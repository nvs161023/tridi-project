/**
 * Геометрия древа «Плетёное древо».
 *
 * Третья форма премиум-коллекции: круглая плита с корневой юбкой, витой ствол,
 * спиральные ветви и сетка сквозных отверстий под серьги.
 *
 * Ствол — коса из четырёх прядей. Прядь это труба, ось которой обвивает ось
 * древа: каждая стоит на своём радиусе и сдвинута по фазе на четверть витка,
 * поэтому с любого ракурса видно, что ствол сплетён, а не процарапан. Между
 * прядями остаётся канал, его закрывает сердечник — тонкая труба по оси: коса
 * получается сплошной, а ложбинки между прядями остаются глубокими.
 *
 * Число витков не задаётся напрямую. Слайдер `treeTwist` выбирает долю от
 * предела, при котором ось пряди ещё поднимается не положе 48° к столу: у трубы,
 * наклонённой на α, самая нижняя точка поверхности наклонена на те же α, и
 * правило 45° переводится в правило «ось не положе 45°». Предел ищется делением
 * пополам по тем же станциям, по которым строятся кольца, поэтому коса остаётся
 * печатаемой при любом сочетании высоты и диаметра базы.
 *
 * Ветви растут из ствола по спирали: азимут каждой следующей сдвинут на угол
 * золотого сечения, высота — своя, а подъём держится 60°. Верхние ветви длиннее
 * и заканчиваются бусиной: кольцо надевают на ветвь, оно сползает по уклону и
 * останавливается на бусине. Загиба крюка вниз нет намеренно: нисходящий загиб
 * обязан пройти через горизонталь, а труба, ось которой ближе 45° к столу, уже
 * требует поддержек. Вместо него ветвь уходит по дуге в сторону — на 40° по
 * азимуту, — и утолщается: этого хватает, чтобы кольцо не соскальзывало.
 * Нижние ветви — короткие прямые штыри под 66°: на них висят браслеты.
 *
 * База — плита Ø120 × 5 мм с сеткой сквозных отверстий Ø1.2: крючок серьги
 * проходит насквозь, стенки отверстий вертикальные, поэтому мостов нет. По краю
 * плиты стоит корневая юбка — кольцо с волнистым контуром и скруглённой кромкой:
 * это «корни» древа и одновременно утяжеляющий борт. Плита и юбка выдавлены из
 * контуров: у плиты в контуре 111 отверстий, и только выдавливание даёт
 * замкнутую оболочку без булевых операций.
 *
 * Все тела замкнуты по отдельности и пересекаются: низ косы уходит в плиту,
 * корни ветвей — в сердечник. Слайсер объединяет их при печати.
 *
 * Система координат общая для коллекции: Z вверх, низ на z = 0, центр базы в
 * начале координат.
 */

import {
  BufferGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Path,
  Shape,
  Vector2,
} from "three";

import {
  normalizeJewelryStandParams,
  type JewelryStandParams,
} from "@/lib/constructor/params";
import { circlePolygon, type Point2 } from "@/lib/constructor/prism-mesh";

/** Высота плиты базы, мм: держит косу и не заваливает древо вперёд. */
export const JEWELRY_TREE_BASE_HEIGHT_MM = 5;

/** Радиус ствола у основания в долях радиуса базы: 0.115·60 = 6.9 мм (Ø13.8). */
const JEWELRY_TREE_TRUNK_RADIUS_SHARE = 0.115;

/**
 * Смещение оси пряди от оси древа в долях наружного радиуса косы.
 *
 * Четыре пряди стоят через 90°, соседние центры отстоят на d·√2. Касание
 * (r = d/√2) даёт d = R/(1 + 1/√2) = 0.586·R — отсюда и число: пряди не
 * расходятся и не слипаются в гладкий цилиндр.
 */
const JEWELRY_TREE_STRAND_OFFSET_SHARE = 0.586;

/** Радиус пряди в долях наружного радиуса косы: 1 − 0.586, ровно до касания. */
const JEWELRY_TREE_STRAND_RADIUS_SHARE = 0.414;

/** Радиус сердечника в долях наружного радиуса косы: 0.34 закрывает канал. */
const JEWELRY_TREE_CORE_SHARE = 0.34;

/** Сужение косы кверху: 0.25 — на верхушке ствол на четверть тоньше. */
const JEWELRY_TREE_TRUNK_TAPER = 0.25;

/** Доля высоты, с которой пряди начинают сходиться в почку. */
export const JEWELRY_TREE_CROWN_START_SHARE = 0.8;

