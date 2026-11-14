/**
 * Геометрия древа «Плетёное древо».
 *
 * Третья форма премиум-коллекции: чаша-лоток для украшений, из дна которой
 * растёт живое дерево — изогнутый ствол с раструбом у корня, ярусы ветвей с
 * развилками и загнутыми вверх крючками, на которые вешают кольца, серьги и
 * цепочки. Композиция повторяет классические подставки-деревья: чаша ловит
 * мелочь, крона держит украшения.
 *
 * Ствол не цилиндр: ось ведёт плавную дугу, радиус падает кверху на две трети,
 * а у самого дна добавляется раструб — расширение вниз, как у настоящего корня.
 * Раструб разгоняется медленнее 45°, поэтому первые слои ложатся без поддержек.
 *
 * Ветви строятся рекурсией: основная ветвь выходит из ствола под 52°…58° к
 * столу, по пути плавно загибается до 84°…88° — так получается крючок, с
 * которого не соскальзывает кольцо. От основной ветви отходят две дочерние,
 * от них — ещё по одной: три уровня дают ажурную крону, а не метёлку.
 * Скорость роста радиуса вдоль трубы ограничена, поэтому утолщение-бусина на
 * конце не создаёт нависания круче 45° при любом ползунке.
 *
 * Чаша — тело вращения: плоское дно на столе, вертикальная внешняя стенка с
 * фаской 45° у кромки, скруглённый борт и наклонённая внутрь внутренняя стенка.
 * Такая оболочка замкнута без булевых операций и печатается без поддержек.
 *
 * Все тела замкнуты по отдельности и пересекаются: низ ствола уходит в дно
 * чаши, корни ветвей — в ствол. Слайсер объединяет их при печати.
 *
 * Система координат общая для коллекции: Z вверх, низ на z = 0, центр базы в
 * начале координат.
 */

import { BufferGeometry, Float32BufferAttribute } from "three";

import {
  normalizeJewelryStandParams,
  type JewelryStandParams,
} from "@/lib/constructor/params";

/** Подъём основной ветви у ствола, градусы: пять градусов запаса к правилу 45°. */
export const JEWELRY_TREE_MIN_ELEVATION_DEG = 50;

/** Радиус ветви у ствола, мм: Ø5 держит кольцо и не ломается при печати. */
export const JEWELRY_TREE_BRANCH_RADIUS_MM = 2.5;

/** Радиус бусины на конце ветви, мм: Ø5 — кольцо останавливается на крючке. */
export const JEWELRY_TREE_BRANCH_BUD_RADIUS_MM = 2.6;

/** Радиус ствола у корня в долях высоты: H180 → Ø12.2, H100 → Ø6.8. */
const JEWELRY_TREE_TRUNK_RADIUS_SHARE = 0.034;

/** Пределы радиуса ствола, мм. */
const JEWELRY_TREE_TRUNK_MIN_RADIUS_MM = 3.2;
const JEWELRY_TREE_TRUNK_MAX_RADIUS_MM = 7;

/** Радиус верхушки ствола: 0.34 корня — ствол заметно тоньше к кроне. */
const JEWELRY_TREE_TRUNK_TIP_SHARE = 0.34;

/** Изгиб оси ствола в долях радиуса чаши: дуга, а не штырь. */
const JEWELRY_TREE_TRUNK_SWAY_SHARE = 0.1;

/** Станций ствола: 26 колец дают ровную дугу без граней. */
const JEWELRY_TREE_TRUNK_SAMPLES = 26;

/** Число сторон ствола: 16 при Ø12 дают хорду 2.3 мм. */
const JEWELRY_TREE_TRUNK_SIDES = 16;

/** Число сторон ветвей: они тоньше, двенадцати хватает. */
const JEWELRY_TREE_BRANCH_SIDES = 12;

/** Станций ветви: 16 колец хватает на плавный крючок. */
const JEWELRY_TREE_BRANCH_STEPS = 16;

/** Колец в скруглённой крышке: три дают сферу без плоских граней. */
const JEWELRY_TREE_CAP_STEPS = 3;

/** Длина основной ветви в долях радиуса чаши: крона шире лотка. */
const JEWELRY_TREE_BRANCH_REACH_SHARE = 1.5;

/** Сужение ветви к концу: 0.42 корня — тонкий крючок. */
const JEWELRY_TREE_BRANCH_TIP_SHARE = 0.42;

/** Множитель длины дочерней ветви и её радиус у развилки. */
const JEWELRY_TREE_CHILD_LENGTH_SHARE = 0.54;
const JEWELRY_TREE_CHILD_RADIUS_SHARE = 0.66;

/** Множитель длины веточки третьего уровня. */
const JEWELRY_TREE_TWIG_LENGTH_SHARE = 0.52;

