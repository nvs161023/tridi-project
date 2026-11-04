import {
  CircleGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Path,
  Shape,
} from "three";
import type { BufferGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { KeychainPresetId } from "@/lib/constructor/keychain-presets";

/**
 * Геометрия новых пресетов брелока.
 *
 * В отличие от прежних силуэтов (`lib/constructor/keychain-shapes.ts`), где
 * форма — это SVG-строка, которую надо разобрать, масштабировать и обрезать под
 * габарит, пресет строится кодом сразу в миллиметрах. Так проще держать
 * пропорции: скругление, отверстие под кольцо и толщина заданы числами, а не
 * «на глаз» после масштабирования.
 *
 * Соглашения те же, что у старой геометрии: основа лежит в плоскости XY,
 * толщина идёт по Z от 0 до `thickness`, центр габарита — в начале координат.
 * Такой файл слайсер ставит на стол без поворотов, а предпросмотр поворачивает
 * группу на -90° вокруг X.
 *
 * Фаска three.js расширяет контур наружу: у середины толщины габарит больше
 * контура Shape на `bevelSize`, а у крышек совпадает с ним. Поэтому профиль
 * строится меньше заданного габарита на фаску — иначе модель выходила бы на
 * 0.8 мм шире, чем обещает панель.
 */

/** Параметры, общие для всех пресетов: габарит и толщина из слайдеров, мм. */
export type KeychainPresetGeometryParams = {
  /** Ширина в самой широкой части, мм. */
  width: number;
  /** Высота сверху вниз, мм. */
  height: number;
  /** Толщина основы вместе с фасками, мм. */
  thickness: number;
};

/** Ширина фаски по контуру: 0.4 мм читается как скругление кромки. */
const PRESET_BEVEL_SIZE_MM = 0.4;

/** Глубина фаски на каждой стороне: входит в толщину, а не добавляется к ней. */
const PRESET_BEVEL_THICKNESS_MM = 0.2;

/** Два сегмента дают фаску из двух полос — её видно, но она не «мылит» кромку. */
const PRESET_BEVEL_SEGMENTS = 2;

/** 32 сегмента на дугу: скругления и отверстие выходят гладкими, без лесенки. */
const PRESET_CURVE_SEGMENTS = 32;

/** Радиус скругления корпуса Apple Tag, мм. */
const APPLE_TAG_CORNER_RADIUS_MM = 4;

/** Диаметр отверстия под кольцо в свету, мм: общий для всех пресетов. */
const RING_HOLE_DIAMETER_MM = 5;

/** Отступ центра отверстия от верхнего края корпуса Apple Tag, мм. */
const APPLE_TAG_RING_HOLE_INSET_MM = 5;

/**
 * Отступ центра отверстия от верхнего края у пресетов с сужающимся верхом, мм.
 *
 * Больше, чем у Apple Tag: у капсулы верх — полукруг, у шестигранника — угол,
 * поэтому отверстие отодвигают вниз, чтобы оно целиком легло в широкую часть и
 * стенка над кольцом осталась ровной, а не клином.
 */
const RING_HOLE_INSET_MM = 8;

/** Радиус скругления углов шестигранника, мм. */
const HEX_CORNER_RADIUS_MM = 2;

/**
 * Скругление углов кирпича, мм.
 *
 * Крупное, потому что основа — прямоугольник 32 × 64: с малым радиусом он
 * цепляется за ключи и колет ладонь в кармане.
 */
const BRICK_CORNER_RADIUS_MM = 8;

/** Шаг сетки шипов, мм: стандарт LEGO, под него же сделаны отверстия в деталях. */
const BRICK_STUD_PITCH_MM = 8;

/**
 * Диаметр шипа, мм.
 *
 * Стандарт LEGO — Ø4.8, но FDM раздаёт пластик наружу на 0.05–0.15 мм, и
 * напечатанный шип Ø4.8 в деталь уже не входит. Ø4.7 отдаёт эти 0.1 мм обратно:
 * брелок садится в LEGO-отверстие с рабочим зазором.
 */
const BRICK_STUD_DIAMETER_MM = 4.7;

/** Высота шипа над верхней площадкой, мм. */
const BRICK_STUD_HEIGHT_MM = 1.7;

/** Высота фаски на верхней кромке шипа, мм. */
const BRICK_STUD_CHAMFER_MM = 0.5;

/** Радиус верхней площадки шипа, мм: фаска снимает 0.5 мм высоты и 0.35 мм радиуса. */
const BRICK_STUD_TOP_RADIUS_MM = 2;

/**
 * Насколько низ шипа утоплен в тело, мм.
 *
 * Тело и шипы сливаются через `mergeGeometries`, а не вычитаются друг из друга:
 * CSG в проекте нет, и литофан, вывеска и подставка собраны так же. Оболочки
 * поэтому должны пересекаться объёмом — касание плоскостями дало бы на верхней
 * грани совпадающие треугольники, и слайсер показал бы самопересечение.
 */
const BRICK_STUD_EMBED_MM = 0.2;

/** Скругление четырёх углов билета, мм: крупное, как у настоящего билета. */
const TICKET_CORNER_RADIUS_MM = 6;

/** Ширина корешка (stub) слева, мм: по нему идёт линия перфорации. */
const TICKET_STUB_WIDTH_MM = 10;

/** Корешок узкой заготовки, мм: при 20 мм ширины 10 мм — это половина детали. */
const TICKET_NARROW_STUB_WIDTH_MM = 8;

/** Ширина, ниже которой корешок сужается, мм: 28 мм ещё даёт корешок 10 мм. */
const TICKET_NARROW_WIDTH_MM = 26;

/** Диаметр отверстия перфорации, мм. */
const TICKET_PERFORATION_DIAMETER_MM = 1.8;

/** Шаг перфорации, мм: перемычка между отверстиями остаётся 1.2 мм в свету. */
const TICKET_PERFORATION_STEP_MM = 3;

/** Отступ линии перфорации от верхнего и нижнего края, мм. */
const TICKET_PERFORATION_INSET_MM = 4;

/** Отступ центра кольца от верхнего края, мм: как у остальных пресетов. */
const TICKET_RING_TOP_INSET_MM = 8;

/** Минимальная перемычка от перфорации до кольца, мм: ближние отверстия снимаются. */
const TICKET_PERFORATION_RING_GAP_MM = 1;

/**
 * Раскладка билета: корешок, линия перфорации и отверстие под кольцо.
 *
 * Общая функция для геометрии и подписи в панели, как `brickStudLayout`: числа
 * на плашке обязаны совпадать с тем, что уедет в STL, поэтому ширина корешка и
 * количество отверстий считаются в одном месте.
 *
 * Корешок — полоса у левой кромки: 10 мм при ширине от 26 мм и 8 мм на узкой
 * заготовке. Уже 8 мм его делать нельзя — отверстию Ø5 мм нужны стенки по
 * 1.5 мм, иначе ушко рвётся под весом ключей. Кольцо стоит по центру корешка в
 * 8 мм от верхнего края, а перфорация идёт по его правой границе от
 * `−height/2 + 4` до `height/2 − 4` с шагом 3 мм: отверстия, которые подошли бы к
 * кольцу ближе 1 мм, из линии снимаются — на узкой заготовке у ушка появляется
 * разрыв, зато перемычка между отверстиями не превращается в щель.
 */
export type TicketLayout = {
  /** Ширина корешка слева, мм. */
  stubWidth: number;
  /** X линии перфорации от центра габарита, мм. */
  perforationX: number;
  /** Y отверстий перфорации от центра габарита, мм; снизу вверх. */
  perforationYs: number[];
  /** X центра отверстия под кольцо от центра габарита, мм. */
  ringX: number;
  /** Y центра отверстия под кольцо от центра габарита, мм. */
  ringY: number;
};

export function ticketLayout(width: number, height: number): TicketLayout {
  const stubWidth = Math.min(
    width >= TICKET_NARROW_WIDTH_MM
      ? TICKET_STUB_WIDTH_MM
      : TICKET_NARROW_STUB_WIDTH_MM,
    // Основная часть не уже 12 мм: иначе билет превращается в корешок.
    Math.max(width - 12, 6),
  );
  const holeRadius = TICKET_PERFORATION_DIAMETER_MM / 2;
  const ringRadius = RING_HOLE_DIAMETER_MM / 2;
  const ringX = -width / 2 + stubWidth / 2;
  const ringY = height / 2 - TICKET_RING_TOP_INSET_MM;
  const perforationX = -width / 2 + stubWidth;
  const firstY = -height / 2 + TICKET_PERFORATION_INSET_MM;
  const lastY = height / 2 - TICKET_PERFORATION_INSET_MM;
  const perforationYs: number[] = [];

  for (
    let y = firstY;
    y <= lastY + 1e-9;
    y += TICKET_PERFORATION_STEP_MM
  ) {
    const distanceToRing = Math.hypot(perforationX - ringX, y - ringY);

    if (distanceToRing >= ringRadius + holeRadius + TICKET_PERFORATION_RING_GAP_MM) {
      perforationYs.push(y);
    }
  }

  return { stubWidth, perforationX, perforationYs, ringX, ringY };
}

/**
 * Пресеты, у которых уже есть геометрия.
 *
 * Список читают панель (подсказка вместо плашки «в работе») и API (422 вместо
 * файла-заглушки), поэтому он один на оба места: разойтись они не могут.
 */
export const IMPLEMENTED_KEYCHAIN_PRESETS: readonly KeychainPresetId[] = [
  "apple-tag",
  "capsule",
  "hex",
  "brick",
  "ticket",
];

/** Готова ли геометрия пресета: остальные три пока строятся старым силуэтом. */
export function isKeychainPresetImplemented(
  presetId: KeychainPresetId,
): boolean {
  return IMPLEMENTED_KEYCHAIN_PRESETS.includes(presetId);
}

/**
 * Контур отверстия под кольцо на высоте `centerY` со смещением `centerX`.
 *
 * Смещение нужно билету: у него кольцо стоит не на оси симметрии, а в корешке.
 * Радиус берётся больше номинального на фаску: у отверстия three.js поджимает
 * стенку на `bevelSize` так же, как расширяет корпус наружу. Центр отсчитывается
 * от номинального габарита, а не от контура крышки: панель обещает миллиметры
 * заготовки, а не профиля выдавливания.
 */
function ringHolePath(centerY: number, centerX = 0): Path {
  const hole = new Path();
  const holeRadius = RING_HOLE_DIAMETER_MM / 2 + PRESET_BEVEL_SIZE_MM;

  hole.absarc(centerX, centerY, holeRadius, 0, Math.PI * 2, true);

  return hole;
}

/**
 * Выдавливает контур в основу с фаской по обеим кромкам.
 *
 * Толщина держится ровно по слайдеру: выдавливание идёт на
 * `thickness − 2 × bevelThickness`, а сдвиг на `bevelThickness` ставит нижнюю
 * грань на Z = 0 — слайсер кладёт модель на стол без поворотов.
 */
function extrudePresetShape(
  shape: Shape,
  thickness: number,
): ExtrudeGeometry {
  const depth = Math.max(thickness - PRESET_BEVEL_THICKNESS_MM * 2, 0.05);
  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: PRESET_BEVEL_SEGMENTS,
    bevelSize: PRESET_BEVEL_SIZE_MM,
    bevelThickness: PRESET_BEVEL_THICKNESS_MM,
    curveSegments: PRESET_CURVE_SEGMENTS,
    depth,
    steps: 1,
  });

  geometry.translate(0, 0, PRESET_BEVEL_THICKNESS_MM);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

