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
  PRO_HOURS,
  PRO_LESSONS,
  PRO_VISUALS,
  TOTAL_EXPLANATIONS,
  TOTAL_LESSONS,
  TOTAL_LEVEL_VISUALS,
  TOTAL_QUESTIONS,
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
  title: "TriDi — от первой детали до собственного бизнеса",
  description:
    "Практический курс по 3D-печати: 38 уроков, 410 наглядных схем и 9 тестов. От калибровки принтера до деталей под нагрузкой и продаж.",
};

const { pro: proCourse } = coursesData;

/** Цена Pro — из data/courses.json, как и на странице тарифов. */
const proPrice = new Intl.NumberFormat("ru-RU").format(proCourse.price);

/** Регистрация с возвратом в первый бесплатный урок. */
const START_FREE_HREF = authHref("/auth/sign-up", "/course/lesson-1");

/** Цвета уровня: одна палитра на карточки, галерею и тарифы. */
const LEVEL_STYLES: Record<
  CourseLevel["key"],
  { accent: VisualAccent; line: string; text: string; hover: string }
> = {
  basic: {
    accent: "blue",
    line: "from-blue-500 to-cyan-400",
    text: "text-blue-300",
    hover: "hover:border-blue-400/50",
  },
  confident: {
    accent: "violet",
    line: "from-violet-500 to-fuchsia-400",
    text: "text-violet-300",
    hover: "hover:border-violet-400/50",
  },
  engineer: {
    accent: "emerald",
    line: "from-emerald-500 to-teal-400",
    text: "text-emerald-300",
    hover: "hover:border-emerald-400/50",
  },
  profit: {
    accent: "amber",
    line: "from-amber-500 to-orange-400",
    text: "text-amber-300",
    hover: "hover:border-amber-400/50",
  },
};

