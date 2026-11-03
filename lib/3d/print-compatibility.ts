/**
 * Совместимость файла печати с принтером.
 *
 * 3MF помнит, для какой модели его нарезали (`sliced_for_printer`), и отправить
 * такой файл на другой принтер значит получить отказ слайсера или кривую
 * печать: профили температуры, скорости и объёма у моделей разные. Проверка
 * одна для карточки заказа и Server Action: карточка гасит кнопку заранее, а
 * действие повторяет проверку — браузер мог устареть.
 *
 * Сравнение терпит разные написания одного принтера: «Bambu Lab A1», «Bambu
 * Lab A1 0.4 nozzle» и «A1» при бренде «Bambu Lab» — это одна модель. Служебный
 * код профиля Bambu Studio («N2S») — тоже она: коды разворачиваются в названия
 * (`lib/3d/printer-model-codes.ts`), иначе товар, размеченный старым разбором,
 * навсегда остался бы «чужим» для своего же принтера.
 */
import {
  bambuPrinterCode,
  resolvePrinterModelCode,
} from "@/lib/3d/printer-model-codes";
import { normalizePrinterModel } from "@/lib/workshop/printer-presets";

/** Модель принтера из парка: бренд и модель — как в `workshop_printers`. */
export type PrinterIdentity = {
  brand: string;
  model: string;
};

/**
 * Расширения, которые принтер печатает без слайсера.
 *
 * STL сюда не входит: это готовая 3D-модель, а не задание печати. Такой файл
 * прикладывают к товару как исходник, но в очередь печати он не годится —
 * сначала мастер нарезает его слайсером.
 *
 * `.bgcode` — бинарный G-code прошивок Prusa (Buddy): PrusaSlicer сохраняет
 * его для PrusaLink, а агент фермы грузит такой файл как есть. Форматов у
 * протокола два (`.gcode` и `.bgcode`), поэтому оба стоят в списке; что
 * остальные протоколы `.bgcode` не принимают, решает `PRINTER_UPLOAD_FORMATS`.
 */
const PRINTABLE_EXTENSIONS = ["gcode", "gco", "g", "bgcode", "3mf"] as const;

/**
 * Расширения исходников модели.
 *
 * STL — модель для слайсера: её прикладывают к товару, чтобы нарезать изделие
 * заново под другой принтер. В очередь печати такой файл не годится: сначала
 * мастер нарезает его слайсером. На карточке файл один, поэтому STL хранится в
 * том же `gcode_url`; `model_url` остаётся у товаров, заведённых до упрощения.
 */
export const SOURCE_MODEL_EXTENSIONS = ["stl"] as const;

/**
 * Подпись единого блока загрузки файла товара.
 *
 * В карточке товара файл один: 3MF или G-code агент фермы печатает как есть, а
 * STL остаётся моделью для нарезки. Ссылка в любом случае хранится в
 * `gcode_url`, поэтому форма подписывает блок именно так.
 */
export const PRODUCT_FILE_LABEL = "Файл модели для печати";

/**
 * Назначение загружаемого файла товара.
 *
 * `model` — исходник STL для слайсера и калькулятора, `print` — готовое
 * задание печати. Роут `/api/workshop/gcode` по этому значению выбирает
 * проверку расширений и папку бакета. Форма товара всегда грузит файл
 * значением по умолчанию; `model` остался для старых вызовов и карточек с
 * отдельным `model_url`.
 */
export type ProductFileKind = "print" | "model";

/**
 * Расширение файла печати из ссылки: query и якорь не считаются.
 *
 * По нему решается и способ печати (проект 3MF уходит как есть, а G-code и STL
 * Bambu не печатает), и есть ли у файла разметка принтера. null — ссылки нет
 * или у неё нет расширения.
 */
