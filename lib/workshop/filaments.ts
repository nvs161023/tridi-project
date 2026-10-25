/**
 * Склад пластика Мастерской: модель катушки, пределы полей и разбор форм.
 *
 * Те же три места, что у настроек калькулятора: форма проверяет ввод этими
 * пределами, Server Action — теми же функциями, а `supabase/workshop_filaments.sql`
 * повторяет их в check-ограничениях. Расхождение пределов означало бы, что форма
 * пропустит число, которое база отклонит.
 *
 * Вес в базе — integer: катушка измеряется граммами, десятые доли значат только
 * для парсера G-code. Поэтому ввод округляется до целого, а не отклоняется.
 *
 * Импорт из фото переиспользует те же пределы: название раскладывается на бренд,
 * тип и цвет, количество с единицей превращается в вес, а стоимость позиции —
 * в цену за килограмм. Нечитаемая цена заменяется значением по умолчанию.
 */
import { DEFAULT_PLASTIC_PRICE_PER_KG } from "@/lib/workshop/calculator";
import {
  formatWorkshopLimit,
  parseWorkshopNumber,
} from "@/lib/workshop/settings";

/** Катушка в том виде, в каком с ней работает интерфейс. */
export type WorkshopFilament = {
  id: string;
  brand: string;
  type: string;
  color: string;
  totalWeightG: number;
  remainingWeightG: number;
  pricePerKg: number;
  minThresholdG: number;
  /** Ссылка на товар: по ней ведёт кнопка «Купить». */
  purchaseUrl: string | null;
  createdAt: string | null;
};

/** Позиция спецификации на закупку: катушка и сколько граммов нужно купить. */
export type FilamentOrderItem = {
  filamentId: string;
  quantityGrams: number;
};

/**
 * Границы списка закупки.
 *
 * Список приходит из адреса печатной формы, поэтому его размер и количество
 * проверяются до запроса в базу. Верхняя граница граммов совпадает с
 * ограничением веса катушки в `supabase/workshop_filaments.sql`.
 */
export const FILAMENT_ORDER_LIMITS = {
  maxItems: 100,
  minGrams: 1,
  maxGrams: 100000,
} as const;

export type FilamentTextKey = "brand" | "type" | "color" | "purchaseUrl";
export type FilamentNumberKey =
  | "totalWeightG"
  | "remainingWeightG"
  | "pricePerKg"
  | "minThresholdG";

/** Проверенный ввод формы «Добавить катушку». Ссылка — пустая строка, если её нет. */
export type FilamentDraft = Record<FilamentTextKey, string> &
  Record<FilamentNumberKey, number>;

/** Ошибки по полям формы: подсказка стоит рядом с виновным полем. */
export type FilamentFormErrors = Partial<
  Record<FilamentTextKey | FilamentNumberKey, string>
>;

/** Числовое поле формы: подпись, имя в FormData, колонка в таблице и пределы. */
export type FilamentNumberField = {
  key: FilamentNumberKey;
  formName: string;
  column: string;
  label: string;
  hint: string;
  step: string;
  min: number;
  max: number;
  /** Вес в граммах — целое, цена — с копейками. */
  integer?: boolean;
};

/** Колонки, которые читает lib/workshop/filament-store.ts. */
export const FILAMENT_COLUMNS =
  "id, brand, type, color, total_weight_g, remaining_weight_g, price_per_kg, min_threshold_g, purchase_url, created_at";

/** Пределы текстовых полей — как у колонок text в миграции. */
export const FILAMENT_TEXT_LIMITS = {
  brand: 60,
  type: 30,
  color: 40,
  purchaseUrl: 500,
} as const;

/** Значения по умолчанию: типовая катушка 1 кг с порогом «пора докупить». */
export const FILAMENT_DEFAULTS = {
  totalWeightG: 1000,
  minThresholdG: 200,
  pricePerKg: DEFAULT_PLASTIC_PRICE_PER_KG,
} as const;

/**
 * Подсказки для поля «Бренд»: популярные производители филамента.
 *
 * Это `<datalist>`, а не список допустимых значений: свой бренд напечатать можно,
 * иначе половина катушек не попала бы на склад. Сервер по-прежнему проверяет
 * только длину (1…60 символов) — см. FILAMENT_TEXT_LIMITS.
 */
export const FILAMENT_BRANDS = [
  "eSun",
  "Sunlu",
  "Polymaker",
  "Bambu Lab",
  "Prusament",
  "Anycubic",
  "Creality",
  "Devil Design",
  "Bestfilament",
  "FDPlast",
  "REC",
  "3DPlast",
  "Semenych",
] as const;

