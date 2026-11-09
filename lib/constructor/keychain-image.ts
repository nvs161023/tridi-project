import { ExtrudeGeometry } from "three";
import type { BufferGeometry } from "three";

/**
 * Префиксы `imageData` и границы порога живут в `params.ts`: там же нормализация
 * проверяет поле, и одна константа на всех не даст панели сохранить маску,
 * которую геометрия потом не узнает.
 */
import {
  isKeychainImageData,
  KEYCHAIN_IMAGE_FIELD_PREFIX,
  KEYCHAIN_IMAGE_MAX_LENGTH,
  KEYCHAIN_IMAGE_PREFIX,
  KEYCHAIN_IMAGE_THRESHOLD_LIMITS,
} from "@/lib/constructor/params";
import {
  buildFaceMask,
  findWidestBand,
  keychainRotatedSize,
  rectFits,
  KEYCHAIN_TEXT_EMBED_MM,
  type FaceMask,
  type KeychainTextKeepOut,
  type KeychainTextSide,
} from "@/lib/constructor/keychain-text";
import {
  checkRasterLimits,
  contourArea,
  coverageByAlpha,
  coverageByInk,
  hasTransparency,
  quantizeCoverage,
  simplifyContour,
  traceCoverageContours,
  type RasterLimitCode,
} from "@/lib/constructor/raster-to-contours";
import { buildShapes, groupContours } from "@/lib/constructor/shape-utils";
import { parseSvgOutline, type OutlinePoint } from "@/lib/constructor/svg-outline";

/**
 * Картинка на брелоке: маска из PNG/JPG, её место на грани и рельеф.
 *
 * Панель переводит загруженный файл в поле покрытия и хранит его в
 * `params.imageData` как четырёхбитную маску в base64. Почему не PNG и не SVG:
 *
 * - сервер и предпросмотр собирают геометрию одним кодом, а своего декодера PNG
 *   на сервере нет;
 * - ступени серого в SVG-путях не выразить: прежняя маска была бинарной, и
 *   полутон на логотипе превращался в рваное пятно;
 * - маска 400×400 при четырёх битах на ячейку — около 104 КБ base64, она
 *   влезает в `KEYCHAIN_IMAGE_MAX_LENGTH` вместе с остальными параметрами.
 *
 * Маска живёт в трёх видах: поле покрытия (0…1 на ячейку) обводится marching
 * squares, из него же берётся растровая маска проверки места, а порог яркости
 * решает, какая ячейка считается пластиком. Поэтому рельеф и проверка всегда
 * говорят об одной картинке: точка печатается там, где маска считает её тёмной.
 *
 * Доля краски в непрозрачной картинке — `1 − min(R,G,B)/255`, а не яркость: у
 * синего и жёлтого светлота обманывает, и цветные части логотипа оказывались ниже
 * порога. Маска бинарная по смыслу, хотя хранится ступенями. Дизеринга нет:
 * Флойд — Стейнберг разбрасывал полутон по одиночным ячейкам, а сопло такие точки
 * не печатает. Вместо дизеринга работают два правила:
 *
 * - жёсткий порог: пластиком становится ячейка темнее `imageThreshold`
 *   (у PNG с прозрачностью решает альфа, а белый фон не печатается никогда);
 * - дилатация в один проход: штрих тоньше сопла получает печатную ширину, и
 *   буквы остаются буквами — без неё слайсер рвёт тонкую линию на осколки.
 *
 * Место ищется по карте грани 0.4 мм — той же, что у надписи. Отверстие под
 * кольцо, кромка силуэта, полость кармана NFC и буквы блокируют ячейки, поэтому
 * картинка не выходит за брелок и не наезжает на имя. Запрошенный масштаб — не
 * приказ: если места мало, картинка ужимается шагом сетки, и отчёт об этом
 * уходит в интерфейс.
 */

/**
 * Растр загрузки: картинка уменьшается до этого квадрата перед сборкой маски.
 *
 * 400 ячеек по большей стороне. На логотип 26 мм это 0.065 мм на ячейку, и мелкий
 * текст вроде «tridi-print.ru» остаётся буквами: при сетке 240 ячейка была 0.11 мм,
 * штрих подписи занимал две, и после расширения соседние буквы слипались. Запас
 * взят не «на глаз»: в маске 400 ячеек просвет между буквами — это три-четыре
 * ячейки против одной-двух, поэтому дилатация их больше не заливает.
 *
 * Предел задаёт формат: габарит маски лежит в заголовке (маркер и два uint16), а
 * длина строки — в `KEYCHAIN_IMAGE_MAX_LENGTH`. Четыре бита на ячейку дают на сетке
 * 400 маску 400 × 400 = 80 002 байта, то есть ~104 КБ base64: это вчетверо длиннее
 * прежней 240-й маски, зато полутон и порог по-прежнему живут в самих данных, а не
 * запекаются в момент загрузки файла.
 */
export const KEYCHAIN_IMAGE_GRID = 400;

/**
 * Ступеней покрытия в ячейке маски.
 *
 * Четыре бита на ячейку: шестнадцати ступеней хватает, чтобы порог яркости имел
 * пятнадцать различимых положений, а строка маски оставалась короткой.
 */
export const KEYCHAIN_IMAGE_FIELD_LEVELS = 16;

/** Сколько раз маску можно огрубить, если контуров вышло слишком много. */
const COARSEN_ATTEMPTS = 3;

/** Площадь контура в ячейках, ниже которой это крупа, а не рисунок. */
const MIN_CONTOUR_AREA_CELLS = 0.5;

