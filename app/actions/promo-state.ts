/**
 * Состояния форм промокодов.
 *
 * Отдельный файл без "use server": типы и пустые значения нужны и серверным
 * действиям, и клиентским формам, а импортировать модуль с "use server" в
 * клиентский компонент можно только ради самих действий.
 */

/** Результат выпуска партии в /admin/promo. */
export type PromoAdminFormState = {
  error?: string;
  success?: string;
  /** Коды последней созданной партии — показываем сразу после выпуска. */
  created?: string[];
};

export const emptyPromoAdminFormState: PromoAdminFormState = {};

/** Результат активации кода покупателем на /activate. */
export type ActivatePromoFormState = {
  error?: string;
  success?: string;
  /** Куда вести после успеха: страница оплаченного уровня. */
  courseHref?: string;
};

export const emptyActivatePromoFormState: ActivatePromoFormState = {};