const STATS = [
  { value: LEVELS.length, label: "уровня" },
  { value: TOTAL_LESSONS, label: "уроков" },
  { value: TOTAL_VISUALS, label: "наглядных схем" },
  { value: TOTAL_TESTS, label: "тестов модулей" },
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

const STEPS = [
  {
    title: "Уроки с практикой",
    text: "Каждый урок — короткие блоки: текст, схема и чек-лист. В конце — действие, которое можно повторить на своём принтере.",
  },
  {
    title: "Тесты модулей",
    text: `${TOTAL_TESTS} тестов, ${TOTAL_QUESTIONS} вопросов и ${TOTAL_EXPLANATIONS} пояснений: разбираем не только верный ответ, но и почему остальные не подходят.`,
  },
  {
    title: "Гейты, а не перемотка",
    text: "Следующий модуль открывается после сданного теста. Нельзя перепрыгнуть тему, не поняв её.",
  },
  {
    title: "Прогресс в кабинете",
    text: "Личный кабинет хранит пройденные уроки и результаты тестов. Возвращаешься — продолжаешь с того же места.",
  },
];

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
        {/* Герой: обещание пути + заглушка финального проекта */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-48 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-blue-600/20 blur-3xl sm:h-[42rem] sm:w-[42rem]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute top-48 -right-32 h-80 w-80 rounded-full bg-violet-600/15 blur-3xl"
          />

          <div className="relative mx-auto grid max-w-6xl gap-12 px-5 pt-16 pb-14 sm:px-8 sm:pt-24 sm:pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:pt-28">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/40 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-blue-200 sm:text-sm">
                <span aria-hidden>🖨️</span>
                {TOTAL_VISUALS} наглядных схем · {TOTAL_TESTS} тестов
              </span>

              <h1 className="mt-7 text-4xl leading-[1.05] font-extrabold tracking-tight text-white sm:text-6xl">
                От первой детали
                <br />
                до собственного{" "}
                <span className="bg-gradient-to-r from-blue-400 via-violet-300 to-amber-300 bg-clip-text text-transparent">
                  бизнеса
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300 sm:mt-8 sm:text-xl">
                {TOTAL_LESSONS} уроков, {TOTAL_VISUALS} наглядных схем,{" "}
                {TOTAL_TESTS} тестов. Путь от калибровки принтера до деталей под
                нагрузкой и продаж — без воды и стоковых картинок.
              </p>

              <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
                <Link
                  href={START_FREE_HREF}
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-blue-600 px-8 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  Начать бесплатно
                  <span aria-hidden>→</span>
                </Link>
                <Link
                  href="/subscription"
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-8 text-lg font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  Посмотреть тарифы
                </Link>
              </div>

              <p className="mt-6 text-sm text-slate-400">
                <span aria-hidden>✅</span> Первый уровень — бесплатно и без
                карты. Платные уровни открывает подписка Pro.
              </p>
            </div>

            <div className="relative">
              <div
                aria-hidden
                className="absolute -inset-4 rotate-2 rounded-[2rem] bg-gradient-to-br from-amber-400/20 via-violet-500/10 to-blue-500/20 blur-2xl"
              />
              <VisualPlaceholder
                code="Z8"
                title="Финальный проект"
                accent="amber"
                showCaption={false}
                className="relative shadow-2xl shadow-slate-950/60"
              />
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

        {/* Четыре уровня: для кого, что внутри, сколько уроков и схем */}
        <section
          id="levels"
          className="scroll-mt-20 border-t border-white/10 bg-gradient-to-b from-slate-900/40 to-transparent"
        >
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <p className="text-sm font-semibold tracking-widest text-blue-400 uppercase">
              Программа
            </p>
            <h2 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Четыре уровня — от новичка до дохода
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
              Уровни идут по порядку: сначала уверенная печать, потом инженерия,
              потом деньги. Внутри каждого — уроки, собственные схемы и тест
              модуля с пояснениями.
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

                    <p className="mt-4 text-sm leading-relaxed text-slate-300">
                      <span className="text-slate-500">Для кого: </span>
                      {level.audience}
                    </p>

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
                        href={level.isFree ? START_FREE_HREF : level.href}
                        className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                          level.isFree
                            ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25 hover:bg-blue-500"
                            : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
                        }`}
                      >
                        {level.isFree ? "Начать бесплатно" : "Открыть в Pro"}
                        <span aria-hidden>→</span>
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Галерея: стилизованные схемы четырёх уровней */}
        <section id="gallery" className="scroll-mt-20 border-t border-white/10">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <p className="text-sm font-semibold tracking-widest text-violet-400 uppercase">
              Галерея качества
            </p>
            <h2 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Схемы, нарисованные под каждый урок
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
              Не сток и не случайные нейрокартинки: каждый кадр собран из чисел и
              терминов конкретного блока. Вот по одной схеме с каждого уровня —
              от технологий печати до расчёта партии.
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

        {/* Как проходит обучение: практика, тесты, гейты, прогресс */}
        <section
          id="how"
          className="scroll-mt-20 border-t border-white/10 bg-gradient-to-b from-slate-900/50 to-transparent"
        >
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <p className="text-sm font-semibold tracking-widest text-emerald-400 uppercase">
              Как учим
            </p>
            <h2 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Это не видео «посмотрел и забыл»
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
              Курс устроен как практика с проверкой: урок → тест → следующий
              модуль. Прогресс хранится в кабинете, а не в голове после
              просмотра.
            </p>

            <ol className="mt-12 grid gap-5 sm:mt-14 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="relative flex flex-col rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-7"
                >
                  <span
                    aria-hidden
                    className="text-xs font-semibold tracking-[0.2em] text-emerald-300"
                  >
                    0{index + 1}
                  </span>
                  <h3 className="mt-3 text-lg font-bold text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {step.text}
                  </p>
                </li>
              ))}
            </ol>

            <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 px-5 py-4 text-sm text-slate-300">
              <span>
                <strong className="text-white">{TOTAL_TESTS}</strong> тестов
                модулей
              </span>
              <span>
                <strong className="text-white">{TOTAL_QUESTIONS}</strong>{" "}
                вопросов
              </span>
              <span>
                <strong className="text-white">{TOTAL_EXPLANATIONS}</strong>{" "}
                пояснений к ответам
              </span>
              <span className="text-slate-500">
                — проверка после каждого модуля
              </span>
            </div>
          </div>
        </section>

        {/* Тарифный тизер: бесплатный старт и Pro */}
        <section id="pricing" className="scroll-mt-20 border-t border-white/10">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <p className="text-sm font-semibold tracking-widest text-amber-400 uppercase">
              Тарифы
            </p>
            <h2 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Начни бесплатно — продолжишь по подписке
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
              Первый уровень не требует карты. Подписка Pro открывает сразу три
              платных уровня — без покупки курсов по отдельности.
            </p>

            <div className="mt-12 grid gap-6 sm:mt-14 lg:grid-cols-2 lg:gap-8">
              {/* Новичок — бесплатно */}
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

                <ul className="mt-6 space-y-3 text-sm leading-relaxed text-slate-300 sm:text-base">
                  <li className="flex items-start gap-3">
                    <span aria-hidden className="text-blue-300">
                      ✓
                    </span>
                    {LEVELS[0].lessons} уроков, {LEVELS[0].visuals} схем и{" "}
                    {LEVELS[0].tests} теста первого уровня
                  </li>
                  <li className="flex items-start gap-3">
                    <span aria-hidden className="text-blue-300">
                      ✓
                    </span>
                    15 типовых дефектов печати и их решения
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
                </div>
              </article>

              {/* Pro — платные уровни и продвинутый курс */}
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
                    Все платные уровни
                  </span>
                </div>

                <p className="relative mt-5 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-white">
                    {proPrice} ₽
                  </span>
                  <span className="text-sm text-slate-400">/мес</span>
                </p>

                <ul className="relative mt-6 space-y-3 text-sm leading-relaxed text-slate-300 sm:text-base">
                  <li className="flex items-start gap-3">
                    <span aria-hidden className="text-amber-300">
                      ✓
                    </span>
                    «Уверенный», «Инженер», «Заработок» — {PAID_LESSONS} уроков
                    и {PAID_VISUALS} схем
                  </li>
                  <li className="flex items-start gap-3">
                    <span aria-hidden className="text-amber-300">
                      ✓
                    </span>
                    {PAID_TESTS} тестов модулей с пояснениями к каждому ответу
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
                    Одна подписка на все платные материалы
                  </li>
                </ul>

                <div className="relative mt-auto pt-8">
                  <Link
                    href="/subscription"
                    className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-8 text-lg font-semibold text-slate-950 shadow-lg shadow-amber-500/25 transition-colors hover:from-amber-300 hover:to-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  >
                    Смотреть тарифы
                    <span aria-hidden>→</span>
                  </Link>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* Финальный CTA */}
        <section className="border-t border-white/10">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="relative overflow-hidden rounded-3xl border border-blue-400/20 bg-gradient-to-br from-blue-600/20 via-slate-900 to-violet-600/20 px-6 py-12 text-center sm:px-12 sm:py-16">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-blue-500/20 blur-3xl"
              />

              <h2 className="relative mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Начни с первой детали — бесплатно
              </h2>
              <p className="relative mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
                {LEVELS[0].lessons} уроков первого уровня, {LEVELS[0].visuals}{" "}
                схем и {LEVELS[0].tests} теста — без оплаты и карты. Дальше
                решаешь сам: остаться на бесплатном или открыть все уровни в
                Pro.
              </p>

              <div className="relative mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4">
                <Link
                  href={START_FREE_HREF}
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-blue-600 px-8 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  Начать бесплатно
                  <span aria-hidden>→</span>
                </Link>
                <Link
                  href="/subscription"
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-8 text-lg font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  Посмотреть тарифы
                </Link>
              </div>

              <p className="relative mx-auto mt-8 max-w-2xl text-sm leading-relaxed text-slate-400">
                TriDi — практический курс по 3D-печати: {TOTAL_VISUALS} схем,{" "}
                {TOTAL_TESTS} тестов и путь от калибровки принтера до продаж.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}






