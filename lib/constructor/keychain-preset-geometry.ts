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

/**
 * Скругление четырёх углов билета, мм.
 *
 * Меньше, чем у остальных пресетов: у настоящего билета угол почти прямой, а
 * 6 мм превращали силуэт в капсулу.
 */
const TICKET_CORNER_RADIUS_MM = 4;

/**
 * Доля высоты, уходящая под отрывной корешок.
 *
 * У бумажных билетов корешок — 25–33 % длины; 28 % попадает в середину вилки и
 * оставляет основной части место под надпись.
 */
const TICKET_STUB_SHARE = 0.28;

/** Корешок не ниже 12 мм: в нём должны уместиться полоса номера и штрихкода. */
const TICKET_STUB_MIN_MM = 12;

/** Корешок не выше 22 мм: на длинной заготовке он иначе съедает четверть детали. */
const TICKET_STUB_MAX_MM = 22;

/** Длина щели перфорации по ширине, мм. */
const TICKET_SLOT_LENGTH_MM = 4;

/** Высота щели в свету, мм: сквозной прокол, который перемычка держит от разрыва. */
const TICKET_SLOT_HEIGHT_MM = 0.9;

/** Перемычка между щелями, мм: 2.6 мм держат нагрузку и читаются как пунктир. */
const TICKET_SLOT_GAP_MM = 2.6;

/** Шаг между центрами щелей, мм: длина щели плюс перемычка. */
const TICKET_SLOT_STEP_MM = TICKET_SLOT_LENGTH_MM + TICKET_SLOT_GAP_MM;

/** Поле от боковой кромки до крайней щели, мм: щель не сливается с кромочным вырезом. */
const TICKET_SLOT_EDGE_MARGIN_MM = 4;

/** Радиус полукруглого выреза на боковой кромке, мм: «зацеп» линии отрыва. */
const TICKET_NOTCH_RADIUS_MM = 2.5;

/** Диаметр пятака проушины, мм. */
const TICKET_TAB_DIAMETER_MM = 11;

/** Выступ проушины над верхней кромкой билета, мм. */
const TICKET_TAB_PROTRUSION_MM = 4;

/** Лучей у вспышки: восемь вершин через 45° читаются как звезда, а не шестерня. */
const STARBURST_RAY_COUNT = 8;

/** Шаг между лучами, °. */
const STARBURST_RAY_PITCH_DEG = 360 / STARBURST_RAY_COUNT;

/** Поле от кромки заготовки до кончика луча, мм. */
const STARBURST_EDGE_MARGIN_MM = 2;

/**
 * Доля внешнего радиуса, остающаяся на впадину между лучами.
 *
 * Глубина в 35 % радиуса — компромисс между силуэтом и скруглением кончика: при
 * более глубоких впадинах дуга R2 на кончике съедает вершину на 3 мм, и чтобы
 * габарит остался равен номиналу, лучи пришлось бы вытянуть в иглы.
 */
const STARBURST_INNER_SHARE = 0.65;

/** Радиус впадины не меньше этого: отверстие Ø5 мм плюс стенка 3 мм, мм. */
const STARBURST_INNER_MIN_MM = RING_HOLE_DIAMETER_MM / 2 + 3;

/** Скругление кончика луча, мм: острый кончик колет ладонь и скалывается. */
const STARBURST_TIP_RADIUS_MM = 2;

/** Скругление впадины, мм: в полтора раза меньше кончика, иначе впадина — волна. */
const STARBURST_VALLEY_RADIUS_MM = 1.5;

/**
 * Доля ребра луча под прямыми участками между скруглениями.
 *
 * Если оставить меньше, луч превращается в иглу: на 20 мм брелоке два скругления
 * иначе смыкаются, и контур пересекает сам себя.
 */
const STARBURST_STRAIGHT_SHARE = 0.8;

/**
 * Проходов уточнения луча.
 *
 * Скругление кончика срезает вершину, а срезание зависит от раствора угла, тот —
 * от выноса вершины: поправка уточняется итеративно, как у шестигранника, но
 * здесь она меняет угол в разы сильнее, поэтому проходов больше.
 */
const STARBURST_SOLVE_PASSES = 80;

