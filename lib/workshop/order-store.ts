/**
 * Чтение заказов для страницы `/dashboard/workshop`.
 *
 * Новые заказы сверху: мастеру нужен текущий заказ, а не прошлогодний.
 * Отсутствие таблицы — ожидаемое состояние до применения миграции, поэтому
 * вкладка получает пустой список и признак `isMissingTable`, а не ошибку.
 */
import type { createClient } from "@/lib/supabase/server";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import {
  ORDER_COLUMNS,
  normalizeOrderRow,
  type WorkshopOrder,
} from "@/lib/workshop/orders";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type WorkshopOrdersSnapshot = {
  orders: WorkshopOrder[];
  /** В базе нет таблицы workshop_orders — миграция не применена. */
  isMissingTable: boolean;
};

/** Заказы пользователя: сначала новые. */
export async function getWorkshopOrders(
  supabase: Supabase,
  userId: string,
): Promise<WorkshopOrdersSnapshot> {
  const { data, error } = await supabase
    .from("workshop_orders")
    .select(ORDER_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Заказы мастерской не прочитаны:", error.code, error.message);

    return {
      orders: [],
      isMissingTable: isMissingTableSchema(error.code, error.message),
    };
  }

  const rows = (data ?? []) as Partial<Record<string, unknown>>[];

  return {
    orders: rows
      .map(normalizeOrderRow)
      .filter((order): order is WorkshopOrder => order !== null),
    isMissingTable: false,
  };
}
