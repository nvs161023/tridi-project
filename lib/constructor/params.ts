import {
  isHolePlacement,
  isKeychainPresetId,
  keychainPresetById,
  type HolePlacement,
  type KeychainPresetId,
} from "@/lib/constructor/keychain-presets";
import {
  DEFAULT_QR_CARD_SPEC,
  QR_CARD_CONTENT_MAX_LENGTH,
  QR_CARD_NAME_MAX_LENGTH,
  QR_CARD_SIZES,
  isQrCardSize,
  isQrCardTab,
  isQrContentType,
  isQrMode,
  type QrCardSize,
  type QrCardSpec,
  type QrCardTab,
  type QrContentType,
  type QrMode,
} from "@/lib/constructor/qr-card-geometry";

/**
 * Словарь QR-визитки живёт в `qr-card-geometry.ts`, но панели и API удобнее
 * брать его вместе с параметрами модели: один импорт на всё, что связано с
 * брелоком, и никакой возможности подключить половину набора.
 */
export type {
  QrCardSize,
  QrCardSpec,
  QrCardTab,
  QrContentType,
  QrMode,
} from "@/lib/constructor/qr-card-geometry";

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
 * шириной корпуса. Вывеска ограничена кеглем 120 мм и пятнадцатью символами:
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
export type NumericLimit = {
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
  // Цоколь и обод — декоративные, поэтому по умолчанию ноль: силуэт остаётся
  // ровно таким, каким был до появления слайдеров. Цоколь выше 12 мм и обод
  // шире 6 мм на вазе 60 мм уже спорят с силуэтом, а не дополняют его.
  footMm: { min: 0, max: 12, step: 1, defaultValue: 0, decimals: 0 },
  rimMm: { min: 0, max: 6, step: 1, defaultValue: 0, decimals: 0 },
  // Грани сечения: 0–2 — «как в силуэте» (круг у плавных, 4 и 8 у квадрата и
  // восьмигранника), 3–12 — столько граней у любой формы. Ноль по умолчанию,
  // поэтому старые вазы остаются ровно такими, какими были.
  sectionSides: { min: 0, max: 12, step: 1, defaultValue: 0, decimals: 0 },
  // Закрутка и каннелюры — деформации стенки, а не силуэт: при нулях геометрия
  // совпадает с прежней до вершины. Угол — целыми шагами по 15°: рельеф с
  // шагом 1° печатается так же, а слайдер в 720 положений неудобен.
  twistDeg: { min: 0, max: 720, step: 15, defaultValue: 0, decimals: 0 },
  // 24 жёлоба — предел, где каннелюра ещё читается, а не сливается в шум:
  // при диаметре 90 мм между жёлобами остаётся меньше 4 мм поля.
  flutes: { min: 0, max: 24, step: 1, defaultValue: 0, decimals: 0 },
  // Глубина в миллиметрах, а не «интенсивность»: 2 мм жёлоба на маленькой и
  // большой вазе выглядят одинаково. Реальный предел считает геометрия —
  // min(0.6 · стенка, 0.45 · самый узкий радиус).
  fluteDepthMm: { min: 0, max: 6, step: 0.2, defaultValue: 0, decimals: 1 },
  // Органика — складки «мятой глины» по сиду: 0 — гладкая стенка, 1 — полная
  // амплитуда. Предел считает геометрия: min(4 мм, 0.15 · самый узкий радиус),
  // чтобы кольцо не вывернулось через ось, а на большой вазе волны не выросли
  // до сантиметра.
  organic: { min: 0, max: 1, step: 0.05, defaultValue: 0, decimals: 2 },
  // Наклон — сдвиг модели по X, пропорциональный высоте: дно остаётся на столе,
  // а верх уходит в сторону. 30° при высоте 140 мм смещает кромку на 81 мм,
  // поэтому дальше начинается не декор, а падающая ваза.
  leanDeg: { min: -30, max: 30, step: 1, defaultValue: 0, decimals: 0 },
  // Сид меняет только рисунок складок и микро-вариации силуэта: размеры, число
  // граней и расход пластика от него не зависят.
  vaseSeed: { min: 1, max: 999999, step: 1, defaultValue: 1, decimals: 0 },
  // Амплитуда слоя, мм. Три миллиметра — уже глубокий рельеф: сумма всех слоёв
  // ограничена 45% самого узкого радиуса (у дефолтной вазы Ø90 × 140 это 9.4 мм),
  // поэтому три слоя по 3 мм делят бюджет пропорционально. Прежние 5 мм слайдер
  // предлагал, но вторая половина хода ничего не меняла.
  patternIntensity: {
    min: 0,
    max: 3,
    step: 0.1,
    defaultValue: 1.2,
    decimals: 1,
  },
  // Частота слоя: число повторов по окружности. 32 гребня — потолок сетки:
  // восемь выборок на период дают ровно `VASE_MAX_SEGMENTS = 256` сегментов,
  // выше которых разрешение по окружности не растёт. Соты и чешуйки считают
  // частоту вдвое мельче, поэтому у них потолок наступает раньше — это
  // записано в `vase-budget.ts`.
  patternFrequency: { min: 1, max: 32, step: 1, defaultValue: 20, decimals: 0 },
  // Фаза слоя по окружности: сдвиг узора относительно нулевого угла. Шаг 15° —
  // при частоте 20 один шаг двигает гребень на треть периода; мелкий шаг был бы
  // незаметен, а точная подгонка нужна только совмещению слоёв, и её делает
  // сохранённый проект, а не слайдер.
  patternPhaseDeg: { min: 0, max: 360, step: 15, defaultValue: 0, decimals: 0 },
  // Затухание слоя у кромки и дна, мм: 0 — слой идёт до самой полосы, которую
  // всё равно гасит геометрия ради печати. 30 мм — треть вазы высотой 90 мм;
  // больше это уже не затухание, а «узора нет на верхней половине».
  patternFadeMm: { min: 0, max: 30, step: 1, defaultValue: 5, decimals: 0 },
  length: { min: 30, max: 100, step: 1, defaultValue: 60, decimals: 0 },
  width: { min: 20, max: 50, step: 1, defaultValue: 30, decimals: 0 },
  thickness: { min: 2, max: 5, step: 0.5, defaultValue: 3, decimals: 1 },
  standAngle: { min: 45, max: 75, step: 1, defaultValue: 65, decimals: 0 },
  phoneThickness: { min: 8, max: 15, step: 1, defaultValue: 11, decimals: 0 },
  standWidth: { min: 60, max: 100, step: 5, defaultValue: 80, decimals: 0 },
  signFontSize: { min: 20, max: 120, step: 2, defaultValue: 60, decimals: 0 },
  // Меньше 11 мм полость буквы не вмещает ленту: 11 − 2 мм лица = 9 мм канала.
  signDepth: { min: 11, max: 40, step: 1, defaultValue: 18, decimals: 0 },
  signLetterGap: { min: 2, max: 20, step: 1, defaultValue: 6, decimals: 0 },
  // Сколько букв печатается одним блоком: больше пяти деталь неудобно вешать.
  signBlockSize: { min: 1, max: 5, step: 1, defaultValue: 3, decimals: 0 },
  boxWidth: { min: 40, max: 200, step: 5, defaultValue: 140, decimals: 0 },
  boxDepth: { min: 40, max: 200, step: 5, defaultValue: 100, decimals: 0 },
  boxHeight: { min: 40, max: 200, step: 5, defaultValue: 60, decimals: 0 },
  // Стенка 1.2 мм — минимальная прочная толщина для бытового органайзера:
  // тоньше периметр начинает пружинить и коробку ведёт после остывания.
  boxWall: { min: 1.2, max: 3, step: 0.1, defaultValue: 1.6, decimals: 1 },
  // Радиус задаёт и наружный контур, и внутреннюю полость. 5 мм убирают
  // острые углы, но оставляют стенке одинаковую толщину по всему периметру.
  boxCornerRadius: { min: 0, max: 20, step: 1, defaultValue: 5, decimals: 0 },
  // Количество перегородок, а не ячеек: 0 — пустая коробка, 1 — пополам.
  boxDividers: { min: 0, max: 3, step: 1, defaultValue: 1, decimals: 0 },
  lithophaneWidth: { min: 40, max: 200, step: 5, defaultValue: 120, decimals: 0 },
  lithophaneHeight: {
    min: 40,
    max: 200,
    step: 5,
    defaultValue: 80,
    decimals: 0,
  },
  // Толщина светлых участков. 0.8 мм — стандарт: свет проходит, а пластик ещё
  // держит форму при печати и сборке. Нижняя граница 0.6 мм нужна логотипу:
  // прозрачный фон печатается минимальной толщиной, и с максимумом 3.5 мм знак
  // не сливается с фоном. Верх диапазона 2 мм — для тёмных кадров и крупных
  // панелей, где светлые участки и так почти не просвечивают.
  lithophaneMinThickness: {
    min: 0.6,
    max: 2,
    step: 0.1,
    defaultValue: 0.8,
    decimals: 1,
  },
  // Толщина тёмных участков, текста и рамки. 3 мм — стандарт: рельеф читается, а
  // печать не растягивается. 5 мм — для кадров, где нужен глубокий рельеф
  // (крупный текст и логотип): перепад с минимумом 0.8 мм доходит до 4.2 мм, и
  // буквы печатаются заметно глубже. Плита с таким перепадом печатается дольше,
  // но остаётся в габарите рамки: лицевая плоскость считается по максимуму.
  // Ниже 2 мм перепад с минимумом уходил бы в ноль.
  lithophaneMaxThickness: {
    min: 2,
    max: 5,
    step: 0.1,
    defaultValue: 3,
    decimals: 1,
  },
  // Число панелей круглого плафона. Ручного слайдера больше нет: плафон делится
  // ровно на столько панелей, сколько загружено фото, поэтому границы — это один
  // цельный абажур (360°) и четыре панели по 90°. Пять и больше не бывает: слотов
  // под отдельные фото всего три. Границы остались для нормализации сохранённых
  // проектов и проверки API, а значение в состоянии всегда вычисленное.
  lithophanePanels: {
    min: 1,
    max: 4,
    step: 1,
    defaultValue: 4,
    decimals: 0,
  },
  // Расстояние от плоскости панели до лицевой плоскости кольца: по нему ножка
  // кольца скользит по пазу полоза вдоль Z. 20 мм — кольцо почти у рельефа, 90 мм
  // — уходит в тыл, и перед патроном остаётся 90 мм на лампочку: 60 мм хватает
  // даже крупному E27. Полоз 100 мм держит ножку на всём диапазоне.
  lithoRailDistance: {
    min: 20,
    max: 90,
    step: 5,
    defaultValue: 40,
    decimals: 0,
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
  // Термопринт: лист A4 — 210 мм, поэтому 200 мм — самый крупный принт,
  // который ещё переносится на футболку целиком.
  heatTransferWidth: {
    min: 20,
    max: 200,
    step: 5,
    defaultValue: 100,
    decimals: 0,
  },
  heatTransferHeight: {
    min: 20,
    max: 200,
    step: 5,
    defaultValue: 100,
    decimals: 0,
  },
  // Толщина задаётся слоями по 0.2 мм: 0.4 мм гнётся по ткани, 0.8 мм — уже
  // пластиковая нашлёпка.
  heatTransferLayers: {
    min: 1,
    max: 4,
    step: 1,
    defaultValue: 2,
    decimals: 0,
  },
} as const satisfies Record<string, NumericLimit>;

/** Типы моделей, которые умеет собирать конструктор. */
export const MODEL_TYPES = [
  "vase",
  "keychain",
  "sign",
  "box",
  "lithophane",
  "stand",
  "planter",
  "coaster",
  "jewelry_stand",
  "pen_holder",
  "heat_transfer",
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
  planter: "Кашпо",
  coaster: "Подставка под кружку",
  jewelry_stand: "Подставка для украшений",
  pen_holder: "Органайзер для ручек",
  heat_transfer: "Термопринт",
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
    desc: "Параметрические вазы: двенадцать силуэтов, математические волны, закрутка, грани и точные размеры под ваш принтер.",
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
    id: "heat_transfer",
    title: "Генератор термопринтов",
    desc: "Логотип из PNG или SVG превращается в тонкую наклейку: контуры, зеркало и толщина в слоях под ткань.",
  },
];

/**
 * Пресеты силуэта. Значение — часть состояния модели, а не размер: профиль
 * строится в lib/constructor/vase-profile.ts по этим идентификаторам.
 *
 * square и octagon — не просто другой силуэт: их сечение в плане
 * превращается в правильный многоугольник в lib/constructor/vase-section.ts.
 * Профиль по высоте остаётся плавным, а радиус зависит от угла, поэтому
 * квадратная ваза сохраняет толщину стенки на гранях и в углах. Слайдер «Грани»
 * обобщает это на любое сечение от 3 до 12 граней.
 *
 * mushroom, bud, bottle и bubble добавились на этапе «новые силуэты»: это только
 * новые наборы опорных точек профиля, код геометрии и панели они не трогают.
 * У mushroom широкая шляпка на узкой ножке, у bud силуэт сходится к узкой
 * горловине, у bottle плечо и горлышко графина, у bubble стопка из трёх сфер.
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
  "mushroom",
  "bud",
  "bottle",
  "bubble",
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
  mushroom: "Гриб",
  bud: "Бутон",
  bottle: "Бутыль",
  bubble: "Пузыри",
} as const satisfies Record<VaseShape, string>;

/**
 * Математические узоры на стенке.
 *
 * smooth — ровная поверхность; spiral — косая спираль; ribs — вертикальные
 * рёбра; waves — горизонтальные волны; honeycomb — шестиугольные соты из трёх
 * синусоид, повёрнутых на 60°; scales — перекрывающиеся чешуйки из синуса и
 * косинуса с разными фазами; basket — плетение «над-под» из полос по кругу и по
 * высоте; chevron — галочки, у которых фаза полосы ломается по высоте; moire —
 * интерференция двух решёток под прямым углом; flutes — каннелюры: острые
 * жёлоба с широкими гребнями вместо синусоиды рёбер. Узор не добавляет вершины:
 * он смещает существующие точки LatheGeometry, поэтому число треугольников не
 * меняется, а наружная и внутренняя стенки сдвигаются на одну величину —
 * толщина остаётся прежней.
 */
export const VASE_PATTERNS = [
  "smooth",
  "spiral",
  "ribs",
  "waves",
  "honeycomb",
  "scales",
  "basket",
  "chevron",
  "moire",
  "flutes",
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
  basket: "Плетение",
  chevron: "Шеврон",
  moire: "Муар",
  flutes: "Каннелюры",
} as const satisfies Record<VasePattern, string>;

/**
 * Сколько слоёв узора помещается на одной вазе.
 *
 * Три — предел композиции, а не техники: рёбра, спираль и волны вместе уже дают
 * рябь, в которой не читается ни один рисунок, а цикл по вершинам и бюджет
 * сегментов растут линейно по числу слоёв. Ограничение общее для нормализации и
 * API, поэтому «лишние» слои не отвергаются по-разному в разных местах.
 */
export const VASE_MAX_PATTERN_LAYERS = 3;

/**
 * Затухание слоя у кромки по умолчанию, мм.
 *
 * Пять миллиметров — та же полоса, что держит кромку ровным кольцом
 * (`RIM_FADE_MM` в геометрии): она нужна не узору, а печати. Декор гасится
 * раньше, потому что у кромки рельеф читается как брак литья, а не как рисунок.
 */
export const VASE_DEFAULT_FADE_TOP_MM = 5;

/**
 * Затухание слоя у дна по умолчанию, мм.
 *
 * Три миллиметра — один-два слоя печати: первый слой должен лечь полным диском,
 * иначе край дна идёт волной и хуже держится за стол.
 */
export const VASE_DEFAULT_FADE_BOTTOM_MM = 3;

/**
 * Один слой узора на стенке.
 *
 * Слой — это самостоятельный рисунок со своей силой, частотой, фазой и
 * затуханием у краёв. Композиция из 1–3 слоёв даёт рельеф, которого не получить
 * одним узором: рёбра и спираль вместе читаются как кручёная грань, волны поверх
 * рёбер — как стихийная керамика. Слои складываются, а не заменяют друг друга:
 *
 *   Δr(θ, v) = Σ amplitude × shape(type, θ, frequency, phase) × envelope(v)
 *
 * `amplitude` — в миллиметрах, как и прежняя «сила узора»: два миллиметра рёбер
 * выглядят одинаково на маленькой и большой вазе. Сумма амплитуд всех слоёв
 * ограничена геометрией (45% самого узкого радиуса), поэтому глубокая
 * композиция не выворачивает кольцо через ось.
 *
 * `envelope` — затухание у кромки и дна в миллиметрах, а не «проценты высоты»:
 * пять миллиметров у вазы на 90 и на 200 мм означают одно и то же для печати.
 * Ноль выключает затухание совсем — так открываются проекты, сохранённые до
 * появления слоёв (см. `resolvePatternLayers`).
 */
export type PatternLayer = {
  /** Тип рисунка; `smooth` — слой есть, но ничего не смещает. */
  type: VasePattern;
  /** Амплитуда смещения стенки, мм; 0 — слой молчит. */
  amplitude: number;
  /** Частота повторов: число гребней по окружности. */
  frequency: number;
  /** Сдвиг фазы, градусы: совмещает слои друг с другом. */
  phaseDeg: number;
  /** Затухание слоя у кромки и дна, мм. */
  envelope: {
    fadeTopMm: number;
    fadeBottomMm: number;
  };
};

/**
 * Пресет брелока по умолчанию: с него начинается модель и «Сброс».
 *
 * Он же — единственный источник формы. Своего контура больше нет: загрузка
 * силуэта детали убрана из панели, потому что владелец тестировал формы живьём и
 * своя обводка в печати не прижилась. Пресеты строятся кодом
 * (`lib/constructor/keychain-presets.ts`), поэтому в модели всегда есть
 * геометрия, а ушко под кольцо, фаска и карман под метку считаются по одним
 * числам.
 *
 * Старые проекты с `custom` открываются этим пресетом: нормализация не находит в
 * них `keychainPreset` и подставляет `DEFAULT_KEYCHAIN_PRESET_ID`.
 */
export const DEFAULT_KEYCHAIN_PRESET_ID: KeychainPresetId = "apple-tag";

/**
 * Предел размера загруженного SVG, символов.
 *
 * В брелоке так ограничен только логотип термопринта: своего контура у него
 * больше нет, но SVG логотипа разбирается тем же парсером без DOM.
 */
export const CUSTOM_SVG_MAX_LENGTH = 200_000;

/**
 * Границы толщины QR-визитки, мм.
 *
 * Уже общих 2–5: визитка лежит в кармане плашмя, и на 2 мм пластик под кольцом
 * прогибается, а на 5 мм выпуклый рельеф 0.4 мм перестаёт читаться пальцем.
 * Шаг и точность те же, что у общего слайдера, — панель показывает одни и те же
 * миллиметры.
 */
export const QR_CARD_THICKNESS_LIMITS = {
  min: 2.5,
  max: 3.5,
  step: 0.5,
  defaultValue: 3,
  decimals: 1,
} satisfies NumericLimit;

