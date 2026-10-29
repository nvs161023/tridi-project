/**
 * Принтеры Мастерской: модель для интерфейса, пределы полей, разбор формы и
 * расчёт обслуживания.
 *
 * Те же три места, что у настроек и склада: форма проверяет ввод этими
 * пределами, Server Action — теми же функциями, а
 * `supabase/workshop_printers_orders.sql` повторяет их в check-ограничениях.
 * Расхождение означало бы, что форма пропустит число, которое база отклонит.
 *
 * Интервал смазки может быть нулевым — это «смазывать нечего»: у Bambu Lab
 * карбоновые стержни чистят спиртом, а не смазывают. Интервалы сопла и винта Z
 * нулевыми быть не могут: на них делят процент износа.
 */
import {
  isPrinterProtocol,
  type PrinterProtocol,
} from "@/lib/db/workshop-types";
import {
  formatWorkshopLimit,
  parseWorkshopNumber,
} from "@/lib/workshop/settings";

/** Состояния принтера, которые пишет агент фермы (check в workshop_farm_and_shop.sql). */
export const PRINTER_FARM_STATUSES = [
  "idle",
  "printing",
  "paused",
  "error",
  "offline",
] as const;

export type PrinterFarmStatus = (typeof PRINTER_FARM_STATUSES)[number];

