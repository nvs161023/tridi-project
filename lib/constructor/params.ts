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
 *
 * Коробка-органайзер вписана в стол 220 × 220 мм: длина и ширина до 220 мм,
 * высота до 160 мм. Перегородки имеют ту же толщину, что и стенки, поэтому
 * сетка до 8 × 8 остаётся печатной даже на минимальной коробке. Крышка —
 * отдельная деталь с бортиком по периметру; она лежит рядом с корпусом в том же
 * STL, чтобы её можно было напечатать без поддержек.
 *
 * Литофан принимает фотографию, сжатую в браузере до сетки 150 × 150, и
 * превращает яркость пикселей в толщину пластика: тёмные участки дают 3 мм,
 * светлые — 0.8 мм. Размер панели ограничен 200 × 200 мм, чтобы вместе с
 * рамкой она влезала на стол 220 × 220; толщины 0.4–2 и 1–6 мм оставляют
 * запас на настройку контраста, но максимум всегда больше минимума.
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
  lampBaseHeight: { min: 30, max: 140, step: 5, defaultValue: 60, decimals: 0 },
  signFontSize: { min: 20, max: 120, step: 2, defaultValue: 60, decimals: 0 },
  // Меньше 11 мм полость буквы не вмещает ленту: 11 − 2 мм лица = 9 мм канала.
  signDepth: { min: 11, max: 40, step: 1, defaultValue: 18, decimals: 0 },
  signLetterGap: { min: 2, max: 20, step: 1, defaultValue: 6, decimals: 0 },
  // Сколько букв печатается одним блоком: больше пяти деталь неудобно вешать.
  signBlockSize: { min: 1, max: 5, step: 1, defaultValue: 3, decimals: 0 },
  boxLength: { min: 60, max: 220, step: 5, defaultValue: 140, decimals: 0 },
  boxWidth: { min: 60, max: 220, step: 5, defaultValue: 100, decimals: 0 },
  boxHeight: { min: 30, max: 160, step: 5, defaultValue: 60, decimals: 0 },
  boxWall: { min: 0.8, max: 3, step: 0.1, defaultValue: 1.6, decimals: 1 },
  boxGrid: { min: 1, max: 8, step: 1, defaultValue: 2, decimals: 0 },
  lithophaneWidth: { min: 40, max: 200, step: 5, defaultValue: 120, decimals: 0 },
  lithophaneHeight: {
    min: 40,
    max: 200,
    step: 5,
    defaultValue: 80,
    decimals: 0,
  },
  lithophaneMinThickness: {
    min: 0.4,
    max: 2,
    step: 0.1,
    defaultValue: 0.8,
    decimals: 1,
  },
  lithophaneMaxThickness: {
    min: 1,
    max: 6,
    step: 0.1,
    defaultValue: 3,
    decimals: 1,
  },
} as const satisfies Record<string, NumericLimit>;

/** Типы моделей, которые умеет собирать конструктор. */
export const MODEL_TYPES = [
  "vase",
  "keychain",
  "lamp",
  "sign",
  "box",
  "lithophane",
] as const;

export type ModelType = (typeof MODEL_TYPES)[number];

/** Подписи моделей для вкладок панели параметров. */
export const MODEL_TYPE_LABELS = {
  vase: "Ваза",
  keychain: "Брелок",
  lamp: "Светильник",
  sign: "Вывеска",
  box: "Коробки",
  lithophane: "Литофан",
} as const satisfies Record<ModelType, string>;

/**
 * Пресеты силуэта. Значение — часть состояния модели, а не размер: профиль
 * строится в lib/constructor/vase-profile.ts по этим идентификаторам.
 *
 * square и octagon — не просто другой силуэт: их сечение в плане
 * превращается в правильный многоугольник в lib/constructor/vase-geometry.ts.
 * Профиль по высоте остаётся плавным, а радиус зависит от угла, поэтому
 * квадратная ваза сохраняет толщину стенки на гранях и в углах.
 */
export const VASE_SHAPES = [
  "classic",
  "cone",
  "cylinder",
  "hourglass",
  "teardrop",
  "double_bulb",
  "square",
  "octagon",
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
  square: "Квадратная",
  octagon: "Восьмигранная",
} as const satisfies Record<VaseShape, string>;

/**
 * Математические узоры на стенке.
 *
 * smooth — ровная поверхность; spiral — косая спираль; ribs — вертикальные
 * рёбра; waves — горизонтальные волны; honeycomb — шестиугольные соты из трёх
 * синусоид, повёрнутых на 60°; scales — перекрывающиеся чешуйки из синуса и
 * косинуса с разными фазами. Узор не добавляет вершины: он смещает
 * существующие точки LatheGeometry, поэтому число треугольников не меняется,
 * а наружная и внутренняя стенки сдвигаются на одну величину — толщина
 * остаётся прежней.
 */
export const VASE_PATTERNS = [
  "smooth",
  "spiral",
  "ribs",
  "waves",
  "honeycomb",
  "scales",
] as const;

export type VasePattern = (typeof VASE_PATTERNS)[number];

/** Подписи узоров для панели параметров. */
export const VASE_PATTERN_LABELS = {
  smooth: "Гладкая",
  spiral: "Спираль",
  ribs: "Рёбра",
  waves: "Волны",
  honeycomb: "Соты",
  scales: "Чешуйки",
} as const satisfies Record<VasePattern, string>;

