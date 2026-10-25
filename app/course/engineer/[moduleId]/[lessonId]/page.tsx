import Link from "next/link";
import { redirect } from "next/navigation";

import { CompleteButton } from "@/components/course/CompleteButton";
import { LessonBlocks } from "@/components/course/LessonBlocks";
import { LESSON_CARD } from "@/components/course/lesson-ui";
import { LessonLayout } from "@/components/course/LessonLayout";
import { LessonPager } from "@/components/course/LessonPager";
import { ModuleTestGate } from "@/components/course/ModuleTestGate";
import { ModuleTestLocked } from "@/components/course/ModuleTestLocked";
import { PreviewLessonNotice } from "@/components/course/PreviewLessonNotice";
import { TestOverlay } from "@/components/course/TestOverlay";
import {
  engineerLessons,
  engineerModuleLabel,
  engineerModuleQuestions,
  findEngineerLesson,
  findEngineerModule,
  findEngineerModuleByOrder,
} from "@/lib/engineer-course";
import { resolveUserId } from "@/lib/current-user";
import {
  PREVIEW_BLOCKS,
  PREVIEW_LESSONS,
  loadCompletedLessonNumbers,
  unreadModuleLessons,
} from "@/lib/course-access";
import { LESSON_FORMS, pluralize } from "@/lib/course-stats";
import {
  ENGINEER_MODULE_TEST_COURSE_TYPE,
  isModuleTestCompletedByOrder,
} from "@/lib/module-test";
import { loadPassedModuleTests } from "@/lib/module-test-progress";
import { hasCourseAccess } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import type { MiniCheckQuestion } from "@/lib/types";

/**
 * Урок уровня «Инженер»: /course/engineer/<модуль>/<урок> — например
 * /course/engineer/1/IN1, /course/engineer/2/IN10.
 *
 * Доступ к содержимому решает покупка курса или пакета «Всё включено»: гостя не
 * пускает middleware, а вошедшему без доступа страница отдаёт только первые два
 * блока и карточку с условиями покупки. Проверка выполняется на сервере, под
 * сессией пользователя, поэтому в HTTP-ответ платные блоки просто не попадают.
 *
 * Порядок уровня. Первый урок модуля открывается после сданного теста предыдущего
 * модуля. Тесты модулей пишутся вместе с материалами, поэтому гейт включается
 * только тогда, когда тест предыдущего модуля уже написан: пока вопросов нет,
 * страница не ставит перед человеком нерешаемую задачу.
 *
 * Прогресс. В lesson_progress.lesson_id — число, а коды уроков уровня строковые
 * (IN1…IN10), поэтому в базу уходит СКВОЗНОЙ номер урока (1…10, lesson_order): он
 * же показывается в шапке как «Урок X из 10».
 */

const totalLessons = engineerLessons.length;
const totalHours = formatTotalHours();

/** «~4 ч» — сумма длительностей уроков уровня. */
function formatTotalHours(): string {
  const minutes = engineerLessons.reduce(
    (sum, lesson) => sum + Number.parseInt(lesson.duration, 10),
    0,
  );
  const hours = Math.max(1, Math.round(minutes / 60));

  return `~${hours} ч`;
}

/** Код модуля или урока из адреса: кириллица и пробелы приходят закодированными. */
function normalizeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Адрес урока уровня. */
function lessonHref(moduleId: string, lessonId: string): string {
  return `/course/engineer/${encodeURIComponent(moduleId)}/${encodeURIComponent(lessonId)}`;
}

/** Адрес страницы «Проверь себя» по модулю урока. */
function checkHref(moduleId: string): string {
  return `/course/engineer/${encodeURIComponent(moduleId)}/check`;
}

function LessonNotFound() {
  return (
    <div className="min-h-screen text-slate-100">
      <main className="mx-auto flex max-w-3xl flex-col items-start px-5 py-20 sm:px-8 sm:py-28">
        <p className="text-sm font-semibold uppercase tracking-widest text-violet-300">
          Уровень «Инженер»
        </p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          <span aria-hidden>🔍</span> Такого урока нет
        </h1>
        <p className="mt-6 text-base leading-relaxed text-slate-300 sm:text-lg">
          Возможно, адрес набран с опечаткой или урок ещё не появился в программе
          уровня. Открой программу — там видно все модули и уроки.
        </p>
        <Link
          href="/course/engineer"
          className="mt-8 inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-400 to-indigo-500 px-9 text-lg font-semibold text-slate-950 shadow-lg shadow-violet-500/25 transition-colors hover:from-violet-300 hover:to-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          Программа уровня
          <span aria-hidden>→</span>
        </Link>
      </main>
    </div>
  );
}

