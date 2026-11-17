import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { PlanButton } from "@/app/subscription/PlanButton";
import { Header } from "@/components/Header";
import { MODEL_TYPES } from "@/lib/constructor/model-types";
import { pluralize } from "@/lib/course-stats";
import { defects } from "@/lib/defects";
import { SUBSCRIPTION_PLAN, TOKEN_PACKS } from "@/lib/generation-plans";
import { getPaymentAmount } from "@/lib/payments";
import { profileCount } from "@/lib/profiles";
import { OG_IMAGE } from "@/lib/seo";

/**
 * Тарифы платформы: подписка Pro на инструменты.
 *
 * Подписка продаётся здесь как доступ к инструментам, и первый из них —
 * Мастерская: заказы с маркетплейсов, склад пластика, принтеры, документы.
 * Конструктор, профили печати и лимиты генератора идут в том же пакете, но
 * перечислены после мастерской, потому что рутину снимает именно она.
 *
 * Пакетов токенов на этой странице больше нет: разовую докупку генераций
 * показываем только в генераторе по фото (`/3d-generator`), где виден остаток
 * баланса. Здесь остаётся ссылка на него и цены из каталога — чтобы человек
 * понимал разницу между подпиской и разовой покупкой.
 *
 * Цены не дублируются в разметке: подписка берётся из `data/courses.json`
 * (через `getPaymentAmount`), пакеты — из `data/generation-plans.json`. Кнопки
 * `PlanButton` создают подписанную ссылку Robokassa на сервере, поэтому
 * подменить сумму в браузере нельзя. Курсы живут отдельно — на `/subscription`,
 * и их цены сюда не попадают.
 *
 * Страница публичная: посмотреть тарифы можно без входа, а оплата попросит
 * аккаунт (после входа человек вернётся сюда же — `loginHref`).
 */

/** Цена в рублях с разделителями разрядов: 500 → «500», 1 500 → «1 500». */
const formatPrice = (price: number) => price.toLocaleString("ru-RU");

/** Формы склонения: 193 профиля, 6 дефектов — без них «профилей» выглядит ошибкой. */
const PROFILE_FORMS: [string, string, string] = ["профиль", "профиля", "профилей"];
const DEFECT_FORMS: [string, string, string] = ["дефект", "дефекта", "дефектов"];

/** Цена подписки из каталога: одна и та же в метаданных, карточке и оплате. */
const SUBSCRIPTION_PRICE = getPaymentAmount(SUBSCRIPTION_PLAN.courseId);

const PAGE_TITLE = "Подписка Pro: мастерская и инструменты 3D-печати";
const PAGE_DESCRIPTION = `Мастерская Pro за ${formatPrice(SUBSCRIPTION_PRICE)} ₽: заказы с Ozon, Wildberries и Яндекс Маркета, склад пластика, принтеры и документы. Плюс конструктор, профили печати и генератор по фото.`;
const PAGE_IMAGE_ALT =
  "TriDi: подписка Pro — мастерская, конструктор и профили печати";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/pricing" },
  // Свои openGraph и twitter: иначе в мессенджере развернулась бы карточка
  // главной с продуктовым описанием генератора, а og:url указывал бы на «/».
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "TriDi",
    url: "/pricing",
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

/**
 * Карточки инструментов под подпиской: что открывает Pro и что остаётся
 * бесплатным.
 *
 * Мастерская идёт первой: подписка продаётся как рабочее место печатника, а
 * генератор, конструктор и профили — соседние инструменты того же пакета.
 * Ссылки совпадают с шапкой и центром инструментов (`/tools`), чтобы человек
 * попадал в тот же раздел, что и из меню.
 */