/**
 * Скруглённый прямоугольник с отверстием под кольцо — пресет Apple Tag.
 *
 * Корпус — прямоугольник `width × height` со скруглением 4 мм и отверстием
 * Ø5 мм в 5 мм от верхнего края: отдельное ушко не нужно, кольцо проходит сквозь
 * корпус, и брелок не цепляется ушком за ключи. Отверстие вырезано через
 * `shape.holes`, поэтому оно сквозное на всю толщину.
 *
 * Толщина держится ровно по слайдеру: выдавливание идёт на
 * `thickness − 2 × bevelThickness`, а сдвиг на `bevelThickness` ставит нижнюю
 * грань на Z = 0 — так же, как у старой геометрии.
 */
export function buildAppleTag(
  params: KeychainPresetGeometryParams,
): ExtrudeGeometry {
  const bevel = PRESET_BEVEL_SIZE_MM;
  // Профиль Shape — это контур крышки: фаска раздвигает его на bevel наружу.
  const profileWidth = Math.max(params.width - bevel * 2, 1);
  const profileHeight = Math.max(params.height - bevel * 2, 1);
  const radius = Math.min(
    APPLE_TAG_CORNER_RADIUS_MM,
    Math.min(profileWidth, profileHeight) / 2,
  );
  const halfWidth = profileWidth / 2;
  const halfHeight = profileHeight / 2;

  const shape = new Shape();

  shape.moveTo(-halfWidth + radius, -halfHeight);
  shape.lineTo(halfWidth - radius, -halfHeight);
  shape.absarc(
    halfWidth - radius,
    -halfHeight + radius,
    radius,
    -Math.PI / 2,
    0,
    false,
  );
  shape.lineTo(halfWidth, halfHeight - radius);
  shape.absarc(
    halfWidth - radius,
    halfHeight - radius,
    radius,
    0,
    Math.PI / 2,
    false,
  );
  shape.lineTo(-halfWidth + radius, halfHeight);
  shape.absarc(
    -halfWidth + radius,
    halfHeight - radius,
    radius,
    Math.PI / 2,
    Math.PI,
    false,
  );
  shape.lineTo(-halfWidth, -halfHeight + radius);
  shape.absarc(
    -halfWidth + radius,
    -halfHeight + radius,
    radius,
    Math.PI,
    Math.PI * 1.5,
    false,
  );
  shape.closePath();

  // Центр отверстия отсчитывается от номинального габарита, а не от контура
  // крышки: панель обещает 5 мм от края заготовки.
  shape.holes.push(
    ringHolePath(params.height / 2 - APPLE_TAG_RING_HOLE_INSET_MM),
  );

  return extrudePresetShape(shape, params.thickness);
}

