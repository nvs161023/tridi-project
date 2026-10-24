"use client";

import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useRef, useState } from "react";

import { addPrinter } from "@/app/actions/printers";
import { emptyPrinterFormState } from "@/app/actions/printers-state";
import { MaintenanceGuideDialog } from "@/components/workshop/MaintenanceGuideDialog";
import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";
import { getMaintenanceGuide } from "@/lib/workshop/maintenance-guides";
import { PRINTER_PRESETS } from "@/lib/workshop/printer-presets";
import {
  PRINTER_INTERVAL_DEFAULTS,
  PRINTER_INTERVAL_LIMITS,
  PRINTER_TEXT_LIMITS,
  formatPrinterHours,
} from "@/lib/workshop/printers";

/**
 * Окно «Добавить принтер».
 *
 * Модель выбирается из справочника `PRINTER_PRESETS`: по индексу сервер сам
 * берёт бренд и модель, а форма подставляет интервалы обслуживания и показывает
 * подсказку `note`. Интервалы остаются полями ввода — справочник это ориентир,
 * а не жёсткий регламент, и мастер с другой загрузкой может их поправить.
 *
 * Проверки живут в lib/workshop/printers.ts, здесь только разметка и ошибки,
 * которые вернул Server Action. После успеха окно закрывается, список
 * обновляется через router.refresh().
 */

type AddPrinterDialogProps = {
  onClose: () => void;
  /** Сообщение для строки состояния на вкладке. */
  onCreated: (message: string) => void;
};

const inputClassName =
  "mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-white outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40";