/**
 * Упрощение контура маски, в ячейках.
 *
 * 0.4 ячейки — это 0.026 мм при сетке 400 и логотипе 26 мм: допуск снимает только
 * точки, которые лежат на прямой между соседями, то есть повторяющиеся узлы
 * ступеньки marching squares. Форму буквы он не трогает.
 *
 * Почему не 1.5, как было: полтора допуска при сетке 240 съедали подпись целиком.
 * Замер на логотипе 273 × 273 — из 38 обведённых контуров 14 схлопывались в
 * отрезок или в точку и отбрасывались как крупа; при 0.4 остаются все 38, и
 * «tridi-print.ru» доходит до геометрии буквами. Крупа сама по себе не проблема:
 * её режут площадь контура (`MIN_CONTOUR_AREA_CELLS`) и ширина сопла.
 *
 * Если геометрия не примет столько точек (`RASTER_MAX_POINTS_TOTAL`), допуск
 * растёт ступенями из `MASK_RDP_RETRY`, и только потом огрубляется сетка: убрать
 * лишние узлы дешевле, чем потерять половину разрешения.
 */
const MASK_RDP_CELLS = 0.4;

/**
 * Ступени допуска на случай, если обводка не влезла в предел точек.
 *
 * 0.75 — прежний общий допуск растра, 1.5 — прежнее значение маски. Порядок важен:
 * сначала пробуем сохранить форму, и лишь последняя ступень согласна на потери.
 */
const MASK_RDP_RETRY = [0.75, 1.5] as const;

/**
 * Тоньше сопла рельеф не напечатать, мм.
 *
 * Пятна мельче этого размера выбрасываются при сборке геометрии, а не при
 * загрузке: маска от размера картинки не зависит, а ширина сопла — про печать.
 * После дилатации штрих выходит в три ячейки, поэтому фильтр ловит уже не крупу,
 * а случайные хвосты инверсии и сглаженного края.
 */
export const KEYCHAIN_IMAGE_MIN_FEATURE_MM = 0.4;

/**
 * Минимальная доля краски в ячейке, которая ещё становится пластиком.
 *
 * Это правило «белый фон не печатается»: ячейка светлее 90 % яркости остаётся
 * фоном при любом пороге. Максимум слайдера и так равен 90 %, а константа держит
 * правило, даже если из старого проекта придёт порог вне границ.
 */
const MIN_INK_SHARE = 0.1;

/** Разрешение маски проверки у прежней SVG-обводки: она осталась для старых проектов. */
const LEGACY_MASK_PIXELS = 96;

/**
 * Зазор между рельефами на одной грани, мм.
 *
 * Экспортируется: зазор ставит общий конвейер декораций
 * (`keychain-geometry.ts`), когда вычитает уже placed рельеф из карты грани.
 * Вплотную рельефы слиплись бы в одно пятно при печати.
 */
export const KEYCHAIN_DECORATION_GAP_MM = 0.8;

/** Минимальная полоса под картинку, мм: мельче логотип не читается. */
const IMAGE_MIN_BAND_MM = 4;

/** Ниже этой доли запрошенного масштаба картинка уже не логотип, а точка. */
const IMAGE_MIN_SCALE_SHARE = 0.25;

/** Шаг подгонки масштаба: 5% от базового размера за попытку. */
const IMAGE_SCALE_STEP = 0.05;

/** Сколько разобранных картинок держим в памяти: слайдер зовёт сборку часто. */
const BUILD_CACHE_LIMIT = 6;

/** Почему из файла не вышло маски. */
export type KeychainImageError = "empty" | RasterLimitCode;

/**
 * Текст отказа для панели.
 *
 * Коды ошибок общие с растеризацией, поэтому объяснение живёт здесь: панель не
 * повторяет формулировки и не расходится с ними, когда пределы растра поменяются.
 */
export function keychainImageErrorText(error: KeychainImageError): string {
  if (error === "empty") {
    return "На картинке не нашлось рисунка. Нужен логотип на прозрачном или светлом фоне: рельефом становится тёмное и непрозрачное.";
  }

  if (error === "too_many_contours") {
    return "Слишком много отдельных пятен. Загрузите логотип с крупным силуэтом без мелкой крошки.";
  }

  return "Слишком подробная картинка. Упростите логотип: мелкие штрихи на брелоке всё равно сольются.";
}

/**
 * Поле покрытия картинки: ступени 0…`KEYCHAIN_IMAGE_FIELD_LEVELS − 1`.
 *
 * Панель рисует по нему превью, геометрия — рельеф. Ячейки идут сверху вниз, как
 * строки исходного файла: переворот по Y делает уже постановка.
 */
export type KeychainImageField = {
  cells: Uint8Array;
  height: number;
  width: number;
};

/**
 * Маска, готовая к постановке.
 *
 * `contours` центрированы в нуле и приведены к единичному габариту: большая
 * сторона картинки равна 1, поэтому размер в миллиметрах — это просто `size`.
 */
export type KeychainImageBuild = {
  contours: OutlinePoint[][];
  /** Габарит маски в единичных координатах: границы нужны маске проверки. */
  frame: { height: number; minX: number; minY: number; width: number };
  /** Растр маски по габариту: по нему проверяется пересечение с препятствиями. */
  mask: { bits: Uint8Array; height: number; width: number };
  /** Сторона пикселя маски в единичных координатах. */
  pixel: number;
};

/** Результат постановки: центр, размер и во что превратился запрос. */
export type KeychainImagePlacement = {
  centerX: number;
  centerY: number;
  /** Большая сторона картинки, мм. */
  size: number;
  /** Запрошенный масштаб из панели. */
  requested: number;
  /** Фактический масштаб: меньше запрошенного, если пришлось ужиматься. */
  actual: number;
  side: KeychainTextSide;
};

