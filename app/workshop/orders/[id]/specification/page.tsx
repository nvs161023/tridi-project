import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SpecificationPrintButton } from "@/app/workshop/orders/[id]/specification/SpecificationPrintButton";
import { Header } from "@/components/Header";
import { resolveUserId } from "@/lib/current-user";
import { hasActiveSubscription } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { getWorkshopFilaments } from "@/lib/workshop/filament-store";
import { formatGrams } from "@/lib/workshop/filaments";
import { getWorkshopOrder } from "@/lib/workshop/order-store";
import { formatOrderDate, isOrderId } from "@/lib/workshop/orders";

type SpecificationPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Спецификация к заказу — печатная форма материала.
 *
 * Страница открывается из карточки заказа в новой вкладке. Заказ читается по
 * id с проверкой владельца, катушка — из склада пользователя: в заказе хранится
 * только `filament_id`, а название и цвет могут измениться после создания.
 * Если катушки нет, материал вписывают на бумаге — форма оставляет пустую
 * строку и показывает вес из заказа.
 *
 * На экране видны шапка сайта, кнопка «Печать» и пояснение. В печати остаётся
 * только белый лист A4: `visibility` гасит всё, кроме `.specification-sheet`,
 * поэтому меню, подвал и cookie-баннер не попадают на бумагу.
 */

const CREATED_AT_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const SPECIFICATION_STYLES = `
@page {
  size: A4 portrait;
  margin: 16mm;
}
@media print {
  html,
  body {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    color: #111 !important;
  }
  body * {
    visibility: hidden !important;
  }
  .specification-sheet,
  .specification-sheet * {
    visibility: visible !important;
  }
  .specification-sheet {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    right: auto !important;
    bottom: auto !important;
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    background: #fff !important;
    color: #111 !important;
    box-shadow: none !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .specification-sheet * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .specification-screen-only {
    display: none !important;
  }
}
`;

/** Дата создания: «25 октября 2026 г.»; битая строка не ломает документ. */
function formatCreatedAt(value: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : CREATED_AT_FORMATTER.format(date);
}

/** Название катушки так, как его ищут на складе: бренд, тип и цвет. */
function formatFilamentName(filament: {
  brand: string;
  type: string;
  color: string;
}): string {
  return [filament.brand, filament.type, filament.color]
    .filter(Boolean)
    .join(" ");
}

export const metadata: Metadata = {
  title: "Спецификация к заказу — TriDi",
  description:
    "Печатная спецификация материала к заказу Мастерской: название катушки и вес модели.",
  // Личный документ: название заказа и клиент не должны попадать в поиск.
  robots: { index: false, follow: false },
};

/** Страница зависит от cookies и данных заказа — собираем её на каждый запрос. */
export const dynamic = "force-dynamic";

export default async function OrderSpecificationPage({
  params,
}: SpecificationPageProps) {
  const { id } = await params;

  if (!isOrderId(id)) {
    notFound();
  }

  const supabase = await createClient();
  const userId = await resolveUserId(supabase);

  if (!userId) {
    redirect(
      `/auth/login?next=${encodeURIComponent(`/workshop/orders/${id}/specification`)}`,
    );
  }

  // Спецификация — часть Мастерской: без пакета заказов у пользователя нет.
  const hasPro = await hasActiveSubscription(supabase, userId);

  if (!hasPro) {
    redirect("/dashboard/workshop");
  }

  const [order, stock] = await Promise.all([
    getWorkshopOrder(supabase, userId, id),
    getWorkshopFilaments(supabase, userId),
  ]);

  if (!order) {
    notFound();
  }

  const filament = order.filamentId
    ? (stock.filaments.find((item) => item.id === order.filamentId) ?? null)
    : null;
  const materialName = filament ? formatFilamentName(filament) : null;
  const weight = formatGrams(order.materialWeightG);
  const createdAt = formatCreatedAt(order.createdAt);

  return (
    <div className="min-h-screen text-slate-100">
      <style>{SPECIFICATION_STYLES}</style>
      <Header />

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="specification-screen-only mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard/workshop"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-300 transition-colors hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            <span aria-hidden>←</span>
            К заказам
          </Link>
          <SpecificationPrintButton />
        </div>

        <article
          data-specification-sheet
          className="specification-sheet mx-auto bg-white p-7 text-neutral-950 shadow-2xl shadow-black/50 sm:p-11"
        >
          <div className="border-b border-neutral-300 pb-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-[0.24em] text-neutral-500 uppercase">
                  TriDi · Мастерская
                </p>
                <h1 className="mt-3 text-2xl leading-tight font-extrabold tracking-tight break-words text-neutral-950 sm:text-3xl">
                  Спецификация к заказу «{order.title}»
                </h1>
              </div>
              <p className="shrink-0 font-mono text-[11px] text-neutral-500">
                № {order.id.slice(0, 8)}
              </p>
            </div>

            <dl className="mt-6 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">
                  Дата создания заказа
                </dt>
                <dd className="mt-1 font-semibold text-neutral-900">
                  {createdAt}
                </dd>
              </div>

              {order.clientName ? (
                <div>
                  <dt className="text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">
                    Клиент
                  </dt>
                  <dd className="mt-1 font-semibold break-words text-neutral-900">
                    {order.clientName}
                  </dd>
                </div>
              ) : null}

              {order.deadline ? (
                <div>
                  <dt className="text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">
                    Срок сдачи
                  </dt>
                  <dd className="mt-1 font-semibold text-neutral-900">
                    {formatOrderDate(order.deadline)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>

          <section
            aria-labelledby="specification-material-title"
            className="mt-8"
          >
            <h2
              id="specification-material-title"
              className="text-base font-extrabold tracking-tight text-neutral-950"
            >
              Материал
            </h2>

            <table className="mt-3 w-full border-collapse text-sm">
              <caption className="sr-only">
                Материал заказа: название катушки со склада и вес модели
              </caption>
              <thead>
                <tr className="border-y border-neutral-300 bg-neutral-100 text-left text-[10px] font-semibold tracking-wide text-neutral-600 uppercase">
                  <th scope="col" className="px-3 py-3">
                    Материал
                  </th>
                  <th scope="col" className="w-32 px-3 py-3 text-right">
                    Вес
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-neutral-300 align-middle">
                  <td className="px-3 py-4 font-semibold text-neutral-950">
                    {materialName ? (
                      materialName
                    ) : (
                      <span className="flex items-baseline gap-3 font-normal">
                        <span aria-hidden>[ ]</span>
                        <span className="min-h-5 flex-1 border-b border-neutral-400">
                          <span className="sr-only">
                            Впишите материал вручную
                          </span>
                          &nbsp;
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-4 text-right font-bold whitespace-nowrap text-neutral-950 tabular-nums">
                    {weight}
                  </td>
                </tr>
              </tbody>
            </table>

            {materialName ? null : (
              <p className="mt-3 text-xs leading-relaxed text-neutral-600">
                Катушка не выбрана — впишите материал вручную, например: [ ] PLA
                Чёрный — {weight}.
              </p>
            )}
          </section>

          <footer className="mt-16 flex flex-wrap items-end justify-between gap-6 border-t border-neutral-300 pt-5 text-xs text-neutral-600">
            <p>Мастер: ______________________________</p>
            <p>Дата: «____» ______________ 20____ г.</p>
          </footer>
        </article>

        <p className="specification-screen-only mx-auto mt-5 max-w-2xl text-center text-xs leading-relaxed text-slate-400">
          В диалоге печати можно выбрать принтер или «Сохранить как PDF». На
          листе останется только спецификация.
        </p>
      </main>
    </div>
  );
}

