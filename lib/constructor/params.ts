/**
 * Параметры конструктора: границы, значения по умолчанию и нормализация.
 *
 * Здесь нет three.js и React — модуль общий для клиентской сцены, серверного
 * экспорта STL и проверочных скриптов. Размеры везде в миллиметрах: STL не
 * хранит единицы, и слайсеры трактуют их как миллиметры, поэтому пересчёт
 * масштаба не нужен.
 *
 * Границы вазы выбраны под настольные принтеры: высота до 300 мм, диаметр до
 * 200 мм (влезает на стол 220 × 220), стенка от 0.8 мм — два периметра соплом
 * 0.4 мм. Шаг толщины 0.1 мм, чтобы попадать в привычные 1.2 / 1.6 / 2.0 мм.
 * Брелок ограничен 100 × 50 мм: он печатается плашмя и занимает стол целиком
 * только в самом крупном размере.
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
  patternIntensity: {
    min: 0,
    max: 5,
    step: 0.1,
    defaultValue: 1.5,
    decimals: 1,
  },
  patternFrequency: { min: 1, max: 20, step: 1, defaultValue: 8, decimals: 0 },
  length: { min: 30, max: 100, step: 1, defaultValue: 60, decimals: 0 },
  width: { min: 20, max: 50, step: 1, defaultValue: 30, decimals: 0 },
  thickness: { min: 2, max: 5, step: 0.5, defaultValue: 3, decimals: 1 },
} as const satisfies Record<string, NumericLimit>;

/** Типы моделей, которые умеет собирать конструктор. */
export const MODEL_TYPES = ["vase", "keychain"] as const;

export type ModelType = (typeof MODEL_TYPES)[number];

/** Подписи моделей для вкладок панели параметров. */
export const MODEL_TYPE_LABELS = {
  vase: "Ваза",
  keychain: "Брелок",
} as const satisfies Record<ModelType, string>;

/**
 * Пресеты силуэта. Значение — часть состояния модели, а не размер: профиль
 * строится в lib/constructor/vase-profile.ts по этим идентификаторам.
 */
export const VASE_SHAPES = [
  "classic",
  "cone",
  "cylinder",
  "hourglass",
  "teardrop",
  "double_bulb",
] as const;

export type VaseShape = (typeof VASE_SHAPES)[number];

/** Подписи для интерфейса: одни и те же в панели и в подписи предпросмотра. */
export const VASE_SHAPE_LABELS = {
  classic: "Классика",
  cone: "Конус",
  cylinder: "Цилиндр",
  hourglass: "Песочные часы",
  teardrop: "Капля",
  double_bulb: "Двойная сфера",
} as const satisfies Record<VaseShape, string>;

/**
 * Математические узоры на стенке.
 *
 * smooth — ровная поверхность; spiral — косая спираль; ribs — вертикальные
 * рёбра; waves — горизонтальные волны. Узор не добавляет вершины: он смещает
 * существующие точки LatheGeometry, поэтому число треугольников не меняется.
 */
export const VASE_PATTERNS = ["smooth", "spiral", "ribs", "waves"] as const;

export type VasePattern = (typeof VASE_PATTERNS)[number];

/** Подписи узоров для панели параметров. */
export const VASE_PATTERN_LABELS = {
  smooth: "Гладкая",
  spiral: "Спираль",
  ribs: "Рёбра",
  waves: "Волны",
} as const satisfies Record<VasePattern, string>;

/**
 * Форма брелока: скруглённый прямоугольник или вытянутый шестиугольник.
 * Круглое отверстие под кольцо есть у обеих форм.
 */
export const KEYCHAIN_SHAPES = ["rounded", "hexagon"] as const;

export type KeychainShape = (typeof KEYCHAIN_SHAPES)[number];

export const KEYCHAIN_SHAPE_LABELS = {
  rounded: "Скруглённый",
  hexagon: "Шестиугольник",
} as const satisfies Record<KeychainShape, string>;

/** Сколько символов имени помещается на брелоке. */
export const KEYCHAIN_TEXT_MAX_LENGTH = 10;

/**
 * Символы, которые есть в Roboto Bold и которые пропускает серверная
 * проверка. Латиница и любая кириллица покрывают имена, цифры — даты и
 * номера, пробел и знаки — двойные имена.
 */
