/**
 * Ядро обработки заказов маркетплейсов.
 *
 * Один вход для Ozon, Wildberries и Яндекс.Маркета: вебхук разбирает свой
 * payload и отдаёт сюда нормализованный заказ. Дальше модуль:
 *   1. проверяет поля и приводит деньги/количество к пределам базы;
 *   2. ищет каждый SKU в workshop_marketplace_links этой мастерской и этой
 *      площадки;
 *   3. создаёт заказ и позиции, либо возвращает существующий (идемпотентность
 *      по user_id + marketplace_order_id);
 *   4. если хотя бы один SKU не найден — ставит заказу статус `unmapped` и
 *      сохраняет позицию с product_id = null, чтобы её можно было связать
 *      вручную на странице «Маркетплейсы».
 *
 * Клиент базы передаётся необязательным третьим аргументом: вебхуки уже имеют
 * service_role-клиент после поиска продавца по токену, а тест передаёт свой.
 * Без клиента функция сама создаёт service_role: запись из вебхука идёт без
 * cookies пользователя, поэтому RLS её не пропустит.
 *
 * Транзакции между несколькими запросами PostgREST нет. Поэтому при неудачной
 * вставке позиций заказ удаляется (каскад уносит и частичные строки), а вебхук
 * получает ошибку и повторяет уведомление — заказ не остаётся полупустым.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isMarketplace,
  isWorkshopUuid,
  type Marketplace,
} from "@/lib/db/workshop-types";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import { isOrderStatus, type OrderStatus } from "@/lib/workshop/orders";

/** Позиция нормализованного заказа: SKU может отсутствовать. */
export type NormalizedOrderItem = {
  sku: string | null;
  quantity: number;
  /** Цена за единицу в рублях; null — площадка её не прислала. */
  price: number | null;
};

/**
 * Заказ, приведённый вебхуком к общему виду.
 *
 * `total_amount` и `marketplace_commission` — null, если площадка не прислала
 * поле. Это не ноль: в аналитике «неизвестно» и «нулевая комиссия» — разные
 * вещи.
 */
export type NormalizedOrder = {
  marketplace_order_id: string;
  buyer_name: string | null;
  items: NormalizedOrderItem[];
  total_amount: number | null;
  marketplace_commission: number | null;
  source: Marketplace;
};

export type OrderProcessingFailureReason =
  | "invalid_order"
  | "invalid_user"
  | "migration_missing"
  | "server_misconfigured"
  | "read_failed"
  | "write_failed";

export type OrderProcessingFailure = {
  ok: false;
  reason: OrderProcessingFailureReason;
  error: string;
};

export type ProcessedOrder = {
  orderId: string;
  orderStatus: OrderStatus;
  /** created — новый; updated — существующий дополнили; unchanged — повтор. */
  outcome: "created" | "updated" | "unchanged";
  /** Сколько позиций сохранили связь с товаром. */
  mappedItems: number;
  /** SKU, для которых связи не нашлось. */
  unmappedSkus: string[];
};

export type OrderProcessingResult =
  | { ok: true; data: ProcessedOrder }
  | OrderProcessingFailure;

export type RelinkResult = {
  ordersChecked: number;
  ordersReady: number;
  itemsLinked: number;
};

type Supabase = SupabaseClient;

/** Сколько SKU ищем одним запросом: длинный `in` упирается в URL PostgREST. */
const LOOKUP_CHUNK = 100;

/** Больше позиций в одном заказе не бывает; лишние отбрасываются. */
const MAX_ITEMS = 100;

/** `workshop_order_items.quantity` — check от 1 до 10 000. */
const MAX_QUANTITY = 10_000;

/** `workshop_orders.total_cost` — check до 1 000 000 ₽. */
const MAX_AMOUNT = 1_000_000;

/** `workshop_orders.title` — check до 80 символов. */
const MAX_TITLE_LENGTH = 80;

/** `buyer_name` в workshop_orders.client_name — check до 60 символов. */
const MAX_BUYER_LENGTH = 60;

/** `notes` — check до 1000 символов. */
const MAX_NOTES_LENGTH = 1000;

/** Подписи площадок в заголовке заказа: так же, как у старых вебхуков. */
const SOURCE_TITLES: Record<Marketplace, string> = {
  ozon: "Ozon",
  wb: "WB",
  yandex: "Яндекс",
};

