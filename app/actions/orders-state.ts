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
 *
 * Оценки времени и пластика приходят из G-кода при старте печати (`null` — агент
 * ещё не посчитал), `lastError` — причина последнего отказа, `cancelRequested` —
 * мастер уже попросил остановить и агент снимет печать на следующем опросе.
 */
export type OrderPrintJobState = {
  /** id задания: кнопка «Отменить печать» работает по нему. */
  id: string;
  status: "queued" | "printing";
  printerId: string | null;
  /** null — задание создано без принтера или принтер удалили. */
  printerName: string | null;
  cancelRequested: boolean;
  lastError: string | null;
  estimatedSeconds: number | null;
  filamentGrams: number | null;
  queuedAt: string | null;
  startedAt: string | null;
};

/**
 * Последний отказ печати по заказу.
 *
 * Показывается в карточке, когда активного задания нет: иначе мастер видит
 * снова доступную кнопку и не знает, что печать уже падала. `cancelled` — отмена
 * мастером, её текст свой и «поломкой» её называть нельзя.
 */
export type OrderPrintFailure = {
  jobId: string;
  status: "failed" | "cancelled";
  message: string | null;
  at: string | null;
};

/**
 * Ответ кнопки «Распределить на свободные принтеры».
 *
 * Два числа нужны раздельно: мастер видит заказы («распределено 3 заказа»), а
 * агент фермы получает задания — у заказа с тремя позициями их три. Одно число
 * пришлось бы либо завышать, либо объяснять в тексте, поэтому `orders` и `jobs`
 * считаются независимо.
 *
 * Ноль — не ошибка: свободных принтеров или подходящих заказов могло просто не
 * быть, и это нормальный ответ (`ok: true` с сообщением). Отказ (`ok: false`) —
 * только сессия, подписка или база.
 */
export type AutoScheduleState =
  | { ok: true; orders: number; jobs: number; message: string }
  | { ok: false; error: string };

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
  /** Последний отказ или отмена; null — печать ещё не падала. */
  lastFailure: OrderPrintFailure | null;
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
