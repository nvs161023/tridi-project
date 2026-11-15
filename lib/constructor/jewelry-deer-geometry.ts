/**
 * Геометрия подставки «Лесной олень».
 *
 * Вторая форма премиум-коллекции — стоящий low-poly олень на овальном лотке.
 * Его корпус, шея, голова, уши и ноги собраны из простых гранёных примитивов:
 * только плоские фаски и жёсткие рёбра, без плавных сплайнов. Рога образуют
 * высокую раскидистую крону, на которую вешают кольца, серьги и цепочки.
 *
 * Лоток — овальная плита с полостью под монету сбоку от фигуры. Под оленем
 * стоит овальный плинт: в него утоплены нижние торцы четырёх ног. Корпус висит
 * над плинтом на ногах, шея входит в грудь, голова — в шею. Все тела замкнуты
 * по отдельности; слайсер объединяет их при печати, булевых операций нет.
 *
 * Нормали не сглаживаются: каждая грань освещается целиком, поэтому силуэт
 * читается как гранёная скульптура PolyArt. В предпросмотре у материала также
 * включён `flatShading`.
 *
 * Рога — отдельный набор из 26 изогнутых трубчатых ветвей. Их форма осталась
 * прежней: два ствола на сторону задают развилку, от них отходят первичные
 * ветви, а часть первичных ветвится ещё раз. Осевые линии — кубические Безье;
 * кольца строятся параллельным переносом, поэтому труба не перекручивается на
 * изгибе. Каждый шаг ломаной поднимается не положе 55° к столу (на компактных
 * кронах — 65°) — это и есть правило печати без поддержек. На кончиках стоят
 * небольшие бутоны: кольцо не соскальзывает.
 *
 * Высота фигуры ограничена 240 мм: если размах рогов поднимает крону выше,
 * плинт и все low-poly части фигуры вместе с рогами равномерно уменьшаются, а
 * лоток с монетной полостью остаётся заданного размера. Тонкие ветви при этом
 * не опускаются ниже Ø3 мм, иначе они ломались бы при печати и использовании.
 *
 * Система координат общая для коллекции: Z вверх, низ на z = 0, центр лотка в
 * начале координат, олень смотрит в −Y.
 */

import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Float32BufferAttribute,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";

import {
  normalizeJewelryStandParams,
  type JewelryStandParams,
} from "@/lib/constructor/params";
import {
  addFanCap,
  addPrismSides,
  type Point2,
} from "@/lib/constructor/prism-mesh";

/** Максимальная высота готовой модели, мм: поле печати обычного принтера. */
export const JEWELRY_DEER_MAX_HEIGHT_MM = 240;

/** Максимальный габарит модели по X и Y, мм: стол 250 × 250. */
export const JEWELRY_DEER_MAX_FOOTPRINT_MM = 250;

/** Минимальный диаметр ветви рога после масштабирования, мм. */
export const JEWELRY_DEER_MIN_ANTLER_DIAMETER_MM = 3;

/** Высота овального лотка, мм: полость 2.5 мм плюс дно 2.5 мм. */
export const JEWELRY_DEER_BASE_HEIGHT_MM = 5;

/** Диаметр полости под монету или шайбу, мм: рубль и четвертак входят. */
export const JEWELRY_DEER_WEIGHT_DIAMETER_MM = 25;

/** Глубина полости, мм: монета 2–3 мм ложится почти заподлицо с лицом лотка. */
export const JEWELRY_DEER_WEIGHT_DEPTH_MM = 2.5;

/** Дно под полостью, мм: лоток остаётся не сквозным. */
export const JEWELRY_DEER_WEIGHT_FLOOR_MM = 2.5;

/**
 * Сдвиг полости вбок от центра лотка, мм.
 *
 * Олень стоит по центру лотка, тело вытянуто по Y, а длинные стороны овала —
 * по X. Свободное поле остаётся справа и слева от фигуры: там и стоит круглая
 * чаша под монету, не задевая ни плинт, ни ноги. На узком лотке смещение
 * уменьшается, чтобы полость не вышла за кромку.
 */
export const JEWELRY_DEER_WEIGHT_OFFSET_MM = 60;

/** Радиус ствола рога у основания, мм: рога держат вес цепочки. */
export const JEWELRY_DEER_ANTLER_ROOT_RADIUS_MM = 7;

/** Радиус ствола на конце, мм: тонкий кончик не ломается при печати. */
export const JEWELRY_DEER_ANTLER_TIP_RADIUS_MM = 1.4;

/** Радиус бутона, мм: Ø3.6 — кольцо и серьга не соскальзывают. */
export const JEWELRY_DEER_ANTLER_BUD_RADIUS_MM = 1.8;

/** Радиус первичной ветви у основания, мм: тоньше ствола, но не хрупче. */
export const JEWELRY_DEER_TINE_ROOT_RADIUS_MM = 4.2;

/**
 * Минимальный подъём каждой хорды рога, градусы.
 *
 * 55° к столу оставляет 10° запаса к правилу 45°: даже скругление кончика и
 * утолщение-бутон не разворачивают нормаль вниз настолько, чтобы понадобилась
 * поддержка. Ломаная проверяется после выборки Безье, а не по контрольным
 * точкам — слайсер видит именно хорды.
 */
export const JEWELRY_DEER_ANTLER_MIN_ELEVATION_DEG = 55;

/** Число сторон рогов, шт.: 10 хватает, чтобы кольцо не цеплялось. */
const JEWELRY_DEER_ANTLER_SIDES = 10;

/** Сторон плинта: овал не требует большего. */
const JEWELRY_DEER_PLINTH_SIDES = 96;

/** Высота плинта, мм: скрывает нижние торцы ног. */
const JEWELRY_DEER_PLINTH_HEIGHT_MM = 6;

/** Число сторон ноги, шт.: восемь граней читаются как low-poly. */
const JEWELRY_DEER_LEG_SIDES = 8;

/** Диаметр ноги, мм: по ТЗ 6. */
export const JEWELRY_DEER_LEG_DIAMETER_MM = 6;

/** Высота прямой ноги от лотка до корпуса, мм: по ТЗ 35. */
export const JEWELRY_DEER_LEG_HEIGHT_MM = 35;

/**
 * Смещение ног по X от оси, мм.
 *
 * Корпус шириной 20 мм имеет кромки на ±10 мм. Центры ног стоят на ±7 мм:
 * верхний торец диаметром 6 мм целиком входит в корпус, и все четыре ноги
 * пересекаются с ним, а не висят рядом. Координата ±15 из эскиза вынесла бы
 * цилиндры за кромку корпуса, и тело перестало бы быть единой деталью.
 */
export const JEWELRY_DEER_LEG_OFFSET_X_MM = 7;

/** Смещение передней и задней пары ног по Y, мм: по ТЗ ±15. */
export const JEWELRY_DEER_LEG_OFFSET_Y_MM = 15;

/** Длина корпуса по Y, мм: по ТЗ 50. */
export const JEWELRY_DEER_TORSO_LENGTH_MM = 50;

/** Ширина корпуса по X, мм: по ТЗ 20. */
export const JEWELRY_DEER_TORSO_WIDTH_MM = 20;

/** Высота корпуса по Z, мм: по ТЗ 25. */
export const JEWELRY_DEER_TORSO_HEIGHT_MM = 25;

/** Центр корпуса над низом детали, мм: по ТЗ 35. */
export const JEWELRY_DEER_TORSO_CENTER_Z_MM = 35;

