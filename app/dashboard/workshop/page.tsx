import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Header } from "@/components/Header";
import { ButtonLink } from "@/components/ui";
import { WorkshopCreateOrderButton } from "@/components/workshop/WorkshopCreateOrderButton";
import { WorkshopStats } from "@/components/workshop/WorkshopStats";
import { WorkshopTabs } from "@/components/workshop/WorkshopTabs";
import { resolveUserId } from "@/lib/current-user";
import { hasActiveSubscription } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { getWorkshopClients } from "@/lib/workshop/clients";
import { isLowStockFilament } from "@/lib/workshop/filaments";
import { getWorkshopFilaments } from "@/lib/workshop/filament-store";
import { getWorkshopOrders } from "@/lib/workshop/order-store";
import { countMaintenanceDue } from "@/lib/workshop/printers";
import { getWorkshopPrinters } from "@/lib/workshop/printer-store";
import { getWorkshopProducts } from "@/lib/workshop/products";
import { getWorkshopSettings } from "@/lib/workshop/store";

/**
 * Мастерская — Pro-инструмент: рабочее место для 3D-печати.
 *
 * Доступ проверяется здесь, а не в middleware: middleware отвечает только за
 * сессию, а «есть ли пакет» — это запрос к purchases и subscriptions. Такой же
 * порядок у библиотеки профилей, и он позволяет показать гостю и ученику без
 * пакета понятное объяснение, а не глухой редирект.
 *
 * Настройки, склад, принтеры, заказы, товары и клиенты читаются только при
 * открытом доступе: без пакета сохранять их всё равно нельзя, значит и лишние
 * запросы к базе не нужны. Запросы идут параллельно — это шесть независимых
 * таблиц.
 */
export const metadata: Metadata = {
  title: "Мастерская — TriDi",
  description:
    "Калькулятор себестоимости 3D-печати, склад пластика, принтеры с обслуживанием и заказы клиентов: материал, электричество, амортизация и работа, рекомендованная цена и прибыль. Входит в пакет «Всё включено».",
  robots: { index: false, follow: false },
};

/** Страница зависит от cookies пользователя — собираем её на каждый запрос. */
export const dynamic = "force-dynamic";

