import { forwardRef, type InputHTMLAttributes } from "react";

import { cx } from "./class-names";

/**
 * Общие классы текстового поля.
 *
 * `appearance-none` и `outline-none` убирают светлую рамку браузера, а
 * `focus:ring-2` рисует сине-прозрачное кольцо кита. `aria-invalid` меняет
 * рамку на красную — это работает и в формах на Server Actions, где ошибка
 * приходит текстом, а не браузерной валидацией.
 */
const INPUT_CLASS =
  "w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white shadow-inner shadow-black/20 transition-all duration-200 outline-none placeholder:text-slate-500 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-rose-500/60 aria-[invalid=true]:focus:ring-rose-500/40";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

/**
 * Поле ввода кита.
 *
 * `forwardRef` сохраняет совместимость с формами и библиотеками, которым нужен
 * DOM-узел: фокус после ошибки, маска телефона или измерение ширины. Внешние
 * классы дописываются после базовых, чтобы поле можно было растянуть или
 * сделать компактнее в конкретной форме.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = "text", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cx(INPUT_CLASS, className)}
      {...props}
    />
  );
});

Input.displayName = "Input";
