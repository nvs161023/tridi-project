/**
 * Строки для записи в таблицы Мастерской.
 *
 * Отдельные функции, потому что имена колонок и чисел должны совпадать: форма
 * присылает camelCase, база ждёт snake_case. Здесь единственное место перевода
 * — если колонка переименуется, TypeScript подсветит поле сразу, а не база
 * ответит PGRST204 уже в проде.
 */
import type { PrinterProtocol, PrinterStatus } from "@/lib/db/workshop-types";
import type {
  FilamentDraft,
  FilamentUsageType,
} from "@/lib/workshop/filaments";
import type {
  OrderDraft,
  OrderEditDraft,
  OrderSource,
} from "@/lib/workshop/orders";
import type { WorkshopIntegrations } from "@/lib/workshop/integrations";
import { findPrinterPresetByModel } from "@/lib/workshop/printer-presets";
import {
  DISCOVERED_PRINTER_BRAND,
  DISCOVERED_PRINTER_MODEL,
  PRINTER_INTERVAL_DEFAULTS,
  type ApprovedPrinterDraft,
  type PrinterDraft,
} from "@/lib/workshop/printers";
import type {
  WorkshopCompanyType,
  WorkshopRequisites,
} from "@/lib/workshop/requisites";
import type { WorkshopSettings } from "@/lib/workshop/settings";

/**
 * Что уходит в `from("workshop_settings").upsert(...)`.
 *
 * Числа, реквизиты и ключи Ozon необязательны: вкладка «Калькулятор»
 * присылает только числа, «Реквизиты» — данные компании, «Интеграции» —
 * Client-Id и Api-Key. PostgREST получает объект без undefined-полей, поэтому
 * сохранение одной вкладки не затирает значения другой. Остальные колонки при
 * вставке заполняют значения по умолчанию из миграции.
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
  /** Колонки из `supabase/workshop_marketplace_integration.sql`. */
  ozon_client_id?: string | null;
  ozon_api_key?: string | null;
};

/**
 * Настройки, реквизиты и ключи Ozon → строка для upsert.
 *
 * Пустые необязательные реквизиты остаются null: очищенное поле должно
 * очистить и колонку, а не хранить пустую строку. Реквизиты с обязательными
 * полями пишутся всегда парой — форма не даст сохранить одно без другого.
 * Ключи Ozon тоже пишутся парой; `null` в обоих полях выключает интеграцию.
 */
export function createWorkshopSettingsPayload(
  userId: string,
  settings: WorkshopSettings | null,
  requisites: WorkshopRequisites | null,
  integrations: WorkshopIntegrations | null = null,
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

  if (integrations) {
    payload.ozon_client_id = integrations.ozonClientId;
    payload.ozon_api_key = integrations.ozonApiKey;
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
  /** Складская катушка или заказная; колонка из `workshop_filament_usage_type.sql`. */
  usage_type: FilamentUsageType;
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
    usage_type: draft.usageType,
  };
}

/** Что уходит в `from("workshop_printers").insert(...)`. */
export type WorkshopPrinterPayload = {
  user_id: string;
  name: string;
  brand: string;
  model: string;
  /**
   * Протокол агента. В SQL у колонки default 'moonraker', но форма теперь
   * спрашивает его явно: без этого Bambu-принтер, добавленный руками, остался
   * бы Moonraker-принтером без адреса.
   */
  protocol_type: PrinterProtocol;
  /** SN для Bambu; null — не задан, адаптер найдёт номер сам. */
  serial_number: string | null;
  /**
   * Локальный адрес принтера. Обязателен: агент подключается к принтеру
   * напрямую, и без адреса карточка в парке осталась бы мёртвой.
   */
  ip_address: string;
  /**
   * Ключ API (Moonraker/OctoPrint) или код доступа Bambu; null — принтер не
   * требует. Секрет: уходит только агенту, в браузер не возвращается.
   */
  api_key: string | null;
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
    protocol_type: draft.protocolType,
    // Пустая строка из формы — это «номера нет»: в базе ему место только как null.
    serial_number: draft.serialNumber || null,
    ip_address: draft.ipAddress,
    // Пустой ключ — тоже null: check-ограничение не принимает api_key длины 0.
    api_key: draft.apiKey || null,
    nozzle_interval: draft.nozzleInterval,
    lubrication_interval: draft.lubricationInterval,
    z_screw_interval: draft.zScrewInterval,
  };
}

