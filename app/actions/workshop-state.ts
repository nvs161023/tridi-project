/**
 * Состояние формы настроек Мастерской для useActionState.
 *
 * Одно действие обслуживает две вкладки: калькулятор сохраняет числа, а
 * «Реквизиты» — данные компании. Поэтому успех и ошибки обеих групп живут в
 * одном объекте: каждая форма читает свои поля, а после сохранения калькулятор
 * обновляет числа без перезагрузки страницы.
 */
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
  /** Настройки сохранены: можно обновить расчёт. */
  success?: boolean;
  /** Нормализованные числа, которые записались в базу. */
  values?: WorkshopSettings;
  /** Нормализованные реквизиты, которые записались в базу. */
  requisites?: WorkshopRequisites;
};

export const emptyWorkshopSettingsFormState: WorkshopSettingsFormState = {};
