"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";

import { approveDiscoveredPrinters } from "@/app/actions/printers";
import type { DiscoveredPrintersState } from "@/app/actions/printers-state";
import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";
import type { PrinterProtocol } from "@/lib/db/workshop-types";
import {
  PRINTER_TEXT_LIMITS,
  defaultDiscoveredPrinterName,
  type DiscoveredPrinter,
} from "@/lib/workshop/printers";

/**
 * Окно «Мастер подключения фермы».
 *
 * Агент фермы запускают с `SCAN_NETWORK=true`: он обходит локальную сеть и
 * присылает находки в `/api/agent/discover`, а страница читает их
 * (`getDiscoveredPrinters()` в lib/workshop/printer-store.ts). Здесь мастер даёт
 * принтерам имена и одной кнопкой переносит выбранные в парк через Server Action
 * `approveDiscoveredPrinters`.
 *
 * Выбор и имена хранятся как «правки поверх умолчаний»: отмечено всё, что в
 * списке, имя по умолчанию — `Принтер 192.168.1.50`. Поэтому `router.refresh()`
 * при открытии окна не ломает уже введённое: новые находки с сервера сразу видны
 * и отмечены, а правки старых строк остаются.
 *
 * После успеха окно закрывает родитель: страницу мастер обновляет сам
 * (`router.refresh()`), а вкладка показывает тост и оставляет ту же строку в
 * `aria-live`.
 */

type DiscoverPrintersDialogProps = {
  printers: DiscoveredPrinter[];
  /** В базе нет таблицы workshop_discovered_printers — миграция не применена. */
  isMissingTable: boolean;
  onClose: () => void;
  /** Итог подтверждения: строка для тоста на вкладке «Принтеры». */
  onApproved: (message: string) => void;
};

/** Подписи протоколов: агент определяет их сам, мастеру остаётся прочитать. */
const PROTOCOL_LABELS: Record<PrinterProtocol, string> = {
  moonraker: "Moonraker",
  octoprint: "OctoPrint",
  bambu: "Bambu",
};

const inputClassName =
  "mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-zinc-500 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30 focus:ring-inset disabled:cursor-not-allowed disabled:opacity-40";

const primaryButtonClassName =
  "inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButtonClassName =
  "inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-6 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-40";

const selectAllButtonClassName =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] px-3.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]";

/** Русская форма слова «принтер» по числу: 1 принтер, 3 принтера, 12 принтеров. */
function printersWord(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;

  if (mod100 >= 11 && mod100 <= 14) {
    return "принтеров";
  }

  if (mod10 === 1) {
    return "принтер";
  }

  return mod10 >= 2 && mod10 <= 4 ? "принтера" : "принтеров";
}

/**
 * Тост после переноса: «Успешно добавлено 3 принтера».
 *
 * Ноль добавленных — не ошибка: список подтвердили повторно, и все адреса уже
 * стоят в парке. Тогда показываем ответ сервера, а не «добавлено 0 принтеров».
 */
function approvedNotice(state: DiscoveredPrintersState): string {
  const added = state.added ?? 0;

  if (added === 0) {
    return state.message ?? "Все найденные принтеры уже есть в парке.";
  }

  const skipped = state.skipped ?? 0;
  const tail = skipped > 0 ? `. Пропущено: ${skipped}.` : "";

  return `Успешно добавлено ${added} ${printersWord(added)}${tail}`;
}

