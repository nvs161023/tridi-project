import type { Metadata } from "next";
import Link from "next/link";

import { Header } from "@/components/Header";
import { ProBundleCard } from "@/components/landing/ProBundleCard";
import {
  VisualPlaceholder,
  type VisualAccent,
} from "@/components/landing/VisualPlaceholder";
import coursesData from "@/data/courses.json";
import { authHref } from "@/lib/auth-redirect";
import { resolveUserId } from "@/lib/current-user";
import {
  LEVELS,
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
import { profileCount } from "@/lib/profiles";
import { organizationJsonLd } from "@/lib/seo";
import { resolveSiteUrl } from "@/lib/site-url";
import { getPurchasedCourses, hasCourseAccess } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "TriDi — освой 3D-печать: от первой детали до бизнеса",
  description: `Практический курс по 3D-печати: ${TOTAL_LESSONS} глубоких уроков, ${TOTAL_VISUALS} наглядных схем, именной сертификат и проверка знаний. Старт бесплатно, без карты.`,
};

const { pro: proCourse } = coursesData;
const basicCourse = coursesData.basic;

const formatPrice = (price: number) =>
  new Intl.NumberFormat("ru-RU").format(price);

/** Единый стиль ярких бейджей скидок на карточках уровней. */
const DISCOUNT_BADGE =
  "rounded-full bg-amber-400 px-2.5 py-1 text-center text-[10px] font-extrabold tracking-wide text-slate-950 uppercase shadow-lg shadow-amber-500/20";

/** Акция базового уровня: старая цена и бейдж — из data/courses.json. */
const basicOldPrice = formatPrice(basicCourse.oldPrice);
const basicBadge = basicCourse.badge;

/** Цена подписки Pro — из data/courses.json, как и на странице тарифов. */
const proPrice = formatPrice(proCourse.subscriptionPrice);

/** Регистрация с возвратом в первый бесплатный урок. */
const START_FREE_HREF = authHref("/auth/sign-up", "/course/lesson-1");

/** Цвета уровня: карточки, галерея и бейджи используют одну палитру. */
const LEVEL_STYLES: Record<
  CourseLevel["key"],
  {
    accent: VisualAccent;
    line: string;
    text: string;
    hover: string;
    badge: string;
  }
> = {
  basic: {
    accent: "blue",
    line: "from-blue-500 to-cyan-400",
    text: "text-blue-300",
    hover: "hover:border-blue-400/50",
    badge: "border-blue-400/40 bg-blue-500/10 text-blue-200",
  },
  confident: {
    accent: "violet",
    line: "from-violet-500 to-fuchsia-400",
    text: "text-violet-300",
    hover: "hover:border-violet-400/50",
    badge: "border-violet-400/40 bg-violet-500/10 text-violet-200",
  },
  engineer: {
    accent: "emerald",
    line: "from-emerald-500 to-teal-400",
    text: "text-emerald-300",
    hover: "hover:border-emerald-400/50",
    badge: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
  },
  profit: {
    accent: "amber",
    line: "from-amber-500 to-orange-400",
    text: "text-amber-300",
    hover: "hover:border-amber-400/50",
    badge: "border-amber-400/40 bg-amber-500/10 text-amber-200",
  },
};

/**
 * Проблема, которую решает каждый уровень.
 *
 * Цифры и состав уровней берутся из данных курса, а формулировка боли живёт
 * здесь: это маркетинговый текст витрины, а не часть программы.
 */
const LEVEL_PROBLEMS: Record<CourseLevel["key"], string> = {
  basic: "Чтобы первая деталь не отклеилась и не превратилась в «спагетти».",
  confident:
    "Чтобы поддержки, модификаторы и детали больше стола печатались с первого раза.",
  engineer: "Чтобы детали не ломались под нагрузкой.",
  profit: "Чтобы считать себестоимость и цену, а не работать в убыток.",
};

const STATS = [
  { value: LEVELS.length, label: "уровня" },
  { value: TOTAL_LESSONS, label: "уроков" },
  { value: TOTAL_VISUALS, label: "наглядных схем" },
  { value: TOTAL_TESTS, label: "тестов модулей" },
];

