"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";

import { deleteOrder, updateOrderStatus } from "@/app/actions/orders";
import { CreateOrderDialog } from "@/components/workshop/CreateOrderDialog";
import { OrderDetailsDialog } from "@/components/workshop/OrderDetailsDialog";
import {
  PrinterIcon,
  TrashIcon,
} from "@/components/workshop/WorkshopIcons";
import { createClient } from "@/lib/supabase/client";
import type { WorkshopClient } from "@/lib/workshop/clients";
import type { WorkshopFilament } from "@/lib/workshop/filaments";
import {
  ORDER_STATUS_META,
  ORDER_STATUS_SEQUENCE,
  formatOrderCost,
  formatOrderDate,
  formatOrderHours,
  type OrderFlowStatus,
  type OrderStatus,
  type WorkshopOrder,
} from "@/lib/workshop/orders";
import type { WorkshopPrinter } from "@/lib/workshop/printers";
import type { WorkshopProduct } from "@/lib/workshop/products";

/**
 * Вкладка «Заказы» — Kanban-доска.
 *
 * Четыре колонки повторяют статусы заказа. На десктопе это сетка из четырёх
 * равных колонок, на мобильном — лента с горизонтальной прокруткой: карточки
 * не сжимаются до нечитаемой ширины. Перетаскивание работает на нативном HTML5
 * API, без сторонних библиотек.
 *
 * У перетаскивания есть клавиатурный и мобильный дубль: кнопка «⋯» на карточке
 * открывает список всех статусов. Поэтому смена статуса не зависит от точности
 * пальца и остаётся доступной без drag-and-drop.
 *
 * После успешного Server Action вызывается router.refresh(): карточка
 * возвращается с сервера уже в новой колонке, а не переезжает только в памяти
 * браузера. Если запись не удалась, карточка остаётся на месте и показывается
 * ошибка.
 *
 * Тем же refresh() доска отвечает на изменения в базе: подписка Supabase
 * Realtime показывает заказы, созданные и передвинутые в другой вкладке или
 * локальным агентом. Своих данных у доски нет — источник один, серверный
 * компонент страницы.
 */

type WorkshopOrdersTabProps = {
  orders: WorkshopOrder[];
  printers: WorkshopPrinter[];
  filaments: WorkshopFilament[];
  products: WorkshopProduct[];
  /** База клиентов для выбора готового контакта при создании заказа. */
  clients: WorkshopClient[];
  /** В базе нет таблицы workshop_orders — миграция не применена. */
  isMissingTable: boolean;
};

type StatusColumn = {
  status: OrderFlowStatus;
  label: string;
  hint: string;
};

/** MIME-тип переносимого заказа: по нему колонка понимает, что тащат карточку. */
const DRAG_MIME = "application/x-workshop-order";

/**
 * Пауза перед refresh() после события Realtime.
 *
 * Одно действие может изменить несколько строк сразу: заказ, наработку принтера
 * и остаток катушки. Агент тоже обновляет заказы пачкой. Без паузы каждая
 * строка вызвала бы свой серверный рендер; 250 мс на глаз незаметны и собирают
 * всплеск в один refresh.
 */
const REALTIME_REFRESH_DELAY_MS = 250;

const STATUS_COLUMNS: readonly StatusColumn[] = [
  { status: "new", label: "Новые", hint: "Ждут запуска" },
  { status: "printing", label: "В печати", hint: "Сейчас на принтере" },
  { status: "ready", label: "Готовы", hint: "Можно выдавать" },
  { status: "delivered", label: "Выданы", hint: "Переданы клиенту" },
];

/** Цвет точки статуса в колонке и меню. Классы статические — Tailwind их видит. */
const STATUS_DOT_CLASS: Record<OrderStatus, string> = {
  new: "bg-zinc-400",
  printing: "bg-blue-400",
  ready: "bg-emerald-400",
  delivered: "bg-violet-400",
  unmapped: "bg-amber-400",
};

