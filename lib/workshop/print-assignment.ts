/**
 * Одна проверка «можно ли печатать этот файл на этом принтере».
 *
 * Проверка нужна в трёх местах: карточка заказа гасит кнопку, `queueOrderForPrint`
 * повторяет её на сервере, а `autoScheduleOrders` по ней выбирает принтер. Пока
 * правила жили в каждом вызове отдельно, они разъезжались: формат файла проверял
 * только ручной путь, а 3MF без разметки считался совместимым со всеми.
 *
 * Правил два, и оба отказывают до постановки в очередь:
 *   1. формат файла против протокола принтера (`PRINTER_UPLOAD_FORMATS`): Bambu
 *      печатает `.3mf`, Klipper/Moonraker, Creality, Anycubic и Elegoo — `.gcode`,
 *      PrusaLink — `.gcode` и `.bgcode`, FlashForge — оба;
 *   2. разметка 3MF против модели принтера: `sliced_for_printer` из метаданных
 *      архива. Пустая разметка у проекта слайсера — не «подходит всем», а
 *      «неизвестно, подходит ли», поэтому на принтер с маркой такой файл не идёт.
 */
import {
  isPrintableFile,
  printFileExtension,
  printerMismatchMessage,
  type PrinterIdentity,
} from "@/lib/3d/print-compatibility";
import type { PrinterProtocol } from "@/lib/db/workshop-types";
import { validatePrintFileForProtocol } from "@/lib/workshop/printers";

/** Принтер, которому примеряют файл: модель из разметки 3MF и протокол загрузки. */
export type PrintAssignmentPrinter = PrinterIdentity & {
  /**
   * Протокол из `workshop_printers.protocol_type`.
   *
   * null — строку не прочитали или в ней незнакомое значение: формат тогда не
   * проверить, а разметка 3MF остаётся строгой (неизвестный протокол — не повод
   * считать принтер «универсальным»).
   */
  protocolType: PrinterProtocol | null;
};

/**
 * Причина отказа.
 *
 * `no_file` — у позиции нет файла печати (STL или пустая ссылка); `format` —
 * протокол не печатает такое расширение; `unsliced` — 3MF без метки, и
 * совместимость проверить нечем; `sliced` — 3MF нарезан под другую модель.
 */
export type PrintRefusalKind = "no_file" | "format" | "unsliced" | "sliced";

/** Итог проверки: `ok` — файл уйдёт на принтер, иначе причина словами. */
export type PrintAssignmentCheck =
  | { ok: true }
  | { ok: false; kind: PrintRefusalKind; reason: string };


/**
 * Протоколы без привязки к марке.
 *
 * Klipper и OctoPrint печатают любой G-code и о модели принтера ничего не
 * требуют, поэтому строгость к разметке 3MF на них не распространяется. Сам
 * `.3mf` они всё равно не принимают (`PRINTER_UPLOAD_FORMATS`), так что правило
 * остаётся честным: формат откажет раньше разметки.
 */
const BRAND_AGNOSTIC_PROTOCOLS: readonly PrinterProtocol[] = [
  "moonraker",
  "octoprint",
];

/**
 * Слайсер, который сохранит файл под свой принтер.
 *
 * Нужен для текста отказа: совет «сохраните в Bambu Studio» владельцу FlashForge
 * бесполезен, а «переслайсите в слайсере принтера» — нет.
 */
const PRINTER_SLICERS: Partial<Record<PrinterProtocol, string>> = {
  bambu: "Bambu Studio",
  flashforge: "FlashPrint",
  prusa: "PrusaSlicer",
};

/** Проект слайсера: `.3mf` — это архив с G-code под конкретную модель. */
const PROJECT_3MF_EXTENSION = "3mf";

const NO_PRINT_FILE =
  "У позиции нет файла печати: STL — модель для слайсера, а не задание. Нарежьте её и загрузите .gcode или .3mf.";