/** Три короткие боли, с которых начинается продающая воронка. */
const PAIN_POINTS = [
  {
    title: "Отклеивается стол",
    detail:
      "Первая деталь срывается, и непонятно, что менять: адгезию, температуру или поток.",
    accent: "text-blue-300",
  },
  {
    title: "Не знаете цен",
    detail:
      "Пластик, электричество, брак и время — считать нечем, поэтому цена берётся наугад.",
    accent: "text-violet-300",
  },
  {
    title: "Ломаются детали",
    detail:
      "Трещины под нагрузкой: ориентация, стенки и режим печати выбираются вслепую.",
    accent: "text-amber-300",
  },
];

const PROFILE_SETTING_FORMS: [string, string, string] = [
  "настройка",
  "настройки",
  "настроек",
];

/**
 * Дополнительная ценность курсов и подписки Pro.
 *
 * Сертификат и библиотека профилей уже существуют в продукте, поэтому витрина
 * называет их рядом с уроками: без этого ценность пакета выглядит как «ещё
 * несколько курсов», а не как готовый набор инструментов.
 */
const EXTRAS = [
  {
    icon: "🎓",
    title: "Сертификат",
    text: "Именной документ с QR-кодом и публичной проверкой подлинности.",
    iconClassName: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
  },
  {
    icon: "🖨️",
    title: "Библиотека профилей",
    text: `${profileCount} ${pluralize(profileCount, PROFILE_SETTING_FORMS)} для Anycubic, Elegoo, Creality и др.`,
    iconClassName: "border-blue-400/25 bg-blue-500/10 text-blue-200",
  },
  {
    icon: "📐",
    title: "3D-Конструктор",
    text: "Генератор ваз и брелоков с экспортом в STL и коммерческой лицензией.",
    iconClassName: "border-violet-400/25 bg-violet-500/10 text-violet-200",
  },
  {
    icon: "🛠️",
    title: "Диагностика",
    text: "Справочник дефектов: почему сопливит или отклеивается.",
    iconClassName: "border-amber-400/25 bg-amber-500/10 text-amber-200",
  },
];

/**
 * Методология: один и тот же цикл на каждом уровне.
 *
 * Это описание подхода, а не состав программы, поэтому текст живёт здесь,
 * рядом с другими маркетинговыми блоками витрины.
 */
const METHOD_STEPS = [
  {
    step: "01",
    title: "Теория",
    text: "Короткая физика процесса: почему деталь ведёт себя именно так.",
    accent: "text-blue-300",
  },
  {
    step: "02",
    title: "Схемы",
    text: "Визуальный разбор настроек, нагрузок и дефектов печати.",
    accent: "text-violet-300",
  },
  {
    step: "03",
    title: "Тесты",
    text: "Проверка понимания после каждого модуля, с пояснениями.",
    accent: "text-emerald-300",
  },
  {
    step: "04",
    title: "Проект",
    text: "Своя деталь в конце уровня — от расчёта до готовой печати.",
    accent: "text-amber-300",
  },
];

/**
 * Три крупные схемы для блока методологии.
 *
 * Это стилизованные превью, а не кадры уроков: витрине нужен ритм и понятные
 * названия, а сами визуализации остаются внутри уроков. Код (L1, C5, IN4)
 * связывает карточку с уроком, где схема открывается.
 */
const GALLERY: {
  code: string;
  title: string;
  caption: string;
  accent: VisualAccent;
}[] = [
  {
    code: "L1",
    title: "Технологии",
    caption:
      "FDM, SLA и SLS: три источника тепла, три материала и три ниши применения.",
    accent: "blue",
  },
  {
    code: "C5",
    title: "Поддержки",
    caption:
      "Решётка против дерева: расход пластика, следы на детали и надёжность опоры.",
    accent: "violet",
  },
  {
    code: "IN4",
    title: "Симуляция",
    caption:
      "Нагрузка на деталь до печати: где слабее всего и зачем добавлять рёбра.",
    accent: "emerald",
  },
];