/** Ширина шеи по X, мм: уже корпуса, но шире головы. */
export const JEWELRY_DEER_NECK_WIDTH_MM = 14;

/** Длина наклонной шеи, мм: от груди до головы. */
export const JEWELRY_DEER_NECK_LENGTH_MM = 30;

/** Толщина шеи по Y, мм: гранёный блок, а не труба. */
export const JEWELRY_DEER_NECK_THICKNESS_MM = 12;

/** Наклон шеи вокруг X, градусы: вверх и вперёд. */
export const JEWELRY_DEER_NECK_TILT_DEG = 31;

/** Длина головы по Y, мм: по ТЗ 25. */
export const JEWELRY_DEER_HEAD_LENGTH_MM = 25;

/** Ширина головы по X, мм: по ТЗ 15. */
export const JEWELRY_DEER_HEAD_WIDTH_MM = 15;

/** Высота головы по Z, мм: по ТЗ 15. */
export const JEWELRY_DEER_HEAD_HEIGHT_MM = 15;

/** Центр головы по Y, мм: по ТЗ −45, нос смотрит в −Y. */
export const JEWELRY_DEER_HEAD_CENTER_Y_MM = -45;

/** Центр головы по Z от низа детали, мм: по ТЗ 75. */
export const JEWELRY_DEER_HEAD_CENTER_Z_MM = 75;

/** Наклон головы носом вниз, градусы. */
export const JEWELRY_DEER_HEAD_TILT_DEG = 15;

/** Радиус основания уха-конуса, мм. */
export const JEWELRY_DEER_EAR_RADIUS_MM = 3.2;

/** Число граней уха, шт.: четыре дают читаемый треугольный силуэт. */
export const JEWELRY_DEER_EAR_SIDES = 4;

/** Число сторон базы, шт.: 96 держит овал гладким на любом размере. */
const JEWELRY_DEER_BASE_SIDES = 96;

/** Гранёный блок: центр, габариты и наклон вокруг X. */
export type JewelryDeerBox = {
  readonly centerMm: Vec3;
  /** Ширина по X, мм. */
  readonly widthMm: number;
  /** Длина по Y, мм. */
  readonly lengthMm: number;
  /** Высота по Z, мм. */
  readonly heightMm: number;
  /** Наклон вокруг X, градусы: нос и верх шеи уходят вперёд. */
  readonly tiltXDeg: number;
};

/** Корпус low-poly оленя: блок с точными нижней и верхней плоскостями. */
export type JewelryDeerBody = JewelryDeerBox & {
  readonly bottomZMm: number;
  readonly topZMm: number;
};

/** Голова low-poly оленя: блок, макушка и точка носа. */
export type JewelryDeerHead = JewelryDeerBox & {
  /** Самая высокая точка наклонённого блока, мм. */
  readonly crownZMm: number;
  /** Передняя нижняя точка морды, мм. */
  readonly noseMm: Vec3;
};

/** Овальный плинт под фигурой: длина по Y, ширина по X. */
export type JewelryDeerPlinth = {
  readonly centerMm: readonly [number, number];
  readonly lengthMm: number;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly topZMm: number;
};

/** Прямая нога-цилиндр: ось Z, верх утоплен в корпус. */
export type JewelryDeerLeg = {
  readonly id: string;
  readonly xMm: number;
  readonly yMm: number;
  readonly bottomZMm: number;
  readonly topZMm: number;
  readonly radiusMm: number;
  readonly sides: number;
};

/** Точка в пространстве, локальный тип модуля. */
type Vec3 = readonly [number, number, number];

/** Ухо-конус: корень в голове, кончик наружу и вверх. */
export type JewelryDeerEar = {
  readonly id: string;
  readonly rootMm: Vec3;
  readonly tipMm: Vec3;
  readonly radiusMm: number;
  readonly sides: number;
};

/** Точка осевой линии рога: центр кольца и радиус трубы. */
export type JewelryDeerAntlerPoint = {
  readonly xMm: number;
  readonly yMm: number;
  readonly zMm: number;
  readonly radiusMm: number;
};

/** Одна труба рога: ствол или отросток. */
export type JewelryDeerAntlerPath = {
  /** Имя для тестов и отчёта: `beam-right`, `tine-2-left` и так далее. */
  readonly id: string;
  /** `beam` — ствол с бутоном на конце, `tine` — отросток. */
  readonly kind: "beam" | "tine";
  /** Сторона: −1 — левый рог, 1 — правый. */
  readonly side: -1 | 1;
  /** Осевая линия от корня до бутона. */
  readonly points: readonly JewelryDeerAntlerPoint[];
  /** Радиус бутона на конце, мм. */
  readonly budRadiusMm: number;
};

/** План оленя: всё, что считается один раз и проверяется тестом. */
export type JewelryDeerPlan = {
  readonly baseLengthMm: number;
  readonly baseWidthMm: number;
  readonly baseHeightMm: number;
  /** Центр полости на плоскости стола: сбоку от фигуры. */
  readonly pocketCenterMm: readonly [number, number];
  /** Смещение полости от центра, мм: на узком лотке поджимается к кромке. */
  readonly pocketOffsetMm: number;
  readonly pocketRadiusMm: number;
  readonly pocketDepthMm: number;
  readonly pocketFloorMm: number;
  /** Масштаб фигуры поверх авторских размеров: 0…1, вписывает высоту в 240 мм. */
  readonly fitScale: number;
  readonly plinth: JewelryDeerPlinth;
  readonly body: JewelryDeerBody;
  /** Наклонная шея: тот же гранёный блок, что уходит в геометрию. */
  readonly neck: JewelryDeerBox;
  readonly legs: readonly JewelryDeerLeg[];
  readonly head: JewelryDeerHead;
  /** Верх головы без рогов, мм. */
  readonly crownZMm: number;
  /** Верх рогов, мм: самая высокая точка модели. */
  readonly antlerTopZMm: number;
  readonly antlerSpreadMm: number;
  /** Крайняя точка рогов по X от оси, мм: размах с учётом толщины бутона. */
  readonly antlerOuterXMm: number;
  readonly antlers: readonly JewelryDeerAntlerPath[];
  readonly ears: readonly JewelryDeerEar[];
  readonly heightMm: number;
};

/** Сложение векторов. */
function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/** Разность векторов. */
function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/** Умножение вектора на число. */
function multiply(v: Vec3, factor: number): Vec3 {
  return [v[0] * factor, v[1] * factor, v[2] * factor];
}

/** Длина вектора. */
function magnitude(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

/** Единичный вектор; нулевой остаётся нулевым, чтобы не делить на ноль. */
function normalize(v: Vec3): Vec3 {
  const size = magnitude(v);

  return size > 1e-12 ? multiply(v, 1 / size) : [0, 0, 1];
}

/** Линейная интерполяция двух чисел. */
function lerpNumber(from: number, to: number, share: number): number {
  return from + (to - from) * share;
}

/** Точка кубической кривой Безье. */
function cubicBezierAt(
  controls: readonly [Vec3, Vec3, Vec3, Vec3],
  share: number,
): Vec3 {
  const inverse = 1 - share;
  const a = inverse * inverse * inverse;
  const b = 3 * inverse * inverse * share;
  const c = 3 * inverse * share * share;
  const d = share * share * share;

  return [
    controls[0][0] * a + controls[1][0] * b + controls[2][0] * c + controls[3][0] * d,
    controls[0][1] * a + controls[1][1] * b + controls[2][1] * c + controls[3][1] * d,
    controls[0][2] * a + controls[1][2] * b + controls[2][2] * c + controls[3][2] * d,
  ];
}

/** Векторное произведение. */
function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/** Гладкая ступень 0…1: у неё ограничена производная, а значит и нависание. */
function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge1 <= edge0) {
    return value >= edge1 ? 1 : 0;
  }

  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));

  return t * t * (3 - 2 * t);
}

