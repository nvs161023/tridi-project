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
 * Активное задание печати заказа.
 *
 * Заказ — центр управления очередью, поэтому карточка показывает не кнопку, а
 * состояние задания, когда оно уже создано: `queued` — агент фермы ещё не взял
 * работу, `printing` — печать идёт. Имя принтера берётся из самого задания, а не
 * из заказа: принтер заказа можно сменить, а задание остаётся на том, которому
 * его отдали.
 */
export type OrderPrintJobState = {
  status: "queued" | "printing";
  printerId: string | null;
  /** null — задание создано без принтера или принтер удалили. */
  printerName: string | null;
};

/**
 * Готовность заказа к очереди печати.
 *
 * `itemCount` — сколько позиций у заказа, `gcodeItemCount` — у скольких товаров
 * есть ссылка на G-code. Карточка по этому ответу решает, активна ли кнопка
 * «В очередь на печать», а `activeJob` заменяет кнопку статусом, если задание уже
 * стоит в очереди или печатается.
 */
export type OrderPrintStatus = {
  itemCount: number;
  gcodeItemCount: number;
  /** Активное задание заказа; null — в очереди ничего нет. */
  activeJob: OrderPrintJobState | null;
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
