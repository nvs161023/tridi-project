import Link, { type LinkProps } from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "./class-names";

/** Визуальный вес кнопки. `primary` и `secondary` — основные варианты кита. */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "gold"
  | "success";

/** Размер: компактный для шапки, обычный для форм и крупный для героя. */
export type ButtonSize = "sm" | "md" | "lg";

type ButtonStyleProps = {
  /** Оформление; по умолчанию синий градиент. */
  variant?: ButtonVariant;
  /** Размер; по умолчанию `md` с `px-6 py-3`. */
  size?: ButtonSize;
  /** Растянуть на всю ширину контейнера. */
  fullWidth?: boolean;
  /** Дополнительные классы: отступы в сетке, скрытие на мобильных и т. п. */
  className?: string;
};

/**
 * Общая формула классов для `<button>` и ссылки-кнопки.
 *
 * Вынесена отдельно, чтобы `Button` и `ButtonLink` выглядели одинаково, а
 * проекты вне кита могли собрать ту же кнопку для нестандартного элемента.
 * Переход длится 300 мс: свечение и подъём карточки не должны дёргаться.
 */
export function buttonClassName({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: ButtonStyleProps = {}): string {
  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-950/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] hover:scale-[1.02] active:scale-[0.99]",
    secondary:
      "border border-white/10 bg-white/[0.03] text-white backdrop-blur-md hover:border-white/20 hover:bg-white/[0.07]",
    ghost: "text-slate-300 hover:bg-white/[0.05] hover:text-white",
    gold:
      "bg-gradient-to-r from-amber-300 to-amber-500 text-slate-950 shadow-lg shadow-amber-950/30 hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:scale-[1.02] active:scale-[0.99]",
    success:
      "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-950/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.35)] hover:scale-[1.02] active:scale-[0.99]",
  };

  const sizes: Record<ButtonSize, string> = {
    sm: "min-h-10 px-4 py-2 text-sm",
    md: "min-h-12 px-6 py-3 text-base",
    lg: "min-h-14 px-8 py-4 text-lg",
  };

  return cx(
    "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-300 ease-out hover:cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-50",
    sizes[size],
    variants[variant],
    fullWidth && "w-full",
    className,
  );
}

export type ButtonProps = ButtonStyleProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    children?: ReactNode;
  };

/**
 * Кнопка действия.
 *
 * По умолчанию `type="button"`: в формах это защищает от случайной отправки,
 * когда кнопка просто открывает окно или сбрасывает поле. Для отправки формы
 * явно передаётся `type="submit"`.
 */
export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName({ variant, size, fullWidth, className })}
      {...props}
    />
  );
}

export type ButtonLinkProps = ButtonStyleProps &
  Omit<LinkProps, "className" | "children"> & {
    children?: ReactNode;
  };

/**
 * Ссылка с видом кнопки.
 *
 * Нужна для CTA, которые ведут на другой маршрут: остаётся настоящий `<a>` с
 * историей браузера и prefetch Next.js, но оформление общее с `Button`.
 */
export function ButtonLink({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={buttonClassName({ variant, size, fullWidth, className })}
      {...props}
    />
  );
}
