/**
 * Авторизация локального агента 3D-фермы.
 *
 * Агент работает на компьютере мастера и ходит в API без cookie сессии
 * Supabase: он не «пользователь в браузере», а служебный клиент. Поэтому
 * мастерскую определяет не сессия, а персональный ключ
 * `workshop_settings.agent_token` (uuid, unique) — тот же приём, что у
 * `webhook_token` в вебхуках Ozon/WB/Yandex.
 *
 * Токен приходит только в заголовке `Authorization: Bearer <token>`: он не
 * должен попадать в URL, логи доступа и историю браузера. Значение токена
 * никогда не возвращается наружу — наружу уходит лишь id владельца.
 *
 * Модуль серверный: клиент service_role обходит RLS, импортировать его в
 * клиентский компонент нельзя.
 */
import { isWorkshopUuid } from "@/lib/db/workshop-types";
import { createAdminClient } from "@/lib/supabase/admin";

/** Схема заголовка: `Authorization: Bearer <token>`. */
const BEARER_SCHEME = "bearer";

/** Кто пришёл: владелец мастерской, чей agent_token совпал. */
export type AgentIdentity = {
  userId: string;
};

/**
 * Токен из заголовка Authorization.
 *
 * Схема сравнивается без учёта регистра (`Bearer`, `bearer`), между схемой и
 * токеном допускаются пробелы. null — заголовка нет, он другого типа или
 * токен пустой.
 */
function readBearerToken(header: string | null): string | null {
  if (!header) {
    return null;
  }

  const value = header.trim();
  const separator = value.search(/\s/u);

  if (separator <= 0) {
    return null;
  }

  if (value.slice(0, separator).toLowerCase() !== BEARER_SCHEME) {
    return null;
  }

  const token = value.slice(separator + 1).trim();

  return token || null;
}

/**
 * Проверяет токен агента и возвращает владельца мастерской.
 *
 * null — токена нет, он неверного формата, не найден в `workshop_settings` или
 * сервер не смог прочитать базу. Ответ наружу в этих случаях одинаковый (401),
 * чтобы по нему нельзя было понять, существует ли токен. Причину серверной
 * ошибки пишем в лог: агент на своей стороне видит только «не авторизован».
 */
export async function validateAgentToken(
  req: Request,
): Promise<AgentIdentity | null> {
  const token = readBearerToken(req.headers.get("authorization"));

  // Токен — uuid из gen_random_uuid(). Не uuid — заведомо не наш ключ, в базу
  // не ходим: так перебор мусорных значений не нагружает PostgREST.
  if (!token || !isWorkshopUuid(token)) {
    return null;
  }

  let supabase: ReturnType<typeof createAdminClient>;

  try {
    supabase = createAdminClient();
  } catch (error) {
    console.error(
      "Агент: клиент service_role не создан:",
      error instanceof Error ? error.message : error,
    );

    return null;
  }

  const result = await supabase
    .from("workshop_settings")
    .select("user_id")
    .eq("agent_token", token)
    .maybeSingle();

  if (result.error) {
    console.error(
      "Агент: токен не проверен:",
      result.error.code,
      result.error.message,
    );

    return null;
  }

  // Ответ PostgREST не считаем доверенным: строка может быть null, а user_id —
  // не строкой, если схема разошлась с кодом.
  const userId: unknown =
    typeof result.data === "object" && result.data !== null
      ? (result.data as { user_id?: unknown }).user_id
      : null;

  if (!isWorkshopUuid(userId)) {
    return null;
  }

  return { userId };
}