/** Точка осевой линии как вектор. */
function pointToVec(point: JewelryDeerAntlerPoint): Vec3 {
  return [point.xMm, point.yMm, point.zMm];
}

/** Скалярное произведение. */
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Базис трубы: два единичных вектора, перпендикулярных оси.
 *
 * Для первой точки изогнутой трубы мировая X проецируется на плоскость кольца:
 * грань не перекручивается, а дальше рамка переносится параллельно от кольца к
 * кольцу. Этого достаточно и для стволов рогов, и для ветвей, и для ног.
 */
function tubeFrame(axis: Vec3): { e1: Vec3; e2: Vec3 } {
  const reference: Vec3 = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = normalize(subtract(reference, multiply(axis, dot(reference, axis))));

  return { e1, e2: cross(axis, e1) };
}

/**
 * Поднимает точку так, чтобы хорда от предыдущей шла не положе `minDeg`.
 *
 * Без этого кубическая кривая может «выстрелить» вбок почти горизонтально и
 * дать нависание, которого не видно по контрольным точкам. Функция меняет
 * только Z: план по X и Y, а значит размах рогов, остаётся прежним.
 */
function enforceMinElevation(
  points: readonly Vec3[],
  minDeg: number,
): { xMm: number; yMm: number; zMm: number }[] {
  const tangent = Math.tan((minDeg * Math.PI) / 180);
  const result: { xMm: number; yMm: number; zMm: number }[] = [];

  for (const [x, y, z] of points) {
    if (result.length === 0) {
      result.push({ xMm: x, yMm: y, zMm: z });
      continue;
    }

    const previous = result[result.length - 1];
    const run = Math.hypot(x - previous.xMm, y - previous.yMm);
    const minZ = previous.zMm + run * tangent;

    result.push({ xMm: x, yMm: y, zMm: Math.max(z, minZ) });
  }

  return result;
}

/** Точки кубической кривой без радиуса: общая заготовка для труб. */
function sampleCubic(
  controls: readonly [Vec3, Vec3, Vec3, Vec3],
  samples: number,
): Vec3[] {
  const points: Vec3[] = [];

  for (let index = 0; index < samples; index += 1) {
    const share = samples > 1 ? index / (samples - 1) : 0;

    points.push(cubicBezierAt(controls, share));
  }

  return points;
}

/**
 * Одна изогнутая труба рога с бутоном на конце.
 *
 * Осевая линия — кубическая Безье. После выборки каждая хорда поднимается не
 * положе `JEWELRY_DEER_ANTLER_MIN_ELEVATION_DEG`, поэтому слайсер не поставит
 * поддержку. Радиус линейно сужается, а на последних 20 % мягко раздаётся в
 * бутон: кольцо останавливается на нём, а не соскальзывает с гладкого конуса.
 */
function createAntlerPath(options: {
  readonly id: string;
  readonly kind: "beam" | "tine";
  readonly side: -1 | 1;
  readonly controls: readonly [Vec3, Vec3, Vec3, Vec3];
  readonly rootRadiusMm: number;
  readonly tipRadiusMm: number;
  readonly budRadiusMm: number;
  readonly samples: number;
  readonly minElevationDeg: number;
}): JewelryDeerAntlerPath {
  const centers = enforceMinElevation(
    sampleCubic(options.controls, options.samples),
    options.minElevationDeg,
  );
  const points = centers.map((center, index) => {
    const share = centers.length > 1 ? index / (centers.length - 1) : 1;
    const bud = smoothstep(0.8, 1, share);

    return {
      xMm: center.xMm,
      yMm: center.yMm,
      zMm: center.zMm,
      radiusMm:
        lerpNumber(options.rootRadiusMm, options.tipRadiusMm, share) +
        (options.budRadiusMm - options.tipRadiusMm) * bud,
    };
  });

  return {
    id: options.id,
    kind: options.kind,
    side: options.side,
    points,
    budRadiusMm: options.budRadiusMm,
  };
}

/**
 * Ветвь рога в нормированных координатах кроны.
 *
 * `tip`, `c1` и `c2` заданы долями: X — половины размаха, Y — глубины кроны,
 * Z — высоты над корнем. `parent` — имя ствола или ветви, `attach` — доля её
 * длины, откуда растёт эта ветвь. Так все развилки получаются связанными.
 */
type JewelryDeerAntlerBranchSpec = {
  readonly id: string;
  readonly parent: string | null;
  readonly attach: number;
  readonly tip: readonly [number, number, number];
  readonly c1: readonly [number, number, number];
  readonly c2: readonly [number, number, number];
  readonly rootRadiusMm: number;
  readonly samples: number;
};

/**
 * Крона: два ствола на сторону и одиннадцать ветвей.
 *
 * Нормированные Z подобраны так, чтобы даже нижние ветви уходили вверх круче
 * 55°. Стволы задают силуэт дерева; ветви заполняют его ярусами, а три
 * развилки добавляют ярус третьего порядка. Форма повторяется зеркально,
 * поэтому крона читается симметричной, как на референсе.
 */
