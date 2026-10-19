/**
 * Сертификат о прохождении курса: номер, подпись и публичная проверка.
 *
 * Таблица сертификатов не нужна: сертификат — это подписанный HMAC-токен, в
 * котором лежат имя ученика, курс и дата завершения. Такой токен можно положить
 * в ссылку и на печатный сертификат, а страница /verify/[id] проверит подпись без
 * входа в аккаунт и без запросов к базе. Подделать имя или курс нельзя, не зная
 * секрета.
 *
 * Секрет: CERTIFICATE_SECRET (рекомендуется) или SUPABASE_SERVICE_ROLE_KEY,
 * который уже есть на сервере. В разработке без них берётся локальная строка —
 * чтобы можно было проверять печать без настройки окружения. В production без
 * секрета сертификат не создаётся: лучше показать ошибку, чем выдать документ,
 * который сможет подделать любой.
 *
 * Модуль серверный: node:crypto нельзя импортировать в клиентский компонент.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import { LEVELS, type LevelKey } from "./course-levels";

/** Версия формата токена: если поменяем поля, старые ссылки не сломаются молча. */
const TOKEN_VERSION = 1;

/** Максимальная длина имени: защищает ссылку и вёрстку сертификата. */
const MAX_NAME_LENGTH = 120;

/** Локальный секрет разработки: в production не используется. */
const DEVELOPMENT_SECRET = "tridi-local-certificate-secret";

/** Подписанный сертификат в том виде, в котором его показывает страница. */
export type Certificate = {
  /** Полный токен для ссылки /verify/[id]. */
  token: string;
  /** Имя получателя на момент выдачи. */
  name: string;
  course: LevelKey;
  /** Устойчивый идентификатор получателя и курса (16 hex-символов). */
  subject: string;
  /** Дата завершения в формате YYYY-MM-DD. */
  issuedAt: string;
  /** Человекочитаемый номер: TRI-2026-AB12CD34. */
  number: string;
};

/** Данные, из которых создаётся сертификат. */
export type CertificateInput = {
  userId: string;
  name: string;
  course: LevelKey;
  /** Полная ISO-дата последнего шага; если нет — берётся текущая дата. */
  issuedAt?: string | null;
};

let hasWarnedAboutSecret = false;

/** Секрет подписи или null, если в production он не настроен. */
function resolveSecret(): string | null {
  const configured = process.env.CERTIFICATE_SECRET?.trim();

  if (configured) {
    return configured;
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (serviceRoleKey) {
    return serviceRoleKey;
  }

  if (process.env.NODE_ENV !== "production") {
    return DEVELOPMENT_SECRET;
  }

  return null;
}

/** Есть ли курс с таким ключом: защищает проверку токена от мусора. */
function isLevelKey(value: string): value is LevelKey {
  return LEVELS.some((level) => level.key === value);
}

/** Имя без лишних пробелов и переносов: подпись должна быть предсказуемой. */
function normalizeName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
}

/** Дата YYYY-MM-DD, которая действительно существует (31 февраля не пройдёт). */
function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Дата выдачи: дата последнего шага или сегодняшняя, если даты нет. */
function normalizeIssueDate(issuedAt?: string | null): string {
  if (issuedAt) {
    const parsed = new Date(issuedAt);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  return new Date().toISOString().slice(0, 10);
}

/** Подпись полезной части токена: 16 байт в base64url (22 символа). */
function signPayload(payloadPart: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(payloadPart)
    .digest("base64url")
    .slice(0, 22);
}

/** Устойчивый subject: один и тот же ученик и курс дают один и тот же номер. */
function buildSubject(userId: string, course: LevelKey, secret: string): string {
  return createHmac("sha256", secret)
    .update(`certificate-subject:${userId}:${course}`)
    .digest("hex")
    .slice(0, 16);
}

/** Номер сертификата из subject и года выдачи. */
export function certificateNumber(subject: string, issuedAt: string): string {
  const year = issuedAt.slice(0, 4);

  return `TRI-${year}-${subject.slice(0, 8).toUpperCase()}`;
}

/** Месяцы в родительном падеже — формат даты одинаков на всех серверах. */
const MONTHS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

/**
 * «19 октября 2026» из YYYY-MM-DD.
 *
 * Собираем строку вручную, а не через Intl: на сервере без полного набора
 * локалей формат может отличаться или вернуться на английском, а дата на
 * сертификате должна выглядеть одинаково везде.
 */
export function formatCertificateDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const monthName = MONTHS_GENITIVE[month - 1] ?? "";

  return `${day} ${monthName} ${year}`;
}

