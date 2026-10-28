import { validateAgentToken } from "@/lib/agent-auth";
import { isWorkshopUuid } from "@/lib/db/workshop-types";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Статусы печати от локального агента 3D-фермы.
 *
 *   POST /api/agent/status
 *   Authorization: Bearer <agent_token>
 *   { "jobId": "<uuid>", "status": "printing" | "done" | "failed", "progress": 0…100 }
 *
 * Агент сообщает, что происходит с печатью, а роут переносит это на Канбан.
 * Три таблицы меняются вместе, иначе интерфейс показал бы «печатается» у
 * свободного принтера и заказ, который уже готов.
 *
 *   printing → задание printing, заказ printing, принтер printing (+progress);
 *   done     → задание done,     заказ ready,    принтер idle (progress = 0,
 *              remaining_time = 0);
 *   failed   → задание failed,   заказ new (мастер перезапустит), принтер error
 *              (progress = 0).
 *
 * Повторный запрос с тем же статусом безопасен: значения пишутся целиком, а не
 * приращиваются, поэтому агент может переспросить после таймаута.
 *
 * Чужое задание неотличимо от несуществующего: и то и другое — 404, чтобы по
 * ответу нельзя было проверить, есть ли задание у другой мастерской.
 */
export const runtime = "nodejs";

/** Статусы меняются сразу: кэшировать ответ нельзя. */
export const dynamic = "force-dynamic";

/** Статусы, которые вправе прислать агент; `queued` ставит только приложение. */
const AGENT_JOB_STATUSES = ["printing", "done", "failed"] as const;

type AgentJobStatus = (typeof AGENT_JOB_STATUSES)[number];

/** progress принтера — integer 0…100 (check workshop_printers_farm_fields_check). */
const PROGRESS_MIN = 0;
const PROGRESS_MAX = 100;

const MIGRATION_HINT =
  "Очередь печати недоступна: в базе нет нужных таблиц или колонок. Примените supabase/workshop_farm_and_shop.sql.";

type Row = Partial<Record<string, unknown>>;

/** Разобранное тело запроса. */
type StatusPayload = {
  jobId: string;
  status: AgentJobStatus;
  /** null — поле не передано, прогресс принтера не трогаем. */
  progress: number | null;
};