/**
 * Капсула с торцами-полукругами и отверстием под кольцо — пресет Capsule.
 *
 * Корпус — прямоугольник `width × height`, у которого верх и низ заменены
 * полукругами радиусом в половину ширины: при 24 × 64 мм это два торца по
 * 12 мм и прямая стенка 40 мм между ними. Углов у такой формы нет, поэтому она
 * не цепляется за ключи и печатается без поддержек.
 *
 * Отверстие Ø5 мм стоит на оси симметрии (X = 0) в 8 мм от верхнего края. Центр
 * верхнего полукруга лежит ниже, поэтому кольцо целиком попадает в плоскую
 * часть торца, а стенка над ним ровная со всех сторон — это и держит прочность
 * ушка при узкой капсуле. Если ширина больше высоты, капсула ложится набок:
 * полукруги уходят на боковые торцы, а отверстие остаётся там же, где обещает
 * панель — по центру и в 8 мм от верхнего края.
 */
export function buildCapsule(
  params: KeychainPresetGeometryParams,
): ExtrudeGeometry {
  const bevel = PRESET_BEVEL_SIZE_MM;
  // Профиль Shape — контур крышки: фаска раздвигает его на bevel наружу.
  const profileWidth = Math.max(params.width - bevel * 2, 1);
  const profileHeight = Math.max(params.height - bevel * 2, 1);
  const halfWidth = profileWidth / 2;
  const halfHeight = profileHeight / 2;
  // Радиус торца — половина ширины, но не больше половины высоты: при широкой
  // заготовке полукруги иначе наехали бы друг на друга.
  const radius = Math.min(halfWidth, halfHeight);
  const shape = new Shape();

  if (halfWidth <= halfHeight) {
    // Вертикальная капсула: торцы сверху и снизу, стенки идут по оси Y.
    // Выше этой точки контур уже закругляется: там начинается верхний торец.
    const topArcCenterY = halfHeight - radius;
    const bottomArcCenterY = -halfHeight + radius;

    shape.moveTo(halfWidth, bottomArcCenterY);
    shape.lineTo(halfWidth, topArcCenterY);
    // Полукруг по верхнему торцу: от правой стенки через верх к левой.
    shape.absarc(0, topArcCenterY, radius, 0, Math.PI, false);
    shape.lineTo(-halfWidth, bottomArcCenterY);
    // Полукруг по нижнему торцу: от левой стенки через низ обратно к правой.
    shape.absarc(0, bottomArcCenterY, radius, Math.PI, Math.PI * 2, false);
  } else {
    // Широкая заготовка: полукруги радиуса halfHeight уже не помещаются между
    // верхом и низом, поэтому капсула ложится набок — торцы слева и справа,
    // стенки параллельны оси X. Иначе контур вылезал бы за габарит.
    const rightArcCenterX = halfWidth - radius;
    const leftArcCenterX = -halfWidth + radius;

    shape.moveTo(leftArcCenterX, -halfHeight);
    shape.lineTo(rightArcCenterX, -halfHeight);
    shape.absarc(rightArcCenterX, 0, radius, -Math.PI / 2, Math.PI / 2, false);
    shape.lineTo(leftArcCenterX, halfHeight);
    shape.absarc(leftArcCenterX, 0, radius, Math.PI / 2, Math.PI * 1.5, false);
  }

  shape.closePath();

  shape.holes.push(ringHolePath(params.height / 2 - RING_HOLE_INSET_MM));

  return extrudePresetShape(shape, params.thickness);
}