/**
 * Что получилось из картинки в модели: по этим числам панель предупреждает.
 *
 * `side = null` значит, что картинка на брелок не встала: места нет ни на лице,
 * ни на обороте. `actual < requested` — картинка ужалась ради букв или кромки.
 */
export type KeychainImageFit = {
  requested: number;
  actual: number;
  side: KeychainTextSide | null;
  /** Большая сторона вставшей картинки, мм: 0, если она не встала. */
  size: number;
};

/** Готовые маски по строке `imageData` и порогу: сборка идёт на каждый параметр. */
const buildCache = new Map<string, KeychainImageBuild | null>();

/**
 * Уменьшает поле покрытия до рабочей сетки, если файл больше неё.
 *
 * Панель уже отдаёт картинку уменьшенной до `KEYCHAIN_IMAGE_GRID`, но функция
 * публичная: скрипты и тесты зовут её с исходными пикселями. Усреднение по
 * площади (а не выбор пикселя) обязательно: иначе тонкий штрих логотипа на
 * большой картинке просто пропадёт между ячейками.
 */
function packToGrid(
  field: Float32Array,
  width: number,
  height: number,
): { field: Float32Array; height: number; width: number } {
  const longest = Math.max(width, height);

  if (longest <= KEYCHAIN_IMAGE_GRID) {
    return { field, height, width };
  }

  const targetWidth = Math.max(2, Math.round((width * KEYCHAIN_IMAGE_GRID) / longest));
  const targetHeight = Math.max(2, Math.round((height * KEYCHAIN_IMAGE_GRID) / longest));
  const sums = new Float32Array(targetWidth * targetHeight);
  const counts = new Uint32Array(targetWidth * targetHeight);

  for (let row = 0; row < height; row += 1) {
    const targetRow = Math.min(
      targetHeight - 1,
      Math.floor((row * targetHeight) / height),
    );

    for (let column = 0; column < width; column += 1) {
      const targetColumn = Math.min(
        targetWidth - 1,
        Math.floor((column * targetWidth) / width),
      );
      const target = targetRow * targetWidth + targetColumn;

      sums[target] += field[row * width + column];
      counts[target] += 1;
    }
  }

  const packed = new Float32Array(targetWidth * targetHeight);

  for (let index = 0; index < packed.length; index += 1) {
    packed[index] = counts[index] > 0 ? sums[index] / counts[index] : 0;
  }

  return { field: packed, height: targetHeight, width: targetWidth };
}

/** Байт-маркер заголовка маски: ноль не бывает началом прежнего габарита. */
const MASK_HEADER_MARKER = 0;

/** Длина заголовка маски нового образца: маркер и два uint16. */
const MASK_HEADER_BYTES = 5;

/** Длина заголовка прежней маски: ширина и высота по одному байту. */
const MASK_HEADER_BYTES_LEGACY = 2;

/**
 * Упаковывает поле покрытия в `imageData`: заголовок габарита и по четыре бита
 * на ячейку.
 *
 * Заголовок — маркер 0 и два uint16 (ширина, высота) старшим байтом вперёд. Сетка
 * 400 в один байт не влезает, а маркер отличает новую строку от прежней, где первым
 * шёл сам габарит: он не бывает меньше двух, поэтому ноль однозначен и старые
 * проекты читаются без миграции.
 *
 * Ячейки идут построчно слева направо, младшие четыре бита — чётная колонка,
 * старшие — нечётная. Заголовок вместо JSON: строка и без него длинная, а `atob`
 * в браузере и в Node разбирает её одинаково.
 */
function packField(field: KeychainImageField): string {
  const { cells, height, width } = field;
  const total = width * height;
  const bytes = new Uint8Array(MASK_HEADER_BYTES + Math.ceil(total / 2));

  bytes[0] = MASK_HEADER_MARKER;
  bytes[1] = (width >> 8) & 0xff;
  bytes[2] = width & 0xff;
  bytes[3] = (height >> 8) & 0xff;
  bytes[4] = height & 0xff;

  for (let index = 0; index < total; index += 1) {
    const slot = MASK_HEADER_BYTES + (index >> 1);
    const value = cells[index] & 0x0f;

    bytes[slot] = index % 2 === 0 ? value : bytes[slot] | (value << 4);
  }

  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return `${KEYCHAIN_IMAGE_FIELD_PREFIX}${btoa(binary)}`;
}

/**
 * Разметка SVG из `imageData` прежних проектов.
 *
 * `atob` есть и в браузере, и в Node, поэтому разбор у панели и у роута общий.
 * Исключение из `atob` — испорченная строка: возвращаем `null`, а не роняем
 * сборку модели.
 */
export function decodeKeychainImageMarkup(
  imageData: string | null | undefined,
): string | null {
  if (!isKeychainImageData(imageData) || !imageData.startsWith(KEYCHAIN_IMAGE_PREFIX)) {
    return null;
  }

  try {
    const markup = atob(imageData.slice(KEYCHAIN_IMAGE_PREFIX.length));

    return markup.includes("<svg") ? markup : null;
  } catch {
    return null;
  }
}