/**
 * Границы толщины для выбранного пресета.
 *
 * Одна функция на панель, нормализацию и API: у QR-визитки свой диапазон, у
 * остальных пресетов — общий. Разойтись они не могут, потому что слайдер,
 * округление и серверная проверка читают одно число.
 */
export function keychainThicknessLimits(
  preset?: KeychainPresetId | null,
): NumericLimit {
  return preset === "qr-card"
    ? QR_CARD_THICKNESS_LIMITS
    : CONSTRUCTOR_LIMITS.thickness;
}

/**
 * Содержимое визитки из параметров модели.
 *
 * Одна функция на предпросмотр, панель и API: матрица кода строится из того же
 * объекта, поэтому подпись «модуль 0.85 мм» и файл не могут разойтись.
 * Габарит и крепление остаются полями силуэта (`qrCardSize`, `qrCardTab`), а
 * рельеф и содержимое живут в декорации `qr`: содержимое кода — это декорация, а
 * размер и крепление меняют саму заготовку.
 */
export function keychainQrCardSpec(params: KeychainParams): QrCardSpec {
  const qr = keychainQrDecoration(params.decorations);

  return {
    size: params.qrCardSize,
    tab: params.qrCardTab,
    mode: qr?.qrMode ?? DEFAULT_QR_CARD_SPEC.mode,
    contentType: qr?.qrContentType ?? DEFAULT_QR_CARD_SPEC.contentType,
    content: qr?.qrContent ?? DEFAULT_QR_CARD_SPEC.content,
    name: qr?.qrName ?? DEFAULT_QR_CARD_SPEC.name,
    phone: qr?.qrPhone ?? DEFAULT_QR_CARD_SPEC.phone,
  };
}

/** Декорация нужного вида или null: список короткий, поиск дешёвый. */
function findKeychainDecoration<K extends KeychainDecorationKind>(
  decorations: readonly KeychainDecoration[] | undefined,
  kind: K,
): Extract<KeychainDecoration, { kind: K }> | null {
  const found = decorations?.find((decoration) => decoration.kind === kind);

  return (found as Extract<KeychainDecoration, { kind: K }> | undefined) ?? null;
}

/** Надпись на брелоке или null, если её нет в списке. */
export function keychainTextDecoration(
  decorations: readonly KeychainDecoration[] | undefined,
): KeychainTextDecoration | null {
  return findKeychainDecoration(decorations, "text");
}

/** Картинка на брелоке или null. */
export function keychainImageDecoration(
  decorations: readonly KeychainDecoration[] | undefined,
): KeychainImageDecoration | null {
  return findKeychainDecoration(decorations, "image");
}

/** Декорация QR-кода или null: у остальных силуэтов её может не быть. */
export function keychainQrDecoration(
  decorations: readonly KeychainDecoration[] | undefined,
): KeychainQrDecoration | null {
  return findKeychainDecoration(decorations, "qr");
}

/**
 * Шрифты, которые нужны модели.
 *
 * Сцена грузит JSON-файлы только для тех наборов, что выбраны в декорациях:
 * переключение на PT Serif не тянет Roboto, а брелок без надписи не грузит
 * ничего. Серверный роут берёт тот же список, поэтому файл и предпросмотр
 * собираются из одинаковых шрифтов.
 */
export function keychainDecorationFonts(
  decorations: readonly KeychainDecoration[] | undefined,
): KeychainFontId[] {
  const fonts = new Set<KeychainFontId>();

  for (const decoration of decorations ?? []) {
    if (decoration.kind === "text") {
      fonts.add(decoration.font);
    }
  }

  return [...fonts];
}



/**
 * Подпись формы брелока для панели, сводки и aria-описания сцены.
 *
 * Форму задаёт пресет из реестра, поэтому подпись берётся из его `label`. Одна
 * функция на все места не даёт подписям разойтись: пока пресет жил в отдельном
 * состоянии панели, сводка читала силуэт и показывала форму, которой в модели
 * уже не было.
 */
