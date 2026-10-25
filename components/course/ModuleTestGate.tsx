import Link from "next/link";

import { CompleteButton } from "@/components/course/CompleteButton";
import {
  LESSON_CARD,
  LESSON_PRIMARY,
  LESSON_SECONDARY,
} from "@/components/course/lesson-ui";
import { moduleTestThemes } from "@/components/course/module-test-theme";
import { TestOverlay } from "@/components/course/TestOverlay";
import { moduleTestPassFrom, type CourseTestVariant } from "@/lib/module-test";
import type { MiniCheckQuestion } from "@/lib/types";

/**
 * Карточка «Проверь себя» на последнем уроке модуля.
 *
 * Тест — обязательный шаг: пока он не сдан, «Продолжить курс» заблокирована, а
 * сам тест открывается слайдом поверх урока (components/course/TestOverlay.tsx).
 * Так ученик не теряет урок из виду и в любой момент может вернуться к материалу.
 *
 * Два состояния карточки:
 *  - тест не сдан — главная кнопка «Пройти тест» и заблокированное продолжение
 *    с подписью «Сначала сдай тест»;
 *  - тест сдан — активное продолжение (отметить урок и идти дальше) и
 *    «Пройти тест ещё раз» вторым действием.
 *
 * У последнего урока курса продолжение ведёт в «Центр выпускника», и карточка
 * добавляет поздравление: блок «Курс пройден!» показывается только после сданного
 * теста.
 */
type ModuleTestGateProps = {
  courseType: CourseTestVariant;
  /** Номер модуля для базы: код модуля (базовый) или место в курсе (продвинутый). */
  moduleNumber: number;
  moduleLabel: string;
  questions: MiniCheckQuestion[];
  /** Первый урок модуля — «к урокам» уходит на отдельную страницу теста. */
  lessonsHref: string;
  /** Страница теста того же модуля: запасной вход, если слайд не открывается. */
  testPageHref: string;
  /** Урок, который отмечаем пройденным вместе с переходом дальше. */
  lessonId: number;
  /** Куда вести после сдачи: следующий урок курса или «Центр выпускника». */
  nextHref: string;
  /** Подпись активного продолжения: «Продолжить курс» и т.п. */
  nextLabel: string;
  isPassed: boolean;
  /** Последний урок курса: перед продолжением показываем поздравление. */
  isCourseFinal?: boolean;
  /** Текст поздравления для последнего урока курса. */
  courseFinishNote?: string;
};

export function ModuleTestGate({
  courseType,
  moduleNumber,
  moduleLabel,
  questions,
  lessonsHref,
  testPageHref,
  lessonId,
  nextHref,
  nextLabel,
  isPassed,
  isCourseFinal,
  courseFinishNote,
}: ModuleTestGateProps) {
  const theme = moduleTestThemes[courseType];
  const total = questions.length;
  // Порог у каждого уровня свой: 5 в бесплатном курсе, 7 в платных (см.
  // lib/module-test.ts) — подпись должна совпадать с тем, как считает тест.
  const hint = `${total} вопросов, порог — ${moduleTestPassFrom(courseType)} правильных из ${total}. Без сданного теста дальше не пустим.`;

  return (
    <section className={LESSON_CARD}>
      <p
        className={`text-[11px] font-semibold tracking-[0.16em] uppercase ${theme.eyebrow}`}
      >
        Проверь себя
      </p>

      <h2 className="mt-3 text-xl font-bold tracking-tight text-white sm:text-2xl">
        {moduleLabel}
      </h2>

      <p className="mt-3 text-[16px] leading-8 text-slate-300 sm:text-[17px]">
        {hint}
      </p>

      <p
        className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
          isPassed
            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
            : "border-amber-500/20 bg-amber-500/10 text-amber-200"
        }`}
      >
        {isPassed ? "Тест модуля сдан" : "Тест модуля пока не сдан"}
      </p>

      {isCourseFinal && isPassed ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center">
          <p className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            <span aria-hidden>🏆</span> Курс пройден!
          </p>
          {courseFinishNote ? (
            <p className="mt-3 text-[16px] leading-8 text-slate-300">
              {courseFinishNote}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {isPassed ? (
          <>
            <CompleteButton
              lessonId={lessonId}
              courseType={courseType}
              href={nextHref}
              label={nextLabel}
            />

            <div className="w-full sm:w-64">
              <TestOverlay
                courseType={courseType}
                moduleNumber={moduleNumber}
                moduleLabel={moduleLabel}
                questions={questions}
                lessonsHref={lessonsHref}
                nextHref={nextHref}
                continueLabel={nextLabel}
                triggerLabel="Пройти тест ещё раз"
                triggerClassName={`${LESSON_SECONDARY} min-h-14 w-full px-6`}
                hint={hint}
              />
            </div>
          </>
        ) : (
          <div className="w-full">
            <TestOverlay
              courseType={courseType}
              moduleNumber={moduleNumber}
              moduleLabel={moduleLabel}
              questions={questions}
              lessonsHref={lessonsHref}
              nextHref={nextHref}
              continueLabel={nextLabel}
              triggerLabel="Пройти тест"
              triggerClassName={`${LESSON_PRIMARY} min-h-14 w-full px-9 text-lg`}
              hint={hint}
            />
          </div>
        )}
      </div>

      {isPassed ? null : (
        <div className="mt-6">
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="inline-flex min-h-14 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-9 text-lg font-semibold text-zinc-500"
          >
            {nextLabel}
            <span aria-hidden>→</span>
          </button>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
            Сначала сдай тест — без него следующий модуль закрыт.
          </p>
        </div>
      )}

      <p className="mt-5">
        <Link
          href={testPageHref}
          className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-200"
        >
          Открыть тест отдельной страницей
        </Link>
      </p>
    </section>
  );
}
