import { SplineCurve, Vector2 } from "three";

import type { VaseParams, VaseShape } from "@/lib/constructor/params";
import { vaseProfileRows, type VaseBudget } from "@/lib/constructor/vase-budget";
import {
  resolveOrganic,
  resolveVaseSeed,
} from "@/lib/constructor/vase-deformation";
import { organicProfileShare } from "@/lib/constructor/vase-seed";

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
 *
 * Сколько точек снимается со сплайна силуэта, module не решает: это функция
 * размера вазы и бюджета треугольников (`vaseProfileRows`), и она приходит
 * аргументом — иначе шаг по высоте и шаг по окружности разъезжались бы.
 */

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

/**
 * Доля высоты, которую может занять цоколь.
 *
 * Цоколь отнимает высоту у силуэта, а не добавляет её сверху: иначе модель
 * выросла бы выше заказанной. 15% — предел, после которого силуэт читается как
 * «стакан на ножке», а не как ваза.
 */
const MAX_FOOT_SHARE = 0.15;

/** Доля высоты, которую может занять раструб обода: 45° на 12% высоты — уже много. */
const MAX_RIM_SHARE = 0.12;

/** Параметры, из которых строится осевое сечение: узор на профиль не влияет. */
export type VaseProfileParams = Pick<
  VaseParams,
  "height" | "diameter" | "wall" | "shape" | "footMm" | "rimMm" | "organic" | "vaseSeed"
>;

/**
 * Насколько сид может сжать радиус опорной точки силуэта.
 *
 * Два процента — предел, при котором ваза остаётся «той же моделью»: силуэт
 * читается, диаметр и расход пластика не уезжают. Вариация только сжимает, а не
 * расширяет, потому что диаметр — обещание слайдера: «самая широкая часть»
 * никогда не должна оказаться шире заказанного.
 */
