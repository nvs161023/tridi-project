/**
 * Экспорт каталога Мастерской в CSV для пяти маркетплейсов.
 *
 * Ozon, Wildberries, Яндекс.Маркет, Авито и Мегамаркет ждут разные названия и
 * порядок колонок, поэтому формат каждой площадки описан одной таблицей. Цена
 * выводится числом с двумя знаками после точки, вес — в граммах, габариты — в
 * миллиметрах: ровно в тех единицах, в которых их хранит `workshop_products`.
 *
 * Разделитель `;` и BOM в начале файла нужны Excel с русской локалью: без них
 * он открывает CSV в одной колонке и ломает кириллицу. Переводы строк CRLF —
 * стандарт CSV (RFC 4180).
 */
import type { WorkshopProduct } from "@/lib/workshop/products";

/** Площадки, для которых поддерживается выгрузка. */
export const EXPORT_PLATFORMS = [
  "ozon",
  "wb",
  "yandex",
  "avito",
  "megamarket",
] as const;

export type ExportPlatform = (typeof EXPORT_PLATFORMS)[number];

/** Подписи площадок для сообщений об ошибках. */
export const EXPORT_PLATFORM_LABELS: Record<ExportPlatform, string> = {
  ozon: "Ozon",
  wb: "Wildberries",
  yandex: "Яндекс.Маркет",
  avito: "Авито",
  megamarket: "Мегамаркет",
};

/** Заголовки CSV в том порядке, в каком их ждут площадки. */
const EXPORT_COLUMNS: Record<ExportPlatform, readonly string[]> = {
  ozon: [
    "Артикул",
    "Название",
    "Цена",
    "Вес",
    "Длина",
    "Ширина",
    "Высота",
    "Описание",
  ],
  wb: ["Артикул", "Наименование", "Цена", "Вес с упаковкой", "Габариты"],
  yandex: [
    "shop-sku",
    "name",
    "price",
    "weight",
    "dimensions",
    "description",
  ],
  avito: ["Название", "Цена", "Описание", "Вес", "Габариты"],
  megamarket: [
    "Артикул",
    "Название",
    "Цена",
    "Вес",
    "Габариты",
    "Описание",
  ],
};

/** Проверка параметра `platform`: только известные площадки. */
export function isExportPlatform(
  value: string | null | undefined,
): value is ExportPlatform {
  return (
    typeof value === "string" &&
    (EXPORT_PLATFORMS as readonly string[]).includes(value)
  );
}

/**
 * Ячейка CSV: кавычки нужны, если внутри есть разделитель, кавычка или перевод
 * строки. Кавычки внутри значения удваиваются по RFC 4180.
 */
function csvCell(value: string): string {
  if (!/[;"\r\n]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

/** Цена без разделителей разрядов: `1500.00`, а не `1 500 ₽`. */
function priceCell(product: WorkshopProduct): string {
  return product.price.toFixed(2);
}

/** Пустой вес или габарит остаётся пустой ячейкой, а не нулём. */
function numberCell(value: number | null): string {
  return value === null ? "" : String(value);
}

/**
 * Габариты одной ячейкой `Д×Ш×В`.
 *
 * Если хотя бы одна сторона не заполнена, ячейка остаётся пустой: обрезанная
 * строка `100×200` на площадке означала бы другую геометрию. У Ozon три
 * отдельные колонки, поэтому там каждая сторона выгружается независимо.
 */
function dimensionsCell(product: WorkshopProduct): string {
  const sides = [product.lengthMm, product.widthMm, product.heightMm];

  if (sides.some((side) => side === null)) {
    return "";
  }

  return sides.map((side) => String(side)).join("×");
}

/** Значения строки в порядке колонок выбранной площадки. */
function productCells(
  product: WorkshopProduct,
  platform: ExportPlatform,
): readonly string[] {
  const weight = numberCell(product.weightG);
  const description = product.description ?? "";

  switch (platform) {
    case "ozon":
      return [
        product.sku,
        product.title,
        priceCell(product),
        weight,
        numberCell(product.lengthMm),
        numberCell(product.widthMm),
        numberCell(product.heightMm),
        description,
      ];
    case "wb":
      return [
        product.sku,
        product.title,
        priceCell(product),
        weight,
        dimensionsCell(product),
      ];
    case "yandex":
      return [
        product.sku,
        product.title,
        priceCell(product),
        weight,
        dimensionsCell(product),
        description,
      ];
    case "avito":
      return [
        product.title,
        priceCell(product),
        description,
        weight,
        dimensionsCell(product),
      ];
    case "megamarket":
      return [
        product.sku,
        product.title,
        priceCell(product),
        weight,
        dimensionsCell(product),
        description,
      ];
  }
}

/**
 * Собирает CSV всего каталога для одной площадки.
 *
 * Пустой каталог — это не ошибка: возвращается файл только с заголовками,
 * чтобы пользователь мог открыть его в Excel и заполнить.
 */
export function buildProductsCsv(
  products: readonly WorkshopProduct[],
  platform: ExportPlatform,
): string {
  const lines = [EXPORT_COLUMNS[platform].join(";")];

  for (const product of products) {
    lines.push(productCells(product, platform).map(csvCell).join(";"));
  }

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