/**
 * Что уходит в `from("workshop_printers").insert(...)` для найденного принтера.
 *
 * Шире WorkshopPrinterPayload только состоянием: принтер найден, но ещё не
 * печатает, поэтому сразу `idle`. Адрес и протокол приходят из сети. Ключ API
 * сеть не знает: его вводит мастер в окне подтверждения, а если поле оставлено
 * пустым — берётся ключ из находки агента (сегодня агент его не присылает).
 * Серийный номер передаётся, если сканер его услышал (Bambu отвечает на SSDP
 * заголовком `USN`): без него мастеру пришлось бы искать SN на корпусе.
 */
export type DiscoveredPrinterPayload = WorkshopPrinterPayload & {
  status: PrinterStatus;
};

/**
 * Принтер из автообнаружения → строка парка.
 *
 * Сеть знает адрес, протокол и — у Bambu — серийный номер, а бренд и модель в
 * workshop_printers обязательные. Поэтому они берутся из справочника, если
 * мастер назвал принтер как в пресете («Bambu Lab P1S»): заодно подставляются
 * интервалы ТО этой модели. Не совпало — «Неизвестно · Найден по сети» и
 * интервалы по умолчанию, как у формы без выбранной модели: карточка не должна
 * показывать чужой регламент. Номер приходит из SSDP-ответа принтера; null —
 * не пришёл, и адаптер найдёт его сам при подключении. Ключ приходит из окна
 * подтверждения или из находки агента; null — ключ не указан, и адаптер
 * попробует подключиться без него (пустая строка в базе недопустима).
 */
export function createDiscoveredPrinterPayload(
  userId: string,
  draft: ApprovedPrinterDraft,
  protocolType: PrinterProtocol,
  serialNumber: string | null = null,
  apiKey: string | null = null,
): DiscoveredPrinterPayload {
  const preset = findPrinterPresetByModel(draft.name);

  return {
    user_id: userId,
    name: draft.name,
    brand: preset?.brand ?? DISCOVERED_PRINTER_BRAND,
    model: preset?.model ?? DISCOVERED_PRINTER_MODEL,
    protocol_type: protocolType,
    serial_number: serialNumber,
    ip_address: draft.ipAddress,
    api_key: apiKey,
    status: "idle",
    nozzle_interval: preset?.nozzleHours ?? PRINTER_INTERVAL_DEFAULTS.nozzle,
    lubrication_interval:
      preset?.lubricationHours ?? PRINTER_INTERVAL_DEFAULTS.lubrication,
    z_screw_interval: preset?.zScrewHours ?? PRINTER_INTERVAL_DEFAULTS.zScrew,
  };
}

/** Что уходит в `from("workshop_orders").insert(...)`. */
export type WorkshopOrderPayload = {
  user_id: string;
  /**
   * Источник заказа. Ручные заказы создаются только формой мастерской, поэтому
   * здесь всегда `manual`; импорт маркетплейса будет передавать свой источник
   * отдельным путём.
   */
  source: OrderSource;
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
 * строки. `source` всегда `manual`: этот путь используется только ручным
 * созданием заказа. Наработка принтера и остаток катушки меняются отдельными
 * update после вставки заказа — см. app/actions/orders.ts.
 */
export function createOrderPayload(
  userId: string,
  draft: OrderDraft,
): WorkshopOrderPayload {
  const payload: WorkshopOrderPayload = {
    user_id: userId,
    source: "manual",
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
 * `source` тоже не передаётся: происхождение заказа (ручной, Ozon, WB или
 * Яндекс Маркет) не должно меняться от ручной правки карточки.
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