export function isPrinterFarmStatus(value: unknown): value is PrinterFarmStatus {
  return (
    typeof value === "string" &&
    (PRINTER_FARM_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Текущие заказы принтеров: `printer_id` → название заказа.
 *
 * Заголовок берётся из связи `workshop_print_jobs` → `workshop_orders`, поэтому
 * серверная страница собирает карту сама, а карточка только показывает строку.
 */
export type PrinterActiveJobs = Record<string, string>;

/** Принтер в том виде, в каком с ним работает интерфейс. */
export type WorkshopPrinter = {
  id: string;
  /** Имя от пользователя: «Мой Ender». */
  name: string;
  brand: string;
  model: string;
  totalHours: number;
  nozzleHours: number;
  nozzleInterval: number;
  lubricationHours: number;
  lubricationInterval: number;
  zScrewHours: number;
  zScrewInterval: number;
  /** Дата последнего обслуживания в формате ГГГГ-ММ-ДД. */
  lastMaintenanceDate: string | null;
  /** Состояние от агента фермы; idle — печати нет. */
  status: PrinterFarmStatus;
  /** Прогресс текущей печати, % (0…100). */
  progress: number;
  /** Остаток текущей печати в секундах; 0 — печати нет. */
  remainingTime: number;
  /** Когда агент последний раз получил ответ; null — ещё ни разу. */
  lastSeenAt: string | null;
  /**
   * Серийный номер Bambu Lab (SN); null — не задан.
   *
   * По нему агент строит MQTT-топики device/<serial>/…, поэтому без него
   * Bambu-принтер приходится искать в сети (SSDP). У Moonraker и OctoPrint
   * такого понятия нет.
   */
  serialNumber: string | null;
  /** Чем агент управляет принтером: moonraker, octoprint или bambu. */
  protocolType: PrinterProtocol;
  /**
   * Адрес в локальной сети; null — не задан.
   *
   * Нужен не только агенту, но и карточке: форма «Подключение» правит адрес,
   * протокол и ключ по текущим значениям. Без миграции
   * `supabase/workshop_farm_and_shop.sql` колонки нет, поле показывается пустым,
   * и сохранение попросит адрес заново.
   */
  ipAddress: string | null;
  createdAt: string | null;
};

/** Проверенный ввод формы «Добавить принтер». */
export type PrinterDraft = {
  name: string;
  brand: string;
  model: string;
  /** Чем агент управляет принтером; Bambu добавляет к этому SN и LAN-режим. */
  protocolType: PrinterProtocol;
  /** SN для Bambu; пустая строка — поле скрыто или его не заполнили. */
  serialNumber: string;
  /** Адрес в локальной сети: без него агенту некуда подключаться. */
  ipAddress: string;
  /**
   * Ключ API (Moonraker/OctoPrint) или код доступа Bambu; пустая строка — не
   * задан, в базе это null. Секрет: уходит только агенту.
   */
  apiKey: string;
  nozzleInterval: number;
  lubricationInterval: number;
  zScrewInterval: number;
};

/** Ошибки по полям формы: подсказка стоит рядом с виновным полем. */
export type PrinterFormErrors = Partial<
  Record<
    | "name"
    | "brand"
    | "model"
    | "protocol"
    | "serialNumber"
    | "ipAddress"
    | "apiKey"
    | "nozzleInterval"
    | "lubricationInterval"
    | "zScrewInterval",
    string
  >
>;

/**
 * Базовые колонки парка — без живых полей агента.
 *
 * Нужны как запасной запрос: миграцию `supabase/workshop_farm_and_shop.sql`
 * применяют вручную, и без неё колонок status/progress/remaining_time/last_seen_at
 * в базе ещё нет. Тогда парк читается этим набором, а карточки показывают
 * обслуживание без метки состояния.
 */
export const PRINTER_BASE_COLUMNS =
  "id, name, brand, model, total_hours, nozzle_hours, nozzle_interval, lubrication_hours, lubrication_interval, z_screw_hours, z_screw_interval, last_maintenance_date, created_at";

/**
 * Колонки, которые читает lib/workshop/printer-store.ts: парк плюс живые поля
 * агента. serial_number, protocol_type и ip_address живут там же: их добавляет
 * та же миграция, а при её отсутствии printer-store перечитывает парк через
 * PRINTER_BASE_COLUMNS — карточка тогда покажет подключение пустым.
 */
export const PRINTER_COLUMNS = `${PRINTER_BASE_COLUMNS}, status, progress, remaining_time, last_seen_at, serial_number, protocol_type, ip_address`;

/** Пределы текстовых полей — как у колонок text в миграции. */
export const PRINTER_TEXT_LIMITS = {
  name: 60,
  brand: 40,
  model: 60,
  /** Серийный номер Bambu: check в workshop_farm_and_shop.sql — 1…64 символа. */
  serialNumber: 64,
  /** Ключ API / код доступа: check в workshop_farm_and_shop.sql — 1…512 символов. */
  apiKey: 512,
} as const;

/** Пределы интервалов обслуживания, ч. */
export const PRINTER_INTERVAL_LIMITS = {
  nozzleMin: 1,
  lubricationMin: 0,
  zScrewMin: 1,
  max: 10000,
} as const;

/** Интервалы по умолчанию — как в SQL, если модель не выбрана. */
export const PRINTER_INTERVAL_DEFAULTS = {
  nozzle: 400,
  lubrication: 300,
  zScrew: 720,
} as const;

/** Предел наработки: numeric(12, 2) с запасом на годы печати. */
export const PRINTER_HOURS_MAX = 1000000;

/**
 * Варианты `<select>` протокола: «Moonraker (Klipper)» понятнее, чем «Moonraker».
 *
 * Список один на форму добавления и на карточку принтера: две копии подписей
 * разъехались бы, и один и тот же протокол назывался бы по-разному.
 */
export const PRINTER_PROTOCOL_OPTIONS: readonly {
  value: PrinterProtocol;
  label: string;
}[] = [
  { value: "moonraker", label: "Moonraker (Klipper)" },
  { value: "octoprint", label: "OctoPrint" },
  { value: "bambu", label: "Bambu Lab (LAN)" },
];

/** Подпись протокола для интерфейса: «Moonraker (Klipper)». */
export function formatPrinterProtocol(value: PrinterProtocol): string {
  return (
    PRINTER_PROTOCOL_OPTIONS.find((option) => option.value === value)?.label ??
    value
  );
}

/** Предел адреса принтера — как у колонки ip_address (text, 1…253 символа). */
export const PRINTER_ADDRESS_MAX = 253;

/**
 * Сколько найденных принтеров принимает одно сканирование и одно подтверждение.
 *
 * Сотня принтеров — уже крупная ферма, а 200 строк хватает и на подсеть с
 * запасом: больше — это либо чужая сеть, либо сломанный агент, и такой ответ
 * лучше обрезать, чем записать в базу мегабайт JSON.
 */
export const DISCOVERED_PRINTERS_LIMIT = 200;

/**
 * Бренд и модель принтера из автообнаружения.
 *
 * Сеть знает только адрес и протокол, а колонки brand/model в workshop_printers
 * обязательные (not null, 1…40 и 1…60 символов). Если имя, введённое мастером,
 * совпало с пресетом («Bambu Lab P1S»), бренд и модель берутся из справочника;
 * иначе карточка честно показывает «Неизвестно · Найден по сети», а не пустоту.
 */
export const DISCOVERED_PRINTER_BRAND = "Неизвестно";
export const DISCOVERED_PRINTER_MODEL = "Найден по сети";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const hoursFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
});

/** Когда принтер выходил на связь: «29.10.2026, 14:05». */
const lastSeenFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Наработка для интерфейса: «412,5 ч». */
export function formatPrinterHours(value: number): string {
  return `${hoursFormatter.format(value)} ч`;
}

/** Идентификатор принтера: мусор отсекаем до запроса к PostgREST. */
export function isPrinterId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/**
 * Адрес принтера из ответа агента или из формы: IPv4, IPv6 или имя узла.
 *
 * Разрешены только символы, из которых состоят адреса. Пробел или «/» означали
 * бы, что агент прислал не адрес, а строку URL либо подпись, — подключиться по
 * такому значению нельзя, и в workshop_printers.ip_address ему не место. Адрес
 * длиннее 253 символов не влезает в колонку и check-ограничение миграции.
 * null — это не адрес.
 */
export function normalizePrinterAddress(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  if (text.length === 0 || text.length > PRINTER_ADDRESS_MAX) {
    return null;
  }

  return /^[0-9a-zA-Z.:_-]+$/.test(text) ? text : null;
}

/**
 * Серийный номер из ответа агента: `USN` SSDP-ответа Bambu (`01S00C123456789`).
 *
 * Агент присылает номер, который принтер назвал сам, поэтому проверяем ровно то,
 * что проверит база: длину 1…64 символа и отсутствие пробелов. Пробел или «/»
 * означали бы, что пришла не подпись устройства, а строка другого формата: такой
 * номер не годится ни в MQTT-топик `device/<serial>/…`, ни в SSDP-поиск.
 * null — номера нет: Moonraker и OctoPrint его не называют вовсе.
 */
export function normalizePrinterSerial(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  if (text.length === 0 || text.length > PRINTER_TEXT_LIMITS.serialNumber) {
    return null;
  }

  return /^[0-9A-Za-z_-]+$/.test(text) ? text : null;
}

/**
 * Ключ API (Moonraker/OctoPrint) или код доступа Bambu из ответа агента.
 *
 * Содержимое не ограничиваем алфавитом: ключ Moonraker — строка из
 * `moonraker.conf`, ключ OctoPrint — 32 hex-символа, код доступа Bambu — восемь
 * знаков с экрана принтера. Проверяем ровно то, что проверит база: непустую
 * строку до 512 символов (check `char_length(api_key) between 1 and 512`).
 * Пробелы по краям не считаются частью ключа и обрезаются: перенос строки из
 * буфера обмена — частая ошибка. null — ключа нет: и «не прислали», и «прислали
 * пустое».
 */
export function normalizePrinterApiKey(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  return text.length === 0 || text.length > PRINTER_TEXT_LIMITS.apiKey
    ? null
    : text;
}

/**
 * Принтер, найденный агентом: адрес, протокол, номер и ключ, если принтер или
 * агент их назвали.
 *
 * Серийный номер приходит только от Bambu: он же отвечает на SSDP-запрос
 * заголовком `USN`. Ключ доступа агент сегодня не присылает — его вводит мастер
 * в окне подтверждения, — но поле читается здесь, чтобы ключ, присланный вместе
 * с находкой, не потерялся при подтверждении. Для Moonraker и OctoPrint оба
 * поля обычно null.
 */
export type DiscoveredPrinterDraft = {
  ipAddress: string;
  protocolType: PrinterProtocol;
  serialNumber: string | null;
  apiKey: string | null;
};

/**
 * Принтер, которого мастер подтвердил: к адресу добавлены имя и ключ.
 *
 * `apiKey` — то, что мастер ввёл в окне мастера подключения (или пустая строка,
 * если не вводил). Секрет: значение уходит только в базу, в браузер не
 * возвращается.
 */
export type ApprovedPrinterDraft = {
  ipAddress: string;
  name: string;
  apiKey: string | null;
};

/** Итог разбора списка: что приняли и сколько строк отбросили. */
export type DiscoveredPrintersRead<Draft> = {
  drafts: Draft[];
  skipped: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Ключ сравнения адресов: регистр в записи IPv6 не важен. */
function addressKey(ipAddress: string | null): string {
  return ipAddress === null ? "" : ipAddress.toLocaleLowerCase("en-US");
}

/**
 * Ответ агента `[{ "ip_address": "192.168.1.50", "protocol_type": "moonraker" }]`.
 *
 * Мусорная строка не отменяет всё сканирование: агент обходит подсеть, и одна
 * странная запись не должна стоить сотни нормальных. Такие строки считаются в
 * `skipped`. Повтор адреса схлопывается — второй сканер в той же подсети иначе
 * удвоил бы карточки. Неизвестный протокол читается как moonraker: это default
 * колонки, и агент всегда может прислать протокол точнее.
 *
 * `serial_number` необязателен: его присылает только Bambu (SSDP-ответ), у
 * Moonraker и OctoPrint такого понятия нет. Нечитаемый номер не отбрасывает
 * находку — адрес и протокол важнее, — он просто теряется: без серийника
 * адаптер найдёт принтер сам.
 *
 * `api_key` агент сегодня не присылает: ключ вводит мастер в окне подтверждения.
 * Но если ключ пришёл вместе с находкой, он сохраняется — подтверждение
 * использует его, когда поле в окне оставлено пустым.
 *
 * null — тело не массив: это ошибка формата, а не «ничего не найдено» (пустой
 * массив как раз означает «в сети пусто», и старые находки должны исчезнуть).
 */
export function readDiscoveredPrinters(
  value: unknown,
): DiscoveredPrintersRead<DiscoveredPrinterDraft> | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const seen = new Set<string>();
  const drafts: DiscoveredPrinterDraft[] = [];
  let skipped = 0;

  for (const item of value) {
    const row = isRecord(item) ? item : null;
    const ipAddress = normalizePrinterAddress(row?.ip_address);
    const key = addressKey(ipAddress);
    const protocol = row ? row.protocol_type : null;

    if (
      ipAddress === null ||
      seen.has(key) ||
      drafts.length >= DISCOVERED_PRINTERS_LIMIT
    ) {
      skipped += 1;
      continue;
    }

    seen.add(key);
    drafts.push({
      ipAddress,
      protocolType: isPrinterProtocol(protocol) ? protocol : "moonraker",
      serialNumber: normalizePrinterSerial(row?.serial_number),
      apiKey: normalizePrinterApiKey(row?.api_key),
    });
  }

  return { drafts, skipped };
}

/**
 * Список на подтверждение от мастера
 * `[{ "ip_address": ..., "name": ..., "api_key": ... }]`.
 *
 * Подтверждается только принтер с именем: без имени карточка в парке была бы
 * безымянной, а мастер всё равно должен понимать, какой адрес он добавляет.
 * Строка без имени, с нечитаемым адресом или повтором адреса отбрасывается и
 * считается в `skipped`: список мог устареть, пока агент пересканировал сеть.
 * Имя длиннее предела колонки обрезается, а не роняет всю пачку.
 *
 * `api_key` необязателен: пустое поле — «ключа нет» (в базе null). Слишком
 * длинный ключ не обрезается: усечённый секрет — это неверный секрет, принтер
 * молча не подключится, поэтому такой ключ считается неуказанным.
 * null — это не массив: вызывающий отвечает ошибкой, а не «ничего не выбрано».
 */
export function readApprovedPrinters(
  value: unknown,
): DiscoveredPrintersRead<ApprovedPrinterDraft> | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const seen = new Set<string>();
  const drafts: ApprovedPrinterDraft[] = [];
  let skipped = 0;

  for (const item of value) {
    const row = isRecord(item) ? item : null;
    const ipAddress = normalizePrinterAddress(row?.ip_address);
    const key = addressKey(ipAddress);
    const name =
      row && typeof row.name === "string"
        ? row.name.trim().slice(0, PRINTER_TEXT_LIMITS.name)
        : "";

    if (
      ipAddress === null ||
      name.length === 0 ||
      seen.has(key) ||
      drafts.length >= DISCOVERED_PRINTERS_LIMIT
    ) {
      skipped += 1;
      continue;
    }

    seen.add(key);
    drafts.push({
      ipAddress,
      name,
      apiKey: normalizePrinterApiKey(row?.api_key),
    });
  }

  return { drafts, skipped };
}

