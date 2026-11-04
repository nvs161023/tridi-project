/**
 * Чтение принтеров для страницы `/dashboard/workshop`.
 *
 * Миграцию `supabase/workshop_printers_orders.sql` применяют вручную, поэтому
 * таблицы может не быть в живой базе. Как и со складом, это не повод падать:
 * вкладка «Принтеры» показывается пустой и с предупреждением, а остальные
 * разделы Мастерской продолжают работать.
 */
import { isWorkshopUuid } from "@/lib/db/workshop-types";
import type { createClient } from "@/lib/supabase/server";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import type { ActiveJobTiming, ActiveOrderJobs } from "@/lib/workshop/stuck-print-jobs";
import {
  PRINTER_BASE_COLUMNS,
  PRINTER_COLUMNS,
  isPrinterId,
  normalizeDiscoveredPrinterRow,
  normalizePrinterRow,
  type DiscoveredPrinter,
  type PrinterActiveJobs,
  type PrinterLastErrors,
  type WorkshopPrinter,
} from "@/lib/workshop/printers";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type WorkshopPrintersSnapshot = {
  printers: WorkshopPrinter[];
  /** Названия заказов, которые печатаются сейчас: `printer_id` → title. */
  activeJobs: PrinterActiveJobs;
  /**
   * Активные задания по заказам: `order_id` → задание.
   *
   * Доске заказов нужны id задания и метки этапов: по ним видно, что печать
   * висит, и можно закрыть её силой, не дожидаясь ответа принтера.
   */
  orderJobs: ActiveOrderJobs;
  /** Причина последнего отказа: `printer_id` → текст от агента. */
  lastErrors: PrinterLastErrors;
  /** В базе нет таблицы workshop_printers — миграция не применена. */
  isMissingTable: boolean;
};

/** Статусы, в которых задание считается живым: печать идёт, ждёт или стоит. */
const ACTIVE_JOB_STATUSES = ["queued", "printing", "paused"] as const;

/** Колонки задания без миграции hardening: метка старта берётся из created_at. */
const BASIC_ORDER_JOB_COLUMNS = "id, order_id, status, created_at";

/** Колонки задания с миграцией hardening: точные метки этапов и просьба отмены. */
const DETAILED_ORDER_JOB_COLUMNS =
  "id, order_id, status, queued_at, started_at, cancel_requested";

/**
 * Колонки задания вместе с прогрессом печати.
 *
 * `progress`/`remaining_time` появились позже остальных колонок hardening,
 * поэтому идут отдельным набором: база со старой миграцией ответит на общий
 * запрос 42703, и читатель потерял бы точные метки этапов вместе с полоской.
 */
const PROGRESS_ORDER_JOB_COLUMNS = `${DETAILED_ORDER_JOB_COLUMNS}, progress, remaining_time`;

/** Наборы колонок от нового к старому: читается первый, ответивший без 42703. */
const ORDER_JOB_COLUMN_SETS = [
  PROGRESS_ORDER_JOB_COLUMNS,
  DETAILED_ORDER_JOB_COLUMNS,
  BASIC_ORDER_JOB_COLUMNS,
] as const;

/** Строка активного задания после разбора: всё, кроме счётчика заданий. */
type ActiveJobRowTiming = Omit<ActiveJobTiming, "jobsCount">;

/** Старшинство статусов: печать важнее паузы, пауза — очереди. */
const ACTIVE_STATUS_RANK: Record<ActiveJobTiming["status"], number> = {
  printing: 0,
  paused: 1,
  queued: 2,
};

/**
 * Активные задания по заказам: `order_id` → задание.
 *
 * Доске заказов нужны id задания (по нему закрывают зависшее), состояние,
 * метки этапов, прогресс и остаток печати. `getActivePrinterJobs` для этого не
 * годится: там ключ — принтер, а название заказа вместо времени.
 *
 * `queued_at`/`started_at` появляются миграцией `workshop_print_queue_hardening`,
 * `progress`/`remaining_time` — её более поздней версией. Колонки читаются
 * наборами от нового к старому: пока миграцию не применили, запрос падает на
 * 42703, и остаются `created_at` и нулевой прогресс — карточка покажет кнопку
 * позже и без полоски, но не соврёт о времени. Нет таблицы вовсе (миграция farm
 * не применена) — пустая карта без предупреждения: это ожидаемое состояние.
 */
