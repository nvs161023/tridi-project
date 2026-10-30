import { validateAgentToken } from "@/lib/agent-auth";
import { isWorkshopUuid } from "@/lib/db/workshop-types";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Статусы печати от локального агента 3D-фермы.
 *
 *   POST /api/agent/status
 *   Authorization: Bearer <agent_token>
 *   {
 *     "jobId": "<uuid>",
 *     "status": "printing" | "done" | "failed" | "cancelled",
 *     "progress": 0…100,
 *     "message": "почему не вышло",
 *     "estimatedSeconds": 7500,
 *     "filamentGrams": 42.5
 *   }
 *
 *   GET /api/agent/status?jobId=<uuid>
 *   → { "cancelRequested": true | false }
 *
 * POST: агент сообщает, что происходит с печатью, а роут переносит это на
 * Канбан и на принтер. Заказ двигает триггер `workshop_print_jobs_sync_order`
 * (одна транзакция с записью задания и событием журнала); пока миграция
 * `workshop_print_queue_hardening.sql` не применена, роут делает это сам —
 * иначе карточка показывала бы «печатается» у свободного принтера.
 *
 * У заказа бывает несколько заданий — по одному на позицию. Поэтому `done`,
 * `failed` и `cancelled` переносят заказ на Канбан только тогда, когда других
 * активных заданий не осталось: иначе первая напечатанная позиция закрывала бы
 * весь заказ, а остальные ещё стояли бы в очереди.
 *
 *   printing  → задание printing, принтер printing (+progress);
 *   done      → задание done,     принтер idle (progress = 0, remaining_time = 0);
 *   failed    → задание failed,   принтер error (progress = 0);
 *   cancelled → задание cancelled, принтер idle: печать остановил мастер, это не
 *               поломка и не повод красить принтер в ошибку.
 *
 * `message` — причина отказа словами агента («Bambu: FTPS ответил 530»). Роут
 * кладёт её в `workshop_print_jobs.last_error`, и карточка заказа показывает
 * причину, а не «провалено». `estimatedSeconds`/`filamentGrams` — оценка из
 * самого G-кода: агент присылает её со стартом печати, карточка показывает
 * «≈2 ч 5 мин» и расход пластика.
 *
 * Повторный запрос с тем же статусом безопасен: значения пишутся целиком, а не
 * приращиваются, поэтому агент может переспросить после таймаута.
 *
 * GET — опрос просьбы об отмене: мастер нажал «Отменить печать», база подняла
 * `cancel_requested`, агент останавливает принтер на следующем опросе. Ответ
 * всегда 200 с `false`, если просьбы нет: сетевые сбои не должны гасить печать.
 *
 * Чужое задание неотличимо от несуществующего: и то и другое — 404, чтобы по
 * ответу нельзя было проверить, есть ли задание у другой мастерской. Пока
 * миграция `workshop_print_queue_hardening.sql` не применена, колонки-флага в
 * таблице нет: отличить существующее задание от опечатки в id нечем, и роут
 * отвечает `false` на любой `jobId` — печать важнее точности 404.
 */
export const runtime = "nodejs";

/** Статусы меняются сразу: кэшировать ответ нельзя. */
export const dynamic = "force-dynamic";

/**
 * Статусы, которые вправе прислать агент; `queued` ставит только приложение.
 *
 * `cancelled` появился вместе с кнопкой «Отменить печать»: агент останавливает
 * принтер и закрывает задание отменой, а не отказом, — иначе отмены попадали бы
 * в статистику поломок.
 */
const AGENT_JOB_STATUSES = ["printing", "done", "failed", "cancelled"] as const;

type AgentJobStatus = (typeof AGENT_JOB_STATUSES)[number];

/** progress принтера — integer 0…100 (check workshop_printers_farm_fields_check). */
const PROGRESS_MIN = 0;
const PROGRESS_MAX = 100;

/** check workshop_print_jobs_last_error_check: от 1 до 500 символов. */
const STATUS_MESSAGE_MAX = 500;

/** check workshop_print_jobs_estimated_seconds_check: от 1 секунды до года. */
const ESTIMATED_SECONDS_MAX = 31_536_000;

/** check workshop_print_jobs_filament_grams_check: больше нуля, до 100 кг. */
const FILAMENT_GRAMS_MAX = 100_000;

const MIGRATION_HINT =
  "Очередь печати недоступна: в базе нет нужных таблиц или колонок. Примените supabase/workshop_farm_and_shop.sql.";

type Row = Partial<Record<string, unknown>>;

