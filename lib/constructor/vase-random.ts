/**
 * Случайная ваза: силуэт, узоры, числа и сид от переданного генератора.
 *
 * Модуль чистый: источник случайности приходит аргументом, а не берётся из
 * `Math.random()` внутри. Конструктор передаёт браузерный генератор, а
 * проверочный скрипт — свой, и тогда результат воспроизводим: тест знает, какие
 * числа получит функция, и проверяет границы, а не «что-то произошло».
 *
 * Диапазоны — из плана этапа, а не крайние значения слайдеров: 0.5–2 мм и 6–24
 * повтора дают читаемый рельеф, тогда как 3 мм на 32 гребнях превращают стенку в
 * рябь. Нормализация всё равно зажмёт числа в слайдеры, но случайность обязана
 * попадать внутрь с первого раза: иначе кнопка иногда показывала бы «пустую» вазу.
 */
import {
  CONSTRUCTOR_LIMITS,
  VASE_DEFAULT_FADE_BOTTOM_MM,
  VASE_DEFAULT_FADE_TOP_MM,
  VASE_PATTERNS,
  VASE_SHAPES,
  type PatternLayer,
  type VaseParams,
  type VasePattern,
} from "@/lib/constructor/params";

/** Границы случайной амплитуды слоя, мм. */
export const VASE_RANDOM_AMPLITUDE = { min: 0.5, max: 2 } as const;

/** Границы случайной частоты слоя: число гребней по окружности. */
export const VASE_RANDOM_FREQUENCY = { min: 6, max: 24 } as const;

/** Сколько слоёв получает случайная ваза: один или два. */
export const VASE_RANDOM_LAYER_COUNTS = [1, 2] as const;

/**
 * Узоры, из которых выбирает рандом.
 *
 * `smooth` исключён: слой без рельефа — это «узора нет», и случайная ваза с ним
 * выглядела бы как кнопка, которая не сработала. Порядок наследуется от
 * `VASE_PATTERNS`, поэтому новый узор попадает в рандом сам, без правки списка.
 */
export const VASE_RANDOM_PATTERNS: readonly VasePattern[] = VASE_PATTERNS.filter(
  (pattern) => pattern !== "smooth",
);

/** Что возвращает рандом: ровно те поля, которые он вправе менять. */
export type RandomVaseParams = Pick<
  VaseParams,
  "shape" | "patterns" | "vaseSeed"
>;

/**
 * Индекс в массиве по случайному числу 0…1.
 *
 * `random()` не обязан быть честным: тест может вернуть 1, а испорченный
 * генератор — NaN. Поэтому значение зажимается в границы, а не проверяется
 * вызывающим кодом.
 */
function randomIndex(length: number, random: () => number): number {
  const value = random();

  if (!Number.isFinite(value) || length <= 0) {
    return 0;
  }

  return Math.min(length - 1, Math.max(0, Math.floor(value * length)));
}

/**
 * Случайное число на шаге слайдера.
 *
 * Значение встаёт на сетку шага, поэтому `0.5 + 15 × 0.1` не превращается в
 * 1.9999999999999998: нормализация потом всё равно выровняет число, но лучше,
 * когда параметры совпадают с тем, что покажет слайдер, сразу.
 */
function randomStepValue(
  min: number,
  max: number,
  step: number,
  decimals: number,
  random: () => number,
): number {
  const count = Math.max(0, Math.round((max - min) / step));
  const value = min + randomIndex(count + 1, random) * step;

  return Number(value.toFixed(decimals));
}

/**
 * Случайная ваза: силуэт, один-два слоя узора, амплитуды, частоты и сид.
 *
 * Слои разных типов: два слоя одного рисунка только удвоили бы глубину, а
 * композиция читается, когда рисунки не повторяются, — та же логика, что у
 * `nextPatternLayer`. Фаза у обоих нулевая, затухание печатное (5 и 3 мм):
 * случайность касается рисунка, а не краёв, которые нужны печати.
 *
 * Размеры, стенка и деформации не меняются: кнопка «Случайная ваза» крутит
 * форму, а не стол принтера, и не должна молча делать вазу выше или толще.
 */
export function randomVaseParams(random: () => number): RandomVaseParams {
  const shape = VASE_SHAPES[randomIndex(VASE_SHAPES.length, random)];
  const layerCount =
    VASE_RANDOM_LAYER_COUNTS[
      randomIndex(VASE_RANDOM_LAYER_COUNTS.length, random)
    ];
  const pool = [...VASE_RANDOM_PATTERNS];
  const patterns: PatternLayer[] = [];

  for (let index = 0; index < layerCount; index += 1) {
    const [type] = pool.splice(randomIndex(pool.length, random), 1);

    patterns.push({
      type,
      amplitude: randomStepValue(
        VASE_RANDOM_AMPLITUDE.min,
        VASE_RANDOM_AMPLITUDE.max,
        0.1,
        1,
        random,
      ),
      frequency: randomStepValue(
        VASE_RANDOM_FREQUENCY.min,
        VASE_RANDOM_FREQUENCY.max,
        1,
        0,
        random,
      ),
      phaseDeg: 0,
      envelope: {
        fadeTopMm: VASE_DEFAULT_FADE_TOP_MM,
        fadeBottomMm: VASE_DEFAULT_FADE_BOTTOM_MM,
      },
    });
  }

  return {
    shape,
    patterns,
    vaseSeed: randomStepValue(
      CONSTRUCTOR_LIMITS.vaseSeed.min,
      CONSTRUCTOR_LIMITS.vaseSeed.max,
      CONSTRUCTOR_LIMITS.vaseSeed.step,
      CONSTRUCTOR_LIMITS.vaseSeed.decimals,
      random,
    ),
  };
}
