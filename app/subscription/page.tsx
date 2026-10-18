import type { Metadata } from "next";
import Link from "next/link";

import { Header } from "@/components/Header";
import coursesData from "@/data/courses.json";
import { authHref } from "@/lib/auth-redirect";
import { LEGAL_OPERATOR } from "@/lib/legal";
import {
  LEVELS,
  PAID_LESSONS,
  PAID_TESTS,
  PAID_VISUALS,
  PRO_HOURS,
  PRO_LESSONS,
  PRO_VISUALS,
  TOTAL_LESSONS,
  TOTAL_TESTS,
  TOTAL_VISUALS,
  type CourseLevel,
} from "@/lib/course-levels";
import {
  LESSON_FORMS,
  TEST_FORMS,
  VISUAL_FORMS,
  pluralize,
} from "@/lib/course-stats";

import { PlanButton } from "./PlanButton";

export const metadata: Metadata = {
  title: "Тарифы — 3D-печать с нуля",
  description:
    "Первый уровень бесплатно, подписка Pro открывает три платных уровня, тесты и продвинутый курс. Цены, сравнение уровней, отзывы и частые вопросы.",
};

const { pro: proCourse } = coursesData;

/** Цена Pro — из data/courses.json: тот же источник, что и на главной. */
const proPrice = new Intl.NumberFormat("ru-RU").format(proCourse.price);

/** Регистрация с возвратом в первый бесплатный урок. */
const START_FREE_HREF = authHref("/auth/sign-up", "/course/lesson-1");

/** Цвета уровня: таблица, мобильные карточки и бейджи. */
const LEVEL_STYLES: Record<
  CourseLevel["key"],
  { line: string; text: string; badge: string; soft: string }
> = {
  basic: {
    line: "from-blue-500 to-cyan-400",
    text: "text-blue-300",
    badge: "border-blue-400/40 bg-blue-500/10 text-blue-200",
    soft: "from-blue-500/10",
  },
  confident: {
    line: "from-violet-500 to-fuchsia-400",
    text: "text-violet-300",
    badge: "border-violet-400/40 bg-violet-500/10 text-violet-200",
    soft: "from-violet-500/10",
  },
  engineer: {
    line: "from-emerald-500 to-teal-400",
    text: "text-emerald-300",
    badge: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
    soft: "from-emerald-500/10",
  },
  profit: {
    line: "from-amber-500 to-orange-400",
    text: "text-amber-300",
    badge: "border-amber-400/40 bg-amber-500/10 text-amber-200",
    soft: "from-amber-500/10",
  },
};

/** Строки сравнительной таблицы: одинаковые для десктопа и мобильных карточек. */
const COMPARISON_ROWS: { label: string; values: string[] }[] = [
  {
    label: "Стоимость",
    values: LEVELS.map((level) =>
      level.isFree ? "0 ₽ навсегда" : "Входит в Pro",
    ),
  },
  {
    label: "Уроки",
    values: LEVELS.map(
      (level) => `${level.lessons} ${pluralize(level.lessons, LESSON_FORMS)}`,
    ),
  },
  {
    label: "Наглядные схемы",
    values: LEVELS.map(
      (level) => `${level.visuals} ${pluralize(level.visuals, VISUAL_FORMS)}`,
    ),
  },
  {
    label: "Тесты модулей",
    values: LEVELS.map(
      (level) => `${level.tests} ${pluralize(level.tests, TEST_FORMS)}`,
    ),
  },
  {
    label: "Длительность",
    values: LEVELS.map((level) => level.hours),
  },
  {
    label: "Для кого",
    values: LEVELS.map((level) => level.audience),
  },
];

/**
 * Четыре вопроса, которые чаще всего задают перед оплатой.
 *
 * Числа бесплатного уровня берём из LEVELS, а не пишем руками: если курс
 * изменится, FAQ не начнёт обещать старое количество уроков и схем.
 */
