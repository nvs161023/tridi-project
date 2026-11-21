"use client";

import { useEffect, useId, useState } from "react";

import { ParamHint } from "@/components/constructor/ParamHint";

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
  /** Пояснение: зачем параметр и на что влияет. */
  hint?: string;
  onChange: (value: number) => void;
};

/** Ограничение значения границами слайдера. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Округление до шага ввода без хвостов плавающей точки. */
function roundToStep(value: number, step: number): number {
  if (!Number.isFinite(step) || step <= 0) {
    return value;
  }

  return Number((Math.round(value / step) * step).toFixed(6));
}

/**
 * Слайдер размера с точным вводом и кнопками шага.
 *
 * Раньше значение можно было только перетащить: попасть мышью в 137 мм при
 * диапазоне 60–300 было почти невозможно, а на телефоне палец закрывал
 * ползунок. Теперь рядом стоит число с единицей измерения, его можно набрать
 * руками, а кнопки «−» и «+» двигают значение ровно на шаг. Нативный range
 * остался для быстрой подстройки, клавиатуры и скринридеров.
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
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const format = (next: number) => next.toFixed(decimals);
  const [draft, setDraft] = useState(() => format(value));
  const [editing, setEditing] = useState(false);

  /*
    Пока поле в фокусе, черновик не перезаписываем: иначе «1.» превращалось бы
    в «1.0» на каждом нажатии, и десятичную часть нельзя было бы набрать.
  */
  useEffect(() => {
    if (!editing) {
      setDraft(value.toFixed(decimals));
    }
  }, [decimals, editing, value]);

  const commit = (next: string) => {
    setDraft(next);
    const parsed = Number(next.replace(",", "."));

    if (next.trim() === "" || !Number.isFinite(parsed)) {
      return;
    }

    onChange(clamp(parsed, min, max));
  };

  const normalize = () => {
    setEditing(false);
    const parsed = Number(draft.replace(",", "."));
    const next = Number.isFinite(parsed) ? clamp(parsed, min, max) : value;
    onChange(next);
    setDraft(format(next));
  };

  const nudge = (direction: number) => {
    const next = clamp(roundToStep(value + direction * step, step), min, max);
    onChange(next);
    setDraft(format(next));
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5 pt-1.5" id={labelId}>
          <span className="text-sm font-medium text-slate-200">{label}</span>
          {hint ? <ParamHint id={hintId} label={label} text={hint} /> : null}
        </span>

        <div className="flex shrink-0 items-center gap-1">
          <button
            aria-label={`Уменьшить: ${label}`}
            className="grid size-9 place-items-center rounded-xl border border-white/10 bg-slate-950/50 text-base font-semibold text-slate-300 transition-colors hover:border-white/25 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={value <= min}
            onClick={() => nudge(-1)}
            type="button"
          >
            <span aria-hidden>−</span>
          </button>

          <span className="relative">
            <input
              aria-describedby={hint ? hintId : undefined}
              aria-labelledby={labelId}
              className="h-9 w-[5.4rem] rounded-xl border border-white/10 bg-slate-950/60 pr-8 pl-2.5 text-right text-sm font-semibold tabular-nums text-white transition-colors [appearance:textfield] focus-visible:border-blue-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              inputMode="decimal"
              max={max}
              min={min}
              onBlur={normalize}
              onChange={(event) => commit(event.target.value)}
              onFocus={() => setEditing(true)}
              step={step}
              type="number"
              value={draft}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[0.65rem] font-medium text-slate-400"
            >
              {unit}
            </span>
          </span>

          <button
            aria-label={`Увеличить: ${label}`}
            className="grid size-9 place-items-center rounded-xl border border-white/10 bg-slate-950/50 text-base font-semibold text-slate-300 transition-colors hover:border-white/25 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={value >= max}
            onClick={() => nudge(1)}
            type="button"
          >
            <span aria-hidden>+</span>
          </button>
        </div>
      </div>

      <input
        aria-describedby={hint ? hintId : undefined}
        aria-labelledby={labelId}
        aria-valuetext={`${format(value)} ${unit}`}
        className="mt-3 h-1.5 w-full cursor-pointer accent-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
    </div>
  );
}
