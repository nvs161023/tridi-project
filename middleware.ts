import {
  type NextFetchEvent,
  type NextRequest,
  NextResponse,
} from "next/server";

import { recordSiteVisit, shouldTrackVisit } from "@/lib/analytics/visits";
import { HIDDEN_REDIRECT_PATH, isHiddenPath } from "@/lib/hidden-routes";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Прослойка делает три независимые вещи.
 *
 * 1. Скрытые разделы (/constructor): страница готова не полностью — модели не
 *    проверены на печати, — поэтому адрес закрыт для всех, включая владельцев
 *    пакета. Редирект стоит до проверки сессии: гостя незачем вести на вход,
 *    чтобы потом показать «инструмент недоступен».
 *
 * 2. Защищённые страницы (/dashboard, /course/*, /forum/new,
 *    /admin/*, /auth/*): updateSession продлевает сессию Supabase, отправляет
 *    гостя на вход с запоминанием адреса (next=...), уводит авторизованного
 *    пользователя со страницы входа и передаёт данные странице заголовком.
 *    Логика лежит в lib/supabase/middleware.ts — здесь только подключение.
 *
 * 3. Публичные страницы: считаем просмотр в site_visits. Запись уходит в
 *    event.waitUntil, поэтому база не задерживает HTML и не ломает страницу,
 *    даже если миграция ещё не применена. updateSession для публичных страниц
 *    НЕ вызывается: для авторизованного пользователя это сетевой запрос к
 *    Supabase на каждом переходе, который раньше заметно тормозил навигацию.
 *
 * matcher покрывает весь сайт, кроме служебных путей и файлов. Это нужно
 * именно для счётчика посещений: раньше middleware запускался только на
 * защищённых разделах. Список исключений — в config.matcher ниже.
 *
 * Не заменяйте ответ updateSession: в нём едут обновлённые cookies, потеряв
 * их, пользователя будет разлогинивать.
 */

/**
 * Скрытые разделы описаны в lib/hidden-routes.ts: список и проверка общие для
 * middleware и страницы, чтобы правило не разъехалось. Ниже — только те
 * префиксы, где нужна сессия.
 */

/** Префиксы, где нужна сессия. */
const SESSION_PATH_PREFIXES = [
  "/dashboard",
  "/certificate",
  "/course",
  "/admin",
  "/auth",
];

/** Отдельные защищённые страницы вне префиксов. */
const SESSION_EXACT_PATHS = new Set(["/forum/new"]);

/** Нужен ли на этом пути пользователь из Supabase. */
function needsSession(pathname: string): boolean {
  if (SESSION_EXACT_PATHS.has(pathname)) {
    return true;
  }

  return SESSION_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * API-роуты не проходят через сессию и счётчик посещений.
 *
 * `matcher` уже исключает `/api`, но проверка остаётся здесь явно: если
 * matcher поменяют (например, ради счётчика для новых разделов), вебхуки
 * Ozon и платёжные уведомления не должны получить редирект на вход.
 * У Ozon нет cookie нашей сессии, поэтому любая проверка браузерной сессии
 * для `/api/webhooks/*` — это 403 или 307 вместо уведомления.
 */
function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;

  // Первым делом: у вебхуков свои проверки внутри роутов.
  if (isApiPath(pathname)) {
    return NextResponse.next();
  }

  // Скрытый раздел закрыт и для гостя, и для владельца пакета: это не про
  // права, а про готовность продукта. Проверка стоит первой, чтобы не гонять
  // updateSession (запрос к Supabase) ради страницы, которую всё равно не
  // открыть.
  if (isHiddenPath(pathname)) {
    return NextResponse.redirect(new URL(HIDDEN_REDIRECT_PATH, request.url));
  }

  if (needsSession(pathname)) {
    return updateSession(request);
  }

  if (shouldTrackVisit(request)) {
    event.waitUntil(recordSiteVisit(pathname));
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Весь сайт, кроме:
   *  - /api — вебхуки и cron, у них свои проверки;
   *  - /_next/static и /_next/image — собранные файлы Next.js;
   *  - favicon.ico, robots.txt, sitemap.xml — служебные файлы;
   *  - любого пути с расширением в последнем сегменте (логотипы, картинки,
   *    шрифты из public/): это не страницы.
   *
   * Проверка «кроме /admin и /dashboard» для счётчика живёт в
   * lib/analytics/visits.ts: эти разделы проходят через middleware, потому что
   * им нужна сессия, но посещениями не считаются.
   */
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};

