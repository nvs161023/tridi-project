"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import { parseGcode } from "@/lib/gcode-parser";
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

/** Сообщение под кнопкой загрузки G-code: тон задаёт цвет. */
type GcodeMessage = {
  tone: "success" | "warning" | "error";
  text: string;
};

/**
 * Предел размера файла: 50 МБ. Читать больше — значит держать в памяти
 * текст, который всё равно нужен только ради заголовка, и подвешивать вкладку
 * на слабом ноутбуке.
 */
const MAX_GCODE_BYTES = 50 * 1024 * 1024;

/** Числа из G-code для сообщения: «1,1», «12,3». */
const gcodeNumberFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
});

/** Цвет строки состояния под кнопкой загрузки G-code. */
const GCODE_TONE_CLASSES = {
  success: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
  warning: "border-amber-400/40 bg-amber-500/10 text-amber-100",
  error: "border-red-400/40 bg-red-500/10 text-red-100",
} as const;

export function CostCalculator({ settings }: CostCalculatorProps) {
  const [values, setValues] =
    useState<Record<CalculatorFieldKey, string>>(INITIAL_VALUES);
  const [errors, setErrors] = useState<
    Partial<Record<CalculatorFieldKey, string>>
  >({});
  const [input, setInput] = useState<CalculatorInput | null>(null);
  const [gcodeMessage, setGcodeMessage] = useState<GcodeMessage | null>(null);
  const [isReadingGcode, setIsReadingGcode] = useState(false);

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

  /**
   * Загрузка G-code: вес и время берём из комментариев слайсера.
   *
   * Файл читается в браузере и никуда не отправляется. Поле выбора очищается
   * сразу после чтения — иначе повторный выбор того же файла не вызовет
   * onChange, и человек решит, что кнопка не работает.
   *
   * Старый расчёт убирается: он посчитан по прежним числам, и оставлять его на
   * экране рядом с новыми полями — значит показывать неверную себестоимость.
   */
  async function handleGcodeChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    if (file.size > MAX_GCODE_BYTES) {
      setGcodeMessage({
        tone: "error",
        text: "Файл больше 50 МБ. Сохраните его заново или впишите вес и время вручную.",
      });
      return;
    }

    setIsReadingGcode(true);
    setGcodeMessage(null);

    try {
      const estimate = parseGcode(await file.text());
      const nextValues = { ...values };

      if (estimate.weightGrams !== null) {
        nextValues.weightGrams = String(estimate.weightGrams);
      }

      if (estimate.timeHours !== null) {
        nextValues.printHours = String(estimate.timeHours);
      }

      setValues(nextValues);
      setErrors({});
      setInput(null);

      if (estimate.weightGrams !== null && estimate.timeHours !== null) {
        setGcodeMessage({
          tone: "success",
          text: `Из файла: вес ${gcodeNumberFormatter.format(estimate.weightGrams)} г, время ${gcodeNumberFormatter.format(estimate.timeHours)} ч. Проверьте и нажмите «Рассчитать».`,
        });
        return;
      }

      if (estimate.weightGrams !== null) {
        setGcodeMessage({
          tone: "warning",
          text: `Из файла взяли вес ${gcodeNumberFormatter.format(estimate.weightGrams)} г — время печати в комментариях не нашлось.`,
        });
        return;
      }

      if (estimate.timeHours !== null) {
        setGcodeMessage({
          tone: "warning",
          text: `Из файла взяли время ${gcodeNumberFormatter.format(estimate.timeHours)} ч — вес пластика в комментариях не нашёлся.`,
        });
        return;
      }

      setGcodeMessage({
        tone: "warning",
        text: "В файле не нашлось ни времени печати, ни веса пластика. Заполните поля вручную — или сохраните G-code с комментариями слайсера.",
      });
    } catch {
      setGcodeMessage({
        tone: "error",
        text: "Не удалось прочитать файл. Попробуйте другой G-code.",
      });
    } finally {
      setIsReadingGcode(false);
    }
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
        Вес и время печати подставит G-code из слайсера — или впишите их вручную.
        Настройки слева идут в электричество, амортизацию и работу.
      </p>

      <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-4">
        <label
          htmlFor="calculator-gcode"
          className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-full border border-blue-400/40 bg-blue-500/10 px-4 text-sm font-semibold text-blue-100 transition-colors hover:bg-blue-500/20 focus-within:ring-2 focus-within:ring-blue-400 focus-within:ring-offset-2 focus-within:ring-offset-slate-950"
        >
          <span aria-hidden>📄</span>
          {isReadingGcode ? "Читаем файл…" : "Загрузить G-code"}
          <input
            id="calculator-gcode"
            type="file"
            accept=".gcode,.gco,.g"
            onChange={handleGcodeChange}
            disabled={isReadingGcode}
            className="sr-only"
          />
        </label>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          Файл из слайсера: вес модели и время печати подставим из комментариев.
          Разбор идёт в браузере — файл никуда не загружается.
        </p>
        {gcodeMessage ? (
          <p
            role="status"
            className={`mt-2 rounded-xl border px-3 py-2 text-xs leading-relaxed ${GCODE_TONE_CLASSES[gcodeMessage.tone]}`}
          >
            {gcodeMessage.text}
          </p>
        ) : null}
      </div>

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