/**
 * Раскладка билета: корешок снизу, линия отрыва со щелями и проушина.
 *
 * Общая функция для геометрии и подписи в панели, как `brickStudLayout`: числа
 * на плашке обязаны совпадать с тем, что уедет в STL, поэтому высота корешка,
 * число щелей и положение кольца считаются в одном месте.
 *
 * Корешок — полоса у нижней кромки, поперёк ширины: 28 % высоты в вилке 12–22 мм.
 * Линия отрыва идёт по его верхней границе и упирается в полукруглые вырезы на
 * обеих боковых кромках — так она «выходит на кромку», как у бумажного билета.
 * Проушина выступает над верхней кромкой на 4 мм, поэтому габарит по высоте на
 * эти 4 мм больше слайдера: `height` остаётся длиной самого билета.
 */
export type TicketLayout = {
  /** Высота корешка снизу, мм. */
  stubHeight: number;
  /** Y линии отрыва от центра габарита, мм: по ней идут щели и кромочные вырезы. */
  perforationY: number;
  /** Щелей в линии перфорации. */
  slotCount: number;
  /** Щелей в ряду: линия одна, поэтому совпадает с `slotCount`. */
  slotsPerRow: number;
  /** Шаг между центрами щелей, мм. */
  slotStep: number;
  /** X центров щелей от центра габарита, мм; слева направо. */
  slotXs: number[];
  /** Y центра отверстия под кольцо — он же центр пятака проушины, мм. */
  ringY: number;
  /** Выступ проушины над верхней кромкой билета, мм. */
  tabProtrusion: number;
};

export function ticketLayout(width: number, height: number): TicketLayout {
  // Корешок снизу: доля высоты в вилке 12–22 мм и не больше половины заготовки —
  // иначе от билета остаётся один корешок.
  const stubHeight = Math.min(
    Math.max(height * TICKET_STUB_SHARE, TICKET_STUB_MIN_MM),
    TICKET_STUB_MAX_MM,
    height / 2,
  );
  // Полоса под щели: от кромки до кромки без полей. Крайняя щель должна уложиться
  // целиком, поэтому от полосы отнимается длина щели, а не шаг.
  const slotField = Math.max(
    width - TICKET_SLOT_EDGE_MARGIN_MM * 2,
    TICKET_SLOT_LENGTH_MM,
  );
  const slotCount = Math.max(
    1,
    Math.floor((slotField + TICKET_SLOT_GAP_MM) / TICKET_SLOT_STEP_MM),
  );
  const slotSpan =
    slotCount * TICKET_SLOT_LENGTH_MM + (slotCount - 1) * TICKET_SLOT_GAP_MM;
  const slotXs = Array.from(
    { length: slotCount },
    (_, index) =>
      -slotSpan / 2 + TICKET_SLOT_LENGTH_MM / 2 + index * TICKET_SLOT_STEP_MM,
  );
  // Проушина выступает над верхней кромкой ровно на 4 мм, поэтому центр пятака
  // лежит на 1.5 мм ниже кромки: 5.5 − 4 = 1.5 при пятаке Ø11.
  const ringY =
    height / 2 + TICKET_TAB_PROTRUSION_MM - TICKET_TAB_DIAMETER_MM / 2;

  return {
    stubHeight,
    perforationY: -height / 2 + stubHeight,
    slotCount,
    slotsPerRow: slotCount,
    slotStep: TICKET_SLOT_STEP_MM,
    slotXs,
    ringY,
    tabProtrusion: TICKET_TAB_PROTRUSION_MM,
  };
}

/**
 * Раскладка вспышки: лучи, впадины и скругления Starburst.
 *
 * Общая функция для геометрии и подписи в панели, как `ticketLayout`: числа на
 * плашке обязаны совпадать с тем, что уедет в STL.
 *
 * Звезда вписывается в квадрат по меньшей стороне слайдера: лучи одинаковой
 * длины, а разница `width × length` уходит в поле по краям. Внешний радиус — это
 * профиль контура, то есть номинал минус поле 2 мм и минус фаска; на готовой
 * модели фаска раздвигает контур обратно, и габарит совпадает с `sizeMm`.
 *
 * Скругление кончика срезает вершину луча, поэтому сама вершина выносится
 * дальше внешнего радиуса ровно на срезание — так габарит остаётся равен
 * `sizeMm`, а не теряет 2 мм на каждом луче. Срезание зависит от угла при
 * кончике, угол — от выноса вершины, поэтому положение вершины ищется
 * итеративно, и на малых размерах скругления поджимаются: иначе два соседних
 * скругления на одном ребре сомкнулись бы и контур пересёк сам себя.
 */
