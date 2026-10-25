/**
 * Состояние формы настроек Мастерской для useActionState.
 *
 * Одно действие обслуживает три вкладки: калькулятор сохраняет числа,
 * «Реквизиты» — данные компании, «Интеграции» — ключи Ozon. Поэтому успех и
 * ошибки всех групп живут в одном объекте: каждая форма читает свои поля, а
 * после сохранения калькулятор обновляет числа без перезагрузки страницы.
 */
import type {
  WorkshopIntegrations,
  WorkshopIntegrationsErrors,
} from "@/lib/workshop/integrations";
import type {
  WorkshopRequisites,
  WorkshopRequisitesErrors,
} from "@/lib/workshop/requisites";
import type {
  WorkshopSettings,
  WorkshopSettingsErrors,
} from "@/lib/workshop/settings";

export type WorkshopSettingsFormState = {
  /** Общая ошибка формы: сессия, подписка, база. */
  error?: string;
  /** Ошибки числовых полей калькулятора — показываются под полем. */
  fieldErrors?: WorkshopSettingsErrors;
  /** Ошибки полей вкладки «Реквизиты» — показываются под полем. */
  requisitesFieldErrors?: WorkshopRequisitesErrors;
  /** Ошибки полей вкладки «Интеграции» — показываются под полем. */
  integrationFieldErrors?: WorkshopIntegrationsErrors;
  /** Настройки сохранены: можно обновить расчёт. */
  success?: boolean;
  /** Нормализованные числа, которые записались в базу. */
  values?: WorkshopSettings;
  /** Нормализованные реквизиты, которые записались в базу. */
  requisites?: WorkshopRequisites;
  /** Ключи Ozon, которые записались в базу; `null` в паре — интеграция выключена. */
  integrations?: WorkshopIntegrations;
};

export const emptyWorkshopSettingsFormState: WorkshopSettingsFormState = {};
