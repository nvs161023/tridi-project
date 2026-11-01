/**
 * Проверка связи с принтером («Проверить связь»): словарь сервера и окна.
 *
 * Кнопка в форме не зовёт адаптер напрямую — она кладёт просьбу в очередь
 * (`/api/agent/probe`), агент забирает её на ближайшем опросе и отвечает
 * `adapter.probe()`. Здесь собрано то, что нужно обеим сторонам: статусы
 * очереди, разбор ответа и подписи возможностей. Модуль клиентский: серверных
 * импортов нет, поэтому окно может читать его без «серверного» бандла.
 */

/** Состояния строки очереди: pending → running → done. */
export const PRINTER_PROBE_STATUSES = ["pending", "running", "done"] as const;

export type PrinterProbeStatus = (typeof PRINTER_PROBE_STATUSES)[number];

export function isPrinterProbeStatus(
  value: unknown,
): value is PrinterProbeStatus {
  return (
    typeof value === "string" &&
    (PRINTER_PROBE_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Ответ адаптера на пробу.
 *
 * `ok: false` — не сбой очереди, а ответ принтера: он выключен, не в сети или
 * не принял секрет. Тогда `error` объясняет причину словами адаптера («Access
 * Code не принят»), а `capabilities` остаются статикой протокола — окно всё
 * равно показывает, что принтер будет уметь после подключения.
 */
export type PrinterProbeResult = {
  ok: boolean;
  model: string | null;
  serialNumber: string | null;
  firmware: string | null;
  capabilities: string[];
  formats: string[];
  error: string | null;
};

/** Сколько строк ответа показывать: больше у протокола не бывает. */
const PROBE_LIST_MAX = 16;

/** Длина одной строки ответа: имя модели и SN короче. */
const PROBE_TEXT_MAX = 64;

/** Предел причины отказа: `last_error` адаптера не длиннее. */
const PROBE_ERROR_MAX = 500;

function readList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const items: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }

    const text = item.trim().slice(0, PROBE_TEXT_MAX);

    if (text && !items.includes(text)) {
      items.push(text);
    }

    if (items.length >= PROBE_LIST_MAX) {
      break;
    }
  }

  return items;
}

function readProbeText(value: unknown, maxLength = PROBE_TEXT_MAX): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  return text ? text.slice(0, maxLength) : null;
}

/**
 * `result` из базы или из ответа агента → результат для интерфейса.
 *
 * jsonb принимает что угодно, а браузеру доверять нельзя так же, как базе:
 * приводим типы и обрезаем длину. null — строки ещё нет ответа (pending или
 * running): окно продолжает опрос.
 */
export function normalizeProbeResult(value: unknown): PrinterProbeResult | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const row = value as Record<string, unknown>;

  return {
    ok: row.ok === true,
    model: readProbeText(row.model),
    serialNumber: readProbeText(row.serialNumber ?? row.serial_number),
    firmware: readProbeText(row.firmware),
    capabilities: readList(row.capabilities),
    formats: readList(row.formats),
    error: readProbeText(row.error, PROBE_ERROR_MAX),
  };
}

/**
 * «Печать ✓ · Пауза ✗ · Камера ✗» — все возможности протокола.
 *
 * Ответ пробы приносит `capabilities` словами агента (`CAPABILITY_*`), поэтому
 * строка собирается той же функцией, что и в карточке принтера
 * (`formatPrinterCapabilities`): два списка подписей разъехались бы при первой
 * правке.
 */
export { formatPrinterCapabilities as formatProbeCapabilities } from "@/lib/workshop/printers";

/**
 * Первая строка ответа: модель, серийный номер и прошивка.
 *
 * «Bambu Lab A1, SN: 00M09A123456789, прошивка 01.08» — то, по чему мастер
 * понимает, что ответил именно тот принтер, который он добавляет.
 */
export function formatProbeHeadline(result: PrinterProbeResult): string {
  const parts: string[] = [result.model ?? "Принтер ответил"];

  if (result.serialNumber) {
    parts.push(`SN: ${result.serialNumber}`);
  }

  if (result.firmware) {
    parts.push(`прошивка ${result.firmware}`);
  }

  return parts.join(", ");
}

/** Форматы файлов для строки пробы: «.gcode, .3mf» или пустая строка. */
export function formatProbeFormats(result: PrinterProbeResult): string {
  return result.formats.join(", ");
}

/** Как часто окно спрашивает результат: агент опрашивает сервер раз в 5 с. */
export const PROBE_POLL_INTERVAL_MS = 2000;

/** Сколько ждать ответа агента: 30 попыток × 2 с = минута. */
export const PROBE_POLL_ATTEMPTS = 30;