/** Остаток смещения прядей на верхушке: коса сходится в одно тело. */
const JEWELRY_TREE_CROWN_OFFSET_SHARE = 0.38;

/** Сужение самой пряди к верхушке: 0.12 — коса сходится плотнее. */
const JEWELRY_TREE_STRAND_TIP_TAPER = 0.12;

/** Доля высоты, после которой фаза витка замирает: почка не завивается. */
const JEWELRY_TREE_PHASE_FREEZE_SHARE = 0.88;

/** Максимум производной smoothstep на участке: по нему считается предел витка. */
const JEWELRY_TREE_PHASE_PROFILE_PEAK = 1.5 / JEWELRY_TREE_PHASE_FREEZE_SHARE;

/** Подъём оси пряди, градусы: 48° — три градуса запаса к правилу 45°. */
export const JEWELRY_TREE_STRAND_ELEVATION_DEG = 48;

/** Станций у пряди: 26 колец на 170 мм оставляют хорды по 6.5 мм. */
const JEWELRY_TREE_STRAND_SAMPLES = 26;

/** Число сторон пряди: Ø4.7 при 16 сегментах даёт хорду 0.9 мм. */
const JEWELRY_TREE_STRAND_SIDES = 16;

/** Число сторон сердечника и ветвей: они тоньше, двенадцати хватает. */
const JEWELRY_TREE_BRANCH_SIDES = 12;

/** Насколько коса уходит в плиту, мм: склейка тел без видимого стыка. */
const JEWELRY_TREE_STRAND_EMBED_MM = 2.8;

/** Число прядей в косе: четыре дают «над-под» с любого ракурса. */
const JEWELRY_TREE_STRAND_COUNT = 4;

/** Колец в скруглённой крышке: три дают сферу без плоских граней. */
const JEWELRY_TREE_CAP_STEPS = 3;

/** Подъём верхней ветви, градусы: 60° — 12° запаса под бусину и загиб. */
const JEWELRY_TREE_HOOK_ELEVATION_DEG = 60;

/** Подъём нижнего штыря, градусы: 66° — штырь круче ветви и короче её. */
const JEWELRY_TREE_POST_ELEVATION_DEG = 66;

/** Радиус ветви у ствола, мм: Ø4.4 держит кольцо и браслет. */
export const JEWELRY_TREE_BRANCH_RADIUS_MM = 2.2;

/** Радиус ветви перед бусиной, мм: Ø3.2 — ветвь не хрупче пряди. */
const JEWELRY_TREE_BRANCH_TIP_RADIUS_MM = 1.6;

/** Радиус бусины на конце верхней ветви, мм: Ø5.2 — кольцо не соскальзывает. */
export const JEWELRY_TREE_BRANCH_BUD_RADIUS_MM = 2.6;

/** Длина бусины, мм: рост радиуса на 1 за 7 мм — нависание 8° к оси. */
const JEWELRY_TREE_BRANCH_BUD_MM = 7;

/** Боковой загиб верхней ветви, градусы: больше 40° уже срывает подъём. */
const JEWELRY_TREE_HOOK_CURL_DEG = 40;

/** Доли длины ветви, на которых работает загиб: середина, подальше от бусины. */
const JEWELRY_TREE_HOOK_CURL_FROM_SHARE = 0.3;
const JEWELRY_TREE_HOOK_CURL_TO_SHARE = 0.9;

/** Вынос верхней ветви в долях радиуса базы: 0.42·60 = 25 мм. */
const JEWELRY_TREE_HOOK_REACH_SHARE = 0.42;

/** Длина нижнего штыря в долях высоты древа и её пределы, мм. */
const JEWELRY_TREE_POST_LENGTH_SHARE = 0.15;
const JEWELRY_TREE_POST_MIN_LENGTH_MM = 18;
const JEWELRY_TREE_POST_MAX_LENGTH_MM = 40;

/** Запас под ветви на верхушке, мм: ветвь не выходит выше ползунка высоты. */
const JEWELRY_TREE_HOOK_HEADROOM_MM = 2;

/** Доли высоты, где сидят верхние ветви: под самой почкой. */
const JEWELRY_TREE_HOOK_ROOT_BAND = [0.56, 0.74] as const;

/** Доли высоты, где сидят нижние штыри: середина ствола. */
const JEWELRY_TREE_POST_ROOT_BAND = [0.26, 0.42] as const;

/** Шаг азимута между ветвями в долях оборота: 0.618 — золотое сечение. */
const JEWELRY_TREE_BRANCH_AZIMUTH_STEP = 0.61803;

