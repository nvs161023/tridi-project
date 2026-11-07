import {
  CONSTRUCTOR_LIMITS,
  DEFAULT_VASE_PARAMS,
  isVaseShape,
  resolvePatternLayers,
  type VaseParams,
  type VasePattern,
  type VasePatternInput,
} from "@/lib/constructor/params";
import { DETAIL_PATTERN_SCALE } from "@/lib/constructor/pattern-waves";
import { resolveFluteCount } from "@/lib/constructor/vase-deformation";
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
 * Разрешение задают две вещи: частота рельефа (узор и каннелюры) и размер вазы.
 * Второе важнее и было упущено: при фиксированных 128 сегментах хорда на
 * окружности зависит от диаметра, и ваза Ø90 собиралась огранкой по 2.2 мм, а
 * Ø200 — по 4.9 мм. В слайсере это читалось как «слабая детализация»: рельеф
 * есть, а поверхность выглядит гранёной. Поэтому к требованию рельефа добавлено
 * требование хорды: столько сегментов, чтобы хорда на самом широком кольце была
 * не длиннее `VASE_CHORD_MM` (0.6 мм).
 *
 * Порядок «максимум из двух требований, затем бюджет» сохраняет оба прежних
 * обещания: мелкий рельеф не превращается в шум, а число треугольников никогда
 * не выходит за бюджет режима. Меняется только одно — гладкая ваза больше не
 * собирается огранкой в 2 мм, и это намеренно.
 *
 * Цель по хорде одна на предпросмотр и на STL: после того как сварка вершин
 * перестала быть узким местом (см. `weldPositions`), плотная сетка собирается
 * быстрее прежней грубой, поэтому экран показывает ту же геометрию, что уходит
 * в файл. Различаются режимы только бюджетом треугольников: на 200 мм
 * предпросмотр упирается в свои 120 000, а STL идёт до 400 000.
 *
 * Модуль чистый: без three.js, чтобы числа можно было проверить отдельно от
 * сборки сцены.
 */

/** Нижняя граница: меньше 128 сегментов не бывает ни при каком размере. */
export const VASE_MIN_SEGMENTS = 128;

/**
 * Целевая длина хорды по окружности, мм: верхняя граница шага сетки.
 *
 * Хорда — это отрезок между соседними вершинами кольца. Именно она, а не число
 * сегментов, определяет, выглядит ли ваза гранёной: 2.2 мм на Ø90 видно на
 * фотографии печати, 1.6 мм уже нет. Взят 0.6 мм — сопоставимо с диаметром
 * сопла 0.4: слайсер всё равно не воспроизведёт дугу точнее, но огранку такой
 * шаг не создаёт. Крупнее этого значения шаг не бывает ни при каком бюджете.
 */
export const VASE_CHORD_MM = 0.6;

/**
 * Мельче этого шага строки профиля не нужны, мм.
 *
 * Строки идут по высоте, и их шаг тоже виден: на 2.2 мм поверхность читалась
 * «стиральной доской» — ровные горизонтальные полосы между кольцами, особенно
 * заметные на плоском затенении слайсера. Девяти десятых хватает: на снимках
 * гейта полосы исчезают, а полмиллиметра шага давали бы вдвое больше
 * треугольников без видимой разницы.
 */
export const VASE_ROW_MIN_MM = 0.9;

/** Сколько строк профиля минимум: у маленькой вазы силуэт тоже должен читаться. */
export const VASE_MIN_ROWS = 48;

/** Потолок строк: у вазы 300 мм это шаг 0.94 мм. */
export const VASE_MAX_ROWS = 320;

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
  Pick<VaseParams, "shape" | "sectionSides" | "flutes" | "diameter" | "height">
> &
  VasePatternInput;

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
    : DEFAULT_VASE_PARAMS.patterns[0].frequency;

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

/**
 * Сколько сегментов нужно, чтобы каннелюры читались.
 *
 * У жёлоба один период на оборот, поэтому правило то же, что у узоров:
 * `VASE_SAMPLES_PER_PERIOD` выборок на жёлоб. Даже 24 жёлоба требуют 192
 * сегмента — меньше потолка, поэтому каннелюры никогда не упираются в
 * разрешение.
 */