/**
 * Принтер, которого агент нашёл в сети и который ждёт решения мастера.
 *
 * Строка `workshop_discovered_printers` — очередь «что подтвердить», а не история
 * сканирований: после переноса в парк она удаляется. Поэтому здесь только то,
 * что нужно мастеру подключения: адрес, протокол, серийный номер (Bambu называет
 * его в SSDP-ответе) и время находки.
 */
export type DiscoveredPrinter = {
  ipAddress: string;
  protocolType: PrinterProtocol;
  /** Номер из SSDP-ответа Bambu; null — принтер его не назвал. */
  serialNumber: string | null;
  discoveredAt: string | null;
};

/**
 * Имя по умолчанию для найденного принтера: «Принтер 192.168.1.50».
 *
 * Мастеру не нужно придумывать имя с нуля: адрес уже отличает принтеры друг от
 * друга, а переименовать можно тут же, в мастере. Длинный адрес обрезается до
 * предела колонки name — иначе первая же отправка упёрлась бы в check базы.
 */
export function defaultDiscoveredPrinterName(ipAddress: string): string {
  return `Принтер ${ipAddress}`.slice(0, PRINTER_TEXT_LIMITS.name);
}

/**
 * Строка workshop_discovered_printers → `DiscoveredPrinter`.
 *
 * Берём только статус `discovered`: `added` — уже перенесённый в парк принтер, в
 * мастере ему делать нечего. Битый адрес даёт null: подключиться по такой строке
 * нельзя, а в списке она выглядела бы рабочей. Неизвестный протокол читается
 * как moonraker — это default колонки и самый частый случай (Klipper).
 * `serial_number` читается тем же правилом, что и в ответе агента: номер нужен
 * только Bambu, у остальных он null.
 */
