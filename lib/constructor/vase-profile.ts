import { SplineCurve, Vector2 } from "three";

import type { VaseParams, VaseShape } from "@/lib/constructor/params";

/**
 * Осевое сечение вазы в плоскости (радиус, высота).
 *
 * Контур начинается на оси внизу, идёт по внешней стенке вверх, через кромку
 * переходит на внутреннюю стенку, спускается к дну полости и возвращается на
 * ось. Порядок обхода выбран так, чтобы LatheGeometry построила наружные
 * нормали снаружи, а внутренние — со стороны полости.
 *
 * Все размеры в миллиметрах: STL не хранит единицы, и слайсеры читают
 * координаты как мм.
 */

/** Сколько точек снимаем со сплайна внешнего силуэта. */
const OUTER_SEGMENTS = 64;

/** Минимальный внешний радиус: горловина не должна схлопнуться в точку. */
const MIN_OUTER_RADIUS_MM = 0.8;

/** Минимальный радиус полости. */
const MIN_INNER_RADIUS_MM = 0.4;

/**
 * Стенка не может занимать больше 45% самого узкого внешнего радиуса.
 * Иначе внутренний радиус станет меньше нуля и поверхность вывернется.
 */
const MAX_WALL_SHARE = 0.45;

/** Минимальная толщина дна: более тонкое дно ломается при снятии со стола. */
const MIN_FLOOR_MM = 1.2;

/** Допуск, ниже которого соседние точки профиля считаем совпавшими. */
const PROFILE_EPSILON = 1e-4;

/** Параметры, из которых строится осевое сечение: узор на профиль не влияет. */
export type VaseProfileParams = Pick<
  VaseParams,
  "height" | "diameter" | "wall" | "shape"
>;

/** Точка пресета: доля высоты и доля максимального радиуса. */
type PresetPoint = readonly [heightShare: number, radiusShare: number];

/**
 * Силуэты пресетов. Радиус задан долей от diameter / 2, высота — долей от
 * height, поэтому один пресет работает при любых размерах.
 *
 * classic — широкая нижняя часть, плавное сужение и небольшой раструб кромки;
 * cone — почти прямой конус с широким основанием; cylinder — вертикальные
 * стенки; hourglass — широкая верхняя и нижняя часть с узкой талией;
 * teardrop — массивное основание и плавно закруглённая верхняя часть;
 * double_bulb — две выпуклости, разделённые мягкой талией; square и octagon —
 * силуэты под многоугольное сечение: пологие стенки, чтобы грани читались по
 * всей высоте, а не только у дна.
 */