const JEWELRY_DEER_ANTLER_BRANCHES: readonly JewelryDeerAntlerBranchSpec[] = [
  {
    id: "beam-out",
    parent: null,
    attach: 0,
    tip: [1, -0.08, 1],
    c1: [0.02, -0.02, 0.34],
    c2: [0.56, -0.14, 0.78],
    rootRadiusMm: JEWELRY_DEER_ANTLER_ROOT_RADIUS_MM,
    samples: 18,
  },
  {
    id: "beam-in",
    parent: "beam-out",
    attach: 0.14,
    tip: [0.34, -0.04, 0.96],
    c1: [0.06, -0.04, 0.5],
    c2: [0.2, -0.1, 0.78],
    rootRadiusMm: JEWELRY_DEER_TINE_ROOT_RADIUS_MM * 1.2,
    samples: 16,
  },
  {
    id: "out-1",
    parent: "beam-out",
    attach: 0.16,
    tip: [0.62, -0.18, 0.42],
    c1: [0.2, -0.1, 0.24],
    c2: [0.45, -0.16, 0.33],
    rootRadiusMm: JEWELRY_DEER_TINE_ROOT_RADIUS_MM,
    samples: 11,
  },
  {
    id: "out-2",
    parent: "beam-out",
    attach: 0.3,
    tip: [0.94, -0.3, 0.6],
    c1: [0.4, -0.1, 0.4],
    c2: [0.72, -0.25, 0.5],
    rootRadiusMm: JEWELRY_DEER_TINE_ROOT_RADIUS_MM,
    samples: 11,
  },
  {
    id: "out-3",
    parent: "beam-out",
    attach: 0.44,
    tip: [0.99, 0.05, 0.76],
    c1: [0.56, 0, 0.58],
    c2: [0.82, 0.02, 0.67],
    rootRadiusMm: JEWELRY_DEER_TINE_ROOT_RADIUS_MM * 0.92,
    samples: 11,
  },
  {
    id: "out-4",
    parent: "beam-out",
    attach: 0.58,
    tip: [0.8, 0.18, 0.86],
    c1: [0.6, 0.08, 0.7],
    c2: [0.72, 0.12, 0.79],
    rootRadiusMm: JEWELRY_DEER_TINE_ROOT_RADIUS_MM * 0.84,
    samples: 10,
  },
  {
    id: "out-5",
    parent: "beam-out",
    attach: 0.74,
    tip: [0.56, -0.15, 0.95],
    c1: [0.56, 0, 0.82],
    c2: [0.52, -0.1, 0.89],
    rootRadiusMm: JEWELRY_DEER_TINE_ROOT_RADIUS_MM * 0.76,
    samples: 10,
  },
  {
    id: "in-1",
    parent: "beam-in",
    attach: 0.38,
    tip: [0.62, -0.32, 0.5],
    c1: [0.3, -0.18, 0.38],
    c2: [0.48, -0.28, 0.44],
    rootRadiusMm: JEWELRY_DEER_TINE_ROOT_RADIUS_MM * 0.9,
    samples: 10,
  },
  {
    id: "in-2",
    parent: "beam-in",
    attach: 0.58,
    tip: [0.38, -0.42, 0.7],
    c1: [0.32, -0.25, 0.58],
    c2: [0.34, -0.36, 0.64],
    rootRadiusMm: JEWELRY_DEER_TINE_ROOT_RADIUS_MM * 0.8,
    samples: 10,
  },
  {
    id: "in-3",
    parent: "beam-in",
    attach: 0.76,
    tip: [0.14, -0.28, 0.88],
    c1: [0.23, -0.2, 0.78],
    c2: [0.16, -0.25, 0.83],
    rootRadiusMm: JEWELRY_DEER_TINE_ROOT_RADIUS_MM * 0.7,
    samples: 9,
  },
  {
    id: "out-2a",
    parent: "out-2",
    attach: 0.55,
    tip: [0.72, -0.5, 0.74],
    c1: [0.65, -0.38, 0.62],
    c2: [0.68, -0.48, 0.68],
    rootRadiusMm: JEWELRY_DEER_TINE_ROOT_RADIUS_MM * 0.55,
    samples: 9,
  },
  {
    id: "in-1a",
    parent: "in-1",
    attach: 0.55,
    tip: [0.78, -0.45, 0.68],
    c1: [0.7, -0.4, 0.56],
    c2: [0.75, -0.45, 0.62],
    rootRadiusMm: JEWELRY_DEER_TINE_ROOT_RADIUS_MM * 0.5,
    samples: 9,
  },
  {
    id: "out-3a",
    parent: "out-3",
    attach: 0.58,
    tip: [1, -0.2, 0.9],
    c1: [0.86, -0.18, 0.76],
    c2: [0.94, -0.22, 0.83],
    rootRadiusMm: JEWELRY_DEER_TINE_ROOT_RADIUS_MM * 0.45,
    samples: 9,
  },
];


/**
 * План оленя до ограничения габарита.
 *
 * План считается без three.js и без меша — по нему строятся и геометрия, и
 * подписи, и проверки в `scripts/test-jewelry-geometry.ts`. Габарит фигуры
 * выводится из размеров лотка, а высота рогов — из размаха. На максимальных
 * ползунках авторская крона выходит около 410 мм, поэтому публичный
 * `jewelryDeerPlan` дополнительно вписывает её в печатный конверт.
 */
