"use server";

import type {
  AddClientResult,
  UpdateClientResult,
} from "@/lib/workshop/clients";
import {
  addClient as addClientToBase,
  updateClient as updateClientInBase,
} from "@/lib/workshop/clients";

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

/**
 * Правка карточки клиента.
 *
 * id приходит отдельным аргументом, а данные — формой: разбор и проверки общие
 * с добавлением (`readClientForm`), поэтому у окна правки те же поля и те же
 * подсказки об ошибках.
 */
export async function updateClient(
  clientId: string,
  formData: FormData,
): Promise<UpdateClientResult> {
  return updateClientInBase(clientId, formData);
}