export function DiscoverPrintersDialog({
  printers,
  isMissingTable,
  onClose,
  onApproved,
}: DiscoverPrintersDialogProps) {
  const router = useRouter();
  /** Введённые имена: ключ — адрес, значение — правка мастера. */
  const [names, setNames] = useState<Record<string, string>>({});
  /** Снятые отметки: ключ — адрес, отсутствие ключа значит «выбран». */
  const [unselected, setUnselected] = useState<Record<string, boolean>>({});
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isChosen = (ipAddress: string) => !unselected[ipAddress];
  const nameOf = (ipAddress: string) =>
    names[ipAddress] ?? defaultDiscoveredPrinterName(ipAddress);

  const chosen = printers.filter((printer) => isChosen(printer.ipAddress));
  const allChosen = printers.length > 0 && chosen.length === printers.length;
  const namelessChosen = chosen.filter(
    (printer) => nameOf(printer.ipAddress).trim().length === 0,
  );
  const canSubmit = chosen.length > 0 && namelessChosen.length === 0 && !isPending;

  /**
   * Пока идёт сохранение, окно не закрывается: иначе мастер не увидит ответ
   * сервера, а принтеры всё равно добавятся.
   */
  const closeUnlessPending = useCallback(() => {
    if (!isPending) {
      onClose();
    }
  }, [isPending, onClose]);

  useDialogDismiss(closeUnlessPending);

  function toggleAll() {
    const next: Record<string, boolean> = {};

    for (const printer of printers) {
      next[printer.ipAddress] = allChosen;
    }

    setUnselected(next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setError(null);
    setIsPending(true);

    const result = await approveDiscoveredPrinters(
      chosen.map((printer) => ({
        ip_address: printer.ipAddress,
        name: nameOf(printer.ipAddress),
      })),
    );

    setIsPending(false);

    if (!result.ok) {
      setError(result.error ?? "Не удалось добавить принтеры в парк.");
      return;
    }

    router.refresh();
    onApproved(approvedNotice(result));
  }

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeUnlessPending();
        }
      }}
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="farm-wizard-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl shadow-black/60 sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-blue-400 uppercase">
              Агент фермы
            </p>
            <h2
              id="farm-wizard-title"
              className="mt-3 text-2xl font-extrabold tracking-tight text-white"
            >
              Мастер подключения фермы
            </h2>
          </div>
          <button
            type="button"
            onClick={closeUnlessPending}
            aria-label="Закрыть мастер подключения фермы"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-lg text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          Агент нашёл принтеры в локальной сети. Отметьте нужные, дайте им имена
          — они появятся в парке мастерской, а находки из очереди уйдут.
        </p>

        {isMissingTable ? (
          <p
            role="status"
            className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100"
          >
            <span aria-hidden>⚠️ </span>
            Найденные принтеры пока не сохраняются: в базе нет таблицы
            workshop_discovered_printers. Примените
            supabase/workshop_farm_and_shop.sql.
          </p>
        ) : null}

        {printers.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-5 py-8 text-center">
            <p aria-hidden className="text-3xl">
              📡
            </p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Принтеры не найдены. Убедитесь, что агент запущен с флагом
              SCAN_NETWORK=true и находится в одной сети с принтерами
            </p>
            <button
              type="button"
              onClick={closeUnlessPending}
              className={`mt-5 ${secondaryButtonClassName}`}
            >
              Закрыть
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} autoComplete="off" className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={toggleAll}
                className={selectAllButtonClassName}
              >
                {allChosen ? "Снять выбор" : "Выбрать все"}
              </button>
              <p className="text-xs font-semibold text-zinc-500">
                Выбрано:{" "}
                <span className="text-white tabular-nums">{chosen.length}</span>{" "}
                из <span className="tabular-nums">{printers.length}</span>
              </p>
            </div>

            <ul className="mt-4 space-y-2">
              {printers.map((printer, index) => {
                const checkboxId = `farm-wizard-printer-${index}`;
                const checked = isChosen(printer.ipAddress);

                return (
                  <li
                    key={printer.ipAddress}
                    className="rounded-xl border border-white/10 bg-black/30 p-3"
                  >
                    <div className="flex items-start gap-3">
                      <input
                        id={checkboxId}
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          const next = event.currentTarget.checked;

                          setUnselected((prev) => ({
                            ...prev,
                            [printer.ipAddress]: !next,
                          }));
                        }}
                        className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-blue-500"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <label
                            htmlFor={checkboxId}
                            className="cursor-pointer font-mono text-sm font-bold text-white"
                          >
                            {printer.ipAddress}
                          </label>
                          <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-300 uppercase">
                            {PROTOCOL_LABELS[printer.protocolType]}
                          </span>
                        </div>
                        <label
                          htmlFor={`${checkboxId}-name`}
                          className="sr-only"
                        >
                          Имя принтера {printer.ipAddress}
                        </label>
                        <input
                          id={`${checkboxId}-name`}
                          type="text"
                          autoFocus={index === 0}
                          maxLength={PRINTER_TEXT_LIMITS.name}
                          disabled={!checked}
                          value={nameOf(printer.ipAddress)}
                          onChange={(event) => {
                            const next = event.currentTarget.value;

                            setNames((prev) => ({
                              ...prev,
                              [printer.ipAddress]: next,
                            }));
                          }}
                          className={inputClassName}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {namelessChosen.length > 0 ? (
              <p className="mt-3 text-xs leading-relaxed text-amber-300">
                Дайте имя всем выбранным принтерам: без него карточка в парке
                будет безымянной.
              </p>
            ) : null}

            {error ? (
              <p
                role="alert"
                className="mt-4 rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-100"
              >
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row">
              <button
                type="submit"
                disabled={!canSubmit}
                aria-busy={isPending}
                className={primaryButtonClassName}
              >
                {isPending ? "Добавляем…" : "Добавить выбранные в парк"}
              </button>
              <button
                type="button"
                onClick={closeUnlessPending}
                className={secondaryButtonClassName}
              >
                Закрыть
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
