"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";

import { deleteFilament } from "@/app/actions/filaments";
import { AddFilamentDialog } from "@/components/workshop/AddFilamentDialog";
import { ConsumeFilamentDialog } from "@/components/workshop/ConsumeFilamentDialog";
import { ImportStockFromPhotoDialog } from "@/components/workshop/ImportStockFromPhotoDialog";
import { OrderFilamentsDialog } from "@/components/workshop/OrderFilamentsDialog";
import {
  SpecificationIcon,
  TrashIcon,
} from "@/components/workshop/WorkshopIcons";
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
 * Окон четыре: «Добавить катушку», «Списать N грамм», «Импорт из фото» и
 * «Спецификация на закупку». Они
 * монтируются по условию: так состояние их форм сбрасывается при каждом
 * открытии, и старая ошибка не висит над новым вводом. Фокус после закрытия
 * возвращается на кнопку, которая открыла окно.
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

/**
 * Пора ли покупать пластик: сигналы закупки относятся только к складскому
 * запасу. Заказную катушку брали под конкретную задачу, поэтому её низкий
 * остаток не красит строку и не попадает в сводку — статус показывает бейдж
 * «Заказной».
 */
function needsPurchase(filament: WorkshopFilament): boolean {
  return filament.usageType === "stock" && isLowStockFilament(filament);
}

/**
 * Название катушки для подтверждения и `aria-label`: «Бренд Тип Цвет».
 *
 * Поля в базе обязательные, но старые строки могли сохраниться с пробелами,
 * поэтому пустые куски отбрасываются, как в окне добавления.
 */
function filamentLabel(filament: WorkshopFilament): string {
  const parts = [filament.brand, filament.type, filament.color]
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts.join(" ") : "Без названия";
}

