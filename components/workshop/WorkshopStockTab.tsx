"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { AddFilamentDialog } from "@/components/workshop/AddFilamentDialog";
import { ConsumeFilamentDialog } from "@/components/workshop/ConsumeFilamentDialog";
import {
  filamentRemainingPercent,
  formatGrams,
  isLowStockFilament,
  type WorkshopFilament,
} from "@/lib/workshop/filaments";

/**
 * Вкладка «Склад».
 *
 * Список приходит с сервера, а после добавления и списания обновляется через
 * router.refresh() — поэтому здесь нет второго источника правды и склад не
 * расходится с базой. Состояние вкладки — только открытые окна и строка
 * подтверждения.
 *
 * Окон два: «Добавить катушку» и «Списать N грамм». Они монтируются по условию:
 * так состояние их форм сбрасывается при каждом открытии, и старая ошибка не
 * висит над новым вводом. Фокус после закрытия возвращается на кнопку, которая
 * открыла окно.
 *
 * Таблица на широком экране и карточки на узком — одна и та же информация.
 * Скрытая копия не рендерится: `hidden md:block` и `md:hidden`, а не два
 * обработчика на одних и тех же данных.
 */

type WorkshopStockTabProps = {
  filaments: WorkshopFilament[];
  /** В базе нет таблицы workshop_filaments — миграция не применена. */
  isMissingTable: boolean;
};

