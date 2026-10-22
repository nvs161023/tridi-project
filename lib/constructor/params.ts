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
 * Подставка под телефон ограничена углом 45–75°: на меньшем наклоне телефон
 * падает назад, на большем — стоит почти вертикально и опрокидывается вперёд.
 * Толщина 8–15 мм оставляет место чехлу, а ширина 60–100 мм совпадает с
 * шириной корпуса. Клипсы держат кабели 3–8 мм: это весь ряд USB, зарядных и
 * сетевых шнуров. Вывеска ограничена кеглем 120 мм и пятнадцатью символами:
 * длинная строка крупным кеглем упирается в лимит ширины 800 мм, и геометрия
 * сама уменьшает буквы.
 *
 * Коробка-органайзер вписана в стол 220 × 220 мм: длина и ширина до 220 мм,
 * высота до 160 мм. Перегородки имеют ту же толщину, что и стенки, поэтому
 * сетка до 8 × 8 остаётся печатной даже на минимальной коробке. Крышка —
 * отдельная деталь с бортиком по периметру; она лежит рядом с корпусом в том же
 * STL, чтобы её можно было напечатать без поддержек.
 *
 * Литофан принимает фотографию, сжатую в браузере до сетки 400 × 400, и
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
  standAngle: { min: 45, max: 75, step: 1, defaultValue: 65, decimals: 0 },
  phoneThickness: { min: 8, max: 15, step: 1, defaultValue: 11, decimals: 0 },
  standWidth: { min: 60, max: 100, step: 5, defaultValue: 80, decimals: 0 },
  cableDiameter: { min: 3, max: 8, step: 0.5, defaultValue: 5, decimals: 1 },
  clipCount: { min: 1, max: 10, step: 1, defaultValue: 3, decimals: 0 },
  clipSpacing: { min: 10, max: 40, step: 1, defaultValue: 20, decimals: 0 },
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
  planterSize: { min: 60, max: 200, step: 5, defaultValue: 120, decimals: 0 },
  planterHeight: { min: 50, max: 200, step: 5, defaultValue: 110, decimals: 0 },
  planterWall: { min: 1.2, max: 4, step: 0.2, defaultValue: 2, decimals: 1 },
  coasterSize: { min: 60, max: 140, step: 5, defaultValue: 90, decimals: 0 },
  coasterThickness: { min: 3, max: 10, step: 1, defaultValue: 5, decimals: 0 },
  jewelryHeight: { min: 60, max: 160, step: 5, defaultValue: 100, decimals: 0 },
  jewelryBase: { min: 50, max: 120, step: 5, defaultValue: 80, decimals: 0 },
  // Габарит «под ключ»: стаканчик должен вмещать ручку и не падать от веса.
  penSize: { min: 50, max: 120, step: 5, defaultValue: 80, decimals: 0 },
  penHeight: { min: 60, max: 160, step: 5, defaultValue: 100, decimals: 0 },
  penWall: { min: 1.2, max: 4, step: 0.2, defaultValue: 1.6, decimals: 1 },
  // Число отделений: больше четырёх в габарит 50 мм уже не помещаются.
  penSections: { min: 1, max: 4, step: 1, defaultValue: 2, decimals: 0 },
  patchSize: { min: 40, max: 140, step: 5, defaultValue: 80, decimals: 0 },
  // Тонкая нашивка гнётся, толстая уже похожа на медаль.
  patchThickness: { min: 1, max: 3, step: 0.2, defaultValue: 1.6, decimals: 1 },
  patchStitches: { min: 0, max: 48, step: 4, defaultValue: 24, decimals: 0 },
  // Плафон гирлянды: снизу широкий, сверху садится на цоколь.
  lightDiameter: { min: 24, max: 80, step: 2, defaultValue: 44, decimals: 0 },
  lightHeight: { min: 20, max: 60, step: 2, defaultValue: 34, decimals: 0 },
  lightSocket: { min: 6, max: 20, step: 1, defaultValue: 10, decimals: 0 },
  lightWall: { min: 1.2, max: 3, step: 0.2, defaultValue: 1.6, decimals: 1 },
  // Сколько плафонов печатается одним файлом: гирлянду собирают партиями.
  lightCount: { min: 1, max: 4, step: 1, defaultValue: 1, decimals: 0 },
  // Игрушка: габарит шара и высота тела без петельки.
  ornamentDiameter: { min: 40, max: 100, step: 5, defaultValue: 60, decimals: 0 },
  ornamentHeight: { min: 50, max: 140, step: 5, defaultValue: 90, decimals: 0 },
  ornamentWall: { min: 1.2, max: 3, step: 0.2, defaultValue: 1.6, decimals: 1 },
  // Крючок: плита на стену и вынос штыря от неё.
  hookWidth: { min: 20, max: 80, step: 5, defaultValue: 40, decimals: 0 },
  hookHeight: { min: 30, max: 100, step: 5, defaultValue: 60, decimals: 0 },
  hookDepth: { min: 15, max: 60, step: 5, defaultValue: 35, decimals: 0 },
  // Клипса кружки: зазор строится по толщине борта.
  cupRim: { min: 2, max: 8, step: 0.5, defaultValue: 4, decimals: 1 },
  cupClipWidth: { min: 10, max: 40, step: 5, defaultValue: 20, decimals: 0 },
  cupClipLength: { min: 15, max: 50, step: 5, defaultValue: 30, decimals: 0 },
  // Трафарет: плита от открытки до половины листа A4.
  stencilWidth: { min: 60, max: 220, step: 5, defaultValue: 140, decimals: 0 },
  stencilHeight: { min: 40, max: 220, step: 5, defaultValue: 100, decimals: 0 },
  stencilThickness: { min: 0.8, max: 3, step: 0.2, defaultValue: 1.2, decimals: 1 },
} as const satisfies Record<string, NumericLimit>;

/** Типы моделей, которые умеет собирать конструктор. */
export const MODEL_TYPES = [
  "vase",
  "keychain",
  "sign",
  "box",
  "lithophane",
  "stand",
  "clips",
  "planter",
  "coaster",
  "jewelry_stand",
  "pen_holder",
  "fabric_patch",
  "string_light",
  "ornament",
  "wall_hook",
  "cup_clip",
  "stencil",
] as const;

export type ModelType = (typeof MODEL_TYPES)[number];

/** Подписи моделей для вкладок панели параметров. */
export const MODEL_TYPE_LABELS = {
  vase: "Ваза",
  keychain: "Брелок",
  sign: "Вывеска",
  box: "Коробки",
  lithophane: "Литофан",
  stand: "Подставка",
  clips: "Клипсы",
  planter: "Кашпо",
  coaster: "Подставка под кружку",
  jewelry_stand: "Подставка для украшений",
  pen_holder: "Органайзер для ручек",
  fabric_patch: "Нашивка",
  string_light: "Абажур для гирлянды",
  ornament: "Ёлочная игрушка",
  wall_hook: "Настенный крючок",
  cup_clip: "Клипса для кружки",
  stencil: "Трафарет",
} as const satisfies Record<ModelType, string>;

/** Инструмент конструктора в витринах: идентификатор, название и описание. */
export type ConstructorTool = {
  /** Модель конструктора, которую открывает инструмент. */
  id: ModelType;
  /** Название в списках Pro и на витрине инструментов. */
  title: string;
  /** Одно предложение о том, что инструмент собирает. */
  desc: string;
};

/**
 * Все генераторы конструктора одним массивом.
 *
 * Массив — единственный источник списка: страница тарифов, витрина
 * `/tools` и подписи самих моделей берут инструменты отсюда, поэтому новый
 * генератор достаточно добавить в `MODEL_TYPES` и в этот массив. Порядок
 * совпадает с порядком вкладок панели параметров.
 */