export function normalizeDiscoveredPrinterRow(
  row: Partial<Record<string, unknown>>,
): DiscoveredPrinter | null {
  const ipAddress = normalizePrinterAddress(row.ip_address);

  if (ipAddress === null || row.status !== "discovered") {
    return null;
  }

  return {
    ipAddress,
    protocolType: isPrinterProtocol(row.protocol_type)
      ? row.protocol_type
      : "moonraker",
    serialNumber: normalizePrinterSerial(row.serial_number),
    discoveredAt: typeof row.created_at === "string" ? row.created_at : null,
  };
}

/** Дата из формы или базы: только настоящий день в формате ГГГГ-ММ-ДД. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Процент износа узла для полоски: 0…∞ с одним знаком после запятой,
 * null — у узла нет регламента (интервал 0).
 *
 * Дробный процент, а не целый: при 100,3 % полоска уже красная, и подпись не
 * должна показывать «100 %», иначе цвет спорит с числом.
 */
export function printerMaintenancePercent(
  hours: number,
  interval: number,
): number | null {
  if (!Number.isFinite(hours) || !Number.isFinite(interval) || interval <= 0) {
    return null;
  }

  return Math.max(0, Math.round((hours / interval) * 1000) / 10);
}

/** Уровень обслуживания: зелёный до 80 %, жёлтый 80–100 %, красный сверх. */
export type MaintenanceLevel = "ok" | "due" | "overdue";

