/**
 * End-to-end тест: вебхуки площадок на живых товарах мастерской.
 *
 * Что проверяет на боевой базе `.env.local` и запущенном сервере:
 *   1. связи «SKU площадки → товар» находят реальные товары владельца
 *      (артикулы `01`…`04`) через `workshop_marketplace_links`;
 *   2. вебхук Ozon (`TYPE_NEW_POSTING`) создаёт заказ `OZ-001` со статусом new,
 *      привязкой позиции к товару `01` и суммой 3040 ₽;
 *   3. вебхук WB массивом (`[{ id, skus, price }]`) создаёт заказ
 *      `WB: 12345678` со статусом new, привязкой к товару `02` и суммой 1499,97 ₽;
 *   4. вебхук Яндекса (`ORDER_CREATED`, артикул в `offerId`) создаёт заказ
 *      `YA-001` со статусом new и привязкой к товару `03`;
 *   5. неизвестный SKU даёт статус unmapped и позицию без товара (`OZ-002`);
 *   6. товар `04` остаётся без связи — на нём видно, что связи не появляются
 *      сами.
 *
 * Запуск (нужен сервер на 3000: вебхуки принимает он, а не скрипт):
 *   npm start
 *   node --import ./scripts/register-alias.mjs scripts/test-marketplace-orders.ts
 *
 * Скрипт пишет в боевую базу: создаёт три связи и четыре заказа от имени
 * владельца товаров. В конце, в том числе после ошибки, удаляет только
 * тестовые заказы и тестовые связи — товары `01`…`04` остаются. Переменная
 * `KEEP_MARKETPLACE_TEST_DATA=1` оставляет данные для проверки глазами.
 */
import fs from "node:fs";
import path from "node:path";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const ROOT = path.resolve(import.meta.dirname, "..");

/** Куда стучаться вебхуками: сервер приложения, а не база. */
const BASE_URL = (
  process.env.MARKETPLACE_TEST_BASE_URL ?? "http://localhost:3000"
).replace(/\/+$/u, "");

/** Оставить данные после теста: так их видно в интерфейсе мастерской. */
const KEEP_DATA = process.env.KEEP_MARKETPLACE_TEST_DATA === "1";

/** Артикулы товаров, на которых проверяется связка. */
const PRODUCT_SKUS = ["01", "02", "03", "04"] as const;

/** Товар, который остаётся без связи: на нём проверяется unmapped. */
const UNLINKED_SKU = "04";

/** Связи, которые создаёт тест: площадка, артикул площадки, артикул товара. */
const TEST_LINKS = [
  { marketplace: "ozon", sku: "SKU-OZON-01", productSku: "01" },
  { marketplace: "wb", sku: "SKU-WB-02", productSku: "02" },
  { marketplace: "yandex", sku: "SKU-YANDEX-03", productSku: "03" },
] as const;

/** `marketplace_order_id` тестовых заказов — по ним же идёт уборка. */
const TEST_ORDER_IDS = ["OZ-001", "12345678", "YA-001", "OZ-002"] as const;

/**
 * Заказ Ozon.
 *
 * `message_type` в теле обязателен: без него роут считает уведомление чужим
 * событием и подтверждает его, не создавая заказ. Ozon всегда присылает тип,
 * поэтому в тесте он тоже есть.
 */
const OZON_ORDER = {
  message_type: "TYPE_NEW_POSTING",
  posting_number: "OZ-001",
  products: [{ sku: "SKU-OZON-01", quantity: 2, price: "1520.00" }],
};

/** Заказ Ozon с незнакомым артикулом: ожидаем unmapped. */
const OZON_UNKNOWN = {
  message_type: "TYPE_NEW_POSTING",
  posting_number: "OZ-002",
  products: [{ sku: "SKU-UNKNOWN", quantity: 1, price: "500.00" }],
};

/** Заказ WB в старом формате: массив из одного заказа. */
const WB_ORDER = [{ id: 12345678, skus: ["SKU-WB-02"], price: 149997 }];

/** Заказ Яндекса: артикул лежит в `offerId`, количество — в `count`. */
const YANDEX_ORDER = {
  eventType: "ORDER_CREATED",
  orderId: "YA-001",
  items: [{ offerId: "SKU-YANDEX-03", count: 1, price: 2000 }],
};

type Row = Record<string, unknown>;

let failures = 0;

function check(name: string, ok: boolean, details: unknown) {
  const text = typeof details === "string" ? details : JSON.stringify(details);

  console.log(`${ok ? "✓" : "✗"} ${name} — ${text}`);

  if (!ok) {
    failures += 1;
  }
}

