import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Прослойка между пользователем и страницами сайта.
 *
 * Работает на каждом подходящем запросе ДО того, как Next.js начнёт отдавать
 * страницу, и занимается только одним: продлевает сессию Supabase, если
 * access-токен пользователя успел истечь.
 *
 * Сама логика лежит в lib/supabase/middleware.ts (функция updateSession) —
 * здесь только подключение. Ничего не рендерим и не удаляем:
 * always возвращаем тот ответ, который пришёл из updateSession, иначе
 * обновлённые cookies сессии потеряются и пользователя будет разлогинивать.
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
