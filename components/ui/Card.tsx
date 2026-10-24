import type { HTMLAttributes } from "react";

import { cx } from "./class-names";

/** Внутренние отступы карточки. `none` нужен обёрткам с собственной сеткой. */
export type CardPadding = "none" | "sm" | "md" | "lg";

/** Тег карточки: семантика важнее `div` там, где карточка — статья или фигура. */
export type CardElement =
  | "div"
  | "article"
  | "section"
  | "figure"
  | "li"
  | "details";

export type CardProps = HTMLAttributes<HTMLElement> & {
  /** Какой тег отрисовать. */
  as?: CardElement;
  /** Отступы внутри; по умолчанию `p-6`. */
  padding?: CardPadding;
  /**
   * Карточка кликабельна целиком или служит ссылкой: при наведении поднимается
   * на 4 px, тень усиливается. Для статичных карточек движение не нужно.
   */
  interactive?: boolean;
};

const PADDING_CLASS: Record<CardPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

/**
 * Стеклянная карточка кита.
 *
 * Фон, обводка, размытие и тень заданы утилитой `.glass-panel` в globals.css:
 * одна точка правки для всех карточек. `interactive` добавляет плавный подъём
 * и объёмную тень — только там, где карточка действительно кликабельна.
 */
export function Card({
  as = "div",
  padding = "md",
  interactive = false,
  className,
  ...props
}: CardProps) {
  // Приведение нужно только TypeScript: значение `as` остаётся прежним, и
  // React рисует нужный тег без лишних обёрток.
  const Component = as as "div";

  return (
    <Component
      className={cx(
        "glass-panel",
        PADDING_CLASS[padding],
        interactive &&
          "transition-all duration-300 ease-out hover:-translate-y-1 hover:border-white/10 hover:bg-white/[0.04] hover:shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]",
        className,
      )}
      {...props}
    />
  );
}
