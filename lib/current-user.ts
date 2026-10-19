import { headers } from "next/headers";
import type { User } from "@supabase/supabase-js";

import { formatFullName, splitPersonName } from "@/lib/person-name";
import { createClient } from "@/lib/supabase/server";
import {
  USER_HEADER,
  decodeRequestUser,
  type RequestUser,
} from "@/lib/supabase/user-headers";

/**
 * Данные пользователя из ответа Supabase в том же виде, в каком их передаёт
 * middleware. Нужны страховочной ветке, когда запрос прошёл мимо прослойки.
 */
function requestUserFromAuthUser(user: User): RequestUser {
  const metadata = user.user_metadata ?? {};
  const savedFirstName =
    typeof metadata.first_name === "string" ? metadata.first_name.trim() : "";
  const savedLastName =
    typeof metadata.last_name === "string" ? metadata.last_name.trim() : "";
  const savedFullName =
    typeof metadata.name === "string" ? metadata.name.trim() : "";
  const fallbackParts = splitPersonName(savedFullName);
  const firstName = savedFirstName || fallbackParts.firstName || null;
  const lastName = savedLastName || fallbackParts.lastName || null;
  const fullName =
    firstName || lastName
      ? formatFullName(firstName ?? "", lastName ?? "") || null
      : savedFullName || null;

  return {
    id: user.id,
    email: user.email ?? null,
    name: fullName,
    firstName,
    lastName,
  };
}

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
export async function resolveCurrentUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<RequestUser | null> {
  const identity = decodeRequestUser((await headers()).get(USER_HEADER));

  if (identity) {
    return identity;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? requestUserFromAuthUser(user) : null;
}

/** Только идентификатор пользователя — для страниц, которым имя не нужно. */
export async function resolveUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  return (await resolveCurrentUser(supabase))?.id ?? null;
}
