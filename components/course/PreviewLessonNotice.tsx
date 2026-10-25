import Link from "next/link";

import { LESSON_CARD, LESSON_PRIMARY } from "@/components/course/lesson-ui";

/**
 * Подпись под открытым превью-уроком.
 *
 * Первые PREVIEW_LESSONS урока каждого платного уровня открыты без покупки (см.
 * lib/course-access.ts), но человек об этом не знает, пока не упрётся в замок.
 * Карточка говорит прямо: это превью, следующий урок уже закрыт, тарифы — рядом.
 *
 * Поверхность карточки общая со всеми блоками урока (`LESSON_CARD`), а цвет
 * остаётся только в подписи уровня — так превью не выглядит блоком из другого
 * продукта, но и не спорит с белой кнопкой действия.
 */
type PreviewLessonNoticeProps = {
  accent: "confident" | "engineer" | "profit";
  /** Сквозной номер открытого урока: «Урок 1 из 12». */
  lessonNumber: number;
  totalLessons: number;
};

const ACCENTS = {
  confident: { eyebrow: "text-emerald-300" },
  engineer: { eyebrow: "text-violet-300" },
  profit: { eyebrow: "text-rose-300" },
} as const;

export function PreviewLessonNotice({
  accent,
  lessonNumber,
  totalLessons,
}: PreviewLessonNoticeProps) {
  const theme = ACCENTS[accent];

  return (
    <section className={`mt-8 sm:mt-10 ${LESSON_CARD}`}>
      <p
        className={`text-[11px] font-semibold tracking-[0.16em] uppercase ${theme.eyebrow}`}
      >
        Превью · урок {lessonNumber} из {totalLessons}
      </p>

      <p className="mt-3 text-[16px] leading-8 text-slate-300 sm:text-[17px]">
        Первые два урока уровня открыты без покупки — читай и повторяй за
        схемами. Дальше начинается платная часть: остальные уроки, тесты модулей
        с разбором и визуализации.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/subscription"
          className={`${LESSON_PRIMARY} min-h-14 w-full px-8 text-lg sm:w-auto`}
        >
          Посмотреть тарифы
          <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}
