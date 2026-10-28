/**
 * Тест API локального агента 3D-фермы (этап 3, шаг 3.1).
 *
 * Что проверяет на живой базе:
 *   1. `GET /api/agent/tasks` с правильным токеном отдаёт queued-задание
 *      мастерской — с G-code, принтером и заказом;
 *   2. неверный токен получает 401;
 *   3. запрос без заголовка Authorization получает 401;
 *   4. токен не-uuid отклоняется до запроса в базу (тоже 401).
 *
 * Тест создаёт пользователя, настройки с agent_token, принтер, заказ, позицию
 * и одно queued-задание, а в finally удаляет пользователя — каскад auth.users
 * уносит все строки мастерской.
 *
 * Запуск (после применения supabase/workshop_farm_and_shop.sql):
 *   node --import ./scripts/register-alias.mjs scripts/test-agent-tasks.ts
 *
 * Если миграция не применена, тест завершается кодом 2 и подсказывает файл:
 * это ожидаемое состояние до ручного применения SQL.
 */
import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { GET } from "../app/api/agent/tasks/route";
import { isMissingTableSchema } from "../lib/supabase/schema-errors";

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
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? localEnv.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Нет NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY в .env.local.",
  );
  process.exit(1);
}

// Роут читает env в момент вызова createAdminClient: переносим значения из
// .env.local, чтобы скрипту не нужен был --env-file.
process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;

const admin = createSupabaseClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Row = Record<string, unknown>;

function throwIfError(
  error: { message: string } | null,
  what: string,
): void {
  if (error) {
    throw new Error(`${what}: ${error.message}`);
  }
}

async function insertOne(
  table: string,
  values: Record<string, unknown>,
  columns: string,
  what: string,
): Promise<Row> {
  const result: {
    data: unknown;
    error: { message: string } | null;
  } = await admin.from(table).insert(values).select(columns).single();

  throwIfError(result.error, what);

  if (typeof result.data !== "object" || result.data === null) {
    throw new Error(`${what}: база вернула пустой ответ.`);
  }

  return result.data as Row;
}

/** Достаёт id из ответа insert ... select. */
function requireId(data: Row, what: string): string {
  const id = data.id;

  if (typeof id !== "string" || !id) {
    throw new Error(`${what}: база не вернула id.`);
  }

  return id;
}

/** Тело ответа роута: задачи и, при ошибке, текст причины. */
type TaskPayload = {
  id?: unknown;
  orderId?: unknown;
  orderItemId?: unknown;
  printerId?: unknown;
  gcodeUrl?: unknown;
  order?: { id?: unknown; title?: unknown } | null;
  printer?: { id?: unknown; apiKey?: unknown } | null;
};

type TasksResponse = { tasks?: TaskPayload[]; error?: unknown };

/** Запрос к роуту так, как его сделает локальный агент. */
async function callTasks(headers: Record<string, string>): Promise<Response> {
  return GET(
    new Request("http://localhost/api/agent/tasks", { method: "GET", headers }),
  );
}