/** Точка контура в плоскости XY, мм. */
type ShapePoint = readonly [number, number];

/**
 * Точки, между которыми пройдёт скругление угла.
 *
 * Дуга радиуса `radius`, вписанная в угол с внутренним раствором θ, касается его
 * сторон на расстоянии `radius / tan(θ / 2)` от вершины, и такую же хорду даёт
 * квадратичная кривая с контрольной точкой в самом угле. Отсюда и формула: угол
 * скругляется одним `quadraticCurveTo`, без отдельной математики на дуги.
 * Половина смежной стороны — верхняя граница: у вытянутого шестигранника соседние
 * скругления иначе наехали бы друг на друга и контур пересёкся бы сам с собой.
 */
function cornerRoundPoints(
  corner: ShapePoint,
  previous: ShapePoint,
  next: ShapePoint,
  radius: number,
): { from: ShapePoint; to: ShapePoint } {
  const toPrevious = [previous[0] - corner[0], previous[1] - corner[1]];
  const toNext = [next[0] - corner[0], next[1] - corner[1]];
  const previousLength = Math.hypot(toPrevious[0], toPrevious[1]);
  const nextLength = Math.hypot(toNext[0], toNext[1]);

  if (previousLength === 0 || nextLength === 0) {
    return { from: corner, to: corner };
  }

  // Раствор угла берётся через косинус: acos устойчив и там, где вытянутый
  // шестигранник ушёл от 120°.
  const cosine =
    (toPrevious[0] * toNext[0] + toPrevious[1] * toNext[1]) /
    (previousLength * nextLength);
  const halfAngle = Math.acos(Math.min(Math.max(cosine, -1), 1)) / 2;
  const cut = Math.min(
    radius / Math.tan(halfAngle),
    previousLength / 2,
    nextLength / 2,
  );

  return {
    from: [
      corner[0] + (toPrevious[0] / previousLength) * cut,
      corner[1] + (toPrevious[1] / previousLength) * cut,
    ],
    to: [
      corner[0] + (toNext[0] / nextLength) * cut,
      corner[1] + (toNext[1] / nextLength) * cut,
    ],
  };
}

