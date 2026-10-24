"use client";

import { useMemo, useState, type FormEvent } from "react";

import {
  CALCULATOR_FIELDS,
  WORKSHOP_MARKUP,
  WORKSHOP_MARKUP_PERCENT,
  calculateWorkshopCost,
  formatMoney,
  readCalculatorInput,
  type CalculatorFieldKey,
  type CalculatorInput,
} from "@/lib/workshop/calculator";
import type { WorkshopSettings } from "@/lib/workshop/settings";

/**
 * Калькулятор себестоимости заказа.
 *
 * Расчёт появляется только после нажатия «Рассчитать»: так пользователь видит
 * итог по тем числам, которые сам подтвердил, а не мигающие значения на каждый
 * символ. Как только поле меняется, старый результат убирается — иначе его
 * легко принять за расчёт по новым данным.
 *
 * Сами формулы лежат в lib/workshop/calculator.ts: этот компонент отвечает
 * только за поля, ошибки и показ разбивки.
 */

type CostCalculatorProps = {
  settings: WorkshopSettings;
};

const inputClassName =
  "mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-base text-white outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40";

/**
 * Стартовые значения: цена пластика подставлена типичная, вес и время пустые —
 * их нужно взять из слайсера для конкретной модели.
 */
const INITIAL_VALUES = Object.fromEntries(
  CALCULATOR_FIELDS.map((field) => [
    field.key,
    field.key === "plasticPricePerKg" ? field.placeholder : "",
  ]),
) as Record<CalculatorFieldKey, string>;

export function CostCalculator({ settings }: CostCalculatorProps) {
  const [values, setValues] =
    useState<Record<CalculatorFieldKey, string>>(INITIAL_VALUES);
  const [errors, setErrors] = useState<
    Partial<Record<CalculatorFieldKey, string>>
  >({});
  const [input, setInput] = useState<CalculatorInput | null>(null);

  // Настройки могли только что сохранить: пересчитываем по ним же, без
  // повторного нажатия «Рассчитать».
  const breakdown = useMemo(
    () => (input ? calculateWorkshopCost(settings, input) : null),
    [input, settings],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = readCalculatorInput(values);
    setErrors(parsed.errors);
    setInput(parsed.input);
  }

  function handleChange(key: CalculatorFieldKey, value: string) {
    setValues((previous) => ({ ...previous, [key]: value }));
    setInput(null);
  }

  return (
    <section
      aria-labelledby="workshop-calculator-title"
      className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md sm:p-7"
    >
      <p className="text-xs font-semibold tracking-[0.16em] text-blue-300 uppercase">
        Расчёт
      </p>
      <h2
        id="workshop-calculator-title"
        className="mt-2 text-xl font-extrabold tracking-tight text-white"
      >
        Себестоимость заказа
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">
        Вес и время печати возьмите из слайсера. Настройки слева подставляются в
        электричество, амортизацию и работу.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-5 grid gap-4">
        {CALCULATOR_FIELDS.map((field) => {
          const fieldId = `calculator-${field.key}`;
          const error = errors[field.key];

          return (
            <div key={field.key}>
              <label
                htmlFor={fieldId}
                className="flex items-baseline justify-between gap-2 text-sm font-semibold text-slate-200"
              >
                <span>{field.label}</span>
                <span className="text-xs font-normal text-slate-400">
                  {field.unit}
                </span>
              </label>
              <input
                id={fieldId}
                name={field.key}
                type="number"
                inputMode="decimal"
                step={field.step}
                min={field.min}
                max={field.max}
                value={values[field.key]}
                onChange={(event) => handleChange(field.key, event.target.value)}
                placeholder={field.placeholder}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${fieldId}-error` : undefined}
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
              ) : null}
            </div>
          );
        })}

        <button
          type="submit"
          className="mt-1 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          Рассчитать
        </button>
      </form>

      {breakdown ? (
        <div className="mt-6" aria-live="polite">
          <dl className="grid gap-3 sm:grid-cols-3">
            <ResultCard
              label="Себестоимость"
              value={formatMoney(breakdown.costPrice)}
              hint="материал, электричество, износ и работа"
              tone="neutral"
            />
            <ResultCard
              label="Рекомендуемая цена"
              value={formatMoney(breakdown.recommendedPrice)}
              hint={`себестоимость × ${WORKSHOP_MARKUP}`}
              tone="price"
            />
            <ResultCard
              label="Прибыль"
              value={formatMoney(breakdown.profit)}
              hint={`наценка ${WORKSHOP_MARKUP_PERCENT} %`}
              tone="profit"
            />
          </dl>

          <ul className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-1">
            {[
              { label: "Материал", value: breakdown.material },
              { label: "Электричество", value: breakdown.electricity },
              { label: "Амортизация", value: breakdown.depreciation },
              { label: "Работа", value: breakdown.labor },
            ].map((row) => (
              <li
                key={row.label}
                className="flex items-center justify-between gap-3 border-b border-white/5 py-2.5 text-sm last:border-b-0"
              >
                <span className="text-slate-300">{row.label}</span>
                <span className="font-semibold tabular-nums text-white">
                  {formatMoney(row.value)}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-xs leading-relaxed text-slate-400">
            Материал — вес × цену за килограмм, электричество — мощность × часы ×
            тариф. Рекомендуемая цена считается как себестоимость ×{" "}
            {WORKSHOP_MARKUP}: это наценка {WORKSHOP_MARKUP_PERCENT} %, из которой
            ещё платятся комиссии и доставка.
          </p>
        </div>
      ) : (
        <p className="mt-6 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-5 text-sm leading-relaxed text-slate-300">
          Заполните поля и нажмите «Рассчитать» — покажем себестоимость,
          рекомендуемую цену и прибыль.
        </p>
      )}
    </section>
  );
}

/** Крупная цифра результата: цвет подсказывает, доход это или расход. */
function ResultCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "neutral" | "price" | "profit";
}) {
  const toneClassName = {
    neutral: "border-white/10 bg-slate-950/40 text-white",
    price: "border-blue-400/30 bg-blue-500/10 text-blue-100",
    profit: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
  }[tone];

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClassName}`}>
      <dt className="text-xs font-semibold tracking-wide text-slate-300 uppercase">
        {label}
      </dt>
      <dd>
        <span className="mt-1 block text-xl font-extrabold tabular-nums">
          {value}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-slate-400">
          {hint}
        </span>
      </dd>
    </div>
  );
}
