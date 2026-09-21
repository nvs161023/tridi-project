import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase-клиент для браузера.
 *
 * Используется в Client Components ("use client") и в коде, который
 * выполняется в браузере: чтение данных, вход/выход пользователя,
 * подписка на изменения — всё, что требует ключ anon.
 *
 * Клиент хранит сессию в cookies, поэтому он «видит» того же пользователя,
 * что и серверные компоненты.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Не заданы NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY. Добавьте их в .env.local",
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