/** Подъём веточек-крючков у их концов, градусы. */
const JEWELRY_TREE_BRANCH_END_ELEVATION_DEG = 86;

/** Боковой увод дочерних ветвей от родителя, градусы: 28…58 по ползунку изгиба. */
const JEWELRY_TREE_CHILD_SWING_MIN_DEG = 28;
const JEWELRY_TREE_CHILD_SWING_MAX_DEG = 58;

/** Штырь под кольцо: высота над ветвью, мм, и его радиус, мм. */
const JEWELRY_TREE_THORN_LENGTH_MM = 7;
const JEWELRY_TREE_THORN_RADIUS_MM = 1.35;

/** Доля высоты, где сидят ярусы основных ветвей: от нижнего до верхнего. */
const JEWELRY_TREE_BRANCH_ROOT_BAND = [0.3, 0.66] as const;

/** Доли высоты, где сидят верхние ветви, и их длина в долях основной. */
const JEWELRY_TREE_CROWN_ROOT_SHARES = [0.7, 0.78, 0.86] as const;
const JEWELRY_TREE_CROWN_LENGTH_SHARE = 0.34;

/** Шаг азимута между основными ветвями: золотое сечение даёт естественный ряд. */
const JEWELRY_TREE_BRANCH_AZIMUTH_STEP = 0.61803;

/** Запас под бусину на верхушке, мм: крона не пробивает ползунок высоты. */
const JEWELRY_TREE_TOP_HEADROOM_MM = 1.4;

/** Число сегментов чаши: 96 на Ø120 дают хорду 3.9 мм. */
const JEWELRY_TREE_DISH_SIDES = 96;

/** Глубина борта в долях радиуса чаши и её пределы, мм. */
const JEWELRY_TREE_DISH_RIM_SHARE = 0.2;
const JEWELRY_TREE_DISH_MIN_RIM_MM = 9;
const JEWELRY_TREE_DISH_MAX_RIM_MM = 18;

/** Толщина дна в долях радиуса, мм и пределы. */
const JEWELRY_TREE_DISH_FLOOR_SHARE = 0.06;
const JEWELRY_TREE_DISH_MIN_FLOOR_MM = 2.6;
const JEWELRY_TREE_DISH_MAX_FLOOR_MM = 5;

/** Толщина стенки чаши в долях радиуса, мм и пределы. */
const JEWELRY_TREE_DISH_WALL_SHARE = 0.055;
const JEWELRY_TREE_DISH_MIN_WALL_MM = 2.2;
const JEWELRY_TREE_DISH_MAX_WALL_MM = 3.4;

/** Скругление кромки чаши: 45° — фаска, которая печатается без поддержек. */
const JEWELRY_TREE_DISH_EDGE_SHARE = 0.03;
const JEWELRY_TREE_DISH_MIN_EDGE_MM = 1.6;
const JEWELRY_TREE_DISH_MAX_EDGE_MM = 2.6;

/** Наклон внутренней стенки чаши: доля глубины, уходящая к центру. */
const JEWELRY_TREE_DISH_TAPER_SHARE = 0.12;


/** Точка оси трубы: центр кольца и его радиус. */
export type JewelryTreePoint = {
  readonly xMm: number;
  readonly yMm: number;
  readonly zMm: number;
  readonly radiusMm: number;
};

/** Труба плана: ствол, ветвь, веточка или штырь под кольцо. */
export type JewelryTreeTube = {
  readonly id: string;
  readonly kind: "trunk" | "branch" | "twig" | "thorn";
  readonly points: readonly JewelryTreePoint[];
};

/** Точка профиля чаши в плоскости (радиус, высота). */
export type JewelryTreeDishPoint = {
  readonly radiusMm: number;
  readonly zMm: number;
};

/** Чаша-лоток: внешний радиус, высота борта и профиль тела вращения. */
export type JewelryTreeDish = {
  readonly outerRadiusMm: number;
  readonly rimZMm: number;
  readonly floorZMm: number;
  readonly wallThicknessMm: number;
  readonly profile: readonly JewelryTreeDishPoint[];
};

/**
 * План древа: чаша, ствол, ветви и габарит.
 *
 * План считается без three.js: по нему строятся и геометрия, и подписи, и
 * проверки в `scripts/test-jewelry-geometry.ts`.
 */
export type JewelryTreePlan = {
  readonly baseRadiusMm: number;
  readonly baseHeightMm: number;
  readonly trunkRootZMm: number;
  readonly trunkSpanMm: number;
  readonly trunkRadiusMm: number;
  readonly trunkTipRadiusMm: number;
  readonly trunk: JewelryTreeTube;
  readonly branches: readonly JewelryTreeTube[];
  readonly mainBranchCount: number;
  readonly twigCount: number;
  readonly thornCount: number;
  readonly dish: JewelryTreeDish;
  readonly crownZMm: number;
  readonly reachMm: number;
  readonly flattestSurfaceDeg: number;
  readonly heightMm: number;
};

