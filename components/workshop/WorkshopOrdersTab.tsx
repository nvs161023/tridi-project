"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";

import { advanceOrderStatus } from "@/app/actions/orders";
import { CreateOrderDialog } from "@/components/workshop/CreateOrderDialog";
import { formatGrams, type WorkshopFilament } from "@/lib/workshop/filaments";
import {
  ORDER_STATUS_META,
  formatOrderCost,
  formatOrderDate,
  formatOrderHours,
  nextOrderStatus,
  type WorkshopOrder,
} from "@/lib/workshop/orders";
import type { WorkshopPrinter } from "@/lib/workshop/printers";

/**
 * Вкладка «Заказы».
 *
 * Таблица на широком экране и карточки на узком — одна и та же информация.
 * Бейдж статуса — кнопка: нажатие переводит заказ на следующий шаг
 * (new → printing → ready → delivered). «Доставлен» — конечный статус, его
 * кнопка выключена.
 *
 * Список приходит с сервера и обновляется через router.refresh() после
 * создания заказа и смены статуса. Принтеры и катушки передаются отдельно:
 * по id из заказа находим имя принтера и подпись катушки, а удалённые строки
 * показываем как «Принтер удалён» / «Катушка удалена».
 */

type WorkshopOrdersTabProps = {
  orders: WorkshopOrder[];
  printers: WorkshopPrinter[];
  filaments: WorkshopFilament[];
  /** В базе нет таблицы workshop_orders — миграция не применена. */
  isMissingTable: boolean;
};

