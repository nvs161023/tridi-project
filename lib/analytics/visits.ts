/**
 * Учёт посещений публичных страниц.
 *
 * Middleware вызывает `shouldTrackVisit` до отдачи страницы и, если запрос
 * подходит, складывает `recordSiteVisit` в `event.waitUntil`: запись в базу не
 * задерживает ответ и не ломает навигацию, даже если таблицы ещё нет.
 *
 * Что не считается посещением:
 *   • не GET (формы, API-вызовы);
 *   • служебные разделы /api, /admin, /dashboard и /auth;
 *   • статика Next.js и файлы с расширением;
 *   • предзагрузка ссылок и RSC-запросы при клиентской навигации — иначе один
 *     переход по сайту давал бы несколько «посещений».
 *
 * Хранится только путь без query-строки: ни IP, ни cookies, ни user_id.
 */
import type { NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";

/** Длина колонки path в site_visits.sql. */
const MAX_PATH_LENGTH = 512;

/** Разделы, которые не являются публичными страницами. */
const EXCLUDED_PREFIXES = ["/api", "/admin", "/dashboard", "/auth", "/_next"];

/** Служебные файлы в корне, у которых нет расширения в адресе. */
const EXCLUDED_PATHS = new Set(["/favicon.ico", "/robots.txt", "/sitemap.xml"]);

/** Путь, который имеет смысл записывать в site_visits. */
export function isTrackedPath(pathname: string): boolean {
  if (!pathname.startsWith("/") || pathname.length > MAX_PATH_LENGTH) {
    return false;
  }

  if (EXCLUDED_PATHS.has(pathname)) {
    return false;
  }

  // Точка в последнем сегменте — почти всегда файл (/logo.svg, /photo.webp),
  // а не страница. Проверяем именно последний сегмент, чтобы не отбросить
  // будущие адреса вида /profiles/ivan.petrov.
  const lastSegment = pathname.slice(pathname.lastIndexOf("/") + 1);
  if (lastSegment.includes(".")) {
    return false;
  }

  return !EXCLUDED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Стоит ли считать этот запрос просмотром страницы. */
export function shouldTrackVisit(request: NextRequest): boolean {
  if (request.method !== "GET") {
    return false;
  }

  if (!isTrackedPath(request.nextUrl.pathname)) {
    return false;
  }

  // Предзагрузка ссылки при наведении: страницу ещё никто не открывал.
  if (request.headers.get("next-router-prefetch") === "1") {
    return false;
  }

  const purpose = `${request.headers.get("purpose") ?? ""} ${
    request.headers.get("sec-purpose") ?? ""
  }`.toLowerCase();

  if (purpose.includes("prefetch")) {
    return false;
  }

  // Клиентская навигация App Router: HTML уже был отдан отдельным запросом,
  // его и считаем. Без этой проверки один переход учитывался бы дважды.
  return request.headers.get("rsc") !== "1";
}

/**
 * Записывает просмотр. Ошибки только логируются: аналитика не должна мешать
 * отдаче страницы. Отсутствие таблицы (миграция не применена) — ожидаемое
 * состояние, поэтому не засоряет лог на каждом запросе.
 */
export async function recordSiteVisit(pathname: string): Promise<void> {
  if (!isTrackedPath(pathname)) {
    return;
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("site_visits")
      .insert({ path: pathname.slice(0, MAX_PATH_LENGTH) });

    if (error && !isMissingTableSchema(error.code, error.message)) {
      console.error("[visits] Не удалось записать посещение:", error.message);
    }
  } catch (error) {
    console.error(
      "[visits] Не удалось записать посещение:",
      error instanceof Error ? error.message : error,
    );
  }
}