/**
 * Замок без доступа: уровень покупается навсегда.
 * Цену здесь не показываем — состав тарифов живёт на /subscription.
 */
function LockedNotice({ refreshHref }: { refreshHref: string }) {
  return (
    <section className="relative mt-12 overflow-hidden rounded-3xl border-2 border-violet-500/40 bg-gradient-to-b from-violet-500/10 via-slate-900/70 to-slate-900/80 p-7 text-center sm:mt-16 sm:p-9">
      <h2 className="relative text-2xl font-extrabold text-white sm:text-3xl">
        <span aria-hidden>🔒</span> Доступ к уровню закрыт
      </h2>

      <p className="relative mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-300">
        Уровень «Инженер» покупается навсегда: {totalLessons}{" "}
        {pluralize(totalLessons, LESSON_FORMS)}, {totalHours},
        визуализации к каждому блоку и практика после урока.
      </p>

      <div className="relative mt-8">
        <Link
          href="/subscription"
          className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-400 to-indigo-500 px-9 text-lg font-semibold text-slate-950 shadow-lg shadow-violet-500/25 transition-colors hover:from-violet-300 hover:to-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:w-auto"
        >
          Посмотреть тарифы
          <span aria-hidden>→</span>
        </Link>
      </div>

      <p className="relative mt-6 text-sm text-slate-300">
        Уже купили доступ?{" "}
        {/* Обычная ссылка, а не <Link>: нужна полная перезагрузка, чтобы сервер
            заново сходил в базу и проверил покупки. Работает и без JavaScript. */}
        <a
          href={refreshHref}
          className="font-semibold text-violet-200 underline-offset-4 transition-colors hover:text-violet-100 hover:underline"
        >
          Обнови страницу
        </a>
      </p>
    </section>
  );
}


/**
 * Первый урок модуля, у которого не сдан тест предыдущего модуля.
 *
 * Показываем это вместо содержимого урока: иначе порядок уровня обходился бы
 * простой перестановкой кода модуля в адресе. Тест открывается здесь же слайдом
 * (components/course/TestOverlay) — после сдачи страница обновляется, и вместо
 * этого экрана появляется сам урок.
 */
function LessonLockedByTest({
  previousModuleLabel,
  previousModuleOrder,
  previousModuleQuestions,
  previousLessonsHref,
  previousCheckHref,
  lockedLessonHref,
}: {
  previousModuleLabel: string;
  /** Место модуля в уровне: у «Инженера» оно же и результат в базе. */
  previousModuleOrder: number;
  previousModuleQuestions: MiniCheckQuestion[];
  previousLessonsHref: string;
  previousCheckHref: string;
  lockedLessonHref: string;
}) {
  return (
    <div className="min-h-screen text-slate-100">
      <main className="mx-auto flex max-w-3xl flex-col items-start px-5 py-20 sm:px-8 sm:py-28">
        <p className="text-sm font-semibold uppercase tracking-widest text-violet-300">
          Модуль закрыт
        </p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          <span aria-hidden>🔒</span> Сначала тест: {previousModuleLabel}
        </h1>
        <p className="mt-6 text-base leading-relaxed text-slate-300 sm:text-lg">
          Этот урок открывает следующий модуль. Тесты в уровне обязательны: пока
          не сдан тест предыдущего модуля, дальше не пустим. Начать можно прямо
          здесь — слайдом.
        </p>

        <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap">
          <div className="flex-1">
            <TestOverlay
              courseType="engineer"
              moduleNumber={previousModuleOrder}
              moduleLabel={previousModuleLabel}
              questions={previousModuleQuestions}
              lessonsHref={previousLessonsHref}
              nextHref={lockedLessonHref}
              continueLabel="К текущему уроку"
              triggerLabel="Пройти тест"
              hint={`${previousModuleQuestions.length} вопросов. Тест открывает следующий модуль.`}
            />
          </div>
          <div className="flex-1">
            <Link
              href={previousLessonsHref}
              className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full border border-violet-400/40 bg-white/5 px-9 text-lg font-semibold text-violet-100 transition-colors hover:bg-violet-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              К урокам модуля
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>

        <Link
          href={previousCheckHref}
          className="mt-4 text-sm font-medium text-slate-300 transition-colors hover:text-violet-300"
        >
          Открыть тест отдельной страницей
        </Link>
      </main>
    </div>
  );
}

