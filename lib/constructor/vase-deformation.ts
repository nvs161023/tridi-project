import {
  CONSTRUCTOR_LIMITS,
  DEFAULT_VASE_PARAMS,
  type VaseParams,
} from "@/lib/constructor/params";
import { organicOffset } from "@/lib/constructor/vase-seed";

/**
 * Закрутка, каннелюры, органика и наклон: деформации стенки, которые не меняют
 * ни силуэт, ни толщину.
 *
 * Профиль задаёт радиус по высоте R(v), сечение — множитель по углу f(u), а
 * этот модуль добавляет третью координату: сдвиг фазы по углу, который растёт с
 * высотой (закрутка), глубину жёлобов в миллиметрах (каннелюры), смещение по
 * сиду (органика) и перекос всей модели (наклон). Модуль чистый (без three.js),
 * как `vase-section.ts`, `vase-seed.ts` и `pattern-waves.ts`, поэтому формулы
 * проверяются отдельно от сборки сетки.
 *
 * Ключевое решение: закрутка, жёлоба и органика меняют только радиус вершины, а
 * её угловое положение остаётся прежним. Спираль получается потому, что фаза
 * угла растёт с высотой, а не потому, что вершины поворачиваются вокруг оси.
 * Так шов окружности сходится при любом угле закрутки: обе копии шва лежат на
 * одном угле, и сварка по координатам их склеивает. Поворот самих вершин
 * потребовал бы кратности `360 / ribCount` — иначе половинки шва разъехались бы
 * и в сетке появились открытые рёбра.
 *
 * Наклон — единственная деформация, которая меняет не радиус, а координату:
 * это сдвиг по X, пропорциональный высоте. Дно остаётся на столе, объём
 * сохраняется (определитель преобразования равен единице), а толщина стенки в
 * каждом горизонтальном сечении остаётся заданной: сдвиг одинаков для внешней и
 * внутренней точки одной высоты. Габарит по X при этом растёт — на наклонённую
 * вазу нужен стол шире.
 */

/**
 * Насколько плоско дно жёлоба.
 *
 * Глубина жёлоба считается как `(1 − wave)^p`, где `wave` — косинус от 0 до 1.
 * При `p = 1` профиль — чистый синус: мягкие волны. При `p = 3` срез
 * концентрируется у дна, гребни становятся широкими и почти плоскими, и
 * жёлоб читается как каннелюра — канавка с плоскими полями между ними.
 */
export const VASE_FLUTE_FLATNESS = 3;

/**
 * Доля толщины стенки, которую может занять глубина жёлоба.
 *
 * Стенка всюду сохраняет толщину (обе поверхности смещаются одинаково), но
 * глубокая канавка на тонкой стенке выворачивает внутреннюю поверхность
 * наизнанку: на гребне и на дне жёлоба нормаль к поверхности разворачивается, и
 * радиус кривизны становится меньше половины толщины стенки — треугольники
 * начинают пересекаться. 60% стенки оставляют запас на кривизну.
 */
export const MAX_FLUTE_WALL_SHARE = 0.6;

/** Доля самого узкого радиуса, которую может занять глубина жёлоба. */
export const MAX_FLUTE_RADIUS_SHARE = 0.45;

/**
 * Предел смещения «органикой» в миллиметрах.
 *
 * Органика — это складки мятой глины, а не рельеф: 4 мм на вазе высотой 140 мм
 * читаются как ручная лепка, а больше — как брак печати. Абсолютный предел
 * нужен потому, что доля радиуса на большой вазе дала бы слишком глубокие
 * волны: при диаметре 200 мм это уже 12 мм.
 */
export const MAX_ORGANIC_MM = 4;

/**
 * Доля самого узкого радиуса, которую может занять органика.
 *
 * То же ограничение, что у узора: если сместить стенку внутрь сильнее радиуса,
 * кольцо вывернется через ось. Сумма узора, каннелюр и органики на каждой
 * высоте тоже укладывается в эту долю (`vase-geometry.ts` передаёт остаток
 * бюджета в амплитуду органики).
 */
export const MAX_ORGANIC_RADIUS_SHARE = 0.13;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Закрутка в радианах.
 *
 * Параметр приходит из состояния конструктора и из тела запроса, поэтому здесь
 * отсекается мусор: не число и выход за границы. Верхняя граница — два полных
 * оборота: на вазе высотой 140 мм это уже сильно закрученный рельеф, а больше
 * слайсеру всё равно не прочитать.
 */