/** Читает .env.local: ключ=значение, кавычки снимаются. */
function readEnv(file: string): Record<string, string> {
  const full = path.join(ROOT, file);
  const env: Record<string, string> = {};

  if (!fs.existsSync(full)) {
    return env;
  }

  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");

    if (index <= 0) {
      continue;
    }

    let value = trimmed.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[trimmed.slice(0, index).trim()] = value;
  }

  return env;
}

const localEnv = readEnv(".env.local");
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? localEnv.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? localEnv.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  console.error(
    "Нет NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY или SUPABASE_SERVICE_ROLE_KEY в .env.local.",
  );
  process.exit(1);
}

const admin: SupabaseClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Сервер приложения должен быть жив: вебхуки принимает он. */
async function serverIsUp(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/webhooks/ozon`, {
      signal: AbortSignal.timeout(5_000),
    });

    return response.ok;
  } catch {
    return false;
  }
}

/** POST вебхука: тело — то, что прислала бы площадка. */
async function postWebhook(
  marketplace: string,
  token: string,
  body: unknown,
): Promise<{ status: number; text: string }> {
  const response = await fetch(
    `${BASE_URL}/api/webhooks/${marketplace}?token=${token}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    },
  );

  return { status: response.status, text: await response.text() };
}

/**
 * Товары `01`…`04` одного владельца.
 *
 * Связи и заказы принадлежат одному пользователю, поэтому нужен тот, у кого
 * есть все четыре товара: иначе заказ искал бы SKU в чужом каталоге.
 */
async function findProducts(): Promise<{
  userId: string;
  bySku: Map<string, Row>;
} | null> {
  const { data, error } = await admin
    .from("workshop_products")
    .select("id, user_id, sku, title")
    .in("sku", [...PRODUCT_SKUS]);

  if (error) {
    console.error("Товары не прочитаны:", error.message);

    return null;
  }

  const rows = ((data ?? []) as Row[]).filter(
    (row) => typeof row.sku === "string",
  );
  const byUser = new Map<string, Map<string, Row>>();

  for (const row of rows) {
    const userId = String(row.user_id);
    const bySku = byUser.get(userId) ?? new Map<string, Row>();

    byUser.set(userId, bySku);

    if (!bySku.has(String(row.sku))) {
      bySku.set(String(row.sku), row);
    }
  }

  for (const [userId, bySku] of byUser) {
    if (PRODUCT_SKUS.every((sku) => bySku.has(sku))) {
      return { userId, bySku };
    }
  }

  return null;
}

/** Персональный адрес вебхука владельца из `workshop_settings`. */
async function readWebhookToken(userId: string): Promise<string | null> {
  const { data, error } = await admin
    .from("workshop_settings")
    .select("webhook_token")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Настройки мастерской не прочитаны:", error.message);

    return null;
  }

  const token = (data as Row | null)?.webhook_token;

  return typeof token === "string" && token ? token : null;
}

/** Заказы по номерам площадок: по ним же убираем тестовые строки. */
async function findOrders(userId: string): Promise<Row[]> {
  const { data, error } = await admin
    .from("workshop_orders")
    .select("id, title, status, source, total_cost, marketplace_order_id")
    .eq("user_id", userId)
    .in("marketplace_order_id", [...TEST_ORDER_IDS]);

  if (error) {
    console.error("Заказы не прочитаны:", error.message);

    return [];
  }

  return (data ?? []) as Row[];
}

async function findOrder(userId: string, orderId: string): Promise<Row | null> {
  const { data, error } = await admin
    .from("workshop_orders")
    .select("id, title, status, source, total_cost, total_amount")
    .eq("user_id", userId)
    .eq("marketplace_order_id", orderId)
    .maybeSingle();

  if (error) {
    console.error(`Заказ ${orderId} не прочитан:`, error.message);

    return null;
  }

  return (data as Row | null) ?? null;
}

async function findItems(orderId: string): Promise<Row[]> {
  const { data, error } = await admin
    .from("workshop_order_items")
    .select("product_id, sku, quantity")
    .eq("order_id", orderId);

  if (error) {
    console.error("Позиции заказа не прочитаны:", error.message);

    return [];
  }

  return (data ?? []) as Row[];
}

/**
 * Уборка тестовых данных.
 *
 * Удаляются только заказы с номерами из `TEST_ORDER_IDS` и связи с артикулами
 * из `TEST_LINKS`: товары `01`…`04` и всё остальное в мастерской остаются.
 * Позиции уходят вместе с заказом (каскад в схеме), но удаляем их явно —
 * уборка не должна зависеть от схемы конкретной базы.
 */
