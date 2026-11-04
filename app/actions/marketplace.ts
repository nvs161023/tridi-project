"use server";

import { revalidatePath } from "next/cache";

import {
  isMarketplace,
  isWorkshopUuid,
} from "@/lib/db/workshop-types";
import { relinkUnmappedOrders } from "@/lib/order-processor";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import { createClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";
import {
  MARKETPLACE_LINK_LIMITS,
  isMarketplaceLinkId,
  type Marketplace,
  type MarketplaceActionState,
  type MarketplaceLink,
} from "@/lib/workshop/marketplace";
import { getProductMarketplaceLinks } from "@/lib/workshop/marketplace-store";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const SESSION_EXPIRED =
  "Сессия истекла. Войдите снова, чтобы изменить связи.";
const PRO_REQUIRED =
  "Мастерская входит в пакет «Всё включено». Оформите доступ, чтобы связать SKU.";
const MIGRATION_MISSING =
  "Связи SKU пока не сохраняются: в базе нет workshop_marketplace_links. Примените supabase/workshop_farm_and_shop.sql.";
const INSERT_FAILED = "Не удалось сохранить связь. Попробуйте ещё раз.";
const DELETE_FAILED = "Не удалось удалить связь. Попробуйте ещё раз.";
const ITEM_NOT_FOUND = "Позиция не найдена — возможно, её уже удалили. Обновите страницу.";
const ITEMS_MIGRATION_MISSING =
  "Позиции заказов пока не читаются: примените supabase/workshop_farm_and_shop.sql.";
const ORDER_NOT_FOUND =
  "Заказ не найден — возможно, его уже удалили. Обновите страницу.";
const ORDER_READ_FAILED = "Не удалось прочитать заказ. Попробуйте ещё раз.";


function readText(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

/** Обновляет страницы, где видны связи, заказы и каталог. */
function revalidateMarketplace() {
  revalidatePath("/dashboard/workshop");
  revalidatePath("/dashboard/workshop/products");
  revalidatePath("/dashboard/workshop/marketplace");
}

/**
 * Товар принадлежит этой мастерской.
 *
 * null — проверка пройдена. Свободный uuid от клиента не даст связать чужую
 * карточку, поэтому проверка идёт до вставки связи.
 */
async function checkOwnProduct(
  supabase: Supabase,
  userId: string,
  productId: string,
): Promise<MarketplaceActionState | null> {
  const { data: product, error } = await supabase
    .from("workshop_products")
    .select("id")
    .eq("id", productId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Товар для связи не прочитан:", error.code, error.message);

    return {
      ok: false,
      error: isMissingTableSchema(error.code, error.message)
        ? "Каталог пока не настроен: примените supabase/workshop_products.sql."
        : INSERT_FAILED,
    };
  }

  if (!product) {
    return {
      ok: false,
      error: "Товар не найден — возможно, его удалили. Обновите страницу.",
    };
  }

  return null;
}

/**
 * Запись связи «площадка + SKU → товар».
 *
 * null — связь сохранена. Вставку делает не только форма страницы
 * «Маркетплейсы», но и карточка unmapped-заказа, поэтому ошибки уникальности и
 * отсутствующей таблицы объясняются в одном месте.
 */
async function insertMarketplaceLink(
  supabase: Supabase,
  userId: string,
  link: { marketplace: Marketplace; sku: string; productId: string },
): Promise<MarketplaceActionState | null> {
  const { error } = await supabase.from("workshop_marketplace_links").insert({
    user_id: userId,
    marketplace: link.marketplace,
    sku: link.sku,
    product_id: link.productId,
  });

  if (!error) {
    return null;
  }

  console.warn("Связь SKU не сохранена:", error.code, error.message);

  if (error.code === "23505") {
    return {
      ok: false,
      error: `SKU «${link.sku}» уже связан с товаром на этой площадке.`,
    };
  }

  return {
    ok: false,
    error: isMissingTableSchema(error.code, error.message)
      ? MIGRATION_MISSING
      : INSERT_FAILED,
  };
}

/**
 * Повторное связывание unmapped-заказов после новой связи.
 *
 * Ошибка пересчёта не отменяет сохранённую связь — она попадёт в следующий
 * заказ, а страница покажет заказ всё ещё требующим внимания. Поэтому сбой
 * только пишется в журнал, а мастер получает сообщение об успешной записи.
 */
async function relinkAfterLink(
  supabase: Supabase,
  userId: string,
  message: string,
): Promise<string> {
  try {
    const relinked = await relinkUnmappedOrders(supabase, userId);

    if (relinked.ordersReady > 0) {
      return `${message} Заказов вернулось в работу: ${relinked.ordersReady}.`;
    }
  } catch (relinkError) {
    console.warn(
      "Связь сохранена, но unmapped-заказы не обновлены:",
      relinkError,
    );
  }

  return message;
}

/**
 * Добавление связи «SKU площадки → товар».
 *
 * После записи все unmapped-заказы мастерской пробуют связаться заново: если
 * этот SKU был единственным неизвестным, заказ сам перейдёт в `new`.
 */
export async function addMarketplaceLink(
  formData: FormData,
): Promise<MarketplaceActionState> {
  const marketplace = readText(formData, "marketplace");
  const sku = readText(formData, "sku");
  const productId = readText(formData, "productId");

  if (!isMarketplace(marketplace)) {
    return { ok: false, error: "Выберите площадку." };
  }

  if (!sku) {
    return { ok: false, error: "Введите SKU площадки." };
  }

  if (sku.length > MARKETPLACE_LINK_LIMITS.sku) {
    return {
      ok: false,
      error: `SKU длиннее ${MARKETPLACE_LINK_LIMITS.sku} символов.`,
    };
  }

  if (!isWorkshopUuid(productId)) {
    return { ok: false, error: "Выберите товар из каталога." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: SESSION_EXPIRED };
  }

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return { ok: false, error: PRO_REQUIRED };
  }

  const productCheck = await checkOwnProduct(supabase, user.id, productId);

  if (productCheck) {
    return productCheck;
  }

  const insertError = await insertMarketplaceLink(supabase, user.id, {
    marketplace,
    sku,
    productId,
  });

  if (insertError) {
    return insertError;
  }

  const message = await relinkAfterLink(
    supabase,
    user.id,
    `SKU «${sku}» связан с товаром.`,
  );

  revalidateMarketplace();

  return { ok: true, message };
}

/**
 * Связи одного товара для карточки каталога.
 *
 * Тонкая граница Server Action над `getProductMarketplaceLinks`: клиентский
 * компонент не может импортировать модуль чтения — тот тянет серверный клиент
 * Supabase и cookies. Пустой список при ошибке: блок связей просто скажет, что
 * связей нет.
 */
export async function getMarketplaceLinks(
  productId: string,
): Promise<MarketplaceLink[]> {
  if (!isWorkshopUuid(productId)) {
    return [];
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  return getProductMarketplaceLinks(supabase, user.id, productId);
}

/**
 * Удаление связи.
 *
 * Уже созданные позиции сохраняют product_id: это снимок решения на момент
 * заказа. Удаление влияет только на будущие заказы и на ручной список связей.
 */
export async function deleteMarketplaceLink(
  linkId: string,
): Promise<MarketplaceActionState> {
  if (!isMarketplaceLinkId(linkId)) {
    return { ok: false, error: "Связь не найдена — обновите страницу." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: SESSION_EXPIRED };
  }

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return { ok: false, error: PRO_REQUIRED };
  }

  const { data, error } = await supabase
    .from("workshop_marketplace_links")
    .delete()
    .eq("id", linkId)
    .eq("user_id", user.id)
    .select("id");

  if (error) {
    console.warn("Связь SKU не удалена:", error.code, error.message);

    return {
      ok: false,
      error: isMissingTableSchema(error.code, error.message)
        ? MIGRATION_MISSING
        : DELETE_FAILED,
    };
  }

  if (!data || data.length === 0) {
    return { ok: false, error: "Связь не найдена — возможно, её уже удалили." };
  }

  revalidateMarketplace();

  return { ok: true, message: "Связь удалена." };
}

/**
 * Связь SKU из карточки unmapped-заказа.
 *
 * Мастер выбирает товар прямо у позиции: площадка и артикул уже известны из
 * строки заказа, поэтому форма не нужна. После записи связи заказы
 * пересчитываются тем же `relinkUnmappedOrders`: когда товар есть у каждой
 * позиции, заказ сам переходит в «Новые».
 */
export async function linkUnmappedOrderItem(
  itemId: string,
  productId: string,
): Promise<MarketplaceActionState> {
  if (!isWorkshopUuid(itemId)) {
    return { ok: false, error: ITEM_NOT_FOUND };
  }

  if (!isWorkshopUuid(productId)) {
    return { ok: false, error: "Выберите товар из каталога." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: SESSION_EXPIRED };
  }

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return { ok: false, error: PRO_REQUIRED };
  }

  const { data: itemRow, error: itemError } = await supabase
    .from("workshop_order_items")
    .select("sku, order_id")
    .eq("id", itemId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (itemError) {
    console.warn(
      "Позиция заказа не прочитана:",
      itemError.code,
      itemError.message,
    );

    return {
      ok: false,
      error: isMissingTableSchema(itemError.code, itemError.message)
        ? ITEMS_MIGRATION_MISSING
        : INSERT_FAILED,
    };
  }

  if (!itemRow) {
    return { ok: false, error: ITEM_NOT_FOUND };
  }

  const item = itemRow as Partial<Record<string, unknown>>;
  const sku = typeof item.sku === "string" ? item.sku.trim() : "";

  if (!sku) {
    return {
      ok: false,
      error:
        "У позиции нет артикула — связать её нельзя. Добавьте SKU в карточке товара вручную.",
    };
  }

  const orderId = item.order_id;

  if (!isWorkshopUuid(orderId)) {
    return { ok: false, error: ITEM_NOT_FOUND };
  }

  const { data: orderRow, error: orderError } = await supabase
    .from("workshop_orders")
    .select("source")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (orderError) {
    console.warn(
      "Заказ позиции не прочитан:",
      orderError.code,
      orderError.message,
    );

    return { ok: false, error: ORDER_READ_FAILED };
  }

  if (!orderRow) {
    return { ok: false, error: ORDER_NOT_FOUND };
  }

  const source = (orderRow as Partial<Record<string, unknown>>).source;

  if (!isMarketplace(source)) {
    return {
      ok: false,
      error: "У заказа не указана площадка — свяжите SKU в карточке товара.",
    };
  }

  const productCheck = await checkOwnProduct(supabase, user.id, productId);

  if (productCheck) {
    return productCheck;
  }

  const insertError = await insertMarketplaceLink(supabase, user.id, {
    marketplace: source,
    sku,
    productId,
  });

  if (insertError) {
    return insertError;
  }

  const message = await relinkAfterLink(
    supabase,
    user.id,
    `SKU «${sku}» связан с товаром.`,
  );

  revalidateMarketplace();

  return { ok: true, message };
}