/** Внутренняя ошибка обработки: причина важнее текста для HTTP-ответа. */
class ProcessingError extends Error {
  readonly reason: OrderProcessingFailureReason;

  constructor(reason: OrderProcessingFailureReason, message: string) {
    super(message);
    this.reason = reason;
  }
}

function failure(
  reason: OrderProcessingFailureReason,
  error: string,
): OrderProcessingFailure {
  return { ok: false, reason, error };
}

/** Ошибка PostgREST → fail-объект; отсутствие схемы узнаём по общему коду. */
function databaseFailure(
  error: { code?: string | null; message: string },
  fallback: OrderProcessingFailureReason,
  what: string,
): ProcessingError {
  const migrationMissing = isMissingTableSchema(error.code, error.message);

  return new ProcessingError(
    migrationMissing ? "migration_missing" : fallback,
    migrationMissing
      ? `${what}: в базе нет таблиц этапа 2. Примените supabase/workshop_farm_and_shop.sql.`
      : `${what}: ${error.message}`,
  );
}

/** Проверка ограничения workshop_orders_status_check до миграции unmapped. */
function isMissingUnmappedStatus(error: {
  code?: string | null;
  message: string;
}): boolean {
  return (
    error.code === "23514" &&
    /workshop_orders_status_check/i.test(error.message)
  );
}

/** Деньги: null — «неизвестно», отрицательное и мусор отклоняются. */
function normalizeAmount(
  value: unknown,
  what: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }

  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value.trim().replace(",", "."))
        : Number.NaN;

  if (!Number.isFinite(number) || number < 0) {
    return { ok: false, error: `${what}: ожидается неотрицательное число.` };
  }

  if (number > MAX_AMOUNT) {
    return {
      ok: false,
      error: `${what}: сумма больше ${MAX_AMOUNT.toLocaleString("ru-RU")} ₽.`,
    };
  }

  return { ok: true, value: Math.round(number * 100) / 100 };
}

/** Количество: целое от 1 до предела колонки; мусор отбрасывается. */
function normalizeQuantity(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number.NaN;

  if (!Number.isSafeInteger(number) || number <= 0) {
    return null;
  }

  return Math.min(MAX_QUANTITY, number);
}

/**
 * Состав заказа: убираем пустые строки, склеиваем одинаковые SKU.
 *
 * Позиции без SKU остаются отдельными: у Яндекса название товара не всегда
 * сопровождается артикулом, и терять такую строку нельзя — заказ всё равно
 * должен быть виден, пусть и со статусом unmapped.
 */
function normalizeItems(items: NormalizedOrderItem[]): NormalizedOrderItem[] {
  const bySku = new Map<string, NormalizedOrderItem>();
  const withoutSku: NormalizedOrderItem[] = [];

  for (const item of items) {
    const quantity = normalizeQuantity(item.quantity);

    if (quantity === null) {
      continue;
    }

    const sku =
      typeof item.sku === "string" && item.sku.trim()
        ? item.sku.trim().slice(0, 128)
        : null;
    const price =
      typeof item.price === "number" &&
      Number.isFinite(item.price) &&
      item.price >= 0
        ? Math.round(item.price * 100) / 100
        : null;

    if (!sku) {
      withoutSku.push({ sku: null, quantity, price });
      continue;
    }

    const existing = bySku.get(sku);

    if (existing) {
      existing.quantity = Math.min(
        MAX_QUANTITY,
        existing.quantity + quantity,
      );
      existing.price ??= price;
      continue;
    }

    bySku.set(sku, { sku, quantity, price });
  }

  return [...bySku.values(), ...withoutSku].slice(0, MAX_ITEMS);
}