/**
 * Силуэты брелока.
 *
 * Встроенные формы — SVG-контуры из lib/constructor/keychain-shapes.ts: жетон,
 * шестигранник, животные, транспорт и символы. `custom` означает загруженный
 * пользователем SVG из `customSvgData`. Прежние значения `rounded` и `hexagon`
 * остаются совместимыми: `rounded` нормализуется в `dog_tag`, а `hexagon`
 * остался отдельным силуэтом.
 *
 * Ушко под кольцо не входит в SVG: geometry добавляет его в верхнюю точку
 * контура, поэтому новая форма не может остаться без отверстия.
 */
export const KEYCHAIN_SHAPES = [
  "dog_tag",
  "hexagon",
  "cat",
  "dog",
  "car",
  "gamepad",
  "heart",
  "star",
  "rocket",
  "fish",
  "house",
  "crown",
  "mushroom",
  "lightning",
  "custom",
] as const;

export type KeychainShape = (typeof KEYCHAIN_SHAPES)[number];

export const KEYCHAIN_SHAPE_LABELS = {
  dog_tag: "Жетон",
  hexagon: "Шестиугольник",
  cat: "Кошка",
  dog: "Собака",
  car: "Машина",
  gamepad: "Геймпад",
  heart: "Сердце",
  star: "Звезда",
  rocket: "Ракета",
  fish: "Рыба",
  house: "Домик",
  crown: "Корона",
  mushroom: "Гриб",
  lightning: "Молния",
  custom: "Свой SVG",
} as const satisfies Record<KeychainShape, string>;

/** Предел размера загруженного SVG: 200 КБ хватает логотипу с контурами. */
export const KEYCHAIN_SVG_MAX_LENGTH = 200_000;

/**
 * Прежнее значение формы для совместимости со старыми запросами.
 * `rounded` был скруглённым прямоугольником — это и есть жетон.
 */
export function normalizeKeychainShapeAlias(value: unknown): KeychainShape | null {
  if (value === "rounded") {
    return "dog_tag";
  }

  return isKeychainShape(value) ? value : null;
}

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

/**
 * Формы основания светильника.
 *
 * Основание — та же деталь, что и абажур, только снизу: в нём живёт патрон,
 * по его верхней кромке абажур центруется посадочным кольцом. Круглое
 * основание печатается быстрее всех, квадратное и шестигранное дают ровные
 * грани и стоят устойчивее.
 */
export const LAMP_BASE_SHAPES = ["round", "square", "hexagon"] as const;

export type LampBaseShape = (typeof LAMP_BASE_SHAPES)[number];

export const LAMP_BASE_SHAPE_LABELS = {
  round: "Круглая",
  square: "Квадратная",
  hexagon: "Шестигранная",
} as const satisfies Record<LampBaseShape, string>;

/**
 * Что выгружать из светильника: основание, абажур или обе детали сразу.
 *
 * Детали печатаются по отдельности — абажур ставится на основание уже после
 * сборки патрона, — поэтому у каждой своя кнопка скачивания.
 */
export const LAMP_PARTS = ["base", "shade", "all"] as const;

export type LampPart = (typeof LAMP_PARTS)[number];

/** Подписи кнопок деталей светильника: по ним клиент строит список скачиваний. */
export const LAMP_PART_LABELS = {
  base: "Основание",
  shade: "Абажур",
  all: "Обе детали",
} as const satisfies Record<LampPart, string>;

/** Ширина канала под светодиодную ленту, мм: другой не бывает. */
export const SIGN_CHANNEL_WIDTHS = [8, 10] as const;

export type SignChannelWidth = (typeof SIGN_CHANNEL_WIDTHS)[number];

/**
 * Детали блока вывески.
 *
 * Блок печатается двумя деталями: `face` — буквы на общей плите с шипом и
 * пазом, `cover` — задняя крышка с бортиком, который входит в камеру буквы.
 * Ключи латинские: они попадают в имя STL-файла, поэтому кириллица в заголовок
 * ответа не просачивается.
 */
export const SIGN_PARTS = ["face", "cover"] as const;

export type SignPart = (typeof SIGN_PARTS)[number];

/** Подписи деталей для панели и имён файлов. */
export const SIGN_PART_LABELS = {
  face: "Лицо",
  cover: "Крышка",
} as const satisfies Record<SignPart, string>;

/**
 * Шрифты вывески.
 *
 * Все три файла лежат в public/fonts в legacy-формате three.js и покрывают
 * кириллицу: sans-bold — Roboto Bold (тот же, что у брелока), sans — Roboto
 * Regular, serif — PT Serif Bold. Ключи короткие и латинские: они попадают в
 * имя STL-файла, поэтому кириллица в заголовок ответа не просачивается.
 */
export const SIGN_FONTS = ["sans-bold", "sans", "serif"] as const;

export type SignFont = (typeof SIGN_FONTS)[number];

/** Подписи шрифтов для панели параметров: имена наборов не переводятся. */
export const SIGN_FONT_LABELS = {
  "sans-bold": "Roboto Bold",
  sans: "Roboto Regular",
  serif: "PT Serif Bold",
} as const satisfies Record<SignFont, string>;

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

