import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { PlanButton } from "@/app/subscription/PlanButton";
import { Header } from "@/components/Header";
import { SUBSCRIPTION_PLAN, TOKEN_PACKS } from "@/lib/generation-plans";
import { getPaymentAmount } from "@/lib/payments";
import { OG_IMAGE } from "@/lib/seo";

/**
 * Тарифы генератора 3D: подписка и пакеты токенов.
 *
 * Цены не дублируются в разметке: подписка берётся из `data/courses.json`
 * (через `getPaymentAmount`), пакеты — из `data/generation-plans.json`. Кнопки
 * `PlanButton` создают подписанную ссылку Robokassa на сервере, поэтому
 * подменить сумму в браузере нельзя.
 *
 * Страница публичная: посмотреть тарифы можно без входа, а оплата попросит
 * аккаунт (после входа человек вернётся сюда же — `loginHref`).
 */
export const metadata: Metadata = {
  title: "Тарифы генератора 3D",
  description:
    "Подписка Pro с 3 генерациями Standard и 1 Ultra каждый месяц, пакеты Standard и Ultra без срока действия. Одна бесплатная генерация Standard — после регистрации.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Тарифы генератора 3D",
    description:
      "Подписка Pro, пакеты Standard и Ultra: выберите, сколько 3D-моделей нужно в месяц.",
    images: [OG_IMAGE],
  },
};