/** Уровень узла или null, если регламента нет (интервал смазки 0). */
export function printerMaintenanceLevel(
  hours: number,
  interval: number,
): MaintenanceLevel | null {
  if (!Number.isFinite(hours) || !Number.isFinite(interval) || interval <= 0) {
    return null;
  }

  const ratio = hours / interval;

  if (ratio > 1) {
    return "overdue";
  }

  return ratio >= 0.8 ? "due" : "ok";
}

/** Сколько узлов принтера требует внимания: для сводки над карточками. */
export function countMaintenanceDue(printer: WorkshopPrinter): number {
  const nozzle = printerMaintenanceLevel(
    printer.nozzleHours,
    printer.nozzleInterval,
  );
  const lubrication = printerMaintenanceLevel(
    printer.lubricationHours,
    printer.lubricationInterval,
  );
  const zScrew = printerMaintenanceLevel(
    printer.zScrewHours,
    printer.zScrewInterval,
  );

  return [nozzle, lubrication, zScrew].filter(
    (level) => level !== null && level !== "ok",
  ).length;
}

/**
 * Форма «Добавить принтер» → проверенные значения.
 *
 * Бренд и модель — свободный текст: справочник `PRINTER_PRESETS` только
 * подставляет интервалы в форме, а модель может быть любой. Сервер проверяет
 * длину названий и интервалы теми же пределами, что SQL.
 *
 * Адрес обязателен: агент подключается к принтеру напрямую, и без `ip_address`
 * карточка в парке осталась бы мёртвой. Ключ доступа необязателен — Moonraker и
 * OctoPrint часто работают без него, у Bambu это код с экрана; пустое поле
 * становится null, потому что check-ограничение миграции не принимает пустую
 * строку.
 */
