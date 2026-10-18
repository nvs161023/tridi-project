"use client";

import { useId } from "react";

type NumberSliderProps = {
  /** Подпись параметра, она же label для range-инпута. */
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Единица измерения в подписи значения: «мм». */
  unit: string;
  /** Сколько знаков после запятой показывать. */
  decimals?: number;
  /** Пояснение под слайдером: зачем параметр и на что влияет. */
  hint?: string;
  onChange: (value: number) => void;
};

/**
 * Слайдер размера с подписью и текущим значением.
 *
 * Используется нативный input[type=range]: он работает с клавиатуры,
 * озвучивается скринридерами и не требует собственной логики перетаскивания.
 * Значение показываем через <output>, связанный с полем, — так скринридер
 * прочитает его вместе с подписью.
 */
export function NumberSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  decimals = 0,
  hint,
  onChange,
}: NumberSliderProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const formattedValue = value.toFixed(decimals);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium text-slate-200" htmlFor={id}>
          {label}
        </label>
        <output
          className="rounded-full border border-white/10 bg-slate-950/60 px-2.5 py-1 text-sm font-semibold tabular-nums text-white"
          htmlFor={id}
        >
          {formattedValue} {unit}
        </output>
      </div>

      <input
        aria-describedby={hint ? hintId : undefined}
        className="mt-3 w-full cursor-pointer accent-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        id={id}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />

      {hint ? (
        <p className="mt-2 text-xs leading-relaxed text-slate-500" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