/** Тройка координат. */
type Vec3 = [number, number, number];

/** Сложение векторов. */
function addVector(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/** Разность векторов. */
function subtractVector(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/** Умножение вектора на число. */
function multiplyVector(v: Vec3, factor: number): Vec3 {
  return [v[0] * factor, v[1] * factor, v[2] * factor];
}

/** Длина вектора. */
function lengthVector(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

/** Единичный вектор; нулевой остаётся нулевым. */
function normalizeVector(v: Vec3): Vec3 {
  const length = lengthVector(v);

  return length > 1e-9 ? multiplyVector(v, 1 / length) : [0, 0, 0];
}

/** Векторное произведение. */
function crossVector(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/**
 * Плавная ступенька от 0 до 1.
 *
 * Скачок производной на концах отсутствует, поэтому радиус и подъём меняются
 * без изломов, а значит и без нависания: там, где считается нависание, важна
 * производная, а не сама кривая.
 */
function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge1 <= edge0) {
    return value >= edge1 ? 1 : 0;
  }

  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));

  return t * t * (3 - 2 * t);
}

/** Зажимает число в отрезок. */
function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Градусы в радианы. */
function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Профиль чаши-лотка.
 *
 * Обход идёт по границе материала: от нижнего полюса наружу по дну, вверх по
 * внешней стенке, через скруглённую кромку внутрь, вниз по внутренней стенке и
 * к центру дна. При таком обходе нормали всех стенок смотрят наружу, а дно
 * лежит на столе — тело получается замкнутым и печатается без поддержек.
 */
function treeDish(baseRadiusMm: number): JewelryTreeDish {
  const rimZMm = clampNumber(
    baseRadiusMm * JEWELRY_TREE_DISH_RIM_SHARE,
    JEWELRY_TREE_DISH_MIN_RIM_MM,
    JEWELRY_TREE_DISH_MAX_RIM_MM,
  );
  const floorZMm = clampNumber(
    baseRadiusMm * JEWELRY_TREE_DISH_FLOOR_SHARE,
    JEWELRY_TREE_DISH_MIN_FLOOR_MM,
    JEWELRY_TREE_DISH_MAX_FLOOR_MM,
  );
  const wallThicknessMm = clampNumber(
    baseRadiusMm * JEWELRY_TREE_DISH_WALL_SHARE,
    JEWELRY_TREE_DISH_MIN_WALL_MM,
    JEWELRY_TREE_DISH_MAX_WALL_MM,
  );
  const edgeMm = clampNumber(
    baseRadiusMm * JEWELRY_TREE_DISH_EDGE_SHARE,
    JEWELRY_TREE_DISH_MIN_EDGE_MM,
    JEWELRY_TREE_DISH_MAX_EDGE_MM,
  );
  const innerRimRadiusMm = baseRadiusMm - wallThicknessMm;
  const innerFloorRadiusMm =
    innerRimRadiusMm - (rimZMm - floorZMm) * JEWELRY_TREE_DISH_TAPER_SHARE;
  const profile: JewelryTreeDishPoint[] = [
    { radiusMm: 0, zMm: 0 },
    { radiusMm: baseRadiusMm * 0.55, zMm: 0 },
    { radiusMm: baseRadiusMm - edgeMm, zMm: 0 },
    { radiusMm: baseRadiusMm, zMm: edgeMm },
    { radiusMm: baseRadiusMm, zMm: rimZMm - edgeMm * 0.9 },
    { radiusMm: baseRadiusMm - edgeMm * 0.9, zMm: rimZMm },
    { radiusMm: innerRimRadiusMm, zMm: rimZMm - edgeMm * 0.6 },
    { radiusMm: innerFloorRadiusMm, zMm: floorZMm + edgeMm },
    { radiusMm: baseRadiusMm * 0.6, zMm: floorZMm },
    { radiusMm: 0, zMm: floorZMm },
  ];

  return {
    outerRadiusMm: baseRadiusMm,
    rimZMm,
    floorZMm,
    wallThicknessMm,
    profile,
  };
}


/** Что нужно для одной трубы: корень, направление, длина и радиусы. */
type JewelryBranchSpec = {
  readonly root: Vec3;
  readonly azimuthRad: number;
  readonly startElevationDeg: number;
  readonly endElevationDeg: number;
  readonly swingRad: number;
  readonly lengthMm: number;
  readonly rootRadiusMm: number;
  readonly tipRadiusMm: number;
  readonly budRadiusMm: number;
  readonly tipLimitZMm: number;
};

/**
 * Один проход роста ветви по станциям.
 *
 * Подъём растёт по smoothstep от старта к концу, поэтому ветвь сначала уходит в
 * сторону, а затем загибается вверх — крюк для кольца. Радиус падает к концу и
 * на последних станциях подрастает в бусину: кольцо сползает по уклону и
 * останавливается на ней.
 */
