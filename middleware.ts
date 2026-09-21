import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Прослойка для путей, где важна авторизация.
 *
 * Работает только на защищённых страницах (/dashboard и /auth/*) и делает
 * ровно одно: продлевает сессию Supabase, если access-токен истёк.
 *
 * Публичные страницы (главная, /course/*) сюда не попадают — им сессия не
 * нужна, а каждый вызов updateSession это сетевой запрос к Supabase. Раньше
 * он выполнялся на каждом переходе по сайту и заметно тормозил навигацию.
 *
 * Логика лежит в lib/supabase/middleware.ts (функция updateSession) — здесь
 * только подключение. Не заменяйте возвращаемый ответ: в нём едут обновлённые
 * cookies, потеряв их, пользователя будет разлогинивать.
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  /**
   * Покрываем только защищённые разделы:
   *  - /dashboard и всё, что внутри;
   *  - /auth/* (вход и регистрация).
   * Когда появится /constructor — добавьте "/constructor/:path*".
   */
  matcher: ["/dashboard", "/dashboard/:path*", "/auth/:path*"],
};