/** Подсказки для поля «Тип»: вводить можно любой, это только ускорение. */
export const FILAMENT_TYPE_SUGGESTIONS = [
  "PLA",
  "PETG",
  "ABS",
  "ASA",
  "TPU",
  "Nylon",
] as const;

/** Сколько строк с фото можно сохранить на склад за один вызов. */
export const IMPORTED_FILAMENTS_MAX = 100;

/** Итог сохранения распознанных позиций: сколько записей создано и сколько нет. */
export type SaveImportedFilamentsResult = {
  saved: number;
  failed: number;
  /** Общая ошибка: сессия, подписка, миграция или пустой список. */
  error?: string;
};

/** Тип пластика, который ищем в названии, и его каноническая запись. */
const IMPORTED_TYPE_TOKENS: readonly { type: string; token: string }[] = [
  { type: "PLA", token: "PLA" },
  { type: "PETG", token: "PETG" },
  { type: "ABS", token: "ABS" },
  { type: "ASA", token: "ASA" },
  { type: "TPU", token: "TPU" },
  { type: "Nylon", token: "Nylon" },
  { type: "HIPS", token: "HIPS" },
  { type: "PVA", token: "PVA" },
  { type: "PC", token: "PC" },
  { type: "PEEK", token: "PEEK" },
  { type: "POM", token: "POM" },
  { type: "PP", token: "PP" },
];

const WORD_CHAR_PATTERN = /[\p{L}\p{N}]/u;

/** Буква или цифра на границе слова: по ним отличаем eSun от «rec» в «direct». */
function isWordChar(value: string | undefined): boolean {
  return value !== undefined && WORD_CHAR_PATTERN.test(value);
}

/** Первое вхождение токена отдельным словом: регистр не важен. */
function findWordToken(
  value: string,
  token: string,
): { index: number; length: number } | null {
  const haystack = value.toLocaleLowerCase("ru-RU");
  const needle = token.toLocaleLowerCase("ru-RU");
  let from = 0;

  while (from <= haystack.length) {
    const index = haystack.indexOf(needle, from);

    if (index === -1) {
      return null;
    }

    const before = haystack[index - 1];
    const after = haystack[index + needle.length];

    if (!isWordChar(before) && !isWordChar(after)) {
      return { index, length: needle.length };
    }

    from = index + 1;
  }

  return null;
}

/** Убирает из названия найденный кусок, чтобы осталось только описание цвета. */
function cutToken(
  value: string,
  token: { index: number; length: number } | null,
): string {
  if (!token) {
    return value;
  }

  return `${value.slice(0, token.index)} ${value.slice(token.index + token.length)}`;
}

/**
 * Цвет из остатка названия.
 *
 * Скобки и знаки препинания после вырезанного бренда и типа не несут смысла,
 * поэтому превращаются в пробелы. Общие слова «пластик» и «филамент» тоже
 * убираем: в накладной это описание товара, а не цвет катушки.
 */
function cleanImportedColor(value: string): string {
  const cleaned = value
    .replace(/[()[\]{}]/g, " ")
    .replace(
      /(^|[^\p{L}\p{N}])(?:филамент|пластик|пластика|нить|3d)(?=$|[^\p{L}\p{N}])/giu,
      "$1",
    )
    .replace(/[.,;:·|/\\_+]+/g, " ")
    .replace(/\s*[-–—]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[-–—,;:.]+|[-–—,;:.]+$/g, "")
    .trim();

  return cleaned.slice(0, FILAMENT_TEXT_LIMITS.color).trim() || "Разное";
}

/**
 * Название из накладной → бренд, тип и цвет.
 *
 * Бренд и тип вырезаются как отдельные слова: «eSun» не должен находиться
 * внутри другого слова, а «PLA+» остаётся типом PLA, а не цветом «+».
 */