/** Растеризует контуры в маску по габариту: чётность пересечений по строке. */
function rasterizeContours(
  contours: readonly (readonly OutlinePoint[])[],
  frame: { height: number; minX: number; minY: number; width: number },
  pixel: number,
): { bits: Uint8Array; height: number; width: number } {
  const width = Math.max(1, Math.round(frame.width / pixel));
  const height = Math.max(1, Math.round(frame.height / pixel));
  const bits = new Uint8Array(width * height);
  const crossings: number[] = [];

  for (let row = 0; row < height; row += 1) {
    const y = frame.minY + (row + 0.5) * pixel;

    crossings.length = 0;

    for (const contour of contours) {
      for (let index = 0; index < contour.length; index += 1) {
        const [x1, y1] = contour[index];
        const [x2, y2] = contour[(index + 1) % contour.length];

        // Ребро пересекает горизонталь, только если его концы по разные стороны.
        if (y1 <= y === y2 <= y) {
          continue;
        }

        crossings.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
    }

    crossings.sort((left, right) => left - right);

    for (let pair = 0; pair + 1 < crossings.length; pair += 2) {
      const from = Math.max(
        0,
        Math.ceil((crossings[pair] - frame.minX) / pixel - 0.5),
      );
      const to = Math.min(
        width - 1,
        Math.floor((crossings[pair + 1] - frame.minX) / pixel - 0.5),
      );

      for (let column = from; column <= to; column += 1) {
        bits[row * width + column] = 1;
      }
    }
  }

  return { bits, height, width };
}

/**
 * Разбирает `imageData` прежних проектов: SVG с контурами маски.
 *
 * Ветка нужна, чтобы старый брелок открывался и печатался как раньше: пересжать
 * маску на сервере нечем (PNG в параметрах не осталось), а бинарная обводка
 * годится и сейчас.
 */
function createSvgBuild(imageData: string): KeychainImageBuild | null {
  const markup = decodeKeychainImageMarkup(imageData);
  const parsed = markup ? parseSvgOutline(markup) : [];

  if (parsed.length === 0) {
    return null;
  }

  // Ось Y в SVG растёт вниз, а на грани брелока — вверх: знак меняется сразу,
  // иначе логотип печатался бы перевёрнутым.
  const flipped = parsed.map((contour) =>
    contour.map(([x, y]) => [x, -y] as OutlinePoint),
  );
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const contour of flipped) {
    for (const [x, y] of contour) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const span = Math.max(spanX, spanY);

  if (!Number.isFinite(span) || span <= 0) {
    return null;
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const contours = flipped.map((contour) =>
    contour.map(
      ([x, y]) => [(x - centerX) / span, (y - centerY) / span] as OutlinePoint,
    ),
  );
  const width = spanX / span;
  const height = spanY / span;
  const frame = {
    height,
    minX: -width / 2,
    minY: -height / 2,
    width,
  };
  const pixel = Math.max(width, height) / LEGACY_MASK_PIXELS;

  return { contours, frame, mask: rasterizeContours(contours, frame, pixel), pixel };
}

/**
 * Разбирает маску из `imageData`: заголовок габарита и полубайты покрытия.
 *
 * Читаются оба образца заголовка: новый (маркер 0 и два uint16) и прежний (ширина и
 * высота по одному байту). Проекты, сохранённые до сетки 400, открываются как есть:
 * поле у них то же самое, отличается только габарит в начале строки.
 *
 * `null` — строка не наша (прежняя SVG-обводка), испорчена или габарит в
 * заголовке не сходится с длиной: файл могли обрезать в базе. Исключение из
 * `atob` не роняет сборку модели, а превращается в «картинки нет».
 */
export function keychainImageField(
  imageData: string | null | undefined,
): KeychainImageField | null {
  if (
    !isKeychainImageData(imageData) ||
    !imageData.startsWith(KEYCHAIN_IMAGE_FIELD_PREFIX)
  ) {
    return null;
  }

  let binary: string;

  try {
    binary = atob(imageData.slice(KEYCHAIN_IMAGE_FIELD_PREFIX.length));
  } catch {
    return null;
  }

  if (binary.length < MASK_HEADER_BYTES_LEGACY) {
    return null;
  }

  const legacy = binary.charCodeAt(0) !== MASK_HEADER_MARKER;
  const header = legacy ? MASK_HEADER_BYTES_LEGACY : MASK_HEADER_BYTES;

  if (binary.length < header) {
    return null;
  }

  const width = legacy
    ? binary.charCodeAt(0)
    : (binary.charCodeAt(1) << 8) | binary.charCodeAt(2);
  const height = legacy
    ? binary.charCodeAt(1)
    : (binary.charCodeAt(3) << 8) | binary.charCodeAt(4);

  if (
    width < 2 ||
    height < 2 ||
    width > KEYCHAIN_IMAGE_GRID ||
    height > KEYCHAIN_IMAGE_GRID
  ) {
    return null;
  }

  const total = width * height;

  if (binary.length < header + Math.ceil(total / 2)) {
    return null;
  }

  const cells = new Uint8Array(total);

  for (let index = 0; index < total; index += 1) {
    const byte = binary.charCodeAt(header + (index >> 1));

    cells[index] = index % 2 === 0 ? byte & 0x0f : (byte >> 4) & 0x0f;
  }

  return { cells, height, width };
}

/**
 * Переводит пиксели файла в `imageData`.
 *
 * Правило выбора поля простое. У PNG-логотипа фон прозрачный, и яркость там не
 * значит ничего: покрытие задаёт альфа, и оно берётся мягким, чтобы сглаженный
 * край остался гладким. У фото и JPG прозрачности нет, поэтому покрытие — это
 * доля краски `1 − яркость`.
 *
 * Дизеринга нет: поле квантуется в шестнадцать ступеней жёстко, а полутон режет
 * порог яркости при сборке — крупа из точек на FDM не печатается (см.
 * `quantizeCoverage`). Дальше поле уменьшается до рабочей сетки. Обводка в
 * контуры идёт уже при сборке модели: порог меняется слайдером, и маску из-за
 * него пересобирать незачем.
 *
 * Пустая картинка возвращает код ошибки: панель покажет его вместо превью.
 */
export function keychainImageFromPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): { imageData: string } | { error: KeychainImageError } {
  if (width < 2 || height < 2) {
    return { error: "empty" };
  }

  const alpha = hasTransparency(pixels, width, height);
  const coverage = alpha
    ? coverageByAlpha(pixels, width, height)
    : coverageByInk(pixels, width, height);
  const grid = packToGrid(coverage, width, height);
  const cells = quantizeCoverage(
    grid.field,
    grid.width,
    grid.height,
    KEYCHAIN_IMAGE_FIELD_LEVELS,
  );
  let ink = 0;

  for (const cell of cells) {
    if (cell > 0) {
      ink += 1;
    }
  }

  if (ink === 0) {
    return { error: "empty" };
  }

  const imageData = packField({ cells, height: grid.height, width: grid.width });

  // Заголовок и base64 добавляют к маске немного, но лимит `params_json` общий:
  // его проверяет та же строка, что уходит в параметры.
  return imageData.length > KEYCHAIN_IMAGE_MAX_LENGTH
    ? { error: "too_many_points" }
    : { imageData };
}

/**
 * Огрубляет поле вдвое: соседние ячейки усредняются.
 *
 * Нужно, когда обводка упёрлась в предел числа контуров: у шумной маски пятен
 * больше, чем принимает геометрия. Половинное разрешение сливает крупу в
 * крупные пятна, рисунок остаётся, а параметры модели не растут. Усреднение, а
 * не выбор ячейки: иначе тонкие штрихи рвутся на пунктир.
 */
function coarsenField(field: KeychainImageField): KeychainImageField {
  const width = Math.max(2, Math.ceil(field.width / 2));
  const height = Math.max(2, Math.ceil(field.height / 2));
  const sums = new Uint32Array(width * height);
  const counts = new Uint32Array(width * height);

  for (let row = 0; row < field.height; row += 1) {
    for (let column = 0; column < field.width; column += 1) {
      const target = Math.floor(row / 2) * width + Math.floor(column / 2);

      sums[target] += field.cells[row * field.width + column];
      counts[target] += 1;
    }
  }

  const cells = new Uint8Array(width * height);

  for (let index = 0; index < cells.length; index += 1) {
    cells[index] = counts[index] > 0 ? Math.round(sums[index] / counts[index]) : 0;
  }

  return { cells, height, width };
}

/**
 * Бинарная маска картинки: порог яркости, инверсия и дилатация.
 *
 * Три шага, строго в этом порядке:
 *
 * 1. Порог. Пластиком становится ячейка темнее `threshold` процентов яркости. В
 *    маске яркость обратна покрытию, поэтому сравнение идёт с `1 − порог`: ячейка
 *    проходит, если краски в ней больше. У PNG с прозрачностью край даёт ступени
 *    0 и 15, и любая граница 10–90 % проходит по одному месту — фигуру задаёт
 *    альфа. Белый фон не печатается никогда: `MIN_INK_SHARE` держит нижнюю
 *    границу порога, и ячейка светлее 90 % яркости остаётся фоном.
 * 2. Инверсия (`imageInvert`): пластик и фон меняются местами. Нужна логотипам
 *    светлым по тёмному; у чёрного рисунка на белом фоне она даст заливку с
 *    окном по рисунку.
 * 3. Дилатация в один проход по четырём соседям: штрих тоньше сопла получает
 *    печатную ширину. Расширяется всё — так буквы подписи остаются целыми, а
 *    прибавка в одну ячейку (0.065 мм) меньше сопла и на глаз не видна.
 *
 * Ячейки возвращаются в порядке растра: первая строка — верхняя. Переворачивает
 * маску только `createFieldBuild`, а превью в панели рисует как есть.
 */
export function keychainImageMask(
  field: KeychainImageField,
  threshold: number,
  invert: boolean,
): Uint8Array {
  const { cells, height, width } = field;
  const cut =
    Math.max(MIN_INK_SHARE, 1 - threshold / 100) *
    (KEYCHAIN_IMAGE_FIELD_LEVELS - 1);
  const bits = new Uint8Array(cells.length);

  for (let index = 0; index < cells.length; index += 1) {
    const plastic = cells[index] >= cut;

    bits[index] = plastic === invert ? 0 : 1;
  }

  return dilateMask(bits, width, height);
}

/**
 * Дилатация: каждый проход добавляет пластику ячейку по четырём сторонам.
 *
 * Зачем вообще: сопло 0.4 мм не печатает штрих тоньше своей ширины. Ячейка маски —
 * 0.065 мм при логотипе 26 мм и сетке 400, поэтому линия в одну-две ячейки для
 * принтера не существует: слайсер либо выбрасывает её, либо рвёт на пунктир. После
 * расширения подпись «tridi-print.ru» выходит штрихом 0.2–0.3 мм и печатается
 * целиком, а не осколками.
 *
 * Проход ровно один и по четырём соседям. Восемь соседей съедали бы углы букв, а
 * второй проход утолщал штрих до пяти ячеек и заливал просветы: на сетке 400
 * просвет между буквами — три-четыре ячейки, и одна ячейка расширения его уже не
 * схлопывает.
 *
 * Прежняя «дилатация по ядру» (расширять только пластик без четырёх соседей)
 * оставляла толстые кольца в покое, но у подписи ядра нет вовсе: буквы считались
 * тонкими и расширялись неравномерно, а срезание одиночных хвостов отрезало у них
 * куски. Ровная прибавка 0.065 мм с каждой стороны меньше сопла и на глаз не видна.
 */
function dilateMask(
  bits: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const grown = new Uint8Array(bits);

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const index = row * width + column;

      if (bits[index] === 1) {
        continue;
      }

      const west = column > 0 && bits[index - 1] === 1;
      const east = column + 1 < width && bits[index + 1] === 1;
      const north = row > 0 && bits[index - width] === 1;
      const south = row + 1 < height && bits[index + width] === 1;

      if (west || east || north || south) {
        grown[index] = 1;
      }
    }
  }

  return grown;
}

