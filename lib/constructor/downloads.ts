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
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Сколько раз Free-пользователь может скачать STL за календарный месяц. */
export const FREE_CONSTRUCTOR_DOWNLOADS_PER_MONTH = 3;

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

/** Остаток лимита для интерфейса: отрицательным он быть не может. */
export function remainingFreeDownloads(used: number): number {
  return Math.max(0, FREE_CONSTRUCTOR_DOWNLOADS_PER_MONTH - used);
}
