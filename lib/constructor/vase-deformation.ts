import {
  CONSTRUCTOR_LIMITS,
  DEFAULT_VASE_PARAMS,
  type VaseParams,
} from "@/lib/constructor/params";

/**
 * Закрутка и каннелюры: деформации стенки, которые не меняют ни силуэт, ни
 * толщину.
 *
 * Профиль задаёт радиус по высоте R(v), сечение — множитель по углу f(u), а
 * этот модуль добавляет третью координату: сдвиг фазы по углу, который растёт с
 * высотой (закрутка), и глубину жёлобов в миллиметрах (каннелюры). Модуль
 * чистый (без three.js), как `vase-section.ts` и `pattern-waves.ts`, поэтому
 * формулы проверяются отдельно от сборки сетки.
 *
 * Ключевое решение: и закрутка, и жёлоба меняют только радиус вершины, а её
 * угловое положение остаётся прежним. Спираль получается потому, что фаза
 * угла растёт с высотой, а не потому, что вершины поворачиваются вокруг оси.
 * Так шов окружности сходится при любом угле закрутки: обе копии шва лежат на
 * одном угле, и сварка по координатам их склеивает. Поворот самих вершин
 * потребовал бы кратности `360 / ribCount` — иначе половинки шва разъехались бы
 * и в сетке появились открытые рёбра.
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
 * Деформация стенки: насколько повернуть кольцо по высоте и как глубоко
 * прорезать жёлоб.
 *
 * `phaseAt` принимает долю высоты (0 у дна, 1 у кромки): закрутка измеряется от
 * дна, поэтому первый слой остаётся полным кругом, а кромка поворачивается на
 * заданный угол. `fluteNotchAt` принимает угол вершины в её собственной системе
 * координат и возвращает глубину в долях от полной: 0 на гребне, 1 на дне
 * жёлоба. Закрутка к нему не относится — кольцо поворачивается уже после того,
 * как радиусы посчитаны.
 */
export type VaseDeformation = {
  /** Полный поворот фазы по высоте, рад; 0 — без закрутки. */
  twistRad: number;
  /** Число жёлобов; 0 — ровная стенка. */
  fluteCount: number;
  /** Запрошенная глубина жёлоба, мм — до ограничения по стенке и радиусу. */
  fluteDepthMm: number;
  /** Сдвиг фазы на доле высоты. */
  phaseAt: (heightShare: number) => number;
  /** Глубина жёлоба в долях от полной: 0 на гребне, 1 на дне. */
  fluteNotchAt: (angle: number) => number;
};

/** Деформации по параметрам вазы: нули дают ровную стенку без закрутки. */
export function createVaseDeformation(
  params: Partial<
    Pick<VaseParams, "twistDeg" | "flutes" | "fluteDepthMm">
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

  return {
    twistRad,
    fluteCount,
    fluteDepthMm,
    phaseAt: (heightShare) => twistRad * clamp(heightShare, 0, 1),
    fluteNotchAt: (angle) => {
      if (fluteCount <= 0) {
        return 0;
      }

      const wave = 0.5 * (1 + Math.cos(fluteCount * angle));

      return Math.pow(1 - wave, VASE_FLUTE_FLATNESS);
    },
  };
}