/** Доли длины верхней ветви, где стоят кольца: сгущение к бусине. */
const JEWELRY_TREE_HOOK_SAMPLES = [
  0, 0.2, 0.38, 0.54, 0.68, 0.8, 0.88, 0.94, 1,
] as const;

/** Доли длины нижнего штыря: пять колец на прямой штырь. */
const JEWELRY_TREE_POST_SAMPLES = [0, 0.3, 0.55, 0.78, 0.92, 1] as const;

/** Число сторон плиты: 60 сегментов на Ø120 дают хорду 6.3 мм. */
const JEWELRY_TREE_BASE_SIDES = 60;

/** Отступ юбки от кромки плиты, мм: плита видна по краю на три миллиметра. */
const JEWELRY_TREE_SKIRT_INSET_MM = 3;

/** Ширина кольца юбки, мм: девять — корни читаются, но не съедают сетку. */
const JEWELRY_TREE_SKIRT_WIDTH_MM = 9;

/** Высота юбки над плитой, мм. */
const JEWELRY_TREE_SKIRT_HEIGHT_MM = 7;

/** Насколько юбка утоплена в плиту, мм: дно скрыто внутри, тел внахлёст. */
const JEWELRY_TREE_SKIRT_EMBED_MM = 1;

/** Скругление кромки юбки, мм: 45°, предел печати без поддержек. */
const JEWELRY_TREE_SKIRT_BEVEL_MM = 1.2;

/** Лепестков у корневого контура и шагов контура на оборот. */
const JEWELRY_TREE_SKIRT_LOBES = 5;
const JEWELRY_TREE_SKIRT_STEPS = 60;

/** Амплитуда лепестков в долях радиуса юбки: контур уходит только внутрь. */
const JEWELRY_TREE_SKIRT_LOBE_SHARE = 0.06;

/** Радиус отверстия под серьгу, мм: крючок Ø0.8 проходит с запасом. */
export const JEWELRY_TREE_HOLE_RADIUS_MM = 0.6;

/** Шаг сетки отверстий, мм: 6 — серьги не задевают друг друга. */
export const JEWELRY_TREE_HOLE_PITCH_MM = 6;

/** Число сторон отверстия: 16 дают погрешность хорды 0.01 мм. */
const JEWELRY_TREE_HOLE_SIDES = 16;

/** Ряды сетки в долях диаметра базы: 0.15…0.30, между стволом и юбкой. */
const JEWELRY_TREE_HOLE_RING_SHARES = [0.15, 0.2, 0.25, 0.3] as const;

/** Минимум отверстий в ряду: у внутреннего кольца иначе их почти нет. */
const JEWELRY_TREE_HOLE_RING_MIN_COUNT = 6;

/** Станций поиска предела витка: деление пополам сходится за 40 шагов. */
const JEWELRY_TREE_TWIST_STEPS = 40;

/** Насколько сердечник короче косы, мм: его торец прячется в почке. */
const JEWELRY_TREE_CORE_TRIM_MM = 1.2;


/** Вектор в миллиметрах. */
type Vec3 = [number, number, number];

/** Точка оси трубы с радиусом, мм. */
export type JewelryTreePoint = {
  readonly xMm: number;
  readonly yMm: number;
  readonly zMm: number;
  readonly radiusMm: number;
};

/** Одна труба древа: прядь, сердечник, верхняя ветвь или нижний штырь. */
export type JewelryTreeTube = {
  readonly id: string;
  readonly kind: "strand" | "core" | "hook" | "post";
  readonly points: readonly JewelryTreePoint[];
};

/** Отверстие сетки: центр в плоскости стола и радиус, мм. */
export type JewelryTreeHole = {
  readonly xMm: number;
  readonly yMm: number;
  readonly radiusMm: number;
};

/**
 * Корневая юбка по кромке плиты.
 *
 * Контур волнистый и уходит только внутрь: деталь не выходит за диаметр базы,
 * а лепестки читаются как корни. Кромка скруглена на `bevelMm` — это ровно 45°,
 * поэтому первый слой печатается без поддержек.
 */
export type JewelryTreeSkirt = {
  readonly outerRadiusMm: number;
  readonly innerRadiusMm: number;
  readonly bottomMm: number;
  readonly topMm: number;
  readonly bevelMm: number;
  readonly lobes: number;
  readonly lobeShare: number;
};

