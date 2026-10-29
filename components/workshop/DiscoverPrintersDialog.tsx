"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import {
  approveDiscoveredPrinters,
  fetchDiscoveredPrinters,
  requestNetworkScan,
} from "@/app/actions/printers";
import type { DiscoveredPrintersState } from "@/app/actions/printers-state";
import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";
import type { PrinterProtocol } from "@/lib/db/workshop-types";
import {
  PRINTER_TEXT_LIMITS,
  defaultDiscoveredPrinterName,
  type DiscoveredPrinter,
} from "@/lib/workshop/printers";

/**
 * Окно «Мастер подключения фермы»: поиск принтеров в сети и перенос в парк.
 *
 * Сеть обходит только агент, который стоит рядом с принтерами, — браузер её не
 * видит. Поэтому окно не показывает мгновенно то, что лежит в базе, а просит
 * агента просканировать сеть (Server Action `requestNetworkScan` ставит
 * `workshop_settings.scan_requested`), показывает «Сканируем сеть…» и раз в три
 * секунды спрашивает находки (`fetchDiscoveredPrinters`). Как только агент их
 * прислал, лоадер уступает место списку, и мастер даёт принтерам имена.
 *
 * Старые находки в базе — не повод не сканировать: если список пришёл непустым,
 * окно показывает его сразу, а если пустым — запускает поиск. Пустой ответ агента
 * тоже результат: через полторы минуты опроса окно честно говорит «принтеров не
 * нашли» и предлагает искать снова.
 *
 * Выбор и имена хранятся как «правки поверх умолчаний»: отмечено всё, что в
 * списке, имя по умолчанию — `Принтер 192.168.1.50`. Поэтому обновление списка
 * не ломает уже введённое: новые находки сразу видны и отмечены, а правки старых
 * строк остаются.
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

/**
 * Как часто окно спрашивает находки, пока агент обходит сеть.
 *
 * Три секунды — компромисс: агент узнаёт о просьбе на ближайшем опросе (раз в
 * пять секунд), обход подсети занимает секунды, и мастер не должен ждать
 * перезагрузки страницы, чтобы увидеть результат.
 */
const SCAN_POLL_INTERVAL_MS = 3000;

/**
 * Сколько раз опросить базу: 30 × 3 с = полторы минуты.
 *
 * Дольше ждать незачем: обход подсети занимает секунды, а пустой ответ — тоже
 * результат. Окно лучше скажет «принтеров не нашли» и предложит поискать снова,
 * чем будет крутить лоадер над выключенным агентом.
 */
const SCAN_POLL_LIMIT = 30;

const SCAN_REQUEST_FAILED =
  "Не удалось запросить сканирование сети. Попробуйте ещё раз.";