/**
 * Короткие ответы на вопросы, которые чаще всего задают перед оплатой.
 *
 * Числа бесплатного уровня берём из LEVELS, а не пишем руками: если курс
 * изменится, FAQ не начнёт обещать старое количество уроков и схем.
 */
const FAQ: { question: string; answer: string }[] = [
  {
    question: "С чего начать?",
    answer: `Зарегистрируйтесь и откройте уровень «Новичок»: ${LEVELS[0].lessons} ${pluralize(LEVELS[0].lessons, LESSON_FORMS)}, ${LEVELS[0].visuals} ${pluralize(LEVELS[0].visuals, VISUAL_FORMS)} и ${LEVELS[0].tests} ${pluralize(LEVELS[0].tests, TEST_FORMS)} модулей. Сейчас он открыт бесплатно по акции, карта не нужна. Потом уровень будет стоить ${basicOldPrice} ₽.`,
  },
  {
    question: "Как проходит оплата?",
    answer: `Курсы покупаются навсегда: уровень или пакет «Всё включено». Подписка Pro за ${proPrice} ₽ на 30 дней открывает инструменты — Конструктор и Профили, — но не уроки. Чек НПД приходит на email, указанный при оплате.`,
  },
  {
    question: "Как работает подписка?",
    answer:
      "Подписка Pro открывает Конструктор 3D-моделей и библиотеку Профилей на 30 дней. Уроки в неё не входят: курсы покупаются отдельно и остаются навсегда. Продление — по желанию, в личном кабинете.",
  },
  {
    question: "Можно ли отменить подписку?",
    answer:
      "Да, в любой момент в личном кабинете. Доступ сохранится до конца оплаченного периода, дальше деньги не списываются.",
  },
];

const CTA_BASE =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 xl:px-8 xl:text-lg";

const PRIMARY_CTA = `${CTA_BASE} bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 focus-visible:ring-blue-400`;

const SECONDARY_CTA = `${CTA_BASE} border border-white/15 bg-white/5 text-white hover:bg-white/10 focus-visible:ring-blue-400`;

/**
 * Главная отдаётся на каждый запрос, а не готовится на этапе сборки.
 *
 * <Header /> читает cookies пользователя, так что страница и так персональная.
 * Но при статической генерации Next.js выполняет Header во время сборки, а ему
 * нужны NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY. Файл .env.local
 * в .gitignore, поэтому в контейнере сборки (Amvera) этих переменных может не
 * быть — и сборка падала с ошибкой «Не заданы NEXT_PUBLIC_SUPABASE_URL…».
 * С force-dynamic сборка не зависит от секретов: они нужны только в рантайме.
 */
