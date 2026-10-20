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
 * Калибровочная башня ограничена реальными диапазонами настройки: температура
 * сопла 190–230 °C, ретракт 0–5 мм. Ступеней от 2 до 10: меньше двух не
 * показывает разницу, больше десяти делает подписи нечитаемыми. Значения идут
 * от нижней ступени к верхней, поэтому начало и конец могут стоять в любом
 * порядке — башня одинаково печатается и с ростом, и с падением параметра.
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
  calibrationSteps: { min: 2, max: 10, step: 1, defaultValue: 5, decimals: 0 },
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
  "calibration",
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
  calibration: "Калибровка",
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
 * Виды калибровочных тестов.
 *
 * temperature меняет температуру сопла по высоте, retraction — длину ретракта.
 * Оба теста печатаются одной башней: секции отличаются только значением,
 * выпукло напечатанным на передней грани.
 */
export const CALIBRATION_TYPES = ["temperature", "retraction"] as const;

export type CalibrationType = (typeof CALIBRATION_TYPES)[number];

export const CALIBRATION_TYPE_LABELS = {
  temperature: "Температура",
  retraction: "Ретракция",
} as const satisfies Record<CalibrationType, string>;

/** Единица значения в подписях и на гранях башни. */
export const CALIBRATION_UNITS = {
  temperature: "°C",
  retraction: "мм",
} as const satisfies Record<CalibrationType, string>;

/**
 * Границы значений калибровки для каждого теста.
 *
 * Температура ниже 190 °C не плавит PLA равномерно, выше 230 °C начинает
 * подгорать. Ретракт длиннее 5 мм рвёт нить и забивает сопло. Шаг температуры
 * 5 °C — стандартный шаг калибровочных башен, ретракта — 0.1 мм.
 */
export const CALIBRATION_VALUE_LIMITS = {
  temperature: { min: 190, max: 230, step: 5, defaultValue: 230, decimals: 0 },
  retraction: { min: 0, max: 5, step: 0.1, defaultValue: 0, decimals: 1 },
} as const satisfies Record<CalibrationType, NumericLimit>;

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
 * Настройки вывески: надпись, кегль, глубина и канал под ленту.
 *
 * Каждая буква печатается отдельной полой деталью: лицо пропускает свет,
 * стенка держит форму, а внутренняя полость служит каналом под ленту.
 */
export type SignParams = {
  /** Надпись на вывеске, до 15 символов; пустая строка означает «нет букв». */
  signText: string;
  /** Кегль шрифта, мм: заглавные буквы примерно на треть ниже. */
  signFontSize: number;
  /** Общая толщина буквы от лица до задней плоскости, мм. */
  signDepth: number;
  /** Ширина канала под ленту: 8 или 10 мм. */
  signChannelWidth: SignChannelWidth;
  /** Зазор между соседними буквами при сборке строки, мм. */
  signLetterGap: number;
};


/** Настройки калибровочной башни: тест, диапазон и число ступеней. */
export type CalibrationParams = {
  /** Что калибруем: температуру сопла или длину ретракта. */
  calibrationType: CalibrationType;
  /** Значение на нижней ступени; для температуры — °C, для ретракта — мм. */
  startValue: number;
  /** Значение на верхней ступени. */
  endValue: number;
  /** Сколько ступеней в башне: от 2 до 10. */
  steps: number;
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
  /** Количество ячеек по длине: от 1 до 8. */
  gridX: number;
  /** Количество ячеек по ширине: от 1 до 8. */
  gridY: number;
  /** Печатать ли отдельную крышку с бортиком. */
  hasLid: boolean;
};

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
  shapeType: "rounded",
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

/** Вывеска по умолчанию: короткое имя бренда и канал 8 мм. */
export const DEFAULT_SIGN_PARAMS: SignParams = {
  signText: "ТРИ ДИ",
  signFontSize: CONSTRUCTOR_LIMITS.signFontSize.defaultValue,
  signDepth: CONSTRUCTOR_LIMITS.signDepth.defaultValue,
  signChannelWidth: 8,
  signLetterGap: CONSTRUCTOR_LIMITS.signLetterGap.defaultValue,
};


/**
 * Калибровка по умолчанию: башня температуры от горячего низа к холодному
 * верху. Такая башня сразу показывает, на какой температуре стенка прочнее.
 */
export const DEFAULT_CALIBRATION_PARAMS: CalibrationParams = {
  calibrationType: "temperature",
  startValue: CALIBRATION_VALUE_LIMITS.temperature.defaultValue,
  endValue: 190,
  steps: CONSTRUCTOR_LIMITS.calibrationSteps.defaultValue,
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
  gridX: CONSTRUCTOR_LIMITS.boxGrid.defaultValue,
  gridY: CONSTRUCTOR_LIMITS.boxGrid.defaultValue,
  hasLid: true,
};

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

