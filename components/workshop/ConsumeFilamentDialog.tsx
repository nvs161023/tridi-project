"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { consumeFilament } from "@/app/actions/filaments";
import { emptyConsumeFilamentFormState } from "@/app/actions/filaments-state";
import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";
import {
  CONSUME_MAX_GRAMS,
  CONSUME_MIN_GRAMS,
  formatGrams,
  subtractFilamentWeight,
  type WorkshopFilament,
} from "@/lib/workshop/filaments";
import { parseWorkshopNumber } from "@/lib/workshop/settings";

/**
 * Окно «Списать N грамм».
 *
 * Списывать пластик вручную нужно, когда печать уже прошла: слайсер обещает
 * один вес, а по факту уходит другой. Остаток пересчитывает Server Action по
 * актуальной строке базы, поэтому окно показывает только предварительную
 * цифру — и та же арифметика лежит в lib/workshop/filaments.ts.
 *
 * Окно монтируется только открытым: состояние формы и подписка на Escape живут
 * ровно столько, сколько оно на экране.
 */

type ConsumeFilamentDialogProps = {
  filament: WorkshopFilament;
  onClose: () => void;
  /** Сообщение для строки состояния на вкладке. */
  onConsumed: (message: string) => void;
};

const inputClassName =
  "mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-white outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40";

export function ConsumeFilamentDialog({
  filament,
  onClose,
  onConsumed,
}: ConsumeFilamentDialogProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    consumeFilament,
    emptyConsumeFilamentFormState,
  );
  const [grams, setGrams] = useState(() =>
    String(Math.min(50, Math.max(CONSUME_MIN_GRAMS, filament.remainingWeightG))),
  );

  useDialogDismiss(onClose);

  useEffect(() => {
    if (!state.success) {
      return;
    }

    router.refresh();
    onConsumed(state.message ?? "Пластик списан.");
    onClose();
  }, [onClose, onConsumed, router, state.message, state.success]);

  const parsedGrams = parseWorkshopNumber(grams);
  const preview =
    parsedGrams !== null && parsedGrams >= CONSUME_MIN_GRAMS
      ? subtractFilamentWeight(filament, parsedGrams)
      : null;
  const isPreviewLow = preview !== null && preview < filament.minThresholdG;

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-4 backdrop-blur-sm sm:items-center"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="consume-filament-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black/50 sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-blue-400 uppercase">
              Склад
            </p>
            <h2
              id="consume-filament-title"
              className="mt-3 text-2xl font-extrabold tracking-tight text-white"
            >
              Списать пластик
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно списания пластика"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-lg text-slate-300 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-300">
          {filament.brand} {filament.type}, {filament.color}. Осталось{" "}
          <strong className="font-semibold text-white">
            {formatGrams(filament.remainingWeightG)}
          </strong>
          .
        </p>

        <form action={formAction} className="mt-5 space-y-4">
          <input type="hidden" name="filamentId" value={filament.id} />

          <div>
            <label
              htmlFor="consume-grams"
              className="block text-sm font-semibold text-slate-200"
            >
              Сколько списать (г)
            </label>
            <input
              id="consume-grams"
              name="grams"
              type="number"
              inputMode="numeric"
              step="1"
              min={CONSUME_MIN_GRAMS}
              max={Math.min(CONSUME_MAX_GRAMS, filament.remainingWeightG)}
              required
              autoFocus
              value={grams}
              onChange={(event) => setGrams(event.target.value)}
              aria-invalid={state.fieldError ? true : undefined}
              aria-describedby={
                state.fieldError ? "consume-grams-error" : "consume-grams-hint"
              }
              className={inputClassName}
            />
            {state.fieldError ? (
              <p
                id="consume-grams-error"
                role="alert"
                className="mt-1.5 text-sm text-red-300"
              >
                {state.fieldError}
              </p>
            ) : (
              <p
                id="consume-grams-hint"
                className="mt-1.5 text-xs leading-relaxed text-slate-400"
              >
                Напишите вес по факту печати — слайсер часто округляет.
              </p>
            )}
          </div>

          <p aria-live="polite" className="text-xs leading-relaxed text-slate-400">
            {preview === null ? (
              "Введите количество граммов."
            ) : (
              <>
                После списания останется{" "}
                <strong className="font-semibold text-slate-200">
                  {formatGrams(preview)}
                </strong>
                {isPreviewLow ? " — это ниже порога, пора покупать." : "."}
              </>
            )}
          </p>

          {state.error ? (
            <p
              role="alert"
              className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100"
            >
              <span aria-hidden>⚠️ </span>
              {state.error}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <button
              type="submit"
              disabled={isPending}
              aria-busy={isPending}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isPending ? "Списываем…" : "Списать"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 px-6 text-sm font-semibold text-slate-200 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
