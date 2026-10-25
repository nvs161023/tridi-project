"use client";

import {
  useMemo,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";

import { CalculatorIcon, UploadIcon } from "@/components/workshop/WorkshopIcons";
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
  "mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 pr-10 text-base text-white outline-none transition-all duration-200 [appearance:textfield] placeholder:text-zinc-500 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30 focus:ring-inset [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

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

/** Расширения, которые принимает и выбор файла, и drag-and-drop. */
const GCODE_EXTENSIONS = [".gcode", ".gco", ".g"] as const;

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
  const [isDraggingFile, setIsDraggingFile] = useState(false);

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

    if (file) {
      await readGcodeFile(file);
    }
  }

  /**
   * Общий путь для выбора файла и drag-and-drop.
   *
   * Расширение проверяем и здесь: `accept` ограничивает только диалог выбора,
   * а бросить в окно можно любой файл. Смысл подсказки «.gcode» не должен
   * расходиться с тем, что реально принимает калькулятор.
   */
  async function readGcodeFile(file: File) {
    if (isReadingGcode) {
      return;
    }

    const name = file.name.toLowerCase();

    if (!GCODE_EXTENSIONS.some((extension) => name.endsWith(extension))) {
      setGcodeMessage({
        tone: "error",
        text: "Нужен файл .gcode, .gco или .g — вес и время печати читаются из комментариев слайсера.",
      });
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

  /** Файл тащат над зоной: подсвечиваем её и разрешаем drop. */
  function handleGcodeDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDraggingFile(true);
  }

  /** Уход на дочерний элемент не должен гасить подсветку зоны. */
  function handleGcodeDragLeave(event: DragEvent<HTMLLabelElement>) {
    const nextTarget = event.relatedTarget;

    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }

    setIsDraggingFile(false);
  }

  function handleGcodeDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDraggingFile(false);

    const file = event.dataTransfer.files?.[0];

    if (file) {
      void readGcodeFile(file);
    }
  }

  return (
    <section aria-labelledby="workshop-calculator-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-blue-300 uppercase">
            Расчёт
          </p>
          <h2
            id="workshop-calculator-title"
            className="mt-2 text-xl font-extrabold tracking-tight text-white"
          >
            Себестоимость заказа
          </h2>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] font-semibold text-zinc-300">
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]"
          />
          G-code → поля
        </span>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
        Вес и время печати подставит G-code из слайсера — или впишите их вручную.
        Настройки мастерской идут в электричество, амортизацию и работу.
      </p>

      <label
        htmlFor="calculator-gcode"
        data-calculator-dropzone
        onDragOver={handleGcodeDragOver}
        onDragLeave={handleGcodeDragLeave}
        onDrop={handleGcodeDrop}
        className={`mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-7 text-center transition-all duration-200 focus-within:border-blue-400/70 focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:ring-inset ${
          isDraggingFile
            ? "border-blue-400/70 bg-blue-500/10"
            : "border-white/15 bg-black/25 hover:border-white/25 hover:bg-white/[0.04]"
        }`}
      >
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-colors ${
            isDraggingFile
              ? "border-blue-400/50 bg-blue-500/20 text-blue-100"
              : "border-white/10 bg-white/5 text-zinc-300"
          }`}
        >
          <UploadIcon className="h-5 w-5" />
        </span>
        <span className="mt-3 text-sm font-semibold text-white">
          {isReadingGcode
            ? "Читаем файл…"
            : "Перетащите .gcode сюда или нажмите, чтобы выбрать файл"}
        </span>
        <span className="mt-1 text-xs leading-relaxed text-zinc-500">
          Вес модели и время печати возьмём из комментариев слайсера. Файл
          остаётся в браузере.
        </span>
        <input
          id="calculator-gcode"
          type="file"
          autoComplete="off"
          accept={GCODE_EXTENSIONS.join(",")}
          onChange={handleGcodeChange}
          disabled={isReadingGcode}
          className="sr-only"
        />
      </label>
      {gcodeMessage ? (
        <p
          role="status"
          className={`mt-3 rounded-xl border px-3 py-2 text-xs leading-relaxed ${GCODE_TONE_CLASSES[gcodeMessage.tone]}`}
        >
          {gcodeMessage.text}
        </p>
      ) : null}

      <form
        onSubmit={handleSubmit}
        noValidate
        autoComplete="off"
        className="mt-6"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {CALCULATOR_FIELDS.map((field) => {
            const fieldId = `calculator-${field.key}`;
            const error = errors[field.key];

            return (
              <div key={field.key}>
                <label
                  htmlFor={fieldId}
                  className="block text-sm font-semibold text-zinc-200"
                >
                  {field.label}
                  <span className="sr-only">, {field.unit}</span>
                </label>
                <div className="relative">
                  <input
                    id={fieldId}
                    name={field.key}
                    type="number"
                    autoComplete="off"
                    inputMode="decimal"
                    step={field.step}
                    min={field.min}
                    max={field.max}
                    value={values[field.key]}
                    onChange={(event) =>
                      handleChange(field.key, event.target.value)
                    }
                    placeholder={field.placeholder}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${fieldId}-error` : undefined}
                    className={inputClassName}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-xs font-medium text-zinc-500">
                    {field.unit}
                  </span>
                </div>
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
        </div>

        <button
          type="submit"
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
        >
          Рассчитать
        </button>
      </form>

      {breakdown ? (
        <div className="mt-6" aria-live="polite" data-calculator-result>
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-blue-500/10 via-violet-500/10 to-fuchsia-500/10 p-5 sm:p-6">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-20 -right-16 h-48 w-48 rounded-full bg-blue-500/15 blur-3xl"
            />
            <div className="relative">
              <p className="text-xs font-semibold tracking-[0.16em] text-blue-200/80 uppercase">
                Рекомендуемая цена
              </p>
              <p className="mt-2 text-4xl font-extrabold leading-none tracking-tight break-words text-emerald-100 tabular-nums">
                {formatMoney(breakdown.recommendedPrice)}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                себестоимость × {WORKSHOP_MARKUP} · наценка{" "}
                {WORKSHOP_MARKUP_PERCENT} %
              </p>

              <dl className="mt-6 grid gap-x-8 gap-y-3 border-t border-white/10 pt-5 sm:grid-cols-2">
                <ResultLine
                  label="Себестоимость"
                  value={formatMoney(breakdown.costPrice)}
                />
                <ResultLine
                  label="Прибыль"
                  value={formatMoney(breakdown.profit)}
                  tone="profit"
                />
                <ResultLine
                  label="Материал"
                  value={formatMoney(breakdown.material)}
                />
                <ResultLine
                  label="Работа"
                  value={formatMoney(breakdown.labor)}
                />
              </dl>

              <p className="mt-4 text-[11px] leading-relaxed text-zinc-400">
                В себестоимость также входят электричество —{" "}
                {formatMoney(breakdown.electricity)} и амортизация —{" "}
                {formatMoney(breakdown.depreciation)}.
              </p>
            </div>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-zinc-500">
            Материал — вес × цену за килограмм, электричество — мощность × часы ×
            тариф. Рекомендуемая цена считается как себестоимость ×{" "}
            {WORKSHOP_MARKUP}: это наценка {WORKSHOP_MARKUP_PERCENT} %, из которой
            ещё платятся комиссии и доставка.
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-black/20 px-5 py-8 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400">
            <CalculatorIcon className="h-5 w-5" />
          </span>
          <p className="mt-3 text-sm font-semibold text-zinc-300">
            Результат появится здесь
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-zinc-500">
            Заполните поля и нажмите «Рассчитать» — покажем себестоимость,
            рекомендуемую цену и прибыль.
          </p>
        </div>
      )}
    </section>
  );
}

/** Строка разбивки: подпись слева, деньги справа. */
function ResultLine({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "profit";
}) {
  const valueClassName =
    tone === "profit" ? "text-emerald-200" : "text-white";

  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-xs text-zinc-400">{label}</dt>
      <dd
        className={`text-sm font-bold break-words tabular-nums ${valueClassName}`}
      >
        {value}
      </dd>
    </div>
  );
}
