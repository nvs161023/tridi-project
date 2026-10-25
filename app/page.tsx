import type { Metadata } from "next";
import Link, { type LinkProps } from "next/link";
import type { ReactNode } from "react";

import { Header } from "@/components/Header";
import {
  BentoCard,
  type BentoAccent,
} from "@/components/landing/BentoCard";
import { ProBundleCard } from "@/components/landing/ProBundleCard";
import { cx } from "@/components/ui/class-names";
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

const formatPrice = (price: number) =>
  new Intl.NumberFormat("ru-RU").format(price);

/**
 * Выгода пакета — разница с покупкой трёх курсов по отдельности.
 * Уровни бейджей не получают: скидочные проценты обещали бы цену, которой
 * никогда не было. Бейдж пакета рисует `ProBundleCard`.
 */
const BUNDLE_SAVING = formatPrice(
  LEVELS.filter((level) => !level.isFree).reduce(
    (sum, level) => sum + level.price,
    0,
  ) - proCourse.price,
);

/** Регистрация с возвратом в первый бесплатный урок. */
const START_FREE_HREF = authHref("/auth/sign-up", "/course/lesson-1");

const SECTION_LABEL =
  "text-[11px] font-semibold tracking-[0.24em] uppercase";

const SECTION_TITLE =
  "mt-4 text-balance text-4xl font-extrabold leading-[1.02] tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl";

/** Цвета bento-карточек, схем и тарифов. Один набор акцентов на всю главную. */
const ACCENT_STYLES: Record<
  BentoAccent,
  {
    text: string;
    dot: string;
    line: string;
    glow: string;
    ring: string;
    badge: string;
  }
> = {
  blue: {
    text: "text-blue-300",
    dot: "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]",
    line: "from-blue-400/0 via-blue-300/60 to-blue-400/0",
    glow: "bg-blue-500/15",
    ring: "border-blue-400/20",
    badge: "border-blue-400/20 bg-blue-500/10 text-blue-200",
  },
  violet: {
    text: "text-violet-300",
    dot: "bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.8)]",
    line: "from-violet-400/0 via-violet-300/60 to-violet-400/0",
    glow: "bg-violet-500/15",
    ring: "border-violet-400/20",
    badge: "border-violet-400/20 bg-violet-500/10 text-violet-200",
  },
  emerald: {
    text: "text-emerald-300",
    dot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]",
    line: "from-emerald-400/0 via-emerald-300/60 to-emerald-400/0",
    glow: "bg-emerald-500/15",
    ring: "border-emerald-400/20",
    badge: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
  },
  amber: {
    text: "text-amber-300",
    dot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]",
    line: "from-amber-400/0 via-amber-300/60 to-amber-400/0",
    glow: "bg-amber-500/15",
    ring: "border-amber-400/20",
    badge: "border-amber-400/20 bg-amber-500/10 text-amber-200",
  },
  neutral: {
    text: "text-white/55",
    dot: "bg-white/60",
    line: "from-white/0 via-white/40 to-white/0",
    glow: "bg-white/10",
    ring: "border-white/10",
    badge: "border-white/10 bg-white/5 text-white/65",
  },
};

const LEVEL_ACCENT: Record<CourseLevel["key"], BentoAccent> = {
  basic: "blue",
  confident: "violet",
  engineer: "emerald",
  profit: "amber",
};

/** Маркетинговый текст проблемы, которую решает уровень. */
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

/** Три боли, с которых начинается продающая воронка. */
const PAIN_POINTS: { title: string; detail: string; accent: BentoAccent }[] = [
  {
    title: "Отклеивается стол",
    detail:
      "Первая деталь срывается, и непонятно, что менять: адгезию, температуру или поток.",
    accent: "blue",
  },
  {
    title: "Не знаете цен",
    detail:
      "Пластик, электричество, брак и время — считать нечем, поэтому цена берётся наугад.",
    accent: "amber",
  },
  {
    title: "Ломаются детали",
    detail:
      "Трещины под нагрузкой: ориентация, стенки и режим печати выбираются вслепую.",
    accent: "violet",
  },
];

const PROFILE_SETTING_FORMS: [string, string, string] = [
  "настройка",
  "настройки",
  "настроек",
];

/** Методология: один и тот же цикл на каждом уровне. */
const METHOD_STEPS = [
  {
    step: "01",
    title: "Теория",
    text: "Короткая физика процесса: почему деталь ведёт себя именно так.",
    accent: "blue",
  },
  {
    step: "02",
    title: "Схемы",
    text: "Визуальный разбор настроек, нагрузок и дефектов печати.",
    accent: "violet",
  },
  {
    step: "03",
    title: "Тесты",
    text: "Проверка понимания после каждого модуля, с пояснениями.",
    accent: "emerald",
  },
  {
    step: "04",
    title: "Проект",
    text: "Своя деталь в конце уровня — от расчёта до готовой печати.",
    accent: "amber",
  },
] satisfies {
  step: string;
  title: string;
  text: string;
  accent: BentoAccent;
}[];

