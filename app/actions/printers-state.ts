/**
 * Состояние форм принтеров для useActionState и ответов кнопок обслуживания.
 *
 * Как и у склада, ошибок может быть много по полям (форма добавления) или
 * ровно одна (сброс счётчика), поэтому два типа, а не один с необязательными
 * полями.
 */
import type { PrinterFormErrors } from "@/lib/workshop/printers";

export type PrinterFormState = {
  /** Общая ошибка формы: сессия, подписка, база. */
  error?: string;
  /** Ошибки конкретных полей — показываются под полем. */
  fieldErrors?: PrinterFormErrors;
  /** Принтер добавлен: можно закрыть окно и обновить список. */
  success?: boolean;
  /** Что показать после успеха: «Bambu Lab P1S добавлен.» */
  message?: string;
};

/** Ответ кнопки «Заменить сопло» / «Смазать оси». */
export type PrinterActionState = {
  ok: boolean;
  message?: string;
  error?: string;
};

export const emptyPrinterFormState: PrinterFormState = {};