async function cleanup(
  userId: string,
): Promise<{ orders: number; links: number }> {
  const orders = await findOrders(userId);
  const orderIds = orders.map((order) => String(order.id));

  if (orderIds.length > 0) {
    const removedItems = await admin
      .from("workshop_order_items")
      .delete()
      .in("order_id", orderIds);

    if (removedItems.error) {
      console.error("Позиции тестовых заказов не удалены:", removedItems.error.message);
    }
  }

  const removedOrders =
    orderIds.length === 0
      ? { error: null, count: 0 }
      : await admin
          .from("workshop_orders")
          .delete({ count: "exact" })
          .in("id", orderIds);

  if (removedOrders.error) {
    console.error("Тестовые заказы не удалены:", removedOrders.error.message);
  }

  const removedLinks = await admin
    .from("workshop_marketplace_links")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .in(
      "sku",
      TEST_LINKS.map((link) => link.sku),
    );

  if (removedLinks.error) {
    console.error("Тестовые связи не удалены:", removedLinks.error.message);
  }

  return {
    orders: removedOrders.count ?? orderIds.length,
    links: removedLinks.count ?? 0,
  };
}

async function main(): Promise<void> {
  console.log(`База: ${supabaseUrl} | сервер: ${BASE_URL}`);

  if (!(await serverIsUp())) {
    console.error(
      `Сервер ${BASE_URL} не отвечает. Запустите npm start и повторите тест.`,
    );
    process.exitCode = 1;

    return;
  }

  const found = await findProducts();

  if (!found) {
    console.error(
      "Не нашёл товары с артикулами 01, 02, 03 и 04 у одного владельца.",
    );
    process.exitCode = 1;

    return;
  }

  const { userId, bySku } = found;
  const productOf = (sku: string) => String(bySku.get(sku)?.id ?? "");

  console.log(
    "Владелец:",
    userId,
    "| товары:",
    PRODUCT_SKUS.map((sku) => `${sku}=${productOf(sku)}`).join(", "),
  );

  const token = await readWebhookToken(userId);

  if (!token) {
    console.error("У владельца нет workshop_settings.webhook_token.");
    process.exitCode = 1;

    return;
  }

  try {
    const stale = await cleanup(userId);

    if (stale.orders > 0 || stale.links > 0) {
      console.log(
        `Прошлые тестовые данные убраны: заказов ${stale.orders}, связей ${stale.links}.`,
      );
    }

    const inserted = await admin
      .from("workshop_marketplace_links")
      .upsert(
        TEST_LINKS.map((link) => ({
          user_id: userId,
          marketplace: link.marketplace,
          sku: link.sku,
          product_id: productOf(link.productSku),
        })),
        { onConflict: "user_id,marketplace,sku" },
      )
      .select("id, marketplace, sku, product_id");

    check(
      "Связи SKU созданы",
      !inserted.error && (inserted.data ?? []).length === TEST_LINKS.length,
      inserted.error?.message ??
        `${(inserted.data ?? []).length}/${TEST_LINKS.length}`,
    );

    const ozon = await postWebhook("ozon", token, OZON_ORDER);
    check("Ozon: вебхук принят", ozon.status === 200, `${ozon.status} ${ozon.text}`);

    const wb = await postWebhook("wb", token, WB_ORDER);
    check("WB: вебхук принят", wb.status === 200, `${wb.status} ${wb.text}`);

    const yandex = await postWebhook("yandex", token, YANDEX_ORDER);
    check(
      "Яндекс: вебхук принят",
      yandex.status === 200,
      `${yandex.status} ${yandex.text}`,
    );

    const unknown = await postWebhook("ozon", token, OZON_UNKNOWN);
    check(
      "Ozon: вебхук с неизвестным SKU принят",
      unknown.status === 200,
      `${unknown.status} ${unknown.text}`,
    );

    const ozonOrder = await findOrder(userId, "OZ-001");
    const ozonItems = ozonOrder ? await findItems(String(ozonOrder.id)) : [];
    const ozonItem: Row = ozonItems[0] ?? {};

    check(
      "Ozon: заказ привязан к товару 01",
      ozonOrder?.status === "new" &&
        ozonOrder?.source === "ozon" &&
        ozonItems.length === 1 &&
        ozonItem.product_id === productOf("01") &&
        ozonItem.sku === "SKU-OZON-01" &&
        ozonItem.quantity === 2 &&
        Number(ozonOrder?.total_cost) === 3040,
      {
        status: ozonOrder?.status,
        total_cost: ozonOrder?.total_cost,
        items: ozonItems,
      },
    );

    const wbOrder = await findOrder(userId, "12345678");
    const wbItems = wbOrder ? await findItems(String(wbOrder.id)) : [];
    const wbItem: Row = wbItems[0] ?? {};

    check(
      "WB: заказ привязан к товару 02",
      wbOrder?.status === "new" &&
        wbOrder?.source === "wb" &&
        wbOrder?.title === "WB: 12345678" &&
        wbItems.length === 1 &&
        wbItem.product_id === productOf("02") &&
        wbItem.sku === "SKU-WB-02" &&
        wbItem.quantity === 1 &&
        Number(wbOrder?.total_cost) === 1499.97,
      {
        title: wbOrder?.title,
        status: wbOrder?.status,
        total_cost: wbOrder?.total_cost,
        items: wbItems,
      },
    );

    const yandexOrder = await findOrder(userId, "YA-001");
    const yandexItems = yandexOrder
      ? await findItems(String(yandexOrder.id))
      : [];
    const yandexItem: Row = yandexItems[0] ?? {};

    check(
      "Яндекс: заказ привязан к товару 03",
      yandexOrder?.status === "new" &&
        yandexOrder?.source === "yandex" &&
        yandexItems.length === 1 &&
        yandexItem.product_id === productOf("03") &&
        yandexItem.sku === "SKU-YANDEX-03" &&
        yandexItem.quantity === 1 &&
        // Яндекс не прислал `total`: сумма заказа неизвестна, в базе 0.
        yandexOrder?.total_amount === null &&
        Number(yandexOrder?.total_cost) === 0,
      {
        status: yandexOrder?.status,
        total_cost: yandexOrder?.total_cost,
        items: yandexItems,
      },
    );

    const unmappedOrder = await findOrder(userId, "OZ-002");
    const unmappedItems = unmappedOrder
      ? await findItems(String(unmappedOrder.id))
      : [];
    const unmappedItem: Row = unmappedItems[0] ?? {};

    check(
      "Ozon: неизвестный SKU уходит в unmapped",
      unmappedOrder?.status === "unmapped" &&
        unmappedOrder?.source === "ozon" &&
        unmappedItems.length === 1 &&
        unmappedItem.product_id === null &&
        unmappedItem.sku === "SKU-UNKNOWN",
      {
        status: unmappedOrder?.status,
        total_cost: unmappedOrder?.total_cost,
        items: unmappedItems,
      },
    );

    const unlinked = await admin
      .from("workshop_marketplace_links")
      .select("id")
      .eq("user_id", userId)
      .eq("product_id", productOf(UNLINKED_SKU));

    check(
      "Товар 04 остался без связи",
      !unlinked.error && (unlinked.data ?? []).length === 0,
      unlinked.error?.message ?? `${(unlinked.data ?? []).length} связей`,
    );

    const testOrders = await findOrders(userId);

    check(
      "В базе ровно 4 тестовых заказа: 3 new и 1 unmapped",
      testOrders.length === 4 &&
        testOrders.filter((order) => order.status === "new").length === 3 &&
        testOrders.filter((order) => order.status === "unmapped").length === 1,
      testOrders.map((order) => `${order.marketplace_order_id}:${order.status}`),
    );
  } catch (error) {
    failures += 1;
    console.error(
      "✗ Тест остановлен:",
      error instanceof Error ? error.message : error,
    );
  } finally {
    if (KEEP_DATA) {
      console.log(
        "KEEP_MARKETPLACE_TEST_DATA=1 — тестовые заказы и связи оставлены.",
      );
    } else {
      const removed = await cleanup(userId);

      console.log(
        `Уборка: удалено заказов ${removed.orders}, тестовых связей ${removed.links}.`,
      );
    }
  }

  const survivors = await admin
    .from("workshop_products")
    .select("id, sku")
    .in("sku", [...PRODUCT_SKUS]);

  check(
    "Товары 01…04 на месте",
    !survivors.error && (survivors.data ?? []).length >= PRODUCT_SKUS.length,
    survivors.error?.message ??
      (survivors.data ?? []).map((row) => String((row as Row).sku)).join(", "),
  );

  console.log(
    failures === 0 ? "\nВсе проверки пройдены." : `\nПровалов: ${failures}.`,
  );

  process.exitCode = failures === 0 ? 0 : 1;
}

void main();

