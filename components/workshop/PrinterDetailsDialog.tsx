"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";

import { deletePrinter, updatePrinter } from "@/app/actions/printers";
import { MaintenanceGuideText } from "@/components/workshop/MaintenanceGuideText";
import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";
import {
  isPrinterProtocol,
  type PrinterProtocol,
} from "@/lib/db/workshop-types";
import {
  UNIVERSAL_MAINTENANCE_TIPS,
  getMaintenanceGuide,
  type MaintenanceTopic,
} from "@/lib/workshop/maintenance-guides";
import { findPrinterPresetByModel } from "@/lib/workshop/printer-presets";
import {
  PRINTER_ADDRESS_MAX,
  PRINTER_PROTOCOL_OPTIONS,
  PRINTER_TEXT_LIMITS,
  formatPrinterDate,
  formatPrinterHours,
  formatPrinterLastSeen,
  formatPrinterProtocol,
  printerMaintenanceLevel,
  printerMaintenancePercent,
  type MaintenanceLevel,
  type PrinterFormErrors,
  type WorkshopPrinter,
} from "@/lib/workshop/printers";

/**
 * Карточка принтера: обслуживание, подключение и удаление.
 *
 * Вкладка «Принтеры» показывает наработку и состояние, но по карточке нельзя
 * было ни прочитать инструкцию по ТО, ни поправить адрес, ни убрать принтер из
 * парка. Окно закрывает эту дырку и открывается кликом по карточке.
 *
 * Блоков два, как у самих действий: «Обслуживание» — только чтение, данные уже
 * пришли с сервера (`WorkshopPrinter`); «Подключение» — форма из четырёх полей и
 * Server Action `updatePrinter`. Удаление стоит отдельным блоком внизу: это
 * редкое и необратимое действие, ему не место рядом с «Сохранить».
 */

type PrinterDetailsDialogProps = {
  printer: WorkshopPrinter;
  /** Название заказа, который печатается сейчас; null — печати нет. */
  activeJobTitle: string | null;
  onClose: () => void;
  /** Сообщение для строки состояния вкладки после сохранения. */
  onSaved: (message: string) => void;
  /** Сообщение после удаления: принтера в парке уже нет. */
  onDeleted: (message: string) => void;
};

type DetailsTab = "maintenance" | "connection";

/** Подпись и цвет уровня обслуживания — те же пороги, что у полосок карточки. */
const LEVEL_STYLES: Record<MaintenanceLevel, { text: string; label: string }> = {
  ok: { text: "text-emerald-300", label: "в норме" },
  due: { text: "text-amber-300", label: "пора обслужить" },
  overdue: { text: "text-red-300", label: "просрочено" },
};

/** Узел обслуживания: наработка и интервал берутся из самой карточки. */
type MaintenanceNode = {
  topic: MaintenanceTopic;
  label: string;
  hours: number;
  interval: number;
};

/**
 * Подписи тем для универсальных советов: три узла, по которым карточка считает
 * наработку, — тот же порядок, что у полосок на самой карточке.
 */
const UNIVERSAL_TOPICS: readonly { topic: MaintenanceTopic; title: string }[] = [
  { topic: "nozzle", title: "Чистка сопла" },
  { topic: "lubrication", title: "Смазка осей" },
  { topic: "zScrew", title: "Обслуживание винта Z" },
];
const inputClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white outline-none transition-all duration-200 placeholder:text-zinc-500 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30 focus:ring-inset";

const labelClassName = "text-sm font-semibold text-zinc-200";

const hintClassName = "mt-2 text-xs leading-relaxed text-zinc-500";

const fieldErrorClassName = "mt-2 text-xs font-semibold text-red-300";

const secondaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-xs font-semibold text-zinc-300 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-40";

const dangerButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-xl border border-red-500/40 bg-red-500/10 px-4 text-xs font-bold text-red-200 transition-colors hover:border-red-400/60 hover:bg-red-500/20 hover:text-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-40";

