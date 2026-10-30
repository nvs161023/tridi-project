"use server";

import type {
  AddProductResult,
  CsvImportPlatform,
  DeleteProductResult,
  ImportProductsResult,
  UpdateProductResult,
} from "@/lib/workshop/products";
import {
  addProduct as addProductInCatalog,
  deleteProduct as deleteProductInCatalog,
  importProductsFromCsv as importProductsInCatalog,
  updateProduct as updateProductInCatalog,
} from "@/lib/workshop/products";

/**
 * Тонкая граница Server Action для каталога товаров.
 *
 * Клиентский компонент не может импортировать файл, где `"use server"` стоит
 * внутри функции: Next разрешает клиенту только модуль с директивой наверху.
 * Логика, проверки и запись в базу остаются в `lib/workshop/products.ts` —
 * здесь только обёртка, чтобы модалку можно было подключить к действию.
 */
export async function addProduct(
  formData: FormData,
): Promise<AddProductResult> {
  return addProductInCatalog(formData);
}

/** Импорт CSV из Ozon/Wildberries: клиенту нужна граница модуля. */
export async function importProductsFromCsv(
  csvString: string,
  platform: CsvImportPlatform,
): Promise<ImportProductsResult> {
  return importProductsInCatalog(csvString, platform);
}

/** Удаление товара: связи SKU уходят каскадом, позиции заказов остаются. */
export async function deleteProduct(
  productId: string,
): Promise<DeleteProductResult> {
  return deleteProductInCatalog(productId);
}

/**
 * Правка карточки товара.
 *
 * id — отдельным аргументом, данные — формой: разбор и проверки общие с
 * добавлением (`readProductForm`), поэтому у окна правки те же поля и те же
 * подсказки об ошибках.
 */
export async function updateProduct(
  productId: string,
  formData: FormData,
): Promise<UpdateProductResult> {
  return updateProductInCatalog(productId, formData);
}
