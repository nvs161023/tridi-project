/**
 * Интеграционный тест обработки заказов маркетплейсов (этап 2).
 *
 * Что проверяет на живой базе:
 *   1. заказ, у которого все SKU связаны, создаётся со статусом new и
 *      привязкой позиции к товару;
 *   2. деньги площадки (total_amount, commission, total_cost) сохраняются;
 *   3. заказ с неизвестным SKU получает статус unmapped и позицию без товара;
 *   4. повторное уведомление не создаёт дубль заказа и позиции;
 *   5. после добавления связи relinkUnmappedOrders переводит заказ в new.
 *
 * Тест создаёт одного пользователя, товар, связь SKU и заказы, а в finally
 * удаляет пользователя — каскад auth.users уносит все строки.
 *
 * Запуск:
 *   node --import ./scripts/register-alias.mjs scripts/test-order-processor.ts
 *
 * Перед запуском примените supabase/workshop_farm_and_shop.sql. Если статуса
 * unmapped ещё нет, тест завершается кодом 2 и подсказывает файл миграции.
 */
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  processMarketplaceOrder,
  relinkUnmappedOrders,
  type NormalizedOrder,
} from "../lib/order-processor";

const ROOT = path.resolve(import.meta.dirname, "..");

let failures = 0;

function check(name: string, ok: boolean, details: string) {
  console.log(`${ok ? "✓" : "✗"} ${name} — ${details}`);

  if (!ok) {
    failures += 1;
  }
}

/** Читает .env.local: ключ=значение, кавычки снимаются. */
function readEnv(file: string): Record<string, string> {
  const full = path.join(ROOT, file);

  if (!fs.existsSync(full)) {
    return {};
  }

  const env: Record<string, string> = {};

  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");

    if (index <= 0) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

const localEnv = readEnv(".env.local");
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? localEnv.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? localEnv.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  console.error(
    "Нет NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY или SUPABASE_SERVICE_ROLE_KEY в .env.local.",
  );
  process.exit(1);
}

process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anonKey;
process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;

const admin = createSupabaseClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Row = Record<string, unknown>;

function throwIfError(error: { message: string } | null, what: string) {
  if (error) {
    throw new Error(`${what}: ${error.message}`);
  }
}

function requireText(data: unknown, key: string, what: string): string {
  const row: Row | null =
    typeof data === "object" && data !== null ? (data as Row) : null;
  const value = row?.[key];

  if (typeof value !== "string" || !value) {
    throw new Error(`${what}: база не вернула поле ${key}.`);
  }

  return value;
}

/** Создаёт подтверждённого пользователя; заказы пишем service_role. */
async function createTestUser(email: string, password: string): Promise<string> {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  throwIfError(created.error, `createUser ${email}`);

  if (!created.data.user) {
    throw new Error(`createUser ${email}: нет пользователя в ответе.`);
  }

  return created.data.user.id;
}

/** Читает заказ по номеру площадки; null — заказа нет. */
async function findOrder(
  supabase: SupabaseClient,
  userId: string,
  marketplaceOrderId: string,
): Promise<Row | null> {
  const { data, error } = await supabase
    .from("workshop_orders")
    .select(
      "id, title, status, source, client_name, total_cost, total_amount, marketplace_commission, marketplace_order_id",
    )
    .eq("user_id", userId)
    .eq("marketplace_order_id", marketplaceOrderId)
    .maybeSingle();

  throwIfError(error, `order ${marketplaceOrderId}`);

  return (data ?? null) as Row | null;
}

/** Позиции заказа: id, sku, quantity, product_id. */
async function readItems(
  supabase: SupabaseClient,
  userId: string,
  orderId: string,
): Promise<Row[]> {
  const { data, error } = await supabase
    .from("workshop_order_items")
    .select("id, sku, quantity, product_id")
    .eq("user_id", userId)
    .eq("order_id", orderId);

  throwIfError(error, `items ${orderId}`);

  return (data ?? []) as Row[];
}

/** Число из PostgREST: numeric приходит строкой. */
function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const number = Number(value);

    return Number.isFinite(number) ? number : null;
  }

  return null;
}

/** Особый случай: миграция статуса unmapped ещё не применена. */
class MigrationMissingError extends Error {}