const MAX_PROFILE_VARIATION = 0.02;

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
 *
 * mushroom, bud, bottle и bubble — второй набор форм: они заметно отличаются от
 * первых восьми, и именно на них видно, что силуэт задаётся только числами.
 * mushroom — широкая шляпка на узкой ножке (читается как лампа); bud — силуэт,
 * сходящийся к узкой горловине, как нераскрывшийся бутон; bottle — плечо и
 * горлышко графина; bubble — три сферы, посаженные друг на друга. Самая широкая
 * опорная точка у каждого силуэта стоит на 1: слайдер «Диаметр» обещает самую
 * широкую часть модели, и расхождение с ним читалось бы как ошибка размера.
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
  mushroom: [
    [0, 0.42],
    [0.05, 0.46],
    [0.2, 0.44],
    [0.45, 0.42],
    [0.6, 0.58],
    [0.72, 0.86],
    [0.82, 1],
    [0.94, 1],
    [1, 0.94],
  ],
  bud: [
    [0, 0.5],
    [0.08, 0.62],
    [0.25, 0.78],
    [0.5, 0.9],
    [0.72, 1],
    [0.86, 0.74],
    [0.94, 0.5],
    [1, 0.36],
  ],
  bottle: [
    [0, 0.72],
    [0.06, 0.86],
    [0.18, 1],
    [0.4, 0.98],
    [0.58, 0.82],
    [0.7, 0.56],
    [0.78, 0.4],
    [0.84, 0.52],
    [0.92, 0.46],
    [1, 0.44],
  ],
  bubble: [
    [0, 0.5],
    [0.06, 0.66],
    [0.14, 0.74],
    [0.22, 0.66],
    [0.3, 0.5],
    [0.4, 0.62],
    [0.5, 0.9],
    [0.58, 1],
    [0.66, 0.86],
    [0.74, 0.64],
    [0.84, 0.72],
    [0.92, 0.8],
    [1, 0.74],
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
function createOuterProfile(params: VaseProfileParams, rows: number): Vector2[] {
  const height = Math.max(params.height, MIN_FLOOR_MM * 2);
  const maxRadius = Math.max(params.diameter / 2, MIN_OUTER_RADIUS_MM);
  const minRadius = Math.min(MIN_OUTER_RADIUS_MM, maxRadius * 0.5);
  const preset = SHAPE_PRESETS[params.shape] ?? SHAPE_PRESETS.classic;
  const organic = resolveOrganic(params.organic);
  const seed = resolveVaseSeed(params.vaseSeed);
  const controls = preset.map(([heightShare, radiusShare]) => {
    // Микро-вариация силуэта: при органике сид сжимает опорные радиусы до 2%.
    // Кривая зависит только от доли высоты, поэтому ваза остаётся той же формы,
    // а серия с разными сидами — разной по пропорциям. Без органики множитель
    // равен единице: старые вазы строятся вершина в вершину как раньше.
    const shrink =
      organic > 0
        ? organic * MAX_PROFILE_VARIATION * organicProfileShare(heightShare, seed)
        : 0;

    return new Vector2(
      clamp(radiusShare * (1 - shrink) * maxRadius, minRadius, maxRadius),
      clamp(heightShare * height, 0, height),
    );
  });
  const spline = new SplineCurve(controls);
  const points: Vector2[] = [];
  const foot = vaseFootHeight(height, params.footMm);
  const bodyHeight = Math.max(height - foot, MIN_FLOOR_MM * 2);
  const bandRadius = clamp(controls[0].x, minRadius, maxRadius);

  // Цоколь: вертикальная стенка на радиусе силуэта у дна. Точка на оси не
  // нужна — дно замыкает профиль, — но нижняя кромка должна стоять ровно на
  // y = 0, иначе модель повиснет над столом.
  if (foot > PROFILE_EPSILON) {
    points.push(new Vector2(bandRadius, 0));
  }

  let previousY = 0;

  for (let index = 0; index <= rows; index += 1) {
    const sampled = spline.getPoint(index / rows);
    // При цоколе силуэт сжимается в оставшуюся высоту: ножка не удлиняет
    // модель, а забирает нижние миллиметры у силуэта.
    const raw =
      foot > PROFILE_EPSILON
        ? foot + (sampled.y / height) * bodyHeight
        : sampled.y;
    const y = clamp(Math.max(raw, previousY), 0, height);
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

  return applyRim(points, params, height, maxRadius);
}

/**
 * Высота прямого цоколя, мм.
 *
 * Значение приходит из слайдера, но профиль строится и из чужих данных —
 * скриптов проверки и старых ссылок, — поэтому мусор превращается в ноль, а
 * слишком высокий цоколь обрезается долей высоты.
 *
 * Функция экспортируется: `vase-geometry` гасит узор на той же полосе, что и
 * профиль. Иначе цоколь остался бы гладким по силуэту, но зубчатым по
 * рельефу — «ножка на ножке», которая читается как брак печати.
 */
export function vaseFootHeight(
  height: number,
  requested: number | undefined,
): number {
  const value = requested ?? 0;

  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.min(value, height * MAX_FOOT_SHARE);
}

/**
 * Высота раструба обода, мм: та же доля высоты и тот же мусорный ноль.
 *
 * Экспортируется по той же причине, что и `vaseFootHeight`: обод — вторая
 * полоса, где узор обязан погаснуть до нуля, иначе венец становится гребешком.
 */
export function vaseRimHeight(
  height: number,
  requested: number | undefined,
): number {
  const value = requested ?? 0;

  if (!Number.isFinite(value) || value <= PROFILE_EPSILON) {
    return 0;
  }

  return Math.min(value, height * MAX_RIM_SHARE);
}

/**
 * Раструб обода: последние `rimMm` миллиметров высоты расширяются наружу.
 *
 * Кромка идёт под 45°, поэтому печатается без поддержек, а стенка остаётся
 * постоянной толщины: внутренний контур строится от нового внешнего радиуса.
 * Радиус не выходит за `diameter / 2` — обещание «диаметр в самой широкой
 * части» важнее декора: у цилиндра горло и так самое широкое место, и
 * слайдер там ничего не меняет.
 */
function applyRim(
  points: Vector2[],
  params: VaseProfileParams,
  height: number,
  maxRadius: number,
): Vector2[] {
  const rim = vaseRimHeight(height, params.rimMm);

  if (rim <= 0) {
    return points;
  }

  const start = height - rim;

  for (const point of points) {
    if (point.y <= start + PROFILE_EPSILON) {
      continue;
    }

    const share = clamp((point.y - start) / rim, 0, 1);

    point.x = Math.min(point.x + rim * share, maxRadius);
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
 *
 * Сколько точек снимать со сплайна, решает `vaseProfileRows`: шаг по высоте
 * должен совпасть с шагом по окружности, иначе поверхность собирается в
 * горизонтальные «террасы». Поэтому бюджет треугольников — второй аргумент:
 * предпросмотр (по умолчанию) и STL делят его по-своему, и профиль обязан
 * строиться с тем же бюджетом, с каким потом собирается сетка.
 */
export function createVaseProfile(
  params: VaseProfileParams,
  budget: VaseBudget = "preview",
): Vector2[] {
  const height = Math.max(params.height, MIN_FLOOR_MM * 2);
  const rows = vaseProfileRows(params.diameter, height, budget);
  const outer = createOuterProfile(params, rows);
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
