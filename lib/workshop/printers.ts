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
 * карбоновые стержни чистят спиртом, а не смазывают. Интервал сопла нулевым
 * быть не может: на него делят процент износа.
 */
import {
  PRINTER_PRESETS,
  type PrinterPreset,
} from "@/lib/workshop/printer-presets";
import {
  formatWorkshopLimit,
  parseWorkshopNumber,
} from "@/lib/workshop/settings";

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
  /** Дата последнего обслуживания в формате ГГГГ-ММ-ДД. */
  lastMaintenanceDate: string | null;
  createdAt: string | null;
};

/** Проверенный ввод формы «Добавить принтер». */
export type PrinterDraft = {
  name: string;
  brand: string;
  model: string;
  nozzleInterval: number;
  lubricationInterval: number;
};

/** Ошибки по полям формы: подсказка стоит рядом с виновным полем. */
export type PrinterFormErrors = Partial<
  Record<"name" | "preset" | "nozzleInterval" | "lubricationInterval", string>
>;

/** Колонки, которые читает lib/workshop/printer-store.ts. */
export const PRINTER_COLUMNS =
  "id, name, brand, model, total_hours, nozzle_hours, nozzle_interval, lubrication_hours, lubrication_interval, last_maintenance_date, created_at";

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
  max: 10000,
} as const;

/** Интервалы по умолчанию — как в SQL, если модель не выбрана. */
export const PRINTER_INTERVAL_DEFAULTS = {
  nozzle: 400,
  lubrication: 300,
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

/** Пресет по индексу из `<select>`: индекс — единственное, что шлёт форма. */
export function findPrinterPreset(value: unknown): PrinterPreset | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return null;
  }

  const index = Number(value);

  return index >= 0 && index < PRINTER_PRESETS.length
    ? PRINTER_PRESETS[index]
    : null;
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

  return [nozzle, lubrication].filter(
    (level) => level !== null && level !== "ok",
  ).length;
}

/**
 * Форма «Добавить принтер» → проверенные значения.
 *
 * Бренд и модель берутся из `PRINTER_PRESETS` по индексу, а интервалы читаются
 * из полей: при выборе модели форма подставляет числа производителя, но
 * мастера с другой загрузкой может их поправить — так и написано в подсказке
 * справочника. Сервер проверяет интервалы теми же пределами, что SQL.
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

  const preset = findPrinterPreset(formData.get("preset"));

  if (!preset) {
    errors.preset = "Выберите модель принтера.";
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

  if (
    !preset ||
    nozzleInterval === null ||
    lubricationInterval === null ||
    Object.keys(errors).length > 0
  ) {
    return { draft: null, errors };
  }

  return {
    draft: {
      name,
      brand: preset.brand,
      model: preset.model,
      nozzleInterval,
      lubricationInterval,
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
    lastMaintenanceDate: isIsoDate(row.last_maintenance_date)
      ? row.last_maintenance_date
      : null,
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