/** План древа: всё, что считается один раз и проверяется тестом. */
export type JewelryTreePlan = {
  readonly baseRadiusMm: number;
  readonly baseHeightMm: number;
  /** Высота, с которой начинается коса: она утоплена в плиту. */
  readonly trunkRootZMm: number;
  readonly trunkRadiusMm: number;
  readonly trunkTipRadiusMm: number;
  readonly trunkSpanMm: number;
  /** Фактическое число витков фазы после выбора предела. */
  readonly twistTurns: number;
  readonly strandOffsetMm: number;
  readonly strandRadiusMm: number;
  readonly coreRadiusMm: number;
  readonly strands: readonly JewelryTreeTube[];
  readonly core: JewelryTreeTube;
  readonly branches: readonly JewelryTreeTube[];
  readonly hookCount: number;
  readonly postCount: number;
  readonly holes: readonly JewelryTreeHole[];
  readonly skirt: JewelryTreeSkirt;
  /** Верхушка косы с учётом скруглённой крышки, мм. */
  readonly crownZMm: number;
  /** Наибольший вынос от оси, мм: ограничивает габарит в плане. */
  readonly reachMm: number;
  /** Самый пологий участок поверхности, градусы: должен быть не ниже 45. */
  readonly flattestSurfaceDeg: number;
  readonly heightMm: number;
};

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
function vectorLength(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

/** Единичный вектор; нулевой остаётся вертикальным, чтобы не делить на ноль. */
function normalizeVector(v: Vec3): Vec3 {
  const size = vectorLength(v);

  return size > 1e-12 ? multiplyVector(v, 1 / size) : [0, 0, 1];
}

/** Векторное произведение. */
function crossVector(a: Vec3, b: Vec3): Vec3 {
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

/** Зажимает число в отрезок. */
function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Градусы в радианы. */
function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * План древа: коса, сердечник, ветви, сетка отверстий и габарит.
 *
 * План считается без three.js: по нему строятся и геометрия, и подписи, и
 * проверки в `scripts/test-jewelry-geometry.ts`.
 */
export function jewelryTreePlan(
  params: Partial<JewelryStandParams> = {},
): JewelryTreePlan {
  const normalized = normalizeJewelryStandParams(params);
  const baseRadiusMm = normalized.treeBaseDiameter / 2;
  const heightMm = normalized.treeHeight;
  const trunkRootZMm =
    JEWELRY_TREE_BASE_HEIGHT_MM - JEWELRY_TREE_STRAND_EMBED_MM;
  const trunkRadiusMm = baseRadiusMm * JEWELRY_TREE_TRUNK_RADIUS_SHARE;

  /** Наружный радиус косы на доле высоты: сужение начинается выше плиты. */
  const outerRadiusAt = (share: number): number =>
    trunkRadiusMm *
    (1 - JEWELRY_TREE_TRUNK_TAPER * smoothstep(0.12, 0.74, share));

  /** Смещение оси пряди от оси древа, мм: к верхушке пряди сходятся. */
  const strandOffsetAt = (share: number): number =>
    outerRadiusAt(share) *
    JEWELRY_TREE_STRAND_OFFSET_SHARE *
    (1 -
      (1 - JEWELRY_TREE_CROWN_OFFSET_SHARE) *
        smoothstep(JEWELRY_TREE_CROWN_START_SHARE, 1, share));

  /** Радиус пряди, мм. */
  const strandRadiusAt = (share: number): number =>
    outerRadiusAt(share) *
    JEWELRY_TREE_STRAND_RADIUS_SHARE *
    (1 - JEWELRY_TREE_STRAND_TIP_TAPER * smoothstep(0.5, 1, share));

  /** Радиус сердечника, мм: он повторяет сужение косы. */
  const coreRadiusAt = (share: number): number =>
    outerRadiusAt(share) * JEWELRY_TREE_CORE_SHARE;

  // Коса занимает всю высоту, кроме скруглённой крышки: её полусфера поднимает
  // верхушку на радиус последнего кольца, и вместе они дают ровно ползунок.
  const crownCapMm = strandRadiusAt(1);
  const trunkSpanMm = Math.max(
    heightMm - trunkRootZMm - crownCapMm,
    heightMm * 0.8,
  );
  const zAt = (share: number): number => trunkRootZMm + share * trunkSpanMm;
  const crownZMm = zAt(1) + crownCapMm;

  const strandShares: number[] = [];

  for (let index = 0; index <= JEWELRY_TREE_STRAND_SAMPLES; index += 1) {
    strandShares.push(index / JEWELRY_TREE_STRAND_SAMPLES);
  }

  /** Фаза витка на доле высоты: у почки она замирает, иначе коса завивается. */
  const strandPhaseAt = (share: number, turns: number): number =>
    Math.PI * 2 * turns * smoothstep(0, JEWELRY_TREE_PHASE_FREEZE_SHARE, share);

  /**
   * Самый пологий участок оси пряди при данном числе витков, градусы.
   *
   * Считается по хордам тех же станций, по которым строятся кольца: слайсер
   * видит именно хорды, а не гладкую кривую.
   */
  const strandElevationDeg = (turns: number): number => {
    let worst = 180;
    let previous: Vec3 | null = null;

    for (const share of strandShares) {
      const offset = strandOffsetAt(share);
      const phase = strandPhaseAt(share, turns);
      const point: Vec3 = [
        offset * Math.cos(phase),
        offset * Math.sin(phase),
        zAt(share),
      ];

      if (previous) {
        const run = Math.hypot(point[0] - previous[0], point[1] - previous[1]);
        const rise = point[2] - previous[2];

        worst = Math.min(worst, (Math.atan2(rise, run) * 180) / Math.PI);
      }

      previous = point;
    }

    return worst;
  };

  // Верхняя граница поиска: витки, при которых даже максимум производной фазы и
  // максимальное смещение пряди дают уклон круче предела. За ней решение лежит
  // заведомо, поэтому деление пополам всегда находит край.
  const twistCeiling =
    (trunkSpanMm * Math.tan(degreesToRadians(JEWELRY_TREE_STRAND_ELEVATION_DEG))) /
    (Math.PI * 2 * JEWELRY_TREE_PHASE_PROFILE_PEAK * Math.max(strandOffsetAt(0), 1e-6));
  let twistTurns = 0;

  if (normalized.treeTwist > 0) {
    let low = 0;
    let high = Math.max(twistCeiling * 2, 0.05);

    for (let step = 0; step < JEWELRY_TREE_TWIST_STEPS; step += 1) {
      const middle = (low + high) / 2;

      if (strandElevationDeg(middle) >= JEWELRY_TREE_STRAND_ELEVATION_DEG) {
        low = middle;
      } else {
        high = middle;
      }
    }

    twistTurns = low * normalized.treeTwist;
  }

  const strands: JewelryTreeTube[] = [];

  for (let index = 0; index < JEWELRY_TREE_STRAND_COUNT; index += 1) {
    const baseAngle = (Math.PI * 2 * index) / JEWELRY_TREE_STRAND_COUNT;

    strands.push({
      id: `strand-${index + 1}`,
      kind: "strand",
      points: strandShares.map((share) => {
        const offset = strandOffsetAt(share);
        const angle = baseAngle + strandPhaseAt(share, twistTurns);

        return {
          xMm: offset * Math.cos(angle),
          yMm: offset * Math.sin(angle),
          zMm: zAt(share),
          radiusMm: strandRadiusAt(share),
        };
      }),
    });
  }

  // Сердечник закрывает канал между прядями и заканчивается внутри почки: его
  // скруглённый торец прячется под крышками прядей.
  const core: JewelryTreeTube = {
    id: "core",
    kind: "core",
    points: [0, 0.3, 0.6, 0.85, 1].map((share) => ({
      xMm: 0,
      yMm: 0,
      zMm: trunkRootZMm + share * (trunkSpanMm - JEWELRY_TREE_CORE_TRIM_MM),
      radiusMm: coreRadiusAt(share),
    })),
  };

  const branchCount = normalized.treeBranchCount;
  const hookCount = Math.ceil(branchCount / 2);
  const postCount = branchCount - hookCount;
  const hookElevationRad = degreesToRadians(JEWELRY_TREE_HOOK_ELEVATION_DEG);
  const postElevationRad = degreesToRadians(JEWELRY_TREE_POST_ELEVATION_DEG);
  const curlRad = degreesToRadians(JEWELRY_TREE_HOOK_CURL_DEG);
  const hookReachMm = baseRadiusMm * JEWELRY_TREE_HOOK_REACH_SHARE;
  const postLengthMm = clampNumber(
    heightMm * JEWELRY_TREE_POST_LENGTH_SHARE,
    JEWELRY_TREE_POST_MIN_LENGTH_MM,
    JEWELRY_TREE_POST_MAX_LENGTH_MM,
  );

  /** Доля высоты для ветви своего яруса: ярус растянут по своей полосе. */
  const laneShare = (
    lane: number,
    count: number,
    band: readonly [number, number],
  ): number =>
    count > 1
      ? band[0] + ((band[1] - band[0]) * lane) / (count - 1)
      : (band[0] + band[1]) / 2;

  const branches: JewelryTreeTube[] = [];

  for (let index = 0; index < branchCount; index += 1) {
    const isHook = index % 2 === 0;
    const lane = Math.floor(index / 2);
    const share = laneShare(
      lane,
      isHook ? hookCount : postCount,
      isHook ? JEWELRY_TREE_HOOK_ROOT_BAND : JEWELRY_TREE_POST_ROOT_BAND,
    );
    // Азимут берётся по золотому сечению: соседние ветви расходятся не меньше
    // чем на треть оборота, и кольца на них не цепляют друг друга.
    const azimuthRad =
      Math.PI * 2 * ((index * JEWELRY_TREE_BRANCH_AZIMUTH_STEP) % 1);
    const rootZMm = zAt(share);

    if (isHook) {
      // Ветвь не выходит выше ползунка: под верхушкой косы остаётся запас, и
      // скруглённая бусина на конце ветви тоже не пробивает потолок габарита.
      const headroomMm = Math.max(
        crownZMm -
          rootZMm -
          JEWELRY_TREE_HOOK_HEADROOM_MM -
          JEWELRY_TREE_BRANCH_BUD_RADIUS_MM,
        6,
      );
      const riseMm = Math.min(
        hookReachMm * Math.tan(hookElevationRad),
        headroomMm,
      );
      const lengthMm = riseMm / Math.sin(hookElevationRad);
      const budLengthMm = Math.min(
        JEWELRY_TREE_BRANCH_BUD_MM,
        lengthMm * 0.3,
      );
      const budStartMm = lengthMm - budLengthMm;

      // Радиус вдоль ветви: конус до бусины плюс smoothstep-утолщение на конце.
      // Скорость утолщения ограничена, поэтому бусина не даёт нависания круче
      // 8° к оси — с подъёмом 60° до правила 45° остаётся запас.
      const radiusAt = (travelledMm: number): number => {
        const taper =
          JEWELRY_TREE_BRANCH_RADIUS_MM +
          (JEWELRY_TREE_BRANCH_TIP_RADIUS_MM -
            JEWELRY_TREE_BRANCH_RADIUS_MM) *
            Math.min(1, travelledMm / Math.max(budStartMm, 1e-6));
        const bud = smoothstep(budStartMm, lengthMm, travelledMm);

        return (
          taper +
          (JEWELRY_TREE_BRANCH_BUD_RADIUS_MM -
            JEWELRY_TREE_BRANCH_TIP_RADIUS_MM) *
            bud
        );
      };

      branches.push({
        id: `hook-${lane + 1}`,
        kind: "hook",
        points: JEWELRY_TREE_HOOK_SAMPLES.map((sample) => {
          const travelledMm = lengthMm * sample;
          const horizontalMm = travelledMm * Math.cos(hookElevationRad);
          // Загиб идёт по азимуту, а не вниз: подъём остаётся прежним.
          const angle =
            azimuthRad +
            curlRad *
              smoothstep(
                JEWELRY_TREE_HOOK_CURL_FROM_SHARE,
                JEWELRY_TREE_HOOK_CURL_TO_SHARE,
                sample,
              );

          return {
            xMm: horizontalMm * Math.cos(angle),
            yMm: horizontalMm * Math.sin(angle),
            zMm: rootZMm + travelledMm * Math.sin(hookElevationRad),
            radiusMm: radiusAt(travelledMm),
          };
        }),
      });

      continue;
    }

    branches.push({
      id: `post-${lane + 1}`,
      kind: "post",
      points: JEWELRY_TREE_POST_SAMPLES.map((sample) => {
        const travelledMm = postLengthMm * sample;
        const horizontalMm = travelledMm * Math.cos(postElevationRad);

        return {
          xMm: horizontalMm * Math.cos(azimuthRad),
          yMm: horizontalMm * Math.sin(azimuthRad),
          zMm: rootZMm + travelledMm * Math.sin(postElevationRad),
          radiusMm:
            JEWELRY_TREE_BRANCH_RADIUS_MM +
            (JEWELRY_TREE_BRANCH_TIP_RADIUS_MM -
              JEWELRY_TREE_BRANCH_RADIUS_MM) *
              sample,
        };
      }),
    });
  }

  // Самая пологая точка поверхности: у трубы с осью под α низ наклонён на α, а
  // рост радиуса «съедает» подъём на atan(Δr/L). Именно это число проверяет
  // тест, а не наклон оси.
  let flattestSurfaceDeg = 180;

  for (const tube of [core, ...strands, ...branches]) {
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
  }

  const holes: JewelryTreeHole[] = [];

  JEWELRY_TREE_HOLE_RING_SHARES.forEach((ringShare, ringIndex) => {
    const ringRadiusMm = normalized.treeBaseDiameter * ringShare;
    const count = Math.max(
      JEWELRY_TREE_HOLE_RING_MIN_COUNT,
      Math.round((Math.PI * 2 * ringRadiusMm) / JEWELRY_TREE_HOLE_PITCH_MM),
    );
    // Ряды сдвинуты на полшага: отверстия соседних колец стоят в шахматном
    // порядке, и серьги висят ровнее.
    const phase = (ringIndex % 2) * (Math.PI / count);

    for (let index = 0; index < count; index += 1) {
      const angle = phase + (Math.PI * 2 * index) / count;

      holes.push({
        xMm: ringRadiusMm * Math.cos(angle),
        yMm: ringRadiusMm * Math.sin(angle),
        radiusMm: JEWELRY_TREE_HOLE_RADIUS_MM,
      });
    }
  });

  const skirtOuterRadiusMm = baseRadiusMm - JEWELRY_TREE_SKIRT_INSET_MM;
  const skirt: JewelryTreeSkirt = {
    outerRadiusMm: skirtOuterRadiusMm,
    innerRadiusMm: skirtOuterRadiusMm - JEWELRY_TREE_SKIRT_WIDTH_MM,
    bottomMm: JEWELRY_TREE_BASE_HEIGHT_MM - JEWELRY_TREE_SKIRT_EMBED_MM,
    topMm: JEWELRY_TREE_BASE_HEIGHT_MM + JEWELRY_TREE_SKIRT_HEIGHT_MM,
    bevelMm: JEWELRY_TREE_SKIRT_BEVEL_MM,
    lobes: JEWELRY_TREE_SKIRT_LOBES,
    lobeShare: JEWELRY_TREE_SKIRT_LOBE_SHARE,
  };

  let reachMm = Math.max(baseRadiusMm, skirt.outerRadiusMm);
  let topMm = crownZMm;

  for (const tube of [core, ...strands, ...branches]) {
    const points = tube.points;
    const last = points[points.length - 1];

    // Скруглённая крышка — полусфера радиусом с конец трубы: её верхняя точка
    // лежит не выше центра плюс радиус, даже если ось наклонена. Так габарит
    // остаётся верхней оценкой, а не приближением по вертикальной проекции оси.
    reachMm = Math.max(
      reachMm,
      Math.hypot(last.xMm, last.yMm) + last.radiusMm,
    );
    topMm = Math.max(topMm, last.zMm + last.radiusMm);
  }

  return {
    baseRadiusMm,
    baseHeightMm: JEWELRY_TREE_BASE_HEIGHT_MM,
    trunkRootZMm,
    trunkRadiusMm,
    trunkTipRadiusMm: outerRadiusAt(1),
    trunkSpanMm,
    twistTurns,
    strandOffsetMm: strandOffsetAt(0),
    strandRadiusMm: strandRadiusAt(0),
    coreRadiusMm: coreRadiusAt(0),
    strands,
    core,
    branches,
    hookCount,
    postCount,
    holes,
    skirt,
    crownZMm,
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

    tangents.push(normalizeVector(addVector(normalizeVector(backward), normalizeVector(forward))));
  }

  return tangents;
}

/** Веер треугольников: `upward` — нормаль вдоль оси, иначе против неё. */
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
 * оси, а значит нет и нависания круче 45° — верхушки прядей и бусины ветвей
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
 * Низ закрыт веером против оси: он всегда утоплен в соседнее тело (в плиту у
 * прядей и ветвей, в сердечник у ветвей), поэтому наружу не смотрит.
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

/** Контур для выдавливания: многоугольник по точкам кольца. */
function polygonShape(points: readonly Point2[]): Shape {
  const shape = new Shape();

  shape.setFromPoints(points.map(([x, y]) => new Vector2(x, y)));

  return shape;
}

/**
 * Выдавливание контура по Z с фаской.
 *
 * Своя сетка тут не годится: у плиты в контуре 111 отверстий, и только
 * `ExtrudeGeometry` собирает такую оболочку без булевых операций. Фаска ровно
 * 45°, поэтому первый слой печатается без поддержек. Треугольники переносятся в
 * общий массив, геометрия three.js сразу освобождается.
 */
function addExtrudedShape(
  positions: number[],
  shape: Shape,
  heightMm: number,
  bottomMm: number,
  bevelMm: number,
): void {
  const bevel = Math.max(bevelMm, 0);
  const depthMm = Math.max(heightMm - bevel * 2, 0.01);
  const geometry = new ExtrudeGeometry(shape, {
    depth: depthMm,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: 0,
    bevelSegments: bevel > 0 ? 2 : 0,
    curveSegments: 1,
    steps: 1,
  });
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  const attribute = flat.getAttribute("position");
  // Выдавливание идёт от нуля, а фаска добавляет по миллиметру с каждой стороны:
  // сдвиг ставит низ детали на bottomMm, а верх — на bottomMm + heightMm.
  const z0 = bottomMm + bevel;

  for (let index = 0; index < attribute.count; index += 1) {
    positions.push(
      attribute.getX(index),
      attribute.getY(index),
      attribute.getZ(index) + z0,
    );
  }

  if (flat !== geometry) {
    flat.dispose();
  }

  geometry.dispose();
}

/**
 * Плита базы с сеткой сквозных отверстий.
 *
 * Отверстия вырезаны в контуре, а не просверлены булевой операцией: стенки
 * получаются вертикальными, мостов нет, оболочка замкнута. Отверстия обходятся
 * по часовой стрелке — иначе стенка смотрит наружу и объём не сходится.
 */
function addBasePlate(positions: number[], plan: JewelryTreePlan): void {
  const shape = polygonShape(circlePolygon(plan.baseRadiusMm, JEWELRY_TREE_BASE_SIDES));

  for (const hole of plan.holes) {
    const contour = circlePolygon(hole.radiusMm, JEWELRY_TREE_HOLE_SIDES)
      .reverse()
      .map(([x, y]): Point2 => [x + hole.xMm, y + hole.yMm]);
    const path = new Path();

    path.setFromPoints(contour.map(([x, y]) => new Vector2(x, y)));
    shape.holes.push(path);
  }

  addExtrudedShape(positions, shape, plan.baseHeightMm, 0, 0);
}

/**
 * Корневая юбка: кольцо с волнистым контуром по кромке плиты.
 *
 * Контур уходит только внутрь, поэтому деталь не выходит за диаметр базы, а
 * лепестки читаются как корни. Внутренний контур повторяет тот же сдвиг, так что
 * ширина кольца по всей окружности одинаковая.
 */
function addSkirt(positions: number[], plan: JewelryTreePlan): void {
  const skirt = plan.skirt;
  const lobeDepthMm = skirt.outerRadiusMm * skirt.lobeShare;

  /** Сдвиг контура внутрь: пять лепестков, на гребне сдвиг нулевой. */
  const lobeShiftMm = (angle: number): number =>
    -lobeDepthMm * (0.5 + 0.5 * Math.cos(skirt.lobes * angle));

  const ringPolygon = (radiusMm: number, clockwise: boolean): Point2[] => {
    const points: Point2[] = [];

    for (let step = 0; step < JEWELRY_TREE_SKIRT_STEPS; step += 1) {
      const angle = (Math.PI * 2 * step) / JEWELRY_TREE_SKIRT_STEPS;
      const radius = radiusMm + lobeShiftMm(angle);

      points.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
    }

    return clockwise ? points.reverse() : points;
  };

  const shape = polygonShape(ringPolygon(skirt.outerRadiusMm, false));
  const inner = new Path();

  inner.setFromPoints(
    ringPolygon(skirt.innerRadiusMm, true).map(([x, y]) => new Vector2(x, y)),
  );
  shape.holes.push(inner);

  addExtrudedShape(
    positions,
    shape,
    skirt.topMm - skirt.bottomMm,
    skirt.bottomMm,
    skirt.bevelMm,
  );
}

/**
 * Геометрия древа «Плетёное древо» для набора параметров.
 *
 * Деталь построена Z-вверх, центр базы в начале координат, низ на z = 0. Все тела
 * замкнуты по отдельности и пересекаются — слайсер объединит их при печати.
 */
export function createJewelryTreeGeometry(
  params: Partial<JewelryStandParams> = {},
): BufferGeometry {
  const plan = jewelryTreePlan(params);
  const positions: number[] = [];

  addBasePlate(positions, plan);
  addSkirt(positions, plan);

  // Сердечник идёт первым: он самый толстый и закрывает канал между прядями.
  addTube(positions, plan.core.points, JEWELRY_TREE_BRANCH_SIDES);

  for (const strand of plan.strands) {
    addTube(positions, strand.points, JEWELRY_TREE_STRAND_SIDES);
  }

  for (const branch of plan.branches) {
    addTube(positions, branch.points, JEWELRY_TREE_BRANCH_SIDES);
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}
