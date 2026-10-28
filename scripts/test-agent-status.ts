/**
 * Тест API статусов локального агента 3D-фермы (этап 3, шаг 3.2).
 *
 * Что проверяет на живой базе:
 *   1. `printing` + progress 50 → задание printing, заказ printing, принтер
 *      printing с progress = 50;
 *   2. `done` → задание done, заказ ready, принтер idle, progress = 0,
 *      remaining_time = 0;
 *   3. `failed` → задание failed, заказ new (мастер перезапустит), принтер
 *      error с progress = 0;
 *   4. неверный токен → 401, неизвестный статус → 400, чужое/несуществующее
 *      задание → 404.
 *
 * Тест создаёт пользователя, товар, заказ, принтер, позицию и queued-задание, а
 * в finally удаляет пользователя — каскад auth.users уносит все строки.
 *
 * Запуск (после применения supabase/workshop_farm_and_shop.sql):
 *   node --import ./scripts/register-alias.mjs scripts/test-agent-status.ts
 *
 * Если миграция не применена, тест завершается кодом 2 и подсказывает файл.
 */
import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { POST } from "../app/api/agent/status/route";
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

/** Тело ответа роута: успех или текст ошибки. */
type StatusResponse = { success?: unknown; error?: unknown };

type StatusResult = {
  status: number;
  body: StatusResponse;
};

