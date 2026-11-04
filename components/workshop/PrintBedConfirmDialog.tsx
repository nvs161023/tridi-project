"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";

/**
 * Предупреждение по умолчанию: задание ставится на один принтер.
 *
 * Текст один на все экраны, где заказ уходит в очередь, — карточку заказа и
 * доску. Мастер подтверждает то же самое, что потом проверяет у станка.
 */
export const PRINT_BED_WARNING_SINGLE =
  "Внимание! Перед запуском печати убедитесь, что на столе принтера нет остатков предыдущей модели. Стол должен быть чистым.";

/**
 * Предупреждение автопланировщика: принтеров сразу несколько.
 *
 * «Распределить на свободные принтеры» ставит заказы на весь парк, поэтому речь
 * идёт о столах всех станков: чистым должен быть каждый, а не тот, что попался
 * первым в списке.
 */
export const PRINT_BED_WARNING_FLEET =
  "Внимание! Убедитесь, что на столах всех принтеров нет остатков предыдущей модели. Столы должны быть чистыми.";

type PrintBedConfirmDialogProps = {
  /** Текст предупреждения: у автопланировщика речь о столах всего парка. */
  warning?: string;
  /** Имя принтера: «на «Bambu A1»». Пусто — машина удалена из парка. */
  printerName?: string | null;
  /** Пояснение под предупреждением; по умолчанию — про очередь на принтер. */
  hint?: string;
  /** Запрос уже уходит на сервер: кнопки гаснут, окно не закрывается. */
  isBusy?: boolean;
  /** Текст подтверждающей кнопки. */
  confirmLabel?: string;
  /** Текст подтверждающей кнопки, пока идёт запрос. */
  busyLabel?: string;
  /** Подтверждение: вызывающий ставит задания в очередь. */
  onConfirm: () => void;
  /** Отмена и Escape — очередь не создаётся. */
  onCancel: () => void;
};

/**
 * Окно «стол чистый» перед постановкой задания в очередь.
 *
 * Печать на ферме стартует без мастера, поэтому остатки прошлой модели на столе
 * — это брак и сорванное сопло. Сервер про стол ничего не знает, и
 * подтверждение — единственное место, где мастер его проверяет. Окно одно на все
 * точки входа (карточка заказа и автопланировщик): второй экран не должен
 * спрашивать про стол другими словами.
 *
 * Окно живёт поверх содержимого (`z-[95]`) и обрабатывает Escape в фазе
 * перехвата (`useDialogDismiss(..., { isTopmost: true })`): закрывается только
 * оно, а карточка под ним остаётся открытой. Фокус получает «Отмена»: промах по
 * Enter не запускает печать на грязном столе.
 */
export function PrintBedConfirmDialog({
  warning = PRINT_BED_WARNING_SINGLE,
  printerName = null,
  hint,
  isBusy = false,
  confirmLabel = "Да, стол чистый, начать печать",
  busyLabel = "Ставим в очередь…",
  onConfirm,
  onCancel,
}: PrintBedConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  /**
   * Свои id у каждого экземпляра.
   *
   * Окно стоит и в карточке заказа, и на доске: повторяющиеся `id` в разметке
   * сломали бы чтение подписи экранным диктором, если обе модалки когда-нибудь
   * окажутся в документе вместе.
   */
  const titleId = useId();
  const descriptionId = useId();

  /**
   * Пока запрос идёт, окно не закрывается: иначе мастер не поймёт, ушёл ли он,
   * и нажмёт кнопку второй раз.
   */
  const closeDialog = useCallback(() => {
    if (!isBusy) {
      onCancel();
    }
  }, [isBusy, onCancel]);

  useDialogDismiss(closeDialog, { isTopmost: true });

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  const text =
    hint ??
    (printerName
      ? `Задание встанет в очередь на «${printerName}»: агент запустит печать, как только принтер освободится.`
      : "Задание встанет в очередь на выбранный принтер: агент запустит печать, как только принтер освободится.");

  return createPortal(
    <div
      role="presentation"
      data-print-bed-confirm-overlay
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeDialog();
        }
      }}
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        data-print-bed-confirm
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0a0a] p-5 shadow-2xl shadow-black/60"
      >
        <h3 id={titleId} className="text-base font-bold text-white">
          Стол принтера чистый?
        </h3>

        <p
          id={descriptionId}
          data-print-bed-confirm-text
          className="mt-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2.5 text-sm leading-relaxed text-amber-100"
        >
          {warning}
        </p>

        <p className="mt-2 text-xs leading-relaxed text-zinc-500">{text}</p>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={closeDialog}
            disabled={isBusy}
            data-print-bed-confirm-cancel
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold text-slate-200 transition-colors hover:border-white/30 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
            aria-busy={isBusy}
            data-print-bed-confirm-accept
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-500 px-4 text-sm font-bold text-white shadow-[0_10px_30px_-12px_rgba(59,130,246,0.8)] transition-colors hover:bg-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