/** Проверка и нормализация входа. Возвращает либо заказ, либо причину. */
function normalizeOrder(
  order: NormalizedOrder,
): { ok: true; value: NormalizedOrder } | OrderProcessingFailure {
  if (!isMarketplace(order.source)) {
    return failure("invalid_order", "Неизвестная площадка заказа.");
  }

  if (typeof order.marketplace_order_id !== "string") {
    return failure("invalid_order", "Не указан номер заказа площадки.");
  }

  const marketplaceOrderId = order.marketplace_order_id.trim();

  if (
    !marketplaceOrderId ||
    marketplaceOrderId.length > 128 ||
    /[\u0000-\u001f\u007f]/.test(marketplaceOrderId)
  ) {
    return failure("invalid_order", "Некорректный номер заказа площадки.");
  }

  const items = Array.isArray(order.items) ? normalizeItems(order.items) : [];

  if (items.length === 0) {
    return failure("invalid_order", "В заказе нет позиций с количеством.");
  }

  const total = normalizeAmount(order.total_amount, "Сумма заказа");

  if (!total.ok) {
    return failure("invalid_order", total.error);
  }

  const commission = normalizeAmount(
    order.marketplace_commission,
    "Комиссия площадки",
  );

  if (!commission.ok) {
    return failure("invalid_order", commission.error);
  }

  const buyerName =
    typeof order.buyer_name === "string"
      ? order.buyer_name
          .replace(/[\u0000-\u001f\u007f]/g, " ")
          .trim()
          .slice(0, MAX_BUYER_LENGTH)
      : "";

  return {
    ok: true,
    value: {
      marketplace_order_id: marketplaceOrderId,
      buyer_name: buyerName || null,
      items,
      total_amount: total.value,
      marketplace_commission: commission.value,
      source: order.source,
    },
  };
}

/** Заголовок заказа: префикс площадки плюс номер, обрезанный до 80 символов. */
export function buildMarketplaceOrderTitle(
  source: Marketplace,
  marketplaceOrderId: string,
): string {
  const prefix = `${SOURCE_TITLES[source]}: `;
  const limit = Math.max(0, MAX_TITLE_LENGTH - prefix.length);

  return `${prefix}${marketplaceOrderId.slice(0, limit)}`;
}

/**
 * Заметки: компактный состав заказа.
 *
 * Заказ с сотней длинных SKU не помещается в 1000 символов. Поэтому позиции
 * добавляются, пока помещаются, а остаток обозначается «…».
 */
function buildOrderNotes(items: NormalizedOrderItem[]): string {
  const parts: string[] = [];

  for (const item of items) {
    const line = `${item.sku ?? "без SKU"} × ${item.quantity}`;
    const candidate = [...parts, line].join(", ");

    if (candidate.length > MAX_NOTES_LENGTH - 1) {
      break;
    }

    parts.push(line);
  }

  const notes = parts.join(", ");

  return parts.length === items.length ? notes : `${notes}…`;
}

/** Связи SKU → товар этой мастерской и этой площадки. */
async function loadProductIds(
  supabase: Supabase,
  userId: string,
  source: Marketplace,
  skus: string[],
): Promise<Map<string, string>> {
  const productIds = new Map<string, string>();
  const unique = [...new Set(skus)];

  for (let index = 0; index < unique.length; index += LOOKUP_CHUNK) {
    const chunk = unique.slice(index, index + LOOKUP_CHUNK);
    const { data, error } = await supabase
      .from("workshop_marketplace_links")
      .select("sku, product_id")
      .eq("user_id", userId)
      .eq("marketplace", source)
      .in("sku", chunk);

    if (error) {
      throw databaseFailure(
        error,
        "read_failed",
        "Связи SKU не прочитаны",
      );
    }

    for (const row of (data ?? []) as {
      sku?: unknown;
      product_id?: unknown;
    }[]) {
      if (
        typeof row.sku === "string" &&
        typeof row.product_id === "string" &&
        isWorkshopUuid(row.product_id)
      ) {
        productIds.set(row.sku, row.product_id);
      }
    }
  }

  return productIds;
}

/** Позиции заказа из базы: id, SKU и текущая связь с товаром. */
async function loadOrderItems(
  supabase: Supabase,
  userId: string,
  orderId: string,
): Promise<{ id: string; sku: string | null; productId: string | null }[]> {
  const { data, error } = await supabase
    .from("workshop_order_items")
    .select("id, sku, product_id")
    .eq("user_id", userId)
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) {
    throw databaseFailure(error, "read_failed", "Позиции заказа не прочитаны");
  }

  return ((data ?? []) as {
    id?: unknown;
    sku?: unknown;
    product_id?: unknown;
  }[])
    .filter(
      (row): row is { id: string; sku: unknown; product_id: unknown } =>
        typeof row.id === "string",
    )
    .map((row) => ({
      id: row.id,
      sku: typeof row.sku === "string" ? row.sku : null,
      productId: typeof row.product_id === "string" ? row.product_id : null,
    }));
}

