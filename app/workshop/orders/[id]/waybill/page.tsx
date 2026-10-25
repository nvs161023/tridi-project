import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { WaybillPrintButton } from "@/app/workshop/orders/[id]/waybill/WaybillPrintButton";
import { Header } from "@/components/Header";
import { resolveUserId } from "@/lib/current-user";
import { LEGAL_OPERATOR } from "@/lib/legal";
import { hasActiveSubscription } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { getWorkshopClientById } from "@/lib/workshop/clients";
import { getWorkshopOrder } from "@/lib/workshop/order-store";
import { formatOrderCost, isOrderId } from "@/lib/workshop/orders";
import { workshopCompanyTypeLabel, type WorkshopRequisites } from "@/lib/workshop/requisites";
import { getWorkshopSettings } from "@/lib/workshop/store";

type WaybillPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Накладная на отгрузку — печатная форма заказа.
 *
 * Открывается из карточки заказа в новой вкладке. Заказ читается по id с
 * проверкой владельца, отправитель — из реквизитов Мастерской
 * (`workshop_settings`), а если их ещё не заполнили — из `LEGAL_OPERATOR`.
 * Получатель берётся из `workshop_clients`, если заказ хранит `client_id`. У
 * старых заказов и заказов с ручным клиентом телефона и адреса нет, поэтому в
 * документе остаются поля `[ ]` для заполнения при отгрузке.
 *
 * В печати остаётся только белый лист A4: `visibility` гасит всё, кроме
 * `.waybill-sheet`, поэтому меню, подвал и cookie-баннер не попадают на бумагу.
 */
const WAYBILL_STYLES = `
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
  .waybill-sheet,
  .waybill-sheet * {
    visibility: visible !important;
  }
  .waybill-sheet {
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
  .waybill-sheet * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .waybill-sheet tr,
  .waybill-sheet footer {
    break-inside: avoid;
  }
  .waybill-screen-only {
    display: none !important;
  }
}
`;

const CREATED_AT_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

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

/** Номер документа: первые восемь символов UUID, как в спецификации. */
function formatWaybillNumber(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}

/** Отправитель в накладной: реквизиты Мастерской или данные сервиса. */
type WaybillSender = {
  name: string;
  /** Короткое имя для строки подписи. */
  signatureName: string;
  inn: string | null;
  ogrn: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  /** Реквизиты Мастерской ещё не заполнены: показываем данные сервиса. */
  isFallback: boolean;
};

/**
 * Реквизиты Мастерской → блок «Отправитель».
 *
 * Название компании — обязательное поле вкладки «Реквизиты», поэтому пустое
 * название означает «реквизиты не заполнены»: до первого сохранения в базе
 * лежит пустая строка. В этом случае документ печатает прежние данные
 * `LEGAL_OPERATOR`, а на экране появляется подсказка. Остальные поля
 * необязательны — выводим только заполненные.
 */
function getWaybillSender(requisites: WorkshopRequisites): WaybillSender {
  if (!requisites.companyName) {
    return {
      name: LEGAL_OPERATOR.fullName,
      signatureName: LEGAL_OPERATOR.shortName,
      inn: LEGAL_OPERATOR.inn,
      ogrn: null,
      address: null,
      phone: LEGAL_OPERATOR.phone,
      email: LEGAL_OPERATOR.email,
      isFallback: true,
    };
  }

  return {
    name: `${workshopCompanyTypeLabel(requisites.companyType)} ${requisites.companyName}`,
    signatureName: requisites.companyName,
    inn: requisites.inn,
    ogrn: requisites.ogrn,
    address: requisites.legalAddress,
    phone: requisites.contactPhone,
    email: requisites.contactEmail,
    isFallback: false,
  };
}

export const metadata: Metadata = {
  title: "Накладная на отгрузку — TriDi",
  description:
    "Печатная накладная к заказу Мастерской: отправитель, получатель, состав отгрузки и итоговая сумма.",
  // Личный документ: название заказа и клиент не должны попадать в поиск.
  robots: { index: false, follow: false },
};