/**
 * Обводит бинарную маску в контуры единичной сетки.
 *
 * Marching squares идёт по покрытию 0/1 с порогом 0.5: край ложится на середину
 * между ячейками, ступенек растра не добавляя. Контуры меньше половины ячейки
 * выбрасываются — после дилатации это уже не крупа, а случайные хвосты инверсии
 * или сглаженного края.
 *
 * `tolerance` — допуск упрощения в ячейках: сборка начинает с `MASK_RDP_CELLS` и
 * поднимает его, если геометрия не приняла столько точек.
 *
 * `null` — либо предел растра, либо порог съел всю картинку.
 */
function traceMask(
  bits: Uint8Array,
  width: number,
  height: number,
  tolerance: number,
): OutlinePoint[][] | null {
  const coverage = new Float32Array(bits.length);

  for (let index = 0; index < bits.length; index += 1) {
    coverage[index] = bits[index];
  }

  const traced = traceCoverageContours(coverage, width, height, 0.5);

  if (checkRasterLimits(traced) !== null) {
    return null;
  }

  const contours: OutlinePoint[][] = [];

  for (const contour of traced) {
    const simplified = simplifyContour(contour, tolerance);

    if (
      simplified.length < 3 ||
      Math.abs(contourArea(simplified)) < MIN_CONTOUR_AREA_CELLS
    ) {
      continue;
    }

    contours.push(simplified);
  }

  return contours.length > 0 ? contours : null;
}

