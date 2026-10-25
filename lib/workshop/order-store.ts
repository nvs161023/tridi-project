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
  ORDER_CLIENT_COLUMNS,
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

/** PostgREST/PostgreSQL: выбранной колонки ещё нет в базе. */
function isMissingColumnSchema(error: {
  code?: string | null;
}): boolean {
  return error.code === "42703" || error.code === "PGRST204";
}

/**
 * Один заказ пользователя.
 *
 * Нужен печатной спецификации: она открывается по прямой ссылке и не должна
 * зависеть от того, попал ли заказ в список на странице. `user_id` в запросе
 * дублирует RLS: чужая строка не откроется, даже если политика ослабнет.
 * Битый id и отсутствие строки дают null — страница сама решает, что показать.
 */
export async function getWorkshopOrder(
  supabase: Supabase,
  userId: string,
  orderId: string,
): Promise<WorkshopOrder | null> {
  if (!isOrderId(orderId)) {
    return null;
  }

  const withClient = await supabase
    .from("workshop_orders")
    .select(ORDER_CLIENT_COLUMNS)
    .eq("id", orderId)
    .eq("user_id", userId)
    .maybeSingle();

  let data: Partial<Record<string, unknown>> | null = (withClient.data ??
    null) as Partial<Record<string, unknown>> | null;
  let error = withClient.error;

  // Миграция workshop_orders_client_id.sql применяется вручную. Пока колонки
  // нет, повторяем запрос без неё: спецификация и накладная открываются, а
  // clientId остаётся null — контакты в накладной заполняются вручную.
  if (error && isMissingColumnSchema(error)) {
    const legacy = await supabase
      .from("workshop_orders")
      .select(ORDER_COLUMNS)
      .eq("id", orderId)
      .eq("user_id", userId)
      .maybeSingle();

    data = (legacy.data ?? null) as Partial<Record<string, unknown>> | null;
    error = legacy.error;
  }

  if (error) {
    console.warn(
      "Заказ мастерской не прочитан:",
      error.code,
      error.message,
    );

    return null;
  }

  return normalizeOrderRow(data);
}

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