async function main(): Promise<void> {
  const suffix = randomBytes(6).toString("hex");
  const email = `order-processor-${suffix}@example.com`;
  const password = `Test-${suffix}-pass`;
  let userId: string | null = null;
  let migrationMissing = false;

  try {
    userId = await createTestUser(email, password);

    const productResult = await admin
      .from("workshop_products")
      .insert({
        user_id: userId,
        sku: `PRD-${suffix}`,
        title: "Тестовая ваза",
        price: 1000,
        gcode_url: "https://example.com/test-vase.gcode",
      })
      .select("id")
      .single();

    throwIfError(productResult.error, "product insert");

    const productId = requireText(productResult.data, "id", "product insert");

    const linkResult = await admin.from("workshop_marketplace_links").insert({
      user_id: userId,
      marketplace: "ozon",
      sku: "TEST-SKU-1",
      product_id: productId,
    });

    throwIfError(linkResult.error, "marketplace link insert");

    const mappedOrder: NormalizedOrder = {
      marketplace_order_id: `TEST-ORDER-1-${suffix}`,
      buyer_name: "Иван Петров",
      items: [{ sku: "TEST-SKU-1", quantity: 2, price: 750 }],
      total_amount: 1500,
      marketplace_commission: 225,
      source: "ozon",
    };

    const first = await processMarketplaceOrder(mappedOrder, userId, {
      supabase: admin,
    });

    check(
      "Связанный SKU создаёт заказ new",
      first.ok &&
        first.data.outcome === "created" &&
        first.data.orderStatus === "new",
      first.ok
        ? `status=${first.data.orderStatus}, mapped=${first.data.mappedItems}`
        : `${first.reason}: ${first.error}`,
    );

    if (!first.ok) {
      throw new Error(
        `Первый заказ не создан: ${first.reason} — ${first.error}`,
      );
    }

    const firstOrder = await findOrder(
      admin,
      userId,
      mappedOrder.marketplace_order_id,
    );

    check(
      "Деньги и клиент записаны",
      Boolean(firstOrder) &&
        readNumber(firstOrder?.total_amount) === 1500 &&
        readNumber(firstOrder?.marketplace_commission) === 225 &&
        readNumber(firstOrder?.total_cost) === 1500 &&
        firstOrder?.client_name === "Иван Петров",
      JSON.stringify({
        total_amount: firstOrder?.total_amount,
        commission: firstOrder?.marketplace_commission,
        total_cost: firstOrder?.total_cost,
        client: firstOrder?.client_name,
      }),
    );

    const firstItems = firstOrder
      ? await readItems(admin, userId, String(firstOrder.id))
      : [];

    check(
      "Позиция привязана к товару",
      firstItems.length === 1 &&
        firstItems[0]?.product_id === productId &&
        firstItems[0]?.sku === "TEST-SKU-1" &&
        Number(firstItems[0]?.quantity) === 2,
      JSON.stringify(
        firstItems.map((item) => ({
          sku: item.sku,
          quantity: item.quantity,
          product_id: item.product_id,
        })),
      ),
    );

    const unmappedOrder: NormalizedOrder = {
      marketplace_order_id: `TEST-ORDER-2-${suffix}`,
      buyer_name: null,
      items: [{ sku: "TEST-SKU-2", quantity: 1, price: 990 }],
      total_amount: 990,
      marketplace_commission: null,
      source: "ozon",
    };

    const second = await processMarketplaceOrder(unmappedOrder, userId, {
      supabase: admin,
    });

    if (!second.ok && second.reason === "migration_missing") {
      throw new MigrationMissingError(second.error);
    }

    check(
      "Неизвестный SKU создаёт unmapped",
      second.ok &&
        second.data.outcome === "created" &&
        second.data.orderStatus === "unmapped" &&
        second.data.unmappedSkus.includes("TEST-SKU-2"),
      second.ok
        ? `status=${second.data.orderStatus}, unmapped=${second.data.unmappedSkus.join(",")}`
        : `${second.reason}: ${second.error}`,
    );

    if (!second.ok) {
      throw new Error(
        `Второй заказ не создан: ${second.reason} — ${second.error}`,
      );
    }

    const secondOrder = await findOrder(
      admin,
      userId,
      unmappedOrder.marketplace_order_id,
    );
    const secondItems = secondOrder
      ? await readItems(admin, userId, String(secondOrder.id))
      : [];

    check(
      "Позиция unmapped сохраняет SKU без товара",
      Boolean(secondOrder) &&
        secondOrder?.status === "unmapped" &&
        secondItems.length === 1 &&
        secondItems[0]?.product_id === null &&
        secondItems[0]?.sku === "TEST-SKU-2",
      JSON.stringify({
        status: secondOrder?.status,
        sku: secondItems[0]?.sku,
        product_id: secondItems[0]?.product_id,
      }),
    );

    const repeat = await processMarketplaceOrder(mappedOrder, userId, {
      supabase: admin,
    });

    check(
      "Повтор заказа идемпотентен",
      repeat.ok &&
        repeat.data.orderId === first.data.orderId &&
        repeat.data.outcome === "unchanged",
      repeat.ok
        ? `outcome=${repeat.data.outcome}, order=${repeat.data.orderId}`
        : `${repeat.reason}: ${repeat.error}`,
    );

    const { data: duplicates, error: duplicateError } = await admin
      .from("workshop_orders")
      .select("id")
      .eq("user_id", userId)
      .eq("marketplace_order_id", mappedOrder.marketplace_order_id);

    throwIfError(duplicateError, "duplicate order check");

    const repeatedItems = await readItems(admin, userId, first.data.orderId);

    check(
      "Дублей заказа и позиций нет",
      (duplicates ?? []).length === 1 && repeatedItems.length === 1,
      `orders=${(duplicates ?? []).length}, items=${repeatedItems.length}`,
    );

    const secondLink = await admin.from("workshop_marketplace_links").insert({
      user_id: userId,
      marketplace: "ozon",
      sku: "TEST-SKU-2",
      product_id: productId,
    });

    throwIfError(secondLink.error, "second marketplace link insert");

    const relinked = await relinkUnmappedOrders(admin, userId);
    const repairedOrder = await findOrder(
      admin,
      userId,
      unmappedOrder.marketplace_order_id,
    );
    const repairedItems = repairedOrder
      ? await readItems(admin, userId, String(repairedOrder.id))
      : [];

    check(
      "Связь возвращает unmapped-заказ в new",
      relinked.ordersReady >= 1 &&
        repairedOrder?.status === "new" &&
        repairedItems[0]?.product_id === productId,
      JSON.stringify({
        ordersReady: relinked.ordersReady,
        itemsLinked: relinked.itemsLinked,
        status: repairedOrder?.status,
        product_id: repairedItems[0]?.product_id,
      }),
    );

    const noMoney: NormalizedOrder = {
      marketplace_order_id: `TEST-ORDER-3-${suffix}`,
      buyer_name: null,
      items: [{ sku: "TEST-SKU-1", quantity: 1, price: null }],
      total_amount: null,
      marketplace_commission: null,
      source: "ozon",
    };
    const third = await processMarketplaceOrder(noMoney, userId, {
      supabase: admin,
    });
    const thirdOrder = await findOrder(
      admin,
      userId,
      noMoney.marketplace_order_id,
    );

    check(
      "Неизвестные деньги остаются null",
      third.ok &&
        Boolean(thirdOrder) &&
        thirdOrder?.total_amount === null &&
        thirdOrder?.marketplace_commission === null,
      JSON.stringify({
        ok: third.ok,
        total_amount: thirdOrder?.total_amount,
        commission: thirdOrder?.marketplace_commission,
      }),
    );

    const invalid = await processMarketplaceOrder(
      { ...noMoney, marketplace_order_id: `TEST-EMPTY-${suffix}`, items: [] },
      userId,
      { supabase: admin },
    );

    check(
      "Заказ без позиций отклоняется",
      !invalid.ok && invalid.reason === "invalid_order",
      invalid.ok ? "создан" : invalid.reason,
    );

    const isolation = await processMarketplaceOrder(
      {
        ...mappedOrder,
        marketplace_order_id: `TEST-WB-${suffix}`,
        source: "wb",
      },
      userId,
      { supabase: admin },
    );

    check(
      "Связь Ozon не подходит заказу WB",
      isolation.ok && isolation.data.orderStatus === "unmapped",
      isolation.ok
        ? `status=${isolation.data.orderStatus}`
        : `${isolation.reason}: ${isolation.error}`,
    );
  } catch (error) {
    if (error instanceof MigrationMissingError) {
      migrationMissing = true;
      console.error("\nСхема не готова:", error.message);
      console.error(
        "Примените supabase/workshop_farm_and_shop.sql и повторите тест.",
      );
    } else {
      failures += 1;
      console.error(
        "✗ Тест остановлен:",
        error instanceof Error ? error.message : error,
      );
    }
  } finally {
    if (userId) {
      const removed = await admin.auth.admin.deleteUser(userId);

      if (removed.error) {
        console.error("Тестовый пользователь не удалён:", removed.error.message);
        failures += 1;
      }
    }
  }

  if (migrationMissing) {
    console.log("\nТест остановлен до применения миграции unmapped.");
  } else {
    console.log(
      failures === 0 ? "\nВсе проверки пройдены." : `\nПровалов: ${failures}.`,
    );
  }

  process.exitCode = migrationMissing ? 2 : failures > 0 ? 1 : 0;
}

void main();