function buildJewelryDeerPlan(
  params: Partial<JewelryStandParams> = {},
): JewelryDeerPlan {
  const normalized = normalizeJewelryStandParams(params);
  const baseLengthMm = normalized.deerBaseLength;
  const baseWidthMm = normalized.deerBaseWidth;
  const antlerSpreadMm = normalized.deerAntlerSpread;
  const pocketRadiusMm = JEWELRY_DEER_WEIGHT_DIAMETER_MM / 2;
  const pocketOffsetMm = Math.min(
    JEWELRY_DEER_WEIGHT_OFFSET_MM,
    baseLengthMm / 2 - pocketRadiusMm - 2,
  );

  // Корпус стоит на ногах: его низ на 22.5 мм выше плиты. Все размеры ниже —
  // авторские, до общего вписывания в 240 мм.
  const bodyBottomZMm =
    JEWELRY_DEER_BASE_HEIGHT_MM + JEWELRY_DEER_TORSO_CENTER_Z_MM -
    JEWELRY_DEER_TORSO_HEIGHT_MM / 2;
  const body: JewelryDeerBody = {
    centerMm: [
      0,
      0,
      JEWELRY_DEER_BASE_HEIGHT_MM + JEWELRY_DEER_TORSO_CENTER_Z_MM,
    ],
    widthMm: JEWELRY_DEER_TORSO_WIDTH_MM,
    lengthMm: JEWELRY_DEER_TORSO_LENGTH_MM,
    heightMm: JEWELRY_DEER_TORSO_HEIGHT_MM,
    tiltXDeg: 0,
    bottomZMm: bodyBottomZMm,
    topZMm: bodyBottomZMm + JEWELRY_DEER_TORSO_HEIGHT_MM,
  };

  const plinthWidthMm = body.widthMm * 1.7;
  const plinthLengthMm = body.lengthMm * 1.4;
  const plinth: JewelryDeerPlinth = {
    centerMm: [0, 0],
    lengthMm: plinthLengthMm,
    widthMm: plinthWidthMm,
    heightMm: JEWELRY_DEER_PLINTH_HEIGHT_MM,
    topZMm: JEWELRY_DEER_BASE_HEIGHT_MM + JEWELRY_DEER_PLINTH_HEIGHT_MM,
  };

  // Шея — наклонный блок от груди (y = −20, z = 45) к голове (y = −35,
  // z = 70). В мировых координатах лоток добавляет 5 мм снизу.
  const neckChestY = -20;
  const neckHeadY = -35;
  const neck: JewelryDeerBox = {
    centerMm: [
      0,
      (neckChestY + neckHeadY) / 2,
      JEWELRY_DEER_BASE_HEIGHT_MM + (45 + 70) / 2,
    ],
    widthMm: JEWELRY_DEER_NECK_WIDTH_MM,
    lengthMm: JEWELRY_DEER_NECK_THICKNESS_MM,
    heightMm: JEWELRY_DEER_NECK_LENGTH_MM,
    tiltXDeg: JEWELRY_DEER_NECK_TILT_DEG,
  };

  const headTiltRad = (JEWELRY_DEER_HEAD_TILT_DEG * Math.PI) / 180;
  const headCenterZ =
    JEWELRY_DEER_BASE_HEIGHT_MM + JEWELRY_DEER_HEAD_CENTER_Z_MM;
  const headCrownZ =
    headCenterZ +
    Math.abs(
      (JEWELRY_DEER_HEAD_LENGTH_MM / 2) * Math.sin(headTiltRad),
    ) +
    (JEWELRY_DEER_HEAD_HEIGHT_MM / 2) * Math.cos(headTiltRad);
  const noseLocalY = -JEWELRY_DEER_HEAD_LENGTH_MM / 2;
  const noseLocalZ = -JEWELRY_DEER_HEAD_HEIGHT_MM / 2;
  const head: JewelryDeerHead = {
    centerMm: [
      0,
      JEWELRY_DEER_HEAD_CENTER_Y_MM,
      headCenterZ,
    ],
    widthMm: JEWELRY_DEER_HEAD_WIDTH_MM,
    lengthMm: JEWELRY_DEER_HEAD_LENGTH_MM,
    heightMm: JEWELRY_DEER_HEAD_HEIGHT_MM,
    tiltXDeg: JEWELRY_DEER_HEAD_TILT_DEG,
    crownZMm: headCrownZ,
    noseMm: [
      0,
      JEWELRY_DEER_HEAD_CENTER_Y_MM +
        noseLocalY * Math.cos(headTiltRad) -
        noseLocalZ * Math.sin(headTiltRad),
      headCenterZ +
        noseLocalY * Math.sin(headTiltRad) +
        noseLocalZ * Math.cos(headTiltRad),
    ],
  };

  const ears: JewelryDeerEar[] = ([-1, 1] as const).map((side) => ({
    id: `ear-${side < 0 ? "left" : "right"}`,
    rootMm: [
      side * JEWELRY_DEER_HEAD_WIDTH_MM * 0.38,
      JEWELRY_DEER_HEAD_CENTER_Y_MM + 1,
      headCenterZ + 4.5,
    ],
    tipMm: [
      side * (JEWELRY_DEER_HEAD_WIDTH_MM / 2 + 9),
      JEWELRY_DEER_HEAD_CENTER_Y_MM + 2,
      headCenterZ + 10,
    ],
    radiusMm: JEWELRY_DEER_EAR_RADIUS_MM,
    sides: JEWELRY_DEER_EAR_SIDES,
  }));

  const makeLeg = (
    side: -1 | 1,
    front: boolean,
  ): JewelryDeerLeg => ({
    id: `leg-${front ? "front" : "rear"}-${side < 0 ? "left" : "right"}`,
    xMm: side * JEWELRY_DEER_LEG_OFFSET_X_MM,
    yMm: (front ? -1 : 1) * JEWELRY_DEER_LEG_OFFSET_Y_MM,
    bottomZMm: JEWELRY_DEER_BASE_HEIGHT_MM,
    topZMm: JEWELRY_DEER_BASE_HEIGHT_MM + JEWELRY_DEER_LEG_HEIGHT_MM,
    radiusMm: JEWELRY_DEER_LEG_DIAMETER_MM / 2,
    sides: JEWELRY_DEER_LEG_SIDES,
  });

  const legs: JewelryDeerLeg[] = [
    makeLeg(-1, true),
    makeLeg(1, true),
    makeLeg(-1, false),
    makeLeg(1, false),
  ];

  // Оба ствола начинаются почти в одной точке на макушке low-poly головы.
  // Корень уходит внутрь блока на 2.5 мм, поэтому рог не висит в воздухе.
  // Форма всех 26 трубок не меняется: сдвигается только общая точка роста.
  const rootX = 0.5;
  const rootY = head.centerMm[1] + 1;
  const rootZ = head.centerMm[2] + 5;
  const halfSpreadMm =
    antlerSpreadMm / 2 - JEWELRY_DEER_ANTLER_BUD_RADIUS_MM;
  const crownHeightMm = antlerSpreadMm * 1.456;
  const crownDepthMm = halfSpreadMm * 0.53;

  const crownPoint = (
    side: -1 | 1,
    [x, y, z]: readonly [number, number, number],
  ): Vec3 => [
    side * x * halfSpreadMm,
    rootY + y * crownDepthMm,
    rootZ + z * crownHeightMm,
  ];

  const pointAtShare = (
    path: JewelryDeerAntlerPath,
    share: number,
  ): { point: Vec3; radiusMm: number } => {
    const points = path.points;
    const scaled = Math.min(1, Math.max(0, share)) * (points.length - 1);
    const index = Math.min(points.length - 2, Math.floor(scaled));
    const local = scaled - index;
    const from = points[index];
    const to = points[index + 1];

    return {
      point: [
        lerpNumber(from.xMm, to.xMm, local),
        lerpNumber(from.yMm, to.yMm, local),
        lerpNumber(from.zMm, to.zMm, local),
      ],
      radiusMm: lerpNumber(from.radiusMm, to.radiusMm, local),
    };
  };

  const antlers: JewelryDeerAntlerPath[] = [];
  // На компактной фигуре рога короткие, и скругление того же бутона занимает
  // большую долю длины. Поэтому запас к 45° там больше: 65° вместо 55°.
  const antlerMinElevationDeg =
    antlerSpreadMm <= 140 ? 65 : antlerSpreadMm <= 190 ? 60 : 55;

  for (const side of [-1, 1] as const) {
    const suffix = side < 0 ? "left" : "right";
    const built = new Map<string, JewelryDeerAntlerPath>();

    for (const spec of JEWELRY_DEER_ANTLER_BRANCHES) {
      const parent = spec.parent ? built.get(spec.parent) : undefined;
      const attach = parent ? pointAtShare(parent, spec.attach) : null;
      const root: Vec3 = attach
        ? attach.point
        : [side * rootX, rootY, rootZ];
      const rootRadiusMm = parent && attach
        ? Math.max(
            0.8,
            Math.min(spec.rootRadiusMm, attach.radiusMm - 0.12),
          )
        : spec.rootRadiusMm;
      const tipRadiusMm = Math.min(
        JEWELRY_DEER_ANTLER_TIP_RADIUS_MM,
        rootRadiusMm * 0.55,
      );
      const budRadiusMm = Math.min(
        JEWELRY_DEER_ANTLER_BUD_RADIUS_MM,
        rootRadiusMm * 0.75 + 0.6,
      );
      const path = createAntlerPath({
        id: `${spec.id}-${suffix}`,
        kind: spec.parent ? "tine" : "beam",
        side,
        controls: [
          root,
          crownPoint(side, spec.c1),
          crownPoint(side, spec.c2),
          crownPoint(side, spec.tip),
        ],
        rootRadiusMm,
        tipRadiusMm,
        budRadiusMm,
        samples: spec.samples,
        minElevationDeg: antlerMinElevationDeg,
      });

      built.set(spec.id, path);
      antlers.push(path);
    }
  }

  let antlerTopMm = 0;
  let antlerOuterXMm = 0;

  for (const path of antlers) {
    const last = path.points[path.points.length - 1];

    antlerTopMm = Math.max(antlerTopMm, last.zMm + path.budRadiusMm);
    antlerOuterXMm = Math.max(
      antlerOuterXMm,
      Math.abs(last.xMm) + path.budRadiusMm,
    );
  }

  const heightMm =
    Math.round(
      Math.max(head.crownZMm, antlerTopMm, body.topZMm) * 100,
    ) / 100;

  return {
    baseLengthMm,
    baseWidthMm,
    baseHeightMm: JEWELRY_DEER_BASE_HEIGHT_MM,
    pocketCenterMm: [pocketOffsetMm, 0],
    pocketOffsetMm,
    pocketRadiusMm,
    pocketDepthMm: JEWELRY_DEER_WEIGHT_DEPTH_MM,
    pocketFloorMm: JEWELRY_DEER_WEIGHT_FLOOR_MM,
    fitScale: 1,
    plinth,
    body,
    neck,
    legs,
    head,
    crownZMm: head.crownZMm,
    antlerTopZMm: antlerTopMm,
    antlerSpreadMm,
    antlerOuterXMm,
    antlers,
    ears,
    heightMm,
  };
}

