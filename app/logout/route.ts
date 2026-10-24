import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { resolveSiteUrl } from "@/lib/site-url";

/**
 * Выход из аккаунта.
 *
 * Это отдельный POST-маршрут, а не Server Action в шапке: после signOut нужен
 * обычный GET на главную, чтобы middleware и страницы прочитали уже очищенные
 * cookies. Если сделать redirect внутри Server Action, запрос сохраняет
 * USER_HEADER прежнего пользователя и шапка показывает его ещё раз.
 *
 * Адрес возврата берём из lib/site-url.ts, а не из request.url. На Amvera
 * приложение слушает внутренний порт за прокси, и request.url приходил с
 * адресом http://localhost:3000 — выход уводил человека с боевого сайта на
 * несуществующий локальный. resolveSiteUrl отдаёт NEXT_PUBLIC_SITE_URL, в
 * разработке — адрес из запроса (иначе локальные проверки уходили бы на прод),
 * а если переменной нет — боевой домен.
 *
 * У signOut нет параметра redirectTo: в @supabase/ssr он принимает только
 * { scope }, и адрес возврата задаёт именно этот маршрут.
 */
export async function POST(request: NextRequest) {
  const siteUrl = await resolveSiteUrl();
  const response = NextResponse.redirect(new URL("/", siteUrl), 303);
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