export function WorkshopStockTab({
  filaments,
  isMissingTable,
}: WorkshopStockTabProps) {
  const router = useRouter();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isOrderOpen, setIsOrderOpen] = useState(false);
  const [consumeTarget, setConsumeTarget] = useState<WorkshopFilament | null>(
    null,
  );
  /** Катушка, которая удаляется: её корзина выключена до ответа сервера. */
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const addTriggerRef = useRef<HTMLButtonElement>(null);
  const importTriggerRef = useRef<HTMLButtonElement>(null);
  const orderTriggerRef = useRef<HTMLButtonElement>(null);
  const consumeTriggerRef = useRef<HTMLButtonElement>(null);

  const summary = useMemo(() => {
    const totalRemainingG = filaments.reduce(
      (sum, filament) => sum + filament.remainingWeightG,
      0,
    );

    return {
      totalRemainingG,
      lowCount: filaments.filter(needsPurchase).length,
    };
  }, [filaments]);

  const openAdd = useCallback(() => {
    setStatus(null);
    setError(null);
    setIsAddOpen(true);
  }, []);

  const closeAdd = useCallback(() => {
    setIsAddOpen(false);
    addTriggerRef.current?.focus();
  }, []);

  const openImport = useCallback(() => {
    setStatus(null);
    setError(null);
    setIsImportOpen(true);
  }, []);

  const closeImport = useCallback(() => {
    setIsImportOpen(false);
    importTriggerRef.current?.focus();
  }, []);

  const openOrder = useCallback(() => {
    setStatus(null);
    setError(null);
    setIsOrderOpen(true);
  }, []);

  const closeOrder = useCallback(() => {
    setIsOrderOpen(false);
    orderTriggerRef.current?.focus();
  }, []);

  const openConsume = useCallback(
    (filament: WorkshopFilament, trigger: HTMLButtonElement) => {
      consumeTriggerRef.current = trigger;
      setStatus(null);
      setError(null);
      setConsumeTarget(filament);
    },
    [],
  );

  const closeConsume = useCallback(() => {
    setConsumeTarget(null);
    consumeTriggerRef.current?.focus();
  }, []);

  /**
   * Удаление катушки.
   *
   * Подтверждение обязательно: действие необратимо, а вернуть катушку неоткуда.
   * Пока сервер отвечает, корзина выключена (`deletingId`), а после успеха
   * `router.refresh()` перечитывает склад — удалённой строки в нём уже нет.
   * Ошибку показываем красной плашкой над таблицей.
   */
  const removeFilament = useCallback(
    async (filament: WorkshopFilament) => {
      if (deletingId !== null) {
        return;
      }

      const label = filamentLabel(filament);
      const confirmed = window.confirm(
        `Удалить катушку «${label}» из склада? Это действие нельзя отменить.`,
      );

      if (!confirmed) {
        return;
      }

      setStatus(null);
      setError(null);
      setDeletingId(filament.id);

      try {
        const result = await deleteFilament(filament.id);

        if ("error" in result) {
          setError(result.error);
          return;
        }

        setStatus(`Катушка «${label}» удалена.`);
        router.refresh();
      } catch {
        setError("Нет связи с сервером. Попробуйте ещё раз.");
      } finally {
        setDeletingId(null);
      }
    },
    [deletingId, router],
  );

  return (
    <section
      aria-labelledby="workshop-stock-title"
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7"
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
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Остатки по катушкам: когда складской пластик подходит к концу, строка
            становится красной, а ссылка на товар — кнопкой «Купить». Заказные
            катушки в напоминание о закупке не попадают.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            ref={orderTriggerRef}
            type="button"
            onClick={openOrder}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            <SpecificationIcon className="h-4 w-4" />
            Спецификация на закупку
          </button>
          <button
            ref={importTriggerRef}
            type="button"
            onClick={openImport}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            Импорт из фото
          </button>
          <button
            ref={addTriggerRef}
            type="button"
            onClick={openAdd}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            <span aria-hidden>+</span>
            Добавить катушку
          </button>
        </div>
      </div>

      <p aria-live="polite" className="mt-3 min-h-5 text-sm text-emerald-300">
        {status}
      </p>

      {error ? (
        <p
          role="alert"
          className="mb-3 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-100"
        >
          <span aria-hidden>⚠️ </span>
          {error}
        </p>
      ) : null}

      {filaments.length === 0 ? (
        <EmptyStock onAdd={openAdd} />
      ) : (
        <>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-zinc-500">
            <span>Катушек: {filaments.length}</span>
            <span>Остаток: {formatGrams(summary.totalRemainingG)}</span>
            {summary.lowCount > 0 ? (
              <span className="text-red-300">
                Пора покупать: {summary.lowCount}
              </span>
            ) : null}
          </p>

          <StockTable
            filaments={filaments}
            onConsume={openConsume}
            onDelete={removeFilament}
            deletingId={deletingId}
          />
          <StockCards
            filaments={filaments}
            onConsume={openConsume}
            onDelete={removeFilament}
            deletingId={deletingId}
          />
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

      {isImportOpen ? (
        <ImportStockFromPhotoDialog onClose={closeImport} />
      ) : null}

      {isOrderOpen ? (
        <OrderFilamentsDialog filaments={filaments} onClose={closeOrder} />
      ) : null}
    </section>
  );
}

/** Таблица склада: на узком экране её заменяют карточки. */
function StockTable({
  filaments,
  onConsume,
  onDelete,
  deletingId,
}: {
  filaments: WorkshopFilament[];
  onConsume: (filament: WorkshopFilament, trigger: HTMLButtonElement) => void;
  onDelete: (filament: WorkshopFilament) => void;
  deletingId: string | null;
}) {
  return (
    <div
      data-stock-table
      className="mt-4 hidden overflow-hidden rounded-2xl border border-white/5 bg-[#0a0a0a] md:block"
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Катушки пластика: бренд, тип, тип позиции, цвет, остаток, порог и
            ссылка на товар
          </caption>
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.02] text-left text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">
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
            const needsRestock = needsPurchase(filament);

            return (
              <tr
                key={filament.id}
                className={`border-b border-white/5 align-top last:border-b-0 ${
                  needsRestock ? "bg-red-500/10" : ""
                }`}
              >
                <td className="px-3 py-4 font-semibold text-white">
                  {filament.brand || "—"}
                  {needsRestock ? (
                    <span className="mt-1 block text-[11px] font-bold tracking-wide text-red-300 uppercase">
                      Пора купить
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-4 text-zinc-300">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>{filament.type || "—"}</span>
                    <UsageTypeBadge usageType={filament.usageType} />
                  </div>
                </td>
                <td className="px-3 py-4 text-zinc-400">
                  {filament.color || "—"}
                </td>
                <td className="px-3 py-4">
                  <span
                    className={`font-semibold tabular-nums ${
                      needsRestock ? "text-red-200" : "text-white"
                    }`}
                  >
                    {formatGrams(filament.remainingWeightG)}
                  </span>
                  <RemainingBar filament={filament} isLow={needsRestock} />
                </td>
                <td className="px-3 py-4 tabular-nums text-zinc-400">
                  {formatGrams(filament.minThresholdG)}
                </td>
                <td className="px-3 py-4">
                  <PurchaseLink filament={filament} isLow={needsRestock} />
                </td>
                <td className="px-3 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <ConsumeButton filament={filament} onOpen={onConsume} />
                    <DeleteButton
                      filament={filament}
                      isDeleting={deletingId === filament.id}
                      onDelete={onDelete}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Карточки склада: та же информация, но в одну колонку. */
function StockCards({
  filaments,
  onConsume,
  onDelete,
  deletingId,
}: {
  filaments: WorkshopFilament[];
  onConsume: (filament: WorkshopFilament, trigger: HTMLButtonElement) => void;
  onDelete: (filament: WorkshopFilament) => void;
  deletingId: string | null;
}) {
  return (
    <ul className="mt-4 grid gap-3 md:hidden">
      {filaments.map((filament) => {
        const needsRestock = needsPurchase(filament);

        return (
          <li
            key={filament.id}
            data-stock-card
            className={`rounded-2xl border p-4 ${
              needsRestock
                ? "border-red-400/30 bg-red-500/[0.07]"
                : "border-white/5 bg-[#0a0a0a]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">
                  {filament.brand || "Без бренда"}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                  <span>
                    {filament.type || "—"} · {filament.color || "—"}
                  </span>
                  <UsageTypeBadge usageType={filament.usageType} />
                </p>
              </div>
              {needsRestock ? (
                <span className="rounded-full border border-red-400/40 bg-red-500/15 px-2.5 py-1 text-[11px] font-bold tracking-wide text-red-200 uppercase">
                  Пора купить
                </span>
              ) : null}
            </div>

            <div className="mt-3">
              <p className="text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">
                Остаток (г)
              </p>
              <p
                className={`mt-0.5 text-lg font-extrabold tabular-nums ${
                  needsRestock ? "text-red-200" : "text-white"
                }`}
              >
                {formatGrams(filament.remainingWeightG)}
              </p>
              <p className="text-xs text-zinc-500">
                из {formatGrams(filament.totalWeightG)} · порог{" "}
                {formatGrams(filament.minThresholdG)}
              </p>
              <RemainingBar filament={filament} isLow={needsRestock} />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <PurchaseLink filament={filament} isLow={needsRestock} />
              <ConsumeButton filament={filament} onOpen={onConsume} />
              <span className="ml-auto">
                <DeleteButton
                  filament={filament}
                  isDeleting={deletingId === filament.id}
                  onDelete={onDelete}
                />
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Бейдж типа позиции: «Складской» — постоянный запас, «Заказной» — пластик
 * под конкретную задачу.
 *
 * Смысл виден из текста, поэтому цвет только помогает глазу: зелёный —
 * складской, янтарный — заказной. `shrink-0` и `whitespace-nowrap` не дают
 * бейджу сплющиться рядом с длинным названием цвета, а переносится он за счёт
 * `flex-wrap` у родителя — на узком экране карточка не ломается.
 */
function UsageTypeBadge({
  usageType,
}: {
  usageType: WorkshopFilament["usageType"];
}) {
  const isOrdered = usageType === "ordered";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide whitespace-nowrap uppercase ${
        isOrdered
          ? "border-amber-500/30 bg-amber-500/20 text-amber-300"
          : "border-green-500/30 bg-green-500/20 text-green-300"
      }`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${
          isOrdered ? "bg-amber-300" : "bg-green-300"
        }`}
      />
      {isOrdered ? "Заказной" : "Складской"}
    </span>
  );
}

/** Пустой склад: объясняем, что даст первая катушка. */
function EmptyStock({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-[#0a0a0a] px-5 py-8 text-center">
      <p aria-hidden className="text-3xl">
        📦
      </p>
      <p className="mt-3 text-sm font-semibold text-white">Склад пока пуст</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
        Добавьте катушку — увидите остаток, порог и ссылку на товар. Когда
        пластик закончится, Мастерская напомнит, что пора покупать.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
      >
        Добавить первую катушку
      </button>
    </div>
  );
}
/**
 * Полоска остатка: процент от общего веса катушки.
 *
 * Красная — только у складской катушки ниже порога. У заказной остаток ничего
 * не говорит о закупке, поэтому полоска янтарная, в тон бейджу «Заказной».
 */
function RemainingBar({
  filament,
  isLow,
}: {
  filament: WorkshopFilament;
  isLow: boolean;
}) {
  const percent = filamentRemainingPercent(filament);
  const barClass =
    filament.usageType === "ordered"
      ? "bg-amber-400/70"
      : isLow
        ? "bg-red-400"
        : "bg-emerald-400";

  return (
    <div className="mt-2 w-full max-w-[9rem]">
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Остаток ${formatGrams(filament.remainingWeightG)} из ${formatGrams(filament.totalWeightG)}`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${barClass}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-zinc-500">
        {percent}% от {formatGrams(filament.totalWeightG)}
      </p>
    </div>
  );
}

/**
 * Ссылка на товар: у складской катушки ниже порога она становится кнопкой
 * «Купить», у остальных — нейтральной ссылкой «Магазин».
 */
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
    ? "inline-flex min-h-9 items-center justify-center rounded-lg border border-red-400/30 bg-red-500/10 px-3.5 text-xs font-bold text-red-200 transition-colors hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
    : "text-sm font-semibold text-blue-300 underline-offset-4 transition-colors hover:text-blue-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]";

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
      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] px-3.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-40"
    >
      Списать
    </button>
  );
}

/**
 * Корзина катушки: маленькая красная кнопка рядом со «Списать» в таблице и в
 * правом нижнем углу мобильной карточки.
 *
 * Подтверждение спрашивает обработчик на вкладке: текст с названием катушки и
 * предупреждением «Это действие нельзя отменить». Пока идёт запрос, кнопка
 * выключается (`disabled` и `aria-busy`), поэтому второй раз нажать её нельзя.
 */
function DeleteButton({
  filament,
  isDeleting,
  onDelete,
}: {
  filament: WorkshopFilament;
  isDeleting: boolean;
  onDelete: (filament: WorkshopFilament) => void;
}) {
  const label = filamentLabel(filament);

  return (
    <button
      type="button"
      data-stock-delete={filament.id}
      disabled={isDeleting}
      aria-busy={isDeleting}
      aria-label={`Удалить катушку: ${label}`}
      title={isDeleting ? "Удаляем…" : "Удалить катушку"}
      onClick={() => onDelete(filament)}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-wait disabled:opacity-60"
    >
      <TrashIcon className="h-4 w-4" />
    </button>
  );
}
