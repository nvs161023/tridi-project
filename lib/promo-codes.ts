/**
 * Промокоды на курсы: формат кода, ссылка активации и CSV для Ozon.
 *
 * Модуль изоморфный: его импортируют и серверная админка, и клиентская форма.
 * Поэтому здесь нет `node:crypto` — случайные символы берём из Web Crypto
 * (`crypto.getRandomValues`), он есть и в Node.js 22, и в браузере.
 *
 * Код печатается как TRIDI-ABCD-1234. Алфавит без похожих символов (нет I, O,
 * 0, 1): код читают с экрана и вводят руками, «0» вместо «O» — типичная ошибка.
 * Длина алфавита ровно 32, поэтому остаток от деления байта не смещает
 * распределение.
 */

/** Курсы, на которые можно выпускать промокоды. */
export const PROMO_COURSE_IDS = ["confident", "engineer", "profit"] as const;

export type PromoCourseId = (typeof PROMO_COURSE_IDS)[number];

/** Названия для админки и писем: совпадают с витриной курсов. */
export const PROMO_COURSE_LABELS: Record<PromoCourseId, string> = {
  confident: "Уверенный уровень",
  engineer: "Инженер 3D-печати",
  profit: "Заработок на 3D-печати",
};

/** Префикс всех кодов TriDi. */
export const PROMO_CODE_PREFIX = "TRIDI";

/** Без I, O, 0 и 1 — чтобы код нельзя было прочитать неправильно. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Сколько кодов можно выпустить одной партией. */
export const PROMO_MAX_BATCH = 500;

/** Проверяет, что строка из формы — известный курс. */
export function isPromoCourseId(value: string): value is PromoCourseId {
  return (PROMO_COURSE_IDS as readonly string[]).includes(value);
}

/**
 * Колонка, которой нет в схеме базы, — по ответу PostgREST.
 *
 * Таблица promo_codes живёт в базе отдельно от кода, и её схема может отставать
 * от supabase/promo_codes.sql: например, в уже созданной таблице нет `note`.
 * PostgREST в этом случае отвечает PGRST204 «Could not find the 'note' column»
 * и не вставляет ни одной строки. Админка убирает неизвестную колонку и
 * повторяет вставку: коды важнее примечания, а предупреждение покажет форма.
 *
 * 42703 — тот же случай, но из PostgreSQL (undefined_column), если запрос
 * выполнялся не через PostgREST.
 */
export function missingColumnName(
  error: { code?: string; message?: string } | null | undefined,
): string | null {
  if (!error || (error.code !== "PGRST204" && error.code !== "42703")) {
    return null;
  }

  const message = error.message ?? "";
  const match =
    message.match(/'([a-z0-9_]+)' column/i) ??
    message.match(/column "([a-z0-9_]+)"/i);

  return match?.[1] ?? null;
}

/**
 * Новый код вида TRIDI-ABCD-1234.
 *
 * 8 случайных символов из алфавита в 32 знака — это 40 бит энтропии: перебрать
 * код через форму активации практически невозможно, а сервер всё равно
 * ограничивает попытки размером партии.
 */
export function generatePromoCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);

  const chars = Array.from(
    bytes,
    (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length],
  );
  const first = chars.slice(0, 4).join("");
  const second = chars.slice(4).join("");

  return `${PROMO_CODE_PREFIX}-${first}-${second}`;
}

/**
 * Приводит ввод человека к каноническому виду.
 *
 * Разрешаем ввести код без дефисов и в нижнем регистре: «tridiabcd1234» станет
 * «TRIDI-ABCD-1234». Всё остальное возвращаем как есть в верхнем регистре —
 * формат проверит isPromoCodeFormat, и в базу уйдёт точное значение.
 */
export function normalizePromoCode(raw: string): string {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const pattern = new RegExp(`^${PROMO_CODE_PREFIX}([A-Z0-9]{4})([A-Z0-9]{4})$`);
  const match = compact.match(pattern);

  if (match) {
    return `${PROMO_CODE_PREFIX}-${match[1]}-${match[2]}`;
  }

  return raw.trim().toUpperCase();
}

/** Код в каноническом виде: TRIDI-XXXX-XXXX. */
export function isPromoCodeFormat(code: string): boolean {
  const pattern = new RegExp(`^${PROMO_CODE_PREFIX}-[A-Z0-9]{4}-[A-Z0-9]{4}$`);

  return pattern.test(code);
}

/**
 * Ссылка активации для письма и CSV.
 *
 * Код кодируем: дефисы безопасны, но encodeURIComponent делает ссылку
 * предсказуемой для любого будущего формата кода.
 */
export function buildActivationUrl(siteUrl: string, code: string): string {
  const base = siteUrl.replace(/\/+$/, "");

  return `${base}/activate?code=${encodeURIComponent(code)}`;
}

/** Ячейка CSV: кавычки нужны только если внутри есть разделитель или перевод строки. */
function csvCell(value: string): string {
  if (!/[";\r\n]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * CSV для Ozon: две колонки — «Код» и «Ссылка на активацию».
 *
 * Разделитель `;` и BOM в начале: Excel с русской локалью открывает такой файл
 * двойным щелчком без «Мастера импорта» и не ломает кириллицу. Переводы строк
 * CRLF — стандарт CSV (RFC 4180).
 */
export function buildOzonCsv(codes: readonly string[], siteUrl: string): string {
  const lines = ["Код;Ссылка на активацию"];

  for (const code of codes) {
    lines.push(
      `${csvCell(code)};${csvCell(buildActivationUrl(siteUrl, code))}`,
    );
  }

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
