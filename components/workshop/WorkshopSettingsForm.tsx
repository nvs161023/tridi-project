"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { saveWorkshopSettings } from "@/app/actions/workshop";
import { emptyWorkshopSettingsFormState } from "@/app/actions/workshop-state";
import {
  WORKSHOP_FIELDS,
  type WorkshopSettings,
} from "@/lib/workshop/settings";

/**
 * Форма настроек калькулятора.
 *
 * Поля выводятся из WORKSHOP_FIELDS: подпись, пределы и колонка в базе описаны
 * один раз в lib/workshop/settings.ts, а здесь только разметка. Поэтому новое
 * поле не требует правок в трёх местах.
 *
 * Состояние живёт выше (вкладка «Калькулятор»): после успешного сохранения
 * форма отдаёт значения наверх, и калькулятор сразу считает по новым числам.
 * router.refresh() нужен для серверной части — при следующем переходе страница
 * покажет сохранённые настройки, а не закэшированные.
 */

type WorkshopSettingsFormProps = {
  settings: WorkshopSettings;
  onSaved: (settings: WorkshopSettings) => void;
};

const inputClassName =
  "w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white outline-none transition-all duration-200 [appearance:textfield] placeholder:text-zinc-500 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30 focus:ring-inset [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

export function WorkshopSettingsForm({
  settings,
  onSaved,
}: WorkshopSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(
    saveWorkshopSettings,
    emptyWorkshopSettingsFormState,
  );
  const router = useRouter();

  // Состояние приходит новым объектом после каждой отправки: на успех
  // обновляем настройки калькулятора и серверные данные страницы.
  useEffect(() => {
    if (state.success && state.values) {
      onSaved(state.values);
      router.refresh();
    }
  }, [state, onSaved, router]);

  return (
    <section aria-labelledby="workshop-settings-title">
      <p className="text-xs font-semibold tracking-[0.16em] text-blue-300 uppercase">
        Настройки
      </p>
      <h2
        id="workshop-settings-title"
        className="mt-2 text-xl font-extrabold tracking-tight text-white"
      >
        Параметры мастерской
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        Четыре числа, по которым считается себестоимость. Их можно менять в
        любой момент — расчёт пересчитается по сохранённым значениям.
      </p>

      <form action={formAction} className="mt-6 grid gap-4">
        {WORKSHOP_FIELDS.map((field) => {
          const fieldId = `workshop-${field.key}`;
          const error = state.fieldErrors?.[field.key];

          return (
            <div key={field.key}>
              <label
                htmlFor={fieldId}
                className="block text-sm font-semibold text-zinc-200"
              >
                {field.label}
              </label>
              <input
                id={fieldId}
                name={field.formName}
                type="number"
                inputMode="decimal"
                step={field.step}
                min={field.min}
                max={field.max}
                required
                defaultValue={settings[field.key]}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${fieldId}-error` : `${fieldId}-hint`}
                className={`mt-2 ${inputClassName}`}
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
                  className="mt-1.5 text-xs leading-relaxed text-zinc-500"
                >
                  {field.hint}
                </p>
              )}
            </div>
          );
        })}

        <div className="pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Сохраняем…" : "Сохранить настройки"}
          </button>

          <p aria-live="polite" className="mt-3 min-h-5 text-sm">
            {state.error ? (
              <span className="text-red-300">{state.error}</span>
            ) : null}
            {state.success && !state.error ? (
              <span className="text-emerald-300">
                Настройки сохранены — калькулятор считает по новым числам.
              </span>
            ) : null}
          </p>
        </div>
      </form>
    </section>
  );
}