const TOOL_CARDS = [
  {
    href: "/tools/workshop",
    tag: "Pro · Мастерская",
    title: "Мастерская",
    description:
      "Заказы с Ozon, Wildberries и Яндекс Маркета, доска статусов, склад пластика, принтеры, клиенты, калькулятор себестоимости и документы.",
    cta: "Что внутри мастерской",
  },
  {
    href: "/constructor",
    tag: "Pro · Конструктор",
    title: "Конструктор 3D",
    description: `${MODEL_TYPES.length} параметрических моделей: вазы, брелоки, вывески, литофаны, кашпо и органайзеры. STL без месячного лимита.`,
    cta: "Открыть конструктор",
  },
  {
    href: "/profiles",
    tag: "Pro · Профили",
    title: "Профили печати",
    description: `${profileCount} ${pluralize(profileCount, PROFILE_FORMS)} принтеров и материалов для Bambu Studio, OrcaSlicer и PrusaSlicer.`,
    cta: "Открыть библиотеку",
  },
  {
    href: "/3d-generator",
    tag: "Pro · Генератор",
    title: "Генератор по фото",
    description: `Модель из 1–4 снимков: ${SUBSCRIPTION_PLAN.standardPerMonth} Standard и ${SUBSCRIPTION_PLAN.ultraPerMonth} Ultra каждый месяц входят в подписку.`,
    cta: "Открыть генератор",
  },
  {
    href: "/tools/defects",
    tag: "Бесплатно",
    title: "Диагностика дефектов",
    description:
      "Справочник проблем печати: причины по частоте и пошаговые решения для слайсера и принтера.",
    cta: "Открыть диагностику",
  },
  {
    href: "/forum",
    tag: "Бесплатно",
    title: "Форум",
    description:
      "Разборы печати, настройки от участников и ответы на вопросы по конкретной модели.",
    cta: "Открыть форум",
  },
] as const;

