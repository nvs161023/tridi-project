import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PlanButton } from "@/app/subscription/PlanButton";
import { Header } from "@/components/Header";
import { authHref } from "@/lib/auth-redirect";
import { getCourseLanding } from "@/lib/course-landing";
import {
  LESSON_FORMS,
  MODULE_FORMS,
  TEST_FORMS,
  VISUAL_FORMS,
  pluralize,
} from "@/lib/course-stats";

type CoursePageProps = {
  params: Promise<{ id: string }>;
};

const QUESTION_FORMS: [string, string, string] = [
  "вопрос",
  "вопроса",
  "вопросов",
];

const formatPrice = (price: number) =>
  new Intl.NumberFormat("ru-RU").format(price);

/**
 * Метаданные отдельного курса: заголовок и описание важнее, чем у витрины,
 * потому что страница должна находиться по запросу «курс 3D-печати инженер».
 * Неизвестный адрес не обещает курс, а отдаёт обычный заголовок 404.
 */
export async function generateMetadata({
  params,
}: CoursePageProps): Promise<Metadata> {
  const { id } = await params;
  const course = getCourseLanding(id);

  if (!course) {
    return {
      title: "Курс не найден — TriDi",
      robots: { index: false, follow: false },
    };
  }

  const description = `${course.subtitle}. ${course.lessons} ${pluralize(
    course.lessons,
    LESSON_FORMS,
  )}, ${course.visuals} ${pluralize(
    course.visuals,
    VISUAL_FORMS,
  )} и ${course.tests} ${pluralize(
    course.tests,
    TEST_FORMS,
  )}. Доступ навсегда, без подписки на уроки.`;

  // У пакета название «Всё включено» ничего не говорит поиску: в заголовке
  // важнее запрос «курсы 3D-печати пакетом».
  const title =
    course.id === "pro"
      ? "Все курсы 3D-печати пакетом — TriDi"
      : `${course.title} — TriDi`;

  return {
    title,
    description,
    alternates: { canonical: `/courses/${course.id}` },
    openGraph: {
      title,
      description,
      type: "website",
      url: `/courses/${course.id}`,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

/**
 * Страница отдаётся на каждый запрос, а не готовится на этапе сборки.
 *
 * <Header /> читает cookies пользователя через Supabase. При статической
 * генерации Next.js выполняет его во время сборки, а переменных окружения в
 * контейнере сборки может не быть. С force-dynamic сборка не зависит от
 * секретов — как на главной и странице тарифов.
 */
export const dynamic = "force-dynamic";

export default async function CourseLandingPage({ params }: CoursePageProps) {
  const { id } = await params;
  const course = getCourseLanding(id);

  if (!course) {
    notFound();
  }

  const price = formatPrice(course.price);
  const oldPrice = course.oldPrice ? formatPrice(course.oldPrice) : null;
  const saving = course.saving ? formatPrice(course.saving) : null;
  const loginHref = authHref("/auth/login", `/courses/${course.id}`);

  const stats = [
    { value: course.modules, label: pluralize(course.modules, MODULE_FORMS) },
    { value: course.lessons, label: pluralize(course.lessons, LESSON_FORMS) },
    { value: course.visuals, label: pluralize(course.visuals, VISUAL_FORMS) },
    { value: course.tests, label: pluralize(course.tests, TEST_FORMS) },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />

      <main>
        {/* Герой: боль, обещание, цена и покупка в одном экране */}
        <section className="relative overflow-hidden border-b border-white/10">
          <div
            aria-hidden
            className={`pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full blur-3xl sm:h-[42rem] sm:w-[42rem] ${course.theme.glow}`}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute top-40 -right-24 h-72 w-72 rounded-full bg-blue-600/10 blur-3xl"
          />

          <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
            <div>
              <Link
                href="/subscription"
                className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-400 transition-colors hover:text-white"
              >
                <span aria-hidden>←</span>
                Все тарифы
              </Link>

              <p
                className={`mt-8 text-sm font-semibold tracking-widest uppercase ${course.theme.text}`}
              >
                {course.kicker}
              </p>
              <h1 className="mt-4 max-w-3xl text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
                {course.title}
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
                {course.subtitle}
              </p>

              <p
                className={`mt-7 max-w-2xl rounded-2xl border-l-2 bg-white/5 px-5 py-4 text-base leading-relaxed text-slate-200 ${course.theme.border}`}
              >
                {course.problem}
              </p>

              <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-400">
                {course.goal}
              </p>

              <dl className="mt-8 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3"
                  >
                    <dt className="text-2xl font-extrabold text-white">
                      {stat.value}
                    </dt>
                    <dd className="mt-0.5 text-xs text-slate-400">
                      {stat.label}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <aside
              className={`rounded-3xl border bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/60 lg:sticky lg:top-24 ${course.theme.border}`}
            >
              <p
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold tracking-wide uppercase ${course.theme.badge}`}
              >
                {course.badge ?? "Доступ навсегда"}
              </p>

              <div className="mt-5 flex flex-wrap items-baseline gap-3">
                <span className="text-4xl font-extrabold tracking-tight text-white">
                  {price} ₽
                </span>
                {oldPrice ? (
                  <span className="text-lg text-slate-500 line-through">
                    {oldPrice} ₽
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-slate-400">
                Разовый платёж. Доступ остаётся навсегда.
              </p>
              {saving ? (
                <p className="mt-3 inline-flex rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  Экономия {saving} ₽ против трёх курсов
                </p>
              ) : null}

              <div className="mt-6">
                <PlanButton
                  label={`Купить за ${price} ₽`}
                  courseId={course.paymentId}
                  variant={course.theme.button}
                  loginHref={loginHref}
                />
              </div>

              <Link
                href="/subscription"
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/15 px-5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/30 hover:text-white"
              >
                Сравнить с другими курсами
              </Link>

              <ul className="mt-6 space-y-2 border-t border-white/10 pt-5 text-sm text-slate-400">
                <li className="flex gap-2">
                  <span aria-hidden className={course.theme.text}>
                    ✓
                  </span>
                  Чек НПД придёт на email после оплаты
                </li>
                <li className="flex gap-2">
                  <span aria-hidden className={course.theme.text}>
                    ✓
                  </span>
                  Уроки открываются в личном кабинете
                </li>
                <li className="flex gap-2">
                  <span aria-hidden className={course.theme.text}>
                    ✓
                  </span>
                  {course.hours} практики в своём темпе
                </li>
              </ul>
            </aside>
          </div>
        </section>

        {/* Программа: модули и уроки из данных курса, без ручных чисел */}
        <section
          id="program"
          className="border-b border-white/10 bg-slate-950"
        >
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <p
              className={`text-sm font-semibold tracking-widest uppercase ${course.theme.text}`}
            >
              Программа
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Что вы получите
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-400">
              Внутри — {course.lessons}{" "}
              {pluralize(course.lessons, LESSON_FORMS)} с практикой на своём
              принтере, {course.visuals} {pluralize(course.visuals, VISUAL_FORMS)}{" "}
              и {course.tests} {pluralize(course.tests, TEST_FORMS)} с{" "}
              {course.questions} {pluralize(course.questions, QUESTION_FORMS)} и
              пояснениями к ответам.
            </p>

            <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { label: "Модулей", value: course.modules },
                { label: "Уроков", value: course.lessons },
                { label: "Схем", value: course.visuals },
                { label: "Тестов", value: course.tests },
                { label: "Длительность", value: course.hours },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3"
                >
                  <dt className="text-xs text-slate-500">{item.label}</dt>
                  <dd className="mt-1 text-lg font-bold text-white">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-10 space-y-10">
              {course.program.map((group, groupIndex) => (
                <div key={group.key}>
                  {course.program.length > 1 ? (
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4">
                      <div>
                        <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase">
                          Уровень {groupIndex + 1}
                        </p>
                        <h3 className="mt-1 text-2xl font-extrabold text-white">
                          {group.title}
                        </h3>
                        <p className="mt-1 text-sm text-slate-400">
                          {group.subtitle}
                        </p>
                      </div>
                      <p className="text-sm text-slate-400">
                        {group.lessons}{" "}
                        {pluralize(group.lessons, LESSON_FORMS)} ·{" "}
                        {group.modules.length}{" "}
                        {pluralize(group.modules.length, MODULE_FORMS)}
                      </p>
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    {group.modules.map((courseModule, moduleIndex) => (
                      <details
                        key={courseModule.id}
                        open={groupIndex === 0 && moduleIndex === 0}
                        className={`group rounded-2xl border bg-slate-900/60 ${course.theme.border}`}
                      >
                        <summary className="flex cursor-pointer list-none items-start gap-3 p-4 [&::-webkit-details-marker]:hidden sm:p-5">
                          <span
                            className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ${course.theme.soft} ${course.theme.text}`}
                          >
                            {moduleIndex + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-base font-bold text-white sm:text-lg">
                              {courseModule.title}
                            </span>
                            <span className="mt-1 block text-sm leading-relaxed text-slate-400">
                              {courseModule.description}
                            </span>
                          </span>
                          <span className="hidden shrink-0 text-xs text-slate-500 sm:block">
                            {courseModule.lessons.length}{" "}
                            {pluralize(courseModule.lessons.length, LESSON_FORMS)}
                          </span>
                          <span
                            aria-hidden
                            className="mt-1 shrink-0 text-slate-500 transition-transform group-open:rotate-180"
                          >
                            ⌄
                          </span>
                        </summary>

                        <ol className="divide-y divide-white/5 border-t border-white/10">
                          {courseModule.lessons.map((lesson) => (
                            <li
                              key={lesson.code}
                              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm sm:px-5"
                            >
                              <span
                                className={`inline-flex min-w-12 justify-center rounded-md px-2 py-0.5 font-mono text-xs font-bold ${course.theme.soft} ${course.theme.text}`}
                              >
                                {lesson.code}
                              </span>
                              <span className="min-w-0 flex-1 text-slate-200">
                                {lesson.title}
                              </span>
                              {lesson.hasMaterial ? null : (
                                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-300 uppercase">
                                  Готовится
                                </span>
                              )}
                              <span className="text-xs text-slate-500">
                                {lesson.duration}
                              </span>
                            </li>
                          ))}
                        </ol>
                      </details>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Аудитория: три портрета, чтобы человек узнал себя */}
        <section
          id="audience"
          className="border-b border-white/10 bg-slate-900/30"
        >
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <p
              className={`text-sm font-semibold tracking-widest uppercase ${course.theme.text}`}
            >
              Для кого
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Курс будет полезен, если вы…
            </h2>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {course.audience.map((item, index) => (
                <article
                  key={item.title}
                  className="rounded-3xl border border-white/10 bg-slate-950/70 p-6"
                >
                  <span
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm font-extrabold ${course.theme.soft} ${course.theme.text}`}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {item.text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Результат: что человек унесёт из курса и сколько это займёт */}
        <section id="results" className="border-b border-white/10">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
            <div>
              <p
                className={`text-sm font-semibold tracking-widest uppercase ${course.theme.text}`}
              >
                Результат
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
                Что изменится после курса
              </h2>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {course.results.map((result) => (
                  <li
                    key={result}
                    className="flex gap-3 rounded-2xl border border-white/10 bg-slate-900/50 p-4 text-sm leading-relaxed text-slate-300"
                  >
                    <span
                      className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${course.theme.soft} ${course.theme.text}`}
                    >
                      ✓
                    </span>
                    {result}
                  </li>
                ))}
              </ul>
            </div>

            <aside
              className={`rounded-3xl border bg-slate-900/60 p-6 ${course.theme.border}`}
            >
              <p className="text-sm font-bold text-white">Коротко о курсе</p>
              <dl className="mt-4 divide-y divide-white/10 text-sm">
                {[
                  {
                    label: "Модулей",
                    value: `${course.modules} ${pluralize(course.modules, MODULE_FORMS)}`,
                  },
                  {
                    label: "Уроков",
                    value: `${course.lessons} ${pluralize(course.lessons, LESSON_FORMS)}`,
                  },
                  {
                    label: "Наглядных схем",
                    value: `${course.visuals} ${pluralize(course.visuals, VISUAL_FORMS)}`,
                  },
                  {
                    label: "Тестов модулей",
                    value: `${course.tests} ${pluralize(course.tests, TEST_FORMS)}`,
                  },
                  {
                    label: "Вопросов с пояснениями",
                    value: `${course.questions} ${pluralize(course.questions, QUESTION_FORMS)}`,
                  },
                  { label: "Длительность", value: course.hours },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-start justify-between gap-4 py-2.5"
                  >
                    <dt className="text-slate-400">{item.label}</dt>
                    <dd className="text-right font-semibold text-white">
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </aside>
          </div>
        </section>

        {/* Финальный экран: та же покупка, без прокрутки наверх */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${course.theme.gradient}`}
          />
          <div
            aria-hidden
            className={`pointer-events-none absolute -bottom-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full blur-3xl ${course.theme.glow}`}
          />

          <div className="relative mx-auto max-w-3xl px-5 py-16 text-center sm:px-8 sm:py-24">
            <p
              className={`text-sm font-semibold tracking-widest uppercase ${course.theme.text}`}
            >
              Следующий шаг
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Начните учиться сегодня
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-300">
              {course.subtitle}
            </p>

            <div
              className={`mx-auto mt-8 max-w-md rounded-3xl border bg-slate-950/80 p-6 text-left shadow-2xl shadow-slate-950/60 sm:p-8 ${course.theme.border}`}
            >
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="text-4xl font-extrabold tracking-tight text-white">
                  {price} ₽
                </span>
                {oldPrice ? (
                  <span className="text-lg text-slate-500 line-through">
                    {oldPrice} ₽
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-slate-400">
                Разовый платёж. Доступ остаётся навсегда.
              </p>

              <div className="mt-6">
                <PlanButton
                  label={`Купить за ${price} ₽`}
                  courseId={course.paymentId}
                  variant={course.theme.button}
                  loginHref={loginHref}
                />
              </div>

              <Link
                href="/subscription"
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/15 px-5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/30 hover:text-white"
              >
                Вернуться к тарифам
              </Link>

              <p className="mt-4 text-center text-xs leading-relaxed text-slate-500">
                Оплата через Robokassa · чек НПД на email · уроки в личном
                кабинете
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