const KEYCHAIN_TEXT_CHAR = /^[A-Za-z0-9 .,'’\-\p{Script=Cyrillic}]$/u;

/** Настраиваемые размеры, имя и форма брелока. */
export type KeychainParams = {
  /** Длина заготовки сверху вниз, мм. */
  length: number;
  /** Ширина в самой широкой части, мм. */
  width: number;
  /** Толщина основы, мм; рельеф имени выступает над ней. */
  thickness: number;
  /** Имя или надпись на лицевой стороне, до 10 символов. */
  text: string;
  /** Форма заготовки: скруглённый прямоугольник или шестиугольник. */
  shapeType: KeychainShape;
};

/** Настраиваемые размеры, форма и рельеф вазы. */
export type VaseParams = {
  /** Высота готовой модели, мм. */
  height: number;
  /** Внешний диаметр в самой широкой части, мм. */
  diameter: number;
  /** Толщина стенки, мм. */
  wall: number;
  /** Пресет силуэта: классическая ваза, конус, цилиндр и т. д. */
  shape: VaseShape;
  /** Тип математического узора на стенке. */
  pattern: VasePattern;
  /** Амплитуда смещения стенки, мм; 0 — ровная поверхность. */
  patternIntensity: number;
  /** Частота повторов узора. */
  patternFrequency: number;
};

/** Значения, с которыми открывается конструктор. */
export const DEFAULT_VASE_PARAMS: VaseParams = {
  height: CONSTRUCTOR_LIMITS.height.defaultValue,
  diameter: CONSTRUCTOR_LIMITS.diameter.defaultValue,
  wall: CONSTRUCTOR_LIMITS.wall.defaultValue,
  shape: "classic",
  pattern: "smooth",
  patternIntensity: CONSTRUCTOR_LIMITS.patternIntensity.defaultValue,
  patternFrequency: CONSTRUCTOR_LIMITS.patternFrequency.defaultValue,
};

/** Значения брелока по умолчанию: имя видно сразу, без пустой заготовки. */
export const DEFAULT_KEYCHAIN_PARAMS: KeychainParams = {
  length: CONSTRUCTOR_LIMITS.length.defaultValue,
  width: CONSTRUCTOR_LIMITS.width.defaultValue,
  thickness: CONSTRUCTOR_LIMITS.thickness.defaultValue,
  text: "Аня",
  shapeType: "rounded",
};

/**
 * Состояние конструктора целиком.
 *
 * Поля обеих моделей лежат рядом, а `model` говорит, какие из них сейчас
 * важны. Так один объект проходит через панель, предпросмотр и API: при
 * переключении вкладки не нужно собирать параметры заново, а сервер может
 * строго проверить только поля выбранной модели.
 */
export type ConstructorParams = { model: ModelType } & VaseParams &
  KeychainParams;

/** Стартовое состояние: открывается ваза, брелок ждёт на своей вкладке. */
export const DEFAULT_CONSTRUCTOR_PARAMS: ConstructorParams = {
  model: "vase",
  ...DEFAULT_VASE_PARAMS,
  ...DEFAULT_KEYCHAIN_PARAMS,
};

/**
 * Имя файла STL для набора параметров.
 *
 * Функция общая для серверного ответа и клиентской запасной подписи ссылки:
 * имя в Content-Disposition и в атрибуте download должно совпадать. Значение
 * wall уже выровнено normalizeVaseParams, поэтому лишние нули не появляются.
 */
export function vaseStlFileName(params: VaseParams): string {
  const patternSuffix = params.pattern === "smooth" ? "" : `-${params.pattern}`;

  return `tridi-vaza-${params.shape}${patternSuffix}-h${params.height}-d${params.diameter}-w${params.wall}.stl`;
}

/**
 * Имя файла STL для брелока.
 *
 * В имя не попадает текст: кириллица в заголовке ответа требует
 * filename*=UTF-8, а запасное имя для старых клиентов всё равно останется
 * латинским. Размеры и форма уже однозначно описывают заготовку.
 */
export function keychainStlFileName(params: KeychainParams): string {
  return `tridi-brelyok-${params.shapeType}-l${params.length}-w${params.width}-t${params.thickness}.stl`;
}

/** Проверка типа модели из формы или API. */
export function isModelType(value: unknown): value is ModelType {
  return (
    typeof value === "string" &&
    (MODEL_TYPES as readonly string[]).includes(value)
  );
}

/** Проверка незнакомого значения из формы, ссылки или API. */
export function isVaseShape(value: unknown): value is VaseShape {
  return (
    typeof value === "string" &&
    (VASE_SHAPES as readonly string[]).includes(value)
  );
}

/** Проверка незнакомого узора из формы или API. */
export function isVasePattern(value: unknown): value is VasePattern {
  return (
    typeof value === "string" &&
    (VASE_PATTERNS as readonly string[]).includes(value)
  );
}

/** Проверка формы брелока из формы или API. */
export function isKeychainShape(value: unknown): value is KeychainShape {
  return (
    typeof value === "string" &&
    (KEYCHAIN_SHAPES as readonly string[]).includes(value)
  );
}

/**
 * Строгая проверка имени для API.
 *
 * Пустая строка допустима: заготовка без надписи — нормальный брелок. Длина
 * считается по символам Unicode, а не по единицам UTF-16, чтобы эмодзи или
 * редкая буква не обходили лимит.
 */
export function isValidKeychainText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Array.from(value).length <= KEYCHAIN_TEXT_MAX_LENGTH &&
    Array.from(value).every((char) => KEYCHAIN_TEXT_CHAR.test(char))
  );
}