/**
 * Собирает маску из поля покрытия: контуры единичного габарита и маску проверки.
 *
 * Ячейка маски равна `1 / max(width, height)`, то есть её сторона в миллиметрах —
 * это `size / max(width, height)`: при логотипе 32 мм и сетке 160 ячейка выходит
 * 0.2 мм. Габарит берётся по сетке, а не по крайним точкам контуров: так маска
 * проверки и рельеф гарантированно описывают один прямоугольник.
 *
 * Строки маски перевёрнуты: в файле первая строка верхняя, а на грани Y растёт
 * вверх. Контуры переворачиваются тем же преобразованием.
 *
 * Шаги `keychainImageMask` (порог, инверсия, дилатация) уже позади: здесь маска
 * только обводится. Допуск упрощения растёт ступенями (`MASK_RDP_CELLS`, затем
 * `MASK_RDP_RETRY`): форма букв важнее числа узлов, поэтому сначала убираем
 * лишние точки и только потом огрубляем сетку вдвое, собирая маску заново, чтобы
 * дилатация работала на новой сетке.
 */
function createFieldBuild(
  field: KeychainImageField,
  threshold: number,
  invert: boolean,
): KeychainImageBuild | null {
  let grid = field;
  let traced: OutlinePoint[][] | null = null;
  let grown: Uint8Array | null = null;

  for (let attempt = 0; attempt < COARSEN_ATTEMPTS; attempt += 1) {
    const mask = keychainImageMask(grid, threshold, invert);

    for (const tolerance of [MASK_RDP_CELLS, ...MASK_RDP_RETRY]) {
      traced = traceMask(mask, grid.width, grid.height, tolerance);

      if (traced !== null) {
        grown = mask;
        break;
      }
    }

    if (traced !== null) {
      break;
    }

    if (grid.width <= 4 || grid.height <= 4) {
      break;
    }

    grid = coarsenField(grid);
  }

  if (traced === null || grown === null) {
    return null;
  }

  const scale = 1 / Math.max(grid.width, grid.height);
  const width = grid.width * scale;
  const height = grid.height * scale;
  const minX = -width / 2;
  const minY = -height / 2;
  const contours = traced.map((contour) =>
    contour.map(
      ([x, y]) => [minX + x * scale, minY + height - y * scale] as OutlinePoint,
    ),
  );
  const bits = new Uint8Array(grid.width * grid.height);

  for (let row = 0; row < grid.height; row += 1) {
    for (let column = 0; column < grid.width; column += 1) {
      if (grown[row * grid.width + column] === 1) {
        bits[(grid.height - 1 - row) * grid.width + column] = 1;
      }
    }
  }

  return {
    contours,
    frame: { height, minX, minY, width },
    mask: { bits, height: grid.height, width: grid.width },
    pixel: scale,
  };
}

/** Разбирает `imageData` в маску: новое поле, иначе прежняя SVG-обводка. */
function createBuild(
  imageData: string,
  threshold: number,
  invert: boolean,
): KeychainImageBuild | null {
  const field = keychainImageField(imageData);

  return field
    ? createFieldBuild(field, threshold, invert)
    : createSvgBuild(imageData);
}

/**
 * Готовая маска из `params.imageData`, порога яркости и галочки инверсии.
 *
 * `null` — картинки нет, строка испорчена или порог съел весь рисунок. Сборка
 * кешируется по тройке «порог + инверсия + маска»: геометрия пересобирается на
 * каждое движение слайдера, а обводка сотен тысяч ячеек не бесплатна.
 */
export function keychainImageBuild(
  imageData: string | null | undefined,
  threshold: number = KEYCHAIN_IMAGE_THRESHOLD_LIMITS.defaultValue,
  invert = false,
): KeychainImageBuild | null {
  if (!imageData) {
    return null;
  }

  const key = `${threshold}|${invert ? "invert" : "normal"}|${imageData}`;

  if (!buildCache.has(key)) {
    if (buildCache.size >= BUILD_CACHE_LIMIT) {
      const oldest = buildCache.keys().next().value;

      if (oldest !== undefined) {
        buildCache.delete(oldest);
      }
    }

    buildCache.set(key, createBuild(imageData, threshold, invert));
  }

  return buildCache.get(key) ?? null;
}


