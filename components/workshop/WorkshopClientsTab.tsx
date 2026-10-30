"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { AddClientDialog } from "@/components/workshop/AddClientDialog";
import {
  ClientsIcon,
  PencilIcon,
} from "@/components/workshop/WorkshopIcons";
import type { WorkshopClient } from "@/lib/workshop/clients";

/**
 * Вкладка «Клиенты».
 *
 * База читается на сервере и приходит готовым массивом. После добавления или
 * правки клиента действие вызывает `revalidatePath`, страница обновляется, и
 * таблица перерисовывается — второй источник правды вкладке не нужен.
 *
 * Пока база пуста, показывается состояние с иконкой и кнопкой. Когда клиенты
 * есть, кнопка «+ Добавить клиента» переезжает в шапку, а данные выводятся
 * таблицей в стиле товаров: тёмная карточка, uppercase-заголовки и прочерки
 * для незаполненных полей. Заметки идут второй строкой под именем — в таблице
 * они не занимают отдельную колонку.
 *
 * Поиск работает по уже загруженному массиву: имя ищется по вхождению
 * подстроки, телефон — и по написанию, и по цифрам, поэтому «+7 (999)»
 * находится и запросом «999». Новых запросов к базе поиск не делает.
 */

type WorkshopClientsTabProps = {
  clients: WorkshopClient[];
};

/** Телефон для ссылки tel: — в href нужны только цифры и плюс. */
function phoneHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** Цифры телефона: по ним поиск не зависит от скобок и дефисов. */
function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Клиенты, подходящие под запрос.
 *
 * Пустой запрос возвращает весь список: вкладка не должна фильтровать базу,
 * пока мастер ничего не искал. Пробелы по краям не считаются содержимым.
 */
function filterClients(
  clients: WorkshopClient[],
  query: string,
): WorkshopClient[] {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return clients;
  }

  const digits = phoneDigits(needle);

  return clients.filter((client) => {
    if (client.name.toLowerCase().includes(needle)) {
      return true;
    }

    if (!client.phone) {
      return false;
    }

    return (
      client.phone.toLowerCase().includes(needle) ||
      (digits.length > 0 && phoneDigits(client.phone).includes(digits))
    );
  });
}

export function WorkshopClientsTab({ clients }: WorkshopClientsTabProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  /** Клиент, открытый в окне правки: тот же диалог, что и добавление. */
  const [editingClient, setEditingClient] = useState<WorkshopClient | null>(
    null,
  );
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const visibleClients = useMemo(
    () => filterClients(clients, search),
    [clients, search],
  );
  const isSearching = search.trim().length > 0;

  const openDialog = useCallback(() => setIsDialogOpen(true), []);
  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
    addButtonRef.current?.focus();
  }, []);

  const openEdit = useCallback((client: WorkshopClient) => {
    setEditingClient(client);
  }, []);

  /** Закрытие правки возвращает фокус на кнопку той же строки. */
  const closeEdit = useCallback(() => {
    const clientId = editingClient?.id;
    setEditingClient(null);

    if (!clientId) {
      return;
    }

    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-client-edit="${clientId}"]`)
        ?.focus();
    });
  }, [editingClient]);

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
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="w-full sm:max-w-sm">
              <label htmlFor="clients-search" className="sr-only">
                Поиск по имени или телефону
              </label>
              <input
                id="clients-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="Поиск: имя или телефон"
                data-clients-search
                className="min-h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white outline-none transition-all duration-200 placeholder:text-zinc-500 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30 focus:ring-inset"
              />
            </div>
            <p className="text-xs font-semibold text-zinc-500">
              Клиентов: {clients.length}
              {isSearching ? ` · найдено: ${visibleClients.length}` : ""}
            </p>
          </div>

          {visibleClients.length === 0 ? (
            <div
              data-clients-no-results
              className="mt-4 rounded-2xl border border-dashed border-white/10 bg-[#0a0a0a] px-5 py-10 text-center"
            >
              <h3 className="text-base font-bold tracking-tight text-white">
                Ничего не найдено
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
                По запросу «{search.trim()}» клиентов нет. Проверьте имя или
                телефон — или сбросьте поиск.
              </p>
              <button
                type="button"
                onClick={() => setSearch("")}
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-5 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
              >
                Сбросить поиск
              </button>
            </div>
          ) : (
            <ClientsTable clients={visibleClients} onEdit={openEdit} />
          )}
        </>
      )}

      {isDialogOpen ? <AddClientDialog onClose={closeDialog} /> : null}
      {editingClient ? (
        <AddClientDialog initial={editingClient} onClose={closeEdit} />
      ) : null}
    </section>
  );
}

/** Таблица базы в стиле товаров и склада: тёмная карточка, компактные строки. */
function ClientsTable({
  clients,
  onEdit,
}: {
  clients: WorkshopClient[];
  onEdit: (client: WorkshopClient) => void;
}) {
  return (
    <div
      data-clients-table
      className="mt-4 overflow-hidden rounded-2xl border border-white/5 bg-[#0a0a0a]"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] border-collapse text-sm">
          <caption className="sr-only">
            Клиенты: имя, телефон, email, адрес и правка карточки
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
              <th scope="col" className="px-3 py-3 text-right">
                <span className="sr-only">Действия</span>
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
                <td className="px-3 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => onEdit(client)}
                    aria-label={`Редактировать клиента «${client.name}»`}
                    title="Редактировать клиента"
                    data-client-edit={client.id}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition-colors hover:border-blue-400/50 hover:bg-blue-500/15 hover:text-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
