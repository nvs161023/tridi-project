"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  resetPrinterLubrication,
  resetPrinterNozzle,
  resetPrinterZScrew,
} from "@/app/actions/printers";
import { AddPrinterDialog } from "@/components/workshop/AddPrinterDialog";
import { DiscoverPrintersDialog } from "@/components/workshop/DiscoverPrintersDialog";
import { RadarIcon } from "@/components/workshop/WorkshopIcons";
import { createClient } from "@/lib/supabase/client";
import {
  countMaintenanceDue,
  formatPrinterDate,
  formatPrinterHours,
  formatPrinterRemaining,
  printerMaintenanceLevel,
  printerMaintenancePercent,
  resolvePrinterLiveStatus,
  type DiscoveredPrinter,
  type MaintenanceLevel,
  type PrinterActiveJobs,
  type PrinterFarmStatus,
  type WorkshopPrinter,
} from "@/lib/workshop/printers";

/**
 * Вкладка «Принтеры».
 *
 * Карточки показывают три наработки — сопло, смазку осей и винт Z — полосками
 * прогресса: зелёная до 80 %, жёлтая 80–100 %, красная сверх интервала. У
 * моделей с интервалом смазки 0 вместо полоски стоит бейдж «Без смазки»:
 * карбоновые стержни Bambu Lab смазывать нельзя, их чистят спиртом. Поэтому и
 * кнопки «Смазать оси» у такой карточки нет — она предлагала бы испортить
 * принтер. Винт Z смазывается почти всегда, поэтому у него своя кнопка.
 *
 * Верх карточки — живое состояние от агента фермы: метка «Свободен», «Печатает»,
 * «Пауза», «Ошибка» или «Офлайн», полоска прогресса печати с остатком времени и
 * название заказа из связи `workshop_print_jobs`. Если агент уже отчитывался и
 * молчит дольше двух минут (`PRINTER_OFFLINE_AFTER_MS`), карточка показывает
 * «Офлайн», даже когда в базе застрял `printing`: иначе застывший прогресс
 * выглядел бы как работа.
 *
 * Список приходит с сервера, а обновляется через router.refresh(): после
 * добавления и сброса счётчиков — сразу, после изменений агента — по подписке
 * Realtime на `workshop_printers` и `workshop_print_jobs`. Состояние вкладки —
 * только открытое окно, строка подтверждения, часы для «офлайн» и то, какой
 * счётчик сейчас сбрасывается.
 *
 * Кнопка «Найти принтеры в сети» открывает «Мастер подключения фермы». Браузер
 * локальную сеть не видит, поэтому окно сначала просит агента её просканировать
 * (`requestNetworkScan` ставит флаг в `workshop_settings`), а находки из
 * `workshop_discovered_printers` показывает по мере поступления. Мастер отмечает
 * нужные, даёт имена и переносит их в парк через `approveDiscoveredPrinters`.
 * После успеха окно закрывается, страница обновляется, а над вкладкой на
 * несколько секунд всплывает тост «Успешно добавлено N принтеров».
 */

type WorkshopPrintersTabProps = {
  printers: WorkshopPrinter[];
  /** Названия заказов, которые печатаются сейчас: `printer_id` → title. */
  activeJobs: PrinterActiveJobs;
  /** Находки агента фермы, которым мастер ещё не дал имена. */
  discoveredPrinters: DiscoveredPrinter[];
  /** В базе нет таблицы workshop_printers — миграция не применена. */
  isMissingTable: boolean;
  /** Нет таблицы workshop_discovered_printers — не применён workshop_farm_and_shop.sql. */
  isDiscoveredMissingTable: boolean;
};

type MaintenanceCounter = "nozzle" | "lubrication" | "zScrew";

/**
 * Пауза перед refresh() после события Realtime.
 *
 * Агент фермы обновляет прогресс каждые несколько секунд и пачкой по всем
 * принтерам: без склейки страница перерисовывалась бы на каждую строку. Таймер
 * перезапускается на каждом событии, refresh выполняется один раз — как на
 * доске заказов (`WorkshopOrdersTab`).
 */
const REALTIME_REFRESH_DELAY_MS = 250;

/** Как часто пересчитывать «офлайн» по last_seen_at без событий. */
const LIVE_TICK_MS = 30 * 1000;

/**
 * Сколько висит тост «Успешно добавлено N принтеров».
 *
 * Как у тоста печати в карточке заказа: четыре секунды хватает, чтобы прочитать
 * строку, и он не мешает дальше. Сообщение при этом дублируется в `aria-live`:
 * тост исчезает сам, а строка состояния вкладки остаётся.
 */
