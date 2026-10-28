/**
 * Интеграционный тест слоя Мастерской (этап 1).
 *
 * Что проверяет на живой базе:
 *   1. getOrderWithItems отдаёт заказ с позицией, товаром и деньгами площадки;
 *   2. чужой заказ не виден второму пользователю (RLS + фильтр user_id);
 *   3. createPrintJob ставит позицию в очередь и не создаёт дубль при повторе;
 *   4. товар без G-code в очередь не попадает;
 *   5. агент по agent_token получает очередь своей мастерской с принтерами;
 *   6. неизвестный токен отклоняется.
 *
 * Тест создаёт двух пользователей, товары, заказ, позиции и принтер, а в
 * finally удаляет пользователей — каскад auth.users уносит все строки.
 *
 * Запуск (после применения supabase/workshop_farm_and_shop.sql):
 *   node --import ./scripts/register-alias.mjs scripts/test-db.ts
 *
 * Если миграция не применена, тест завершается кодом 2 и подсказывает файл:
 * это ожидаемое состояние до ручного применения SQL.
 */
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createPrintJob,
  getOrderWithItems,
  getQueuedJobsForAgent,
} from "../lib/db/workshop-farm";

const ROOT = path.resolve(import.meta.dirname, "..");

let failures = 0;

/** Печатает результат одной проверки и считает провалы. */
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

// createAdminClient читает process.env в момент вызова: переносим значения из
// .env.local, чтобы скрипту не нужен был --env-file.
process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anonKey;
process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;

const admin = createSupabaseClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type TestUser = {
  client: SupabaseClient;
  userId: string;
  email: string;
};

type Row = Record<string, unknown>;

/** Достаёт id из ответа insert ... select. */
function requireId(data: unknown, what: string): string {
  const row: Row | null =
    typeof data === "object" && data !== null ? (data as Row) : null;
  const id = row?.id;

  if (typeof id !== "string" || !id) {
    throw new Error(`${what}: база не вернула id.`);
  }

  return id;
}

/** Достаёт строку из ответа insert ... select. */
function requireText(data: unknown, key: string, what: string): string {
  const row: Row | null =
    typeof data === "object" && data !== null ? (data as Row) : null;
  const value = row?.[key];

  if (typeof value !== "string" || !value) {
    throw new Error(`${what}: база не вернула поле ${key}.`);
  }

  return value;
}

function throwIfError(
  error: { message: string } | null,
  what: string,
): void {
  if (error) {
    throw new Error(`${what}: ${error.message}`);
  }
}

/** Создаёт подтверждённого пользователя и входит им — функции пойдут под RLS. */
async function createTestUser(email: string, password: string): Promise<TestUser> {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  throwIfError(created.error, `createUser ${email}`);

  const client = createSupabaseClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signedIn = await client.auth.signInWithPassword({ email, password });

  throwIfError(signedIn.error, `signIn ${email}`);

  if (!signedIn.data.user) {
    throw new Error(`signIn ${email}: нет пользователя в ответе.`);
  }

  return { client, userId: signedIn.data.user.id, email };
}

/** Какие таблицы и колонки должны существовать после миграции. */
const SCHEMA_PROBES: { table: string; columns: string }[] = [
  { table: "workshop_print_jobs", columns: "id, status, gcode_url" },
  {
    table: "workshop_order_items",
    columns: "id, order_id, product_id, sku, quantity",
  },
  {
    table: "workshop_marketplace_links",
    columns: "id, marketplace, sku, product_id",
  },
  {
    table: "workshop_orders",
    columns:
      "marketplace_order_id, total_amount, marketplace_commission, internal_print_cost",
  },
  { table: "workshop_products", columns: "name, gcode_url" },
  { table: "workshop_settings", columns: "agent_token" },
  {
    table: "workshop_printers",
    columns:
      "protocol_type, ip_address, api_key, status, progress, remaining_time, last_seen_at",
  },
];

/** Возвращает описание первой недостающей таблицы/колонки или null. */
async function probeSchema(): Promise<string | null> {
  for (const { table, columns } of SCHEMA_PROBES) {
    const result = await admin.from(table).select(columns).limit(1);

    if (result.error) {
      return `${table} (${columns}): ${result.error.message}`;
    }
  }

  return null;
}

async function insertOne(
  client: SupabaseClient,
  table: string,
  values: Record<string, unknown>,
  columns: string,
  what: string,
): Promise<Row> {
  const result: {
    data: unknown;
    error: { message: string } | null;
  } = await client.from(table).insert(values).select(columns).single();

  throwIfError(result.error, what);

  if (typeof result.data !== "object" || result.data === null) {
    throw new Error(`${what}: база вернула пустой ответ.`);
  }

  return result.data as Row;
}