/**
 * Насколько скругление отступает от самой вершины по вертикали, мм.
 *
 * Квадратичная кривая до вершины не доходит: её крайняя точка — среднее
 * `(A + 2V + B) / 4`, где A и B — концы скругления, а V — сам угол. Эта величина
 * и решает габарит шестигранника: сверху и снизу крайние точки — вершины.
 */
function cornerApexInset(
  corner: ShapePoint,
  previous: ShapePoint,
  next: ShapePoint,
  radius: number,
): number {
  const round = cornerRoundPoints(corner, previous, next, radius);

  return corner[1] - (round.from[1] + corner[1] * 2 + round.to[1]) / 4;
}

/** Шесть углов шестигранника против часовой стрелки, начиная с верхнего. */
function hexCorners(halfWidth: number, halfHeight: number): ShapePoint[] {
  return [
    [0, halfHeight],
    [-halfWidth, halfHeight / 2],
    [-halfWidth, -halfHeight / 2],
    [0, -halfHeight],
    [halfWidth, -halfHeight / 2],
    [halfWidth, halfHeight / 2],
  ];
}

/**
 * Контур многоугольника с углами, скруглёнными квадратичными кривыми.
 *
 * Общий шаг для шестигранника и кирпича: углы обходятся против часовой стрелки,
 * каждый угол даёт одну кривую с контрольной точкой в самой вершине, между
 * углами остаются прямые грани. Точки касания считает `cornerRoundPoints`,
 * поэтому скругление само ужимается на вытянутом контуре и не пересекает
 * соседнее.
 */
function roundedPolygonShape(
  corners: readonly ShapePoint[],
  radius: number,
): Shape {
  const rounds = corners.map((corner, index) =>
    cornerRoundPoints(
      corner,
      corners[(index + corners.length - 1) % corners.length],
      corners[(index + 1) % corners.length],
      radius,
    ),
  );
  const shape = new Shape();

  shape.moveTo(rounds[0].from[0], rounds[0].from[1]);

  rounds.forEach((round, index) => {
    shape.quadraticCurveTo(
      corners[index][0],
      corners[index][1],
      round.to[0],
      round.to[1],
    );
    // Угол закругляется кривой, а между углами идёт прямая грань.
    if (index < rounds.length - 1) {
      const nextRound = rounds[index + 1];

      shape.lineTo(nextRound.from[0], nextRound.from[1]);
    }
  });
  shape.closePath();

  return shape;
}

/**
 * Шестигранник со скруглёнными углами и отверстием под кольцо — пресет Hex.
 *
 * Острые вершины смотрят вверх и вниз, бока — две вертикальные стенки: так
 * шестигранник точно ложится в габарит `width × height` из слайдеров. При
 * 34 × 40 он отличается от правильного на доли градуса (у правильного высота
 * равна `width × 2 / √3` = 39.3 мм), а на крайних значениях просто растягивается.
 * Углы скруглены на 2 мм: острых кромок в кармане не остаётся, и кольцо не
 * прорезает ушко насквозь.
 *
 * Отверстие Ø5 мм стоит на оси симметрии в 8 мм от верхнего края. Верх здесь —
 * угол, а не прямая кромка, поэтому мало отступить от вершины: важно, что
 * расстояние до двух наклонных граней (около 7.2 мм при 34 × 40) оставляет над
 * кольцом стенку 4.7 мм, и ушко не рвётся при ключах. На самом узком соотношении
 * габарита (50 × 100) стенка проседает до 3.7 мм — это всё ещё втрое толще стенки
 * сопла 0.4 мм.
 */
export function buildHex(params: KeychainPresetGeometryParams): ExtrudeGeometry {
  const bevel = PRESET_BEVEL_SIZE_MM;
  // Профиль Shape — контур крышки: фаска раздвигает его на bevel наружу.
  const halfWidth = Math.max(params.width - bevel * 2, 1) / 2;
  // Ширину задают вертикальные стенки, а высоту — вершины, и скругление срезает
  // как раз их. Поэтому углы ставятся дальше на это срезание: иначе после фаски
  // высота вышла бы меньше слайдера почти на 0.6 мм. Срезание зависит от
  // раствора угла, а тот — от самой полувысоты, поэтому поправка уточняется в
  // три прохода: она меняется в десятки раз медленнее себя, и остаток уходит в
  // тысячные доли миллиметра.
  const apexHalfHeight = Math.max(params.height - bevel * 2, 1) / 2;
  let corners = hexCorners(halfWidth, apexHalfHeight);

  for (let pass = 0; pass < 3; pass += 1) {
    const inset = cornerApexInset(
      corners[0],
      corners[corners.length - 1],
      corners[1],
      HEX_CORNER_RADIUS_MM,
    );

    corners = hexCorners(halfWidth, apexHalfHeight + inset);
  }

  const shape = roundedPolygonShape(corners, HEX_CORNER_RADIUS_MM);

  shape.holes.push(ringHolePath(params.height / 2 - RING_HOLE_INSET_MM));

  return extrudePresetShape(shape, params.thickness);
}

