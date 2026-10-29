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
  createdAt: string | null;
};

/** Проверенный ввод формы «Добавить принтер». */
export type PrinterDraft = {
  name: string;
  brand: string;
  model: string;
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

/** Колонки, которые читает lib/workshop/printer-store.ts: парк плюс живые поля. */
export const PRINTER_COLUMNS = `${PRINTER_BASE_COLUMNS}, status, progress, remaining_time, last_seen_at`;

/** Пределы текстовых полей — как у колонок text в миграции. */
export const PRINTER_TEXT_LIMITS = {
  name: 60,
  brand: 40,
  model: 60,
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const hoursFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
});

/** Наработка для интерфейса: «412,5 ч». */
export function formatPrinterHours(value: number): string {
  return `${hoursFormatter.format(value)} ч`;
}

/** Идентификатор принтера: мусор отсекаем до запроса к PostgREST. */
export function isPrinterId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
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
      nozzleInterval,
      lubricationInterval,
      zScrewInterval,
    },
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