/**
 * Создаёт подписанный сертификат.
 *
 * Вызывается только после проверки завершения курса (isComplete). Повторный
 * вызов для того же ученика и курса даёт тот же subject и номер, но дата берётся
 * из прогресса — сертификат не «перевыпускается» при каждом открытии страницы.
 */
export function createCertificate(input: CertificateInput): Certificate {
  const secret = resolveSecret();

  if (!secret) {
    throw new Error(
      "Не настроен CERTIFICATE_SECRET (или SUPABASE_SERVICE_ROLE_KEY) для подписи сертификатов",
    );
  }

  const name = normalizeName(input.name) || "Слушатель TriDi";
  const issuedAt = normalizeIssueDate(input.issuedAt);
  const subject = buildSubject(input.userId, input.course, secret);
  const payload = JSON.stringify([
    TOKEN_VERSION,
    name,
    input.course,
    issuedAt,
    subject,
  ]);
  const payloadPart = Buffer.from(payload, "utf8").toString("base64url");
  const signature = signPayload(payloadPart, secret);

  return {
    token: `${payloadPart}.${signature}`,
    name,
    course: input.course,
    subject,
    issuedAt,
    number: certificateNumber(subject, issuedAt),
  };
}

/**
 * Проверяет токен и возвращает данные сертификата.
 *
 * null — ссылка повреждена, подпись не совпала, курс неизвестен или сервер не
 * настроен. Страница проверки в этом случае честно пишет, что сертификат не
 * найден, и не показывает неподписанные данные.
 */
export function readCertificateToken(token: string): Certificate | null {
  const secret = resolveSecret();

  if (!secret) {
    if (!hasWarnedAboutSecret) {
      hasWarnedAboutSecret = true;
      console.error(
        "Сертификаты отключены: задайте CERTIFICATE_SECRET или SUPABASE_SERVICE_ROLE_KEY",
      );
    }

    return null;
  }

  // Токен = base64url(payload) + "." + 16-байтовая подпись в base64url.
  if (!/^[A-Za-z0-9_-]{1,600}\.[A-Za-z0-9_-]{22}$/.test(token)) {
    return null;
  }

  const [payloadPart, signature] = token.split(".");
  const expectedSignature = signPayload(payloadPart, secret);
  const givenBuffer = Buffer.from(signature, "base64url");
  const expectedBuffer = Buffer.from(expectedSignature, "base64url");

  if (
    givenBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(givenBuffer, expectedBuffer)
  ) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!Array.isArray(parsed) || parsed.length !== 5) {
    return null;
  }

  const [version, name, course, issuedAt, subject] = parsed;

  if (
    version !== TOKEN_VERSION ||
    typeof name !== "string" ||
    name.length === 0 ||
    name.length > MAX_NAME_LENGTH ||
    typeof course !== "string" ||
    !isLevelKey(course) ||
    typeof issuedAt !== "string" ||
    !isValidIsoDate(issuedAt) ||
    typeof subject !== "string" ||
    !/^[0-9a-f]{16}$/.test(subject)
  ) {
    return null;
  }

  return {
    token,
    name,
    course,
    subject,
    issuedAt,
    number: certificateNumber(subject, issuedAt),
  };
}