/** Настраиваемые размеры, имя, силуэт и NFC-углубление брелока. */
export type KeychainParams = {
  /** Длина заготовки сверху вниз, мм; ушко входит в этот габарит. */
  length: number;
  /** Ширина в самой широкой части, мм. */
  width: number;
  /** Толщина основы, мм; рельеф имени выступает над ней. */
  thickness: number;
  /** Имя или надпись на лицевой стороне, до 10 символов. */
  text: string;
  /** Выбранный силуэт: встроенный SVG или загруженный пользователем. */
  keychainShape: KeychainShape;
  /**
   * Разметка пользовательского SVG. Хранится строкой, потому что файл
   * разбирается и в браузере, и на сервере одним парсером без DOM.
   */
  customSvgData: string;
  /** Вырезать с обратной стороны карман 25 × 25 мм под NFC-метку. */
  nfcEnabled: boolean;
  /**
   * Прежнее имя той же формы. Оставлено, пока панель параметров обновляется:
   * нормализация всегда держит `shapeType === keychainShape`.
   *
   * @deprecated используйте `keychainShape`.
   */
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

/**
 * Настраиваемые размеры светильника: основание с патроном и абажур.
 *
 * Обе детали строятся из одних параметров, поэтому гнездо под патрон и
 * посадочное кольцо совпадают без подгонки.
 */
export type LampParams = {
  /** Высота абажура от нижнего края до кромки патрона, мм. */
  lampHeight: number;
  /** Наружный диаметр абажура у нижнего края, мм. */
  lampDiameter: number;
  /** Толщина стенки абажура, мм. */
  lampWall: number;
  /** Форма основания: круглая, квадратная или шестигранная. */
  lampBaseShape: LampBaseShape;
  /** Высота основания от стола до посадочного кольца, мм. */
  lampBaseHeight: number;
  /** Узор на стенке абажура; гладкий пояс под патрон остаётся ровным. */
  lampPattern: VasePattern;
  /** Тип патрона: от него зависит диаметр отверстия в абажуре и основании. */
  lampMount: LampMount;
};

/**
 * Настройки вывески: надпись, кегль, глубина, канал под ленту и блоки.
 *
 * Надпись делится на блоки по signBlockSize букв. Каждый блок печатается
 * двумя деталями: лицо (объёмные полые буквы на общей плите) и задняя крышка.
 * Плита несёт шип и паз для стыка с соседними блоками, а на стыке остаётся
 * сквозной канал под ленту.
 */
export type SignParams = {
  /** Надпись на вывеске, до 15 символов; пустая строка означает «нет букв». */
  signText: string;
  /** Шрифт надписи: у каждого своя ширина штриха и рисунок букв. */
  signFont: SignFont;
  /** Кегль шрифта, мм: заглавные буквы примерно на треть ниже. */
  signFontSize: number;
  /** Общая толщина буквы от лица до задней плоскости, мм. */
  signDepth: number;
  /** Ширина канала под ленту: 8 или 10 мм. */
  signChannelWidth: SignChannelWidth;
  /** Зазор между соседними буквами при сборке строки, мм. */
  signLetterGap: number;
  /** Сколько букв печатается одним блоком: от 1 до 5. */
  signBlockSize: number;
  /** Общее основание под буквами блока: плита вместо узкой рейки. */
  signBaseMount: boolean;
};


/**
 * Коробка-органайзер: наружные габариты, стенка, сетка ячеек и крышка.
 *
 * Поля с префиксом `box` не пересекаются с длиной брелока и высотой вазы:
 * в общем состоянии конструктора у каждой модели свои значения, поэтому
 * переключение вкладки не переносит 140 мм коробки в 60 мм брелока.
 */
export type BoxParams = {
  /** Наружная длина по X, мм. */
  boxLength: number;
  /** Наружная ширина по Y, мм. */
  boxWidth: number;
  /** Высота стенок от стола, мм. */
  boxHeight: number;
  /** Толщина наружных стенок и перегородок, мм. */
  boxWall: number;
  /**
   * Ширины ячеек по длине, мм. Массив задаёт пропорции: свободное место
   * делится между ячейками, а перегородки остаются ровно `boxWall`. Поэтому
   * сумма может не совпадать с внутренним размером — коробку масштабируют
   * слайдеры габаритов, а не набор ячеек.
   */
  cellsX: number[];
  /** Высоты ячеек по ширине, мм: те же правила, что у `cellsX`. */
  cellsY: number[];
  /**
   * Количество ячеек по длине. Выводится из `cellsX.length`; отдельное поле
   * нужно старым слайдерам и имени файла.
   */
  gridX: number;
  /** Количество ячеек по ширине; выводится из `cellsY.length`. */
  gridY: number;
  /** Печатать ли отдельную крышку с бортиком. */
  hasLid: boolean;
};

/** Минимальная и максимальная ширина одной ячейки, мм. */
export const BOX_CELL_MIN_MM = 5;
export const BOX_CELL_MAX_MM = 220;

/** Пресеты коробки: разные наборы ячеек под типовые задачи. */
export const BOX_PRESET_IDS = ["tools", "batteries", "free"] as const;

export type BoxPresetId = (typeof BOX_PRESET_IDS)[number];

export const BOX_PRESET_LABELS = {
  tools: "Под инструменты",
  batteries: "Под батарейки",
  free: "Свободная сетка",
} as const satisfies Record<BoxPresetId, string>;

/**
 * Сторона сетки изображения. Браузер сжимает фотографию до 150 × 150 сразу
 * после выбора файла: полный кадр в состоянии конструктора заставил бы
 * React и three.js пересобирать миллионы вершин на каждое движение слайдера.
 */
export const LITHOPHANE_RESOLUTION = 150;

/** Число пикселей в сжатом изображении: 150 × 150. */
export const LITHOPHANE_PIXEL_COUNT = LITHOPHANE_RESOLUTION ** 2;

/**
 * Литофан: панель с рельефом фотографии и рамкой по периметру.
 *
 * Поля с префиксом `lithophane` не пересекаются с шириной брелока и высотой
 * вазы в общем объекте ConstructorParams. Яркость хранится построчно сверху
 * вниз, по 150 значений в строке: 0 — чёрный пиксель (толстый пластик),
 * 255 — белый (тонкий). Массив передаётся в API как есть, без повторного
 * декодирования картинки на сервере.
 */
export type LithophaneParams = {
  /** Ширина панели с рамкой, мм. */
  lithophaneWidth: number;
  /** Высота панели с рамкой, мм. */
  lithophaneHeight: number;
  /** Толщина светлых участков, мм. */
  lithophaneMinThickness: number;
  /** Толщина тёмных участков и рамки, мм. */
  lithophaneMaxThickness: number;
  /** Яркость 22 500 пикселей: 150 × 150, значения 0–255. */
  lithophaneBrightness: number[];
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
  keychainShape: "dog_tag",
  customSvgData: "",
  nfcEnabled: false,
  shapeType: "dog_tag",
};

/** Светильник по умолчанию: под E27, круглое основание, гладкая стенка. */
export const DEFAULT_LAMP_PARAMS: LampParams = {
  lampHeight: CONSTRUCTOR_LIMITS.lampHeight.defaultValue,
  lampDiameter: CONSTRUCTOR_LIMITS.lampDiameter.defaultValue,
  lampWall: CONSTRUCTOR_LIMITS.lampWall.defaultValue,
  lampBaseShape: "round",
  lampBaseHeight: CONSTRUCTOR_LIMITS.lampBaseHeight.defaultValue,
  lampPattern: "smooth",
  lampMount: "e27",
};

/** Вывеска по умолчанию: короткое имя бренда, Roboto Bold, канал 8 мм, блоки по три буквы. */
export const DEFAULT_SIGN_PARAMS: SignParams = {
  signText: "ТРИ ДИ",
  signFont: "sans-bold",
  signFontSize: CONSTRUCTOR_LIMITS.signFontSize.defaultValue,
  signDepth: CONSTRUCTOR_LIMITS.signDepth.defaultValue,
  signChannelWidth: 8,
  signLetterGap: CONSTRUCTOR_LIMITS.signLetterGap.defaultValue,
  signBlockSize: CONSTRUCTOR_LIMITS.signBlockSize.defaultValue,
  signBaseMount: true,
};


/**
 * Коробка по умолчанию: 140 × 100 × 60 мм, сетка 2 × 2 и крышка.
 * Такой органайзер сразу показывает и стенки, и перегородки, и обе детали.
 */
export const DEFAULT_BOX_PARAMS: BoxParams = {
  boxLength: CONSTRUCTOR_LIMITS.boxLength.defaultValue,
  boxWidth: CONSTRUCTOR_LIMITS.boxWidth.defaultValue,
  boxHeight: CONSTRUCTOR_LIMITS.boxHeight.defaultValue,
  boxWall: CONSTRUCTOR_LIMITS.boxWall.defaultValue,
  cellsX: [68, 68],
  cellsY: [48, 48],
  gridX: 2,
  gridY: 2,
  hasLid: true,
};

/**
 * Готовые коробки под три сценария.
 *
 * «Инструменты» — длинные ячейки под отвёртки и свёрла; «Батарейки» — шесть
 * узких отделений в ряд под AA/AAA; «Свободная сетка» — широкая ячейка слева
 * и две мелкие справа. Габариты тоже входят в пресет: иначе набор ячеек
 * пришлось бы вручную растягивать слайдерами, чтобы он стал удобным.
 */
export const BOX_PRESETS: Record<BoxPresetId, BoxParams> = {
  tools: {
    boxLength: 220,
    boxWidth: 160,
    boxHeight: 60,
    boxWall: 1.6,
    cellsX: [90, 45, 45],
    cellsY: [70, 70],
    gridX: 3,
    gridY: 2,
    hasLid: true,
  },
  batteries: {
    boxLength: 160,
    boxWidth: 120,
    boxHeight: 50,
    boxWall: 1.2,
    cellsX: [16, 16, 16, 16, 16, 16],
    cellsY: [50, 50],
    gridX: 6,
    gridY: 2,
    hasLid: true,
  },
  free: {
    boxLength: 180,
    boxWidth: 180,
    boxHeight: 60,
    boxWall: 1.6,
    cellsX: [30, 60, 30],
    cellsY: [45, 45, 45],
    gridX: 3,
    gridY: 3,
    hasLid: false,
  },
};

/** Нормализованные параметры пресета: те же границы, что у слайдеров. */
export function boxPresetParams(preset: BoxPresetId): BoxParams {
  return normalizeBoxParams(BOX_PRESETS[preset]);
}

/**
 * Демонстрационный рельеф до загрузки фотографии.
 *
 * Радиальные кольца с мягкой виньеткой показывают, как яркость превращается
 * в толщину: панель не выглядит пустой, а пользователь сразу видит рельеф.
 * Массив создаётся один раз при импорте модуля и дальше не меняется.
 */
function createDemoLithophaneBrightness(): number[] {
  const result: number[] = [];
  const center = (LITHOPHANE_RESOLUTION - 1) / 2;

  for (let row = 0; row < LITHOPHANE_RESOLUTION; row += 1) {
    for (let column = 0; column < LITHOPHANE_RESOLUTION; column += 1) {
      const x = (column - center) / center;
      const y = (row - center) / center;
      const radius = Math.sqrt(x * x + y * y);
      const rings = 0.5 + 0.5 * Math.sin(radius * 7 * Math.PI);
      const vignette = Math.max(0, 1 - radius * 0.55);
      const value = 28 + vignette * (120 + 107 * rings);

      result.push(Math.round(Math.min(255, Math.max(0, value))));
    }
  }

  return result;
}

/**
 * Литофан по умолчанию: 120 × 80 мм, рельеф 0.8–3 мм и демонстрационная
 * картинка. После загрузки фотографии массив заменяется яркостью кадра.
 */
export const DEFAULT_LITHOPHANE_PARAMS: LithophaneParams = {
  lithophaneWidth: CONSTRUCTOR_LIMITS.lithophaneWidth.defaultValue,
  lithophaneHeight: CONSTRUCTOR_LIMITS.lithophaneHeight.defaultValue,
  lithophaneMinThickness:
    CONSTRUCTOR_LIMITS.lithophaneMinThickness.defaultValue,
  lithophaneMaxThickness:
    CONSTRUCTOR_LIMITS.lithophaneMaxThickness.defaultValue,
  lithophaneBrightness: createDemoLithophaneBrightness(),
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
  SignParams &
  BoxParams &
  LithophaneParams;

/** Стартовое состояние: открывается ваза, остальные модели ждут на вкладках. */
export const DEFAULT_CONSTRUCTOR_PARAMS: ConstructorParams = {
  model: "vase",
  ...DEFAULT_VASE_PARAMS,
  ...DEFAULT_KEYCHAIN_PARAMS,
  ...DEFAULT_LAMP_PARAMS,
  ...DEFAULT_SIGN_PARAMS,
  ...DEFAULT_BOX_PARAMS,
  ...DEFAULT_LITHOPHANE_PARAMS,
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
  const nfcSuffix = params.nfcEnabled ? "-nfc" : "";

  return `tridi-brelyok-${params.keychainShape}-l${params.length}-w${params.width}-t${params.thickness}${nfcSuffix}.stl`;
}

/**
 * Имя файла STL для светильника.
 *
 * Патрон важнее узора: по имени сразу видно, под какой патрон напечатана
 * деталь. Форма основания и суффикс детали (`baza` / `abazhur`) позволяют
 * хранить обе части рядом, не путая их между собой.
 */
export function lampStlFileName(params: LampParams, part: LampPart = "all"): string {
  const patternSuffix = params.lampPattern === "smooth" ? "" : `-${params.lampPattern}`;
  const partSuffix = part === "all" ? "" : `-${part === "base" ? "baza" : "abazhur"}`;

  return `tridi-svetilnik-${params.lampBaseShape}-${params.lampMount}${patternSuffix}-h${params.lampHeight}-d${params.lampDiameter}-w${params.lampWall}${partSuffix}.stl`;
}

/**
 * Латинская транслитерация надписи для имени файла.
 *
 * Кириллица в `Content-Disposition` требует `filename*=UTF-8`, а запасное имя
 * всё равно должно остаться латинским, поэтому надпись переводится посимвольно.
 * Таблица — практическая транслитерация без диакритики: «ё» → e, «й» → i,
 * «ъ» и «ь» пропускаются. Знаки препинания и эмодзи в имя не попадают, поэтому
 * файл остаётся валидным при любой надписи.
 */
const SIGN_FILE_TRANSLIT: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

/** Латинский слаг надписи: пустая надпись превращается в «nadpis». */
function signFileSlug(signText: string): string {
  const letters: string[] = [];

  for (const char of Array.from(signText.toLowerCase())) {
    const latin = /[a-z0-9]/.test(char) ? char : SIGN_FILE_TRANSLIT[char];

    if (latin) {
      letters.push(latin);
    }
  }

  const slug = letters.join("").slice(0, 16);

  return slug.length > 0 ? slug : "nadpis";
}

/**
 * Имя файла STL для блока вывески.
 *
 * В имени — надпись латиницей, номер блока с единицы и деталь: `face` (лицо
 * с буквами и плитой) или `cover` (задняя крышка). В API блок адресуется с
 * нуля, но человеку привычнее считать блоки с первого.
 */
export function signStlFileName(
  params: SignParams,
  blockIndex: number,
  part: SignPart,
): string {
  return `tridi-vyveska-${signFileSlug(params.signText)}-b${blockIndex + 1}-${part}.stl`;
}


/**
 * Имя файла STL для коробки.
 *
 * Сетка записывается как `g2x3`, крышка — суффиксом `kryshka`: по имени видно,
 * лежит ли в файле вторая деталь. Толщина стенки важна для печати, поэтому
 * входит в имя как `t1.6`; значения уже выровнены normalizeBoxParams.
 */
export function boxStlFileName(params: BoxParams): string {
  const lidSuffix = params.hasLid ? "-kryshka" : "";

  return `tridi-korobka-l${params.boxLength}-w${params.boxWidth}-h${params.boxHeight}-t${params.boxWall}-g${params.gridX}x${params.gridY}${lidSuffix}.stl`;
}

/**
 * Имя файла STL для литофана.
 *
 * В имени только размеры и диапазон толщин: исходное имя фотографии может
 * содержать кириллицу, а Content-Disposition должен оставаться простым ASCII.
 * Значения уже выровнены normalizeLithophaneParams, поэтому лишних нулей нет.
 */
export function lithophaneStlFileName(params: LithophaneParams): string {
  return `tridi-litofan-w${params.lithophaneWidth}-h${params.lithophaneHeight}-t${params.lithophaneMinThickness}-${params.lithophaneMaxThickness}.stl`;
}

/** Проверка типа модели из формы или API. */
export function isModelType(value: unknown): value is ModelType {
  return (
    typeof value === "string" &&
    (MODEL_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Проверка сжатого изображения: ровно 150 × 150 целых значений 0–255.
 *
 * Строгая проверка нужна и API, и нормализации: массив другого размера дал бы
 * дыры в сетке, а дробное или отрицательное число — неверную толщину.
 */
export function isLithophaneBrightness(value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length !== LITHOPHANE_PIXEL_COUNT) {
    return false;
  }

  // Цикл по индексам, а не every(): разреженный массив every() пропускает
  // дыры, и undefined попал бы в геометрию как NaN.
  for (let index = 0; index < LITHOPHANE_PIXEL_COUNT; index += 1) {
    const pixel = value[index];

    if (
      typeof pixel !== "number" ||
      !Number.isInteger(pixel) ||
      pixel < 0 ||
      pixel > 255
    ) {
      return false;
    }
  }

  return true;
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
 * Безопасная строка SVG: размер в пределах лимита и без исполняемых тегов.
 *
 * Разметка не вставляется в DOM через innerHTML — из неё только читаются
 * числа, — но скрипты и внешние документы отклоняются заранее: API не должен
 * принимать файл, который выглядит как активная страница.
 */
const CUSTOM_SVG_FORBIDDEN =
  /<\s*(script|iframe|object|embed|foreignObject)\b|javascript:/i;

/** Есть ли в разметке хотя бы один поддерживаемый контур. */
const CUSTOM_SVG_CONTOUR = /<(path|polygon|rect|circle|ellipse)\b/i;

export function isCustomSvgData(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= KEYCHAIN_SVG_MAX_LENGTH &&
    !CUSTOM_SVG_FORBIDDEN.test(value)
  );
}

/** Проверка, что из SVG действительно получится контур. */
export function hasDrawableSvgData(value: string): boolean {
  return CUSTOM_SVG_CONTOUR.test(value);
}

/**
 * Проверка массива ячеек коробки.
 *
 * Каждая ячейка — конечное число от 5 до 220 мм, ячеек от 1 до 8. Массив
 * задаёт пропорции, но отрицательная или нулевая ширина сломала бы деление
 * свободного места, поэтому нули отклоняются, а не подменяются.
 */
export function isBoxCells(value: unknown): value is number[] {
  if (
    !Array.isArray(value) ||
    value.length < CONSTRUCTOR_LIMITS.boxGrid.min ||
    value.length > CONSTRUCTOR_LIMITS.boxGrid.max
  ) {
    return false;
  }

  for (let index = 0; index < value.length; index += 1) {
    const cell = value[index];

    if (
      typeof cell !== "number" ||
      !Number.isFinite(cell) ||
      cell < BOX_CELL_MIN_MM ||
      cell > BOX_CELL_MAX_MM
    ) {
      return false;
    }
  }

  return true;
}

/** Проверка патрона из формы или API. */
export function isLampMount(value: unknown): value is LampMount {
  return (
    typeof value === "string" && (LAMP_MOUNTS as readonly string[]).includes(value)
  );
}

/** Проверка формы основания светильника из формы или API. */
export function isLampBaseShape(value: unknown): value is LampBaseShape {
  return (
    typeof value === "string" &&
    (LAMP_BASE_SHAPES as readonly string[]).includes(value)
  );
}

/** Проверка детали светильника: основание, абажур или обе сразу. */
export function isLampPart(value: unknown): value is LampPart {
  return (
    typeof value === "string" && (LAMP_PARTS as readonly string[]).includes(value)
  );
}

/** Проверка ширины канала: под ленту подходят только 8 и 10 мм. */
export function isSignChannelWidth(value: unknown): value is SignChannelWidth {
  return value === 8 || value === 10;
}

/** Проверка шрифта вывески из формы или API. */
export function isSignFont(value: unknown): value is SignFont {
  return typeof value === "string" && (SIGN_FONTS as readonly string[]).includes(value);
}

/** Проверка детали блока вывески из запроса: «face» или «cover». */
export function isSignPart(value: unknown): value is SignPart {
  return typeof value === "string" && (SIGN_PARTS as readonly string[]).includes(value);
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
 * допустима в форме: в предпросмотре это просто пустая строка. STL из пустой
 * надписи не собрать — букв нет, — поэтому API отвечает на неё отказом.
 */
export function isValidSignText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Array.from(value).length <= SIGN_TEXT_MAX_LENGTH &&
    Array.from(value).every((char) => TEXT_CHAR.test(char))
  );
}

/**
 * Буквы надписи: по одной на каждый непробельный символ.
 *
 * `index` — позиция буквы в надписи без пробелов: 0 — первая. По ней блоки
 * делятся на группы, поэтому список в интерфейсе, имена файлов и сборка
 * геометрии не могут разойтись: все берут буквы отсюда. Пробелы пропускаются —
 * у них нет контуров, и отдельной детали для них не бывает.
 */
export function listSignLetters(signText: string): { index: number; char: string }[] {
  return Array.from(signText.trim())
    .filter((char) => char !== " ")
    .map((char, index) => ({ char, index }));
}

/**
 * Блоки надписи: буквы, которые печатаются одной деталью.
 *
 * Размер блока приходит из signBlockSize и зажат в 1–5, поэтому последний блок
 * может быть короче остальных. Номер блока (`index`) уходит в API как
 * `blockIndex` — с нуля, как и номера букв. Пустая надпись даёт пустой список:
 * собирать блоки не из чего.
 */
export function listSignBlocks(
  signText: string,
  blockSize: number,
): { index: number; letters: { index: number; char: string }[] }[] {
  const letters = listSignLetters(signText);
  const size = Math.max(1, Math.round(blockSize));
  const blocks: { index: number; letters: { index: number; char: string }[] }[] = [];

  for (let start = 0; start < letters.length; start += size) {
    blocks.push({
      index: blocks.length,
      letters: letters.slice(start, start + size),
    });
  }

  return blocks;
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
function resolveKeychainShape(params: Partial<KeychainParams>): KeychainShape {
  const fromKeychain = normalizeKeychainShapeAlias(params.keychainShape);
  const fromLegacy = normalizeKeychainShapeAlias(params.shapeType);

  // Панель пока меняет только старое поле shapeType, а normalizeConstructorParams
  // получает весь объект с прежним keychainShape. Поэтому при расхождении
  // побеждает shapeType: это признак свежего выбора в интерфейсе. Запросы API
  // передают согласованные поля (или только keychainShape).
  if (fromLegacy && fromKeychain && fromLegacy !== fromKeychain) {
    return fromLegacy;
  }

  return fromKeychain ?? fromLegacy ?? DEFAULT_KEYCHAIN_PARAMS.keychainShape;
}

/**
 * Проверяет и выравнивает параметры брелока.
 *
 * Как и у вазы, числа зажимаются в границы и встают на шаг слайдера. Текст
 * очищается от символов вне шрифта и обрезается до 10 знаков; сервер до
 * вызова этой функции проверяет исходную строку строго. Силуэт и его прежний
 * псевдоним всегда совпадают, SVG ограничен размером и безопасными тегами,
 * а NFC-флаг принимается только настоящим boolean.
 */
export function normalizeKeychainParams(
  params: Partial<KeychainParams>,
): KeychainParams {
  const keychainShape = resolveKeychainShape(params);
  const customSvgData = isCustomSvgData(params.customSvgData)
    ? params.customSvgData.trim()
    : "";

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
    keychainShape,
    customSvgData,
    nfcEnabled:
      typeof params.nfcEnabled === "boolean"
        ? params.nfcEnabled
        : DEFAULT_KEYCHAIN_PARAMS.nfcEnabled,
    shapeType: keychainShape,
  };
}

/**
 * Проверяет и выравнивает параметры светильника.
 *
 * Отверстие под патрон строится по типу патрона, поэтому он проверяется
 * отдельно от чисел. Узор берётся из того же набора, что у вазы: отдельная
 * копия списка разошлась бы с профилем и панелью. Форма основания — из своего
 * набора: у вазы и светильника общего в нём только слово «форма».
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
    lampBaseShape: isLampBaseShape(params.lampBaseShape)
      ? params.lampBaseShape
      : DEFAULT_LAMP_PARAMS.lampBaseShape,
    lampBaseHeight: snap(
      params.lampBaseHeight ?? DEFAULT_LAMP_PARAMS.lampBaseHeight,
      CONSTRUCTOR_LIMITS.lampBaseHeight,
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
 * промежуточное значение дало бы люфт или зажим. Размер блока выравнивается по
 * шагу 1 и зажимается в 1–5, а общее основание принимается только как boolean.
 */
export function normalizeSignParams(params: Partial<SignParams>): SignParams {
  return {
    signText: sanitizeSignText(params.signText ?? DEFAULT_SIGN_PARAMS.signText),
    signFont: isSignFont(params.signFont)
      ? params.signFont
      : DEFAULT_SIGN_PARAMS.signFont,
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
    signLetterGap: snap(
      params.signLetterGap ?? DEFAULT_SIGN_PARAMS.signLetterGap,
      CONSTRUCTOR_LIMITS.signLetterGap,
    ),
    signBlockSize: snap(
      params.signBlockSize ?? DEFAULT_SIGN_PARAMS.signBlockSize,
      CONSTRUCTOR_LIMITS.signBlockSize,
    ),
    signBaseMount:
      typeof params.signBaseMount === "boolean"
        ? params.signBaseMount
        : DEFAULT_SIGN_PARAMS.signBaseMount,
  };
}

/**
 * Проверяет и выравнивает параметры коробки.
 *
 * Числа зажимаются в границы слайдеров, сетка — целые ячейки от 1 до 8.
 * `hasLid` принимается только булевым значением: строка «false» из формы не
 * должна неожиданно включать крышку. Остальные типы заменяются значением по
 * умолчанию.
 */
export function normalizeBoxParams(params: Partial<BoxParams>): BoxParams {
  const limit = CONSTRUCTOR_LIMITS.boxGrid;
  const rawCellsX = Array.isArray(params.cellsX) ? params.cellsX : null;
  const rawCellsY = Array.isArray(params.cellsY) ? params.cellsY : null;
  const gridX = Math.round(
    clamp(
      params.gridX ?? rawCellsX?.length ?? DEFAULT_BOX_PARAMS.gridX,
      limit.min,
      limit.max,
    ),
  );
  const gridY = Math.round(
    clamp(
      params.gridY ?? rawCellsY?.length ?? DEFAULT_BOX_PARAMS.gridY,
      limit.min,
      limit.max,
    ),
  );

  return {
    boxLength: snap(
      params.boxLength ?? DEFAULT_BOX_PARAMS.boxLength,
      CONSTRUCTOR_LIMITS.boxLength,
    ),
    boxWidth: snap(
      params.boxWidth ?? DEFAULT_BOX_PARAMS.boxWidth,
      CONSTRUCTOR_LIMITS.boxWidth,
    ),
    boxHeight: snap(
      params.boxHeight ?? DEFAULT_BOX_PARAMS.boxHeight,
      CONSTRUCTOR_LIMITS.boxHeight,
    ),
    boxWall: snap(
      params.boxWall ?? DEFAULT_BOX_PARAMS.boxWall,
      CONSTRUCTOR_LIMITS.boxWall,
    ),
    cellsX: normalizeBoxCells(rawCellsX, gridX),
    cellsY: normalizeBoxCells(rawCellsY, gridY),
    gridX,
    gridY,
    hasLid:
      typeof params.hasLid === "boolean"
        ? params.hasLid
        : DEFAULT_BOX_PARAMS.hasLid,
  };
}

/**
 * Приводит набор ячеек к количеству gridX/gridY.
 *
 * Если массив той же длины, его значения зажимаются в 5–220 мм и задают
 * пропорции. Если длина другая (например, старый слайдер поменял число
 * ячеек), массив заменяется равными единицами: геометрия всё равно делит
 * свободное место пропорционально, и ячейки получаются одинаковыми.
 */
function normalizeBoxCells(
  values: readonly unknown[] | null,
  count: number,
): number[] {
  if (!values || values.length !== count) {
    return Array.from({ length: count }, () => 1);
  }

  return Array.from({ length: count }, (_, index) => {
    const value = values[index];

    if (typeof value !== "number" || !Number.isFinite(value)) {
      return 1;
    }

    return Math.round(clamp(value, BOX_CELL_MIN_MM, BOX_CELL_MAX_MM));
  });
}

/**
 * Проверяет и выравнивает параметры литофана.
 *
 * Размеры встают на шаг слайдеров, толщины зажимаются в свои границы.
 * Максимум всегда остаётся хотя бы на один шаг выше минимума: иначе рельеф
 * превратился бы в плоскую пластину. Массив яркости принимается только
 * целым, ровно 150 × 150; испорченные данные заменяются демонстрационным
 * рельефом, чтобы предпросмотр не падал.
 */
export function normalizeLithophaneParams(
  params: Partial<LithophaneParams>,
): LithophaneParams {
  const lithophaneMinThickness = snap(
    params.lithophaneMinThickness ??
      DEFAULT_LITHOPHANE_PARAMS.lithophaneMinThickness,
    CONSTRUCTOR_LIMITS.lithophaneMinThickness,
  );
  const minimumGap = CONSTRUCTOR_LIMITS.lithophaneMaxThickness.step;
  const requestedMaxThickness = snap(
    params.lithophaneMaxThickness ??
      DEFAULT_LITHOPHANE_PARAMS.lithophaneMaxThickness,
    CONSTRUCTOR_LIMITS.lithophaneMaxThickness,
  );
  const lithophaneMaxThickness =
    requestedMaxThickness < lithophaneMinThickness + minimumGap
      ? snap(
          lithophaneMinThickness + minimumGap,
          CONSTRUCTOR_LIMITS.lithophaneMaxThickness,
        )
      : requestedMaxThickness;

  return {
    lithophaneWidth: snap(
      params.lithophaneWidth ?? DEFAULT_LITHOPHANE_PARAMS.lithophaneWidth,
      CONSTRUCTOR_LIMITS.lithophaneWidth,
    ),
    lithophaneHeight: snap(
      params.lithophaneHeight ?? DEFAULT_LITHOPHANE_PARAMS.lithophaneHeight,
      CONSTRUCTOR_LIMITS.lithophaneHeight,
    ),
    lithophaneMinThickness,
    lithophaneMaxThickness,
    lithophaneBrightness: isLithophaneBrightness(params.lithophaneBrightness)
      ? params.lithophaneBrightness
      : DEFAULT_LITHOPHANE_PARAMS.lithophaneBrightness,
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
    ...normalizeBoxParams(params),
    ...normalizeLithophaneParams(params),
  };
}
