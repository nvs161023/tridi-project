/**
 * Каталог товаров Мастерской: чтение `workshop_products` и добавление карточки.
 *
 * Миграцию `supabase/workshop_products.sql` применяют вручную, поэтому таблицы
 * может не быть в живой базе. Как и у склада, это не повод падать: страница
 * получает пустой список, а действие — понятное сообщение о миграции.
 *
 * `addProduct` помечен `"use server"` прямо в функции: файл лежит в `lib`, но
 * вызывается из браузера как Server Action. `getWorkshopProducts` — обычная
 * серверная функция для страницы.
 */
import { revalidatePath } from "next/cache";

import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import { createClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";
import {
  formatWorkshopLimit,
  parseWorkshopNumber,
} from "@/lib/workshop/settings";

/** Товар в том виде, в каком с ним работает интерфейс. */
export type WorkshopProduct = {
  id: string;
  sku: string;
  title: string;
  description: string | null;
  price: number;
  /** Старая цена для зачёркнутой; null — скидки нет. */
  oldPrice: number | null;
  brand: string | null;
  color: string | null;
  size: string | null;
  weightG: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  barcode: string | null;
  category: string | null;
  createdAt: string | null;
};

/** Поля формы «Добавить товар» — по ним же отдаются ошибки. */
export type ProductField =
  | "sku"
  | "name"
  | "description"
  | "price"
  | "oldPrice"
  | "weightG"
  | "lengthMm"
  | "widthMm"
  | "heightMm"
  | "brand"
  | "color"
  | "size"
  | "barcode"
  | "category";

export type ProductFieldErrors = Partial<Record<ProductField, string>>;

/** Ответ Server Action: либо ошибки, либо успех с готовым сообщением. */
export type AddProductResult = {
  error?: string;
  fieldErrors?: ProductFieldErrors;
  success?: boolean;
  message?: string;
};

/** Проверенный ввод формы. Пустые необязательные поля — null. */
type ProductDraft = {
  sku: string;
  title: string;
  description: string | null;
  price: number;
  oldPrice: number | null;
  brand: string | null;
  color: string | null;
  size: string | null;
  weightG: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  barcode: string | null;
  category: string | null;
};

/** Колонки, которые читает getWorkshopProducts. */
export const PRODUCT_COLUMNS =
  "id, sku, title, description, price, old_price, brand, color, size, weight_g, length_mm, width_mm, height_mm, barcode, category, created_at";

/** Пределы текстовых полей — как у `maxLength` в форме. */
export const PRODUCT_TEXT_LIMITS = {
  sku: 64,
  title: 160,
  description: 2000,
  brand: 80,
  color: 80,
  size: 80,
  barcode: 64,
  category: 80,
} as const;

/** numeric(10, 2): больше этой цены база не примет. */
const PRODUCT_PRICE_MAX = 99_999_999.99;

/** Предел колонок integer (вес и габариты). */
const PRODUCT_INTEGER_MAX = 2_147_483_647;

const SESSION_EXPIRED =
  "Сессия истекла. Войдите снова, чтобы добавить товар.";
const PRO_REQUIRED =
  "Мастерская входит в пакет «Всё включено». Оформите доступ, чтобы вести каталог товаров.";
const MIGRATION_MISSING =
  "Каталог пока не сохраняется: в базе нет таблицы workshop_products. Примените миграцию supabase/workshop_products.sql.";
const ADD_FAILED = "Не удалось добавить товар. Попробуйте ещё раз.";

/** Текст из формы: пробелы по краям не считаются содержимым. */
function readFormText(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

/**
 * Текст формы с проверкой длины.
 *
 * `requiredMessage` задан только у обязательных полей: пустое необязательное
 * поле превращается в null, а не в ошибку.
 */
function readTextValue(
  formData: FormData,
  name: string,
  limit: number,
  errors: ProductFieldErrors,
  field: ProductField,
  requiredMessage: string | null = null,
): string | null {
  const text = readFormText(formData, name);

  if (!text) {
    if (requiredMessage) {
      errors[field] = requiredMessage;
    }

    return null;
  }

  if (text.length > limit) {
    errors[field] = `Не больше ${limit} символов.`;

    return null;
  }

  return text;
}

/** Цена: обязательная или необязательная, с округлением до копеек. */
function readPriceValue(
  formData: FormData,
  name: string,
  errors: ProductFieldErrors,
  field: "price" | "oldPrice",
  required: boolean,
): number | null {
  const raw = readFormText(formData, name);

  if (!raw) {
    if (required) {
      errors[field] = "Введите цену.";
    }

    return null;
  }

  const parsed = parseWorkshopNumber(raw);

  if (parsed === null) {
    errors[field] = "Введите число.";

    return null;
  }

  const rounded = Math.round(parsed * 100) / 100;

  if (rounded < 0 || rounded > PRODUCT_PRICE_MAX) {
    errors[field] = `Допустимо от 0 до ${formatWorkshopLimit(PRODUCT_PRICE_MAX)}.`;

    return null;
  }

  return rounded;
}

/** Вес и габариты: колонки integer, дробный ввод округляется. */
function readIntegerValue(
  formData: FormData,
  name: string,
  errors: ProductFieldErrors,
  field: "weightG" | "lengthMm" | "widthMm" | "heightMm",
): number | null {
  const raw = readFormText(formData, name);

  if (!raw) {
    return null;
  }

  const parsed = parseWorkshopNumber(raw);

  if (parsed === null) {
    errors[field] = "Введите целое число.";

    return null;
  }

  const rounded = Math.round(parsed);

  if (rounded < 0 || rounded > PRODUCT_INTEGER_MAX) {
    errors[field] = `Допустимо от 0 до ${formatWorkshopLimit(PRODUCT_INTEGER_MAX)}.`;

    return null;
  }

  return rounded;
}

/**
 * Форма «Добавить товар» → проверенные значения.
 *
 * Название в форме называется `name`, а в таблице лежит в `title`: колонка
 * называется так же, как у заказа, чтобы карточки читались одинаково.
 */
function readProductForm(formData: FormData): {
  draft: ProductDraft | null;
  errors: ProductFieldErrors;
} {
  const errors: ProductFieldErrors = {};
  const sku = readTextValue(
    formData,
    "sku",
    PRODUCT_TEXT_LIMITS.sku,
    errors,
    "sku",
    "Введите артикул.",
  );
  const title = readTextValue(
    formData,
    "name",
    PRODUCT_TEXT_LIMITS.title,
    errors,
    "name",
    "Введите название.",
  );
  const description = readTextValue(
    formData,
    "description",
    PRODUCT_TEXT_LIMITS.description,
    errors,
    "description",
  );
  const price = readPriceValue(formData, "price", errors, "price", true);
  const oldPrice = readPriceValue(
    formData,
    "oldPrice",
    errors,
    "oldPrice",
    false,
  );
  const weightG = readIntegerValue(formData, "weightG", errors, "weightG");
  const lengthMm = readIntegerValue(formData, "lengthMm", errors, "lengthMm");
  const widthMm = readIntegerValue(formData, "widthMm", errors, "widthMm");
  const heightMm = readIntegerValue(formData, "heightMm", errors, "heightMm");
  const brand = readTextValue(
    formData,
    "brand",
    PRODUCT_TEXT_LIMITS.brand,
    errors,
    "brand",
  );
  const color = readTextValue(
    formData,
    "color",
    PRODUCT_TEXT_LIMITS.color,
    errors,
    "color",
  );
  const size = readTextValue(
    formData,
    "size",
    PRODUCT_TEXT_LIMITS.size,
    errors,
    "size",
  );
  const barcode = readTextValue(
    formData,
    "barcode",
    PRODUCT_TEXT_LIMITS.barcode,
    errors,
    "barcode",
  );
  const category = readTextValue(
    formData,
    "category",
    PRODUCT_TEXT_LIMITS.category,
    errors,
    "category",
  );

  if (Object.keys(errors).length > 0) {
    return { draft: null, errors };
  }

  if (price === null || !sku || !title) {
    return {
      draft: null,
      errors: {
        ...errors,
        ...(price === null ? { price: "Введите цену." } : {}),
        ...(!sku ? { sku: "Введите артикул." } : {}),
        ...(!title ? { name: "Введите название." } : {}),
      },
    };
  }

  return {
    draft: {
      sku,
      title,
      description,
      price,
      oldPrice,
      weightG,
      lengthMm,
      widthMm,
      heightMm,
      brand,
      color,
      size,
      barcode,
      category,
    },
    errors,
  };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Текст из строки базы: пробелы убираем, пустое значение — null. */
function readStoredText(value: unknown, limit: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim().slice(0, limit);

  return text || null;
}

/** Число из ответа PostgREST: numeric приходит строкой. */
function readStoredNumber(value: unknown, integer: boolean): number | null {
  const parsed = parseWorkshopNumber(value);

  if (parsed === null) {
    return null;
  }

  return integer ? Math.round(parsed) : parsed;
}

/**
 * Строка `workshop_products` → товар для интерфейса.
 *
 * Строка без корректного id, артикула или названия отбрасывается: такую
 * карточку нельзя ни показать, ни подставить в заказ. Остальные поля
 * нормализуются, чтобы numeric-строки из PostgREST стали числами.
 */
export function normalizeProductRow(
  row: Partial<Record<string, unknown>> | null | undefined,
): WorkshopProduct | null {
  if (
    !row ||
    typeof row.id !== "string" ||
    !UUID_PATTERN.test(row.id)
  ) {
    return null;
  }

  const sku = readStoredText(row.sku, PRODUCT_TEXT_LIMITS.sku);
  const title = readStoredText(row.title, PRODUCT_TEXT_LIMITS.title);

  if (!sku || !title) {
    return null;
  }

  const price = readStoredNumber(row.price, false) ?? 0;

  return {
    id: row.id,
    sku,
    title,
    description: readStoredText(
      row.description,
      PRODUCT_TEXT_LIMITS.description,
    ),
    price: Math.max(0, Math.round(price * 100) / 100),
    oldPrice: readStoredNumber(row.old_price, false),
    brand: readStoredText(row.brand, PRODUCT_TEXT_LIMITS.brand),
    color: readStoredText(row.color, PRODUCT_TEXT_LIMITS.color),
    size: readStoredText(row.size, PRODUCT_TEXT_LIMITS.size),
    weightG: readStoredNumber(row.weight_g, true),
    lengthMm: readStoredNumber(row.length_mm, true),
    widthMm: readStoredNumber(row.width_mm, true),
    heightMm: readStoredNumber(row.height_mm, true),
    barcode: readStoredText(row.barcode, PRODUCT_TEXT_LIMITS.barcode),
    category: readStoredText(row.category, PRODUCT_TEXT_LIMITS.category),
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
  };
}

/**
 * Товары текущего пользователя: новые сверху.
 *
 * Любая ошибка — в том числе неприменённая миграция или истёкшая сессия —
 * означает пустой каталог: вкладка должна открыться, а не упасть с 500.
 * Ошибку пишем в консоль сервера, пользователю её покажет сама вкладка.
 */
export async function getWorkshopProducts(): Promise<WorkshopProduct[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("workshop_products")
    .select(PRODUCT_COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Каталог мастерской не прочитан:", error.code, error.message);

    return [];
  }

  const rows = (data ?? []) as Partial<Record<string, unknown>>[];

  return rows
    .map(normalizeProductRow)
    .filter((product): product is WorkshopProduct => product !== null);
}

/** Повтор артикула у того же пользователя: unique(user_id, sku). */
function isDuplicateSkuError(error: {
  code?: string | null;
  message?: string | null;
  details?: string | null;
}): boolean {
  if (error.code === "23505") {
    return true;
  }

  const text = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();

  return (
    text.includes("workshop_products_user_sku_uidx") ||
    text.includes("duplicate key")
  );
}

/**
 * Добавление товара в каталог.
 *
 * Порядок проверок тот же, что у склада и принтеров: разбор формы → сессия →
 * подписка → запись. Server Action — публичный endpoint, поэтому подписка
 * проверяется здесь, а не только на странице. RLS дополнительно сверяет
 * `auth.uid()`, так что записать товар другому мастеру нельзя даже подделав
 * `user_id`.
 *
 * Артикул уникален в пределах пользователя: нарушение
 * `workshop_products_user_sku_uidx` (код 23505) превращается в понятную
 * подсказку, а не в общий «не удалось сохранить».
 */
export async function addProduct(
  formData: FormData,
): Promise<AddProductResult> {
  "use server";

  const { draft, errors } = readProductForm(formData);

  if (!draft) {
    return { fieldErrors: errors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: SESSION_EXPIRED, fieldErrors: errors };
  }

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return { error: PRO_REQUIRED, fieldErrors: errors };
  }

  const { error } = await supabase.from("workshop_products").insert({
    user_id: user.id,
    sku: draft.sku,
    title: draft.title,
    description: draft.description,
    price: draft.price,
    old_price: draft.oldPrice,
    brand: draft.brand,
    color: draft.color,
    size: draft.size,
    weight_g: draft.weightG,
    length_mm: draft.lengthMm,
    width_mm: draft.widthMm,
    height_mm: draft.heightMm,
    barcode: draft.barcode,
    category: draft.category,
  });

  if (error) {
    console.warn("Товар не добавлен:", error.code, error.message);

    if (isDuplicateSkuError(error)) {
      return {
        error: `Товар с артикулом «${draft.sku}» уже есть в каталоге. Укажите другой SKU.`,
        fieldErrors: { sku: "Этот артикул уже занят." },
      };
    }

    return {
      error: isMissingTableSchema(error.code, error.message)
        ? MIGRATION_MISSING
        : ADD_FAILED,
    };
  }

  // Каталог рисуется на сервере: без этого следующий переход покажет старый список.
  revalidatePath("/dashboard/workshop");

  return {
    success: true,
    message: `Товар «${draft.title}» добавлен.`,
  };
}
