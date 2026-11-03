"use client";

import {
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { loadClientOrders } from "@/app/actions/orders";
import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";
import type { WorkshopClient } from "@/lib/workshop/clients";
import {
  ORDER_STATUS_META,
  formatOrderCost,
  type WorkshopOrder,
} from "@/lib/workshop/orders";

/**
 * Окно «История заказов: [Имя клиента]».
 *
 * Открывается из таблицы клиентов. Заказы читаются при открытии через Server
 * Action `loadClientOrders`: страница не знает, чью историю откроют, поэтому
 * грузить заказы всех клиентов заранее незачем.
 *
 * Состояний четыре: загрузка, ошибка чтения, пустой список и таблица. Пустой
 * список отличается от неприменённой миграции: без колонки
 * `workshop_orders.client_id` заказы ни с одним клиентом не связаны, и окно
 * говорит об этом прямо, а не «заказов не было».
 *
 * Колонки те же, что нужны мастеру для решения: когда заказ был, что заказали,
 * сколько он стоил и на каком он этапе. Статус показывается бейджем из
 * `ORDER_STATUS_META`, поэтому цвет и подпись совпадают с Kanban.
 */

type ClientOrdersDialogProps = {
  client: WorkshopClient;
  onClose: () => void;
};

/** Дата создания заказа: «03.11.2026». */
const ORDER_DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/**
 * Дата заказа с часами из базы.
 *
 * Здесь свой форматтер, а не `formatOrderDate`: та функция ждёт дату без времени
 * (поле `deadline`), а `created_at` приходит полной отметкой времени.
 */
function formatCreatedAt(value: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "—" : ORDER_DATE_FORMATTER.format(date);
}

export function ClientOrdersDialog({
  client,
  onClose,
}: ClientOrdersDialogProps) {
  const [orders, setOrders] = useState<WorkshopOrder[]>([]);
  const [isMissingLink, setIsMissingLink] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useDialogDismiss(onClose);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    let isActive = true;

    async function load() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const snapshot = await loadClientOrders(client.id);

        if (isActive) {
          setOrders(snapshot.orders);
          setIsMissingLink(snapshot.isMissingLink);
        }
      } catch {
        if (isActive) {
          setLoadError(
            "Не удалось загрузить заказы. Закройте окно и откройте снова.",
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      isActive = false;
    };
  }, [client.id]);

  /** Закрытие по фону: клик по самому overlay, а не по окну. */
  const handleBackdropClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  const totalCost = orders.reduce((sum, order) => sum + order.totalCost, 0);
  const hasOrders = orders.length > 0;

  return (
    <div
      role="presentation"
      onMouseDown={handleBackdropClick}
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-orders-title"
        tabIndex={-1}
        data-client-orders-dialog
        className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl shadow-black/60 outline-none sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-blue-400 uppercase">
              Клиенты
            </p>
            <h2
              id="client-orders-title"
              className="mt-3 text-2xl font-extrabold tracking-tight text-white"
            >
              История заказов: {client.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть историю заказов"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-lg text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        {hasOrders ? (
          <p
            data-client-orders-summary
            className="mt-4 text-sm leading-relaxed text-slate-300"
          >
            Заказов:{" "}
            <strong className="font-semibold text-white">{orders.length}</strong>{" "}
            на сумму{" "}
            <strong className="font-semibold text-white">
              {formatOrderCost(totalCost)}
            </strong>
            .
          </p>
        ) : null}

        {isLoading ? (
          <p
            data-client-orders-loading
            className="mt-5 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-8 text-center text-sm text-zinc-400"
          >
            Загружаем заказы…
          </p>
        ) : null}

        {loadError ? (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-200"
          >
            {loadError}
          </p>
        ) : null}

        {!isLoading && isMissingLink ? (
          <p
            data-client-orders-migration
            className="mt-5 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100"
          >
            Заказы не связаны с клиентами: в базе нет колонки{" "}
            <span className="font-mono text-xs">workshop_orders.client_id</span>.
            Примените миграцию{" "}
            <span className="font-mono text-xs">
              supabase/workshop_orders_client_id.sql
            </span>
            , и история появится.
          </p>
        ) : null}

        {!isLoading && !loadError && !hasOrders && !isMissingLink ? (
          <div
            data-client-orders-empty
            className="mt-5 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-10 text-center"
          >
            <h3 className="text-base font-bold tracking-tight text-white">
              У этого клиента пока нет заказов
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-400">
              Выберите этого клиента при создании заказа — он появится здесь.
            </p>
          </div>
        ) : null}

        {hasOrders ? (
          <div
            data-client-orders-table
            className="mt-5 overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02]"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <caption className="sr-only">
                  Заказы клиента {client.name}: дата, название, сумма и статус
                </caption>
                <thead>
                  <tr className="border-b border-white/5 text-left text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">
                    <th scope="col" className="px-3 py-2.5">
                      Дата
                    </th>
                    <th scope="col" className="px-3 py-2.5">
                      Название
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right">
                      Сумма
                    </th>
                    <th scope="col" className="px-3 py-2.5">
                      Статус
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const meta = ORDER_STATUS_META[order.status];

                    return (
                      <tr
                        key={order.id}
                        data-client-orders-row={order.id}
                        className="border-b border-white/5 align-middle last:border-b-0"
                      >
                        <td className="px-3 py-3 whitespace-nowrap tabular-nums text-zinc-400">
                          {formatCreatedAt(order.createdAt)}
                        </td>
                        <td className="px-3 py-3 text-white">{order.title}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums text-zinc-200">
                          {formatOrderCost(order.totalCost)}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${meta.badgeClassName}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-5 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
