/**
 * Чтение заказов и комментариев для страницы `/dashboard/workshop`.
 *
 * Новые заказы сверху: мастеру нужен текущий заказ, а не прошлогодний.
 * Отсутствие таблицы — ожидаемое состояние до применения миграции, поэтому
 * вкладка получает пустой список и признак `isMissingTable`, а не ошибку.
 * Комментарии читает окно карточки заказа: старые сверху, как переписка.
 */
import { createClient } from "@/lib/supabase/server";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import {
  ORDER_COLUMNS,
  ORDER_COMMENT_COLUMNS,
  isOrderId,
  normalizeOrderComment,
  normalizeOrderRow,
  type OrderComment,
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

/**
 * Комментарии заказа: старые сверху — так лента читается как переписка.
 *
 * Пустой или битый id не идёт в PostgREST. Ошибка запроса тоже даёт пустой
 * список: карточка заказа должна открыться, а причина остаётся в логе сервера.
 * RLS уже ограничивает выборку владельцем, явный `user_id` нужен индексу и
 * защищает от случайной выборки чужой строки при отключённой политике.
 */
export async function getOrderComments(
  orderId: string,
): Promise<OrderComment[]> {
  if (!isOrderId(orderId)) {
    return [];
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("workshop_order_comments")
    .select(ORDER_COMMENT_COLUMNS)
    .eq("order_id", orderId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn(
      "Комментарии заказа не прочитаны:",
      error.code,
      error.message,
    );

    return [];
  }

  const rows = (data ?? []) as Partial<Record<string, unknown>>[];

  return rows
    .map(normalizeOrderComment)
    .filter((comment): comment is OrderComment => comment !== null);
}
