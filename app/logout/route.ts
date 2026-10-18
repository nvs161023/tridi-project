import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Выход из аккаунта.
 *
 * Это отдельный POST-маршрут, а не Server Action в шапке: после signOut нужен
 * обычный GET на главную, чтобы middleware и страницы прочитали уже очищенные
 * cookies. Если сделать redirect внутри Server Action, запрос сохраняет
 * USER_HEADER прежнего пользователя и шапка показывает его ещё раз.
 */
export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies) {
        for (const { name, value, options } of cookies) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  await supabase.auth.signOut();

  return response;
}
