/**
 * Тест API статусов локального агента 3D-фермы (этап 3, шаг 3.2).
 *
 * Что проверяет на живой базе:
 *   1. `printing` + progress 50 → задание printing, заказ printing, принтер
 *      printing с progress = 50; оценки слайсера (`estimatedSeconds`,
 *      `filamentGrams`) ложатся в колонки задания;
 *   2. `done` → задание done, заказ ready, принтер idle, progress = 0,
 *      remaining_time = 0;
 *   3. `failed` → задание failed, заказ new (мастер перезапустит), принтер
 *      error с progress = 0;
 *   4. `GET /api/agent/status?jobId=` — опрос отмены: без флага `false`, без
 *      `jobId` → 400, чужое задание → 404, неверный токен → 401;
 *   5. отмена мастером: флаг `cancel_requested` → GET отдаёт `true`, агент
 *      сообщает `cancelled` → задание cancelled (не failed), заказ new, принтер
 *      idle, причина «отменено мастером», флаг снят и повторный опрос даёт
 *      `false`;
 *   6. неверный токен → 401, неизвестный статус → 400, чужое/несуществующее
 *      задание → 404.
 *
 * Тест создаёт пользователя, товар, заказ, принтер, позицию и queued-задание, а
 * в finally удаляет пользователя — каскад auth.users уносит все строки.
 *
 * Запуск (после применения supabase/workshop_farm_and_shop.sql и
 * supabase/workshop_print_queue_hardening.sql):
 *   node --import ./scripts/register-alias.mjs scripts/test-agent-status.ts
 *
 * Если базовой миграции нет, тест завершается кодом 2 и подсказывает файл. Без
 * hardening тест работает, но печатает предупреждение и пропускает проверки
 * оценок и отмены: колонок и статуса `cancelled` в старой схеме нет.
 */
import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { GET, POST } from "../app/api/agent/status/route";
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

/** Тело ответа GET: просьба об отмене или текст ошибки. */
type CancelPollResponse = { cancelRequested?: unknown; error?: unknown };

/** Опрос отмены так, как его сделает локальный агент. */
async function callCancelPoll(
  headers: Record<string, string>,
  query: string,
): Promise<{ status: number; body: CancelPollResponse }> {
  const response = await GET(
    new Request(`http://localhost/api/agent/status${query}`, {
      method: "GET",
      headers,
    }),
  );

  return {
    status: response.status,
    body: (await response.json()) as CancelPollResponse,
  };
}

/** Колонки задания из миграции hardening: без неё их в таблице нет. */
type JobDetails = {
  /** false — миграция hardening не применена, остальные поля пустые. */
  hardened: boolean;
  lastError: string | null;
  estimatedSeconds: number | null;
  filamentGrams: number | null;
  cancelRequested: boolean;
  finishedAt: string | null;
};

const JOB_DETAIL_COLUMNS =
  "last_error, estimated_seconds, filament_grams, cancel_requested, finished_at";

/**
 * Читает задание вместе с колонками hardening.
 *
 * 42703 — «колонки нет»: тест продолжается на старой схеме, только проверки
 * оценок и отмены пропускаются.
 */
async function readJobDetails(jobId: string): Promise<JobDetails> {
  const result = await admin
    .from("workshop_print_jobs")
    .select(JOB_DETAIL_COLUMNS)
    .eq("id", jobId)
    .maybeSingle();

  if (result.error) {
    if (result.error.code === "42703") {
      return {
        hardened: false,
        lastError: null,
        estimatedSeconds: null,
        filamentGrams: null,
        cancelRequested: false,
        finishedAt: null,
      };
    }

    throw new Error(`чтение полей задания: ${result.error.message}`);
  }

  const row = (result.data ?? {}) as Row;

  return {
    hardened: true,
    lastError: typeof row.last_error === "string" ? row.last_error : null,
    estimatedSeconds:
      typeof row.estimated_seconds === "number" ? row.estimated_seconds : null,
    filamentGrams:
      typeof row.filament_grams === "number" ? row.filament_grams : null,
    cancelRequested: row.cancel_requested === true,
    finishedAt: typeof row.finished_at === "string" ? row.finished_at : null,
  };
}