const SHAPE_PRESETS: Record<VaseShape, readonly PresetPoint[]> = {
  classic: [
    [0, 0.55],
    [0.07, 0.72],
    [0.2, 0.9],
    [0.34, 1],
    [0.5, 0.96],
    [0.66, 0.84],
    [0.8, 0.64],
    [0.92, 0.5],
    [1, 0.57],
  ],
  cone: [
    [0, 1],
    [0.18, 0.9],
    [0.4, 0.75],
    [0.62, 0.6],
    [0.82, 0.47],
    [1, 0.38],
  ],
  cylinder: [
    [0, 1],
    [0.35, 1],
    [0.7, 1],
    [1, 1],
  ],
  hourglass: [
    [0, 0.68],
    [0.08, 0.86],
    [0.2, 0.98],
    [0.3, 0.94],
    [0.4, 0.68],
    [0.5, 0.42],
    [0.6, 0.68],
    [0.7, 0.94],
    [0.8, 0.99],
    [0.9, 0.92],
    [1, 0.82],
  ],
  teardrop: [
    [0, 0.58],
    [0.08, 0.82],
    [0.18, 0.96],
    [0.3, 1],
    [0.44, 0.92],
    [0.58, 0.78],
    [0.7, 0.62],
    [0.8, 0.46],
    [0.9, 0.34],
    [1, 0.3],
  ],
  double_bulb: [
    [0, 0.58],
    [0.07, 0.78],
    [0.17, 0.94],
    [0.27, 1],
    [0.37, 0.92],
    [0.46, 0.68],
    [0.52, 0.62],
    [0.6, 0.78],
    [0.7, 0.96],
    [0.8, 1],
    [0.88, 0.92],
    [0.95, 0.72],
    [1, 0.58],
  ],
  square: [
    [0, 0.82],
    [0.12, 0.94],
    [0.3, 1],
    [0.52, 0.99],
    [0.72, 0.94],
    [0.88, 0.88],
    [1, 0.9],
  ],
  octagon: [
    [0, 0.62],
    [0.08, 0.8],
    [0.22, 0.97],
    [0.4, 1],
    [0.58, 0.93],
    [0.74, 0.78],
    [0.88, 0.64],
    [1, 0.68],
  ],
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Добавляет точку, только если она не совпадает с предыдущей. */
function pushUnique(points: Vector2[], point: Vector2): void {
  const previous = points.at(-1);

  if (
    previous &&
    Math.abs(previous.x - point.x) <= PROFILE_EPSILON &&
    Math.abs(previous.y - point.y) <= PROFILE_EPSILON
  ) {
    return;
  }

  points.push(point);
}

/**
 * Внешний силуэт от дна до кромки.
 *
 * SplineCurve — Catmull-Rom: кривая проходит через опорные точки и даёт
 * плавный изгиб между ними. Сплайн может выйти за опорные точки, поэтому
 * радиус каждый раз ограничиваем диапазоном [минимум, diameter / 2], а высоту
 * держим неубывающей: точки идут строго снизу вверх, без петель.
 */
function createOuterProfile(params: VaseProfileParams): Vector2[] {
  const height = Math.max(params.height, MIN_FLOOR_MM * 2);
  const maxRadius = Math.max(params.diameter / 2, MIN_OUTER_RADIUS_MM);
  const minRadius = Math.min(MIN_OUTER_RADIUS_MM, maxRadius * 0.5);
  const preset = SHAPE_PRESETS[params.shape] ?? SHAPE_PRESETS.classic;
  const controls = preset.map(
    ([heightShare, radiusShare]) =>
      new Vector2(
        clamp(radiusShare * maxRadius, minRadius, maxRadius),
        clamp(heightShare * height, 0, height),
      ),
  );
  const spline = new SplineCurve(controls);
  const points: Vector2[] = [];
  let previousY = 0;

  for (let index = 0; index <= OUTER_SEGMENTS; index += 1) {
    const sampled = spline.getPoint(index / OUTER_SEGMENTS);
    const y = clamp(Math.max(sampled.y, previousY), 0, height);
    const x = clamp(sampled.x, minRadius, maxRadius);

    pushUnique(points, new Vector2(x, y));
    previousY = y;
  }

  // Последняя точка должна лежать ровно на кромке: иначе плоское кольцо
  // кромки получит микроскопический наклон и лишние треугольники.
  const last = points.at(-1);

  if (last) {
    last.set(clamp(controls.at(-1)!.x, minRadius, maxRadius), height);
  }

  return points;
}

/** Радиус внешней стенки на заданной высоте: линейная интерполяция. */
function radiusAtHeight(profile: Vector2[], height: number): number {
  for (let index = 1; index < profile.length; index += 1) {
    const previous = profile[index - 1];
    const current = profile[index];

    if (height <= current.y) {
      const span = current.y - previous.y;

      if (span <= PROFILE_EPSILON) {
        return current.x;
      }

      const t = (height - previous.y) / span;

      return previous.x + (current.x - previous.x) * t;
    }
  }

  return profile.at(-1)!.x;
}

/**
 * Возвращает замкнутый профиль вазы в миллиметрах.
 *
 * Толщина стенки откладывается по радиусу: внутренняя точка на той же высоте
 * равна внешнему радиусу минус эффективная стенка. Если стенка не помещается
 * в узкую горловину, она автоматически подрезается до 45% минимального
 * внешнего радиуса — модель остаётся полой и не выворачивается наизнанку.
 *
 * Дно имеет толщину max(wall, 1.2 мм): более тонкое дно сложно снять со стола
 * без повреждений.
 */
export function createVaseProfile(params: VaseProfileParams): Vector2[] {
  const height = Math.max(params.height, MIN_FLOOR_MM * 2);
  const outer = createOuterProfile(params);
  const minOuterRadius = outer.reduce(
    (minimum, point) => Math.min(minimum, point.x),
    Number.POSITIVE_INFINITY,
  );
  const minInnerRadius = Math.min(MIN_INNER_RADIUS_MM, minOuterRadius * 0.5);
  const effectiveWall = Math.min(
    Math.max(params.wall, 0),
    minOuterRadius * MAX_WALL_SHARE,
  );
  const floorThickness = clamp(
    Math.max(params.wall, MIN_FLOOR_MM),
    MIN_FLOOR_MM,
    height * 0.5,
  );
  const innerTopRadius = Math.max(
    outer.at(-1)!.x - effectiveWall,
    minInnerRadius,
  );

  // Дно снаружи: от оси к внешней стенке, дальше сам внешний силуэт.
  const points: Vector2[] = [new Vector2(0, 0), ...outer];

  // Кромка: плоское кольцо от внешней стенки к внутренней.
  pushUnique(points, new Vector2(innerTopRadius, height));

  // Внутренняя стенка сверху вниз. Точки ниже дна полости не нужны: там
  // начинается горизонтальная поверхность дна.
  for (let index = outer.length - 2; index >= 0; index -= 1) {
    const source = outer[index];

    if (source.y <= floorThickness + PROFILE_EPSILON) {
      break;
    }

    pushUnique(
      points,
      new Vector2(
        Math.max(source.x - effectiveWall, minInnerRadius),
        source.y,
      ),
    );
  }

  // Дно полости: от внутренней стенки обратно к оси.
  const innerFloorRadius = Math.max(
    radiusAtHeight(outer, floorThickness) - effectiveWall,
    minInnerRadius,
  );

  pushUnique(points, new Vector2(innerFloorRadius, floorThickness));
  points.push(new Vector2(0, floorThickness));

  // Явное замыкание контура по оси. Сегмент оси при вращении даёт
  // вырожденные треугольники — их уберёт очистка геометрии.
  points.push(new Vector2(0, 0));

  return points;
}

/**
 * Объём материала по замкнутому профилю, мм³.
 *
 * Теорема Паппуса: объём тела вращения равен площади сечения, умноженной на
 * путь центра масс (2πr). Полость вычитать не нужно: её граница уже входит в
 * контур с обратным обходом. Результат — оценка расхода пластика без учёта
 * заполнения и периметров.
 */
export function calculateVaseVolumeMm3(profile: Vector2[]): number {
  let doubleArea = 0;
  let centroidTerm = 0;

  for (let index = 0; index < profile.length; index += 1) {
    const current = profile[index];
    const next = profile[(index + 1) % profile.length];
    const cross = current.x * next.y - next.x * current.y;

    doubleArea += cross;
    centroidTerm += (current.x + next.x) * cross;
  }

  const signedArea = doubleArea / 2;

  if (Math.abs(signedArea) < 1e-9) {
    return 0;
  }

  const centroidRadius = centroidTerm / (6 * signedArea);

  return Math.abs(2 * Math.PI * signedArea * centroidRadius);
}
