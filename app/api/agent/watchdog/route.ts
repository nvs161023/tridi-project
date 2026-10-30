/**
 * Watchdog зависших заданий печати: `POST /api/agent/watchdog`.
 *
 * Зачем: статус `printing` ставит только агент. Если он упал, компьютер уснул
 * или принтер потерял питание, задание остаётся `printing` навсегда: заказ
 * висит в «В печати», повторную постановку той же позиции блокирует частичный
 * уникальный индекс, а просьбу об отмене выполнять некому. Раньше это лечилось
 * только SQL руками.
 *
 * Правило: задание зависло, если с `started_at` прошло больше расчётного
 * времени печати задания (`estimated_seconds` слайсера) плюс 10 %, а если
 * оценки нет — больше суток. Прогресс не учитывается: замерший на 42 % принтер
 * продолжает выглядеть печатающим.
 *
 * Что меняет: задание → `failed` с текстом «Превышено расчетное время печати.
 * Возможно, принтер отключился.», принтер задания → `error` (так же, как при
 * отказе от агента). Заказ возвращается в «Новые», когда других активных
 * заданий у него не осталось: с миграцией `workshop_print_queue_hardening.sql`
 * это делает триггер `workshop_print_jobs_sync_order`, без неё — сам роут.
 *
 * Защита: `Authorization: Bearer <CRON_SECRET>` — тот же секрет, что у
 * ежедневного отчёта (`lib/cron-auth.ts`, сравнение через `timingSafeEqual`).
 *
 * Вызов по расписанию (раз в час):
 *   curl -fsS -X POST "https://tridi-print.ru/api/agent/watchdog" \
 *     -H "Authorization: Bearer $CRON_SECRET"
 *
 * Ответ: `{ checked, stuck, hardened, jobs, errors }`. Повторный запуск
 * безопасен: закрытое задание в выборку `printing` не попадает, а обновление
 * задания дополнительно ограничено условием `status = 'printing'` — два
 * одновременных запуска не закроют одно задание дважды.
 */
import { isCronAuthorized } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import {
  overduePrintMs,
  readStuckPrintJob,
  STUCK_PRINT_MESSAGE,
  type StuckPrintJob,
} from "@/lib/workshop/stuck-print-jobs";

/** Supabase service_role работает только в Node.js. */
export const runtime = "nodejs";

/** Очередь меняется постоянно: ответ кэшировать нельзя. */
export const dynamic = "force-dynamic";

/** Сколько заданий разбираем за один запуск: защита от гигантской выборки. */
const STUCK_LIMIT = 200;

const MIGRATION_HINT =
  "Очередь печати недоступна: в базе нет таблицы workshop_print_jobs. Примените supabase/workshop_farm_and_shop.sql.";

/** Колонки, которые есть уже в `workshop_farm_and_shop.sql`. */
const BASE_COLUMNS = "id, user_id, order_id, printer_id, created_at, updated_at";

/** Колонки из `workshop_print_queue_hardening.sql`: метка старта и оценка. */
const HARDENED_COLUMNS = `${BASE_COLUMNS}, started_at, estimated_seconds`;

type Row = Partial<Record<string, unknown>>;

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function describe(error: SupabaseErrorLike): string {
  return [error.code, error.message].filter(Boolean).join(" ") || "неизвестная ошибка";
}

/**
 * 42703 — «колонки нет»: миграция hardening не применена. Отдельная проверка
 * нужна потому, что `isMissingTableSchema` отвечает за таблицы и кэш схемы, а
 * здесь таблица есть, а новых колонок в ней нет.
 */
function isMissingColumn(error: SupabaseErrorLike): boolean {
  return error.code === "42703";
}

/**
 * Вернуть заказ в «Новые», если активных заданий у него не осталось.
 *
 * Нужно только базе без миграции hardening: с ней переход делает триггер
 * `workshop_print_jobs_sync_order` в одной транзакции с записью задания. Считаем
 * так же, как статусный роут: заказ с несколькими позициями закрывается лишь
 * тогда, когда последнее активное задание снято.
 */
