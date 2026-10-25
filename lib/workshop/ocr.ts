/**
 * Разбор ответа OCR для импорта остатков из фото накладной.
 *
 * Модель просят вернуть строгий JSON-массив, но на практике ответ приходит
 * либо в markdown-обёртке ```json … ```, либо с короткой фразой перед массивом.
 * Поэтому сначала пробуем `JSON.parse` целиком, а затем — кусок от первой `[`
 * до последней `]`. Проверка полей отдельная: без неё клиент получил бы
 * «валидный JSON» с `null` вместо названия и падал бы уже в форме остатков.
 * Стоимость необязательна: если её не удалось прочитать, строка остаётся, а
 * `price` становится `null`.
 */

/** Строка накладной, которую ждёт импорт остатков. */
export type InvoiceItem = {
  name: string;
  quantity: number;
  unit: string;
  /** Общая стоимость позиции в рублях; null — цена не распознана. */
  price: number | null;
};

/**
 * Провайдер OCR — ProxyAPI, OpenAI-совместимый шлюз.
 *
 * Запросы идут на тот же путь, что у OpenAI (`/chat/completions`), меняется
 * только базовый адрес. Ключ лежит в `OPENAI_API_KEY`: имя переменной
 * оставлено прежним, чтобы не менять окружение и настройки деплоя.
 */
export const OCR_API_BASE_URL = "https://api.proxyapi.ru/v1";

/** Полный адрес Chat Completions: база ProxyAPI плюс путь OpenAI. */
export const OCR_API_URL = `${OCR_API_BASE_URL}/chat/completions`;

/** Идентификатор модели в каталоге ProxyAPI: вендор и название. */
export const OCR_MODEL = "openai/gpt-4o";

/**
 * Промпт OCR. Текст намеренно короткий: модель должна вернуть только данные,
 * без пояснений и заголовков таблицы.
 */
export const INVOICE_OCR_PROMPT =
  "Ты — OCR-парсер накладных. Извлеки из этого изображения список материалов: " +
  "название, количество, единица измерения и общую закупочную стоимость позиции в рублях. " +
  "Верни строго JSON-массив: [{ name, quantity, unit, price }]. " +
  "price — итоговая сумма по строке числом, а не цена за единицу. " +
  "Если стоимость не указана или не читается, верни null. " +
  "Без пояснений, без markdown и без текста вокруг JSON.";

/** Markdown-ограда вокруг JSON: ```json … ``` или просто ``` … ```. */
function stripCodeFence(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

/**
 * Количество из ответа модели.
 *
 * Число принимается как есть, строку пробуем привести к числу: OCR иногда
 * отдаёт `"1,5"` или `"2"`. Пустая строка, `NaN`, ноль и отрицательное
 * значение — не количество материала.
 */
function parseQuantity(value: unknown): number | null {
  const quantity =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value.trim().replace(",", "."))
        : Number.NaN;

  return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
}

/**
 * Стоимость позиции из ответа модели.
 *
 * Поле необязательное: если сумму не удалось прочитать, строка всё равно
 * остаётся в результате, а `price` становится `null`. Строку вида
 * `"1 234,56 ₽"` очищаем от пробелов, валюты и запятой в дробной части.
 */
function parsePrice(value: unknown): number | null {
  const price =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(
            value
              .trim()
              .replace(/\s+/g, "")
              .replace(/руб\.?/gi, "")
              .replace(/₽/g, "")
              .replace(",", "."),
          )
        : Number.NaN;

  return Number.isFinite(price) && price >= 0 ? price : null;
}

/**
 * Одна строка массива: объект с непустыми `name` и `unit`, числом `quantity`
 * и необязательной ценой.
 */
function parseInvoiceItem(value: unknown): InvoiceItem | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const unit = typeof record.unit === "string" ? record.unit.trim() : "";
  const quantity = parseQuantity(record.quantity);
  const price = parsePrice(record.price);

  if (!name || !unit || quantity === null) {
    return null;
  }

  return { name, quantity, unit, price };
}

/**
 * Разбирает ответ модели.
 *
 * Возвращает массив строк или `null`, если JSON не разобрался либо хотя бы одна
 * строка не похожа на материал. Нечитаемая цена строку не отбрасывает: поле
 * `price` в ней будет `null`. Пустой массив считается валидным ответом: модель
 * распознала изображение, но материалов на нём нет.
 */
export function parseInvoiceItems(content: string): InvoiceItem[] | null {
  const raw = stripCodeFence(content);

  if (!raw) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");

    if (start === -1 || end <= start) {
      return null;
    }

    try {
      parsed = JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  if (!Array.isArray(parsed)) {
    return null;
  }

  const items: InvoiceItem[] = [];

  for (const value of parsed) {
    const item = parseInvoiceItem(value);

    if (!item) {
      return null;
    }

    items.push(item);
  }

  return items;
}