/**
 * Мастер нажимает «Отменить печать» — это RPC под сессией пользователя.
 * Тест ходит service_role: поднимает тот же флаг, минуя проверку auth.uid().
 */
async function requestCancel(jobId: string): Promise<void> {
  const result = await admin
    .from("workshop_print_jobs")
    .update({ cancel_requested: true })
    .eq("id", jobId);

  throwIfError(result.error, "подъём cancel_requested");
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
    // Оценки слайсера агент присылает со стартом: карточка показывает «≈2 ч 5 мин»
    // и расход пластика.
    const printing = await callStatus(authorized, {
      jobId,
      status: "printing",
      progress: 50,
      estimatedSeconds: 7500,
      filamentGrams: 42.5,
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

    // 2.1 Оценки слайсера ----------------------------------------------------
    // Без миграции hardening колонок нет: роут пишет только статус, а проверять
    // нечего — дальше идут отмена и cancelled, которых в старой схеме тоже нет.
    const printingDetails = await readJobDetails(jobId);
    const hardening = printingDetails.hardened;

    if (hardening) {
      check(
        "printing: estimated_seconds и filament_grams сохранены",
        printingDetails.estimatedSeconds === 7500 &&
          printingDetails.filamentGrams === 42.5,
        `estimated=${printingDetails.estimatedSeconds}, grams=${printingDetails.filamentGrams}`,
      );

      check(
        "printing: last_error пуст, задание активно, отмены нет",
        printingDetails.lastError === null &&
          printingDetails.finishedAt === null &&
          printingDetails.cancelRequested === false,
        `last_error=${printingDetails.lastError}, finished_at=${printingDetails.finishedAt}, cancel_requested=${printingDetails.cancelRequested}`,
      );
    } else {
      console.warn(
        "⚠ Миграция supabase/workshop_print_queue_hardening.sql не применена: проверки оценок и отмены пропущены.",
      );
    }

    // 3. Опрос отмены ---------------------------------------------------------
    // Флаг ещё не поднят: агент обязан получить «печатай дальше», а не 404.
    const pollIdle = await callCancelPoll(authorized, `?jobId=${jobId}`);

    check(
      "GET: без просьбы об отмене → 200 и cancelRequested false",
      pollIdle.status === 200 && pollIdle.body.cancelRequested === false,
      `status=${pollIdle.status}, body=${JSON.stringify(pollIdle.body).slice(0, 200)}`,
    );

    const pollNoJobId = await callCancelPoll(authorized, "");

    check(
      "GET: без jobId → 400",
      pollNoJobId.status === 400,
      `status=${pollNoJobId.status}, body=${JSON.stringify(pollNoJobId.body).slice(0, 200)}`,
    );

    const pollUnknownJob = await callCancelPoll(
      authorized,
      `?jobId=${randomUUID()}`,
    );

    if (hardening) {
      check(
        "GET: неизвестное задание → 404",
        pollUnknownJob.status === 404,
        `status=${pollUnknownJob.status}, body=${JSON.stringify(pollUnknownJob.body).slice(0, 200)}`,
      );
    } else {
      // Без колонки-флага существующее задание от опечатки в id не отличить:
      // роут отвечает «не отменять» на любой jobId, и это осознанный размен.
      check(
        "GET без миграции: неизвестное задание → 200 и cancelRequested false",
        pollUnknownJob.status === 200 &&
          pollUnknownJob.body.cancelRequested === false,
        `status=${pollUnknownJob.status}, body=${JSON.stringify(pollUnknownJob.body).slice(0, 200)}`,
      );
    }

    const pollWrongToken = await callCancelPoll(
      { authorization: `Bearer ${randomUUID()}` },
      `?jobId=${jobId}`,
    );

    check(
      "GET: неверный токен → 401",
      pollWrongToken.status === 401,
      `status=${pollWrongToken.status}`,
    );

    // 4. Печать завершилась ---------------------------------------------------
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

    // 5. Ошибка печати: заказ возвращается в new, принтер — в error -----------
    // Ветка проверяется на том же задании после done: переход уже не реалистичен,
    // но роут обязан согласованно перевести все три строки.
    // `message` — текст агента для карточки: без него мастер видит «провалено» без
    // причины.
    const failureReason = "Bambu: FTPS ответил 530";
    const failed = await callStatus(authorized, {
      jobId,
      status: "failed",
      message: failureReason,
    });

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

    if (hardening) {
      const failedDetails = await readJobDetails(jobId);

      check(
        "failed: причина из message попала в last_error",
        failedDetails.lastError === failureReason &&
          failedDetails.finishedAt !== null,
        `last_error=${failedDetails.lastError}, finished_at=${failedDetails.finishedAt}`,
      );
    }

    // 6. Отказы ---------------------------------------------------------------
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

    // 7. Отмена мастером ------------------------------------------------------
    // Отмена проверяется на свежем задании: прежнее уже закрыто, а флаг
    // `cancel_requested` имеет смысл только у идущей печати. Без миграции
    // hardening ветки нет: статуса `cancelled` и колонки-флага в схеме нет.
    if (hardening) {
      const cancelTarget = await insertOne(
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
        "задание для отмены",
      );
      const cancelJobId = requireId(cancelTarget, "задание для отмены");

      const cancelPrinting = await callStatus(authorized, {
        jobId: cancelJobId,
        status: "printing",
        progress: 30,
      });

      check(
        "отмена: печать запущена (200)",
        cancelPrinting.status === 200 && cancelPrinting.body.success === true,
        `status=${cancelPrinting.status}, body=${JSON.stringify(cancelPrinting.body).slice(0, 200)}`,
      );

      const beforeCancel = await readJobDetails(cancelJobId);

      check(
        "отмена: до клика мастера флага нет",
        beforeCancel.cancelRequested === false &&
          beforeCancel.finishedAt === null,
        `cancel_requested=${beforeCancel.cancelRequested}, finished_at=${beforeCancel.finishedAt}`,
      );

      // Мастер нажал «Отменить печать».
      await requestCancel(cancelJobId);

      const pollCancel = await callCancelPoll(
        authorized,
        `?jobId=${cancelJobId}`,
      );

      check(
        "отмена: GET отдаёт cancelRequested true",
        pollCancel.status === 200 && pollCancel.body.cancelRequested === true,
        `status=${pollCancel.status}, body=${JSON.stringify(pollCancel.body).slice(0, 200)}`,
      );

      // Агент остановил принтер и доложил отмену, а не отказ.
      const cancelled = await callStatus(authorized, {
        jobId: cancelJobId,
        status: "cancelled",
      });

      check(
        "POST cancelled: 200 и success",
        cancelled.status === 200 && cancelled.body.success === true,
        `status=${cancelled.status}, body=${JSON.stringify(cancelled.body).slice(0, 200)}`,
      );

      const afterCancel = await readState(cancelJobId, orderId, printerId);

      check(
        "cancelled: задание cancelled (не failed)",
        afterCancel.jobStatus === "cancelled",
        `job=${afterCancel.jobStatus}`,
      );

      check(
        "cancelled: заказ вернулся в new",
        afterCancel.orderStatus === "new",
        `order=${afterCancel.orderStatus}`,
      );

      check(
        "cancelled: принтер idle, progress 0, remaining_time 0",
        afterCancel.printerStatus === "idle" &&
          afterCancel.progress === 0 &&
          afterCancel.remainingTime === 0,
        `printer=${afterCancel.printerStatus}, progress=${afterCancel.progress}, remaining_time=${afterCancel.remainingTime}`,
      );

      const cancelledDetails = await readJobDetails(cancelJobId);

      check(
        "cancelled: причина «отменено мастером», флаг снят, задание закрыто",
        cancelledDetails.lastError === "отменено мастером" &&
          cancelledDetails.cancelRequested === false &&
          cancelledDetails.finishedAt !== null,
        `last_error=${cancelledDetails.lastError}, cancel_requested=${cancelledDetails.cancelRequested}, finished_at=${cancelledDetails.finishedAt}`,
      );

      const pollAfterCancel = await callCancelPoll(
        authorized,
        `?jobId=${cancelJobId}`,
      );

      check(
        "cancelled: повторный опрос → cancelRequested false",
        pollAfterCancel.status === 200 &&
          pollAfterCancel.body.cancelRequested === false,
        `status=${pollAfterCancel.status}, body=${JSON.stringify(pollAfterCancel.body).slice(0, 200)}`,
      );
    }
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