/**
 * Попадает ли точка грани на закрашенную часть картинки.
 *
 * Точка переводится в единичные координаты картинки и дальше в пиксели маски.
 * Проверяется квадрат размером с ячейку карты, а не одна точка: тонкий штрих
 * логотипа уже 0.4 мм, и проверка по центру могла бы проскочить мимо него.
 */
function imageCovered(
  build: KeychainImageBuild,
  localX: number,
  localY: number,
  halfCell: number,
): boolean {
  const { frame, mask, pixel } = build;
  const fromColumn = Math.max(
    0,
    Math.floor((localX - halfCell - frame.minX) / pixel),
  );
  const toColumn = Math.min(
    mask.width - 1,
    Math.floor((localX + halfCell - frame.minX) / pixel),
  );
  const fromRow = Math.max(
    0,
    Math.floor((localY - halfCell - frame.minY) / pixel),
  );
  const toRow = Math.min(
    mask.height - 1,
    Math.floor((localY + halfCell - frame.minY) / pixel),
  );

  for (let row = fromRow; row <= toRow; row += 1) {
    for (let column = fromColumn; column <= toColumn; column += 1) {
      if (mask.bits[row * mask.width + column]) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Стоит ли картинка на свободных ячейках грани.
 *
 * Проверяются только занятые ячейки карты: под ними либо кромка, либо отверстие
 * под кольцо, либо карман NFC, либо буквы. Пустые ячейки внутри габарита
 * картинки — её собственные просветы, печати они не мешают.
 */
function imageFits(
  mask: FaceMask,
  build: KeychainImageBuild,
  centerX: number,
  centerY: number,
  size: number,
): boolean {
  const { blocked, grid } = mask;
  const halfWidth = (build.frame.width * size) / 2;
  const halfHeight = (build.frame.height * size) / 2;
  const left = centerX - halfWidth;
  const right = centerX + halfWidth;
  const bottom = centerY - halfHeight;
  const top = centerY + halfHeight;

  if (
    left < grid.minX ||
    bottom < grid.minY ||
    right > grid.minX + grid.columns * grid.cell ||
    top > grid.minY + grid.rows * grid.cell
  ) {
    return false;
  }

  const firstColumn = Math.max(
    0,
    Math.ceil((left - grid.minX) / grid.cell - 0.5),
  );
  const lastColumn = Math.min(
    grid.columns - 1,
    Math.floor((right - grid.minX) / grid.cell - 0.5),
  );
  const firstRow = Math.max(
    0,
    Math.ceil((bottom - grid.minY) / grid.cell - 0.5),
  );
  const lastRow = Math.min(
    grid.rows - 1,
    Math.floor((top - grid.minY) / grid.cell - 0.5),
  );
  const halfCell = grid.cell / 2 / size;

  for (let row = firstRow; row <= lastRow; row += 1) {
    const localY = (grid.minY + (row + 0.5) * grid.cell - centerY) / size;

    for (let column = firstColumn; column <= lastColumn; column += 1) {
      if (!blocked[row * grid.columns + column]) {
        continue;
      }

      const localX =
        (grid.minX + (column + 0.5) * grid.cell - centerX) / size;

      if (imageCovered(build, localX, localY, halfCell)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Смещение картинки по одной оси, обрезанное свободной картой.
 *
 * Как у надписи: просьба исполняется, пока картинка целиком лежит на пластике,
 * иначе смещение отступает назад шагами сетки. Соседняя ось берётся уже
 * обрезанной, поэтому итог всегда стоит на свободных ячейках. Проверку `fits`
 * передаёт вызывающий: у повёрнутой картинки она считает по AABB рамки, у
 * прямой — по пикселям маски.
 */
function clampImageOffset(
  mask: FaceMask,
  fits: (centerX: number, centerY: number) => boolean,
  base: { centerX: number; centerY: number },
  desired: number,
  axis: "x" | "y",
): number {
  const steps = Math.round(Math.abs(desired) / mask.grid.cell);
  const sign = desired < 0 ? -1 : 1;
  let accepted = 0;

  for (let step = 1; step <= steps; step += 1) {
    const value = sign * step * mask.grid.cell;

    if (
      !fits(
        axis === "x" ? base.centerX + value : base.centerX,
        axis === "y" ? base.centerY + value : base.centerY,
      )
    ) {
      break;
    }

    accepted = value;
  }

  return accepted;
}

/**
 * Ставит картинку на грань: центр, размер и фактический масштаб.
 *
 * Сначала по карте ищется свободная полоса, как для надписи. Базовый размер
 * вписывает картинку в эту полосу при масштабе 1. Если запрошенный масштаб
 * больше, картинка может не влезть: тогда она ужимается шагом 5% и встаёт по
 * центру полосы. Ручное смещение обрезается по той же карте, что у букв.
 *
 * Поворот (`rotation`) меняет только габарит проверки: AABB повёрнутого
 * прямоугольника шире исходного, поэтому 45° логотип встаёт мельче — но встаёт
 * целиком, а не углом за кромкой. При нулевом повороте проверка идёт по пикселям
 * маски, как раньше: прямой логотип может стоять над просветом внутри буквы.
 *
 * `mask` передаёт вызывающий, когда рельефов несколько: каждая поставленная
 * декорация уже вычтена из карты и стала препятствием с зазором.
 *
 * `null` — места нет совсем: полоса уже минимума или даже уменьшенная картинка
 * упирается в кромку. Панель в этом случае предлагает уменьшить масштаб.
 */
export function placeKeychainImage(
  body: BufferGeometry,
  options: {
    build: KeychainImageBuild;
    keepOut?: readonly KeychainTextKeepOut[];
    mask?: FaceMask;
    offsetX?: number;
    offsetY?: number;
    rotation?: number;
    scale: number;
    side: KeychainTextSide;
  },
): KeychainImagePlacement | null {
  const mask =
    options.mask ?? buildFaceMask(body, options.side, options.keepOut);

  if (!mask) {
    return null;
  }

  const rotation = options.rotation ?? 0;
  const rotated = keychainRotatedSize(
    { height: options.build.frame.height, width: options.build.frame.width },
    rotation,
  );
  // Прямая картинка проверяется по пикселям маски, повёрнутая — по AABB рамки:
  // считать повёрнутую маску дороже, чем проверить прямоугольник с тем же запасом.
  const fits = (centerX: number, centerY: number, size: number): boolean =>
    rotation === 0
      ? imageFits(mask, options.build, centerX, centerY, size)
      : rectFits(
          mask.blocked,
          mask.grid,
          centerX,
          centerY,
          rotated.width * size,
          rotated.height * size,
        );

  const band = findWidestBand(mask.blocked, mask.grid, {
    minHeight: IMAGE_MIN_BAND_MM,
    minWidth: IMAGE_MIN_BAND_MM,
  });

  if (!band) {
    return null;
  }

  const base = Math.min(
    band.width / rotated.width,
    band.height / rotated.height,
  );

  if (!Number.isFinite(base) || base <= 0) {
    return null;
  }

  const requested = options.scale;
  const floor = base * IMAGE_MIN_SCALE_SHARE;
  let size = base * requested;

  while (
    size >= floor &&
    !fits(band.centerX, band.centerY, size)
  ) {
    size -= base * IMAGE_SCALE_STEP;
  }

  if (size < floor) {
    return null;
  }

  const centerX =
    band.centerX +
    clampImageOffset(
      mask,
      (x, y) => fits(x, y, size),
      { centerX: band.centerX, centerY: band.centerY },
      options.offsetX ?? 0,
      "x",
    );
  const centerY =
    band.centerY +
    clampImageOffset(
      mask,
      (x, y) => fits(x, y, size),
      { centerX, centerY: band.centerY },
      options.offsetY ?? 0,
      "y",
    );

  return {
    actual: size / base,
    centerX,
    centerY,
    requested,
    side: options.side,
    size,
  };
}

/**
 * Толщина рельефа картинки, мм.
 *
 * Как у имени: `imageDepth` — выступ над пластиком, а 0.35 мм картинка входит в
 * тело. Оболочки пересекаются объёмом, и слайсер печатает логотип частью
 * брелока, а не отдельной деталью.
 */
export function keychainImageReliefMm(depth: number): number {
  return Math.max(depth, 0.1) + KEYCHAIN_TEXT_EMBED_MM;
}

/**
 * Выдавливает маску картинки и ставит её на выбранную сторону.
 *
 * Фаски нет намеренно: логотип приходит маской с тонкими штрихами, и скругление
 * кромки съедало бы перемычки. Заодно толщина рельефа остаётся ровно
 * `imageDepth + 0.35` — без добавки на скругление.
 *
 * Пятна уже `KEYCHAIN_IMAGE_MIN_FEATURE_MM` в готовом размере выбрасываются: после
 * дилатации штрих выходит в три ячейки маски, но хвосты инверсии и сглаженного
 * края дают точки в одну — это 0.2 мм при логотипе 32 мм. Сопло их не напечатает,
 * зато слайсер получит тысячи отдельных столбиков. Проверка идёт в миллиметрах,
 * поэтому зависит от размера логотипа, а не от исходного файла.
 */
export function createKeychainImageGeometry(options: {
  build: KeychainImageBuild;
  centerX: number;
  centerY: number;
  depth: number;
  rotation: number;
  side: KeychainTextSide;
  size: number;
  thickness: number;
}): BufferGeometry | null {
  const scaled = options.build.contours
    .map((contour) =>
      contour.map(
        ([x, y]) => [x * options.size, y * options.size] as OutlinePoint,
      ),
    )
    .filter((contour) => {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      for (const [x, y] of contour) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }

      return Math.max(maxX - minX, maxY - minY) >= KEYCHAIN_IMAGE_MIN_FEATURE_MM;
    });
  const groups = groupContours(scaled);

  if (groups.length === 0) {
    return null;
  }

  const geometry = new ExtrudeGeometry(buildShapes(groups), {
    bevelEnabled: false,
    curveSegments: 2,
    depth: keychainImageReliefMm(options.depth),
  });

  // Нормали считаем явно, а не надеемся на внутренний вызов `ExtrudeGeometry`:
  // материал брелока (`meshStandardMaterial` во Viewport) не включает
  // `flatShading`, поэтому свет рисует по этим нормалям. Сетка неиндексированная,
  // и тройка вершин каждой грани получает нормаль своей плоскости — верх рельефа
  // освещается ровно, без «шума» из мелких граней.
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  const box = geometry.boundingBox;

  if (!box) {
    geometry.dispose();

    return null;
  }

  // Центр по габариту: у маски он уже в нуле, но выдавливание округляет
  // контуры до долей миллиметра, и поправка держит картинку на месте.
  geometry.translate(
    -(box.min.x + box.max.x) / 2,
    -(box.min.y + box.max.y) / 2,
    0,
  );
  geometry.rotateZ((options.rotation * Math.PI) / 180);

  if (options.side === "back") {
    geometry.rotateX(Math.PI);
  }

  const translateZ =
    options.side === "front"
      ? options.thickness - KEYCHAIN_TEXT_EMBED_MM
      : KEYCHAIN_TEXT_EMBED_MM;

  geometry.translate(options.centerX, options.centerY, translateZ);

  return geometry;
}