/** Запрос к роуту так, как его сделает локальный агент. */
async function callStatus(
  headers: Record<string, string>,
  body: unknown,
): Promise<StatusResult> {
  const response = await POST(
    new Request("http://localhost/api/agent/status", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );

  return {
    status: response.status,
    body: (await response.json()) as StatusResponse,
  };
}

/** Состояние трёх таблиц после сообщения агента. */
type FarmState = {
  jobStatus: string;
  orderStatus: string;
  printerStatus: string;
  progress: number;
  remainingTime: number;
};

/** Перечитывает строки из базы: роут пишет их через service_role. */
async function readState(
  jobId: string,
  orderId: string,
  printerId: string,
): Promise<FarmState> {
  const [job, order, printer] = await Promise.all([
    admin
      .from("workshop_print_jobs")
      .select("status")
      .eq("id", jobId)
      .maybeSingle(),
    admin
      .from("workshop_orders")
      .select("status")
      .eq("id", orderId)
      .maybeSingle(),
    admin
      .from("workshop_printers")
      .select("status, progress, remaining_time")
      .eq("id", printerId)
      .maybeSingle(),
  ]);

  throwIfError(job.error, "чтение задания");
  throwIfError(order.error, "чтение заказа");
  throwIfError(printer.error, "чтение принтера");

  const jobRow = (job.data ?? {}) as Row;
  const orderRow = (order.data ?? {}) as Row;
  const printerRow = (printer.data ?? {}) as Row;

  return {
    jobStatus: String(jobRow.status ?? ""),
    orderStatus: String(orderRow.status ?? ""),
    printerStatus: String(printerRow.status ?? ""),
    progress: Number(printerRow.progress ?? -1),
    remainingTime: Number(printerRow.remaining_time ?? -1),
  };
}

async function main(): Promise<void> {
  const suffix = randomBytes(4).toString("hex");
  const email = `agent-status-${suffix}@example.com`;
  const agentToken = randomUUID();
  const gcodeUrl = `https://example.com/status-${suffix}.gcode`;
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

    const product = await insertOne(
      "workshop_products",
      {
        user_id: userId,
        sku: `STATUS-${suffix}`,
        title: "Ваза для теста статусов",
        price: 1500,
        gcode_url: gcodeUrl,
      },
      "id",
      "товар",
    );

    const order = await insertOne(
      "workshop_orders",
      { user_id: userId, title: "Заказ статусов", status: "new" },
      "id",
      "заказ",
    );
    const orderId = requireId(order, "заказ");

    // Остаток времени специально не нулевой: после done роут обязан обнулить
    // и progress, и remaining_time.
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
        status: "idle",
        progress: 0,
        remaining_time: 1800,
      },
      "id",
      "принтер",
    );
    const printerId = requireId(printer, "принтер");

    const item = await insertOne(
      "workshop_order_items",
      {
        user_id: userId,
        order_id: orderId,
        product_id: requireId(product, "товар"),
        sku: `STATUS-${suffix}`,
        quantity: 1,
      },
      "id",
      "позиция заказа",
    );

    const job = await insertOne(
      "workshop_print_jobs",
      {
        user_id: userId,
        order_id: orderId,
        order_item_id: requireId(item, "позиция заказа"),
        printer_id: printerId,
        gcode_url: gcodeUrl,
        status: "queued",
      },
      "id",
      "задание печати",
    );
    const jobId = requireId(job, "задание печати");

    const authorized: Record<string, string> = {
      authorization: `Bearer ${agentToken}`,
    };

    // 2. Печать началась ------------------------------------------------------
    const printing = await callStatus(authorized, {
      jobId,
      status: "printing",
      progress: 50,
    });

    check(
      "POST printing: 200 и success",
      printing.status === 200 && printing.body.success === true,
      `status=${printing.status}, body=${JSON.stringify(printing.body).slice(0, 300)}`,
    );

    const afterPrinting = await readState(jobId, orderId, printerId);

    check(
      "printing: задание стало printing",
      afterPrinting.jobStatus === "printing",
      `job=${afterPrinting.jobStatus}`,
    );

    check(
      "printing: заказ стал printing",
      afterPrinting.orderStatus === "printing",
      `order=${afterPrinting.orderStatus}`,
    );

    check(
      "printing: принтер printing, progress 50",
      afterPrinting.printerStatus === "printing" &&
        afterPrinting.progress === 50,
      `printer=${afterPrinting.printerStatus}, progress=${afterPrinting.progress}`,
    );

    // 3. Печать завершилась ---------------------------------------------------
    const done = await callStatus(authorized, { jobId, status: "done" });

    check(
      "POST done: 200 и success",
      done.status === 200 && done.body.success === true,
      `status=${done.status}, body=${JSON.stringify(done.body).slice(0, 300)}`,
    );

    const afterDone = await readState(jobId, orderId, printerId);

    check(
      "done: задание стало done",
      afterDone.jobStatus === "done",
      `job=${afterDone.jobStatus}`,
    );

    check(
      "done: заказ стал ready",
      afterDone.orderStatus === "ready",
      `order=${afterDone.orderStatus}`,
    );

    check(
      "done: принтер idle, progress 0, remaining_time 0",
      afterDone.printerStatus === "idle" &&
        afterDone.progress === 0 &&
        afterDone.remainingTime === 0,
      `printer=${afterDone.printerStatus}, progress=${afterDone.progress}, remaining_time=${afterDone.remainingTime}`,
    );

    // 4. Ошибка печати: заказ возвращается в new, принтер — в error -----------
    // Ветка проверяется на том же задании после done: переход уже не реалистичен,
    // но роут обязан согласованно перевести все три строки.
    const failed = await callStatus(authorized, { jobId, status: "failed" });

    check(
      "POST failed: 200 и success",
      failed.status === 200 && failed.body.success === true,
      `status=${failed.status}, body=${JSON.stringify(failed.body).slice(0, 300)}`,
    );

    const afterFailed = await readState(jobId, orderId, printerId);

    check(
      "failed: задание стало failed",
      afterFailed.jobStatus === "failed",
      `job=${afterFailed.jobStatus}`,
    );

    check(
      "failed: заказ вернулся в new",
      afterFailed.orderStatus === "new",
      `order=${afterFailed.orderStatus}`,
    );

    check(
      "failed: принтер error, progress 0",
      afterFailed.printerStatus === "error" && afterFailed.progress === 0,
      `printer=${afterFailed.printerStatus}, progress=${afterFailed.progress}`,
    );

    // 5. Отказы ---------------------------------------------------------------
    const wrongToken = await callStatus(
      { authorization: `Bearer ${randomUUID()}` },
      { jobId, status: "printing" },
    );

    check(
      "POST: неверный токен → 401",
      wrongToken.status === 401,
      `status=${wrongToken.status}`,
    );

    const unknownStatus = await callStatus(authorized, {
      jobId,
      status: "queued",
    });

    check(
      "POST: status queued → 400",
      unknownStatus.status === 400,
      `status=${unknownStatus.status}, body=${JSON.stringify(unknownStatus.body).slice(0, 200)}`,
    );

    const unknownJob = await callStatus(authorized, {
      jobId: randomUUID(),
      status: "printing",
    });

    check(
      "POST: неизвестное задание → 404",
      unknownJob.status === 404,
      `status=${unknownJob.status}`,
    );
  } finally {
    if (createdUserId) {
      const removed = await admin.auth.admin.deleteUser(createdUserId);

      if (removed.error) {
        console.warn(`Не удалось удалить ${email}: ${removed.error.message}`);
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