export async function getActiveOrderJobs(
  supabase: Supabase,
  userId: string,
): Promise<ActiveOrderJobs> {
  let result: {
    data: unknown;
    error: { code?: string | null; message?: string | null } | null;
  } = { data: null, error: null };

  for (const columns of ORDER_JOB_COLUMN_SETS) {
    result = await supabase
      .from("workshop_print_jobs")
      .select(columns)
      .eq("user_id", userId)
      .in("status", ACTIVE_JOB_STATUSES);

    // Колонки не найдены — пробуем более старый набор. Остальные ошибки (нет
    // таблицы, сеть) повторным запросом не лечатся.
    if (!result.error || !isMissingColumnSchema(result.error)) {
      break;
    }
  }

  if (result.error) {
    if (!isMissingTableSchema(result.error.code, result.error.message)) {
      console.warn(
        "Активные задания заказов не прочитаны:",
        result.error.code,
        result.error.message,
      );
    }

    return {};
  }

  const rows = (result.data ?? []) as Partial<Record<string, unknown>>[];
  // Заказ может печататься сразу на нескольких принтерах: у трёх позиций будет
  // три задания, а карточке нужно одно.
  const orders = new Map<string, ActiveJobRowTiming[]>();

  for (const row of rows) {
    if (!isWorkshopUuid(row.id) || !isWorkshopUuid(row.order_id)) {
      continue;
    }

    const orderJobs = orders.get(row.order_id) ?? [];

    orderJobs.push({
      id: row.id,
      status:
        row.status === "printing" || row.status === "paused"
          ? row.status
          : "queued",
      queuedAt: readTimestamp(row.queued_at) ?? readTimestamp(row.created_at),
      startedAt: readTimestamp(row.started_at),
      cancelRequested: row.cancel_requested === true,
      progress: readPercent(row.progress),
      remainingSeconds: readRemainingSeconds(row.remaining_time),
    });

    orders.set(row.order_id, orderJobs);
  }

  const jobs: ActiveOrderJobs = {};

  for (const [orderId, orderJobs] of orders) {
    jobs[orderId] = aggregateActiveJobs(orderJobs);
  }

  return jobs;
}

/**
 * Несколько заданий заказа → одно для карточки.
 *
 * Представитель — задание дальше всех по этапу (печать, затем пауза, затем
 * очередь), при равенстве — раньше дошедшее до своего этапа: если из трёх
 * позиций одна печатается, а другая висит, карточка должна говорить о той, что
 * идёт.
 *
 * Прогресс — среднее по активным заданиям, остаток — самый долгий: заказ готов,
 * когда допечатано последнее задание. `jobsCount` нужен, чтобы подпись
 * «Заданий в работе: 3» объясняла, откуда среднее. Просьба отмены берётся с
 * любого задания: мастер нажал кнопку, и она не должна потеряться.
 */
function aggregateActiveJobs(orderJobs: ActiveJobRowTiming[]): ActiveJobTiming {
  const [first, ...rest] = orderJobs;

  let primary = first;
  let cancelRequested = first.cancelRequested;
  let progressSum = first.progress;
  let remainingSeconds = first.remainingSeconds;
  let jobsCount = 1;

  for (const job of rest) {
    if (compareActiveStages(job, primary) < 0) {
      primary = job;
    }

    cancelRequested = cancelRequested || job.cancelRequested;
    progressSum += job.progress;
    jobsCount += 1;

    if (
      job.remainingSeconds !== null &&
      (remainingSeconds === null || job.remainingSeconds > remainingSeconds)
    ) {
      remainingSeconds = job.remainingSeconds;
    }
  }

  return {
    id: primary.id,
    status: primary.status,
    queuedAt: primary.queuedAt,
    startedAt: primary.startedAt,
    cancelRequested,
    progress: Math.round(progressSum / jobsCount),
    remainingSeconds,
    jobsCount,
  };
}

/**
 * Порядок заданий: печать раньше паузы, пауза раньше очереди; внутри статуса
 * раньше то, что раньше дошло до этапа (старт печати важнее постановки).
 */
function compareActiveStages(
  left: ActiveJobRowTiming,
  right: ActiveJobRowTiming,
): number {
  const byStatus =
    ACTIVE_STATUS_RANK[left.status] - ACTIVE_STATUS_RANK[right.status];

  return byStatus !== 0 ? byStatus : compareStageTime(left, right);
}

/** Сравнение меток этапа: задание без метки уходит в конец. */
function compareStageTime(
  left: ActiveJobRowTiming,
  right: ActiveJobRowTiming,
): number {
  const leftTime = stageTime(left);
  const rightTime = stageTime(right);

  if (leftTime === rightTime) {
    return 0;
  }

  if (leftTime === null) {
    return 1;
  }

  if (rightTime === null) {
    return -1;
  }

  return leftTime - rightTime;
}

/** Время этапа задания в мс: старт печати, иначе постановка в очередь. */
function stageTime(job: ActiveJobRowTiming): number | null {
  const stamp = job.startedAt ?? job.queuedAt;

  if (stamp === null) {
    return null;
  }

  const time = Date.parse(stamp);

  return Number.isNaN(time) ? null : time;
}