export function resolveTwistRad(twistDeg?: number): number {
  const limit = CONSTRUCTOR_LIMITS.twistDeg;
  const value = Number.isFinite(twistDeg)
    ? (twistDeg as number)
    : limit.defaultValue;

  return (clamp(value, limit.min, limit.max) * Math.PI) / 180;
}

/** Число жёлобов: 0 — ровная стенка, 1–24 — столько каннелюр по кругу. */
export function resolveFluteCount(flutes?: number): number {
  const limit = CONSTRUCTOR_LIMITS.flutes;
  const value = Number.isFinite(flutes)
    ? Math.round(flutes as number)
    : limit.defaultValue;

  return Math.round(clamp(value, limit.min, limit.max));
}

/** Глубина жёлоба в миллиметрах: без учёта ограничений по стенке и радиусу. */
export function resolveFluteDepthMm(depthMm?: number): number {
  const limit = CONSTRUCTOR_LIMITS.fluteDepthMm;
  const value = Number.isFinite(depthMm)
    ? (depthMm as number)
    : limit.defaultValue;

  return clamp(value, limit.min, limit.max);
}

/**
 * Предел глубины жёлоба для конкретной вазы, мм.
 *
 * Два независимых ограничения. По стенке — чтобы кривизна дна жёлоба не
 * превысила половину толщины (см. `MAX_FLUTE_WALL_SHARE`). По радиусу — чтобы
 * канавка не дошла до оси: самый узкий радиус на вазе может быть 3 мм, и
 * четырёхмиллиметровый жёлоб вывернул бы кольцо наизнанку.
 */
export function fluteDepthLimitMm(wallMm: number, minRadiusMm: number): number {
  const byWall = Math.max(wallMm, 0) * MAX_FLUTE_WALL_SHARE;
  const byRadius = Math.max(minRadiusMm, 0) * MAX_FLUTE_RADIUS_SHARE;

  return Math.max(0, Math.min(byWall, byRadius));
}

/**
 * Органика: 0 — гладкая стенка, 1 — складки полной глубины.
 *
 * Параметр приходит из слайдера и из тела запроса, поэтому не число и выход за
 * границы превращаются в допустимое значение. Дробное значение сохраняется:
 * амплитуда меняется плавно, и шаг слайдера 0.05 не повод округлять формулу.
 */
export function resolveOrganic(organic?: number): number {
  const limit = CONSTRUCTOR_LIMITS.organic;
  const value = Number.isFinite(organic)
    ? (organic as number)
    : limit.defaultValue;

  return clamp(value, limit.min, limit.max);
}

/**
 * Наклон модели в радианах.
 *
 * Параметр — угол от вертикали в градусах: 0 — ровная ваза, 30 — заметно
 * наклонённая. Знак задаёт сторону: при положительном угле верх уходит в +X.
 */
export function resolveLeanRad(leanDeg?: number): number {
  const limit = CONSTRUCTOR_LIMITS.leanDeg;
  const value = Number.isFinite(leanDeg)
    ? (leanDeg as number)
    : limit.defaultValue;

  return (clamp(value, limit.min, limit.max) * Math.PI) / 180;
}

/** Сид шума: целое из диапазона слайдера, иначе значение по умолчанию. */
export function resolveVaseSeed(seed?: number): number {
  const limit = CONSTRUCTOR_LIMITS.vaseSeed;
  const value = Number.isFinite(seed)
    ? Math.round(seed as number)
    : limit.defaultValue;

  return Math.round(clamp(value, limit.min, limit.max));
}

/**
 * Предел амплитуды органики для конкретной вазы, мм.
 *
 * Два ограничения: доля самого узкого радиуса (чтобы кольцо не вывернулось
 * через ось) и абсолютный предел в миллиметрах (чтобы на большой вазе складки
 * не превратились в волны по 12 мм). Остаток бюджета смещения передаёт
 * геометрия: если узор и каннелюры уже заняли свою долю радиуса, органика
 * получает меньше.
 */
export function organicLimitMm(minRadiusMm: number): number {
  const byRadius = Math.max(minRadiusMm, 0) * MAX_ORGANIC_RADIUS_SHARE;

  return Math.max(0, Math.min(byRadius, MAX_ORGANIC_MM));
}