/** Что уходит в workshop_order_items. */
type OrderItemPayload = {
  user_id: string;
  order_id: string;
  product_id: string | null;
  sku: string | null;
  quantity: number;
};

function createItemPayloads(
  userId: string,
  orderId: string,
  items: NormalizedOrderItem[],
  productIds: Map<string, string>,
): OrderItemPayload[] {
  return items.map((item) => ({
    user_id: userId,
    order_id: orderId,
    product_id: item.sku ? (productIds.get(item.sku) ?? null) : null,
    sku: item.sku,
    quantity: item.quantity,
  }));
}

/** Сколько позиций получили товар и какие SKU остались без связи. */
function summarizeItems(
  items: NormalizedOrderItem[],
  productIds: Map<string, string>,
): { mappedItems: number; unmappedSkus: string[] } {
  const unmappedSkus = new Set<string>();
  let mappedItems = 0;

  for (const item of items) {
    if (item.sku && productIds.has(item.sku)) {
      mappedItems += 1;
    } else if (item.sku) {
      unmappedSkus.add(item.sku);
    }
  }

  return { mappedItems, unmappedSkus: [...unmappedSkus] };
}

/**
 * Доводит существующий unmapped-заказ после появления связи.
 *
 * Позиции получают product_id, а заказ переходит в new, когда товар есть у
 * каждой позиции. Позиции без SKU остаются null: связать их не с чем, заказ
 * остаётся в «Требуют внимания».
 */
async function relinkOrder(
  supabase: Supabase,
  userId: string,
  orderId: string,
  source: Marketplace,
): Promise<{
  status: OrderStatus;
  mappedItems: number;
  unmappedSkus: string[];
}> {
  const items = await loadOrderItems(supabase, userId, orderId);
  const skus = items
    .map((item) => item.sku)
    .filter((sku): sku is string => Boolean(sku));
  const productIds = await loadProductIds(supabase, userId, source, skus);
  let mappedItems = 0;
  const unmappedSkus: string[] = [];

  for (const item of items) {
    const productId = item.sku ? productIds.get(item.sku) : null;

    if (item.productId) {
      mappedItems += 1;
      continue;
    }

    if (!productId) {
      if (item.sku) {
        unmappedSkus.push(item.sku);
      }

      continue;
    }

    const { error } = await supabase
      .from("workshop_order_items")
      .update({ product_id: productId })
      .eq("id", item.id)
      .eq("user_id", userId);

    if (error) {
      throw databaseFailure(
        error,
        "write_failed",
        "Связь позиции не сохранена",
      );
    }

    mappedItems += 1;
  }

  const status: OrderStatus =
    items.length > 0 && mappedItems === items.length ? "new" : "unmapped";

  if (status === "new") {
    const { error } = await supabase
      .from("workshop_orders")
      .update({ status })
      .eq("id", orderId)
      .eq("user_id", userId);

    if (error) {
      throw databaseFailure(error, "write_failed", "Статус заказа не изменён");
    }
  }

  return { status, mappedItems, unmappedSkus };
}

/** Вставка позиций; при ошибке заказ удаляется, чтобы вебхук повторил его. */
async function insertItems(
  supabase: Supabase,
  orderId: string,
  payloads: OrderItemPayload[],
): Promise<void> {
  const { error } = await supabase
    .from("workshop_order_items")
    .insert(payloads);

  if (!error) {
    return;
  }

  await supabase.from("workshop_orders").delete().eq("id", orderId);

  throw databaseFailure(error, "write_failed", "Позиции заказа не сохранены");
}

/** Поиск заказа по номеру площадки: partial unique index этапа 1. */
async function findOrder(
  supabase: Supabase,
  userId: string,
  marketplaceOrderId: string,
): Promise<{ id: string; status: OrderStatus } | null> {
  const { data, error } = await supabase
    .from("workshop_orders")
    .select("id, status")
    .eq("user_id", userId)
    .eq("marketplace_order_id", marketplaceOrderId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw databaseFailure(error, "read_failed", "Заказ не прочитан");
  }

  if (!data || typeof data.id !== "string") {
    return null;
  }

  return {
    id: data.id,
    status: isOrderStatus(data.status) ? data.status : "new",
  };
}