/**
 * Материал урока ещё не написан (blocks пустой).
 *
 * Отдельного «режима разработки» нет: пока в data/course-engineer.json у урока
 * нет блоков, страница честно говорит об этом. Как только блоки появляются,
 * показывается урок.
 */
function LessonPending({
  lessonTitle,
  moduleLabel,
}: {
  lessonTitle: string;
  moduleLabel: string;
}) {
  return (
    <section className="mt-10 rounded-3xl border border-violet-500/30 bg-violet-500/5 p-7 sm:p-9">
      <p className="text-sm font-semibold uppercase tracking-widest text-violet-300">
        Материал готовится
      </p>
      <p className="mt-3 text-base leading-relaxed text-slate-300">
        Урок «{lessonTitle}» из модуля «{moduleLabel}» ещё пишется: его блоки
        появятся здесь по мере готовности, а тесты модулей — вместе с последними
        уроками.
      </p>
    </section>
  );
}

type EngineerLessonPageProps = {
  params: Promise<{ moduleId: string; lessonId: string }>;
};

export async function generateMetadata({ params }: EngineerLessonPageProps) {
  const { moduleId, lessonId } = await params;
  const lesson = findEngineerLesson(
    normalizeSegment(moduleId),
    normalizeSegment(lessonId),
  );

  return {
    title: lesson
      ? `${lesson.title} — Инженер 3D-печати — 3D-печать с нуля`
      : "Урок не найден — 3D-печать с нуля",
  };
}

