import type { SupabaseClient } from "@supabase/supabase-js";

import type { OrderStatus } from "@/lib/workshop/orders";

/**
 * Типы слоя данных Мастерской: 3D-ферма, SKU маркетплейсов и позиции заказов.
 *
 * Здесь два уровня:
 *   1. `...Row` — строки так, как их отдаёт PostgREST (snake_case, numeric
 *      приходит строкой). Нужны, чтобы явно описать select и не использовать
 *      `any`;
 *   2. доменные типы (camelCase) — то, с чем работают Server Actions, страницы
 *      и агент фермы.
 *
 * Значения из базы не считаются доверенными: нормализаторы в
 * lib/db/workshop-farm.ts проверяют uuid, статусы и числа. Незнакомая строка
 * отбрасывается, а не ломает всю страницу.
 */

// -----------------------------------------------------------------------------
// Справочники (совпадают с check-ограничениями supabase/workshop_farm_and_shop.sql)
// -----------------------------------------------------------------------------

/** Площадки, для которых хранится связь SKU → товар. */
export const MARKETPLACES = ["ozon", "wb", "yandex"] as const;

export type Marketplace = (typeof MARKETPLACES)[number];

export function isMarketplace(value: unknown): value is Marketplace {
  return (
    typeof value === "string" &&
    (MARKETPLACES as readonly string[]).includes(value)
  );
}

/** Статусы задания печати: queued → printing → done | failed. */
export const PRINT_JOB_STATUSES = [
  "queued",
  "printing",
  "done",
  "failed",
] as const;

export type PrintJobStatus = (typeof PRINT_JOB_STATUSES)[number];

export function isPrintJobStatus(value: unknown): value is PrintJobStatus {
  return (
    typeof value === "string" &&
    (PRINT_JOB_STATUSES as readonly string[]).includes(value)
  );
}

/** Протоколы, которыми умеет управлять локальный агент. */
export const PRINTER_PROTOCOLS = ["moonraker", "octoprint", "bambu"] as const;

export type PrinterProtocol = (typeof PRINTER_PROTOCOLS)[number];

export function isPrinterProtocol(value: unknown): value is PrinterProtocol {
  return (
    typeof value === "string" &&
    (PRINTER_PROTOCOLS as readonly string[]).includes(value)
  );
}

/** Состояние принтера глазами агента. */
export const PRINTER_STATUSES = [
  "idle",
  "printing",
  "paused",
  "error",
  "offline",
] as const;

export type PrinterStatus = (typeof PRINTER_STATUSES)[number];

