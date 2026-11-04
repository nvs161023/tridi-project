/**
 * Каталог товаров Мастерской: чтение `workshop_products`, добавление карточки и
 * импорт CSV из Ozon/Wildberries.
 *
 * Миграцию `supabase/workshop_products.sql` применяют вручную, поэтому таблицы
 * может не быть в живой базе. Как и у склада, это не повод падать: страница
 * получает пустой список, а действие — понятное сообщение о миграции.
 *
 * `addProduct` и `importProductsFromCsv` помечены `"use server"` прямо в
 * функциях: файл лежит в `lib`, но вызываются они из браузера как Server
 * Actions. `getWorkshopProducts` — обычная серверная функция для страницы.
 */
import { revalidatePath } from "next/cache";

import Papa, { type ParseError } from "papaparse";

import {
  isProductFile,
  isSourceModelFile,
  printFileExtension,
} from "@/lib/3d/print-compatibility";
import { isMarketplace } from "@/lib/db/workshop-types";
import { relinkUnmappedOrders } from "@/lib/order-processor";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import { createClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";
import {
  MARKETPLACE_LINK_LIMITS,
  type MarketplaceLinkDraft,
} from "@/lib/workshop/marketplace";
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
  /** Ссылка на исходник модели (STL); null — исходника нет. */
  modelUrl: string | null;
  /** Ссылка на файл печати: 3MF или G-code; null — файл не приложен. */
  gcodeUrl: string | null;
  /**
   * Модель принтера, для которой нарезан 3MF («Bambu Lab A1»).
   *
   * null — файл без разметки: STL, G-code или 3MF без служебных метаданных.
   * Такое изделие можно печатать на любом принтере парка.
   */
  slicedForPrinter: string | null;
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
  | "category"
  | "modelUrl"
  | "gcodeUrl";

export type ProductFieldErrors = Partial<Record<ProductField, string>>;

/** Ответ Server Action: либо ошибки, либо успех с готовым сообщением. */
export type AddProductResult = {
  error?: string;
  fieldErrors?: ProductFieldErrors;
  success?: boolean;
  message?: string;
  /**
   * id сохранённого товара.
   *
   * Окно каталога заводит SKU маркетплейсов ещё до сохранения карточки, а
   * `addProduct` пишет их вместе с товаром. Пустой id значит, что база не
   * вернула строку: товар создан, но связи могло и не записаться.
   */
  productId?: string;
  /** Сколько связей SKU записалось вместе с товаром. */
  linksCreated?: number;
};

/**
 * Ответ правки товара.
 *
 * Совпадает с добавлением: форма у обоих действий одна (`readProductForm`),
 * поэтому модальное окно разбирает ответ одной веткой кода.
 */
export type UpdateProductResult = AddProductResult;

/** Откуда пришёл CSV: у площадок разные названия колонок. */
export type CsvImportPlatform = "ozon" | "wb";

/** Итог импорта: новые карточки, обновлённые и ошибки проблемных строк. */
export type ImportProductsResult = {
  imported: number;
  updated: number;
  errors: string[];
};

/** Ответ удаления товара: ошибка или подтверждение. */
export type DeleteProductResult = {
  error?: string;
  success?: boolean;
  message?: string;
};

/** Проверенная строка CSV до записи в базу. */
type ProductImportDraft = {
  sku: string;
  title: string;
  price: number;
  weightG: number | null;
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
  modelUrl: string | null;
  gcodeUrl: string | null;
  slicedForPrinter: string | null;
};

/**
 * Колонки, которые читает getWorkshopProducts.
 *
 * `model_url` добавляет supabase/workshop_product_model_url.sql, а `gcode_url`
 * и `sliced_for_printer` — supabase/workshop_farm_and_shop.sql. Пока миграции
 * не применены, PostgREST отвечает PGRST204 на весь select, поэтому наборов
 * четыре: полный, без исходника модели, без разметки принтера и совсем без
 * файлов. Чтение пробует их по порядку — от нового к старому.
 */
export const PRODUCT_COLUMNS =
  "id, sku, title, description, price, old_price, brand, color, size, weight_g, length_mm, width_mm, height_mm, barcode, category, model_url, gcode_url, sliced_for_printer, created_at";

/** Набор без model_url: база до supabase/workshop_product_model_url.sql. */
export const PRODUCT_COLUMNS_NO_MODEL =
  "id, sku, title, description, price, old_price, brand, color, size, weight_g, length_mm, width_mm, height_mm, barcode, category, gcode_url, sliced_for_printer, created_at";

/** Набор без sliced_for_printer: база до повторного запуска миграции фермы. */
export const PRODUCT_COLUMNS_NO_SLICED =
  "id, sku, title, description, price, old_price, brand, color, size, weight_g, length_mm, width_mm, height_mm, barcode, category, gcode_url, created_at";

/** Набор без файла печати: база до supabase/workshop_farm_and_shop.sql. */
export const PRODUCT_COLUMNS_LEGACY =
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
  modelUrl: 2048,
  gcodeUrl: 2048,
  slicedForPrinter: 120,
} as const;