export function readPrinterForm(formData: FormData): {
  draft: PrinterDraft | null;
  errors: PrinterFormErrors;
} {
  const errors: PrinterFormErrors = {};

  const name = readFormText(formData.get("name"));

  if (!name) {
    errors.name = "Введите имя принтера.";
  } else if (name.length > PRINTER_TEXT_LIMITS.name) {
    errors.name = `Не больше ${PRINTER_TEXT_LIMITS.name} символов.`;
  }

  const brand = readFormText(formData.get("brand"));

  if (!brand) {
    errors.brand = "Введите бренд принтера.";
  } else if (brand.length > PRINTER_TEXT_LIMITS.brand) {
    errors.brand = `Не больше ${PRINTER_TEXT_LIMITS.brand} символов.`;
  }

  const model = readFormText(formData.get("model"));

  if (!model) {
    errors.model = "Введите модель принтера.";
  } else if (model.length > PRINTER_TEXT_LIMITS.model) {
    errors.model = `Не больше ${PRINTER_TEXT_LIMITS.model} символов.`;
  }

  // Протокол приходит из `<select>`. Незнакомое значение — не повод терять
  // принтер: Moonraker — и default колонки в миграции, и самый частый выбор.
  const protocol = readFormText(formData.get("protocol"));
  const protocolType: PrinterProtocol = isPrinterProtocol(protocol)
    ? protocol
    : "moonraker";

  // SN есть только у Bambu: у Moonraker и OctoPrint поле в форме скрыто, и
  // чужое значение не сохраняем — иначе в базе остался бы номер, который агент
  // подставил бы в топик MQTT. Поле необязательное: без SN адаптер найдёт
  // принтер сам, через SSDP или топик отчёта.
  const serialNumber =
    protocolType === "bambu" ? readFormText(formData.get("serialNumber")) : "";

  if (serialNumber.length > PRINTER_TEXT_LIMITS.serialNumber) {
    errors.serialNumber = `Не больше ${PRINTER_TEXT_LIMITS.serialNumber} символов.`;
  }

  // Адрес проверяется тем же normalizePrinterAddress, что и находки агента:
  // «192.168.1.50» и «ender3.local» проходят, а «http://192.168.1.50» или
  // строка с пробелом — нет. Без адреса принтер не подключить, поэтому поле
  // обязательное.
  const ipAddress = normalizePrinterAddress(formData.get("ipAddress"));

  if (!ipAddress) {
    errors.ipAddress =
      "Укажите адрес вида 192.168.1.50 или имя узла (ender3.local) — без пробелов и «/».";
  }

  // Ключ необязателен и не обрезается по краям в базе (check смотрит на
  // char_length), поэтому пустое поле обязано стать null, а не "".
  const apiKey = readFormText(formData.get("apiKey"));

  if (apiKey.length > PRINTER_TEXT_LIMITS.apiKey) {
    errors.apiKey = `Не больше ${PRINTER_TEXT_LIMITS.apiKey} символов.`;
  }

  const nozzleInterval = readInterval(
    formData.get("nozzleInterval"),
    PRINTER_INTERVAL_LIMITS.nozzleMin,
  );

  if (nozzleInterval === null) {
    errors.nozzleInterval = `Допустимо от ${PRINTER_INTERVAL_LIMITS.nozzleMin} до ${formatWorkshopLimit(PRINTER_INTERVAL_LIMITS.max)} ч.`;
  }

  const lubricationInterval = readInterval(
    formData.get("lubricationInterval"),
    PRINTER_INTERVAL_LIMITS.lubricationMin,
  );

  if (lubricationInterval === null) {
    errors.lubricationInterval = `Допустимо от ${PRINTER_INTERVAL_LIMITS.lubricationMin} до ${formatWorkshopLimit(PRINTER_INTERVAL_LIMITS.max)} ч. 0 — смазка не требуется.`;
  }

  const zScrewInterval = readInterval(
    formData.get("zScrewInterval"),
    PRINTER_INTERVAL_LIMITS.zScrewMin,
  );

  if (zScrewInterval === null) {
    errors.zScrewInterval = `Допустимо от ${PRINTER_INTERVAL_LIMITS.zScrewMin} до ${formatWorkshopLimit(PRINTER_INTERVAL_LIMITS.max)} ч.`;
  }

  if (
    brand.length === 0 ||
    model.length === 0 ||
    ipAddress === null ||
    nozzleInterval === null ||
    lubricationInterval === null ||
    zScrewInterval === null ||
    Object.keys(errors).length > 0
  ) {
    return { draft: null, errors };
  }

  return {
    draft: {
      name,
      brand,
      model,
      protocolType,
      serialNumber,
      ipAddress,
      apiKey,
      nozzleInterval,
      lubricationInterval,
      zScrewInterval,
    },
    errors,
  };
}

/**
 * Проверенный ввод формы «Подключение» в карточке принтера.
 *
 * Отличается от `PrinterDraft` тем, что имя, бренд, модель и интервалы
 * обслуживания карточка не меняет — их задают при добавлении. Ключ доступа
 * приходит пустым, когда мастер его не трогал: пустая строка означает «оставь
 * сохранённый секрет», а не «сотри ключ».
 */
export type PrinterConnectionDraft = {
  protocolType: PrinterProtocol;
  ipAddress: string;
  /** SN для Bambu; пустая строка — в базе null. */
  serialNumber: string;
  apiKey: string;
};

/**
 * Разбор формы «Подключение».
 *
 * Проверки те же, что у формы добавления (`normalizePrinterAddress`, длина SN и
 * ключа из `PRINTER_TEXT_LIMITS`), но протокол здесь обязателен: при добавлении
 * незнакомое значение молча становилось moonraker, а при правке это означало бы
 * «смени протокол» — принтер перестал бы отвечать агенту.
 */
