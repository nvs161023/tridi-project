"use server";

import { revalidatePath } from "next/cache";

import type { WorkshopSettingsFormState } from "@/app/actions/workshop-state";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import { createClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";
import { createWorkshopSettingsPayload } from "@/lib/workshop/payload";
import {
  hasWorkshopRequisitesFormFields,
  readWorkshopRequisitesForm,
} from "@/lib/workshop/requisites";
import {
  readWorkshopSettingsForm,
  WORKSHOP_FIELDS,
} from "@/lib/workshop/settings";

const SESSION_EXPIRED =
  "Сессия истекла. Войдите снова, чтобы сохранить настройки.";
const PRO_REQUIRED =
  "Мастерская входит в пакет «Всё включено». Оформите доступ, чтобы сохранять настройки.";
const MIGRATION_MISSING =
  "Настройки пока не сохраняются: в базе нет нужных таблиц или колонок. Примените миграции supabase/workshop_settings.sql и supabase/workshop_requisites.sql.";
const SAVE_FAILED = "Не удалось сохранить настройки. Попробуйте ещё раз.";
const EMPTY_FORM = "Форма пустая: нечего сохранять. Обновите страницу.";

/**
 * Сохранение настроек Мастерской.
 *
 * Одно действие на две вкладки: «Калькулятор» присылает четыре числа, а
 * «Реквизиты» — данные компании. Разбор формы определяет, какие поля пришли:
 * так сохранение одной вкладки не затирает значения другой, а первое
 * сохранение с любой вкладки создаёт строку.
 *
 * Порядок проверок повторяет /dashboard/workshop: разбор формы → сессия →
 * подписка → запись. Подписка проверяется и здесь, а не только на странице:
 * Server Action — публичный endpoint, и её можно вызвать запросом в обход
 * интерфейса.
 *
 * Запись — upsert по user_id: одна строка на пользователя, первое сохранение
 * создаёт её, повторное обновляет. RLS всё равно проверяет auth.uid(), так что
 * записать чужую строку не получится даже подделав user_id.
 */
export async function saveWorkshopSettings(
  _prevState: WorkshopSettingsFormState,
  formData: FormData,
): Promise<WorkshopSettingsFormState> {
  const hasSettingsFields = WORKSHOP_FIELDS.some((field) =>
    formData.has(field.formName),
  );
  const hasRequisitesFields = hasWorkshopRequisitesFormFields(formData);

  if (!hasSettingsFields && !hasRequisitesFields) {
    return { error: EMPTY_FORM };
  }

  const settingsResult = hasSettingsFields
    ? readWorkshopSettingsForm(formData)
    : null;
  const requisitesResult = hasRequisitesFields
    ? readWorkshopRequisitesForm(formData)
    : null;

  // Ошибки полей важнее общего текста: пользователь сразу видит, что исправить.
  if (
    (settingsResult && !settingsResult.settings) ||
    (requisitesResult && !requisitesResult.requisites)
  ) {
    return {
      fieldErrors: settingsResult?.errors,
      requisitesFieldErrors: requisitesResult?.errors,
    };
  }

  const settings = settingsResult?.settings ?? null;
  const requisites = requisitesResult?.requisites ?? null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: SESSION_EXPIRED, values: settings ?? undefined };
  }

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return { error: PRO_REQUIRED, values: settings ?? undefined };
  }

  const { error } = await supabase
    .from("workshop_settings")
    .upsert(createWorkshopSettingsPayload(user.id, settings, requisites), {
      onConflict: "user_id",
    });

  if (error) {
    console.warn(
      "Настройки мастерской не сохранены:",
      error.code,
      error.message,
    );

    return {
      error: isMissingTableSchema(error.code, error.message)
        ? MIGRATION_MISSING
        : SAVE_FAILED,
      values: settings ?? undefined,
      requisites: requisites ?? undefined,
    };
  }

  // Страница рисует настройки на сервере: без этого следующий переход покажет
  // старые значения из кэша.
  revalidatePath("/dashboard/workshop");

  return {
    success: true,
    values: settings ?? undefined,
    requisites: requisites ?? undefined,
  };
}