export function isPrinterStatus(value: unknown): value is PrinterStatus {
  return (
    typeof value === "string" &&
    (PRINTER_STATUSES as readonly string[]).includes(value)
  );
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** UUID из базы или из URL. Мусор отсекаем до запроса к PostgREST. */
export function isWorkshopUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

// -----------------------------------------------------------------------------
// Строки PostgREST (snake_case)
// -----------------------------------------------------------------------------

/** numeric из PostgREST: тип зависит от версии парсера, поэтому оба варианта. */
export type NumericValue = number | string;

/** Товар в объёме, нужном ферме: без цены и размеров карточки. */
export type WorkshopProductRow = {
  id: string;
  user_id: string;
  sku: string;
  title: string;
  /** Генерируемый алиас title из workshop_farm_and_shop.sql. */
  name: string;
  gcode_url: string | null;
  created_at: string;
};

export type WorkshopMarketplaceLinkRow = {
  id: string;
  user_id: string;
  marketplace: Marketplace;
  sku: string;
  product_id: string;
  created_at: string;
};

export type WorkshopOrderItemRow = {
  id: string;
  user_id: string;
  order_id: string;
  product_id: string | null;
  sku: string | null;
  quantity: number;
  created_at: string;
};

export type WorkshopPrintJobRow = {
  id: string;
  user_id: string;
  order_id: string;
  order_item_id: string;
  printer_id: string | null;
  gcode_url: string | null;
  status: PrintJobStatus;
  created_at: string;
  updated_at: string;
};

/** Новые финансовые колонки workshop_orders. */
export type WorkshopOrderFinanceRow = {
  marketplace_order_id: string | null;
  total_amount: NumericValue | null;
  marketplace_commission: NumericValue | null;
  internal_print_cost: NumericValue | null;
};

/** Новые колонки workshop_printers, которые заполняет агент. */
export type WorkshopPrinterAgentRow = {
  protocol_type: PrinterProtocol;
  ip_address: string | null;
  api_key: string | null;
  status: PrinterStatus;
  progress: number;
  remaining_time: number;
  last_seen_at: string | null;
};

/** Колонка workshop_settings, по которой агент находит мастерскую. */
export type WorkshopSettingsAgentRow = {
  agent_token: string;
};

// -----------------------------------------------------------------------------
// Доменные типы (camelCase) — с ними работают страницы и агент
// -----------------------------------------------------------------------------

/** Товар каталога, подтянутый к позиции заказа. */
export type WorkshopProductRef = {
  id: string;
  name: string;
  gcodeUrl: string | null;
};

export type WorkshopOrderItem = {
  id: string;
  orderId: string;
  productId: string | null;
  /** Артикул на момент заказа; null — ручная позиция без артикула. */
  sku: string | null;
  quantity: number;
  /** Товар может быть удалён — тогда null, а sku и количество остаются. */
  product: WorkshopProductRef | null;
  createdAt: string | null;
};

/** Деньги заказа: null означает «неизвестно», а не ноль. */
export type WorkshopOrderFinance = {
  marketplaceOrderId: string | null;
  totalAmount: number | null;
  marketplaceCommission: number | null;
  internalPrintCost: number | null;
};

/** Заказ с позициями для карточки CRM. */
export type WorkshopOrderWithItems = WorkshopOrderFinance & {
  id: string;
  title: string;
  status: OrderStatus;
  /** Стоимость для клиента из старой колонки total_cost. */
  totalCost: number;
  createdAt: string | null;
  items: WorkshopOrderItem[];
};

export type WorkshopPrintJob = {
  id: string;
  orderId: string;
  orderItemId: string;
  printerId: string | null;
  gcodeUrl: string | null;
  status: PrintJobStatus;
  createdAt: string | null;
  updatedAt: string | null;
};

/** Принтер в ответе агенту: с адресом и ключом, но без наработок. */
export type AgentPrinter = {
  id: string;
  name: string;
  brand: string;
  model: string;
  protocolType: PrinterProtocol;
  ipAddress: string | null;
  /** Секрет: отдаётся только агенту, никогда — в браузер. */
  apiKey: string | null;
  status: PrinterStatus;
  progress: number;
  remainingTime: number;
  lastSeenAt: string | null;
};

/** Задание в очереди агента; принтер может быть ещё не назначен. */
export type AgentQueuedJob = {
  id: string;
  orderId: string;
  orderItemId: string;
  gcodeUrl: string | null;
  createdAt: string | null;
  printer: AgentPrinter | null;
};

/**
 * Ответ агенту на опрос очереди.
 *
 * Принтеры отдаются вместе с заданиями: агенту нужны адрес и ключ, чтобы
 * подключиться, а второй запрос за списком принтеров означал бы второй секрет
 * в URL. Пустой `jobs` — это нормальный ответ «печатать нечего».
 */
export type AgentQueue = {
  jobs: AgentQueuedJob[];
  printers: AgentPrinter[];
};

// -----------------------------------------------------------------------------
// Контекст и результат операций
// -----------------------------------------------------------------------------

/**
 * Клиент и владелец, от имени которого выполняется запрос.
 *
 * В Server Component контекст не передают — функция сама создаёт клиента из
 * cookies. В тестах и Server Actions передают готовый клиент, чтобы не
 * зависеть от next/headers и не дублировать `getUser`.
 */
export type WorkshopFarmContext = {
  supabase: SupabaseClient;
  userId: string;
};

/**
 * Причина отказа. Код нужен для программной обработки, `error` — для текста
 * в интерфейсе или в ответе API.
 *
 * migration_missing — миграция workshop_farm_and_shop.sql ещё не применена;
 * missing_gcode — у товара нет ссылки на файл печати;
 * server_misconfigured — на сервере нет ключа service_role для агента;
 * not_found — строки нет или она принадлежит другой мастерской (RLS скрывает
 * чужое, поэтому эти случаи неразличимы снаружи — так и задумано).
 */
export type WorkshopFarmFailureReason =
  | "invalid_id"
  | "invalid_token"
  | "unauthorized"
  | "not_found"
  | "ownership_mismatch"
  | "missing_gcode"
  | "migration_missing"
  | "server_misconfigured"
  | "read_failed"
  | "write_failed";

export type WorkshopFarmFailure = {
  ok: false;
  reason: WorkshopFarmFailureReason;
  error: string;
};

export type WorkshopFarmResult<T> =
  | { ok: true; data: T }
  | WorkshopFarmFailure;