/** numeric(10, 2): больше этой цены база не примет. */
const PRODUCT_PRICE_MAX = 99_999_999.99;

/** Предел колонок integer (вес и габариты). */
const PRODUCT_INTEGER_MAX = 2_147_483_647;

/** Четыре колонки, без которых импорт товара невозможен. */
type ProductCsvField = "sku" | "title" | "price" | "weight";

/**
 * Названия колонок Ozon и Wildberries. Сравнение идёт без учёта регистра и
 * лишних пробелов, поэтому «Offer ID», «offer id» и « Offer  ID » — одно и то
 * же. Первый алиас — основной: он попадает в подсказку об ошибке.
 */
const CSV_IMPORT_COLUMNS: Record<
  CsvImportPlatform,
  Record<ProductCsvField, readonly string[]>
> = {
  ozon: {
    sku: ["Offer ID", "Артикул"],
    title: ["Name", "Название"],
    price: ["Price", "Цена"],
    weight: ["Weight", "Вес"],
  },
  wb: {
    sku: ["Артикул продавца"],
    title: ["Наименование"],
    price: ["Цена"],
    weight: ["Вес с упаковкой"],
  },
};

const CSV_IMPORT_PLATFORM_LABELS: Record<CsvImportPlatform, string> = {
  ozon: "Ozon",
  wb: "Wildberries",
};

/** Человеческие пояснения к кодам ошибок Papa Parse. */
const CSV_PARSE_ERROR_MESSAGES: Record<ParseError["code"], string> = {
  MissingQuotes: "незакрытая кавычка",
  UndetectableDelimiter: "не удалось определить разделитель",
  TooFewFields: "в строке меньше колонок, чем в заголовке",
  TooManyFields: "в строке больше колонок, чем в заголовке",
  InvalidQuotes: "некорректные кавычки",
};

/** PostgREST ограничивает длину URL: артикулы читаем порциями. */
const IMPORT_LOOKUP_CHUNK = 100;

/** Один upsert на порцию не делает запрос слишком большим. */
const IMPORT_WRITE_CHUNK = 200;

const IMPORT_SESSION_EXPIRED =
  "Сессия истекла. Войдите снова, чтобы импортировать товары.";
const IMPORT_READ_FAILED =
  "Не удалось прочитать каталог для импорта. Попробуйте ещё раз.";
const IMPORT_WRITE_FAILED =
  "Не удалось сохранить импортированные товары. Попробуйте ещё раз.";

const SESSION_EXPIRED =
  "Сессия истекла. Войдите снова, чтобы добавить товар.";
const PRO_REQUIRED =
  "Мастерская входит в пакет «Всё включено». Оформите доступ, чтобы вести каталог товаров.";
const MIGRATION_MISSING =
  "Каталог пока не сохраняется: в базе нет таблицы workshop_products. Примените миграцию supabase/workshop_products.sql.";
const ADD_FAILED = "Не удалось добавить товар. Попробуйте ещё раз.";
const UPDATE_FAILED = "Не удалось сохранить товар. Попробуйте ещё раз.";
const NOT_FOUND = "Товар не найден — возможно, его уже удалили.";


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

/**
 * Ссылка на файл из формы: пусто — null, иначе абсолютный http(s)-адрес не
 * длиннее предела колонки.
 *
 * Относительный путь агенту фермы бесполезен: он скачивает файл не из
 * браузера. Файл, загруженный через /api/workshop/gcode, уже приходит
 * публичным https-адресом.
 */
function readFileLink(
  formData: FormData,
  field: "modelUrl" | "gcodeUrl",
  errors: ProductFieldErrors,
): string | null {
  const raw = readFormText(formData, field);

  if (!raw) {
    return null;
  }

  const limit = PRODUCT_TEXT_LIMITS[field];

  if (raw.length > limit) {
    errors[field] = `Не больше ${limit} символов.`;

    return null;
  }

  if (!/^https?:\/\/\S+$/iu.test(raw)) {
    errors[field] = "Укажите полную ссылку, начиная с http:// или https://.";

    return null;
  }

  return raw;
}

/**
 * Ссылка на исходник модели: только STL.
 *
 * Поле осталось ради старых карточек: форма больше не показывает отдельный
 * блок исходника, но скрытое поле сохраняет уже приложенный файл, чтобы
 * сохранение карточки его не стёрло. 3MF и G-code здесь отклоняются: это не
 * исходник, и в `model_url` они сломали бы показ файлов в каталоге.
 */
function readModelUrl(
  formData: FormData,
  errors: ProductFieldErrors,
): string | null {
  const url = readFileLink(formData, "modelUrl", errors);

  if (!url) {
    return null;
  }

  if (!isSourceModelFile(url)) {
    errors.modelUrl = "В старом поле исходника допускается только .stl.";

    return null;
  }

  return url;
}

