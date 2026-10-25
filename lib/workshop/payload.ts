/**
 * Строки для записи в таблицы Мастерской.
 *
 * Отдельные функции, потому что имена колонок и чисел должны совпадать: форма
 * присылает camelCase, база ждёт snake_case. Здесь единственное место перевода
 * — если колонка переименуется, TypeScript подсветит поле сразу, а не база
 * ответит PGRST204 уже в проде.
 */
import type { FilamentDraft } from "@/lib/workshop/filaments";
import type { OrderDraft, OrderEditDraft } from "@/lib/workshop/orders";
import type { PrinterDraft } from "@/lib/workshop/printers";
import type {
  WorkshopCompanyType,
  WorkshopRequisites,
} from "@/lib/workshop/requisites";
import type { WorkshopSettings } from "@/lib/workshop/settings";

/**
 * Что уходит в `from("workshop_settings").upsert(...)`.
 *
 * Числа и реквизиты необязательны: вкладка «Калькулятор» присылает только
 * числа, вкладка «Реквизиты» — только данные компании. PostgREST получает
 * объект без undefined-полей, поэтому сохранение одной вкладки не затирает
 * значения другой. Остальные колонки при вставке заполняют значения по
 * умолчанию из миграции.
 */
export type WorkshopSettingsPayload = {
  user_id: string;
  electricity_cost_kwh?: number;
  printer_power_w?: number;
  depreciation_cost_hour?: number;
  labor_cost_hour?: number;
  company_type?: WorkshopCompanyType;
  company_name?: string;
  inn?: string | null;
  ogrn?: string | null;
  legal_address?: string | null;
  bank_details?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
};

/**
 * Настройки и реквизиты → строка для upsert.
 *
 * Пустые необязательные реквизиты остаются null: очищенное поле должно
 * очистить и колонку, а не хранить пустую строку. Реквизиты с обязательными
 * полями пишутся всегда парой — форма не даст сохранить одно без другого.
 */
export function createWorkshopSettingsPayload(
  userId: string,
  settings: WorkshopSettings | null,
  requisites: WorkshopRequisites | null,
): WorkshopSettingsPayload {
  const payload: WorkshopSettingsPayload = { user_id: userId };

  if (settings) {
    payload.electricity_cost_kwh = settings.electricityCostKwh;
    payload.printer_power_w = settings.printerPowerW;
    payload.depreciation_cost_hour = settings.depreciationCostHour;
    payload.labor_cost_hour = settings.laborCostHour;
  }

  if (requisites) {
    payload.company_type = requisites.companyType;
    payload.company_name = requisites.companyName;
    payload.inn = requisites.inn;
    payload.ogrn = requisites.ogrn;
    payload.legal_address = requisites.legalAddress;
    payload.bank_details = requisites.bankDetails;
    payload.contact_phone = requisites.contactPhone;
    payload.contact_email = requisites.contactEmail;
  }

  return payload;
}

/** Что уходит в `from("workshop_filaments").insert(...)`. */
export type WorkshopFilamentPayload = {
  user_id: string;
  brand: string;
  type: string;
  color: string;
  total_weight_g: number;
  remaining_weight_g: number;
  price_per_kg: number;
  min_threshold_g: number;
  purchase_url: string | null;
};

/**
 * Новая катушка. Пустая ссылка превращается в null: в базе это «ссылки нет», а
 * не пустая строка, иначе кнопка «Купить» вела бы на пустоту.
 */
export function createFilamentPayload(
  userId: string,
  draft: FilamentDraft,
): WorkshopFilamentPayload {
  return {
    user_id: userId,
    brand: draft.brand,
    type: draft.type,
    color: draft.color,
    total_weight_g: draft.totalWeightG,
    remaining_weight_g: draft.remainingWeightG,
    price_per_kg: draft.pricePerKg,
    min_threshold_g: draft.minThresholdG,
    purchase_url: draft.purchaseUrl || null,
  };
}

/** Что уходит в `from("workshop_printers").insert(...)`. */
export type WorkshopPrinterPayload = {
  user_id: string;
  name: string;
  brand: string;
  model: string;
  nozzle_interval: number;
  lubrication_interval: number;
  z_screw_interval: number;
};

/**
 * Новый принтер. Наработки не передаём: их выставляет база нулями, а
 * `last_maintenance_date` остаётся null — обслуживания ещё не было.
 */
export function createPrinterPayload(
  userId: string,
  draft: PrinterDraft,
): WorkshopPrinterPayload {
  return {
    user_id: userId,
    name: draft.name,
    brand: draft.brand,
    model: draft.model,
    nozzle_interval: draft.nozzleInterval,
    lubrication_interval: draft.lubricationInterval,
    z_screw_interval: draft.zScrewInterval,
  };
}