async function moveOrderBackToNew(
  supabase: ReturnType<typeof createAdminClient>,
  job: StuckPrintJob,
): Promise<string | null> {
  if (job.orderId === null) {
    return null;
  }

  const remaining = await supabase
    .from("workshop_print_jobs")
    .select("id", { count: "exact", head: true })
    .eq("order_id", job.orderId)
    .eq("user_id", job.userId)
    .neq("id", job.id)
    .in("status", ["queued", "printing"]);

  if (remaining.error) {
    return `Заказ ${job.orderId}: ${describe(remaining.error)}`;
  }

  if ((remaining.count ?? 0) > 0) {
    return null;
  }

  const orderUpdate = await supabase
    .from("workshop_orders")
    .update({ status: "new" })
    .eq("id", job.orderId)
    .eq("user_id", job.userId);

  return orderUpdate.error
    ? `Заказ ${job.orderId}: ${describe(orderUpdate.error)}`
    : null;
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    return json(
      { error: "CRON_SECRET не задан: watchdog не может проверить запрос." },
      503,
    );
  }

  if (!isCronAuthorized(request, secret)) {
    return json({ error: "Неверный или отсутствующий токен." }, 401);
  }

  let supabase: ReturnType<typeof createAdminClient>;

  try {
    supabase = createAdminClient();
  } catch (error) {
    console.error(
      "[watchdog] Клиент service_role не создан:",
      error instanceof Error ? error.message : error,
    );

    return json({ error: "Сервер не настроен: нет ключа service_role." }, 500);
  }

  const runQuery = (columns: string) =>
    supabase
      .from("workshop_print_jobs")
      .select(columns)
      .eq("status", "printing")
      .order("updated_at", { ascending: true })
      .limit(STUCK_LIMIT);

  let queue = await runQuery(HARDENED_COLUMNS);
  let hardened = true;

  if (queue.error && isMissingColumn(queue.error)) {
    hardened = false;
    queue = await runQuery(BASE_COLUMNS);
  }

  if (queue.error) {
    console.error(
      "[watchdog] Очередь не прочитана:",
      queue.error.code,
      queue.error.message,
    );

    // Без миграции таблицы нет вовсе — следить не за чем. Это не поломка, и
    // планировщик не должен получать 500 на каждом запуске.
    if (isMissingTableSchema(queue.error.code, queue.error.message)) {
      return json({
        checked: 0,
        stuck: 0,
        hardened,
        jobs: [],
        errors: [],
        ignored: MIGRATION_HINT,
      });
    }

    return json({ error: "Очередь печати не прочитана." }, 500);
  }

  const rows = Array.isArray(queue.data) ? (queue.data as unknown as Row[]) : [];
  const now = Date.now();
  const errors: string[] = [];
  const stuckJobs: Array<{
    jobId: string;
    printerId: string | null;
    overdueSeconds: number;
  }> = [];

  for (const row of rows) {
    const job = readStuckPrintJob(row);
    const overdueMs = job === null ? null : overduePrintMs(job, now);

    if (!job || overdueMs === null) {
      continue;
    }

    // Условие `status = 'printing'` — защита от гонки: пока считали, агент мог
    // сам закрыть задание. Тогда обновление не найдёт строку и мы её пропустим.
    const jobUpdate = await supabase
      .from("workshop_print_jobs")
      .update(
        hardened
          ? { status: "failed", last_error: STUCK_PRINT_MESSAGE }
          : { status: "failed" },
      )
      .eq("id", job.id)
      .eq("user_id", job.userId)
      .eq("status", "printing")
      .select("id")
      .maybeSingle();

    if (jobUpdate.error) {
      errors.push(`Задание ${job.id}: ${describe(jobUpdate.error)}`);
      continue;
    }

    if (!jobUpdate.data) {
      continue;
    }

    if (job.printerId !== null) {
      const printerUpdate = await supabase
        .from("workshop_printers")
        .update({ status: "error", progress: 0 })
        .eq("id", job.printerId)
        .eq("user_id", job.userId);

      if (printerUpdate.error) {
        errors.push(`Принтер ${job.printerId}: ${describe(printerUpdate.error)}`);
      }
    }

    if (!hardened) {
      const orderError = await moveOrderBackToNew(supabase, job);

      if (orderError !== null) {
        errors.push(orderError);
      }
    }

    const overdueSeconds = Math.round(overdueMs / 1000);

    console.warn(
      `[watchdog] Задание ${job.id} снято с печати: просрочка ${overdueSeconds} с`,
    );
    stuckJobs.push({ jobId: job.id, printerId: job.printerId, overdueSeconds });
  }

  return json({
    checked: rows.length,
    stuck: stuckJobs.length,
    hardened,
    jobs: stuckJobs,
    errors,
  });
}
