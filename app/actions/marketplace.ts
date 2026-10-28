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
  type MarketplaceActionState,
} from "@/lib/workshop/marketplace";

const SESSION_EXPIRED =
  "Сессия истекла. Войдите снова, чтобы изменить связи.";
const PRO_REQUIRED =
  "Мастерская входит в пакет «Всё включено». Оформите доступ, чтобы связать SKU.";
const MIGRATION_MISSING =
  "Связи SKU пока не сохраняются: в базе нет workshop_marketplace_links. Примените supabase/workshop_farm_and_shop.sql.";
const INSERT_FAILED = "Не удалось сохранить связь. Попробуйте ещё раз.";
const DELETE_FAILED = "Не удалось удалить связь. Попробуйте ещё раз.";

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
 * Добавление связи «SKU площадки → товар».
 *
 * После записи все unmapped-заказы мастерской пробуют связаться заново: если
 * этот SKU был единственным неизвестным, заказ сам перейдёт в `new`. Ошибка
 * повторного связывания не отменяет сохранённую связь — она попадёт в
 * следующий заказ, а страница покажет заказ всё ещё требующим внимания.
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

  const { data: product, error: productError } = await supabase
    .from("workshop_products")
    .select("id")
    .eq("id", productId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (productError) {
    console.warn(
      "Товар для связи не прочитан:",
      productError.code,
      productError.message,
    );

    return {
      ok: false,
      error: isMissingTableSchema(productError.code, productError.message)
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

  const { error } = await supabase.from("workshop_marketplace_links").insert({
    user_id: user.id,
    marketplace,
    sku,
    product_id: productId,
  });

  if (error) {
    console.warn("Связь SKU не сохранена:", error.code, error.message);

    if (error.code === "23505") {
      return {
        ok: false,
        error: `SKU «${sku}» уже связан с товаром на этой площадке.`,
      };
    }

    return {
      ok: false,
      error: isMissingTableSchema(error.code, error.message)
        ? MIGRATION_MISSING
        : INSERT_FAILED,
    };
  }

  let message = `SKU «${sku}» связан с товаром.`;

  try {
    const relinked = await relinkUnmappedOrders(supabase, user.id);

    if (relinked.ordersReady > 0) {
      message += ` Заказов вернулось в работу: ${relinked.ordersReady}.`;
    }
  } catch (relinkError) {
    console.warn(
      "Связь сохранена, но unmapped-заказы не обновлены:",
      relinkError,
    );
  }

  revalidateMarketplace();

  return { ok: true, message };
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