const FAQ: { question: string; answer: string }[] = [
  {
    question: "Чем бесплатный уровень отличается от Pro?",
    answer: `Бесплатно открыт уровень «Новичок» целиком: ${LEVELS[0].lessons} ${pluralize(LEVELS[0].lessons, LESSON_FORMS)}, ${LEVELS[0].visuals} ${pluralize(LEVELS[0].visuals, VISUAL_FORMS)} и ${LEVELS[0].tests} ${pluralize(LEVELS[0].tests, TEST_FORMS)} модулей. Pro открывает три платных уровня — «Уверенный», «Инженер» и «Заработок» — и продвинутый курс. Всё это входит в одну подписку.`,
  },
  {
    question: "Как работает подписка?",
    answer:
      "Оплата за 30 дней доступа. Одна действующая подписка открывает все платные материалы сразу — покупать уровни по отдельности не нужно. Продление — по желанию, в личном кабинете.",
  },
  {
    question: "Можно ли отменить подписку?",
    answer:
      "Да, в любой момент в личном кабинете. Доступ сохраняется до конца уже оплаченного периода, дальше деньги не списываются.",
  },
  {
    question: "Дают ли чек об оплате?",
    answer:
      "Да. Исполнитель работает как плательщик НПД: чек формируется в приложении «Мой налог» и приходит на email, указанный при оплате.",
  },
];

/**
 * Страница отдаётся на каждый запрос, а не готовится на этапе сборки.
 *
 * <Header /> читает cookies пользователя через Supabase. При статической
 * генерации Next.js выполняет его во время сборки, а переменных окружения в
 * контейнере сборки может не быть. С force-dynamic сборка не зависит от
 * секретов — как и на главной (см. комментарий в app/page.tsx).
 */
export const dynamic = "force-dynamic";