/**
 * План оленя, вписанный в печатный конверт.
 *
 * Лоток и полость остаются ровно такими, какими их задали ползунки: монета
 * должна входить в гнездо. Если крона поднимает фигуру выше 240 мм, масштаб
 * применяется к плинту, корпусу, шее, голове, ушам, ногам и рогам — ко всей
 * фигуре поверх лотка. Равномерный масштаб не меняет углы наклона и пропорции,
 * поэтому low-poly силуэт и подъём рогов сохраняются. Радиусы рогов после
 * уменьшения поднимаются до Ø3 мм: ветви не становятся хрупкими.
 */
export function jewelryDeerPlan(
  params: Partial<JewelryStandParams> = {},
): JewelryDeerPlan {
  const raw = buildJewelryDeerPlan(params);
  // 0.01 мм запаса: после округления высоты и подъёма тонких бутонов кончик
  // не должен оказаться ровно на пределе или на сотую выше него.
  const availableMm =
    JEWELRY_DEER_MAX_HEIGHT_MM - raw.baseHeightMm - 0.01;
  const aboveBaseMm = raw.heightMm - raw.baseHeightMm;
  const minimumRadiusMm = JEWELRY_DEER_MIN_ANTLER_DIAMETER_MM / 2;
  const byHeight =
    aboveBaseMm > 1e-9 ? availableMm / aboveBaseMm : 1;
  // Если бутон после масштаба станет тоньше минимума, его радиус поднимется
  // обратно до 1.5 мм. Этот запас вычитается заранее, иначе кончик снова
  // вылезет за 240 мм.
  const byThickness =
    aboveBaseMm > JEWELRY_DEER_ANTLER_BUD_RADIUS_MM + 1e-9
      ? (availableMm - minimumRadiusMm) /
        (aboveBaseMm - JEWELRY_DEER_ANTLER_BUD_RADIUS_MM)
      : 1;
  const footprintMm = Math.max(
    raw.baseLengthMm,
    raw.baseWidthMm,
    raw.antlerOuterXMm * 2,
  );
  const byFootprint =
    footprintMm > 1e-9 ? JEWELRY_DEER_MAX_FOOTPRINT_MM / footprintMm : 1;
  const fitScale = Math.min(
    1,
    Math.max(0.05, Math.min(byHeight, byThickness, byFootprint)),
  );

  return scaleDeerFigure(raw, fitScale);
}

/**
 * Равномерно масштабирует фигуру оленя, оставляя лоток и полость в покое.
 *
 * По Z масштаб считается от верхней грани лотка: нижние торцы ног и плинт
 * остаются на своих местах, а крона опускается к столу. По X и Y все детали
 * фигуры сжимаются к центру лотка, поэтому за габарит 250 мм они не выйдут.
 */
function scaleDeerFigure(
  raw: JewelryDeerPlan,
  factor: number,
): JewelryDeerPlan {
  const anchorZMm = raw.baseHeightMm;
  const minimumRadiusMm = JEWELRY_DEER_MIN_ANTLER_DIAMETER_MM / 2;
  const scalePoint = (point: Vec3): Vec3 => [
    point[0] * factor,
    point[1] * factor,
    anchorZMm + (point[2] - anchorZMm) * factor,
  ];
  const scaleZ = (zMm: number): number =>
    anchorZMm + (zMm - anchorZMm) * factor;

  const plinth: JewelryDeerPlinth = {
    ...raw.plinth,
    centerMm: [
      raw.plinth.centerMm[0] * factor,
      raw.plinth.centerMm[1] * factor,
    ],
    lengthMm: raw.plinth.lengthMm * factor,
    widthMm: raw.plinth.widthMm * factor,
    heightMm: raw.plinth.heightMm * factor,
    topZMm: scaleZ(raw.plinth.topZMm),
  };
  const body: JewelryDeerBody = {
    ...raw.body,
    centerMm: scalePoint(raw.body.centerMm),
    widthMm: raw.body.widthMm * factor,
    lengthMm: raw.body.lengthMm * factor,
    heightMm: raw.body.heightMm * factor,
    bottomZMm: scaleZ(raw.body.bottomZMm),
    topZMm: scaleZ(raw.body.topZMm),
  };
  const neck: JewelryDeerBox = {
    ...raw.neck,
    centerMm: scalePoint(raw.neck.centerMm),
    widthMm: raw.neck.widthMm * factor,
    lengthMm: raw.neck.lengthMm * factor,
    heightMm: raw.neck.heightMm * factor,
  };
  const head: JewelryDeerHead = {
    ...raw.head,
    centerMm: scalePoint(raw.head.centerMm),
    widthMm: raw.head.widthMm * factor,
    lengthMm: raw.head.lengthMm * factor,
    heightMm: raw.head.heightMm * factor,
    crownZMm: scaleZ(raw.head.crownZMm),
    noseMm: scalePoint(raw.head.noseMm),
  };

  const ears: JewelryDeerEar[] = raw.ears.map((ear) => ({
    ...ear,
    rootMm: scalePoint(ear.rootMm),
    tipMm: scalePoint(ear.tipMm),
    radiusMm: ear.radiusMm * factor,
  }));
  const legs: JewelryDeerLeg[] = raw.legs.map((leg) => ({
    ...leg,
    xMm: leg.xMm * factor,
    yMm: leg.yMm * factor,
    bottomZMm: scaleZ(leg.bottomZMm),
    topZMm: scaleZ(leg.topZMm),
    radiusMm: leg.radiusMm * factor,
  }));
  const antlers: JewelryDeerAntlerPath[] = raw.antlers.map((path) => ({
    ...path,
    points: path.points.map((point) => ({
      ...point,
      xMm: point.xMm * factor,
      yMm: point.yMm * factor,
      zMm: scaleZ(point.zMm),
      radiusMm: Math.max(point.radiusMm * factor, minimumRadiusMm),
    })),
    budRadiusMm: Math.max(path.budRadiusMm * factor, minimumRadiusMm),
  }));

  let antlerTopZMm = 0;
  let antlerOuterXMm = 0;

  for (const path of antlers) {
    for (const point of path.points) {
      antlerTopZMm = Math.max(
        antlerTopZMm,
        point.zMm + point.radiusMm,
      );
      antlerOuterXMm = Math.max(
        antlerOuterXMm,
        Math.abs(point.xMm) + point.radiusMm,
      );
    }

    const last = path.points[path.points.length - 1];

    antlerTopZMm = Math.max(antlerTopZMm, last.zMm + path.budRadiusMm);
    antlerOuterXMm = Math.max(
      antlerOuterXMm,
      Math.abs(last.xMm) + path.budRadiusMm,
    );
  }

  const heightMm =
    Math.round(
      Math.max(antlerTopZMm, head.crownZMm, body.topZMm) * 100,
    ) / 100;

  return {
    ...raw,
    fitScale: raw.fitScale * factor,
    plinth,
    body,
    neck,
    legs,
    head,
    crownZMm: head.crownZMm,
    antlerTopZMm,
    antlerOuterXMm,
    antlerSpreadMm: antlerOuterXMm * 2,
    antlers,
    ears,
    heightMm,
  };
}

/** Высота модели, мм: габарит по Z для подписи и предпросмотра. */
export function jewelryDeerHeightMm(
  params: Partial<JewelryStandParams> = {},
): number {
  return jewelryDeerPlan(params).heightMm;
}