async function main(): Promise<void> {
  const schemaIssue = await probeSchema();

  if (schemaIssue) {
    console.warn(`⚠ Схема не готова: ${schemaIssue}`);
    console.warn(
      "Примените supabase/workshop_farm_and_shop.sql и повторите тест.",
    );
    process.exitCode = 2;
    return;
  }

  const suffix = randomBytes(4).toString("hex");
  const password = `Test-${randomBytes(10).toString("hex")}`;
  const createdUsers: TestUser[] = [];

  try {
    const userA = await createTestUser(
      `workshop-farm-a-${suffix}@example.com`,
      password,
    );
    createdUsers.push(userA);

    const userB = await createTestUser(
      `workshop-farm-b-${suffix}@example.com`,
      password,
    );
    createdUsers.push(userB);

    const gcodeUrl = `https://example.com/vase-${suffix}.gcode`;
    const marketplaceOrderId = `OZ-ORDER-${suffix}`;

    const product = await insertOne(
      userA.client,
      "workshop_products",
      {
        user_id: userA.userId,
        sku: `SKU-${suffix}`,
        title: "Тестовая ваза",
        gcode_url: gcodeUrl,
      },
      "id, title, name, gcode_url",
      "товар",
    );
    const productId = requireId(product, "товар");

    check(
      "Миграция: name — синоним title",
      product.name === "Тестовая ваза",
      `name=${String(product.name)}, title=${String(product.title)}`,
    );

    await insertOne(
      userA.client,
      "workshop_marketplace_links",
      {
        user_id: userA.userId,
        marketplace: "ozon",
        sku: `OZ-${suffix}`,
        product_id: productId,
      },
      "id",
      "связь SKU",
    );

    const order = await insertOne(
      userA.client,
      "workshop_orders",
      {
        user_id: userA.userId,
        title: "Заказ Ozon",
        marketplace_order_id: marketplaceOrderId,
        total_amount: 1500.5,
        marketplace_commission: 225.25,
        internal_print_cost: 320,
        total_cost: 1500.5,
      },
      "id, marketplace_order_id",
      "заказ",
    );
    const orderId = requireId(order, "заказ");

    const item = await insertOne(
      userA.client,
      "workshop_order_items",
      {
        user_id: userA.userId,
        order_id: orderId,
        product_id: productId,
        sku: `OZ-${suffix}`,
        quantity: 2,
      },
      "id",
      "позиция заказа",
    );
    const itemId = requireId(item, "позиция заказа");

    const noGcodeProduct = await insertOne(
      userA.client,
      "workshop_products",
      {
        user_id: userA.userId,
        sku: `SKU-NOGCODE-${suffix}`,
        title: "Ваза без файла",
      },
      "id",
      "товар без G-code",
    );
    const noGcodeProductId = requireId(noGcodeProduct, "товар без G-code");

    const noGcodeItem = await insertOne(
      userA.client,
      "workshop_order_items",
      {
        user_id: userA.userId,
        order_id: orderId,
        product_id: noGcodeProductId,
        sku: `SKU-NOGCODE-${suffix}`,
        quantity: 1,
      },
      "id",
      "позиция без G-code",
    );
    const noGcodeItemId = requireId(noGcodeItem, "позиция без G-code");

    const printer = await insertOne(
      userA.client,
      "workshop_printers",
      {
        user_id: userA.userId,
        name: "Тестовый Ender",
        brand: "Creality",
        model: "Ender-3",
        protocol_type: "moonraker",
        ip_address: "192.168.1.50",
        api_key: "test-api-key",
      },
      "id",
      "принтер",
    );
    const printerId = requireId(printer, "принтер");

    const tokenRow = await userA.client
      .from("workshop_settings")
      .upsert({ user_id: userA.userId }, { onConflict: "user_id" })
      .select("agent_token")
      .single();

    throwIfError(tokenRow.error, "настройки мастерской");

    const agentToken = requireText(
      tokenRow.data,
      "agent_token",
      "настройки мастерской",
    );

    const contextA = { supabase: userA.client, userId: userA.userId };
    const contextB = { supabase: userB.client, userId: userB.userId };

    // 1. Заказ с позициями и деньгами площадки ------------------------------
    const loaded = await getOrderWithItems(orderId, contextA);

    check(
      "getOrderWithItems: заказ найден",
      loaded.ok,
      loaded.ok ? orderId : `${loaded.reason}: ${loaded.error}`,
    );

    if (!loaded.ok) {
      throw new Error("Заказ не прочитан — дальнейшие проверки невозможны.");
    }

    check(
      "getOrderWithItems: деньги площадки",
      loaded.data.marketplaceOrderId === marketplaceOrderId &&
        loaded.data.totalAmount === 1500.5 &&
        loaded.data.marketplaceCommission === 225.25 &&
        loaded.data.internalPrintCost === 320,
      `id=${String(loaded.data.marketplaceOrderId)}, сумма=${String(loaded.data.totalAmount)}, комиссия=${String(loaded.data.marketplaceCommission)}, себестоимость=${String(loaded.data.internalPrintCost)}`,
    );

    const loadedItem = loaded.data.items.find((entry) => entry.id === itemId);

    check(
      "getOrderWithItems: позиция с товаром и G-code",
      loadedItem?.product?.name === "Тестовая ваза" &&
        loadedItem.product.gcodeUrl === gcodeUrl &&
        loadedItem.quantity === 2,
      loadedItem
        ? `name=${String(loadedItem.product?.name)}, gcode=${String(loadedItem.product?.gcodeUrl)}, количество=${loadedItem.quantity}`
        : "позиции нет в ответе",
    );

    // 2. RLS: чужая мастерская ничего не видит ------------------------------
    const foreignRead = await getOrderWithItems(orderId, contextB);

    check(
      "RLS: чужой заказ не виден",
      !foreignRead.ok && foreignRead.reason === "not_found",
      foreignRead.ok ? "чужой заказ открылся" : foreignRead.reason,
    );

    const foreignJob = await userB.client
      .from("workshop_print_jobs")
      .insert({
        user_id: userB.userId,
        order_id: orderId,
        order_item_id: itemId,
        gcode_url: gcodeUrl,
      })
      .select("id")
      .single();

    check(
      "RLS: чужую позицию нельзя поставить в печать",
      Boolean(foreignJob.error),
      foreignJob.error ? foreignJob.error.message : "вставка прошла",
    );

    const completedJob = await userA.client
      .from("workshop_print_jobs")
      .insert({
        user_id: userA.userId,
        order_id: orderId,
        order_item_id: itemId,
        status: "done",
      })
      .select("id")
      .single();

    check(
      "RLS: браузер не может сразу объявить задание выполненным",
      Boolean(completedJob.error),
      completedJob.error ? completedJob.error.message : "вставка прошла",
    );

    // 3. Постановка в очередь ----------------------------------------------
    const job = await createPrintJob(
      { orderId, orderItemId: itemId, printerId },
      contextA,
    );

    check(
      "createPrintJob: задание создано",
      job.ok && job.data.status === "queued" && job.data.gcodeUrl === gcodeUrl,
      job.ok
        ? `id=${job.data.id}, status=${job.data.status}, gcode=${String(job.data.gcodeUrl)}`
        : `${job.reason}: ${job.error}`,
    );

    if (!job.ok) {
      throw new Error("Задание не создано — проверки агента невозможны.");
    }

    const repeated = await createPrintJob(
      { orderId, orderItemId: itemId, printerId },
      contextA,
    );

    check(
      "createPrintJob: повтор не создаёт дубль",
      repeated.ok && repeated.data.id === job.data.id,
      repeated.ok ? repeated.data.id : `${repeated.reason}: ${repeated.error}`,
    );

    const withoutGcode = await createPrintJob(
      { orderId, orderItemId: noGcodeItemId },
      contextA,
    );

    check(
      "createPrintJob: товар без G-code не ставится в очередь",
      !withoutGcode.ok && withoutGcode.reason === "missing_gcode",
      withoutGcode.ok ? "задание создано" : withoutGcode.reason,
    );

    const mismatchedOrder = await createPrintJob(
      {
        orderId: "00000000-0000-4000-8000-000000000000",
        orderItemId: itemId,
      },
      contextA,
    );

    check(
      "createPrintJob: позиция из другого заказа отклонена",
      !mismatchedOrder.ok && mismatchedOrder.reason === "ownership_mismatch",
      mismatchedOrder.ok ? "задание создано" : mismatchedOrder.reason,
    );

    // 4. Агент по токену ----------------------------------------------------
    const queue = await getQueuedJobsForAgent(agentToken);

    check(
      "Агент: очередь прочитана",
      queue.ok,
      queue.ok
        ? `заданий=${queue.data.jobs.length}, принтеров=${queue.data.printers.length}`
        : `${queue.reason}: ${queue.error}`,
    );

    if (queue.ok) {
      check(
        "Агент: задание в очереди с принтером",
        queue.data.jobs.some(
          (entry) => entry.id === job.data.id && entry.printer?.id === printerId,
        ),
        queue.data.jobs.map((entry) => entry.id).join(", ") || "очередь пуста",
      );

      check(
        "Агент: принтер отдан с адресом и ключом",
        queue.data.printers.some(
          (entry) =>
            entry.id === printerId &&
            entry.ipAddress === "192.168.1.50" &&
            entry.apiKey === "test-api-key",
        ),
        queue.data.printers
          .map(
            (entry) =>
              `${entry.id}:${String(entry.ipAddress)}:${String(entry.apiKey)}`,
          )
          .join(", ") || "принтеров нет",
      );
    }

    const unknownToken = await getQueuedJobsForAgent(
      "00000000-0000-4000-8000-000000000000",
    );

    check(
      "Агент: неизвестный токен отклонён",
      !unknownToken.ok && unknownToken.reason === "invalid_token",
      unknownToken.ok ? "токен принят" : unknownToken.reason,
    );
  } finally {
    for (const user of createdUsers.reverse()) {
      const removed = await admin.auth.admin.deleteUser(user.userId);

      if (removed.error) {
        console.warn(
          `Не удалось удалить ${user.email}: ${removed.error.message}`,
        );
      } else {
        console.log(
          `Пользователь ${user.email} удалён — данные мастерской ушли каскадом.`,
        );
      }
    }
  }

  if (failures > 0) {
    console.error(`Провалов: ${failures}.`);
    process.exitCode = 1;
  } else {
    console.log("Все проверки пройдены.");
  }
}

main().catch((error: unknown) => {
  console.error(
    "Тест упал:",
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
