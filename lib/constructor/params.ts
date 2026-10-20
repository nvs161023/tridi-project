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
 *
 * Светильник живёт в тех же габаритах, что и ваза: отверстие под патрон
 * начинается с 60 мм диаметра, иначе E27 не помещается. Вывеска ограничена
 * кеглем 120 мм и пятнадцатью символами: длинная строка крупным кеглем
 * упирается в лимит ширины 800 мм, и геометрия сама уменьшает буквы.
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
  lampHeight: { min: 60, max: 300, step: 5, defaultValue: 160, decimals: 0 },
  lampDiameter: { min: 60, max: 200, step: 5, defaultValue: 120, decimals: 0 },
  lampWall: { min: 0.8, max: 4, step: 0.1, defaultValue: 1.6, decimals: 1 },
  signFontSize: { min: 20, max: 120, step: 2, defaultValue: 60, decimals: 0 },
  signDepth: { min: 5, max: 40, step: 1, defaultValue: 15, decimals: 0 },
} as const satisfies Record<string, NumericLimit>;

/** Типы моделей, которые умеет собирать конструктор. */
export const MODEL_TYPES = ["vase", "keychain", "lamp", "sign"] as const;

export type ModelType = (typeof MODEL_TYPES)[number];

/** Подписи моделей для вкладок панели параметров. */
export const MODEL_TYPE_LABELS = {
  vase: "Ваза",
  keychain: "Брелок",
  lamp: "Светильник",
  sign: "Вывеска",
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

/**
 * Патроны, под которые строится отверстие в верхней части абажура.
 *
 * Диаметр — наружный диаметр резьбы: E27 — 40 мм, E14 — 28 мм. Отверстие шире
 * на LAMP_SOCKET_CLEARANCE_MM с каждой стороны: после усадки PLA патрон
 * входит плотно, но не проваливается в абажур.
 */
export const LAMP_MOUNTS = ["e27", "e14"] as const;

export type LampMount = (typeof LAMP_MOUNTS)[number];

export const LAMP_MOUNT_LABELS = {
  e27: "E27 · 40 мм",
  e14: "E14 · 28 мм",
} as const satisfies Record<LampMount, string>;

/** Наружный диаметр резьбы патрона, мм. */
export const LAMP_MOUNT_DIAMETERS_MM = {
  e27: 40,
  e14: 28,
} as const satisfies Record<LampMount, number>;

/** Радиальный зазор между патроном и стенкой отверстия, мм. */
export const LAMP_SOCKET_CLEARANCE_MM = 0.3;

/** Ширина канала под светодиодную ленту, мм: другой не бывает. */
export const SIGN_CHANNEL_WIDTHS = [8, 10] as const;

export type SignChannelWidth = (typeof SIGN_CHANNEL_WIDTHS)[number];

/** Сколько символов помещается на вывеске. */
export const SIGN_TEXT_MAX_LENGTH = 15;

/** Сколько символов имени помещается на брелоке. */
export const KEYCHAIN_TEXT_MAX_LENGTH = 10;

/**
 * Символы, которые есть в Roboto Bold и которые пропускает серверная
 * проверка. Латиница и любая кириллица покрывают имена, цифры — даты и
 * номера, пробел и знаки — двойные имена.
 */
const TEXT_CHAR = /^[A-Za-z0-9 .,'’\-\p{Script=Cyrillic}]$/u;

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

/** Настраиваемые размеры абажура: он надевается на патрон сверху. */
export type LampParams = {
  /** Высота от нижнего края до кромки патрона, мм. */
  lampHeight: number;
  /** Наружный диаметр у нижнего края, мм. */
  lampDiameter: number;
  /** Толщина стенки, мм. */
  lampWall: number;
  /** Узор на стенке; гладкий пояс под патрон остаётся ровным. */
  lampPattern: VasePattern;
  /** Тип патрона: от него зависит диаметр отверстия. */
  lampMount: LampMount;
};

/** Настройки вывески: текст, кегль и канал под ленту. */
export type SignParams = {
  /** Надпись на вывеске, до 15 символов; пустая строка допустима. */
  signText: string;
  /** Кегль шрифта, мм: заглавные буквы примерно на треть ниже. */
  signFontSize: number;
  /** Насколько буквы выступают над лицевой плоскостью, мм. */
  signDepth: number;
  /** Ширина канала под ленту: 8 или 10 мм. */
  signChannelWidth: SignChannelWidth;
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

/** Абажур по умолчанию: под E27, с гладкой стенкой. */
export const DEFAULT_LAMP_PARAMS: LampParams = {
  lampHeight: CONSTRUCTOR_LIMITS.lampHeight.defaultValue,
  lampDiameter: CONSTRUCTOR_LIMITS.lampDiameter.defaultValue,
  lampWall: CONSTRUCTOR_LIMITS.lampWall.defaultValue,
  lampPattern: "smooth",
  lampMount: "e27",
};

/** Вывеска по умолчанию: короткое имя бренда и канал 8 мм. */
export const DEFAULT_SIGN_PARAMS: SignParams = {
  signText: "ТРИ ДИ",
  signFontSize: CONSTRUCTOR_LIMITS.signFontSize.defaultValue,
  signDepth: CONSTRUCTOR_LIMITS.signDepth.defaultValue,
  signChannelWidth: 8,
};

/**
 * Состояние конструктора целиком.
 *
 * Поля всех моделей лежат рядом, а `model` говорит, какие из них сейчас
 * важны. Так один объект проходит через панель, предпросмотр и API: при
 * переключении вкладки не нужно собирать параметры заново, а сервер может
 * строго проверить только поля выбранной модели.
 */
export type ConstructorParams = { model: ModelType } & VaseParams &
  KeychainParams &
  LampParams &
  SignParams;

/** Стартовое состояние: открывается ваза, остальные модели ждут на вкладках. */
export const DEFAULT_CONSTRUCTOR_PARAMS: ConstructorParams = {
  model: "vase",
  ...DEFAULT_VASE_PARAMS,
  ...DEFAULT_KEYCHAIN_PARAMS,
  ...DEFAULT_LAMP_PARAMS,
  ...DEFAULT_SIGN_PARAMS,
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

/**
 * Имя файла STL для абажура.
 *
 * Патрон важнее узора: по имени сразу видно, под какой патрон напечатана
 * деталь. Узор добавляется только когда он не гладкий — как у вазы.
 */
export function lampStlFileName(params: LampParams): string {
  const patternSuffix = params.lampPattern === "smooth" ? "" : `-${params.lampPattern}`;

  return `tridi-svetilnik-${params.lampMount}${patternSuffix}-h${params.lampHeight}-d${params.lampDiameter}-w${params.lampWall}.stl`;
}

/**
 * Имя файла STL для вывески.
 *
 * Текст в имя не попадает: кириллица требует filename*=UTF-8, а запасное имя
 * всё равно должно остаться латинским. Кегль, выступ и канал описывают
 * заготовку однозначно.
 */
export function signStlFileName(params: SignParams): string {
  return `tridi-vyveska-s${params.signFontSize}-d${params.signDepth}-c${params.signChannelWidth}.stl`;
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

/** Проверка патрона из формы или API. */
export function isLampMount(value: unknown): value is LampMount {
  return (
    typeof value === "string" && (LAMP_MOUNTS as readonly string[]).includes(value)
  );
}

/** Проверка ширины канала: под ленту подходят только 8 и 10 мм. */
export function isSignChannelWidth(value: unknown): value is SignChannelWidth {
  return value === 8 || value === 10;
}

/**
 * Общая очистка текста для обеих текстовых моделей.
 *
 * Длина считается по символам Unicode, а не по единицам UTF-16: иначе редкая
 * буква вне основной плоскости обходила бы лимит.
 */
function cleanText(value: string, maxLength: number): string {
  return Array.from(value)
    .filter((char) => TEXT_CHAR.test(char))
    .slice(0, maxLength)
    .join("");
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
    Array.from(value).every((char) => TEXT_CHAR.test(char))
  );
}

/**
 * Строгая проверка надписи вывески для API.
 *
 * Правила те же, что у брелока, но лимит — 15 символов. Пустая строка
 * допустима: пустая заготовка с каналом под ленту — нормальная деталь.
 */
export function isValidSignText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Array.from(value).length <= SIGN_TEXT_MAX_LENGTH &&
    Array.from(value).every((char) => TEXT_CHAR.test(char))
  );
}

/**
 * Очистка имени для поля ввода: убирает символы, которых нет в шрифте, и
 * обрезает строку до лимита. Нормализация не должна молча менять имя на
 * сервере — там isValidKeychainText отклоняет неверные данные, — но в
 * браузере так проще: ввод не ломает предпросмотр.
 */
export function sanitizeKeychainText(value: string): string {
  return cleanText(value, KEYCHAIN_TEXT_MAX_LENGTH);
}

/** Очистка надписи вывески для поля ввода: те же символы, лимит 15. */
export function sanitizeSignText(value: string): string {
  return cleanText(value, SIGN_TEXT_MAX_LENGTH);
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
 * Проверяет и выравнивает параметры абажура.
 *
 * Отверстие под патрон строится по типу патрона, поэтому он проверяется
 * отдельно от чисел. Узор берётся из того же набора, что у вазы: отдельная
 * копия списка разошлась бы с профилем и панелью.
 */
export function normalizeLampParams(params: Partial<LampParams>): LampParams {
  return {
    lampHeight: snap(
      params.lampHeight ?? DEFAULT_LAMP_PARAMS.lampHeight,
      CONSTRUCTOR_LIMITS.lampHeight,
    ),
    lampDiameter: snap(
      params.lampDiameter ?? DEFAULT_LAMP_PARAMS.lampDiameter,
      CONSTRUCTOR_LIMITS.lampDiameter,
    ),
    lampWall: snap(
      params.lampWall ?? DEFAULT_LAMP_PARAMS.lampWall,
      CONSTRUCTOR_LIMITS.lampWall,
    ),
    lampPattern: isVasePattern(params.lampPattern)
      ? params.lampPattern
      : DEFAULT_LAMP_PARAMS.lampPattern,
    lampMount: isLampMount(params.lampMount)
      ? params.lampMount
      : DEFAULT_LAMP_PARAMS.lampMount,
  };
}

/**
 * Проверяет и выравнивает параметры вывески.
 *
 * Текст очищается от символов вне шрифта и обрезается до 15 знаков. Ширина
 * канала — только 8 или 10 мм: канал строится под конкретную ленту, и
 * промежуточное значение дало бы люфт или зажим.
 */
export function normalizeSignParams(params: Partial<SignParams>): SignParams {
  return {
    signText: sanitizeSignText(params.signText ?? DEFAULT_SIGN_PARAMS.signText),
    signFontSize: snap(
      params.signFontSize ?? DEFAULT_SIGN_PARAMS.signFontSize,
      CONSTRUCTOR_LIMITS.signFontSize,
    ),
    signDepth: snap(
      params.signDepth ?? DEFAULT_SIGN_PARAMS.signDepth,
      CONSTRUCTOR_LIMITS.signDepth,
    ),
    signChannelWidth: isSignChannelWidth(params.signChannelWidth)
      ? params.signChannelWidth
      : DEFAULT_SIGN_PARAMS.signChannelWidth,
  };
}

/**
 * Нормализует состояние конструктора вместе с выбранной моделью.
 *
 * Каждая группа полей проходит свою проверку: переключение вкладки не должно
 * терять настройки других моделей, а незнакомый `model` безопасно
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
    ...normalizeLampParams(params),
    ...normalizeSignParams(params),
  };
}