export function readPrinterConnectionForm(formData: FormData): {
  draft: PrinterConnectionDraft | null;
  errors: PrinterFormErrors;
} {
  const errors: PrinterFormErrors = {};

  const protocol = readFormText(formData.get("protocol"));

  if (!isPrinterProtocol(protocol)) {
    errors.protocol = "Выберите протокол: Moonraker, OctoPrint или Bambu Lab.";
  }

  const protocolType: PrinterProtocol = isPrinterProtocol(protocol)
    ? protocol
    : "moonraker";

  const ipAddress = normalizePrinterAddress(formData.get("ipAddress"));

  if (!ipAddress) {
    errors.ipAddress =
      "Укажите адрес вида 192.168.1.50 или имя узла (ender3.local) — без пробелов и «/».";
  }

  // SN есть только у Bambu: у Moonraker и OctoPrint такого понятия нет, а чужое
  // значение агент подставил бы в топик MQTT.
  const serialNumber =
    protocolType === "bambu" ? readFormText(formData.get("serialNumber")) : "";

  if (serialNumber.length > PRINTER_TEXT_LIMITS.serialNumber) {
    errors.serialNumber = `Не больше ${PRINTER_TEXT_LIMITS.serialNumber} символов.`;
  }

  // Пустая строка — «ключ не меняем»: сохранённый секрет в браузер не попадает,
  // поэтому поле всегда показывается пустым.
  const apiKey = readFormText(formData.get("apiKey"));

  if (apiKey.length > PRINTER_TEXT_LIMITS.apiKey) {
    errors.apiKey = `Не больше ${PRINTER_TEXT_LIMITS.apiKey} символов.`;
  }

  if (ipAddress === null || Object.keys(errors).length > 0) {
    return { draft: null, errors };
  }

  return {
    draft: { protocolType, ipAddress, serialNumber, apiKey },
    errors,
  };
}

/**
 * Строка `workshop_printers` → принтер для интерфейса.
 *
 * Битое число заменяется значением по умолчанию, строка без корректного id
 * отбрасывается: без id принтер нельзя ни показать, ни обслужить. Нулевой
 * интервал сопла из старой строки не роняет карточку — он покажется как
 * «нет регламента», а не как деление на ноль.
 */
export function normalizePrinterRow(
  row: Partial<Record<string, unknown>> | null | undefined,
): WorkshopPrinter | null {
  if (!row || !isPrinterId(row.id)) {
    return null;
  }

  const nozzleInterval =
    readNumberInRange(
      row.nozzle_interval,
      PRINTER_INTERVAL_LIMITS.nozzleMin,
      PRINTER_INTERVAL_LIMITS.max,
      true,
    ) ?? PRINTER_INTERVAL_DEFAULTS.nozzle;

  const lubricationInterval =
    readNumberInRange(
      row.lubrication_interval,
      PRINTER_INTERVAL_LIMITS.lubricationMin,
      PRINTER_INTERVAL_LIMITS.max,
      true,
    ) ?? PRINTER_INTERVAL_DEFAULTS.lubrication;

  const zScrewInterval =
    readNumberInRange(
      row.z_screw_interval,
      PRINTER_INTERVAL_LIMITS.zScrewMin,
      PRINTER_INTERVAL_LIMITS.max,
      true,
    ) ?? PRINTER_INTERVAL_DEFAULTS.zScrew;

  return {
    id: row.id,
    name:
      readText(row.name, PRINTER_TEXT_LIMITS.name) || "Принтер без имени",
    brand: readText(row.brand, PRINTER_TEXT_LIMITS.brand),
    model: readText(row.model, PRINTER_TEXT_LIMITS.model),
    totalHours: readNumberInRange(row.total_hours, 0, PRINTER_HOURS_MAX) ?? 0,
    nozzleHours: readNumberInRange(row.nozzle_hours, 0, PRINTER_HOURS_MAX) ?? 0,
    nozzleInterval,
    lubricationHours:
      readNumberInRange(row.lubrication_hours, 0, PRINTER_HOURS_MAX) ?? 0,
    lubricationInterval,
    zScrewHours: readNumberInRange(row.z_screw_hours, 0, PRINTER_HOURS_MAX) ?? 0,
    zScrewInterval,
    lastMaintenanceDate: isIsoDate(row.last_maintenance_date)
      ? row.last_maintenance_date
      : null,
    // Живые поля агента: незнакомый статус не ломает карточку, а читается как
    // «свободен» — так же, как default колонки в миграции.
    status: isPrinterFarmStatus(row.status) ? row.status : "idle",
    progress: readNumberInRange(row.progress, 0, 100, true) ?? 0,
    remainingTime:
      readNumberInRange(row.remaining_time, 0, Number.MAX_SAFE_INTEGER, true) ??
      0,
    lastSeenAt: typeof row.last_seen_at === "string" ? row.last_seen_at : null,
    // Пустая строка и null — одно и то же «номера нет»: форма присылает "".
    serialNumber:
      readText(row.serial_number, PRINTER_TEXT_LIMITS.serialNumber) || null,
    // Подключение: без миграции колонок нет — протокол читается как default
    // базы (moonraker), адрес остаётся пустым.
    protocolType: isPrinterProtocol(row.protocol_type)
      ? row.protocol_type
      : "moonraker",
    ipAddress: normalizePrinterAddress(row.ip_address),
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
  };
}

