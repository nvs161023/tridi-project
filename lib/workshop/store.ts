/**
 * Чтение настроек Мастерской для страницы `/dashboard/workshop`.
 *
 * Миграцию `supabase/workshop_settings.sql` применяют вручную, поэтому таблицы
 * может не быть в живой базе. Это не повод падать: страница получает значения
 * по умолчанию и признак isMissingTable, чтобы показать предупреждение «пока не
 * сохраняется» и всё равно дать посчитать себестоимость.
 */
import type { createClient } from "@/lib/supabase/server";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import {
  normalizeWorkshopSettings,
  WORKSHOP_SETTINGS_COLUMNS,
  WORKSHOP_SETTINGS_DEFAULTS,
  type WorkshopSettings,
} from "@/lib/workshop/settings";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type WorkshopSettingsSnapshot = {
  settings: WorkshopSettings;
  /** В базе нет таблицы workshop_settings — миграция не применена. */
  isMissingTable: boolean;
};

/** Настройки пользователя; при любой проблеме — значения по умолчанию. */
export async function getWorkshopSettings(
  supabase: Supabase,
  userId: string,
): Promise<WorkshopSettingsSnapshot> {
  const { data, error } = await supabase
    .from("workshop_settings")
    .select(WORKSHOP_SETTINGS_COLUMNS)
    .eq("user_id", userId)
    // Строки может не быть: настройки создаются при первом сохранении формы.
    .maybeSingle();

  if (error) {
    // Сбой чтения не должен ронять страницу: калькулятор работает и на
    // значениях по умолчанию, а текст предупреждения зависит от причины.
    console.warn(
      "Настройки мастерской не прочитаны:",
      error.code,
      error.message,
    );

    return {
      settings: { ...WORKSHOP_SETTINGS_DEFAULTS },
      isMissingTable: isMissingTableSchema(error.code, error.message),
    };
  }

  return {
    settings: normalizeWorkshopSettings(
      data as Partial<Record<string, unknown>> | null,
    ),
    isMissingTable: false,
  };
}