export function parseImportedFilamentName(name: string): {
  brand: string;
  type: string;
  color: string;
} {
  const source = name.trim();
  let remainder = source;
  let brand = "Импорт";

  for (const knownBrand of FILAMENT_BRANDS) {
    const token = findWordToken(source, knownBrand);

    if (token) {
      brand = knownBrand;
      remainder = cutToken(remainder, token);
      break;
    }
  }

  let type = "PLA";

  for (const candidate of IMPORTED_TYPE_TOKENS) {
    const token = findWordToken(remainder, candidate.token);

    if (!token) {
      continue;
    }

    type = candidate.type;

    // Плюс в «PLA+» — часть обозначения типа, а не начало цвета.
    const hasPlus = remainder[token.index + token.length] === "+";

    remainder = cutToken(remainder, {
      index: token.index,
      length: token.length + (hasPlus ? 1 : 0),
    });
    break;
  }

  return {
    brand: brand.slice(0, FILAMENT_TEXT_LIMITS.brand).trim() || "Импорт",
    type: type.slice(0, FILAMENT_TEXT_LIMITS.type).trim() || "PLA",
    color: cleanImportedColor(remainder),
  };
}

/**
 * Вес одной позиции в граммах.
 *
 * Килограммы переводим в граммы, граммы оставляем как есть. Неизвестная
 * единица («шт», «уп») не даёт веса, поэтому берём типовую катушку 1 кг.
 * Значение округляем и держим в пределах колонок миграции.
 */
function importedWeightG(quantity: number, unit: string): number {
  const normalized = unit
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replace(/\.$/, "");

  const grams =
    normalized === "кг" ||
    normalized === "kg" ||
    normalized === "килограмм" ||
    normalized === "килограммов"
      ? quantity * 1000
      : normalized === "г" ||
          normalized === "гр" ||
          normalized === "g" ||
          normalized === "gram" ||
          normalized === "grams"
        ? quantity
        : FILAMENT_DEFAULTS.totalWeightG;

  return Math.min(100000, Math.max(1, Math.round(grams)));
}

/**
 * Строка OCR → проверенный черновик катушки.
 *
 * Повторяет проверки клиента: Server Action — публичный endpoint, поэтому
 * массив из браузера не считается доверенным. Нечитаемая цена не ошибка —
 * подставляем цену по умолчанию, как и обещает импорт.
 */
export function createImportedFilamentDraft(
  value: unknown,
): FilamentDraft | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const unit = typeof record.unit === "string" ? record.unit.trim() : "";
  const quantity = record.quantity;

  if (
    !name ||
    !unit ||
    typeof quantity !== "number" ||
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    return null;
  }

  const price =
    typeof record.price === "number" &&
    Number.isFinite(record.price) &&
    record.price >= 0
      ? record.price
      : null;
  const weight = importedWeightG(quantity, unit);
  const pricePerKg =
    price === null
      ? FILAMENT_DEFAULTS.pricePerKg
      : Math.round((price / (weight / 1000)) * 100) / 100;

  if (
    !Number.isFinite(pricePerKg) ||
    pricePerKg < 0 ||
    pricePerKg > 100000
  ) {
    return null;
  }

  return {
    ...parseImportedFilamentName(name),
    totalWeightG: weight,
    remainingWeightG: weight,
    pricePerKg,
    minThresholdG: FILAMENT_DEFAULTS.minThresholdG,
    purchaseUrl: "",
  };
}

/**
 * Числовые поля формы. Остаток вводится отдельно: катушка может приехать
 * начатой, а после первой печати остаток всё равно расходится с весом.
 */
export const FILAMENT_NUMBER_FIELDS: readonly FilamentNumberField[] = [
  {
    key: "totalWeightG",
    formName: "totalWeightG",
    column: "total_weight_g",
    label: "Общий вес (г)",
    hint: "Сколько пластика было в новой катушке: обычно 1 000 г.",
    step: "1",
    min: 1,
    max: 100000,
    integer: true,
  },
  {
    key: "remainingWeightG",
    formName: "remainingWeightG",
    column: "remaining_weight_g",
    label: "Остаток (г)",
    hint: "Сколько осталось сейчас — можно поставить на весы.",
    step: "1",
    min: 0,
    max: 100000,
    integer: true,
  },
  {
    key: "pricePerKg",
    formName: "pricePerKg",
    column: "price_per_kg",
    label: "Цена за 1 кг (₽)",
    hint: "Цена катушки за килограмм — подставится в калькулятор.",
    step: "1",
    min: 0,
    max: 100000,
  },
  {
    key: "minThresholdG",
    formName: "minThresholdG",
    column: "min_threshold_g",
    label: "Порог (г)",
    hint: "Когда остаток станет меньше, строка станет красной и появится «Купить».",
    step: "1",
    min: 0,
    max: 100000,
    integer: true,
  },
];

/** Сколько граммов можно списать за один раз. */
export const CONSUME_MIN_GRAMS = 1;
export const CONSUME_MAX_GRAMS = 100000;

const gramsFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

/** Вес для интерфейса: «1 000 г». */
export function formatGrams(value: number): string {
  return `${gramsFormatter.format(value)} г`;
}

/**
 * Пора докупать: остаток ниже порога.
 *
 * Пустая катушка считается «пора» даже при пороге 0 — иначе строка с нулём
 * выглядела бы как обычная.
 */
export function isLowStockFilament(filament: WorkshopFilament): boolean {
  return (
    filament.remainingWeightG <= 0 ||
    filament.remainingWeightG < filament.minThresholdG
  );
}

/** Процент остатка для прогресс-бара: целое 0…100. */
export function filamentRemainingPercent(filament: WorkshopFilament): number {
  if (filament.totalWeightG <= 0) {
    return 0;
  }

  const percent = Math.round(
    (filament.remainingWeightG / filament.totalWeightG) * 100,
  );

  return Math.min(100, Math.max(0, percent));
}

/**
 * Остаток после списания — не меньше нуля.
 *
 * Списать больше, чем есть, Server Action не даст: здесь та же арифметика,
 * чтобы интерфейс мог показать результат до ответа сервера.
 */
export function subtractFilamentWeight(
  filament: WorkshopFilament,
  grams: number,
): number {
  return Math.max(0, filament.remainingWeightG - Math.round(grams));
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Идентификатор строки: PostgREST ответит 22P02 на мусор, поэтому проверяем до запроса. */
export function isFilamentId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/**
 * Позиции из адреса печатной формы → безопасный список.
 *
 * JSON приходит из строки запроса, поэтому доверять ему нельзя: проверяем
 * форму каждого элемента, округляем граммы до целых и отбрасываем повторы id.
 * Один битый элемент не отменяет остальные; пустой или чужой по форме массив
 * даёт пустой список, и страница показывает пустое состояние.
 */
export function readFilamentOrderItems(value: unknown): FilamentOrderItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const items: FilamentOrderItem[] = [];
  const seenIds = new Set<string>();

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const candidate = entry as Partial<FilamentOrderItem>;

    if (!isFilamentId(candidate.filamentId) || seenIds.has(candidate.filamentId)) {
      continue;
    }

    const rawQuantity = candidate.quantityGrams;

    if (typeof rawQuantity !== "number" || !Number.isFinite(rawQuantity)) {
      continue;
    }

    const quantityGrams = Math.round(rawQuantity);

    if (
      quantityGrams < FILAMENT_ORDER_LIMITS.minGrams ||
      quantityGrams > FILAMENT_ORDER_LIMITS.maxGrams
    ) {
      continue;
    }

    seenIds.add(candidate.filamentId);
    items.push({ filamentId: candidate.filamentId, quantityGrams });

    if (items.length >= FILAMENT_ORDER_LIMITS.maxItems) {
      break;
    }
  }

  return items;
}

/**
 * Строка `workshop_filaments` → катушка для интерфейса.
 *
 * Битое число заменяется значением по умолчанию, а строка без корректного id
 * отбрасывается: без id её нельзя ни списать, ни показать ссылкой. Так один
 * странный ряд не ломает весь склад.
 */
export function normalizeFilamentRow(
  row: Partial<Record<string, unknown>> | null | undefined,
): WorkshopFilament | null {
  if (!row || !isFilamentId(row.id)) {
    return null;
  }

  return {
    id: row.id,
    brand: readText(row.brand, FILAMENT_TEXT_LIMITS.brand),
    type: readText(row.type, FILAMENT_TEXT_LIMITS.type),
    color: readText(row.color, FILAMENT_TEXT_LIMITS.color),
    totalWeightG:
      readNumberInRange(row.total_weight_g, 1, 100000, true) ??
      FILAMENT_DEFAULTS.totalWeightG,
    remainingWeightG:
      readNumberInRange(row.remaining_weight_g, 0, 100000, true) ?? 0,
    pricePerKg:
      readNumberInRange(row.price_per_kg, 0, 100000, false) ??
      FILAMENT_DEFAULTS.pricePerKg,
    minThresholdG:
      readNumberInRange(row.min_threshold_g, 0, 100000, true) ??
      FILAMENT_DEFAULTS.minThresholdG,
    purchaseUrl:
      readText(row.purchase_url, FILAMENT_TEXT_LIMITS.purchaseUrl) || null,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
  };
}

