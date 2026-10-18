import type { Metadata } from "next";
import Link from "next/link";

import { Header } from "@/components/Header";
import {
  VisualPlaceholder,
  type VisualAccent,
} from "@/components/landing/VisualPlaceholder";
import coursesData from "@/data/courses.json";
import { authHref } from "@/lib/auth-redirect";
import {
  LEVELS,
  PAID_LESSONS,
  PAID_TESTS,
  PAID_VISUALS,
  PRO_LESSONS,
  PRO_VISUALS,
  TOTAL_LESSONS,
  TOTAL_LEVEL_VISUALS,
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

export const metadata: Metadata = {
  title: "TriDi — освой 3D-печать: от первой детали до бизнеса",
  description: `Практический курс по 3D-печати: ${TOTAL_LESSONS} глубоких уроков, ${TOTAL_VISUALS} наглядных схем и проверка знаний. Старт бесплатно, без карты.`,
};

const { pro: proCourse } = coursesData;

/** Цена Pro — из data/courses.json, как и на странице тарифов. */
const proPrice = new Intl.NumberFormat("ru-RU").format(proCourse.price);

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

/** Три боли, с которых начинается продающая воронка. */
const PAIN_POINTS = [
  {
    question: "Стол отклеивается на 10-м слое?",
    detail:
      "Деталь отрывается, принтер печатает «спагетти», а причина каждый раз новая: стол, температура, поток или первый слой.",
    accent: "text-blue-300",
  },
  {
    question: "Не понимаете, почему деталь расслоилась?",
    detail:
      "Слой треснул, но непонятно, что виновато: температура, влажность пластика, охлаждение или настройки слайсера.",
    accent: "text-violet-300",
  },
  {
    question: "Хотите зарабатывать печатью, но не знаете цен?",
    detail:
      "Страшно назвать цену: непонятно, как считать пластик, электричество, брак и собственное время.",
    accent: "text-amber-300",
  },
];

/**
 * Четыре схемы для галереи — по одной с каждого уровня.
 *
 * Это стилизованные заглушки, а не SVG-кадры уроков: витрине нужен ритм сетки
 * и понятные названия, а сами визуализации остаются внутри уроков. Код (L1, C5,
 * IN4, Z8) связывает карточку с уроком, где схема открывается.
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
  {
    code: "Z8",
    title: "Финальный проект",
    caption:
      "От критериев продукта до партии, фото и продаж — весь путь на одной схеме.",
    accent: "amber",
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
    answer: `Зарегистрируйтесь и откройте уровень «Новичок»: ${LEVELS[0].lessons} ${pluralize(LEVELS[0].lessons, LESSON_FORMS)}, ${LEVELS[0].visuals} ${pluralize(LEVELS[0].visuals, VISUAL_FORMS)} и ${LEVELS[0].tests} ${pluralize(LEVELS[0].tests, TEST_FORMS)} модулей. Это бесплатно, карта не нужна.`,
  },
  {
    question: "Как проходит оплата?",
    answer: `Подписка Pro стоит ${proPrice} ₽ за 30 дней. Одна оплата открывает все платные уровни и продвинутый курс. Чек НПД приходит на email, указанный при оплате.`,
  },
  {
    question: "Как работает подписка?",
    answer:
      "Доступ действует 30 дней. Продление — по желанию, в личном кабинете. Покупать уровни по отдельности не нужно: Pro открывает всё сразу.",
  },
  {
    question: "Можно ли отменить подписку?",
    answer:
      "Да, в любой момент в личном кабинете. Доступ сохранится до конца оплаченного периода, дальше деньги не списываются.",
  },
];

/** Три шага воронки: бесплатный старт → первая деталь → Pro. */
const FUNNEL_STEPS = [
  {
    step: "01",
    title: "Бесплатный «Новичок»",
    text: `Регистрация без карты и ${LEVELS[0].lessons} ${pluralize(LEVELS[0].lessons, LESSON_FORMS)} базы.`,
    note: "0 ₽",
  },
  {
    step: "02",
    title: "Первая готовая деталь",
    text: "Калибровка, первый слой и разбор дефектов — на своём принтере.",
    note: "Практика",
  },
  {
    step: "03",
    title: "Pro и профессия",
    text: `Все платные уровни, ${PRO_LESSONS} ${pluralize(PRO_LESSONS, LESSON_FORMS)} продвинутого курса и ${PRO_VISUALS} схем.`,
    note: `${proPrice} ₽/мес`,
  },
];

const CTA_BASE =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-full px-8 text-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

const PRIMARY_CTA = `${CTA_BASE} bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 focus-visible:ring-blue-400`;

const SECONDARY_CTA = `${CTA_BASE} border border-white/15 bg-white/5 text-white hover:bg-white/10 focus-visible:ring-blue-400`;

const GOLD_CTA = `${CTA_BASE} bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 hover:from-amber-300 hover:to-amber-400 focus-visible:ring-amber-300`;

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

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
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

              <h1 className="mt-7 text-4xl leading-[1.05] font-extrabold tracking-tight text-white sm:text-6xl">
                Освой 3D-печать:
                <br />
                от первой детали{" "}
                <span className="bg-gradient-to-r from-blue-400 via-violet-300 to-amber-300 bg-clip-text text-transparent">
                  до собственного бизнеса
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300 sm:mt-8 sm:text-xl">
                {TOTAL_LESSONS} глубоких уроков, {TOTAL_VISUALS} наглядных схем
                и система проверки знаний. Без воды и сломанных принтеров.
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

              <ul className="mt-7 flex flex-wrap gap-2.5 text-xs font-semibold sm:text-sm">
                <li className="rounded-full border border-blue-400/30 bg-blue-500/10 px-3.5 py-1.5 text-blue-200">
                  0 ₽ на старте
                </li>
                <li className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300">
                  Карта не нужна
                </li>
                <li className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300">
                  Одна подписка на всё
                </li>
              </ul>
            </div>

            <div className="relative mx-auto w-full max-w-sm pb-8 sm:max-w-md lg:max-w-none">
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

              <div className="absolute -bottom-1 left-3 right-3 rounded-2xl border border-white/15 bg-slate-950/90 px-4 py-3.5 shadow-xl shadow-slate-950/60 backdrop-blur sm:left-6 sm:right-auto sm:w-72">
                <p className="text-[10px] font-semibold tracking-[0.2em] text-amber-300 uppercase">
                  Путь курса
                </p>
                <p className="mt-1.5 text-sm font-bold text-white">
                  Новичок → Уверенный
                </p>
                <p className="text-sm font-bold text-white">
                  Инженер → Заработок
                </p>
              </div>
            </div>
          </div>

          <div className="relative mx-auto max-w-6xl px-5 pb-16 sm:px-8 sm:pb-24">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-center"
                >
                  <dt className="text-2xl font-extrabold text-white sm:text-3xl">
                    {stat.value}
                  </dt>
                  <dd className="mt-1 text-xs text-slate-400 sm:text-sm">
                    {stat.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* 2. Агитация: знакомые боли и обещание решения */}
        <section className="scroll-mt-20 border-b border-white/10 bg-gradient-to-b from-slate-900/50 to-transparent">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <p className="text-sm font-semibold tracking-widest text-violet-400 uppercase">
              Знакомая боль?
            </p>
            <h2 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Если хотя бы один пункт — про вас
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
              Курс сэкономит месяцы проб, ошибок и испорченного пластика. Вот с
              чего начинается большинство проблем.
            </p>

            <div className="mt-12 grid gap-4 sm:mt-14 sm:grid-cols-3 sm:gap-5">
              {PAIN_POINTS.map((pain, index) => (
                <article
                  key={pain.question}
                  className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 p-6 transition-colors hover:border-white/20 sm:p-7"
                >
                  <span
                    aria-hidden
                    className={`text-xs font-semibold tracking-[0.2em] ${pain.accent}`}
                  >
                    0{index + 1}
                  </span>
                  <h3 className="mt-4 text-xl font-bold text-white">
                    {pain.question}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400">
                    {pain.detail}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-4 rounded-3xl border border-blue-400/25 bg-gradient-to-r from-blue-500/10 via-slate-900 to-violet-500/10 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <p className="text-lg font-semibold text-white sm:text-xl">
                Мы собрали решение этих проблем в одном курсе.
              </p>
              <Link
                href="#levels"
                className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-blue-300 transition-colors hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Посмотреть программу
                <span aria-hidden>↓</span>
              </Link>
            </div>
          </div>
        </section>

        {/* 3. Демонстрация ценности: четыре уровня и их проблемы */}
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
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
              Не набор разрозненных уроков, а путь: от адгезии первого слоя до
              расчёта цены и продаж.
            </p>

            <div className="mt-12 grid gap-5 sm:mt-14 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {LEVELS.map((level) => {
                const style = LEVEL_STYLES[level.key];

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
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          level.isFree
                            ? "border-blue-400/40 bg-blue-500/10 text-blue-200"
                            : "border-amber-400/40 bg-amber-500/10 text-amber-200"
                        }`}
                      >
                        {level.isFree ? "Бесплатно" : "В Pro"}
                      </span>
                    </div>

                    <h3 className="mt-5 text-2xl font-extrabold tracking-tight text-white">
                      {level.shortTitle}
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">{level.title}</p>

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
                        <dd className="text-[11px] text-slate-400">
                          {pluralize(level.lessons, LESSON_FORMS)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-lg font-bold text-white">
                          {level.visuals}
                        </dt>
                        <dd className="text-[11px] text-slate-400">
                          {pluralize(level.visuals, VISUAL_FORMS)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-lg font-bold text-white">
                          {level.tests}
                        </dt>
                        <dd className="text-[11px] text-slate-400">
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

                    <div className="mt-auto pt-7">
                      <Link
                        href={level.isFree ? START_FREE_HREF : "/subscription"}
                        className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                          level.isFree
                            ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25 hover:bg-blue-500"
                            : "border border-amber-400/40 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20"
                        }`}
                      >
                        {level.isFree ? "Начать бесплатно" : "Смотреть тарифы"}
                        <span aria-hidden>→</span>
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* 4. Доказательство: как выглядят схемы внутри уроков */}
        <section
          id="gallery"
          className="scroll-mt-20 border-b border-white/10"
        >
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <p className="text-sm font-semibold tracking-widest text-violet-400 uppercase">
              Галерея качества
            </p>
            <h2 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Так выглядят уроки
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
              Посмотрите, как выглядят уроки. Каждая схема — это шаг к
              пониманию процесса.
            </p>

            <div className="mt-12 grid gap-4 sm:mt-14 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
              {GALLERY.map((item) => (
                <VisualPlaceholder
                  key={item.code}
                  code={item.code}
                  title={item.title}
                  caption={item.caption}
                  accent={item.accent}
                />
              ))}
            </div>

            <p className="mt-8 text-sm leading-relaxed text-slate-500">
              Показали 4 из {TOTAL_VISUALS}. {TOTAL_LEVEL_VISUALS} схем
              нарисованы под {TOTAL_LESSONS} уроков четырёх уровней, ещё{" "}
              {PRO_VISUALS} — в продвинутом курсе. Остальные открываются внутри
              уроков вместе с подписями и пояснениями.
            </p>
          </div>
        </section>

        {/* 5. Предложение: бесплатный старт и переход в Pro */}
        <section
          id="pricing"
          className="scroll-mt-20 border-b border-white/10"
        >
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="relative overflow-hidden rounded-[2rem] border border-blue-400/20 bg-gradient-to-br from-blue-600/20 via-slate-900 to-amber-500/10 p-6 shadow-2xl shadow-slate-950/40 sm:p-10 lg:p-12">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-32 left-1/3 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -right-16 -bottom-24 h-64 w-64 rounded-full bg-amber-500/15 blur-3xl"
              />

              <div className="relative grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14">
                <div>
                  <p className="text-sm font-semibold tracking-widest text-amber-300 uppercase">
                    Следующий шаг
                  </p>
                  <h2 className="mt-4 max-w-xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
                    Начни бесплатно.{" "}
                    <span className="bg-gradient-to-r from-blue-300 to-amber-300 bg-clip-text text-transparent">
                      Продолжи в Pro.
                    </span>
                  </h2>
                  <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
                    Начни с бесплатного уровня «Новичок». Освой базу, напечатай
                    первую деталь, а затем переходи на Pro и становись
                    профессионалом.
                  </p>

                  <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <Link
                      href={START_FREE_HREF}
                      className={`${PRIMARY_CTA} w-full sm:w-auto`}
                    >
                      Начать бесплатно
                      <span aria-hidden>→</span>
                    </Link>
                    <Link
                      href="/subscription"
                      className={`${GOLD_CTA} w-full sm:w-auto`}
                    >
                      Смотреть тарифы
                    </Link>
                  </div>

                  <p className="mt-6 text-sm leading-relaxed text-slate-400">
                    Отмена в кабинете · Чек НПД на email · 30 дней доступа
                  </p>
                </div>

                <div>
                  <ol className="space-y-3">
                    {FUNNEL_STEPS.map((step, index) => (
                      <li
                        key={step.step}
                        className="flex gap-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4 sm:p-5"
                      >
                        <span
                          aria-hidden
                          className="text-xs font-semibold tracking-[0.16em] text-slate-500"
                        >
                          {step.step}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                            <p className="font-semibold text-white">
                              {step.title}
                            </p>
                            <span
                              className={`text-xs font-semibold ${
                                index === 0
                                  ? "text-blue-300"
                                  : index === 2
                                    ? "text-amber-300"
                                    : "text-slate-400"
                              }`}
                            >
                              {step.note}
                            </span>
                          </div>
                          <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                            {step.text}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>

                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-3">
                      <dt className="text-lg font-bold text-white">
                        {PAID_LESSONS}
                      </dt>
                      <dd className="text-[11px] text-slate-400">
                        уроков в Pro
                      </dd>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-3">
                      <dt className="text-lg font-bold text-white">
                        {PAID_VISUALS}
                      </dt>
                      <dd className="text-[11px] text-slate-400">
                        схем в Pro
                      </dd>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-3">
                      <dt className="text-lg font-bold text-white">
                        {PAID_TESTS}
                      </dt>
                      <dd className="text-[11px] text-slate-400">тестов</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Доверие: короткий FAQ об оплате и подписке */}
        <section id="faq" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:gap-16">
              <div>
                <p className="text-sm font-semibold tracking-widest text-emerald-400 uppercase">
                  FAQ
                </p>
                <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                  Коротко о главном
                </h2>
                <p className="mt-5 text-base leading-relaxed text-slate-400">
                  Оплата, подписка и старт без карты — без мелкого шрифта и
                  скрытых условий.
                </p>

                <ul className="mt-7 space-y-3 text-sm leading-relaxed text-slate-300">
                  {[
                    "Старт — 0 ₽, карта не нужна",
                    "Одна подписка на все платные материалы",
                    "Чек НПД приходит на email",
                    "Отмена — в личном кабинете",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span aria-hidden className="mt-0.5 text-emerald-300">
                        ✓
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>

                <div className="mt-8 rounded-2xl border border-blue-400/20 bg-blue-500/5 p-5">
                  <p className="text-sm leading-relaxed text-slate-300">
                    Начните с бесплатного уровня и решите про Pro после первой
                    готовой детали.
                  </p>
                  <Link
                    href={START_FREE_HREF}
                    className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-300 transition-colors hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  >
                    Начать бесплатно
                    <span aria-hidden>→</span>
                  </Link>
                </div>
              </div>

              <div className="grid items-start gap-3">
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
          </div>
        </section>
      </main>
    </div>
  );
}
