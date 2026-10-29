/**
 * Слой данных Мастерской: заказ с позициями, очередь 3D-фермы и токен агента.
 *
 * Зачем отдельный модуль:
 *   - RLS отдаёт только строки владельца, но не объясняет, почему строки нет.
 *     Функции возвращают результат с кодом причины, чтобы Server Action или
 *     Route Handler показал понятный текст, а не «ошибка 500»;
 *   - миграция supabase/workshop_farm_and_shop.sql применяется вручную. Пока
 *     её нет, PostgREST отвечает 42P01/PGRST204/PGRST205 — это состояние
 *     `migration_missing`, а не поломка приложения;
 *   - агент фермы не имеет cookies пользователя. Он присылает agent_token,
 *     сервер ищет мастерскую по токену через service_role и отдаёт только её
 *     очередь.
 *
 * Деньги: null — «неизвестно», 0 — «известно, что ноль». Функции не заменяют
 * null нулём, иначе аналитика маржи считала бы неполные заказы прибыльными.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isPrintJobStatus,
  isPrinterProtocol,
  isPrinterStatus,
  isWorkshopUuid,
  type AgentPrinter,
  type AgentQueue,
  type AgentQueuedJob,
  type WorkshopFarmContext,
  type WorkshopFarmFailure,
  type WorkshopFarmFailureReason,
  type WorkshopFarmResult,
  type WorkshopOrderItem,
  type WorkshopOrderWithItems,
  type WorkshopPrintJob,
  type WorkshopProductRef,
} from "@/lib/db/workshop-types";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import { normalizeOrderRow, ORDER_TEXT_LIMITS } from "@/lib/workshop/orders";
import { parseWorkshopNumber } from "@/lib/workshop/settings";

const ORDER_WITH_ITEMS_COLUMNS =
  "id, title, status, total_cost, printer_id, created_at, marketplace_order_id, total_amount, marketplace_commission, internal_print_cost";

/**
 * `product:...` — встроенный ресурс PostgREST по внешнему ключу. Имя
 * ограничения указано явно: у таблицы может появиться второй FK на товары, и
 * тогда без подсказки PostgREST ответит PGRST201 «ambiguous embedding».
 */
const ORDER_ITEM_COLUMNS =
  "id, order_id, product_id, sku, quantity, created_at, product:workshop_products!workshop_order_items_product_id_fkey(id, title, name, gcode_url)";

const PRINT_JOB_COLUMNS =
  "id, order_id, order_item_id, printer_id, gcode_url, status, created_at, updated_at";

const AGENT_PRINTER_COLUMNS =
  "id, name, brand, model, protocol_type, ip_address, api_key, serial_number, status, progress, remaining_time, last_seen_at";

/** Сколько заданий отдавать агенту за один опрос: защита от гигантского JSON. */
const AGENT_QUEUE_LIMIT = 200;

/** numeric(10, 2): больше в колонку не поместится. */
const MONEY_MAX = 99_999_999.99;

/** check в workshop_products.gcode_url и workshop_print_jobs.gcode_url. */
const GCODE_URL_MAX = 2048;

/** Секунды в году: остаток печати больше — заведомо мусор. */
const REMAINING_TIME_MAX = 31_536_000;

type Row = Partial<Record<string, unknown>>;

function fail(
  reason: WorkshopFarmFailureReason,
  error: string,
): WorkshopFarmFailure {
  return { ok: false, reason, error };
}

function ok<T>(data: T): WorkshopFarmResult<T> {
  return { ok: true, data };
}

function readText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  if (!text) {
    return null;
  }

  return text.slice(0, maxLength);
}

function readTimestamp(value: unknown): string | null {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
    ? value
    : null;
}

function readNumberInRange(
  value: unknown,
  min: number,
  max: number,
): number | null {
  const parsed = parseWorkshopNumber(value);

  if (parsed === null || parsed < min || parsed > max) {
    return null;
  }

  return parsed;
}

function readIntegerInRange(
  value: unknown,
  min: number,
  max: number,
): number | null {
  const parsed = readNumberInRange(value, min, max);

  return parsed === null ? null : Math.round(parsed);
}