export const CONSTRUCTOR_TOOLS: readonly ConstructorTool[] = [
  {
    id: "vase",
    title: "Генератор ваз",
    desc: "Параметрические вазы с узорами: шесть силуэтов, математические волны и точные размеры под ваш принтер.",
  },
  {
    id: "keychain",
    title: "Генератор брелоков",
    desc: "Брелоки с именем на кириллице, готовыми силуэтами и своим SVG-контуром или картинкой.",
  },
  {
    id: "sign",
    title: "Генератор вывесок",
    desc: "Объёмные буквы с каналом под LED-ленту, разбитые на блоки, которые удобно печатать и вешать.",
  },
  {
    id: "box",
    title: "Генератор коробок",
    desc: "Органайзеры с настраиваемой сеткой перегородок и крышкой: корпус и крышка в одном STL.",
  },
  {
    id: "lithophane",
    title: "Генератор литофанов",
    desc: "Панели из фотографий: яркость пикселей превращается в толщину пластика, а рамка держит свет.",
  },
  {
    id: "stand",
    title: "Генератор подставок",
    desc: "Настольные подставки под телефон с окном под кабель: наклон и ширина подбираются под корпус.",
  },
  {
    id: "clips",
    title: "Генератор клипс",
    desc: "Держатели кабелей на планке: пружинящие C-образные зажимы под любой диаметр шнура.",
  },
  {
    id: "planter",
    title: "Генератор кашпо",
    desc: "Кашпо с дренажными отверстиями и поддоном в одном STL: круглая, квадратная или гранёная форма.",
  },
  {
    id: "coaster",
    title: "Генератор подставок под кружку",
    desc: "Подставки с бортиком и рельефным узором: конденсат остаётся в поддоне, а не на столе.",
  },
  {
    id: "jewelry_stand",
    title: "Генератор подставок для украшений",
    desc: "Настольная стойка с штангой под кольца и рожками под цепочки: всё хранится на одном месте.",
  },
  {
    id: "pen_holder",
    title: "Генератор органайзеров для ручек",
    desc: "Стаканчик с перегородками: круглая, квадратная или гранёная форма и точная толщина стенки.",
  },
  {
    id: "fabric_patch",
    title: "Генератор нашивок",
    desc: "Нашивки с бортиком и стежками: круглая, квадратная или шестигранная форма без швейной машинки.",
  },
  {
    id: "string_light",
    title: "Генератор абажуров для гирлянды",
    desc: "Плафоны под LED-гирлянду: конус с посадкой на цоколь, набор из нескольких штук в одном STL.",
  },
  {
    id: "ornament",
    title: "Генератор ёлочных игрушек",
    desc: "Полые игрушки на ёлку: шар, капля или колокол со стенкой по профилю и кольцом под ленту.",
  },
  {
    id: "wall_hook",
    title: "Генератор настенных крючков",
    desc: "Крючки с плитой под саморезы или клейкую ленту: наклонный штырь печатается без поддержек.",
  },
  {
    id: "cup_clip",
    title: "Генератор клипс для кружки",
    desc: "Зажим на борт кружки с прорезью под нитку: чайный пакетик больше не тонет в чашке.",
  },
  {
    id: "stencil",
    title: "Генератор трафаретов",
    desc: "Трафареты для краски и аэрографа: полосы, точки или соты со сквозными прорезями и рамкой.",
  },
];

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
 * Подставка под телефон: наклон спинки, толщина корпуса и ширина ложа.
 *
 * Три числа задают всю деталь. Угол — наклон спинки от стола: телефон лежит на
 * ней экраном к пользователю. Толщина корпуса задаёт глубину жёлоба между
 * передней губой и спинкой, а ширина — длину профиля поперёк.
 */
export type StandParams = {
  /** Наклон спинки от стола, градусы: 45–75. */
  standAngle: number;
  /** Толщина телефона с чехлом, мм: глубина жёлоба под нижнюю кромку. */
  phoneThickness: number;
  /** Ширина подставки поперёк профиля, мм. */
  standWidth: number;
};

/**
 * Клипсы для кабелей: диаметр шнура, число зажимов и шаг между ними.
 *
 * Зажимы стоят на общей планке, поэтому набор печатается одной деталью.
 * Диаметр задаёт внутренний размер C-образного зажима, шаг — расстояние между
 * центрами соседних зажимов.
 */
export type ClipsParams = {
  /** Наружный диаметр кабеля, мм: от него считается внутренний размер зажима. */
  cableDiameter: number;
  /** Сколько зажимов на планке, от 1 до 10. */
  clipCount: number;
  /** Расстояние между центрами соседних зажимов, мм. */
  clipSpacing: number;
};

/**
 * Форма кашпо: круг, квадрат или шестигранник.
 *
 * `planterSize` у всех трёх форм означает один и тот же габарит «под ключ»:
 * диаметр у круга и расстояние между параллельными гранями у многоугольников.
 * Поэтому стенка одной толщины получается на любой форме, а поддон всегда
 * охватывает горшок.
 */
export const PLANTER_SHAPES = ["round", "square", "hex"] as const;

export type PlanterShape = (typeof PLANTER_SHAPES)[number];

export const PLANTER_SHAPE_LABELS = {
  round: "Круглое",
  square: "Квадратное",
  hex: "Шестигранное",
} as const satisfies Record<PlanterShape, string>;

/**
 * Кашпо: габарит, высота, стенка, форма и дренаж.
 *
 * Дренажные отверстия Ø 5 мм проходят сквозь дно, а рядом с горшком в том же
 * STL печатается поддон: лишняя вода стекает в него и не остаётся под горшком.
 * Без дренажа дно глухое, и поддон не строится — деталь печатается одна.
 */
export type PlanterParams = {
  /** Габарит «под ключ», мм: диаметр круга или размер многоугольника. */
  planterSize: number;
  /** Высота стенки от стола, мм. */
  planterHeight: number;
  /** Толщина стенки и дна, мм. */
  planterWall: number;
  /** Форма в плане: круг, квадрат или шестигранник. */
  planterShape: PlanterShape;
  /** Отверстия в дне и отдельный поддон рядом с горшком. */
  planterDrainage: boolean;
};

/** Подставка под кружку повторяет три формы кашпо: круг, квадрат и шестигранник. */
export const COASTER_SHAPES = PLANTER_SHAPES;

export type CoasterShape = (typeof COASTER_SHAPES)[number];

export const COASTER_SHAPE_LABELS = {
  round: "Круглая",
  square: "Квадратная",
  hex: "Шестигранная",
} as const satisfies Record<CoasterShape, string>;

/** Рельеф на лице подставки: без узора, кольца или точки. */
export const COASTER_PATTERNS = ["plain", "rings", "dots"] as const;

export type CoasterPattern = (typeof COASTER_PATTERNS)[number];

export const COASTER_PATTERN_LABELS = {
  plain: "Без узора",
  rings: "Кольца",
  dots: "Точки",
} as const satisfies Record<CoasterPattern, string>;

/**
 * Подставка под кружку: габарит, толщина, форма, рельеф и бортик.
 *
 * Бортик по краю — это не украшение: конденсат с холодного стакана стекает в
 * него, а не на стол. Узор выступает над лицом на доли миллиметра, чтобы кружка
 * стояла устойчиво.
 */
export type CoasterParams = {
  /** Габарит «под ключ», мм: диаметр или размер многоугольника. */
  coasterSize: number;
  /** Толщина основания, мм. */
  coasterThickness: number;
  /** Форма в плане: круг, квадрат или шестигранник. */
  coasterShape: CoasterShape;
  /** Рельеф на лице подставки. */
  coasterPattern: CoasterPattern;
  /** Бортик по краю, который собирает конденсат. */
  coasterRim: boolean;
};

/** Что держит стойка: кольца на штанге, цепочки на рожках или всё вместе. */
export const JEWELRY_CONFIGS = ["rings", "necklace", "combo"] as const;

export type JewelryConfig = (typeof JEWELRY_CONFIGS)[number];

export const JEWELRY_CONFIG_LABELS = {
  rings: "Кольца",
  necklace: "Цепочки",
  combo: "Кольца и цепочки",
} as const satisfies Record<JewelryConfig, string>;

/**
 * Подставка для украшений: высота стойки, диаметр основания и набор держателей.
 *
 * Основание — диск, на котором лежат часы и серьги, стойка держит штангу для
 * колец и два рожка для цепочек. Все детали — отдельные замкнутые тела, которые
 * входят друг в друга, поэтому стойка печатается одной деталью без поддержек.
 */
export type JewelryStandParams = {
  /** Высота стойки от стола, мм; выше подставки ничего не выступает. */
  jewelryHeight: number;
  /** Диаметр основания, мм. */
  jewelryBase: number;
  /** Какие держатели строить: штанга, рожки или оба. */
  jewelryConfig: JewelryConfig;
};

/**
 * Органайзер для ручек повторяет три формы кашпо: круг, квадрат и шестигранник.
 * Сечение строит тот же код, а подписи согласуют род со словом «органайзер».
 */
export const PEN_SHAPES = PLANTER_SHAPES;

export type PenShape = (typeof PEN_SHAPES)[number];

export const PEN_SHAPE_LABELS = {
  round: "Круглый",
  square: "Квадратный",
  hex: "Шестигранный",
} as const satisfies Record<PenShape, string>;

