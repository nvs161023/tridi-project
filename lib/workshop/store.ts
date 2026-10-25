/**
 * Чтение настроек Мастерской для страницы `/dashboard/workshop`.
 *
 * Миграции `supabase/workshop_settings.sql` и `supabase/workshop_requisites.sql`
 * применяют вручную, поэтому таблицы или новых колонок может не быть в живой
 * базе. Это не повод падать: страница получает значения по умолчанию и признаки
 * isMissingTable / isRequisitesMissing, чтобы показать предупреждение «пока не
 * сохраняется» и всё равно дать посчитать себестоимость.
 *
 * Реквизиты читаются отдельным запросом: если миграция workshop_requisites.sql не
 * применена, PostgREST отвечает PGRST204 на всю выборку, и числа калькулятора в
 * общей выборке тоже пропали бы. Два независимых запроса стоят одного лишнего
 * round-trip, зато числа и реквизиты не ломают друг друга.
 */
import type { createClient } from "@/lib/supabase/server";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import {
  normalizeWorkshopRequisites,
  WORKSHOP_REQUISITES_COLUMNS,
  WORKSHOP_REQUISITES_DEFAULTS,
  type WorkshopRequisites,
} from "@/lib/workshop/requisites";
import {
  normalizeWorkshopSettings,
  WORKSHOP_SETTINGS_COLUMNS,
  WORKSHOP_SETTINGS_DEFAULTS,
  type WorkshopSettings,
} from "@/lib/workshop/settings";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type WorkshopSettingsSnapshot = {
  settings: WorkshopSettings;
  requisites: WorkshopRequisites;
  /** В базе нет таблицы workshop_settings — миграция не применена. */
  isMissingTable: boolean;
  /** В workshop_settings нет колонок реквизитов — не применён workshop_requisites.sql. */
  isRequisitesMissing: boolean;
};

/** Настройки пользователя; при любой проблеме — значения по умолчанию. */
export async function getWorkshopSettings(
  supabase: Supabase,
  userId: string,
): Promise<WorkshopSettingsSnapshot> {
  const [settingsResult, requisitesResult] = await Promise.all([
    supabase
      .from("workshop_settings")
      .select(WORKSHOP_SETTINGS_COLUMNS)
      .eq("user_id", userId)
      // Строки может не быть: настройки создаются при первом сохранении формы.
      .maybeSingle(),
    supabase
      .from("workshop_settings")
      .select(WORKSHOP_REQUISITES_COLUMNS)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (settingsResult.error) {
    // Сбой чтения не должен ронять страницу: калькулятор работает и на
    // значениях по умолчанию, а текст предупреждения зависит от причины.
    console.warn(
      "Настройки мастерской не прочитаны:",
      settingsResult.error.code,
      settingsResult.error.message,
    );
  }

  if (requisitesResult.error) {
    console.warn(
      "Реквизиты мастерской не прочитаны:",
      requisitesResult.error.code,
      requisitesResult.error.message,
    );
  }

  return {
    settings: settingsResult.error
      ? { ...WORKSHOP_SETTINGS_DEFAULTS }
      : normalizeWorkshopSettings(
          settingsResult.data as Partial<Record<string, unknown>> | null,
        ),
    requisites: requisitesResult.error
      ? { ...WORKSHOP_REQUISITES_DEFAULTS }
      : normalizeWorkshopRequisites(
          requisitesResult.data as Partial<Record<string, unknown>> | null,
        ),
    isMissingTable: settingsResult.error
      ? isMissingTableSchema(
          settingsResult.error.code,
          settingsResult.error.message,
        )
      : false,
    isRequisitesMissing: requisitesResult.error
      ? isMissingTableSchema(
          requisitesResult.error.code,
          requisitesResult.error.message,
        )
      : false,
  };
}
