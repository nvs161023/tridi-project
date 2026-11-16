/**
 * Подписанные ссылки на временные STL генератора.
 *
 * Файл «мясорубки» лежит во временной папке и не имеет строки в базе, поэтому
 * право на скачивание подтверждается двумя независимыми проверками:
 *   1. HMAC-подпись в ссылке — её выдал только наш сервер после опроса задачи;
 *   2. сессия и владелец строки `generations` (или флаг `is_public`) — в роуте.
 *
 * Секрет подписи берётся из `FILE_SIGNING_SECRET`, а если переменной нет — из
 * `SUPABASE_SERVICE_ROLE_KEY`. В production лучше задать отдельный секрет:
 * ротация ключа Supabase тогда не инвалидирует уже выданные ссылки.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Сколько живёт ссылка на готовый STL: час с запасом на открытую вкладку. */
export const SIGNED_FILE_TTL_SECONDS = 60 * 60;

/** Ошибка конфигурации: без секрета ссылку подписать нельзя. */
function signingSecret(): string {
  const secret =
    process.env.FILE_SIGNING_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!secret) {
    throw new Error(
      "Не задан FILE_SIGNING_SECRET (или SUPABASE_SERVICE_ROLE_KEY) для подписи ссылок на STL.",
    );
  }

  return secret;
}

/** Данные, которые связывает подпись: файл, задача, пользователь и срок. */
function signaturePayload(
  file: string,
  taskId: string,
  userId: string,
  expiresAt: number,
): string {
  return `${file}\n${taskId}\n${userId}\n${expiresAt}`;
}

/** Ссылка на файл с HMAC-подписью и сроком жизни. */
export function buildGeneratedFileUrl(
  file: string,
  taskId: string,
  userId: string,
  ttlSeconds = SIGNED_FILE_TTL_SECONDS,
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + Math.max(1, ttlSeconds);
  const signature = createHmac("sha256", signingSecret())
    .update(signaturePayload(file, taskId, userId, expiresAt))
    .digest("base64url");
  const params = new URLSearchParams({
    taskId,
    expires: String(expiresAt),
    signature,
  });

  return `/api/generated-stl/${encodeURIComponent(file)}?${params.toString()}`;
}

/**
 * Проверяет срок и HMAC-подпись ссылки.
 *
 * Владельца задачи роут узнаёт из строки `generations`, поэтому подпись
 * проверяется уже после чтения задачи: подписана именно эта строка. Дешёвые
 * проверки (срок, формат) идут первыми, а пустая или испорченная подпись
 * отсекается до обращения к Storage.
 */
export function verifyGeneratedFileLink(input: {
  file: string;
  taskId: string | null;
  userId: string | null;
  expires: string | null;
  signature: string | null;
}): boolean {
  const { file, taskId, userId, expires, signature } = input;

  if (!taskId || !userId || !expires || !signature) {
    return false;
  }

  const expiresAt = Number(expires);

  if (!Number.isInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    return false;
  }

  const expected = createHmac("sha256", signingSecret())
    .update(signaturePayload(file, taskId, userId, expiresAt))
    .digest();
  let provided: Buffer;

  try {
    provided = Buffer.from(signature, "base64url");
  } catch {
    return false;
  }

  return (
    provided.length === expected.length &&
    timingSafeEqual(provided, expected)
  );
}