/**
 * Органайзер для ручек: габарит, высота, стенка, форма и число отделений.
 *
 * Стаканчик собирается из кольца-стены и плиты дна: между ними остаётся
 * открытая полость. Перегородки делят её на отделения — каждая входит в стенку,
 * поэтому деталь печатается одним телом без клея и поддержек.
 */
export type PenHolderParams = {
  /** Габарит «под ключ», мм: диаметр или размер многоугольника. */
  penSize: number;
  /** Высота стенки от стола, мм. */
  penHeight: number;
  /** Толщина стенки, дна и перегородок, мм. */
  penWall: number;
  /** Форма в плане: круг, квадрат или шестигранник. */
  penShape: PenShape;
  /** Сколько отделений делят полость: от 1 до 4. */
  penSections: number;
};

/** Нашивка повторяет три формы кашпо: круг, квадрат и шестигранник. */
export const PATCH_SHAPES = PLANTER_SHAPES;

export type PatchShape = (typeof PATCH_SHAPES)[number];

export const PATCH_SHAPE_LABELS = {
  round: "Круглая",
  square: "Квадратная",
  hex: "Шестигранная",
} as const satisfies Record<PatchShape, string>;

/**
 * Тканевая нашивка: габарит, толщина, форма, бортик и число стежков.
 *
 * Плита — основа, бортик лежит по краю, а стежки идут выпуклыми точками по
 * бортику: так нашивка читается как тканая, хотя печатается пластиком.
 * Отверстия под нить не режутся — в проекте нет булевых операций, а точки
 * стоят на том же месте, где прошла бы строчка.
 */
export type FabricPatchParams = {
  /** Габарит «под ключ», мм: диаметр или размер многоугольника. */
  patchSize: number;
  /** Толщина плиты, мм. */
  patchThickness: number;
  /** Форма в плане: круг, квадрат или шестигранник. */
  patchShape: PatchShape;
  /** Бортик по краю плиты высотой 1 мм. */
  patchBorder: boolean;
  /** Число стежков по бортику: 0 — без строчки. */
  patchStitches: number;
};

/**
 * Абажур для гирлянды: диаметр, высота, посадка на цоколь, стенка и число штук.
 *
 * Плафон — усечённый конус со стенкой: сверху остаётся отверстие под цоколь
 * LED-лампы, снизу — широкий раструб. Верхнее отверстие и держит плафон на
 * проводе, поэтому крепёж не нужен. Несколько штук печатаются в одном STL
 * рядом друг с другом — гирлянду собирают партиями.
 */
export type StringLightParams = {
  /** Диаметр раструба снизу, мм. */
  lightDiameter: number;
  /** Высота плафона, мм. */
  lightHeight: number;
  /** Диаметр верхнего отверстия под цоколь, мм. */
  lightSocket: number;
  /** Толщина стенки, мм. */
  lightWall: number;
  /** Сколько плафонов печатается одним файлом: от 1 до 4. */
  lightCount: number;
};

/** Три силуэта ёлочной игрушки: шар, капля и колокол. */
export const ORNAMENT_SHAPES = ["ball", "drop", "bell"] as const;

export type OrnamentShape = (typeof ORNAMENT_SHAPES)[number];

export const ORNAMENT_SHAPE_LABELS = {
  ball: "Шар",
  drop: "Капля",
  bell: "Колокол",
} as const satisfies Record<OrnamentShape, string>;

/**
 * Ёлочная игрушка: габарит, высота, стенка, силуэт и кольцо под ленту.
 *
 * Игрушка полая: стенка идёт по профилю силуэта, снизу остаётся широкое
 * отверстие — деталь печатается без поддержек и без заполнения внутри. Сверху
 * стоит бобышка с отверстием, а над ней — кольцо в вертикальной плоскости:
 * лента проходит через него, и игрушку можно вешать сразу после печати.
 */
export type OrnamentParams = {
  /** Диаметр самой широкой части, мм. */
  ornamentDiameter: number;
  /** Высота тела игрушки без кольца, мм. */
  ornamentHeight: number;
  /** Толщина стенки, мм. */
  ornamentWall: number;
  /** Силуэт: шар, капля или колокол. */
  ornamentShape: OrnamentShape;
  /** Кольцо под ленту над бобышкой. */
  ornamentLoop: boolean;
};

/** Как крепится настенный крючок: саморезами или клейкой площадкой. */
export const WALL_HOOK_MOUNTS = ["screw", "adhesive"] as const;

export type WallHookMount = (typeof WALL_HOOK_MOUNTS)[number];

export const WALL_HOOK_MOUNT_LABELS = {
  screw: "Саморезы",
  adhesive: "Клейкая площадка",
} as const satisfies Record<WallHookMount, string>;

/**
 * Настенный крючок: плита на стену и наклонный штырь.
 *
 * При печати плита лежит на столе, поэтому штырь растёт прямо из неё: его
 * нижняя грань идёт под 45°, и поддержки не нужны. На стене штырь смотрит
 * вверх и наружу, а вещь соскальзывает по нему к основанию и остаётся в
 * углу между плитой и штырём. Отверстия под саморезы сквозные; у клейкой
 * версии плита целая, с ровной площадкой под двустороннюю ленту.
 */
export type WallHookParams = {
  /** Ширина плиты вдоль стены, мм. */
  hookWidth: number;
  /** Высота плиты на стене, мм. */
  hookHeight: number;
  /** Вынос штыря от стены, мм. */
  hookDepth: number;
  /** Крепление: два отверстия под саморезы или клейкая площадка. */
  hookMount: WallHookMount;
};

/**
 * Клипса для кружки: зажим на борт держит нитку чайного пакетика.
 *
 * Профиль — буква «П»: мостик ложится на борт кружки, короткая ножка уходит
 * внутрь, длинная свисает снаружи и несёт треугольную прорезь под нитку.
 * Стенка кружки проходит между ножками с зазором, поэтому клипса садится на
 * любой борт нужной толщины и снимается без усилия.
 */
export type CupClipParams = {
  /** Толщина стенки кружки, мм: зазор строится вокруг неё. */
  cupRim: number;
  /** Ширина клипсы вдоль борта, мм. */
  cupClipWidth: number;
  /** Длина наружной ножки, мм: она свисает по стенке. */
  cupClipLength: number;
  /** Прорезь под нитку на конце наружной ножки. */
  cupClipHook: boolean;
};

/** Узор трафарета: полосы, точки или соты. */
export const STENCIL_PATTERNS = ["stripes", "dots", "hexes"] as const;

export type StencilPattern = (typeof STENCIL_PATTERNS)[number];

export const STENCIL_PATTERN_LABELS = {
  stripes: "Полосы",
  dots: "Точки",
  hexes: "Соты",
} as const satisfies Record<StencilPattern, string>;

/**
 * Трафарет для краски: плита с прорезями узора.
 *
 * Узор собирается отверстиями в сплошной плите: перемычки между ними держат
 * трафарет целым, а по краю остаётся рамка, чтобы плита не рвалась при
 * снятии с поверхности. Все прорези сквозные, краска проходит насквозь, а
 * сама плита печатается плашмя — без поддержек и без заполнения.
 */
