"use client";

import { MaintenanceGuideText } from "@/components/workshop/MaintenanceGuideText";
import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";

/**
 * Окно «Инструкция по ТО».
 *
 * Текст приходит простым markdown из `lib/workshop/maintenance-guides.ts`, а
 * разбирает его `MaintenanceGuideText` — тот же компонент показывает инструкцию
 * на вкладке «Обслуживание» в карточке принтера. Здесь остаётся только рамка
 * окна: заголовок модели, крестик и кнопка «Понятно».
 *
 * Окно открывается поверх окна добавления принтера (`z-[90]`), Escape и клик по
 * фону закрывают только его: родитель в это время не реагирует на Escape.
 */

type MaintenanceGuideDialogProps = {
  /** Модель: «Bambu Lab X1C». */
  title: string;
  /** Markdown-инструкция из MAINTENANCE_GUIDES. */
  guide: string;
  onClose: () => void;
};

export function MaintenanceGuideDialog({
  title,
  guide,
  onClose,
}: MaintenanceGuideDialogProps) {
  useDialogDismiss(onClose);

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="maintenance-guide-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl shadow-black/60 sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-blue-400 uppercase">
              Инструкция по ТО
            </p>
            <h2
              id="maintenance-guide-title"
              className="mt-3 text-2xl font-extrabold tracking-tight text-white"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            aria-label="Закрыть инструкцию по ТО"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-lg text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        <div className="mt-6 space-y-5">
          <MaintenanceGuideText guide={guide} />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
        >
          Понятно
        </button>
      </div>
    </div>
  );
}