/**
 * Форма «Добавить катушку» → проверенные значения.
 *
 * Возвращает либо полный набор, либо ошибки по полям: частично добавленная
 * катушка хуже, чем подсказка, какое поле исправить.
 */
export function readFilamentForm(formData: FormData): {
  draft: FilamentDraft | null;
  errors: FilamentFormErrors;
} {
  const errors: FilamentFormErrors = {};

  const brand = readFormText(formData.get("brand"));
  const type = readFormText(formData.get("type"));
  const color = readFormText(formData.get("color"));
  const purchaseUrl = readFormText(formData.get("purchaseUrl"));

  if (!brand) {
    errors.brand = "Введите бренд.";
  } else if (brand.length > FILAMENT_TEXT_LIMITS.brand) {
    errors.brand = `Не больше ${FILAMENT_TEXT_LIMITS.brand} символов.`;
  }

  if (!type) {
    errors.type = "Введите тип пластика: PLA, PETG, ABS…";
  } else if (type.length > FILAMENT_TEXT_LIMITS.type) {
    errors.type = `Не больше ${FILAMENT_TEXT_LIMITS.type} символов.`;
  }

  if (!color) {
    errors.color = "Введите цвет.";
  } else if (color.length > FILAMENT_TEXT_LIMITS.color) {
    errors.color = `Не больше ${FILAMENT_TEXT_LIMITS.color} символов.`;
  }

  if (purchaseUrl.length > FILAMENT_TEXT_LIMITS.purchaseUrl) {
    errors.purchaseUrl = `Не больше ${FILAMENT_TEXT_LIMITS.purchaseUrl} символов.`;
  } else if (purchaseUrl && !/^https?:\/\//i.test(purchaseUrl)) {
    errors.purchaseUrl = "Ссылка должна начинаться с http:// или https://.";
  }

  const numbers: Record<FilamentNumberKey, number> = {
    totalWeightG: FILAMENT_DEFAULTS.totalWeightG,
    remainingWeightG: FILAMENT_DEFAULTS.totalWeightG,
    pricePerKg: FILAMENT_DEFAULTS.pricePerKg,
    minThresholdG: FILAMENT_DEFAULTS.minThresholdG,
  };

  for (const field of FILAMENT_NUMBER_FIELDS) {
    const parsed = parseWorkshopNumber(formData.get(field.formName));

    if (parsed === null) {
      errors[field.key] = "Введите число.";
      continue;
    }

    const rounded = field.integer
      ? Math.round(parsed)
      : Math.round(parsed * 100) / 100;

    if (rounded < field.min || rounded > field.max) {
      errors[field.key] = `Допустимо от ${formatWorkshopLimit(field.min)} до ${formatWorkshopLimit(field.max)}.`;
      continue;
    }

    numbers[field.key] = rounded;
  }

  if (
    !errors.remainingWeightG &&
    !errors.totalWeightG &&
    numbers.remainingWeightG > numbers.totalWeightG
  ) {
    errors.remainingWeightG = "Остаток не может быть больше общего веса.";
  }

  if (Object.keys(errors).length > 0) {
    return { draft: null, errors };
  }

  return { draft: { brand, type, color, purchaseUrl, ...numbers }, errors };
}

/** Форма «Списать N грамм» → id катушки и целые граммы. */
export function readConsumeFilamentForm(formData: FormData): {
  filamentId: string | null;
  grams: number | null;
  errors: { filamentId?: string; grams?: string };
} {
  const errors: { filamentId?: string; grams?: string } = {};
  const rawId = formData.get("filamentId");
  const filamentId = isFilamentId(rawId) ? rawId : null;

  if (!filamentId) {
    errors.filamentId = "Катушка не выбрана. Обновите страницу.";
  }

  const parsed = parseWorkshopNumber(formData.get("grams"));
  let grams: number | null = null;

  if (parsed === null) {
    errors.grams = "Введите число граммов.";
  } else {
    const rounded = Math.round(parsed);

    if (rounded < CONSUME_MIN_GRAMS || rounded > CONSUME_MAX_GRAMS) {
      errors.grams = `Допустимо от ${formatWorkshopLimit(CONSUME_MIN_GRAMS)} до ${formatWorkshopLimit(CONSUME_MAX_GRAMS)} г.`;
    } else {
      grams = rounded;
    }
  }

  return { filamentId, grams, errors };
}

/** Число из строки формы или ответа PostgREST: только в пределах. */
function readNumberInRange(
  value: unknown,
  min: number,
  max: number,
  integer: boolean,
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
