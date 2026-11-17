import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Header } from "@/components/Header";
import { ButtonLink } from "@/components/ui";
import {
  TAB_HELP,
  type TabHelpId,
} from "@/components/workshop/workshop-tab-help";
import { OG_IMAGE } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";

/**
 * Публичная витрина Мастерской.
 *
 * Гость не попадает в `/dashboard/workshop`: там нужны сессия и подписка Pro.
 * Без этой страницы подписку продавала только строчка на главной — человеку
 * негде было увидеть, из чего состоит CRM, и он покупал вслепую.
 *
 * Тексты вкладок берутся из `TAB_HELP` — того же источника, что подсказки «?»
 * внутри мастерской. Поэтому витрина не может обещать раздел, которого нет:
 * правка подсказки обновляет и лендинг. Агент печати описан отдельно: это не
 * вкладка, а программа для Windows, без которой ферма не печатает.
 */

const PAGE_TITLE = "Мастерская 3D-печатника: заказы, склад и принтеры";
const PAGE_DESCRIPTION =
  "Мастерская TriDi в подписке Pro: заказы с Ozon, Wildberries и Яндекс Маркета, склад пластика со списанием, ферма принтеров с агентом печати, калькулятор себестоимости и печатные документы заказа.";
const PAGE_IMAGE_ALT =
  "TriDi: мастерская 3D-печатника с заказами, принтерами и складом";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/tools/workshop" },
  // Свой openGraph: без него og:url наследовался бы от /tools.
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "TriDi",
    url: "/tools/workshop",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [
      {
        ...OG_IMAGE,
        alt: PAGE_IMAGE_ALT,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [
      {
        url: OG_IMAGE.url,
        alt: PAGE_IMAGE_ALT,
      },
    ],
  },
};

/** Шапка читает cookies, поэтому страница собирается на каждый запрос. */
export const dynamic = "force-dynamic";

/** Палитра карточек: те же оттенки, что у вкладок в мастерской. */
type Tone = "blue" | "violet" | "emerald" | "amber";

const TONE_BOX: Record<Tone, string> = {
  blue: "border-blue-400/30 bg-blue-500/10 text-blue-300",
  violet: "border-violet-400/30 bg-violet-500/10 text-violet-300",
  emerald: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
  amber: "border-amber-400/30 bg-amber-500/10 text-amber-300",
};

/**
 * Что мастерская берёт на себя: по карточке на ежедневную задачу печатника.
 * Порядок повторяет рабочий день: заказ, материал, станок, деньги, документы,
 * повторная продажа.
 */
const WORKFLOW: { title: string; text: string; tone: Tone }[] = [
  {
    title: "Заказы и доска статусов",
    text: "Заказы с маркетплейсов и ручные в одной доске. Карточка переезжает: новый, в печати, готов, выдан.",
    tone: "blue",
  },
  {
    title: "Склад пластика",
    text: "Катушки, остаток в граммах и порог «пора купить». Списание материала идёт при завершении печати.",
    tone: "violet",
  },
  {
    title: "Ферма принтеров",
    text: "Станки с наработкой и регламентами ТО. Кнопка «Распределить» раздаёт задачи свободным принтерам.",
    tone: "emerald",
  },
  {
    title: "Себестоимость до печати",
    text: "Материал, электричество, амортизация и работа. Цена и прибыль видны до запуска, а не после.",
    tone: "amber",
  },
  {
    title: "Документы заказа",
    text: "Спецификация и накладная собираются из заказа. Реквизиты вводятся один раз и подставляются сами.",
    tone: "blue",
  },
  {
    title: "Клиенты и товары",
    text: "База клиентов с историей заказов. SKU маркетплейсов в карточке товара привязывают заказы сами.",
    tone: "violet",
  },
];

/**
 * Порядок вкладок на витрине. `agent` сюда не входит: это шаг тура про
 * программу печати, а не раздел рабочей области, и о нём отдельный блок.
 */
const TAB_ORDER: Exclude<TabHelpId, "agent">[] = [
  "orders",
  "products",
  "inventory",
  "printers",
  "clients",
  "calculator",
  "requisites",
  "integrations",
];

/** Порядок подключения агента: без всех трёх шагов принтеры останутся офлайн. */
const AGENT_STEPS: { title: string; text: string }[] = [
  {
    title: "Скачайте TriDiAgent.exe",
    text: "Файл лежит во вкладке «Интеграции». Ставится на компьютер рядом с принтерами.",
  },
  {
    title: "Вставьте токен агента",
    text: "Токен выдаётся там же. Отдельной регистрации у программы нет.",
  },
  {
    title: "Найдите принтеры в сети",
    text: "Кнопка «Найти принтеры в сети» добавит станки в мастерскую.",
  },
];

