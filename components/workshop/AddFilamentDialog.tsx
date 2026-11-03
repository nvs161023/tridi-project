"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { addFilament, updateFilament } from "@/app/actions/filaments";
import {
  type FilamentFormState,
  emptyFilamentFormState,
} from "@/app/actions/filaments-state";
import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";
import {
  FILAMENT_BRANDS,
  FILAMENT_DEFAULTS,
  FILAMENT_NUMBER_FIELDS,
  FILAMENT_TEXT_LIMITS,
  FILAMENT_TYPE_SUGGESTIONS,
  FILAMENT_USAGE_TYPES,
  FILAMENT_USAGE_TYPE_LABELS,
  type FilamentNumberKey,
  type FilamentTextKey,
  type WorkshopFilament,
} from "@/lib/workshop/filaments";

/**
 * Окно «Добавить катушку» и «Редактировать катушку».
 *
 * Поля повторяют колонки workshop_filaments. Проверки живут в
 * lib/workshop/filaments.ts, здесь только разметка и ошибки, которые вернул
 * Server Action: одни и те же пределы работают и до отправки (атрибуты min/max),
 * и после (ответ сервера).
 *
 * Режим выбирает проп `initial`: без него форма вызывает `addFilament`, с ним —
 * `updateFilament` и заполняет поля текущими значениями (`defaultValue`). Разбор
 * формы общий, поэтому правка тоже не пропустит пустой бренд, ссылку без
 * http(s) или остаток больше общего веса.
 *
 * После успеха окно закрывается, склад обновляется через router.refresh(), а на
 * вкладке остаётся строка состояния: список рисуется на сервере, и без refresh
 * правка была бы видна только после ручной перезагрузки.
 */

type AddFilamentDialogProps = {
  /**
   * Катушка для правки.
   *
   * Без пропа окно добавляет новую, с ним — исправляет бренд, остаток, цену или
   * ссылку: мастер ошибся при вводе, а удалять катушку и заводить её заново
   * незачем.
   */
  initial?: WorkshopFilament | null;
  onClose: () => void;
  /** Сообщение для строки состояния на вкладке. */
  onCreated: (message: string) => void;
};

const inputClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white outline-none transition-all duration-200 [appearance:textfield] placeholder:text-zinc-500 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30 focus:ring-inset [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

/**
 * Список в том же CRM-стиле, что и поля ввода, но без правил для `input`:
 * `appearance: textfield` и спиннеры числовых полей здесь не нужны, а
 * `color-scheme: dark` красит нативную стрелку под тёмную панель.
 */
const selectClassName =
  "mt-2 w-full cursor-pointer rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white outline-none transition-all duration-200 [color-scheme:dark] focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30 focus:ring-inset";

/** Стартовые значения числовых полей: типовая катушка 1 кг. */
const DEFAULT_NUMBERS: Record<FilamentNumberKey, number> = {
  totalWeightG: FILAMENT_DEFAULTS.totalWeightG,
  remainingWeightG: FILAMENT_DEFAULTS.totalWeightG,
  pricePerKg: FILAMENT_DEFAULTS.pricePerKg,
  minThresholdG: FILAMENT_DEFAULTS.minThresholdG,
};

export function AddFilamentDialog({
  initial = null,
  onClose,
  onCreated,
}: AddFilamentDialogProps) {
  const router = useRouter();
  const [state, setState] = useState<FilamentFormState>(emptyFilamentFormState);
  const [isPending, setIsPending] = useState(false);

  const isEditing = initial !== null;
  /** Надписи кнопки: в правке «Сохранить», в добавлении — прежняя. */
  const submitLabel = isEditing ? "Сохранить" : "Добавить катушку";
  const pendingLabel = isEditing ? "Сохраняем…" : "Добавляем…";

  useDialogDismiss(onClose);

  /**
   * Отправка формы в Server Action.
   *
   * FormData собираем до await: после него event.currentTarget уже обнулён.
   * Ответ либо подтверждает сохранение (тогда обновляем серверный список,
   * показываем сообщение на вкладке и закрываем окно), либо возвращает ошибки
   * по полям — они остаются под теми же полями, что и при добавлении.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPending) {
      return;
    }

    const formData = new FormData(event.currentTarget);

    setState(emptyFilamentFormState);
    setIsPending(true);

    try {
      const result = isEditing
        ? await updateFilament(initial.id, formData)
        : await addFilament(emptyFilamentFormState, formData);

      if (result.error || result.fieldErrors) {
        setState({ error: result.error, fieldErrors: result.fieldErrors });
        return;
      }

      router.refresh();
      onCreated(
        result.message ??
          (isEditing ? "Катушка сохранена." : "Катушка добавлена."),
      );
      onClose();
    } catch {
      setState({
        error:
          "Не удалось отправить форму. Проверьте соединение и попробуйте ещё раз.",
      });
    } finally {
      setIsPending(false);
    }
  }

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
              {isEditing ? "Редактировать катушку" : "Добавить катушку"}
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
              {isEditing
                ? "Поправьте остаток, цену или ссылку — заказы, где катушка уже списана, не изменятся."
                : "Заполните карточку катушки: остаток и порог сразу покажут, когда пора покупать пластик."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно катушки"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-lg text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          autoComplete="off"
          className="mt-6 space-y-4"
        >
          <TextField
            name="brand"
            label="Бренд"
            hint="Начните вводить — подскажем популярные. Свой бренд тоже можно."
            placeholder="Prusament"
            maxLength={FILAMENT_TEXT_LIMITS.brand}
            defaultValue={initial?.brand ?? ""}
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
            hint="Материал: PLA, PETG, ABS, TPU… Свой тип тоже можно."
            placeholder="PLA"
            maxLength={FILAMENT_TEXT_LIMITS.type}
            defaultValue={initial?.type ?? ""}
            required
            list="filament-types-list"
            error={state.fieldErrors?.type}
          />
          <datalist id="filament-types-list">
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
            defaultValue={initial?.color ?? ""}
            required
            error={state.fieldErrors?.color}
          />

          {/*
            Единственный список в окне: тип позиции — это выбор из двух
            значений, а не свободный текст. Имя `usageType` совпадает с
            readFilamentForm, поэтому сервер получает его тем же FormData;
            по умолчанию выбран складской — как default 'stock' в миграции.
          */}
          <div>
            <label
              htmlFor="filament-usageType"
              className="block text-sm font-semibold text-slate-200"
            >
              Тип позиции
            </label>
            <select
              id="filament-usageType"
              name="usageType"
              autoComplete="off"
              defaultValue={initial?.usageType ?? "stock"}
              aria-describedby="filament-usageType-hint"
              className={selectClassName}
            >
              {FILAMENT_USAGE_TYPES.map((usageType) => (
                <option key={usageType} value={usageType}>
                  {FILAMENT_USAGE_TYPE_LABELS[usageType]}
                </option>
              ))}
            </select>
            <p
              id="filament-usageType-hint"
              className="mt-1.5 text-xs leading-relaxed text-slate-400"
            >
              Складской пополняется всегда, заказной покупается под конкретную
              задачу.
            </p>
          </div>

          <TextField
            name="purchaseUrl"
            label="Ссылка на товар (необязательно)"
            hint="Появится в кнопке «Купить», когда остаток упадёт ниже порога."
            placeholder="https://example.com/filament"
            maxLength={FILAMENT_TEXT_LIMITS.purchaseUrl}
            defaultValue={initial?.purchaseUrl ?? ""}
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
                    defaultValue={
                      initial ? initial[field.key] : DEFAULT_NUMBERS[field.key]
                    }
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
              {isPending ? pendingLabel : submitLabel}
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
  defaultValue,
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
  /** Текущее значение при правке; у новой катушки поле пустое. */
  defaultValue?: string;
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
        autoComplete="off"
        list={list}
        placeholder={placeholder}
        maxLength={maxLength}
        defaultValue={defaultValue}
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