/** Три крупные схемы для блока методологии. */
const GALLERY: {
  code: string;
  title: string;
  caption: string;
  accent: BentoAccent;
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
 * Числа бесплатного уровня берём из LEVELS, а не пишем руками.
 */
const FAQ: { question: string; answer: string }[] = [
  {
    question: "С чего начать?",
    answer: `Зарегистрируйтесь и откройте уровень «Новичок»: ${LEVELS[0].lessons} ${pluralize(LEVELS[0].lessons, LESSON_FORMS)}, ${LEVELS[0].visuals} ${pluralize(LEVELS[0].visuals, VISUAL_FORMS)} и ${LEVELS[0].tests} ${pluralize(LEVELS[0].tests, TEST_FORMS)} модулей. Он открыт целиком и бесплатно, карта не нужна.`,
  },
  {
    question: "Нужен ли принтер, чтобы начать?",
    answer:
      "Практика первых трёх уроков проходит без печати: в первом — три свои задачи на бумаге, во втором — разбор восьми узлов своего принтера или его фотографии, в третьем — таблица материалов. Дальше нужен слайсер (урок 4) и принтер с небольшим запасом пластика (с урока 5).",
  },
  {
    question: "Как проходит оплата?",
    answer: `Курсы покупаются навсегда: уровень или пакет «Всё включено». Пакет дешевле покупки трёх курсов по отдельности на ${BUNDLE_SAVING} ₽. Чек НПД приходит на email, указанный при оплате.`,
  },
  {
    question: "Сколько времени нужно?",
    answer: `Уроки бесплатного уровня идут по 20–55 минут. Весь уровень — ${LEVELS[0].hoursWithSplit}: это чтение, практика и два теста модулей. Доступ остаётся навсегда, так что учиться можно в своём темпе.`,
  },
];

/** Декоративные столбики в bento-карточке уроков. */
const CHART_BARS = [
  "h-7",
  "h-11",
  "h-8",
  "h-14",
  "h-10",
  "h-16",
  "h-9",
  "h-12",
  "h-6",
  "h-14",
  "h-8",
  "h-11",
];

/** Детерминированный QR-узор: не настоящий код, а визуальный акцент. */
const QR_CELLS = Array.from({ length: 49 }, (_, index) => {
  const row = Math.floor(index / 7);
  const column = index % 7;
  const finder =
    (row < 2 && column < 2) ||
    (row < 2 && column > 4) ||
    (row > 4 && column < 2);

  return finder || (index * 7 + row + column) % 3 === 0;
});

type CtaVariant = "light" | "outline" | "ghost" | "success";

type CtaLinkProps = Omit<LinkProps, "className" | "children"> & {
  variant?: CtaVariant;
  size?: "md" | "lg";
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * CTA главной в стиле Vercel: белая кнопка с чёрным текстом и стеклянная
 * вторичная. Отдельный компонент не меняет UI-кит внутренних страниц.
 */
function CtaLink({
  variant = "light",
  size = "md",
  fullWidth = false,
  className,
  children,
  ...props
}: CtaLinkProps) {
  const variants: Record<CtaVariant, string> = {
    light:
      "bg-white text-black shadow-[0_10px_40px_-12px_rgba(255,255,255,0.55)] hover:scale-105 hover:bg-zinc-100 hover:shadow-[0_18px_60px_-12px_rgba(255,255,255,0.7)] active:scale-[0.99]",
    outline:
      "border border-white/12 bg-white/[0.035] text-white backdrop-blur-xl hover:border-white/25 hover:bg-white/[0.07] hover:scale-[1.02] active:scale-[0.99]",
    ghost:
      "text-white/60 hover:bg-white/[0.04] hover:text-white",
    success:
      "border border-emerald-400/25 bg-emerald-400/10 text-emerald-200 hover:border-emerald-300/40 hover:bg-emerald-400/15",
  };

  const sizes = {
    md: "min-h-12 px-6 py-3 text-sm",
    lg: "min-h-14 px-7 py-4 text-base",
  };

  return (
    <Link
      className={cx(
        "inline-flex items-center justify-center gap-2.5 rounded-full font-semibold transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303]",
        sizes[size],
        variants[variant],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}


function Check({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx("h-4 w-4 shrink-0", className)}
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

/** Тёмная техническая схема вместо цветной заглушки из старой витрины. */
function MethodPreview({
  code,
  title,
  caption,
  accent,
  className,
}: {
  code: string;
  title: string;
  caption: string;
  accent: BentoAccent;
  className?: string;
}) {
  const colors = ACCENT_STYLES[accent];

  return (
    <figure
      className={cx(
        "group relative overflow-hidden rounded-2xl border border-white/[0.07] border-t-white/20 bg-[#0a0a0a] p-5",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors duration-300 hover:border-white/20",
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:32px_32px] opacity-60"
      />
      <div
        aria-hidden
        className={cx(
          "absolute -top-16 -right-12 h-44 w-44 rounded-full blur-3xl",
          colors.glow,
        )}
      />

      <div className="relative flex items-center justify-between gap-3">
        <span
          className={cx(
            "rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.12em]",
            colors.badge,
          )}
        >
          {code}
        </span>
        <span className={cx("h-1.5 w-1.5 rounded-full", colors.dot)} />
      </div>

      <div className="relative flex aspect-[16/9] items-center justify-center">
        <div
          aria-hidden
          className={cx(
            "absolute h-36 w-36 rounded-full border sm:h-40 sm:w-40",
            colors.ring,
          )}
        />
        <div
          aria-hidden
          className={cx(
            "absolute h-24 w-24 rounded-full border sm:h-28 sm:w-28",
            colors.ring,
          )}
        />
        <div
          aria-hidden
          className="absolute h-px w-3/4 bg-gradient-to-r from-transparent via-white/15 to-transparent"
        />
        <div
          aria-hidden
          className="absolute h-3/4 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent"
        />
        <span
          className={cx(
            "relative font-mono text-[10px] font-semibold tracking-[0.24em] uppercase",
            colors.text,
          )}
        >
          {code}
        </span>
      </div>

      <figcaption className="relative border-t border-white/[0.06] pt-4">
        <h3 className="text-lg font-semibold tracking-tight text-white">
          {title}
        </h3>
        <p className="mt-1.5 text-sm leading-6 text-white/45">{caption}</p>
      </figcaption>
    </figure>
  );
}


/**
 * Главная отдаётся на каждый запрос: Header читает cookies, а карточки
 * тарифов — купленные курсы. force-dynamic также убирает зависимость сборки
 * от NEXT_PUBLIC_SUPABASE_* на этапе статической генерации.
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
    <div className="relative min-h-screen text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organization).replace(/</g, "\\u003c"),
        }}
      />

      <Header />

      <main>
        {/* Hero: центр экрана, mesh-свечение, сетка и два действия. */}
        <section className="relative isolate overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
          >
            <div className="hero-grid absolute inset-0 opacity-80" />
            <div className="absolute top-[-26rem] left-1/2 h-[46rem] w-[46rem] -translate-x-1/2 rounded-full bg-blue-600/20 blur-[150px]" />
            <div className="absolute top-24 right-[-14rem] h-[32rem] w-[32rem] rounded-full bg-violet-600/15 blur-[130px]" />
            <div className="absolute top-1/2 left-[-14rem] h-[28rem] w-[28rem] rounded-full bg-blue-700/10 blur-[120px]" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          </div>

          <div className="relative mx-auto flex min-h-[calc(100svh_-_5rem)] max-w-7xl flex-col items-center justify-center px-5 py-16 text-center sm:px-8 sm:py-20 lg:py-24">
            <div className="inline-flex max-w-full items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.035] px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl sm:px-4 sm:text-xs">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
              </span>
              <span className="text-center">
                Платформа для 3D-печати нового поколения
              </span>
            </div>

            <h1 className="mx-auto mt-7 max-w-5xl text-balance text-5xl leading-[0.95] font-extrabold tracking-[-0.05em] sm:text-6xl md:text-7xl xl:text-[5.5rem]">
              <span className="block bg-gradient-to-b from-white via-white to-white/60 bg-clip-text text-transparent">
                Освой 3D-печать
              </span>{" "}
              <span className="mt-1 block bg-gradient-to-r from-blue-200 via-violet-200 to-white bg-clip-text pb-2 text-transparent">
                от первой детали до бизнеса
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-7 text-white/55 sm:mt-7 sm:text-lg sm:leading-8">
              {TOTAL_LESSONS} глубоких уроков, {TOTAL_VISUALS} наглядных
              схем и именной сертификат. Практика с первого урока — без воды
              и сломанных принтеров.
            </p>

            <div className="mt-9 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
              <CtaLink href={START_FREE_HREF} size="lg" className="group">
                Начать бесплатно
                <span
                  aria-hidden
                  className="transition-transform duration-300 group-hover:translate-x-0.5"
                >
                  →
                </span>
              </CtaLink>
              <CtaLink href="/subscription" variant="outline" size="lg">
                Смотреть тарифы
              </CtaLink>
            </div>


            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/40 sm:text-sm">
              {[
                "Бесплатный старт",
                "Карта не нужна",
                "Доступ навсегда",
                "Сертификат после тестов",
              ].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-400/80" />
                  {item}
                </li>
              ))}
            </ul>

            <dl className="mt-12 grid w-full max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.06] shadow-[0_24px_80px_-40px_rgba(0,0,0,0.9)] sm:mt-14 sm:grid-cols-4">
              {STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="bg-[#070707]/95 px-3 py-4 backdrop-blur-xl sm:px-4 sm:py-5"
                >
                  <dt className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                    {stat.value}
                  </dt>
                  <dd className="mt-1 text-[10px] tracking-[0.14em] text-white/35 uppercase sm:text-[11px]">
                    {stat.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Технические дисциплины: тонкая полоса вместо ряда логотипов. */}
        <div className="border-y border-white/[0.06] bg-white/[0.01]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-7 gap-y-2 px-5 py-4 text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase sm:px-8">
            {[
              "FDM",
              "SLA",
              "SLS",
              "Калибровка",
              "Слайсеры",
              "Материалы",
              "Расчёт",
            ].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>


        {/* Что внутри: bento-сетка с разными размерами блоков. */}
        <section id="inside" className="relative scroll-mt-24">
          <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28 lg:py-32">
            <div className="max-w-4xl">
              <p className={cx(SECTION_LABEL, "text-blue-300/80")}>
                Что внутри
              </p>
              <h2 className={SECTION_TITLE}>
                Не набор уроков.{" "}
                <span className="text-white/35">
                  Система, которая доводит до результата.
                </span>
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/45 sm:text-lg">
                Программа, схемы, проверка знаний и инструменты собраны в один
                маршрут — от первой калибровки до собственного продукта.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-6 lg:mt-16">
              <BentoCard
                as="article"
                padding="lg"
                icon="route"
                eyebrow="Программа"
                title="Один маршрут. Четыре уровня."
                titleClassName="max-w-sm text-2xl sm:text-3xl"
                tone="blue"
                className="md:col-span-3 md:row-span-2"
              >
                <p className="relative mt-3 max-w-md text-sm leading-6 text-white/45">
                  От калибровки первого слоя до расчёта цены и продаж — без
                  разрозненных уроков.
                </p>

                <ol className="relative mt-7 border-t border-white/[0.06]">
                  {LEVELS.map((level, index) => {
                    const accent =
                      ACCENT_STYLES[LEVEL_ACCENT[level.key]];

                    return (
                      <li
                        key={level.key}
                        className="flex items-center gap-3 border-b border-white/[0.06] py-4"
                      >
                        <span className="font-mono text-[10px] text-white/25">
                          0{index + 1}
                        </span>
                        <span
                          aria-hidden
                          className={cx(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            accent.dot,
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white">
                            {level.shortTitle}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-white/35">
                            {level.audience}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-[10px] text-white/30">
                          {level.lessons} ур.
                        </span>
                      </li>
                    );
                  })}
                </ol>

                <div className="relative mt-6 flex items-center gap-3 rounded-2xl border border-blue-400/15 bg-blue-500/[0.06] px-4 py-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-white">
                      Первый уровень — бесплатно
                    </p>
                    <p className="text-[11px] text-white/35">
                      Карта не нужна, доступ сразу.
                    </p>
                  </div>
                </div>
              </BentoCard>

              <BentoCard
                as="article"
                icon="book"
                eyebrow="Контент"
                title="Уроки, а не конспекты"
                tone="violet"
                className="md:col-span-3"
              >
                <p className="relative mt-3 max-w-sm text-sm leading-6 text-white/45">
                  Каждый урок — одна задача, теория и практика. Всего{" "}
                  {TOTAL_LESSONS} уроков.
                </p>

                <div
                  aria-hidden
                  className="relative mt-6 flex h-20 items-end gap-1.5"
                >
                  {CHART_BARS.map((height, index) => (
                    <span
                      key={`${height}-${index}`}
                      className={cx(
                        "flex-1 rounded-full bg-gradient-to-t",
                        index % 3 === 0
                          ? "from-blue-500/15 to-blue-300/60"
                          : "from-white/[0.04] to-white/25",
                        height,
                      )}
                    />
                  ))}
                </div>
                <div className="relative mt-3 flex items-center justify-between text-[9px] font-semibold tracking-[0.16em] text-white/25 uppercase">
                  <span>Теория</span>
                  <span>Практика</span>
                  <span>Результат</span>
                </div>
              </BentoCard>


              <BentoCard
                as="article"
                icon="printer"
                eyebrow="Библиотека"
                title={`${profileCount} ${pluralize(profileCount, PROFILE_SETTING_FORMS)} печати`}
                tone="emerald"
                className="md:col-span-3"
              >
                <p className="relative mt-3 max-w-sm text-sm leading-6 text-white/45">
                  Готовые профили для Anycubic, Elegoo, Creality и других
                  принтеров. Открываются в популярных слайсерах.
                </p>

                <div className="relative mt-6 flex flex-wrap gap-2">
                  {["Anycubic", "Elegoo", "Creality", "и другие"].map(
                    (brand) => (
                      <span
                        key={brand}
                        className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-white/55"
                      >
                        {brand}
                      </span>
                    ),
                  )}
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1.5 font-mono text-[10px] font-semibold text-emerald-300">
                    JSON / INI
                  </span>
                </div>
              </BentoCard>

              <BentoCard
                as="article"
                icon="check"
                eyebrow="Контроль"
                title="Тесты с разбором"
                tone="blue"
                className="md:col-span-2"
              >
                <p className="relative mt-3 text-sm leading-6 text-white/45">
                  {TOTAL_TESTS} тестов модулей. Проверяем понимание и
                  объясняем каждый неверный ответ.
                </p>
                <div className="relative mt-6 grid grid-cols-3 gap-2">
                  {["Вопрос", "Ответ", "Разбор"].map((item, index) => (
                    <div
                      key={item}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-2.5"
                    >
                      <span className="font-mono text-[9px] text-white/25">
                        0{index + 1}
                      </span>
                      <p className="mt-1 text-[10px] font-medium text-white/55">
                        {item}
                      </p>
                    </div>
                  ))}
                </div>
              </BentoCard>

              <BentoCard
                as="article"
                icon="award"
                eyebrow="Документ"
                title="Сертификат с QR"
                tone="amber"
                className="md:col-span-2"
              >
                <p className="relative mt-3 text-sm leading-6 text-white/45">
                  Именной документ после сдачи всех тестов уровня. QR-код
                  ведёт на публичную страницу проверки.
                </p>
                <div className="relative mt-6 flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div
                    aria-hidden
                    className="grid shrink-0 grid-cols-7 gap-0.5 rounded-lg bg-white p-1.5"
                  >
                    {QR_CELLS.map((filled, index) => (
                      <span
                        key={index}
                        className={cx(
                          "h-1.5 w-1.5 rounded-[1px]",
                          filled ? "bg-black" : "bg-transparent",
                        )}
                      />
                    ))}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold tracking-[0.12em] text-amber-300/80 uppercase">
                      Публичная проверка
                    </p>
                    <p className="mt-1 truncate font-mono text-[11px] text-white/45">
                      tridi / verify
                    </p>
                  </div>
                </div>
              </BentoCard>

              <BentoCard
                as="article"
                icon="wrench"
                eyebrow="Инструменты"
                title="Диагностика дефектов"
                tone="violet"
                className="md:col-span-2"
              >
                <p className="relative mt-3 text-sm leading-6 text-white/45">
                  Сопливит, отклеивается или ломается — справочник подскажет,
                  что именно менять.
                </p>
                <div className="relative mt-6 flex flex-wrap gap-2">
                  {["Адгезия", "Температура", "Поток"].map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/50"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </BentoCard>
            </div>
          </div>
        </section>


        {/* Боль: редакционный список вместо трёх одинаковых карточек. */}
        <section className="relative border-b border-white/[0.06]">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-24 sm:px-8 sm:py-28 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:gap-20 lg:py-32">
            <div className="lg:sticky lg:top-28">
              <p className={cx(SECTION_LABEL, "text-amber-300/80")}>
                Знакомая боль
              </p>
              <h2 className={cx(SECTION_TITLE, "sm:text-5xl")}>
                Печать не должна быть лотереей.
              </h2>
              <p className="mt-5 max-w-md text-base leading-7 text-white/45 sm:text-lg">
                Если хотя бы один пункт про вас — дело не в принтере. Дело в
                системе, которой не хватает.
              </p>
              <CtaLink
                href="#path"
                variant="ghost"
                className="group mt-6 px-0"
              >
                Как это работает
                <span
                  aria-hidden
                  className="transition-transform duration-300 group-hover:translate-y-0.5"
                >
                  ↓
                </span>
              </CtaLink>
            </div>

            <div className="border-y border-white/[0.07]">
              {PAIN_POINTS.map((pain, index) => {
                const accent = ACCENT_STYLES[pain.accent];

                return (
                  <article
                    key={pain.title}
                    className="group grid gap-3 border-b border-white/[0.06] py-7 last:border-b-0 sm:grid-cols-[auto_1fr] sm:gap-8 sm:py-8"
                  >
                    <div className="flex items-center gap-3 sm:block">
                      <span className="font-mono text-[10px] text-white/25">
                        0{index + 1}
                      </span>
                      <span
                        aria-hidden
                        className={cx(
                          "h-1.5 w-1.5 rounded-full sm:mt-4 sm:block",
                          accent.dot,
                        )}
                      />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                        {pain.title}
                      </h3>
                      <p className="mt-2 max-w-xl text-sm leading-7 text-white/45 sm:text-base">
                        {pain.detail}
                      </p>
                      <p
                        className={cx(
                          "mt-3 text-[10px] font-semibold tracking-[0.18em] uppercase",
                          accent.text,
                        )}
                      >
                        Решается внутри курса
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>


        {/* Путь: бесплатный старт и следующий уровень. */}
        <section id="path" className="scroll-mt-24">
          <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28 lg:py-32">
            <div className="max-w-3xl">
              <p className={cx(SECTION_LABEL, "text-blue-300/80")}>
                Маршрут
              </p>
              <h2 className={SECTION_TITLE}>
                Начните бесплатно. Продолжите, когда увидите результат.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/45 sm:text-lg">
                Сначала — первая деталь и понимание процесса. Потом — глубина,
                инструменты и собственный продукт.
              </p>
            </div>

            <div className="mt-12 grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr]">
              <BentoCard
                as="article"
                padding="lg"
                tone="blue"
                className="flex h-full flex-col"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/60 to-transparent"
                />
                <div className="relative flex items-center justify-between gap-3">
                  <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1.5 font-mono text-[10px] font-semibold tracking-[0.12em] text-blue-200 uppercase">
                    01 / Старт
                  </span>
                  <span className="text-sm font-extrabold text-blue-300">
                    0 ₽
                  </span>
                </div>
                <h3 className="relative mt-5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  Бесплатный «Новичок»
                </h3>
                <p className="relative mt-3 text-sm leading-7 text-white/45 sm:text-base">
                  {LEVELS[0].lessons}{" "}
                  {pluralize(LEVELS[0].lessons, LESSON_FORMS)}, калибровка и
                  первая готовая деталь — без карты и обязательств.
                </p>
                <ul className="relative mt-6 space-y-2.5 text-sm text-white/55">
                  {[
                    "Доступ сразу после регистрации",
                    "Без карты и обязательств",
                    "Первая деталь на первом уровне",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 text-blue-300" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="relative mt-auto pt-7">
                  <CtaLink href={START_FREE_HREF} fullWidth>
                    Начать бесплатно
                    <span aria-hidden>→</span>
                  </CtaLink>
                  <p className="mt-3 text-center text-[11px] text-white/30">
                    Доступ сразу после регистрации
                  </p>
                </div>
              </BentoCard>

              <div
                aria-hidden
                className="flex items-center justify-center py-1 lg:px-5 lg:py-0"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-[#0a0a0a] text-sm font-bold text-blue-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] lg:h-12 lg:w-12">
                  <span className="lg:hidden">↓</span>
                  <span className="hidden lg:inline">→</span>
                </span>
              </div>

              <BentoCard
                as="article"
                padding="lg"
                tone="amber"
                className="flex h-full flex-col"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/50 to-transparent"
                />
                <div className="relative flex items-center justify-between gap-3">
                  <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 font-mono text-[10px] font-semibold tracking-[0.12em] text-amber-200 uppercase">
                    02 / Продолжение
                  </span>
                  <span className="text-[10px] font-semibold tracking-[0.12em] text-white/25 uppercase">
                    когда готовы
                  </span>
                </div>
                <h3 className="relative mt-5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  Следующий уровень
                </h3>
                <p className="relative mt-3 text-sm leading-7 text-white/45 sm:text-base">
                  Купите конкретный курс навсегда или заберите все три пакетом
                  — он дешевле на {BUNDLE_SAVING} ₽.
                </p>
                <ul className="relative mt-6 space-y-2.5 text-sm text-white/55">
                  {[
                    "Три платных уровня на выбор",
                    "Пакет «Всё включено» со скидкой",
                    "Сертификат после тестов",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 text-amber-300" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="relative mt-auto grid gap-2.5 pt-7 sm:grid-cols-2">
                  <CtaLink href="#levels" variant="light">
                    Выбрать курс
                  </CtaLink>
                  <CtaLink href="/courses/pro" variant="outline">
                    Пакет трёх курсов
                  </CtaLink>
                </div>
              </BentoCard>
            </div>
          </div>
        </section>


        {/* Тарифы: те же bento-поверхности, пакет занимает две колонки. */}
        <section
          id="levels"
          className="scroll-mt-24 border-y border-white/[0.06] bg-white/[0.012]"
        >
          <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28 lg:py-32">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className={cx(SECTION_LABEL, "text-violet-300/80")}>
                  Тарифы
                </p>
                <h2 className={SECTION_TITLE}>
                  Выберите глубину.
                  <span className="text-white/35">
                    {" "}
                    Доступ остаётся навсегда.
                  </span>
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-7 text-white/45 sm:text-lg">
                  Один курс или пакет «Всё включено» — без подписок, скрытых
                  условий и платы за продление.
                </p>
              </div>

              <p className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/[0.06] px-4 py-2.5 text-xs font-semibold text-amber-200">
                <span aria-hidden className="text-amber-300">
                  ◆
                </span>
                Пакет дешевле на {BUNDLE_SAVING} ₽
              </p>
            </div>

            <div className="mt-12 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {LEVELS.map((level) => {
                const style = ACCENT_STYLES[LEVEL_ACCENT[level.key]];
                const isPurchased =
                  level.key !== "basic" && purchasedCourses[level.key];

                return (
                  <BentoCard
                    as="article"
                    key={level.key}
                    padding="none"
                    className={cx(
                      "flex h-full flex-col p-6 sm:p-7",
                      level.isFree && "ring-1 ring-blue-400/15",
                    )}
                  >
                    <div
                      aria-hidden
                      className={cx(
                        "pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r",
                        style.line,
                      )}
                    />

                    <div className="relative flex items-center justify-between gap-3">
                      <span
                        className={cx(
                          "font-mono text-[10px] font-semibold tracking-[0.18em] uppercase",
                          style.text,
                        )}
                      >
                        {level.code}
                      </span>
                      {level.isFree ? (
                        <span
                          className={cx(
                            "rounded-full border px-2.5 py-1 text-[10px] font-semibold",
                            style.badge,
                          )}
                        >
                          Бесплатно
                        </span>
                      ) : isPurchased ? (
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200">
                          Открыт
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold tracking-[0.12em] text-white/25 uppercase">
                          Навсегда
                        </span>
                      )}
                    </div>

                    <h3 className="relative mt-5 text-2xl font-extrabold tracking-tight text-white">
                      {level.shortTitle}
                    </h3>
                    <p className="relative mt-1 text-sm text-white/35">
                      {level.title}
                    </p>

                    <p className="relative mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="text-3xl font-extrabold tracking-tight text-white">
                        {formatPrice(level.price)} ₽
                      </span>
                      <span className="text-xs text-white/35">
                        {level.isFree ? "без карты" : "навсегда"}
                      </span>
                    </p>

                    <div className="relative mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <p
                        className={cx(
                          "text-[9px] font-semibold tracking-[0.18em] uppercase",
                          style.text,
                        )}
                      >
                        Проблема, которую решает
                      </p>
                      <p className="mt-2 text-sm leading-6 font-medium text-white/60">
                        {LEVEL_PROBLEMS[level.key]}
                      </p>
                    </div>


                    <dl className="relative mt-5 grid grid-cols-3 gap-2 border-y border-white/[0.06] py-4 text-center">
                      {[
                        {
                          value: level.lessons,
                          label: pluralize(level.lessons, LESSON_FORMS),
                        },
                        {
                          value: level.visuals,
                          label: pluralize(level.visuals, VISUAL_FORMS),
                        },
                        {
                          value: level.tests,
                          label: pluralize(level.tests, TEST_FORMS),
                        },
                      ].map((stat) => (
                        <div key={stat.label}>
                          <dt className="text-lg font-bold text-white">
                            {stat.value}
                          </dt>
                          <dd className="text-[10px] text-white/35">
                            {stat.label}
                          </dd>
                        </div>
                      ))}
                    </dl>

                    <p className="relative mt-3 text-sm text-white/35">
                      <span className="font-semibold text-white/70">
                        {level.hours}
                      </span>{" "}
                      ({level.hoursSplit})
                    </p>

                    <ul className="relative mt-5 space-y-2.5 text-sm leading-6 text-white/50">
                      {level.outcomes.map((outcome) => (
                        <li key={outcome} className="flex items-start gap-2.5">
                          <Check
                            className={cx("mt-0.5 h-3.5 w-3.5", style.text)}
                          />
                          {outcome}
                        </li>
                      ))}
                    </ul>

                    {!level.isFree ? (
                      <p className="relative mt-4 flex items-center gap-2 text-[11px] font-semibold text-emerald-300/80">
                        <Check className="h-3.5 w-3.5" />
                        Именной сертификат
                      </p>
                    ) : null}

                    <div className="relative mt-auto pt-7">
                      {isPurchased ? (
                        <>
                          <p className="flex items-center justify-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2.5 text-xs font-semibold text-emerald-200">
                            <Check className="h-3.5 w-3.5" />
                            Доступ открыт
                          </p>
                          <CtaLink
                            href={`/course/${level.key}`}
                            variant="success"
                            fullWidth
                            className="mt-3"
                          >
                            Продолжить обучение
                            <span aria-hidden>→</span>
                          </CtaLink>
                        </>
                      ) : (
                        <CtaLink
                          href={level.isFree ? START_FREE_HREF : level.href}
                          variant={level.isFree ? "light" : "outline"}
                          fullWidth
                        >
                          {level.isFree
                            ? "Начать бесплатно"
                            : "Подробнее о курсе"}
                          <span aria-hidden>→</span>
                        </CtaLink>
                      )}
                    </div>
                  </BentoCard>
                );
              })}

              <ProBundleCard
                hasBundle={hasBundle}
                className="sm:col-span-2"
              />
            </div>
          </div>
        </section>


        {/* Методология: цикл обучения и тёмные технические схемы. */}
        <section id="methodology" className="scroll-mt-24">
          <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28 lg:py-32">
            <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-16">
              <div className="lg:sticky lg:top-28">
                <p className={cx(SECTION_LABEL, "text-emerald-300/80")}>
                  Методология
                </p>
                <h2 className={cx(SECTION_TITLE, "sm:text-5xl")}>
                  Один цикл. Четыре уровня. Навык, а не конспект.
                </h2>
                <p className="mt-5 max-w-md text-base leading-7 text-white/45 sm:text-lg">
                  На каждом уровне повторяется один и тот же цикл: понять
                  физику, разобрать схему, проверить себя и сделать проект.
                </p>

                <ol className="mt-9 border-y border-white/[0.07]">
                  {METHOD_STEPS.map((item) => {
                    const accent = ACCENT_STYLES[item.accent];

                    return (
                      <li
                        key={item.step}
                        className="group flex items-start gap-4 border-b border-white/[0.06] py-5 last:border-b-0"
                      >
                        <span className="mt-0.5 font-mono text-[10px] text-white/25">
                          {item.step}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-semibold text-white">
                            {item.title}
                          </h3>
                          <p className="mt-1 text-sm leading-6 text-white/40">
                            {item.text}
                          </p>
                        </div>
                        <span
                          aria-hidden
                          className={cx(
                            "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full opacity-60 transition-opacity duration-300 group-hover:opacity-100",
                            accent.dot,
                          )}
                        />
                      </li>
                    );
                  })}
                </ol>
              </div>

              <div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {GALLERY.map((item, index) => (
                    <MethodPreview
                      key={item.code}
                      code={item.code}
                      title={item.title}
                      caption={item.caption}
                      accent={item.accent}
                      className={index === 0 ? "sm:col-span-2" : ""}
                    />
                  ))}
                </div>
                <p className="mt-4 text-sm leading-6 text-white/35">
                  Три из {TOTAL_VISUALS} схем. Остальные открываются внутри
                  уроков вместе с пояснениями.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ: тонкие строки, крупный вопрос и плюс, который поворачивается. */}
        <section
          id="faq"
          className="scroll-mt-24 border-y border-white/[0.06] bg-white/[0.012]"
        >
          <div className="mx-auto max-w-4xl px-5 py-24 sm:px-8 sm:py-28">
            <div className="text-center">
              <p className={cx(SECTION_LABEL, "text-white/35")}>FAQ</p>
              <h2 className={cx(SECTION_TITLE, "text-4xl sm:text-5xl")}>
                Коротко о главном
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-white/45">
                Оплата, старт без карты и время на курс — без мелкого шрифта и
                скрытых условий.
              </p>
            </div>

            <div className="mt-10 border-y border-white/[0.07]">
              {FAQ.map((item, index) => (
                <details
                  key={item.question}
                  className="group border-b border-white/[0.06] last:border-b-0"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-4 py-5 text-left [&::-webkit-details-marker]:hidden">
                    <span className="font-mono text-[10px] text-white/25">
                      0{index + 1}
                    </span>
                    <span className="flex-1 text-base font-semibold text-white sm:text-lg">
                      {item.question}
                    </span>
                    <span
                      aria-hidden
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.02] text-lg font-light text-white/50 transition-transform duration-300 group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="pr-0 pb-6 text-sm leading-7 text-white/45 sm:pr-12 sm:pl-10">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>


        {/* Финальный CTA: тёмная панель со свечением и крупным заголовком. */}
        <section className="relative overflow-hidden">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:py-28">
            <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#080808] px-6 py-16 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_40px_120px_-60px_rgba(0,0,0,1)] sm:px-12 sm:py-20 lg:py-24">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px] opacity-50 [mask-image:radial-gradient(ellipse_70%_85%_at_50%_50%,#000_10%,transparent_82%)]"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute top-[-12rem] left-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-blue-500/20 blur-[120px]"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute right-[-8rem] bottom-[-10rem] h-72 w-72 rounded-full bg-violet-500/15 blur-[110px]"
              />

              <div className="relative">
                <p className={cx(SECTION_LABEL, "text-blue-300/80")}>
                  Старт
                </p>
                <h2 className="mx-auto mt-4 max-w-3xl text-balance text-4xl font-extrabold leading-[0.98] tracking-[-0.045em] sm:text-5xl md:text-6xl">
                  <span className="bg-gradient-to-b from-white to-white/55 bg-clip-text text-transparent">
                    Первая деталь — уже сегодня.
                  </span>
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-white/45 sm:text-lg">
                  Зарегистрируйтесь, откройте бесплатный уровень и напечатайте
                  первую деталь. Карта не понадобится.
                </p>

                <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                  <CtaLink
                    href={START_FREE_HREF}
                    size="lg"
                    className="group"
                  >
                    Начать бесплатно
                    <span
                      aria-hidden
                      className="transition-transform duration-300 group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </CtaLink>
                  <CtaLink href="#levels" variant="outline" size="lg">
                    Сравнить тарифы
                  </CtaLink>
                </div>

                <p className="mt-6 text-[11px] leading-5 text-white/30">
                  Первый уровень бесплатно · Без карты · Сертификат после
                  тестов
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