/**
 * Обработка заказа площадки.
 *
 * Идемпотентность: заказ ищется по `(user_id, marketplace_order_id)` до
 * вставки. Повтор уведомления не создаёт вторую строку и не дублирует позиции.
 * Если заказ уже есть:
 *   - известные деньги обновляются только непустыми значениями (null не
 *     затирает сумму, которую прислали раньше);
 *   - пустой заказ без позиций дополняется (следствие сбоя между запросами);
 *   - unmapped-заказ пробует связать позиции заново.
 */
export async function processMarketplaceOrder(
  normalizedOrder: NormalizedOrder,
  userId: string,
  options: { supabase?: Supabase } = {},
): Promise<OrderProcessingResult> {
  if (!isWorkshopUuid(userId)) {
    return failure("invalid_user", "Неизвестный владелец мастерской.");
  }

  const normalized = normalizeOrder(normalizedOrder);

  if (!normalized.ok) {
    return normalized;
  }

  const order = normalized.value;

  let supabase: Supabase;

  if (options.supabase) {
    supabase = options.supabase;
  } else {
    try {
      supabase = createAdminClient();
    } catch (error) {
      return failure(
        "server_misconfigured",
        error instanceof Error
          ? error.message
          : "Не удалось создать service_role-клиент.",
      );
    }
  }

  try {
    const existing = await findOrder(
      supabase,
      userId,
      order.marketplace_order_id,
    );

    if (existing) {
      return await processExistingOrder(supabase, userId, order, existing);
    }

    const skus = order.items
      .map((item) => item.sku)
      .filter((sku): sku is string => Boolean(sku));
    const productIds = await loadProductIds(
      supabase,
      userId,
      order.source,
      skus,
    );
    const { mappedItems, unmappedSkus } = summarizeItems(
      order.items,
      productIds,
    );
    const status: OrderStatus =
      mappedItems === order.items.length ? "new" : "unmapped";
    const payload = {
      user_id: userId,
      source: order.source,
      title: buildMarketplaceOrderTitle(
        order.source,
        order.marketplace_order_id,
      ),
      status,
      client_name: order.buyer_name,
      notes: buildOrderNotes(order.items),
      marketplace_order_id: order.marketplace_order_id,
      total_amount: order.total_amount,
      marketplace_commission: order.marketplace_commission,
      total_cost: order.total_amount ?? 0,
    };

    const { data, error } = await supabase
      .from("workshop_orders")
      .insert(payload)
      .select("id, status")
      .single();

    if (error) {
      // Параллельный вебхук успел создать тот же заказ: считаем повтор.
      if (error.code === "23505") {
        const raced = await findOrder(
          supabase,
          userId,
          order.marketplace_order_id,
        );

        if (raced) {
          return await processExistingOrder(
            supabase,
            userId,
            order,
            raced,
          );
        }
      }

      if (isMissingUnmappedStatus(error)) {
        return failure(
          "migration_missing",
          "В базе нет статуса unmapped. Примените supabase/workshop_farm_and_shop.sql.",
        );
      }

      throw databaseFailure(error, "write_failed", "Заказ не создан");
    }

    if (!data || typeof data.id !== "string") {
      throw new ProcessingError(
        "write_failed",
        "Заказ не создан: база не вернула id.",
      );
    }

    await insertItems(
      supabase,
      data.id,
      createItemPayloads(userId, data.id, order.items, productIds),
    );

    return {
      ok: true,
      data: {
        orderId: data.id,
        orderStatus: isOrderStatus(data.status) ? data.status : status,
        outcome: "created",
        mappedItems,
        unmappedSkus,
      },
    };
  } catch (error) {
    if (error instanceof ProcessingError) {
      return failure(error.reason, error.message);
    }

    console.error("Заказ маркетплейса не обработан:", error);

    return failure("write_failed", "Не удалось обработать заказ.");
  }
}