/** Полуоси овальной базы: длина и ширина в тех же единицах, что слайдеры. */
export function jewelryDeerBaseRadiiMm(plan: JewelryDeerPlan): {
  readonly a: number;
  readonly b: number;
} {
  return { a: plan.baseLengthMm / 2, b: plan.baseWidthMm / 2 };
}


/** Полка верхней грани: четырехугольники между наружным и внутренним контуром. */
function addAnnulusCap(
  positions: number[],
  outer: readonly Point2[],
  inner: readonly Point2[],
  z: number,
): void {
  for (let index = 0; index < outer.length; index += 1) {
    const next = (index + 1) % outer.length;
    const [ox0, oy0] = outer[index];
    const [ox1, oy1] = outer[next];
    const [ix0, iy0] = inner[index];
    const [ix1, iy1] = inner[next];

    positions.push(
      ox0,
      oy0,
      z,
      ox1,
      oy1,
      z,
      ix0,
      iy0,
      z,
      ix0,
      iy0,
      z,
      ox1,
      oy1,
      z,
      ix1,
      iy1,
      z,
    );
  }
}

/**
 * Овальный лоток с полостью под утяжелитель.
 *
 * Тело замкнуто: наружная стенка, дно, полка верхней грани, стенка полости и её
 * дно. Стенка полости обходится в обратную сторону — её нормаль смотрит в
 * пустоту, иначе объём детали не сойдётся. Полость не сквозная: под ней
 * остаётся сплошное дно `pocketFloorMm`, поэтому принтер не тянет мост.
 */
function addDeerBase(positions: number[], plan: JewelryDeerPlan): void {
  const { a, b } = jewelryDeerBaseRadiiMm(plan);
  const height = plan.baseHeightMm;
  const floor = plan.pocketFloorMm;
  const [pocketX, pocketY] = plan.pocketCenterMm;
  const pocketRadius = plan.pocketRadiusMm;
  const sides = JEWELRY_DEER_BASE_SIDES;
  const outer: Point2[] = [];
  const inner: Point2[] = [];

  for (let index = 0; index < sides; index += 1) {
    const angle = (Math.PI * 2 * index) / sides;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    outer.push([a * cos, b * sin]);
    inner.push([pocketX + pocketRadius * cos, pocketY + pocketRadius * sin]);
  }

  addPrismSides(positions, outer, 0, height);
  addFanCap(positions, outer, 0, false);
  addAnnulusCap(positions, outer, inner, height);
  addFanCap(positions, inner, floor, true);

  // Стенка полости: обход обратный наружному, нормаль смотрит в отверстие.
  for (let index = 0; index < sides; index += 1) {
    const next = (index + 1) % sides;
    const [ix0, iy0] = inner[index];
    const [ix1, iy1] = inner[next];

    positions.push(
      ix0,
      iy0,
      floor,
      ix0,
      iy0,
      height,
      ix1,
      iy1,
      height,
      ix0,
      iy0,
      floor,
      ix1,
      iy1,
      height,
      ix1,
      iy1,
      floor,
    );
  }
}

/**
 * Овальный плинт под фигурой.
 *
 * Это отдельное замкнутое тело: низ лежит на лотке, верх скрыт под телом.
 * Плинт шире тела, поэтому все нижние торцы ног и брюхо оказываются внутри
 * материала, а не висят над столом. Кромка вертикальная — поддержки не нужны.
 */
function addDeerPlinth(positions: number[], plan: JewelryDeerPlan): void {
  const { centerMm, widthMm, lengthMm, heightMm, topZMm } = plan.plinth;
  const bottomZMm = topZMm - heightMm;
  const sides = JEWELRY_DEER_PLINTH_SIDES;
  const points: Point2[] = [];

  for (let index = 0; index < sides; index += 1) {
    const angle = (Math.PI * 2 * index) / sides;

    points.push([
      centerMm[0] + (widthMm / 2) * Math.cos(angle),
      centerMm[1] + (lengthMm / 2) * Math.sin(angle),
    ]);
  }

  addPrismSides(positions, points, bottomZMm, topZMm);
  addFanCap(positions, points, bottomZMm, false);
  addFanCap(positions, points, topZMm, true);
}

/** Стенки между двумя кольцами: кольца обходятся против часовой стрелки от +оси. */
function addRingWalls(
  positions: number[],
  start: readonly Vec3[],
  end: readonly Vec3[],
): void {
  const count = start.length;

  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    const [ax0, ay0, az0] = start[index];
    const [ax1, ay1, az1] = start[next];
    const [bx0, by0, bz0] = end[index];
    const [bx1, by1, bz1] = end[next];

    positions.push(
      ax0,
      ay0,
      az0,
      ax1,
      ay1,
      az1,
      bx1,
      by1,
      bz1,
      ax0,
      ay0,
      az0,
      bx1,
      by1,
      bz1,
      bx0,
      by0,
      bz0,
    );
  }
}

/** Веер от центра кольца: `forward` — нормаль вдоль оси, иначе против. */
function addRingFan(
  positions: number[],
  center: Vec3,
  ring: readonly Vec3[],
  forward: boolean,
): void {
  const [cx, cy, cz] = center;

  for (let index = 0; index < ring.length; index += 1) {
    const next = (index + 1) % ring.length;
    const [ax, ay, az] = ring[index];
    const [bx, by, bz] = ring[next];

    if (forward) {
      positions.push(cx, cy, cz, ax, ay, az, bx, by, bz);
    } else {
      positions.push(cx, cy, cz, bx, by, bz, ax, ay, az);
    }
  }
}

/**
 * Скруглённая крышка трубы: три кольца и полюс, без единой плоской грани.
 *
 * Кольцо сжимается к центру как `cos`, а вдоль оси уходит на `sin` — получается
 * полусфера. Работает и для круглого кольца рога, и для плоского кольца уха:
 * смещение берётся от центра кольца, поэтому эллипс сжимается в эллипсоид.
 *
 * Сфера на конце рога — это и есть «бутон»: шар радиуса 5.5 дал бы нижнюю
 * полусферу с нависанием 90°, а утолщённая труба с такой крышкой держится в 45°,
 * потому что полусфера продолжает ось трубы, а не торчит из неё.
 */
function addDomeCap(
  positions: number[],
  center: Vec3,
  axis: Vec3,
  ring: readonly Vec3[],
  axialRadiusMm: number,
): void {
  const steps = [Math.PI / 8, Math.PI / 4, (Math.PI * 3) / 8];
  let previous = ring;

  for (const angle of steps) {
    const shrink = Math.cos(angle);
    const offset = multiply(axis, axialRadiusMm * Math.sin(angle));
    const next: Vec3[] = ring.map((point) =>
      add(
        add(center, offset),
        multiply(subtract(point, center), shrink),
      ),
    );

    addRingWalls(positions, previous, next);
    previous = next;
  }

  addRingFan(
    positions,
    add(center, multiply(axis, axialRadiusMm)),
    previous,
    true,
  );
}

/**
 * Добавляет грани примитива three.js в общий неиндексированный массив.
 *
 * `toNonIndexed` нужен до `applyMatrix4`: индексированный Box/Cylinder хранит
 * 24 вершины на 12 треугольников, а генератор собирает STL из независимых
 * треугольников. После переноса вершины копируются как есть.
 */
