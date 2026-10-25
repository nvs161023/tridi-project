"use server";

import type { AddProductResult } from "@/lib/workshop/products";
import { addProduct as addProductInCatalog } from "@/lib/workshop/products";

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
