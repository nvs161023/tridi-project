import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { USER_HEADER, decodeRequestUser } from "@/lib/supabase/user-headers";

/**
 * Кто открыл страницу — общий помощник для страниц под авторизацией.
 *
 * middleware уже проверил сессию и передал пользователя заголовком, поэтому
 * берём готовое значение и НЕ вызываем getUser() второй раз: это экономит круг
 * до Supabase на каждом переходе (см. lib/supabase/user-headers.ts).
 *
 * Страховка: если заголовка нет (запрос прошёл мимо middleware), проверяем сессию
 * сами. Без этого страница могла бы открыться без проверки пользователя.
 */
export async function resolveUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const identity = decodeRequestUser((await headers()).get(USER_HEADER));

  if (identity) {
    return identity.id;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}