export type StarburstLayout = {
  /** Лучей у вспышки. */
  rayCount: number;
  /** Шаг между лучами, °. */
  pitchDeg: number;
  /** Габарит модели по обеим осям, мм: меньшая сторона слайдера минус поле. */
  sizeMm: number;
  /** Радиус кончика луча в профиле контура, мм. */
  outerRadius: number;
  /** Радиус впадины между лучами, мм. */
  innerRadius: number;
  /** Разница внешнего и внутреннего радиуса, мм: глубина впадины. */
  valleyDepth: number;
  /** Радиус математической вершины луча: вынесен на срезание скругления, мм. */
  apexRadius: number;
  /** Угол между рёбрами луча, °. */
  tipAngleDeg: number;
  /** Радиус скругления кончика, мм: 2 мм, если влезает между впадинами. */
  tipRadius: number;
  /** Радиус скругления впадины, мм. */
  valleyRadius: number;
  /** Длина ребра от впадины до вершины, мм. */
  edgeLengthMm: number;
  /** Доля ребра, остающаяся прямой между скруглениями, %. */
  straightSharePct: number;
  /** Стенка между впадиной и отверстием Ø5 мм, мм. */
  rimWidthMm: number;
};

export function starburstLayout(
  width: number,
  height: number,
): StarburstLayout {
  const bevel = PRESET_BEVEL_SIZE_MM;
  const sizeMm = Math.max(
    Math.min(width, height) - STARBURST_EDGE_MARGIN_MM * 2,
    STARBURST_INNER_MIN_MM * 2,
  );
  const outerRadius = Math.max((sizeMm - bevel * 2) / 2, 1);
  // Впадина не может подойти к центру ближе стенки кольца: иначе отверстие
  // вырвет кромку при первом же рывке за ключи.
  const innerRadius = Math.min(
    Math.max(outerRadius * STARBURST_INNER_SHARE, STARBURST_INNER_MIN_MM),
    outerRadius - 1.5,
  );
  const halfPitch = (STARBURST_RAY_PITCH_DEG / 2) * (Math.PI / 180);
  const sinPitch = Math.sin(halfPitch);
  const cosPitch = Math.cos(halfPitch);
  // Раствор угла при кончике: он и решает, насколько скругление срежет вершину.
  const tipAngle = (apex: number): number =>
    2 * Math.atan((innerRadius * sinPitch) / (apex - innerRadius * cosPitch));

  let apexRadius = outerRadius;
  let tipRadius = STARBURST_TIP_RADIUS_MM;
  let valleyRadius = STARBURST_VALLEY_RADIUS_MM;

  for (let pass = 0; pass < STARBURST_SOLVE_PASSES; pass += 1) {
    const halfAngle = tipAngle(apexRadius) / 2;
    const nextApex =
      outerRadius + tipRadius / Math.sin(halfAngle) - tipRadius;
    const edgeLength = Math.hypot(
      nextApex - innerRadius * cosPitch,
      innerRadius * sinPitch,
    );
    // Угол при впадине — по теореме косинусов в треугольнике из двух лучей.
    const valleyChord = 2 * innerRadius * sinPitch;
    const cosine =
      1 - (valleyChord * valleyChord) / (2 * edgeLength * edgeLength);
    const valleyHalf = Math.acos(Math.min(Math.max(cosine, -1), 1)) / 2;
    const tipCut = STARBURST_TIP_RADIUS_MM / Math.tan(halfAngle);
    const valleyCut = STARBURST_VALLEY_RADIUS_MM / Math.tan(valleyHalf);
    const scale = Math.min(
      1,
      (STARBURST_STRAIGHT_SHARE * edgeLength) / (tipCut + valleyCut),
    );

    apexRadius = nextApex;
    tipRadius = STARBURST_TIP_RADIUS_MM * scale;
    valleyRadius = STARBURST_VALLEY_RADIUS_MM * scale;
  }

  const halfAngle = tipAngle(apexRadius) / 2;
  const tipCut = tipRadius / Math.tan(halfAngle);
  const edgeLength = Math.hypot(
    apexRadius - innerRadius * cosPitch,
    innerRadius * sinPitch,
  );
  const valleyChord = 2 * innerRadius * sinPitch;
  const cosine = 1 - (valleyChord * valleyChord) / (2 * edgeLength * edgeLength);
  const valleyHalf = Math.acos(Math.min(Math.max(cosine, -1), 1)) / 2;
  const valleyCut = valleyRadius / Math.tan(valleyHalf);

  return {
    rayCount: STARBURST_RAY_COUNT,
    pitchDeg: STARBURST_RAY_PITCH_DEG,
    sizeMm,
    outerRadius,
    innerRadius,
    valleyDepth: outerRadius - innerRadius,
    apexRadius,
    tipAngleDeg: (halfAngle * 360) / Math.PI,
    tipRadius,
    valleyRadius,
    edgeLengthMm: edgeLength,
    straightSharePct: ((edgeLength - tipCut - valleyCut) / edgeLength) * 100,
    rimWidthMm: innerRadius - RING_HOLE_DIAMETER_MM / 2,
  };
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
  "starburst",
];