async function main(): Promise<void> {
  const suffix = randomBytes(4).toString("hex");
  const email = `agent-tasks-${suffix}@example.com`;
  const agentToken = randomUUID();
  const gcodeUrl = `https://example.com/agent-${suffix}.gcode`;
  let createdUserId: string | null = null;

  try {
    const created = await admin.auth.admin.createUser({
      email,
      password: `Test-${randomBytes(10).toString("hex")}`,
      email_confirm: true,
    });

    throwIfError(created.error, `createUser ${email}`);

    const userId = created.data.user?.id;

    if (!userId) {
      throw new Error("createUser: база не вернула id пользователя.");
    }

    createdUserId = userId;

    // 1. Данные мастерской ----------------------------------------------------
    const settings = await admin
      .from("workshop_settings")
      .upsert(
        { user_id: userId, agent_token: agentToken },
        { onConflict: "user_id" },
      )
      .select("agent_token")
      .single();

    if (settings.error) {
      if (isMissingTableSchema(settings.error.code, settings.error.message)) {
        console.warn(`⚠ Схема не готова: ${settings.error.message}`);
        console.warn(
          "Примените supabase/workshop_farm_and_shop.sql и повторите тест.",
        );
        process.exitCode = 2;
        return;
      }

      throw new Error(`настройки мастерской: ${settings.error.message}`);
    }

    check(
      "Настройки: agent_token сохранён",
      settings.data?.agent_token === agentToken,
      `токен=${String(settings.data?.agent_token)}`,
    );

    const printer = await insertOne(
      "workshop_printers",
      {
        user_id: userId,
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

    const order = await insertOne(
      "workshop_orders",
      { user_id: userId, title: "Заказ агента" },
      "id",
      "заказ",
    );
    const orderId = requireId(order, "заказ");

    const item = await insertOne(
      "workshop_order_items",
      {
        user_id: userId,
        order_id: orderId,
        sku: `AGENT-${suffix}`,
        quantity: 1,
      },
      "id",
      "позиция заказа",
    );
    const itemId = requireId(item, "позиция заказа");

    const job = await insertOne(
      "workshop_print_jobs",
      {
        user_id: userId,
        order_id: orderId,
        order_item_id: itemId,
        printer_id: printerId,
        gcode_url: gcodeUrl,
        status: "queued",
      },
      "id",
      "задание печати",
    );
    const jobId = requireId(job, "задание печати");

    // 2. Запрос с правильным токеном -----------------------------------------
    const authorized = await callTasks({
      authorization: `Bearer ${agentToken}`,
    });
    const authorizedBody = (await authorized.json()) as TasksResponse;

    check(
      "GET: правильный токен → 200",
      authorized.status === 200,
      `status=${authorized.status}, body=${JSON.stringify(authorizedBody).slice(0, 300)}`,
    );

    const tasks = Array.isArray(authorizedBody.tasks)
      ? authorizedBody.tasks
      : [];
    const task = tasks.find((entry) => entry.id === jobId);

    check(
      "GET: queued-задание вернулось",
      Boolean(task),
      tasks.map((entry) => String(entry.id)).join(", ") || "список пуст",
    );

    check(
      "GET: G-code и printer_id в задании",
      task?.gcodeUrl === gcodeUrl && task?.printerId === printerId,
      task
        ? `gcode=${String(task.gcodeUrl)}, printer_id=${String(task.printerId)}`
        : "задания нет",
    );

    check(
      "GET: заказ и принтер подтянуты join-ом",
      task?.order?.id === orderId &&
        task.order?.title === "Заказ агента" &&
        task?.printer?.id === printerId &&
        task?.printer?.apiKey === "test-api-key",
      task
        ? `order=${String(task.order?.title)}, api_key=${String(task.printer?.apiKey)}`
        : "задания нет",
    );

    // 3. Отказы ---------------------------------------------------------------
    const wrongToken = await callTasks({
      authorization: `Bearer ${randomUUID()}`,
    });

    check(
      "GET: неверный токен → 401",
      wrongToken.status === 401,
      `status=${wrongToken.status}`,
    );

    const noToken = await callTasks({});

    check(
      "GET: без заголовка Authorization → 401",
      noToken.status === 401,
      `status=${noToken.status}`,
    );

    const malformed = await callTasks({ authorization: "Bearer not-a-uuid" });

    check(
      "GET: токен не-uuid → 401",
      malformed.status === 401,
      `status=${malformed.status}`,
    );
  } finally {
    if (createdUserId) {
      const removed = await admin.auth.admin.deleteUser(createdUserId);

      if (removed.error) {
        console.warn(
          `Не удалось удалить ${email}: ${removed.error.message}`,
        );
      } else {
        console.log(
          `Пользователь ${email} удалён — данные мастерской ушли каскадом.`,
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