/** Страница зависит от cookies и данных заказа — собираем её на каждый запрос. */
export const dynamic = "force-dynamic";

export default async function OrderWaybillPage({
  params,
}: WaybillPageProps) {
  const { id } = await params;

  if (!isOrderId(id)) {
    notFound();
  }

  const supabase = await createClient();
  const userId = await resolveUserId(supabase);

  if (!userId) {
    redirect(
      `/auth/login?next=${encodeURIComponent(`/workshop/orders/${id}/waybill`)}`,
    );
  }

  // Накладная — часть Мастерской: без пакета заказов у пользователя нет.
  const hasPro = await hasActiveSubscription(supabase, userId);

  if (!hasPro) {
    redirect("/dashboard/workshop");
  }

  const [order, snapshot] = await Promise.all([
    getWorkshopOrder(supabase, userId, id),
    getWorkshopSettings(supabase, userId),
  ]);

  if (!order) {
    notFound();
  }

  const sender = getWaybillSender(snapshot.requisites);

  // Ссылка на клиента необязательна. Запрос дублирует `user_id`: даже если в
  // базе окажется чужая ссылка, контакты другого мастера не попадут в документ.
  const client = order.clientId
    ? await getWorkshopClientById(supabase, userId, order.clientId)
    : null;
  const recipientName = client?.name ?? order.clientName;
  const clientPhone = client?.phone ?? null;
  const clientAddress = client?.address ?? null;
  const clientEmail = client?.email ?? null;

  const number = formatWaybillNumber(order.id);
  const createdAt = formatCreatedAt(order.createdAt);
  const total = formatOrderCost(order.totalCost);
  const clientName = recipientName ?? "Клиент не указан";

  return (
    <div className="min-h-screen text-slate-100">
      <style>{WAYBILL_STYLES}</style>
      <Header />

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="waybill-screen-only mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard/workshop"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-300 transition-colors hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            <span aria-hidden>←</span>
            К заказам
          </Link>
          <WaybillPrintButton />
        </div>

        <article
          data-waybill-sheet
          className="waybill-sheet mx-auto bg-white p-6 text-neutral-950 shadow-2xl shadow-black/50 sm:p-10"
        >
          <header className="border-b-2 border-neutral-900 pb-5">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-[0.24em] text-neutral-500 uppercase">
                  TriDi · Мастерская
                </p>
                <h1
                  data-waybill-title
                  className="mt-3 text-2xl leading-tight font-extrabold tracking-tight break-words text-neutral-950 sm:text-3xl"
                >
                  Накладная на отгрузку № {number}
                </h1>
                <p className="mt-2 text-sm leading-relaxed break-words text-neutral-600">
                  Основание: заказ «{order.title}»
                </p>
              </div>

              <div className="shrink-0 text-left sm:text-right">
                <p className="text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">
                  Дата создания заказа
                </p>
                <p className="mt-1 text-sm font-bold text-neutral-950">
                  <time dateTime={order.createdAt ?? undefined}>
                    {createdAt}
                  </time>
                </p>
                <p className="mt-3 text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">
                  Номер заказа
                </p>
                <p className="mt-1 font-mono text-[10px] break-all text-neutral-600">
                  {order.id}
                </p>
              </div>
            </div>
          </header>

          <section
            aria-label="Стороны отгрузки"
            className="mt-6 grid gap-4 sm:grid-cols-2"
          >
            <div
              data-waybill-sender
              className="rounded-lg border border-neutral-300 p-4"
            >
              <h2 className="text-[10px] font-semibold tracking-[0.18em] text-neutral-500 uppercase">
                Отправитель
              </h2>
              <p
                data-waybill-sender-name
                className="mt-2 text-sm leading-snug font-bold break-words text-neutral-950 first-letter:uppercase"
              >
                {sender.name}
              </p>
              <dl className="mt-3 space-y-1.5 text-xs leading-relaxed text-neutral-700">
                {sender.inn ? (
                  <div className="flex gap-2">
                    <dt className="shrink-0 font-semibold text-neutral-500">
                      ИНН
                    </dt>
                    <dd
                      data-waybill-sender-inn
                      className="font-mono break-all"
                    >
                      {sender.inn}
                    </dd>
                  </div>
                ) : null}
                {sender.ogrn ? (
                  <div className="flex gap-2">
                    <dt className="shrink-0 font-semibold text-neutral-500">
                      ОГРН/ОГРНИП
                    </dt>
                    <dd
                      data-waybill-sender-ogrn
                      className="font-mono break-all"
                    >
                      {sender.ogrn}
                    </dd>
                  </div>
                ) : null}
                {sender.address ? (
                  <div className="flex gap-2">
                    <dt className="shrink-0 font-semibold text-neutral-500">
                      Адрес
                    </dt>
                    <dd
                      data-waybill-sender-address
                      className="break-words"
                    >
                      {sender.address}
                    </dd>
                  </div>
                ) : null}
                {sender.phone ? (
                  <div className="flex gap-2">
                    <dt className="shrink-0 font-semibold text-neutral-500">
                      Телефон
                    </dt>
                    <dd
                      data-waybill-sender-phone
                      className="break-words"
                    >
                      {sender.phone}
                    </dd>
                  </div>
                ) : null}
                {sender.email ? (
                  <div className="flex gap-2">
                    <dt className="shrink-0 font-semibold text-neutral-500">
                      Email
                    </dt>
                    <dd
                      data-waybill-sender-email
                      className="break-all"
                    >
                      {sender.email}
                    </dd>
                  </div>
                ) : null}
              </dl>
              {sender.isFallback ? (
                <p
                  role="note"
                  data-waybill-requisites-warning
                  className="waybill-screen-only mt-3 rounded-md border border-red-300 bg-red-50 px-2.5 py-2 text-[10px] leading-relaxed font-semibold text-red-700"
                >
                  Внимание: заполните реквизиты в разделе «Реквизиты»
                  Мастерской, чтобы они печатались в накладной.
                </p>
              ) : null}
            </div>

            <div
              data-waybill-recipient
              className="rounded-lg border border-neutral-300 p-4"
            >
              <h2 className="text-[10px] font-semibold tracking-[0.18em] text-neutral-500 uppercase">
                Получатель
              </h2>
              <p
                data-waybill-client
                className="mt-2 text-sm leading-snug font-bold break-words text-neutral-950"
              >
                {clientName}
              </p>
              <dl className="mt-3 space-y-2 text-xs leading-relaxed text-neutral-700">
                <div>
                  <dt className="font-semibold text-neutral-500">Телефон</dt>
                  <dd
                    data-waybill-phone
                    className="mt-1 flex items-baseline gap-2"
                  >
                    {clientPhone ? (
                      <span className="text-sm font-semibold break-words text-neutral-950">
                        {clientPhone}
                      </span>
                    ) : (
                      <>
                        <span aria-hidden>[ ]</span>
                        <span className="h-4 min-w-0 flex-1 border-b border-neutral-400">
                          <span className="sr-only">
                            Впишите телефон получателя
                          </span>
                        </span>
                      </>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-neutral-500">
                    Адрес доставки
                  </dt>
                  <dd
                    data-waybill-address
                    className="mt-1 flex items-baseline gap-2"
                  >
                    {clientAddress ? (
                      <span className="text-sm font-semibold break-words text-neutral-950">
                        {clientAddress}
                      </span>
                    ) : (
                      <>
                        <span aria-hidden>[ ]</span>
                        <span className="h-4 min-w-0 flex-1 border-b border-neutral-400">
                          <span className="sr-only">
                            Впишите адрес доставки получателя
                          </span>
                        </span>
                      </>
                    )}
                  </dd>
                </div>
                {clientEmail ? (
                  <div data-waybill-email>
                    <dt className="font-semibold text-neutral-500">Email</dt>
                    <dd className="mt-1 text-sm font-semibold break-all text-neutral-950">
                      {clientEmail}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <p className="waybill-screen-only mt-3 text-[10px] leading-relaxed text-neutral-500">
                {client
                  ? "Контакты взяты из базы клиентов. Пустые поля впишите при отгрузке."
                  : order.clientId
                    ? "Клиент из базы не найден — впишите телефон и адрес при отгрузке."
                    : "В заказе нет ссылки на клиента. Телефон и адрес впишите при отгрузке."}
              </p>
            </div>
          </section>

          <section aria-labelledby="waybill-items-title" className="mt-8">
            <h2 id="waybill-items-title" className="sr-only">
              Состав отгрузки
            </h2>

            <table
              data-waybill-items
              className="w-full table-fixed border-collapse text-[10px] sm:text-sm"
            >
              <caption className="sr-only">
                Товары к отгрузке: наименование, количество, цена и сумма
              </caption>
              <colgroup>
                <col className="w-[42%]" />
                <col className="w-[14%]" />
                <col className="w-[22%]" />
                <col className="w-[22%]" />
              </colgroup>
              <thead>
                <tr className="border-y border-neutral-300 bg-neutral-100 text-left text-[9px] font-semibold tracking-wide text-neutral-600 uppercase sm:text-[10px]">
                  <th scope="col" className="px-2 py-2.5 sm:px-3">
                    Наименование
                  </th>
                  <th
                    scope="col"
                    className="border-l border-neutral-200 px-1.5 py-2.5 text-center sm:px-3"
                  >
                    Кол-во
                  </th>
                  <th
                    scope="col"
                    className="border-l border-neutral-200 px-1.5 py-2.5 text-right sm:px-3"
                  >
                    Цена
                  </th>
                  <th
                    scope="col"
                    className="border-l border-neutral-200 px-1.5 py-2.5 text-right sm:px-3"
                  >
                    Сумма
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-neutral-300 align-middle">
                  <td className="px-2 py-4 font-semibold break-words text-neutral-950 [overflow-wrap:anywhere] sm:px-3">
                    {order.title}
                  </td>
                  <td className="border-l border-neutral-200 px-1.5 py-4 text-center font-semibold text-neutral-900 tabular-nums sm:px-3">
                    1
                  </td>
                  <td className="border-l border-neutral-200 px-1.5 py-4 text-right whitespace-nowrap text-neutral-900 tabular-nums sm:px-3">
                    {total}
                  </td>
                  <td className="border-l border-neutral-200 px-1.5 py-4 text-right font-bold whitespace-nowrap text-neutral-950 tabular-nums sm:px-3">
                    {total}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-t border-neutral-300 pt-4">
              <p className="text-[11px] text-neutral-500">Всего позиций: 1</p>
              <p
                data-waybill-total
                className="text-sm font-extrabold text-neutral-950 sm:text-base"
              >
                Итого к оплате:{" "}
                <span className="whitespace-nowrap tabular-nums">{total}</span>
              </p>
            </div>
          </section>

          <footer
            data-waybill-signatures
            className="mt-12 border-t border-neutral-300 pt-5"
          >
            <div className="grid gap-8 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">
                  Отправитель
                </p>
                <p className="mt-7 text-sm text-neutral-700">
                  ______________________________
                </p>
                <p className="mt-1 text-xs break-words text-neutral-600">
                  {sender.signatureName}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">
                  Получатель
                </p>
                <p className="mt-7 text-sm text-neutral-700">
                  ______________________________
                </p>
                <p className="mt-1 text-xs break-words text-neutral-600">
                  {recipientName ?? "ФИО получателя"}
                </p>
              </div>
            </div>

            <p className="mt-8 text-[10px] text-neutral-500">М.П.</p>
          </footer>
        </article>

        <p className="waybill-screen-only mx-auto mt-5 max-w-2xl text-center text-xs leading-relaxed text-slate-400">
          В диалоге печати можно выбрать принтер или «Сохранить как PDF». На
          листе останется только накладная.
        </p>
      </main>
    </div>
  );
}