/** Начало сегодняшнего дня: по нему считаем просроченные сроки. */
function todayStart(): number {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/** Срок прошёл, а заказ ещё не выдан. */
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
  products,
  clients,
  isMissingTable,
}: WorkshopOrdersTabProps) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  /** Заказ, который удаляется: карточка блокируется до ответа сервера. */
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<OrderFlowStatus | null>(
    null,
  );
  /** Открытая карточка заказа: id вместо объекта — детали берутся из props. */
  const [detailsOrderId, setDetailsOrderId] = useState<string | null>(null);
  const createTriggerRef = useRef<HTMLButtonElement>(null);
  /**
   * Когда закончилось последнее перетаскивание.
   *
   * Браузер не присылает click после drag-and-drop, но событие может прийти на
   * некоторых платформах. Короткая пауза после dragend не даёт клику открыть
   * карточку вместо переноса.
   */
  const lastDragEndRef = useRef(0);

  const printerById = useMemo(
    () => new Map(printers.map((printer) => [printer.id, printer])),
    [printers],
  );

  const groupedOrders = useMemo(() => {
    const groups: Record<OrderFlowStatus, WorkshopOrder[]> = {
      new: [],
      printing: [],
      ready: [],
      delivered: [],
    };

    for (const order of orders) {
      if (order.status !== "unmapped") {
        groups[order.status].push(order);
      }
    }

    return groups;
  }, [orders]);

  const summary = useMemo(
    () => ({
      totalCost: orders.reduce((sum, order) => sum + order.totalCost, 0),
      inProgress: orders.filter((order) => order.status === "printing").length,
      overdue: orders.filter(isOrderOverdue).length,
    }),
    [orders],
  );

  /** Заказ открытой карточки: после router.refresh() берём свежие данные. */
  const detailsOrder =
    detailsOrderId !== null
      ? (orders.find((order) => order.id === detailsOrderId) ?? null)
      : null;

  const openCreate = useCallback(() => {
    setNotice(null);
    setError(null);
    setIsCreateOpen(true);
  }, []);

  const closeCreate = useCallback(() => {
    setIsCreateOpen(false);
    createTriggerRef.current?.focus();
  }, []);

  const openDetails = useCallback((order: WorkshopOrder) => {
    setNotice(null);
    setError(null);
    setDetailsOrderId(order.id);
  }, []);

  /**
   * Закрытие карточки возвращает фокус на её заголовок: после Escape человек
   * остаётся на том же заказе, а не в начале страницы.
   */
  const closeDetails = useCallback(() => {
    const orderId = detailsOrderId;
    setDetailsOrderId(null);

    if (!orderId) {
      return;
    }

    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-order-open="${orderId}"]`)
        ?.focus();
    });
  }, [detailsOrderId]);

  /**
   * Клик по карточке открывает заказ. Кнопки внутри (меню статуса, заголовок)
   * обрабатывают клик сами, поэтому их пропускаем; после drag-and-drop карточка
   * не открывается — иначе перенос заканчивался бы модальным окном.
   */
  function handleCardClick(
    event: ReactMouseEvent<HTMLLIElement>,
    order: WorkshopOrder,
  ) {
    if (Date.now() - lastDragEndRef.current < 250) {
      return;
    }

    // Пока сохраняется статус или идёт удаление, карточка недоступна:
    // окно показало бы старые данные.
    if (pendingId === order.id || deletingId === order.id) {
      return;
    }

    if (
      event.target instanceof Element &&
      event.target.closest("button, a, input, textarea, select, label")
    ) {
      return;
    }

    openDetails(order);
  }

  /**
   * Realtime: доска видит заказы, изменённые не в этой вкладке.
   *
   * Источник данных Kanban — серверный компонент страницы: в `WorkshopOrder`
   * уже присоединены принтер, катушка и позиции, а в событии `postgres_changes`
   * лежит только строка таблицы. Собрать из неё карточку нельзя, поэтому
   * обработчик ничего не патчит в стейте, а вызывает `router.refresh()`:
   * страница перечитывает заказы тем же `getWorkshopOrders()`, что и при
   * загрузке. Так же поступают `moveOrder` и `removeOrder` после Server Action —
   * на доске всегда серверные данные, без «второй правды» в браузере.
   *
   * События приходят только по своим заказам: RLS-политика
   * `workshop_orders_select_own` применяется к подписке так же, как к select.
   * Канал один на страницу, имя фиксированное — второй такой клиент просто
   * переиспользует тему вместо отдельного сокета.
   *
   * Всплеск событий (агент обновил пачку заказов) схлопывается в один refresh:
   * таймер перезапускается на каждом событии, а серверный рендер выполняется
   * один раз — через REALTIME_REFRESH_DELAY_MS после последнего.
   *
   * Без таблицы и без ключей Supabase доска работает как раньше: изменения
   * видны после перезагрузки страницы.
   */
  useEffect(() => {
    if (isMissingTable) {
      return;
    }

    let supabase: ReturnType<typeof createClient>;

    try {
      supabase = createClient();
    } catch (cause) {
      // createClient() бросает, если в окружении нет NEXT_PUBLIC_SUPABASE_*.
      // Это не повод ломать Мастерскую: остальное на странице работает.
      console.warn("Realtime заказов недоступен:", cause);

      return;
    }

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel("realtime-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workshop_orders" },
        () => {
          if (refreshTimer !== null) {
            clearTimeout(refreshTimer);
          }

          refreshTimer = setTimeout(() => {
            refreshTimer = null;
            router.refresh();
          }, REALTIME_REFRESH_DELAY_MS);
        },
      )
      .subscribe();

    return () => {
      // Таймер мог остаться от последнего события: после отписки refresh
      // перерисовал бы размонтированную страницу.
      if (refreshTimer !== null) {
        clearTimeout(refreshTimer);
      }

      void supabase.removeChannel(channel);
    };
  }, [isMissingTable, router]);

  /** Перенос карточки в выбранную колонку: сервер проверяет заказ и статус. */
  async function moveOrder(order: WorkshopOrder, nextStatus: OrderFlowStatus) {
    if (
      order.status === nextStatus ||
      pendingId === order.id ||
      deletingId === order.id
    ) {
      return;
    }

    setNotice(null);
    setError(null);
    setPendingId(order.id);

    const result = await updateOrderStatus(order.id, nextStatus);

    setPendingId(null);

    if (!result.ok) {
      setError(result.error ?? "Не удалось сменить статус.");
      return;
    }

    setNotice(result.message ?? "Статус изменён.");
    router.refresh();
  }

  /**
   * Удаление заказа с карточки Kanban.
   *
   * Подтверждение обязательно: действие необратимо, а комментарии удаляются
   * каскадом. Пока сервер отвечает, карточка заблокирована (`deletingId`), а
   * после успеха `router.refresh()` убирает её с доски: страница перечитывает
   * заказы, и удалённой строки в них уже нет. Открытую карточку закрываем — её
   * заказа больше не существует.
   */
  async function removeOrder(order: WorkshopOrder) {
    if (deletingId !== null) {
      return;
    }

    const confirmed = window.confirm(
      `Удалить заказ «${order.title}»? Это действие нельзя отменить.`,
    );

    if (!confirmed) {
      return;
    }

    setNotice(null);
    setError(null);
    setDeletingId(order.id);

    try {
      const result = await deleteOrder(order.id);

      if (!result.ok) {
        setError(
          result.error ?? "Не удалось удалить заказ. Попробуйте ещё раз.",
        );
        return;
      }

      if (detailsOrderId === order.id) {
        setDetailsOrderId(null);
      }

      setNotice(result.message ?? "Заказ удалён.");
      router.refresh();
    } catch {
      setError("Нет связи с сервером. Попробуйте ещё раз.");
    } finally {
      setDeletingId(null);
    }
  }

  function handleDropOrder(orderId: string, nextStatus: OrderFlowStatus) {
    setDraggingId(null);
    setDragOverStatus(null);

    const order = orders.find((item) => item.id === orderId);

    if (!order) {
      setError(
        "Заказ не найден — возможно, его уже удалили. Обновите страницу.",
      );
      return;
    }

    void moveOrder(order, nextStatus);
  }

  function handleDragStart(
    event: DragEvent<HTMLLIElement>,
    order: WorkshopOrder,
  ) {
    if (pendingId === order.id) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(DRAG_MIME, order.id);
    event.dataTransfer.setData("text/plain", order.id);
    setDraggingId(order.id);
    setDragOverStatus(null);
  }

  function handleDragEnd() {
    lastDragEndRef.current = Date.now();
    setDraggingId(null);
    setDragOverStatus(null);
  }

  return (
    <section
      aria-labelledby="workshop-orders-title"
      className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7"
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
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Перетащите карточку в нужную колонку или смените статус через «⋯».
            Новый статус сохраняется сразу, а срок подсвечивается красным, пока
            заказ не выдан.
          </p>
        </div>

        <button
          ref={createTriggerRef}
          type="button"
          onClick={openCreate}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
        >
          <span aria-hidden>+</span>
          Создать заказ
        </button>
      </div>

      <p aria-live="polite" className="mt-3 min-h-5 text-sm text-emerald-300">
        {notice}
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
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-zinc-500">
            <span>Заказов: {orders.length}</span>
            <span>В печати: {summary.inProgress}</span>
            <span>Сумма: {formatOrderCost(summary.totalCost)}</span>
            {summary.overdue > 0 ? (
              <span className="text-red-300">
                Просрочен срок: {summary.overdue}
              </span>
            ) : null}
          </p>

          <p className="mt-3 text-[11px] text-zinc-500 lg:hidden">
            Проведите пальцем в сторону, чтобы увидеть все этапы.
          </p>

          <p className="mt-1 text-[11px] text-zinc-500">
            Нажмите на карточку, чтобы открыть заказ и комментарии. Чтобы сменить
            статус, перетащите её в другую колонку или нажмите «⋯».
          </p>

          <div
            data-kanban-board
            className="mt-2 max-w-full overflow-x-auto overscroll-x-contain pb-2 lg:overflow-visible"
          >
            <div className="flex snap-x snap-mandatory gap-3 lg:grid lg:grid-cols-4 lg:gap-4">
              {STATUS_COLUMNS.map((column) => (
                <KanbanColumn
                  key={column.status}
                  column={column}
                  orders={groupedOrders[column.status]}
                  printerById={printerById}
                  pendingId={pendingId}
                  deletingId={deletingId}
                  draggingId={draggingId}
                  isDragOver={dragOverStatus === column.status}
                  onDragOverStatusChange={setDragOverStatus}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDropOrder={handleDropOrder}
                  onMoveOrder={(order, nextStatus) => {
                    void moveOrder(order, nextStatus);
                  }}
                  onDeleteOrder={(order) => {
                    void removeOrder(order);
                  }}
                  onOpenOrder={openDetails}
                  onCardClick={handleCardClick}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {isCreateOpen ? (
        <CreateOrderDialog
          printers={printers}
          filaments={filaments}
          products={products}
          clients={clients}
          onClose={closeCreate}
          onCreated={setNotice}
        />
      ) : null}

      {detailsOrder ? (
        <OrderDetailsDialog
          order={detailsOrder}
          clients={clients}
          filaments={filaments}
          products={products}
          onUpdated={setNotice}
          onClose={closeDetails}
        />
      ) : null}
    </section>
  );
}

type KanbanColumnProps = {
  column: StatusColumn;
  orders: WorkshopOrder[];
  printerById: Map<string, WorkshopPrinter>;
  pendingId: string | null;
  deletingId: string | null;
  draggingId: string | null;
  isDragOver: boolean;
  onDragOverStatusChange: (status: OrderFlowStatus | null) => void;
  onDragStart: (
    event: DragEvent<HTMLLIElement>,
    order: WorkshopOrder,
  ) => void;
  onDragEnd: () => void;
  onDropOrder: (orderId: string, status: OrderFlowStatus) => void;
  onMoveOrder: (order: WorkshopOrder, status: OrderFlowStatus) => void;
  onDeleteOrder: (order: WorkshopOrder) => void;
  onOpenOrder: (order: WorkshopOrder) => void;
  onCardClick: (
    event: ReactMouseEvent<HTMLLIElement>,
    order: WorkshopOrder,
  ) => void;
};

/**
 * Колонка статуса — одновременно зона приёма карточки.
 *
 * `onDragEnter` подсвечивает колонку, `onDragLeave` снимает подсветку только
 * когда курсор покинул её целиком: события всплывают от дочерних карточек, и без
 * проверки `relatedTarget` рамка мигала бы на каждом движении.
 */
function KanbanColumn({
  column,
  orders,
  printerById,
  pendingId,
  deletingId,
  draggingId,
  isDragOver,
  onDragOverStatusChange,
  onDragStart,
  onDragEnd,
  onDropOrder,
  onMoveOrder,
  onDeleteOrder,
  onOpenOrder,
  onCardClick,
}: KanbanColumnProps) {
  const headingId = `workshop-orders-column-${column.status}`;

  function handleDragEnter(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    onDragOverStatusChange(column.status);
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    const next = event.relatedTarget;

    if (next instanceof Node && event.currentTarget.contains(next)) {
      return;
    }

    if (isDragOver) {
      onDragOverStatusChange(null);
    }
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();

    const orderId =
      event.dataTransfer.getData(DRAG_MIME) ||
      event.dataTransfer.getData("text/plain");

    if (orderId) {
      onDropOrder(orderId, column.status);
      return;
    }

    onDragOverStatusChange(null);
  }

  return (
    <section
      aria-labelledby={headingId}
      data-kanban-column={column.status}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex w-[272px] shrink-0 snap-start flex-col rounded-2xl border p-3 transition-colors lg:w-auto lg:min-w-0 ${
        isDragOver
          ? "border-blue-400/60 bg-blue-500/10 ring-2 ring-blue-400/40"
          : "border-white/[0.07] bg-black/20"
      }`}
    >
      <header className="flex items-start justify-between gap-2 px-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_CLASS[column.status]}`}
            />
            <h3
              id={headingId}
              className="truncate text-sm font-semibold text-white"
            >
              {column.label}
            </h3>
          </div>
          <p className="mt-1 text-[11px] leading-none text-zinc-500">
            {column.hint}
          </p>
        </div>
        <span className="inline-flex min-w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[11px] font-bold text-zinc-300 tabular-nums">
          <span className="sr-only">Заказов: </span>
          {orders.length}
        </span>
      </header>

      <div aria-hidden className="mt-3 h-px bg-white/[0.06]" />

      <ul aria-label={`Заказы: ${column.label}`} className="mt-3 flex-1 space-y-2.5">
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            printer={
              order.printerId
                ? (printerById.get(order.printerId) ?? null)
                : null
            }
            isPending={pendingId === order.id}
            isDeleting={deletingId === order.id}
            isDragging={draggingId === order.id}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onMoveOrder={onMoveOrder}
            onDelete={onDeleteOrder}
            onOpen={onOpenOrder}
            onClick={onCardClick}
          />
        ))}

        {orders.length === 0 ? (
          <li className="flex min-h-36 flex-1 items-center justify-center rounded-xl border border-dashed border-white/10 px-4 py-6 text-center">
            <span className="text-xs leading-relaxed text-zinc-600">
              {isDragOver
                ? "Отпустите карточку здесь"
                : "Перетащите заказ сюда или смените статус через «⋯»"}
            </span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}

type OrderCardProps = {
  order: WorkshopOrder;
  printer: WorkshopPrinter | null;
  isPending: boolean;
  /** Заказ удаляется: карточка блокируется так же, как при смене статуса. */
  isDeleting: boolean;
  isDragging: boolean;
  onDragStart: (
    event: DragEvent<HTMLLIElement>,
    order: WorkshopOrder,
  ) => void;
  onDragEnd: () => void;
  onMoveOrder: (order: WorkshopOrder, status: OrderFlowStatus) => void;
  onDelete: (order: WorkshopOrder) => void;
  onOpen: (order: WorkshopOrder) => void;
  onClick: (
    event: ReactMouseEvent<HTMLLIElement>,
    order: WorkshopOrder,
  ) => void;
};

/**
 * Карточка заказа.
 *
 * `draggable` выключен на время записи, чтобы два действия не отправились
 * одновременно. Кнопка «⋯» ведёт себя как обычный элемент вне drag: она не
 * начинает перетаскивание и открывает меню смены статуса.
 *
 * Клик по карточке открывает `OrderDetailsDialog`, а перетаскивание остаётся
 * прежним: drag начинается с зажатой мыши, click после него не приходит.
 * Заголовок — отдельная кнопка: открыть заказ можно и с клавиатуры.
 */
function OrderCard({
  order,
  printer,
  isPending,
  isDeleting,
  isDragging,
  onDragStart,
  onDragEnd,
  onMoveOrder,
  onDelete,
  onOpen,
  onClick,
}: OrderCardProps) {
  const isOverdue = isOrderOverdue(order);
  const isBusy = isPending || isDeleting;

  return (
    <li
      draggable={!isBusy}
      aria-busy={isBusy}
      data-order-id={order.id}
      data-order-status={order.status}
      data-order-card
      onClick={(event) => onClick(event, order)}
      onDragStart={(event) => onDragStart(event, order)}
      onDragEnd={onDragEnd}
      className={`group relative rounded-xl border border-white/[0.08] bg-[#0a0a0a] p-3 transition-[border-color,background-color,opacity] ${
        isBusy
          ? "cursor-wait opacity-60"
          : isDragging
            ? "cursor-grabbing opacity-40"
            : "cursor-pointer hover:border-white/20 hover:bg-white/[0.045]"
      }`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <h4 className="min-w-0 text-base leading-snug font-bold tracking-tight break-words text-white">
          <button
            type="button"
            draggable={false}
            data-order-open={order.id}
            onClick={() => onOpen(order)}
            className="text-left transition-colors hover:text-blue-200 focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {order.title}
          </button>
        </h4>
        <StatusMenu
          order={order}
          isPending={isPending}
          isDeleting={isDeleting}
          onSelect={(nextStatus) => onMoveOrder(order, nextStatus)}
          onDelete={() => onDelete(order)}
        />
      </div>

      <p className="mt-1 truncate text-xs text-zinc-400">
        {order.clientName ?? "Клиент не указан"}
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-2.5 py-2">
        <div className="min-w-0">
          <dt className="text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">
            Стоимость
          </dt>
          <dd className="mt-0.5 truncate text-[13px] font-semibold text-white tabular-nums">
            {formatOrderCost(order.totalCost)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">
            Печать
          </dt>
          <dd className="mt-0.5 truncate text-[13px] font-semibold text-zinc-200 tabular-nums">
            {formatOrderHours(order.printTimeHours)}
          </dd>
        </div>
      </dl>

      <div className="mt-2.5 text-[11px]">
        {isOverdue ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-red-400/35 bg-red-500/10 px-2 py-0.5 font-semibold text-red-200">
            <span aria-hidden>!</span>
            Просрочен · {formatOrderDate(order.deadline)}
          </span>
        ) : order.deadline ? (
          <span className="text-zinc-500">
            Срок:{" "}
            <span className="font-medium text-zinc-300">
              {formatOrderDate(order.deadline)}
            </span>
          </span>
        ) : (
          <span className="text-zinc-600">Без срока</span>
        )}
      </div>

      {order.printerId ? (
        <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[11px] text-zinc-400">
          <PrinterIcon className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          <span className="truncate">
            {printer ? printer.name : "Принтер удалён"}
          </span>
        </div>
      ) : null}

      {isBusy ? (
        <p className="mt-2 text-[10px] font-semibold text-blue-300">
          {isDeleting ? "Удаляем…" : "Сохраняем статус…"}
        </p>
      ) : null}
    </li>
  );
}

type MenuPosition = {
  top?: number;
  bottom?: number;
  right: number;
};

/**
 * Меню действий с заказом для мобильных и клавиатуры.
 *
 * Панель рендерится в портал с `position: fixed`: доска прокручивается по
 * горизонтали, и обычное абсолютное меню обрезалось бы её краем. При открытии
 * фокус переходит на первый доступный статус, Escape возвращает его на «⋯».
 * Текущий статус показан, но выключен — повторять его бессмысленно. Удаление
 * стоит отдельной красной строкой под разделителем: его не спутать со сменой
 * статуса, а подтверждение спрашивает само действие на доске.
 */
function StatusMenu({
  order,
  isPending,
  isDeleting,
  onSelect,
  onDelete,
}: {
  order: WorkshopOrder;
  isPending: boolean;
  isDeleting: boolean;
  onSelect: (status: OrderFlowStatus) => void;
  onDelete: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = `order-status-menu-${order.id}`;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLButtonElement>("button:not([disabled])")
        ?.focus();
    });

    function handlePointerDown(event: PointerEvent) {
      if (!(event.target instanceof Node)) {
        return;
      }

      if (
        !menuRef.current?.contains(event.target) &&
        !triggerRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
        setPosition(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      setIsOpen(false);
      setPosition(null);
      triggerRef.current?.focus();
    }

    function handleViewportChange() {
      setIsOpen(false);
      setPosition(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [isOpen]);

  function toggleMenu() {
    if (isOpen) {
      setIsOpen(false);
      setPosition(null);
      return;
    }

    const rect = triggerRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const right = Math.max(8, window.innerWidth - rect.right);
    const openUp = window.innerHeight - rect.bottom < 220;

    setPosition(
      openUp
        ? { bottom: window.innerHeight - rect.top + 6, right }
        : { top: rect.bottom + 6, right },
    );
    setIsOpen(true);
  }

  function chooseStatus(nextStatus: OrderFlowStatus) {
    setIsOpen(false);
    setPosition(null);
    triggerRef.current?.focus();
    onSelect(nextStatus);
  }

  /** Удаление — отдельная строка меню: оно не меняет статус, а стирает заказ. */
  function chooseDelete() {
    setIsOpen(false);
    setPosition(null);
    triggerRef.current?.focus();
    onDelete();
  }

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        draggable={false}
        disabled={isPending || isDeleting}
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label={`Действия с заказом «${order.title}»`}
        title="Действия с заказом"
        onClick={toggleMenu}
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-base leading-none text-zinc-300 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-wait disabled:opacity-50"
      >
        <span aria-hidden>⋯</span>
      </button>

      {isOpen && position
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              style={{
                top: position.top,
                bottom: position.bottom,
                right: position.right,
              }}
              className="fixed z-[70] w-48 rounded-xl border border-white/10 bg-[#111111] p-1.5 shadow-2xl shadow-black/70"
            >
              <p className="px-2.5 pt-1 pb-1.5 text-[10px] font-semibold tracking-[0.12em] text-zinc-500 uppercase">
                Новый статус
              </p>
              <ul aria-label="Статусы заказа" className="space-y-0.5">
                {ORDER_STATUS_SEQUENCE.map((status) => {
                  const isCurrent = status === order.status;

                  return (
                    <li key={status}>
                      <button
                        type="button"
                        disabled={isCurrent}
                        aria-current={isCurrent ? "true" : undefined}
                        onClick={() => chooseStatus(status)}
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                          isCurrent
                            ? "cursor-default bg-white/[0.04] text-zinc-500"
                            : "text-zinc-200 hover:bg-white/[0.07] focus-visible:bg-white/[0.07]"
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT_CLASS[status]}`}
                        />
                        {ORDER_STATUS_META[status].label}
                        {isCurrent ? (
                          <span className="ml-auto text-[10px] text-zinc-600">
                            Текущий
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div aria-hidden className="my-1 h-px bg-white/[0.08]" />

              <button
                type="button"
                data-order-menu-delete
                onClick={chooseDelete}
                disabled={isPending || isDeleting}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/15 hover:text-red-200 focus-visible:bg-red-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70 disabled:cursor-wait disabled:opacity-50"
              >
                <TrashIcon className="h-3.5 w-3.5 shrink-0" />
                {isDeleting ? "Удаляем…" : "Удалить"}
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/** Пустой список заказов: объясняем, что даст первый заказ. */
function EmptyOrders({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-[#0a0a0a] px-5 py-8 text-center">
      <p aria-hidden className="text-3xl">
        🧾
      </p>
      <p className="mt-3 text-sm font-semibold text-white">Заказов пока нет</p>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-zinc-400">
        Создайте заказ — Мастерская посчитает его стоимость, спишет пластик с
        катушки и прибавит время печати к наработке принтера. Вес и время можно
        взять из G-code.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
      >
        Создать первый заказ
      </button>
    </div>
  );
}
