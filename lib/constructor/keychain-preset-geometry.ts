import { ExtrudeGeometry, Path, Shape } from "three";

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
 * Пресеты, у которых уже есть геометрия.
 *
 * Список читают панель (подсказка вместо плашки «в работе») и API (422 вместо
 * файла-заглушки), поэтому он один на оба места: разойтись они не могут.
 */
export const IMPLEMENTED_KEYCHAIN_PRESETS: readonly KeychainPresetId[] = [
  "apple-tag",
  "capsule",
  "hex",
];

/** Готова ли геометрия пресета: остальные пять пока строятся старым силуэтом. */
export function isKeychainPresetImplemented(
  presetId: KeychainPresetId,
): boolean {
  return IMPLEMENTED_KEYCHAIN_PRESETS.includes(presetId);
}

/**
 * Контур отверстия под кольцо на высоте `centerY` по оси симметрии.
 *
 * Радиус берётся больше номинального на фаску: у отверстия three.js поджимает
 * стенку на `bevelSize` так же, как расширяет корпус наружу. Центр отсчитывается
 * от номинального габарита, а не от контура крышки: панель обещает миллиметры
 * заготовки, а не профиля выдавливания.
 */
function ringHolePath(centerY: number): Path {
  const hole = new Path();
  const holeRadius = RING_HOLE_DIAMETER_MM / 2 + PRESET_BEVEL_SIZE_MM;

  hole.absarc(0, centerY, holeRadius, 0, Math.PI * 2, true);

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

  const rounds = corners.map((corner, index) =>
    cornerRoundPoints(
      corner,
      corners[(index + corners.length - 1) % corners.length],
      corners[(index + 1) % corners.length],
      HEX_CORNER_RADIUS_MM,
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

  shape.holes.push(ringHolePath(params.height / 2 - RING_HOLE_INSET_MM));

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
): ExtrudeGeometry | null {
  switch (presetId) {
    case "apple-tag":
      return buildAppleTag(params);
    case "capsule":
      return buildCapsule(params);
    case "hex":
      return buildHex(params);
    default:
      return null;
  }
}