/**
 * Деформации стенки: закрутка, каннелюры, органика и наклон.
 *
 * `phaseAt` принимает долю высоты (0 у дна, 1 у кромки): закрутка измеряется от
 * дна, поэтому первый слой остаётся полным кругом, а кромка поворачивается на
 * заданный угол. `fluteNotchAt` принимает угол вершины в её собственной системе
 * координат и возвращает глубину в долях от полной: 0 на гребне, 1 на дне
 * жёлоба. Закрутка к нему не относится — кольцо поворачивается уже после того,
 * как радиусы посчитаны. `organicAt` считает смещение по сиду в миллиметрах, а
 * `leanShiftAt` — сдвиг по X от наклона: он не радиус, а координата.
 */
export type VaseDeformation = {
  /** Полный поворот фазы по высоте, рад; 0 — без закрутки. */
  twistRad: number;
  /** Число жёлобов; 0 — ровная стенка. */
  fluteCount: number;
  /** Запрошенная глубина жёлоба, мм — до ограничения по стенке и радиусу. */
  fluteDepthMm: number;
  /** Органика: 0 — гладкая стенка, 1 — полная амплитуда. */
  organic: number;
  /** Наклон от вертикали, рад; 0 — ровная ваза. */
  leanRad: number;
  /** Сид шума: от него зависит только рисунок складок. */
  seed: number;
  /** Сдвиг фазы на доле высоты. */
  phaseAt: (heightShare: number) => number;
  /** Глубина жёлоба в долях от полной: 0 на гребне, 1 на дне. */
  fluteNotchAt: (angle: number) => number;
  /** Предел органики для самого узкого радиуса, мм; 0 при `organic = 0`. */
  organicAmplitudeMm: (minRadiusMm: number) => number;
  /** Смещение органики, мм: 0 при нулевой амплитуде. */
  organicAt: (
    angle: number,
    heightShare: number,
    amplitudeMm: number,
  ) => number;
  /** Сдвиг по X от наклона, мм: 0 у дна, полный у кромки. */
  leanShiftAt: (heightMm: number, bottomMm: number) => number;
};

/** Деформации по параметрам вазы: нули дают ровную стенку без закрутки. */
export function createVaseDeformation(
  params: Partial<
    Pick<
      VaseParams,
      "twistDeg" | "flutes" | "fluteDepthMm" | "organic" | "leanDeg" | "vaseSeed"
    >
  > = {},
): VaseDeformation {
  const twistRad = resolveTwistRad(
    params.twistDeg ?? DEFAULT_VASE_PARAMS.twistDeg,
  );
  const fluteCount = resolveFluteCount(
    params.flutes ?? DEFAULT_VASE_PARAMS.flutes,
  );
  const fluteDepthMm = resolveFluteDepthMm(
    params.fluteDepthMm ?? DEFAULT_VASE_PARAMS.fluteDepthMm,
  );
  const organic = resolveOrganic(params.organic ?? DEFAULT_VASE_PARAMS.organic);
  const leanRad = resolveLeanRad(params.leanDeg ?? DEFAULT_VASE_PARAMS.leanDeg);
  const seed = resolveVaseSeed(params.vaseSeed ?? DEFAULT_VASE_PARAMS.vaseSeed);
  const leanSlope = Math.tan(leanRad);

  return {
    twistRad,
    fluteCount,
    fluteDepthMm,
    organic,
    leanRad,
    seed,
    phaseAt: (heightShare) => twistRad * clamp(heightShare, 0, 1),
    fluteNotchAt: (angle) => {
      if (fluteCount <= 0) {
        return 0;
      }

      const wave = 0.5 * (1 + Math.cos(fluteCount * angle));

      return Math.pow(1 - wave, VASE_FLUTE_FLATNESS);
    },
    organicAmplitudeMm: (minRadiusMm) =>
      organic > 0 ? organicLimitMm(minRadiusMm) * organic : 0,
    organicAt: (angle, heightShare, amplitudeMm) =>
      organic > 0
        ? organicOffset(angle, clamp(heightShare, 0, 1), seed, amplitudeMm)
        : 0,
    leanShiftAt: (heightMm, bottomMm) =>
      leanSlope === 0 ? 0 : leanSlope * (heightMm - bottomMm),
  };
}