export default function SubscriptionPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />

      <main>
        {/* Герой: одно обещание и два действия */}
        <section className="relative overflow-hidden border-b border-white/10">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-amber-500/15 blur-3xl sm:h-[38rem] sm:w-[38rem]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute top-32 -right-24 h-72 w-72 rounded-full bg-blue-600/15 blur-3xl"
          />

          <div className="relative mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
            <p className="text-sm font-semibold tracking-widest text-amber-400 uppercase">
              Тарифы
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
              Один путь.
              <br />
              Четыре уровня.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl">
              Первый уровень — бесплатно и без карты. Подписка Pro открывает
              «Уверенный», «Инженер» и «Заработок», их тесты и продвинутый курс.
            </p>

            <div className="mt-7 flex flex-wrap gap-2.5 text-xs font-semibold sm:text-sm">
              <span className="rounded-full border border-blue-400/40 bg-blue-500/10 px-3.5 py-1.5 text-blue-200">
                0 ₽ на старте
              </span>
              <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3.5 py-1.5 text-amber-200">
                {proPrice} ₽/мес — Pro
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300">
                Отмена в кабинете
              </span>
            </div>

            <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Link
                href={START_FREE_HREF}
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-blue-600 px-8 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Начать бесплатно
                <span aria-hidden>→</span>
              </Link>
              <a
                href="#pro"
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-8 text-lg font-semibold text-slate-950 shadow-lg shadow-amber-500/25 transition-colors hover:from-amber-300 hover:to-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Оформить подписку Pro
              </a>
            </div>

            <p className="mt-6 text-sm text-slate-400">
              <span aria-hidden>✅</span> На бесплатном уровне карта не нужна. Pro
              — 30 дней доступа, чек НПД на email.
            </p>
          </div>
        </section>

        {/* Сравнение четырёх уровней */}
        <section aria-labelledby="compare-title" className="border-b border-white/10">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <p className="text-sm font-semibold tracking-widest text-blue-400 uppercase">
              Что входит
            </p>
            <h2
              id="compare-title"
              className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl"
            >
              Сравнение четырёх уровней
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
              В проекте {TOTAL_LESSONS} уроков, {TOTAL_VISUALS} схем и{" "}
              {TOTAL_TESTS} тестов модулей. В таблице — только то, что входит в
              каждый уровень.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/5 px-5 py-4 text-sm text-slate-300">
              <span aria-hidden className="text-amber-300">
                ◆
              </span>
              <span>
                <strong className="text-white">Подписка Pro</strong> —{" "}
                {proPrice} ₽/мес. Открывает все три платных уровня сразу:{" "}
                {PAID_LESSONS} уроков, {PAID_VISUALS} схем и {PAID_TESTS} тестов.
              </span>
            </div>

            {/* Десктоп: настоящая таблица с колонками уровней */}
            <div className="mt-8 hidden overflow-hidden rounded-3xl border border-white/10 lg:block">
              <table className="w-full table-fixed border-collapse text-left">
                <caption className="sr-only">
                  Сравнение уровней «Новичок», «Уверенный», «Инженер» и
                  «Заработок»
                </caption>
                <thead>
                  <tr className="bg-white/5">
                    <th
                      scope="col"
                      className="w-1/5 px-4 py-5 text-xs font-semibold tracking-widest text-slate-400 uppercase"
                    >
                      Уровень
                    </th>
                    {LEVELS.map((level) => {
                      const style = LEVEL_STYLES[level.key];

                      return (
                        <th
                          key={level.key}
                          scope="col"
                          className={`border-l border-white/10 px-4 py-5 align-top ${
                            level.isFree
                              ? "bg-blue-500/[0.06]"
                              : "bg-amber-500/[0.04]"
                          }`}
                        >
                          <span
                            className={`text-[11px] font-semibold tracking-[0.16em] uppercase ${style.text}`}
                          >
                            {level.code}
                          </span>
                          <span className="mt-1 block text-lg font-bold text-white">
                            {level.shortTitle}
                          </span>
                          <span
                            className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${style.badge}`}
                          >
                            {level.isFree ? "0 ₽" : "В Pro"}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row) => (
                    <tr key={row.label} className="border-t border-white/10">
                      <th
                        scope="row"
                        className="px-4 py-3.5 text-sm font-medium text-slate-400"
                      >
                        {row.label}
                      </th>
                      {row.values.map((value, index) => (
                        <td
                          key={`${row.label}-${LEVELS[index].key}`}
                          className="border-l border-white/10 px-4 py-3.5 text-sm leading-relaxed text-slate-300"
                        >
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-t border-white/10 bg-white/[0.03]">
                    <th
                      scope="row"
                      className="px-4 py-4 text-sm font-medium text-slate-400"
                    >
                      Старт
                    </th>
                    {LEVELS.map((level) => (
                      <td
                        key={level.key}
                        className="border-l border-white/10 px-4 py-4"
                      >
                        <Link
                          href={level.isFree ? START_FREE_HREF : "#pro"}
                          className={`inline-flex min-h-10 items-center justify-center rounded-full px-4 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                            level.isFree
                              ? "bg-blue-600 text-white hover:bg-blue-500"
                              : "border border-amber-400/40 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20"
                          }`}
                        >
                          {level.isFree ? "Начать бесплатно" : "Выбрать Pro"}
                        </Link>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Мобильный вариант той же таблицы: карточки уровней */}
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:hidden">
              {LEVELS.map((level) => {
                const style = LEVEL_STYLES[level.key];

                return (
                  <article
                    key={level.key}
                    className={`relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b ${style.soft} to-slate-900/60 p-5`}
                  >
                    <div
                      aria-hidden
                      className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${style.line}`}
                    />
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`text-[11px] font-semibold tracking-[0.16em] uppercase ${style.text}`}
                      >
                        {level.code}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${style.badge}`}
                      >
                        {level.isFree ? "Бесплатно" : "В Pro"}
                      </span>
                    </div>

                    <h3 className="mt-3 text-xl font-extrabold text-white">
                      {level.shortTitle}
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {level.audience}
                    </p>

                    <dl className="mt-4 space-y-2 border-y border-white/10 py-3 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-slate-500">Уроки</dt>
                        <dd className="font-medium text-slate-200">
                          {level.lessons}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-slate-500">Схемы</dt>
                        <dd className="font-medium text-slate-200">
                          {level.visuals}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-slate-500">Тесты</dt>
                        <dd className="font-medium text-slate-200">
                          {level.tests}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-slate-500">Длительность</dt>
                        <dd className="font-medium text-slate-200">
                          {level.hours}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-slate-500">Стоимость</dt>
                        <dd
                          className={`font-semibold ${
                            level.isFree ? "text-blue-300" : "text-amber-300"
                          }`}
                        >
                          {level.isFree ? "0 ₽" : "В Pro"}
                        </dd>
                      </div>
                    </dl>

                    <Link
                      href={level.isFree ? START_FREE_HREF : "#pro"}
                      className={`mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                        level.isFree
                          ? "bg-blue-600 text-white hover:bg-blue-500"
                          : "border border-amber-400/40 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20"
                      }`}
                    >
                      {level.isFree ? "Начать бесплатно" : "Выбрать Pro"}
                    </Link>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Два способа начать: бесплатно или Pro */}
        <section id="pro" className="scroll-mt-20 border-b border-white/10">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <p className="text-sm font-semibold tracking-widest text-amber-400 uppercase">
              Подписка
            </p>
            <h2 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Начни бесплатно. Открой всё — когда будешь готов
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
              Одна подписка Pro вместо трёх отдельных покупок. Бесплатный уровень
              остаётся доступен всегда — даже без подписки.
            </p>

            <div className="mt-12 grid gap-6 lg:grid-cols-2 lg:gap-8">
              {/* Новичок — 0 ₽ */}
              <article className="flex flex-col rounded-3xl border border-blue-500/30 bg-slate-900/60 p-7 sm:p-9">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                    Новичок
                  </h3>
                  <span className="rounded-full border border-blue-400/40 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-200">
                    Бесплатно навсегда
                  </span>
                </div>

                <p className="mt-5 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-white">0 ₽</span>
                  <span className="text-sm text-slate-400">без карты</span>
                </p>

                <p className="mt-4 text-sm leading-relaxed text-slate-400 sm:text-base">
                  {LEVELS[0].goal}
                </p>

                <ul className="mt-6 space-y-3 text-sm leading-relaxed text-slate-300 sm:text-base">
                  <li className="flex items-start gap-3">
                    <span aria-hidden className="text-blue-300">
                      ✓
                    </span>
                    {LEVELS[0].lessons} уроков, {LEVELS[0].visuals} схем и{" "}
                    {LEVELS[0].tests} теста модулей
                  </li>
                  <li className="flex items-start gap-3">
                    <span aria-hidden className="text-blue-300">
                      ✓
                    </span>
                    Тесты с пояснениями к каждому ответу
                  </li>
                  <li className="flex items-start gap-3">
                    <span aria-hidden className="text-blue-300">
                      ✓
                    </span>
                    Первый проект целиком: от детали до замеров
                  </li>
                  <li className="flex items-start gap-3">
                    <span aria-hidden className="text-blue-300">
                      ✓
                    </span>
                    Прогресс уроков и тестов в личном кабинете
                  </li>
                </ul>

                <div className="mt-auto pt-8">
                  <Link
                    href={START_FREE_HREF}
                    className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-8 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  >
                    Начать бесплатно
                    <span aria-hidden>→</span>
                  </Link>
                  <p className="mt-3 text-center text-xs text-slate-500">
                    Регистрация нужна, чтобы сохранять прогресс. Карта — нет.
                  </p>
                </div>
              </article>

              {/* Pro — 1 490 ₽/мес */}
              <article className="relative flex flex-col overflow-hidden rounded-3xl border-2 border-amber-400/50 bg-gradient-to-b from-amber-500/10 via-slate-900/80 to-slate-900/90 p-7 shadow-xl shadow-amber-950/30 sm:p-9">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl"
                />

                <div className="relative flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                    Подписка Pro
                  </h3>
                  <span className="rounded-full border border-amber-400/50 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
                    30 дней доступа
                  </span>
                </div>

                <p className="relative mt-5 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-white">
                    {proPrice} ₽
                  </span>
                  <span className="text-sm text-slate-400">/мес</span>
                </p>

                <p className="relative mt-4 text-sm leading-relaxed text-slate-300 sm:text-base">
                  {proCourse.goal}
                </p>

                <ul className="relative mt-6 space-y-3 text-sm leading-relaxed text-slate-300 sm:text-base">
                  <li className="flex items-start gap-3">
                    <span aria-hidden className="text-amber-300">
                      ✓
                    </span>
                    Все три платных уровня: {PAID_LESSONS} уроков и{" "}
                    {PAID_VISUALS} схем
                  </li>
                  <li className="flex items-start gap-3">
                    <span aria-hidden className="text-amber-300">
                      ✓
                    </span>
                    {PAID_TESTS} тестов модулей с пояснениями к ответам
                  </li>
                  <li className="flex items-start gap-3">
                    <span aria-hidden className="text-amber-300">
                      ✓
                    </span>
                    Продвинутый курс: {PRO_LESSONS} уроков, {PRO_VISUALS} схем,{" "}
                    {PRO_HOURS}
                  </li>
                  <li className="flex items-start gap-3">
                    <span aria-hidden className="text-amber-300">
                      ✓
                    </span>
                    Одна подписка на все платные материалы — без доплат за уровни
                  </li>
                </ul>

                <div className="relative mt-auto pt-8">
                  <PlanButton
                    label="Оформить подписку Pro"
                    variant="gold"
                    message="Оплата подключается — скоро здесь будет ЮKassa"
                  />
                  <p className="mt-3 text-center text-xs leading-relaxed text-slate-500">
                    Онлайн-оплата подключается: кнопка пока показывает заглушку.
                    Условия оплаты, чеков и возврата — в{" "}
                    <Link
                      href="/legal/offer"
                      className="text-slate-400 underline underline-offset-2 transition-colors hover:text-amber-200"
                    >
                      оферте
                    </Link>
                    .
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* Отзывы: честные плейсхолдеры, без выдуманных историй */}
        <section
          aria-labelledby="reviews-title"
          className="border-b border-white/10"
        >
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <p className="text-sm font-semibold tracking-widest text-violet-400 uppercase">
              Отзывы
            </p>
            <h2
              id="reviews-title"
              className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl"
            >
              Здесь будут реальные истории
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
              Мы не публикуем выдуманные отзывы. Места подготовлены под первые
              потоки: человек расскажет, что напечатал, где застрял и что
              изменилось в его мастерской.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3 lg:gap-5">
              {["Первый", "Второй", "Третий"].map((slot) => (
                <figure
                  key={slot}
                  className="flex h-full flex-col rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-6"
                >
                  <div
                    aria-hidden
                    className="text-sm tracking-[0.2em] text-amber-400/40"
                  >
                    ★★★★★
                  </div>
                  <blockquote className="mt-4 text-sm leading-relaxed text-slate-500 italic">
                    «{slot} отзыв: что получилось напечатать, что оказалось
                    сложным и чем помог курс».
                  </blockquote>
                  <figcaption className="mt-auto flex items-center gap-3 pt-6">
                    <span
                      aria-hidden
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-slate-500"
                    >
                      ?
                    </span>
                    <span className="text-xs text-slate-500">
                      Имя · уровень · дата
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>

            <p className="mt-6 text-xs leading-relaxed text-slate-500">
              Плейсхолдеры уберём, когда появятся настоящие отзывы с согласием
              авторов на публикацию.
            </p>
          </div>
        </section>

        {/* FAQ: нативные details — работают без клиентского JS */}
        <section aria-labelledby="faq-title">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <p className="text-sm font-semibold tracking-widest text-emerald-400 uppercase">
              FAQ
            </p>
            <h2
              id="faq-title"
              className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl"
            >
              Частые вопросы
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
              Коротко о подписке, доступе и оплате. Если вопроса нет в списке —
              напишите на почту из футера.
            </p>

            <div className="mt-10 grid items-start gap-3 lg:grid-cols-2 lg:gap-4">
              {FAQ.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-2xl border border-white/10 bg-white/5 px-5 py-4 transition-colors open:border-white/20 sm:px-6 sm:py-5"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-white [&::-webkit-details-marker]:hidden">
                    {item.question}
                    <span
                      aria-hidden
                      className="shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180"
                    >
                      ⌄
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Условия оплаты рядом с тарифами, а не только в футере */}
        <section className="border-t border-white/10">
          <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
              <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                Оплата, чеки и возврат
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
                Оплачивая подписку, вы соглашаетесь с{" "}
                <Link
                  href="/legal/offer"
                  className="font-semibold text-blue-300 underline underline-offset-4 transition-colors hover:text-blue-200"
                >
                  Публичной офертой
                </Link>{" "}
                и{" "}
                <Link
                  href="/legal/privacy"
                  className="font-semibold text-blue-300 underline underline-offset-4 transition-colors hover:text-blue-200"
                >
                  Политикой обработки персональных данных
                </Link>
                . Исполнитель работает как плательщик НПД: чек формируется в
                приложении «Мой налог» и приходит на email. Отмена подписки — в
                личном кабинете, доступ сохраняется до конца оплаченного периода.
              </p>
              <p className="mt-3 text-sm text-slate-400">
                Вопросы по оплате и доступу:{" "}
                <a
                  href={`mailto:${LEGAL_OPERATOR.email}`}
                  className="font-medium text-blue-300 transition-colors hover:text-blue-200"
                >
                  {LEGAL_OPERATOR.email}
                </a>
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}






