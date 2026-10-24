/**
 * Настройки калькулятора Мастерской: значения по умолчанию, пределы и разбор
 * формы.
 *
 * Правило одно на три места: страница показывает сохранённые значения, Server
 * Action проверяет форму теми же пределами, а `supabase/workshop_settings.sql`
 * повторяет их в check-ограничениях. Если пределы разъедутся, форма сохранит
 * число, которое база отклонит, и пользователь увидит непонятную ошибку.
 *
 * PostgREST отдаёт numeric строкой («5.50»), поэтому чтение из базы идёт через
 * тот же parseWorkshopNumber, что и разбор формы: «5,5» из поля ввода и «5.50»
 * из базы превращаются в одно и то же число.
 */

/** Четыре числа калькулятора в том виде, в каком с ними работает интерфейс. */
export type WorkshopSettings = {
  electricityCostKwh: number;
  printerPowerW: number;
  depreciationCostHour: number;
  laborCostHour: number;
};

export type WorkshopSettingKey = keyof WorkshopSettings;

/** Поле формы: подпись, имя в FormData, колонка в workshop_settings и пределы. */
export type WorkshopField = {
  key: WorkshopSettingKey;
  /** Имя поля в форме и в FormData. */
  formName: string;
  /** Колонка таблицы workshop_settings. */
  column: string;
  label: string;
  hint: string;
  step: string;
  min: number;
  max: number;
  /** Мощность в базе — integer, поэтому дробное значение округляется. */
  integer?: boolean;
};

/**
 * Значения из SQL-миграции. Свежая строка создаётся из них, а если миграция ещё
 * не применена, калькулятор считает по этим же числам и честно предупреждает,
 * что сохранение недоступно.
 */
export const WORKSHOP_SETTINGS_DEFAULTS: WorkshopSettings = {
  electricityCostKwh: 5.5,
  printerPowerW: 150,
  depreciationCostHour: 10,
  laborCostHour: 300,
};

/**
 * Поля формы в порядке показа. Пределы совпадают с check-ограничениями:
 * 0…1000 ₽ за кВт·ч, 0…10 000 Вт, 0…100 000 ₽ за час.
 */
export const WORKSHOP_FIELDS: readonly WorkshopField[] = [
  {
    key: "electricityCostKwh",
    formName: "electricityCostKwh",
    column: "electricity_cost_kwh",
    label: "Цена электричества (₽/кВт·ч)",
    hint: "Тариф из квитанции — обычно 4–7 ₽ за киловатт-час.",
    step: "0.01",
    min: 0,
    max: 1000,
  },
  {
    key: "printerPowerW",
    formName: "printerPowerW",
    column: "printer_power_w",
    label: "Мощность принтера (Вт)",
    hint: "Среднее потребление во время печати: у настольного FDM-принтера это 100–200 Вт.",
    step: "1",
    min: 0,
    max: 10000,
    integer: true,
  },
  {
    key: "depreciationCostHour",
    formName: "depreciationCostHour",
    column: "depreciation_cost_hour",
    label: "Амортизация (₽/час)",
    hint: "Износ принтера за час печати: цена принтера делённая на его ресурс.",
    step: "0.01",
    min: 0,
    max: 100000,
  },
  {
    key: "laborCostHour",
    formName: "laborCostHour",
    column: "labor_cost_hour",
    label: "Стоимость часа работы (₽/час)",
    hint: "Сколько стоит час вашей работы: подготовка модели, снятие, обработка.",
    step: "0.01",
    min: 0,
    max: 100000,
  },
];

/** Колонки, которые читает lib/workshop/store.ts. */
export const WORKSHOP_SETTINGS_COLUMNS =
  "electricity_cost_kwh, printer_power_w, depreciation_cost_hour, labor_cost_hour";

/** Ошибки полей формы: подсказка стоит рядом с нужным полем. */
export type WorkshopSettingsErrors = Partial<Record<WorkshopSettingKey, string>>;

const limitFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
});

/** Предел для текста ошибки: «100 000», а не «100000». */
export function formatWorkshopLimit(value: number): string {
  return limitFormatter.format(value);
}

/**
 * Число из строки формы или из ответа PostgREST.
 *
 * Принимает «1,5» (запятая на русской раскладке), «1.5» и число; пробелы и
 * неразрывные пробелы выбрасывает. Всё остальное — null: пустое поле, «abc»,
 * NaN и бесконечность.
 */
export function parseWorkshopNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const text = value
    .trim()
    .replace(/[\s\u00a0]/g, "")
    .replace(",", ".");

  if (!text) {
    return null;
  }

  const number = Number(text);

  return Number.isFinite(number) ? number : null;
}

/** Округление до копеек (целые поля — до единицы) и проверка пределов. */
function fitSettingValue(field: WorkshopField, value: number): number | null {
  const rounded = field.integer
    ? Math.round(value)
    : Math.round(value * 100) / 100;

  if (rounded < field.min || rounded > field.max) {
    return null;
  }

  return rounded;
}

/**
 * Строка `workshop_settings` → настройки для интерфейса.
 *
 * Незнакомое или вышедшее за пределы значение заменяется значением по
 * умолчанию: строка могла попасть в базу от прошлой версии формы, и страница
 * не должна из-за неё падать. Отсутствующая строка — тоже значения по
 * умолчанию.
 */
export function normalizeWorkshopSettings(
  row: Partial<Record<string, unknown>> | null | undefined,
): WorkshopSettings {
  const settings = { ...WORKSHOP_SETTINGS_DEFAULTS };

  if (!row) {
    return settings;
  }

  for (const field of WORKSHOP_FIELDS) {
    const parsed = parseWorkshopNumber(row[field.column]);

    if (parsed === null) {
      continue;
    }

    const value = fitSettingValue(field, parsed);

    if (value !== null) {
      settings[field.key] = value;
    }
  }

  return settings;
}

/**
 * Форма → настройки для записи.
 *
 * Возвращает либо полный набор чисел, либо null и ошибки по полям: частично
 * сохранённые настройки хуже, чем честная подсказка, какое поле исправить.
 */
export function readWorkshopSettingsForm(formData: FormData): {
  settings: WorkshopSettings | null;
  errors: WorkshopSettingsErrors;
} {
  const errors: WorkshopSettingsErrors = {};
  const settings = { ...WORKSHOP_SETTINGS_DEFAULTS };

  for (const field of WORKSHOP_FIELDS) {
    const parsed = parseWorkshopNumber(formData.get(field.formName));
    const value = parsed === null ? null : fitSettingValue(field, parsed);

    if (value === null) {
      errors[field.key] =
        parsed === null
          ? "Введите число."
          : `Допустимо от ${formatWorkshopLimit(field.min)} до ${formatWorkshopLimit(field.max)}.`;
      continue;
    }

    settings[field.key] = value;
  }

  return Object.keys(errors).length > 0
    ? { settings: null, errors }
    : { settings, errors };
}