export default async function EngineerLessonPage({
  params,
}: EngineerLessonPageProps) {
  const { moduleId, lessonId } = await params;

  const lesson = findEngineerLesson(
    normalizeSegment(moduleId),
    normalizeSegment(lessonId),
  );
  const currentModule = findEngineerModule(normalizeSegment(moduleId));

  if (!lesson || !currentModule) {
    return <LessonNotFound />;
  }

  // Сквозной номер урока: он же lesson_id в lesson_progress и «Урок X из 10».
  const index = engineerLessons.findIndex(
    (item) => item.lessonId === lesson.lessonId,
  );
  const previous = index > 0 ? engineerLessons[index - 1] : null;
  const next = index + 1 < totalLessons ? engineerLessons[index + 1] : null;
  const isLastLesson = next === null;
  const nextHref = next
    ? lessonHref(next.moduleId, next.lessonId)
    : "/course/engineer/complete";
  const currentHref = lessonHref(lesson.moduleId, lesson.lessonId);
  const progressPercent = Math.round((lesson.lessonNumber / totalLessons) * 100);

  const supabase = await createClient();

  // Кто открыл страницу. Гостя сюда не пустит middleware, но проверку дублируем:
  // страница платная, и лишняя осторожность здесь дешевле открытого содержимого.
  const userId = await resolveUserId(supabase);

  if (!userId) {
    redirect(`/auth/login?next=${encodeURIComponent(currentHref)}`);
  }

  // Главный вопрос страницы: есть ли доступ у ЭТОГО пользователя.
  const hasAccess = await hasCourseAccess(supabase, userId, "engineer");

  // Результаты тестов читаем только тем, у кого есть доступ: без доступа важнее
  // показать её, чем порядок уровня, да и лишний запрос к базе ни к чему.
  const passedTests = hasAccess
    ? await loadPassedModuleTests(ENGINEER_MODULE_TEST_COURSE_TYPE)
    : new Set<number>();

  const isTestPassed = isModuleTestCompletedByOrder(
    passedTests,
    currentModule.module_order,
  );
  const moduleQuestions = engineerModuleQuestions(currentModule);

  // Первый урок модуля открыт только после теста предыдущего модуля — и только
  // если этот тест уже написан: иначе человек упирался бы в тест, которого нет.
  const previousModule = lesson.isModuleFirst
    ? findEngineerModuleByOrder(currentModule.module_order - 1)
    : null;
  const previousModuleQuestions = previousModule
    ? engineerModuleQuestions(previousModule)
    : [];

  if (
    hasAccess &&
    previousModule &&
    previousModuleQuestions.length > 0 &&
    !isModuleTestCompletedByOrder(passedTests, previousModule.module_order)
  ) {
    return (
      <LessonLockedByTest
        previousModuleLabel={engineerModuleLabel(previousModule)}
        previousModuleOrder={previousModule.module_order}
        previousModuleQuestions={previousModuleQuestions}
        previousLessonsHref={lessonHref(
          previousModule.module_id,
          previousModule.lessons[0].lesson_id,
        )}
        previousCheckHref={checkHref(previousModule.module_id)}
        lockedLessonHref={currentHref}
      />
    );
  }

  const hasModuleTest = moduleQuestions.length > 0;

  // Превью: первые PREVIEW_LESSONS урока уровня открыты без покупки, остальные —
  // только с доступом. Решение принимается на сервере, поэтому платные блоки в
  // HTTP-ответ просто не попадают.
  const isPreviewLesson = !hasAccess && lesson.lessonNumber <= PREVIEW_LESSONS;

  // Тест модуля стоит в конце модуля: пока уроки до него не отмечены
  // пройденными, вместо теста показываем список того, что осталось прочитать.
  const moduleLessonsBeforeTest = lesson.isModuleLast
    ? currentModule.lessons
        .filter((item) => item.lesson_order < lesson.lessonNumber)
        .map((item) => ({
          lessonId: item.lesson_id,
          lessonNumber: item.lesson_order,
          title: item.lesson_title,
        }))
    : [];
  const unreadLessons =
    hasAccess && hasModuleTest && moduleLessonsBeforeTest.length > 0
      ? unreadModuleLessons(
          moduleLessonsBeforeTest,
          await loadCompletedLessonNumbers("engineer"),
        )
      : [];

  const lessonsHref = lessonHref(
    currentModule.module_id,
    currentModule.lessons[0].lesson_id,
  );

  const courseFinishNote = `Позади все ${totalLessons} ${pluralize(totalLessons, LESSON_FORMS)} уровня «Инженер»: расчёт деталей, повтор чужой геометрии и своя процедура печати. Дальше — практика на своих моделях.`;

  return (
    <div className="min-h-screen text-slate-100">
      <header className="border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur">
        <div className="mx-auto w-full max-w-[800px] px-5 py-4 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/course/engineer"
              className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
            >
              <span aria-hidden>←</span>
              {hasAccess ? "Программа уровня" : "На главную"}
            </Link>
            {hasAccess && previous ? (
              <Link
                href={lessonHref(previous.moduleId, previous.lessonId)}
                className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
              >
                <span aria-hidden>←</span>
                Предыдущий
              </Link>
            ) : null}
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
              <span>
                Урок {lesson.lessonNumber} из {totalLessons}
              </span>
              {hasAccess ? (
                <span className="text-zinc-300">{progressPercent}%</span>
              ) : null}
            </div>
            {/* Без доступа полоска остаётся серой и пустой: прогресс по закрытому
                уровню не показываем, чтобы не намекать на недоступное. */}
            <div
              role="progressbar"
              aria-label="Прогресс уровня «Инженер»"
              aria-valuenow={hasAccess ? progressPercent : 0}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
            >
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${
                  hasAccess ? "bg-white" : "bg-white/20"
                }`}
                style={{ width: hasAccess ? `${progressPercent}%` : "0%" }}
              />
            </div>
          </div>
        </div>
      </header>

      <LessonLayout>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-violet-300 uppercase">
          {lesson.moduleLabel}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {lesson.title}
        </h1>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-zinc-300">
            <span aria-hidden>✅</span>
            Инженер 3D-печати
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-zinc-300">
            <span aria-hidden>⏱️</span>
            {lesson.duration}
          </span>
        </div>

        {/* Без доступа в разметку попадают только первые блоки урока, остальное
            остаётся на сервере — «посмотреть код страницы» не поможет. */}
        {!hasAccess && !isPreviewLesson ? (
          <>
            {lesson.blocks.length > 0 ? (
              <LessonBlocks
                blocks={lesson.blocks.slice(0, PREVIEW_BLOCKS)}
                courseType="engineer"
                moduleId={currentModule.module_id}
                lessonId={lesson.lessonId}
              />
            ) : null}
            <LockedNotice refreshHref={currentHref} />
          </>
        ) : lesson.blocks.length === 0 ? (
          <LessonPending
            lessonTitle={lesson.title}
            moduleLabel={lesson.moduleLabel}
          />
        ) : (
          <>
            <LessonBlocks
              blocks={lesson.blocks}
              courseType="engineer"
              moduleId={currentModule.module_id}
              lessonId={lesson.lessonId}
            />
            {isPreviewLesson ? (
              <PreviewLessonNotice
                accent="engineer"
                lessonNumber={lesson.lessonNumber}
                totalLessons={totalLessons}
              />
            ) : null}
          </>
        )}

        {hasAccess ? (
          <div className="mt-10 border-t border-white/5 pt-8 sm:mt-12">
            {lesson.isModuleLast && hasModuleTest ? (
              // Последний урок модуля: тест обязателен и здесь, поэтому вместо
              // перехода показываем карточку «Проверь себя». Пока уроки модуля не
              // прочитаны, вместо теста стоит список того, что осталось.
              unreadLessons.length > 0 ? (
                <ModuleTestLocked
                  courseType="engineer"
                  moduleLabel={lesson.moduleLabel}
                  unread={unreadLessons.map((item) => ({
                    href: lessonHref(currentModule.module_id, item.lessonId),
                    label: `${item.lessonId} · ${item.title}`,
                  }))}
                />
              ) : (
                <ModuleTestGate
                  courseType="engineer"
                  moduleNumber={currentModule.module_order}
                  moduleLabel={lesson.moduleLabel}
                  questions={moduleQuestions}
                  lessonsHref={lessonsHref}
                  testPageHref={checkHref(currentModule.module_id)}
                  lessonId={lesson.lessonNumber}
                  nextHref={nextHref}
                  nextLabel={
                    isLastLesson ? "Центр выпускника" : "Продолжить курс"
                  }
                  isPassed={isTestPassed}
                  isCourseFinal={isLastLesson}
                  courseFinishNote={courseFinishNote}
                />
              )
            ) : lesson.isModuleLast ? (
              // Тест модуля ещё не написан: проверять нечего, поэтому продолжаем
              // без гейта. Как только вопросы появятся, здесь встанет тест.
              <section className={LESSON_CARD}>
                <p className="text-[11px] font-semibold tracking-[0.16em] text-violet-300 uppercase">
                  Проверь себя
                </p>
                <h2 className="mt-3 text-xl font-bold tracking-tight text-white sm:text-2xl">
                  {lesson.moduleLabel}
                </h2>
                <p className="mt-3 text-[16px] leading-8 text-slate-300 sm:text-[17px]">
                  Тест модуля появится вместе с последними уроками. Пока проверка
                  не написана, следующий модуль открыт — можно идти дальше.
                </p>
                <div className="mt-6">
                  <CompleteButton
                    lessonId={lesson.lessonNumber}
                    courseType="engineer"
                    href={nextHref}
                    label={
                      isLastLesson ? "Центр выпускника" : "Продолжить курс"
                    }
                  />
                </div>
              </section>
            ) : (
              <CompleteButton
                lessonId={lesson.lessonNumber}
                courseType="engineer"
                href={nextHref}
                label="Пройти урок"
              />
            )}
            <LessonPager
              previous={
                previous
                  ? {
                      href: lessonHref(previous.moduleId, previous.lessonId),
                      label: previous.title,
                    }
                  : null
              }
              next={
                next
                  ? {
                      href: lessonHref(next.moduleId, next.lessonId),
                      label: next.title,
                    }
                  : null
              }
            />
          </div>
        ) : null}
      </LessonLayout>
    </div>
  );
}