/** Разобранное тело запроса. */
type StatusPayload = {
  jobId: string;
  status: AgentJobStatus;
  /** null — поле не передано, прогресс принтера не трогаем. */
  progress: number | null;
  /** Причина отказа словами агента; null — причина не передана. */
  message: string | null;
  /** Оценка слайсера, секунды; null — агент её не прислал. */
  estimatedSeconds: number | null;
  /** Расход пластика, граммы; null — агент его не прислал. */
  filamentGrams: number | null;
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
      error:
        "status указан неверно: допустимы printing, done, failed и cancelled.",
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

  // Причина отказа: обрезаем до 500 символов, как char_length в базе. Пустая
  // строка — это «причины нет», а не причина из нуля байт.
  let message: string | null = null;

  if (value.message !== undefined && value.message !== null) {
    if (typeof value.message !== "string") {
      return {
        payload: null,
        error: "message указан неверно: нужна строка с причиной отказа.",
      };
    }

    const text = value.message.trim().slice(0, STATUS_MESSAGE_MAX);
    message = text || null;
  }

  // Оценки слайсера необязательны и проверяются на диапазон: check-констрейнт
  // в базе отверг бы 0 и отрицательные значения, а агент получил бы 500.
  let estimatedSeconds: number | null = null;

  if (value.estimatedSeconds !== undefined && value.estimatedSeconds !== null) {
    if (
      typeof value.estimatedSeconds !== "number" ||
      !Number.isFinite(value.estimatedSeconds) ||
      value.estimatedSeconds < 1 ||
      value.estimatedSeconds > ESTIMATED_SECONDS_MAX
    ) {
      return {
        payload: null,
        error: "estimatedSeconds указан неверно: нужно число секунд от 1 до 31536000.",
      };
    }

    estimatedSeconds = Math.round(value.estimatedSeconds);
  }

  let filamentGrams: number | null = null;

  if (value.filamentGrams !== undefined && value.filamentGrams !== null) {
    if (
      typeof value.filamentGrams !== "number" ||
      !Number.isFinite(value.filamentGrams) ||
      value.filamentGrams <= 0 ||
      value.filamentGrams > FILAMENT_GRAMS_MAX
    ) {
      return {
        payload: null,
        error: "filamentGrams указан неверно: нужно число граммов от 0 до 100000.",
      };
    }

    // numeric(10, 2): округляем до сотых, иначе база сделает это молча.
    filamentGrams = Math.round(value.filamentGrams * 100) / 100;
  }

  return {
    payload: {
      jobId,
      status: value.status,
      progress,
      message,
      estimatedSeconds,
      filamentGrams,
    },
    error: null,
  };
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
 *
 * Отмена и отказ возвращают заказ в «Новые»: печать не состоялась, и мастер
 * должен увидеть заказ на доске, а не в «Печатается». Применяется только в
 * режиме без триггера — с миграцией hardening заказ двигает база.
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

  // Отмена — не поломка: принтер остановлен и свободен, красный «error» врал бы
  // о состоянии железа. remaining_time тоже сбрасываем: печати больше нет.
  if (payload.status === "cancelled") {
    return { status: "idle", progress: 0, remaining_time: 0 };
  }

  return { status: "error", progress: 0 };
}

/** Поля задания, которые пишет POST. */
type JobPatch = {
  status: AgentJobStatus;
  /** Причина отказа; только для failed/cancelled — у done и printing её нет. */
  last_error?: string;
  estimated_seconds?: number;
  filament_grams?: number;
};

/**
 * Патч задания: без `message` у успешных статусов.
 *
 * `last_error` пишется только у failed/cancelled. Если писать его всегда, то
 * повторный «printing» после отказа затирал бы причину, которую мастер ещё не
 * прочитал, а триггер журнала записал бы её в событие запуска.
 */
function jobPatchFor(payload: StatusPayload): JobPatch {
  const patch: JobPatch = { status: payload.status };

  if (payload.message && payload.status !== "printing" && payload.status !== "done") {
    patch.last_error = payload.message;
  }

  if (payload.estimatedSeconds !== null) {
    patch.estimated_seconds = payload.estimatedSeconds;
  }

  if (payload.filamentGrams !== null) {
    patch.filament_grams = payload.filamentGrams;
  }

  return patch;
}

/** Колонки задания, которые нужны POST: заказ, принтер и флаг миграции. */
const JOB_COLUMNS = "id, order_id, printer_id";
const JOB_COLUMNS_HARDENED = `${JOB_COLUMNS}, cancel_requested`;

/**
 * 42703 — «колонки нет»: миграция hardening не применена. Отдельная проверка
 * нужна потому, что isMissingTableSchema отвечает только за таблицы/кэш схемы,
 * а здесь таблица есть, а новых колонок в ней нет.
 */