export function keychainShapeLabel(params: {
  keychainPreset?: KeychainPresetId | null;
}): string {
  return keychainPresetById(
    params.keychainPreset ?? DEFAULT_KEYCHAIN_PRESET_ID,
  ).label;
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
 * Префикс `imageData` нового формата: готовая маска-растр в base64.
 *
 * В параметрах лежит не файл и не SVG-обводка, а поле покрытия картинки: 400 ячеек
 * по длинной стороне, 4 бита на ячейку (16 уровней «сколько краски»). Такой растр
 * занимает ~104 КБ в base64 (сетка 400 × 400 — это 80 002 байта), поэтому предел
 * длины считается под него. По этому полю строят рельеф и геометрия, и превью маски
 * в панели — один и тот же код (`keychain-image.ts`).
 *
 * Заголовок маски начинается с байта 0 и двух uint16 (ширина, высота): прежние маски
 * писали габарит двумя байтами и читаются по-прежнему, а новая сетка в байт не влезает.
 */
export const KEYCHAIN_IMAGE_FIELD_PREFIX = "data:image/x-keychain-mask;base64,";

/**
 * Прежний префикс `imageData`: маска хранилась как SVG-обводка в base64.
 *
 * Проекты, сохранённые до поля покрытия, открываются как есть: геометрия читает
 * оба формата, а новая картинка пишется уже полем.
 */
export const KEYCHAIN_IMAGE_PREFIX = "data:image/svg+xml;base64,";

/**
 * Предел длины `imageData`, символов: примерно 128 КБ маски.
 *
 * Считан под сетку 400: 400 × 400 ячеек по четыре бита дают 80 002 байта, в base64
 * это 106 672 знака плюс префикс. Запас в 21 КБ оставлен на квадратную картинку с
 * неровной стороной и на будущий рост сетки без правки нормализации.
 */
export const KEYCHAIN_IMAGE_MAX_LENGTH = 128 * 1024;

/**
 * Порог яркости картинки, проценты.
 *
 * Ячейка темнее порога становится пластиком, светлее — остаётся фоном. Порог выше
 * — в рельеф идёт больше полутонов и картинка плотнее, ниже — остаётся только
 * самое тёмное. У PNG с прозрачностью от порога зависит только сглаженный край:
 * фигуру задаёт альфа. Дизеринга нет, маска бинарная, а белый фон не печатается
 * никогда (границу держит `MIN_INK_SHARE` в `keychain-image.ts`).
 */
export const KEYCHAIN_IMAGE_THRESHOLD_LIMITS: NumericLimit = {
  min: 10,
  max: 90,
  step: 5,
  defaultValue: 50,
  decimals: 0,
};

/**
 * Масштаб картинки относительно свободной полосы грани.
 *
 * 1.0 — картинка вписана в полосу целиком; меньше — логотип меньше, больше —
 * крупнее, если место позволяет. При 2.0 картинка ужимается сама: рельеф не
 * может выйти за брелок или наехать на буквы.
 */
export const KEYCHAIN_IMAGE_SCALE_LIMITS: NumericLimit = {
  min: 0.5,
  max: 2,
  step: 0.1,
  defaultValue: 1,
  decimals: 1,
};

/**
 * Толщина рельефа картинки над пластиком, мм.
 *
 * Как у имени: 0.35 мм картинка входит в тело и не считается. 0.2 мм — почти
 * гравировка, 1 мм — выпуклый логотип, который читается на ощупь.
 */
export const KEYCHAIN_IMAGE_DEPTH_LIMITS: NumericLimit = {
  min: 0.2,
  max: 1,
  step: 0.1,
  defaultValue: 0.6,
  decimals: 1,
};

/**
 * Похоже ли значение на маску картинки брелока.
 *
 * Проверяются только формат и предел длины: поле покрытия разбирает геометрия, а
 * нормализация должна оставаться дешёвой — она вызывается на каждый слайдер.
 * Принимаются оба формата: поле нового образца и сохранённая SVG-обводка.
 */
export function isKeychainImageData(value: unknown): value is string {
  if (typeof value !== "string" || value.length > KEYCHAIN_IMAGE_MAX_LENGTH) {
    return false;
  }

  const prefix = value.startsWith(KEYCHAIN_IMAGE_FIELD_PREFIX)
    ? KEYCHAIN_IMAGE_FIELD_PREFIX
    : value.startsWith(KEYCHAIN_IMAGE_PREFIX)
      ? KEYCHAIN_IMAGE_PREFIX
      : null;

  if (!prefix) {
    return false;
  }

  const payload = value.slice(prefix.length);

  return payload.length > 0 && /^[A-Za-z0-9+/=]+$/.test(payload);
}

/**
 * Смещение любой декорации по X и Y, мм.
 *
 * Диапазон шире любого силуэта: смещение — просьба, а геометрия обрезает его по
 * свободному месту грани. Слайдер в 20 мм позволяет увести имя к краю, но не
 * дальше: рельеф останавливается на границе пластика сам.
 */
export const KEYCHAIN_DECORATION_OFFSET_LIMITS: NumericLimit = {
  min: -20,
  max: 20,
  step: 1,
  defaultValue: 0,
  decimals: 0,
};

/**
 * Толщина рельефа декорации над пластиком, мм.
 *
 * Внедрение в тело (0.35 мм) не входит в это число и не настраивается: слайдер
 * задаёт только видимую высоту рельефа. 0.2 мм — почти гравировка, 1 мм —
 * выпуклый рельеф, который читается на ощупь даже на тонкой основе.
 */
export const KEYCHAIN_DECORATION_DEPTH_LIMITS: NumericLimit = {
  min: 0.2,
  max: 1,
  step: 0.1,
  defaultValue: 0.8,
  decimals: 1,
};

/**
 * Межстрочный интервал надписи, доли кегля.
 *
 * Кегль — это размер буквы в миллиметрах, поэтому шаг строки считается как
 * `lineHeight · кегль`: 0.8 — строки почти слипаются, 1.2 — обычный набор,
 * 2.0 — разрядка в две высоты буквы.
 */
export const KEYCHAIN_TEXT_LINE_HEIGHT_LIMITS: NumericLimit = {
  min: 0.8,
  max: 2,
  step: 0.1,
  defaultValue: 1.2,
  decimals: 1,
};

/**
 * Символы, которые есть в Roboto Bold и которые пропускает серверная
 * проверка. Латиница и любая кириллица покрывают имена, цифры — даты и
 * номера, пробел и знаки — двойные имена.
 */
const TEXT_CHAR = /^[A-Za-z0-9 .,'’\-\p{Script=Cyrillic}]$/u;

/**
 * Шрифты надписи на брелоке.
 *
 * Все три файла лежат в `public/fonts` в legacy-формате three.js и покрывают
 * кириллицу: `sans-bold` — Roboto Bold (тот же, что у вывески), `sans` — Roboto
 * Regular, `serif` — PT Serif Bold. Ключи короткие и латинские: они попадают в
 * параметры проекта, а не в имя файла, поэтому кириллица в них не нужна.
 */
export const KEYCHAIN_FONTS = ["sans-bold", "sans", "serif"] as const;

export type KeychainFontId = (typeof KEYCHAIN_FONTS)[number];

/** Подписи шрифтов для панели: имена наборов не переводятся. */
export const KEYCHAIN_FONT_LABELS = {
  "sans-bold": "Roboto Bold",
  sans: "Roboto Regular",
  serif: "PT Serif Bold",
} as const satisfies Record<KeychainFontId, string>;

/**
 * Пути шрифтов: их грузит браузер и читает серверный роут.
 *
 * Реестр один, поэтому набор в панели, предпросмотр и API не могут разойтись:
 * ключ декорации превращается в файл одной функцией `keychainFontUrl`.
 */
export const KEYCHAIN_FONT_URLS = {
  "sans-bold": "/fonts/cyrillic.typeface.json",
  sans: "/fonts/roboto-regular.typeface.json",
  serif: "/fonts/pt-serif-bold.typeface.json",
} as const satisfies Record<KeychainFontId, string>;

export function isKeychainFontId(value: unknown): value is KeychainFontId {
  return (
    typeof value === "string" &&
    (KEYCHAIN_FONTS as readonly string[]).includes(value)
  );
}

/** Путь JSON-файла шрифта по ключу декорации. */
export function keychainFontUrl(font: KeychainFontId): string {
  return KEYCHAIN_FONT_URLS[font];
}

/**
 * Повороты декорации в плоскости грани, градусы.
 *
 * Набор фиксированный, а не слайдер: косой поворот текста на брелоке читается
 * хуже прямого, и произвольный угол давал бы столько же сборок модели, сколько
 * положений слайдера. 90° и 270° нужны вертикальным именам, 45° и 135° — угловым
 * композициям, 180° — имени вверх ногами на обороте.
 */
export const KEYCHAIN_DECORATION_ROTATIONS = [0, 45, 90, 135, 180, 270] as const;

export type KeychainRotation = (typeof KEYCHAIN_DECORATION_ROTATIONS)[number];

export function isKeychainRotation(value: unknown): value is KeychainRotation {
  return (
    typeof value === "number" &&
    (KEYCHAIN_DECORATION_ROTATIONS as readonly number[]).includes(value)
  );
}

/**
 * Сторона, на которую просится декорация.
 *
 * `auto` — самая свободная: лицо, а если там нет места, то оборот. `front` и
 * `back` — просьба, а не приказ: если на выбранной стороне места нет, рельеф не
 * печатается вовсе, и панель говорит об этом.
 */
export const KEYCHAIN_DECORATION_SIDES = ["auto", "front", "back"] as const;

export type KeychainDecorationSide = (typeof KEYCHAIN_DECORATION_SIDES)[number];

export const KEYCHAIN_DECORATION_SIDE_LABELS = {
  auto: "Любая сторона",
  front: "Только лицо",
  back: "Только оборот",
} as const satisfies Record<KeychainDecorationSide, string>;

export function isKeychainDecorationSide(
  value: unknown,
): value is KeychainDecorationSide {
  return (
    typeof value === "string" &&
    (KEYCHAIN_DECORATION_SIDES as readonly string[]).includes(value)
  );
}

/** Выравнивание строк многострочной надписи. */
export const KEYCHAIN_TEXT_ALIGNS = ["left", "center", "right"] as const;

export type KeychainTextAlign = (typeof KEYCHAIN_TEXT_ALIGNS)[number];

export const KEYCHAIN_TEXT_ALIGN_LABELS = {
  left: "По левому краю",
  center: "По центру",
  right: "По правому краю",
} as const satisfies Record<KeychainTextAlign, string>;

export function isKeychainTextAlign(
  value: unknown,
): value is KeychainTextAlign {
  return (
    typeof value === "string" &&
    (KEYCHAIN_TEXT_ALIGNS as readonly string[]).includes(value)
  );
}

/**
 * Сколько декораций держит брелок: надпись, картинка и QR-код.
 *
 * Больше трёх рельефов на грани 30 × 60 мм не помещается: карта свободного места
 * 0.4 мм показывает, что четвёртая декорация либо не встанет, либо съест кегль
 * имени до нечитаемого.
 */
export const KEYCHAIN_MAX_DECORATIONS = 3;

/** Сколько строк в надписи: три строки по 10 символов — предел грани. */
export const KEYCHAIN_TEXT_MAX_LINES = 3;


/** Виды декораций: по одной каждого вида на брелоке. */
export const KEYCHAIN_DECORATION_KINDS = ["text", "image", "qr"] as const;

export type KeychainDecorationKind =
  (typeof KEYCHAIN_DECORATION_KINDS)[number];

export const KEYCHAIN_DECORATION_KIND_LABELS = {
  text: "Текст",
  image: "Картинка",
  qr: "QR-код",
} as const satisfies Record<KeychainDecorationKind, string>;

export function isKeychainDecorationKind(
  value: unknown,
): value is KeychainDecorationKind {
  return (
    typeof value === "string" &&
    (KEYCHAIN_DECORATION_KINDS as readonly string[]).includes(value)
  );
}

/**
 * Общие поля любой декорации грани.
 *
 * `id` — стабильный ключ для списка в панели. Декораций каждого вида не больше
 * одной, поэтому нормализация пишет в `id` вид: он не зависит от случайностей и
 * переживает сохранение проекта, а список в интерфейсе не пересоздаётся.
 */
type KeychainDecorationBase = {
  id: string;
  /** Смещение от центра свободной полосы, мм: просьба, обрезается картой. */
  offsetX: number;
  /** Смещение по Y, мм: вверх — плюс. */
  offsetY: number;
  /** Поворот в плоскости грани, градусы. */
  rotation: KeychainRotation;
  /** Высота рельефа над пластиком, мм; внедрение 0.35 мм не входит. */
  depth: number;
  /** Сторона грани: любая, только лицо или только оборот. */
  side: KeychainDecorationSide;
};

/**
 * Надпись на грани: строки, шрифт и выравнивание.
 *
 * `content` хранит переводы строк как есть (`\n`), поэтому многострочное имя
 * переживает сохранение проекта одной строкой. `lineHeight` — шаг строки в долях
 * кегля, `align` — выравнивание строк в блоке: у короткой второй строки при
 * центрировании остаётся симметричный отступ.
 */
export type KeychainTextDecoration = KeychainDecorationBase & {
  kind: "text";
  content: string;
  font: KeychainFontId;
  align: KeychainTextAlign;
  lineHeight: number;
};

/**
 * Картинка на грани: маска рельефа и её происхождение.
 *
 * `imageData` — маска-растр в base64 (`KEYCHAIN_IMAGE_FIELD_PREFIX`): по ней
 * строятся и контуры рельефа, и превью в панели. `imageName` — имя загруженного
 * файла для панели: в геометрии оно не нужно, но без него после перезагрузки
 * проекта карточка логотипа обезличена. `imageThreshold` — порог яркости в
 * процентах: выше порог — больше полутонов уходит в пластик, ниже — рельефом
 * остаётся только самое тёмное. `imageInvert` меняет пластик и фон местами — для
 * логотипов светлым по тёмному; по умолчанию выключен, поэтому проекты прежних
 * версий печатаются как раньше.
 */
export type KeychainImageDecoration = KeychainDecorationBase & {
  kind: "image";
  imageData: string;
  imageScale: number;
  imageName: string;
  imageThreshold: number;
  imageInvert: boolean;
};

/**
 * QR-код визитки как декорация.
 *
 * Код целиком занимает лицо визитки, поэтому его нельзя двигать и поворачивать:
 * поля общих настроек у него всегда нейтральные, а печатает его силуэт
 * (`qr-card-geometry.ts`), а не общий конвейер рельефов. В массиве декораций он
 * живёт ради единой схемы и ради памяти содержимого: ссылка и имя визитки
 * сохраняются в проекте, даже если силуэт временно выбран другой.
 */
export type KeychainQrDecoration = KeychainDecorationBase & {
  kind: "qr";
  qrMode: QrMode;
  qrContentType: QrContentType;
  qrContent: string;
  qrName: string;
  qrPhone: string;
};

/** Любая декорация грани: вид различается полем `kind`. */
export type KeychainDecoration =
  | KeychainTextDecoration
  | KeychainImageDecoration
  | KeychainQrDecoration;

/**
 * Плоские поля прежних проектов.
 *
 * До массива декораций надпись и картинка жили отдельными полями, а визитка —
 * ещё и своими. Нормализация читает их ради миграции, но в готовых параметрах
 * этих полей нет: единственный источник рельефа — `decorations`.
 */
export type KeychainDecorationsInput = {
  decorations?: readonly unknown[];
  text?: string;
  showText?: boolean;
  textOffsetX?: number;
  textOffsetY?: number;
  textDepth?: number;
  imageData?: string | null;
  imageOffsetX?: number;
  imageOffsetY?: number;
  imageScale?: number;
  imageDepth?: number;
  qrMode?: QrMode;
  qrContentType?: QrContentType;
  qrContent?: string;
  qrName?: string;
  qrPhone?: string;
};

/** Настраиваемые размеры, имя, силуэт и NFC-углубление брелока. */
export type KeychainParams = {
  /** Длина заготовки сверху вниз, мм; ушко входит в этот габарит. */
  length: number;
  /** Ширина в самой широкой части, мм. */
  width: number;
  /** Толщина основы, мм; рельеф декораций выступает над ней. */
  thickness: number;
  /**
   * Рельефы на гранях: надпись, картинка и QR-код.
   *
   * Массив вместо плоских полей. Каждый вид встречается не больше одного раза, а
   * весь список — не длиннее `KEYCHAIN_MAX_DECORATIONS`. Порядок нормализация
   * держит фиксированным (текст, картинка, QR), потому что он же задаёт карточки
   * в панели; порядок постановки на грань считает геометрия: сначала картинка —
   * она крупнее и хуже переносит ужимание, потом буквы, кегль которых
   * подбирается по остатку полосы.
   *
   * Пустой массив — брелок без рельефа: так печатают заготовку под гравировку.
   * Старые проекты поля не знают: их плоские поля собирает в массив миграция
   * (`normalizeKeychainParams`).
   */
  decorations: KeychainDecoration[];
  /**
   * Пресет силуэта из `lib/constructor/keychain-presets.ts`.
   *
   * Единственный источник формы: своего контура больше нет. Нормализация всегда
   * держит здесь идентификатор из реестра — проект со старым `custom` получает
   * `DEFAULT_KEYCHAIN_PRESET_ID`, поэтому предпросмотр и экспорт никогда не
   * остаются без геометрии.
   */
  keychainPreset?: KeychainPresetId | null;
  /** Вырезать с обратной стороны карман 25 × 25 мм под NFC-метку. */
  nfcEnabled: boolean;
  /**
   * Куда ставить отверстие Ø5 мм под кольцо.
   *
   * Одно поле на все пресеты: доступный набор лежит в реестре
   * (`holePlacements`), и нормализация держит значение внутри него — присланная
   * позиция, которой у силуэта нет, молча становится `center`. Так же ведёт себя
   * `nfcEnabled`: включённый признак у пресета без `nfcPocketY` гасится, а не
   * обещает ушко, которого в модели не будет.
   */
  holePlacement: HolePlacement;
  /**
   * Размер QR-визитки: 60 × 40 или 70 × 45 мм.
   *
   * Габарит визитки определяется кодом, а не слайдером: оба размера шире
   * границы `width` (50 мм), поэтому ширина с высотой выводятся из этого поля, а
   * слайдеры размеров в панели скрыты. У остальных пресетов поле не влияет ни на
   * что — это память выбора на случай возврата к визитке.
   */
  qrCardSize: QrCardSize;
  /** Крепление визитки: проушина Ø11 мм сверху или отверстие Ø5 мм в теле. */
  qrCardTab: QrCardTab;
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
  /**
   * Слои узора: от одного до `VASE_MAX_PATTERN_LAYERS`.
   *
   * Один слой — прежний узор, три — композиция. Порядок слоёв не важен: они
   * складываются. Каждый слой несёт свою амплитуду в миллиметрах, частоту, фазу
   * и затухание у кромки и дна; пустой список нормализация заменяет гладким
   * слоем, поэтому в параметрах всегда есть хотя бы один элемент.
   */
  patterns: PatternLayer[];
  /**
   * Высота прямого цоколя, мм.
   *
   * Нижние `footMm` миллиметров модели идут вертикальной стенкой на радиусе
   * силуэта у дна, а сам силуэт сжимается в оставшуюся высоту. Первый слой
   * ложится полным диском без нависаний, поэтому ваза не отрывается от стола и
   * не обрастает «юбкой» от растекания пластика.
   */
  footMm: number;
  /**
   * Насколько обод шире стенки, мм.
   *
   * Кромка горла расширяется наружу раструбом на высоте `rimMm` (45°, без
   * поддержек); полость при этом расширяется на ту же величину, поэтому стенка
   * у кромки сохраняет толщину. Обод не выходит за заданный диаметр: у
   * цилиндра, где горло и так самое широкое место, слайдер ничего не меняет.
   */
  rimMm: number;
  /**
   * Грани сечения: 0 — «как в силуэте», 3–12 — столько граней у любой формы.
   *
   * Сечение в плане — правильный N-угольник: плоские грани и острые углы, вид
   * «кристалла» или low-poly вазы. Стенка при этом остаётся заданной по нормали
   * (`vase-section.ts` отдаёт сжатие грани, а геометрия строит внутренний контур
   * вписанным многоугольником). Габарит не выходит за `diameter`: углы ложатся
   * ровно на радиус, грани — на `diameter / 2 · cos(π/N)`.
   */
  sectionSides: number;
  /**
   * Закрутка рельефа по высоте, градусы: 0 — без закрутки, 720 — два оборота.
   *
   * Фаза угла растёт от дна к кромке, поэтому грани, каннелюры и узор идут по
   * спирали. Ровный круг от закрутки не меняется: у него нечему закручиваться.
   * Угловое положение вершин при этом остаётся прежним — меняется только фаза
   * формул, поэтому шов окружности сходится при любом угле (`vase-deformation.ts`).
   */
  twistDeg: number;
  /**
   * Число каннелюр по кругу: 0 — ровная стенка, 1–24 — столько жёлобов.
   *
   * Жёлоб — это канавка с плоским дном, а не синус узора «рёбра»: глубина
   * задаётся в миллиметрах и не зависит от диаметра, поэтому 2 мм на маленькой
   * и большой вазе выглядят одинаково. Стенка сохраняет толщину: внешняя и
   * внутренняя поверхности смещаются на одну величину.
   */
  flutes: number;
  /** Глубина каннелюры, мм; ограничена стенкой и радиусом (см. `flutes`). */
  fluteDepthMm: number;
  /**
   * Органика: 0 — гладкая стенка, 1 — складки полной глубины.
   *
   * Детерминированный шум по сиду (`vase-seed.ts`) смещает стенку наружу и
   * внутрь двумя октавами: крупные складки через всю вазу и мелкая рябь поверх.
   * Смещение получают обе поверхности одинаково, поэтому толщина стенки
   * сохраняется, а у дна и под кромкой амплитуда гаснет — первый слой ложится
   * полным диском, венец остаётся ровным. Предел — min(4 мм, 0.15 · самый узкий
   * радиус): сумма с узором и каннелюрами на каждой высоте укладывается в ту же
   * долю радиуса, что и у них.
   */
  organic: number;
  /**
   * Наклон модели, градусы от вертикали: −30…30, 0 — ровная ваза.
   *
   * Верх сдвигается по X пропорционально высоте, дно остаётся на столе. Это
   * тот же приём, что у карандаша, поставленного под углом: горизонтальные
   * сечения не меняются, поэтому толщина стенки и объём сохраняются. Габарит по
   * X растёт на `tan(угол) · высота`, а одна сторона стенки становится круче —
   * при больших углах печать требует поддержек.
   */
  leanDeg: number;
  /**
   * Сид шума, целое 1…999999.
   *
   * «Другая ваза» меняет только его: силуэт, размеры и число граней остаются, а
   * рисунок складок и микро-вариации профиля — новые. Один и тот же сид даёт
   * одну и ту же геометрию на клиенте и в API, поэтому рецепт из проекта
   * воспроизводим.
   */
  vaseSeed: number;
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

/**
 * Термопринт: логотип, который печатается плоской наклейкой и переносится на
 * ткань утюгом.
 *
 * Разметка приходит из SVG-файла или из PNG: в `heatTransferSvg` лежат уже
 * готовые замкнутые контуры, а не исходный файл, — так панель, предпросмотр и
 * сервер разбирают одну и ту же строку. Толщина задаётся слоями по 0.2 мм:
 * 0.4 мм гнётся вместе с тканью, 0.8 мм уже держит форму и топорщится.
 */
export type HeatTransferParams = {
  /** Контуры печати в координатах viewBox исходника; "" — файл не загружен. */
  heatTransferSvg: string;
  /** Ширина принта по X, мм. Это габарит детали, а не масштаб SVG. */
  heatTransferWidth: number;
  /** Высота принта по Y, мм: при загрузке выводится из пропорций контуров. */
  heatTransferHeight: number;
  /** Толщина слоями по 0.2 мм: от 1 до 4 слоёв, то есть 0.2–0.8 мм. */
  heatTransferLayers: number;
  /** Зеркало по X: принт переносится на ткань лицом вниз, иначе текст читается наоборот. */
  heatTransferMirror: boolean;
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
 * Коробка-органайзер: наружные габариты, стенка, скругления, перегородки и
 * крышка.
 *
 * Поля с префиксом `box` не пересекаются с длиной брелока и высотой вазы:
 * в общем состоянии конструктора у каждой модели свои значения, поэтому
 * переключение вкладки не переносит 140 мм коробки в 60 мм брелока.
 */
export const BOX_MAGNET_SIZE_IDS = ["6x2", "8x3"] as const;

/** Типоразмер круглого магнита: диаметр × толщина в миллиметрах. */
export type BoxMagnetSize = (typeof BOX_MAGNET_SIZE_IDS)[number];

export const BOX_MAGNET_SIZE_LABELS = {
  "6x2": "6 × 2 мм",
  "8x3": "8 × 3 мм",
} as const satisfies Record<BoxMagnetSize, string>;

/**
 * Размеры паза под магнит.
 *
 * Диаметр на 0.2 мм больше самого магнита: клей и допуск печати не должны
 * выдавливать деталь наружу. Глубина на 0.2 мм больше толщины магнита — этот
 * запас уходит под клей, а над пазом остаётся не меньше 0.4 мм пластика.
 */
export const BOX_MAGNET_SPECS = {
  "6x2": { diameterMm: 6.2, depthMm: 2.2 },
  "8x3": { diameterMm: 8.2, depthMm: 3.2 },
} as const satisfies Record<
  BoxMagnetSize,
  { diameterMm: number; depthMm: number }
>;

export function isBoxMagnetSize(value: unknown): value is BoxMagnetSize {
  return (
    typeof value === "string" &&
    (BOX_MAGNET_SIZE_IDS as readonly string[]).includes(value)
  );
}

export type BoxParams = {
  /** Наружная ширина по X, мм. */
  boxWidth: number;
  /** Наружная глубина по Y, мм. */
  boxDepth: number;
  /** Высота стенок от стола, мм. */
  boxHeight: number;
  /** Толщина наружных стенок, мм. */
  boxWall: number;
  /** Радиус скругления наружных углов, мм. */
  boxCornerRadius: number;
  /** Количество перегородок, делящих ширину по X: от 0 до 3. */
  boxDividersX: number;
  /** Количество перегородок, делящих глубину по Y: от 0 до 3. */
  boxDividersY: number;
  /** Печатать ли отдельную крышку с внутренней юбкой. */
  hasLid: boolean;
  /** Вырезать ли по четыре глухих паза под магниты в дне и крышке. */
  boxMagnets: boolean;
  /** Типоразмер магнитов: 6 × 2 или 8 × 3 мм. */
  boxMagnetSize: BoxMagnetSize;
  /** Добавлять ли отдельное кольцо-адаптер для штабелирования. */
  boxStack: boolean;
};

/** Пресеты коробки: разные наборы перегородок под типовые задачи. */
export const BOX_PRESET_IDS = ["tools", "batteries", "free"] as const;

export type BoxPresetId = (typeof BOX_PRESET_IDS)[number];

export const BOX_PRESET_LABELS = {
  tools: "Под инструменты",
  batteries: "Под батарейки",
  free: "Свободная сетка",
} as const satisfies Record<BoxPresetId, string>;

/**
 * Длинная сторона сетки яркости: 400 пикселей.
 *
 * Браузер рисует фотографию на canvas сразу после выбора файла и считает по ней
 * яркость. Короткая сторона не назначается, а выводится из пропорций кадра,
 * поэтому в состоянии лежит прямоугольная сетка: 400 × 267 для кадра 3:2,
 * 267 × 400 для портрета. 400 пикселей дают 0.27 мм на пиксель на панели
 * 120 мм — примерно две ширины сопла, и штрих в один пиксель ещё читается на
 * печати. Прежние 150 × 150 не хватало: пиксель занимал 0.8 мм, и тонкие линии
 * логотипа сглаживались до «каши» ещё до геометрии. Полный кадр фотографии в
 * состоянии не хранится: 400 × 400 чисел — это около 1 МБ JSON, а не
 * 12 мегапикселей.
 */
export const LITHOPHANE_RESOLUTION = 400;

/**
 * Шаг вершины сетки рельефа, мм.
 *
 * 0.3 мм — стандарт литофанов из референсов: примерно две ширины сопла
 * 0.4 мм, поэтому рельеф печатается без провалов между вершинами. Число
 * вершин больше не фиксировано: оно считается по габаритам плиты
 * (`lithophaneMeshSize`), поэтому на панели 120 мм шаг равен 0.30 мм, а на
 * панели 200 мм вершин вдвое больше и шаг остаётся тем же.
 */
export const LITHOPHANE_VERTEX_STEP_MM = 0.3;

/**
 * Бюджет треугольников рельефа: миллион.
 *
 * Сетка 668 × 501 на панели 200 × 150 мм — это 667 000 треугольников лица и
 * 7 002 на боковины и тыл, то есть файл на 34 МБ: столько разумно отдать один
 * раз на печать. Миллион — предел, за которым браузер телефона и сервер
 * начинают заметно тормозить. Плита 210 мм (701 × 701, 988 400 треугольников)
 * ещё проходит, 215 мм (718 × 718, 1 036 782) — уже нет; слайдеры
 * останавливаются на 200 мм, поэтому в интерфейсе отказ не появляется, но API
 * и геометрия проверяют бюджет сами.
 */
export const LITHOPHANE_MESH_MAX_TRIANGLES = 1_000_000;

/** Отказ по бюджету сетки: одинаковый текст в панели, геометрии и API. */
export const LITHOPHANE_MESH_TOO_LARGE_MESSAGE =
  "Слишком большой размер для такой детализации — уменьшите габариты панели.";

/**
 * Длинная сторона уменьшенной копии для предпросмотра в сцене.
 *
 * three.js пересобирает рельеф на каждое движение слайдера, и полная сетка
 * яркости в браузере телефона заметно тормозит вращение. Сцена получает
 * усреднённую копию с длинной стороной 150 пикселей (400 × 267 → 150 × 100), а
 * в запрос STL уходит полный массив из состояния — предпросмотр остаётся
 * отзывчивым, печать — подробной.
 */
export const LITHOPHANE_PREVIEW_RESOLUTION = 150;

/**
 * Верхняя граница стороны сетки яркости из запроса.
 *
 * Массив приходит из браузера, поэтому сервер не должен принимать гигантский
 * JSON: 1024 × 1024 — это уже миллион значений, дальше проверка отклоняет
 * запрос с 422. Граница проверяется по каждой стороне: прямоугольная сетка
 * 400 × 267 проходит, 2048 × 2 — нет.
 */
export const LITHOPHANE_MAX_RESOLUTION = 1024;

/** Размер сетки рельефа: вершины по осям, шаг в мм и число треугольников. */
export type LithophaneMeshSize = {
  columns: number;
  rows: number;
  /** Фактический шаг вершины по X, мм: не больше LITHOPHANE_VERTEX_STEP_MM. */
  stepX: number;
  /** Фактический шаг вершины по Y, мм. */
  stepY: number;
  /** Треугольники рельефа: лицо, боковины, тыл и веер центра тыла. */
  triangles: number;
};

/**
 * Шаг вершины рельефа у калейдоскопа, мм.
 *
 * Калейдоскоп печатает четыре панели, и каждая — полная сетка рельефа. При шаге
 * 0.3 мм панель 200 × 150 мм давала бы 583 000 треугольников, а четыре панели —
 * 2.3 миллиона: такой файл (116 МБ) не откроет ни браузер, ни слайсер. Шаг
 * 0.5 мм режет число треугольников в 2.8 раза (0.3² / 0.5²), и четыре панели
 * того же размера укладываются в 840 000 — под бюджетом миллиона. Детализация
 * падает незначительно: 0.5 мм — это 1.25 ширины сопла 0.4 мм, и фото на
 * просвет остаётся читаемым.
 */
export const LITHOPHANE_KALEIDOSCOPE_PANEL_STEP_MM = 0.5;

/**
 * Шаг нарезки тыла изогнутых панелей, мм.
 *
 * Панель плафона рождается сразу на цилиндре, но её тыл собран веером от центра
 * к контуру: луч веера идёт от центра до кромки, и без нарезки его середина ушла
 * бы внутрь радиуса на R(1 − cos(θ/2)). Поэтому тыл режется вдоль лучей на
 * отрезки не длиннее 4 мм (на панели Ø120 это ошибка формы около 0.1 мм), а
 * бюджет треугольников считает эту нарезку отдельным слагаемым: без неё
 * проверка API обещала бы на треть меньше.
 */
export const LITHOPHANE_BEND_STRIP_MM = 4;

/**
 * Слотов под отдельные фото: остальные панели.
 *
 * У призмы четыре грани, у плафона — до четырёх панелей, и первая всегда берёт
 * основной кадр
 * (`lithophaneBrightness`). Остальные три лежат в `lithophaneSideBrightness` по
 * порядку: слот 0 — грань 2, слот 1 — грань 3, слот 2 — грань 4. Длина массива
 * постоянная, поэтому пустой слот в середине не сдвигает соседние, а `null`
 * означает «как у предыдущей грани».
 */
export const LITHOPHANE_SIDE_IMAGE_SLOTS = 3;

/**
 * Поправки сетки под форму панели: шаг вершины, число копий рельефа и шаг
 * нарезки тыла.
 *
 * `copies` — сколько раз сетка попадает в файл: у калейдоскопа четыре панели, у
 * круглого плафона — выбранное число, у плоской одна. Бюджет треугольников
 * считается по сумме, иначе модель из четырёх панелей проходила бы проверку, а
 * файл получался вчетверо больше предела. `fanStep` — шаг нарезки тыла вдоль
 * лучей: у панелей плафона тыл лежит на цилиндре и режется полосами, у плоской
 * панели и граней призмы остаётся одним веером.
 */
export function lithophaneMeshOptions(
  shape: LithophaneShape,
  panels: number = LITHOPHANE_KALEIDOSCOPE_SIDES,
): {
  step: number;
  copies: number;
  fanStep: number;
} {
  if (shape === "kaleidoscope") {
    return {
      step: LITHOPHANE_KALEIDOSCOPE_PANEL_STEP_MM,
      copies: LITHOPHANE_KALEIDOSCOPE_SIDES,
      fanStep: 0,
    };
  }

  if (shape === "round") {
    return {
      step: LITHOPHANE_KALEIDOSCOPE_PANEL_STEP_MM,
      copies: Math.max(1, Math.round(panels)),
      fanStep: LITHOPHANE_BEND_STRIP_MM,
    };
  }

  return {
    step: LITHOPHANE_VERTEX_STEP_MM,
    copies: 1,
    fanStep: 0,
  };
}

/**
 * Сетка рельефа под габариты плиты.
 *
 * Число вершин растёт вместе с панелью: `ceil(размер / 0.3) + 1` — округление
 * вверх, поэтому фактический шаг всегда не больше 0.3 мм (панель 107.6 мм даёт
 * 360 вершин и шаг 0.2997 мм). Раньше сетка была фиксированной 400 × 400: на
 * панели 120 мм шаг выходил 0.27 мм, а на панели 200 мм — 0.50 мм, то есть
 * шире сопла, и мелкие детали терялись при печати.
 *
 * Шаг и число копий берутся из `lithophaneMeshOptions`: калейдоскоп режется
 * крупнее (0.5 мм), а его четыре панели делят один бюджет треугольников.
 *
 * `null` — сетка не влезает в бюджет треугольников: геометрия тогда бросает
 * ошибку с текстом `LITHOPHANE_MESH_TOO_LARGE_MESSAGE`, а API отвечает 422.
 */
export function lithophaneMeshSize(
  plateWidth: number,
  plateHeight: number,
  options: { step?: number; copies?: number; fanStep?: number } = {},
): LithophaneMeshSize | null {
  if (!(plateWidth > 0) || !(plateHeight > 0)) {
    return null;
  }

  const step = options.step ?? LITHOPHANE_VERTEX_STEP_MM;
  const copies = options.copies ?? 1;
  const columns = Math.max(2, Math.ceil(plateWidth / step)) + 1;
  const rows = Math.max(2, Math.ceil(plateHeight / step)) + 1;
  // Контур плиты — 2(columns − 1) + 2(rows − 1) рёбер. На каждое ребро
  // приходится две боковины (один четырёхугольник) и треугольники веера центра
  // тыла: два треугольника на ячейку лица плюс три на ребро контура.
  const boundary = 2 * (columns - 1) + 2 * (rows - 1);
  // У панели плафона тыл режется вдоль лучей веера: на каждое ребро контура
  // приходится по два луча, и каждый луч длиной не больше диагонали плиты даёт
  // диагональ / fanStep отрезков. Без этого слагаемого бюджет обещал бы на
  // треть меньше, чем получается в файле.
  const fanStep = options.fanStep ?? 0;
  const fan =
    fanStep > 0
      ? 2 * boundary * Math.ceil(Math.hypot(plateWidth, plateHeight) / fanStep)
      : 0;
  const triangles = 2 * (columns - 1) * (rows - 1) + 3 * boundary + fan;

  if (triangles * copies > LITHOPHANE_MESH_MAX_TRIANGLES) {
    return null;
  }

  return {
    columns,
    rows,
    stepX: plateWidth / (columns - 1),
    stepY: plateHeight / (rows - 1),
    triangles,
  };
}

/**
 * Форма панели литофана.
 *
 * `flat` — прежняя плоская плита: рельеф идёт по плоскости, рамка и крепление
 * собираются как раньше. `round` — круглый плафон: полый цилиндр, стенки которого
 * собраны из двух-четырёх изогнутых панелей, а внутри остаётся большая пустая
 * камера под лампу. `kaleidoscope` — светильник из четырёх панелей: они стоят под
 * 90° друг к другу и смыкаются в закрытую призму на общей базе с отверстием под
 * свечу или LED-лампу. Фото повторяется на каждой грани, а свет рассеивается
 * внутри призмы и выходит через рельеф.
 *
 * Сменные крепления есть только у плоской панели: паз подставки, стойка и
 * световой короб вырезаны в плоской рамке, а плафон и призма держатся на своих
 * панелях.
 */
export const LITHOPHANE_SHAPES = ["flat", "round", "kaleidoscope"] as const;

export type LithophaneShape = (typeof LITHOPHANE_SHAPES)[number];

/** Подписи форм панели для панели конструктора. */
export const LITHOPHANE_SHAPE_LABELS = {
  flat: "Плоская (как фото)",
  round: "Круглый плафон (2–4 панели)",
  kaleidoscope: "Калейдоскоп (4 стороны)",
} as const satisfies Record<LithophaneShape, string>;

/** Граней у призмы калейдоскопа: по одной на сторону квадрата. */
export const LITHOPHANE_KALEIDOSCOPE_SIDES = 4;


/**
 * Как литофан стоит или висит.
 *
 * Значения остались ради сохранённых проектов и API: панель формы, число
 * панелей и крепление — отдельные поля, и старый проект со стойкой продолжает
 * печататься как раньше. Панель конструктора предлагает не весь список, а
 * только `LITHOPHANE_MOUNT_CHOICES`: плиту без крепления, полоз с кольцом и
 * короб под LED-панель. `arch`, `stand`, `base` и `hook` открываются лишь в
 * проекте, где они уже выбраны, и остаются доступны API.
 *
 * `none` — только плита и рамка, крепление не печатается. `arch` — открытая
 * подставка: две ножки по краям и база с пазом под рамку и каналом под
 * светодиодную ленту, между ножками свет проходит к низу панели. `stand` —
 * сплошная ножка. `base` — массивное основание. `hook` — световой короб за
 * рамкой с двумя петлями на тыльной стенке. `led_box` — тонкий короб 15 мм за
 * рамкой с полкой под квадратную LED-панель и съёмной задней крышкой.
 */
export const LITHOPHANE_MOUNTS = [
  "none",
  "rail",
  "led_box",
  "arch",
  "stand",
  "base",
  "hook",
] as const;

export type LithophaneMount = (typeof LITHOPHANE_MOUNTS)[number];

/** Подписи креплений: по ним клиент строит кнопки выбора. */
export const LITHOPHANE_MOUNT_LABELS = {
  none: "Без подставки",
  rail: "Полоз и кольцо на салазках",
  led_box: "Короб под LED-панель",
  arch: "Открытая арка со светом",
  stand: "Сплошная ножка",
  base: "Массивное основание",
  hook: "Подвес на стену",
} as const satisfies Record<LithophaneMount, string>;

/**
 * Крепления, которые предлагает панель конструктора.
 *
 * Список короче `LITHOPHANE_MOUNTS`: `arch`, `stand`, `base` и `hook` остались
 * ради сохранённых проектов и API, а новых деталей конструктор для них не
 * собирает. Порядок — от простого к сложному: плита без крепления, полоз с
 * кольцом под лампу и короб под квадратную LED-панель.
 */
export const LITHOPHANE_MOUNT_CHOICES = ["none", "rail", "led_box"] as const;

/**
 * Патроны кольца: обычный миньон E14 и стандартный E27.
 *
 * Диаметр — резьбовая часть патрона, та, что проходит сквозь кольцо: 14.6 и
 * 28.6 мм. Гайка патрона садится в шестигранное гнездо с тыла кольца, поэтому
 * размеры обоих креплений лежат рядом в `LITHOPHANE_RAIL_SOCKET_SIZES`.
 */
export const LITHOPHANE_RAIL_SOCKETS = ["e14", "e27"] as const;

export type LithophaneRailSocket = (typeof LITHOPHANE_RAIL_SOCKETS)[number];

/** Подписи патронов: по ним клиент строит выбор. */
export const LITHOPHANE_RAIL_SOCKET_LABELS = {
  e14: "E14 (Ø14.6 мм)",
  e27: "E27 (Ø28.6 мм)",
} as const satisfies Record<LithophaneRailSocket, string>;

/**
 * Резьба патрона, гайка под него и наружный диаметр кольца, мм.
 *
 * Кольцу достаточно обойти гайку: патрон держится на нём фланцем и этой же
 * гайкой, корпуса и полости у детали нет. Поэтому наружный диаметр равен размеру
 * гайки по вершинам плюс мясо — Ø32 под E14 (гайка 22 мм под ключ, 25.9 мм по
 * вершинам) и Ø42 под E27 (33 мм под ключ, 38.1 мм по вершинам). Меньше кольцо
 * сэкономит пластик, но шестигранное гнездо вылезет наружу.
 */
export const LITHOPHANE_RAIL_SOCKET_SIZES = {
  e14: { thread: 14.6, nut: 22, ring: 32 },
  e27: { thread: 28.6, nut: 33, ring: 42 },
} as const satisfies Record<
  LithophaneRailSocket,
  { thread: number; nut: number; ring: number }
>;

/**
 * Источники света, под которые в базе открытой арки вырезано крепление.
 *
 * `strip` — канал 10 × 2 мм под светодиодную ленту и канавка под провод;
 * `usb_bulb` — открытая скоба Ø13.4 мм за панелью, в неё вставляется гибкая
 * ножка USB-лампы; `socket` — открытая скоба Ø39.8 мм под патрон E27: патрон
 * входит с натягом и светит прямо на тыл панели; `none` — база без выборок,
 * подсветку ставят отдельно.
 */
export const LITHOPHANE_LIGHT_SOURCES = [
  "strip",
  "usb_bulb",
  "socket",
  "none",
] as const;

export type LithophaneLightSource =
  (typeof LITHOPHANE_LIGHT_SOURCES)[number];

/** Подписи источников света: по ним клиент строит выпадающий список. */
export const LITHOPHANE_LIGHT_SOURCE_LABELS = {
  strip: "Светодиодная лента (канал 10 мм)",
  usb_bulb: "USB-лампа (Type-A)",
  socket: "LED-патрон (E14/E27)",
  none: "Без подсветки",
} as const satisfies Record<LithophaneLightSource, string>;

/**
 * Какое гнездо скобы занимает лампа.
 *
 * В одном держателе напечатаны две скобы: ближняя — как на референсе с Cults3D,
 * патрон почти у панели и деталь компактная; дальняя отодвигает лампу на 120 мм,
 * и карта света зеленеет. Расчёт берёт то гнездо, которое выбрано, а человек
 * переставляет патрон между ними при сборке.
 */
export const LITHOPHANE_LIGHT_SEATS = ["near", "far"] as const;

export type LithophaneLightSeat = (typeof LITHOPHANE_LIGHT_SEATS)[number];

/** Подписи гнёзд: по ним клиент строит выбор положения лампы. */
export const LITHOPHANE_LIGHT_SEAT_LABELS = {
  near: "Ближнее гнездо (компактно)",
  far: "Дальнее гнездо (ровный свет)",
} as const satisfies Record<LithophaneLightSeat, string>;

/**
 * Нужна ли отдельная деталь подставки.
 *
 * У открытой арки, сплошной ножки и массивного основания правила сборки общие:
 * различаются форма профиля и наличие паза под ленту. Одним предикатом
 * проверяют наличие детали в панели, сборка плиты с рамкой, габариты сцены и
 * запрос STL — иначе список деталей обещал бы файл, которого API не соберёт.
 */
export function lithophaneHasStand(mount: LithophaneMount): boolean {
  return mount === "arch" || mount === "stand" || mount === "base";
}

/**
 * Печатается ли нижний полоз с кольцом.
 *
 * Полоз намертво врезан в тыл плоской рамки, а кольцо вставляется в его паз
 * ножкой и везёт патрон. Ни у плафона, ни у калейдоскопа тыла рамки нет, поэтому
 * крепление читается только у плоской формы и только вместе с рамкой.
 */
export function lithophaneHasRail(
  mount: LithophaneMount,
  shape: LithophaneShape,
  hasFrame = true,
): boolean {
  return mount === "rail" && shape === "flat" && hasFrame;
}

/**
 * Печатается ли короб под LED-панель.
 *
 * Короб наращивает тыл плоской рамки теми же стенками, что и рамка: полка под
 * квадратную LED-панель, карман под неё и паз под съёмную заднюю крышку.
 * Как и полоз, он живёт только на плоской форме и только вместе с рамкой —
 * у плафона и калейдоскопа тыла, к которому его крепить, нет. Отдельным файлом
 * печатается одна задняя крышка.
 */
export function lithophaneHasLedBox(
  mount: LithophaneMount,
  shape: LithophaneShape,
  hasFrame = true,
): boolean {
  return mount === "led_box" && shape === "flat" && hasFrame;
}

/**
 * Есть ли у формы панели крепления.
 *
 * Паз подставки, задняя стойка и световой короб настенного крепления вырезаны в
 * плоской рамке, а плафон и призма собраны из своих панелей. Поэтому сменные
 * крепления применяются только к плоской панели, а выбор человека не
 * сбрасывается — вернувшись к плоской форме, он получает то же крепление.
 */
export function lithophaneShapeHasMounts(shape: LithophaneShape): boolean {
  return shape === "flat";
}

/**
 * Есть ли у формы съёмная рамка с пазом.
 *
 * Рамка — плоская деталь: у калейдоскопа панели входят в паз цоколя и крышки, а
 * у круглого плафона панели сами образуют стенку. Поэтому флаг рамки и выбор
 * крепления читаются только у плоской формы, остальные печатают панели.
 */
export function lithophaneShapeHasFrame(shape: LithophaneShape): boolean {
  return shape === "flat";
}

/**
 * Есть ли у формы своя база, вырезанная в её геометрии.
 *
 * У калейдоскопа база — часть самой детали: рельс по квадрату и пьедестал под
 * свечу. У круглого плафона база тоже есть, но это отдельная деталь (диск с
 * пазом и стаканом под патрон, см. `createLithophaneStandGeometry`), поэтому
 * предикат отвечает только за встроенные цоколи.
 */
export function lithophaneShapeHasBase(shape: LithophaneShape): boolean {
  return shape === "kaleidoscope";
}

/**
 * Сколько фото загружено: основной кадр и заполненные слоты подряд.
 *
 * Первый кадр есть всегда (до загрузки это демонстрационный рельеф), а слоты
 * заполняются по порядку: пустой слот обрывает цепочку, потому что панель без
 * фото в середине кольца разорвала бы плафон. Так единица означает «одно фото»,
 * двойка — «два разных кадра» и так далее до четырёх.
 */
export function lithophaneLoadedFaceCount(
  params: Pick<LithophaneParams, "lithophaneSideBrightness">,
): number {
  let faces = 1;

  for (const slot of params.lithophaneSideBrightness ?? []) {
    if (!slot) {
      break;
    }

    faces += 1;
  }

  return faces;
}

/**
 * Число панелей рельефа у формы.
 *
 * Плоская панель — одна плита, калейдоскоп — четыре грани, круглый плафон —
 * столько панелей, сколько загружено разных фото: один кадр печатается цельным
 * кольцом на 360°, два делят окружность пополам, три — по 120°, четыре — по
 * 90°. По этому числу считаются копии сетки в бюджете треугольников, группы
 * материалов в сцене и ширина каждой панели.
 */
export function lithophanePanelCount(
  params: Pick<
    LithophaneParams,
    "lithoShape" | "lithophanePanels" | "lithophaneSideBrightness"
  >,
): number {
  if (params.lithoShape === "kaleidoscope") {
    return LITHOPHANE_KALEIDOSCOPE_SIDES;
  }

  if (params.lithoShape === "round") {
    return lithophaneLoadedFaceCount(params);
  }

  return 1;
}

/**
 * Детали литофана: что выгружать в STL.
 *
 * Рельеф и рамка печатаются отдельно и собираются без клея: плита входит в
 * паз рамки с зазором 0.2 мм. Подставка — третья деталь, она нужна только при
 * `lithoMount === "stand"` или `"base"`, а у круглого плафона это его основание:
 * кольцо с пазом, спицы и ступица под патрон. Крышка (`top_cover`) — тоже
 * деталь плафона: кольцо-козырёк с пазом снизу, оно закрывает абажур сверху.
 * Каретка (`carriage`) — деталь полоза: её печатают, когда `lithophaneHasRail`, и
 * вставляют ножкой в паз, врезанный в тыл рамки. `cover` — задняя крышка короба
 * под LED-панель: она нужна только при `lithophaneHasLedBox` и вставляется в паз
 * на тылу короба. `all` — собранный вид для проверки и печати одним файлом.
 */
export const LITHOPHANE_PARTS = [
  "relief",
  "frame",
  "stand",
  "top_cover",
  "carriage",
  "cover",
  "all",
] as const;

export type LithophanePart = (typeof LITHOPHANE_PARTS)[number];

/** Подписи деталей литофана для панели и имён файлов. */
export const LITHOPHANE_PART_LABELS = {
  relief: "Панель",
  frame: "Рамка с полозом",
  stand: "Подставка",
  top_cover: "Верхняя крышка плафона",
  carriage: "Каретка",
  cover: "Задняя крышка короба",
  all: "Все детали",
} as const satisfies Record<LithophanePart, string>;

/**
 * Подпись детали с учётом крепления и формы.
 *
 * Полоз и короб наращивают одну и ту же рамку, но печатаются с ней разными
 * деталями: «Рамка с полозом» и «Рамка с коробом» точнее одного общего слова.
 * Крышка короба — самостоятельная деталь, ей крепление в подписи не нужно.
 * У круглого плафона деталь `stand` — это не подставка, а основание со спицами и
 * ступицей под патрон, а `top_cover` — верхняя крышка-козырёк: подписи называют
 * их своими словами.
 */
export function lithophanePartLabel(
  part: LithophanePart,
  mount: LithophaneMount = "none",
  shape: LithophaneShape = "flat",
): string {
  if (part === "frame" && mount === "led_box") {
    return "Рамка с коробом";
  }

  if (part === "relief" && shape === "round") {
    return "Панели плафона";
  }

  if (part === "stand" && shape === "round") {
    return "Основание плафона (спицы)";
  }

  if (part === "top_cover" && shape === "round") {
    return "Верхняя крышка (козырёк)";
  }

  return LITHOPHANE_PART_LABELS[part];
}

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
 * слайдеры не прыгают при включении рамки. У круглого плафона ширина — это
 * наружный диаметр, а у калейдоскопа — сторона грани.
 */
export type LithophaneParams = {
  /** Ширина панели с рамкой, мм; у плафона — наружный диаметр. */
  lithophaneWidth: number;
  /** Высота панели с рамкой, мм. */
  lithophaneHeight: number;
  /** Толщина светлых участков, мм. */
  lithophaneMinThickness: number;
  /** Толщина тёмных участков и рамки, мм. */
  lithophaneMaxThickness: number;
  /** Яркость кадра построчно: width × height значений 0–255. */
  lithophaneBrightness: number[];
  /**
   * Ширина сетки яркости, пикселей.
   *
   * Хранится отдельным полем, потому что сетка прямоугольная: длинная сторона
   * кадра — 400, короткая — по пропорциям (400 × 267 для 3:2). Старые проекты и
   * клиенты присылают только массив: тогда обе стороны выводятся из длины как
   * квадрат, и такие данные принимаются без изменений.
   */
  lithophaneBrightnessWidth: number;
  /** Высота сетки яркости, пикселей. */
  lithophaneBrightnessHeight: number;
  /**
   * Кадры остальных панелей: три слота, в каждом сетка или `null`.
   *
   * Первая панель всегда берёт `lithophaneBrightness`, а эти три — панели 2, 3 и
   * 4: у калейдоскопа грани, у плафона секторы. Пустой слот повторяет последний
   * загруженный кадр, поэтому одна картинка печатается на всех панелях. Массив
   * одной длины (3) — индекс слота совпадает с номером панели, и снятие фото в
   * середине не сдвигает остальные.
   */
  lithophaneSideBrightness: (LithophaneBrightnessGrid | null)[];
  /** Печатать рамку с пазом отдельной деталью. */
  lithoFrame: boolean;
  /**
   * Форма панели: плоская, круглый плафон или призма калейдоскопа.
   *
   * У плоской панели рельеф идёт по плоскости, а крепление и рамка собираются
   * отдельными деталями. У плафона панели рождаются сразу на цилиндре: ширина
   * каждой равна дуге сектора, поэтому фото не сжимается к краям. У призмы
   * четыре плоские грани стоят под 90°.
   */
  lithoShape: LithophaneShape;
  /**
   * Число панелей рельефа: у плафона — вычисленное по числу фото, у призмы —
   * четыре.
   *
   * Поле осталось от прежнего слайдера «Число панелей». Теперь у круглого
   * плафона оно равно числу загруженных кадров (см. `lithophanePanelCount`):
   * один кадр — цельное кольцо на 360°, четыре — четыре панели по 90°.
   * Плоская панель и калейдоскоп значение не читают.
   */
  lithophanePanels: number;
  /**
   * Крепление: открытая арка со светом, сплошная ножка, массивное основание,
   * петли под саморезы или без подставки. Арка, ножка и основание собираются
   * одинаково, но у арки вместо глухой стойки две ножки по краям, а в базе —
   * паз под рамку и канал под светодиодную ленту.
   */
  lithoMount: LithophaneMount;
  /**
   * Патрон кольца: миньон E14 или стандартный E27.
   *
   * Читает только кольцо: в нём вырезана резьба патрона и шестигранное гнездо под
   * штатную гайку. Значение переживает смену формы и крепления.
   */
  lithoRailSocket: LithophaneRailSocket;
  /**
   * Расстояние от плоскости панели до лицевой плоскости кольца, мм.
   *
   * Читает только кольцо: по нему его ножка скользит по пазу полоза, а сам полоз
   * остаётся на тылу рамки. Значение переживает смену формы и крепления.
   */
  lithoRailDistance: number;
  /**
   * Источник света в базе: лента, USB-лампа, патрон E27 или ничего.
   *
   * Читает открытая арка: в её базе вырезан канал под ленту, полка со стойкой
   * USB-лампы или стакан под патрон. Остальные крепления выборок не имеют:
   * источнику там негде стоять. Значение переживает смену крепления и формы, а в
   * интерфейсе выбора источника больше нет — его оставили для сохранённых
   * проектов. Призма калейдоскопа держит свечу в пьедестале.
   */
  lithoLightSource: LithophaneLightSource;
  /**
   * Гнездо скобы, в которое вставлена лампа: ближнее или дальнее.
   *
   * У открытой арки в держателе напечатаны обе скобы, поэтому расчёт света берёт
   * выбранное положение: близкое даёт пятно (пик ×6), дальнее — ровную карту.
   */
  lithoLightSeat: LithophaneLightSeat;
  /**
   * Рассеиватель: лист матового акрила 2 мм в пазу базы, между лампой и панелью.
   *
   * Паз под него печатается всегда, когда в базе есть свет, — это выбор из
   * расчёта, а не из геометрии: флаг говорит, что человек действительно вставит
   * лист, и тогда расчёт усредняет пятно так, как это делает рассеиватель.
   * Без листа пятно считается прямым — так печатается и так светит.
   */
  lithoDiffuser: boolean;
};

/** Сетка яркости вместе с её размерами: массив без полей не читается. */
export type LithophaneBrightnessGrid = {
  brightness: number[];
  width: number;
  height: number;
};

/** Значения, с которыми открывается конструктор. */
export const DEFAULT_VASE_PARAMS: VaseParams = {
  height: CONSTRUCTOR_LIMITS.height.defaultValue,
  diameter: CONSTRUCTOR_LIMITS.diameter.defaultValue,
  wall: CONSTRUCTOR_LIMITS.wall.defaultValue,
  shape: "classic",
  // Новый проект открывается рёбрами: конструктор сразу показывает рельеф, а не
  // пустую стенку. 1.2 мм на частоте 20 — тонкие частые рёбра: они читаются и на
  // снимке печати, и в предпросмотре, и не выходят за бюджет амплитуд. Затухание
  // печатное — 5 мм у кромки и 3 мм у дна (см. `VASE_DEFAULT_FADE_TOP_MM`).
  patterns: [
    {
      type: "ribs",
      amplitude: 1.2,
      frequency: 20,
      phaseDeg: 0,
      envelope: {
        fadeTopMm: VASE_DEFAULT_FADE_TOP_MM,
        fadeBottomMm: VASE_DEFAULT_FADE_BOTTOM_MM,
      },
    },
  ],
  footMm: CONSTRUCTOR_LIMITS.footMm.defaultValue,
  rimMm: CONSTRUCTOR_LIMITS.rimMm.defaultValue,
  sectionSides: CONSTRUCTOR_LIMITS.sectionSides.defaultValue,
  twistDeg: CONSTRUCTOR_LIMITS.twistDeg.defaultValue,
  flutes: CONSTRUCTOR_LIMITS.flutes.defaultValue,
  fluteDepthMm: CONSTRUCTOR_LIMITS.fluteDepthMm.defaultValue,
  organic: CONSTRUCTOR_LIMITS.organic.defaultValue,
  leanDeg: CONSTRUCTOR_LIMITS.leanDeg.defaultValue,
  vaseSeed: CONSTRUCTOR_LIMITS.vaseSeed.defaultValue,
};

/**
 * Образец надписи: общие поля карточки «Текст» до ввода букв.
 *
 * Содержимое пустое: надпись появляется только по кнопке «Добавить текст», а
 * печатать чужое имя в новом проекте незачем. Тот же объект — образец для
 * кнопки, поэтому новая карточка ждёт ввода.
 */
export const DEFAULT_KEYCHAIN_TEXT_DECORATION: KeychainTextDecoration = {
  align: "center",
  content: "",
  depth: KEYCHAIN_DECORATION_DEPTH_LIMITS.defaultValue,
  font: "sans-bold",
  id: "text",
  kind: "text",
  lineHeight: KEYCHAIN_TEXT_LINE_HEIGHT_LIMITS.defaultValue,
  offsetX: KEYCHAIN_DECORATION_OFFSET_LIMITS.defaultValue,
  offsetY: KEYCHAIN_DECORATION_OFFSET_LIMITS.defaultValue,
  rotation: 0,
  side: "auto",
};

/**
 * QR-код визитки по умолчанию: выпуклый рельеф и короткая ссылка.
 *
 * Общие поля нейтральные: код занимает лицо целиком, двигать и поворачивать его
 * нельзя, а рельеф печатает силуэт визитки по `qrMode` — своей толщины у
 * декорации кода нет.
 */
export const DEFAULT_KEYCHAIN_QR_DECORATION: KeychainQrDecoration = {
  depth: KEYCHAIN_DECORATION_DEPTH_LIMITS.defaultValue,
  id: "qr",
  kind: "qr",
  offsetX: 0,
  offsetY: 0,
  qrContent: DEFAULT_QR_CARD_SPEC.content,
  qrContentType: DEFAULT_QR_CARD_SPEC.contentType,
  qrMode: DEFAULT_QR_CARD_SPEC.mode,
  qrName: DEFAULT_QR_CARD_SPEC.name,
  qrPhone: DEFAULT_QR_CARD_SPEC.phone,
  rotation: 0,
  side: "front",
};

/** Новая надпись для кнопки «Добавить текст»: поле пустое и ждёт ввода. */
export function createKeychainTextDecoration(
  content = "",
): KeychainTextDecoration {
  return { ...DEFAULT_KEYCHAIN_TEXT_DECORATION, content };
}

/**
 * Новая картинка из загруженного файла.
 *
 * Панель передаёт готовую маску и имя файла: имя нужно только интерфейсу, но
 * хранится в параметрах, чтобы карточка «Картинка: logo.png» пережила
 * перезагрузку проекта. Порог яркости стартует с середины шкалы — 50% повторяет
 * прежнее поведение, когда рельефом становилась тёмная половина картинки;
 * инверсия выключена, потому что большинство логотипов тёмные на светлом фоне.
 */
export function createKeychainImageDecoration(
  imageData: string,
  imageName: string,
): KeychainImageDecoration {
  return {
    depth: KEYCHAIN_IMAGE_DEPTH_LIMITS.defaultValue,
    id: "image",
    imageData,
    imageInvert: false,
    imageName,
    imageScale: KEYCHAIN_IMAGE_SCALE_LIMITS.defaultValue,
    imageThreshold: KEYCHAIN_IMAGE_THRESHOLD_LIMITS.defaultValue,
    kind: "image",
    offsetX: KEYCHAIN_DECORATION_OFFSET_LIMITS.defaultValue,
    offsetY: KEYCHAIN_DECORATION_OFFSET_LIMITS.defaultValue,
    rotation: 0,
    side: "auto",
  };
}

/**
 * Значения брелока по умолчанию: модель открывается с готовым пресетом.
 *
 * Раньше здесь стоял жетон `dog_tag`, потом своя форма `custom` — оба варианта
 * оставляли модель без геометрии, если файл не загружен: предпросмотр показал бы
 * заглушку, а API вернул бы 422 на первый же запрос. Поэтому по умолчанию выбран
 * первый пресет реестра.
 *
 * Декор пуст: новый брелок печатается чистым, а надпись, картинка и QR
 * появляются кнопками блока «Декор». Прежние проекты приходят со своими
 * декорациями и читаются как раньше (`normalizeKeychainDecorations`).
 */
export const DEFAULT_KEYCHAIN_PARAMS: KeychainParams = {
  length: CONSTRUCTOR_LIMITS.length.defaultValue,
  width: CONSTRUCTOR_LIMITS.width.defaultValue,
  thickness: CONSTRUCTOR_LIMITS.thickness.defaultValue,
  decorations: [],
  keychainPreset: DEFAULT_KEYCHAIN_PRESET_ID,
  nfcEnabled: false,
  holePlacement: "center",
  qrCardSize: DEFAULT_QR_CARD_SPEC.size,
  qrCardTab: DEFAULT_QR_CARD_SPEC.tab,
};

/** Подставка по умолчанию: наклон 65°, телефон 11 мм, ширина 80 мм. */
export const DEFAULT_STAND_PARAMS: StandParams = {
  standAngle: CONSTRUCTOR_LIMITS.standAngle.defaultValue,
  phoneThickness: CONSTRUCTOR_LIMITS.phoneThickness.defaultValue,
  standWidth: CONSTRUCTOR_LIMITS.standWidth.defaultValue,
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

/** Термопринт по умолчанию: 100 × 100 мм, два слоя, без файла и зеркала. */
export const DEFAULT_HEAT_TRANSFER_PARAMS: HeatTransferParams = {
  heatTransferSvg: "",
  heatTransferWidth: CONSTRUCTOR_LIMITS.heatTransferWidth.defaultValue,
  heatTransferHeight: CONSTRUCTOR_LIMITS.heatTransferHeight.defaultValue,
  heatTransferLayers: CONSTRUCTOR_LIMITS.heatTransferLayers.defaultValue,
  heatTransferMirror: false,
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
 * Коробка по умолчанию: 140 × 100 × 60 мм, стенка 1.6 мм, скругление 5 мм,
 * по одной перегородке вдоль каждой оси и крышка. Такой органайзер сразу
 * показывает и скруглённый корпус, и перегородки, и обе детали.
 */
export const DEFAULT_BOX_PARAMS: BoxParams = {
  boxWidth: CONSTRUCTOR_LIMITS.boxWidth.defaultValue,
  boxDepth: CONSTRUCTOR_LIMITS.boxDepth.defaultValue,
  boxHeight: CONSTRUCTOR_LIMITS.boxHeight.defaultValue,
  boxWall: CONSTRUCTOR_LIMITS.boxWall.defaultValue,
  boxCornerRadius: CONSTRUCTOR_LIMITS.boxCornerRadius.defaultValue,
  boxDividersX: CONSTRUCTOR_LIMITS.boxDividers.defaultValue,
  boxDividersY: CONSTRUCTOR_LIMITS.boxDividers.defaultValue,
  hasLid: true,
  boxMagnets: false,
  boxMagnetSize: "6x2",
  boxStack: false,
};

/**
 * Готовые коробки под три сценария.
 *
 * «Инструменты» — длинная коробка с двумя перегородками по X и одной по Y;
 * «Батарейки» — много узких отделений для AA/AAA; «Свободная» — просторная
 * коробка с одной перегородкой и без крышки. Габариты входят в пресет:
 * иначе число перегородок пришлось бы подгонять слайдерами вручную.
 */
export const BOX_PRESETS: Record<BoxPresetId, BoxParams> = {
  tools: {
    boxWidth: 200,
    boxDepth: 160,
    boxHeight: 60,
    boxWall: 1.6,
    boxCornerRadius: 5,
    boxDividersX: 2,
    boxDividersY: 1,
    hasLid: true,
    boxMagnets: false,
    boxMagnetSize: "6x2",
    boxStack: false,
  },
  batteries: {
    boxWidth: 160,
    boxDepth: 120,
    boxHeight: 50,
    boxWall: 1.2,
    boxCornerRadius: 3,
    boxDividersX: 3,
    boxDividersY: 1,
    hasLid: true,
    boxMagnets: false,
    boxMagnetSize: "6x2",
    boxStack: false,
  },
  free: {
    boxWidth: 180,
    boxDepth: 180,
    boxHeight: 60,
    boxWall: 1.6,
    boxCornerRadius: 8,
    boxDividersX: 1,
    boxDividersY: 1,
    hasLid: false,
    boxMagnets: false,
    boxMagnetSize: "6x2",
    boxStack: false,
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
 * Литофан по умолчанию: 120 × 80 мм, рельеф 0.8–3 мм, рамка и открытая арка.
 *
 * Рамка включена сразу: без неё плита 0.8–3 мм стоит только на ребре. Крепление
 * по умолчанию — «без подставки»: старые подставки из интерфейса убраны, а
 * монорельс будет отдельной задачей. После загрузки фотографии массив яркости
 * заменяется яркостью кадра.
 */
export const DEFAULT_LITHOPHANE_PARAMS: LithophaneParams = {
  lithophaneWidth: CONSTRUCTOR_LIMITS.lithophaneWidth.defaultValue,
  lithophaneHeight: CONSTRUCTOR_LIMITS.lithophaneHeight.defaultValue,
  lithophaneMinThickness:
    CONSTRUCTOR_LIMITS.lithophaneMinThickness.defaultValue,
  lithophaneMaxThickness:
    CONSTRUCTOR_LIMITS.lithophaneMaxThickness.defaultValue,
  lithophaneBrightness: createDemoLithophaneBrightness(),
  lithophaneBrightnessWidth: LITHOPHANE_RESOLUTION,
  lithophaneBrightnessHeight: LITHOPHANE_RESOLUTION,
  // Остальные панели пусты: демонстрационный рельеф повторяется на всех
  // панелях, пока человек не загрузит разные фото.
  lithophaneSideBrightness: [null, null, null],
  lithoFrame: true,
  lithoMount: "none",
  // Миньон по умолчанию: под него зенковка и гнездо под гайку самые компактные, а
  // E27 выбирают осознанно, когда нужен свет поярче.
  lithoRailSocket: "e14",
  // 40 мм — между навесом и панелью остаётся 20 мм, а ножка стоит на середине
  // полоза и не свисает с его торца.
  lithoRailDistance: CONSTRUCTOR_LIMITS.lithoRailDistance.defaultValue,
  // Плоская панель — форма из референсов и прежнее поведение конструктора:
  // плафон и калейдоскоп выбирают осознанно.
  lithoShape: "flat",
  // Четыре панели — замкнутое кольцо абажура и самый понятный вид плафона.
  lithophanePanels: CONSTRUCTOR_LIMITS.lithophanePanels.defaultValue,
  // Канал под ленту — самый дешёвый свет: лента 8–10 мм лежит в базе и светит
  // на тыл кадра, ничего докупать не нужно.
  lithoLightSource: "strip",
  // Дальнее гнездо по умолчанию: карта света на нём зелёная, а ближнее человек
  // выбирает осознанно, когда важнее компактность детали на полке.
  lithoLightSeat: "far",
  // Рассеиватель — отдельная деталь, которой у человека может не быть:
  // по умолчанию её нет, а расчёт подсказывает её для больших панелей.
  lithoDiffuser: false,
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
  PlanterParams &
  CoasterParams &
  JewelryStandParams &
  PenHolderParams &
  HeatTransferParams;

/** Стартовое состояние: открывается ваза, остальные модели ждут на вкладках. */
export const DEFAULT_CONSTRUCTOR_PARAMS: ConstructorParams = {
  model: "vase",
  ...DEFAULT_VASE_PARAMS,
  ...DEFAULT_KEYCHAIN_PARAMS,
  ...DEFAULT_SIGN_PARAMS,
  ...DEFAULT_BOX_PARAMS,
  ...DEFAULT_LITHOPHANE_PARAMS,
  ...DEFAULT_STAND_PARAMS,
  ...DEFAULT_PLANTER_PARAMS,
  ...DEFAULT_COASTER_PARAMS,
  ...DEFAULT_JEWELRY_STAND_PARAMS,
  ...DEFAULT_PEN_HOLDER_PARAMS,
  ...DEFAULT_HEAT_TRANSFER_PARAMS,
};

/**
 * Имя файла STL для набора параметров вазы.
 *
 * Функция общая для серверного ответа и клиентской запасной подписи ссылки:
 * имя в Content-Disposition и в атрибуте download должно совпадать. Значение
 * wall уже выровнено normalizeVaseParams, поэтому лишние нули не появляются.
 *
 * Деформации попадают в имя суффиксами в порядке панели. Без них вазы с
 * закруткой, жёлобами, гранями, складками и наклоном назывались бы одинаково:
 * в папке загрузок браузер добавил бы «(1)», и по имени файла рецепт было бы
 * не восстановить. Нулевые деформации суффикса не дают — у прежней вазы имя
 * остаётся прежним.
 *
 * Сид пишется только при органике: без складок он не влияет на геометрию, а
 * два одинаковых файла не должны расходиться в именах. Сид стоит последним,
 * чтобы серия «других ваз» сортировалась рядом.
 *
 * Органика — в процентах (`-organic50`): её шаг 0.05 даёт ровно проценты, а
 * дробь с точкой в имени читается как второе расширение. Глубина жёлобов идёт
 * рядом с их числом (`-flutes8x2`): восемь жёлобов по 0.2 мм и по 6 мм — разные
 * вазы. Наклон бывает отрицательным, и знак остаётся как есть (`-lean-10`):
 * слово «minus» в имени длиннее самого числа.
 *
 * Композиция узоров пишется через плюс (`-ribs+spiral`): плюс — разделитель
 * слоёв, а не ещё один суффикс, и он допустим в имени файла на всех системах.
 * Один слой даёт прежнее имя (`-spiral`), гладкая ваза — прежнее совсем без
 * суффикса, поэтому ссылки и папки загрузок не меняются.
 */
export function vaseStlFileName(params: VaseParams): string {
  const pattern = vasePatternSlug(params.patterns);
  const patternSuffix = pattern === "smooth" ? "" : `-${pattern}`;
  const twistSuffix = params.twistDeg > 0 ? `-twist${params.twistDeg}` : "";
  const fluteSuffix =
    params.flutes > 0
      ? `-flutes${params.flutes}x${formatMillimetres(params.fluteDepthMm)}`
      : "";
  const sidesSuffix =
    params.sectionSides > 0 ? `-sides${params.sectionSides}` : "";
  const organicSuffix =
    params.organic > 0 ? `-organic${Math.round(params.organic * 100)}` : "";
  const leanSuffix = params.leanDeg !== 0 ? `-lean${params.leanDeg}` : "";
  const seedSuffix = params.organic > 0 ? `-s${params.vaseSeed}` : "";

  return [
    `tridi-vaza-${params.shape}${patternSuffix}`,
    `-h${params.height}-d${params.diameter}-w${formatMillimetres(params.wall)}`,
    twistSuffix,
    fluteSuffix,
    sidesSuffix,
    organicSuffix,
    leanSuffix,
    seedSuffix,
    ".stl",
  ].join("");
}

/** Число для имени файла: без хвостов плавающей точки, до двух знаков. */
function formatMillimetres(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/**
 * Метаданные генерации вазы для журнала `constructor_generations.details`.
 *
 * Пишем не габарит — он уже в имени файла и в самом STL, — а то, что отвечает на
 * вопрос «какие вазы реально скачивают»: силуэт, композицию слоёв, деформации,
 * цоколь с ободом и сид.
 *
 * Объект плоский: так его группируют в SQL одним `->>`, не разбирая структуру.
 * Единственное исключение — `patterns`: это массив, потому что слоёв до трёх и у
 * каждого свои числа. Массив читается тем же `->` (jsonb) и не превращает строку
 * журнала в дерево.
 *
 * Конусности стенки здесь нет намеренно: толщина по высоте постоянна, отдельного
 * параметра в модели не существует, а поле, которое всегда ноль, обещало бы
 * настройку, которой нет.
 *
 * Сюда приходит результат normalizeVaseParams: в журнале не бывает NaN,
 * `undefined` и «сырых» значений слайдера, поэтому группировка по `organic` не
 * распадается на сотни почти одинаковых чисел. Проект, сохранённый до появления
 * цоколя и обода, нормализуется нулями — поля есть всегда.
 */
export type VaseGenerationDetails = {
  shape: VaseShape;
  /**
   * Набор слоёв строкой: `smooth`, `ribs` или `ribs+spiral`.
   *
   * Поле осталось тем же и с тем же ключом, что до композиции: дашборд и
   * запросы группируют генерации по `->>pattern`, и ломать их ради того, чтобы
   * положить сюда массив, незачем. Композиция видна прямо в строке.
   */
  pattern: string;
  /**
   * Слои по строке на каждый: `ribs:1.2@24`, `spiral:1@6`.
   *
   * Строка собирается как `тип:амплитуда@частота`: её видно глазами и можно
   * разобрать в SQL без отдельного jsonb-пути на каждое поле. Пустой список
   * слоёв нормализуется в гладкий слой, поэтому массив никогда не пуст.
   */
  patterns: string[];
  sectionSides: number;
  twistDeg: number;
  flutes: number;
  fluteDepthMm: number;
  /** Высота цоколя, мм: форма края, а не габарит, поэтому в журнале нужна. */
  footMm: number;
  /** Насколько обод шире стенки, мм. */
  rimMm: number;
  organic: number;
  leanDeg: number;
  vaseSeed: number;
};

export function vaseGenerationDetails(
  params: VaseParams,
): VaseGenerationDetails {
  // Слои читаются через нормализацию: у проекта до композиции их нет вовсе, а
  // пустой массив превратился бы в строку без единого слоя.
  const layers = resolvePatternLayers(params);

  return {
    shape: params.shape,
    pattern: vasePatternSlug(layers),
    patterns: vasePatternLayerTokens(layers),
    sectionSides: params.sectionSides,
    twistDeg: params.twistDeg,
    flutes: params.flutes,
    fluteDepthMm: params.fluteDepthMm,
    footMm: params.footMm,
    rimMm: params.rimMm,
    organic: params.organic,
    leanDeg: params.leanDeg,
    vaseSeed: params.vaseSeed,
  };
}

/**
 * Имя файла STL для брелока.
 *
 * В имя не попадает текст: кириллица в заголовке ответа требует
 * filename*=UTF-8, а запасное имя для старых клиентов всё равно останется
 * латинским. Размеры и форма уже однозначно описывают заготовку: в имени стоит
 * идентификатор пресета, потому что другой формы у брелока нет.
 */
export function keychainStlFileName(params: KeychainParams): string {
  const nfcSuffix = params.nfcEnabled ? "-nfc" : "";
  const shape = params.keychainPreset ?? DEFAULT_KEYCHAIN_PRESET_ID;

  return `tridi-brelyok-${shape}-l${params.length}-w${params.width}-t${params.thickness}${nfcSuffix}.stl`;
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
 * Имя файла STL для термопринта.
 *
 * Габарит и число слоёв входят в имя: толщина выводится из слоёв, а не
 * хранится отдельным полем. Зеркальная деталь получает суффикс — она печатается
 * тем же контуром, но кладётся на ткань другой стороной, и файлы нельзя
 * перепутать.
 */
export function heatTransferStlFileName(params: HeatTransferParams): string {
  const mirrorSuffix = params.heatTransferMirror ? "-zerkalo" : "";

  return `tridi-termoprint-${params.heatTransferWidth}x${params.heatTransferHeight}-sl${params.heatTransferLayers}${mirrorSuffix}.stl`;
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
 * Габариты записываются как `w140-d100-h60`, толщина `t1.6`, скругление
 * `r5`, перегородки — `x1-y2`, крышка — суффиксом `kryshka`. По имени видно,
 * лежит ли в файле вторая деталь и какие перегородки построены; значения уже
 * выровнены normalizeBoxParams.
 */
export function boxStlFileName(params: BoxParams): string {
  const lidSuffix = params.hasLid ? "-kryshka" : "";

  return `tridi-korobka-w${params.boxWidth}-d${params.boxDepth}-h${params.boxHeight}-t${params.boxWall}-r${params.boxCornerRadius}-x${params.boxDividersX}-y${params.boxDividersY}${lidSuffix}.stl`;
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
 * Размеры сетки яркости: ширина и высота в пикселях.
 *
 * Основной путь — пара полей `lithophaneBrightnessWidth`/`Height`: сетка
 * прямоугольная, потому что кадр 3:2 занимает 400 × 267, а не квадрат. Если
 * полей нет (старый проект или старый клиент), сторона выводится из длины
 * массива как квадратная: 160 000 значений — это 400 × 400.
 *
 * `null` — данные испорчены: размеры переданы, но не сходятся с длиной массива,
 * выходят за LITHOPHANE_MAX_RESOLUTION или длина не образует сетку вообще.
 */
export function lithophaneBrightnessSize(
  brightness: number[],
  width?: unknown,
  height?: unknown,
): { width: number; height: number } | null {
  if (typeof width === "number" || typeof height === "number") {
    if (
      typeof width !== "number" ||
      typeof height !== "number" ||
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 2 ||
      height < 2 ||
      width > LITHOPHANE_MAX_RESOLUTION ||
      height > LITHOPHANE_MAX_RESOLUTION ||
      width * height !== brightness.length
    ) {
      return null;
    }

    return { width, height };
  }

  const side = Math.round(Math.sqrt(brightness.length));

  if (
    side < 2 ||
    side > LITHOPHANE_MAX_RESOLUTION ||
    side * side !== brightness.length
  ) {
    return null;
  }

  return { width: side, height: side };
}

/** Значения сетки: целые числа 0–255 и ни одной дыры в массиве. */
function hasLithophaneBrightnessValues(brightness: number[]): boolean {
  // Цикл по индексам, а не every(): разреженный массив every() пропускает
  // дыры, и undefined попал бы в геометрию как NaN.
  for (let index = 0; index < brightness.length; index += 1) {
    const pixel = brightness[index];

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
 * Проверка сжатого изображения: сетка целых значений 0–255.
 *
 * Размеры приходят отдельными полями и должны сходиться с длиной массива:
 * 400 × 267 из нового клиента, 150 × 150 из старого. Без полей длина обязана
 * быть полным квадратом — так проверяются проекты прежнего формата. Строгая
 * проверка нужна и API, и нормализации: массив другого размера дал бы дыры в
 * сетке, а дробное или отрицательное число — неверную толщину.
 */
export function isLithophaneBrightness(
  value: unknown,
  width?: unknown,
  height?: unknown,
): value is number[] {
  return (
    Array.isArray(value) &&
    lithophaneBrightnessSize(value, width, height) !== null &&
    hasLithophaneBrightnessValues(value)
  );
}

/**
 * Сетка яркости из параметров: массив вместе с его размерами.
 *
 * Нормализация и API зовут одну функцию: она проверяет и значения, и размеры, а
 * испорченные данные заменяет демонстрационным рельефом — предпросмотр не
 * должен падать из-за состояния формы.
 */
export function resolveLithophaneBrightness(source: {
  lithophaneBrightness?: unknown;
  lithophaneBrightnessWidth?: unknown;
  lithophaneBrightnessHeight?: unknown;
}): LithophaneBrightnessGrid {
  const brightness = source.lithophaneBrightness;

  if (Array.isArray(brightness)) {
    const size = lithophaneBrightnessSize(
      brightness,
      source.lithophaneBrightnessWidth,
      source.lithophaneBrightnessHeight,
    );

    if (size !== null && hasLithophaneBrightnessValues(brightness)) {
      return { brightness, width: size.width, height: size.height };
    }
  }

  return {
    brightness: DEFAULT_LITHOPHANE_PARAMS.lithophaneBrightness,
    width: LITHOPHANE_RESOLUTION,
    height: LITHOPHANE_RESOLUTION,
  };
}

/**
 * Проверка одного слота грани: сетка яркости или `null`.
 *
 * Слот принимает только настоящую сетку с целыми значениями 0–255 и сходящимися
 * размерами — те же требования, что у основной сетки. Испорченный слот
 * отбрасывается целиком: подставить чужой кадр хуже, чем повторить предыдущую
 * грань.
 */
export function isLithophaneBrightnessGrid(value: unknown): boolean {
  if (value === null) {
    return true;
  }

  if (typeof value !== "object") {
    return false;
  }

  const grid = value as {
    brightness?: unknown;
    width?: unknown;
    height?: unknown;
  };

  return (
    Array.isArray(grid.brightness) &&
    isLithophaneBrightness(grid.brightness, grid.width, grid.height)
  );
}

/**
 * Проверка массива слотов остальных граней калейдоскопа.
 *
 * Массив короткий (до трёх слотов) и каждый слот — сетка или `null`. Клиент
 * присылает ровно три слота, но старый проект мог сохранить меньше: длина до
 * `LITHOPHANE_SIDE_IMAGE_SLOTS` принимается как есть, а нормализация дополнит её
 * пустыми слотами.
 */
export function isLithophaneSideBrightness(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length <= LITHOPHANE_SIDE_IMAGE_SLOTS &&
    value.every((slot) => isLithophaneBrightnessGrid(slot))
  );
}

/**
 * Слоты граней из состояния: всегда три, пустые — `null`.
 *
 * Функция одна на нормализацию и API: она проверяет каждый слот и выбрасывает
 * испорченные, а недостающие дополняет `null`. Так предпросмотр и файл печати
 * видят одинаковый набор кадров, и грань без фото честно повторяет предыдущую.
 */
export function resolveLithophaneSideBrightness(
  value: unknown,
): (LithophaneBrightnessGrid | null)[] {
  const slots: (LithophaneBrightnessGrid | null)[] = [];

  for (let slot = 0; slot < LITHOPHANE_SIDE_IMAGE_SLOTS; slot += 1) {
    const candidate = Array.isArray(value) ? value[slot] : null;

    if (
      candidate &&
      typeof candidate === "object" &&
      isLithophaneBrightnessGrid(candidate)
    ) {
      const grid = candidate as {
        brightness: number[];
        width: number;
        height: number;
      };

      slots.push({
        brightness: grid.brightness,
        width: grid.width,
        height: grid.height,
      });
    } else {
      slots.push(null);
    }
  }

  return slots;
}

/**
 * Кадры четырёх граней калейдоскопа: основной и три слота.
 *
 * Пустой слот повторяет предыдущую грань — так одна загруженная картинка
 * печатается на всех четырёх гранях, как у прежнего калейдоскопа, а человек,
 * загрузивший четыре разных фото, получает по кадру на грань. Возвращаются
 * ссылки на исходные сетки: копировать 400 × 267 чисел на каждую отрисовку
 * незачем.
 */
export function lithophaneFaceBrightness(
  params: LithophaneParams,
): LithophaneBrightnessGrid[] {
  const faces: LithophaneBrightnessGrid[] = [
    {
      brightness: params.lithophaneBrightness,
      width: params.lithophaneBrightnessWidth,
      height: params.lithophaneBrightnessHeight,
    },
  ];

  for (const slot of params.lithophaneSideBrightness) {
    faces.push(slot ?? faces[faces.length - 1]);
  }

  return faces;
}

/**
 * Уменьшает сетку яркости усреднением блоков: 400 × 267 → 150 × 100.
 *
 * Предпросмотр в сцене получает уменьшенную копию, иначе three.js пересобирает
 * сотни тысяч вершин на каждое движение слайдера. Усреднение, а не выборка
 * каждого N-го пикселя: тонкие штрихи логотипа иначе пропадали бы в
 * предпросмотре целиком. Пропорции сохраняются: длинная сторона сжимается до
 * `targetLongSide`, короткая — во столько же раз, поэтому предпросмотр не
 * растягивает кадр. Массив не увеличивается: если цель не меньше источника,
 * сетка возвращается как есть — ссылка на состояние остаётся прежней.
 */
export function downsampleLithophaneBrightness(
  brightness: number[],
  width: number,
  height: number,
  targetLongSide: number,
): LithophaneBrightnessGrid {
  const longSide = Math.max(width, height);

  if (targetLongSide < 2 || targetLongSide >= longSide) {
    return { brightness, width, height };
  }

  const scale = targetLongSide / longSide;
  const targetWidth = Math.max(2, Math.round(width * scale));
  const targetHeight = Math.max(2, Math.round(height * scale));
  const result = new Array<number>(targetWidth * targetHeight);
  const scaleX = width / targetWidth;
  const scaleY = height / targetHeight;

  for (let row = 0; row < targetHeight; row += 1) {
    const top = Math.floor(row * scaleY);
    const bottom = Math.max(top + 1, Math.floor((row + 1) * scaleY));

    for (let column = 0; column < targetWidth; column += 1) {
      const left = Math.floor(column * scaleX);
      const right = Math.max(left + 1, Math.floor((column + 1) * scaleX));
      let sum = 0;
      let count = 0;

      for (let y = top; y < bottom; y += 1) {
        const rowOffset = y * width;

        for (let x = left; x < right; x += 1) {
          sum += brightness[rowOffset + x];
          count += 1;
        }
      }

      result[row * targetWidth + column] = Math.round(sum / count);
    }
  }

  return { brightness: result, width: targetWidth, height: targetHeight };
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

/** Патрон каретки из запроса или сохранённого проекта. */
export function isLithophaneRailSocket(
  value: unknown,
): value is LithophaneRailSocket {
  return (
    typeof value === "string" &&
    (LITHOPHANE_RAIL_SOCKETS as readonly string[]).includes(value)
  );
}

/** Форма панели из запроса или сохранённого проекта. */
export function isLithophaneShape(value: unknown): value is LithophaneShape {
  return (
    typeof value === "string" &&
    (LITHOPHANE_SHAPES as readonly string[]).includes(value)
  );
}

/**
 * Проверка источника света из формы или API.
 *
 * Незнакомое значение — это не ошибка ввода: старый проект или ссылка без поля
 * получают ленту, а не падение сборки.
 */
export function isLithophaneLightSource(
  value: unknown,
): value is LithophaneLightSource {
  return (
    typeof value === "string" &&
    (LITHOPHANE_LIGHT_SOURCES as readonly string[]).includes(value)
  );
}

/**
 * Проверка гнезда скобы из формы или API.
 *
 * Как и у источника, незнакомое значение — не ошибка ввода: старый проект без
 * поля получает дальнее гнездо, где карта света ровнее.
 */
export function isLithophaneLightSeat(
  value: unknown,
): value is LithophaneLightSeat {
  return (
    typeof value === "string" &&
    (LITHOPHANE_LIGHT_SEATS as readonly string[]).includes(value)
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
    value.length <= CUSTOM_SVG_MAX_LENGTH &&
    !CUSTOM_SVG_FORBIDDEN.test(value)
  );
}

/** Проверка, что из SVG действительно получится контур. */
export function hasDrawableSvgData(value: string): boolean {
  return CUSTOM_SVG_CONTOUR.test(value);
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
 * редкая буква не обходили лимит. Строк не больше `KEYCHAIN_TEXT_MAX_LINES`, и
 * каждая держится в пределах `KEYCHAIN_TEXT_MAX_LENGTH`: перевод строки —
 * разделитель, а не символ шрифта.
 */
export function isValidKeychainText(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const lines = value.split("\n");

  return (
    lines.length <= KEYCHAIN_TEXT_MAX_LINES &&
    lines.every(
      (line) =>
        Array.from(line).length <= KEYCHAIN_TEXT_MAX_LENGTH &&
        Array.from(line).every((char) => TEXT_CHAR.test(char)),
    )
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
 *
 * Переводы строк сохраняются: многострочное имя чистится построчно, поэтому
 * пользователь может печатать вторую строку, не теряя первую.
 */
export function sanitizeKeychainText(value: string): string {
  return value
    .split("\n")
    .slice(0, KEYCHAIN_TEXT_MAX_LINES)
    .map((line) => cleanText(line, KEYCHAIN_TEXT_MAX_LENGTH))
    .join("\n");
}

/** Очистка надписи вывески для поля ввода: те же символы, лимит 15. */
export function sanitizeSignText(value: string): string {
  return cleanText(value, SIGN_TEXT_MAX_LENGTH);
}

/**
 * Символы, допустимые в содержимом QR.
 *
 * Набор шире, чем у имени: в ссылке есть `:/?&=#%+~`, в почте — `@` и точки, в
 * телефоне — скобки. Управляющие символы и перевод строки не проходят: строка
 * уходит в код как есть, и лишний перевод строки сломал бы разметку vCard.
 */
const QR_CARD_CHAR = /^[^\u0000-\u001f\u007f]$/u;

/** Общая очистка строки визитки: только печатные символы и лимит длины. */
function cleanQrText(value: string, maxLength: number): string {
  return Array.from(value)
    .filter((char) => QR_CARD_CHAR.test(char))
    .slice(0, maxLength)
    .join("");
}

/** Очистка содержимого QR: ссылка, телефон или почта. */
export function sanitizeQrCardContent(value: string): string {
  return cleanQrText(value, QR_CARD_CONTENT_MAX_LENGTH);
}

/** Очистка имени для визитки vCard: те же символы, лимит 40. */
export function sanitizeQrCardName(value: string): string {
  return cleanQrText(value, QR_CARD_NAME_MAX_LENGTH);
}

/** Очистка телефона для визитки: цифры, плюс, скобки, пробел и дефис. */
export function sanitizeQrCardPhone(value: string): string {
  return Array.from(value)
    .filter((char) => /^[\d+()\s-]$/.test(char))
    .slice(0, 20)
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
 * Число из состояния или дефолт.
 *
 * `snap` пропускает `NaN` насквозь: арифметика с ним возвращает `NaN`, и такой
 * габарит ломает геометрию уже на сервере. Для термопринта это важнее
 * терпимости к строке — габарит приходит из пропорций файла, — поэтому всё, что
 * не конечное число, честно заменяется дефолтом.
 */
function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Ввод узора: новые слои или прежний один узор строкой.
 *
 * До этапа композиции у вазы были три поля — `pattern`, `patternIntensity` и
 * `patternFrequency`. В сохранённых проектах, старых запросах к API и прежних
 * ссылках они остались, поэтому геометрия и бюджет сегментов принимают оба
 * вида ввода, а не требуют ручной миграции. Поля помечены `@deprecated`, но не
 * удалены: иначе пришлось бы переписать все сохранёнки разом.
 */
export type VasePatternInput = {
  /**
   * Новый вид: 1–3 слоя. Неполный слой допустим — нормализация подставит
   * значения по умолчанию, поэтому API может прислать только тип и амплитуду.
   */
  patterns?: ReadonlyArray<Partial<PatternLayer>>;
  /** @deprecated прежний один узор; превращается в единственный слой. */
  pattern?: VasePattern;
  /** @deprecated амплитуда прежнего узора, мм. */
  patternIntensity?: number;
  /** @deprecated частота прежнего узора. */
  patternFrequency?: number;
};

/**
 * Слой по умолчанию: его значения подставляются в неполный слой.
 *
 * Это дефолт нового проекта — рёбра 1.2 мм на частоте 20. Неполный слой от API
 * получает те же числа, поэтому запрос `{ patterns: [{ type: "waves" }] }` даёт
 * волны той же силы, что видит пользователь в конструкторе.
 */
const DEFAULT_PATTERN_LAYER = DEFAULT_VASE_PARAMS.patterns[0];

/**
 * Приводит один слой к границам слайдеров.
 *
 * Неполный слой получает значения по умолчанию: проект мог сохраниться в
 * середине разработки этапа, а API — прислать только тип и амплитуду. Числа
 * выравниваются по шагу так же, как размеры вазы, поэтому сохранённый проект и
 * тот же проект, открытый заново, дают одну и ту же геометрию.
 */
function normalizePatternLayer(layer: Partial<PatternLayer> | undefined): PatternLayer {
  const envelope = layer?.envelope;

  return {
    type: isVasePattern(layer?.type) ? layer.type : DEFAULT_PATTERN_LAYER.type,
    amplitude: snap(
      finiteNumber(layer?.amplitude, DEFAULT_PATTERN_LAYER.amplitude),
      CONSTRUCTOR_LIMITS.patternIntensity,
    ),
    frequency: snap(
      finiteNumber(layer?.frequency, DEFAULT_PATTERN_LAYER.frequency),
      CONSTRUCTOR_LIMITS.patternFrequency,
    ),
    phaseDeg: snap(
      finiteNumber(layer?.phaseDeg, DEFAULT_PATTERN_LAYER.phaseDeg),
      CONSTRUCTOR_LIMITS.patternPhaseDeg,
    ),
    envelope: {
      fadeTopMm: snap(
        finiteNumber(envelope?.fadeTopMm, DEFAULT_PATTERN_LAYER.envelope.fadeTopMm),
        CONSTRUCTOR_LIMITS.patternFadeMm,
      ),
      fadeBottomMm: snap(
        finiteNumber(
          envelope?.fadeBottomMm,
          DEFAULT_PATTERN_LAYER.envelope.fadeBottomMm,
        ),
        CONSTRUCTOR_LIMITS.patternFadeMm,
      ),
    },
  };
}

/**
 * Слои узора из любого вида ввода: новый список или прежний один узор.
 *
 * Правило одно на всю программу — клиент, сервер и проверочные скрипты зовут
 * эту функцию, — и оно же открывает старые сохранёнки без изменений:
 *
 *   — если пришло хоть одно поле прежнего вида (`pattern`, `patternIntensity`,
 *     `patternFrequency`), собирается один слой из них с нулевым затуханием:
 *     старый проект — это весь узор целиком, и половина нового вида в нём
 *     появиться не может. Поля прежнего вида главнее, поэтому объект вида
 *     `{ ...DEFAULT_VASE_PARAMS, pattern: "ribs" }` ведёт себя как до этапа;
 *   — иначе берутся первые `VASE_MAX_PATTERN_LAYERS` слоя нового вида; лишние
 *     отбрасываются, а не ломают проект.
 *
 * Нули в envelope — не заглушка: до этапа композиции затухание было общим и
 * считалось от цоколя и обода (`patternFade` в геометрии), и оно там осталось.
 * Поэтому старый проект даёт вершина в вершину прежнюю вазу, а не «похожую с
 * другим краем».
 *
 * Слой `smooth` остаётся в списке: он не смещает ничего, но панель и имя файла
 * должны видеть, что узор выключен, а не что слоёв нет вовсе.
 */
export function resolvePatternLayers(params: VasePatternInput): PatternLayer[] {
  const hasLegacyFields =
    params.pattern !== undefined ||
    params.patternIntensity !== undefined ||
    params.patternFrequency !== undefined;
  const layers = Array.isArray(params.patterns) ? params.patterns : [];

  if (!hasLegacyFields && layers.length > 0) {
    return layers
      .slice(0, VASE_MAX_PATTERN_LAYERS)
      .map((layer) => normalizePatternLayer(layer));
  }

  return [
    {
      type: isVasePattern(params.pattern)
        ? params.pattern
        : DEFAULT_PATTERN_LAYER.type,
      amplitude: snap(
        finiteNumber(params.patternIntensity, DEFAULT_PATTERN_LAYER.amplitude),
        CONSTRUCTOR_LIMITS.patternIntensity,
      ),
      frequency: snap(
        finiteNumber(params.patternFrequency, DEFAULT_PATTERN_LAYER.frequency),
        CONSTRUCTOR_LIMITS.patternFrequency,
      ),
      phaseDeg: 0,
      envelope: { fadeTopMm: 0, fadeBottomMm: 0 },
    },
  ];
}

/**
 * Порядок, в котором кнопка «Добавить слой» выбирает узоры.
 *
 * `smooth` в списке нет: слой без рельефа ничего не добавляет к композиции.
 */
const NEW_LAYER_ORDER: readonly VasePattern[] = [
  "ribs",
  "spiral",
  "waves",
  "honeycomb",
  "scales",
  "basket",
  "chevron",
  "moire",
  "flutes",
];

/**
 * Следующий слой для кнопки «Добавить слой».
 *
 * Новый слой берёт первый узор, которого в композиции ещё нет. Так нажатие сразу
 * меняет рисунок: второй слой рёбер на тех же числах только удвоил бы глубину.
 * Порядок предпочтений — рёбра, спираль, волны, соты, чешуйки, плетение,
 * шеврон, муар, каннелюры: от самого читаемого рельефа к самому мелкому.
 *
 * Частота вдвое реже дефолтной (6 против 20): редкий рисунок поверх частого
 * читается как композиция, а не как рябь в рябь. Амплитуда 1 мм — новый слой
 * заметен, но не спорит с первым. Затухание печатное, как у дефолтного слоя.
 *
 * Функция не знает про лимит слоёв: панель выключает кнопку после
 * `VASE_MAX_PATTERN_LAYERS`, а нормализация всё равно отбросит лишние.
 */
export function nextPatternLayer(
  existing: readonly PatternLayer[],
): PatternLayer {
  const used = new Set(existing.map((layer) => layer.type));
  const type =
    NEW_LAYER_ORDER.find((pattern) => !used.has(pattern)) ??
    NEW_LAYER_ORDER[NEW_LAYER_ORDER.length - 1];

  return {
    type,
    amplitude: 1,
    frequency: 6,
    phaseDeg: 0,
    envelope: {
      fadeTopMm: VASE_DEFAULT_FADE_TOP_MM,
      fadeBottomMm: VASE_DEFAULT_FADE_BOTTOM_MM,
    },
  };
}

/**
 * Короткое имя набора слоёв: `smooth`, `ribs` или `ribs+spiral`.
 *
 * Им подписаны имя STL и метаданные генерации, поэтому строка безопасна для
 * файла и для группировки в SQL: только латиница и плюс между слоями.
 */
export function vasePatternSlug(patterns: readonly PatternLayer[]): string {
  const types = patterns
    .map((layer) => layer.type)
    .filter((type) => type !== "smooth");

  return types.length > 0 ? types.join("+") : "smooth";
}

/**
 * Слои узора строками для журнала генераций: по элементу на слой.
 *
 * Формат `тип:амплитуда@частота` (`ribs:1.2@24`) выбран ради дашборда и SQL: без
 * пробелов и кавычек, поэтому `->` отдаёт готовый список, а `->>` — ту же строку
 * для быстрой группировки. Фаза и затухание у краёв не пишутся: они нужны печати,
 * а не рисунку, и у всех слоёв одинаковы. Числа уже выровнены нормализацией.
 */
export function vasePatternLayerTokens(
  patterns: readonly PatternLayer[],
): string[] {
  return patterns.map(
    (layer) => `${layer.type}:${layer.amplitude}@${layer.frequency}`,
  );
}

/** Человеческая подпись набора слоёв: «Рёбра + Спираль». */
export function vasePatternLabel(patterns: readonly PatternLayer[]): string {
  const types = patterns
    .map((layer) => layer.type)
    .filter((type) => type !== "smooth");

  if (types.length === 0) {
    return VASE_PATTERN_LABELS.smooth;
  }

  return types.map((type) => VASE_PATTERN_LABELS[type]).join(" + ");
}

/**
 * Проверяет и выравнивает параметры перед отрисовкой или экспортом.
 *
 * Функция нужна и клиенту, и серверу: значения могут прийти из слайдера,
 * из будущей ссылки с настройками или из запроса к API. Отсутствующие поля
 * заменяются значениями по умолчанию, поэтому неполный объект безопасен.
 *
 * Узор приходит либо слоями, либо прежними полями — оба вида разбирает
 * `resolvePatternLayers`, поэтому старый проект открывается без правок.
 */
export function normalizeVaseParams(
  params: Omit<Partial<VaseParams>, "patterns"> & VasePatternInput,
): VaseParams {
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
    patterns: resolvePatternLayers(params),
    footMm: snap(
      params.footMm ?? DEFAULT_VASE_PARAMS.footMm,
      CONSTRUCTOR_LIMITS.footMm,
    ),
    rimMm: snap(
      params.rimMm ?? DEFAULT_VASE_PARAMS.rimMm,
      CONSTRUCTOR_LIMITS.rimMm,
    ),
    sectionSides: snap(
      params.sectionSides ?? DEFAULT_VASE_PARAMS.sectionSides,
      CONSTRUCTOR_LIMITS.sectionSides,
    ),
    twistDeg: snap(
      params.twistDeg ?? DEFAULT_VASE_PARAMS.twistDeg,
      CONSTRUCTOR_LIMITS.twistDeg,
    ),
    flutes: snap(
      params.flutes ?? DEFAULT_VASE_PARAMS.flutes,
      CONSTRUCTOR_LIMITS.flutes,
    ),
    fluteDepthMm: snap(
      params.fluteDepthMm ?? DEFAULT_VASE_PARAMS.fluteDepthMm,
      CONSTRUCTOR_LIMITS.fluteDepthMm,
    ),
    organic: snap(
      params.organic ?? DEFAULT_VASE_PARAMS.organic,
      CONSTRUCTOR_LIMITS.organic,
    ),
    leanDeg: snap(
      params.leanDeg ?? DEFAULT_VASE_PARAMS.leanDeg,
      CONSTRUCTOR_LIMITS.leanDeg,
    ),
    vaseSeed: snap(
      params.vaseSeed ?? DEFAULT_VASE_PARAMS.vaseSeed,
      CONSTRUCTOR_LIMITS.vaseSeed,
    ),
  };
}

/**
 * Пресет из параметров: единственный источник формы брелока.
 *
 * Своего контура больше нет, поэтому любое сохранённое значение формы, которого
 * нет в реестре (прежние `custom`, `dog_tag`, `hexagon`, `cat` и остальные),
 * даёт пресет по умолчанию: проект из старой версии открывается готовой
 * моделью, а не пустой заготовкой без геометрии.
 */
function resolveKeychainPreset(
  params: Partial<KeychainParams>,
): KeychainPresetId {
  return isKeychainPresetId(params.keychainPreset)
    ? params.keychainPreset
    : DEFAULT_KEYCHAIN_PRESET_ID;
}

/** Общие поля декорации: то, что есть у любого вида. */
type KeychainDecorationCommon = Pick<
  KeychainDecoration,
  "depth" | "offsetX" | "offsetY" | "rotation" | "side"
>;

/**
 * Общие поля декорации из сырого ввода.
 *
 * Границы и шаг те же, что у слайдеров: панель, нормализация и серверная сверка
 * читают одни числа. Значение вне набора (`rotation: 37`, `side: "top"`) — не
 * ошибка состояния, а устаревший выбор, и он откатывается к образцу: так проект
 * из старой версии открывается, а не падает.
 */
function normalizeDecorationCommon(
  input: Readonly<Record<string, unknown>>,
  fallback: KeychainDecorationCommon,
): KeychainDecorationCommon {
  return {
    depth: snap(
      typeof input.depth === "number" ? input.depth : fallback.depth,
      KEYCHAIN_DECORATION_DEPTH_LIMITS,
    ),
    offsetX: snap(
      typeof input.offsetX === "number" ? input.offsetX : fallback.offsetX,
      KEYCHAIN_DECORATION_OFFSET_LIMITS,
    ),
    offsetY: snap(
      typeof input.offsetY === "number" ? input.offsetY : fallback.offsetY,
      KEYCHAIN_DECORATION_OFFSET_LIMITS,
    ),
    rotation: isKeychainRotation(input.rotation)
      ? input.rotation
      : fallback.rotation,
    side: isKeychainDecorationSide(input.side) ? input.side : fallback.side,
  };
}

/**
 * Имя файла картинки для панели.
 *
 * Хранится ради подписи «Картинка: logo.png»: путь отбрасывается, управляющие
 * символы вырезаются, длина ограничена — в `params_json` не должно быть ни
 * локальных путей, ни мусора из имени файла.
 */
function sanitizeKeychainImageName(value: string): string {
  const name = value.split(/[\\/]/).pop() ?? "";

  return name.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 60);
}

/** Надпись из сырого ввода: пустое содержимое допустимо и ждёт ввода. */
function normalizeTextDecoration(
  input: Readonly<Record<string, unknown>>,
): KeychainTextDecoration {
  const sample = DEFAULT_KEYCHAIN_TEXT_DECORATION;

  return {
    ...normalizeDecorationCommon(input, sample),
    align: isKeychainTextAlign(input.align) ? input.align : sample.align,
    content: sanitizeKeychainText(
      typeof input.content === "string" ? input.content : sample.content,
    ),
    font: isKeychainFontId(input.font) ? input.font : sample.font,
    id: "text",
    kind: "text",
    lineHeight: snap(
      typeof input.lineHeight === "number"
        ? input.lineHeight
        : sample.lineHeight,
      KEYCHAIN_TEXT_LINE_HEIGHT_LIMITS,
    ),
  };
}

/**
 * Картинка из сырого ввода: без настоящей маски декорации нет.
 *
 * Маска проходит только проверку формата: если поле покрытия испорчено или
 * слишком длинное, декорация гаснет и брелок печатается без логотипа. Так
 * сохранённый проект со старой маской не ломает ни предпросмотр, ни экспорт.
 * Порог яркости приходит из проекта прежней версии пустым и встаёт на 50% —
 * это ровно то деление, которым рельеф отделялся от фона до появления слайдера.
 * Инверсия в старых проектах не записана вовсе, поэтому читается строгим
 * `=== true`: любое другое значение (в том числе отсутствие поля) — выключена, и
 * сохранённый брелок печатается как раньше.
 */
function normalizeImageDecoration(
  input: Readonly<Record<string, unknown>>,
): KeychainImageDecoration | null {
  const imageData = input.imageData;

  if (!isKeychainImageData(imageData)) {
    return null;
  }

  return {
    ...normalizeDecorationCommon(
      input,
      createKeychainImageDecoration(imageData, ""),
    ),
    id: "image",
    imageData,
    imageInvert: input.imageInvert === true,
    imageName: sanitizeKeychainImageName(
      typeof input.imageName === "string" ? input.imageName : "",
    ),
    imageScale: snap(
      typeof input.imageScale === "number"
        ? input.imageScale
        : KEYCHAIN_IMAGE_SCALE_LIMITS.defaultValue,
      KEYCHAIN_IMAGE_SCALE_LIMITS,
    ),
    imageThreshold: snap(
      typeof input.imageThreshold === "number"
        ? input.imageThreshold
        : KEYCHAIN_IMAGE_THRESHOLD_LIMITS.defaultValue,
      KEYCHAIN_IMAGE_THRESHOLD_LIMITS,
    ),
    kind: "image",
  };
}

/** QR-код визитки из сырого ввода: содержимое чистится как в визитке. */
function normalizeQrDecoration(
  input: Readonly<Record<string, unknown>>,
): KeychainQrDecoration {
  const sample = DEFAULT_KEYCHAIN_QR_DECORATION;

  return {
    ...normalizeDecorationCommon(input, sample),
    id: "qr",
    kind: "qr",
    qrContent: sanitizeQrCardContent(
      typeof input.qrContent === "string" ? input.qrContent : sample.qrContent,
    ),
    qrContentType: isQrContentType(input.qrContentType)
      ? input.qrContentType
      : sample.qrContentType,
    qrMode: isQrMode(input.qrMode) ? input.qrMode : sample.qrMode,
    qrName: sanitizeQrCardName(
      typeof input.qrName === "string" ? input.qrName : sample.qrName,
    ),
    qrPhone: sanitizeQrCardPhone(
      typeof input.qrPhone === "string" ? input.qrPhone : sample.qrPhone,
    ),
  };
}

/** Декорация из записи массива: неизвестный вид и битая картинка отбрасываются. */
function normalizeDecorationEntry(input: unknown): KeychainDecoration | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }

  const entry = input as Record<string, unknown>;

  if (entry.kind === "text") {
    return normalizeTextDecoration(entry);
  }

  if (entry.kind === "image") {
    return normalizeImageDecoration(entry);
  }

  if (entry.kind === "qr") {
    return normalizeQrDecoration(entry);
  }

  return null;
}

/**
 * Декорации из плоских полей прежних проектов.
 *
 * Так открываются проекты, сохранённые до массива: надпись собирается в
 * текстовую декорацию, маска картинки — в картинку. Снятая галочка `showText`
 * означает «надписи в модели нет», поэтому в массив она не попадает: вернуть её
 * можно кнопкой «Добавить текст», а текст придётся набрать заново — в параметрах
 * его не было.
 *
 * Имя файла в старых проектах не хранилось, поэтому `imageName` пустой, и
 * панель подписывает карточку «Картинка из проекта», а не выдумывает имя.
 */
function legacyKeychainDecorations(
  params: KeychainDecorationsInput,
): KeychainDecoration[] {
  const decorations: KeychainDecoration[] = [];
  const content =
    typeof params.text === "string" ? sanitizeKeychainText(params.text) : "";

  if (params.showText !== false && content.trim()) {
    decorations.push(
      normalizeTextDecoration({
        content,
        depth: params.textDepth,
        offsetX: params.textOffsetX,
        offsetY: params.textOffsetY,
      }),
    );
  }

  const image = normalizeImageDecoration({
    depth: params.imageDepth,
    imageData: params.imageData,
    imageScale: params.imageScale,
    offsetX: params.imageOffsetX,
    offsetY: params.imageOffsetY,
  });

  if (image) {
    decorations.push(image);
  }

  return decorations;
}

/** QR-декорация из плоских полей визитки: только если хоть одно поле пришло. */
function legacyKeychainQrDecoration(
  params: KeychainDecorationsInput,
): KeychainQrDecoration | null {
  const present =
    params.qrMode !== undefined ||
    params.qrContentType !== undefined ||
    params.qrContent !== undefined ||
    params.qrName !== undefined ||
    params.qrPhone !== undefined;

  if (!present) {
    return null;
  }

  return normalizeQrDecoration({
    qrContent: params.qrContent,
    qrContentType: params.qrContentType,
    qrMode: params.qrMode,
    qrName: params.qrName,
    qrPhone: params.qrPhone,
  });
}

/**
 * Список декораций: новый массив или миграция плоских полей.
 *
 * Декораций каждого вида не больше одной, поэтому повтор вида в массиве
 * отбрасывается: первый пункт списка и есть настройка этого рельефа. Порядок
 * всегда один — текст, картинка, QR: он задаёт карточки в панели и не зависит от
 * того, в каком порядке пользователь добавлял рельефы.
 *
 * Пустой массив — норма нового проекта: декор появляется кнопками панели, а не
 * заготовкой. Поэтому пустота не доливается образцом, а плоские поля читаются
 * только тогда, когда массива нет вовсе — так проекты прежних версий (с полем
 * `text` и картинкой на верхнем уровне) открываются со своей надписью, а новый
 * проект без нажатой кнопки остаётся чистым.
 *
 * У QR-визитки декорация `qr` есть всегда: её содержимое печатает силуэт, и без
 * неё панели нечего показать в карточке кода. У остальных силуэтов она остаётся
 * только если пришла из проекта — так ссылка и имя визитки переживают
 * переключение формы туда и обратно.
 */
export function normalizeKeychainDecorations(
  params: KeychainDecorationsInput,
  preset: KeychainPresetId | null,
): KeychainDecoration[] {
  const source = Array.isArray(params.decorations) ? params.decorations : null;
  const decorations = new Map<KeychainDecorationKind, KeychainDecoration>();
  const entries = source
    ? source.slice(0, KEYCHAIN_MAX_DECORATIONS)
    : legacyKeychainDecorations(params);

  for (const entry of entries) {
    const decoration = normalizeDecorationEntry(entry);

    if (decoration && !decorations.has(decoration.kind)) {
      decorations.set(decoration.kind, decoration);
    }
  }

  if (!decorations.has("qr")) {
    const legacyQr = source ? null : legacyKeychainQrDecoration(params);

    if (legacyQr) {
      decorations.set("qr", legacyQr);
    }
  }

  if (preset === "qr-card" && !decorations.has("qr")) {
    decorations.set("qr", DEFAULT_KEYCHAIN_QR_DECORATION);
  }

  return KEYCHAIN_DECORATION_KINDS.flatMap((kind) => {
    const decoration = decorations.get(kind);

    return decoration ? [decoration] : [];
  });
}

/**
 * Проверяет и выравнивает параметры брелока.
 *
 * Как и у вазы, числа зажимаются в границы и встают на шаг слайдера. Текст
 * очищается от символов вне шрифта и обрезается до 10 знаков; сервер до вызова
 * этой функции проверяет исходную строку строго. Маска картинки ограничена
 * размером, а NFC-флаг принимается только настоящим boolean.
 *
 * Форму задаёт только пресет: сохранённый `custom` и прочие прежние силуэты
 * открываются пресетом по умолчанию, иначе предпросмотр и экспорт остались бы без
 * геометрии. Карман под NFC-метку держат только Apple Tag, Brick и QR-визитка — у
 * них в реестре есть `nfcPocketY`; у остальных пресетов флаг гасится, потому что
 * включённый флаг обещал бы карман, которого в модели нет. Тонкую основу
 * нормализация не чинит: глубину и толщину проверяет `nfcLayout`, и панель с API
 * блокируют скачивание с понятной причиной.
 *
 * У QR-визитки ширина и длина берутся не из слайдеров, а из размера кода: 60 × 40
 * и 70 × 45 мм обе выше границы `width`, поэтому габарит выводится из
 * `qrCardSize`, а толщина держится в границах пресета.
 *
 * Рельефы собираются в массив декораций: новый проект присылает его готовым, а
 * проект прежней версии — плоскими полями, которые миграция превращает в текстовую
 * декорацию и картинку (`normalizeKeychainDecorations`). Здесь же решается, есть
 * ли у модели декорация QR-кода: у визитки она есть всегда.
 */
export function normalizeKeychainParams(
  params: Partial<KeychainParams> & KeychainDecorationsInput,
): KeychainParams {
  const keychainPreset = resolveKeychainPreset(params);
  const qrCardSize = isQrCardSize(params.qrCardSize)
    ? params.qrCardSize
    : DEFAULT_KEYCHAIN_PARAMS.qrCardSize;
  // Габарит визитки задаёт размер кода, а не слайдер: 60 и 70 мм шире его границы.
  const qrCard = keychainPreset === "qr-card" ? QR_CARD_SIZES[qrCardSize] : null;
  const thicknessLimits = keychainThicknessLimits(keychainPreset);
  // Карман под метку обещан только там, где он есть в геометрии: реестр хранит
  // центр кармана, и его отсутствие — единственный признак «пресет не держит».
  const presetNfc =
    keychainPreset !== null &&
    keychainPresetById(keychainPreset).nfcPocketY !== undefined;
  const requestedNfc =
    typeof params.nfcEnabled === "boolean"
      ? params.nfcEnabled
      : DEFAULT_KEYCHAIN_PARAMS.nfcEnabled;
  // Позиция отверстия живёт в наборе пресета: у Starburst боковой стенки нет, у
  // Cap/Hex её пока не строит геометрия, у QR-визитки крепление своё. Значение вне
  // набора не ошибка состояния — это устаревший выбор после смены силуэта, и он
  // откатывается к центру, как `nfcEnabled` у пресета без кармана.
  const presetHolePlacements = keychainPreset
    ? keychainPresetById(keychainPreset).holePlacements
    : [];
  const holePlacement =
    isHolePlacement(params.holePlacement) &&
    presetHolePlacements.includes(params.holePlacement)
      ? params.holePlacement
      : DEFAULT_KEYCHAIN_PARAMS.holePlacement;
  // Рельефы: массив нового формата или миграция плоских полей. Одна функция на
  // клиент, сервер и сохранённые проекты — расхождение «в панели имя есть, в
  // файле нет» невозможно.
  const decorations = normalizeKeychainDecorations(params, keychainPreset);

  return {
    length:
      qrCard?.height ??
      snap(
        params.length ?? DEFAULT_KEYCHAIN_PARAMS.length,
        CONSTRUCTOR_LIMITS.length,
      ),
    width:
      qrCard?.width ??
      snap(
        params.width ?? DEFAULT_KEYCHAIN_PARAMS.width,
        CONSTRUCTOR_LIMITS.width,
      ),
    thickness: snap(
      params.thickness ?? thicknessLimits.defaultValue,
      thicknessLimits,
    ),
    // Рельефы на гранях: надпись, картинка, QR-код. Плоских полей больше нет,
    // поэтому смещения, толщины, шрифт и строки живут внутри декораций.
    decorations,
    keychainPreset,
    nfcEnabled: presetNfc ? requestedNfc : false,
    holePlacement,
    qrCardSize,
    qrCardTab: isQrCardTab(params.qrCardTab)
      ? params.qrCardTab
      : DEFAULT_KEYCHAIN_PARAMS.qrCardTab,
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
 * Проверяет и выравнивает параметры термопринта.
 *
 * Разметка принимается только целой: пустая строка — штатное «файл ещё не
 * загружен», а строка без поддерживаемых контуров или длиннее 200 000 символов
 * отбрасывается целиком, как свой контур брелока. Обрезать SVG нельзя: половина
 * разметки — это невалидный файл.
 *
 * Габарит и число слоёв выравниваются по шагам слайдеров, а всё, что не
 * конечное число, заменяется дефолтом: `NaN` из пустого слайдера сломал бы
 * геометрию. Ширина и высота независимы: ни одна не выводится из другой,
 * пропорции применяются при загрузке файла в панели, а не при нормализации.
 * Зеркало принимается только булевым, как дренаж кашпо.
 */
export function normalizeHeatTransferParams(
  params: Partial<HeatTransferParams>,
): HeatTransferParams {
  const heatTransferSvg =
    isCustomSvgData(params.heatTransferSvg) &&
    hasDrawableSvgData(params.heatTransferSvg)
      ? params.heatTransferSvg.trim()
      : "";

  return {
    heatTransferSvg,
    heatTransferWidth: snap(
      finiteNumber(
        params.heatTransferWidth,
        DEFAULT_HEAT_TRANSFER_PARAMS.heatTransferWidth,
      ),
      CONSTRUCTOR_LIMITS.heatTransferWidth,
    ),
    heatTransferHeight: snap(
      finiteNumber(
        params.heatTransferHeight,
        DEFAULT_HEAT_TRANSFER_PARAMS.heatTransferHeight,
      ),
      CONSTRUCTOR_LIMITS.heatTransferHeight,
    ),
    heatTransferLayers: Math.round(
      snap(
        finiteNumber(
          params.heatTransferLayers,
          DEFAULT_HEAT_TRANSFER_PARAMS.heatTransferLayers,
        ),
        CONSTRUCTOR_LIMITS.heatTransferLayers,
      ),
    ),
    heatTransferMirror:
      typeof params.heatTransferMirror === "boolean"
        ? params.heatTransferMirror
        : DEFAULT_HEAT_TRANSFER_PARAMS.heatTransferMirror,
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
 * Поля, которые могли остаться в сохранённых проектах прежней версии.
 *
 * Старая коробка хранила длину/ширину (`boxLength`, `boxWidth`) и массив
 * ячеек (`cellsX`, `gridX`). Новые поля важнее: старый формат распознаётся
 * только когда `boxDepth` ещё нет, поэтому миграция не путает ширину с
 * глубиной у свежих проектов.
 */
export type BoxParamsInput = Partial<BoxParams> & {
  boxLength?: unknown;
  cellsX?: unknown;
  cellsY?: unknown;
  gridX?: unknown;
  gridY?: unknown;
};

/** Сколько перегородок соответствует старому числу ячеек. */
function legacyBoxDividers(cells: unknown, grid: unknown): number | undefined {
  const count =
    typeof grid === "number" && Number.isFinite(grid)
      ? grid
      : Array.isArray(cells) && cells.length > 0
        ? cells.length
        : null;

  if (count === null) {
    return undefined;
  }

  return clamp(Math.round(count) - 1, 0, CONSTRUCTOR_LIMITS.boxDividers.max);
}

/**
 * Проверяет и выравнивает параметры коробки.
 *
 * Числа зажимаются в границы слайдеров, количество перегородок — целое от 0
 * до 3. `hasLid`, `boxMagnets` и `boxStack` принимаются только булевыми
 * значениями: строка «false» из формы не должна неожиданно включать крышку или
 * пазы. Неизвестный типоразмер магнита заменяется на 6 × 2 мм. Старые проекты с
 * `boxLength` и сеткой ячеек переводятся в новую модель без потери габаритов.
 */
export function normalizeBoxParams(params: BoxParamsInput): BoxParams {
  const legacy =
    params.boxDepth === undefined && typeof params.boxLength === "number";
  const width = legacy ? params.boxLength : params.boxWidth;
  const depth = legacy ? params.boxWidth : params.boxDepth;
  const legacyDividersX = legacy
    ? legacyBoxDividers(params.cellsX, params.gridX)
    : undefined;
  const legacyDividersY = legacy
    ? legacyBoxDividers(params.cellsY, params.gridY)
    : undefined;
  const hasLid =
    typeof params.hasLid === "boolean"
      ? params.hasLid
      : DEFAULT_BOX_PARAMS.hasLid;

  return {
    boxWidth: snap(
      finiteNumber(width, DEFAULT_BOX_PARAMS.boxWidth),
      CONSTRUCTOR_LIMITS.boxWidth,
    ),
    boxDepth: snap(
      finiteNumber(depth, DEFAULT_BOX_PARAMS.boxDepth),
      CONSTRUCTOR_LIMITS.boxDepth,
    ),
    boxHeight: snap(
      finiteNumber(params.boxHeight, DEFAULT_BOX_PARAMS.boxHeight),
      CONSTRUCTOR_LIMITS.boxHeight,
    ),
    boxWall: snap(
      finiteNumber(params.boxWall, DEFAULT_BOX_PARAMS.boxWall),
      CONSTRUCTOR_LIMITS.boxWall,
    ),
    boxCornerRadius: snap(
      finiteNumber(
        legacy ? undefined : params.boxCornerRadius,
        DEFAULT_BOX_PARAMS.boxCornerRadius,
      ),
      CONSTRUCTOR_LIMITS.boxCornerRadius,
    ),
    boxDividersX: snap(
      finiteNumber(
        params.boxDividersX ?? legacyDividersX,
        DEFAULT_BOX_PARAMS.boxDividersX,
      ),
      CONSTRUCTOR_LIMITS.boxDividers,
    ),
    boxDividersY: snap(
      finiteNumber(
        params.boxDividersY ?? legacyDividersY,
        DEFAULT_BOX_PARAMS.boxDividersY,
      ),
      CONSTRUCTOR_LIMITS.boxDividers,
    ),
    hasLid,
    boxMagnets:
      typeof params.boxMagnets === "boolean"
        ? params.boxMagnets
        : DEFAULT_BOX_PARAMS.boxMagnets,
    boxMagnetSize: isBoxMagnetSize(params.boxMagnetSize)
      ? params.boxMagnetSize
      : DEFAULT_BOX_PARAMS.boxMagnetSize,
    boxStack:
      hasLid &&
      (typeof params.boxStack === "boolean"
        ? params.boxStack
        : DEFAULT_BOX_PARAMS.boxStack),
  };
}

/**
 * Проверяет и выравнивает параметры литофана.
 *
 * Размеры встают на шаг слайдеров, толщины зажимаются в свои границы.
 * Максимум всегда остаётся хотя бы на один шаг выше минимума: иначе рельеф
 * превратился бы в плоскую пластину. Массив яркости принимается только целым,
 * прямоугольной сеткой до LITHOPHANE_MAX_RESOLUTION по каждой стороне;
 * испорченные данные заменяются демонстрационным рельефом, чтобы предпросмотр
 * не падал.
 *
 * Крепление без рамки невозможно: паз подставки и петли подвеса вырезаны в
 * рамке. Поэтому при выключенной рамке `lithoMount` принудительно становится
 * `none`, и панель не обещает крепление, которого в файле не будет.
 *
 * Форма панели и число панелей плафона проходят проверку по списку и границам
 * слайдера. Крепление при плафоне и калейдоскопе не сбрасывается: выбор остаётся
 * в состоянии, а геометрия и список файлов его не читают (см.
 * `lithophaneShapeHasMounts`). Так переключение формы туда и обратно не стирает
 * настройку крепления.
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
  const lithoShape = isLithophaneShape(params.lithoShape)
    ? params.lithoShape
    : DEFAULT_LITHOPHANE_PARAMS.lithoShape;
  const requestedMount = isLithophaneMount(params.lithoMount)
    ? params.lithoMount
    : DEFAULT_LITHOPHANE_PARAMS.lithoMount;
  // Патрон переживает смену крепления: у подставки он не читается, а вернувшись
  // к монорельсу, человек получает тот же выбор.
  const lithoRailSocket = isLithophaneRailSocket(params.lithoRailSocket)
    ? params.lithoRailSocket
    : DEFAULT_LITHOPHANE_PARAMS.lithoRailSocket;
  // Расстояние переживает смену крепления и патрона, как и сам патрон: у
  // подставки оно не читается, а вернувшись к монорельсу, человек получает свой
  // выбор.
  const lithoRailDistance = snap(
    params.lithoRailDistance ?? DEFAULT_LITHOPHANE_PARAMS.lithoRailDistance,
    CONSTRUCTOR_LIMITS.lithoRailDistance,
  );
  // Источник света не зависит от крепления: у сплошной ножки выборок нет, но
  // выбор человека остаётся, и на арке он получит то же гнездо, что и раньше.
  const lithoLightSource = isLithophaneLightSource(params.lithoLightSource)
    ? params.lithoLightSource
    : DEFAULT_LITHOPHANE_PARAMS.lithoLightSource;
  // Гнездо переживает смену источника и крепления, как и сам источник: у ленты
  // оно просто не читается, а вернувшись к патрону, человек получает свой выбор.
  const lithoLightSeat = isLithophaneLightSeat(params.lithoLightSeat)
    ? params.lithoLightSeat
    : DEFAULT_LITHOPHANE_PARAMS.lithoLightSeat;
  const brightness = resolveLithophaneBrightness(params);
  const sideBrightness = resolveLithophaneSideBrightness(
    params.lithophaneSideBrightness,
  );
  /*
    Число панелей плафона больше не выбирается слайдером: оно равно числу
    загруженных фото — 1 кадр печатается цельным кольцом, 2–4 делят окружность
    на равные секторы. Поле остаётся в состоянии, чтобы бюджет сетки, запрос STL
    и панель читали одно и то же вычисленное значение; у плоской панели и
    калейдоскопа оно по-прежнему берётся из параметров.
  */
  const lithophanePanels =
    lithoShape === "round"
      ? lithophaneLoadedFaceCount({ lithophaneSideBrightness: sideBrightness })
      : snap(
          params.lithophanePanels ?? DEFAULT_LITHOPHANE_PARAMS.lithophanePanels,
          CONSTRUCTOR_LIMITS.lithophanePanels,
        );

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
    lithophaneBrightness: brightness.brightness,
    lithophaneBrightnessWidth: brightness.width,
    lithophaneBrightnessHeight: brightness.height,
    lithophaneSideBrightness: sideBrightness,
    lithoFrame,
    lithoMount: lithoFrame ? requestedMount : "none",
    lithoRailSocket,
    lithoRailDistance,
    lithoShape,
    lithophanePanels,
    lithoLightSource,
    lithoLightSeat,
    // Флаг не зависит ни от формы, ни от крепления: лист либо вставлен, либо нет.
    lithoDiffuser:
      params.lithoDiffuser ?? DEFAULT_LITHOPHANE_PARAMS.lithoDiffuser,
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
  params: Omit<Partial<ConstructorParams>, "patterns"> &
    VasePatternInput &
    KeychainDecorationsInput,
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
    ...normalizePlanterParams(params),
    ...normalizeCoasterParams(params),
    ...normalizeJewelryStandParams(params),
    ...normalizePenHolderParams(params),
    ...normalizeHeatTransferParams(params),
  };
}