/**
 * Дата обслуживания: «24.10.2026» вместо машинного «2026-10-24».
 */
export function formatPrinterDate(value: string | null): string {
  if (!isIsoDate(value)) {
    return "—";
  }

  const [year, month, day] = value.split("-");

  return `${day}.${month}.${year}`;
}

/**
 * Когда принтер последний раз выходил на связь.
 *
 * `last_seen_at` пишет пульс агента фермы; null — агент ещё ни разу не
 * отчитался по этому принтеру. Строка «ещё не выходил на связь» честнее
 * прочерка: в карточке принтера она отвечает на вопрос «агент его видит?».
 */
export function formatPrinterLastSeen(value: string | null): string {
  if (typeof value !== "string") {
    return "ещё не выходил на связь";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "ещё не выходил на связь";
  }

  return lastSeenFormatter.format(date);
}

/** Сколько принтер может молчать: дольше — «офлайн», даже если status говорит иное. */
export const PRINTER_OFFLINE_AFTER_MS = 2 * 60 * 1000;

/**
 * Состояние для карточки с поправкой на давность ответа.
 *
 * `last_seen_at` старше двух минут значит, что агент потерял принтер: прогресс
 * застыл, и подпись «Печатает» была бы обманом. Отметки нет (null) — агент ещё
 * ни разу не отчитывался, судить об офлайне не по чему: метку даёт сам статус.
 * Без этой оговорки парк, добавленный вручную и ещё не подключённый, выглядел
 * бы серым целиком.
 *
 * `now === null` — разметка до монтирования в браузере: время сервера и клиента
 * может разойтись, поэтому срок не проверяется и SSR с гидратацией дают
 * одинаковый результат.
 */
export function resolvePrinterLiveStatus(
  printer: Pick<WorkshopPrinter, "status" | "lastSeenAt">,
  now: number | null,
): PrinterFarmStatus {
  if (printer.status === "offline" || now === null) {
    return printer.status;
  }

  const seenAt = printer.lastSeenAt
    ? Date.parse(printer.lastSeenAt)
    : Number.NaN;

  if (Number.isNaN(seenAt)) {
    return printer.status;
  }

  return now - seenAt > PRINTER_OFFLINE_AFTER_MS ? "offline" : printer.status;
}

/**
 * Остаток печати словами: «меньше минуты», «45 мин», «1 ч 20 мин».
 * null — показывать нечего: печати нет или пришёл ноль вместо секунд.
 */
export function formatPrinterRemaining(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  if (seconds < 60) {
    return "меньше минуты";
  }

  const minutes = Math.ceil(seconds / 60);

  if (minutes < 60) {
    return `${minutes} мин`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} мин`;
}

/** Интервал из формы: целое число в допустимых пределах или null. */
function readInterval(
  value: FormDataEntryValue | null,
  min: number,
): number | null {
  const parsed = parseWorkshopNumber(value);

  if (parsed === null) {
    return null;
  }

  const rounded = Math.round(parsed);

  return rounded >= min && rounded <= PRINTER_INTERVAL_LIMITS.max
    ? rounded
    : null;
}

/** Число из строки формы или ответа PostgREST: только в пределах. */
function readNumberInRange(
  value: unknown,
  min: number,
  max: number,
  integer = false,
): number | null {
  const parsed = parseWorkshopNumber(value);

  if (parsed === null) {
    return null;
  }

  const rounded = integer ? Math.round(parsed) : Math.round(parsed * 100) / 100;

  return rounded < min || rounded > max ? null : rounded;
}

/** Текст из строки базы: обрезаем пробелы и лишнюю длину. */
function readText(value: unknown, limit: number): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

/** Текст из формы: пробелы по краям не считаются содержимым. */
function readFormText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}