/** Итог разбора: либо данные, либо текст ошибки для 400. */
type ParsedPayload =
  | { payload: StatusPayload; error: null }
  | { payload: null; error: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAgentJobStatus(value: unknown): value is AgentJobStatus {
  return (
    typeof value === "string" &&
    (AGENT_JOB_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Разбор JSON-тела.
 *
 * Ошибки формата — 400 и понятный текст: агент пишет их в свой журнал, а
 * мастер видит, что именно не так, а не «ошибка 500».
 */
function parsePayload(value: unknown): ParsedPayload {
  if (!isObject(value)) {
    return { payload: null, error: "Тело запроса должно быть JSON-объектом." };
  }

  const jobId = typeof value.jobId === "string" ? value.jobId.trim() : "";

  if (!isWorkshopUuid(jobId)) {
    return { payload: null, error: "jobId указан неверно: нужен uuid задания." };
  }

  if (!isAgentJobStatus(value.status)) {
    return {
      payload: null,
      error: "status указан неверно: допустимы printing, done и failed.",
    };
  }

  let progress: number | null = null;

  // progress необязателен, но переданное значение проверяем: база отклонит
  // выход за 0…100, и агент получил бы 500 вместо понятной причины.
  if (value.progress !== undefined && value.progress !== null) {
    if (
      typeof value.progress !== "number" ||
      !Number.isFinite(value.progress) ||
      value.progress < PROGRESS_MIN ||
      value.progress > PROGRESS_MAX
    ) {
      return {
        payload: null,
        error: "progress указан неверно: нужно число от 0 до 100.",
      };
    }

    progress = Math.round(value.progress);
  }

  return { payload: { jobId, status: value.status, progress }, error: null };
}

function readRow(value: unknown): Row | null {
  return isObject(value) ? (value as Row) : null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/** Одинаковый ответ на «нет токена», «мусор» и «токен не найден». */
function unauthorized(): Response {
  return json({ error: "Токен агента не принят." }, 401);
}

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

/** Ошибки записи: отсутствие миграции отличаем от поломки базы. */
function writeFailure(
  error: SupabaseErrorLike,
  fallback: string,
): Response {
  console.error("Агент: статус не записан:", error.code, error.message);

  return isMissingTableSchema(error.code, error.message)
    ? json({ error: MIGRATION_HINT }, 503)
    : json({ error: fallback }, 500);
}

/**
 * Колонка заказа на Канбане: заказ идёт по цепочке
 * new → printing → ready → delivered, а `unmapped` ставит импорт маркетплейса.
 */
function orderStatusFor(status: AgentJobStatus): "new" | "printing" | "ready" {
  if (status === "printing") {
    return "printing";
  }

  return status === "done" ? "ready" : "new";
}

/** Поля принтера, которые меняет агент. */
type PrinterPatch = {
  status: "printing" | "idle" | "error";
  progress?: number;
  remaining_time?: number;
};

function printerPatchFor(payload: StatusPayload): PrinterPatch {
  if (payload.status === "printing") {
    // progress не передан — оставляем на принтере прошлое значение: агент
    // сообщил только начало печати и ещё не знает процентов.
    return payload.progress === null
      ? { status: "printing" }
      : { status: "printing", progress: payload.progress };
  }

  if (payload.status === "done") {
    return { status: "idle", progress: 0, remaining_time: 0 };
  }

  return { status: "error", progress: 0 };
}

export async function POST(request: Request): Promise<Response> {
  const identity = await validateAgentToken(request);

  if (!identity) {
    return unauthorized();
  }

  // Тело может быть не JSON вовсе — это 400, а не исключение роута.
  const body: unknown = await request.json().catch(() => null);
  const parsed = parsePayload(body);

  if (!parsed.payload) {
    return json({ error: parsed.error }, 400);
  }

  const payload = parsed.payload;

  let supabase: ReturnType<typeof createAdminClient>;

  try {
    supabase = createAdminClient();
  } catch (error) {
    console.error(
      "Агент: клиент service_role не создан:",
      error instanceof Error ? error.message : error,
    );

    return json({ error: "Сервер не настроен для агента фермы." }, 500);
  }

  // 1. Задание этой мастерской? Заодно узнаём заказ и принтер, чтобы не делать
  // второй запрос и не обновить чужие строки по угаданному id.
  const jobResult = await supabase
    .from("workshop_print_jobs")
    .select("id, order_id, printer_id")
    .eq("id", payload.jobId)
    .eq("user_id", identity.userId)
    .maybeSingle();

  if (jobResult.error) {
    console.error(
      "Агент: задание не прочитано:",
      jobResult.error.code,
      jobResult.error.message,
    );

    return isMissingTableSchema(jobResult.error.code, jobResult.error.message)
      ? json({ error: MIGRATION_HINT }, 503)
      : json({ error: "Задание не прочитано." }, 500);
  }

  const job = readRow(jobResult.data);

  if (!job || !isWorkshopUuid(job.order_id)) {
    return json({ error: "Задание не найдено." }, 404);
  }

  // 2. Само задание.
  const jobUpdate = await supabase
    .from("workshop_print_jobs")
    .update({ status: payload.status })
    .eq("id", payload.jobId)
    .eq("user_id", identity.userId);

  if (jobUpdate.error) {
    return writeFailure(jobUpdate.error, "Статус задания не записан.");
  }

  // 3. Заказ на Канбане.
  const orderUpdate = await supabase
    .from("workshop_orders")
    .update({ status: orderStatusFor(payload.status) })
    .eq("id", job.order_id)
    .eq("user_id", identity.userId);

  if (orderUpdate.error) {
    return writeFailure(orderUpdate.error, "Статус заказа не записан.");
  }

  // 4. Принтер: задание могли поставить в очередь без него, тогда обновлять
  // нечего.
  const printerId = job.printer_id;

  if (isWorkshopUuid(printerId)) {
    const printerUpdate = await supabase
      .from("workshop_printers")
      .update(printerPatchFor(payload))
      .eq("id", printerId)
      .eq("user_id", identity.userId);

    if (printerUpdate.error) {
      return writeFailure(
        printerUpdate.error,
        "Состояние принтера не записано.",
      );
    }
  }

  return json({ success: true });
}