/** Метка времени из строки базы: null — значения нет или оно не дата. */
function readTimestamp(value: unknown): string | null {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
    ? value
    : null;
}

/** Число из строки базы: null — значения нет, оно не число или это NaN. */
function readNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

/** Прогресс из строки базы, %: 0…100, мусор и отсутствие — 0. */
function readPercent(value: unknown): number {
  const percent = readNumber(value);

  return percent === null ? 0 : Math.min(100, Math.max(0, Math.round(percent)));
}

/** Остаток печати из строки базы, с: 0 и мусор — «время до конца неизвестно». */
function readRemainingSeconds(value: unknown): number | null {
  const seconds = readNumber(value);

  return seconds !== null && seconds > 0 ? Math.round(seconds) : null;
}

/**
 * Строка задания с вложенным заказом: связь названа явно, чтобы PostgREST не
 * гадал. Вложенность бывает и объектом, и массивом из одной записи — тип
 * Supabase-клиента без сгенерированной схемы описывает её массивом.
 */
type ActiveJobRow = {
  printer_id: string | null;
  order: { title: string | null } | { title: string | null }[] | null;
};

/**
 * Заказы, которые печатаются прямо сейчас.
 *
 * Название заказа лежит не в принтере: его даёт связь
 * `workshop_print_jobs` → `workshop_orders` по `order_id`. Имя ограничения
 * указано явно — у задания несколько внешних ключей, и без подсказки PostgREST
 * однажды ответит PGRST201 «ambiguous embedding».
 *
 * `paused` ищется вместе с `printing`: карточка принтера показывает, что на нём
 * стоит, а на паузе станок всё ещё занят тем же заказом.
 *
 * Без миграции `workshop_farm_and_shop.sql` таблицы заданий нет: карточки
 * показываются без строки заказа, а ворнинг в лог не пишется — это ожидаемое
 * состояние, а не сбой.
 */
export async function getActivePrinterJobs(
  supabase: Supabase,
  userId: string,
): Promise<PrinterActiveJobs> {
  const { data, error } = await supabase
    .from("workshop_print_jobs")
    .select(
      "printer_id, order:workshop_orders!workshop_print_jobs_order_id_fkey(title)",
    )
    .eq("user_id", userId)
    .in("status", ["printing", "paused"]);

  if (error) {
    if (!isMissingTableSchema(error.code, error.message)) {
      console.warn(
        "Текущие задания принтеров не прочитаны:",
        error.code,
        error.message,
      );
    }

    return {};
  }

  const jobs: PrinterActiveJobs = {};

  for (const row of (data ?? []) as unknown as ActiveJobRow[]) {
    const order = Array.isArray(row.order) ? row.order[0] : row.order;
    const title = order?.title?.trim();

    if (isPrinterId(row.printer_id) && title) {
      jobs[row.printer_id] = title;
    }
  }

  return jobs;
}
/** Строка задания с причиной отказа: нужны только принтер и текст. */
type LastErrorRow = {
  printer_id: string | null;
  last_error: string | null;
};

/** Сколько последних отказов читать: по одному на принтер достаточно. */
const LAST_ERROR_LIMIT = 100;

/**
 * Причина последнего отказа по каждому принтеру.
 *
 * Источник — `workshop_print_jobs.last_error` у заданий со статусом `failed`:
 * агент пишет туда словами протокола («Bambu: неверный Access Code»), и карточка
 * принтера показывает ту же фразу, что и карточка заказа. Красная плашка нужна
 * именно мастеру у станка: он видит, что задание не ушло, и не ищет причину в
 * настройках.
 *
 * Задания читаются от новых к старым, и первое найденное значение для принтера
 * остаётся: карточке нужна одна строка, а не история. Колонки `last_error` может
 * не быть (миграция `workshop_print_jobs_hardening` не применена) — тогда карта
 * пустая, и плашка не показывается: это ожидаемое состояние, а не сбой.
 */