export default async function WorkshopPage() {
  const supabase = await createClient();
  const userId = await resolveUserId(supabase);

  if (!userId) {
    redirect("/auth/login");
  }

  const hasPro = await hasActiveSubscription(supabase, userId);
  const [snapshot, stock, fleet, orderBook, productList, clientList] = hasPro
    ? await Promise.all([
        getWorkshopSettings(supabase, userId),
        getWorkshopFilaments(supabase, userId),
        getWorkshopPrinters(supabase, userId),
        getWorkshopOrders(supabase, userId),
        getWorkshopProducts(),
        getWorkshopClients(),
      ])
    : [null, null, null, null, null, null];

  const orders = orderBook?.orders ?? [];
  const now = new Date();
  const activeOrders = orders.filter(
    (order) => order.status !== "delivered",
  ).length;
  const unmappedOrders = orders.filter(
    (order) => order.status === "unmapped",
  ).length;
  const printingOrders = orders.filter(
    (order) => order.status === "printing",
  ).length;
  const deliveredThisMonth = orders.filter(
    (order) =>
      order.status === "delivered" && isCurrentMonth(order.createdAt, now),
  );
  const monthRevenue = deliveredThisMonth.reduce(
    (sum, order) => sum + order.totalCost,
    0,
  );
  const spools = stock?.filaments.length ?? 0;
  const lowStock = stock?.filaments.filter(isLowStockFilament).length ?? 0;
  const printerCount = fleet?.printers.length ?? 0;
  const maintenanceDue =
    fleet?.printers.filter((printer) => countMaintenanceDue(printer) > 0)
      .length ?? 0;

  return (
    <div className="min-h-screen text-zinc-100">
      <Header />

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/dashboard"
          className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-zinc-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303]"
        >
          <span aria-hidden>←</span>
          Личный кабинет
        </Link>

        <section
          aria-labelledby="workshop-title"
          className="relative mt-6 overflow-hidden rounded-[2rem] border border-white/[0.07] bg-[#0a0a0a]/75 px-5 py-7 shadow-[0_40px_120px_-60px_rgba(0,0,0,1)] backdrop-blur-xl sm:px-8 sm:py-9 lg:px-10 lg:py-10"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-28 -right-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 left-1/3 h-56 w-56 rounded-full bg-violet-500/[0.07] blur-3xl"
          />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-zinc-300">
                  CRM · 3D-печать
                </span>
                <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-2.5 py-1 text-blue-200">
                  Входит в пакет «Всё включено»
                </span>
                {hasPro ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-200">
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
                    />
                    Доступ открыт
                  </span>
                ) : (
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-zinc-400">
                    Доступ по пакету
                  </span>
                )}
              </div>

              <h1
                id="workshop-title"
                className="mt-5 text-4xl font-extrabold tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl"
              >
                Мастерская
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
                Управление заказами, складом и принтерами в одном месте.
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-stretch gap-2.5 sm:flex-row sm:items-center lg:flex-col lg:items-end">
              {snapshot && stock && fleet && orderBook ? (
                <WorkshopCreateOrderButton
                  printers={fleet.printers}
                  filaments={stock.filaments}
                  products={productList ?? []}
                  clients={clientList ?? []}
                />
              ) : (
                <ButtonLink
                  href="/courses/pro"
                  size="lg"
                  className="min-h-12 rounded-2xl px-5 text-sm sm:min-h-14 sm:px-7 sm:text-base"
                >
                  Открыть пакет
                  <span aria-hidden>→</span>
                </ButtonLink>
              )}
              <p className="max-w-56 text-center text-[11px] leading-relaxed text-zinc-500 sm:text-left lg:text-right">
                Заказ спишет пластик и часы принтера автоматически.
              </p>
            </div>
          </div>
        </section>

        {snapshot && stock && fleet && orderBook ? (
          <>
            <WorkshopStats
              activeOrders={activeOrders}
              printingOrders={printingOrders}
              monthRevenue={monthRevenue}
              deliveredThisMonth={deliveredThisMonth.length}
              spools={spools}
              lowStock={lowStock}
              printerCount={printerCount}
              maintenanceDue={maintenanceDue}
            />

            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <Link
                href="/dashboard/workshop/products"
                className="inline-flex min-h-10 items-center rounded-xl border border-white/10 bg-white/[0.03] px-4 font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303]"
              >
                Каталог и G-code
              </Link>
              <Link
                href="/dashboard/workshop/marketplace"
                className="inline-flex min-h-10 items-center rounded-xl border border-white/10 bg-white/[0.03] px-4 font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303]"
              >
                Маркетплейсы
              </Link>
            </div>

            {unmappedOrders > 0 ? (
              <Link
                href="/dashboard/workshop/marketplace"
                className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/25 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-100 transition-colors hover:border-amber-400/40 hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303]"
              >
                <span>
                  <strong className="font-bold">
                    {unmappedOrders} заказ(ов) без маппинга.
                  </strong>{" "}
                  Свяжите SKU с товаром, чтобы вернуть их в работу.
                </span>
                <span aria-hidden className="font-semibold">
                  Открыть →
                </span>
              </Link>
            ) : null}

            <WorkshopTabs
              settings={snapshot.settings}
              filaments={stock.filaments}
              printers={fleet.printers}
              activePrinterJobs={fleet.activeJobs}
              orders={orderBook.orders}
              products={productList ?? []}
              clients={clientList ?? []}
              isMissingTable={snapshot.isMissingTable}
              isFilamentsMissingTable={stock.isMissingTable}
              isPrintersMissingTable={fleet.isMissingTable}
              isOrdersMissingTable={orderBook.isMissingTable}
              requisites={snapshot.requisites}
              isRequisitesMissing={snapshot.isRequisitesMissing}
              integrations={snapshot.integrations}
              isIntegrationsMissing={snapshot.isIntegrationsMissing}
              agentToken={snapshot.agentToken}
              isAgentTokenMissing={snapshot.isAgentTokenMissing}
            />
          </>
        ) : (
          <LockedWorkshop />
        )}
      </main>
    </div>
  );
}
/**
 * Заказ создан в текущем месяце.
 *
 * `created_at` приходит из PostgREST строкой ISO. Битое значение не должно
 * попадать в выручку: такой заказ просто не считается.
 */
function isCurrentMonth(value: string | null, now: Date): boolean {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

/**
 * Замок для тех, у кого нет пакета.
 *
 * Показываем, что именно откроется: калькулятор, склад, принтеры и заказы.
 * Это честнее пустого экрана — человек понимает, за что платит, и не ищет
 * кнопку, которой нет.
 */
function LockedWorkshop() {
  return (
    <section
      aria-labelledby="workshop-locked-title"
      className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md sm:p-8"
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-xl"
        >
          🔒
        </span>
        <div>
          <h2
            id="workshop-locked-title"
            className="text-xl font-extrabold tracking-tight text-white sm:text-2xl"
          >
            Мастерская открывается пакетом «Всё включено»
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
            Калькулятор считает себестоимость заказа по вашему тарифу на
            электричество, мощности принтера и стоимости часа работы, а затем
            показывает рекомендованную цену и прибыль. Склад помнит остатки
            катушек и подсказывает, что пора докупить. Принтеры ведут наработку
            сопла и смазки, а заказы списывают пластик и часы автоматически.
            Всё сохраняется в аккаунте — вводить заново не придётся.
          </p>
        </div>
      </div>

      <ul className="mt-6 space-y-2">
        {[
          "Себестоимость заказа: материал, электричество, амортизация и работа",
          "Рекомендованная цена с наценкой и прибыль по каждой модели",
          "Склад пластика: остатки, порог и кнопка «Купить»",
          "Принтеры с обслуживанием и заказы клиентов со статусами",
        ].map((point) => (
          <li
            key={point}
            className="flex items-start gap-2 text-sm text-slate-300"
          >
            <span aria-hidden className="mt-0.5 text-blue-300">
              ✓
            </span>
            {point}
          </li>
        ))}
      </ul>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Link
          href="/courses/pro"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-blue-600 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          Открыть пакет «Всё включено»
          <span aria-hidden>→</span>
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/20 px-6 text-sm font-semibold text-slate-200 transition-colors hover:border-blue-400/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          Вернуться в кабинет
        </Link>
      </div>
    </section>
  );
}