/** Что уходит в `from("workshop_orders").insert(...)`. */
export type WorkshopOrderPayload = {
  user_id: string;
  title: string;
  client_name: string | null;
  /**
   * Ссылка на клиента из базы. Поле необязательное: без выбранного клиента его
   * нет в payload, чтобы заказ создавался и до применения миграции
   * workshop_orders_client_id.sql.
   */
  client_id?: string;
  total_cost: number;
  material_weight_g: number;
  print_time_hours: number;
  printer_id: string | null;
  filament_id: string | null;
  /**
   * Ссылка на товар каталога. Поле необязательное: без выбранного товара его
   * нет в payload, чтобы заказ создавался и до применения миграции
   * workshop_products.sql (там колонка product_id появляется).
   */
  product_id?: string;
  notes: string | null;
  deadline: string | null;
};

/**
 * Новый заказ. Статус не передаём — база ставит `new` по умолчанию; пустые
 * имя клиента, заметки и срок превращаются в null, чтобы не хранить пустые
 * строки. Наработка принтера и остаток катушки меняются отдельными update
 * после вставки заказа — см. app/actions/orders.ts.
 */
export function createOrderPayload(
  userId: string,
  draft: OrderDraft,
): WorkshopOrderPayload {
  const payload: WorkshopOrderPayload = {
    user_id: userId,
    title: draft.title,
    client_name: draft.clientName || null,
    total_cost: draft.totalCost,
    material_weight_g: draft.materialWeightG,
    print_time_hours: draft.printTimeHours,
    printer_id: draft.printerId,
    filament_id: draft.filamentId,
    notes: draft.notes || null,
    deadline: draft.deadline,
  };

  if (draft.productId) {
    payload.product_id = draft.productId;
  }

  if (draft.clientId) {
    payload.client_id = draft.clientId;
  }

  return payload;
}

/** Что уходит в `from("workshop_orders").update(...)` при правке заказа. */
export type WorkshopOrderUpdatePayload = {
  title: string;
  client_name: string | null;
  /**
   * Ссылка на клиента из базы. Колонку добавляет миграция
   * `supabase/workshop_orders_client_id.sql`, поэтому поле необязательное:
   * без миграции правка идёт без ссылки, а не падает.
   */
  client_id?: string | null;
  total_cost: number;
  material_weight_g: number;
  print_time_hours: number;
  notes: string | null;
  deadline: string | null;
};

/**
 * Правка заказа: только поля карточки.
 *
 * `status`, `printer_id` и `filament_id` не передаются намеренно. Статус меняет
 * Kanban (`updateOrderStatus`), технику выбирают при создании. Наработка
 * принтера и остаток катушки при правке не пересчитываются: заказ уже списал
 * ресурс при создании, а правка меняет только записи о заказе.
 *
 * `client_id` попадает в payload, когда известно состояние ссылки: uuid —
 * привязать клиента, `null` — отвязать (ручной ввод). `withClientLink` включает
 * запись null и для заказов без выбранного клиента: колонка существует только
 * после миграции, поэтому её наличие сообщает вызывающий код.
 */
export function createOrderUpdatePayload(
  draft: OrderEditDraft,
  clientName: string,
  { withClientLink = false }: { withClientLink?: boolean } = {},
): WorkshopOrderUpdatePayload {
  const payload: WorkshopOrderUpdatePayload = {
    title: draft.title,
    client_name: clientName || null,
    total_cost: draft.totalCost,
    material_weight_g: draft.materialWeightG,
    print_time_hours: draft.printTimeHours,
    notes: draft.notes || null,
    deadline: draft.deadline,
  };

  if (withClientLink || draft.clientId) {
    payload.client_id = draft.clientId;
  }

  return payload;
}

/** Что уходит в `from("workshop_printers").update(...)` после заказа. */
export type WorkshopPrinterUsagePayload = {
  total_hours: number;
  nozzle_hours: number;
  lubrication_hours: number;
  z_screw_hours: number;
};

/** Наработка из плана (camelCase) → колонки базы (snake_case). */
export function createPrinterUsagePayload(hours: {
  totalHours: number;
  nozzleHours: number;
  lubricationHours: number;
  zScrewHours: number;
}): WorkshopPrinterUsagePayload {
  return {
    total_hours: hours.totalHours,
    nozzle_hours: hours.nozzleHours,
    lubrication_hours: hours.lubricationHours,
    z_screw_hours: hours.zScrewHours,
  };
}

/** Что уходит в `from("workshop_filaments").update(...)` после заказа. */
export type WorkshopFilamentUsagePayload = {
  remaining_weight_g: number;
};

export function createFilamentUsagePayload(
  remainingWeightG: number,
): WorkshopFilamentUsagePayload {
  return { remaining_weight_g: remainingWeightG };
}
