/**
 * Чтение связей SKU и заказов без маппинга для страницы «Маркетплейсы».
 *
 * Ошибка чтения не роняет страницу: мастерская должна открыться и показать,
 * что именно не настроено. Отсутствие таблиц этапа 1 возвращается флагом
 * `isMissingTable`, как у остальных разделов Мастерской.
 */
import { isMarketplace, isWorkshopUuid } from "@/lib/db/workshop-types";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import { createClient } from "@/lib/supabase/server";
import type {
  MarketplaceLink,
  UnmappedOrder,
  UnmappedOrderItem,
} from "@/lib/workshop/marketplace";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type MarketplaceSnapshot = {
  links: MarketplaceLink[];
  unmappedOrders: UnmappedOrder[];
  /** Нет workshop_marketplace_links или workshop_order_items. */
  isMissingTable: boolean;
};

const LINK_COLUMNS = "id, marketplace, sku, product_id, created_at";
const ORDER_COLUMNS =
  "id, title, source, marketplace_order_id, client_name, created_at";
const ITEM_COLUMNS = "id, order_id, sku, quantity";

/** Связь из строки PostgREST; битые поля отбрасываются. */
function normalizeLink(
  row: Partial<Record<string, unknown>>,
): MarketplaceLink | null {
  if (
    !isWorkshopUuid(row.id) ||
    !isMarketplace(row.marketplace) ||
    !isWorkshopUuid(row.product_id) ||
    typeof row.sku !== "string" ||
    !row.sku.trim()
  ) {
    return null;
  }

  return {
    id: row.id,
    marketplace: row.marketplace,
    sku: row.sku.trim().slice(0, 128),
    productId: row.product_id,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
  };
}

/** Заказ unmapped; заказ другой площадки или с битым id не показываем. */
function normalizeOrder(
  row: Partial<Record<string, unknown>>,
): UnmappedOrder | null {
  if (
    !isWorkshopUuid(row.id) ||
    !isMarketplace(row.source) ||
    typeof row.title !== "string" ||
    !row.title.trim()
  ) {
    return null;
  }

  return {
    id: row.id,
    title: row.title.trim().slice(0, 80),
    source: row.source,
    marketplaceOrderId:
      typeof row.marketplace_order_id === "string"
        ? row.marketplace_order_id
        : null,
    clientName:
      typeof row.client_name === "string" && row.client_name.trim()
        ? row.client_name.trim().slice(0, 60)
        : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
    items: [],
  };
}

/** Позиция заказа; количество приводим к пределу колонки. */
function normalizeItem(
  row: Partial<Record<string, unknown>>,
): UnmappedOrderItem | null {
  if (!isWorkshopUuid(row.id)) {
    return null;
  }

  const quantity =
    typeof row.quantity === "number" && Number.isFinite(row.quantity)
      ? Math.min(10000, Math.max(1, Math.round(row.quantity)))
      : 1;

  return {
    id: row.id,
    sku:
      typeof row.sku === "string" && row.sku.trim()
        ? row.sku.trim().slice(0, 128)
        : null,
    quantity,
  };
}

/** Связи, заказы unmapped и их позиции. */
export async function getMarketplaceSnapshot(
  supabase: Supabase,
  userId: string,
): Promise<MarketplaceSnapshot> {
  const linksResult = await supabase
    .from("workshop_marketplace_links")
    .select(LINK_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (linksResult.error) {
    console.warn(
      "Связи маркетплейсов не прочитаны:",
      linksResult.error.code,
      linksResult.error.message,
    );

    return {
      links: [],
      unmappedOrders: [],
      isMissingTable: isMissingTableSchema(
        linksResult.error.code,
        linksResult.error.message,
      ),
    };
  }

  const links = ((linksResult.data ?? []) as Partial<Record<string, unknown>>[])
    .map(normalizeLink)
    .filter((link): link is MarketplaceLink => link !== null);

  const ordersResult = await supabase
    .from("workshop_orders")
    .select(ORDER_COLUMNS)
    .eq("user_id", userId)
    .eq("status", "unmapped")
    .order("created_at", { ascending: false });

  if (ordersResult.error) {
    console.warn(
      "Заказы без маппинга не прочитаны:",
      ordersResult.error.code,
      ordersResult.error.message,
    );

    return {
      links,
      unmappedOrders: [],
      isMissingTable: isMissingTableSchema(
        ordersResult.error.code,
        ordersResult.error.message,
      ),
    };
  }

  const orders = ((ordersResult.data ?? []) as Partial<Record<string, unknown>>[])
    .map(normalizeOrder)
    .filter((order): order is UnmappedOrder => order !== null);

  if (orders.length === 0) {
    return { links, unmappedOrders: [], isMissingTable: false };
  }

  const itemsResult = await supabase
    .from("workshop_order_items")
    .select(ITEM_COLUMNS)
    .eq("user_id", userId)
    .in(
      "order_id",
      orders.map((order) => order.id),
    );

  if (itemsResult.error) {
    console.warn(
      "Позиции заказов без маппинга не прочитаны:",
      itemsResult.error.code,
      itemsResult.error.message,
    );

    return {
      links,
      unmappedOrders: orders,
      isMissingTable: isMissingTableSchema(
        itemsResult.error.code,
        itemsResult.error.message,
      ),
    };
  }

  const itemsByOrder = new Map<string, UnmappedOrderItem[]>();

  for (const row of (itemsResult.data ?? []) as Partial<
    Record<string, unknown>
  >[]) {
    const orderId = row.order_id;

    if (typeof orderId !== "string") {
      continue;
    }

    const item = normalizeItem(row);

    if (!item) {
      continue;
    }

    itemsByOrder.set(orderId, [...(itemsByOrder.get(orderId) ?? []), item]);
  }

  return {
    links,
    unmappedOrders: orders.map((order) => ({
      ...order,
      items: itemsByOrder.get(order.id) ?? [],
    })),
    isMissingTable: false,
  };
}
