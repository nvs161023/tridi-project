import Link from "next/link";

import { CompleteButton } from "@/components/course/CompleteButton";
import { LessonBlocks } from "@/components/course/LessonBlocks";
import { ModuleTestGate } from "@/components/course/ModuleTestGate";
import { TestOverlay } from "@/components/course/TestOverlay";
import courseProData from "@/data/course-pro.json";
import { basicCourseModules, basicLessons } from "@/lib/basic-course";
import { LESSON_FORMS, pluralize, summarizeCourse } from "@/lib/course-stats";
import { isModuleTestCompleted } from "@/lib/module-test";
import { loadPassedModuleTests } from "@/lib/module-test-progress";
import type { MiniCheckQuestion } from "@/lib/types";

/**
 * Уроки базового курса в плоском виде: lib/basic-course разворачивает модули из
 * data/lessons.json, поэтому страница работает как раньше — /course/lesson-N.
 *
 * Тип BasicLesson уже знает код модуля и признак последнего урока в модуле: по ним
 * на последнем уроке модуля появляется кнопка «Проверь себя».
 */
const lessons = basicLessons;
const totalLessons = lessons.length;

/** Сводка продвинутого курса для приглашения — считается по файлу курса. */
const proSummary = summarizeCourse(courseProData);

/**
 * Что даёт продвинутый курс — модули золотого блока-приглашения. Названия берём
 * из файла курса по коду модуля, а не пишем текстом: так приглашение не
 * разойдётся с программой курса.
 */
const PRO_PROMO_MODULE_IDS: string[] = ["A-без", "B", "E2", "C2", "J", "T"];
const proPromoItems: string[] = PRO_PROMO_MODULE_IDS.flatMap((moduleId) => {
  const courseModule = courseProData.modules.find(
    (item) => item.module_id === moduleId,
  );

  return courseModule ? [courseModule.module_title] : [];
});

type LessonPageProps = {
  params: Promise<{ id: string }>;
};

function parseLessonId(rawId: string): number | null {
  const match = rawId.match(/\d+/);

  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);

  return Number.isFinite(parsed) ? parsed : null;
}

function lessonHref(id: number): string {
  return `/course/lesson-${id}`;
}

export function generateStaticParams() {
  return lessons.map((lesson) => ({ id: `lesson-${lesson.id}` }));
}

export async function generateMetadata({ params }: LessonPageProps) {
  const { id } = await params;
  const lessonId = parseLessonId(id);
  const lesson = lessons.find((item) => item.id === lessonId);

  return {
    title: lesson
      ? `${lesson.title} — 3D-печать с нуля`
      : "Урок не найден — 3D-печать с нуля",
  };
}

/**
 * Золотой блок-приглашение в продвинутый курс.
 *
 * Показывается на последнем уроке базового курса: человек только что закончил
 * бесплатную часть — это лучшее место предложить продолжение.
 */
function ProCoursePromo() {
  return (
    <section className="relative mt-12 overflow-hidden rounded-3xl border-2 border-yellow-500/50 bg-gradient-to-b from-amber-500/10 via-slate-900/70 to-slate-900/80 p-7 sm:mt-16 sm:p-9">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl"
      />

      <p className="relative text-2xl font-extrabold text-white sm:text-3xl">
        <span aria-hidden>🎉</span> Базовый курс пройден! Теперь ты готов к
        продвинутому:
      </p>

      <ul className="relative mt-6 space-y-3">
        {proPromoItems.map((item) => (
          <li
            key={item}
            className="flex items-start gap-3 text-base leading-relaxed text-slate-200"
          >
            <span aria-hidden className="text-amber-300">
              —
            </span>
            {item}
          </li>
        ))}
      </ul>

      <p className="relative mt-6 text-sm font-semibold text-amber-200">
        {proSummary.lessons} {pluralize(proSummary.lessons, LESSON_FORMS)} ·{" "}
        {proSummary.hours} · входит в тариф Pro
      </p>

      <div className="relative mt-8">
        <Link
          href="/course/pro/A/A1"
          className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-9 text-lg font-semibold text-slate-950 shadow-lg shadow-amber-500/25 transition-colors hover:from-amber-300 hover:to-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:w-auto"
        >
          Открыть продвинутый курс
          <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}

function LessonNotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex max-w-3xl flex-col items-start px-5 py-20 sm:px-8 sm:py-28">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
          Ошибка 404
        </p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          Урок не найден
        </h1>
        <p className="mt-6 text-base leading-relaxed text-slate-400 sm:text-lg">
          Такого урока нет или ссылка устарела. Вернитесь на главную — там
          программа всего курса из {totalLessons} уроков.
        </p>
        <Link
          href="/"
          className="mt-10 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-9 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:w-auto"
        >
          Вернуться на главную
          <span aria-hidden>→</span>
        </Link>
      </main>
    </div>
  );
}