/** Начало сегодняшнего дня: по нему считаем просроченные сроки. */
function todayStart(): number {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/** Срок прошёл, а заказ ещё не доставлен. */
function isOrderOverdue(order: WorkshopOrder): boolean {
  if (!order.deadline || order.status === "delivered") {
    return false;
  }

  const [year, month, day] = order.deadline.split("-").map(Number);

  return new Date(year, month - 1, day).getTime() < todayStart();
}

export function WorkshopOrdersTab({
  orders,
  printers,
  filaments,
  isMissingTable,
}: WorkshopOrdersTabProps) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const createTriggerRef = useRef<HTMLButtonElement>(null);

  const printerById = useMemo(
    () => new Map(printers.map((printer) => [printer.id, printer])),
    [printers],
  );
  const filamentById = useMemo(
    () => new Map(filaments.map((filament) => [filament.id, filament])),
    [filaments],
  );

  const summary = useMemo(
    () => ({
      totalCost: orders.reduce((sum, order) => sum + order.totalCost, 0),
      inProgress: orders.filter((order) => order.status === "printing").length,
      overdue: orders.filter(isOrderOverdue).length,
    }),
    [orders],
  );

  const openCreate = useCallback(() => {
    setStatus(null);
    setError(null);
    setIsCreateOpen(true);
  }, []);

  const closeCreate = useCallback(() => {
    setIsCreateOpen(false);
    createTriggerRef.current?.focus();
  }, []);

  /** Смена статуса: сервер сам решает, какой статус следующий. */
  async function handleStatusChange(order: WorkshopOrder) {
    setStatus(null);
    setError(null);
    setPendingId(order.id);

    const result = await advanceOrderStatus(order.id);

    setPendingId(null);

    if (!result.ok) {
      setError(result.error ?? "Не удалось сменить статус.");
      return;
    }

    setStatus(result.message ?? "Статус изменён.");
    router.refresh();
  }

  return (
    <section
      aria-labelledby="workshop-orders-title"
      className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md sm:p-7"
    >
      {isMissingTable ? (
        <p
          role="status"
          className="mb-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100"
        >
          <span aria-hidden>⚠️ </span>
          Заказы пока не сохраняются: в базе нет таблицы workshop_orders.
          Создавать их можно после миграции
          supabase/workshop_printers_orders.sql.
        </p>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-blue-300 uppercase">
            Заказы
          </p>
          <h2
            id="workshop-orders-title"
            className="mt-2 text-xl font-extrabold tracking-tight text-white"
          >
            Заказы клиентов
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
            При создании заказа время печати прибавляется к наработке
            принтера, а вес модели списывается с катушки. Статус меняется
            нажатием на бейдж.
          </p>
        </div>

        <button
          ref={createTriggerRef}
          type="button"
          onClick={openCreate}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <span aria-hidden>+</span>
          Создать заказ
        </button>
      </div>

      <p aria-live="polite" className="mt-3 min-h-5 text-sm text-emerald-300">
        {status}
      </p>
      {error ? (
        <p
          role="alert"
          className="mb-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100"
        >
          <span aria-hidden>⚠️ </span>
          {error}
        </p>
      ) : null}

      {orders.length === 0 ? (
        <EmptyOrders onAdd={openCreate} />
      ) : (
        <>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-400">
            <span>Заказов: {orders.length}</span>
            <span>В печати: {summary.inProgress}</span>
            <span>Сумма: {formatOrderCost(summary.totalCost)}</span>
            {summary.overdue > 0 ? (
              <span className="text-red-300">
                Просрочен срок: {summary.overdue}
              </span>
            ) : null}
          </p>

          <OrdersTable
            orders={orders}
            printerById={printerById}
            filamentById={filamentById}
            pendingId={pendingId}
            onStatusChange={handleStatusChange}
          />
          <OrdersCards
            orders={orders}
            printerById={printerById}
            filamentById={filamentById}
            pendingId={pendingId}
            onStatusChange={handleStatusChange}
          />
        </>
      )}

      {isCreateOpen ? (
        <CreateOrderDialog
          printers={printers}
          filaments={filaments}
          onClose={closeCreate}
          onCreated={setStatus}
        />
      ) : null}
    </section>
  );
}

type OrderListProps = {
  orders: WorkshopOrder[];
  printerById: Map<string, WorkshopPrinter>;
  filamentById: Map<string, WorkshopFilament>;
  pendingId: string | null;
  onStatusChange: (order: WorkshopOrder) => void;
};

/** Таблица заказов: на узком экране её заменяют карточки. */
function OrdersTable({
  orders,
  printerById,
  filamentById,
  pendingId,
  onStatusChange,
}: OrderListProps) {
  return (
    <div className="mt-3 hidden overflow-x-auto lg:block">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Заказы: название, клиент, статус, стоимость, расход пластика и
          принтер
        </caption>
        <thead>
          <tr className="border-b border-white/10 text-left text-xs font-semibold tracking-wide text-slate-400 uppercase">
            <th scope="col" className="px-3 py-3">
              Заказ
            </th>
            <th scope="col" className="px-3 py-3">
              Статус
            </th>
            <th scope="col" className="px-3 py-3">
              Стоимость
            </th>
            <th scope="col" className="px-3 py-3">
              Вес
            </th>
            <th scope="col" className="px-3 py-3">
              Время
            </th>
            <th scope="col" className="px-3 py-3">
              Принтер
            </th>
            <th scope="col" className="px-3 py-3">
              Катушка
            </th>
            <th scope="col" className="px-3 py-3">
              Срок
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const printer = order.printerId
              ? printerById.get(order.printerId)
              : null;
            const filament = order.filamentId
              ? filamentById.get(order.filamentId)
              : null;
            const isOverdue = isOrderOverdue(order);

            return (
              <tr
                key={order.id}
                className="border-b border-white/5 align-top last:border-b-0"
              >
                <td className="px-3 py-4">
                  <p className="font-semibold text-white">{order.title}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {order.clientName ?? "Клиент не указан"}
                  </p>
                  {order.notes ? (
                    <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
                      {order.notes}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-4">
                  <StatusBadge
                    order={order}
                    isPending={pendingId === order.id}
                    onChange={onStatusChange}
                  />
                </td>
                <td className="px-3 py-4 tabular-nums text-slate-200">
                  {formatOrderCost(order.totalCost)}
                </td>
                <td className="px-3 py-4 tabular-nums text-slate-300">
                  {formatGrams(order.materialWeightG)}
                </td>
                <td className="px-3 py-4 tabular-nums text-slate-300">
                  {formatOrderHours(order.printTimeHours)}
                </td>
                <td className="px-3 py-4 text-slate-300">
                  {order.printerId
                    ? (printer?.name ?? "Принтер удалён")
                    : "—"}
                </td>
                <td className="px-3 py-4 text-slate-300">
                  {order.filamentId
                    ? filament
                      ? filamentLabel(filament)
                      : "Катушка удалена"
                    : "—"}
                </td>
                <td
                  className={`px-3 py-4 tabular-nums ${
                    isOverdue ? "font-semibold text-red-300" : "text-slate-300"
                  }`}
                >
                  {formatOrderDate(order.deadline)}
                  {isOverdue ? <span className="sr-only"> — срок прошёл</span> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Карточки заказов: та же информация, но в одну колонку. */
function OrdersCards({
  orders,
  printerById,
  filamentById,
  pendingId,
  onStatusChange,
}: OrderListProps) {
  return (
    <ul className="mt-4 grid gap-3 lg:hidden">
      {orders.map((order) => {
        const printer = order.printerId
          ? printerById.get(order.printerId)
          : null;
        const filament = order.filamentId
          ? filamentById.get(order.filamentId)
          : null;
        const isOverdue = isOrderOverdue(order);

        return (
          <li
            key={order.id}
            className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">{order.title}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {order.clientName ?? "Клиент не указан"}
                </p>
              </div>
              <StatusBadge
                order={order}
                isPending={pendingId === order.id}
                onChange={onStatusChange}
              />
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <dt className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                  Стоимость
                </dt>
                <dd className="mt-0.5 tabular-nums text-slate-200">
                  {formatOrderCost(order.totalCost)}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                  Срок
                </dt>
                <dd
                  className={`mt-0.5 tabular-nums ${
                    isOverdue
                      ? "font-semibold text-red-300"
                      : "text-slate-200"
                  }`}
                >
                  {formatOrderDate(order.deadline)}
                  {isOverdue ? " — срок прошёл" : ""}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                  Вес
                </dt>
                <dd className="mt-0.5 tabular-nums text-slate-200">
                  {formatGrams(order.materialWeightG)}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                  Время
                </dt>
                <dd className="mt-0.5 tabular-nums text-slate-200">
                  {formatOrderHours(order.printTimeHours)}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                  Принтер
                </dt>
                <dd className="mt-0.5 text-slate-200">
                  {order.printerId
                    ? (printer?.name ?? "Принтер удалён")
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                  Катушка
                </dt>
                <dd className="mt-0.5 text-slate-200">
                  {order.filamentId
                    ? filament
                      ? filamentLabel(filament)
                      : "Катушка удалена"
                    : "—"}
                </dd>
              </div>
            </dl>

            {order.notes ? (
              <p className="mt-3 text-xs leading-relaxed text-slate-400">
                {order.notes}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Бейдж статуса — кнопка следующего шага.
 *
 * У «Доставлен» следующего статуса нет: кнопка выключена, но остаётся
 * читаемой. `title` и `aria-label` объясняют, что произойдёт по нажатию.
 */
function StatusBadge({
  order,
  isPending,
  onChange,
}: {
  order: WorkshopOrder;
  isPending: boolean;
  onChange: (order: WorkshopOrder) => void;
}) {
  const meta = ORDER_STATUS_META[order.status];
  const next = nextOrderStatus(order.status);
  const nextLabel = next ? ORDER_STATUS_META[next].label : null;

  return (
    <button
      type="button"
      disabled={isPending || next === null}
      aria-busy={isPending}
      onClick={() => onChange(order)}
      aria-label={
        nextLabel
          ? `Заказ «${order.title}»: перевести в «${nextLabel}»`
          : `Заказ «${order.title}» доставлен — статус конечный`
      }
      title={nextLabel ? `Следующий статус: ${nextLabel}` : "Заказ доставлен"}
      className={`inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-default disabled:opacity-60 ${meta.badgeClassName} ${
        next ? "cursor-pointer hover:brightness-125" : ""
      }`}
    >
      {isPending ? "Меняем…" : meta.label}
      {next ? <span aria-hidden>→</span> : null}
    </button>
  );
}

/** Подпись катушки для таблицы: «Prusament PLA Чёрный». */
function filamentLabel(filament: WorkshopFilament): string {
  return (
    [filament.brand, filament.type, filament.color]
      .filter(Boolean)
      .join(" ") || "Катушка без названия"
  );
}

/** Пустой список заказов: объясняем, что даст первый заказ. */
function EmptyOrders({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-white/15 bg-slate-950/40 px-5 py-8 text-center">
      <p aria-hidden className="text-3xl">
        🧾
      </p>
      <p className="mt-3 text-sm font-semibold text-white">Заказов пока нет</p>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-300">
        Создайте заказ — Мастерская посчитает его стоимостью, спишет пластик с
        катушки и прибавит время печати к наработке принтера. Вес и время можно
        взять из G-code.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full border border-white/20 px-5 text-sm font-semibold text-slate-100 transition-colors hover:border-blue-400/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        Создать первый заказ
      </button>
    </div>
  );
}
