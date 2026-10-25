/**
 * Шифрование секретов приложения: AES-256-GCM.
 *
 * Ключи Ozon нельзя хранить в базе открытым текстом: дамп `workshop_settings`
 * или ошибка в логах PostgREST сразу раскрыла бы доступ к кабинету продавца.
 * Здесь один формат для всех секретов приложения — строка
 * `v1.<iv>.<auth-tag>.<ciphertext>` в base64url. Версия в префиксе позволит
 * поменять алгоритм, не ломая уже сохранённые значения.
 *
 * Ключ шифрования: `ENCRYPTION_SECRET` (рекомендуется), иначе SHA-256 от
 * `SUPABASE_SERVICE_ROLE_KEY`, который уже есть на сервере. В разработке без
 * них берётся локальная строка, чтобы сохранение ключей работало без настройки
 * окружения. В production без секрета шифрование не выполняется: лучше вернуть
 * ошибку, чем записать ключ в базу открытым.
 *
 * Модуль серверный: `node:crypto` нельзя импортировать в клиентский компонент.
 * Не добавляйте сюда `"use client"` и не импортируйте файл из браузерного кода.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/** Алгоритм с проверкой целостности: подмена ciphertext ломает auth tag. */
const ALGORITHM = "aes-256-gcm";

/** Версия формата: часть префикса, а не отдельная колонка в базе. */
const FORMAT_VERSION = "v1";

/** GCM рекомендует 12 байт IV; auth tag у aes-256-gcm всегда 16 байт. */
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** Локальный секрет разработки: в production не используется. */
const DEVELOPMENT_SECRET = "tridi-local-encryption-secret";

/**
 * Секрет из окружения.
 *
 * `ENCRYPTION_SECRET` важнее service-role ключа: его можно сменить, не
 * перевыпуская ключи Supabase. Service-role ключ — запасной вариант, чтобы
 * локальная разработка и текущий сервер работали без новой переменной.
 */
function resolveSecret(): string {
  const configured = process.env.ENCRYPTION_SECRET?.trim();

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

  throw new Error(
    "Не задан ENCRYPTION_SECRET: расшифровать ключи Ozon невозможно.",
  );
}

/** 32 байта для AES-256: SHA-256 от любого по длине секрета. */
function createKey(): Buffer {
  return createHash("sha256").update(resolveSecret(), "utf8").digest();
}

/**
 * Зашифровать текст.
 *
 * Пустая строка остаётся пустой: «ключа нет» не нужно превращать в
 * зашифрованный мусор. Для каждого вызова создаётся новый IV, поэтому два
 * одинаковых ключа дают разные ciphertext.
 */
export function encrypt(text: string): string {
  if (!text) {
    return "";
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, createKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    FORMAT_VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

/**
 * Расшифровать значение, созданное `encrypt`.
 *
 * Ошибка означает неверный `ENCRYPTION_SECRET` или повреждённые данные.
 * Возвращать в таком случае открытый текст нельзя: пусть вызывающий код
 * решает, показать ошибку или считать интеграцию ненастроенной.
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) {
    return "";
  }

  const parts = ciphertext.split(".");

  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) {
    throw new Error("Неизвестный формат зашифрованного значения.");
  }

  const iv = Buffer.from(parts[1], "base64url");
  const authTag = Buffer.from(parts[2], "base64url");
  const payload = Buffer.from(parts[3], "base64url");

  if (iv.length !== IV_BYTES || authTag.length !== TAG_BYTES) {
    throw new Error("Повреждённые параметры зашифрованного значения.");
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, createKey(), iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(payload), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    throw new Error(
      "Не удалось расшифровать значение: неверный ключ или повреждённые данные.",
    );
  }
}

/**
 * Похоже ли значение на результат `encrypt`.
 *
 * Нужно для старых строк, сохранённых до шифрования: их можно прочитать как
 * есть и зашифровать при следующем сохранении, а не терять ключ продавца.
 */
export function isEncryptedSecret(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const parts = value.split(".");

  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) {
    return false;
  }

  return (
    Buffer.from(parts[1], "base64url").length === IV_BYTES &&
    Buffer.from(parts[2], "base64url").length === TAG_BYTES &&
    parts[3].length > 0
  );
}