export type StencilParams = {
  /** Ширина плиты, мм. */
  stencilWidth: number;
  /** Высота плиты, мм. */
  stencilHeight: number;
  /** Толщина плиты, мм: тонкая плотнее прилегает, толстая жёстче. */
  stencilThickness: number;
  /** Узор прорезей: полосы, точки или соты. */
  stencilPattern: StencilPattern;
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
 * Сторона сетки изображения. Браузер рисует фотографию на canvas 400 × 400
 * сразу после выбора файла и считает по ней яркость.
 *
 * 150 × 150 не хватало: на панели 120 мм один пиксель — это 0.8 мм, и тонкие
 * линии логотипа сглаживались до «каши» ещё до геометрии. При 400 × 400
 * пиксель занимает 0.3 мм — примерно две ширины сопла, поэтому штрих в один
 * пиксель ещё читается на печати. Полный кадр фотографии в состоянии не
 * хранится: 160 000 чисел — это около 1 МБ JSON, а не 12 мегапикселей.
 */
export const LITHOPHANE_RESOLUTION = 400;

/** Число пикселей в сжатом изображении: 400 × 400. */
export const LITHOPHANE_PIXEL_COUNT = LITHOPHANE_RESOLUTION ** 2;

/**
 * Сторона сетки рельефа, вершин на сторону.
 *
 * Совпадает с источником: 400 × 400 пикселей дают 400 × 400 вершин, и каждая
 * вершина получает свою яркость почти без билинейного размазывания. Шаг
 * вершины на панели 120 мм — 0.3 мм, примерно две ширины сопла; 160 801
 * вершина ещё помещается в память телефона, а выше 500 × 500 сетка начинает
 * заметно тормозить слайдеры.
 */
export const LITHOPHANE_MESH_RESOLUTION = 400;

/**
 * Сторона уменьшенной копии для предпросмотра в сцене.
 *
 * three.js пересобирает рельеф на каждое движение слайдера, и полные 400 × 400
 * вершин в браузере телефона заметно тормозят вращение. Сцена получает
 * усреднённую копию 150 × 150, а в запрос STL уходит полный массив из
 * состояния — предпросмотр остаётся отзывчивым, печать — подробной.
 */
export const LITHOPHANE_PREVIEW_RESOLUTION = 150;

/**
 * Верхняя граница стороны сетки яркости из запроса.
 *
 * Массив приходит из браузера, поэтому сервер не должен принимать гигантский
 * JSON: 1024 × 1024 — это уже миллион значений, дальше проверка отклоняет
 * запрос с 422.
 */
export const LITHOPHANE_MAX_RESOLUTION = 1024;

/**
 * Как литофан стоит или висит.
 *
 * `none` — только плита и рамка, крепление не печатается. `stand` — отдельная
 * подставка: база с передней губой и задней стенкой под наклоном 12°.
 * `hook` — две петли на задней полке рамки: литофан висит на шляпках
 * саморезов вплотную к стене.
 */
export const LITHOPHANE_MOUNTS = ["none", "stand", "hook"] as const;

export type LithophaneMount = (typeof LITHOPHANE_MOUNTS)[number];

/** Подписи креплений: по ним клиент строит кнопки выбора. */
export const LITHOPHANE_MOUNT_LABELS = {
  none: "Без крепления",
  stand: "Подставка",
  hook: "Подвес на стену",
} as const satisfies Record<LithophaneMount, string>;

/**
 * Детали литофана: что выгружать в STL.
 *
 * Рельеф и рамка печатаются отдельно и собираются без клея: плита входит в
 * паз рамки с зазором 0.2 мм. Подставка — третья деталь, она нужна только при
 * `lithoMount === "stand"`. `all` — собранный вид для проверки и печати одним
 * файлом.
 */
export const LITHOPHANE_PARTS = ["relief", "frame", "stand", "all"] as const;

export type LithophanePart = (typeof LITHOPHANE_PARTS)[number];

/** Подписи деталей литофана для панели и имён файлов. */
export const LITHOPHANE_PART_LABELS = {
  relief: "Рельеф",
  frame: "Рамка",
  stand: "Подставка",
  all: "Все детали",
} as const satisfies Record<LithophanePart, string>;

/**
 * Литофан: панель с рельефом фотографии, рамка и крепление.
 *
 * Поля с префиксом `lithophane` не пересекаются с шириной брелока и высотой
 * вазы в общем объекте ConstructorParams. Яркость хранится построчно сверху
 * вниз, по 400 значений в строке: 0 — чёрный пиксель (толстый пластик),
 * 255 — белый (тонкий). Массив передаётся в API как есть, без повторного
 * декодирования картинки на сервере.
 *
 * Размеры `lithophaneWidth` и `lithophaneHeight` — это габарит собранной
 * рамки. Плита рельефа меньше на ширину бортика и зазор посадки, поэтому
 * слайдеры не прыгают при включении рамки.
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
  /** Яркость 160 000 пикселей: сетка 400 × 400, значения 0–255. */
  lithophaneBrightness: number[];
  /** Печатать рамку с пазом отдельной деталью. */
  lithoFrame: boolean;
  /** Крепление: без него, подставка на стол или петли под саморезы. */
  lithoMount: LithophaneMount;
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

/** Подставка по умолчанию: наклон 65°, телефон 11 мм, ширина 80 мм. */
export const DEFAULT_STAND_PARAMS: StandParams = {
  standAngle: CONSTRUCTOR_LIMITS.standAngle.defaultValue,
  phoneThickness: CONSTRUCTOR_LIMITS.phoneThickness.defaultValue,
  standWidth: CONSTRUCTOR_LIMITS.standWidth.defaultValue,
};

/** Клипсы по умолчанию: кабель 5 мм, три зажима через 20 мм. */
export const DEFAULT_CLIPS_PARAMS: ClipsParams = {
  cableDiameter: CONSTRUCTOR_LIMITS.cableDiameter.defaultValue,
  clipCount: CONSTRUCTOR_LIMITS.clipCount.defaultValue,
  clipSpacing: CONSTRUCTOR_LIMITS.clipSpacing.defaultValue,
};

/** Кашпо по умолчанию: круглое 120 × 110 мм, стенка 2 мм, дренаж и поддон. */
export const DEFAULT_PLANTER_PARAMS: PlanterParams = {
  planterSize: CONSTRUCTOR_LIMITS.planterSize.defaultValue,
  planterHeight: CONSTRUCTOR_LIMITS.planterHeight.defaultValue,
  planterWall: CONSTRUCTOR_LIMITS.planterWall.defaultValue,
  planterShape: "round",
  planterDrainage: true,
};

/** Подставка под кружку по умолчанию: круглая Ø 90 × 5 мм с бортиком и кольцами. */
export const DEFAULT_COASTER_PARAMS: CoasterParams = {
  coasterSize: CONSTRUCTOR_LIMITS.coasterSize.defaultValue,
  coasterThickness: CONSTRUCTOR_LIMITS.coasterThickness.defaultValue,
  coasterShape: "round",
  coasterPattern: "rings",
  coasterRim: true,
};

/** Стойка по умолчанию: 100 мм на основании Ø 80 мм, штанга и рожки вместе. */
export const DEFAULT_JEWELRY_STAND_PARAMS: JewelryStandParams = {
  jewelryHeight: CONSTRUCTOR_LIMITS.jewelryHeight.defaultValue,
  jewelryBase: CONSTRUCTOR_LIMITS.jewelryBase.defaultValue,
  jewelryConfig: "combo",
};

/** Органайзер по умолчанию: Ø 80 × 100 мм, стенка 1.6 мм, два отделения. */
export const DEFAULT_PEN_HOLDER_PARAMS: PenHolderParams = {
  penSize: CONSTRUCTOR_LIMITS.penSize.defaultValue,
  penHeight: CONSTRUCTOR_LIMITS.penHeight.defaultValue,
  penWall: CONSTRUCTOR_LIMITS.penWall.defaultValue,
  penShape: "round",
  penSections: CONSTRUCTOR_LIMITS.penSections.defaultValue,
};

/** Нашивка по умолчанию: круглая Ø 80 × 1.6 мм, бортик и 24 стежка. */
export const DEFAULT_FABRIC_PATCH_PARAMS: FabricPatchParams = {
  patchSize: CONSTRUCTOR_LIMITS.patchSize.defaultValue,
  patchThickness: CONSTRUCTOR_LIMITS.patchThickness.defaultValue,
  patchShape: "round",
  patchBorder: true,
  patchStitches: CONSTRUCTOR_LIMITS.patchStitches.defaultValue,
};

/** Плафон по умолчанию: раструб Ø 44 мм, высота 34 мм, отверстие 10 мм. */
export const DEFAULT_STRING_LIGHT_PARAMS: StringLightParams = {
  lightDiameter: CONSTRUCTOR_LIMITS.lightDiameter.defaultValue,
  lightHeight: CONSTRUCTOR_LIMITS.lightHeight.defaultValue,
  lightSocket: CONSTRUCTOR_LIMITS.lightSocket.defaultValue,
  lightWall: CONSTRUCTOR_LIMITS.lightWall.defaultValue,
  lightCount: CONSTRUCTOR_LIMITS.lightCount.defaultValue,
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
 * Игрушка по умолчанию: шар Ø 60 мм, высота 90 мм, стенка 1.6 мм, с кольцом.
 * Такой шар печатается примерно за два часа и сразу показывает и полость,
 * и посадку кольца под ленту.
 */
export const DEFAULT_ORNAMENT_PARAMS: OrnamentParams = {
  ornamentDiameter: CONSTRUCTOR_LIMITS.ornamentDiameter.defaultValue,
  ornamentHeight: CONSTRUCTOR_LIMITS.ornamentHeight.defaultValue,
  ornamentWall: CONSTRUCTOR_LIMITS.ornamentWall.defaultValue,
  ornamentShape: "ball",
  ornamentLoop: true,
};

/** Крючок по умолчанию: плита 40 × 60 мм, вынос 35 мм, под саморезы. */
export const DEFAULT_WALL_HOOK_PARAMS: WallHookParams = {
  hookWidth: CONSTRUCTOR_LIMITS.hookWidth.defaultValue,
  hookHeight: CONSTRUCTOR_LIMITS.hookHeight.defaultValue,
  hookDepth: CONSTRUCTOR_LIMITS.hookDepth.defaultValue,
  hookMount: "screw",
};

/** Клипса по умолчанию: борт 4 мм, ширина 20 мм, наружная ножка 30 мм. */
export const DEFAULT_CUP_CLIP_PARAMS: CupClipParams = {
  cupRim: CONSTRUCTOR_LIMITS.cupRim.defaultValue,
  cupClipWidth: CONSTRUCTOR_LIMITS.cupClipWidth.defaultValue,
  cupClipLength: CONSTRUCTOR_LIMITS.cupClipLength.defaultValue,
  cupClipHook: true,
};

/** Трафарет по умолчанию: 140 × 100 × 1.2 мм с полосами. */
export const DEFAULT_STENCIL_PARAMS: StencilParams = {
  stencilWidth: CONSTRUCTOR_LIMITS.stencilWidth.defaultValue,
  stencilHeight: CONSTRUCTOR_LIMITS.stencilHeight.defaultValue,
  stencilThickness: CONSTRUCTOR_LIMITS.stencilThickness.defaultValue,
  stencilPattern: "stripes",
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
 * Литофан по умолчанию: 120 × 80 мм, рельеф 0.8–3 мм, рамка и подставка.
 *
 * Рамка включена сразу: без неё плита 0.8–3 мм стоит только на ребре. Подставка
 * по умолчанию тоже включена — на вкладке видно готовый предмет, а не заготовку.
 * После загрузки фотографии массив яркости заменяется яркостью кадра.
 */
export const DEFAULT_LITHOPHANE_PARAMS: LithophaneParams = {
  lithophaneWidth: CONSTRUCTOR_LIMITS.lithophaneWidth.defaultValue,
  lithophaneHeight: CONSTRUCTOR_LIMITS.lithophaneHeight.defaultValue,
  lithophaneMinThickness:
    CONSTRUCTOR_LIMITS.lithophaneMinThickness.defaultValue,
  lithophaneMaxThickness:
    CONSTRUCTOR_LIMITS.lithophaneMaxThickness.defaultValue,
  lithophaneBrightness: createDemoLithophaneBrightness(),
  lithoFrame: true,
  lithoMount: "stand",
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
  SignParams &
  BoxParams &
  LithophaneParams &
  StandParams &
  ClipsParams &
  PlanterParams &
  CoasterParams &
  JewelryStandParams &
  PenHolderParams &
  FabricPatchParams &
  StringLightParams &
  OrnamentParams &
  WallHookParams &
  CupClipParams &
  StencilParams;

/** Стартовое состояние: открывается ваза, остальные модели ждут на вкладках. */
export const DEFAULT_CONSTRUCTOR_PARAMS: ConstructorParams = {
  model: "vase",
  ...DEFAULT_VASE_PARAMS,
  ...DEFAULT_KEYCHAIN_PARAMS,
  ...DEFAULT_SIGN_PARAMS,
  ...DEFAULT_BOX_PARAMS,
  ...DEFAULT_LITHOPHANE_PARAMS,
  ...DEFAULT_STAND_PARAMS,
  ...DEFAULT_CLIPS_PARAMS,
  ...DEFAULT_PLANTER_PARAMS,
  ...DEFAULT_COASTER_PARAMS,
  ...DEFAULT_JEWELRY_STAND_PARAMS,
  ...DEFAULT_PEN_HOLDER_PARAMS,
  ...DEFAULT_FABRIC_PATCH_PARAMS,
  ...DEFAULT_STRING_LIGHT_PARAMS,
  ...DEFAULT_ORNAMENT_PARAMS,
  ...DEFAULT_WALL_HOOK_PARAMS,
  ...DEFAULT_CUP_CLIP_PARAMS,
  ...DEFAULT_STENCIL_PARAMS,
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
 * Имя файла STL для подставки.
 *
 * В имени наклон, толщина телефона и ширина: по ним видно, под какой корпус
 * напечатана деталь. Значения уже выровнены normalizeStandParams, поэтому
 * лишних нулей нет.
 */
export function standStlFileName(params: StandParams): string {
  return `tridi-podstavka-a${params.standAngle}-t${params.phoneThickness}-w${params.standWidth}.stl`;
}

/**
 * Имя файла STL для клипс.
 *
 * Диаметр кабеля и число зажимов описывают набор полностью: шаг важен для
 * раскладки кабелей по столу, поэтому тоже входит в имя.
 */
export function clipsStlFileName(params: ClipsParams): string {
  return `tridi-klipsy-d${params.cableDiameter}-n${params.clipCount}-s${params.clipSpacing}.stl`;
}

/**
 * Имя файла STL для кашпо.
 *
 * Габарит «под ключ» записывается как `d`, высота и стенка — как `h` и `t`.
 * Суффикс `drenazh` говорит, что в файле две детали: горшок с отверстиями и
 * поддон. Значения уже выровнены normalizePlanterParams, поэтому лишних нулей
 * в имени нет.
 */
export function planterStlFileName(params: PlanterParams): string {
  const drainageSuffix = params.planterDrainage ? "-drenazh" : "";

  return `tridi-kashpo-${params.planterShape}-d${params.planterSize}-h${params.planterHeight}-t${params.planterWall}${drainageSuffix}.stl`;
}

/**
 * Имя файла STL для подставки под кружку.
 *
 * Узор и бортик попадают в имя суффиксами: по папке загрузок видно, какая
 * именно подставка напечатана. У ровной подставки без узора суффикса нет.
 */
export function coasterStlFileName(params: CoasterParams): string {
  const patternSuffix =
    params.coasterPattern === "plain" ? "" : `-${params.coasterPattern}`;
  const rimSuffix = params.coasterRim ? "-bort" : "";

  return `tridi-podstavka-kruzhka-${params.coasterShape}-d${params.coasterSize}-t${params.coasterThickness}${patternSuffix}${rimSuffix}.stl`;
}

/**
 * Имя файла STL для подставки украшений.
 *
 * Набор держателей входит в имя: `rings`, `necklace` или `combo` — иначе три
 * разные стойки одного размера попали бы в папку загрузок под одним именем.
 */
export function jewelryStandStlFileName(params: JewelryStandParams): string {
  return `tridi-podstavka-ukrasheniy-${params.jewelryConfig}-h${params.jewelryHeight}-d${params.jewelryBase}.stl`;
}

/**
 * Имя файла STL для органайзера для ручек.
 *
 * Форма, габарит, высота, стенка и число отделений описывают деталь целиком:
 * по папке загрузок видно, какой стаканчик напечатан.
 */
export function penHolderStlFileName(params: PenHolderParams): string {
  return `tridi-organajzer-${params.penShape}-d${params.penSize}-h${params.penHeight}-t${params.penWall}-s${params.penSections}.stl`;
}

/**
 * Имя файла STL для нашивки.
 *
 * Бортик и число стежков попадают суффиксами: две нашивки одного габарита
 * отличаются как раз строчкой, и по имени видно, какую деталь печатали.
 */
export function fabricPatchStlFileName(params: FabricPatchParams): string {
  const borderSuffix = params.patchBorder ? "-bort" : "";
  const stitchesSuffix =
    params.patchStitches > 0 ? `-stezhki${params.patchStitches}` : "";

  return `tridi-nashivka-${params.patchShape}-d${params.patchSize}-t${params.patchThickness}${borderSuffix}${stitchesSuffix}.stl`;
}

/**
 * Имя файла STL для плафонов гирлянды.
 *
 * Посадка на цоколь и число плафонов входят в имя: один и тот же раструб с
 * разным верхним отверстием на провод не наденется.
 */
export function stringLightStlFileName(params: StringLightParams): string {
  return `tridi-abazhur-girlyandy-d${params.lightDiameter}-h${params.lightHeight}-o${params.lightSocket}-n${params.lightCount}.stl`;
}

/**
 * Имя файла STL для ёлочной игрушки.
 *
 * Силуэт, габарит, высота и стенка описывают деталь целиком, а суффикс
 * `petlya` говорит, что сверху есть кольцо под ленту. Значения уже выровнены
 * normalizeOrnamentParams, поэтому лишних нулей в имени нет.
 */
export function ornamentStlFileName(params: OrnamentParams): string {
  const loopSuffix = params.ornamentLoop ? "-petlya" : "";

  return `tridi-elka-igrushka-${params.ornamentShape}-d${params.ornamentDiameter}-h${params.ornamentHeight}-t${params.ornamentWall}${loopSuffix}.stl`;
}

/**
 * Имя файла STL для настенного крючка.
 *
 * Крепление входит в имя: у версии под саморезы в плите сквозные отверстия, у
 * клейкой плита целая, и перепутать файлы в папке загрузок нельзя.
 */
export function wallHookStlFileName(params: WallHookParams): string {
  return `tridi-kryuchok-${params.hookMount}-w${params.hookWidth}-h${params.hookHeight}-d${params.hookDepth}.stl`;
}

/**
 * Имя файла STL для клипсы кружки.
 *
 * Толщина борта и длина ножки входят в имя: клипса под тонкий борт не сядет на
 * толстую кружку, а разная длина ножки — это разные детали.
 */
export function cupClipStlFileName(params: CupClipParams): string {
  const hookSuffix = params.cupClipHook ? "-nit" : "";

  return `tridi-klipsa-kruzhka-t${params.cupRim}-w${params.cupClipWidth}-l${params.cupClipLength}${hookSuffix}.stl`;
}

/**
 * Имя файла STL для трафарета.
 *
 * Узор входит в имя: трафареты одного габарита отличаются только рисунком
 * прорезей, и в папке загрузок они не должны сливаться в один файл.
 */
export function stencilStlFileName(params: StencilParams): string {
  return `tridi-trafaret-${params.stencilPattern}-w${params.stencilWidth}-h${params.stencilHeight}-t${params.stencilThickness}.stl`;
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
 * Имя файла STL для детали литофана.
 *
 * В имени только размеры, диапазон толщин и имя детали: исходное имя фотографии
 * может содержать кириллицу, а Content-Disposition должен оставаться простым
 * ASCII. Суффикс детали нужен всегда — рельеф, рамка и подставка лежат рядом в
 * папке загрузок, и «(1).stl» в них не должен появиться. Значения уже выровнены
 * normalizeLithophaneParams, поэтому лишних нулей нет.
 */
export function lithophaneStlFileName(
  params: LithophaneParams,
  part: LithophanePart = "all",
): string {
  return `tridi-litofan-w${params.lithophaneWidth}-h${params.lithophaneHeight}-t${params.lithophaneMinThickness}-${params.lithophaneMaxThickness}-${part}.stl`;
}

/** Проверка типа модели из формы или API. */
export function isModelType(value: unknown): value is ModelType {
  return (
    typeof value === "string" &&
    (MODEL_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Сторона квадратной сетки яркости: 400 для 160 000 значений.
 *
 * Сторона не хранится отдельным полем — её содержит длина массива. Поэтому
 * геометрия и проверка считают её одним и тем же способом, и массив
 * «400 × 300» не может пройти как валидный.
 */
export function lithophaneBrightnessSide(brightness: number[]): number {
  return Math.round(Math.sqrt(brightness.length));
}

/**
 * Проверка сжатого изображения: квадратная сетка целых значений 0–255.
 *
 * Сторона выводится из длины и должна быть целой: 400 × 400 из браузера,
 * 150 × 150 из старого клиента. Строгая проверка нужна и API, и нормализации:
 * массив другого размера дал бы дыры в сетке, а дробное или отрицательное
 * число — неверную толщину.
 */
export function isLithophaneBrightness(value: unknown): value is number[] {
  if (!Array.isArray(value)) {
    return false;
  }

  const side = lithophaneBrightnessSide(value);

  if (
    side < 2 ||
    side > LITHOPHANE_MAX_RESOLUTION ||
    side * side !== value.length
  ) {
    return false;
  }

  // Цикл по индексам, а не every(): разреженный массив every() пропускает
  // дыры, и undefined попал бы в геометрию как NaN.
  for (let index = 0; index < value.length; index += 1) {
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

/**
 * Уменьшает сетку яркости усреднением блоков: 400 × 400 → 150 × 150.
 *
 * Предпросмотр в сцене получает уменьшенную копию, иначе three.js пересобирает
 * 160 801 вершину на каждое движение слайдера. Усреднение, а не выборка каждого
 * N-го пикселя: иначе тонкие штрихи логотипа пропадали бы в предпросмотре
 * целиком. Массив не увеличивается: если цель не меньше источника, он
 * возвращается как есть — ссылка на состояние остаётся прежней.
 */
export function downsampleLithophaneBrightness(
  brightness: number[],
  targetSide: number,
): number[] {
  const side = lithophaneBrightnessSide(brightness);

  if (targetSide < 2 || targetSide >= side) {
    return brightness;
  }

  const result = new Array<number>(targetSide * targetSide);
  const scale = side / targetSide;

  for (let row = 0; row < targetSide; row += 1) {
    const top = Math.floor(row * scale);
    const bottom = Math.max(top + 1, Math.floor((row + 1) * scale));

    for (let column = 0; column < targetSide; column += 1) {
      const left = Math.floor(column * scale);
      const right = Math.max(left + 1, Math.floor((column + 1) * scale));
      let sum = 0;
      let count = 0;

      for (let y = top; y < bottom; y += 1) {
        const rowOffset = y * side;

        for (let x = left; x < right; x += 1) {
          sum += brightness[rowOffset + x];
          count += 1;
        }
      }

      result[row * targetSide + column] = Math.round(sum / count);
    }
  }

  return result;
}

/**
 * Проверка крепления литофана из формы или API.
 *
 * Значение приходит строкой из ссылки или запроса: незнакомое лучше заменить
 * на `none`, чем строить подставку с NaN.
 */
export function isLithophaneMount(value: unknown): value is LithophaneMount {
  return (
    typeof value === "string" &&
    (LITHOPHANE_MOUNTS as readonly string[]).includes(value)
  );
}

/** Проверка детали литофана: рельеф, рамка, подставка или всё сразу. */
export function isLithophanePart(value: unknown): value is LithophanePart {
  return (
    typeof value === "string" &&
    (LITHOPHANE_PARTS as readonly string[]).includes(value)
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

/** Проверка формы кашпо из формы или API. */
export function isPlanterShape(value: unknown): value is PlanterShape {
  return (
    typeof value === "string" &&
    (PLANTER_SHAPES as readonly string[]).includes(value)
  );
}

/**
 * Проверка формы подставки под кружку.
 *
 * Набор форм у неё тот же, что у кашпо: сечение строит один и тот же код, а
 * разные подписи в списке нужны только для согласования рода («круглая»).
 */
export const isCoasterShape: (value: unknown) => value is CoasterShape =
  isPlanterShape;

/**
 * Проверка формы органайзера для ручек.
 *
 * Набор форм общий с кашпо: сечение строит один и тот же код, а подписи в
 * списке согласуют род («круглый органайзер»).
 */
export const isPenShape: (value: unknown) => value is PenShape = isPlanterShape;

/** Проверка формы нашивки: круг, квадрат или шестигранник, как у кашпо. */
export const isPatchShape: (value: unknown) => value is PatchShape =
  isPlanterShape;

/** Проверка рельефа подставки под кружку из формы или API. */
export function isCoasterPattern(value: unknown): value is CoasterPattern {
  return (
    typeof value === "string" &&
    (COASTER_PATTERNS as readonly string[]).includes(value)
  );
}

/** Проверка набора держателей стойки для украшений. */
export function isJewelryConfig(value: unknown): value is JewelryConfig {
  return (
    typeof value === "string" &&
    (JEWELRY_CONFIGS as readonly string[]).includes(value)
  );
}

/** Проверка силуэта ёлочной игрушки из формы или API. */
export function isOrnamentShape(value: unknown): value is OrnamentShape {
  return (
    typeof value === "string" &&
    (ORNAMENT_SHAPES as readonly string[]).includes(value)
  );
}

/** Проверка крепления настенного крючка из формы или API. */
export function isWallHookMount(value: unknown): value is WallHookMount {
  return (
    typeof value === "string" &&
    (WALL_HOOK_MOUNTS as readonly string[]).includes(value)
  );
}

/** Проверка узора трафарета из формы или API. */
export function isStencilPattern(value: unknown): value is StencilPattern {
  return (
    typeof value === "string" &&
    (STENCIL_PATTERNS as readonly string[]).includes(value)
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
 * Проверяет и выравнивает параметры подставки.
 *
 * Все три числа — размеры, поэтому только выравнивание по шагу и границы. Угол
 * 45–75° держит телефон в равновесии: на меньшем наклоне он падает назад, на
 * большем — опрокидывается вперёд вместе с подставкой.
 */
export function normalizeStandParams(params: Partial<StandParams>): StandParams {
  return {
    standAngle: snap(
      params.standAngle ?? DEFAULT_STAND_PARAMS.standAngle,
      CONSTRUCTOR_LIMITS.standAngle,
    ),
    phoneThickness: snap(
      params.phoneThickness ?? DEFAULT_STAND_PARAMS.phoneThickness,
      CONSTRUCTOR_LIMITS.phoneThickness,
    ),
    standWidth: snap(
      params.standWidth ?? DEFAULT_STAND_PARAMS.standWidth,
      CONSTRUCTOR_LIMITS.standWidth,
    ),
  };
}

/**
 * Проверяет и выравнивает параметры клипс.
 *
 * Диаметр кабеля выравнивается по шагу 0.5 мм: зажим держит шнур за счёт
 * натяга, и полмиллиметра уже заметны. Число зажимов — целое от 1 до 10, шаг
 * между ними — от 10 до 40 мм, иначе соседние зажимы срастаются в один.
 */
export function normalizeClipsParams(params: Partial<ClipsParams>): ClipsParams {
  return {
    cableDiameter: snap(
      params.cableDiameter ?? DEFAULT_CLIPS_PARAMS.cableDiameter,
      CONSTRUCTOR_LIMITS.cableDiameter,
    ),
    clipCount: Math.round(
      snap(
        params.clipCount ?? DEFAULT_CLIPS_PARAMS.clipCount,
        CONSTRUCTOR_LIMITS.clipCount,
      ),
    ),
    clipSpacing: snap(
      params.clipSpacing ?? DEFAULT_CLIPS_PARAMS.clipSpacing,
      CONSTRUCTOR_LIMITS.clipSpacing,
    ),
  };
}

/**
 * Проверяет и выравнивает параметры кашпо.
 *
 * Три числа выравниваются по шагу слайдеров: габарит и высота — по 5 мм,
 * стенка — по 0.2 мм. Форма и дренаж принимаются только из своих наборов:
 * строка «false» из формы не должна включать отверстия, а незнакомая форма
 * заменяется круглой.
 */
export function normalizePlanterParams(
  params: Partial<PlanterParams>,
): PlanterParams {
  return {
    planterSize: snap(
      params.planterSize ?? DEFAULT_PLANTER_PARAMS.planterSize,
      CONSTRUCTOR_LIMITS.planterSize,
    ),
    planterHeight: snap(
      params.planterHeight ?? DEFAULT_PLANTER_PARAMS.planterHeight,
      CONSTRUCTOR_LIMITS.planterHeight,
    ),
    planterWall: snap(
      params.planterWall ?? DEFAULT_PLANTER_PARAMS.planterWall,
      CONSTRUCTOR_LIMITS.planterWall,
    ),
    planterShape: isPlanterShape(params.planterShape)
      ? params.planterShape
      : DEFAULT_PLANTER_PARAMS.planterShape,
    planterDrainage:
      typeof params.planterDrainage === "boolean"
        ? params.planterDrainage
        : DEFAULT_PLANTER_PARAMS.planterDrainage,
  };
}

/**
 * Проверяет и выравнивает параметры подставки под кружку.
 *
 * Толщина выравнивается по 1 мм: тонкая подставка коробится от горячей кружки, а
 * толщина больше 10 мм уже не нужна. Узор и бортик проверяются так же строго,
 * как у кашпо форма и дренаж.
 */
export function normalizeCoasterParams(
  params: Partial<CoasterParams>,
): CoasterParams {
  return {
    coasterSize: snap(
      params.coasterSize ?? DEFAULT_COASTER_PARAMS.coasterSize,
      CONSTRUCTOR_LIMITS.coasterSize,
    ),
    coasterThickness: snap(
      params.coasterThickness ?? DEFAULT_COASTER_PARAMS.coasterThickness,
      CONSTRUCTOR_LIMITS.coasterThickness,
    ),
    coasterShape: isCoasterShape(params.coasterShape)
      ? params.coasterShape
      : DEFAULT_COASTER_PARAMS.coasterShape,
    coasterPattern: isCoasterPattern(params.coasterPattern)
      ? params.coasterPattern
      : DEFAULT_COASTER_PARAMS.coasterPattern,
    coasterRim:
      typeof params.coasterRim === "boolean"
        ? params.coasterRim
        : DEFAULT_COASTER_PARAMS.coasterRim,
  };
}

/**
 * Проверяет и выравнивает параметры стойки для украшений.
 *
 * Высота и основание выравниваются по 5 мм. Набор держателей принимается только
 * из трёх известных значений: от него зависит, какие тела строит геометрия.
 */
export function normalizeJewelryStandParams(
  params: Partial<JewelryStandParams>,
): JewelryStandParams {
  return {
    jewelryHeight: snap(
      params.jewelryHeight ?? DEFAULT_JEWELRY_STAND_PARAMS.jewelryHeight,
      CONSTRUCTOR_LIMITS.jewelryHeight,
    ),
    jewelryBase: snap(
      params.jewelryBase ?? DEFAULT_JEWELRY_STAND_PARAMS.jewelryBase,
      CONSTRUCTOR_LIMITS.jewelryBase,
    ),
    jewelryConfig: isJewelryConfig(params.jewelryConfig)
      ? params.jewelryConfig
      : DEFAULT_JEWELRY_STAND_PARAMS.jewelryConfig,
  };
}

/**
 * Проверяет и выравнивает параметры органайзера для ручек.
 *
 * Габарит и высота выравниваются по 5 мм, стенка — по 0.2 мм. Число отделений
 * целое, от 1 до 4: в стаканчик 50 мм больше перегородок уже не помещается.
 * Форма принимается только из общего набора кашпо.
 */
export function normalizePenHolderParams(
  params: Partial<PenHolderParams>,
): PenHolderParams {
  return {
    penSize: snap(
      params.penSize ?? DEFAULT_PEN_HOLDER_PARAMS.penSize,
      CONSTRUCTOR_LIMITS.penSize,
    ),
    penHeight: snap(
      params.penHeight ?? DEFAULT_PEN_HOLDER_PARAMS.penHeight,
      CONSTRUCTOR_LIMITS.penHeight,
    ),
    penWall: snap(
      params.penWall ?? DEFAULT_PEN_HOLDER_PARAMS.penWall,
      CONSTRUCTOR_LIMITS.penWall,
    ),
    penShape: isPenShape(params.penShape)
      ? params.penShape
      : DEFAULT_PEN_HOLDER_PARAMS.penShape,
    penSections: Math.round(
      snap(
        params.penSections ?? DEFAULT_PEN_HOLDER_PARAMS.penSections,
        CONSTRUCTOR_LIMITS.penSections,
      ),
    ),
  };
}

/**
 * Проверяет и выравнивает параметры нашивки.
 *
 * Толщина выравнивается по 0.2 мм, стежки — целое число от 0 до 48: 0 честно
 * выключает строчку, а не оставляет одну точку. Бортик принимается только
 * булевым значением, как дренаж кашпо.
 */
export function normalizeFabricPatchParams(
  params: Partial<FabricPatchParams>,
): FabricPatchParams {
  return {
    patchSize: snap(
      params.patchSize ?? DEFAULT_FABRIC_PATCH_PARAMS.patchSize,
      CONSTRUCTOR_LIMITS.patchSize,
    ),
    patchThickness: snap(
      params.patchThickness ?? DEFAULT_FABRIC_PATCH_PARAMS.patchThickness,
      CONSTRUCTOR_LIMITS.patchThickness,
    ),
    patchShape: isPatchShape(params.patchShape)
      ? params.patchShape
      : DEFAULT_FABRIC_PATCH_PARAMS.patchShape,
    patchBorder:
      typeof params.patchBorder === "boolean"
        ? params.patchBorder
        : DEFAULT_FABRIC_PATCH_PARAMS.patchBorder,
    patchStitches: Math.round(
      snap(
        params.patchStitches ?? DEFAULT_FABRIC_PATCH_PARAMS.patchStitches,
        CONSTRUCTOR_LIMITS.patchStitches,
      ),
    ),
  };
}

/**
 * Проверяет и выравнивает параметры плафона для гирлянды.
 *
 * Диаметр, высота и стенка выравниваются по шагу слайдеров. Верхнее отверстие
 * дополнительно ограничено габаритом: если оно вместе со стенкой шире раструба,
 * внутренняя поверхность конуса пересекает наружную и деталь выворачивается.
 * Число плафонов целое, от 1 до 4.
 */
export function normalizeStringLightParams(
  params: Partial<StringLightParams>,
): StringLightParams {
  const lightDiameter = snap(
    params.lightDiameter ?? DEFAULT_STRING_LIGHT_PARAMS.lightDiameter,
    CONSTRUCTOR_LIMITS.lightDiameter,
  );
  const lightWall = snap(
    params.lightWall ?? DEFAULT_STRING_LIGHT_PARAMS.lightWall,
    CONSTRUCTOR_LIMITS.lightWall,
  );
  const maxSocket = Math.max(
    CONSTRUCTOR_LIMITS.lightSocket.min,
    lightDiameter - 4 * lightWall - 2,
  );

  return {
    lightDiameter,
    lightHeight: snap(
      params.lightHeight ?? DEFAULT_STRING_LIGHT_PARAMS.lightHeight,
      CONSTRUCTOR_LIMITS.lightHeight,
    ),
    lightSocket: snap(
      Math.min(
        params.lightSocket ?? DEFAULT_STRING_LIGHT_PARAMS.lightSocket,
        maxSocket,
      ),
      CONSTRUCTOR_LIMITS.lightSocket,
    ),
    lightWall,
    lightCount: Math.round(
      snap(
        params.lightCount ?? DEFAULT_STRING_LIGHT_PARAMS.lightCount,
        CONSTRUCTOR_LIMITS.lightCount,
      ),
    ),
  };
}

/**
 * Проверяет и выравнивает параметры ёлочной игрушки.
 *
 * Диаметр, высота и стенка выравниваются по шагу слайдеров, силуэт и кольцо
 * проверяются отдельно. Стенка дополнительно ограничена четвертью диаметра:
 * при более толстой стенке внутренняя поверхность профиля сходится сама с
 * собой и полость игрушки исчезает.
 */
export function normalizeOrnamentParams(
  params: Partial<OrnamentParams>,
): OrnamentParams {
  const ornamentDiameter = snap(
    params.ornamentDiameter ?? DEFAULT_ORNAMENT_PARAMS.ornamentDiameter,
    CONSTRUCTOR_LIMITS.ornamentDiameter,
  );

  return {
    ornamentDiameter,
    ornamentHeight: snap(
      params.ornamentHeight ?? DEFAULT_ORNAMENT_PARAMS.ornamentHeight,
      CONSTRUCTOR_LIMITS.ornamentHeight,
    ),
    ornamentWall: snap(
      Math.min(
        params.ornamentWall ?? DEFAULT_ORNAMENT_PARAMS.ornamentWall,
        ornamentDiameter / 4,
      ),
      CONSTRUCTOR_LIMITS.ornamentWall,
    ),
    ornamentShape: isOrnamentShape(params.ornamentShape)
      ? params.ornamentShape
      : DEFAULT_ORNAMENT_PARAMS.ornamentShape,
    ornamentLoop:
      typeof params.ornamentLoop === "boolean"
        ? params.ornamentLoop
        : DEFAULT_ORNAMENT_PARAMS.ornamentLoop,
  };
}

/**
 * Проверяет и выравнивает параметры настенного крючка.
 *
 * Плита и вынос выравниваются по шагу 5 мм, крепление — только `screw` или
 * `adhesive`. Отдельных ограничений между полями нет: короткий штырь на высокой
 * плите — это осознанный выбор, а не ошибка ввода.
 */
export function normalizeWallHookParams(
  params: Partial<WallHookParams>,
): WallHookParams {
  return {
    hookWidth: snap(
      params.hookWidth ?? DEFAULT_WALL_HOOK_PARAMS.hookWidth,
      CONSTRUCTOR_LIMITS.hookWidth,
    ),
    hookHeight: snap(
      params.hookHeight ?? DEFAULT_WALL_HOOK_PARAMS.hookHeight,
      CONSTRUCTOR_LIMITS.hookHeight,
    ),
    hookDepth: snap(
      params.hookDepth ?? DEFAULT_WALL_HOOK_PARAMS.hookDepth,
      CONSTRUCTOR_LIMITS.hookDepth,
    ),
    hookMount: isWallHookMount(params.hookMount)
      ? params.hookMount
      : DEFAULT_WALL_HOOK_PARAMS.hookMount,
  };
}

/**
 * Проверяет и выравнивает параметры клипсы для кружки.
 *
 * Толщина борта выравнивается по шагу 0.5: от неё зависит зазор между ножками,
 * и полмиллиметра здесь заметны. Прорезь под нитку принимается только как
 * boolean — в геометрии это либо вырез в ножке, либо ровный край.
 */
export function normalizeCupClipParams(
  params: Partial<CupClipParams>,
): CupClipParams {
  return {
    cupRim: snap(
      params.cupRim ?? DEFAULT_CUP_CLIP_PARAMS.cupRim,
      CONSTRUCTOR_LIMITS.cupRim,
    ),
    cupClipWidth: snap(
      params.cupClipWidth ?? DEFAULT_CUP_CLIP_PARAMS.cupClipWidth,
      CONSTRUCTOR_LIMITS.cupClipWidth,
    ),
    cupClipLength: snap(
      params.cupClipLength ?? DEFAULT_CUP_CLIP_PARAMS.cupClipLength,
      CONSTRUCTOR_LIMITS.cupClipLength,
    ),
    cupClipHook:
      typeof params.cupClipHook === "boolean"
        ? params.cupClipHook
        : DEFAULT_CUP_CLIP_PARAMS.cupClipHook,
  };
}

/**
 * Проверяет и выравнивает параметры трафарета.
 *
 * Ширина, высота и толщина выравниваются по шагу слайдеров, узор проверяется
 * по списку. Число прорезей не задаётся отдельно: шаг узора считается от
 * габарита, чтобы трафарет не превращался в сито на большом размере.
 */
export function normalizeStencilParams(
  params: Partial<StencilParams>,
): StencilParams {
  return {
    stencilWidth: snap(
      params.stencilWidth ?? DEFAULT_STENCIL_PARAMS.stencilWidth,
      CONSTRUCTOR_LIMITS.stencilWidth,
    ),
    stencilHeight: snap(
      params.stencilHeight ?? DEFAULT_STENCIL_PARAMS.stencilHeight,
      CONSTRUCTOR_LIMITS.stencilHeight,
    ),
    stencilThickness: snap(
      params.stencilThickness ?? DEFAULT_STENCIL_PARAMS.stencilThickness,
      CONSTRUCTOR_LIMITS.stencilThickness,
    ),
    stencilPattern: isStencilPattern(params.stencilPattern)
      ? params.stencilPattern
      : DEFAULT_STENCIL_PARAMS.stencilPattern,
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
 * целым, квадратной сеткой до LITHOPHANE_MAX_RESOLUTION; испорченные данные
 * заменяются демонстрационным рельефом, чтобы предпросмотр не падал.
 *
 * Крепление без рамки невозможно: паз подставки и петли подвеса вырезаны в
 * рамке. Поэтому при выключенной рамке `lithoMount` принудительно становится
 * `none`, и панель не обещает крепление, которого в файле не будет.
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
  const lithoFrame = params.lithoFrame ?? DEFAULT_LITHOPHANE_PARAMS.lithoFrame;
  const requestedMount = isLithophaneMount(params.lithoMount)
    ? params.lithoMount
    : DEFAULT_LITHOPHANE_PARAMS.lithoMount;

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
    lithoFrame,
    lithoMount: lithoFrame ? requestedMount : "none",
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
    ...normalizeSignParams(params),
    ...normalizeBoxParams(params),
    ...normalizeLithophaneParams(params),
    ...normalizeStandParams(params),
    ...normalizeClipsParams(params),
    ...normalizePlanterParams(params),
    ...normalizeCoasterParams(params),
    ...normalizeJewelryStandParams(params),
    ...normalizePenHolderParams(params),
    ...normalizeFabricPatchParams(params),
    ...normalizeStringLightParams(params),
    ...normalizeOrnamentParams(params),
    ...normalizeWallHookParams(params),
    ...normalizeCupClipParams(params),
    ...normalizeStencilParams(params),
  };
}
