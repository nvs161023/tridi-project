import { readFile } from "node:fs/promises";
import path from "node:path";

import type { NextRequest } from "next/server";

import {
  findProfileById,
  profileContentType,
  profileExtension,
} from "@/lib/profiles";
import { hasActiveSubscription } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";

/** Файлы читаются с диска — нужен Node.js, а не Edge. */
export const runtime = "nodejs";

/** Ответ зависит от cookies пользователя, кэшировать его нельзя. */
export const dynamic = "force-dynamic";

/** Корень библиотеки: profiles/ лежит рядом с package.json. */
const PROFILES_ROOT = path.resolve(process.cwd(), "profiles");

/** Ошибка в JSON: клиент показывает сообщение, статус остаётся машинным. */
function errorResponse(status: number, error: string, message: string): Response {
  return Response.json(
    { error, message },
    {
      status,
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    },
  );
}

/** ASCII-вариант имени для старых клиентов, не понимающих filename*. */
function asciiFileName(name: string): string {
  return name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
}

/**
 * Скачивание профиля из библиотеки.
 *
 * Доступ только по подписке Pro:
 *   1. сессия — getUser(), потому что /api/* не покрыт middleware;
 *   2. hasActiveSubscription() проверяет purchases (expires_at) и subscriptions
 *      (active или действующий trial);
 *   3. файл берётся строго по id из data/profiles.json, а не по пути из адреса.
 *
 * Гость получает 401, вошедший без активной подписки — 403. Подписка Pro
 * открывает инструменты (профили и конструктор), но не уроки — это разные
 * покупки в purchases.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse(
      401,
      "unauthorized",
      "Войдите в аккаунт, чтобы скачать профиль.",
    );
  }

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return errorResponse(
      403,
      "pro_required",
      "Скачивание профилей доступно по подписке Pro.",
    );
  }

  const id = request.nextUrl.searchParams.get("id")?.trim() ?? "";

  if (!id) {
    return errorResponse(400, "missing_id", "Не указан профиль для скачивания.");
  }

  const profile = findProfileById(id);

  if (!profile) {
    return errorResponse(404, "not_found", "Такого профиля нет в библиотеке.");
  }

  // Файл выбираем по метаданным, но всё равно проверяем, что итоговый путь
  // остался внутри profiles/: защита от ошибки в JSON и попытки path traversal.
  const filePath = path.resolve(PROFILES_ROOT, profile.file);
  const relativePath = path.relative(PROFILES_ROOT, filePath);

  if (
    relativePath === "" ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    return errorResponse(404, "not_found", "Файл профиля не найден.");
  }

  let file: Buffer;

  try {
    file = await readFile(filePath);
  } catch {
    // Файла нет на диске (например, забыли приложить при деплое) — это 404,
    // а не 500: для клиента профиль просто недоступен.
    console.error("Профиль не найден на диске:", relativePath);
    return errorResponse(404, "not_found", "Файл профиля не найден.");
  }

  const fileName = path.basename(filePath);
  const fallbackName = `${profile.id}.${profileExtension(profile)}`;

  return new Response(new Uint8Array(file), {
    status: 200,
    headers: {
      "content-type": profileContentType(profile),
      "content-disposition": `attachment; filename="${asciiFileName(fallbackName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "content-length": String(file.byteLength),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
