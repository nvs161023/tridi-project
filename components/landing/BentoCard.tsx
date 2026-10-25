import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "@/components/ui/class-names";

/** Цветовой акцент карточки: подсвечивает иконку и мягкое пятно в углу. */
export type BentoAccent = "blue" | "violet" | "emerald" | "amber" | "neutral";

/** Крупная иконка карточки. SVG рисуется инлайново, без иконочного пакета. */
export type BentoIconName =
  | "route"
  | "book"
  | "printer"
  | "check"
  | "award"
  | "wrench";

type BentoElement = "div" | "article" | "section" | "li";

type BentoPadding = "none" | "sm" | "md" | "lg";

export type BentoCardProps = HTMLAttributes<HTMLElement> & {
  /** Семантический тег: карточка-статья, элемент списка или обычный div. */
  as?: BentoElement;
  /** Внутренние отступы; по умолчанию `p-6`. */
  padding?: BentoPadding;
  /** Крупная иконка в стеклянном квадрате. */
  icon?: BentoIconName;
  /** Маленькая надпись над заголовком. */
  eyebrow?: string;
  /** Заголовок карточки; допускает разметку для крупных цифр. */
  title?: ReactNode;
  /** Дополнительные классы заголовка: размер и ширина. */
  titleClassName?: string;
  /** Цветовой акцент. */
  tone?: BentoAccent;
  children?: ReactNode;
};

const PADDING_CLASS: Record<BentoPadding, string> = {
  none: "",
  sm: "p-5",
  md: "p-6 sm:p-7",
  lg: "p-7 sm:p-9",
};

const TONE_CLASS: Record<
  BentoAccent,
  { glow: string; icon: string; text: string }
> = {
  blue: {
    glow: "bg-blue-500/15",
    icon: "border-blue-400/20 bg-blue-500/10 text-blue-300",
    text: "text-blue-300",
  },
  violet: {
    glow: "bg-violet-500/15",
    icon: "border-violet-400/20 bg-violet-500/10 text-violet-300",
    text: "text-violet-300",
  },
  emerald: {
    glow: "bg-emerald-500/15",
    icon: "border-emerald-400/20 bg-emerald-500/10 text-emerald-300",
    text: "text-emerald-300",
  },
  amber: {
    glow: "bg-amber-500/15",
    icon: "border-amber-400/20 bg-amber-500/10 text-amber-300",
    text: "text-amber-300",
  },
  neutral: {
    glow: "bg-white/10",
    icon: "border-white/10 bg-white/[0.04] text-white/70",
    text: "text-white/55",
  },
};

/** Контуры иконок в стиле тонких линий 24×24. */
const ICON_PATHS: Record<BentoIconName, ReactNode> = {
  route: (
    <>
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="5" r="2" />
      <path d="M8 19h4a4 4 0 0 0 4-4V9" />
      <path d="M6 17V8a3 3 0 0 1 3-3h2" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
      <path d="M4 19a2 2 0 0 1 2-2h14" />
      <path d="M8 7h8M8 11h6" />
    </>
  ),
  printer: (
    <>
      <path d="M7 8V4h10v4" />
      <path d="M5 8h14a2 2 0 0 1 2 2v7h-4v3H7v-3H3v-7a2 2 0 0 1 2-2z" />
      <path d="M7 14h10" />
      <path d="M7 17h10" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.7 2.7L16.5 9" />
    </>
  ),
  award: (
    <>
      <circle cx="12" cy="9" r="5" />
      <path d="m8.5 13.5-1 7 4.5-2.5 4.5 2.5-1-7" />
      <path d="m10.2 9 1.2 1.2 2.5-2.4" />
    </>
  ),
  wrench: (
    <path d="M14.5 6.5a4.5 4.5 0 0 0-6 5.8L3 17.8V21h3.2l5.5-5.5a4.5 4.5 0 0 0 5.8-6l-2.8 2.8-2.8-2.8z" />
  ),
};

/**
 * Премиальная bento-карточка главной.
 *
 * Фон `#0a0a0a`, тонкая верхняя грань и внутренняя тень дают глубину на
 * чёрной странице. При наведении светлеет только рамка — карточка не «прыгает»
 * и не спорит с контентом. Компонент принимает любой тег и готовые блоки,
 * поэтому тарифы, маршрут и bento-сетка используют одну поверхность.
 */
export function BentoCard({
  as = "div",
  padding = "md",
  icon,
  eyebrow,
  title,
  titleClassName,
  tone = "neutral",
  className,
  children,
  ...props
}: BentoCardProps) {
  // Приведение нужно только TypeScript: React рисует нужный тег без обёрток.
  const Component = as as "div";
  const colors = TONE_CLASS[tone];

  return (
    <Component
      className={cx(
        "group relative overflow-hidden rounded-3xl border border-white/[0.07] border-t-white/20 bg-[#0a0a0a] text-white",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_24px_70px_-36px_rgba(0,0,0,0.95)]",
        "transition-[border-color,background-color,box-shadow] duration-300 ease-out",
        "hover:border-white/20 hover:border-t-white/35 hover:bg-[#0c0c0d]",
        PADDING_CLASS[padding],
        className,
      )}
      {...props}
    >
      <div
        aria-hidden
        className={cx(
          "pointer-events-none absolute -top-20 -right-16 h-44 w-44 rounded-full opacity-70 blur-3xl",
          colors.glow,
        )}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-60"
      />

      {icon || eyebrow || title ? (
        <div className="relative">
          {icon ? (
            <span
              className={cx(
                "flex h-11 w-11 items-center justify-center rounded-xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:h-12 sm:w-12",
                colors.icon,
              )}
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 sm:h-6 sm:w-6"
              >
                {ICON_PATHS[icon]}
              </svg>
            </span>
          ) : null}

          {eyebrow ? (
            <p
              className={cx(
                "mt-5 text-[10px] font-semibold tracking-[0.2em] uppercase",
                colors.text,
              )}
            >
              {eyebrow}
            </p>
          ) : null}

          {title ? (
            <h3
              className={cx(
                "mt-2 text-xl font-extrabold tracking-tight text-white sm:text-2xl",
                titleClassName,
              )}
            >
              {title}
            </h3>
          ) : null}
        </div>
      ) : null}

      {children}
    </Component>
  );
}