/** Строка списка возможностей: галочка и текст. */
function PlanFeature({
  children,
  accent = "text-emerald-300",
}: {
  children: ReactNode;
  accent?: string;
}) {
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden className={accent}>
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen text-zinc-100">
      <Header />

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <section aria-labelledby="pricing-title">
          <p className="text-xs font-semibold tracking-widest text-amber-300 uppercase">
            Подписка Pro
          </p>
          <h1
            className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl"
            id="pricing-title"
          >
            Все инструменты печатника в одной подписке
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Мастерская снимает рутину: заказы с маркетплейсов, склад пластика,
            принтеры и документы в одном окне. С ней открываются конструктор,
            профили печати и лимиты генератора по фото. Курсы покупаются
            отдельно — эта страница только про инструменты.
          </p>

          <div className="mt-6 flex flex-wrap gap-2.5 text-xs font-semibold sm:text-sm">
            <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300">
              Мастерская · CRM для 3D-печати
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300">
              {MODEL_TYPES.length} моделей Конструктора
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300">
              {profileCount} {pluralize(profileCount, PROFILE_FORMS)} печати
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300">
              {defects.length} {pluralize(defects.length, DEFECT_FORMS)} бесплатно
            </span>
          </div>
        </section>

        <section
          aria-labelledby="plan-pro-title"
          className="mt-8 rounded-[1.75rem] border border-amber-300/30 bg-gradient-to-b from-amber-400/[0.08] to-[#0a0a0a]/80 p-5 shadow-[0_30px_90px_-60px_rgba(0,0,0,1)] sm:p-7"
        >
          <div className="grid gap-7 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-10">
            <div className="flex flex-col">
              <span className="inline-flex w-fit items-center rounded-full border border-amber-300/40 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-amber-200 uppercase">
                Подписка
              </span>
              <h2
                className="mt-4 text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
                id="plan-pro-title"
              >
                {SUBSCRIPTION_PLAN.title}
              </h2>
              <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-4xl font-extrabold text-white">
                  {formatPrice(SUBSCRIPTION_PRICE)} ₽
                </span>
                <span className="text-sm text-slate-300">за 30 дней</span>
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Один платёж открывает платформу на аккаунт. Продление ручное:
                каждый следующий платёж добавляет ещё 30 дней, автосписаний нет.
              </p>
              <div className="mt-5">
                <PlanButton
                  courseId={SUBSCRIPTION_PLAN.courseId}
                  label="Подключить Pro"
                  loginHref="/pricing"
                  size="compact"
                  variant="gold"
                />
              </div>
              <Link
                className="mt-3 inline-flex min-h-8 items-center gap-1.5 text-xs font-semibold text-amber-200 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303] focus-visible:outline-none"
                href="/tools/workshop"
              >
                Что внутри мастерской
                <span aria-hidden>→</span>
              </Link>
            </div>

            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-widest text-amber-300 uppercase">
                Что входит
              </p>
              <ul className="mt-3 grid gap-2.5 text-sm leading-relaxed text-slate-200 sm:grid-cols-2">
                <PlanFeature accent="text-amber-300">
                  <strong className="font-semibold text-white">
                    Мастерская:
                  </strong>{" "}
                  заказы с Ozon, Wildberries и Яндекс Маркета на одной доске
                </PlanFeature>
                <PlanFeature accent="text-amber-300">
                  <strong className="font-semibold text-white">Склад:</strong>{" "}
                  катушки, остатки пластика и списание материала на заказ
                </PlanFeature>
                <PlanFeature accent="text-amber-300">
                  <strong className="font-semibold text-white">Принтеры:</strong>{" "}
                  наработка, обслуживание и распределение задач печати
                </PlanFeature>
                <PlanFeature accent="text-amber-300">
                  <strong className="font-semibold text-white">Документы:</strong>{" "}
                  спецификации заказов, накладные и реквизиты для маркировки
                </PlanFeature>
                <PlanFeature accent="text-amber-300">
                  <strong className="font-semibold text-white">
                    Конструктор:
                  </strong>{" "}
                  все {MODEL_TYPES.length} моделей и STL без месячного лимита
                </PlanFeature>
                <PlanFeature accent="text-amber-300">
                  <strong className="font-semibold text-white">
                    Профили печати:
                  </strong>{" "}
                  {profileCount} {pluralize(profileCount, PROFILE_FORMS)} для слайсеров
                </PlanFeature>
                <PlanFeature accent="text-amber-300">
                  <strong className="font-semibold text-white">
                    Генератор по фото:
                  </strong>{" "}
                  {SUBSCRIPTION_PLAN.standardPerMonth} Standard и{" "}
                  {SUBSCRIPTION_PLAN.ultraPerMonth} Ultra каждый месяц
                </PlanFeature>
                <PlanFeature accent="text-amber-300">
                  <strong className="font-semibold text-white">Лицензия:</strong>{" "}
                  печать и продажа изделий по своим моделям
                </PlanFeature>
              </ul>
            </div>
          </div>
        </section>

        <section aria-labelledby="pricing-tools-title" className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-widest text-amber-300 uppercase">
                Инструменты
              </p>
              <h2
                className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
                id="pricing-tools-title"
              >
                Что открывает подписка
              </h2>
            </div>
            <Link
              className="inline-flex min-h-8 items-center gap-1.5 text-sm font-semibold text-slate-300 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303] focus-visible:outline-none"
              href="/tools"
            >
              Все инструменты
              <span aria-hidden>→</span>
            </Link>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOOL_CARDS.map((tool) => (
              <Link
                key={tool.href}
                className="group flex h-full flex-col rounded-3xl border border-white/[0.07] bg-[#0a0a0a]/60 p-5 transition-colors hover:border-white/20 hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303] focus-visible:outline-none"
                href={tool.href}
              >
                <span className="text-[11px] font-semibold tracking-wide text-amber-300 uppercase">
                  {tool.tag}
                </span>
                <span className="mt-2 text-lg font-bold tracking-tight text-white">
                  {tool.title}
                </span>
                <span className="mt-2 flex-1 text-sm leading-relaxed text-slate-300">
                  {tool.description}
                </span>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-200 transition-colors group-hover:text-white">
                  {tool.cta}
                  <span
                    aria-hidden
                    className="transition-transform duration-200 group-hover:translate-x-1"
                  >
                    →
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="pricing-separate-title" className="mt-10">
          <p className="text-xs font-semibold tracking-widest text-amber-300 uppercase">
            Отдельно
          </p>
          <h2
            className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
            id="pricing-separate-title"
          >
            Что покупается не в подписке
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {/* Курсы живут на /subscription: здесь только указатель. */}
            <article className="flex h-full flex-col rounded-3xl border border-white/[0.07] bg-[#0a0a0a]/60 p-5 sm:p-6">
              <span className="text-[11px] font-semibold tracking-wide text-blue-300 uppercase">
                Обучение
              </span>
              <h3 className="mt-2 text-lg font-bold tracking-tight text-white">
                Курсы по 3D-печати
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-300">
                Четыре уровня: от распаковки принтера до первых заказов и
                заработка. Первый уровень бесплатный, платные покупаются
                навсегда и не входят в Pro.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-slate-200 transition-colors hover:border-white/30 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303] focus-visible:outline-none"
                  href="/subscription"
                >
                  Курсы и уровни
                  <span aria-hidden>→</span>
                </Link>
                <Link
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-slate-300 underline underline-offset-4 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303] focus-visible:outline-none"
                  href="/start"
                >
                  Начать бесплатно
                </Link>
              </div>
            </article>

            {/*
              Токены покупаются только в генераторе: там виден остаток баланса
              и выбор качества, поэтому на витрине остаются цены и ссылка, а не
              кнопка оплаты.
            */}
            <article className="flex h-full flex-col rounded-3xl border border-fuchsia-300/25 bg-gradient-to-b from-fuchsia-500/[0.08] to-[#0a0a0a]/60 p-5 sm:p-6">
              <span className="text-[11px] font-semibold tracking-wide text-fuchsia-300 uppercase">
                Генератор
              </span>
              <h3 className="mt-2 text-lg font-bold tracking-tight text-white">
                Пакеты токенов
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-300">
                Разовая докупка генераций: {TOKEN_PACKS.standard.quantity}{" "}
                Standard за {formatPrice(TOKEN_PACKS.standard.price)} ₽ или{" "}
                {TOKEN_PACKS.ultra.quantity} Ultra за{" "}
                {formatPrice(TOKEN_PACKS.ultra.price)} ₽. Токены не сгорают и не
                зависят от подписки.
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Покупка — на странице генератора: там виден остаток баланса и
                выбор качества.
              </p>
              <div className="mt-4">
                <Link
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-blue-500 px-4 text-sm font-extrabold text-white shadow-lg shadow-fuchsia-500/25 transition-transform hover:scale-[1.01] focus-visible:ring-2 focus-visible:ring-fuchsia-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303] focus-visible:outline-none"
                  href="/3d-generator"
                >
                  Открыть генератор
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </article>
          </div>
        </section>

        <section
          aria-labelledby="pricing-order-title"
          className="mt-10 rounded-[1.75rem] border border-white/[0.07] bg-[#0a0a0a]/60 p-5 sm:p-7"
        >
          <h2
            className="text-lg font-extrabold tracking-tight text-white sm:text-xl"
            id="pricing-order-title"
          >
            Генерации: что оплачено и когда списывается
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
            Подписка — это в первую очередь инструменты. Генерации по фото идут
            бонусом: месячный лимит обновляется автоматически, а докупить объём
            можно пакетом прямо в генераторе.
          </p>
          <ol className="mt-5 grid gap-4 sm:grid-cols-3">
            <li className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <span
                aria-hidden
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs font-bold text-zinc-300"
              >
                1
              </span>
              <p className="mt-3 text-sm font-semibold text-white">
                Лимиты подписки
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                {SUBSCRIPTION_PLAN.standardPerMonth} Standard и{" "}
                {SUBSCRIPTION_PLAN.ultraPerMonth} Ultra каждый месяц, остаток
                обновляется 1-го числа.
              </p>
            </li>
            <li className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <span
                aria-hidden
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs font-bold text-zinc-300"
              >
                2
              </span>
              <p className="mt-3 text-sm font-semibold text-white">
                Бесплатная Standard
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                Одна генерация на аккаунт — навсегда. Для Ultra бесплатных нет.
              </p>
            </li>
            <li className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <span
                aria-hidden
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs font-bold text-zinc-300"
              >
                3
              </span>
              <p className="mt-3 text-sm font-semibold text-white">
                Купленные токены
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                Тратятся последними и не сгорают. Если сеть отказала, списание
                возвращается.
              </p>
            </li>
          </ol>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-5 text-sm font-extrabold text-slate-950 shadow-lg shadow-amber-500/25 transition-transform hover:scale-[1.01] focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303] focus-visible:outline-none"
              href="/dashboard/workshop"
            >
              Открыть мастерскую
              <span aria-hidden>→</span>
            </Link>
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/30 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303] focus-visible:outline-none"
              href="/3d-generator"
            >
              Открыть генератор
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
