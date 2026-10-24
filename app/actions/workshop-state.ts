/**
 * Состояние формы настроек Мастерской для useActionState.
 *
 * Форма одна, поэтому успех и ошибки живут в одном объекте: после сохранения
 * компонент обновляет настройки калькулятора без перезагрузки страницы, а при
 * ошибке показывает подсказку рядом с виновным полем.
 */
import type {
  WorkshopSettings,
  WorkshopSettingsErrors,
} from "@/lib/workshop/settings";

export type WorkshopSettingsFormState = {
  /** Общая ошибка формы: сессия, подписка, база. */
  error?: string;
  /** Ошибки конкретных полей — показываются под полем. */
  fieldErrors?: WorkshopSettingsErrors;
  /** Настройки сохранены: можно обновить расчёт. */
  success?: boolean;
  /** Нормализованные значения, которые записались в базу. */
  values?: WorkshopSettings;
};

export const emptyWorkshopSettingsFormState: WorkshopSettingsFormState = {};