function isMissingColumn(error: SupabaseErrorLike): boolean {
  return error.code === "42703";
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
  //
  // Запрашиваем колонку hardening: по её наличию видно, применена ли миграция.
  // Это единственный способ узнать, двигает ли заказ триггер, — иначе роут
  // дублировал бы переходы Канбана и мог разойтись с базой.
  let jobResult = await supabase
    .from("workshop_print_jobs")
    .select(JOB_COLUMNS_HARDENED)
    .eq("id", payload.jobId)
    .eq("user_id", identity.userId)
    .maybeSingle();

  let hardening = true;

  if (jobResult.error && isMissingColumn(jobResult.error)) {
    hardening = false;
    jobResult = await supabase
      .from("workshop_print_jobs")
      .select(JOB_COLUMNS)
      .eq("id", payload.jobId)
      .eq("user_id", identity.userId)
      .maybeSingle();
  }

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

  // 2. Само задание вместе с причиной отказа и оценками слайсера.
  //
  // Без миграции hardening колонок нет: пишем только статус, а причину и оценки
  // теряем — это лучше, чем ответить 500 и оставить заказ в «Печатается».
  // Старый check статусов тоже не знает `cancelled`, поэтому отмена до миграции
  // закрывается как `failed`.
  const jobPatch: JobPatch = hardening
    ? jobPatchFor(payload)
    : {
        status: payload.status === "cancelled" ? "failed" : payload.status,
      };

  const jobUpdate = await supabase
    .from("workshop_print_jobs")
    .update(jobPatch)
    .eq("id", payload.jobId)
    .eq("user_id", identity.userId);

  if (jobUpdate.error) {
    return writeFailure(jobUpdate.error, "Статус задания не записан.");
  }

  // 3. Заказ на Канбане — только если триггера нет: с миграцией hardening
  // задание, заказ и событие журнала меняются одной транзакцией базы.
  //
  // У заказа может быть несколько заданий — по одному на позицию. Закрывающий
  // статус поэтому двигает заказ только в том случае, когда это задание
  // последнее активное: иначе первая завершённая позиция уводила бы в «Готово»
  // заказ, который ещё печатается. Триггер hardening считает так же, а без
  // миграции расчёт лежит на роуте.
  if (!hardening) {
    let shouldMoveOrder = payload.status === "printing";

    if (!shouldMoveOrder) {
      const remaining = await supabase
        .from("workshop_print_jobs")
        .select("id", { count: "exact", head: true })
        .eq("order_id", job.order_id)
        .eq("user_id", identity.userId)
        .neq("id", payload.jobId)
        .in("status", ["queued", "printing"]);

      if (remaining.error) {
        return writeFailure(remaining.error, "Очередь заказа не прочитана.");
      }

      shouldMoveOrder = (remaining.count ?? 0) === 0;
    }

    if (shouldMoveOrder) {
      const orderUpdate = await supabase
        .from("workshop_orders")
        .update({ status: orderStatusFor(payload.status) })
        .eq("id", job.order_id)
        .eq("user_id", identity.userId);

      if (orderUpdate.error) {
        return writeFailure(orderUpdate.error, "Статус заказа не записан.");
      }
    }
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

/**
 * Опрос просьбы об отмене: `GET /api/agent/status?jobId=<uuid>`.
 *
 * Агент спрашивает между срезами прогресса. Ответ `{"cancelRequested": false}`
 * на любой неясности (нет флага в базе, нет задания, сбой чтения) — намеренно:
 * гасить печать из-за сетевого сбоя или чужого `jobId` нельзя. 404 остаётся
 * только для «задания нет вовсе», чтобы агент мог отличить опечатку в id от
 * «печатай дальше».
 *
 * Просьбу снимает сервер, а не агент: статус `cancelled`/`failed` от агента
 * сбрасывает флаг. Поэтому повторный опрос после остановки вернёт false.
 */
export async function GET(request: Request): Promise<Response> {
  const identity = await validateAgentToken(request);

  if (!identity) {
    return unauthorized();
  }

  const jobId = new URL(request.url).searchParams.get("jobId")?.trim() ?? "";

  if (!isWorkshopUuid(jobId)) {
    return json({ error: "jobId указан неверно: нужен uuid задания." }, 400);
  }

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

  const result = await supabase
    .from("workshop_print_jobs")
    .select("id, cancel_requested")
    .eq("id", jobId)
    .eq("user_id", identity.userId)
    .maybeSingle();

  if (result.error) {
    // Нет колонки или таблицы — отмены ещё не поддерживаются. Печать важнее:
    // ответ «не отменять», а причина уходит в журнал сервера.
    if (
      isMissingColumn(result.error) ||
      isMissingTableSchema(result.error.code, result.error.message)
    ) {
      console.warn(
        "Агент: флаг отмены не прочитан, продолжаем печать. Примените supabase/workshop_print_queue_hardening.sql:",
        result.error.code,
        result.error.message,
      );

      return json({ cancelRequested: false });
    }

    console.error(
      "Агент: флаг отмены не прочитан:",
      result.error.code,
      result.error.message,
    );

    return json({ error: "Просьба об отмене не прочитана." }, 500);
  }

  const job = readRow(result.data);

  if (!job) {
    return json({ error: "Задание не найдено." }, 404);
  }

  return json({ cancelRequested: job.cancel_requested === true });
}
