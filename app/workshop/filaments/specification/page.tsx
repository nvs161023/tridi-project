import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FilamentSpecificationPrintButton } from "@/app/workshop/filaments/specification/FilamentSpecificationPrintButton";
import { Header } from "@/components/Header";
import { resolveUserId } from "@/lib/current-user";
import { LEGAL_OPERATOR } from "@/lib/legal";
import { hasActiveSubscription } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, roundMoney } from "@/lib/workshop/calculator";
import { getWorkshopFilamentsByIds } from "@/lib/workshop/filament-store";
import {
  readFilamentOrderItems,
  type FilamentOrderItem,
  type WorkshopFilament,
} from "@/lib/workshop/filaments";
import {
  workshopCompanyTypeLabel,
  type WorkshopRequisites,
} from "@/lib/workshop/requisites";
import { getWorkshopSettings } from "@/lib/workshop/store";

type FilamentSpecificationPageProps = {
  /** `items` — JSON `[{ filamentId, quantityGrams }]` из окна «Сформировать». */
  searchParams: Promise<{ items?: string | string[] }>;
};

const SPECIFICATION_PATH = "/workshop/filaments/specification";

/**
 * Спецификация на закупку филамента — печатная форма склада.
 *
 * Страница открывается из окна «Спецификация на закупку» в новой вкладке.
 * Список позиций приходит в `?items=` закодированным JSON. Его нельзя
 * использовать как запрос напрямую, поэтому `readFilamentOrderItems` проверяет
 * каждый id и количество, а катушки затем читаются из базы только по `user_id`
 * текущего мастера. Цена за килограмм берётся из склада: примерная стоимость
 * позиции — `quantityGrams / 1000 * pricePerKg`.
 *
 * Заказчик — сам мастер: блок берётся из `workshop_settings`. Пока название
 * компании не заполнено, документ печатает данные `LEGAL_OPERATOR`, а на экране
 * появляется красная подсказка. В печати остаётся только белый лист A4:
 * `visibility` гасит всё, кроме `.filament-specification-sheet`.
 */
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
  .filament-specification-sheet,
  .filament-specification-sheet * {
    visibility: visible !important;
  }
  .filament-specification-sheet {
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
  .filament-specification-sheet * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .filament-specification-sheet tr,
  .filament-specification-sheet footer {
    break-inside: avoid;
  }
  .filament-specification-screen-only {
    display: none !important;
  }
}
`;

const GRAMS_FORMATTER = new Intl.NumberFormat("ru-RU");

/** Название катушки для строки спецификации: «eSun PLA Чёрный». */
function formatFilamentName(filament: WorkshopFilament): string {
  return (
    [filament.brand, filament.type, filament.color]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" ") || "Без названия"
  );
}

/** Заказчик в документе: реквизиты Мастерской или данные сервиса. */
type SpecificationCustomer = {
  name: string;
  inn: string | null;
  ogrn: string | null;
  address: string | null;
  phone: string | null;
  /** Реквизиты Мастерской ещё не заполнены: показываем данные сервиса. */
  isFallback: boolean;
};

/**
 * Реквизиты Мастерской → блок «Заказчик».
 *
 * Название компании — обязательное поле вкладки «Реквизиты», поэтому пустое
 * название означает «реквизиты не заполнены». Тогда документ печатает данные
 * `LEGAL_OPERATOR`, а на экране появляется подсказка. Необязательные поля
 * выводятся только заполненными.
 */
function getSpecificationCustomer(
  requisites: WorkshopRequisites,
): SpecificationCustomer {
  if (!requisites.companyName) {
    return {
      name: LEGAL_OPERATOR.fullName,
      inn: LEGAL_OPERATOR.inn,
      ogrn: null,
      address: null,
      phone: LEGAL_OPERATOR.phone,
      isFallback: true,
    };
  }

  return {
    name: `${workshopCompanyTypeLabel(requisites.companyType)} ${requisites.companyName}`,
    inn: requisites.inn,
    ogrn: requisites.ogrn,
    address: requisites.legalAddress,
    phone: requisites.contactPhone,
    isFallback: false,
  };
}

/** Строка таблицы: данные катушки, количество и примерная стоимость. */
type SpecificationLine = {
  filament: WorkshopFilament;
  quantityGrams: number;
  cost: number;
};

/** JSON из адреса → проверенный список; битая строка не роняет страницу. */
function parseItemsParam(rawItems: string | string[] | undefined): {
  items: FilamentOrderItem[];
  wasProvided: boolean;
} {
  if (typeof rawItems !== "string" || !rawItems) {
    return { items: [], wasProvided: false };
  }

  try {
    return {
      items: readFilamentOrderItems(JSON.parse(rawItems)),
      wasProvided: true,
    };
  } catch {
    return { items: [], wasProvided: true };
  }
}

export const metadata: Metadata = {
  title: "Спецификация на закупку филамента — TriDi",
  description:
    "Печатная спецификация склада Мастерской: заказчик, катушки, количество и примерная стоимость закупки.",
  // Личный документ: состав закупки не должен попадать в поиск.
  robots: { index: false, follow: false },
};

/** Страница зависит от cookies и данных склада — собираем её на каждый запрос. */
export const dynamic = "force-dynamic";

export default async function FilamentSpecificationPage({
  searchParams,
}: FilamentSpecificationPageProps) {
  const { items: rawItems } = await searchParams;
  const { items, wasProvided } = parseItemsParam(rawItems);

  const supabase = await createClient();
  const userId = await resolveUserId(supabase);

  if (!userId) {
    redirect(`/auth/login?next=${encodeURIComponent(SPECIFICATION_PATH)}`);
  }

  // Спецификация — часть Мастерской: без пакета склада у пользователя нет.
  const hasPro = await hasActiveSubscription(supabase, userId);

  if (!hasPro) {
    redirect("/dashboard/workshop");
  }

  const [snapshot, stock] = await Promise.all([
    getWorkshopSettings(supabase, userId),
    items.length > 0
      ? getWorkshopFilamentsByIds(
          supabase,
          userId,
          items.map((item) => item.filamentId),
        )
      : Promise.resolve({ filaments: [], isMissingTable: false }),
  ]);

  const customer = getSpecificationCustomer(snapshot.requisites);
  const filamentsById = new Map(
    stock.filaments.map((filament) => [filament.id, filament]),
  );
  const lines: SpecificationLine[] = items.flatMap((item) => {
    const filament = filamentsById.get(item.filamentId);

    if (!filament) {
      return [];
    }

    return [
      {
        filament,
        quantityGrams: item.quantityGrams,
        cost: roundMoney((item.quantityGrams / 1000) * filament.pricePerKg),
      },
    ];
  });
  const missingCount = items.length - lines.length;
  const total = roundMoney(lines.reduce((sum, line) => sum + line.cost, 0));
  const hasLines = lines.length > 0;

  return (
    <div className="min-h-screen text-slate-100">
      <style>{SPECIFICATION_STYLES}</style>
      <Header />

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="filament-specification-screen-only mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard/workshop"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-300 transition-colors hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            <span aria-hidden>←</span>
            На склад
          </Link>
          {hasLines ? <FilamentSpecificationPrintButton /> : null}
        </div>

        <article
          data-filament-specification-sheet
          className="filament-specification-sheet mx-auto bg-white p-6 text-neutral-950 shadow-2xl shadow-black/50 sm:p-10"
        >
          <header className="border-b-2 border-neutral-900 pb-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-[0.24em] text-neutral-500 uppercase">
                  TriDi · Мастерская
                </p>
                <h1 className="mt-3 text-2xl leading-tight font-extrabold tracking-tight break-words text-neutral-950 sm:text-3xl">
                  Спецификация на закупку филамента
                </h1>
              </div>
              <p className="shrink-0 font-mono text-[11px] text-neutral-500">
                Пополнение склада
              </p>
            </div>
          </header>

          <section
            aria-labelledby="filament-specification-customer-title"
            data-filament-specification-requisites
            className="mt-6 rounded-lg border border-neutral-300 bg-neutral-50 p-4"
          >
            <h2
              id="filament-specification-customer-title"
              className="text-[10px] font-semibold tracking-[0.18em] text-neutral-500 uppercase"
            >
              Заказчик
            </h2>
            <p
              data-filament-specification-customer
              className="mt-2 text-sm leading-snug font-bold break-words text-neutral-950 first-letter:uppercase"
            >
              {customer.name}
            </p>

            <dl className="mt-3 grid gap-x-8 gap-y-2 text-xs leading-relaxed text-neutral-700 sm:grid-cols-2">
              {customer.inn ? (
                <div className="flex gap-2">
                  <dt className="shrink-0 font-semibold text-neutral-500">
                    ИНН
                  </dt>
                  <dd
                    data-filament-specification-customer-inn
                    className="font-mono break-all"
                  >
                    {customer.inn}
                  </dd>
                </div>
              ) : null}

              {customer.ogrn ? (
                <div className="flex gap-2">
                  <dt className="shrink-0 font-semibold text-neutral-500">
                    ОГРН
                  </dt>
                  <dd
                    data-filament-specification-customer-ogrn
                    className="font-mono break-all"
                  >
                    {customer.ogrn}
                  </dd>
                </div>
              ) : null}

              {customer.address ? (
                <div className="flex gap-2 sm:col-span-2">
                  <dt className="shrink-0 font-semibold text-neutral-500">
                    Адрес
                  </dt>
                  <dd
                    data-filament-specification-customer-address
                    className="break-words"
                  >
                    {customer.address}
                  </dd>
                </div>
              ) : null}

              {customer.phone ? (
                <div className="flex gap-2">
                  <dt className="shrink-0 font-semibold text-neutral-500">
                    Телефон
                  </dt>
                  <dd
                    data-filament-specification-customer-phone
                    className="break-words"
                  >
                    {customer.phone}
                  </dd>
                </div>
              ) : null}
            </dl>

            {customer.isFallback ? (
              <p
                role="note"
                data-filament-specification-warning
                className="filament-specification-screen-only mt-3 rounded-md border border-red-300 bg-red-50 px-2.5 py-2 text-[10px] leading-relaxed font-semibold text-red-700"
              >
                Внимание: заполните реквизиты в разделе «Реквизиты» Мастерской.
              </p>
            ) : null}
          </section>

          {stock.isMissingTable || missingCount > 0 ? (
            <div className="filament-specification-screen-only mt-3 space-y-2">
              {stock.isMissingTable ? (
                <p className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-[10px] leading-relaxed font-semibold text-amber-800">
                  Склад не прочитан: возможно, не применена миграция
                  workshop_filaments.sql.
                </p>
              ) : null}
              {missingCount > 0 ? (
                <p
                  data-filament-specification-missing
                  className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-[10px] leading-relaxed font-semibold text-amber-800"
                >
                  Не найдено позиций: {missingCount}. Возможно, катушки удалены
                  со склада.
                </p>
              ) : null}
            </div>
          ) : null}

          {hasLines ? (
            <>
              <section
                aria-labelledby="filament-specification-items-title"
                className="mt-8"
              >
                <h2
                  id="filament-specification-items-title"
                  className="text-base font-extrabold tracking-tight text-neutral-950"
                >
                  Позиции закупки
                </h2>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <caption className="sr-only">
                      Катушки для закупки: материал, количество в граммах и
                      примерная стоимость
                    </caption>
                    <thead>
                      <tr className="border-y border-neutral-300 bg-neutral-100 text-left text-[10px] font-semibold tracking-wide text-neutral-600 uppercase">
                        <th scope="col" className="w-10 px-2 py-3 text-center">
                          №
                        </th>
                        <th scope="col" className="px-2 py-3 sm:px-3">
                          Материал (бренд, тип, цвет)
                        </th>
                        <th
                          scope="col"
                          className="w-24 px-2 py-3 text-right sm:px-3"
                        >
                          Количество (г)
                        </th>
                        <th
                          scope="col"
                          className="w-32 px-2 py-3 text-right sm:px-3"
                        >
                          Примерная стоимость (₽)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, index) => (
                        <tr
                          key={line.filament.id}
                          data-filament-specification-row
                          className="border-b border-neutral-300 align-top"
                        >
                          <td className="px-2 py-4 text-center font-semibold text-neutral-500 tabular-nums">
                            {index + 1}
                          </td>
                          <td
                            data-filament-specification-material
                            className="px-2 py-4 font-semibold break-words text-neutral-950 [overflow-wrap:anywhere] sm:px-3"
                          >
                            {formatFilamentName(line.filament)}
                            <span className="mt-1 block text-[10px] font-normal text-neutral-500">
                              Цена: {formatMoney(line.filament.pricePerKg)}/кг
                            </span>
                          </td>
                          <td
                            data-filament-specification-quantity
                            className="px-2 py-4 text-right font-semibold whitespace-nowrap text-neutral-900 tabular-nums sm:px-3"
                          >
                            {GRAMS_FORMATTER.format(line.quantityGrams)}
                          </td>
                          <td
                            data-filament-specification-cost
                            className="px-2 py-4 text-right font-bold whitespace-nowrap text-neutral-950 tabular-nums sm:px-3"
                          >
                            {formatMoney(line.cost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-t border-neutral-300 pt-4">
                  <p className="text-[11px] text-neutral-500">
                    Всего позиций: {lines.length}
                  </p>
                  <p
                    data-filament-specification-total
                    className="text-sm font-extrabold text-neutral-950 sm:text-base"
                  >
                    Итого:{" "}
                    <span className="whitespace-nowrap tabular-nums">
                      {formatMoney(total)}
                    </span>
                  </p>
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-neutral-500">
                  Стоимость рассчитана по ценам склада и может отличаться от
                  предложения поставщика.
                </p>
              </section>

              <footer
                data-filament-specification-signatures
                className="mt-12 border-t border-neutral-300 pt-5"
              >
                <div className="grid gap-8 sm:grid-cols-2">
                  <p className="text-sm text-neutral-700">
                    Заказчик ______________________________
                  </p>
                  <p className="text-sm text-neutral-700">
                    Дата «____» ______________ 20____ г.
                  </p>
                </div>
              </footer>
            </>
          ) : (
            <section
              data-filament-specification-empty
              className="mt-8 rounded-lg border border-dashed border-neutral-300 px-5 py-10 text-center"
            >
              <h2 className="text-base font-extrabold text-neutral-950">
                Нет позиций для закупки
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-neutral-600">
                {wasProvided
                  ? "Не удалось прочитать список катушек. Вернитесь на склад и сформируйте спецификацию заново."
                  : "Выберите катушки в окне «Спецификация на закупку» и нажмите «Сформировать»."}
              </p>
              <Link
                href="/dashboard/workshop"
                className="filament-specification-screen-only mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-neutral-950 px-5 text-sm font-bold text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2"
              >
                Вернуться на склад
              </Link>
            </section>
          )}
        </article>

        {hasLines ? (
          <p className="filament-specification-screen-only mx-auto mt-5 max-w-2xl text-center text-xs leading-relaxed text-slate-400">
            В диалоге печати можно выбрать принтер или «Сохранить как PDF». На
            листе останется только спецификация.
          </p>
        ) : null}
      </main>
    </div>
  );
}
