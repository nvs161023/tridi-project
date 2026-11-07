import {
  CONSTRUCTOR_LIMITS,
  DEFAULT_VASE_PARAMS,
  isVasePattern,
  isVaseShape,
  type VaseParams,
  type VasePattern,
} from "@/lib/constructor/params";
import { DETAIL_PATTERN_SCALE } from "@/lib/constructor/pattern-waves";
import {
  resolveSectionSides,
  VASE_SECTION_MIN_SIDES,
} from "@/lib/constructor/vase-section";

/**
 * Разрешение вазы по окружности и бюджет треугольников.
 *
 * LatheGeometry строит кольцо из фиксированного числа сегментов, а узор только
 * смещает готовые вершины. Поэтому частота рельефа ограничена не формулой, а
 * сеткой: при 128 сегментах «соты» на частоте 20 дают 40 ячеек по кругу, то
 * есть 3.2 выборки на период — синус превращается в шум. Здесь считается,
 * сколько сегментов нужно именно этому рельефу, и сколько треугольников
 * получится в итоге.
 *
 * Правило одно и то же для предпросмотра и для STL: разрешение растёт только
 * под рельеф и только вверх от базовых 128. Силуэт от него не зависит, поэтому
 * гладкие вазы остаются байт-в-байт прежними — это главное условие этапа.
 *
 * Модуль чистый: без three.js, чтобы числа можно было проверить отдельно от
 * сборки сцены.
 */

/** База: 128 сегментов при диаметре 200 мм дают хорду около 4.9 мм. */
export const VASE_MIN_SEGMENTS = 128;

/**
 * Потолок по окружности.
 *
 * 256 сегментов при 129 точках профиля — это 65 536 треугольников, половина
 * бюджета предпросмотра. Дальше растёт не качество, а вес STL: слайсер всё
 * равно сглаживает контур печати, а «звенящий» рельеф появляется раньше.
 */
export const VASE_MAX_SEGMENTS = 256;

/**
 * Сколько выборок приходится на один период рельефа.
 *
 * Восемь — минимум, при котором синус читается гладким: на четыре выборки
 * приходится пик и провал без скруглений, на восемь форма волны видна. Именно
 * поэтому значение не 16: при 16 «соты» на дефолтной частоте 8 требуют 256
 * сегментов, то есть меняют сетку всем существующим вазам, а выигрыш уже
 * неразличим глазом.
 */
export const VASE_SAMPLES_PER_PERIOD = 8;

/** Бюджет предпросмотра: больше 120 000 треугольников браузер не любит. */
export const VASE_PREVIEW_TRIANGLE_BUDGET = 120_000;

/** Бюджет STL: запас на будущие узоры (вмятины, ажур) и высокие вазы. */
export const VASE_EXPORT_TRIANGLE_BUDGET = 400_000;

/** Для чего собирается сетка: экран или файл. */
export type VaseBudget = "preview" | "export";

/** Поля параметров, от которых зависит разрешение по окружности. */
export type VaseBudgetParams = Partial<
  Pick<VaseParams, "pattern" | "patternFrequency" | "shape" | "sectionSides">
>;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Частота узора, приведённая к допустимой.
 *
 * Параметры приходят из состояния конструктора и из тела запроса, поэтому
 * NaN и дробные значения здесь обычное дело. Округление совпадает с тем, что
 * делает `applyPattern`: он тоже считает частоту целой. Если числа нет вовсе,
 * берётся значение по умолчанию, иначе разрешение посчиталось бы по мусору.
 */
function safeFrequency(frequency: number | undefined): number {
  const value = Number.isFinite(frequency)
    ? Math.round(frequency as number)
    : DEFAULT_VASE_PARAMS.patternFrequency;

  return clamp(
    value,
    CONSTRUCTOR_LIMITS.patternFrequency.min,
    CONSTRUCTOR_LIMITS.patternFrequency.max,
  );
}

/**
 * Сколько периодов рельефа укладывается по окружности.
 *
 * У гладкой вазы периодов нет. Соты и чешуйки мельче рёбер в
 * `DETAIL_PATTERN_SCALE` раз — множитель целый, поэтому периодов тоже целое
 * число. Спираль и волны считаются по той же частоте: у спирали это число
 * гребней, у волн — число колец (по окружности они не повторяются, но лишние
 * сегменты им не вредят).
 */
