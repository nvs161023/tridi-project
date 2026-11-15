/**
 * Геометрия подставки «Рогатое дерево».
 *
 * Третья форма премиум-коллекции — овальный лоток, из которого растёт гладкий
 * ствол с раструбом и раскидистая крона из рогов. Тело оленя удалено полностью:
 * в модуле нет головы, шеи, ушей и ног, осталась только опора и геометрия рогов.
 *
 * Ствол — тело вращения на 32 сегмента: нижний радиус 15 мм, верхний 10 мм,
 * высота 60 мм от лица лотка до начала кроны. У самого лотка радиус плавно
 * раздаётся до 30 мм — получается раструб, который переходит в ствол без
 * ступеньки. Профиль сужается только кверху, поэтому ни одна грань не нависает
 * над столом.
 *
 * Рога образуют высокую крону, на которую вешают кольца, серьги и цепочки. Два
 * ствола на сторону задают развилку, от них отходят первичные ветви, а часть
 * первичных ветвится ещё раз. Осевые линии — кубические Безье; кольца строятся
 * параллельным переносом, поэтому труба не перекручивается на изгибе. Каждый шаг
 * ломаной поднимается не положе 46° к столу (на компактной кроне — 56°): это
 * правило печати без поддержек. На кончиках стоят небольшие бутоны, чтобы кольцо
 * не соскальзывало.
 *
 * В овальном лотке вырезана сетка из десяти сквозных отверстий Ø1.2 мм: в них
 * вставляют крючки серёг. Отверстия идут двумя колонками по пять и стоят вне
 * раструба, поэтому стенка вокруг каждого не тоньше двух миллиметров.
 *
 * Все тела замкнуты по отдельности; слайсер объединяет их при печати, булевых
 * операций нет. Нормали считаются по вершинам, а затем сглаживаются по углу до
 * 60°: ствол, раструб и трубы рогов выглядят цельными, кромки лотка и отверстий
 * остаются чёткими. В предпросмотре материал гладкий, без `flatShading`.
 *
 * Система координат общая для коллекции: Z вверх, низ на z = 0, центр лотка в
 * начале координат, длинная ось лотка идёт по X.
 */

import {
  BufferGeometry,
  Float32BufferAttribute,
  ShapeUtils,
  Vector2,
} from "three";

import { applyCreasedNormals } from "@/lib/constructor/mesh-normals";
import {
  normalizeJewelryStandParams,
  type JewelryStandParams,
} from "@/lib/constructor/params";

/** Максимальная высота готовой модели, мм: поле печати обычного принтера. */
export const JEWELRY_ANTLER_TREE_MAX_HEIGHT_MM = 240;

/** Максимальный габарит модели по X и Y, мм: стол 250 × 250. */
export const JEWELRY_ANTLER_TREE_MAX_FOOTPRINT_MM = 250;

/** Минимальный диаметр ветви рога, мм: тоньше ветвь ломается при печати. */
export const JEWELRY_ANTLER_TREE_MIN_ANTLER_DIAMETER_MM = 3;

/** Высота овального лотка, мм. Полости под монету у новой базы нет. */
export const JEWELRY_ANTLER_TREE_BASE_HEIGHT_MM = 5;

/** Высота ствола от лица лотка до начала рогов, мм. */
export const JEWELRY_ANTLER_TREE_TRUNK_HEIGHT_MM = 60;

/** Радиус ствола у раструба, мм: по ТЗ нижний радиус 15. */
export const JEWELRY_ANTLER_TREE_TRUNK_BOTTOM_RADIUS_MM = 15;

/** Радиус ствола под рогами, мм: по ТЗ верхний радиус 10. */
export const JEWELRY_ANTLER_TREE_TRUNK_TOP_RADIUS_MM = 10;

/** Сегментов у ствола: 32 дают гладкий силуэт и хорду меньше 3 мм. */
export const JEWELRY_ANTLER_TREE_TRUNK_SIDES = 32;

/** Радиус раструба на лице лотка, мм: широкая опора под стволом. */
export const JEWELRY_ANTLER_TREE_FLARE_RADIUS_MM = 30;

/** Высота раструба, мм: за столько радиус сходит с 30 до 15. */
export const JEWELRY_ANTLER_TREE_FLARE_HEIGHT_MM = 10;

/** Диаметр отверстия под крючок серьги, мм. */
export const JEWELRY_ANTLER_TREE_HOLE_DIAMETER_MM = 1.2;