/** Готова ли геометрия пресета: остальные два пока строятся старым силуэтом. */
export function isKeychainPresetImplemented(
  presetId: KeychainPresetId,
): boolean {
  return IMPLEMENTED_KEYCHAIN_PRESETS.includes(presetId);
}

/**
 * Контур отверстия под кольцо на высоте `centerY` по оси симметрии.
 *
 * Кольцо у всех пресетов стоит на оси X = 0: у билета проушина с пятаком теперь
 * по центру верхней кромки, а не в корешке. Радиус берётся больше номинального
 * на фаску: у отверстия three.js поджимает стенку на `bevelSize` так же, как
 * расширяет корпус наружу. Центр отсчитывается от номинального габарита, а не от
 * контура крышки: панель обещает миллиметры заготовки, а не профиля выдавливания.
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

/** Точка на окружности радиуса `radius` под углом `angle` (радианы), мм. */
function polarPoint(radius: number, angle: number): ShapePoint {
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
}

/** Единичный вектор из `from` в `to`: направление ребра без длины. */
function unitVector(from: ShapePoint, to: ShapePoint): ShapePoint {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);

  if (length === 0) {
    return [0, 0];
  }

  return [(to[0] - from[0]) / length, (to[1] - from[1]) / length];
}

/** Точка начала дуги скругления по её центру, радиусу и углу, мм. */
function arcStart(
  center: ShapePoint,
  radius: number,
  angle: number,
): ShapePoint {
  return [
    center[0] + radius * Math.cos(angle),
    center[1] + radius * Math.sin(angle),
  ];
}

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
 * Щель перфорации: капсула 4 × 0.9 мм с закруглёнными торцами и центром в (x, y).
 *
 * Радиус и прямая часть больше номинала на фаску: на середине толщины three.js
 * поджимает отверстие на `bevelSize`, и без добавки щель в свету вышла бы
 * 0.1 × 3.2 мм вместо 0.9 × 4. Торцы скруглены на половину высоты, поэтому у
 * капсулы нет углов, в которых фаска сходится клином и ломает сетку.
 *
 * Обход по часовой стрелке — как у остальных отверстий: three.js сам приводит
 * дырки к обратному обходу, но одинаковое направление читается легче.
 */
function ticketSlotPath(x: number, y: number): Path {
  const radius = TICKET_SLOT_HEIGHT_MM / 2 + PRESET_BEVEL_SIZE_MM;
  // Половина прямой части: 4 − 0.9 = 3.1 мм, то есть по 1.55 мм от центра.
  const straight = (TICKET_SLOT_LENGTH_MM - TICKET_SLOT_HEIGHT_MM) / 2;
  const slot = new Path();

  slot.moveTo(x - straight, y + radius);
  slot.lineTo(x + straight, y + radius);
  // Правый торец: сверху вниз через крайнюю точку.
  slot.absarc(x + straight, y, radius, Math.PI / 2, -Math.PI / 2, true);
  slot.lineTo(x - straight, y - radius);
  // Левый торец: снизу вверх через крайнюю точку.
  slot.absarc(x - straight, y, radius, -Math.PI / 2, Math.PI / 2, true);
  slot.closePath();

  return slot;
}