function growBranchOnce(
  spec: JewelryBranchSpec,
  lengthMm: number,
): JewelryTreePoint[] {
  const startElevationRad = degreesToRadians(spec.startElevationDeg);
  const endElevationRad = degreesToRadians(spec.endElevationDeg);
  const stepMm = lengthMm / JEWELRY_TREE_BRANCH_STEPS;
  const points: JewelryTreePoint[] = [];
  let x = spec.root[0];
  let y = spec.root[1];
  let z = spec.root[2];
  let previousRadiusMm = spec.rootRadiusMm;

  for (let index = 0; index <= JEWELRY_TREE_BRANCH_STEPS; index += 1) {
    const share = index / JEWELRY_TREE_BRANCH_STEPS;
    const elevationRad =
      startElevationRad +
      (endElevationRad - startElevationRad) * smoothstep(0.32, 1, share);
    const azimuthRad =
      spec.azimuthRad + spec.swingRad * smoothstep(0.12, 1, share);
    const taper =
      spec.rootRadiusMm +
      (spec.tipRadiusMm - spec.rootRadiusMm) * Math.pow(share, 0.9);
    const bud =
      (spec.budRadiusMm - spec.tipRadiusMm) * smoothstep(0.78, 1, share);
    // Рост радиуса вдоль оси «съедает» подъём: бусина не имеет права расти
    // быстрее, чем позволяет запас до 46°. Иначе на короткой ветви, поджатой
    // потолком кроны, бусина превращается в нависающий гриб.
    const growthLimit =
      Math.tan(degreesToRadians((elevationRad * 180) / Math.PI - 46)) *
      stepMm;
    const radiusMm = Math.min(
      taper + bud,
      previousRadiusMm + Math.max(growthLimit, 0),
    );

    points.push({ xMm: x, yMm: y, zMm: z, radiusMm });
    previousRadiusMm = radiusMm;

    const horizontalMm = Math.cos(elevationRad) * stepMm;

    x += horizontalMm * Math.cos(azimuthRad);
    y += horizontalMm * Math.sin(azimuthRad);
    z += Math.sin(elevationRad) * stepMm;
  }

  return points;
}

/**
 * Ветвь с подгонкой под потолок кроны.
 *
 * Верхушка ветви вместе с бусиной не должна пробивать ползунок высоты, поэтому
 * длина укорачивается, пока кончик не опустится под предел. Хватает одного-двух
 * проходов: высота кончика почти пропорциональна длине.
 */
function growBranch(spec: JewelryBranchSpec): JewelryTreePoint[] {
  let lengthMm = Math.max(spec.lengthMm, 2);
  let points = growBranchOnce(spec, lengthMm);
  const allowedRiseMm = spec.tipLimitZMm - spec.root[2] - spec.budRadiusMm;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const riseMm = points[points.length - 1].zMm - spec.root[2];

    if (riseMm <= allowedRiseMm) {
      break;
    }

    const scale = allowedRiseMm > 1 ? (allowedRiseMm / riseMm) * 0.97 : 0.4;

    lengthMm *= clampNumber(scale, 0.3, 0.95);
    points = growBranchOnce(spec, lengthMm);
  }

  return points;
}

/** Точка ломаной по доле длины: развилки сидят точно на ветви. */
function branchPointAt(
  points: readonly JewelryTreePoint[],
  share: number,
): JewelryTreePoint {
  const index = Math.round(clampNumber(share, 0, 1) * (points.length - 1));

  return points[index];
}


/**
 * План древа: чаша, ствол, ярусы ветвей и габарит.
 *
 * Ствол ведёт плавную дугу, его радиус падает кверху, а у дна добавлен раструб
 * корня. Ветви строятся рекурсией: основная, две дочерние и веточка третьего
 * уровня. Порядок ярусов и азимутов держит крону ажурной: соседние ветви не
 * слипаются, кольца на них не цепляют друг друга.
 */
