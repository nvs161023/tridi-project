/**
 * Чтение настроек Мастерской для страницы `/dashboard/workshop`.
 *
 * Миграции `supabase/workshop_settings.sql`, `supabase/workshop_requisites.sql` и
 * `supabase/workshop_marketplace_integration.sql` применяют вручную, поэтому
 * таблицы или новых колонок может не быть в живой базе. Это не повод падать:
 * страница получает значения по умолчанию и признаки isMissingTable /
 * isRequisitesMissing / isIntegrationsMissing, чтобы показать предупреждение
 * «пока не сохраняется» и всё равно дать посчитать себестоимость.
 *
 * Реквизиты, ключи Ozon, токен вебхука и токен агента читаются отдельными
 * запросами: если миграция не применена, PostgREST отвечает PGRST204 на всю
 * выборку, и числа калькулятора в общей выборке тоже пропали бы. Пять
 * независимых запросов стоят лишних round-trip, зато числа, реквизиты,
 * интеграция и агент не ломают друг друга.
 */
import type { createClient } from "@/lib/supabase/server";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import {
  normalizeAgentToken,
  WORKSHOP_AGENT_TOKEN_COLUMN,
} from "@/lib/workshop/agent-token";
import {
  normalizeWorkshopIntegrations,
  WORKSHOP_INTEGRATIONS_COLUMNS,
  WORKSHOP_INTEGRATIONS_DEFAULTS,
  WORKSHOP_WEBHOOK_TOKEN_COLUMN,
  type WorkshopIntegrations,
} from "@/lib/workshop/integrations";
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
  integrations: WorkshopIntegrations;
  /**
   * Токен локального агента печати из `workshop_settings.agent_token`.
   * `null` — токен ещё не создан или колонки нет (миграция не применена).
   */
  agentToken: string | null;
  /** В базе нет таблицы workshop_settings — миграция не применена. */
  isMissingTable: boolean;
  /** В workshop_settings нет колонок реквизитов — не применён workshop_requisites.sql. */
  isRequisitesMissing: boolean;
  /** Нет колонок Ozon — не применён workshop_marketplace_integration.sql. */
  isIntegrationsMissing: boolean;
  /** Нет колонки agent_token — не применён workshop_farm_and_shop.sql. */
  isAgentTokenMissing: boolean;
};

/** Настройки пользователя; при любой проблеме — значения по умолчанию. */
export async function getWorkshopSettings(
  supabase: Supabase,
  userId: string,
): Promise<WorkshopSettingsSnapshot> {
  const [
    settingsResult,
    requisitesResult,
    integrationsResult,
    webhookTokenResult,
    agentTokenResult,
  ] = await Promise.all([
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
    supabase
      .from("workshop_settings")
      .select(WORKSHOP_INTEGRATIONS_COLUMNS)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("workshop_settings")
      .select(WORKSHOP_WEBHOOK_TOKEN_COLUMN)
      .eq("user_id", userId)
      .maybeSingle(),
    // Токен агента приходит из другой миграции (workshop_farm_and_shop.sql),
    // поэтому и запрос отдельный: без колонки ключи Ozon и числа должны
    // остаться в интерфейсе.
    supabase
      .from("workshop_settings")
      .select(WORKSHOP_AGENT_TOKEN_COLUMN)
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

  if (integrationsResult.error) {
    console.warn(
      "Интеграция с Ozon не прочитана:",
      integrationsResult.error.code,
      integrationsResult.error.message,
    );
  }

  if (webhookTokenResult.error) {
    // Нет только колонки токена: ключи Ozon при этом читаются, страница
    // работает, а вкладка «Интеграции» подскажет применить миграцию.
    console.warn(
      "Токен вебхука Ozon не прочитан:",
      webhookTokenResult.error.code,
      webhookTokenResult.error.message,
    );
  }

  if (agentTokenResult.error) {
    // Колонку agent_token создаёт workshop_farm_and_shop.sql. Пока её нет,
    // вкладка «Интеграции» показывает предупреждение вместо токена, а
    // остальные разделы работают.
    console.warn(
      "Токен агента печати не прочитан:",
      agentTokenResult.error.code,
      agentTokenResult.error.message,
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
    integrations: integrationsResult.error
      ? { ...WORKSHOP_INTEGRATIONS_DEFAULTS }
      : normalizeWorkshopIntegrations({
          ...(integrationsResult.data as
            | Partial<Record<string, unknown>>
            | null),
          webhook_token: webhookTokenResult.error
            ? null
            : (webhookTokenResult.data as { webhook_token?: unknown } | null)
                ?.webhook_token,
        }),
    agentToken: agentTokenResult.error
      ? null
      : normalizeAgentToken(
          (
            agentTokenResult.data as Partial<Record<string, unknown>> | null
          )?.[WORKSHOP_AGENT_TOKEN_COLUMN],
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
    isIntegrationsMissing: integrationsResult.error
      ? isMissingTableSchema(
          integrationsResult.error.code,
          integrationsResult.error.message,
        )
      : false,
    isAgentTokenMissing: agentTokenResult.error
      ? isMissingTableSchema(
          agentTokenResult.error.code,
          agentTokenResult.error.message,
        )
      : false,
  };
}