/** Как начать: три шага от входа до первого заказа. */
const START_STEPS: { title: string; text: string }[] = [
  {
    title: "Войдите в аккаунт",
    text: "Мастерская открывается только с сессией: заказы и склад привязаны к профилю.",
  },
  {
    title: "Оформите подписку Pro",
    text: "Одна подписка открывает мастерскую, конструктор, профили и генератор.",
  },
  {
    title: "Добавьте принтер, катушку и товар",
    text: "С этого набора мастерская считает себестоимость и распределяет задания.",
  },
];

/**
 * Честные ограничения. Мастерская не заменяет слайсер и бухгалтерию и не
 * работает без доступа продавца к маркетплейсу — об этом лучше сказать до
 * оплаты, чем после.
 */
const LIMITS: string[] = [
  "Не слайсер: модели по-прежнему режутся в Bambu Studio, OrcaSlicer или PrusaSlicer.",
  "Не бухгалтерия: налоги, чеки и отчётность остаются в сторонних сервисах.",
  "Доска свёрстана для широкого экрана: на телефоне работают не все разделы.",
  "Маркетплейсам нужен доступ продавца: ключи выдаёт кабинет Ozon, WB или Яндекса.",
];

/**
 * Скриншоты демо-мастерской: снимает `npm run shots:workshop` с настоящих
 * вкладок демо-аккаунта. Подпись под галереей честно говорит, что данные
 * демонстрационные, — иначе покупатель решит, что видит чужую CRM.
 *
 * `unoptimized`: файлы уже сжаты при съёмке (JPEG 88 %), а оптимизатор Next в
 * standalone-сборке на Amvera остаётся без sharp — пусть отдаётся как есть.
 */
const SCREENSHOTS: {
  src: string;
  title: string;
  text: string;
  width: number;
  height: number;
}[] = [
  {
    src: "/workshop/orders.jpg",
    title: "Заказы",
    text: "Канбан со статусами, сроками и активными заданиями печати.",
    width: 2160,
    height: 1725,
  },
  {
    src: "/workshop/stock.jpg",
    title: "Склад",
    text: "Остатки катушек, цена за килограмм и красная строка «пора докупить».",
    width: 2160,
    height: 1725,
  },
  {
    src: "/workshop/printers.jpg",
    title: "Принтеры",
    text: "Наработка сопла и смазки, прогресс печати и очередь заданий.",
    width: 2160,
    height: 1725,
  },
  {
    src: "/workshop/clients.jpg",
    title: "Клиенты",
    text: "Контакты, адреса и заметки — подставляются в заказ и накладную.",
    width: 2160,
    height: 1725,
  },
  {
    src: "/workshop/calculator.jpg",
    title: "Калькулятор",
    text: "Себестоимость по вашему тарифу, рекомендованная цена и прибыль.",
    width: 2160,
    height: 1725,
  },
];

/**
 * Страница собирается на каждый запрос: шапка читает cookies, а кнопки героя
 * зависят от сессии и подписки.
 */