/**
 * Очистка имени для поля ввода: убирает символы, которых нет в шрифте, и
 * обрезает строку до лимита. Нормализация не должна молча менять имя на
 * сервере — там isValidKeychainText отклоняет неверные данные, — но в
 * браузере так проще: ввод не ломает предпросмотр.
 */
export function sanitizeKeychainText(value: string): string {
  return Array.from(value)
    .filter((char) => KEYCHAIN_TEXT_CHAR.test(char))
    .slice(0, KEYCHAIN_TEXT_MAX_LENGTH)
    .join("");
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
    height: snap(
      params.height ?? DEFAULT_VASE_PARAMS.height,
      CONSTRUCTOR_LIMITS.height,
    ),
    diameter: snap(
      params.diameter ?? DEFAULT_VASE_PARAMS.diameter,
      CONSTRUCTOR_LIMITS.diameter,
    ),
    wall: snap(
      params.wall ?? DEFAULT_VASE_PARAMS.wall,
      CONSTRUCTOR_LIMITS.wall,
    ),
    shape: isVaseShape(params.shape) ? params.shape : DEFAULT_VASE_PARAMS.shape,
    pattern: isVasePattern(params.pattern)
      ? params.pattern
      : DEFAULT_VASE_PARAMS.pattern,
    patternIntensity: snap(
      params.patternIntensity ?? DEFAULT_VASE_PARAMS.patternIntensity,
      CONSTRUCTOR_LIMITS.patternIntensity,
    ),
    patternFrequency: snap(
      params.patternFrequency ?? DEFAULT_VASE_PARAMS.patternFrequency,
      CONSTRUCTOR_LIMITS.patternFrequency,
    ),
  };
}

/**
 * Проверяет и выравнивает параметры брелока.
 *
 * Как и у вазы, числа зажимаются в границы и встают на шаг слайдера. Текст
 * очищается от символов вне шрифта и обрезается до 10 знаков; сервер до
 * вызова этой функции проверяет исходную строку строго.
 */
export function normalizeKeychainParams(
  params: Partial<KeychainParams>,
): KeychainParams {
  return {
    length: snap(
      params.length ?? DEFAULT_KEYCHAIN_PARAMS.length,
      CONSTRUCTOR_LIMITS.length,
    ),
    width: snap(
      params.width ?? DEFAULT_KEYCHAIN_PARAMS.width,
      CONSTRUCTOR_LIMITS.width,
    ),
    thickness: snap(
      params.thickness ?? DEFAULT_KEYCHAIN_PARAMS.thickness,
      CONSTRUCTOR_LIMITS.thickness,
    ),
    text: sanitizeKeychainText(params.text ?? DEFAULT_KEYCHAIN_PARAMS.text),
    shapeType: isKeychainShape(params.shapeType)
      ? params.shapeType
      : DEFAULT_KEYCHAIN_PARAMS.shapeType,
  };
}

/**
 * Нормализует состояние конструктора вместе с выбранной моделью.
 *
 * Обе группы полей проходят свои проверки: переключение вкладки не должно
 * терять настройки второй модели, а незнакомый `model` безопасно
 * превращается в вазу.
 */
export function normalizeConstructorParams(
  params: Partial<ConstructorParams>,
): ConstructorParams {
  return {
    model: isModelType(params.model)
      ? params.model
      : DEFAULT_CONSTRUCTOR_PARAMS.model,
    ...normalizeVaseParams(params),
    ...normalizeKeychainParams(params),
  };
}