/**
 * Ссылка на файл модели: 3MF, G-code (в том числе бинарный `.bgcode` PrusaLink)
 * или STL.
 *
 * Файл у товара один, и живёт он в `gcode_url` — так карточка, очередь печати и
 * агент фермы читают одну и ту же колонку. STL здесь разрешён: мастер может
 * приложить только модель, а нарезать её — позже. В очередь печати такой файл
 * при этом не попадёт: её проверяет `isPrintableFile`.
 */
function readGcodeUrl(
  formData: FormData,
  errors: ProductFieldErrors,
): string | null {
  const url = readFileLink(formData, "gcodeUrl", errors);

  if (!url) {
    return null;
  }

  if (!isProductFile(url)) {
    errors.gcodeUrl = "Файл модели — .3mf, .gcode, .bgcode или .stl.";

    return null;
  }

  return url;
}

/**
 * Модель принтера из формы.
 *
 * Значение приходит скрытым полем из `/api/workshop/gcode`: сервер разбирает
 * 3MF сразу после загрузки, пока архив есть в памяти, и возвращает модель
 * принтера из его метаданных. Скачивать файл повторно здесь нельзя — ссылку
 * вводит пользователь, и серверный fetch по чужому адресу стал бы дырой.
 *
 * Разметка есть только у 3MF: у STL и G-code её нет по определению, поэтому
 * поле игнорируется, даже если клиент его прислал.
 */
function readSlicedForPrinter(
  formData: FormData,
  gcodeUrl: string | null,
): string | null {
  if (printFileExtension(gcodeUrl) !== "3mf") {
    return null;
  }

  const raw = readFormText(formData, "slicedForPrinter").replace(/\s+/gu, " ");

  if (!raw) {
    return null;
  }

  return raw.slice(0, PRODUCT_TEXT_LIMITS.slicedForPrinter).trim() || null;
}

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
  // Описание необязательно: карточка живёт и без него, а маркетплейсам оно
  // нужно только при выгрузке. Пустое поле сохраняется как NULL.
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
  const modelUrl = readModelUrl(formData, errors);
  const gcodeUrl = readGcodeUrl(formData, errors);
  const slicedForPrinter = readSlicedForPrinter(formData, gcodeUrl);

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
      modelUrl,
      gcodeUrl,
      slicedForPrinter,
    },
    errors,
  };
}

/**
 * Текст ячейки CSV: числа Papa Parse отдаёт строками, но защищаемся и от
 * неожиданного типа.
 */
function csvCellText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
}

/** Заголовок без BOM, лишних пробелов и регистра. */
function normalizeProductCsvHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("ru-RU");
}

/**
 * Число из CSV: «1 250,00 ₽», «1,250.00» и «1250.5» дают одно и то же.
 *
 * Пробелы, валюта и прочие символы выбрасываются. Если в числе есть и точка,
 * и запятая, десятичным считается последний разделитель, а другой — разряды.
 * Одиночный разделитель с тремя цифрами после него тоже считается разрядным:
 * так «1,250» из англоязычной выгрузки не превращается в 1,25.
 */
function parseImportedNumber(value: string): number | null {
  const compact = value
    .replace(/[\s\u00a0\u202f]/g, "")
    .replace(/(?:₽|руб\.?|р\.?|rub|rur)/giu, "")
    .replace(/[^\d,.\-]/g, "")
    .replace(/^[.,]+|[.,]+$/g, "");

  if (!compact) {
    return null;
  }

  const commaIndex = compact.lastIndexOf(",");
  const dotIndex = compact.lastIndexOf(".");
  let normalized = compact;

  if (commaIndex !== -1 && dotIndex !== -1) {
    const decimal = commaIndex > dotIndex ? "," : ".";
    const thousands = decimal === "," ? "." : ",";

    normalized = compact
      .split(thousands)
      .join("")
      .replace(decimal, ".");
  } else if (commaIndex !== -1 || dotIndex !== -1) {
    const separator = commaIndex !== -1 ? "," : ".";
    const parts = compact.split(separator);
    const isThousands =
      parts.length === 2 &&
      parts[1].length === 3 &&
      parts[0] !== "" &&
      parts[0] !== "0";

    if (
      isThousands ||
      (parts.length > 2 && parts.slice(1).every((part) => part.length === 3))
    ) {
      normalized = parts.join("");
    } else {
      normalized = `${parts.slice(0, -1).join("")}.${parts.at(-1)}`;
    }
  }

  const number = Number(normalized);

  return Number.isFinite(number) ? number : null;
}

