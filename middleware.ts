import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Прослойка для путей, где важна авторизация.
 *
 * Работает только на защищённых страницах (/dashboard и /auth/*) и делает три
 * вещи: продлевает сессию Supabase (если access-токен истёк), отправляет гостя
 * с /dashboard на вход, а авторизованного пользователя с /auth/* — в личный
 * кабинет.
 *
 * Заодно middleware передаёт данные пользователя странице заголовком, поэтому
 * страницы НЕ вызывают getUser() повторно — это экономит один круг до Supabase
 * на каждый переход (см. lib/supabase/user-headers.ts).
 *
 * Список путей задаётся в config.matcher ниже — middleware не запускается на
 * всём остальном сайте.
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
   *  - /auth/* (вход, регистрация и всё, что внутри).
   *
   * `:path*` означает «ноль и более сегментов», поэтому "/dashboard/:path*"
   * захватывает и сам /dashboard — отдельная запись "/dashboard" не нужна.
   *
   * Публичные страницы (/, /course/*) в matcher не перечислены: для них
   * middleware не запускается вообще, то есть нет ни обращения к Supabase,
   * ни задержки перед отдачей HTML.
   *
   * Когда появится /constructor — добавьте "/constructor/:path*".
   */
  matcher: ["/dashboard/:path*", "/auth/:path*"],
};