/** Деньги: неотрицательные, ровно до копеек; иначе null («неизвестно»). */
function readMoney(value: unknown): number | null {
  const parsed = readNumberInRange(value, 0, MONEY_MAX);

  return parsed === null ? null : Math.round(parsed * 100) / 100;
}

function readRow(value: unknown): Row | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Row)
    : null;
}

/**
 * PostgREST возвращает to-one связь объектом, но при неожиданной схеме может
 * вернуть массив — берём первый элемент, чтобы нормализация не падала.
 */
function readEmbeddedRow(value: unknown): Row | null {
  return Array.isArray(value) ? readRow(value[0]) : readRow(value);
}

function readRows(value: unknown): Row[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const rows: Row[] = [];

  for (const item of value) {
    const row = readRow(item);

    if (row) {
      rows.push(row);
    }
  }

  return rows;
}

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

function isSchemaError(error: SupabaseErrorLike): boolean {
  return (
    error.code === "42703" ||
    isMissingTableSchema(error.code, error.message)
  );
}

const MIGRATION_HINT =
  "Миграция workshop_farm_and_shop.sql ещё не применена: в базе нет нужных таблиц или колонок.";

function readFailure(
  error: SupabaseErrorLike,
  fallback: string,
): WorkshopFarmFailure {
  console.warn("Мастерская: чтение не удалось:", error.code, error.message);

  return isSchemaError(error)
    ? fail("migration_missing", MIGRATION_HINT)
    : fail("read_failed", fallback);
}

function writeFailure(
  error: SupabaseErrorLike,
  fallback: string,
): WorkshopFarmFailure {
  console.warn("Мастерская: запись не удалась:", error.code, error.message);

  return isSchemaError(error)
    ? fail("migration_missing", MIGRATION_HINT)
    : fail("write_failed", fallback);
}

type WorkshopOrderBase = Omit<WorkshopOrderWithItems, "items">;

function normalizeProduct(value: unknown): WorkshopProductRef | null {
  const row = readEmbeddedRow(value);

  if (!row || !isWorkshopUuid(row.id)) {
    return null;
  }

  return {
    id: row.id,
    // `name` — генерируемый алиас title; title оставлен резервом на случай,
    // если миграцию применили частично и колонки name ещё нет в select.
    name:
      readText(row.name, ORDER_TEXT_LIMITS.title) ??
      readText(row.title, ORDER_TEXT_LIMITS.title) ??
      "Без названия",
    gcodeUrl: readText(row.gcode_url, GCODE_URL_MAX),
  };
}

function normalizeOrderItem(value: unknown): WorkshopOrderItem | null {
  const row = readRow(value);

  if (!row || !isWorkshopUuid(row.id) || !isWorkshopUuid(row.order_id)) {
    return null;
  }

  return {
    id: row.id,
    orderId: row.order_id,
    productId: isWorkshopUuid(row.product_id) ? row.product_id : null,
    sku: readText(row.sku, 128),
    quantity: readIntegerInRange(row.quantity, 1, 10_000) ?? 1,
    product: normalizeProduct(row.product),
    createdAt: readTimestamp(row.created_at),
  };
}

/**
 * Финансовые поля читаются отдельно от normalizeOrderRow: старый нормализатор
 * не знает о новых колонках, а переписывать его ради CRM значило бы менять
 * поведение существующих страниц.
 */
function normalizeOrderBase(value: Row): WorkshopOrderBase | null {
  const base = normalizeOrderRow(value);

  if (!base) {
    return null;
  }

  return {
    id: base.id,
    title: base.title,
    status: base.status,
    totalCost: base.totalCost,
    // Принтер нужен очереди печати: задание без принтера агент не запустит.
    printerId: isWorkshopUuid(value.printer_id) ? value.printer_id : null,
    createdAt: base.createdAt,
    marketplaceOrderId: readText(value.marketplace_order_id, 128),
    totalAmount: readMoney(value.total_amount),
    marketplaceCommission: readMoney(value.marketplace_commission),
    internalPrintCost: readMoney(value.internal_print_cost),
  };
}

