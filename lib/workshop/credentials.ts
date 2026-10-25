/**
 * Серверные доступы к Ozon Seller для запросов к API.
 *
 * В базе Api-Key лежит зашифрованным (`lib/crypto.ts`), а в интерфейс уходит
 * только маска. Поэтому расшифровка живёт отдельно от `getWorkshopSettings`:
 * страница не должна получать открытый ключ даже случайно, а фоновые задачи и
 * будущие запросы к Seller API получают его здесь.
 *
 * Модуль серверный: импортирует `node:crypto` через `lib/crypto.ts`. Не
 * используйте его в клиентских компонентах.
 */
import { decrypt, isEncryptedSecret } from "@/lib/crypto";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Пара доступов, готовая для заголовков Seller API. */
export type WorkshopOzonCredentials = {
  clientId: string;
  apiKey: string;
};

/**
 * Client-Id и расшифрованный Api-Key или `null`, если интеграция не настроена.
 *
 * Старые строки, сохранённые до шифрования, возвращаются как есть — иначе
 * после деплоя перестали бы работать уже настроенные интеграции. При следующем
 * сохранении вкладки «Интеграции» такое значение шифруется. Сбой чтения или
 * расшифровки не роняет вызывающий код: без ключей просто не идём в Ozon.
 */
export async function getWorkshopOzonCredentials(
  supabase: Supabase,
  userId: string,
): Promise<WorkshopOzonCredentials | null> {
  const { data, error } = await supabase
    .from("workshop_settings")
    .select("ozon_client_id, ozon_api_key")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn(
      "Доступы Ozon не прочитаны:",
      error.code,
      error.message,
    );

    return null;
  }

  const row = data as
    | { ozon_client_id?: unknown; ozon_api_key?: unknown }
    | null;
  const clientId =
    typeof row?.ozon_client_id === "string" ? row.ozon_client_id.trim() : "";
  const storedKey =
    typeof row?.ozon_api_key === "string" ? row.ozon_api_key.trim() : "";

  if (!clientId || !storedKey) {
    return null;
  }

  try {
    return {
      clientId,
      apiKey: isEncryptedSecret(storedKey)
        ? decrypt(storedKey)
        : storedKey,
    };
  } catch (decryptError) {
    console.warn(
      "Api-Key Ozon не расшифрован:",
      decryptError instanceof Error
        ? decryptError.message
        : "неизвестная ошибка",
    );

    return null;
  }
}