/**
 * Билет с корешком снизу, пунктиром отрыва и проушиной — пресет Ticket.
 *
 * Корпус — прямоугольник `width × height` (28 × 60 по умолчанию) с углами,
 * скруглёнными на 4 мм, а сверху по центру выступает проушина-пятак Ø11 мм на
 * 4 мм: габарит по высоте поэтому на 4 мм больше слайдера. Отверстие под кольцо
 * Ø5 мм стоит в пятаке, то есть в целой части билета, а не в отрывной.
 *
 * Корешок — полоса у нижней кромки высотой 28 % длины (вилка 12–22 мм). По его
 * верхней границе идёт линия отрыва: щели-капсулы 4 × 0.9 мм с перемычкой
 * 2.6 мм, а на обеих боковых кромках — полукруглые вырезы R 2.5 мм. Вырезы и
 * делают линию отрыва линией: она выходит на кромку, как у бумажного билета, а
 * не обрывается в теле. Сквозные щели вместо бороздки выбраны по прочности:
 * перемычка 2.6 мм держит ключи, а «сэндвич» на толщине 2 мм оставил бы 0.8 мм
 * тела.
 *
 * Контур обходится против часовой стрелки и построен точными дугами `absarc`:
 * на радиусе 4 мм квадратичная кривая ушла бы от окружности, и угол выглядел бы
 * приплюснутым. Проушина — не отдельная оболочка, а часть того же контура:
 * дуга пятака подменяет собой участок верхней кромки, поэтому модель остаётся
 * одним `ExtrudeGeometry` без слияния геометрий и без CSG.
 *
 * Щели и отверстие под кольцо добавляются в `shape.holes`, поэтому они сквозные
 * на всю толщину, и каждая оболочка остаётся замкнутой. Тиснёной рамки по
 * контуру нет: канавка 0.5 мм — это второй уровень выдавливания, а надпись и
 * рамка подключутся отдельной задачей сразу для всех пресетов.
 */