export function PrinterDetailsDialog({
  printer,
  activeJobTitle,
  onClose,
  onSaved,
  onDeleted,
}: PrinterDetailsDialogProps) {
  const router = useRouter();
  const [tab, setTab] = useState<DetailsTab>("maintenance");
  const [protocol, setProtocol] = useState<PrinterProtocol>(
    printer.protocolType,
  );
  const [fieldErrors, setFieldErrors] = useState<PrinterFormErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isBusy = isSaving || isDeleting;

  /**
   * Пока идёт сохранение или удаление, окно не закрывается: иначе непонятно,
   * применились ли изменения, а сообщение на вкладке осталось бы без адресата.
   */
  const closeDialog = useCallback(() => {
    if (!isBusy) {
      onClose();
    }
  }, [isBusy, onClose]);

  useDialogDismiss(closeDialog);

  const model = [printer.brand, printer.model].filter(Boolean).join(" ");
  const guide = getMaintenanceGuide(printer.brand, printer.model);
  const preset =
    findPrinterPresetByModel(model) ||
    findPrinterPresetByModel(printer.model || "");
  const nodes: MaintenanceNode[] = [
    {
      topic: "nozzle",
      label: "Сопло",
      hours: printer.nozzleHours,
      interval: printer.nozzleInterval,
    },
    {
      topic: "lubrication",
      label: "Смазка осей",
      hours: printer.lubricationHours,
      interval: printer.lubricationInterval,
    },
    {
      topic: "zScrew",
      label: "Винт Z",
      hours: printer.zScrewHours,
      interval: printer.zScrewInterval,
    },
  ];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isBusy) {
      return;
    }

    // FormData снимаем до await: currentTarget живёт только в обработчике.
    const formData = new FormData(event.currentTarget);

    setFieldErrors({});
    setError(null);
    setNotice(null);
    setIsSaving(true);

    try {
      const result = await updatePrinter(printer.id, formData);

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setError(result.error ?? "Не удалось сохранить подключение.");
        return;
      }

      const message = result.message ?? "Подключение сохранено.";

      setNotice(message);
      onSaved(message);
      router.refresh();
    } catch {
      setError("Нет связи с сервером. Попробуйте ещё раз.");
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Удаление в два шага: первая кнопка только раскрывает подтверждение.
   * После успеха окно закрывается, а вкладка показывает сообщение и обновлённый
   * парк — принтера в списке уже нет.
   */
  async function handleDelete() {
    if (isBusy) {
      return;
    }

    setDeleteError(null);
    setIsDeleting(true);

    try {
      const result = await deletePrinter(printer.id);

      if (!result.ok) {
        setDeleteError(result.error ?? "Не удалось удалить принтер.");
        return;
      }

      onDeleted(result.message ?? "Принтер удалён.");
      onClose();
      router.refresh();
    } catch {
      setDeleteError("Нет связи с сервером. Попробуйте ещё раз.");
    } finally {
      setIsDeleting(false);
    }
  }

  if (typeof document === "undefined") {
    return null;
  }

  /** Вкладка: активная — белая, как главная кнопка, иначе тихая тёмная. */
  const tabClassName = (isActive: boolean) =>
    `inline-flex min-h-10 flex-1 items-center justify-center rounded-lg px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
      isActive
        ? "bg-white text-black shadow-[0_8px_24px_-16px_rgba(255,255,255,0.6)]"
        : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
    }`;

  return createPortal(
    <div
      role="presentation"
      data-printer-details-overlay
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeDialog();
        }
      }}
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/85 p-4 backdrop-blur-sm sm:items-center"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="printer-details-heading"
        tabIndex={-1}
        data-printer-details={printer.id}
        className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl shadow-black/60 outline-none sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.2em] text-blue-400 uppercase">
              Принтер
            </p>
            <h2
              id="printer-details-heading"
              className="mt-3 text-2xl font-extrabold tracking-tight break-words text-white"
            >
              {printer.name}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              {model || "Модель не указана"} ·{" "}
              {formatPrinterProtocol(printer.protocolType)} ·{" "}
              {formatPrinterHours(printer.totalHours)} всего
            </p>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            disabled={isBusy}
            autoFocus
            aria-label="Закрыть карточку принтера"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-lg text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-wait disabled:opacity-60"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Карточка принтера"
          className="mt-5 flex gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1"
        >
          <button
            type="button"
            role="tab"
            id="printer-tab-maintenance"
            aria-selected={tab === "maintenance"}
            aria-controls="printer-panel-maintenance"
            data-printer-tab="maintenance"
            onClick={() => setTab("maintenance")}
            className={tabClassName(tab === "maintenance")}
          >
            Обслуживание
          </button>
          <button
            type="button"
            role="tab"
            id="printer-tab-connection"
            aria-selected={tab === "connection"}
            aria-controls="printer-panel-connection"
            data-printer-tab="connection"
            onClick={() => setTab("connection")}
            className={tabClassName(tab === "connection")}
          >
            Подключение
          </button>
        </div>

        {/*
          Панели не размонтируются при переключении вкладок: у формы подключения
          есть черновик, и введённый адрес не должен пропадать, если мастер
          заглянул в инструкцию. Скрытая панель — атрибут hidden, а не условие.
        */}
        <div
          role="tabpanel"
          id="printer-panel-maintenance"
          aria-labelledby="printer-tab-maintenance"
          data-printer-panel="maintenance"
          hidden={tab !== "maintenance"}
          className="mt-5 space-y-6"
        >
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
              <dt className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
                Последний выход на связь
              </dt>
              <dd
                data-printer-last-seen
                className="mt-1 text-sm font-semibold text-white"
              >
                {formatPrinterLastSeen(printer.lastSeenAt)}
              </dd>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
              <dt className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
                Последнее обслуживание
              </dt>
              <dd className="mt-1 text-sm font-semibold text-white">
                {formatPrinterDate(printer.lastMaintenanceDate)}
              </dd>
            </div>
            {activeJobTitle ? (
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 sm:col-span-2">
                <dt className="text-[11px] font-semibold tracking-wide text-blue-200 uppercase">
                  Печатается сейчас
                </dt>
                <dd className="mt-1 text-sm font-semibold text-white">
                  {activeJobTitle}
                </dd>
              </div>
            ) : null}
          </dl>

          <div>
            <h3 className="text-xs font-semibold tracking-[0.16em] text-blue-300 uppercase">
              Наработка узлов
            </h3>
            <ul className="mt-3 space-y-2">
              {nodes.map((node) => {
                const level = printerMaintenanceLevel(
                  node.hours,
                  node.interval,
                );
                const percent = printerMaintenancePercent(
                  node.hours,
                  node.interval,
                );

                return (
                  <li
                    key={node.topic}
                    data-printer-node={node.topic}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">
                        {node.label}
                      </p>
                      <p className="mt-1 text-xs tabular-nums text-zinc-500">
                        {node.interval > 0
                          ? `${formatPrinterHours(node.hours)} из ${formatPrinterHours(node.interval)}`
                          : "Смазка не требуется: стержни чистят спиртом"}
                      </p>
                    </div>
                    {level === null ? (
                      <span className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold tracking-wide text-zinc-400 uppercase">
                        Без смазки
                      </span>
                    ) : (
                      <span
                        className={`text-xs font-semibold tabular-nums ${LEVEL_STYLES[level].text}`}
                      >
                        {percent === null
                          ? LEVEL_STYLES[level].label
                          : `${Math.round(percent)} % · ${LEVEL_STYLES[level].label}`}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold tracking-[0.16em] text-blue-300 uppercase">
              {guide ? "Инструкция по ТО" : "Универсальные советы"}
            </h3>
            {preset ? (
              <p className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-zinc-400">
                <span className="font-semibold text-zinc-200">
                  Особенность модели:{" "}
                </span>
                {preset.note}
              </p>
            ) : null}

            {guide ? (
              <div
                data-printer-guide
                className="mt-4 space-y-5"
              >
                <MaintenanceGuideText guide={guide} />
              </div>
            ) : (
              <div data-printer-guide className="mt-4 space-y-4">
                <p className="text-sm leading-relaxed text-zinc-400">
                  Для модели «{model || "без названия"}» отдельной инструкции
                  пока нет — ниже универсальные советы. Интервалы взяты из
                  карточки принтера, их можно было поправить при добавлении.
                </p>
                {UNIVERSAL_TOPICS.map(({ topic, title }) => (
                  <div key={topic}>
                    <h4 className="text-sm font-bold tracking-wide text-blue-200 uppercase">
                      {title}
                    </h4>
                    <ul className="mt-2 space-y-2">
                      {UNIVERSAL_MAINTENANCE_TIPS[topic].map((tip) => (
                        <li
                          key={tip}
                          className="flex gap-2.5 text-sm leading-relaxed text-zinc-400"
                        >
                          <span
                            aria-hidden
                            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400"
                          />
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          role="tabpanel"
          id="printer-panel-connection"
          aria-labelledby="printer-tab-connection"
          data-printer-panel="connection"
          hidden={tab !== "connection"}
          className="mt-5"
        >
          <p className="text-sm leading-relaxed text-zinc-400">
            Агент фермы подключается к принтеру напрямую: адрес, протокол и
            ключ уходят только ему. Имя, модель и интервалы обслуживания здесь
            не меняются — их задают при добавлении принтера.
          </p>

          {printer.ipAddress === null ? (
            <p className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100">
              <span aria-hidden>⚠️ </span>
              Адрес не задан: агент не сможет подключиться к принтеру, пока вы
              его не укажете.
            </p>
          ) : null}

          {notice ? (
            <p
              role="status"
              data-printer-connection-notice
              className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100"
            >
              {notice}
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              data-printer-connection-error
              className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100"
            >
              <span aria-hidden>⚠️ </span>
              {error}
            </p>
          ) : null}

          <form
            onSubmit={handleSubmit}
            autoComplete="off"
            data-printer-connection-form
            className="mt-4 space-y-4"
          >
            <div>
              <label
                htmlFor="printer-connection-protocol"
                className={labelClassName}
              >
                Протокол
              </label>
              <select
                id="printer-connection-protocol"
                name="protocol"
                value={protocol}
                onChange={(event) => {
                  const next = event.target.value;

                  if (isPrinterProtocol(next)) {
                    setProtocol(next);
                  }
                }}
                aria-describedby="printer-connection-protocol-hint"
                aria-invalid={fieldErrors.protocol ? true : undefined}
                className={inputClassName}
              >
                {PRINTER_PROTOCOL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p
                id="printer-connection-protocol-hint"
                className={hintClassName}
              >
                Как агент управляет принтером. Bambu работает в LAN-режиме:
                MQTT и код доступа с экрана принтера.
              </p>
              {fieldErrors.protocol ? (
                <p className={fieldErrorClassName}>{fieldErrors.protocol}</p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="printer-connection-ip"
                className={labelClassName}
              >
                IP-адрес или имя узла
              </label>
              <input
                id="printer-connection-ip"
                name="ipAddress"
                type="text"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                required
                maxLength={PRINTER_ADDRESS_MAX}
                defaultValue={printer.ipAddress ?? ""}
                placeholder="192.168.1.50"
                aria-describedby="printer-connection-ip-hint"
                aria-invalid={fieldErrors.ipAddress ? true : undefined}
                className={inputClassName}
              />
              <p id="printer-connection-ip-hint" className={hintClassName}>
                Адрес вида 192.168.1.50 или ender3.local — без http://,
                пробелов и «/».
              </p>
              {fieldErrors.ipAddress ? (
                <p className={fieldErrorClassName}>{fieldErrors.ipAddress}</p>
              ) : null}
            </div>

            {protocol === "bambu" ? (
              <div>
                <label
                  htmlFor="printer-connection-serial"
                  className={labelClassName}
                >
                  Серийный номер
                </label>
                <input
                  id="printer-connection-serial"
                  name="serialNumber"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={PRINTER_TEXT_LIMITS.serialNumber}
                  defaultValue={printer.serialNumber ?? ""}
                  placeholder="00M09A123456789"
                  aria-describedby="printer-connection-serial-hint"
                  aria-invalid={fieldErrors.serialNumber ? true : undefined}
                  className={inputClassName}
                />
                <p
                  id="printer-connection-serial-hint"
                  className={hintClassName}
                >
                  Нужен только Bambu Lab: по номеру агент строит топики MQTT.
                  Если принтер его не сообщил, оставьте поле пустым.
                </p>
                {fieldErrors.serialNumber ? (
                  <p className={fieldErrorClassName}>
                    {fieldErrors.serialNumber}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div>
              <label
                htmlFor="printer-connection-key"
                className={labelClassName}
              >
                Ключ API / код доступа
              </label>
              <input
                id="printer-connection-key"
                name="apiKey"
                type="password"
                autoComplete="new-password"
                spellCheck={false}
                maxLength={PRINTER_TEXT_LIMITS.apiKey}
                defaultValue=""
                placeholder={
                  protocol === "bambu"
                    ? "Новый код доступа, если меняете"
                    : "Новый ключ API, если меняете"
                }
                aria-describedby="printer-connection-key-hint"
                aria-invalid={fieldErrors.apiKey ? true : undefined}
                className={inputClassName}
              />
              <p id="printer-connection-key-hint" className={hintClassName}>
                Ключ хранится как секрет и в браузер не возвращается. Пустое
                поле — оставить сохранённый ключ.
              </p>
              {fieldErrors.apiKey ? (
                <p className={fieldErrorClassName}>{fieldErrors.apiKey}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-white/5 pt-4">
              <button
                type="submit"
                disabled={isBusy}
                aria-busy={isSaving}
                data-printer-connection-save
                className="inline-flex min-h-10 items-center justify-center rounded-xl bg-white px-4 text-xs font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-wait disabled:opacity-60"
              >
                {isSaving ? "Сохраняем…" : "Сохранить"}
              </button>
              <p className="text-xs text-zinc-500">
                После сохранения страница обновится: карточка покажет новый
                адрес.
              </p>
            </div>
          </form>
        </div>

        <div className="mt-6 border-t border-white/5 pt-5">
          <p className="text-sm font-semibold text-white">Удалить принтер</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Принтер исчезнет из парка, и агент перестанет его опрашивать. Заказы
            останутся: ссылка на принтер в них просто станет пустой.
          </p>

          {deleteError ? (
            <p
              role="alert"
              data-printer-delete-error
              className="mt-3 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-100"
            >
              {deleteError}
            </p>
          ) : null}

          {isConfirmingDelete ? (
            <div
              role="group"
              aria-label="Подтверждение удаления принтера"
              className="mt-3 flex flex-wrap gap-2"
            >
              <button
                type="button"
                onClick={handleDelete}
                disabled={isBusy}
                aria-busy={isDeleting}
                data-printer-delete-confirm
                className={dangerButtonClassName}
              >
                {isDeleting ? "Удаляем…" : `Да, удалить «${printer.name}»`}
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
                disabled={isDeleting}
                data-printer-delete-cancel
                className={secondaryButtonClassName}
              >
                Отмена
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setIsConfirmingDelete(true);
              }}
              disabled={isBusy}
              data-printer-delete
              className={`mt-3 ${dangerButtonClassName}`}
            >
              Удалить принтер
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
