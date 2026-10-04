import Link from "next/link";
import { redirect } from "next/navigation";

import coursesData from "@/data/courses.json";
import { resolveUserId } from "@/lib/current-user";
import { confidentCourse, confidentModules } from "@/lib/confident-course";
import {
  LESSON_FORMS,
  MODULE_FORMS,
  formatHours,
  pluralize,
  summarizeCourse,
} from "@/lib/course-stats";
import { createClient } from "@/lib/supabase/server";

/**
 * Уровень «Уверенный»: /course/confident — программа из трёх модулей.
 *
 * Страница открывается любому вошедшему человеку: она показывает, что за уровень
 * и какие в нём уроки. Сам материал уроков — платный, его отдаёт страница урока
 * (/course/confident/<модуль>/<урок>), где доступ решает подписка.
 *
 * Материалы уровня пишутся по частям, поэтому у урока может быть пустой blocks:
 * такой урок не ссылка, а строка с отметкой «Готовится». Отметка исчезает сама,
 * когда в файле данных появляются блоки — отдельного «режима разработки» нет.
 */
const courseMeta = coursesData.confident;
const summary = summarizeCourse(confidentCourse);

export const metadata = {
  title: "Уверенный уровень — 3D-печать с нуля",
};

export default async function ConfidentCoursePage() {
  // Гостя сюда не пустит middleware (см. middleware.ts), но проверку дублируем:
  // страница уровня живёт в закрытом разделе /course.
  const supabase = await createClient();
  const userId = await resolveUserId(supabase);

  if (!userId) {
    redirect(`/auth/login?next=${encodeURIComponent("/course/confident")}`);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <span aria-hidden>←</span>
            На главную
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-slate-300 transition-colors hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Личный кабинет
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
          Платный уровень
        </p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          {courseMeta.title}
        </h1>
        <p className="mt-4 text-lg text-slate-300 sm:text-xl">
          {courseMeta.subtitle}
        </p>
        <p className="mt-4 text-base leading-relaxed text-slate-400 sm:text-lg">
          {courseMeta.goal}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-200 sm:text-sm">
            <span aria-hidden>📚</span>
            {summary.modules} {pluralize(summary.modules, MODULE_FORMS)}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-slate-300 sm:text-sm">
            <span aria-hidden>🎓</span>
            {summary.lessons} {pluralize(summary.lessons, LESSON_FORMS)}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-slate-300 sm:text-sm">
            <span aria-hidden>⏱️</span>
            {formatHours(confidentCourse.modules.flatMap((item) => item.lessons))}
          </span>
        </div>

        <p className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-4 text-sm leading-relaxed text-emerald-100/85">
          Уровень входит в подписку: доступ к урокам открывается вместе с ней.{" "}
          <Link
            href="/subscription"
            className="font-semibold text-emerald-200 underline-offset-4 transition-colors hover:text-emerald-100 hover:underline"
          >
            Посмотреть тарифы
          </Link>
        </p>

        <div className="mt-12 space-y-10">
          {confidentModules.map((courseModule) => (
            <section
              key={courseModule.module_id}
              className="rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-9"
            >
              <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
                Модуль {courseModule.module_order}
              </p>
              <h2 className="mt-3 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                {courseModule.module_title}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-slate-400">
                {courseModule.module_description}
              </p>

              <ul className="mt-6 space-y-3">
                {courseModule.lessons.map((lesson) => (
                  <li key={lesson.lesson_id}>
                    {lesson.blocks.length > 0 ? (
                      <Link
                        href={`/course/confident/${encodeURIComponent(courseModule.module_id)}/${encodeURIComponent(lesson.lesson_id)}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-950/40 px-5 py-4 text-base font-medium text-slate-200 transition-colors hover:border-emerald-400/50 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                      >
                        <span>
                          {lesson.lesson_id} · {lesson.lesson_title}
                        </span>
                        <span className="text-sm text-slate-400">
                          {lesson.duration} <span aria-hidden>→</span>
                        </span>
                      </Link>
                    ) : (
                      <span className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-950/40 px-5 py-4 text-base font-medium text-slate-400">
                        <span>
                          {lesson.lesson_id} · {lesson.lesson_title}
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                          Готовится
                        </span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-10 text-sm leading-relaxed text-slate-500">
          Уровень продолжает базовый курс: там разобраны физика процесса,
          калибровка и типичные дефекты, здесь — безопасность мастерской,
          тонкости слайсера и управление принтером.
        </p>
      </main>
    </div>
  );
}