export function requiredFluteSegments(flutes: number): number {
  const count = Math.round(flutes);

  if (!Number.isFinite(count) || count <= 0) {
    return 0;
  }

  return clamp(
    count * VASE_SAMPLES_PER_PERIOD,
    VASE_MIN_SEGMENTS,
    VASE_MAX_SEGMENTS,
  );
}

/**
 * Во сколько раз шаг колец должен нацело делиться, чтобы жёлоба были точными.
 *
 * У жёлоба два характерных места — гребень и дно. Чтобы в вершины попали оба,
 * круг должен делиться на `2 · flutes`: тогда сетка не «промахивается» мимо дна
 * и глубина совпадает с заданной. Промах был бы второго порядка (у дна
 * производная равна нулю), но 5–6% от трёх миллиметров видны на глаз, а лишние
 * сегменты почти бесплатны.
 */
export function fluteSegmentStep(flutes: number): number {
  const count = Math.round(flutes);

  if (!Number.isFinite(count) || count <= 0) {
    return 1;
  }

  return count * 2;
}

/**
 * Целевой шаг сетки, мм — одинаковый по окружности и по высоте.
 *
 * Площадь сетки растёт как произведение двух шагов, поэтому один бюджет делится
 * между направлениями поровну: шаг `s` даёт `4 · π · D · H / s²` треугольников
 * (две стенки, по два треугольника на клетку). Отсюда `s = sqrt(4πDH / бюджет)`,
 * но не крупнее `VASE_CHORD_MM`: рельеф должен читаться при любом размере, а
 * бюджет ограничивает уже не его, а плотность.
 *
 * Одинаковый шаг в двух направлениях — не эстетика, а лечение конкретного
 * дефекта: при шаге 0.6 мм по окружности и 2.2 мм по высоте поверхность
 * собиралась в горизонтальные «террасы», которые на плоском затенении читались
 * как слабая детализация, хотя рёбра были на месте.
 */
export function vaseDetailMm(
  diameter: number | undefined,
  height: number | undefined,
  budget: VaseBudget = "preview",
): number {
  const size = Number.isFinite(diameter)
    ? Math.max(diameter as number, 0)
    : DEFAULT_VASE_PARAMS.diameter;
  const tall = Number.isFinite(height)
    ? Math.max(height as number, 0)
    : DEFAULT_VASE_PARAMS.height;
  const area = 4 * Math.PI * size * tall;
  const byBudget = area > 0 ? Math.sqrt(area / vaseTriangleBudget(budget)) : 0;

  return Math.max(VASE_CHORD_MM, byBudget);
}

/**
 * Сколько строк нужно внешнему силуэту, чтобы шаг по высоте совпал с шагом по
 * окружности.
 *
 * Мельче `VASE_ROW_MIN_MM` строки не делаются: горизонтальные полосы на этом
 * шаге уже не видны, а треугольники продолжали бы расти. Счёт идёт по высоте
 * вазы, а потолок и пол держат маленькие и очень высокие модели в разумных
 * рамках.
 */
export function vaseProfileRows(
  diameter: number | undefined,
  height: number | undefined,
  budget: VaseBudget = "preview",
): number {
  const size = Number.isFinite(diameter)
    ? Math.max(diameter as number, 0)
    : DEFAULT_VASE_PARAMS.diameter;
  const tall = Number.isFinite(height)
    ? Math.max(height as number, 0)
    : DEFAULT_VASE_PARAMS.height;
  const step = Math.max(vaseDetailMm(size, tall, budget), VASE_ROW_MIN_MM);

  if (tall <= 0) {
    return VASE_MIN_ROWS;
  }

  return clamp(Math.round(tall / step), VASE_MIN_ROWS, VASE_MAX_ROWS);
}

/**
 * Сколько сегментов нужно, чтобы шаг по окружности был не крупнее целевого.
 *
 * Окружность считается по диаметру — обещанию слайдера «самая широкая часть», а
 * не по текущему радиусу: у бутылочного силуэта широкая часть одна, и именно она
 * задаёт огранку. Шаг переводится в сегменты как `π · D / шаг`: настоящая хорда
 * `2 · R · sin(π / N)` отличается от дуги меньше чем на 0.1% уже при 128
 * сегментах, то есть на порядок точнее, чем нужно.
 *
 * Ниже базы функция не опускается: маленькая ваза получает те же 128 сегментов,
 * что и раньше, иначе у неё выросла бы относительная огранка.
 */