/**
 * Сколько шипов встаёт по стороне `dimension` при шаге 8 мм.
 *
 * Сетка отступает от кромки на половину шага, поэтому крайний шип стоит в 4 мм
 * от края и в 1.6 мм от кромки — так же, как у настоящей детали. Это и есть
 * `floor((dimension − 8) / 8) + 1`: «+1» — первый шип, «−8» — два отступа.
 */
function brickStudLineCount(dimension: number): number {
  return Math.max(
    1,
    Math.floor((dimension - BRICK_STUD_PITCH_MM) / BRICK_STUD_PITCH_MM) + 1,
  );
}

/** Раскладка шипов на кирпиче: сколько их и как они стоят. */
export type BrickStudLayout = {
  /** Шипов поперёк ширины. */
  columns: number;
  /** Рядов по высоте; верхний ряд снят под отверстие. */
  rows: number;
  /** Всего шипов. */
  total: number;
};

/**
 * Раскладка шипов для габарита — общая для геометрии и подписи в панели.
 *
 * Верхний ряд снимается всегда: отверстие Ø5 мм стоит в 8 мм от верхнего края,
 * то есть как раз в полосе верхнего ряда. У 32 × 64 шипы этого ряда проходят в
 * 5.66 мм от центра отверстия при сумме радиусов 4.85 мм и кольцо не задевают —
 * ряд снимается ради гладкой полосы под кольцо. Зато при 50 × 100 и 20 × 30
 * тот же шип подходит на 4.47 и 4.12 мм и врезался бы в отверстие.
 */
export function brickStudLayout(width: number, height: number): BrickStudLayout {
  const columns = brickStudLineCount(width);
  const rows = Math.max(brickStudLineCount(height) - 1, 1);

  return { columns, rows, total: columns * rows };
}

/**
 * Центры шипов, мм: сетка от центра габарита, без верхнего ряда.
 *
 * Ряды после снятия не пересчитываются: сетка остаётся на своей высоте, сверху
 * освобождается полоса. Иначе шипы съехали бы к отверстию и потеряли шаг 8 мм
 * относительно соседних деталей.
 */
function brickStudCenters(width: number, height: number): ShapePoint[] {
  const { columns, rows } = brickStudLayout(width, height);
  const startX = -((columns - 1) * BRICK_STUD_PITCH_MM) / 2;
  const startY = -((brickStudLineCount(height) - 1) * BRICK_STUD_PITCH_MM) / 2;
  const centers: ShapePoint[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      centers.push([
        startX + column * BRICK_STUD_PITCH_MM,
        startY + row * BRICK_STUD_PITCH_MM,
      ]);
    }
  }

  return centers;
}

/**
 * Оболочка одного шипа: цилиндр Ø4.7 мм с фаской на верхней кромке.
 *
 * Шип собран из четырёх кусков — стенки, конуса фаски и двух донышек, — а не из
 * двух готовых цилиндров: у стопки цилиндров совпадающие диски остаются внутри
 * оболочки, и рёбра колец сходятся по три, то есть сетка перестаёт быть
 * watertight. Каждый кусок здесь замкнут, кольца соседних кусков совпадают по
 * вершинам, а низ шипа уходит в тело на `BRICK_STUD_EMBED_MM`.
 */
function brickStudGeometry(): BufferGeometry {
  const radius = BRICK_STUD_DIAMETER_MM / 2;
  const baseZ = -BRICK_STUD_EMBED_MM;
  // Фаска начинается на 0.5 мм ниже верха: цилиндрическая часть шипа — 1.2 мм.
  const wallTopZ = BRICK_STUD_HEIGHT_MM - BRICK_STUD_CHAMFER_MM;
  const wallHeight = wallTopZ - baseZ;
  const segments = PRESET_CURVE_SEGMENTS;
  // CylinderGeometry строится вдоль Y: поворот на 90° ставит ось шипа по Z.
  const wall = new CylinderGeometry(
    radius,
    radius,
    wallHeight,
    segments,
    1,
    true,
  );

  wall.rotateX(Math.PI / 2);
  wall.translate(0, 0, baseZ + wallHeight / 2);

  const chamfer = new CylinderGeometry(
    BRICK_STUD_TOP_RADIUS_MM,
    radius,
    BRICK_STUD_CHAMFER_MM,
    segments,
    1,
    true,
  );

  chamfer.rotateX(Math.PI / 2);
  chamfer.translate(0, 0, wallTopZ + BRICK_STUD_CHAMFER_MM / 2);

  // Донышки — плоские многоугольники: верхнее смотрит вверх, нижнее вниз.
  const top = new CircleGeometry(BRICK_STUD_TOP_RADIUS_MM, segments);

  top.translate(0, 0, BRICK_STUD_HEIGHT_MM);

  const bottom = new CircleGeometry(radius, segments);

  bottom.rotateX(Math.PI);
  bottom.translate(0, 0, baseZ);

  const pieces = [wall, chamfer, top, bottom];
  const merged = mergeGeometries(pieces);

  for (const piece of pieces) {
    piece.dispose();
  }

  if (!merged) {
    throw new Error("Не удалось собрать оболочку шипа кирпича");
  }

  // Тело кирпича выдавливается без индекса, поэтому и шип отдаётся без него.
  const stud = merged.toNonIndexed();

  merged.dispose();

  return stud;
}