export async function getPrinterLastErrors(
  supabase: Supabase,
  userId: string,
): Promise<PrinterLastErrors> {
  const { data, error } = await supabase
    .from("workshop_print_jobs")
    .select("printer_id, last_error")
    .eq("user_id", userId)
    .eq("status", "failed")
    .not("printer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(LAST_ERROR_LIMIT);

  if (error) {
    if (
      !isMissingTableSchema(error.code, error.message) &&
      !isMissingColumnSchema(error)
    ) {
      console.warn(
        "Причины отказов принтеров не прочитаны:",
        error.code,
        error.message,
      );
    }

    return {};
  }

  const errors: PrinterLastErrors = {};

  for (const row of (data ?? []) as unknown as LastErrorRow[]) {
    const text =
      typeof row.last_error === "string" ? row.last_error.trim() : "";

    // Первое (самое новое) значение на принтер: старые отказы уже неактуальны.
    if (isPrinterId(row.printer_id) && text && !errors[row.printer_id]) {
      errors[row.printer_id] = text;
    }
  }

  return errors;
}



/** PostgREST/PostgreSQL: выбранной колонки ещё нет в базе. */
function isMissingColumnSchema(error: { code?: string | null }): boolean {
  return error.code === "42703" || error.code === "PGRST204";
}

/**
 * Принтеры пользователя: сначала добавленные раньше, чтобы список не прыгал.
 *
 * Живые колонки (status, progress, remaining_time, last_seen_at) появляются
 * миграцией `supabase/workshop_farm_and_shop.sql`. Пока её не применили, запрос
 * с ними падает на 42703/PGRST204 — тогда парк перечитывается базовым набором
 * колонок, а карточки показывают обслуживание без метки состояния. Так же
 * поступает `getWorkshopOrder()` с колонкой client_id.
 */
export async function getWorkshopPrinters(
  supabase: Supabase,
  userId: string,
): Promise<WorkshopPrintersSnapshot> {
  // Четыре независимых запроса: список парка, названия заказов в печати,
  // активные задания по заказам и причины последних отказов. Параллельно,
  // потому что карточкам нужны все четыре, а ждать их по очереди незачем.
  const [livePrinters, activeJobs, orderJobs, lastErrors] = await Promise.all([
    supabase
      .from("workshop_printers")
      .select(PRINTER_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    getActivePrinterJobs(supabase, userId),
    getActiveOrderJobs(supabase, userId),
    getPrinterLastErrors(supabase, userId),
  ]);

  // Тип ответа намеренно свободный: наборы колонок у двух запросов разные, а
  // разбирает строки всё равно normalizePrinterRow.
  let printersResult: {
    data: unknown;
    error: { code?: string | null; message?: string | null } | null;
  } = livePrinters;

  if (printersResult.error && isMissingColumnSchema(printersResult.error)) {
    printersResult = await supabase
      .from("workshop_printers")
      .select(PRINTER_BASE_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
  }

  const { data, error } = printersResult;

  if (error) {
    console.warn("Принтеры мастерской не прочитаны:", error.code, error.message);

    return {
      printers: [],
      activeJobs: {},
      orderJobs: {},
      lastErrors: {},
      isMissingTable: isMissingTableSchema(error.code, error.message),
    };
  }

  const rows = (data ?? []) as Partial<Record<string, unknown>>[];

  return {
    printers: rows
      .map(normalizePrinterRow)
      .filter((printer): printer is WorkshopPrinter => printer !== null),
    activeJobs,
    orderJobs,
    lastErrors,
    isMissingTable: false,
  };
}

export type DiscoveredPrintersSnapshot = {
  printers: DiscoveredPrinter[];
  /** В базе нет таблицы workshop_discovered_printers — миграция не применена. */
  isMissingTable: boolean;
};

/**
 * Принтеры, которые агент нашёл в сети и которые ждут подтверждения мастера.
 *
 * Статус фильтруется в запросе: индекс `(user_id, status)` из
 * `supabase/workshop_farm_and_shop.sql` создан ровно под эту пару. Порядок —
 * `created_at asc`, то есть порядок, в котором агент присылал находки: мастер
 * видит ферму в том же порядке, в каком её обошёл сканер.
 *
 * Без миграции возвращается пустой список с признаком `isMissingTable`: вкладка
 * не падает, а мастер подключения честно говорит, что таблицы нет. Прочие
 * ошибки чтения тоже не пробрасываются — находки есть, а списка нет, и это
 * состояние лучше показать пустым окном, чем красной страницей.
 */
export async function getDiscoveredPrinters(
  supabase: Supabase,
  userId: string,
): Promise<DiscoveredPrintersSnapshot> {
  const { data, error } = await supabase
    .from("workshop_discovered_printers")
    .select("ip_address, name, protocol_type, serial_number, status, created_at")
    .eq("user_id", userId)
    .eq("status", "discovered")
    .order("created_at", { ascending: true });

  if (error) {
    if (!isMissingTableSchema(error.code, error.message)) {
      console.warn(
        "Найденные принтеры не прочитаны:",
        error.code,
        error.message,
      );
    }

    return {
      printers: [],
      isMissingTable: isMissingTableSchema(error.code, error.message),
    };
  }

  const rows = (data ?? []) as Partial<Record<string, unknown>>[];

  return {
    printers: rows
      .map(normalizeDiscoveredPrinterRow)
      .filter((printer): printer is DiscoveredPrinter => printer !== null),
    isMissingTable: false,
  };
}