const TOAST_TIMEOUT_MS = 4000;

/** Цвет полоски и подписи по уровню обслуживания. */
const LEVEL_STYLES: Record<
  MaintenanceLevel,
  { bar: string; text: string; label: string }
> = {
  ok: { bar: "bg-emerald-400", text: "text-emerald-300", label: "В норме" },
  due: { bar: "bg-amber-400", text: "text-amber-300", label: "Пора обслужить" },
  overdue: { bar: "bg-red-400", text: "text-red-300", label: "Просрочено" },
};

/**
 * Метка состояния принтера и цвет полоски печати.
 *
 * «Свободен» — зелёный, «Печатает» — синий, «Пауза» — жёлтый, «Ошибка» —
 * красный, «Офлайн» — серый: тот же язык, что у обслуживания, но отдельные
 * цвета, чтобы статус не путался с износом.
 */
const STATE_STYLES: Record<
  PrinterFarmStatus,
  { label: string; badge: string; dot: string; bar: string }
> = {
  idle: {
    label: "Свободен",
    badge: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
    dot: "bg-emerald-400",
    bar: "bg-emerald-400",
  },
  printing: {
    label: "Печатает",
    badge: "border-blue-400/40 bg-blue-500/15 text-blue-100",
    dot: "bg-blue-400",
    bar: "bg-blue-400",
  },
  paused: {
    label: "Пауза",
    badge: "border-amber-400/40 bg-amber-500/10 text-amber-100",
    dot: "bg-amber-400",
    bar: "bg-amber-400",
  },
  error: {
    label: "Ошибка",
    badge: "border-red-400/40 bg-red-500/10 text-red-100",
    dot: "bg-red-400",
    bar: "bg-red-400",
  },
  offline: {
    label: "Офлайн",
    badge: "border-white/10 bg-white/[0.04] text-zinc-400",
    dot: "bg-zinc-500",
    bar: "bg-zinc-500",
  },
};

/** Процент с запятой: «79,8 %» вместо машинного «79.8 %». */
const percentFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 1,
});

/** Прогресс печати целым числом: 42 % — без десятых, их даёт только износ. */
const progressFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

/** Белая кнопка главного действия — как «Рассчитать» в калькуляторе. */
const primaryActionClassName =
  "inline-flex min-h-9 items-center justify-center rounded-lg bg-white px-3.5 text-xs font-bold text-black transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-40";

/** Тёмная кнопка с обводкой — как «Сохранить» в калькуляторе. */
const secondaryActionClassName =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] px-3.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-40";

