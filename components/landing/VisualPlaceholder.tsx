/**
 * Стилизованная заглушка схемы для витрины.
 *
 * Настоящие кадры уроков — это компоненты с SVG (components/lesson-visuals).
 * Витрине они не нужны: здесь важно показать сетку, уровни и названия схем,
 * не раздувая страницу десятками инлайновых картинок. Поэтому карточка собрана
 * из div'ов: градиент уровня, техническая сетка, кольца и крупный код урока.
 *
 * Когда понадобится настоящий кадр, его можно положить в эту же рамку — размеры
 * и подпись уже заданы.
 */

/** Цвет уровня: фон, свечение, бейдж и линии схемы. */
export type VisualAccent = "blue" | "violet" | "emerald" | "amber";

type AccentStyle = {
  /** Градиент подложки: одинаковый набор классов для всех карточек. */
  surface: string;
  /** Мягкое цветное пятно в углу. */
  glow: string;
  /** Бейдж с кодом урока. */
  badge: string;
  /** Кольца и линии «схемы». */
  ring: string;
  line: string;
  /** Подсветка рамки при наведении. */
  hover: string;
};

const ACCENTS: Record<VisualAccent, AccentStyle> = {
  blue: {
    surface: "from-blue-500/25 via-slate-900 to-cyan-500/10",
    glow: "bg-blue-500/30",
    badge: "border-blue-400/40 bg-blue-500/10 text-blue-200",
    ring: "border-blue-400/25",
    line: "bg-blue-400/60",
    hover: "group-hover:border-blue-400/50",
  },
  violet: {
    surface: "from-violet-500/25 via-slate-900 to-fuchsia-500/10",
    glow: "bg-violet-500/30",
    badge: "border-violet-400/40 bg-violet-500/10 text-violet-200",
    ring: "border-violet-400/25",
    line: "bg-violet-400/60",
    hover: "group-hover:border-violet-400/50",
  },
  emerald: {
    surface: "from-emerald-500/25 via-slate-900 to-teal-500/10",
    glow: "bg-emerald-500/30",
    badge: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
    ring: "border-emerald-400/25",
    line: "bg-emerald-400/60",
    hover: "group-hover:border-emerald-400/50",
  },
  amber: {
    surface: "from-amber-500/25 via-slate-900 to-orange-500/10",
    glow: "bg-amber-500/30",
    badge: "border-amber-400/40 bg-amber-500/10 text-amber-200",
    ring: "border-amber-400/25",
    line: "bg-amber-400/60",
    hover: "group-hover:border-amber-400/50",
  },
};

type VisualPlaceholderProps = {
  /** Код урока: L1, C5, IN4, Z8. */
  code: string;
  /** Название схемы: «Технологии», «Поддержки», «Симуляция». */
  title: string;
  /** Одна строка о том, что показывает схема. */
  caption?: string;
  accent?: VisualAccent;
  /** В герое подпись не нужна — остаётся только карточка схемы. */
  showCaption?: boolean;
  className?: string;
};

/**
 * Карточка схемы: градиент, сетка и название.
 *
 * Всё декоративное помечено aria-hidden, поэтому скринридер читает только код,
 * название и подпись — без «пустых» кругов и линий.
 */
export function VisualPlaceholder({
  code,
  title,
  caption,
  accent = "blue",
  showCaption = true,
  className = "",
}: VisualPlaceholderProps) {
  const colors = ACCENTS[accent];

  return (
    <figure
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 transition-colors ${colors.hover} ${className}`}
    >
      <div
        className={`relative flex aspect-[4/3] flex-col justify-between overflow-hidden bg-gradient-to-br p-4 sm:p-5 ${colors.surface}`}
      >
        {/* Техническая сетка: тонкие линии, как на миллиметровке. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:24px_24px]"
        />
        <div
          aria-hidden
          className={`absolute -top-12 -right-10 h-40 w-40 rounded-full blur-2xl ${colors.glow}`}
        />

        {/* Кольца и оси — намёк на схему, без единого SVG. */}
        <div
          aria-hidden
          className={`absolute top-1/2 left-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border ${colors.ring}`}
        />
        <div
          aria-hidden
          className={`absolute top-1/2 left-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border ${colors.ring}`}
        />
        <div
          aria-hidden
          className="absolute top-1/2 left-1/2 h-px w-3/4 -translate-x-1/2 bg-white/10"
        />
        <div
          aria-hidden
          className="absolute top-1/2 left-1/2 h-3/4 w-px -translate-y-1/2 bg-white/10"
        />

        {/* Крупный код урока — водяной знак в углу. */}
        <span
          aria-hidden
          className="absolute -right-2 -bottom-5 text-7xl font-black tracking-tighter text-white/[0.06] sm:text-8xl"
        >
          {code}
        </span>

        <span
          className={`relative inline-flex w-fit rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${colors.badge}`}
        >
          {code}
        </span>

        <div className="relative">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-white/50 uppercase">
            Схема урока
          </p>
          <p className="mt-1 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
            {title}
          </p>
          <div aria-hidden className="mt-3 flex items-end gap-1.5">
            <span className={`h-2 w-8 rounded-full ${colors.line}`} />
            <span className="h-2 w-5 rounded-full bg-white/20" />
            <span className={`h-2 w-11 rounded-full opacity-60 ${colors.line}`} />
          </div>
        </div>
      </div>

      {showCaption && caption ? (
        <figcaption className="relative mt-auto border-t border-white/10 px-4 py-3.5">
          <p className="text-xs leading-relaxed text-slate-400">{caption}</p>
        </figcaption>
      ) : null}
    </figure>
  );
}