/** Колонок и рядов в сетке отверстий: 2 × 5 = 10 серёг. */
export const JEWELRY_ANTLER_TREE_HOLE_COLUMNS = 2;
export const JEWELRY_ANTLER_TREE_HOLE_ROWS = 5;
export const JEWELRY_ANTLER_TREE_HOLE_COUNT =
  JEWELRY_ANTLER_TREE_HOLE_COLUMNS * JEWELRY_ANTLER_TREE_HOLE_ROWS;

/** Сегментов у каждого отверстия: Ø1.2 мм остаётся круглым после STL. */
const JEWELRY_ANTLER_TREE_HOLE_SIDES = 16;

/** Сегментов у овального лотка: 96 дают ровный край на 250 мм. */
const JEWELRY_ANTLER_TREE_BASE_SIDES = 96;

/** Радиусы труб рогов и минимальный подъём хорды, градусы. */
export const JEWELRY_ANTLER_TREE_ANTLER_ROOT_RADIUS_MM = 7;
export const JEWELRY_ANTLER_TREE_ANTLER_TIP_RADIUS_MM = 1.4;
export const JEWELRY_ANTLER_TREE_ANTLER_BUD_RADIUS_MM = 1.8;
export const JEWELRY_ANTLER_TREE_TINE_ROOT_RADIUS_MM = 4.2;
export const JEWELRY_ANTLER_TREE_ANTLER_MIN_ELEVATION_DEG = 46;

/** Сегментов у трубы рога: 10 граней сглаживаются до круглого сечения. */
const JEWELRY_ANTLER_TREE_ANTLER_SIDES = 10;

/** Насколько корень рога утоплен в верхушку ствола, мм. */
const JEWELRY_ANTLER_TREE_ROOT_BURY_MM = 6;

/** Вертикальный подъём последнего участка трубы, мм: бутон не нависает. */
const JEWELRY_ANTLER_TREE_TIP_LIFT_MM = 1.5;

/** Точка в пространстве, локальный тип модуля. */
type Vec3 = readonly [number, number, number];

/** Точка осевой линии рога: центр кольца и радиус трубы. */
export type JewelryAntlerTreePoint = {
  readonly xMm: number;
  readonly yMm: number;
  readonly zMm: number;
  readonly radiusMm: number;
};

/** Одна труба рога: ствол или отросток. */
export type JewelryAntlerTreeAntlerPath = {
  /** Имя для тестов и отчёта: `beam-right`, `tine-2-left` и так далее. */
  readonly id: string;
  /** `beam` — ствол с бутоном на конце, `tine` — отросток. */
  readonly kind: "beam" | "tine";
  /** Сторона: −1 — левый рог, 1 — правый. */
  readonly side: -1 | 1;
  /** Осевая линия от корня до бутона. */
  readonly points: readonly JewelryAntlerTreePoint[];
  /** Радиус бутона на конце, мм. */
  readonly budRadiusMm: number;
};

/** Сквозное отверстие в лотке: центр и радиус на плоскости стола. */
export type JewelryAntlerTreeHole = {
  readonly xMm: number;
  readonly yMm: number;
  readonly radiusMm: number;
};

/** Точка профиля ствола: высота и наружный радиус. */
export type JewelryAntlerTreeStemPoint = {
  readonly zMm: number;
  readonly radiusMm: number;
};

/** План «Рогатого дерева»: всё, что проверяется тестом и подписью панели. */
export type JewelryAntlerTreePlan = {
  readonly baseLengthMm: number;
  readonly baseWidthMm: number;
  readonly baseHeightMm: number;
  /** Высота ствола от лица лотка до рогов, мм: всегда 60. */
  readonly trunkHeightMm: number;
  readonly trunkBottomRadiusMm: number;
  readonly trunkTopRadiusMm: number;
  readonly trunkSides: number;
  /** Низ ствола утоплен в лоток на 1 мм, чтобы тела не стыковались в плоскости. */
  readonly trunkRootZMm: number;
  readonly trunkTopZMm: number;
  readonly flareRadiusMm: number;
  readonly flareHeightMm: number;
  readonly flareStartZMm: number;
  readonly flareEndZMm: number;
  readonly stemProfile: readonly JewelryAntlerTreeStemPoint[];
  /** Центр корня рогов внутри верхушки ствола, мм. */
  readonly antlerRootZMm: number;
  readonly holes: readonly JewelryAntlerTreeHole[];
  readonly holeDiameterMm: number;
  /** Заданный размах рогов от кончика до кончика, мм. */
  readonly antlerSpreadMm: number;
  /** Верх рогов, мм: самая высокая точка модели. */
  readonly antlerTopZMm: number;
  /** Крайняя точка рогов по X от оси, мм: размах с учётом толщины бутона. */
  readonly antlerOuterXMm: number;
  /** Крайняя точка рогов по Y, мм: глубина кроны. */
  readonly antlerOuterYMm: number;
  readonly antlers: readonly JewelryAntlerTreeAntlerPath[];
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

/** Единичный вектор; нулевой остаётся вертикальным, чтобы не делить на ноль. */
function normalize(v: Vec3): Vec3 {
  const size = magnitude(v);

  return size > 1e-12 ? multiply(v, 1 / size) : [0, 0, 1];
}

/** Линейная интерполяция двух чисел. */
function lerpNumber(from: number, to: number, share: number): number {
  return from + (to - from) * share;
}

/** Ограничение числа отрезком. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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

/** Скалярное произведение. */
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Гладкая ступень 0…1: у неё ограничена производная, а значит и нависание. */
function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge1 <= edge0) {
    return value >= edge1 ? 1 : 0;
  }

  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);

  return t * t * (3 - 2 * t);
}