/**
 * LEGO-кирпич с шипами и отверстием под кольцо — пресет Brick.
 *
 * Основа — прямоугольник `width × height` (по умолчанию 32 × 64, то есть плита
 * четыре на восемь), углы скруглены на 8 мм: у такой формы нет кромок, за
 * которые цепляются ключи, и она не колет ладонь в кармане.
 *
 * Сверху — шипы Ø4.7 мм, высота 1.7 мм, шаг 8 мм, фаска 0.5 мм по верхней
 * кромке. Шаг и высота взяты из стандарта LEGO, поэтому брелок стыкуется с
 * обычными деталями, а 32 × 64 — это ровно 4 × 8 шипов. Диаметр на 0.1 мм
 * меньше стандартного Ø4.8: FDM раздаёт пластик наружу на 0.05–0.15 мм, и
 * напечатанный шип в LEGO-отверстие уже не входит. Сетка считается от центра
 * габарита, верхний ряд снят под отверстие (`brickStudLayout`).
 *
 * Габарит от шипов не растёт: крайний шип стоит в 4 мм от кромки при радиусе
 * 2.35 мм, то есть до края остаётся 1.65 мм. Исключение — углы: у 32 × 64 шип в
 * углу выступает за дугу скругления на 0.6 мм и висит крошечным козырьком над
 * фаской. Это осознанная плата за честный шаг 8 мм: у настоящих деталей LEGO
 * углы квадратные, а брелок без скругления царапается в кармане.
 *
 * Компенсация габарита, как у шестигранника, здесь не нужна: крайние точки
 * прямоугольника — середины прямых сторон, и скругление их не трогает даже на
 * крайних значениях слайдеров (20 × 30): срез 8 мм меньше половины короткой
 * стороны профиля (9.6 мм), поэтому радиус не поджимается, а посередине
 * короткой стороны остаётся прямая грань 3.2 мм.
 *
 * Отверстие Ø5 мм — на оси симметрии в 8 мм от верхнего края, верхняя кромка
 * горизонтальная, поэтому пластик над кольцом всегда один и тот же: 4.7 мм у
 * крышек и 5.5 мм на середине толщины, при любом размере заготовки.
 */
export function buildBrick(
  params: KeychainPresetGeometryParams,
): BufferGeometry {
  const bevel = PRESET_BEVEL_SIZE_MM;
  // Профиль Shape — контур крышки: фаска раздвигает его на bevel наружу.
  const halfWidth = Math.max(params.width - bevel * 2, 1) / 2;
  const halfHeight = Math.max(params.height - bevel * 2, 1) / 2;
  const corners: ShapePoint[] = [
    [halfWidth, halfHeight],
    [-halfWidth, halfHeight],
    [-halfWidth, -halfHeight],
    [halfWidth, -halfHeight],
  ];

  const shape = roundedPolygonShape(corners, BRICK_CORNER_RADIUS_MM);

  shape.holes.push(ringHolePath(params.height / 2 - RING_HOLE_INSET_MM));

  const body = extrudePresetShape(shape, params.thickness);
  const stud = brickStudGeometry();
  const parts: BufferGeometry[] = [body];

  // Шип стоит на верхней грани: низ утоплен в тело, верх поднят на 1.7 мм.
  for (const [x, y] of brickStudCenters(params.width, params.height)) {
    parts.push(stud.clone().translate(x, y, params.thickness));
  }

  stud.dispose();

  const brick = mergeGeometries(parts);

  for (const part of parts) {
    part.dispose();
  }

  if (!brick) {
    throw new Error("Не удалось соединить кирпич и шипы");
  }

  brick.computeBoundingBox();
  brick.computeBoundingSphere();

  return brick;
}