function normalizePrintJob(value: unknown): WorkshopPrintJob | null {
  const row = readRow(value);

  if (
    !row ||
    !isWorkshopUuid(row.id) ||
    !isWorkshopUuid(row.order_id) ||
    !isWorkshopUuid(row.order_item_id) ||
    !isPrintJobStatus(row.status)
  ) {
    return null;
  }

  return {
    id: row.id,
    orderId: row.order_id,
    orderItemId: row.order_item_id,
    printerId: isWorkshopUuid(row.printer_id) ? row.printer_id : null,
    gcodeUrl: readText(row.gcode_url, GCODE_URL_MAX),
    status: row.status,
    createdAt: readTimestamp(row.created_at),
    updatedAt: readTimestamp(row.updated_at),
  };
}

/**
 * Принтер для агента. api_key — секрет: объект уходит только в ответ агента,
 * поэтому его нельзя возвращать из Server Component в браузер.
 */
function normalizeAgentPrinter(value: unknown): AgentPrinter | null {
  const row = readRow(value);

  if (!row || !isWorkshopUuid(row.id)) {
    return null;
  }

  return {
    id: row.id,
    name: readText(row.name, 60) ?? "Принтер",
    brand: readText(row.brand, 40) ?? "",
    model: readText(row.model, 60) ?? "",
    protocolType: isPrinterProtocol(row.protocol_type)
      ? row.protocol_type
      : "moonraker",
    ipAddress: readText(row.ip_address, 253),
    apiKey: readText(row.api_key, 512),
    serialNumber: readText(row.serial_number, 64),
    status: isPrinterStatus(row.status) ? row.status : "offline",
    progress: readIntegerInRange(row.progress, 0, 100) ?? 0,
    remainingTime:
      readIntegerInRange(row.remaining_time, 0, REMAINING_TIME_MAX) ?? 0,
    lastSeenAt: readTimestamp(row.last_seen_at),
  };
}

/**
 * Кто выполняет запрос. Без контекста — текущая сессия из cookies; с
 * контекстом — готовый клиент (тест, Server Action после getUser).
 *
 * Динамический импорт `@/lib/supabase/server` нужен скриптам и тестам: модуль
 * тянет next/headers, которого вне Next нет. При переданном контексте ветка не
 * выполняется и next/headers не загружается.
 */
async function resolveContext(
  context?: WorkshopFarmContext,
): Promise<WorkshopFarmContext | null> {
  if (context) {
    return isWorkshopUuid(context.userId) ? context : null;
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return { supabase, userId: data.user.id };
}

/**
 * Заказ с позициями и деньгами площадки.
 *
 * Один заказ и его позиции читаются параллельно: оба запроса фильтруются по
 * владельцу, поэтому второй не зависит от результата первого. Чужая строка
 * (или отключённая политика) даёт not_found — по ответу нельзя понять, есть ли
 * заказ у другого мастера.
 */
export async function getOrderWithItems(
  orderId: string,
  context?: WorkshopFarmContext,
): Promise<WorkshopFarmResult<WorkshopOrderWithItems>> {
  if (!isWorkshopUuid(orderId)) {
    return fail("invalid_id", "Заказ указан неверно.");
  }

  const ctx = await resolveContext(context);

  if (!ctx) {
    return fail("unauthorized", "Нужно войти в мастерскую.");
  }

  const [orderResult, itemsResult] = await Promise.all([
    ctx.supabase
      .from("workshop_orders")
      .select(ORDER_WITH_ITEMS_COLUMNS)
      .eq("id", orderId)
      .eq("user_id", ctx.userId)
      .maybeSingle(),
    ctx.supabase
      .from("workshop_order_items")
      .select(ORDER_ITEM_COLUMNS)
      .eq("order_id", orderId)
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: true }),
  ]);

  if (orderResult.error) {
    return readFailure(orderResult.error, "Заказ не прочитан.");
  }

  if (itemsResult.error) {
    return readFailure(itemsResult.error, "Позиции заказа не прочитаны.");
  }

  const orderRow = readRow(orderResult.data);

  if (!orderRow) {
    return fail("not_found", "Заказ не найден.");
  }

  const order = normalizeOrderBase(orderRow);

  if (!order) {
    return fail("read_failed", "База вернула заказ в неизвестном формате.");
  }

  const items = readRows(itemsResult.data)
    .map(normalizeOrderItem)
    .filter((item): item is WorkshopOrderItem => item !== null);

  return ok({ ...order, items });
}