export function WorkshopStockTab({
  filaments,
  isMissingTable,
}: WorkshopStockTabProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [consumeTarget, setConsumeTarget] = useState<WorkshopFilament | null>(
    null,
  );
  const [status, setStatus] = useState<string | null>(null);
  const addTriggerRef = useRef<HTMLButtonElement>(null);
  const consumeTriggerRef = useRef<HTMLButtonElement>(null);

  const summary = useMemo(() => {
    const totalRemainingG = filaments.reduce(
      (sum, filament) => sum + filament.remainingWeightG,
      0,
    );

    return {
      totalRemainingG,
      lowCount: filaments.filter(isLowStockFilament).length,
    };
  }, [filaments]);

  const openAdd = useCallback(() => {
    setStatus(null);
    setIsAddOpen(true);
  }, []);

  const closeAdd = useCallback(() => {
    setIsAddOpen(false);
    addTriggerRef.current?.focus();
  }, []);

  const openConsume = useCallback(
    (filament: WorkshopFilament, trigger: HTMLButtonElement) => {
      consumeTriggerRef.current = trigger;
      setStatus(null);
      setConsumeTarget(filament);
    },
    [],
  );

  const closeConsume = useCallback(() => {
    setConsumeTarget(null);
    consumeTriggerRef.current?.focus();
  }, []);

  return (
    <section
      aria-labelledby="workshop-stock-title"
      className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md sm:p-7"
    >
      {isMissingTable ? (
        <p
          role="status"
          className="mb-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100"
        >
          <span aria-hidden>⚠️ </span>
          Склад пока не сохраняется: в базе нет таблицы workshop_filaments.
          Добавлять катушки можно после миграции
          supabase/workshop_filaments.sql.
        </p>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-blue-300 uppercase">
            Склад
          </p>
          <h2
            id="workshop-stock-title"
            className="mt-2 text-xl font-extrabold tracking-tight text-white"
          >
            Катушки пластика
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
            Остатки по катушкам: когда пластик подходит к концу, строка
            становится красной, а ссылка на товар — кнопкой «Купить».
          </p>
        </div>

        <button
          ref={addTriggerRef}
          type="button"
          onClick={openAdd}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <span aria-hidden>+</span>
          Добавить катушку
        </button>
      </div>

      <p aria-live="polite" className="mt-3 min-h-5 text-sm text-emerald-300">
        {status}
      </p>

      {filaments.length === 0 ? (
        <EmptyStock onAdd={openAdd} />
      ) : (
        <>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-400">
            <span>Катушек: {filaments.length}</span>
            <span>Остаток: {formatGrams(summary.totalRemainingG)}</span>
            {summary.lowCount > 0 ? (
              <span className="text-red-300">
                Пора покупать: {summary.lowCount}
              </span>
            ) : null}
          </p>

          <StockTable filaments={filaments} onConsume={openConsume} />
          <StockCards filaments={filaments} onConsume={openConsume} />
        </>
      )}

      {isAddOpen ? (
        <AddFilamentDialog onClose={closeAdd} onCreated={setStatus} />
      ) : null}

      {consumeTarget ? (
        <ConsumeFilamentDialog
          filament={consumeTarget}
          onClose={closeConsume}
          onConsumed={setStatus}
        />
      ) : null}
    </section>
  );
}

/** Таблица склада: на узком экране её заменяют карточки. */
function StockTable({
  filaments,
  onConsume,
}: {
  filaments: WorkshopFilament[];
  onConsume: (filament: WorkshopFilament, trigger: HTMLButtonElement) => void;
}) {
  return (
    <div className="mt-3 hidden overflow-x-auto md:block">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Катушки пластика: бренд, тип, цвет, остаток, порог и ссылка на товар
        </caption>
        <thead>
          <tr className="border-b border-white/10 text-left text-xs font-semibold tracking-wide text-slate-400 uppercase">
            <th scope="col" className="px-3 py-3">
              Бренд
            </th>
            <th scope="col" className="px-3 py-3">
              Тип
            </th>
            <th scope="col" className="px-3 py-3">
              Цвет
            </th>
            <th scope="col" className="px-3 py-3">
              Остаток (г)
            </th>
            <th scope="col" className="px-3 py-3">
              Порог (г)
            </th>
            <th scope="col" className="px-3 py-3">
              Ссылка
            </th>
            <th scope="col" className="px-3 py-3">
              <span className="sr-only">Действия</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {filaments.map((filament) => {
            const isLow = isLowStockFilament(filament);

            return (
              <tr
                key={filament.id}
                className={`border-b border-white/5 align-top last:border-b-0 ${
                  isLow ? "bg-red-500/10" : ""
                }`}
              >
                <td className="px-3 py-4 font-semibold text-white">
                  {filament.brand || "—"}
                  {isLow ? (
                    <span className="mt-1 block text-[11px] font-bold tracking-wide text-red-300 uppercase">
                      Пора купить
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-4 text-slate-200">
                  {filament.type || "—"}
                </td>
                <td className="px-3 py-4 text-slate-300">
                  {filament.color || "—"}
                </td>
                <td className="px-3 py-4">
                  <span
                    className={`font-semibold tabular-nums ${
                      isLow ? "text-red-200" : "text-white"
                    }`}
                  >
                    {formatGrams(filament.remainingWeightG)}
                  </span>
                  <RemainingBar filament={filament} isLow={isLow} />
                </td>
                <td className="px-3 py-4 tabular-nums text-slate-300">
                  {formatGrams(filament.minThresholdG)}
                </td>
                <td className="px-3 py-4">
                  <PurchaseLink filament={filament} isLow={isLow} />
                </td>
                <td className="px-3 py-4 text-right">
                  <ConsumeButton filament={filament} onOpen={onConsume} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Карточки склада: та же информация, но в одну колонку. */
function StockCards({
  filaments,
  onConsume,
}: {
  filaments: WorkshopFilament[];
  onConsume: (filament: WorkshopFilament, trigger: HTMLButtonElement) => void;
}) {
  return (
    <ul className="mt-4 grid gap-3 md:hidden">
      {filaments.map((filament) => {
        const isLow = isLowStockFilament(filament);

        return (
          <li
            key={filament.id}
            className={`rounded-2xl border p-4 ${
              isLow
                ? "border-red-400/40 bg-red-500/10"
                : "border-white/10 bg-slate-950/40"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">
                  {filament.brand || "Без бренда"}
                </p>
                <p className="mt-0.5 text-xs text-slate-300">
                  {filament.type || "—"} · {filament.color || "—"}
                </p>
              </div>
              {isLow ? (
                <span className="rounded-full border border-red-400/40 bg-red-500/15 px-2.5 py-1 text-[11px] font-bold tracking-wide text-red-200 uppercase">
                  Пора купить
                </span>
              ) : null}
            </div>

            <div className="mt-3">
              <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                Остаток (г)
              </p>
              <p
                className={`mt-0.5 text-lg font-extrabold tabular-nums ${
                  isLow ? "text-red-200" : "text-white"
                }`}
              >
                {formatGrams(filament.remainingWeightG)}
              </p>
              <p className="text-xs text-slate-400">
                из {formatGrams(filament.totalWeightG)} · порог{" "}
                {formatGrams(filament.minThresholdG)}
              </p>
              <RemainingBar filament={filament} isLow={isLow} />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <PurchaseLink filament={filament} isLow={isLow} />
              <ConsumeButton filament={filament} onOpen={onConsume} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Пустой склад: объясняем, что даст первая катушка. */
function EmptyStock({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-white/15 bg-slate-950/40 px-5 py-8 text-center">
      <p aria-hidden className="text-3xl">
        📦
      </p>
      <p className="mt-3 text-sm font-semibold text-white">Склад пока пуст</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-300">
        Добавьте катушку — увидите остаток, порог и ссылку на товар. Когда
        пластик закончится, Мастерская напомнит, что пора покупать.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full border border-white/20 px-5 text-sm font-semibold text-slate-100 transition-colors hover:border-blue-400/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        Добавить первую катушку
      </button>
    </div>
  );
}
/** Полоска остатка: процент от общего веса катушки. */
function RemainingBar({
  filament,
  isLow,
}: {
  filament: WorkshopFilament;
  isLow: boolean;
}) {
  const percent = filamentRemainingPercent(filament);

  return (
    <div className="mt-2 w-full max-w-[9rem]">
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Остаток ${formatGrams(filament.remainingWeightG)} из ${formatGrams(filament.totalWeightG)}`}
        className="h-2 w-full overflow-hidden rounded-full bg-white/10"
      >
        <div
          className={`h-full rounded-full ${isLow ? "bg-red-400" : "bg-emerald-400"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-slate-400">
        {percent} % от {formatGrams(filament.totalWeightG)}
      </p>
    </div>
  );
}

/** Ссылка на товар: у катушки ниже порога она становится кнопкой «Купить». */
function PurchaseLink({
  filament,
  isLow,
}: {
  filament: WorkshopFilament;
  isLow: boolean;
}) {
  if (!filament.purchaseUrl) {
    return <span className="text-sm text-slate-500">—</span>;
  }

  const className = isLow
    ? "inline-flex min-h-9 items-center justify-center rounded-full border border-red-400/40 bg-red-500/15 px-3.5 text-xs font-bold text-red-100 transition-colors hover:bg-red-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
    : "text-sm font-semibold text-blue-300 underline-offset-4 transition-colors hover:text-blue-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

  return (
    <a
      href={filament.purchaseUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {isLow ? "Купить" : "Магазин"}
      <span className="sr-only">
        {" "}
        — {filament.brand} {filament.type} {filament.color}
      </span>
    </a>
  );
}

/** Кнопка «Списать»: запоминает себя, чтобы вернуть фокус после закрытия окна. */
function ConsumeButton({
  filament,
  onOpen,
}: {
  filament: WorkshopFilament;
  onOpen: (filament: WorkshopFilament, trigger: HTMLButtonElement) => void;
}) {
  const isEmpty = filament.remainingWeightG <= 0;

  return (
    <button
      type="button"
      disabled={isEmpty}
      onClick={(event) => onOpen(filament, event.currentTarget)}
      aria-label={
        isEmpty
          ? `Катушка пуста: ${filament.brand} ${filament.type} ${filament.color}`
          : `Списать пластик: ${filament.brand} ${filament.type} ${filament.color}`
      }
      className="inline-flex min-h-9 items-center justify-center rounded-full border border-white/15 px-3.5 text-xs font-semibold text-slate-200 transition-colors hover:border-blue-400/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/15 disabled:hover:text-slate-200"
    >
      Списать
    </button>
  );
}
