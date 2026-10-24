/**
 * Состояние форм склада Мастерской для useActionState.
 *
 * Форм две — «Добавить катушку» и «Списать N грамм» — и ошибки у них разные:
 * у первой их может быть много по полям, у второй только количество. Поэтому
 * два типа, а не один с необязательными полями.
 */
import type { FilamentFormErrors } from "@/lib/workshop/filaments";

export type FilamentFormState = {
  /** Общая ошибка формы: сессия, подписка, база. */
  error?: string;
  /** Ошибки конкретных полей — показываются под полем. */
  fieldErrors?: FilamentFormErrors;
  /** Катушка добавлена: можно закрыть окно и обновить список. */
  success?: boolean;
  /** Что показать после успеха: «Катушка Prusament PLA добавлена.» */
  message?: string;
};

export type ConsumeFilamentFormState = {
  /** Общая ошибка: сессия, подписка, база, катушка не найдена. */
  error?: string;
  /** Ошибка поля «Сколько граммов». */
  fieldError?: string;
  /** Пластик списан: можно закрыть окно и обновить список. */
  success?: boolean;
  /** Итог списания: «Списали 120 г. Осталось 1 000 г.» */
  message?: string;
};

export const emptyFilamentFormState: FilamentFormState = {};
export const emptyConsumeFilamentFormState: ConsumeFilamentFormState = {};