/**
 * Активное задание позиции: созданное и ещё не завершённое.
 *
 * Повторный вебхук или двойной клик не должен печатать модель дважды, поэтому
 * createPrintJob сначала ищет queued/printing. Уникальный частичный индекс
 * workshop_print_jobs_active_item_uidx закрывает гонку двух параллельных
 * запросов на уровне базы.
 */
async function findActivePrintJob(
  ctx: WorkshopFarmContext,
  orderItemId: string,
): Promise<WorkshopFarmResult<WorkshopPrintJob | null>> {
  const result = await ctx.supabase
    .from("workshop_print_jobs")
    .select(PRINT_JOB_COLUMNS)
    .eq("user_id", ctx.userId)
    .eq("order_item_id", orderItemId)
    .in("status", ["queued", "printing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) {
    return readFailure(result.error, "Очередь печати не прочитана.");
  }

  return ok(normalizePrintJob(result.data));
}

export type CreatePrintJobInput = {
  orderId: string;
  orderItemId: string;
  /** null/undefined — агент сам выберет свободный принтер. */
  printerId?: string | null;
};

/**
 * Поставить позицию заказа в очередь печати.
 *
 * Проверки по порядку:
 *   1. формат uuid — до обращения к базе;
 *   2. позиция принадлежит текущему пользователю (RLS + явный user_id);
 *   3. позиция относится именно к переданному заказу;
 *   4. у товара есть G-code: печатать нечего, если ссылки нет;
 *   5. принтер (если выбран) принадлежит мастерской;
 *   6. активного задания ещё нет — повторный вызов идемпотентен.
 */
export async function createPrintJob(
  input: CreatePrintJobInput,
  context?: WorkshopFarmContext,
): Promise<WorkshopFarmResult<WorkshopPrintJob>> {
  if (!isWorkshopUuid(input.orderId) || !isWorkshopUuid(input.orderItemId)) {
    return fail("invalid_id", "Заказ или позиция заказа указаны неверно.");
  }

  const printerId = input.printerId ?? null;

  if (printerId !== null && !isWorkshopUuid(printerId)) {
    return fail("invalid_id", "Принтер указан неверно.");
  }

  const ctx = await resolveContext(context);

  if (!ctx) {
    return fail("unauthorized", "Нужно войти в мастерскую.");
  }

  const itemResult = await ctx.supabase
    .from("workshop_order_items")
    .select(ORDER_ITEM_COLUMNS)
    .eq("id", input.orderItemId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (itemResult.error) {
    return readFailure(itemResult.error, "Позиция заказа не прочитана.");
  }

  const item = normalizeOrderItem(itemResult.data);

  if (!item) {
    return fail("not_found", "Позиция заказа не найдена.");
  }

  if (item.orderId !== input.orderId) {
    return fail("ownership_mismatch", "Позиция относится к другому заказу.");
  }

  const gcodeUrl = item.product?.gcodeUrl ?? null;

  if (!gcodeUrl) {
    return fail(
      "missing_gcode",
      "У товара нет G-code. Добавьте ссылку в карточке товара и повторите.",
    );
  }

  const existing = await findActivePrintJob(ctx, input.orderItemId);

  if (!existing.ok) {
    return existing;
  }

  if (existing.data) {
    return ok(existing.data);
  }

  if (printerId) {
    const printerResult = await ctx.supabase
      .from("workshop_printers")
      .select("id")
      .eq("id", printerId)
      .eq("user_id", ctx.userId)
      .maybeSingle();

    if (printerResult.error) {
      return readFailure(printerResult.error, "Принтер не прочитан.");
    }

    if (!readRow(printerResult.data)) {
      return fail("not_found", "Принтер не найден в вашей мастерской.");
    }
  }

  const insertResult = await ctx.supabase
    .from("workshop_print_jobs")
    .insert({
      user_id: ctx.userId,
      order_id: input.orderId,
      order_item_id: input.orderItemId,
      printer_id: printerId,
      gcode_url: gcodeUrl,
    })
    .select(PRINT_JOB_COLUMNS)
    .single();

  if (insertResult.error) {
    // Гонка: параллельный запрос успел создать активное задание. Уникальный
    // частичный индекс не дал создать дубль — возвращаем уже созданное.
    if (insertResult.error.code === "23505") {
      const again = await findActivePrintJob(ctx, input.orderItemId);

      if (!again.ok) {
        return again;
      }

      if (again.data) {
        return ok(again.data);
      }
    }

    return writeFailure(
      insertResult.error,
      "Не удалось поставить задание в очередь.",
    );
  }

  const job = normalizePrintJob(insertResult.data);

  if (!job) {
    return fail("write_failed", "База вернула задание в неизвестном формате.");
  }

  return ok(job);
}

/**
 * Мастерская по токену агента.
 *
 * Агент работает без cookies, поэтому клиент здесь service_role: он обходит
 * RLS, а мастерскую ограничивает найденный user_id. Токен сравнивается только
 * на сервере и никогда не возвращается в ответе.
 */
async function resolveAgentContext(
  agentToken: string,
): Promise<WorkshopFarmResult<WorkshopFarmContext>> {
  if (!isWorkshopUuid(agentToken)) {
    return fail("invalid_token", "Токен агента указан неверно.");
  }

  let supabase: SupabaseClient;

  try {
    supabase = createAdminClient();
  } catch {
    return fail(
      "server_misconfigured",
      "Сервер не настроен: нет ключа service_role для агента фермы.",
    );
  }

  const result = await supabase
    .from("workshop_settings")
    .select("user_id, agent_token")
    .eq("agent_token", agentToken)
    .maybeSingle();

  if (result.error) {
    return readFailure(result.error, "Настройки мастерской не прочитаны.");
  }

  const row = readRow(result.data);

  if (!row || !isWorkshopUuid(row.user_id)) {
    return fail("invalid_token", "Токен агента не найден или устарел.");
  }

  return ok({ supabase, userId: row.user_id });
}

/**
 * Очередь печати для локального агента 3D-фермы.
 *
 * Возвращает только queued-задания мастерской и её принтеры с адресами и
 * ключами. Пустой jobs — нормальный ответ «печатать нечего». Статусы
 * printing/done/failed агент меняет отдельным запросом, поэтому здесь их нет.
 */
export async function getQueuedJobsForAgent(
  agentToken: string,
): Promise<WorkshopFarmResult<AgentQueue>> {
  const context = await resolveAgentContext(agentToken);

  if (!context.ok) {
    return context;
  }

  const { supabase, userId } = context.data;

  const [jobsResult, printersResult] = await Promise.all([
    supabase
      .from("workshop_print_jobs")
      .select(PRINT_JOB_COLUMNS)
      .eq("user_id", userId)
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(AGENT_QUEUE_LIMIT),
    supabase
      .from("workshop_printers")
      .select(AGENT_PRINTER_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
  ]);

  if (jobsResult.error) {
    return readFailure(jobsResult.error, "Очередь печати не прочитана.");
  }

  if (printersResult.error) {
    return readFailure(printersResult.error, "Принтеры мастерской не прочитаны.");
  }

  const printers = readRows(printersResult.data)
    .map(normalizeAgentPrinter)
    .filter((printer): printer is AgentPrinter => printer !== null);
  const printerById = new Map(
    printers.map((printer) => [printer.id, printer] as const),
  );

  const jobs: AgentQueuedJob[] = [];

  for (const row of readRows(jobsResult.data)) {
    const job = normalizePrintJob(row);

    if (!job) {
      continue;
    }

    jobs.push({
      id: job.id,
      orderId: job.orderId,
      orderItemId: job.orderItemId,
      gcodeUrl: job.gcodeUrl,
      createdAt: job.createdAt,
      printer: job.printerId ? (printerById.get(job.printerId) ?? null) : null,
    });
  }

  return ok({ jobs, printers });
}
