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
  ORDER_BASE_COLUMNS,
  ORDER_CLIENT_BASE_COLUMNS,
  ORDER_CLIENT_COLUMNS,
  ORDER_COLUMNS,
  ORDER_COMMENT_COLUMNS,
  ORDER_ITEM_COLUMNS,
  isOrderId,
  normalizeOrderComment,
  normalizeOrderItemSummary,
  normalizeOrderRow,
  type OrderComment,
  type OrderItemSummary,
  type WorkshopOrder,
} from "@/lib/workshop/orders";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Наборы колонок от полного к базовому.
 *
 * `source` и `client_id` добавляют отдельные ручные миграции. Перебор позволяет
 * приложению работать до их применения: карточка и список не падают, а
 * отсутствующие поля нормализация заменяет безопасными значениями.
 */
const ORDER_SELECT_FALLBACKS = [
  ORDER_CLIENT_COLUMNS,
  ORDER_CLIENT_BASE_COLUMNS,
  ORDER_COLUMNS,
  ORDER_BASE_COLUMNS,
] as const;

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

  let data: Partial<Record<string, unknown>> | null = null;
  let error: { code?: string | null; message: string } | null = null;

  // Миграции workshop_orders_client_id.sql и
  // workshop_marketplace_integration.sql применяются вручную. Пока колонок нет,
  // запрос повторяется с резервными наборами: заказ открывается, clientId
  // остаётся null, source считается ручным.
  for (const columns of ORDER_SELECT_FALLBACKS) {
    const result = await supabase
      .from("workshop_orders")
      .select(columns)
      .eq("id", orderId)
      .eq("user_id", userId)
      .maybeSingle();

    data = (result.data ?? null) as Partial<Record<string, unknown>> | null;
    error = result.error;

    if (!error || !isMissingColumnSchema(error)) {
      break;
    }
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
  let data: Partial<Record<string, unknown>>[] | null = null;
  let error: { code?: string | null; message: string } | null = null;

  // Та же деградация, что у getWorkshopOrder: клиент из базы и источник заказа
  // появляются миграциями, поэтому список читается и на старой схеме.
  for (const columns of ORDER_SELECT_FALLBACKS) {
    const result = await supabase
      .from("workshop_orders")
      .select(columns)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    data = (result.data ?? null) as
      | Partial<Record<string, unknown>>[]
      | null;
    error = result.error;

    if (!error || !isMissingColumnSchema(error)) {
      break;
    }
  }

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

/**
 * Позиции заказа для карточки: название товара и количество.
 *
 * Читаются при открытии карточки по той же причине, что и комментарии: доска
 * заказов не держит позиции в памяти. Порядок — `created_at asc`, как позиции
 * добавляли. Пустой или битый id не идёт в PostgREST, а ошибка запроса даёт
 * пустой список: карточка открывается, форма добавления позиции остаётся
 * доступной и сама объяснит причину. Таблицу создаёт
 * `supabase/workshop_farm_and_shop.sql` — до миграции список просто пуст.
 */
export async function getOrderItems(
  orderId: string,
): Promise<OrderItemSummary[]> {
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
    .from("workshop_order_items")
    .select(ORDER_ITEM_COLUMNS)
    .eq("order_id", orderId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("Позиции заказа не прочитаны:", error.code, error.message);

    return [];
  }

  const rows = (data ?? []) as Partial<Record<string, unknown>>[];

  return rows
    .map(normalizeOrderItemSummary)
    .filter((item): item is OrderItemSummary => item !== null);
}
