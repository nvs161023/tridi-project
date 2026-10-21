"use client";

import { useId } from "react";

/** Вариант списка: значение параметра и его подпись в панели. */
type SelectOption<T extends string | number> = {
  /** Значение, которое уйдёт в обработчик: форма, узор или число. */
  value: T;
  /** Текст пункта: то, что видит пользователь. */
  label: string;
};

type ParameterSelectProps<T extends string | number> = {
  /** Подпись параметра, она же label для поля. */
  label: string;
  /** Текущее значение; в DOM оно уходит строкой. */
  value: T;
  /** Все допустимые значения: порядок массива задаёт порядок пунктов. */
  options: readonly SelectOption<T>[];
  /** Пояснение под списком: зачем параметр и на что влияет. */
  hint?: string;
  onChange: (value: T) => void;
};

/**
 * Выпадающий список параметра.
 *
 * Нативный select вместо набора кнопок: у брелока пятнадцать силуэтов, и сетка
 * кнопок занимала пол-экрана, а выбранное значение приходилось искать глазами.
 * Список работает с клавиатуры и озвучивается скринридерами. `[color-scheme:dark]`
 * нужен, чтобы браузер не нарисовал белый выпадающий список внутри тёмной панели.
 *
 * Значения бывают строковые (форма, узор, шрифт) и числовые (канал ленты).
 * Сравнение идёт по строковому представлению, а наружу возвращается исходное
 * значение из `options`: панель не делает `Number()` и приведений типов.
 */
export function ParameterSelect<T extends string | number>({
  label,
  value,
  options,
  hint,
  onChange,
}: ParameterSelectProps<T>) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div>
      <label className="text-sm font-medium text-slate-200" htmlFor={id}>
        {label}
      </label>

      <div className="relative mt-3">
        <select
          aria-describedby={hint ? hintId : undefined}
          className="w-full cursor-pointer appearance-none rounded-xl border border-white/10 bg-slate-800 px-4 py-3 pr-10 text-sm font-medium text-white transition-colors [color-scheme:dark] hover:border-white/25 focus-visible:border-blue-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          id={id}
          onChange={(event) => {
            const next = options.find(
              (option) => String(option.value) === event.target.value,
            );

            if (next) {
              onChange(next.value);
            }
          }}
          value={String(value)}
        >
          {options.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>

        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[0.7rem] text-slate-400"
        >
          ▼
        </span>
      </div>

      {hint ? (
        <p className="mt-2 text-xs leading-relaxed text-slate-300" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