export function jewelryTreePlan(
  params: Partial<JewelryStandParams> = {},
): JewelryTreePlan {
  const normalized = normalizeJewelryStandParams(params);
  const baseRadiusMm = normalized.treeBaseDiameter / 2;
  const heightMm = normalized.treeHeight;
  const dish = treeDish(baseRadiusMm);
  const trunkRootZMm = dish.floorZMm - 0.8;
  const trunkRadiusMm = clampNumber(
    heightMm * JEWELRY_TREE_TRUNK_RADIUS_SHARE,
    JEWELRY_TREE_TRUNK_MIN_RADIUS_MM,
    JEWELRY_TREE_TRUNK_MAX_RADIUS_MM,
  );
  const trunkTipRadiusMm = trunkRadiusMm * JEWELRY_TREE_TRUNK_TIP_SHARE;
  const trunkSpanMm = Math.max(
    heightMm - trunkRootZMm - trunkTipRadiusMm,
    heightMm * 0.7,
  );
  const swayAzimuthRad = Math.PI * 0.25;
  const swayMm = baseRadiusMm * JEWELRY_TREE_TRUNK_SWAY_SHARE;

  /** Точка оси ствола: пологая дуга от корня к верхушке. */
  const axisAt = (share: number): Vec3 => {
    const bowMm = swayMm * Math.sin(Math.PI * share);

    return [
      bowMm * Math.cos(swayAzimuthRad),
      bowMm * Math.sin(swayAzimuthRad),
      trunkRootZMm + share * trunkSpanMm,
    ];
  };

  /** Радиус ствола: раструб у корня, сужение к верхушке. */
  const trunkRadiusAt = (share: number): number =>
    trunkRadiusMm *
    (1 - (1 - JEWELRY_TREE_TRUNK_TIP_SHARE) * Math.pow(share, 0.85)) *
    (1 + 0.6 * (1 - smoothstep(0, 0.18, share)));

  const trunkPoints: JewelryTreePoint[] = [];

  for (let index = 0; index <= JEWELRY_TREE_TRUNK_SAMPLES; index += 1) {
    const share = index / JEWELRY_TREE_TRUNK_SAMPLES;
    const [x, y, z] = axisAt(share);

    trunkPoints.push({
      xMm: x,
      yMm: y,
      zMm: z,
      radiusMm: trunkRadiusAt(share),
    });
  }

  const trunk: JewelryTreeTube = {
    id: "trunk",
    kind: "trunk",
    points: trunkPoints,
  };
  const branches: JewelryTreeTube[] = [];
  const crownLimitZMm = heightMm - JEWELRY_TREE_TOP_HEADROOM_MM;
  const reachBaseMm = baseRadiusMm * JEWELRY_TREE_BRANCH_REACH_SHARE;
  const mainCount = normalized.treeBranchCount;
  const twist = normalized.treeTwist;
  const childSwingDeg =
    JEWELRY_TREE_CHILD_SWING_MIN_DEG +
    (JEWELRY_TREE_CHILD_SWING_MAX_DEG - JEWELRY_TREE_CHILD_SWING_MIN_DEG) *
      twist;
  let twigCount = 0;
  let thornCount = 0;

  /** Добавляет трубу в план и возвращает её точки: от них растут развилки. */
  const addBranch = (
    id: string,
    kind: JewelryTreeTube["kind"],
    spec: JewelryBranchSpec,
  ): readonly JewelryTreePoint[] => {
    const points = growBranch(spec);

    branches.push({ id, kind, points });

    return points;
  };


  for (let index = 0; index < mainCount; index += 1) {
    const lane = mainCount > 1 ? index / (mainCount - 1) : 0.5;
    const share =
      JEWELRY_TREE_BRANCH_ROOT_BAND[0] +
      (JEWELRY_TREE_BRANCH_ROOT_BAND[1] - JEWELRY_TREE_BRANCH_ROOT_BAND[0]) *
        lane;
    const root = axisAt(share);
    const azimuthRad =
      Math.PI * 2 * ((index * JEWELRY_TREE_BRANCH_AZIMUTH_STEP + 0.08) % 1);
    const rootRadiusMm = Math.max(
      trunkRadiusAt(share) * 0.5,
      JEWELRY_TREE_BRANCH_RADIUS_MM,
    );
    const lengthMm = reachBaseMm * (1.05 - 0.35 * share);
    const points = addBranch(`branch-${index + 1}`, "branch", {
      root,
      azimuthRad,
      startElevationDeg: JEWELRY_TREE_MIN_ELEVATION_DEG + 4 * lane,
      endElevationDeg: JEWELRY_TREE_MIN_ELEVATION_DEG + 6 + 4 * lane,
      swingRad:
        degreesToRadians(12 + 26 * twist) * (index % 2 === 0 ? 1 : -1),
      lengthMm,
      rootRadiusMm,
      tipRadiusMm: rootRadiusMm * JEWELRY_TREE_BRANCH_TIP_SHARE,
      budRadiusMm: JEWELRY_TREE_BRANCH_BUD_RADIUS_MM,
      tipLimitZMm: crownLimitZMm,
    });
    const childLengthMm = lengthMm * JEWELRY_TREE_CHILD_LENGTH_SHARE;

    // Две дочерние ветви: от середины и от верхней трети родителя.
    for (let childIndex = 0; childIndex < 2; childIndex += 1) {
      const anchor = branchPointAt(points, childIndex === 0 ? 0.44 : 0.68);
      const childAzimuthRad =
        azimuthRad +
        degreesToRadians(childSwingDeg) * (childIndex === 0 ? -1 : 1);
      const childRootRadiusMm =
        anchor.radiusMm * JEWELRY_TREE_CHILD_RADIUS_SHARE;
      const childPoints = addBranch(
        `branch-${index + 1}-${childIndex + 1}`,
        "branch",
        {
          root: [anchor.xMm, anchor.yMm, anchor.zMm],
          azimuthRad: childAzimuthRad,
          startElevationDeg: 58,
          endElevationDeg: 64,
          swingRad:
            degreesToRadians(10 + 18 * twist) *
            (childIndex === 0 ? -1 : 1),
          lengthMm: childLengthMm,
          rootRadiusMm: childRootRadiusMm,
          tipRadiusMm: childRootRadiusMm * JEWELRY_TREE_BRANCH_TIP_SHARE,
          budRadiusMm: JEWELRY_TREE_BRANCH_BUD_RADIUS_MM * 0.86,
          tipLimitZMm: crownLimitZMm,
        },
      );

      // Веточка третьего уровня: тонкая, почти вертикальная.
      const twigAnchor = branchPointAt(childPoints, 0.58);
      const twigRootRadiusMm = twigAnchor.radiusMm * 0.7;

      addBranch(`twig-${index + 1}-${childIndex + 1}`, "twig", {
        root: [twigAnchor.xMm, twigAnchor.yMm, twigAnchor.zMm],
        azimuthRad:
          childAzimuthRad + degreesToRadians(childSwingDeg * 0.5),
        startElevationDeg: 66,
        endElevationDeg: 72,
        swingRad: degreesToRadians(8 + 14 * twist),
        lengthMm: childLengthMm * JEWELRY_TREE_TWIG_LENGTH_SHARE,
        rootRadiusMm: twigRootRadiusMm,
        tipRadiusMm: twigRootRadiusMm * JEWELRY_TREE_BRANCH_TIP_SHARE,
        budRadiusMm: JEWELRY_TREE_BRANCH_BUD_RADIUS_MM * 0.8,
        tipLimitZMm: crownLimitZMm,
      });
      twigCount += 1;
    }

    // Штырь под кольцо: вертикальный отросток на нижней части ветви.
    const thornAnchor = branchPointAt(points, 0.3);

    addBranch(`thorn-${index + 1}`, "thorn", {
      root: [thornAnchor.xMm, thornAnchor.yMm, thornAnchor.zMm],
      azimuthRad,
      startElevationDeg: 84,
      endElevationDeg: JEWELRY_TREE_BRANCH_END_ELEVATION_DEG,
      swingRad: 0,
      lengthMm: JEWELRY_TREE_THORN_LENGTH_MM,
      rootRadiusMm: JEWELRY_TREE_THORN_RADIUS_MM,
      tipRadiusMm: JEWELRY_TREE_THORN_RADIUS_MM * 0.74,
      budRadiusMm: JEWELRY_TREE_BRANCH_BUD_RADIUS_MM * 0.76,
      tipLimitZMm: crownLimitZMm,
    });
    thornCount += 1;
  }

  // Верхние ветви: короткие, почти вертикальные — они и дают макушку.
  JEWELRY_TREE_CROWN_ROOT_SHARES.forEach((share, index) => {
    const crownRootRadiusMm = Math.max(
      trunkRadiusAt(share) * 0.55,
      JEWELRY_TREE_THORN_RADIUS_MM * 1.4,
    );

    addBranch(`crown-${index + 1}`, "branch", {
      root: axisAt(share),
      azimuthRad: Math.PI * 2 * ((0.31 + index * 0.37) % 1),
      startElevationDeg: 50,
      endElevationDeg: 56,
      swingRad: degreesToRadians(10 + 18 * twist),
      lengthMm: reachBaseMm * JEWELRY_TREE_CROWN_LENGTH_SHARE,
      rootRadiusMm: crownRootRadiusMm,
      tipRadiusMm: crownRootRadiusMm * JEWELRY_TREE_BRANCH_TIP_SHARE,
      budRadiusMm: JEWELRY_TREE_BRANCH_BUD_RADIUS_MM * 0.9,
      tipLimitZMm: crownLimitZMm,
    });
  });


  // Ствол и ветви строятся по долям высоты, поэтому верхушка может не дотянуть
  // до ползунка доли миллиметра. Лёгкая растяжка по Z ставит габарит ровно на
  // заданную высоту; углы от неё только круче, нависаний она не добавляет.
  let rawTopMm = dish.rimZMm;

  for (const tube of [trunk, ...branches]) {
    for (const point of tube.points) {
      rawTopMm = Math.max(rawTopMm, point.zMm + point.radiusMm);
    }
  }

  const zScale = rawTopMm > 0 ? heightMm / rawTopMm : 1;
  const fitPoints = (
    points: readonly JewelryTreePoint[],
  ): JewelryTreePoint[] =>
    points.map((point) => ({ ...point, zMm: point.zMm * zScale }));
  const fittedTrunk: JewelryTreeTube = {
    ...trunk,
    points: fitPoints(trunk.points),
  };
  const fittedBranches: JewelryTreeTube[] = branches.map((branch) => ({
    ...branch,
    points: fitPoints(branch.points),
  }));

  // Самая пологая точка поверхности: у трубы с осью под α низ наклонён на α, а
  // рост радиуса «съедает» подъём на atan(Δr/L). Именно это число проверяет
  // тест, а не наклон оси.
  let flattestSurfaceDeg = 180;
  let reachMm = baseRadiusMm;
  let topMm = dish.rimZMm;

  for (const tube of [fittedTrunk, ...fittedBranches]) {
    for (let index = 0; index < tube.points.length - 1; index += 1) {
      const from = tube.points[index];
      const to = tube.points[index + 1];
      const run = Math.hypot(to.xMm - from.xMm, to.yMm - from.yMm);
      const rise = to.zMm - from.zMm;
      const travelled = Math.hypot(run, rise);
      const growth = Math.max(
        0,
        (to.radiusMm - from.radiusMm) / Math.max(travelled, 1e-6),
      );
      const surface =
        (Math.atan2(rise, run) * 180) / Math.PI -
        (Math.atan(growth) * 180) / Math.PI;

      flattestSurfaceDeg = Math.min(flattestSurfaceDeg, surface);
    }

    for (const point of tube.points) {
      reachMm = Math.max(
        reachMm,
        Math.hypot(point.xMm, point.yMm) + point.radiusMm,
      );
      topMm = Math.max(topMm, point.zMm + point.radiusMm);
    }
  }

  return {
    baseRadiusMm,
    baseHeightMm: dish.rimZMm,
    trunkRootZMm,
    trunkSpanMm,
    trunkRadiusMm,
    trunkTipRadiusMm,
    trunk: fittedTrunk,
    branches: fittedBranches,
    mainBranchCount: mainCount,
    twigCount,
    thornCount,
    dish,
    crownZMm: (trunkRootZMm + trunkSpanMm + trunkTipRadiusMm) * zScale,
    reachMm,
    flattestSurfaceDeg,
    heightMm: Math.round(topMm * 100) / 100,
  };
}