/** Существующий заказ: деньги, восстановление позиций и повторный маппинг. */
async function processExistingOrder(
  supabase: Supabase,
  userId: string,
  order: NormalizedOrder,
  existing: { id: string; status: OrderStatus },
): Promise<OrderProcessingResult> {
  const updates: Record<string, number> = {};

  if (order.total_amount !== null) {
    updates.total_amount = order.total_amount;
    updates.total_cost = order.total_amount;
  }

  if (order.marketplace_commission !== null) {
    updates.marketplace_commission = order.marketplace_commission;
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from("workshop_orders")
      .update(updates)
      .eq("id", existing.id)
      .eq("user_id", userId);

    if (error) {
      throw databaseFailure(error, "write_failed", "Суммы заказа не обновлены");
    }
  }

  const items = await loadOrderItems(supabase, userId, existing.id);
  const skus = order.items
    .map((item) => item.sku)
    .filter((sku): sku is string => Boolean(sku));
  const productIds = await loadProductIds(
    supabase,
    userId,
    order.source,
    skus,
  );
  const summary = summarizeItems(order.items, productIds);

  // Заказ мог остаться без позиций, если прошлый запрос оборвался между
  // вставкой заказа и вставкой состава. Дополняем его тем же составом.
  if (items.length === 0) {
    await insertItems(
      supabase,
      existing.id,
      createItemPayloads(userId, existing.id, order.items, productIds),
    );

    const status: OrderStatus =
      summary.mappedItems === order.items.length ? "new" : "unmapped";

    if (status !== existing.status) {
      const { error } = await supabase
        .from("workshop_orders")
        .update({ status })
        .eq("id", existing.id)
        .eq("user_id", userId);

      if (error) {
        throw databaseFailure(error, "write_failed", "Статус заказа не изменён");
      }
    }

    return {
      ok: true,
      data: {
        orderId: existing.id,
        orderStatus: status,
        outcome: "updated",
        mappedItems: summary.mappedItems,
        unmappedSkus: summary.unmappedSkus,
      },
    };
  }

  if (existing.status === "unmapped") {
    const relinked = await relinkOrder(
      supabase,
      userId,
      existing.id,
      order.source,
    );

    return {
      ok: true,
      data: {
        orderId: existing.id,
        orderStatus: relinked.status,
        outcome: relinked.status === "new" ? "updated" : "unchanged",
        mappedItems: relinked.mappedItems,
        unmappedSkus: relinked.unmappedSkus,
      },
    };
  }

  return {
    ok: true,
    data: {
      orderId: existing.id,
      orderStatus: existing.status,
      outcome: "unchanged",
      mappedItems: items.filter((item) => item.productId).length,
      unmappedSkus: summary.unmappedSkus,
    },
  };
}

/**
 * Повторно связывает все unmapped-заказы мастерской после изменения связей.
 *
 * Вызывается Server Action после добавления или удаления связи. Клиент —
 * обычный (с cookies): RLS разрешает менять только свои заказы и позиции.
 */
export async function relinkUnmappedOrders(
  supabase: Supabase,
  userId: string,
): Promise<RelinkResult> {
  if (!isWorkshopUuid(userId)) {
    return { ordersChecked: 0, ordersReady: 0, itemsLinked: 0 };
  }

  const { data, error } = await supabase
    .from("workshop_orders")
    .select("id, source")
    .eq("user_id", userId)
    .eq("status", "unmapped")
    .order("created_at", { ascending: true });

  if (error) {
    throw databaseFailure(
      error,
      "read_failed",
      "Заказы без маппинга не прочитаны",
    );
  }

  let ordersChecked = 0;
  let ordersReady = 0;
  let itemsLinked = 0;

  for (const row of (data ?? []) as { id?: unknown; source?: unknown }[]) {
    if (typeof row.id !== "string" || !isMarketplace(row.source)) {
      continue;
    }

    ordersChecked += 1;

    const before = await loadOrderItems(supabase, userId, row.id);
    const linkedBefore = before.filter((item) => item.productId).length;
    const result = await relinkOrder(supabase, userId, row.id, row.source);

    itemsLinked += Math.max(0, result.mappedItems - linkedBefore);

    if (result.status === "new") {
      ordersReady += 1;
    }
  }

  return { ordersChecked, ordersReady, itemsLinked };
}