/** Стартовые диапазоны для переключения теста: значения не переносятся. */
export const DEFAULT_CALIBRATION_VALUES = {
  temperature: { startValue: 230, endValue: 190 },
  retraction: { startValue: 0, endValue: 5 },
} as const satisfies Record<
  CalibrationType,
  { startValue: number; endValue: number }
>;

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
  CalibrationParams &
  BoxParams &
  LithophaneParams;

/** Стартовое состояние: открывается ваза, остальные модели ждут на вкладках. */
export const DEFAULT_CONSTRUCTOR_PARAMS: ConstructorParams = {
  model: "vase",
  ...DEFAULT_VASE_PARAMS,
  ...DEFAULT_KEYCHAIN_PARAMS,
  ...DEFAULT_LAMP_PARAMS,
  ...DEFAULT_SIGN_PARAMS,
  ...DEFAULT_CALIBRATION_PARAMS,
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
  return `tridi-brelyok-${params.shapeType}-l${params.length}-w${params.width}-t${params.thickness}.stl`;
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
 * Имя файла STL для вывески.
 *
 * Текст в имя не попадает: кириллица требует filename*=UTF-8, а запасное имя
 * всё равно должно остаться латинским. Кегль, выступ и канал описывают
 * заготовку однозначно, номер буквы (`b1`, `b2` …) — отдельную деталь.
 * Номера в имени человеческие, с единицы, хотя в API буква адресуется с нуля.
 */
export function signStlFileName(params: SignParams, letterIndex: number | null = null): string {
  const letterSuffix = letterIndex === null ? "" : `-b${letterIndex + 1}`;

  return `tridi-vyveska-s${params.signFontSize}-d${params.signDepth}-c${params.signChannelWidth}${letterSuffix}.stl`;
}


/**
 * Имя файла STL для калибровочной башни.
 *
 * В имени только латиница: тест, диапазон и число ступеней однозначно
 * описывают башню, а кириллические единицы в заголовке ответа не нужны.
 * Значения уже выровнены normalizeCalibrationParams, поэтому лишних нулей нет.
 */
export function calibrationStlFileName(params: CalibrationParams): string {
  return `tridi-kalibrovka-${params.calibrationType}-${params.startValue}-${params.endValue}-s${params.steps}.stl`;
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

/** Проверка вида калибровочного теста из формы или API. */
export function isCalibrationType(value: unknown): value is CalibrationType {
  return (
    typeof value === "string" &&
    (CALIBRATION_TYPES as readonly string[]).includes(value)
  );
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
 * `index` — позиция буквы в надписи без пробелов: 0 — первая. Именно она уходит
 * в API как `letter`, поэтому список в интерфейсе, имена файлов и сборка
 * геометрии не могут разойтись: все берут буквы отсюда. Пробелы пропускаются —
 * у них нет контуров, и отдельной детали для них не бывает.
 */
export function listSignLetters(signText: string): { index: number; char: string }[] {
  return Array.from(signText.trim())
    .filter((char) => char !== " ")
    .map((char, index) => ({ char, index }));
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
    signLetterGap: snap(
      params.signLetterGap ?? DEFAULT_SIGN_PARAMS.signLetterGap,
      CONSTRUCTOR_LIMITS.signLetterGap,
    ),
  };
}

/**
 * Проверяет и выравнивает параметры калибровочной башни.
 *
 * Диапазон зависит от теста, поэтому тип проверяется первым: при смене
 * температуры на ретракт старые 230 °C не должны стать 230 мм. Значения
 * зажимаются в границы выбранного теста и встают на его шаг; число ступеней
 * берётся из общего лимита. Начало и конец не сортируются — направление
 * башни задаёт пользователь.
 */
export function normalizeCalibrationParams(
  params: Partial<CalibrationParams>,
): CalibrationParams {
  const calibrationType = isCalibrationType(params.calibrationType)
    ? params.calibrationType
    : DEFAULT_CALIBRATION_PARAMS.calibrationType;
  const limit = CALIBRATION_VALUE_LIMITS[calibrationType];
  const fallback = DEFAULT_CALIBRATION_VALUES[calibrationType];

  return {
    calibrationType,
    startValue: snap(params.startValue ?? fallback.startValue, limit),
    endValue: snap(params.endValue ?? fallback.endValue, limit),
    steps: snap(
      params.steps ?? DEFAULT_CALIBRATION_PARAMS.steps,
      CONSTRUCTOR_LIMITS.calibrationSteps,
    ),
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
    gridX: snap(
      params.gridX ?? DEFAULT_BOX_PARAMS.gridX,
      CONSTRUCTOR_LIMITS.boxGrid,
    ),
    gridY: snap(
      params.gridY ?? DEFAULT_BOX_PARAMS.gridY,
      CONSTRUCTOR_LIMITS.boxGrid,
    ),
    hasLid:
      typeof params.hasLid === "boolean"
        ? params.hasLid
        : DEFAULT_BOX_PARAMS.hasLid,
  };
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
    ...normalizeCalibrationParams(params),
    ...normalizeBoxParams(params),
    ...normalizeLithophaneParams(params),
  };
}