/**
 * Текст отказа для 3MF без разметки.
 *
 * Bambu назван прямо: A1 не нарезает файл сам, и мастеру нужен именно Bambu
 * Studio. Для остальных протоколов подставляется их слайсер, а если его нет —
 * общая фраза: обещать «Bambu Studio» чужому принтеру нельзя.
 */
function unsliced3mfReason(protocol: PrinterProtocol | null): string {
  const slicer = protocol ? PRINTER_SLICERS[protocol] : undefined;
  const tail = slicer
    ? `Пожалуйста, сохраните файл в ${slicer}.`
    : "Пожалуйста, переслайсите файл в слайсере принтера.";

  return `Невозможно проверить совместимость: файл не содержит данных о слайсере. ${tail}`;
}

/**
 * Принтер вообще возьмёт этот файл: расширение входит в набор протокола.
 *
 * Пустая ссылка и STL отклоняются отдельным текстом: это не про принтер, а про
 * то, что печатать нечего. Неизвестный протокол (`null`) проверку пропускает —
 * выдумывать набор форматов нельзя.
 */
export function checkPrintFormat(
  protocol: PrinterProtocol | null,
  fileUrl: string | null,
): PrintAssignmentCheck {
  if (!isPrintableFile(fileUrl)) {
    return { ok: false, kind: "no_file", reason: NO_PRINT_FILE };
  }

  if (!protocol) {
    return { ok: true };
  }

  const formatCheck = validatePrintFileForProtocol(protocol, fileUrl ?? "");

  return formatCheck.ok
    ? { ok: true }
    : { ok: false, kind: "format", reason: formatCheck.reason };
}

/**
 * Разметка 3MF против модели принтера.
 *
 * `slicedForPrinter` — то, что сервер прочитал из архива при загрузке товара;
 * null, пустая строка и одни пробелы значат «метки нет». Явная метка должна
 * совпасть с моделью принтера, а её отсутствие у `.3mf` — отказ на любом
 * принтере с маркой: внутри проекта слайсера лежит G-code, нарезанный под
 * конкретную модель и сопло, и «нет метки» здесь значит «неизвестно, подходит
 * ли», а не «подходит всем».
 */
export function checkSlicedPrinter(
  slicedForPrinter: string | null,
  fileUrl: string | null,
  printer: PrintAssignmentPrinter,
): PrintAssignmentCheck {
  const slicedFor = (slicedForPrinter ?? "").trim();
  const isProject3mf = printFileExtension(fileUrl) === PROJECT_3MF_EXTENSION;
  const isBrandAgnostic = printer.protocolType
    ? BRAND_AGNOSTIC_PROTOCOLS.includes(printer.protocolType)
    : false;

  if (!slicedFor && isProject3mf && !isBrandAgnostic) {
    return {
      ok: false,
      kind: "unsliced",
      reason: unsliced3mfReason(printer.protocolType),
    };
  }

  const mismatch = printerMismatchMessage(slicedFor, {
    brand: printer.brand,
    model: printer.model,
  });

  return mismatch
    ? { ok: false, kind: "sliced", reason: mismatch }
    : { ok: true };
}

/**
 * Обе проверки подряд: формат, затем разметка.
 *
 * Формат важнее разметки: если принтер вообще не печатает такой файл, совет про
 * слайсер — единственный полезный.
 */
export function checkPrintAssignment(
  fileUrl: string | null,
  slicedForPrinter: string | null,
  printer: PrintAssignmentPrinter,
): PrintAssignmentCheck {
  const formatCheck = checkPrintFormat(printer.protocolType, fileUrl);

  if (!formatCheck.ok) {
    return formatCheck;
  }

  return checkSlicedPrinter(slicedForPrinter, fileUrl, printer);
}

/** Короткая форма для подбора принтера: файл уйдёт на эту машину. */
export function printFitsPrinter(
  fileUrl: string | null,
  slicedForPrinter: string | null,
  printer: PrintAssignmentPrinter,
): boolean {
  return checkPrintAssignment(fileUrl, slicedForPrinter, printer).ok;
}
