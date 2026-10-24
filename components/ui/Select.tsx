import {
  forwardRef,
  type CSSProperties,
  type SelectHTMLAttributes,
} from "react";

import { cx } from "./class-names";

const SELECT_CLASS =
  "w-full appearance-none rounded-xl border border-white/10 bg-black/40 py-3 pr-10 pl-4 text-sm text-white shadow-inner shadow-black/20 transition-all duration-200 outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-rose-500/60 aria-[invalid=true]:focus:ring-rose-500/40";

/**
 * Стрелка встроена в стиль, а не нарисована отдельным `<span>`: у нативного
 * select нет надёжного слота для иконки, а обёртка ломала бы сетки форм.
 */
const CHEVRON_STYLE: CSSProperties = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E\")",
  backgroundPosition: "right 1rem center",
  backgroundRepeat: "no-repeat",
  backgroundSize: "1rem 1rem",
};

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/**
 * Выпадающий список кита.
 *
 * Системный вид select заменён тёмным полем и собственной стрелкой, но сам
 * элемент остаётся нативным: клавиатура, мобильные барабаны выбора и
 * `required` работают без клиентского JavaScript.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ className, style, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        style={{ ...CHEVRON_STYLE, ...style }}
        className={cx(SELECT_CLASS, className)}
        {...props}
      >
        {children}
      </select>
    );
  },
);

Select.displayName = "Select";