export default async function WorkshopLandingPage({
  searchParams,
}: {
  /** `?demo=unavailable|error` — итог попытки открыть демо-мастерскую. */
  searchParams: Promise<{ demo?: string }>;
}) {
  const demoState = (await searchParams).demo;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const hasPro = user ? await hasActiveSubscription(supabase, user.id) : false;

  // Куда ведёт главная кнопка: гость уходит на вход с возвратом в мастерскую,
  // ученик без подписки — на витрину Pro, владелец подписки — в рабочую область.
  const primaryHref = hasPro
    ? "/dashboard/workshop"
    : user
      ? "/pricing"
      : "/auth/login?next=/dashboard/workshop";
  const primaryLabel = hasPro
    ? "Открыть мастерскую"
    : user
      ? "Оформить подписку Pro"
      : "Войти и открыть мастерскую";

  return (
    <div className="min-h-screen text-slate-100">
      <Header />

      <main>
        {/* Герой: что это, для кого и как открывается */}
        <section className="relative overflow-hidden border-b border-white/10">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-amber-500/15 blur-3xl sm:h-[38rem] sm:w-[38rem]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute top-24 -right-24 h-72 w-72 rounded-full bg-blue-600/15 blur-3xl"
          />

          <div className="relative mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <p className="text-sm font-semibold tracking-widest text-amber-400 uppercase">
              Мастерская · подписка Pro
            </p>

            <h1 className="mt-4 max-w-4xl text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
              Заказы, принтеры и склад
              <br />
              в одном окне
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-300 sm:text-xl">
              Мастерская TriDi — рабочее место печатника: заказы с маркетплейсов,
              пластик, ферма и документы. Открывается подпиской Pro, отдельной
              платы за мастерскую нет.
            </p>

            <div className="mt-7 flex flex-wrap gap-2.5 text-xs font-semibold sm:text-sm">
              <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300">
                {TAB_ORDER.length} разделов
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300">
                Печатные документы заказа
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300">
                Агент печати для Windows
              </span>
            </div>

            <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
              <ButtonLink
                href={primaryHref}
                size="lg"
                fullWidth
                className="sm:w-auto"
              >
                {primaryLabel}
                <span aria-hidden>→</span>
              </ButtonLink>
              <ButtonLink
                href={hasPro ? "/tools" : "/pricing"}
                variant="secondary"
                size="lg"
                fullWidth
                className="sm:w-auto"
              >
                {hasPro ? "Все инструменты" : "Что входит в Pro"}
              </ButtonLink>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <a
                href="/api/demo/workshop"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-5 text-sm font-semibold text-emerald-200 transition-colors hover:border-emerald-300/60 hover:text-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Смотреть демо-мастерскую
                <span aria-hidden>↗</span>
              </a>
              <p className="text-xs leading-relaxed text-slate-400">
                Без регистрации: данные можно листать и считать, но не менять.
              </p>
            </div>

            {demoState === "unavailable" || demoState === "error" ? (
              <p
                role="status"
                className="mt-4 max-w-2xl rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
              >
                {demoState === "unavailable"
                  ? "Демо-доступ выключен: на сервере не задан пароль демо-аккаунта."
                  : "Не удалось войти в демо. Обновите страницу и попробуйте ещё раз."}
              </p>
            ) : null}

            <p className="mt-6 text-sm text-slate-300">
              <span aria-hidden>✅</span> Подписка Pro открывает мастерскую и
              остальные инструменты сразу после оплаты.
            </p>
          </div>
        </section>

        {/* Шесть задач, которые мастерская снимает с печатника */}
        <section
          aria-labelledby="workshop-workflow-title"
          className="border-b border-white/10"
        >
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <p className="text-sm font-semibold tracking-widest text-blue-400 uppercase">
              Что внутри
            </p>
            <h2
              id="workshop-workflow-title"
              className="mt-3 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl"
            >
              Рабочий день печатника без таблиц
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Заказ, материал, станок, деньги и документы живут в одной базе.
              Данные не переносятся руками между файлами.
            </p>

            <ul className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {WORKFLOW.map((card, index) => (
                <li
                  key={card.title}
                  className="flex flex-col rounded-2xl border border-white/10 border-t-white/20 bg-white/[0.03] p-6"
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-xl border text-sm font-bold ${TONE_BOX[card.tone]}`}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="mt-5 text-xl font-bold tracking-tight text-white">
                    {card.title}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">
                    {card.text}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Разделы рабочей области: тексты из подсказок самой мастерской */}
        <section
          aria-labelledby="workshop-tabs-title"
          className="border-b border-white/10 bg-white/[0.02]"
        >
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <p className="text-sm font-semibold tracking-widest text-violet-400 uppercase">
              Разделы
            </p>
            <h2
              id="workshop-tabs-title"
              className="mt-3 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl"
            >
              Восемь вкладок, одна база
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Слева список разделов, справа работа. Описания совпадают с
              подсказками «?» внутри мастерской.
            </p>

            <ul className="mt-10 grid gap-4 md:grid-cols-2">
              {TAB_ORDER.map((id) => (
                <li
                  key={id}
                  className="rounded-2xl border border-white/10 bg-[#0a0a0a]/60 p-6"
                >
                  <p className="text-lg font-bold tracking-tight text-white">
                    {TAB_HELP[id].title}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {TAB_HELP[id].text}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Как это выглядит: снимки настоящих вкладок демо-аккаунта */}
        <section
          aria-labelledby="workshop-screens-title"
          className="border-b border-white/10"
        >
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <p className="text-sm font-semibold tracking-widest text-emerald-400 uppercase">
              Демо
            </p>
            <h2
              id="workshop-screens-title"
              className="mt-3 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl"
            >
              Посмотрите мастерскую до оплаты
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Это настоящие вкладки демо-аккаунта: заказы, склад, принтеры и база
              клиентов. Откройте демо целиком — данные можно листать и считать,
              но не менять.
            </p>

            <ul className="mt-10 grid gap-5 md:grid-cols-2">
              {SCREENSHOTS.map((shot, index) => (
                <li
                  key={shot.src}
                  className={`overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a]/70 ${
                    index === SCREENSHOTS.length - 1 &&
                    SCREENSHOTS.length % 2 === 1
                      ? "md:col-span-2"
                      : ""
                  }`}
                >
                  <Image
                    src={shot.src}
                    alt={`Мастерская TriDi: вкладка «${shot.title}» с демонстрационными данными`}
                    width={shot.width}
                    height={shot.height}
                    unoptimized
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="h-auto w-full border-b border-white/10"
                  />
                  <div className="p-5">
                    <p className="text-lg font-bold tracking-tight text-white">
                      {shot.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-300">
                      {shot.text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-xs text-slate-400">
              Данные демонстрационные: имена клиентов и заказы придуманы для
              показа.
            </p>

            <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.07] p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-lg font-bold text-white">
                  Демо-доступ без регистрации
                </p>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-300">
                  Внутри только чтение: сохранить заказ, клиента или настройки
                  нельзя. При нажатии «Сохранить» мастерская объяснит это и
                  предложит оформить Pro.
                </p>
              </div>
              <a
                href="/api/demo/workshop"
                className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Открыть демо
                <span aria-hidden>→</span>
              </a>
            </div>
          </div>
        </section>

        {/* Агент печати: без него ферма не увидит станки */}
        <section
          aria-labelledby="workshop-agent-title"
          className="border-b border-white/10"
        >
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold tracking-widest text-emerald-400 uppercase">
                Агент печати
              </p>
              <h2
                id="workshop-agent-title"
                className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl"
              >
                Принтеры связывает программа
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-300 sm:text-lg">
                TriDiAgent.exe работает на компьютере рядом со станками. Он
                находит принтеры в локальной сети и передаёт им задания из
                мастерской.
              </p>
              <p className="mt-4 text-base leading-relaxed text-slate-300">
                {TAB_HELP.agent.text}
              </p>
              <p className="mt-6 text-sm leading-relaxed text-slate-400">
                Программа и токен выдаются во вкладке «Интеграции» после оплаты
                подписки.
              </p>
            </div>

            <ol className="space-y-3">
              {AGENT_STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                >
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/10 text-sm font-bold text-emerald-300"
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base font-semibold text-white">
                      {step.title}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-slate-300">
                      {step.text}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Как начать: три шага от входа до первого заказа */}
        <section
          aria-labelledby="workshop-start-title"
          className="border-b border-white/10 bg-white/[0.02]"
        >
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <p className="text-sm font-semibold tracking-widest text-blue-400 uppercase">
              Начало работы
            </p>
            <h2
              id="workshop-start-title"
              className="mt-3 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl"
            >
              Первый заказ за три шага
            </h2>

            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {START_STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="rounded-2xl border border-white/10 bg-[#0a0a0a]/60 p-6"
                >
                  <span className="text-sm font-bold tracking-[0.2em] text-blue-300 uppercase">
                    Шаг {index + 1}
                  </span>
                  <p className="mt-3 text-lg font-bold tracking-tight text-white">
                    {step.title}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {step.text}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Ограничения: сказать до оплаты, а не после */}
        <section
          aria-labelledby="workshop-limits-title"
          className="border-b border-white/10"
        >
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <div className="rounded-3xl border border-amber-400/25 bg-amber-500/[0.06] p-6 sm:p-8">
              <h2
                id="workshop-limits-title"
                className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
              >
                Чего мастерская не делает
              </h2>
              <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-200">
                Границы честные: инструмент ведёт заказы и ферму, но не заменяет
                весь софт мастерской.
              </p>
              <ul className="mt-6 grid gap-3 md:grid-cols-2">
                {LIMITS.map((limit) => (
                  <li
                    key={limit}
                    className="flex gap-3 text-sm leading-relaxed text-slate-200"
                  >
                    <span
                      aria-hidden
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300"
                    />
                    <span>{limit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Финальный призыв: та же кнопка, что в герое, и вход в каталог */}
        <section aria-labelledby="workshop-cta-title">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <div className="flex flex-col gap-6 rounded-3xl border border-blue-400/20 bg-blue-500/[0.07] p-6 md:flex-row md:items-center md:justify-between sm:p-8">
              <div>
                <h2
                  id="workshop-cta-title"
                  className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
                >
                  Поставьте ферму на учёт
                </h2>
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-200">
                  Подписка Pro открывает мастерскую, конструктор, профили печати и
                  генератор по фото. Одной оплаты хватает на все инструменты.
                </p>
                <p className="mt-3 text-sm text-slate-300">
                  Сначала хотите посмотреть остальное?{" "}
                  <Link
                    href="/tools"
                    className="font-semibold text-blue-200 underline underline-offset-4 transition-colors hover:text-white"
                  >
                    Все инструменты платформы
                  </Link>
                  .
                </p>
              </div>

              <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row md:flex-col lg:flex-row">
                <ButtonLink href={primaryHref} size="lg">
                  {primaryLabel}
                  <span aria-hidden>→</span>
                </ButtonLink>
                {hasPro ? null : (
                  <ButtonLink href="/pricing" variant="secondary" size="lg">
                    Цена и состав Pro
                  </ButtonLink>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