export function patternPeriodsByTurn(
  pattern: VasePattern,
  frequency: number | undefined,
): number {
  if (pattern === "smooth") {
    return 0;
  }

  const value = safeFrequency(frequency);

  return pattern === "honeycomb" || pattern === "scales"
    ? value * DETAIL_PATTERN_SCALE
    : value;
}

/**
 * Минимальное разрешение, при котором рельеф ещё читается.
 *
 * Считается от числа периодов, а не от габарита: диаметр на частоту не влияет,
 * зато любое правило «хорда не больше N мм» поднимало бы разрешение даже
 * гладким вазам и меняло их сетку.
 */
export function requiredVaseSegments(
  pattern: VasePattern,
  frequency: number | undefined,
): number {
  const periods = patternPeriodsByTurn(pattern, frequency);

  if (periods <= 0) {
    return VASE_MIN_SEGMENTS;
  }

  return clamp(
    Math.ceil(periods * VASE_SAMPLES_PER_PERIOD),
    VASE_MIN_SEGMENTS,
    VASE_MAX_SEGMENTS,
  );
}

/**
 * Оценка числа треугольников по числу сегментов и точек профиля.
 *
 * LatheGeometry соединяет соседние точки профиля кольцом из `segments` квадов,
 * то есть даёт `2 × segments × (points − 1)` треугольников. Часть из них
 * вырождена (ось вращения, шов) и будет удалена очисткой, поэтому оценка —
 * верхняя граница: бюджет она не превысит, а занизить его не может.
 */
export function estimateVaseTriangles(
  segments: number,
  profilePointCount: number,
): number {
  return 2 * Math.max(segments, 1) * Math.max(profilePointCount - 1, 1);
}

/** Лимит треугольников для режима сборки. */
export function vaseTriangleBudget(budget: VaseBudget = "preview"): number {
  return budget === "export"
    ? VASE_EXPORT_TRIANGLE_BUDGET
    : VASE_PREVIEW_TRIANGLE_BUDGET;
}

/**
 * Во сколько раз шаг колец должен нацело делиться, чтобы грани были точными.
 *
 * LatheGeometry ставит вершины через равный угол, а угол многоугольника
 * приходится ровно на середину сектора (`π/N`). Чтобы он попал в вершину,
 * полный круг должен делиться на целое число углов: `segments = 2 · m · N`.
 * Для квадрата и восьмиугольника это 8 и 16 — оба делят 128, поэтому старые
 * вазы не меняются вовсе. Без выравнивания 3, 5, 6, 7, 9, 10, 11 и 12-гранник
 * терял бы углы: между соседними кольцами проходит хорда, и угол срезается
 * фаской (в замерах до 0.76 мм).
 */
export function sectionSegmentStep(sides: number): number {
  if (!Number.isFinite(sides) || sides < VASE_SECTION_MIN_SIDES) {
    return 1;
  }

  return Math.round(sides) * 2;
}

/** Округляет число сегментов вверх до кратного граням. */
export function alignSegmentsToSection(segments: number, sides: number): number {
  const step = sectionSegmentStep(sides);

  if (step <= 1) {
    return segments;
  }

  return Math.ceil(segments / step) * step;
}

/**
 * Число сегментов по окружности для конкретной вазы.
 *
 * Порядок: взять требование рельефа, затем урезать его бюджетом, затем
 * округлить вверх до кратного граням. Профиль важнее окружности (силуэт видно
 * на просвет), поэтому ниже базы разрешение не опускается никогда: 128
 * сегментов при 129 точках — это 32 768 треугольников, они влезают даже в самый
 * скромный лимит. Если выравнивание под грани вылезает за бюджет (это возможно
 * только на вазе с очень подробным профилем), бюджет важнее: углы тогда
 * срезаются хордой, но файл остаётся в лимите.
 */
export function vaseSegments(
  params: VaseBudgetParams,
  profilePointCount: number,
  budget: VaseBudget = "preview",
): number {
  const pattern = isVasePattern(params.pattern)
    ? params.pattern
    : DEFAULT_VASE_PARAMS.pattern;
  const shape = isVaseShape(params.shape) ? params.shape : DEFAULT_VASE_PARAMS.shape;
  const required = requiredVaseSegments(pattern, params.patternFrequency);
  const byBudget = Math.floor(
    vaseTriangleBudget(budget) / (2 * Math.max(profilePointCount - 1, 1)),
  );
  const base = Math.max(VASE_MIN_SEGMENTS, Math.min(required, byBudget));
  const aligned = alignSegmentsToSection(
    base,
    resolveSectionSides(shape, params.sectionSides),
  );

  return aligned <= byBudget ? aligned : base;
}