/** Вес из CSV: голое число — граммы, «кг» и «г» переводятся в граммы. */
function parseImportedWeightG(value: string): {
  weightG: number | null;
  error: string | null;
} {
  const raw = value.trim();

  if (!raw || /^[-–—]$/.test(raw) || /^(?:нет|н\/д|n\/a)$/i.test(raw)) {
    return { weightG: null, error: null };
  }

  const compact = raw
    .toLocaleLowerCase("ru-RU")
    .replace(/[\s\u00a0\u202f]/g, "");
  const isMilligrams = compact.includes("мг") || compact.includes("mg");
  const isKilograms =
    !isMilligrams && (compact.includes("кг") || compact.includes("kg"));
  const numberText = compact
    .replace(/(?:килограмм(?:а|ов)?|кг|kilograms?|kg)/gu, "")
    .replace(/(?:миллиграмм(?:а|ов)?|мг|milligrams?|mg)/gu, "")
    .replace(/(?:грамм(?:а|ов)?|гр|г|grams?|g)/gu, "");
  const number = parseImportedNumber(numberText);

  if (number === null) {
    return {
      weightG: null,
      error: `вес «${raw}» не распознан.`,
    };
  }

  const multiplier = isMilligrams ? 0.001 : isKilograms ? 1000 : 1;
  const rounded = Math.round(number * multiplier);

  if (rounded < 0 || rounded > PRODUCT_INTEGER_MAX) {
    return {
      weightG: null,
      error: `вес должен быть от 0 до ${formatWorkshopLimit(PRODUCT_INTEGER_MAX)} г.`,
    };
  }

  return { weightG: rounded, error: null };
}

/** Подсказка, какие названия колонки принимаются для поля. */
function csvColumnAliases(
  platform: CsvImportPlatform,
  field: ProductCsvField,
): string {
  return CSV_IMPORT_COLUMNS[platform][field]
    .map((alias) => `«${alias}»`)
    .join(" или ");
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Идентификатор товара: мусор отсекаем до запроса к PostgREST. */
export function isProductId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/**
 * CSV Ozon или Wildberries → проверенные строки товаров.
 *
 * Первая строка — заголовки. Обязательные колонки ищутся среди алиасов
 * площадки; строки без артикула, названия или корректной цены не записываются,
 * а их номера попадают в `errors`. Одинаковый SKU внутри файла берётся
 * последним: два раза один товар в одном upsert PostgreSQL обновить не даст.
 */
export function parseProductsCsv(
  csvString: string,
  platform: CsvImportPlatform,
): { drafts: ProductImportDraft[]; errors: string[] } {
  const errors: string[] = [];
  const source = csvString.replace(/^\uFEFF/, "");

  if (!source.trim()) {
    return { drafts: [], errors: ["CSV пуст."] };
  }

  const parsed = Papa.parse<Record<string, string | undefined>>(source, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeProductCsvHeader,
  });

  for (const parseError of parsed.errors) {
    const row =
      typeof parseError.row === "number"
        ? `Строка ${parseError.row + 2}: `
        : "";

    errors.push(`${row}${CSV_PARSE_ERROR_MESSAGES[parseError.code]}.`);
  }

  const fields = parsed.meta.fields ?? [];
  const columns: Partial<Record<ProductCsvField, string>> = {};

  for (const field of ["sku", "title", "price", "weight"] as const) {
    const aliases = CSV_IMPORT_COLUMNS[platform][field].map(
      normalizeProductCsvHeader,
    );
    const column = fields.find((header) => aliases.includes(header));

    if (column) {
      columns[field] = column;
    } else {
      errors.push(
        `В CSV ${CSV_IMPORT_PLATFORM_LABELS[platform]} не найдена колонка ${csvColumnAliases(platform, field)}.`,
      );
    }
  }

  const skuColumn = columns.sku;
  const titleColumn = columns.title;
  const priceColumn = columns.price;
  const weightColumn = columns.weight;

  if (!skuColumn || !titleColumn || !priceColumn || !weightColumn) {
    return { drafts: [], errors };
  }

  const draftsBySku = new Map<
    string,
    { draft: ProductImportDraft; line: number }
  >();

  parsed.data.forEach((row, index) => {
    const line = index + 2;
    const prefix = `Строка ${line}: `;
    const sku = csvCellText(row[skuColumn]);
    const title = csvCellText(row[titleColumn]);
    const rawPrice = csvCellText(row[priceColumn]);
    const rawWeight = csvCellText(row[weightColumn]);

    if (!sku && !title && !rawPrice && !rawWeight) {
      return;
    }

    if (!sku) {
      errors.push(`${prefix}не указан артикул.`);

      return;
    }

    if (sku.length > PRODUCT_TEXT_LIMITS.sku) {
      errors.push(
        `${prefix}артикул длиннее ${PRODUCT_TEXT_LIMITS.sku} символов.`,
      );

      return;
    }

    if (!title) {
      errors.push(`${prefix}не указано название.`);

      return;
    }

    if (title.length > PRODUCT_TEXT_LIMITS.title) {
      errors.push(
        `${prefix}название длиннее ${PRODUCT_TEXT_LIMITS.title} символов.`,
      );

      return;
    }

    if (!rawPrice) {
      errors.push(`${prefix}не указана цена.`);

      return;
    }

    const parsedPrice = parseImportedNumber(rawPrice);
    const price =
      parsedPrice === null ? null : Math.round(parsedPrice * 100) / 100;

    if (price === null) {
      errors.push(`${prefix}цена «${rawPrice}» не распознана.`);

      return;
    }

    if (price < 0 || price > PRODUCT_PRICE_MAX) {
      errors.push(
        `${prefix}цена должна быть от 0 до ${formatWorkshopLimit(PRODUCT_PRICE_MAX)} ₽.`,
      );

      return;
    }

    const { weightG, error: weightError } = parseImportedWeightG(rawWeight);

    if (weightError) {
      errors.push(`${prefix}${weightError}`);

      return;
    }

    const previous = draftsBySku.get(sku);

    if (previous) {
      errors.push(
        `${prefix}артикул «${sku}» уже встречался в строке ${previous.line}; использована последняя строка.`,
      );
    }

    draftsBySku.set(sku, {
      draft: { sku, title, price, weightG },
      line,
    });
  });

  if (draftsBySku.size === 0 && errors.length === 0) {
    errors.push("В CSV нет строк с товарами.");
  }

  return {
    drafts: Array.from(draftsBySku.values(), ({ draft }) => draft),
    errors,
  };
}

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
  const storedModelUrl = readStoredText(
    row.model_url,
    PRODUCT_TEXT_LIMITS.modelUrl,
  );
  const storedGcodeUrl = readStoredText(
    row.gcode_url,
    PRODUCT_TEXT_LIMITS.gcodeUrl,
  );

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
    modelUrl: storedModelUrl,
    // У новых карточек здесь лежит любой файл модели, включая STL: печатать
    // его никто не будет — очередь проверяет `isPrintableFile`.
    gcodeUrl: storedGcodeUrl,
    slicedForPrinter: readStoredText(
      row.sliced_for_printer,
      PRODUCT_TEXT_LIMITS.slicedForPrinter,
    ),
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

  let data: Partial<Record<string, unknown>>[] | null = null;
  let error: { code?: string | null; message: string } | null = null;

  // model_url добавляет supabase/workshop_product_model_url.sql, gcode_url и
  // sliced_for_printer — supabase/workshop_farm_and_shop.sql. Пока миграции не
  // применили заново, каталог читается без новых колонок: товары и заказы
  // должны работать.
  for (const columns of [
    PRODUCT_COLUMNS,
    PRODUCT_COLUMNS_NO_MODEL,
    PRODUCT_COLUMNS_NO_SLICED,
    PRODUCT_COLUMNS_LEGACY,
  ]) {
    const result = await supabase
      .from("workshop_products")
      .select(columns)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    data = (result.data ?? null) as
      | Partial<Record<string, unknown>>[]
      | null;
    error = result.error;

    if (!error || !isMissingTableSchema(error.code, error.message)) {
      break;
    }
  }

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
 * Черновые связи SKU из формы «Добавить товар».
 *
 * У новой карточки ещё нет id, поэтому окно копит связи у себя и отдаёт их
 * полем `marketplaceLinks` — JSON-массивом `{marketplace, sku}`. Разбор
 * всепрощающий: битый JSON, чужая площадка и пустой артикул просто не создают
 * связь, ронять из-за них товар нельзя. Повторы внутри списка отбрасываются,
 * иначе unique(user_id, marketplace, sku) ругался бы на собственную форму.
 */
