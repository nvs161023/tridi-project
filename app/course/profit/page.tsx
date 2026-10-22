import Link from "next/link";
import { redirect } from "next/navigation";

import coursesData from "@/data/courses.json";
import { resolveUserId } from "@/lib/current-user";
import { profitCourse, profitModules } from "@/lib/profit-course";
import { PREVIEW_LESSONS } from "@/lib/course-access";
import {
  LESSON_FORMS,
  MODULE_FORMS,
  formatHours,
  pluralize,
  summarizeCourse,
} from "@/lib/course-stats";
import { hasCourseAccess } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";

/**
 * Уровень «Заработок»: /course/profit — программа из двух модулей.
 *
 * Страница открывается любому вошедшему человеку: она показывает, что за уровень
 * и какие в нём уроки. Сам материал уроков — платный, его отдаёт страница урока
 * (/course/profit/<модуль>/<урок>), где доступ решает покупка или подписка.
 *
 * Материалы уровня пишутся по частям, поэтому у урока может быть пустой blocks:
 * такой урок не ссылка, а строка с отметкой «Готовится». Отметка исчезает сама,
 * когда в файле данных появляются блоки — отдельного «режима разработки» нет.
 */
const courseMeta = coursesData.profit;
const summary = summarizeCourse(profitCourse);

export const metadata = {
  title: "Заработок на 3D-печати — 3D-печать с нуля",
  description:
    "Уровень «Заработок» TriDi: 8 уроков о нишах, расчёте цены, клиентах, серийной печати, маркетинге, упаковке и налогах. Первые два урока открыты без покупки.",
  // Программа уровня живёт в закрытом разделе: middleware уводит гостя на
  // вход, поэтому робот видит редирект, а не страницу. noindex фиксирует это
  // явно — индексировать адрес, который робот не может открыть, бессмысленно.
  robots: { index: false, follow: false },
};

export default async function ProfitCoursePage() {
  // Гостя сюда не пустит middleware (см. middleware.ts), но проверку дублируем:
  // страница уровня живёт в закрытом разделе /course.
  const supabase = await createClient();
  const userId = await resolveUserId(supabase);

  if (!userId) {
    redirect(`/auth/login?next=${encodeURIComponent("/course/profit")}`);
  }

  // Доступ решает страница урока, но программе он нужен тоже: без покупки
  // первые PREVIEW_LESSONS урока открыты, и об этом лучше сказать до клика.
  const hasAccess = await hasCourseAccess(supabase, userId, "profit");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <span aria-hidden>←</span>
            На главную
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-slate-300 transition-colors hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Личный кабинет
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-sm font-semibold uppercase tracking-widest text-rose-300">
          Платный уровень
        </p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          {courseMeta.title}
        </h1>
        <p className="mt-4 text-lg text-slate-300 sm:text-xl">
          {courseMeta.subtitle}
        </p>
        <p className="mt-4 text-base leading-relaxed text-slate-300 sm:text-lg">
          {courseMeta.goal}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-rose-500/40 bg-rose-500/10 px-4 py-1.5 text-xs font-semibold text-rose-200 sm:text-sm">
            <span aria-hidden>📚</span>
            {summary.modules} {pluralize(summary.modules, MODULE_FORMS)}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-slate-300 sm:text-sm">
            <span aria-hidden>🎓</span>
            {summary.lessons} {pluralize(summary.lessons, LESSON_FORMS)}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-slate-300 sm:text-sm">
            <span aria-hidden>⏱️</span>
            {formatHours(profitCourse.modules.flatMap((item) => item.lessons))}
          </span>
        </div>

        <p className="mt-8 rounded-2xl border border-rose-500/30 bg-rose-500/5 px-5 py-4 text-sm leading-relaxed text-rose-100/85">
          {hasAccess ? (
            <>
              Уровень открыт целиком: все уроки, тесты модулей с разбором и
              визуализации. Доступ остаётся навсегда:{" "}
              <Link
                href="/subscription"
                className="font-semibold text-rose-200 underline-offset-4 transition-colors hover:text-rose-100 hover:underline"
              >
                Посмотреть тарифы
              </Link>
            </>
          ) : (
            <>
              Первые два урока открыты без покупки — прочитай и реши, нужен ли
              уровень. Весь уровень покупается навсегда:{" "}
              <Link
                href="/subscription"
                className="font-semibold text-rose-200 underline-offset-4 transition-colors hover:text-rose-100 hover:underline"
              >
                Посмотреть тарифы
              </Link>
            </>
          )}
        </p>

        <div className="mt-12 space-y-10">
          {profitModules.map((courseModule) => (
            <section
              key={courseModule.module_id}
              className="rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-9"
            >
              <p className="text-sm font-semibold uppercase tracking-widest text-rose-300">
                Модуль {courseModule.module_order}
              </p>
              <h2 className="mt-3 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                {courseModule.module_title}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-slate-300">
                {courseModule.module_description}
              </p>

              <ul className="mt-6 space-y-3">
                {courseModule.lessons.map((lesson) => (
                  <li key={lesson.lesson_id}>
                    {lesson.blocks.length > 0 ? (
                      <Link
                        href={`/course/profit/${encodeURIComponent(courseModule.module_id)}/${encodeURIComponent(lesson.lesson_id)}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-950/40 px-5 py-4 text-base font-medium text-slate-200 transition-colors hover:border-rose-400/50 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                      >
                        <span>
                          {lesson.lesson_id} · {lesson.lesson_title}
                        </span>
                        <span className="flex items-center gap-2 text-sm text-slate-300">
                          {!hasAccess && lesson.lesson_order <= PREVIEW_LESSONS ? (
                            <span className="rounded-full border border-rose-400/40 bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-rose-200">
                              Превью
                            </span>
                          ) : null}
                          {!hasAccess && lesson.lesson_order > PREVIEW_LESSONS ? (
                            <span
                              className="text-slate-400"
                              title="Открывается после покупки уровня"
                            >
                              <span aria-hidden>🔒</span>
                              <span className="sr-only">
                                Открывается после покупки уровня
                              </span>
                            </span>
                          ) : null}
                          {lesson.duration} <span aria-hidden>→</span>
                        </span>
                      </Link>
                    ) : (
                      <span className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-950/40 px-5 py-4 text-base font-medium text-slate-300">
                        <span>
                          {lesson.lesson_id} · {lesson.lesson_title}
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-widest text-slate-300">
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

        <p className="mt-10 text-sm leading-relaxed text-slate-300">
          Уровень продолжает «Инженера»: там деталь считается до печати и
          повторяется по замерам, здесь — что продавать, сколько просить,
          как договориться с заказчиком и как оформить доход.
        </p>
      </main>
    </div>
  );
}
