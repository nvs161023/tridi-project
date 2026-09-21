import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Обновляет сессию пользователя на каждом запросе.
 *
 * Что происходит по шагам:
 * 1. берём cookies из входящего запроса;
 * 2. создаём Supabase-клиент, который умеет их читать и перезаписывать;
 * 3. вызываем getUser() — если access-токен истёк, Supabase сам обменяет
 *    refresh-токен на новый и положит обновлённые cookies в ответ;
 * 4. возвращаем NextResponse, который нужно вернуть из middleware.ts в корне.
 *
 * Пример будущего middleware.ts в корне проекта:
 *
 *   import { type NextRequest } from "next/server";
 *   import { updateSession } from "@/lib/supabase/middleware";
 *
 *   export async function middleware(request: NextRequest) {
 *     return await updateSession(request);
 *   }
 *
 *   export const config = {
 *     matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
 *   };
 */
export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Не заданы NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY. Добавьте их в .env.local",
    );
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = NextResponse.next({ request });

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }

        // Заголовки кеширования от Supabase: ответ с токенами нельзя
        // кэшировать на CDN/прокси, иначе чужие сессии могут «слипнуться».
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // ВАЖНО: не удаляйте этот вызов — именно он продлевает сессию.
  // Не вызывайте getUser() между созданием клиента и возвратом response:
  // обновлённые cookies должны попасть в тот же ответ.
  await supabase.auth.getUser();

  return response;
}
