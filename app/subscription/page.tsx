import type { Metadata } from "next";
import Link from "next/link";

import { Header } from "@/components/Header";
import { ProBundleCard } from "@/components/landing/ProBundleCard";
import coursesData from "@/data/courses.json";
import { authHref } from "@/lib/auth-redirect";
import { resolveUserId } from "@/lib/current-user";
import { LEGAL_OPERATOR } from "@/lib/legal";
import {
  LEVELS,
  PAID_LEVELS,
  PAID_LESSONS,
  PAID_TESTS,
  PAID_VISUALS,
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
import { getPurchasedCourses, hasCourseAccess } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";

import { PlanButton } from "./PlanButton";

export const metadata: Metadata = {
  title: "Тарифы — 3D-печать с нуля",
  description:
    "Первый уровень бесплатно, три платных курса и пакет «Всё включено» — со скидкой в честь запуска платформы. Пакет открывает все курсы и Pro-инструменты навсегда, подписка Pro — инструменты на 30 дней. Цены, сравнение уровней и частые вопросы.",
};

const { pro: proCourse } = coursesData;

const formatPrice = (price: number) =>
  new Intl.NumberFormat("ru-RU").format(price);

/** Единый стиль ярких бейджей скидок на карточках тарифов. */
const DISCOUNT_BADGE =
  "rounded-full bg-amber-400 px-2.5 py-1 text-center text-[10px] font-extrabold tracking-wide text-slate-950 uppercase shadow-lg shadow-amber-500/20";

/** Цена со старой ценой для FAQ: «2 990 ₽ вместо 4 990 ₽». */
const priceWithOld = (level: CourseLevel) =>
  level.oldPrice
    ? `${formatPrice(level.price)} ₽ вместо ${formatPrice(level.oldPrice)} ₽`
    : `${formatPrice(level.price)} ₽`;

/** Цены из data/courses.json: тот же источник, что и на главной. */
const proSubscriptionPrice = formatPrice(proCourse.subscriptionPrice);
const proBundlePrice = formatPrice(proCourse.price);

/** Акция базового уровня: старая цена и бейдж берутся из data/courses.json. */
const basicLevel = LEVELS[0];
const basicOldPrice = basicLevel.oldPrice
  ? formatPrice(basicLevel.oldPrice)
  : null;
const basicBadge = basicLevel.badge ?? "Акция";

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
      level.isFree
        ? "0 ₽ навсегда"
        : `${formatPrice(level.price)} ₽ навсегда`,
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
 * Вопросы, которые чаще всего задают перед оплатой.
 *
 * Числа и цены берём из LEVELS и data/courses.json, а не пишем руками: если
 * курс или тариф изменится, FAQ не начнёт обещать старое.
 */
const FAQ: { question: string; answer: string }[] = [
  {
    question: "Чем бесплатный уровень отличается от платных?",
    answer: `Бесплатно открыт уровень «Новичок» целиком: ${LEVELS[0].lessons} ${pluralize(LEVELS[0].lessons, LESSON_FORMS)}, ${LEVELS[0].visuals} ${pluralize(LEVELS[0].visuals, VISUAL_FORMS)} и ${LEVELS[0].tests} ${pluralize(LEVELS[0].tests, TEST_FORMS)} модулей. Платные уровни можно купить по отдельности или пакетом — доступ остаётся навсегда. Подписка Pro открывает инструменты, а не уроки.`,
  },
  {
    question: "Почему «Новичок» сейчас бесплатный?",
    answer: `Это акция в честь запуска платформы. Сейчас уровень стоит 0 ₽, после акции его цена — ${basicOldPrice ?? "1 990"} ₽. Доступ, открытый во время акции, остаётся бесплатным.`,
  },
  {
    question: "Можно ли купить курс навсегда?",
    answer: `Да. Со скидкой к запуску платформы «Уверенный» стоит ${priceWithOld(LEVELS[1])}, «Инженер» — ${priceWithOld(LEVELS[2])}, «Заработок» — ${priceWithOld(LEVELS[3])}. Пакет из трёх уровней — ${proBundlePrice} ₽ вместо ${formatPrice(proCourse.oldPrice)} ₽. Он открывает все три курса и Pro-инструменты навсегда: это разовый платёж.`,
  },
  {
    question: "Как работает подписка?",
    answer:
      "Оплата за 30 дней доступа к инструментам: Конструктору 3D-моделей и библиотеке Профилей. Уроки в подписку не входят — курсы покупаются отдельно и остаются навсегда. Продление — по желанию, в личном кабинете.",
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

export default async function SubscriptionPage() {
  const supabase = await createClient();
  const userId = await resolveUserId(supabase);
  const purchasedCourses = userId
    ? await getPurchasedCourses(supabase, userId)
    : { confident: false, engineer: false, profit: false };
  const hasBundle = userId
    ? await hasCourseAccess(supabase, userId, "pro")
    : false;

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
              Первый уровень — бесплатно по акции и без карты. Платные курсы
              покупаются навсегда, а пакет «Всё включено» открывает все три
              уровня и Pro-инструменты. Подписка Pro — доступ к инструментам на
              30 дней.
            </p>

            <div className="mt-7 flex flex-wrap gap-2.5 text-xs font-semibold sm:text-sm">
              <span className="rounded-full border border-blue-400/40 bg-blue-500/10 px-3.5 py-1.5 text-blue-200">
                0 ₽ по акции
              </span>
              <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3.5 py-1.5 text-amber-200">
                Курсы от {formatPrice(LEVELS[1].price)} ₽ навсегда
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300">
                Инструменты Pro — {proSubscriptionPrice} ₽/мес
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
                href="#pricing"
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-8 text-lg font-semibold text-slate-950 shadow-lg shadow-amber-500/25 transition-colors hover:from-amber-300 hover:to-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Выбрать тариф
                <span aria-hidden>→</span>
              </a>
            </div>

            <p className="mt-6 text-sm text-slate-300">
              <span aria-hidden>✅</span> На бесплатном уровне карта не нужна.
              Курсы покупаются навсегда, подписка Pro — доступ к инструментам на
              30 дней. Чек НПД на email.
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
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
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
                {proSubscriptionPrice} ₽/мес. Открывает инструменты: Конструктор
                и Профили. Уроки не входят — купи нужный уровень навсегда или
                забери все три пакетом.
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
                      className="w-1/5 px-4 py-5 text-xs font-semibold tracking-widest text-slate-300 uppercase"
                    >
                      Уровень
                    </th>
                    {LEVELS.map((level) => {
                      const style = LEVEL_STYLES[level.key];
                      const isPurchased =
                        level.key !== "basic" && purchasedCourses[level.key];

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
                          {isPurchased ? (
                            <span className="mt-2 inline-flex rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
                              Доступ открыт
                            </span>
                          ) : (
                            <span
                              className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${style.badge}`}
                            >
                              {level.isFree
                                ? "0 ₽"
                                : `${formatPrice(level.price)} ₽`}
                            </span>
                          )}
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
                        className="px-4 py-3.5 text-sm font-medium text-slate-300"
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
                      className="px-4 py-4 text-sm font-medium text-slate-300"
                    >
                      Старт
                    </th>
                    {LEVELS.map((level) => {
                      const isPurchased =
                        level.key !== "basic" && purchasedCourses[level.key];

                      return (
                        <td
                          key={level.key}
                          className="border-l border-white/10 px-4 py-4"
                        >
                          {isPurchased ? (
                            <div className="flex flex-col items-center gap-2">
                              <span className="inline-flex rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-200">
                                Доступ открыт
                              </span>
                              <Link
                                href={`/course/${level.key}`}
                                className="inline-flex min-h-10 items-center justify-center rounded-full bg-emerald-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                              >
                                Продолжить обучение
                              </Link>
                            </div>
                          ) : (
                            <Link
                              href={level.isFree ? START_FREE_HREF : level.href}
                              className={`inline-flex min-h-10 items-center justify-center rounded-full px-4 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                                level.isFree
                                  ? "bg-blue-600 text-white hover:bg-blue-500"
                                  : "border border-amber-400/40 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20"
                              }`}
                            >
                              {level.isFree
                                ? "Начать бесплатно"
                                : "Подробнее о курсе"}
                            </Link>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Мобильный вариант той же таблицы: карточки уровней */}
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:hidden">
              {LEVELS.map((level) => {
                const style = LEVEL_STYLES[level.key];
                const isPurchased =
                  level.key !== "basic" && purchasedCourses[level.key];

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
                      {isPurchased ? (
                        <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
                          Доступ открыт
                        </span>
                      ) : (
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${style.badge}`}
                        >
                          {level.isFree ? "Бесплатно" : "Навсегда"}
                        </span>
                      )}
                    </div>

                    <h3 className="mt-3 text-xl font-extrabold text-white">
                      {level.shortTitle}
                    </h3>
                    <p className="mt-1 text-sm text-slate-300">
                      {level.audience}
                    </p>

                    <dl className="mt-4 space-y-2 border-y border-white/10 py-3 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-slate-300">Уроки</dt>
                        <dd className="font-medium text-slate-200">
                          {level.lessons}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-slate-300">Схемы</dt>
                        <dd className="font-medium text-slate-200">
                          {level.visuals}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-slate-300">Тесты</dt>
                        <dd className="font-medium text-slate-200">
                          {level.tests}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-slate-300">Длительность</dt>
                        <dd className="font-medium text-slate-200">
                          {level.hours}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-slate-300">Стоимость</dt>
                        <dd
                          className={`font-semibold ${
                            level.isFree ? "text-blue-300" : "text-amber-300"
                          }`}
                        >
                          {level.isFree
                            ? "0 ₽"
                            : `${formatPrice(level.price)} ₽`}
                        </dd>
                      </div>
                    </dl>

                    {isPurchased ? (
                      <Link
                        href={`/course/${level.key}`}
                        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                      >
                        Продолжить обучение
                        <span aria-hidden>→</span>
                      </Link>
                    ) : (
                      <Link
                        href={level.isFree ? START_FREE_HREF : level.href}
                        className={`mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                          level.isFree
                            ? "bg-blue-600 text-white hover:bg-blue-500"
                            : "border border-amber-400/40 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20"
                        }`}
                      >
                        {level.isFree ? "Начать бесплатно" : "Подробнее о курсе"}
                      </Link>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Тарифы: бесплатный старт, три курса навсегда и пакет */}
        <section id="pricing" className="scroll-mt-20 border-b border-white/10">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <p className="text-sm font-semibold tracking-widest text-amber-400 uppercase">
              Купить курсы
            </p>
            <h2 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Купить курсы (навсегда)
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Начни с бесплатного «Новичка» по акции, купи нужный уровень
              навсегда или забери все три со скидкой. Доступ остаётся у вас
              навсегда — без продлений.
            </p>

            <div className="mt-8 flex max-w-2xl items-start gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-5 py-4 text-amber-100">
              <span aria-hidden className="text-lg leading-none">
                🔥
              </span>
              <p className="text-sm font-semibold leading-relaxed">
                Цены со скидкой в честь запуска платформы
              </p>
            </div>

            <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/[0.02] p-4 sm:p-6 lg:p-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-[0.16em] text-blue-300 uppercase">
                    Купить курсы (навсегда)
                  </p>
                  <h3 className="mt-2 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                    Уровни и пакет «Всё включено»
                  </h3>
                </div>
                <p className="text-sm text-slate-300">
                  {PAID_LESSONS} уроков · {PAID_VISUALS} схем · {PAID_TESTS} тестов
                  в трёх платных уровнях
                </p>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Новичок — 0 ₽ */}
              <article className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-blue-500/30 bg-slate-900/60 p-5">
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-400"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold tracking-[0.16em] text-blue-300 uppercase">
                    {basicLevel.code}
                  </span>
                  <span className={DISCOUNT_BADGE}>{basicBadge}</span>
                </div>

                <h3 className="mt-3 text-xl font-extrabold tracking-tight text-white">
                  {LEVELS[0].shortTitle}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  {LEVELS[0].audience}
                </p>

                <p className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-3xl font-extrabold text-white">0 ₽</span>
                  {basicOldPrice ? (
                    <s className="text-sm font-semibold text-slate-300">
                      {basicOldPrice} ₽
                    </s>
                  ) : null}
                  <span className="text-xs text-slate-300">без карты</span>
                </p>
                {basicOldPrice ? (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-amber-200/90">
                    Бесплатно в честь запуска платформы. Потом —{" "}
                    {basicOldPrice} ₽.
                  </p>
                ) : null}

                <ul className="mt-4 space-y-2 border-t border-white/10 pt-4 text-xs leading-relaxed text-slate-300">
                  <li className="flex items-start gap-2">
                    <span aria-hidden className="text-blue-300">
                      ✓
                    </span>
                    {LEVELS[0].lessons} уроков и {LEVELS[0].visuals} схем
                  </li>
                  <li className="flex items-start gap-2">
                    <span aria-hidden className="text-blue-300">
                      ✓
                    </span>
                    {LEVELS[0].tests} теста модулей с пояснениями
                  </li>
                  <li className="flex items-start gap-2">
                    <span aria-hidden className="text-blue-300">
                      ✓
                    </span>
                    {LEVELS[0].outcomes[0]}
                  </li>
                  <li className="flex items-start gap-2">
                    <span aria-hidden className="text-blue-300">
                      ✓
                    </span>
                    {LEVELS[0].outcomes[1]}
                  </li>
                </ul>

                <div className="mt-auto pt-5">
                  <Link
                    href={START_FREE_HREF}
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-base font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  >
                    Начать бесплатно
                    <span aria-hidden>→</span>
                  </Link>
                  <p className="mt-2 text-center text-[11px] font-medium text-slate-300">
                    Доступ навсегда
                  </p>
                </div>
              </article>

              {PAID_LEVELS.map((level) => {
                const style = LEVEL_STYLES[level.key];
                const isPurchased = purchasedCourses[level.key];

                return (
                  <article
                    key={level.key}
                    className={`relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b ${style.soft} to-slate-900/60 p-5`}
                  >
                    <div
                      aria-hidden
                      className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${style.line}`}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[11px] font-semibold tracking-[0.16em] uppercase ${style.text}`}
                      >
                        {level.code}
                      </span>
                      {isPurchased ? (
                        <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                          Доступ открыт
                        </span>
                      ) : level.badge ? (
                        <span className={DISCOUNT_BADGE}>{level.badge}</span>
                      ) : (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style.badge}`}
                        >
                          Навсегда
                        </span>
                      )}
                    </div>

                    <h3 className="mt-3 text-xl font-extrabold tracking-tight text-white">
                      {level.shortTitle}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300">
                      {level.audience}
                    </p>

                    <p className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="text-3xl font-extrabold text-white">
                        {formatPrice(level.price)} ₽
                      </span>
                      {level.oldPrice ? (
                        <s
                          className="text-sm font-semibold text-slate-300"
                          aria-label={`Старая цена: ${formatPrice(level.oldPrice)} ₽`}
                        >
                          {formatPrice(level.oldPrice)} ₽
                        </s>
                      ) : null}
                      <span className="text-xs text-slate-300">разово</span>
                    </p>

                    <ul className="mt-4 space-y-2 border-t border-white/10 pt-4 text-xs leading-relaxed text-slate-300">
                      <li className="flex items-start gap-2">
                        <span aria-hidden className={style.text}>
                          ✓
                        </span>
                        {level.lessons} {pluralize(level.lessons, LESSON_FORMS)} и{" "}
                        {level.visuals} {pluralize(level.visuals, VISUAL_FORMS)}
                      </li>
                      <li className="flex items-start gap-2">
                        <span aria-hidden className={style.text}>
                          ✓
                        </span>
                        {level.tests} {pluralize(level.tests, TEST_FORMS)} модулей
                      </li>
                      <li className="flex items-start gap-2">
                        <span aria-hidden className={style.text}>
                          ✓
                        </span>
                        {level.outcomes[0]}
                      </li>
                      <li className="flex items-start gap-2">
                        <span aria-hidden className={style.text}>
                          ✓
                        </span>
                        {level.outcomes[1]}
                      </li>
                    </ul>

                    <div className="mt-auto pt-5">
                      {isPurchased ? (
                        <>
                          <p className="flex items-center justify-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200">
                            <span aria-hidden>✓</span>
                            Доступ открыт
                          </p>
                          <Link
                            href={`/course/${level.key}`}
                            className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                          >
                            Продолжить обучение
                            <span aria-hidden>→</span>
                          </Link>
                        </>
                      ) : (
                        <>
                          <PlanButton
                            label="Купить навсегда"
                            courseId={level.key}
                            size="compact"
                          />
                          <Link
                            href={level.href}
                            className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full border border-blue-400/40 bg-blue-500/10 px-4 text-xs font-semibold text-blue-200 transition-colors hover:border-blue-300/60 hover:bg-blue-500/20"
                          >
                            Подробнее о курсе
                            <span aria-hidden>→</span>
                          </Link>
                          <p className="mt-2 text-center text-[11px] font-medium text-slate-300">
                            Доступ навсегда
                          </p>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}

              <ProBundleCard
                hasBundle={hasBundle}
                className="sm:col-span-2"
              />
            </div>
            </div>
          </div>
        </section>

        {/* Инструменты: подписка Pro открывает Конструктор и Профили, но не уроки */}
        <section
          id="tools"
          aria-labelledby="tools-title"
          className="scroll-mt-20 border-b border-white/10"
        >
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <p className="text-sm font-semibold tracking-widest text-blue-400 uppercase">
              Инструменты
            </p>
            <h2
              id="tools-title"
              className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl"
            >
              Инструменты (Подписка Pro)
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Отдельная подписка для работы с моделями: Конструктор 3D-моделей и
              библиотека Профилей. Уроки в неё не входят — курсы покупаются
              отдельно и остаются навсегда.
            </p>

            <article className="relative mt-10 overflow-hidden rounded-3xl border border-blue-400/30 bg-gradient-to-r from-blue-600/15 via-slate-900/90 to-slate-900/95 p-6 sm:p-8">
                <div
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 -right-20 h-56 w-56 -translate-y-1/2 rounded-full bg-blue-500/10 blur-3xl"
                />

                <div className="relative grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div>
                        <p className="text-xs font-semibold tracking-[0.16em] text-blue-300 uppercase">
                          Подписка
                        </p>
                        <h3 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                          Подписка Pro
                        </h3>
                      </div>
                      <span className="rounded-full border border-blue-400/40 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-200">
                        30 дней доступа
                      </span>
                    </div>

                    <p className="mt-4 flex items-baseline gap-2">
                      <span className="text-4xl font-extrabold text-white">
                        {proSubscriptionPrice} ₽
                      </span>
                      <span className="text-sm text-slate-300">/мес</span>
                    </p>

                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
                      Подписка открывает инструменты платформы: Конструктор
                      3D-моделей и библиотеку Профилей. Это не доступ к урокам —
                      курсы покупаются отдельно и остаются навсегда.
                    </p>

                    <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm leading-relaxed text-slate-300">
                      <li className="flex items-center gap-2">
                        <span aria-hidden className="text-blue-300">
                          ✓
                        </span>
                        Конструктор 3D-моделей: шаблоны и параметры
                      </li>
                      <li className="flex items-center gap-2">
                        <span aria-hidden className="text-blue-300">
                          ✓
                        </span>
                        Библиотека Профилей печати
                      </li>
                      <li className="flex items-center gap-2">
                        <span aria-hidden className="text-blue-300">
                          ✓
                        </span>
                        Безлимитная генерация в Конструкторе
                      </li>
                      <li className="flex items-center gap-2">
                        <span aria-hidden className="text-blue-300">
                          ✓
                        </span>
                        Коммерческая лицензия (можно продавать напечатанное)
                      </li>
                      <li className="flex items-center gap-2">
                        <span aria-hidden className="text-blue-300">
                          ✓
                        </span>
                        Новые инструменты по мере выхода
                      </li>
                    </ul>
                  </div>

                  <div>
                    <PlanButton
                      label="Оформить подписку Pro"
                      courseId="pro-subscription"
                      variant="blue"
                    />
                    <p className="mt-3 text-center text-xs leading-relaxed text-slate-300">
                      Инструменты доступны, пока активна подписка
                    </p>
                    <p className="mt-2 text-center text-xs leading-relaxed text-slate-300">
                      Уроки не входят · Чек НПД на email · отмена в кабинете
                    </p>
                  </div>
                </div>
              </article>
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
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
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
                  <blockquote className="mt-4 text-sm leading-relaxed text-slate-300 italic">
                    «{slot} отзыв: что получилось напечатать, что оказалось
                    сложным и чем помог курс».
                  </blockquote>
                  <figcaption className="mt-auto flex items-center gap-3 pt-6">
                    <span
                      aria-hidden
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-slate-300"
                    >
                      ?
                    </span>
                    <span className="text-xs text-slate-300">
                      Имя · уровень · дата
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>

            <p className="mt-6 text-xs leading-relaxed text-slate-300">
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
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
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
                      className="shrink-0 text-slate-300 transition-transform duration-200 group-open:rotate-180"
                    >
                      ⌄
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">
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
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">
                Оплачивая курс или подписку, вы соглашаетесь с{" "}
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
              <p className="mt-3 text-sm text-slate-300">
                Вопросы по оплате и доступу:{" "}
                <a
                  href={`mailto:${LEGAL_OPERATOR.email}`}
                  className="font-medium text-blue-300 transition-colors hover:text-blue-200"
                >
                  {LEGAL_OPERATOR.email}
                </a>
              </p>
              <p className="mt-4 border-t border-white/10 pt-4 text-xs leading-relaxed text-slate-300">
                Сервис предназначен для лиц старше 18 лет.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}