export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const userId = await resolveUserId(supabase);
  const purchasedCourses = userId
    ? await getPurchasedCourses(supabase, userId)
    : { confident: false, engineer: false, profit: false };
  const hasBundle = userId
    ? await hasCourseAccess(supabase, userId, "pro")
    : false;

  const siteUrl = await resolveSiteUrl();
  const organization = {
    "@context": "https://schema.org",
    ...organizationJsonLd(siteUrl),
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organization).replace(/</g, "\\u003c"),
        }}
      />

      <Header />

      <main>
        {/* 1. Герой: захват внимания и два действия */}
        <section className="relative overflow-hidden border-b border-white/10">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-48 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-blue-600/25 blur-3xl sm:h-[42rem] sm:w-[42rem]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute top-40 -right-32 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-0 -left-24 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl"
          />

          <div className="relative mx-auto grid max-w-6xl gap-14 px-5 pt-16 pb-14 sm:px-8 sm:pt-24 sm:pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:pt-28">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/40 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-blue-200 sm:text-sm">
                <span aria-hidden>🖨️</span>
                {TOTAL_LESSONS} глубоких уроков · {TOTAL_VISUALS} схем
              </span>

              <h1 className="mt-7 text-4xl leading-[1.05] font-extrabold tracking-tight text-white sm:text-5xl xl:text-6xl">
                Освой 3D-печать:
                <br />
                от первой детали{" "}
                <span className="bg-gradient-to-r from-blue-400 via-violet-300 to-amber-300 bg-clip-text text-transparent">
                  до собственного бизнеса
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300 sm:mt-8 sm:text-xl">
                {TOTAL_LESSONS} глубоких уроков, {TOTAL_VISUALS} наглядных схем
                и именной сертификат, подтверждающий ваши навыки. Без воды и
                сломанных принтеров.
              </p>

              <p className="mt-5 inline-flex flex-wrap items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-100">
                <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-slate-950 uppercase">
                  {basicBadge}
                </span>
                Первый уровень сейчас бесплатно — потом {basicOldPrice} ₽
              </p>

              <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
                <Link
                  href={START_FREE_HREF}
                  className={`${PRIMARY_CTA} w-full sm:w-auto`}
                >
                  Начать бесплатно
                  <span aria-hidden>→</span>
                </Link>
                <Link
                  href="/subscription"
                  className={`${SECONDARY_CTA} w-full sm:w-auto`}
                >
                  Смотреть тарифы
                </Link>
              </div>

              <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200">
                <span aria-hidden>🎓</span>
                Именной сертификат по окончании
              </p>

              <ul className="mt-4 flex flex-wrap gap-2.5 text-xs font-semibold sm:text-sm">
                <li className="rounded-full border border-blue-400/30 bg-blue-500/10 px-3.5 py-1.5 text-blue-200">
                  0 ₽ на старте
                </li>
                <li className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300">
                  Карта не нужна
                </li>
                <li className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300">
                  Курсы остаются навсегда
                </li>
              </ul>
            </div>

            <div className="relative mx-auto w-full max-w-sm sm:max-w-md lg:max-w-none">
              <div
                aria-hidden
                className="absolute -inset-4 rotate-2 rounded-[2rem] bg-gradient-to-br from-amber-400/20 via-violet-500/10 to-blue-500/25 blur-2xl"
              />
              <VisualPlaceholder
                code="Z8"
                title="Финальный проект"
                accent="amber"
                showCaption={false}
                className="relative shadow-2xl shadow-slate-950/60"
              />

              <div className="mt-4 w-full rounded-2xl border border-white/15 bg-slate-950/90 px-4 py-3.5 leading-relaxed shadow-xl shadow-slate-950/60 backdrop-blur sm:max-w-xs">
                <p className="text-[11px] font-semibold tracking-[0.2em] text-amber-300 uppercase sm:text-xs">
                  Путь курса
                </p>
                <p className="mt-1.5 text-[15px] font-bold text-white sm:text-sm">
                  Новичок → Уверенный
                </p>
                <p className="text-[15px] font-bold text-white sm:text-sm">
                  Инженер → Заработок
                </p>
              </div>
            </div>
          </div>

          <div className="relative mx-auto max-w-6xl px-5 pb-16 sm:px-8 sm:pb-24">
            <dl className="grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="flex min-h-28 min-w-0 flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 py-5 text-center sm:min-h-32 sm:px-4"
                >
                  <dt className="text-3xl font-extrabold text-white sm:text-4xl">
                    {stat.value}
                  </dt>
                  <dd className="mt-2 max-w-full text-sm leading-relaxed text-balance text-slate-200 sm:text-base">
                    {stat.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* 2. Боль: три коротких тезиса и обещание решения */}
        <section className="border-b border-white/10 bg-gradient-to-b from-slate-900/50 to-transparent">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <p className="text-sm font-semibold tracking-widest text-violet-400 uppercase">
              Знакомая боль?
            </p>
            <h2 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Если хотя бы один пункт — про вас
            </h2>

            <div className="mt-9 grid gap-3 sm:mt-10 sm:grid-cols-3 sm:gap-4">
              {PAIN_POINTS.map((pain, index) => (
                <article
                  key={pain.title}
                  className="relative flex h-full flex-col rounded-2xl border border-white/10 bg-slate-900/60 p-5 transition-colors hover:border-white/20 sm:p-6"
                >
                  <span
                    aria-hidden
                    className={`text-xs font-semibold tracking-[0.2em] ${pain.accent}`}
                  >
                    0{index + 1}
                  </span>
                  <h3 className="mt-3 text-lg font-bold text-white sm:text-xl">
                    {pain.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {pain.detail}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-blue-400/25 bg-gradient-to-r from-blue-500/10 via-slate-900 to-violet-500/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <p className="text-base font-semibold text-white sm:text-lg">
                Мы собрали решение в одном курсе.
              </p>
              <Link
                href="#path"
                className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-blue-300 transition-colors hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Как это работает
                <span aria-hidden>↓</span>
              </Link>
            </div>
          </div>
        </section>

        {/* 3. Визуальная воронка: бесплатный старт → следующий уровень */}
        <section id="path" className="scroll-mt-20 border-b border-white/10">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold tracking-widest text-blue-400 uppercase">
                Ваш путь
              </p>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
                Два шага — и вы уже печатаете
              </h2>
              <p className="mt-5 text-base leading-relaxed text-slate-300 sm:text-lg">
                Начните бесплатно, а следующий уровень выберите только тогда,
                когда увидите результат.
              </p>
            </div>

            <div className="mt-10 grid items-stretch gap-4 sm:mt-12 lg:grid-cols-[1fr_auto_1fr] lg:gap-0">
              <article className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-blue-400/30 bg-gradient-to-br from-blue-600/15 via-slate-900 to-slate-950 p-6 sm:p-8">
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-400"
                />
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full border border-blue-400/40 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-200">
                    Шаг 1
                  </span>
                  <span className="text-sm font-extrabold text-blue-300">
                    0 ₽
                  </span>
                </div>
                <h3 className="mt-5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  Бесплатный «Новичок»
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
                  {LEVELS[0].lessons}{" "}
                  {pluralize(LEVELS[0].lessons, LESSON_FORMS)}, калибровка и
                  первая готовая деталь — без карты и обязательств.
                </p>
                <div className="mt-auto pt-7">
                  <Link
                    href={START_FREE_HREF}
                    className={`${PRIMARY_CTA} w-full`}
                  >
                    Начать бесплатно
                    <span aria-hidden>→</span>
                  </Link>
                  <p className="mt-3 text-xs leading-relaxed text-slate-300">
                    Доступ сразу после регистрации
                  </p>
                </div>
              </article>

              <div
                aria-hidden
                className="flex items-center justify-center py-1 lg:px-5 lg:py-0"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-slate-900 text-lg font-bold text-blue-300 shadow-lg shadow-slate-950/40 lg:h-12 lg:w-12">
                  <span className="lg:hidden">↓</span>
                  <span className="hidden lg:inline">→</span>
                </span>
              </div>

              <article className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-amber-400/25 bg-gradient-to-br from-amber-500/10 via-slate-900 to-violet-500/10 p-6 sm:p-8">
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 to-violet-400"
                />
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
                    Шаг 2
                  </span>
                  <span className="text-xs font-semibold text-slate-300">
                    когда будете готовы
                  </span>
                </div>
                <h3 className="mt-5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  Твой следующий уровень
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
                  Купите конкретный курс навсегда или оформите Pro-подписку для
                  доступа ко всем инструментам.
                </p>
                <p className="mt-3 text-xs leading-relaxed text-slate-300 italic">
                  Завершите обучение и получите именной сертификат, который
                  можно добавить в резюме.
                </p>
                <div className="mt-auto grid gap-2.5 pt-7 sm:grid-cols-2">
                  <Link
                    href="#levels"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-amber-400 px-5 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/20 transition-colors hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  >
                    Выбрать курс
                    <span aria-hidden>→</span>
                  </Link>
                  <Link
                    href="/subscription"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  >
                    Pro-подписка
                  </Link>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* 4. Оффер: четыре уровня и пакет «Всё включено» */}
        <section
          id="levels"
          className="scroll-mt-20 border-b border-white/10 bg-gradient-to-b from-slate-900/40 to-transparent"
        >
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <p className="text-sm font-semibold tracking-widest text-blue-400 uppercase">
              Что внутри
            </p>
            <h2 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Четыре уровня — четыре решённые проблемы
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Не набор разрозненных уроков, а путь: от адгезии первого слоя до
              расчёта цены и продаж.
            </p>

            <div className="mt-8 flex max-w-2xl items-start gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-5 py-4 text-amber-100">
              <span aria-hidden className="text-lg leading-none">
                🔥
              </span>
              <p className="text-sm font-semibold leading-relaxed">
                Цены со скидкой в честь запуска платформы
              </p>
            </div>

            <div className="mt-10 grid gap-5 sm:mt-12 sm:grid-cols-2 xl:grid-cols-3 xl:gap-6">
              {LEVELS.map((level) => {
                const style = LEVEL_STYLES[level.key];
                const isPurchased =
                  level.key !== "basic" && purchasedCourses[level.key];

                return (
                  <article
                    key={level.key}
                    className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 p-6 transition-colors sm:p-7 ${style.hover}`}
                  >
                    <div
                      aria-hidden
                      className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${style.line}`}
                    />

                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`text-xs font-semibold tracking-[0.16em] uppercase ${style.text}`}
                      >
                        {level.code}
                      </span>
                      {level.badge ? (
                        <span className={DISCOUNT_BADGE}>{level.badge}</span>
                      ) : null}
                    </div>

                    <h3 className="mt-5 text-2xl font-extrabold tracking-tight text-white">
                      {level.shortTitle}
                    </h3>
                    <p className="mt-1 text-sm text-slate-300">{level.title}</p>

                    <p className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="text-2xl font-extrabold text-white">
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
                      <span className="text-xs text-slate-300">
                        {level.isFree ? "сейчас" : "навсегда"}
                      </span>
                    </p>

                    <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                      <p
                        className={`text-[10px] font-semibold tracking-[0.16em] uppercase ${style.text}`}
                      >
                        Проблема, которую решает
                      </p>
                      <p className="mt-2 text-sm leading-relaxed font-medium text-slate-200">
                        {LEVEL_PROBLEMS[level.key]}
                      </p>
                    </div>

                    <dl className="mt-5 grid grid-cols-3 gap-2 border-y border-white/10 py-4 text-center">
                      <div>
                        <dt className="text-lg font-bold text-white">
                          {level.lessons}
                        </dt>
                        <dd className="text-[11px] text-slate-300">
                          {pluralize(level.lessons, LESSON_FORMS)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-lg font-bold text-white">
                          {level.visuals}
                        </dt>
                        <dd className="text-[11px] text-slate-300">
                          {pluralize(level.visuals, VISUAL_FORMS)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-lg font-bold text-white">
                          {level.tests}
                        </dt>
                        <dd className="text-[11px] text-slate-300">
                          {pluralize(level.tests, TEST_FORMS)}
                        </dd>
                      </div>
                    </dl>

                    <ul className="mt-5 space-y-2.5 text-sm leading-relaxed text-slate-300">
                      {level.outcomes.map((outcome) => (
                        <li key={outcome} className="flex items-start gap-2.5">
                          <span aria-hidden className={`mt-0.5 ${style.text}`}>
                            ✓
                          </span>
                          {outcome}
                        </li>
                      ))}
                    </ul>

                    {!level.isFree ? (
                      <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-emerald-300">
                        <span aria-hidden>✅</span>
                        Именной сертификат
                      </p>
                    ) : null}

                    <div className="mt-auto pt-7">
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
                        <Link
                          href={level.isFree ? START_FREE_HREF : level.href}
                          className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                            level.isFree
                              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25 hover:bg-blue-500"
                              : "border border-blue-400/40 bg-blue-500/10 text-blue-200 hover:border-blue-300/60 hover:bg-blue-500/20"
                          }`}
                        >
                          {level.isFree ? "Начать бесплатно" : "Подробнее о курсе"}
                          <span aria-hidden>→</span>
                        </Link>
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
        </section>

        {/* 5. Методология: четыре шага и крупные превью схем */}
        <section
          id="methodology"
          className="scroll-mt-20 border-b border-white/10 bg-gradient-to-b from-slate-900/40 to-transparent"
        >
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-14">
              <div>
                <p className="text-sm font-semibold tracking-widest text-emerald-400 uppercase">
                  Методология
                </p>
                <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
                  Почему это работает
                </h2>
                <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
                  Один цикл на каждом уровне: понять теорию, разобрать схему,
                  проверить себя и сделать свой проект.
                </p>

                <ol className="mt-8 space-y-2.5">
                  {METHOD_STEPS.map((item) => (
                    <li
                      key={item.step}
                      className="flex gap-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4 transition-colors hover:border-white/20 sm:p-5"
                    >
                      <span
                        aria-hidden
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-semibold ${item.accent}`}
                      >
                        {item.step}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-white">
                          {item.title}
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed text-slate-300">
                          {item.text}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {GALLERY.map((item, index) => (
                    <VisualPlaceholder
                      key={item.code}
                      code={item.code}
                      title={item.title}
                      caption={item.caption}
                      accent={item.accent}
                      showCaption={false}
                      className={index === 0 ? "sm:col-span-2" : ""}
                    />
                  ))}
                </div>
                <p className="mt-4 text-sm leading-relaxed text-slate-300">
                  Три из {TOTAL_VISUALS} схем. Остальные открываются внутри
                  уроков вместе с пояснениями.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Дополнительная ценность: сертификат и Pro-инструменты */}
        <section
          id="extras"
          className="scroll-mt-20 border-b border-white/10 bg-slate-950"
        >
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold tracking-widest text-amber-400 uppercase">
                Кроме уроков
              </p>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
                Что вы получаете помимо знаний
              </h2>
              <p className="mt-5 text-base leading-relaxed text-slate-300 sm:text-lg">
                Сертификат выдаётся после сдачи всех тестов уровня, а
                инструменты открываются в пакете «Всё включено» и подписке Pro.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-3 sm:mt-12 sm:gap-4 lg:grid-cols-4">
              {EXTRAS.map((item) => (
                <article
                  key={item.title}
                  className="flex h-full min-w-0 flex-col rounded-2xl border border-white/10 bg-slate-900/60 p-4 transition-colors hover:border-white/20 sm:p-5"
                >
                  <span
                    aria-hidden
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-lg sm:h-11 sm:w-11 sm:text-xl ${item.iconClassName}`}
                  >
                    {item.icon}
                  </span>
                  <h3 className="mt-4 text-sm leading-snug font-bold text-white sm:text-base">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {item.text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 7. FAQ: четыре вопроса об оплате, подписке и старте */}
        <section id="faq" className="scroll-mt-20 border-b border-white/10">
          <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8 sm:py-28">
            <div className="text-center">
              <p className="text-sm font-semibold tracking-widest text-emerald-400 uppercase">
                FAQ
              </p>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Коротко о главном
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-300">
                Оплата, подписка и старт без карты — без мелкого шрифта и
                скрытых условий.
              </p>
            </div>

            <div className="mt-8 grid items-start gap-3 sm:mt-10">
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

        {/* 8. Финальный CTA: простая полоса призыва */}
        <section>
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
            <div className="flex flex-col gap-6 overflow-hidden rounded-3xl border border-blue-400/25 bg-gradient-to-r from-blue-600/20 via-slate-900 to-amber-500/10 px-6 py-8 shadow-2xl shadow-slate-950/30 sm:px-10 sm:py-10 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
                  Начни печатать уже сегодня
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
                  Первый уровень бесплатно: зарегистрируйтесь и напечатайте
                  первую деталь.
                </p>
                <p className="mt-3 max-w-xl text-xs leading-relaxed text-slate-300">
                  Пройди первый уровень бесплатно. Получи сертификат после сдачи
                  всех тестов.
                </p>
              </div>
              <Link
                href={START_FREE_HREF}
                className={`${PRIMARY_CTA} w-full shrink-0 sm:w-auto`}
              >
                Начать бесплатно
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
