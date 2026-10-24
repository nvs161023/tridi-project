"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";

import {
  resetPrinterLubrication,
  resetPrinterNozzle,
} from "@/app/actions/printers";
import { AddPrinterDialog } from "@/components/workshop/AddPrinterDialog";
import {
  countMaintenanceDue,
  formatPrinterDate,
  formatPrinterHours,
  printerMaintenanceLevel,
  printerMaintenancePercent,
  type MaintenanceLevel,
  type WorkshopPrinter,
} from "@/lib/workshop/printers";

/**
 * Вкладка «Принтеры».
 *
 * Карточки показывают две наработки — сопло и смазку — полосками прогресса:
 * зелёная до 80 %, жёлтая 80–100 %, красная сверх интервала. У моделей с
 * интервалом смазки 0 вместо полоски стоит бейдж «Без смазки»: карбоновые
 * стержни Bambu Lab смазывать нельзя, их чистят спиртом. Поэтому и кнопки
 * «Смазать оси» у такой карточки нет — она предлагала бы испортить принтер.
 *
 * Список приходит с сервера, а после добавления и сброса счётчиков
 * обновляется через router.refresh(). Состояние вкладки — только открытое
 * окно, строка подтверждения и то, какой счётчик сейчас сбрасывается.
 */

type WorkshopPrintersTabProps = {
  printers: WorkshopPrinter[];
  /** В базе нет таблицы workshop_printers — миграция не применена. */
  isMissingTable: boolean;
};

type MaintenanceCounter = "nozzle" | "lubrication";

/** Цвет полоски и подписи по уровню обслуживания. */
const LEVEL_STYLES: Record<
  MaintenanceLevel,
  { bar: string; text: string; label: string }
> = {
  ok: { bar: "bg-emerald-400", text: "text-emerald-300", label: "В норме" },
  due: { bar: "bg-amber-400", text: "text-amber-300", label: "Пора обслужить" },
  overdue: { bar: "bg-red-400", text: "text-red-300", label: "Просрочено" },
};

/** Процент с запятой: «79,8 %» вместо машинного «79.8 %». */
const percentFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 1,
});

export function WorkshopPrintersTab({
  printers,
  isMissingTable,
}: WorkshopPrintersTabProps) {
  const router = useRouter();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    id: string;
    counter: MaintenanceCounter;
  } | null>(null);
  const addTriggerRef = useRef<HTMLButtonElement>(null);

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

  /** Сброс счётчика: ответ сервера решает, показать сообщение или ошибку. */
  async function handleReset(
    printer: WorkshopPrinter,
    counter: MaintenanceCounter,
  ) {
    setStatus(null);
    setError(null);
    setPending({ id: printer.id, counter });

    const result =
      counter === "nozzle"
        ? await resetPrinterNozzle(printer.id)
        : await resetPrinterLubrication(printer.id);

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
      className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md sm:p-7"
    >
      {isMissingTable ? (
        <p
          role="status"
          className="mb-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100"
        >
          <span aria-hidden>⚠️ </span>
          Принтеры пока не сохраняются: в базе нет таблицы workshop_printers.
          Добавлять их можно после миграции
          supabase/workshop_printers_orders.sql.
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
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
            Наработка сопла и смазки видна сразу: зелёная полоска — всё в
            порядке, жёлтая — пора готовиться, красная — обслуживание
            просрочено.
          </p>
        </div>

        <button
          ref={addTriggerRef}
          type="button"
          onClick={openAdd}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <span aria-hidden>+</span>
          Добавить принтер
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

      {printers.length === 0 ? (
        <EmptyPrinters onAdd={openAdd} />
      ) : (
        <>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-400">
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
    </section>
  );
}

/** Карточка принтера: наработки, обслуживание и кнопки сброса. */
function PrinterCard({
  printer,
  pendingCounter,
  onReset,
}: {
  printer: WorkshopPrinter;
  /** Какой счётчик этой карточки сейчас сбрасывается. */
  pendingCounter: MaintenanceCounter | null;
  onReset: (printer: WorkshopPrinter, counter: MaintenanceCounter) => void;
}) {
  const isBusy = pendingCounter !== null;
  const model = [printer.brand, printer.model].filter(Boolean).join(" ");

  return (
    <li className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold text-white">{printer.name}</p>
          <p className="mt-0.5 text-xs text-slate-300">
            {model || "Модель не указана"}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-slate-200">
          {formatPrinterHours(printer.totalHours)} всего
        </span>
      </div>

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
              <span className="font-semibold text-slate-200">Смазка</span>
              <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-bold tracking-wide text-slate-300 uppercase">
                Без смазки
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Смазка не требуется: карбоновые стержни чистят спиртом — смазка
              их портит.
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <p className="text-xs text-slate-400">
          Обслуживание: {formatPrinterDate(printer.lastMaintenanceDate)}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onReset(printer, "nozzle")}
            disabled={isBusy}
            aria-busy={pendingCounter === "nozzle"}
            aria-label={`Заменить сопло: ${printer.name}`}
            className="inline-flex min-h-9 items-center justify-center rounded-full border border-white/15 px-3.5 text-xs font-semibold text-slate-200 transition-colors hover:border-blue-400/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/15 disabled:hover:text-slate-200"
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
              className="inline-flex min-h-9 items-center justify-center rounded-full border border-white/15 px-3.5 text-xs font-semibold text-slate-200 transition-colors hover:border-blue-400/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/15 disabled:hover:text-slate-200"
            >
              {pendingCounter === "lubrication" ? "Сбрасываем…" : "Смазать оси"}
            </button>
          ) : null}
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
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="text-xs font-semibold text-slate-200">{label}</span>
        <span className="text-xs tabular-nums text-slate-300">
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
        className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/10"
      >
        <div
          className={`h-full rounded-full transition-[width] ${styles.bar}`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <p className={`mt-1.5 text-[11px] ${styles.text}`}>
        {percentFormatter.format(percent)} % · {styles.label}
      </p>
    </div>
  );
}

/** Пустой парк принтеров: объясняем, что даст первый принтер. */
function EmptyPrinters({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-white/15 bg-slate-950/40 px-5 py-8 text-center">
      <p aria-hidden className="text-3xl">
        🖨️
      </p>
      <p className="mt-3 text-sm font-semibold text-white">Принтеров пока нет</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-300">
        Добавьте принтер — Мастерская будет считать его наработку по заказам и
        напомнит, когда пора менять сопло или смазывать оси. Интервалы
        обслуживания подставятся из справочника моделей.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full border border-white/20 px-5 text-sm font-semibold text-slate-100 transition-colors hover:border-blue-400/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        Добавить первый принтер
      </button>
    </div>
  );
}
