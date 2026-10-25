"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { addFilament } from "@/app/actions/filaments";
import { emptyFilamentFormState } from "@/app/actions/filaments-state";
import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";
import {
  FILAMENT_BRANDS,
  FILAMENT_DEFAULTS,
  FILAMENT_NUMBER_FIELDS,
  FILAMENT_TEXT_LIMITS,
  FILAMENT_TYPE_SUGGESTIONS,
  type FilamentNumberKey,
  type FilamentTextKey,
} from "@/lib/workshop/filaments";

/**
 * Окно «Добавить катушку».
 *
 * Поля повторяют колонки workshop_filaments. Проверки живут в
 * lib/workshop/filaments.ts, здесь только разметка и ошибки, которые вернул
 * Server Action: одни и те же пределы работают и до отправки (атрибуты min/max),
 * и после (ответ сервера).
 *
 * После успеха окно закрывается само, а склад обновляется через router.refresh():
 * список рисуется на сервере, и без этого новая катушка появилась бы только
 * после ручной перезагрузки.
 */

type AddFilamentDialogProps = {
  onClose: () => void;
  /** Сообщение для строки состояния на вкладке. */
  onCreated: (message: string) => void;
};

const inputClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white outline-none transition-all duration-200 [appearance:textfield] placeholder:text-zinc-500 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30 focus:ring-inset [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

/** Стартовые значения числовых полей: типовая катушка 1 кг. */
const DEFAULT_NUMBERS: Record<FilamentNumberKey, number> = {
  totalWeightG: FILAMENT_DEFAULTS.totalWeightG,
  remainingWeightG: FILAMENT_DEFAULTS.totalWeightG,
  pricePerKg: FILAMENT_DEFAULTS.pricePerKg,
  minThresholdG: FILAMENT_DEFAULTS.minThresholdG,
};

export function AddFilamentDialog({
  onClose,
  onCreated,
}: AddFilamentDialogProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    addFilament,
    emptyFilamentFormState,
  );

  useDialogDismiss(onClose);

  // Успех приходит новым объектом состояния: обновляем серверный список,
  // показываем подтверждение на вкладке и закрываем окно. Состояние формы
  // живёт только пока окно смонтировано, поэтому повторного срабатывания при
  // следующем открытии нет.
  useEffect(() => {
    if (!state.success) {
      return;
    }

    router.refresh();
    onCreated(state.message ?? "Катушка добавлена.");
    onClose();
  }, [onClose, onCreated, router, state.message, state.success]);

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-filament-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl shadow-black/60 sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-blue-400 uppercase">
              Склад
            </p>
            <h2
              id="add-filament-title"
              className="mt-3 text-2xl font-extrabold tracking-tight text-white"
            >
              Добавить катушку
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно добавления катушки"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-lg text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        <form
          action={formAction}
          autoComplete="off"
          className="mt-6 space-y-4"
        >
          <TextField
            name="brand"
            label="Бренд"
            hint="Начните вводить — подскажем популярные. Свой бренд тоже можно."
            placeholder="Prusament"
            maxLength={FILAMENT_TEXT_LIMITS.brand}
            required
            autoFocus
            list="brand-list"
            error={state.fieldErrors?.brand}
          />
          <datalist id="brand-list">
            {FILAMENT_BRANDS.map((brand) => (
              <option key={brand} value={brand} />
            ))}
          </datalist>

          <TextField
            name="type"
            label="Тип"
            hint="Материал: PLA, PETG, ABS, TPU…"
            placeholder="PLA"
            maxLength={FILAMENT_TEXT_LIMITS.type}
            required
            list="filament-type-options"
            error={state.fieldErrors?.type}
          />
          <datalist id="filament-type-options">
            {FILAMENT_TYPE_SUGGESTIONS.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>

          <TextField
            name="color"
            label="Цвет"
            hint="Как на катушке: «Чёрный», «Galaxy Black»."
            placeholder="Чёрный"
            maxLength={FILAMENT_TEXT_LIMITS.color}
            required
            error={state.fieldErrors?.color}
          />

          <TextField
            name="purchaseUrl"
            label="Ссылка на товар (необязательно)"
            hint="Появится в кнопке «Купить», когда остаток упадёт ниже порога."
            placeholder="https://example.com/filament"
            maxLength={FILAMENT_TEXT_LIMITS.purchaseUrl}
            type="url"
            error={state.fieldErrors?.purchaseUrl}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            {FILAMENT_NUMBER_FIELDS.map((field) => {
              const fieldId = `filament-${field.key}`;
              const error = state.fieldErrors?.[field.key];

              return (
                <div key={field.key}>
                  <label
                    htmlFor={fieldId}
                    className="block text-sm font-semibold text-slate-200"
                  >
                    {field.label}
                  </label>
                  <input
                    id={fieldId}
                    name={field.formName}
                    type="number"
                    autoComplete="off"
                    inputMode="numeric"
                    step={field.step}
                    min={field.min}
                    max={field.max}
                    required
                    defaultValue={DEFAULT_NUMBERS[field.key]}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={
                      error ? `${fieldId}-error` : `${fieldId}-hint`
                    }
                    className={inputClassName}
                  />
                  {error ? (
                    <p
                      id={`${fieldId}-error`}
                      role="alert"
                      className="mt-1.5 text-sm text-red-300"
                    >
                      {error}
                    </p>
                  ) : (
                    <p
                      id={`${fieldId}-hint`}
                      className="mt-1.5 text-xs leading-relaxed text-slate-400"
                    >
                      {field.hint}
                    </p>
                  )}
                </div>
              );
            })}
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
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Добавляем…" : "Добавить катушку"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-6 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Текстовое поле с подсказкой или ошибкой под ним. */
function TextField({
  name,
  label,
  hint,
  placeholder,
  maxLength,
  type = "text",
  list,
  required,
  autoFocus,
  error,
}: {
  name: FilamentTextKey;
  label: string;
  hint: string;
  placeholder: string;
  maxLength: number;
  type?: "text" | "url";
  list?: string;
  required?: boolean;
  autoFocus?: boolean;
  error?: string;
}) {
  const fieldId = `filament-${name}`;

  return (
    <div>
      <label
        htmlFor={fieldId}
        className="block text-sm font-semibold text-slate-200"
      >
        {label}
      </label>
      <input
        id={fieldId}
        name={name}
        type={type}
        autoComplete="new-password"
        list={list}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : `${fieldId}-hint`}
        className={inputClassName}
      />
      {error ? (
        <p
          id={`${fieldId}-error`}
          role="alert"
          className="mt-1.5 text-sm text-red-300"
        >
          {error}
        </p>
      ) : (
        <p
          id={`${fieldId}-hint`}
          className="mt-1.5 text-xs leading-relaxed text-slate-400"
        >
          {hint}
        </p>
      )}
    </div>
  );
}
