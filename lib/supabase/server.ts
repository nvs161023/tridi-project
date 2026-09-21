import { cookies } from "next/headers";

import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Одна пара cookies для записи: имя, значение и опции (срок жизни, флаги).
 */
type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

function getSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Не заданы NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY. Добавьте их в .env.local",
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}

/**
 * Читает все cookies текущего запроса.
 * Supabase достаёт из них токены сессии, чтобы понять, кто это.
 */
export async function getCookies() {
  const cookieStore = await cookies();

  return cookieStore.getAll();
}

/**
 * Записывает cookies в ответ (например, обновлённый access-токен).
 *
 * В Server Components писать cookies нельзя — там метод бросит исключение,
 * и мы просто пропускаем запись: обновлением сессии занимается middleware
 * (lib/supabase/middleware.ts).
 */
export async function setCookies(cookiesToSet: CookieToSet[]) {
  try {
    const cookieStore = await cookies();

    for (const { name, value, options } of cookiesToSet) {
      cookieStore.set(name, value, options);
    }
  } catch {
    // Server Component: cookies только для чтения — это нормально.
  }
}

/**
 * Supabase-клиент для серверного кода: Server Components, Route Handlers,
 * Server Actions.
 *
 * ВАЖНО: создавайте новый клиент на каждый запрос (просто вызывайте
 * createClient() в нужном месте) и не храните его в глобальной переменной —
 * иначе один пользователь получит сессию другого.
 */
export async function createClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: getCookies,
      setAll: setCookies,
    },
  });
}