export function printFileExtension(url: string | null): string | null {
  if (!url) {
    return null;
  }

  const path = url.split(/[?#]/u)[0];
  const match = /\.([a-z0-9]+)$/iu.exec(path);

  return match ? match[1].toLocaleLowerCase("en-US") : null;
}

/**
 * Файл можно ставить в очередь печати.
 *
 * STL, PDF и прочее — нет: агенту фермы нечего отправлять на принтер, а
 * обещать мастеру «задание в очереди» было бы неправдой.
 */
export function isPrintableFile(url: string | null): boolean {
  const extension = printFileExtension(url);

  return (
    extension !== null &&
    (PRINTABLE_EXTENSIONS as readonly string[]).includes(extension)
  );
}

/**
 * Ссылка ведёт на исходник модели (STL).
 *
 * По этой проверке Server Action раскладывает старые карточки: ссылка на STL
 * читается как `model_url`, а не как файл печати. Новые товары кладут STL в
 * `gcode_url` — печатать его всё равно никто не будет (`isPrintableFile`).
 */
export function isSourceModelFile(url: string | null): boolean {
  const extension = printFileExtension(url);

  return (
    extension !== null &&
    (SOURCE_MODEL_EXTENSIONS as readonly string[]).includes(extension)
  );
}

/**
 * Расширения единого файла товара.
 *
 * Карточка принимает все три формата одним полем: 3MF и G-code готовы к печати,
 * STL мастер нарежет сам. Расширение `.gco` и `.g` остаются: так называют
 * G-code слайсеры, и отказывать в них незачем. `.bgcode` — тот же G-code, но
 * бинарный и для PrusaLink, поэтому он идёт рядом с `.gcode`.
 */
export const PRODUCT_FILE_EXTENSIONS = [
  ...PRINTABLE_EXTENSIONS,
  ...SOURCE_MODEL_EXTENSIONS,
] as const;

/**
 * Ссылка ведёт на файл из единого блока загрузки: .3mf, .gcode, .bgcode, .gco,
 * .g или .stl.
 *
 * Проверка нужна Server Action: поле `gcode_url` теперь принимает и STL, а
 * в очередь печати такой файл по-прежнему не попадает — за это отвечает
 * `isPrintableFile`.
 */
export function isProductFile(url: string | null): boolean {
  const extension = printFileExtension(url);

  return (
    extension !== null &&
    (PRODUCT_FILE_EXTENSIONS as readonly string[]).includes(extension)
  );
}

/**
 * Ключ сравнения: регистр, тире, хвост про сопло и скобки не важны.
 *
 * «Bambu Lab A1 0.4 nozzle» → «bambu lab a1»; «FlashForge Adventurer 5M Pro» →
 * «flashforge adventurer 5m pro» (цифра внутри «5m» остаётся частью модели).
 */
function comparisonKey(value: string): string {
  return normalizePrinterModel(value)
    .replace(/\b\d+(?:\.\d+)?\s*(?:mm)?\s*nozzle\b/giu, " ")
    .replace(/\bnozzle\b/giu, " ")
    .replace(/[()]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * Ключ для сверки файла с принтером: у Bambu Lab модель заменяется кодом.
 *
 * «N2S», «Bambu Lab A1» и «A1» дают один ключ, «Bambu Lab X1 Carbon» и «X1C» —
 * тоже: слайсер, карточка принтера и справочник зовут один станок по-разному.
 * Остальные бренды сравниваются текстом, как раньше. Подпись для человека
 * строится отдельно (`comparisonKey`), поэтому код в интерфейсе не появится.
 */
function canonicalKey(value: string): string {
  const key = comparisonKey(value);

  return bambuPrinterCode(key) ?? key;
}

/**
 * Подпись разметки 3MF для интерфейса: код профиля разворачивается в название.
 *
 * В базе у товаров, загруженных до этого правила, лежит «N2S»: показывать его
 * мастеру бессмысленно. Пустая разметка остаётся пустой строкой.
 */
export function slicedForPrinterLabel(slicedForPrinter: string | null): string {
  return resolvePrinterModelCode(slicedForPrinter ?? "");
}

/** Подпись принтера для сообщений: бренд не дублируется в модели. */
export function formatPrinterLabel({ brand, model }: PrinterIdentity): string {
  const brandText = brand.trim();
  const modelText = model.trim();

  if (!modelText) {
    return brandText;
  }

  const modelKey = comparisonKey(modelText);

  if (!brandText || modelKey.startsWith(`${comparisonKey(brandText)} `)) {
    return modelText;
  }

  return `${brandText} ${modelText}`.trim();
}

/**
 * Варианты ключей принтера из парка: «A1» и «Bambu Lab A1» — один принтер.
 *
 * Модель может уже содержать бренд («Bambu Lab A1» при бренде «Bambu Lab»),
 * поэтому набор собирается, а не сравнивается одной строкой. Ключи канонические:
 * у Bambu Lab это код модели, поэтому «X1C» и «X1 Carbon» сходятся.
 */
function printerKeys({ brand, model }: PrinterIdentity): string[] {
  const modelKey = canonicalKey(model);
  const brandKey = comparisonKey(brand);
  const keys = new Set<string>();

  if (modelKey) {
    keys.add(modelKey);
  }

  if (brandKey && modelKey) {
    keys.add(`${brandKey} ${modelKey}`);
  }

  return [...keys];
}

/**
 * Файл подходит принтеру.
 *
 * `slicedForPrinter` пустой — файл не размечен (STL, G-code или 3MF без
 * служебных метаданных), и проверять нечего: такой файл разрешён. Явная
 * разметка должна совпасть с моделью принтера. Совпадение по концу строки
 * нужно для названий с уточнением впереди: «Original Prusa MK4» и модель
 * «MK4». Разные модели им не станут: «A1 mini» не заканчивается на «A1».
 *
 * Служебный код Bambu Studio («N2S») сравнивается как название: товары,
 * загруженные до разбора кодов, продолжают печататься на своём принтере.
 */
export function isSlicedForPrinter(
  slicedForPrinter: string | null,
  printer: PrinterIdentity,
): boolean {
  const slicedKey = canonicalKey(slicedForPrinter ?? "");

  if (!slicedKey) {
    return true;
  }

  return printerKeys(printer).some(
    (key) => slicedKey === key || slicedKey.endsWith(` ${key}`),
  );
}

/**
 * Текст отказа при несовпадении: что за принтер в файле и что делать.
 *
 * В тексте — название модели, а не служебный код: «нарезан для N2S» мастеру
 * ничего не говорит, а «нарезан для Bambu Lab A1» — говорит.
 * null — файл подходит, показывать нечего.
 */
export function printerMismatchMessage(
  slicedForPrinter: string | null,
  printer: PrinterIdentity,
): string | null {
  if (isSlicedForPrinter(slicedForPrinter, printer)) {
    return null;
  }

  const slicedFor = slicedForPrinterLabel(slicedForPrinter);

  return `Этот файл нарезан для ${slicedFor}. Выберите соответствующий принтер или загрузите файл, нарезанный для ${formatPrinterLabel(printer)}.`;
}