/** Высота модели, мм: габарит по Z для подписи и предпросмотра. */
export function jewelryTreeHeightMm(
  params: Partial<JewelryStandParams> = {},
): number {
  return jewelryTreePlan(params).heightMm;
}


/** Базис кольца, перпендикулярного оси. */
function ringBasis(tangent: Vec3): { e1: Vec3; e2: Vec3 } {
  const reference: Vec3 = Math.abs(tangent[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const e1 = normalizeVector(crossVector(reference, tangent));

  return { e1, e2: crossVector(tangent, e1) };
}

/** Касательные ломаной: на изломе берётся биссектриса, кольцо не разворачивается. */
function polylineTangents(centers: readonly Vec3[]): Vec3[] {
  const tangents: Vec3[] = [];

  for (let index = 0; index < centers.length; index += 1) {
    const forward =
      index + 1 < centers.length
        ? subtractVector(centers[index + 1], centers[index])
        : subtractVector(centers[index], centers[index - 1]);
    const backward =
      index > 0
        ? subtractVector(centers[index], centers[index - 1])
        : forward;

    tangents.push(
      normalizeVector(
        addVector(normalizeVector(backward), normalizeVector(forward)),
      ),
    );
  }

  return tangents;
}

/** Веер из полюса к кольцу; `upward` задаёт сторону нормали. */
function addRingFan(
  positions: number[],
  center: Vec3,
  ring: readonly Vec3[],
  upward: boolean,
): void {
  for (let step = 0; step < ring.length; step += 1) {
    const current = ring[step];
    const next = ring[(step + 1) % ring.length];

    if (upward) {
      positions.push(...center, ...current, ...next);
    } else {
      positions.push(...center, ...next, ...current);
    }
  }
}

/** Стенка между двумя кольцами; обход держит нормаль наружу. */
function addRingWalls(
  positions: number[],
  lower: readonly Vec3[],
  upper: readonly Vec3[],
): void {
  for (let step = 0; step < lower.length; step += 1) {
    const next = (step + 1) % lower.length;

    positions.push(
      ...lower[step],
      ...lower[next],
      ...upper[next],
      ...lower[step],
      ...upper[next],
      ...upper[step],
    );
  }
}


/**
 * Скруглённая крышка на конце трубы.
 *
 * Полусфера из трёх колец: у сферической поверхности нет граней под углом к
 * оси, а значит нет и нависания круче 45° — верхушки ветвей и бусины
 * печатаются без поддержек.
 */
function addRoundedCap(
  positions: number[],
  center: Vec3,
  tangent: Vec3,
  radiusMm: number,
  base: readonly Vec3[],
): void {
  const { e1, e2 } = ringBasis(tangent);
  const pole = addVector(center, multiplyVector(tangent, radiusMm));
  let previous = [...base];

  for (let step = 1; step <= JEWELRY_TREE_CAP_STEPS; step += 1) {
    const polar = (step / (JEWELRY_TREE_CAP_STEPS + 1)) * (Math.PI / 2);
    const ringRadiusMm = radiusMm * Math.cos(polar);
    const offsetMm = radiusMm * Math.sin(polar);
    const ring: Vec3[] = [];

    for (let index = 0; index < base.length; index += 1) {
      const angle = (Math.PI * 2 * index) / base.length;

      ring.push(
        addVector(
          addVector(center, multiplyVector(tangent, offsetMm)),
          addVector(
            multiplyVector(e1, Math.cos(angle) * ringRadiusMm),
            multiplyVector(e2, Math.sin(angle) * ringRadiusMm),
          ),
        ),
      );
    }

    addRingWalls(positions, previous, ring);
    previous = ring;
  }

  addRingFan(positions, pole, previous, true);
}

/**
 * Одна труба: кольца по станциям, глухой низ и скруглённый верх.
 *
 * Низ закрыт веером против оси: он всегда утоплен в соседнее тело (в дно чаши
 * у ствола, в ствол или ветвь у побегов), поэтому наружу не смотрит.
 */
function addTube(
  positions: number[],
  points: readonly JewelryTreePoint[],
  sides: number,
): void {
  if (points.length < 2) {
    return;
  }

  const centers = points.map(
    (point): Vec3 => [point.xMm, point.yMm, point.zMm],
  );
  const tangents = polylineTangents(centers);
  const rings = points.map((point, index) => {
    const { e1, e2 } = ringBasis(tangents[index]);
    const ring: Vec3[] = [];

    for (let step = 0; step < sides; step += 1) {
      const angle = (Math.PI * 2 * step) / sides;

      ring.push(
        addVector(
          centers[index],
          addVector(
            multiplyVector(e1, Math.cos(angle) * point.radiusMm),
            multiplyVector(e2, Math.sin(angle) * point.radiusMm),
          ),
        ),
      );
    }

    return ring;
  });

  addRingFan(positions, centers[0], rings[0], false);

  for (let index = 0; index < rings.length - 1; index += 1) {
    addRingWalls(positions, rings[index], rings[index + 1]);
  }

  const lastIndex = rings.length - 1;

  addRoundedCap(
    positions,
    centers[lastIndex],
    tangents[lastIndex],
    points[lastIndex].radiusMm,
    rings[lastIndex],
  );
}


/**
 * Чаша-лоток как тело вращения.
 *
 * Профиль обходится по границе материала, поэтому нормали смотрят наружу, а
 * полюса закрыты веерами: у внешнего дна — вниз, у внутреннего — вверх. Стенки
 * вертикальные или наклонены наружу кверху, нависаний нет.
 */
function addDish(positions: number[], plan: JewelryTreePlan): void {
  const profile = plan.dish.profile;
  const sides = JEWELRY_TREE_DISH_SIDES;
  const rings: Vec3[][] = profile.map((point) => {
    const ring: Vec3[] = [];

    for (let step = 0; step < sides; step += 1) {
      const angle = (Math.PI * 2 * step) / sides;

      ring.push([
        point.radiusMm * Math.cos(angle),
        point.radiusMm * Math.sin(angle),
        point.zMm,
      ]);
    }

    return ring;
  });

  for (let index = 0; index < profile.length - 1; index += 1) {
    const from = profile[index];
    const to = profile[index + 1];

    if (from.radiusMm <= 0) {
      addRingFan(positions, [0, 0, from.zMm], rings[index + 1], false);
    } else if (to.radiusMm <= 0) {
      addRingFan(positions, [0, 0, to.zMm], rings[index], true);
    } else {
      addRingWalls(positions, rings[index], rings[index + 1]);
    }
  }
}

/**
 * Геометрия древа для набора параметров.
 *
 * Функция принимает частичные параметры: недостающие поля берутся из значений
 * по умолчанию, поэтому предпросмотр может вызвать её с любым набором.
 */
export function createJewelryTreeGeometry(
  params: Partial<JewelryStandParams> = {},
): BufferGeometry {
  const plan = jewelryTreePlan(params);
  const positions: number[] = [];

  addDish(positions, plan);
  addTube(positions, plan.trunk.points, JEWELRY_TREE_TRUNK_SIDES);

  for (const branch of plan.branches) {
    addTube(positions, branch.points, JEWELRY_TREE_BRANCH_SIDES);
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();

  return geometry;
}