function readPendingMarketplaceLinks(
  formData: FormData,
): MarketplaceLinkDraft[] {
  const raw = formData.get("marketplaceLinks");

  if (typeof raw !== "string" || !raw.trim()) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn(
      "Связи SKU из формы не разобраны: поле marketplaceLinks — не JSON.",
    );

    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const seen = new Set<string>();
  const links: MarketplaceLinkDraft[] = [];

  for (const item of parsed) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const row = item as Partial<Record<string, unknown>>;
    const sku =
      typeof row.sku === "string"
        ? row.sku.trim().slice(0, MARKETPLACE_LINK_LIMITS.sku)
        : "";

    if (!isMarketplace(row.marketplace) || !sku) {
      continue;
    }

    // Артикул площадки — текст: «abc» и «ABC» это один и тот же SKU.
    const key = `${row.marketplace}:${sku.toLowerCase()}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    links.push({ marketplace: row.marketplace, sku });
  }

  return links;
}

/**
 * Запись связей, которые мастер завёл до сохранения товара.
 *
 * Ошибка одной связи не откатывает ни карточку, ни остальные связи: дубль
 * артикула (23505) или неприменённая миграция — повод для записи в журнал, а
 * товар уже создан. Возвращается число записанных связей: его показывает
 * сообщение об успехе.
 */
async function createMarketplaceLinks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  productId: string,
  links: MarketplaceLinkDraft[],
): Promise<number> {
  let created = 0;

  for (const link of links) {
    const { error } = await supabase.from("workshop_marketplace_links").insert({
      user_id: userId,
      marketplace: link.marketplace,
      sku: link.sku,
      product_id: productId,
    });

    if (error) {
      console.warn(
        `WARNING: не удалось создать связь ${link.marketplace}/${link.sku}:`,
        error.code,
        error.message,
      );

      continue;
    }

    created += 1;
  }

  return created;
}

/** id из `insert().select("id")`: один товар — одна строка в ответе. */
function readCreatedProductId(rows: unknown): string | null {
  const row = Array.isArray(rows)
    ? (rows[0] as Partial<Record<string, unknown>> | undefined)
    : undefined;

  return typeof row?.id === "string" ? row.id : null;
}

/** Сообщение об успехе: сколько связей SKU записалось вместе с карточкой. */
function productAddedMessage(
  title: string,
  created: number,
  total: number,
): string {
  const message = `Товар «${title}» добавлен.`;

  if (total === 0) {
    return message;
  }

  if (created === total) {
    return `${message} Связей SKU: ${created}.`;
  }

  return `${message} Связей SKU: ${created} из ${total} — остальные не записались, добавьте их в карточке товара.`;
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
 *
 * Связи SKU маркетплейсов приходят тем же запросом (поле `marketplaceLinks`):
 * у новой карточки ещё нет id, поэтому окно копит их у себя, а запись идёт
 * после вставки товара. Сбой отдельной связи карточку не откатывает.
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

  // Связи SKU, заведённые в форме до сохранения: у нового товара нет id,
  // поэтому окно отдаёт их списком, а запись идёт после вставки карточки.
  const pendingLinks = readPendingMarketplaceLinks(formData);

  // `model_url` и `sliced_for_printer` — необязательные колонки миграций
  // supabase/workshop_product_model_url.sql и
  // supabase/workshop_farm_and_shop.sql. Пустое значение не пишем вовсе: null
  // означает «файла нет», и лишний ключ только мешал бы старой базе принять
  // товар.
  const insertPayload: Record<string, unknown> = {
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
    gcode_url: draft.gcodeUrl,
  };

  if (draft.modelUrl) {
    insertPayload.model_url = draft.modelUrl;
  }

  if (draft.slicedForPrinter) {
    insertPayload.sliced_for_printer = draft.slicedForPrinter;
  }

  /** Колонки, которых может не быть в живой базе: миграции применяют вручную. */
  const optionalColumns = ["model_url", "sliced_for_printer"].filter(
    (column) => column in insertPayload,
  );

  // `.select("id")` возвращает созданную строку: id нужен, чтобы сразу
  // записать связи SKU из той же формы. Вставка идёт одним построителем,
  // поэтому повтор после PGRST204 тоже возвращает id.
  const insertOnce = (payload: Record<string, unknown>) =>
    supabase.from("workshop_products").insert(payload).select("id");

  let inserted = await insertOnce(insertPayload);

  // Миграции применяют вручную: пока колонок нет, товар сохраняется без
  // исходника и разметки принтера. Терять из-за этого карточку нельзя —
  // проверка при заказе просто не сработает, пока мастер не обновит схему.
  if (
    inserted.error &&
    optionalColumns.length > 0 &&
    isMissingTableSchema(inserted.error.code, inserted.error.message)
  ) {
    console.warn(
      "Товар сохранён без исходника или разметки принтера: примените supabase/workshop_product_model_url.sql и заново supabase/workshop_farm_and_shop.sql.",
      inserted.error.code,
      inserted.error.message,
    );

    const retryPayload: Record<string, unknown> = { ...insertPayload };

    for (const column of optionalColumns) {
      delete retryPayload[column];
    }

    inserted = await insertOnce(retryPayload);
  }

  const error = inserted.error;

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

  // Связи SKU пишутся после товара: без id вставлять их некуда. Сбой одной
  // связи не откатывает карточку — мастер добавит её в окне правки.
  const productId = readCreatedProductId(inserted.data);
  let linksCreated = 0;

  if (pendingLinks.length > 0) {
    if (productId) {
      linksCreated = await createMarketplaceLinks(
        supabase,
        user.id,
        productId,
        pendingLinks,
      );
    } else {
      console.warn(
        "WARNING: связи SKU не созданы — база не вернула id нового товара.",
      );
    }
  }

  // Новая связь могла разблокировать заказы без маппинга: пересчёт тот же, что
  // в окне правки (`addMarketplaceLink`). Сбой пересчёта товар не откатывает.
  let ordersReady = 0;

  if (linksCreated > 0) {
    try {
      ordersReady = (await relinkUnmappedOrders(supabase, user.id)).ordersReady;
    } catch (relinkError) {
      console.warn(
        "Связи SKU записаны, но unmapped-заказы не обновлены:",
        relinkError,
      );
    }
  }

  // Каталог рисуется на сервере: без этого следующий переход покажет старый список.
  revalidatePath("/dashboard/workshop");
  revalidatePath("/dashboard/workshop/products");
  revalidatePath("/dashboard/workshop/marketplace");

  let message = productAddedMessage(
    draft.title,
    linksCreated,
    pendingLinks.length,
  );

  if (ordersReady > 0) {
    message = `${message} Заказов вернулось в работу: ${ordersReady}.`;
  }

  return {
    success: true,
    message,
    productId: productId ?? undefined,
    linksCreated,
  };
}

/**
 * Правка карточки товара.
 *
 * Порядок проверок как у добавления: id → разбор формы → сессия → подписка →
 * `update` с фильтром по владельцу. Разбор общий (`readProductForm`): меняются
 * все поля карточки, включая артикул, цену и файл печати, — мастер правит то,
 * что видит, а не половину формы. Пустое необязательное поле записывается как
 * null: так стираются старые габариты и ссылка на G-code.
 *
 * Артикул уникален в пределах пользователя: повтор у другой карточки
 * превращается в подсказку «артикул занят» (код 23505), а не в общий отказ.
 *
 * `select("title")` возвращает обновлённую строку: пустой ответ означает, что
 * товар уже удалили в другой вкладке. Колонки файлов добавляют миграции
 * supabase/workshop_product_model_url.sql (`model_url`) и
 * supabase/workshop_farm_and_shop.sql (`gcode_url`, `sliced_for_printer`); пока
 * миграции не применили заново, `update` повторяется без них — карточка
 * сохраняется, а в сообщении честно сказано, что файлы не записаны.
 */
export async function updateProduct(
  productId: string,
  formData: FormData,
): Promise<UpdateProductResult> {
  "use server";

  if (!isProductId(productId)) {
    return { error: "Товар не найден — обновите страницу." };
  }

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

  // Поля без файла печати отделены от файла: старая база принимает первые и
  // отвечает PGRST204 на вторые, и откат тогда касается только файла.
  const cardPayload = {
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
  };
  const filePayload: Record<string, unknown> = {
    model_url: draft.modelUrl,
    gcode_url: draft.gcodeUrl,
    sliced_for_printer: draft.slicedForPrinter,
  };
  // Тот же файл печати без исходника: так карточка сохраняется на базе, где
  // supabase/workshop_product_model_url.sql ещё не применена.
  const printPayload: Record<string, unknown> = { ...filePayload };

  delete printPayload.model_url;

  let result = await supabase
    .from("workshop_products")
    .update({ ...cardPayload, ...filePayload })
    .eq("id", productId)
    .eq("user_id", user.id)
    .select("title")
    .maybeSingle();
  let modelSkipped = false;
  let fileSkipped = false;

  // Миграции применяют вручную, поэтому откат идёт по шагам: сначала карточка
  // сохраняется без исходника, потом — совсем без файлов.
  if (
    result.error &&
    isMissingTableSchema(result.error.code, result.error.message)
  ) {
    console.warn(
      "Товар сохранён без исходника: примените supabase/workshop_product_model_url.sql.",
      result.error.code,
      result.error.message,
    );

    modelSkipped = true;
    result = await supabase
      .from("workshop_products")
      .update({ ...cardPayload, ...printPayload })
      .eq("id", productId)
      .eq("user_id", user.id)
      .select("title")
      .maybeSingle();
  }

  if (
    result.error &&
    isMissingTableSchema(result.error.code, result.error.message)
  ) {
    console.warn(
      "Товар сохранён без файла печати: примените заново supabase/workshop_farm_and_shop.sql.",
      result.error.code,
      result.error.message,
    );

    fileSkipped = true;
    result = await supabase
      .from("workshop_products")
      .update(cardPayload)
      .eq("id", productId)
      .eq("user_id", user.id)
      .select("title")
      .maybeSingle();
  }

  if (result.error) {
    console.warn(
      "Товар не сохранён:",
      result.error.code,
      result.error.message,
    );

    if (isDuplicateSkuError(result.error)) {
      return {
        error: `Товар с артикулом «${draft.sku}» уже есть в каталоге. Укажите другой SKU.`,
        fieldErrors: { sku: "Этот артикул уже занят." },
      };
    }

    return {
      error: isMissingTableSchema(result.error.code, result.error.message)
        ? MIGRATION_MISSING
        : UPDATE_FAILED,
    };
  }

  if (!result.data) {
    return { error: NOT_FOUND };
  }

  // Каталог рисуется на сервере: без этого правку увидят только после
  // перезагрузки страницы.
  revalidatePath("/dashboard/workshop");
  revalidatePath("/dashboard/workshop/products");
  revalidatePath("/dashboard/workshop/marketplace");

  let savedMessage = `Товар «${draft.title}» сохранён.`;

  if (fileSkipped && (draft.gcodeUrl || draft.modelUrl)) {
    savedMessage = `Товар «${draft.title}» сохранён, но файлы не записаны: примените supabase/workshop_product_model_url.sql и заново supabase/workshop_farm_and_shop.sql.`;
  } else if (modelSkipped && draft.modelUrl) {
    savedMessage = `Товар «${draft.title}» сохранён, но ссылка на исходник не записана: примените supabase/workshop_product_model_url.sql.`;
  }

  return { success: true, message: savedMessage };
}

/**
 * Импорт товаров из CSV Ozon или Wildberries.
 *
 * Порядок как у остальных действий каталога: сессия → подписка → разбор файла →
 * чтение существующих артикулов → один upsert на порцию строк. Артикул
 * уникален в пределах пользователя, поэтому повторный SKU не создаёт дубль:
 * обновляются название, цена и вес, а описание, габариты и прочие поля
 * карточки остаются прежними.
 *
 * Ошибки отдельных строк не отменяют остальные: в `errors` возвращаются номера
 * строк CSV, а в `imported` и `updated` — только реально записанные карточки.
 */
export async function importProductsFromCsv(
  csvString: string,
  platform: CsvImportPlatform,
): Promise<ImportProductsResult> {
  "use server";

  if (typeof csvString !== "string" || !csvString.trim()) {
    return { imported: 0, updated: 0, errors: ["CSV пуст."] };
  }

  if (platform !== "ozon" && platform !== "wb") {
    return {
      imported: 0,
      updated: 0,
      errors: ["Неизвестная площадка. Поддерживаются Ozon и Wildberries."],
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { imported: 0, updated: 0, errors: [IMPORT_SESSION_EXPIRED] };
  }

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return { imported: 0, updated: 0, errors: [PRO_REQUIRED] };
  }

  const { drafts, errors } = parseProductsCsv(csvString, platform);

  if (drafts.length === 0) {
    return { imported: 0, updated: 0, errors };
  }

  const skus = drafts.map((draft) => draft.sku);
  const existingSkus = new Set<string>();

  for (let index = 0; index < skus.length; index += IMPORT_LOOKUP_CHUNK) {
    const chunk = skus.slice(index, index + IMPORT_LOOKUP_CHUNK);
    const { data, error } = await supabase
      .from("workshop_products")
      .select("sku")
      .eq("user_id", user.id)
      .in("sku", chunk);

    if (error) {
      console.warn("Каталог для импорта не прочитан:", error.code, error.message);

      return {
        imported: 0,
        updated: 0,
        errors: [
          ...errors,
          isMissingTableSchema(error.code, error.message)
            ? MIGRATION_MISSING
            : IMPORT_READ_FAILED,
        ],
      };
    }

    for (const row of data ?? []) {
      if (typeof row.sku === "string") {
        existingSkus.add(row.sku);
      }
    }
  }

  let imported = 0;
  let updated = 0;

  for (let index = 0; index < drafts.length; index += IMPORT_WRITE_CHUNK) {
    const chunk = drafts.slice(index, index + IMPORT_WRITE_CHUNK);
    const payload = chunk.map((draft) => ({
      user_id: user.id,
      sku: draft.sku,
      title: draft.title,
      price: draft.price,
      weight_g: draft.weightG,
    }));
    const { error } = await supabase
      .from("workshop_products")
      .upsert(payload, { onConflict: "user_id,sku" });

    if (error) {
      console.warn("Импорт товаров не сохранён:", error.code, error.message);

      errors.push(
        error.code === "42P10" ||
          isMissingTableSchema(error.code, error.message)
          ? MIGRATION_MISSING
          : IMPORT_WRITE_FAILED,
      );

      break;
    }

    for (const draft of chunk) {
      if (existingSkus.has(draft.sku)) {
        updated += 1;
      } else {
        imported += 1;
      }
    }
  }

  if (imported + updated > 0) {
    revalidatePath("/dashboard/workshop");
  }

  return { imported, updated, errors };
}

/**
 * Удаление товара каталога.
 *
 * Связи маркетплейсов уходят каскадом, а позиции заказов сохраняют SKU и
 * количество с product_id = null — история заказов не пропадает. Действие
 * повторяет проверки остальных Server Actions: id → сессия → подписка → запрос
 * с фильтром по владельцу.
 */
export async function deleteProduct(
  productId: string,
): Promise<DeleteProductResult> {
  "use server";

  if (!isProductId(productId)) {
    return { error: "Товар не найден — обновите страницу." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "Сессия истекла. Войдите снова, чтобы удалить товар.",
    };
  }

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return {
      error:
        "Мастерская входит в пакет «Всё включено». Оформите доступ, чтобы менять каталог.",
    };
  }

  const { data, error } = await supabase
    .from("workshop_products")
    .delete()
    .eq("id", productId)
    .eq("user_id", user.id)
    .select("id");

  if (error) {
    console.warn("Товар не удалён:", error.code, error.message);

    return {
      error: isMissingTableSchema(error.code, error.message)
        ? MIGRATION_MISSING
        : "Не удалось удалить товар. Попробуйте ещё раз.",
    };
  }

  if (!data || data.length === 0) {
    return { error: "Товар не найден — возможно, его уже удалили." };
  }

  revalidatePath("/dashboard/workshop");
  revalidatePath("/dashboard/workshop/products");
  revalidatePath("/dashboard/workshop/marketplace");

  return { success: true, message: "Товар удалён." };
}