export function buildTicket(
  params: KeychainPresetGeometryParams,
): ExtrudeGeometry {
  const bevel = PRESET_BEVEL_SIZE_MM;
  const layout = ticketLayout(params.width, params.height);
  // Профиль Shape — контур крышки: фаска раздвигает его на bevel наружу.
  const halfWidth = Math.max(params.width - bevel * 2, 1) / 2;
  const halfHeight = Math.max(params.height - bevel * 2, 1) / 2;
  // Скругление поджимается под половину габарита: на узкой заготовке углы иначе
  // наехали бы друг на друга.
  const corner = Math.min(TICKET_CORNER_RADIUS_MM, halfWidth, halfHeight);
  // Пятак проушины: радиус профиля меньше номинала на фаску, центр совпадает с
  // центром отверстия под кольцо.
  const tabRadius = TICKET_TAB_DIAMETER_MM / 2 - bevel;
  // Расстояние от центра пятака до верхней кромки профиля: 1.5 − 0.4 = 1.1 мм, то
  // есть над габаритом проушина поднимается ровно на 4 мм. Берётся из геометрии,
  // а не из номинала, чтобы дуга начиналась точно на кромке.
  const tabDrop = halfHeight - layout.ringY;
  // Полухорда, по которой дуга пятака пересекает верхнюю кромку: с неё начинается
  // проушина, и туда же контур возвращается с другой стороны.
  const tabChord = Math.sqrt(
    Math.max(tabRadius * tabRadius - tabDrop * tabDrop, 0),
  );
  const tabStartAngle = Math.atan2(tabDrop, tabChord);
  const tabEndAngle = Math.PI - tabStartAngle;
  const notchY = layout.perforationY;
  const shape = new Shape();

  // Обход против часовой стрелки: нижняя кромка слева направо, правая стенка с
  // вырезом, верхняя кромка через проушину, левая стенка с вырезом.
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
  shape.lineTo(halfWidth, notchY - TICKET_NOTCH_RADIUS_MM);
  // Кромочный вырез: дуга уходит внутрь тела, поэтому в контуре она обходится по
  // часовой стрелке — материал остаётся снаружи выреза.
  shape.absarc(
    halfWidth,
    notchY,
    TICKET_NOTCH_RADIUS_MM,
    -Math.PI / 2,
    Math.PI / 2,
    true,
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
  // Верхняя кромка доходит до пятака и уступает ему место: дальше идёт дуга
  // проушины от правой точки пересечения через верх к левой.
  shape.lineTo(tabChord, halfHeight);
  shape.absarc(
    0,
    layout.ringY,
    tabRadius,
    tabStartAngle,
    tabEndAngle,
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
  shape.lineTo(-halfWidth, notchY + TICKET_NOTCH_RADIUS_MM);
  // Левый кромочный вырез: та же дуга внутрь тела, но стенка обходится вниз.
  shape.absarc(
    -halfWidth,
    notchY,
    TICKET_NOTCH_RADIUS_MM,
    Math.PI / 2,
    -Math.PI / 2,
    true,
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

  // Линия отрыва: каждая щель — отдельная дырка в контуре.
  for (const x of layout.slotXs) {
    shape.holes.push(ticketSlotPath(x, notchY));
  }

  shape.holes.push(ringHolePath(layout.ringY));

  return extrudePresetShape(shape, params.thickness);
}

/**
 * Вспышка из восьми лучей с отверстием под кольцо — пресет Starburst.
 *
 * Силуэт — звезда с шагом 45°, внешний радиус берётся по меньшей стороне
 * слайдера и ужимается на поле 2 мм: при 42 × 44 мм габарит выходит 38 × 38,
 * лучи одинаковой длины, а разница сторон уходит в поле. Глубина впадины —
 * 35 % радиуса, кончик скруглён на 2 мм, впадина на 1.5 мм: этого хватает, чтобы
 * силуэт читался как вспышка, а не как круг с волнами или шестерня.
 *
 * Скругление кончика срезает вершину луча, поэтому вершина выносится за внешний
 * радиус на срезание: без этого габарит вышел бы меньше номинала почти на 2 мм.
 * Отверстие Ø5 мм стоит в теле по центру: отдельное ушко вписывается только от
 * 30 мм, а на 20 мм проушина не помещается между впадинами. Кольцо сквозное через
 * `shape.holes` и упирается в впадину стенкой не меньше 3 мм.
 */
export function buildStarburst(
  params: KeychainPresetGeometryParams,
): ExtrudeGeometry {
  const layout = starburstLayout(params.width, params.height);
  const rayCount = layout.rayCount;
  const pitch = (layout.pitchDeg * Math.PI) / 180;
  const tips = Array.from({ length: rayCount }, (_, index) =>
    polarPoint(layout.apexRadius, Math.PI / 2 + index * pitch),
  );
  const valleys = Array.from({ length: rayCount }, (_, index) =>
    polarPoint(layout.innerRadius, Math.PI / 2 + pitch / 2 + index * pitch),
  );
  // Скругление кончика — дуга, вписанная в угол между рёбрами: её центр лежит на
  // биссектрисе на расстоянии R / sin(θ / 2) от вершины, а разворот равен внешнему
  // углу луча, то есть 180° − θ.
  const arcs = tips.map((tip, index) => {
    const toPrevious = unitVector(
      tip,
      valleys[(index + rayCount - 1) % rayCount],
    );
    const toNext = unitVector(tip, valleys[index]);
    const cosine =
      toPrevious[0] * toNext[0] + toPrevious[1] * toNext[1];
    const halfAngle = Math.acos(Math.min(Math.max(cosine, -1), 1)) / 2;
    const distance = layout.tipRadius / Math.sin(halfAngle);
    const bisectorX = toPrevious[0] + toNext[0];
    const bisectorY = toPrevious[1] + toNext[1];
    const bisectorLength = Math.hypot(bisectorX, bisectorY);

    return {
      center: [
        tip[0] + (bisectorX / bisectorLength) * distance,
        tip[1] + (bisectorY / bisectorLength) * distance,
      ] as ShapePoint,
      startAngle:
        Math.atan2(toPrevious[1], toPrevious[0]) + Math.PI / 2,
      sweep: Math.PI - halfAngle * 2,
    };
  });
  // Впадина скругляется квадратичной кривой с контрольной точкой в самой
  // впадине: так же, как углы шестигранника, и без математики на вторую дугу.
  const valleyRounds = valleys.map((valley, index) =>
    cornerRoundPoints(
      valley,
      tips[index],
      tips[(index + 1) % rayCount],
      layout.valleyRadius,
    ),
  );
  const shape = new Shape();
  const start = arcStart(arcs[0].center, layout.tipRadius, arcs[0].startAngle);

  shape.moveTo(start[0], start[1]);

  // Обход против часовой стрелки: дуга кончика, ребро вниз к впадине, скругление
  // впадины, ребро к следующему кончику.
  for (let index = 0; index < rayCount; index += 1) {
    const arc = arcs[index];
    const round = valleyRounds[index];
    const nextStart = arcStart(
      arcs[(index + 1) % rayCount].center,
      layout.tipRadius,
      arcs[(index + 1) % rayCount].startAngle,
    );

    shape.absarc(
      arc.center[0],
      arc.center[1],
      layout.tipRadius,
      arc.startAngle,
      arc.startAngle + arc.sweep,
      false,
    );
    shape.lineTo(round.from[0], round.from[1]);
    shape.quadraticCurveTo(
      valleys[index][0],
      valleys[index][1],
      round.to[0],
      round.to[1],
    );
    shape.lineTo(nextStart[0], nextStart[1]);
  }
  shape.closePath();

  shape.holes.push(ringHolePath(0));

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
    case "starburst":
      return buildStarburst(params);
    default:
      return null;
  }
}