/**
 * Билет с корешком, линией перфорации и отверстием под кольцо — пресет Ticket.
 *
 * Корпус — прямоугольник `width × height` (28 × 60 по умолчанию) с углами,
 * скруглёнными на 6 мм: крупное скругление и есть то, что отличает билет от
 * бруска. Слева идёт корешок шириной 10 мм (8 мм на узкой заготовке) — от него
 * отделена основная часть линией сквозных отверстий Ø1.8 мм с шагом 3 мм. Линия
 * идёт по правой границе корешка от `−height/2 + 4` до `height/2 − 4`, то есть не
 * доходит до скруглений, где отверстие вышло бы на кромку. Отверстие под кольцо
 * Ø5 мм стоит в корешке, а не по центру верхней грани: при 28 × 60 его центр
 * приходится на X = −9, Y = 22, стенка до кромки — 2.5 мм, до линии перфорации —
 * 1.6 мм (0.8 мм на крышках, где фаска раскрывает отверстия).
 *
 * Контур обходится против часовой стрелки и построен точными дугами `absarc`:
 * на радиусе 6 мм квадратичная кривая ушла бы от окружности почти на 0.4 мм, и
 * угол выглядел бы приплюснутым. Габарит от этого не страдает — крайние точки
 * лежат на серединах прямых участков стенок, а фаска расширяет их ровно до
 * `width × height`.
 *
 * Отверстия перфорации и кольца добавляются в `shape.holes`, поэтому они
 * сквозные на всю толщину, и каждая оболочка остаётся замкнутой. Тиснёной
 * рамки по контуру нет: канавка 0.5 мм — это второй уровень выдавливания, а
 * пресет собирается одним `ExtrudeGeometry`, как и остальные.
 */
export function buildTicket(
  params: KeychainPresetGeometryParams,
): ExtrudeGeometry {
  const bevel = PRESET_BEVEL_SIZE_MM;
  // Профиль Shape — контур крышки: фаска раздвигает его на bevel наружу.
  const halfWidth = Math.max(params.width - bevel * 2, 1) / 2;
  const halfHeight = Math.max(params.height - bevel * 2, 1) / 2;
  // Скругление поджимается под половину габарита: на узкой заготовке углы иначе
  // наехали бы друг на друга.
  const corner = Math.min(TICKET_CORNER_RADIUS_MM, halfWidth, halfHeight);
  const layout = ticketLayout(params.width, params.height);
  const shape = new Shape();

  // Обход против часовой стрелки: нижняя кромка слева направо, правая стенка,
  // верхняя кромка справа налево, левая стенка.
  shape.moveTo(-halfWidth + corner, -halfHeight);
  shape.lineTo(halfWidth - corner, -halfHeight);
  // Правый нижний угол: от нижней кромки к правой стенке.
  shape.absarc(
    halfWidth - corner,
    -halfHeight + corner,
    corner,
    -Math.PI / 2,
    0,
    false,
  );
  shape.lineTo(halfWidth, halfHeight - corner);
  // Правый верхний угол: от правой стенки к верхней кромке.
  shape.absarc(
    halfWidth - corner,
    halfHeight - corner,
    corner,
    0,
    Math.PI / 2,
    false,
  );
  shape.lineTo(-halfWidth + corner, halfHeight);
  // Левый верхний угол.
  shape.absarc(
    -halfWidth + corner,
    halfHeight - corner,
    corner,
    Math.PI / 2,
    Math.PI,
    false,
  );
  shape.lineTo(-halfWidth, -halfHeight + corner);
  // Левый нижний угол: возврат к началу контура.
  shape.absarc(
    -halfWidth + corner,
    -halfHeight + corner,
    corner,
    Math.PI,
    Math.PI * 1.5,
    false,
  );
  shape.closePath();

  // Линия перфорации: каждое отверстие — отдельная дырка в контуре. Радиус
  // больше номинала на фаску: на середине толщины three.js поджимает отверстие
  // на bevelSize, и без добавки в свету осталось бы 0.5 мм вместо 0.9 мм.
  for (const y of layout.perforationYs) {
    const perforation = new Path();

    perforation.absarc(
      layout.perforationX,
      y,
      TICKET_PERFORATION_DIAMETER_MM / 2 + bevel,
      0,
      Math.PI * 2,
      true,
    );
    shape.holes.push(perforation);
  }

  shape.holes.push(ringHolePath(layout.ringY, layout.ringX));

  return extrudePresetShape(shape, params.thickness);
}

/**
 * Геометрия выбранного пресета.
 *
 * null означает «пресет ещё не реализован»: панель по этому же признаку гасит
 * кнопку скачивания, а API отвечает 422, поэтому заглушка не может уехать в
 * печать как правдоподобная модель.
 */
export function buildKeychainPresetGeometry(
  presetId: KeychainPresetId,
  params: KeychainPresetGeometryParams,
): BufferGeometry | null {
  switch (presetId) {
    case "apple-tag":
      return buildAppleTag(params);
    case "capsule":
      return buildCapsule(params);
    case "hex":
      return buildHex(params);
    case "brick":
      return buildBrick(params);
    case "ticket":
      return buildTicket(params);
    default:
      return null;
  }
}