/** Цена в рублях с разделителями разрядов: 500 → «500», 1 500 → «1 500». */
const formatPrice = (price: number) => price.toLocaleString("ru-RU");

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
  const subscriptionPrice = getPaymentAmount(SUBSCRIPTION_PLAN.courseId);

  return (
    <div className="min-h-screen text-zinc-100">
      <Header />

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <section aria-labelledby="pricing-title">
          <p className="text-xs font-semibold tracking-widest text-fuchsia-300 uppercase">
            Генератор 3D
          </p>
          <h1
            className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl"
            id="pricing-title"
          >
            Тарифы: подписка или пакеты токенов
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
            После регистрации доступна одна бесплатная генерация Standard.
            Подписка Pro добавляет 3 Standard и 1 Ultra каждый месяц, а пакеты
            токенов покупаются разово и не сгорают — их можно брать сколько
            угодно.
          </p>
        </section>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {/* Подписка: месячные лимиты обновляются 1-го числа. */}
          <section
            aria-labelledby="plan-subscription-title"
            className="flex flex-col rounded-[1.75rem] border border-amber-300/30 bg-gradient-to-b from-amber-400/[0.08] to-[#0a0a0a]/80 p-5 shadow-[0_30px_90px_-60px_rgba(0,0,0,1)] sm:p-6"
          >
            <span className="inline-flex w-fit items-center rounded-full border border-amber-300/40 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-amber-200 uppercase">
              Подписка
            </span>
            <h2
              className="mt-4 text-xl font-extrabold tracking-tight text-white"
              id="plan-subscription-title"
            >
              {SUBSCRIPTION_PLAN.title}
            </h2>
            <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-3xl font-extrabold text-white">
                {formatPrice(subscriptionPrice)} ₽
              </span>
              <span className="text-xs text-slate-300">за 30 дней</span>
            </p>
            <ul className="mt-4 space-y-2 border-t border-white/10 pt-4 text-xs leading-relaxed text-slate-300">
              <PlanFeature accent="text-amber-300">
                Доступ ко всем моделям и инструментам платформы
              </PlanFeature>
              <PlanFeature accent="text-amber-300">
                {SUBSCRIPTION_PLAN.standardPerMonth} генерации Standard каждый
                месяц
              </PlanFeature>
              <PlanFeature accent="text-amber-300">
                {SUBSCRIPTION_PLAN.ultraPerMonth} генерация Ultra каждый месяц
              </PlanFeature>
              <PlanFeature accent="text-amber-300">
                Лимиты обновляются 1-го числа, остаток виден в генераторе
              </PlanFeature>
            </ul>
            <div className="mt-auto pt-5">
              <PlanButton
                courseId={SUBSCRIPTION_PLAN.courseId}
                label="Оформить подписку"
                loginHref="/pricing"
                size="compact"
                variant="gold"
              />
              <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-400">
                Продление ручное: каждый платёж добавляет 30 дней, автосписаний
                нет.
              </p>
            </div>
          </section>

          {/* Пакет Standard: токены не сгорают. */}
          <section
            aria-labelledby="plan-standard-title"
            className="flex flex-col rounded-[1.75rem] border border-white/[0.07] bg-[#0a0a0a]/80 p-5 shadow-[0_30px_90px_-60px_rgba(0,0,0,1)] sm:p-6"
          >
            <span className="inline-flex w-fit items-center rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-blue-200 uppercase">
              Пакет
            </span>
            <h2
              className="mt-4 text-xl font-extrabold tracking-tight text-white"
              id="plan-standard-title"
            >
              {TOKEN_PACKS.standard.title}
            </h2>
            <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-3xl font-extrabold text-white">
                {formatPrice(TOKEN_PACKS.standard.price)} ₽
              </span>
              <span className="text-xs text-slate-300">
                за {TOKEN_PACKS.standard.quantity} генераций
              </span>
            </p>
            <ul className="mt-4 space-y-2 border-t border-white/10 pt-4 text-xs leading-relaxed text-slate-300">
              <PlanFeature>
                {TOKEN_PACKS.standard.quantity} токенов Standard — обычное
                качество
              </PlanFeature>
              <PlanFeature>
                Токены не сгорают и не зависят от подписки
              </PlanFeature>
              <PlanFeature>
                Списываются после бесплатной и месячного лимита
              </PlanFeature>
              <PlanFeature>Докупать можно без ограничений</PlanFeature>
            </ul>
            <div className="mt-auto pt-5">
              <PlanButton
                courseId={TOKEN_PACKS.standard.courseId}
                label="Купить пакет"
                loginHref="/pricing"
                size="compact"
              />
              <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-400">
                Действуют на генерацию Standard.
              </p>
            </div>
          </section>

          {/* Пакет Ultra: дороже, но самая подробная геометрия. */}
          <section
            aria-labelledby="plan-ultra-title"
            className="flex flex-col rounded-[1.75rem] border border-fuchsia-300/30 bg-gradient-to-b from-fuchsia-500/[0.08] to-[#0a0a0a]/80 p-5 shadow-[0_30px_90px_-60px_rgba(0,0,0,1)] sm:p-6"
          >
            <span className="inline-flex w-fit items-center rounded-full border border-fuchsia-300/40 bg-fuchsia-500/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-fuchsia-200 uppercase">
              Пакет
            </span>
            <h2
              className="mt-4 text-xl font-extrabold tracking-tight text-white"
              id="plan-ultra-title"
            >
              {TOKEN_PACKS.ultra.title}
            </h2>
            <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-3xl font-extrabold text-white">
                {formatPrice(TOKEN_PACKS.ultra.price)} ₽
              </span>
              <span className="text-xs text-slate-300">
                за {TOKEN_PACKS.ultra.quantity} генераций
              </span>
            </p>
            <ul className="mt-4 space-y-2 border-t border-white/10 pt-4 text-xs leading-relaxed text-slate-300">
              <PlanFeature accent="text-fuchsia-300">
                {TOKEN_PACKS.ultra.quantity} токенов Ultra — максимальная
                детализация
              </PlanFeature>
              <PlanFeature accent="text-fuchsia-300">
                Токены не сгорают и не зависят от подписки
              </PlanFeature>
              <PlanFeature accent="text-fuchsia-300">
                Списываются после месячного лимита Ultra
              </PlanFeature>
              <PlanFeature accent="text-fuchsia-300">
                Докупать можно без ограничений
              </PlanFeature>
            </ul>
            <div className="mt-auto pt-5">
              <PlanButton
                courseId={TOKEN_PACKS.ultra.courseId}
                label="Купить пакет"
                loginHref="/pricing"
                size="compact"
              />
              <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-400">
                Действуют на ультра-генерацию.
              </p>
            </div>
          </section>
        </div>

        <section
          aria-labelledby="pricing-order-title"
          className="mt-4 rounded-[1.75rem] border border-white/[0.07] bg-[#0a0a0a]/60 p-5 sm:p-7"
        >
          <h2
            className="text-lg font-extrabold tracking-tight text-white sm:text-xl"
            id="pricing-order-title"
          >
            Как списываются генерации
          </h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-3">
            <li className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <span
                aria-hidden
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs font-bold text-zinc-300"
              >
                1
              </span>
              <p className="mt-3 text-sm font-semibold text-white">
                Месячный лимит подписки
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                У подписки сначала тратится 3 Standard и 1 Ultra текущего
                месяца: остаток сгорает 1-го числа.
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
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-blue-500 px-5 text-sm font-extrabold text-white shadow-lg shadow-fuchsia-500/25 transition-transform hover:scale-[1.01] focus-visible:ring-2 focus-visible:ring-fuchsia-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303] focus-visible:outline-none"
              href="/3d-generator"
            >
              Открыть генератор
              <span aria-hidden>→</span>
            </Link>
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/30 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303] focus-visible:outline-none"
              href="/subscription"
            >
              Курсы и обучение
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