/** Точка осевой линии как вектор. */
function pointToVec(point: JewelryAntlerTreePoint): Vec3 {
  return [point.xMm, point.yMm, point.zMm];
}

/**
 * Базис трубы: два единичных вектора, перпендикулярных оси.
 *
 * Для первой точки изогнутой трубы мировая X проецируется на плоскость кольца:
 * грань не перекручивается, а дальше рамка переносится параллельно от кольца к
 * кольцу.
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
 * положе `minElevationDeg`, поэтому слайсер не поставит поддержку. Радиус
 * линейно сужается, а на последних 20 % мягко раздаётся в бутон: кольцо
 * останавливается на нём, а не соскальзывает с гладкого конуса. Радиус снизу
 * ограничен половиной минимального диаметра — даже тонкая ветвь третьего порядка
 * остаётся прочной.
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
}): JewelryAntlerTreeAntlerPath {
  const minimumRadiusMm =
    JEWELRY_ANTLER_TREE_MIN_ANTLER_DIAMETER_MM / 2;
  const centers = enforceMinElevation(
    sampleCubic(options.controls, options.samples),
    options.minElevationDeg,
  );
  const lastCenter = centers[centers.length - 1];

  // Последний участок уходит строго вверх: крышка бутона становится
  // вертикальной, и у сферы не появляется нижней полусферы с нависанием.
  centers.push({
    xMm: lastCenter.xMm,
    yMm: lastCenter.yMm,
    zMm: lastCenter.zMm + JEWELRY_ANTLER_TREE_TIP_LIFT_MM,
  });
  const points = centers.map((center, index) => {
    const share = centers.length > 1 ? index / (centers.length - 1) : 1;
    const bud = smoothstep(0.8, 1, share);
    const radiusMm =
      lerpNumber(options.rootRadiusMm, options.tipRadiusMm, share) +
      (options.budRadiusMm - options.tipRadiusMm) * bud;

    return {
      xMm: center.xMm,
      yMm: center.yMm,
      zMm: center.zMm,
      radiusMm: Math.max(minimumRadiusMm, radiusMm),
    };
  });

  return {
    id: options.id,
    kind: options.kind,
    side: options.side,
    points,
    budRadiusMm: Math.max(minimumRadiusMm, options.budRadiusMm),
  };
}

/**
 * Ветвь рога в нормированных координатах кроны.
 *
 * `tip`, `c1` и `c2` заданы долями: X — половины размаха, Y — глубины кроны,
 * Z — высоты над корнем. `parent` — имя ствола или ветви, `attach` — доля её
 * длины, откуда растёт эта ветвь. Так все развилки получаются связанными.
 */
