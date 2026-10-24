import Link from "next/link";

/**
 * Подпись под открытым превью-уроком.
 *
 * Первые PREVIEW_LESSONS урока каждого платного уровня открыты без покупки (см.
 * lib/course-access.ts), но человек об этом не знает, пока не упрётся в замок.
 * Карточка говорит прямо: это превью, следующий урок уже закрыт, тарифы — рядом.
 *
 * Цвета совпадают с акцентом уровня, чтобы превью не выглядело блоком из
 * другого продукта.
 */
type PreviewLessonNoticeProps = {
  accent: "confident" | "engineer" | "profit";
  /** Сквозной номер открытого урока: «Урок 1 из 12». */
  lessonNumber: number;
  totalLessons: number;
};

const ACCENTS = {
  confident: {
    box: "border-emerald-400/40 bg-emerald-500/10",
    eyebrow: "text-emerald-300",
    button:
      "border-emerald-400/40 bg-white/5 text-emerald-100 hover:bg-emerald-400/10 focus-visible:ring-emerald-300",
  },
  engineer: {
    box: "border-violet-400/40 bg-violet-500/10",
    eyebrow: "text-violet-300",
    button:
      "border-violet-400/40 bg-white/5 text-violet-100 hover:bg-violet-400/10 focus-visible:ring-violet-300",
  },
  profit: {
    box: "border-rose-400/40 bg-rose-500/10",
    eyebrow: "text-rose-300",
    button:
      "border-rose-400/40 bg-white/5 text-rose-100 hover:bg-rose-400/10 focus-visible:ring-rose-300",
  },
} as const;

export function PreviewLessonNotice({
  accent,
  lessonNumber,
  totalLessons,
}: PreviewLessonNoticeProps) {
  const theme = ACCENTS[accent];

  return (
    <section
      className={`mt-12 rounded-3xl border ${theme.box} p-7 sm:mt-16 sm:p-9`}
    >
      <p
        className={`text-sm font-semibold uppercase tracking-widest ${theme.eyebrow}`}
      >
        Превью · урок {lessonNumber} из {totalLessons}
      </p>

      <p className="mt-3 text-base leading-relaxed text-slate-200">
        Первые два урока уровня открыты без покупки — читай и повторяй за
        схемами. Дальше начинается платная часть: остальные уроки, тесты модулей
        с разбором и визуализации.
      </p>

      <div className="mt-7 flex flex-wrap gap-3">
        <Link
          href="/subscription"
          className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-full border px-8 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:text-lg ${theme.button}`}
        >
          Посмотреть тарифы
          <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}