const SCAN_POLL_FAILED =
  "Не удалось прочитать найденные принтеры. Попробуйте ещё раз.";

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

  /**
   * Находки: страница отдаёт их пропом, дальше окно обновляет список само —
   * агент присылает результат уже после открытия окна.
   */
  const [found, setFound] = useState<DiscoveredPrinter[]>(printers);
  /** Номер поиска: 0 — данные пришли с сервера, сканировать не нужно. */
  const [scanRun, setScanRun] = useState(printers.length === 0 ? 1 : 0);
  /** Агент обходит сеть, находок ещё нет: вместо списка — статус ожидания. */
  const [isScanning, setIsScanning] = useState(
    printers.length === 0 && !isMissingTable,
  );
  /** Сканирование закончилось, а принтеров в сети не нашлось. */
  const [scanEmpty, setScanEmpty] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    // Таблицы находок нет: просить сканирование бессмысленно, серверу некуда
    // записывать результат. Предупреждение о миграции уже показано выше.
    if (scanRun === 0 || isMissingTable) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let attempts = 0;

    const stopPolling = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    /** Один опрос находок: пришли — показываем, попытки кончились — «пусто». */
    const poll = async () => {
      attempts += 1;

      const result = await fetchDiscoveredPrinters();

      if (cancelled) {
        return;
      }

      if (!result.ok) {
        stopPolling();
        setIsScanning(false);
        setScanError(result.error ?? SCAN_POLL_FAILED);
        return;
      }

      const rows = result.printers ?? [];

      if (rows.length > 0) {
        stopPolling();
        setFound(rows);
        setIsScanning(false);
        setScanError(null);
        setScanEmpty(false);
        // Вкладка показывает число находок в подписи кнопки — страницу
        // обновляем один раз, когда список действительно изменился.
        router.refresh();
        return;
      }

      if (attempts >= SCAN_POLL_LIMIT) {
        stopPolling();
        setIsScanning(false);
        setScanEmpty(true);
      }
    };

    // Просьба уходит сразу при открытии окна: мастер нажал кнопку, а не ждёт
    // пятисекундного такта агента.
    void requestNetworkScan().then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setIsScanning(false);
        setScanError(result.error ?? SCAN_REQUEST_FAILED);
        return;
      }

      timer = setInterval(() => {
        void poll();
      }, SCAN_POLL_INTERVAL_MS);
    });

    // Окно закрыли — опрос прекращается: находки всё равно придут в базу,
    // а лишние запросы к серверу закрытому окну не нужны.
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [scanRun, isMissingTable, router]);

  /** «Искать снова»: новый запрос агенту и новый цикл опроса. */
  function restartScan() {
    setFound([]);
    setScanEmpty(false);
    setScanError(null);
    setIsScanning(true);
    setScanRun((run) => run + 1);
  }

  const isChosen = (ipAddress: string) => !unselected[ipAddress];
  const nameOf = (ipAddress: string) =>
    names[ipAddress] ?? defaultDiscoveredPrinterName(ipAddress);

  const chosen = found.filter((printer) => isChosen(printer.ipAddress));
  const allChosen = found.length > 0 && chosen.length === found.length;
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

    for (const printer of found) {
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

  /**
   * Подпись под заголовком: объясняет, что происходит сейчас, а не только что
   * делать дальше. Пока идёт обход сети, мастер должен понимать, почему список
   * ещё пуст.
   */
  const headerNote = isMissingTable
    ? "Список находок пока не сохраняется: в базе нет таблицы workshop_discovered_printers."
    : isScanning
      ? "Агент обходит локальную сеть мастерской. Как только он пришлёт находки, здесь появятся адреса принтеров."
      : found.length === 0
        ? "Принтеров в сети пока нет. Запустите агент фермы и повторите поиск."
        : "Агент нашёл принтеры в локальной сети. Отметьте нужные, дайте им имена — они появятся в парке мастерской, а находки из очереди уйдут.";

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
          {headerNote}
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

        {isScanning ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-5 rounded-2xl border border-blue-500/30 bg-blue-500/[0.06] px-5 py-8 text-center"
          >
            <span
              aria-hidden
              className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-blue-400"
            />
            <p className="mt-4 text-sm font-semibold text-white">
              Сканируем сеть… Пожалуйста, подождите
            </p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              Агент обходит локальную сеть и пришлёт найденные принтеры. Обычно
              это занимает меньше минуты.
            </p>
            <button
              type="button"
              onClick={closeUnlessPending}
              className={`mt-5 ${secondaryButtonClassName}`}
            >
              Отменить
            </button>
          </div>
        ) : found.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-5 py-8 text-center">
            <p aria-hidden className="text-3xl">
              📡
            </p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              {isMissingTable
                ? "Принтеры не найдены: список находок пока не сохраняется в базе."
                : scanEmpty
                  ? "Агент просканировал сеть, но принтеров не нашёл. Проверьте, что он запущен и стоит в одной сети с принтерами, а если ферма в другом VLAN — что задан SCAN_SUBNETS."
                  : "Принтеры не найдены. Запустите агент фермы — он обходит сеть и присылает находки сюда."}
            </p>
            {scanError ? (
              <p
                role="alert"
                className="mt-3 rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-100"
              >
                {scanError}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
              {isMissingTable ? null : (
                <button
                  type="button"
                  onClick={restartScan}
                  className={primaryButtonClassName}
                >
                  Искать снова
                </button>
              )}
              <button
                type="button"
                onClick={closeUnlessPending}
                className={secondaryButtonClassName}
              >
                Закрыть
              </button>
            </div>
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
                из <span className="tabular-nums">{found.length}</span>
              </p>
            </div>

            <ul className="mt-4 space-y-2">
              {found.map((printer, index) => {
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
                          {printer.serialNumber ? (
                            <span
                              className="rounded-md border border-white/10 bg-black/40 px-2 py-0.5 font-mono text-[10px] text-zinc-400"
                              title="Серийный номер принтер назвал сам — по нему строятся MQTT-топики"
                            >
                              SN {printer.serialNumber}
                            </span>
                          ) : null}
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
