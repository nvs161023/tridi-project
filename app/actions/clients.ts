"use server";

import type { AddClientResult } from "@/lib/workshop/clients";
import { addClient as addClientToBase } from "@/lib/workshop/clients";

/**
 * Тонкая граница Server Action для базы клиентов.
 *
 * Клиентский компонент не может импортировать файл, где `"use server"` стоит
 * внутри функции: Next разрешает клиенту только модуль с директивой наверху.
 * Логика, проверки и запись в базу остаются в `lib/workshop/clients.ts` —
 * здесь только обёртка, чтобы модалку можно было подключить к действию.
 */
export async function addClient(
  formData: FormData,
): Promise<AddClientResult> {
  return addClientToBase(formData);
}
