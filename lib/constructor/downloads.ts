/**
 * Учёт бесплатных скачиваний STL в Конструкторе.
 *
 * Бесплатный пользователь получает три генерации в календарный месяц. Месяц
 * считается по UTC: сервер и база не зависят от часового пояса браузера, а
 * границы всегда одинаковые. Pro-пользователи лимит не расходуют.
 *
 * Проверка в интерфейсе нужна только для удобства: API считает записи заново
 * перед каждой генерацией и не отдаёт файл сверх лимита.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import { FREE_CONSTRUCTOR_DOWNLOADS_PER_MONTH } from "@/lib/constructor/limits";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Сколько раз Free-пользователь может скачать STL за календарный месяц.
 *
 * Само число живёт в `lib/constructor/limits.ts`: витрины берут его без
 * Supabase-клиента, а этот модуль реэкспортирует для существующих импортов.
 */
export { FREE_CONSTRUCTOR_DOWNLOADS_PER_MONTH };

/** Резерв слота: либо id записи для отката, либо причина отказа. */
export type ConstructorDownloadReservation =
  | { ok: true; id: string }
  | { ok: false; reason: "limit" }
  | { ok: false; reason: "error"; error: string };

/** Результат подсчёта: либо число, либо текст ошибки без утечки деталей. */
export type ConstructorDownloadUsage =
  | { count: number; error: null }
  | { count: null; error: string };

/** Начало текущего месяца и начало следующего — обе границы в UTC. */
export function utcMonthBounds(now = new Date()): {
  start: string;
  end: string;
} {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  return {
    start: new Date(Date.UTC(year, month, 1)).toISOString(),
    end: new Date(Date.UTC(year, month + 1, 1)).toISOString(),
  };
}

/**
 * Сколько бесплатных скачиваний пользователь уже потратил в этом месяце.
 *
 * Читаем клиентом пользователя, а не service role: RLS отдаёт только его
 * записи, поэтому чужой идентификатор в запросе ничего не меняет. Ошибку
 * возвращаем отдельно — API должен закрыть доступ, а не молча обнулить лимит.
 */
export async function countConstructorDownloadsThisMonth(
  supabase: Supabase,
  userId: string,
  now = new Date(),
): Promise<ConstructorDownloadUsage> {
  const { start, end } = utcMonthBounds(now);

  const { count, error } = await supabase
    .from("constructor_downloads")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", start)
    .lt("created_at", end);

  if (error) {
    return { count: null, error: error.message };
  }

  return { count: count ?? 0, error: null };
}

/**
 * Атомарно резервирует бесплатное скачивание.
 *
 * Проверка и вставка идут одной SQL-функцией под блокировкой по пользователю:
 * две параллельные генерации не могут обе увидеть «осталось одно» и получить
 * четвёртый файл. Резерв создаётся до сборки STL и удаляется
 * `releaseConstructorDownload`, если генерация упала.
 *
 * Ошибку базы возвращаем отдельно: API должен закрыть доступ (503), а не
 * пропустить запрос без учёта лимита.
 */
export async function reserveConstructorDownload(
  userId: string,
  limit = FREE_CONSTRUCTOR_DOWNLOADS_PER_MONTH,
): Promise<ConstructorDownloadReservation> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("reserve_constructor_download", {
      p_user_id: userId,
      p_limit: limit,
    });

    if (error) {
      return { ok: false, reason: "error", error: error.message };
    }

    if (typeof data !== "string" || data.length === 0) {
      return { ok: false, reason: "limit" };
    }

    return { ok: true, id: data };
  } catch (error) {
    return {
      ok: false,
      reason: "error",
      error: error instanceof Error ? error.message : "неизвестная ошибка",
    };
  }
}

/**
 * Возвращает зарезервированное скачивание при ошибке генерации.
 *
 * Это компенсирующая операция: её сбой не должен скрывать исходную ошибку,
 * поэтому причина только пишется в лог, а функция не бросает исключение.
 */
export async function releaseConstructorDownload(id: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc("release_constructor_download", {
      p_id: id,
    });

    if (error) {
      console.warn(
        "[constructor] Не удалось вернуть бесплатное скачивание:",
        error.message,
      );
    }
  } catch (error) {
    console.warn(
      "[constructor] Не удалось вернуть бесплатное скачивание:",
      error instanceof Error ? error.message : error,
    );
  }
}

/** Остаток лимита для интерфейса: отрицательным он быть не может. */
export function remainingFreeDownloads(used: number): number {
  return Math.max(0, FREE_CONSTRUCTOR_DOWNLOADS_PER_MONTH - used);
}