/**
 * Первый урок модуля, у которого не сдан тест предыдущего модуля.
 *
 * Показываем это вместо содержимого урока: тесты обязательны, поэтому обойти их
 * прямой ссылкой на урок тоже нельзя.
 *
 * Тест открывается здесь же слайдом (components/course/TestOverlay): после сдачи
 * страница обновляется, и вместо этого экрана появляется сам урок — никуда
 * переходить не нужно. Ссылка на отдельную страницу теста остаётся запасным
 * входом.
 */
function LessonLockedByTest({
  moduleId,
  moduleNumber,
  moduleLabel,
  moduleLessonsHref,
  questions,
  lockedLessonHref,
}: {
  /** Код модуля, тест которого нужно сдать. */
  moduleId: string;
  /** Тот же модуль числом: только так результат ложится в базу. */
  moduleNumber: number;
  /** «Модуль 1: Знакомство» — название модуля для текста. */
  moduleLabel: string;
  /** Первый урок модуля с тестом — ссылка «к урокам» на странице теста. */
  moduleLessonsHref: string;
  questions: MiniCheckQuestion[];
  /** Адрес закрытого урока: туда ведём после сдачи. */
  lockedLessonHref: string;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex max-w-3xl flex-col items-start px-5 py-20 sm:px-8 sm:py-28">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
          Модуль закрыт
        </p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          Сначала пройди тест модуля
        </h1>
        <p className="mt-6 text-base leading-relaxed text-slate-400 sm:text-lg">
          {moduleLabel} ещё не сдан. Ответь на {questions.length} вопросов — и
          уроки следующего модуля откроются. Тест открывается прямо здесь,
          слайдом: закрыть можно в любой момент.
        </p>

        <div className="mt-10 w-full sm:max-w-md">
          <TestOverlay
            courseType="basic"
            moduleNumber={moduleNumber}
            moduleLabel={moduleLabel}
            questions={questions}
            lessonsHref={moduleLessonsHref}
            nextHref={lockedLessonHref}
            continueLabel="Открыть урок"
            triggerLabel="Пройти тест модуля"
            hint={`${questions.length} вопросов по урокам модуля. Без сданного теста урок останется закрытым.`}
          />
        </div>

        <Link
          href="/"
          className="mt-6 text-sm font-medium text-slate-400 transition-colors hover:text-blue-400"
        >
          <span aria-hidden>←</span> Назад к курсу
        </Link>
        <Link
          href={`/course/check/${moduleId}`}
          className="mt-3 text-sm font-medium text-slate-500 transition-colors hover:text-blue-400"
        >
          Открыть тест отдельной страницей
        </Link>
      </main>
    </div>
  );
}
export default async function LessonPage({ params }: LessonPageProps) {
  const { id } = await params;
  const lessonId = parseLessonId(id);
  const lesson = lessons.find((item) => item.id === lessonId);

  if (!lesson) {
    return <LessonNotFound />;
  }

  // Тесты модулей обязательны: сданные результаты лежат в базе отдельным типом
  // курса (см. lib/module-test.ts) и открывают следующий модуль.
  const passedTests = await loadPassedModuleTests();
  const isTestPassed = isModuleTestCompleted(passedTests, lesson.moduleId);

  // Первый урок модуля открыт только после теста предыдущего модуля.
  const previousModule = lesson.isModuleFirst
    ? basicCourseModules.find(
        (courseModule) => courseModule.moduleOrder === lesson.moduleOrder - 1,
      )
    : undefined;

  if (
    previousModule &&
    !isModuleTestCompleted(passedTests, previousModule.moduleId)
  ) {
    return (
      <LessonLockedByTest
        moduleId={previousModule.moduleId}
        moduleNumber={Number(previousModule.moduleId)}
        moduleLabel={previousModule.label}
        moduleLessonsHref={lessonHref(previousModule.lessonIds[0])}
        questions={previousModule.questions}
        lockedLessonHref={lessonHref(lesson.id)}
      />
    );
  }

  /**
   * Вопросы теста модуля текущего урока: их показывает карточка «Проверь себя»
   * на последнем уроке модуля.
   */
  const moduleQuestions =
    basicCourseModules.find(
      (courseModule) => courseModule.moduleId === lesson.moduleId,
    )?.questions ?? [];

  const progressPercent = Math.round((lesson.id / totalLessons) * 100);
  const isLastLesson = lesson.id === totalLessons;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto max-w-3xl px-5 py-4 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <span aria-hidden>←</span>
              Назад к курсу
            </Link>
            {lesson.id > 1 ? (
              <Link
                href={lessonHref(lesson.id - 1)}
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                <span aria-hidden>←</span>
                Предыдущий урок
              </Link>
            ) : null}
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 sm:text-sm">
              <span>
                Урок {lesson.id} из {totalLessons}
              </span>
              <span className="text-blue-400">{progressPercent}%</span>
            </div>
            <div
              role="progressbar"
              aria-label="Прогресс курса"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
            >
              <div
                className="h-full rounded-full bg-blue-600 transition-[width] duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
          {lesson.module}
        </p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          {lesson.title}
        </h1>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/40 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-300 sm:text-sm">
            <span aria-hidden>⏱️</span>
            {lesson.duration}
          </span>
          <span className="text-sm text-slate-400">
            Урок {lesson.id} из {totalLessons}
          </span>
        </div>

        <LessonBlocks
          blocks={lesson.blocks}
          courseType="basic"
          lessonId={lesson.id}
        />

        {isLastLesson ? <ProCoursePromo /> : null}

        <div className="mt-12 sm:mt-16">
          {lesson.isModuleLast ? (
            // Последний урок модуля: тест обязателен, поэтому вместо перехода
            // показываем карточку «Проверь себя» со слайдом теста и заблокированной
            // кнопкой продолжения — пока тест не сдан, дальше не пустим.
            <ModuleTestGate
              courseType="basic"
              moduleNumber={Number(lesson.moduleId)}
              moduleLabel={lesson.module}
              questions={moduleQuestions}
              lessonsHref={lessonHref(lesson.id)}
              testPageHref={`/course/check/${lesson.moduleId}`}
              lessonId={lesson.id}
              nextHref={isLastLesson ? "/constructor" : lessonHref(lesson.id + 1)}
              nextLabel={
                isLastLesson ? "Перейти в конструктор" : "Продолжить курс"
              }
              isPassed={isTestPassed}
              isCourseFinal={isLastLesson}
              courseFinishNote={`Все ${totalLessons} уроков позади. Осталось собрать свою первую модель: вазу, брелок или светильник.`}
            />
          ) : (
            <CompleteButton
              lessonId={lesson.id}
              courseType="basic"
              href={lessonHref(lesson.id + 1)}
              label="Пройти урок"
            />
          )}
        </div>
      </main>
    </div>
  );
}
