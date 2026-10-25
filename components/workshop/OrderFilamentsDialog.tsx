"use client";

import { type FormEvent, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";
import { SpecificationIcon } from "@/components/workshop/WorkshopIcons";
import {
  FILAMENT_DEFAULTS,
  FILAMENT_ORDER_LIMITS,
  formatGrams,
  type FilamentOrderItem,
  type WorkshopFilament,
} from "@/lib/workshop/filaments";

type OrderFilamentsDialogProps = {
  filaments: WorkshopFilament[];
  onClose: () => void;
};

/** Название катушки для строки спецификации: «eSun PLA Чёрный». */
function filamentTitle(filament: WorkshopFilament): string {
  return (
    [filament.brand, filament.type, filament.color]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" ") || "Без названия"
  );
}

/**
 * Окно «Спецификация на закупку филамента».
 *
 * В список сразу попадают только складские катушки (`usageType === "stock"`)
 * ниже минимального порога, все отмечены. Заказной пластик покупают под
 * конкретную задачу, поэтому в автозакупку он не попадает даже при низком
 * остатке. Ненужные строки снимаются галочкой, количество по умолчанию —
 * вес стандартной катушки (1 000 г). «Сформировать» кодирует выбранные позиции
 * в адрес `/workshop/filaments/specification`, открывает печатную форму в новой
 * вкладке и закрывает окно.
 *
 * Портал, overlay, Escape, блокировка прокрутки и возврат фокуса повторяют
 * остальные окна Мастерской.
 */
export function OrderFilamentsDialog({
  filaments,
  onClose,
}: OrderFilamentsDialogProps) {
  const candidates = useMemo(
    () =>
      filaments.filter(
        (filament) =>
          filament.usageType === "stock" &&
          filament.remainingWeightG < filament.minThresholdG,
      ),
    [filaments],
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(candidates.map((filament) => filament.id)),
  );
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      candidates.map((filament) => [
        filament.id,
        String(FILAMENT_DEFAULTS.totalWeightG),
      ]),
    ),
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  useDialogDismiss(onClose);

  function toggleFilament(filamentId: string, isSelected: boolean) {
    setSubmitError(null);
    setSelectedIds((current) => {
      const next = new Set(current);

      if (isSelected) {
        next.add(filamentId);
      } else {
        next.delete(filamentId);
      }

      return next;
    });
  }

  function updateQuantity(filamentId: string, value: string) {
    setSubmitError(null);
    setQuantities((current) => ({ ...current, [filamentId]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const selected = candidates.filter((filament) =>
      selectedIds.has(filament.id),
    );

    if (selected.length === 0) {
      setSubmitError("Выберите хотя бы одну позицию.");
      return;
    }

    const orderItems: FilamentOrderItem[] = [];

    for (const filament of selected) {
      const quantityGrams = Math.round(Number(quantities[filament.id]));

      if (
        !Number.isFinite(quantityGrams) ||
        quantityGrams < FILAMENT_ORDER_LIMITS.minGrams ||
        quantityGrams > FILAMENT_ORDER_LIMITS.maxGrams
      ) {
        setSubmitError(
          `Количество должно быть от ${FILAMENT_ORDER_LIMITS.minGrams} до ${FILAMENT_ORDER_LIMITS.maxGrams} г.`,
        );
        return;
      }

      orderItems.push({ filamentId: filament.id, quantityGrams });
    }

    const params = new URLSearchParams({
      items: JSON.stringify(orderItems),
    });
    const printWindow = window.open(
      `/workshop/filaments/specification?${params.toString()}`,
      "_blank",
    );

    if (!printWindow) {
      setSubmitError(
        "Браузер заблокировал новую вкладку. Разрешите всплывающие окна и попробуйте снова.",
      );
      return;
    }

    printWindow.opener = null;
    onClose();
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      role="presentation"
      data-order-filaments-dialog-overlay
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-filaments-title"
        data-order-filaments-dialog
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] shadow-2xl shadow-black/60"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.2em] text-blue-400 uppercase">
              Склад
            </p>
            <h2
              id="order-filaments-title"
              className="mt-2 text-2xl font-extrabold tracking-tight text-white"
            >
              Спецификация на закупку филамента
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
              В список автоматически попали складские катушки с остатком ниже
              минимального порога. Снимите галочки с ненужных или измените
              количество.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно спецификации"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-lg text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            <span aria-hidden>✕</span>
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
            {candidates.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/30 px-5 py-10 text-center">
                <SpecificationIcon className="mx-auto h-9 w-9 text-zinc-500" />
                <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-zinc-400">
                  Все катушки на складе в норме. Заказывать пока нечего
                </p>
                <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-zinc-500">
                  Заказные позиции не участвуют в автозакупке.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {candidates.map((filament, index) => {
                  const isSelected = selectedIds.has(filament.id);
                  const isCritical =
                    filament.remainingWeightG <= 0 ||
                    (filament.minThresholdG > 0 &&
                      filament.remainingWeightG <= filament.minThresholdG / 2);
                  const checkboxId = `order-filament-${filament.id}`;
                  const quantityId = `order-filament-quantity-${filament.id}`;

                  return (
                    <li
                      key={filament.id}
                      data-order-filaments-row
                      className={`rounded-xl border p-4 transition-colors ${
                        isSelected
                          ? "border-white/10 bg-white/[0.03]"
                          : "border-white/5 bg-black/30 opacity-60"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          id={checkboxId}
                          type="checkbox"
                          checked={isSelected}
                          autoFocus={index === 0}
                          onChange={(event) =>
                            toggleFilament(filament.id, event.target.checked)
                          }
                          aria-describedby={`${checkboxId}-details`}
                          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-white/20 bg-black/40 accent-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
                        />
                        <div className="min-w-0 flex-1">
                          <label
                            htmlFor={checkboxId}
                            className="cursor-pointer text-sm font-bold break-words text-white"
                          >
                            {filamentTitle(filament)}
                          </label>
                          <div id={`${checkboxId}-details`}>
                            <p
                              className={`mt-1 text-xs font-semibold tabular-nums ${
                                isCritical ? "text-red-300" : "text-amber-200"
                              }`}
                            >
                              Осталось: {formatGrams(filament.remainingWeightG)}
                            </p>
                            <p className="text-[11px] text-zinc-500">
                              Порог: {formatGrams(filament.minThresholdG)}
                            </p>
                          </div>
                        </div>
                        <div className="w-24 shrink-0 sm:w-28">
                          <label
                            htmlFor={quantityId}
                            className="block text-[10px] font-semibold tracking-wide text-zinc-500 uppercase"
                          >
                            К заказу, г
                          </label>
                          <input
                            id={quantityId}
                            type="number"
                            inputMode="numeric"
                            min={FILAMENT_ORDER_LIMITS.minGrams}
                            max={FILAMENT_ORDER_LIMITS.maxGrams}
                            step={1}
                            required={isSelected}
                            disabled={!isSelected}
                            value={quantities[filament.id] ?? ""}
                            onChange={(event) =>
                              updateQuantity(filament.id, event.target.value)
                            }
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-right text-sm font-semibold tabular-nums text-white transition-colors focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {submitError ? (
            <p
              role="alert"
              data-order-filaments-error
              className="border-t border-red-400/25 bg-red-950/70 px-5 py-3 text-sm font-semibold text-red-200 sm:px-6"
            >
              {submitError}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-white/10 p-5 sm:flex-row sm:justify-end sm:p-6">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-6 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={candidates.length === 0}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Сформировать
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

