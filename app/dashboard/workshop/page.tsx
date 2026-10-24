import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Header } from "@/components/Header";
import { WorkshopTabs } from "@/components/workshop/WorkshopTabs";
import { resolveUserId } from "@/lib/current-user";
import { hasActiveSubscription } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { getWorkshopFilaments } from "@/lib/workshop/filament-store";
import { getWorkshopOrders } from "@/lib/workshop/order-store";
import { getWorkshopPrinters } from "@/lib/workshop/printer-store";
import { getWorkshopSettings } from "@/lib/workshop/store";

/**
 * Мастерская — Pro-инструмент: рабочее место для 3D-печати.
 *
 * Доступ проверяется здесь, а не в middleware: middleware отвечает только за
 * сессию, а «есть ли пакет» — это запрос к purchases и subscriptions. Такой же
 * порядок у библиотеки профилей, и он позволяет показать гостю и ученику без
 * пакета понятное объяснение, а не глухой редирект.
 *
 * Настройки, склад, принтеры и заказы читаются только при открытом доступе:
 * без пакета сохранять их всё равно нельзя, значит и лишние запросы к базе не
 * нужны. Запросы идут параллельно — это четыре независимые таблицы.
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
  const [snapshot, stock, fleet, orderBook] = hasPro
    ? await Promise.all([
        getWorkshopSettings(supabase, userId),
        getWorkshopFilaments(supabase, userId),
        getWorkshopPrinters(supabase, userId),
        getWorkshopOrders(supabase, userId),
      ])
    : [null, null, null, null];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <Link
          href="/dashboard"
          className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-slate-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <span aria-hidden>←</span>
          Личный кабинет
        </Link>

        <div className="mt-6 flex flex-wrap items-center gap-2.5 text-xs font-semibold sm:text-sm">
          <span className="rounded-full border border-blue-400/40 bg-blue-500/10 px-3.5 py-1.5 text-blue-200">
            Входит в пакет «Всё включено»
          </span>
          {hasPro ? (
            <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3.5 py-1.5 text-emerald-200">
              Доступ открыт
            </span>
          ) : (
            <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300">
              Доступ по пакету
            </span>
          )}
        </div>

        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          Мастерская
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
          Рабочее место для 3D-печати: себестоимость заказа, рекомендованная цена,
          прибыль, склад пластика, принтеры с обслуживанием и заказы клиентов — без
          таблиц в блокноте.
        </p>

        {snapshot && stock && fleet && orderBook ? (
          <WorkshopTabs
            settings={snapshot.settings}
            filaments={stock.filaments}
            printers={fleet.printers}
            orders={orderBook.orders}
            isMissingTable={snapshot.isMissingTable}
            isFilamentsMissingTable={stock.isMissingTable}
            isPrintersMissingTable={fleet.isMissingTable}
            isOrdersMissingTable={orderBook.isMissingTable}
          />
        ) : (
          <LockedWorkshop />
        )}
      </main>
    </div>
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