function addPrimitiveGeometry(
  positions: number[],
  primitive: BufferGeometry,
  matrix: Matrix4,
): void {
  const flat = primitive.index ? primitive.toNonIndexed() : primitive;

  flat.applyMatrix4(matrix);

  const attribute = flat.getAttribute("position");

  for (let index = 0; index < attribute.count; index += 1) {
    positions.push(
      attribute.getX(index),
      attribute.getY(index),
      attribute.getZ(index),
    );
  }

  if (flat !== primitive) {
    flat.dispose();
  }

  primitive.dispose();
}

/** Матрица положения и поворота для примитива. */
function primitiveMatrix(centerMm: Vec3, quaternion: Quaternion): Matrix4 {
  return new Matrix4().compose(
    new Vector3(centerMm[0], centerMm[1], centerMm[2]),
    quaternion,
    new Vector3(1, 1, 1),
  );
}

/**
 * Гранёный блок корпуса, шеи или головы.
 *
 * Размеры заданы по мировым осям: X — ширина, Y — длина, Z — высота. Наклон
 * вокруг X опускает переднюю часть головы и поднимает заднюю, поэтому силуэт
 * читается оленем, а не параллелепипедом.
 */
function addDeerBox(positions: number[], box: JewelryDeerBox): void {
  const geometry = new BoxGeometry(
    box.widthMm,
    box.lengthMm,
    box.heightMm,
  );
  const quaternion = new Quaternion().setFromEuler(
    new Euler((box.tiltXDeg * Math.PI) / 180, 0, 0),
  );

  addPrimitiveGeometry(
    positions,
    geometry,
    primitiveMatrix(box.centerMm, quaternion),
  );
}

/** Прямая нога: восьмигранный цилиндр с плоскими торцами. */
function addDeerLeg(positions: number[], leg: JewelryDeerLeg): void {
  const heightMm = leg.topZMm - leg.bottomZMm;
  const geometry = new CylinderGeometry(
    leg.radiusMm,
    leg.radiusMm,
    heightMm,
    leg.sides,
    1,
    false,
  );
  const quaternion = new Quaternion().setFromEuler(
    new Euler(Math.PI / 2, 0, 0),
  );
  const center: Vec3 = [
    leg.xMm,
    leg.yMm,
    (leg.topZMm + leg.bottomZMm) / 2,
  ];

  addPrimitiveGeometry(
    positions,
    geometry,
    primitiveMatrix(center, quaternion),
  );
}

/** Ухо: четырёхгранный конус от корня в голове к кончику наружу. */
function addDeerEar(positions: number[], ear: JewelryDeerEar): void {
  const from = new Vector3(...ear.rootMm);
  const to = new Vector3(...ear.tipMm);
  const axis = to.clone().sub(from);
  const lengthMm = axis.length();

  if (lengthMm <= 1e-9) {
    return;
  }

  axis.normalize();

  const geometry = new ConeGeometry(
    ear.radiusMm,
    lengthMm,
    ear.sides,
    1,
    false,
  );
  const quaternion = new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    axis,
  );
  const center = from.add(to).multiplyScalar(0.5);

  addPrimitiveGeometry(
    positions,
    geometry,
    primitiveMatrix([center.x, center.y, center.z], quaternion),
  );
}

/**
 * Касательные ломаной: средние для внутренних точек и хорда для концов.
 *
 * Кольца изогнутой трубы ставятся перпендикулярно именно этим касательным, а не
 * одной оси на всю трубу. Иначе на сильном изгибе кольцо наклоняется и труба
 * сужается в месте перегиба.
 */
function polylineTangents(centers: readonly Vec3[]): Vec3[] {
  return centers.map((center, index) => {
    const previous = centers[Math.max(0, index - 1)];
    const next = centers[Math.min(centers.length - 1, index + 1)];

    return normalize(subtract(next, previous));
  });
}

/** Кольца изогнутой трубы с параллельным переносом рамки. */
function curvedTubeRings(
  centers: readonly Vec3[],
  radii: readonly number[],
  sides: number,
): Vec3[][] {
  const tangents = polylineTangents(centers);
  let e1 = tubeFrame(tangents[0]).e1;
  const rings: Vec3[][] = [];

  for (let index = 0; index < centers.length; index += 1) {
    const tangent = tangents[index];
    const projected = subtract(e1, multiply(tangent, dot(e1, tangent)));

    e1 =
      magnitude(projected) > 1e-6
        ? normalize(projected)
        : tubeFrame(tangent).e1;
    const e2 = cross(tangent, e1);
    const ring: Vec3[] = [];

    for (let step = 0; step < sides; step += 1) {
      const angle = (Math.PI * 2 * step) / sides;

      ring.push(
        add(
          centers[index],
          add(
            multiply(e1, Math.cos(angle) * radii[index]),
            multiply(e2, Math.sin(angle) * radii[index]),
          ),
        ),
      );
    }

    rings.push(ring);
  }

  return rings;
}

/**
 * Изогнутая труба с глухим корнем и скруглённым кончиком.
 *
 * Корень всегда утоплен в тело-хозяин, поэтому его веер смотрит внутрь и не
 * считается нависанием. Кончик закрыт полусферой: острой кромки нет, кольцо не
 * цепляется за срез.
 */
function addCurvedTube(
  positions: number[],
  centers: readonly Vec3[],
  radii: readonly number[],
  sides: number,
): void {
  if (centers.length < 2) {
    return;
  }

  const rings = curvedTubeRings(centers, radii, sides);
  const tangents = polylineTangents(centers);
  const first = centers[0];
  const last = centers[centers.length - 1];

  addRingFan(positions, first, rings[0], false);

  for (let index = 0; index < rings.length - 1; index += 1) {
    addRingWalls(positions, rings[index], rings[index + 1]);
  }

  addDomeCap(
    positions,
    last,
    tangents[tangents.length - 1],
    rings[rings.length - 1],
    radii[radii.length - 1],
  );
}

/** Одна труба рога: изогнутая ось с бутоном на конце. */
function addAntlerTube(
  positions: number[],
  path: JewelryDeerAntlerPath,
): void {
  addCurvedTube(
    positions,
    path.points.map(pointToVec),
    path.points.map((point) => point.radiusMm),
    JEWELRY_DEER_ANTLER_SIDES,
  );
}

/**
 * Геометрия подставки «Лесной олень» для набора параметров.
 *
 * Деталь построена Z-вверх; лоток стоит в начале координат, олень смотрит в −Y.
 * Лоток, плинт, корпус, шея, голова, уши, ноги и каждая труба рога — отдельные
 * замкнутые тела. Они пересекаются, поэтому слайсер объединяет их при печати
 * без булевых операций. Нормали не сглаживаются: неиндексированная сетка
 * получает нормаль каждой грани, и low-poly силуэт остаётся гранёным.
 */
export function createJewelryDeerGeometry(
  params: Partial<JewelryStandParams> = {},
): BufferGeometry {
  const plan = jewelryDeerPlan(params);
  const positions: number[] = [];

  addDeerBase(positions, plan);
  addDeerPlinth(positions, plan);
  addDeerBox(positions, plan.body);
  addDeerBox(positions, plan.neck);
  addDeerBox(positions, plan.head);

  for (const ear of plan.ears) {
    addDeerEar(positions, ear);
  }

  for (const leg of plan.legs) {
    addDeerLeg(positions, leg);
  }

  for (const path of plan.antlers) {
    addAntlerTube(positions, path);
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));

  // `computeVertexNormals` на неиндексированной сетке записывает нормаль грани.
  // Никакого сглаживания после неё нет: корпус и голова читаются кубами, а
  // трубы рогов — десятигранниками.
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