export function AddPrinterDialog({
  onClose,
  onCreated,
}: AddPrinterDialogProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    addPrinter,
    emptyPrinterFormState,
  );
  const [presetIndex, setPresetIndex] = useState("");
  const [nozzleInterval, setNozzleInterval] = useState(
    String(PRINTER_INTERVAL_DEFAULTS.nozzle),
  );
  const [lubricationInterval, setLubricationInterval] = useState(
    String(PRINTER_INTERVAL_DEFAULTS.lubrication),
  );
  const [zScrewInterval, setZScrewInterval] = useState(
    String(PRINTER_INTERVAL_DEFAULTS.zScrew),
  );
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const guideTriggerRef = useRef<HTMLButtonElement>(null);

  /**
   * Пока открыта инструкция, Escape должен закрывать только её. Обработчик
   * родительского окна остаётся подписанным, но ничего не делает.
   */
  const closeAddUnlessGuide = useCallback(() => {
    if (!isGuideOpen) {
      onClose();
    }
  }, [isGuideOpen, onClose]);

  useDialogDismiss(closeAddUnlessGuide);

  const closeGuide = useCallback(() => {
    setIsGuideOpen(false);
    guideTriggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!state.success) {
      return;
    }

    router.refresh();
    onCreated(state.message ?? "Принтер добавлен.");
    onClose();
  }, [onClose, onCreated, router, state.message, state.success]);

  const preset = presetIndex ? PRINTER_PRESETS[Number(presetIndex)] : null;
  const guide = preset
    ? getMaintenanceGuide(preset.brand, preset.model)
    : null;
  const nameError = state.fieldErrors?.name;
  const presetError = state.fieldErrors?.preset;
  const nozzleError = state.fieldErrors?.nozzleInterval;
  const lubricationError = state.fieldErrors?.lubricationInterval;
  const zScrewError = state.fieldErrors?.zScrewInterval;

  /** Выбор модели: подставляем все интервалы производителя и её подсказку. */
  function handlePresetChange(value: string) {
    setPresetIndex(value);
    setIsGuideOpen(false);

    const next = value ? PRINTER_PRESETS[Number(value)] : null;

    if (!next) {
      return;
    }

    setNozzleInterval(String(next.nozzleHours));
    setLubricationInterval(String(next.lubricationHours));
    setZScrewInterval(String(next.zScrewHours));
  }

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
        aria-labelledby="add-printer-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black/50 sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-blue-400 uppercase">
              Принтеры
            </p>
            <h2
              id="add-printer-title"
              className="mt-3 text-2xl font-extrabold tracking-tight text-white"
            >
              Добавить принтер
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно добавления принтера"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-lg text-slate-300 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        <form action={formAction} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="printer-name"
              className="block text-sm font-semibold text-slate-200"
            >
              Имя принтера
            </label>
            <input
              id="printer-name"
              name="name"
              type="text"
              placeholder="Мой Ender"
              maxLength={PRINTER_TEXT_LIMITS.name}
              required
              autoFocus
              aria-invalid={nameError ? true : undefined}
              aria-describedby={
                nameError ? "printer-name-error" : "printer-name-hint"
              }
              className={inputClassName}
            />
            {nameError ? (
              <p
                id="printer-name-error"
                role="alert"
                className="mt-1.5 text-sm text-red-300"
              >
                {nameError}
              </p>
            ) : (
              <p
                id="printer-name-hint"
                className="mt-1.5 text-xs leading-relaxed text-slate-400"
              >
                Как вы его называете: «Мой Ender», «Принтер в гараже».
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="printer-preset"
              className="block text-sm font-semibold text-slate-200"
            >
              Модель
            </label>
            <select
              id="printer-preset"
              name="preset"
              required
              value={presetIndex}
              onChange={(event) => handlePresetChange(event.currentTarget.value)}
              aria-invalid={presetError ? true : undefined}
              aria-describedby={
                presetError ? "printer-preset-error" : "printer-preset-hint"
              }
              className={inputClassName}
            >
              <option value="">Выберите модель</option>
              {PRINTER_PRESETS.map((item, index) => (
                <option key={`${item.brand}-${item.model}`} value={index}>
                  {item.brand} — {item.model}
                </option>
              ))}
            </select>
            {presetError ? (
              <p
                id="printer-preset-error"
                role="alert"
                className="mt-1.5 text-sm text-red-300"
              >
                {presetError}
              </p>
            ) : (
              <p
                id="printer-preset-hint"
                className="mt-1.5 text-xs leading-relaxed text-slate-400"
              >
                Интервалы обслуживания подставятся из справочника — их можно
                поправить под свою загрузку.
              </p>
            )}
          </div>

          {preset ? (
            <div
              aria-live="polite"
              className="rounded-2xl border border-blue-400/30 bg-blue-500/10 px-4 py-3"
            >
              <p className="text-xs font-semibold tracking-wide text-blue-200 uppercase">
                {preset.brand} {preset.model}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-200">
                {preset.note}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                Сопло — каждые {formatPrinterHours(preset.nozzleHours)}
                {preset.lubricationHours > 0
                  ? ` · смазка осей — каждые ${formatPrinterHours(preset.lubricationHours)}`
                  : " · смазка осей не требуется"}
                {` · винт Z — каждые ${formatPrinterHours(preset.zScrewHours)}`}
              </p>
              {guide ? (
                <button
                  ref={guideTriggerRef}
                  type="button"
                  onClick={() => setIsGuideOpen(true)}
                  aria-haspopup="dialog"
                  className="mt-3 inline-flex min-h-9 items-center justify-center rounded-full border border-blue-300/40 bg-blue-500/10 px-4 text-xs font-semibold text-blue-100 transition-colors hover:border-blue-200/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  Инструкция по ТО
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="printer-nozzle-interval"
                className="block text-sm font-semibold text-slate-200"
              >
                Сопло, ч
              </label>
              <input
                id="printer-nozzle-interval"
                name="nozzleInterval"
                type="number"
                inputMode="numeric"
                step="1"
                min={PRINTER_INTERVAL_LIMITS.nozzleMin}
                max={PRINTER_INTERVAL_LIMITS.max}
                required
                value={nozzleInterval}
                onChange={(event) => setNozzleInterval(event.target.value)}
                aria-invalid={nozzleError ? true : undefined}
                aria-describedby={
                  nozzleError
                    ? "printer-nozzle-interval-error"
                    : "printer-nozzle-interval-hint"
                }
                className={inputClassName}
              />
              {nozzleError ? (
                <p
                  id="printer-nozzle-interval-error"
                  role="alert"
                  className="mt-1.5 text-sm text-red-300"
                >
                  {nozzleError}
                </p>
              ) : (
                <p
                  id="printer-nozzle-interval-hint"
                  className="mt-1.5 text-xs leading-relaxed text-slate-400"
                >
                  Через сколько часов менять сопло.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="printer-lubrication-interval"
                className="block text-sm font-semibold text-slate-200"
              >
                Смазка, ч
              </label>
              <input
                id="printer-lubrication-interval"
                name="lubricationInterval"
                type="number"
                inputMode="numeric"
                step="1"
                min={PRINTER_INTERVAL_LIMITS.lubricationMin}
                max={PRINTER_INTERVAL_LIMITS.max}
                required
                value={lubricationInterval}
                onChange={(event) =>
                  setLubricationInterval(event.target.value)
                }
                aria-invalid={lubricationError ? true : undefined}
                aria-describedby={
                  lubricationError
                    ? "printer-lubrication-interval-error"
                    : "printer-lubrication-interval-hint"
                }
                className={inputClassName}
              />
              {lubricationError ? (
                <p
                  id="printer-lubrication-interval-error"
                  role="alert"
                  className="mt-1.5 text-sm text-red-300"
                >
                  {lubricationError}
                </p>
              ) : (
                <p
                  id="printer-lubrication-interval-hint"
                  className="mt-1.5 text-xs leading-relaxed text-slate-400"
                >
                  0 — смазка не требуется, например у карбоновых стержней.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="printer-z-screw-interval"
                className="block text-sm font-semibold text-slate-200"
              >
                Винт Z, ч
              </label>
              <input
                id="printer-z-screw-interval"
                name="zScrewInterval"
                type="number"
                inputMode="numeric"
                step="1"
                min={PRINTER_INTERVAL_LIMITS.zScrewMin}
                max={PRINTER_INTERVAL_LIMITS.max}
                required
                value={zScrewInterval}
                onChange={(event) => setZScrewInterval(event.target.value)}
                aria-invalid={zScrewError ? true : undefined}
                aria-describedby={
                  zScrewError
                    ? "printer-z-screw-interval-error"
                    : "printer-z-screw-interval-hint"
                }
                className={inputClassName}
              />
              {zScrewError ? (
                <p
                  id="printer-z-screw-interval-error"
                  role="alert"
                  className="mt-1.5 text-sm text-red-300"
                >
                  {zScrewError}
                </p>
              ) : (
                <p
                  id="printer-z-screw-interval-hint"
                  className="mt-1.5 text-xs leading-relaxed text-slate-400"
                >
                  Через сколько часов смазывать винт Z.
                </p>
              )}
            </div>
          </div>

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
              {isPending ? "Добавляем…" : "Добавить принтер"}
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

      {isGuideOpen && preset && guide ? (
        <MaintenanceGuideDialog
          title={`${preset.brand} ${preset.model}`}
          guide={guide}
          onClose={closeGuide}
        />
      ) : null}
    </div>
  );
}
