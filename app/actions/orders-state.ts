/**
 * Состояние форм заказов для useActionState и ответов смены статуса.
 *
 * `fieldErrors` несёт ошибки полей, `error` — общую (сессия, подписка, база).
 * Ошибка «в катушке не хватает пластика» приходит в `fieldErrors.materialWeightG`:
 * она относится к весу модели, а не ко всему заказу.
 */
import type { OrderFormErrors } from "@/lib/workshop/orders";

export type OrderFormState = {
  /** Общая ошибка формы: сессия, подписка, база. */
  error?: string;
  /** Ошибки конкретных полей — показываются под полем. */
  fieldErrors?: OrderFormErrors;
  /** Заказ создан: можно закрыть окно и обновить список. */
  success?: boolean;
  /** Что показать после успеха: «Заказ «Подставка» создан.» */
  message?: string;
};

/** Ответ кнопки статуса и других одиночных действий с заказом. */
export type OrderActionState = {
  ok: boolean;
  message?: string;
  error?: string;
};

/**
 * Готовность заказа к очереди печати.
 *
 * `itemCount` — сколько позиций у заказа, `gcodeItemCount` — у скольких товаров
 * есть ссылка на G-code. Карточка по этому ответу решает, активна ли кнопка
 * «В очередь на печать».
 */
export type OrderPrintStatus = {
  itemCount: number;
  gcodeItemCount: number;
};

/**
 * Ответ формы «Редактировать заказ».
 *
 * Ошибки полей приходят отдельно от общей: форма показывает текст под
 * конкретным полем (название, стоимость, вес), а сессия, подписка и база —
 * общей плашкой над кнопками.
 */
export type OrderEditState = OrderActionState & {
  fieldErrors?: OrderFormErrors;
};

export const emptyOrderFormState: OrderFormState = {};