export function detailVaseSegments(
  diameter: number | undefined,
  height: number | undefined,
  budget: VaseBudget = "preview",
): number {
  const size = Number.isFinite(diameter)
    ? Math.max(diameter as number, 0)
    : DEFAULT_VASE_PARAMS.diameter;
  const step = vaseDetailMm(size, height, budget);

  return Math.max(VASE_MIN_SEGMENTS, Math.ceil((Math.PI * size) / step));
}

/** Наибольший общий делитель: нужен, чтобы сложить шаги выравнивания. */
function greatestCommonDivisor(first: number, second: number): number {
  let a = Math.abs(first);
  let b = Math.abs(second);

  while (b > 0) {
    const rest = a % b;

    a = b;
    b = rest;
  }

  return a > 0 ? a : 1;
}

/**
 * Округляет число сегментов вверх до кратного всем шагам сразу.
 *
 * Шаги бывают несовместимыми: 11 граней требуют кратности 22, а 23 каннелюры —
 * 46, и общее кратное 506 вдвое больше нужного. Поэтому вызывающий код сначала
 * пробует полное кратное, а если оно не влезает в бюджет — оставляет только
 * геометрически обязательный шаг граней (`vaseSegments`).
 */
export function alignSegmentsToSteps(
  segments: number,
  steps: readonly number[],
): number {
  let step = 1;

  for (const value of steps) {
    const rounded = Math.round(value);

    if (!Number.isFinite(rounded) || rounded <= 1) {
      continue;
    }

    step = (step * rounded) / greatestCommonDivisor(step, rounded);
  }

  if (step <= 1) {
    return segments;
  }

  return Math.ceil(segments / step) * step;
}

/**
 * Число сегментов по окружности для конкретной вазы.
 *
 * Порядок: взять максимум из двух требований — рельеф (узор и каннелюры) и шаг
 * сетки, который зависит от размера вазы и бюджета (см. `vaseDetailMm`), — затем
 * урезать его бюджетом, затем округлить вверх до общего кратного граням и
 * жёлобам.
 *
 * Шаг стоит первым по важности, потому что он единственный не связан с
 * рельефом: гладкая ваза Ø200 при 128 сегментах собиралась огранкой по 4.9 мм, и
 * никакой узор этого не исправлял. Теперь разрешение следует размеру.
 *
 * Выравнивание может потребовать вдвое больше сегментов, чем нужно рельефу
 * (см. `alignSegmentsToSteps`), поэтому у него свой потолок — двойной максимум
 * из требования шага и бюджета. Если полное кратное в потолок не влезает,
 * остаётся только шаг граней: каннелюры тогда получают на пару процентов меньше
 * глубины, а углы многоугольника остаются точными — это важнее.
 */
export function vaseSegments(
  params: VaseBudgetParams,
  profilePointCount: number,
  budget: VaseBudget = "preview",
): number {
  const layers = resolvePatternLayers(params);
  const shape = isVaseShape(params.shape) ? params.shape : DEFAULT_VASE_PARAMS.shape;
  const flutes = resolveFluteCount(params.flutes);
  // Слоёв до трёх, а разрешение одно на всех: сетка обязана обслужить самый
  // частый слой, иначе именно он превратится в шум, а редкие останутся гладкими.
  const required = Math.max(
    ...layers.map((layer) => requiredVaseSegments(layer.type, layer.frequency)),
    requiredFluteSegments(flutes),
  );
  const byDetail = detailVaseSegments(params.diameter, params.height, budget);
  const byBudget = Math.floor(
    vaseTriangleBudget(budget) / (2 * Math.max(profilePointCount - 1, 1)),
  );
  const base = Math.max(
    VASE_MIN_SEGMENTS,
    Math.min(Math.max(required, byDetail), byBudget),
  );
  const sectionStep = sectionSegmentStep(
    resolveSectionSides(shape, params.sectionSides),
  );
  const ceiling = Math.min(
    byBudget,
    Math.max(VASE_MAX_SEGMENTS, byDetail) * 2,
  );
  const aligned = alignSegmentsToSteps(base, [
    sectionStep,
    fluteSegmentStep(flutes),
  ]);

  if (aligned <= ceiling) {
    return aligned;
  }

  const bySection = alignSegmentsToSteps(base, [sectionStep]);

  return bySection <= ceiling ? bySection : base;
}
