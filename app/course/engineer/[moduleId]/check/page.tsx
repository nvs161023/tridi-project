import Link from "next/link";
import { redirect } from "next/navigation";

import { ModuleTest } from "@/components/course/ModuleTest";
import { ModuleTestLocked } from "@/components/course/ModuleTestLocked";
import {
  engineerModules,
  engineerModuleQuestions,
  findEngineerModule,
} from "@/lib/engineer-course";
import {
  loadCompletedLessonNumbers,
  unreadModuleLessons,
} from "@/lib/course-access";
import { resolveUserId } from "@/lib/current-user";
import { hasCourseAccess } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";

/**
 * Страница «Проверь себя» уровня «Инженер»: тест по модулю —
 * /course/engineer/<модуль>/check, например /course/engineer/1/check.
 *
 * Доступ тот же, что и к урокам уровня: вход и покупка курса, пакета или подписка.
 * middleware гостя не пустит, но про покупки он не знает — их спрашиваем у базы.
 *
 * Тесты модулей пишутся вместе с материалами, поэтому возможны два состояния:
 * вопросы уже есть — показываем тест; вопросов нет — говорим, что тест готовится,
 * и ведём к урокам модуля. Пустой тест не рисуем: «0 вопросов из 0» выглядело бы
 * поломкой, а не работой в процессе.
 *
 * Адрес /course/engineer/<модуль>/check не конфликтует с уроком: статический
 * сегмент "check" выигрывает у динамического [lessonId].
 */
type EngineerCheckPageProps = {
  params: Promise<{ moduleId: string }>;
};

/** Код модуля из адреса: кириллица и пробелы приходят закодированными. */
function normalizeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function lessonHref(moduleId: string, lessonId: string): string {
  return `/course/engineer/${encodeURIComponent(moduleId)}/${encodeURIComponent(lessonId)}`;
}

function checkHref(moduleId: string): string {
  return `/course/engineer/${encodeURIComponent(moduleId)}/check`;
}

export async function generateMetadata({ params }: EngineerCheckPageProps) {
  const { moduleId } = await params;
  const courseModule = findEngineerModule(normalizeSegment(moduleId));

  return {
    title: courseModule
      ? `Тест модуля ${courseModule.module_order}: ${courseModule.module_title} — Инженер 3D-печати`
      : "Тест модуля не найден — Инженер 3D-печати",
  };
}

export default async function EngineerCheckPage({
  params,
}: EngineerCheckPageProps) {
  const { moduleId } = await params;
  const courseModule = findEngineerModule(normalizeSegment(moduleId));

  if (!courseModule) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <main className="mx-auto flex max-w-3xl flex-col items-start px-5 py-20 sm:px-8 sm:py-28">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-300">
            Уровень «Инженер»
          </p>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            <span aria-hidden>🔍</span> Такого модуля нет
          </h1>
          <p className="mt-6 text-base leading-relaxed text-slate-300 sm:text-lg">
            Проверка знаний есть у каждого модуля уровня — открой программу и
            выбери нужный.
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

  const moduleLabel = `Модуль ${courseModule.module_order}: ${courseModule.module_title}`;
  const firstLessonHref = lessonHref(
    courseModule.module_id,
    courseModule.lessons[0].lesson_id,
  );
  const questions = engineerModuleQuestions(courseModule);

  const supabase = await createClient();
  const userId = await resolveUserId(supabase);

  if (!userId) {
    redirect(
      `/auth/login?next=${encodeURIComponent(checkHref(courseModule.module_id))}`,
    );
  }

  const hasAccess = await hasCourseAccess(supabase, userId, "engineer");

  // Тест модуля открывается после всех уроков модуля, кроме последнего: тест
  // стоит в конце, поэтому сам себя в проверку не включает (lib/course-access.ts).
  const moduleLessonsBeforeTest = courseModule.lessons
    .slice(0, -1)
    .map((item) => ({
      lessonId: item.lesson_id,
      lessonNumber: item.lesson_order,
      title: item.lesson_title,
    }));
  const unreadLessons =
    hasAccess && questions.length > 0
      ? unreadModuleLessons(
          moduleLessonsBeforeTest,
          await loadCompletedLessonNumbers("engineer"),
        )
      : [];

  const nextModule = engineerModules.find(
    (item) => item.module_order === courseModule.module_order + 1,
  );
  const nextLessonHref = nextModule
    ? lessonHref(nextModule.module_id, nextModule.lessons[0].lesson_id)
    : "/course/engineer/complete";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-8">
          <Link
            href={firstLessonHref}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-violet-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <span aria-hidden>←</span>
            К урокам модуля
          </Link>
          <Link
            href="/course/engineer"
            className="text-sm font-medium text-slate-300 transition-colors hover:text-violet-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Программа уровня
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-sm font-semibold uppercase tracking-widest text-violet-300">
          Проверь себя
        </p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          {moduleLabel}
        </h1>

        <div className="mt-10">
          {!hasAccess ? (
            <section className="rounded-3xl border-2 border-violet-500/40 bg-gradient-to-b from-violet-500/10 via-slate-900/70 to-slate-900/80 p-7 text-center sm:p-9">
              <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
                <span aria-hidden>🔒</span> Доступ к тестам закрыт
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-300">
                Тесты модулей уровня «Инженер» входят в платный доступ:
                купите уровень навсегда.
              </p>
              <div className="mt-8">
                <Link
                  href="/subscription"
                  className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-400 to-indigo-500 px-9 text-lg font-semibold text-slate-950 shadow-lg shadow-violet-500/25 transition-colors hover:from-violet-300 hover:to-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:w-auto"
                >
                  Посмотреть тарифы
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </section>
          ) : unreadLessons.length > 0 ? (
            <ModuleTestLocked
              courseType="engineer"
              moduleLabel={moduleLabel}
              unread={unreadLessons.map((item) => ({
                href: lessonHref(courseModule.module_id, item.lessonId),
                label: `${item.lessonId} · ${item.title}`,
              }))}
            />
          ) : questions.length > 0 ? (
            <ModuleTest
              courseType="engineer"
              moduleNumber={courseModule.module_order}
              moduleLabel={moduleLabel}
              lessonsHref={firstLessonHref}
              nextLessonHref={nextLessonHref}
              continueLabel={
                nextModule ? "Следующий урок" : "Центр выпускника"
              }
              questions={questions}
            />
          ) : (
            <section className="rounded-3xl border border-violet-500/30 bg-violet-500/5 p-7 sm:p-9">
              <p className="text-sm font-semibold uppercase tracking-widest text-violet-300">
                Тест готовится
              </p>
              <p className="mt-3 text-base leading-relaxed text-slate-300">
                Вопросы к модулю «{courseModule.module_title}» ещё пишутся: они
                появятся вместе с последними уроками модуля. Пока проверки нет,
                следующий модуль открыт.
              </p>
              <div className="mt-7">
                <Link
                  href={firstLessonHref}
                  className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-400 to-indigo-500 px-9 text-lg font-semibold text-slate-950 shadow-lg shadow-violet-500/25 transition-colors hover:from-violet-300 hover:to-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:w-auto"
                >
                  К урокам модуля
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
