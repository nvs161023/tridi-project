import Link from "next/link";

import { CompleteButton } from "@/components/course/CompleteButton";
import { moduleTestThemes } from "@/components/course/module-test-theme";
import { TestOverlay } from "@/components/course/TestOverlay";
import { MODULE_TEST_PASS_FROM, type CourseTestVariant } from "@/lib/module-test";
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
 * У последнего урока курса продолжение ведёт в конструктор и карточка добавляет
 * поздравление: блок «Курс пройден!» показывается только после сданного теста.
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
  /** Куда вести после сдачи: следующий урок курса или конструктор. */
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
  const hint = `${total} вопросов, порог — ${MODULE_TEST_PASS_FROM} правильных из ${total}. Без сданного теста дальше не пустим.`;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-9">
      <p className={`text-sm font-semibold uppercase tracking-widest ${theme.eyebrow}`}>
        Проверь себя
      </p>

      <h2 className="mt-3 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
        {moduleLabel}
      </h2>

      <p className="mt-3 text-base leading-relaxed text-slate-400">
        {hint}
      </p>

      <p
        className={`mt-4 text-sm font-semibold ${
          isPassed ? "text-emerald-300" : "text-amber-200"
        }`}
      >
        {isPassed ? "Тест модуля сдан" : "Тест модуля пока не сдан"}
      </p>

      {isCourseFinal && isPassed ? (
        <div className="mt-6 rounded-2xl border border-blue-500/40 bg-blue-500/10 p-6 text-center">
          <p className="text-2xl font-extrabold text-white sm:text-3xl">
            <span aria-hidden>🏆</span> Курс пройден!
          </p>
          {courseFinishNote ? (
            <p className="mt-3 text-base leading-relaxed text-slate-300">
              {courseFinishNote}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {isPassed ? (
          <>
            <div className="flex-1">
              <CompleteButton
                lessonId={lessonId}
                courseType={courseType}
                href={nextHref}
                label={nextLabel}
              />
            </div>

            <div className="flex-1">
              <TestOverlay
                courseType={courseType}
                moduleNumber={moduleNumber}
                moduleLabel={moduleLabel}
                questions={questions}
                lessonsHref={lessonsHref}
                nextHref={nextHref}
                continueLabel={nextLabel}
                triggerLabel="Пройти тест ещё раз"
                triggerVariant="secondary"
                hint={hint}
              />
            </div>
          </>
        ) : (
          <div className="flex-1">
            <TestOverlay
              courseType={courseType}
              moduleNumber={moduleNumber}
              moduleLabel={moduleLabel}
              questions={questions}
              lessonsHref={lessonsHref}
              nextHref={nextHref}
              continueLabel={nextLabel}
              triggerLabel="Пройти тест"
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
            className="inline-flex min-h-14 w-full cursor-not-allowed items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-9 text-lg font-semibold text-slate-500"
          >
            {nextLabel}
            <span aria-hidden>→</span>
          </button>
          <p className="mt-3 text-sm text-slate-400">
            Сначала сдай тест — без него следующий модуль закрыт.
          </p>
        </div>
      )}

      <p className="mt-5">
        <Link
          href={testPageHref}
          className="text-sm font-medium text-slate-400 transition-colors hover:text-blue-400"
        >
          Открыть тест отдельной страницей
        </Link>
      </p>
    </section>
  );
}