type JewelryAntlerTreeBranchSpec = {
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
 * 46°. Стволы задают силуэт дерева; ветви заполняют его ярусами, а три
 * развилки добавляют ярус третьего порядка. Форма повторяется зеркально,
 * поэтому крона читается симметричной.
 */
const JEWELRY_ANTLER_TREE_BRANCHES: readonly JewelryAntlerTreeBranchSpec[] = [
  {
    id: "beam-out",
    parent: null,
    attach: 0,
    tip: [1, -0.08, 1],
    c1: [0.02, -0.02, 0.34],
    c2: [0.56, -0.14, 0.78],
    rootRadiusMm: JEWELRY_ANTLER_TREE_ANTLER_ROOT_RADIUS_MM,
    samples: 18,
  },
  {
    id: "beam-in",
    parent: "beam-out",
    attach: 0.14,
    tip: [0.34, -0.04, 0.96],
    c1: [0.06, -0.04, 0.5],
    c2: [0.2, -0.1, 0.78],
    rootRadiusMm: JEWELRY_ANTLER_TREE_TINE_ROOT_RADIUS_MM * 1.2,
    samples: 16,
  },
  {
    id: "out-1",
    parent: "beam-out",
    attach: 0.16,
    tip: [0.62, -0.18, 0.42],
    c1: [0.2, -0.1, 0.24],
    c2: [0.45, -0.16, 0.33],
    rootRadiusMm: JEWELRY_ANTLER_TREE_TINE_ROOT_RADIUS_MM,
    samples: 11,
  },
  {
    id: "out-2",
    parent: "beam-out",
    attach: 0.3,
    tip: [0.94, -0.3, 0.6],
    c1: [0.4, -0.1, 0.4],
    c2: [0.72, -0.25, 0.5],
    rootRadiusMm: JEWELRY_ANTLER_TREE_TINE_ROOT_RADIUS_MM,
    samples: 11,
  },
  {
    id: "out-3",
    parent: "beam-out",
    attach: 0.44,
    tip: [0.99, 0.05, 0.76],
    c1: [0.56, 0, 0.58],
    c2: [0.82, 0.02, 0.67],
    rootRadiusMm: JEWELRY_ANTLER_TREE_TINE_ROOT_RADIUS_MM * 0.92,
    samples: 11,
  },
  {
    id: "out-4",
    parent: "beam-out",
    attach: 0.58,
    tip: [0.8, 0.18, 0.86],
    c1: [0.6, 0.08, 0.7],
    c2: [0.72, 0.12, 0.79],
    rootRadiusMm: JEWELRY_ANTLER_TREE_TINE_ROOT_RADIUS_MM * 0.84,
    samples: 10,
  },
  {
    id: "out-5",
    parent: "beam-out",
    attach: 0.74,
    tip: [0.56, -0.15, 0.95],
    c1: [0.56, 0, 0.82],
    c2: [0.52, -0.1, 0.89],
    rootRadiusMm: JEWELRY_ANTLER_TREE_TINE_ROOT_RADIUS_MM * 0.76,
    samples: 10,
  },
  {
    id: "in-1",
    parent: "beam-in",
    attach: 0.38,
    tip: [0.62, -0.32, 0.5],
    c1: [0.3, -0.18, 0.38],
    c2: [0.48, -0.28, 0.44],
    rootRadiusMm: JEWELRY_ANTLER_TREE_TINE_ROOT_RADIUS_MM * 0.9,
    samples: 10,
  },
  {
    id: "in-2",
    parent: "beam-in",
    attach: 0.58,
    tip: [0.38, -0.42, 0.7],
    c1: [0.32, -0.25, 0.58],
    c2: [0.34, -0.36, 0.64],
    rootRadiusMm: JEWELRY_ANTLER_TREE_TINE_ROOT_RADIUS_MM * 0.8,
    samples: 10,
  },
  {
    id: "in-3",
    parent: "beam-in",
    attach: 0.76,
    tip: [0.14, -0.28, 0.88],
    c1: [0.23, -0.2, 0.78],
    c2: [0.16, -0.25, 0.83],
    rootRadiusMm: JEWELRY_ANTLER_TREE_TINE_ROOT_RADIUS_MM * 0.7,
    samples: 9,
  },
  {
    id: "out-2a",
    parent: "out-2",
    attach: 0.55,
    tip: [0.72, -0.5, 0.74],
    c1: [0.65, -0.38, 0.62],
    c2: [0.68, -0.48, 0.68],
    rootRadiusMm: JEWELRY_ANTLER_TREE_TINE_ROOT_RADIUS_MM * 0.55,
    samples: 9,
  },
  {
    id: "in-1a",
    parent: "in-1",
    attach: 0.55,
    tip: [0.78, -0.45, 0.68],
    c1: [0.7, -0.4, 0.56],
    c2: [0.75, -0.45, 0.62],
    rootRadiusMm: JEWELRY_ANTLER_TREE_TINE_ROOT_RADIUS_MM * 0.5,
    samples: 9,
  },
  {
    id: "out-3a",
    parent: "out-3",
    attach: 0.58,
    tip: [1, -0.2, 0.9],
    c1: [0.86, -0.18, 0.76],
    c2: [0.94, -0.22, 0.83],
    rootRadiusMm: JEWELRY_ANTLER_TREE_TINE_ROOT_RADIUS_MM * 0.45,
    samples: 9,
  },
];

/** Радиус ствола на высоте `zMm`: раструб у лотка и линейное сужение кверху. */
function stemRadiusAt(
  zMm: number,
  flareStartZMm: number,
  flareEndZMm: number,
  trunkTopZMm: number,
): number {
  if (zMm <= flareStartZMm) {
    return JEWELRY_ANTLER_TREE_FLARE_RADIUS_MM;
  }

  if (zMm <= flareEndZMm) {
    return lerpNumber(
      JEWELRY_ANTLER_TREE_FLARE_RADIUS_MM,
      JEWELRY_ANTLER_TREE_TRUNK_BOTTOM_RADIUS_MM,
      smoothstep(flareStartZMm, flareEndZMm, zMm),
    );
  }

  return lerpNumber(
    JEWELRY_ANTLER_TREE_TRUNK_BOTTOM_RADIUS_MM,
    JEWELRY_ANTLER_TREE_TRUNK_TOP_RADIUS_MM,
    clamp((zMm - flareEndZMm) / (trunkTopZMm - flareEndZMm), 0, 1),
  );
}

/**
 * Сетка отверстий под серьги.
 *
 * Две колонки стоят на длинной оси лотка, пять рядов — вдоль короткой. Смещение
 * колонок прижато к краю раструба с запасом 4 мм, поэтому отверстия не попадают
 * в тело ствола. Строки в долях ширины лотка одинаково работают и на компактной
 * базе 150 × 100, и на витринной 250 × 150.
 */
function buildEarringHoles(
  baseLengthMm: number,
  baseWidthMm: number,
): JewelryAntlerTreeHole[] {
  const radiusMm = JEWELRY_ANTLER_TREE_HOLE_DIAMETER_MM / 2;
  const xOffsetMm = Math.max(
    JEWELRY_ANTLER_TREE_FLARE_RADIUS_MM + 4,
    baseLengthMm * 0.225,
  );
  const holes: JewelryAntlerTreeHole[] = [];

  for (let column = 0; column < JEWELRY_ANTLER_TREE_HOLE_COLUMNS; column += 1) {
    const xMm = column === 0 ? -xOffsetMm : xOffsetMm;

    for (let row = 0; row < JEWELRY_ANTLER_TREE_HOLE_ROWS; row += 1) {
      const share =
        (row - (JEWELRY_ANTLER_TREE_HOLE_ROWS - 1) / 2) * 0.19;

      holes.push({ xMm, yMm: baseWidthMm * share, radiusMm });
    }
  }

  return holes;
}

/**
 * План «Рогатого дерева» до построения меша.
 *
 * План считается без three.js: по нему строятся геометрия, подпись панели и
 * проверки. Ствол всегда поднимается на 60 мм над лицом лотка. Высота кроны
 * выбирается из размаха, но ограничена так, чтобы самая верхняя точка вместе с
 * бутоном оставалась в печатном конверте 240 мм; поэтому ствол не приходится
 * масштабировать и он сохраняет заданные 60 мм при любом положении ползунка.
 */
function buildJewelryAntlerTreePlan(
  params: Partial<JewelryStandParams> = {},
): JewelryAntlerTreePlan {
  const normalized = normalizeJewelryStandParams(params);
  const baseLengthMm = normalized.baseLength;
  const baseWidthMm = normalized.baseWidth;
  const antlerSpreadMm = normalized.antlerSpread;
  const baseHeightMm = JEWELRY_ANTLER_TREE_BASE_HEIGHT_MM;
  const flareStartZMm = baseHeightMm;
  const flareEndZMm = baseHeightMm + JEWELRY_ANTLER_TREE_FLARE_HEIGHT_MM;
  const trunkTopZMm = baseHeightMm + JEWELRY_ANTLER_TREE_TRUNK_HEIGHT_MM;
  const trunkRootZMm = baseHeightMm - 1;
  const antlerRootZMm = trunkTopZMm - JEWELRY_ANTLER_TREE_ROOT_BURY_MM;
  const stemProfile: JewelryAntlerTreeStemPoint[] = [];

  for (let zMm = trunkRootZMm; zMm <= trunkTopZMm; zMm += 1) {
    stemProfile.push({
      zMm,
      radiusMm: stemRadiusAt(
        zMm,
        flareStartZMm,
        flareEndZMm,
        trunkTopZMm,
      ),
    });
  }

  // Оба ствола рогов растут из одной точки в верхушке ствола. Корень утоплен
  // на 6 мм, поэтому его глухой торец лежит в материале и не требует поддержки.
  const rootX = 0.5;
  const rootY = 0;
  const halfSpreadMm =
    antlerSpreadMm / 2 - JEWELRY_ANTLER_TREE_ANTLER_BUD_RADIUS_MM;
  const crownHeightMm = Math.min(172, 120 + (antlerSpreadMm - 100) * 0.5);
  const crownDepthMm = halfSpreadMm * 0.53;

  const crownPoint = (
    side: -1 | 1,
    [x, y, z]: readonly [number, number, number],
  ): Vec3 => [
    side * x * halfSpreadMm,
    rootY + y * crownDepthMm,
    antlerRootZMm + z * crownHeightMm,
  ];

  const pointAtShare = (
    path: JewelryAntlerTreeAntlerPath,
    share: number,
  ): { point: Vec3; radiusMm: number } => {
    const points = path.points;
    const scaled = clamp(share, 0, 1) * (points.length - 1);
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

  const antlers: JewelryAntlerTreeAntlerPath[] = [];
  const antlerMinElevationDeg =
    antlerSpreadMm <= 140 ? 56 : antlerSpreadMm <= 190 ? 51 : 46;

  for (const side of [-1, 1] as const) {
    const suffix = side < 0 ? "left" : "right";
    const built = new Map<string, JewelryAntlerTreeAntlerPath>();

    for (const spec of JEWELRY_ANTLER_TREE_BRANCHES) {
      const parent = spec.parent ? built.get(spec.parent) : undefined;
      const attach = parent ? pointAtShare(parent, spec.attach) : null;
      const root: Vec3 = attach
        ? attach.point
        : [side * rootX, rootY, antlerRootZMm];
      const rootRadiusMm =
        parent && attach
          ? Math.max(
              0.8,
              Math.min(spec.rootRadiusMm, attach.radiusMm - 0.12),
            )
          : spec.rootRadiusMm;
      const tipRadiusMm = Math.min(
        JEWELRY_ANTLER_TREE_ANTLER_TIP_RADIUS_MM,
        rootRadiusMm * 0.55,
      );
      const budRadiusMm = Math.min(
        JEWELRY_ANTLER_TREE_ANTLER_BUD_RADIUS_MM,
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
  let antlerOuterYMm = 0;

  for (const path of antlers) {
    for (const point of path.points) {
      antlerTopMm = Math.max(antlerTopMm, point.zMm + point.radiusMm);
      antlerOuterXMm = Math.max(
        antlerOuterXMm,
        Math.abs(point.xMm) + point.radiusMm,
      );
      antlerOuterYMm = Math.max(
        antlerOuterYMm,
        Math.abs(point.yMm) + point.radiusMm,
      );
    }

    const last = path.points[path.points.length - 1];

    antlerTopMm = Math.max(antlerTopMm, last.zMm + path.budRadiusMm);
    antlerOuterXMm = Math.max(
      antlerOuterXMm,
      Math.abs(last.xMm) + path.budRadiusMm,
    );
    antlerOuterYMm = Math.max(
      antlerOuterYMm,
      Math.abs(last.yMm) + path.budRadiusMm,
    );
  }

  return {
    baseLengthMm,
    baseWidthMm,
    baseHeightMm,
    trunkHeightMm: JEWELRY_ANTLER_TREE_TRUNK_HEIGHT_MM,
    trunkBottomRadiusMm: JEWELRY_ANTLER_TREE_TRUNK_BOTTOM_RADIUS_MM,
    trunkTopRadiusMm: JEWELRY_ANTLER_TREE_TRUNK_TOP_RADIUS_MM,
    trunkSides: JEWELRY_ANTLER_TREE_TRUNK_SIDES,
    trunkRootZMm,
    trunkTopZMm,
    flareRadiusMm: JEWELRY_ANTLER_TREE_FLARE_RADIUS_MM,
    flareHeightMm: JEWELRY_ANTLER_TREE_FLARE_HEIGHT_MM,
    flareStartZMm,
    flareEndZMm,
    stemProfile,
    antlerRootZMm,
    holes: buildEarringHoles(baseLengthMm, baseWidthMm),
    holeDiameterMm: JEWELRY_ANTLER_TREE_HOLE_DIAMETER_MM,
    antlerSpreadMm,
    antlerTopZMm: antlerTopMm,
    antlerOuterXMm,
    antlerOuterYMm,
    antlers,
    heightMm: Math.round(Math.max(trunkTopZMm, antlerTopMm) * 100) / 100,
  };
}

/** План модели для панели, теста и диспетчера. */
export function jewelryAntlerTreePlan(
  params: Partial<JewelryStandParams> = {},
): JewelryAntlerTreePlan {
  return buildJewelryAntlerTreePlan(params);
}

/** Высота модели, мм: габарит по Z для подписи и предпросмотра. */
export function jewelryAntlerTreeHeightMm(
  params: Partial<JewelryStandParams> = {},
): number {
  return jewelryAntlerTreePlan(params).heightMm;
}

/** Точка на плоскости стола. */
type Point2 = readonly [number, number];

/** Точка в пространстве для треугольников. */
type Point3 = readonly [number, number, number];

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

/** Веер от центра кольца: `forward` — нормаль вдоль +Z, иначе вдоль −Z. */
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
 * Сфера на конце рога — это и есть бутон. Она продолжает ось трубы, поэтому
 * нижней полусферы с нависанием 90° нет: кольцо не соскальзывает и поддержка не
 * нужна.
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
  path: JewelryAntlerTreeAntlerPath,
): void {
  addCurvedTube(
    positions,
    path.points.map(pointToVec),
    path.points.map((point) => point.radiusMm),
    JEWELRY_ANTLER_TREE_ANTLER_SIDES,
  );
}

/** Эллипс лотка против часовой стрелки: длинная ось по X. */
function ellipseContour(
  lengthMm: number,
  widthMm: number,
  sides: number,
): Point2[] {
  const points: Point2[] = [];

  for (let index = 0; index < sides; index += 1) {
    const angle = (Math.PI * 2 * index) / sides;

    points.push([
      (lengthMm / 2) * Math.cos(angle),
      (widthMm / 2) * Math.sin(angle),
    ]);
  }

  return points;
}

/** Контур отверстия против часовой стрелки. */
function holeContour(hole: JewelryAntlerTreeHole): Point2[] {
  const points: Point2[] = [];

  for (let index = 0; index < JEWELRY_ANTLER_TREE_HOLE_SIDES; index += 1) {
    const angle = (Math.PI * 2 * index) / JEWELRY_ANTLER_TREE_HOLE_SIDES;

    points.push([
      hole.xMm + hole.radiusMm * Math.cos(angle),
      hole.yMm + hole.radiusMm * Math.sin(angle),
    ]);
  }

  return points;
}

/**
 * Треугольник с нормалью в заданную сторону.
 *
 * Earcut возвращает обход без гарантии знака, а STL требует наружную нормаль.
 * Поэтому порядок вершин проверяется по векторному произведению и при
 * необходимости меняется.
 */
function addOrientedTriangle(
  positions: number[],
  a: Point3,
  b: Point3,
  c: Point3,
  normal: Point3,
): void {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const forward = nx * normal[0] + ny * normal[1] + nz * normal[2] >= 0;

  if (forward) {
    positions.push(...a, ...b, ...c);
  } else {
    positions.push(...a, ...c, ...b);
  }
}

/**
 * Крышка лотка с отверстиями.
 *
 * Earcut возвращает индексы в общем массиве: сначала наружный контур, затем
 * отверстия в порядке массива. Точка находится по индексу без поиска по
 * координатам, а знак каждого треугольника выравнивается по нормали крышки.
 */
function addPerforatedCap(
  positions: number[],
  outer: readonly Point2[],
  holes: readonly (readonly Point2[])[],
  zMm: number,
  top: boolean,
): void {
  const outerPoints = outer.map(([x, y]) => new Vector2(x, y));
  const holePoints = holes.map((hole) =>
    hole.map(([x, y]) => new Vector2(x, y)),
  );
  const faces = ShapeUtils.triangulateShape(outerPoints, holePoints);
  const normal: Point3 = [0, 0, top ? 1 : -1];
  const pointAt = (index: number): Point2 => {
    if (index < outer.length) {
      return outer[index];
    }

    let offset = index - outer.length;

    for (const hole of holes) {
      if (offset < hole.length) {
        return hole[offset];
      }

      offset -= hole.length;
    }

    return outer[0];
  };

  for (const [a, b, c] of faces) {
    const pa = pointAt(a);
    const pb = pointAt(b);
    const pc = pointAt(c);

    addOrientedTriangle(
      positions,
      [pa[0], pa[1], zMm],
      [pb[0], pb[1], zMm],
      [pc[0], pc[1], zMm],
      normal,
    );
  }
}

/** Внутренняя стенка отверстия: нормаль смотрит к его оси, в пустоту. */
function addHoleWall(
  positions: number[],
  hole: readonly Point2[],
  z0: number,
  z1: number,
): void {
  for (let index = 0; index < hole.length; index += 1) {
    const next = (index + 1) % hole.length;
    const [x0, y0] = hole[index];
    const [x1, y1] = hole[next];

    positions.push(
      x0,
      y0,
      z0,
      x0,
      y0,
      z1,
      x1,
      y1,
      z1,
      x0,
      y0,
      z0,
      x1,
      y1,
      z1,
      x1,
      y1,
      z0,
    );
  }
}

/** Наружные стенки овального лотка против часовой стрелки. */
function addOuterWalls(
  positions: number[],
  outer: readonly Point2[],
  z0: number,
  z1: number,
): void {
  for (let index = 0; index < outer.length; index += 1) {
    const next = (index + 1) % outer.length;
    const [x0, y0] = outer[index];
    const [x1, y1] = outer[next];

    positions.push(
      x0,
      y0,
      z0,
      x1,
      y1,
      z0,
      x1,
      y1,
      z1,
      x0,
      y0,
      z0,
      x1,
      y1,
      z1,
      x0,
      y0,
      z1,
    );
  }
}

/**
 * Овальный лоток со сквозными отверстиями под серьги.
 *
 * Тело замкнуто: нижняя крышка, наружная стенка, верхняя крышка и внутренние
 * стенки десяти отверстий. Полости под монету нет — у «Рогатого дерева» лоток
 * цельный, а дырки нужны только крючкам серёг.
 */
function addAntlerTreeBase(
  positions: number[],
  plan: JewelryAntlerTreePlan,
): void {
  const outer = ellipseContour(
    plan.baseLengthMm,
    plan.baseWidthMm,
    JEWELRY_ANTLER_TREE_BASE_SIDES,
  );
  const holes = plan.holes.map(holeContour);

  addPerforatedCap(positions, outer, holes, 0, false);
  addPerforatedCap(
    positions,
    outer,
    holes,
    plan.baseHeightMm,
    true,
  );
  addOuterWalls(positions, outer, 0, plan.baseHeightMm);

  for (const hole of holes) {
    addHoleWall(positions, hole, 0, plan.baseHeightMm);
  }
}

/** Кольцо ствола на высоте профиля: 32 точки против часовой стрелки. */
function stemRing(
  zMm: number,
  radiusMm: number,
  sides: number,
): Vec3[] {
  const ring: Vec3[] = [];

  for (let index = 0; index < sides; index += 1) {
    const angle = (Math.PI * 2 * index) / sides;

    ring.push([
      radiusMm * Math.cos(angle),
      radiusMm * Math.sin(angle),
      zMm,
    ]);
  }

  return ring;
}

/**
 * Ствол с раструбом: одно замкнутое тело вращения на 32 сегмента.
 *
 * Профиль начинается на 1 мм ниже лица лотка, чтобы нижняя крышка не совпала с
 * его верхней плоскостью. У лотка радиус 30 мм, к высоте 10 мм он сходит до 15,
 * а дальше линейно сужается до 10 под рогами. Радиус только уменьшается, поэтому
 * нависаний нет.
 */
function addAntlerTreeStem(
  positions: number[],
  plan: JewelryAntlerTreePlan,
): void {
  const rings = plan.stemProfile.map((point) =>
    stemRing(point.zMm, point.radiusMm, plan.trunkSides),
  );
  const first = plan.stemProfile[0];
  const last = plan.stemProfile[plan.stemProfile.length - 1];

  addRingFan(positions, [0, 0, first.zMm], rings[0], false);

  for (let index = 0; index < rings.length - 1; index += 1) {
    addRingWalls(positions, rings[index], rings[index + 1]);
  }

  addRingFan(positions, [0, 0, last.zMm], rings[rings.length - 1], true);
}

/**
 * Геометрия подставки «Рогатое дерево» для набора параметров.
 *
 * Деталь построена Z-вверх; лоток стоит в начале координат, длинная ось идёт по
 * X, ствол — по Z. Лоток, ствол и каждая трубка рога — отдельные замкнутые тела.
 * Они пересекаются, поэтому слайсер объединяет их при печати без булевых
 * операций. Нормали считаются по вершинам и сглаживаются по углу 60°: ствол и
 * рога выглядят цельными, кромки лотка и отверстий остаются чёткими.
 */
export function createJewelryAntlerTreeGeometry(
  params: Partial<JewelryStandParams> = {},
): BufferGeometry {
  const plan = jewelryAntlerTreePlan(params);
  const positions: number[] = [];

  addAntlerTreeBase(positions, plan);
  addAntlerTreeStem(positions, plan);

  for (const path of plan.antlers) {
    addAntlerTube(positions, path);
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();

  const smoothed = applyCreasedNormals(geometry, 60);

  smoothed.computeBoundingBox();
  smoothed.computeBoundingSphere();

  return smoothed;
}










