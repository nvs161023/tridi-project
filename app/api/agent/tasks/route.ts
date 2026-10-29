import {
  isPrinterProtocol,
  isPrinterStatus,
  isWorkshopUuid,
  type PrinterProtocol,
  type PrinterStatus,
} from "@/lib/db/workshop-types";
import { validateAgentToken } from "@/lib/agent-auth";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOrderStatus, type OrderStatus } from "@/lib/workshop/orders";

/**
 * Очередь печати для локального агента 3D-фермы.
 *
 *   GET /api/agent/tasks
 *   Authorization: Bearer <agent_token>
 *
 * Порядок:
 *   1. токен проверяет lib/agent-auth.ts по `workshop_settings.agent_token`;
 *      нет токена или он неверный — 401, задачи не читаются;
 *   2. задания ищутся только своей мастерской (`user_id`) и только `queued`:
 *      `printing` уже взято, `done`/`failed` — история;
 *   3. к заданию подтягиваются заказ и принтер, чтобы агенту не пришлось
 *      делать второй запрос: нужны адрес, ключ и серийный номер принтера
 *      (Bambu адресует MQTT-топики номером), а также название заказа для
 *      журнала.
 *
 * Ответ: `{ "tasks": [...] }`. Пустой массив — нормальный ответ «печатать
 * нечего», а не ошибка. `gcodeUrl` — снимок ссылки на момент постановки
 * задания: товар могли отредактировать позже.
 *
 * api_key принтера — секрет мастерской. Он уходит только агенту, который уже
 * подтвердил agent_token, поэтому ни страницы, ни Server Actions этот роут не
 * вызывают.
 */
export const runtime = "nodejs";

/** Очередь меняется после каждой печати: кэшировать ответ нельзя. */
export const dynamic = "force-dynamic";

/**
 * Связи указаны с именем ограничения: у `workshop_print_jobs` уже несколько
 * внешних ключей, и без подсказки PostgREST однажды ответит PGRST201
 * «ambiguous embedding», если появится второй ключ на ту же таблицу.
 */
const TASK_COLUMNS =
  "id, order_id, order_item_id, printer_id, gcode_url, status, created_at, " +
  "order:workshop_orders!workshop_print_jobs_order_id_fkey(id, title, status), " +
  "printer:workshop_printers!workshop_print_jobs_printer_id_fkey(id, name, protocol_type, ip_address, api_key, serial_number, status)";

/** Сколько заданий отдавать за один опрос: защита от гигантского JSON. */
const TASK_LIMIT = 200;

/** `workshop_print_jobs.gcode_url` — check до 2048 символов. */
const GCODE_URL_MAX = 2048;

const MIGRATION_HINT =
  "Очередь печати недоступна: в базе нет нужных таблиц или колонок. Примените supabase/workshop_farm_and_shop.sql.";

type Row = Partial<Record<string, unknown>>;

/** Принтер в ответе агенту: как до него достучаться и что он делает сейчас. */
type AgentTaskPrinter = {
  id: string;
  name: string;
  protocolType: PrinterProtocol;
  ipAddress: string | null;
  apiKey: string | null;
  /**
   * Серийный номер Bambu (SN); null — мастер не заполнил поле.
   *
   * Bambu адресует MQTT-топики им: device/<serial>/report и
   * device/<serial>/request. Без номера адаптер ищет принтер сам (SSDP), так что
   * null — не ошибка, а «подсказки нет».
   */
  serialNumber: string | null;
  status: PrinterStatus;
};

/** Заказ задачи: агенту хватает названия и статуса для журнала. */
type AgentTaskOrder = {
  id: string;
  title: string;
  status: OrderStatus;
};

/** Одно queued-задание в формате, удобном локальному агенту. */
type AgentTask = {
  id: string;
  orderId: string;
  orderItemId: string;
  printerId: string | null;
  gcodeUrl: string | null;
  createdAt: string | null;
  printer: AgentTaskPrinter | null;
  order: AgentTaskOrder | null;
};

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

function normalizePrinter(value: unknown): AgentTaskPrinter | null {
  const row = readEmbeddedRow(value);

  if (!row || !isWorkshopUuid(row.id)) {
    return null;
  }

  return {
    id: row.id,
    name: readText(row.name, 60) ?? "Принтер",
    protocolType: isPrinterProtocol(row.protocol_type)
      ? row.protocol_type
      : "moonraker",
    ipAddress: readText(row.ip_address, 253),
    apiKey: readText(row.api_key, 512),
    serialNumber: readText(row.serial_number, 64),
    status: isPrinterStatus(row.status) ? row.status : "offline",
  };
}

function normalizeOrder(value: unknown): AgentTaskOrder | null {
  const row = readEmbeddedRow(value);

  if (!row || !isWorkshopUuid(row.id)) {
    return null;
  }

  return {
    id: row.id,
    title: readText(row.title, 80) ?? "Заказ",
    status: isOrderStatus(row.status) ? row.status : "new",
  };
}

function normalizeTask(value: unknown): AgentTask | null {
  const row = readRow(value);

  if (
    !row ||
    !isWorkshopUuid(row.id) ||
    !isWorkshopUuid(row.order_id) ||
    !isWorkshopUuid(row.order_item_id)
  ) {
    return null;
  }

  return {
    id: row.id,
    orderId: row.order_id,
    orderItemId: row.order_item_id,
    printerId: isWorkshopUuid(row.printer_id) ? row.printer_id : null,
    gcodeUrl: readText(row.gcode_url, GCODE_URL_MAX),
    createdAt: readTimestamp(row.created_at),
    printer: normalizePrinter(row.printer),
    order: normalizeOrder(row.order),
  };
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

export async function GET(request: Request): Promise<Response> {
  const identity = await validateAgentToken(request);

  if (!identity) {
    return unauthorized();
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
    .select(TASK_COLUMNS)
    .eq("user_id", identity.userId)
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(TASK_LIMIT);

  if (result.error) {
    console.error(
      "Агент: очередь печати не прочитана:",
      result.error.code,
      result.error.message,
    );

    return isMissingTableSchema(result.error.code, result.error.message)
      ? json({ error: MIGRATION_HINT }, 503)
      : json({ error: "Очередь печати не прочитана." }, 500);
  }

  const tasks: AgentTask[] = readRows(result.data)
    .map(normalizeTask)
    .filter((task): task is AgentTask => task !== null);

  return json({ tasks });
}