export function WorkshopPrintersTab({
  printers,
  activeJobs,
  discoveredPrinters,
  isMissingTable,
  isDiscoveredMissingTable,
}: WorkshopPrintersTabProps) {
  const router = useRouter();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDiscoverOpen, setIsDiscoverOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    id: string;
    counter: MaintenanceCounter;
  } | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const addTriggerRef = useRef<HTMLButtonElement>(null);
  const discoverTriggerRef = useRef<HTMLButtonElement>(null);

  /**
   * Часы карточки для правила «молчит дольше двух минут — офлайн».
   *
   * Время ставится после монтирования, а не при рендере: сервер и браузер
   * считают его по-разному, и разметка SSR разошлась бы с гидратацией. Дальше
   * тикер раз в LIVE_TICK_MS двигает часы, чтобы метка «Офлайн» появлялась даже
   * когда агент пропал и событий Realtime нет.
   */
  useEffect(() => {
    const tick = () => setNow(Date.now());

    tick();

    const timer = setInterval(tick, LIVE_TICK_MS);

    return () => clearInterval(timer);
  }, []);

  /**
   * Realtime: прогресс печати пишет агент фермы, а не эта вкладка.
   *
   * Страница собрана на сервере, и в `WorkshopPrinter` уже лежат склеенные
   * данные: статус, остаток и название заказа через `workshop_print_jobs`.
   * Собрать то же из строки события нельзя, поэтому обработчик ничего не
   * патчит в стейте, а вызывает `router.refresh()`: страница перечитывает парк
   * тем же `getWorkshopPrinters()`, что и при загрузке. Так же поступают
   * `WorkshopOrdersTab` и кнопки сброса счётчиков.
   *
   * Слушаем две таблицы: `workshop_printers` (статус, прогресс, остаток) и
   * `workshop_print_jobs` (какой заказ печатается). Всплеск событий
   * схлопывается в один refresh через REALTIME_REFRESH_DELAY_MS.
   *
   * Без миграции и без ключей Supabase вкладка работает как раньше: изменения
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
      // Принтеры от этого не пропадают: они пришли с сервера.
      console.warn("Realtime принтеров недоступен:", cause);

      return;
    }

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer !== null) {
        clearTimeout(refreshTimer);
      }

      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        router.refresh();
      }, REALTIME_REFRESH_DELAY_MS);
    };

    const channel = supabase
      .channel("realtime-printers")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workshop_printers" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workshop_print_jobs" },
        scheduleRefresh,
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

  const summary = useMemo(() => {
    const dueNodes = printers.reduce(
      (sum, printer) => sum + countMaintenanceDue(printer),
      0,
    );

    return {
      totalHours: printers.reduce(
        (sum, printer) => sum + printer.totalHours,
        0,
      ),
      dueNodes,
      duePrinters: printers.filter(
        (printer) => countMaintenanceDue(printer) > 0,
      ).length,
    };
  }, [printers]);

  const openAdd = useCallback(() => {
    setStatus(null);
    setError(null);
    setIsAddOpen(true);
  }, []);

  const closeAdd = useCallback(() => {
    setIsAddOpen(false);
    addTriggerRef.current?.focus();
  }, []);

  /**
   * Тост гаснет сам: он не должен висеть поверх карточек, пока мастер работает
   * с парком. Таймер перезапускается на новом сообщении — повторное добавление
   * снова показывает строку на четыре секунды.
   */
  useEffect(() => {
    if (toast === null) {
      return;
    }

    const timer = setTimeout(() => setToast(null), TOAST_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [toast]);

  /**
   * Мастер подключения фермы открывается кнопкой и сразу просит страницу
   * перечитать находки: агент сканирует сеть при старте, и с прошлой загрузки
   * список мог измениться. Открытому окну refresh не мешает — выбор и имена
   * живут в его состоянии поверх данных с сервера.
   */
  const openDiscover = useCallback(() => {
    setStatus(null);
    setError(null);
    setIsDiscoverOpen(true);
    router.refresh();
  }, [router]);

  const closeDiscover = useCallback(() => {
    setIsDiscoverOpen(false);
    discoverTriggerRef.current?.focus();
  }, []);

  /**
   * Подтверждение прошло: окно закрывается, тост всплывает, а та же строка
   * остаётся в `aria-live` вкладки — тост исчезнет, сообщение нет. Страницу
   * уже обновил сам мастер, поэтому здесь только показываем результат.
   */
  const handleApproved = useCallback((message: string) => {
    setToast(message);
    setStatus(message);
    setIsDiscoverOpen(false);
    discoverTriggerRef.current?.focus();
  }, []);

  /** Сброс счётчика: ответ сервера решает, показать сообщение или ошибку. */
  async function handleReset(
    printer: WorkshopPrinter,
    counter: MaintenanceCounter,
  ) {
    setStatus(null);
    setError(null);
    setPending({ id: printer.id, counter });

    const reset = {
      nozzle: resetPrinterNozzle,
      lubrication: resetPrinterLubrication,
      zScrew: resetPrinterZScrew,
    }[counter];

    const result = await reset(printer.id);

    setPending(null);

    if (!result.ok) {
      setError(result.error ?? "Не удалось сбросить счётчик.");
      return;
    }

    setStatus(result.message ?? "Счётчик сброшен.");
    router.refresh();
  }

  return (
    <section
      aria-labelledby="workshop-printers-title"
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7"
    >
      {isMissingTable ? (
        <p
          role="status"
          className="mb-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100"
        >
          <span aria-hidden>⚠️ </span>
          Принтеры пока не сохраняются: в базе нет таблицы workshop_printers или
          колонок винта Z. Добавлять их можно после миграции
          supabase/workshop_printers_orders.sql; для уже созданной таблицы —
          supabase/workshop_printer_z_screw.sql.
        </p>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-blue-300 uppercase">
            Принтеры
          </p>
          <h2
            id="workshop-printers-title"
            className="mt-2 text-xl font-extrabold tracking-tight text-white"
          >
            Парк принтеров
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Наработка сопла, смазки осей и винта Z видна сразу: зелёная полоска
            — всё в порядке, жёлтая — пора готовиться, красная — обслуживание
            просрочено. Состояние печати обновляется само: прогресс, остаток
            времени и название заказа приходят от агента фермы.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            ref={discoverTriggerRef}
            type="button"
            onClick={openDiscover}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-4 text-sm font-bold text-white shadow-[0_10px_30px_-12px_rgba(59,130,246,0.8)] transition-colors hover:from-blue-400 hover:to-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            <RadarIcon className="h-4 w-4" />
            Найти принтеры в сети
            {discoveredPrinters.length > 0 ? (
              <span className="inline-flex min-w-5 items-center justify-center rounded-md bg-black/25 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                {discoveredPrinters.length}
              </span>
            ) : null}
          </button>

          <button
            ref={addTriggerRef}
            type="button"
            onClick={openAdd}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            <span aria-hidden>+</span>
            Добавить принтер
          </button>
        </div>
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

      {printers.length === 0 ? (
        <EmptyPrinters onAdd={openAdd} />
      ) : (
        <>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-zinc-500">
            <span>Принтеров: {printers.length}</span>
            <span>
              Общая наработка: {formatPrinterHours(summary.totalHours)}
            </span>
            {summary.dueNodes > 0 ? (
              <span className="text-amber-300">
                Требуют внимания: {summary.dueNodes} — принтеров с
                просрочкой: {summary.duePrinters}
              </span>
            ) : (
              <span className="text-emerald-300">Все узлы в норме</span>
            )}
          </p>

          <ul className="mt-4 grid gap-4 lg:grid-cols-2">
            {printers.map((printer) => (
              <PrinterCard
                key={printer.id}
                printer={printer}
                activeJobTitle={activeJobs[printer.id] ?? null}
                now={now}
                pendingCounter={
                  pending?.id === printer.id ? pending.counter : null
                }
                onReset={handleReset}
              />
            ))}
          </ul>
        </>
      )}

      {isAddOpen ? (
        <AddPrinterDialog onClose={closeAdd} onCreated={setStatus} />
      ) : null}

      {isDiscoverOpen ? (
        <DiscoverPrintersDialog
          printers={discoveredPrinters}
          isMissingTable={isDiscoveredMissingTable}
          onClose={closeDiscover}
          onApproved={handleApproved}
        />
      ) : null}

      {toast ? (
        <p
          role="status"
          data-printer-toast
          className="pointer-events-none fixed inset-x-4 bottom-6 z-[90] mx-auto max-w-sm rounded-xl border border-emerald-400/50 bg-emerald-500/20 px-4 py-3 text-center text-sm font-semibold text-emerald-50 shadow-2xl shadow-black/60 backdrop-blur"
        >
          {toast}
        </p>
      ) : null}
    </section>
  );
}

/** Карточка принтера: состояние печати, наработки, обслуживание и сбросы. */
function PrinterCard({
  printer,
  activeJobTitle,
  now,
  pendingCounter,
  onReset,
}: {
  printer: WorkshopPrinter;
  /** Название заказа, который печатается на этом принтере; null — печати нет. */
  activeJobTitle: string | null;
  /** Время для правила «долго молчит — офлайн»; null до монтирования. */
  now: number | null;
  /** Какой счётчик этой карточки сейчас сбрасывается. */
  pendingCounter: MaintenanceCounter | null;
  onReset: (printer: WorkshopPrinter, counter: MaintenanceCounter) => void;
}) {
  const isBusy = pendingCounter !== null;
  const model = [printer.brand, printer.model].filter(Boolean).join(" ");
  const liveStatus = resolvePrinterLiveStatus(printer, now);
  const state = STATE_STYLES[liveStatus];
  const isPrinting = liveStatus === "printing";
  // Пауза с ненулевым прогрессом показывает полоску: видно, сколько уже
  // напечатано и с какого места продолжат.
  const showsProgress =
    isPrinting || (liveStatus === "paused" && printer.progress > 0);
  const progress = Math.min(100, Math.max(0, printer.progress));
  const progressText = progressFormatter.format(progress);
  const remaining = isPrinting
    ? formatPrinterRemaining(printer.remainingTime)
    : null;
  const currentOrderTitle = isPrinting ? activeJobTitle : null;

  return (
    <li
      data-printer-card
      className="rounded-2xl border border-white/5 bg-[#0a0a0a] p-5 shadow-[0_18px_50px_-36px_rgba(0,0,0,1)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold tracking-tight text-white">
            {printer.name}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {model || "Модель не указана"}
          </p>
        </div>
        <span className="shrink-0 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-zinc-300">
          {formatPrinterHours(printer.totalHours)} всего
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span
          data-printer-status={liveStatus}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold ${state.badge}`}
        >
          <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${state.dot}`} />
          {state.label}
        </span>
        {currentOrderTitle ? (
          <p
            data-printer-order
            className="min-w-0 text-xs leading-relaxed text-zinc-400"
          >
            Заказ:{" "}
            <span className="font-semibold text-white">{currentOrderTitle}</span>
          </p>
        ) : null}
      </div>

      {showsProgress ? (
        <div data-printer-print-progress className="mt-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-[11px]">
            <span className="font-semibold text-zinc-300">Печать</span>
            <span className="tabular-nums text-zinc-400">
              {progressText}%
              {remaining ? ` · Осталось: ${remaining}` : ""}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${progressText} %`}
            aria-label={`Печать на ${printer.name}: ${progressText} %`}
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/[0.08]"
          >
            <div
              className={`h-full rounded-full transition-[width] duration-700 ${state.bar}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        <MaintenanceGauge
          label="Сопло"
          hours={printer.nozzleHours}
          interval={printer.nozzleInterval}
        />

        {printer.lubricationInterval > 0 ? (
          <MaintenanceGauge
            label="Смазка"
            hours={printer.lubricationHours}
            interval={printer.lubricationInterval}
          />
        ) : (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-zinc-300">Смазка</span>
              <span className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold tracking-wide text-zinc-400 uppercase">
                Без смазки
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Смазка не требуется: карбоновые стержни чистят спиртом — смазка
              их портит.
            </p>
          </div>
        )}

        <MaintenanceGauge
          label="Винт Z"
          hours={printer.zScrewHours}
          interval={printer.zScrewInterval}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
        <p className="text-xs text-zinc-500">
          Обслуживание: {formatPrinterDate(printer.lastMaintenanceDate)}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onReset(printer, "nozzle")}
            disabled={isBusy}
            aria-busy={pendingCounter === "nozzle"}
            aria-label={`Заменить сопло: ${printer.name}`}
            className={primaryActionClassName}
          >
            {pendingCounter === "nozzle" ? "Сбрасываем…" : "Заменить сопло"}
          </button>

          {printer.lubricationInterval > 0 ? (
            <button
              type="button"
              onClick={() => onReset(printer, "lubrication")}
              disabled={isBusy}
              aria-busy={pendingCounter === "lubrication"}
              aria-label={`Смазать оси: ${printer.name}`}
              className={secondaryActionClassName}
            >
              {pendingCounter === "lubrication" ? "Сбрасываем…" : "Смазать оси"}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => onReset(printer, "zScrew")}
            disabled={isBusy}
            aria-busy={pendingCounter === "zScrew"}
            aria-label={`Смазать винт Z: ${printer.name}`}
            className={secondaryActionClassName}
          >
            {pendingCounter === "zScrew" ? "Сбрасываем…" : "Смазать винт Z"}
          </button>
        </div>
      </div>
    </li>
  );
}

/**
 * Полоска наработки узла.
 *
 * Ширина ограничена 100 %, но процент в подписи настоящий: при 125 % видно,
 * насколько просрочено обслуживание. Цвет задаёт уровень из
 * `printerMaintenanceLevel` — те же пороги 80 % и 100 %, что в описании.
 */
function MaintenanceGauge({
  label,
  hours,
  interval,
}: {
  label: string;
  hours: number;
  interval: number;
}) {
  const percent = printerMaintenancePercent(hours, interval);
  const level = printerMaintenanceLevel(hours, interval);

  if (percent === null || level === null) {
    return null;
  }

  const styles = LEVEL_STYLES[level];

  return (
    <div data-printer-gauge={label}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="text-xs font-semibold text-zinc-300">{label}</span>
        <span className="text-[11px] tabular-nums text-zinc-500">
          {formatPrinterHours(hours)} / {formatPrinterHours(interval)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={Math.min(100, percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${percentFormatter.format(percent)} %`}
        aria-label={`${label}: ${percentFormatter.format(percent)} % ресурса`}
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${styles.bar}`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <p className={`mt-1.5 flex flex-wrap gap-x-1.5 text-[11px] ${styles.text}`}>
        <span>{percentFormatter.format(percent)}% до замены</span>
        <span className="text-zinc-500">· {styles.label}</span>
      </p>
    </div>
  );
}

/** Пустой парк принтеров: объясняем, что даст первый принтер. */
function EmptyPrinters({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-[#0a0a0a] px-5 py-8 text-center">
      <p aria-hidden className="text-3xl">
        🖨️
      </p>
      <p className="mt-3 text-sm font-semibold text-white">Принтеров пока нет</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
        Добавьте принтер — Мастерская будет считать его наработку по заказам и
        напомнит, когда пора менять сопло, смазывать оси или винт Z. Интервалы
        обслуживания подставятся из справочника моделей.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
      >
        Добавить первый принтер
      </button>
    </div>
  );
}
