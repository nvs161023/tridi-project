"use client";

import { useCallback, useRef, useState } from "react";

import { AddClientDialog } from "@/components/workshop/AddClientDialog";
import { ClientsIcon } from "@/components/workshop/WorkshopIcons";
import type { WorkshopClient } from "@/lib/workshop/clients";

/**
 * Вкладка «Клиенты».
 *
 * База читается на сервере и приходит готовым массивом. После добавления
 * клиента `addClient` вызывает `revalidatePath`, страница обновляется, и
 * таблица перерисовывается — второй источник правды вкладке не нужен.
 *
 * Пока база пуста, показывается состояние с иконкой и кнопкой. Когда клиенты
 * есть, кнопка «+ Добавить клиента» переезжает в шапку, а данные выводятся
 * таблицей в стиле товаров: тёмная карточка, uppercase-заголовки и прочерки
 * для незаполненных полей. Заметки идут второй строкой под именем — в таблице
 * они не занимают отдельную колонку.
 */

type WorkshopClientsTabProps = {
  clients: WorkshopClient[];
};

/** Телефон для ссылки tel: — в href нужны только цифры и плюс. */
function phoneHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function WorkshopClientsTab({ clients }: WorkshopClientsTabProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const openDialog = useCallback(() => setIsDialogOpen(true), []);
  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
    addButtonRef.current?.focus();
  }, []);

  return (
    <section
      aria-labelledby="workshop-clients-title"
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-blue-300 uppercase">
            База клиентов
          </p>
          <h2
            id="workshop-clients-title"
            className="mt-2 text-xl font-extrabold tracking-tight text-white"
          >
            Клиенты
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Контакты и адрес доставки в одном месте: добавьте клиента один раз,
            и его имя, телефон и email будут под рукой в заказах.
          </p>
        </div>

        {clients.length > 0 ? (
          <button
            ref={addButtonRef}
            type="button"
            onClick={openDialog}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            <span aria-hidden>+</span>
            Добавить клиента
          </button>
        ) : null}
      </div>

      {clients.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-[#0a0a0a] px-5 py-12 text-center sm:py-16">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-blue-300 shadow-[0_18px_60px_-28px_rgba(59,130,246,0.7)]">
            <ClientsIcon className="h-8 w-8" />
          </span>
          <h3 className="mt-5 text-lg font-bold tracking-tight text-white">
            База клиентов пока пуста
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
            Добавьте первого клиента, чтобы не вводить его контакты при каждом
            заказе. Телефон и адрес можно оставить пустыми.
          </p>
          <button
            ref={addButtonRef}
            type="button"
            onClick={openDialog}
            className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            <span aria-hidden className="text-lg leading-none">
              +
            </span>
            Добавить клиента
          </button>
        </div>
      ) : (
        <>
          <p className="mt-3 text-xs font-semibold text-zinc-500">
            Клиентов: {clients.length}
          </p>
          <ClientsTable clients={clients} />
        </>
      )}

      {isDialogOpen ? <AddClientDialog onClose={closeDialog} /> : null}
    </section>
  );
}

/** Таблица базы в стиле товаров и склада: тёмная карточка, компактные строки. */
function ClientsTable({ clients }: { clients: WorkshopClient[] }) {
  return (
    <div
      data-clients-table
      className="mt-4 overflow-hidden rounded-2xl border border-white/5 bg-[#0a0a0a]"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <caption className="sr-only">
            Клиенты: имя, телефон, email и адрес
          </caption>
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.02] text-left text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">
              <th scope="col" className="px-3 py-3">
                Имя
              </th>
              <th scope="col" className="px-3 py-3">
                Телефон
              </th>
              <th scope="col" className="px-3 py-3">
                Email
              </th>
              <th scope="col" className="px-3 py-3">
                Адрес
              </th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr
                key={client.id}
                className="border-b border-white/5 align-top transition-colors last:border-b-0 hover:bg-white/[0.02]"
              >
                <td className="px-3 py-4">
                  <p className="font-semibold text-white">{client.name}</p>
                  {client.notes ? (
                    <p className="mt-1 max-w-xs text-xs leading-relaxed text-zinc-500">
                      {client.notes}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-4 whitespace-nowrap tabular-nums text-zinc-300">
                  {client.phone ? (
                    <a
                      href={phoneHref(client.phone)}
                      className="transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
                    >
                      {client.phone}
                    </a>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
                <td className="px-3 py-4 break-words text-zinc-300">
                  {client.email ? (
                    <a
                      href={`mailto:${client.email}`}
                      className="transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
                    >
                      {client.email}
                    </a>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
                <td className="max-w-[18rem] px-3 py-4 break-words text-zinc-300">
                  {client.address ?? <span className="text-slate-500">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
