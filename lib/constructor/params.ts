/**
 * Параметры конструктора ваз: границы, значения по умолчанию и нормализация.
 *
 * Здесь нет three.js и React — модуль общий для клиентской сцены, серверного
 * экспорта STL и проверочных скриптов. Размеры везде в миллиметрах: STL не
 * хранит единицы, и слайсеры трактуют их как миллиметры, поэтому пересчёт
 * масштаба не нужен.
 *
 * Границы выбраны под настольные принтеры: высота до 300 мм, диаметр до
 * 200 мм (влезает на стол 220 × 220), стенка от 0.8 мм — два периметра соплом
 * 0.4 мм. Шаг толщины 0.1 мм, чтобы попадать в привычные 1.2 / 1.6 / 2.0 мм.
 */

/** Размерный параметр: границы, шаг и значение по умолчанию. */
type NumericLimit = {
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  /** Сколько знаков показывать в интерфейсе. */
  decimals: number;
};

/**
 * Границы параметров в одном месте: их читают слайдеры, нормализация и
 * будущий API-роут, поэтому расхождение между UI и сервером исключено.
 */
export const CONSTRUCTOR_LIMITS = {
  height: { min: 60, max: 300, step: 5, defaultValue: 140, decimals: 0 },
  diameter: { min: 40, max: 200, step: 5, defaultValue: 90, decimals: 0 },
  wall: { min: 0.8, max: 4, step: 0.1, defaultValue: 1.6, decimals: 1 },
} as const satisfies Record<string, NumericLimit>;

/**
 * Пресеты силуэта. Значение — часть состояния модели, а не размер: профиль
 * строится в lib/constructor/vase-profile.ts по этим идентификаторам.
 */
export const VASE_SHAPES = ["classic", "cone", "cylinder"] as const;

export type VaseShape = (typeof VASE_SHAPES)[number];

/** Подписи для интерфейса: одни и те же в панели и в подписи предпросмотра. */
export const VASE_SHAPE_LABELS = {
  classic: "Классика",
  cone: "Конус",
  cylinder: "Цилиндр",
} as const satisfies Record<VaseShape, string>;

/** Настраиваемые размеры и форма вазы. */
export type VaseParams = {
  /** Высота готовой модели, мм. */
  height: number;
  /** Внешний диаметр в самой широкой части, мм. */
  diameter: number;
  /** Толщина стенки, мм. */
  wall: number;
  /** Пресет силуэта: классическая ваза, конус или цилиндр. */
  shape: VaseShape;
};

/** Значения, с которыми открывается конструктор. */
export const DEFAULT_VASE_PARAMS: VaseParams = {
  height: CONSTRUCTOR_LIMITS.height.defaultValue,
  diameter: CONSTRUCTOR_LIMITS.diameter.defaultValue,
  wall: CONSTRUCTOR_LIMITS.wall.defaultValue,
  shape: "classic",
};

/** Проверка незнакомого значения из формы, ссылки или API. */
export function isVaseShape(value: unknown): value is VaseShape {
  return (
    typeof value === "string" &&
    (VASE_SHAPES as readonly string[]).includes(value)
  );
}

/** Значение внутри границ. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Приводит число к сетке шага внутри границ.
 *
 * Шаг отсчитывается от минимума: для высоты 60–300 с шагом 5 получаются
 * ровно 60, 65, …, 300. Округление до сотых убирает хвосты плавающей точки
 * (1.6 + 0.1 может дать 1.7000000000000002).
 */
function snap(value: number, limit: NumericLimit): number {
  const clamped = clamp(value, limit.min, limit.max);
  const steps = Math.round((clamped - limit.min) / limit.step);
  const snapped = limit.min + steps * limit.step;

  return Math.round(snapped * 100) / 100;
}

/**
 * Проверяет и выравнивает параметры перед отрисовкой или экспортом.
 *
 * Функция нужна и клиенту, и серверу: значения могут прийти из слайдера,
 * из будущей ссылки с настройками или из запроса к API. Отсутствующие поля
 * заменяются значениями по умолчанию, поэтому неполный объект безопасен.
 */
export function normalizeVaseParams(params: Partial<VaseParams>): VaseParams {
  return {
    height: snap(params.height ?? DEFAULT_VASE_PARAMS.height, CONSTRUCTOR_LIMITS.height),
    diameter: snap(
      params.diameter ?? DEFAULT_VASE_PARAMS.diameter,
      CONSTRUCTOR_LIMITS.diameter,
    ),
    wall: snap(params.wall ?? DEFAULT_VASE_PARAMS.wall, CONSTRUCTOR_LIMITS.wall),
    shape: isVaseShape(params.shape) ? params.shape : DEFAULT_VASE_PARAMS.shape,
  };
}
