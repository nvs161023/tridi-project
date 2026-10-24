"use server";

import { revalidatePath } from "next/cache";

import type { WorkshopSettingsFormState } from "@/app/actions/workshop-state";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import { createClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";
import { createWorkshopSettingsPayload } from "@/lib/workshop/payload";
import { readWorkshopSettingsForm } from "@/lib/workshop/settings";

const SESSION_EXPIRED =
  "Сессия истекла. Войдите снова, чтобы сохранить настройки.";
const PRO_REQUIRED =
  "Мастерская входит в пакет «Всё включено». Оформите доступ, чтобы сохранять настройки.";
const MIGRATION_MISSING =
  "Настройки пока не сохраняются: в базе нет таблицы workshop_settings. Примените миграцию supabase/workshop_settings.sql.";
const SAVE_FAILED = "Не удалось сохранить настройки. Попробуйте ещё раз.";

/**
 * Сохранение настроек калькулятора Мастерской.
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
  const { settings, errors } = readWorkshopSettingsForm(formData);

  if (!settings) {
    return { fieldErrors: errors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: SESSION_EXPIRED, values: settings };
  }

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return { error: PRO_REQUIRED, values: settings };
  }

  const { error } = await supabase
    .from("workshop_settings")
    .upsert(createWorkshopSettingsPayload(user.id, settings), {
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
      values: settings,
    };
  }

  // Страница рисует настройки на сервере: без этого следующий переход покажет
  // старые значения из кэша.
  revalidatePath("/dashboard/workshop");

  return { success: true, values: settings };
}
