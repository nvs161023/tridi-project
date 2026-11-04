"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";

import { deletePrinter, updatePrinter } from "@/app/actions/printers";
import { MaintenanceGuideText } from "@/components/workshop/MaintenanceGuideText";
import { PrinterModelHint } from "@/components/workshop/PrinterModelHint";
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
import {
  PRINTER_BRAND_OPTIONS,
  findPrinterPresetByModel,
  isPresetPrinterModel,
  printerModelOptions,
} from "@/lib/workshop/printer-presets";
import {
  DISCOVERED_PRINTER_BRAND,
  PRINTER_ADDRESS_MAX,
  PRINTER_PROTOCOL_CAPABILITIES,
  PRINTER_PROTOCOL_OPTIONS,
  PRINTER_TEXT_LIMITS,
  PRINTER_UPLOAD_FORMATS,
  UNLISTED_PRINTER_MODEL,
  formatPrinterCapabilities,
  formatPrinterDate,
  formatPrinterHours,
  formatPrinterLastSeen,
  formatPrinterProtocol,
  isPrinterIdentityUnknown,
  isUnknownPrinterModel,
  printerConnectionSpec,
  printerSerialHint,
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
 * пришли с сервера (`WorkshopPrinter`); «Подключение» — форма полей протокола и
 * Server Action `updatePrinter`. Сверху этой формы стоит «Карточка принтера»:
 * имя, бренд и модель. Бренд с моделью правятся здесь, потому что по ним
 * проверка совместимости 3MF сверяет файл с профилем слайсера, а принтер из
 * автообнаружения приходит с заглушкой «Неизвестно · Найден по сети» — раньше
 * исправить это можно было только удалив принтер. Набор полей подключения
 * берётся из `PRINTER_CONNECTION_SPECS` — того же справочника, что у окна
 * добавления: ключ доступа, серийный номер, Check Code FlashForge, логин-пароль
 * и Device ID/Mode ID Anycubic. Секреты в браузер не возвращаются, поэтому поля
 * показываются пустыми, а пустое поле значит «оставить сохранённое». Кнопка
 * «Сохранить» одна на весь блок: визитка и подключение уходят одним
 * `updatePrinter`, и введённое не теряется при переключении вкладок. Удаление
 * стоит отдельным блоком внизу: это редкое и необратимое действие, ему не место
 * рядом с «Сохранить».
 */

type PrinterDetailsDialogProps = {
  printer: WorkshopPrinter;
  /** Название заказа, который печатается сейчас; null — печати нет. */
  activeJobTitle: string | null;
  /**
   * Причина последнего отказа агента (`workshop_print_jobs.last_error`); null —
   * отказов не было или задание ещё не падало.
   */
  lastError: string | null;
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
  "mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white outline-none transition-all duration-200 placeholder:text-zinc-400 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30 focus:ring-inset";

const labelClassName = "text-sm font-semibold text-zinc-200";

const hintClassName = "mt-2 text-xs leading-relaxed text-zinc-400";

const fieldErrorClassName = "mt-2 text-xs font-semibold text-red-300";

const secondaryButtonClassName =
  "inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-xs font-semibold text-zinc-300 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-40";

const dangerButtonClassName =
  "inline-flex min-h-12 items-center justify-center rounded-xl border border-red-400/40 bg-red-400/10 px-4 text-xs font-bold text-red-200 transition-colors hover:border-red-400/60 hover:bg-red-400/20 hover:text-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-40";

export function PrinterDetailsDialog({
  printer,
  activeJobTitle,
  lastError,
  onClose,
  onSaved,
  onDeleted,
}: PrinterDetailsDialogProps) {
  const router = useRouter();
  const [tab, setTab] = useState<DetailsTab>("maintenance");
  const [protocol, setProtocol] = useState<PrinterProtocol>(
    printer.protocolType,
  );
  /**
   * Имя, бренд и модель правятся в самой карточке. Поля управляемые: янтарное
   * предупреждение о совместимости 3MF должно гаснуть сразу, как мастер впишет
   * бренд и модель, а не после сохранения и перезагрузки страницы.
   */
  const [name, setName] = useState(printer.name);
  const [brand, setBrand] = useState(printer.brand);
  const [model, setModel] = useState(printer.model);
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

  /** Подпись модели из сохранённых значений: по ней ищется регламент ТО. */
  const modelLabel = [printer.brand, printer.model].filter(Boolean).join(" ");
  /** Та же подпись из текущих полей: под именем в шапке обновляется сразу. */
  const identityLabel = [brand, model]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(" ");
  /**
   * Бренд и модель — заглушки автообнаружения или пустые: ровно тот случай, когда
   * проверка совместимости 3MF не сработает. Подсвечиваем виновное поле, а не
   * только весь блок, — мастеру видно, что именно выбрать.
   */
  const isBrandMissing =
    brand.trim().length === 0 || brand.trim() === DISCOVERED_PRINTER_BRAND;
  const isModelMissing = isUnknownPrinterModel(model);
  const identityUnknown = isPrinterIdentityUnknown(brand, model);
  /**
   * Модель не из справочника выбранного бренда: строка, заведённая до строгого
   * выбора, или чужой профиль слайсера. Проверка совместимости 3MF сверяет файл
   * с парой «бренд — модель», поэтому сервер такую строку не сохранит — мастер
   * должен видеть это до нажатия «Сохранить».
   */
  const identityMismatch =
    !identityUnknown && !isPresetPrinterModel(brand, model);
  /** Модели выбранного бренда: `<select>` модели строится по ним. */
  const brandModels = printerModelOptions(brand);
  /**
   * Поля подключения выбранного протокола: тот же справочник
   * `PRINTER_CONNECTION_SPECS`, по которому рисуется окно добавления. Поэтому и
   * здесь, и там FlashForge спрашивает SN и Check Code, а Anycubic — логин,
   * пароль, Device ID и Mode ID, не разъезжаясь в названиях и проверках.
   */
  const spec = printerConnectionSpec(protocol);
  /**
   * Check Code ищется в справочнике протокола, но поле рисуется всегда — даже
   * когда протокол его не спрашивает. Так мастер видит, куда вписать код с
   * наклейки, не переключая протокол: у FlashForge поле обязательное, у
   * остальных остаётся пустым и подсказка объясняет, кому оно нужно.
   */
  const checkCodeField =
    spec.secrets.find((field) => field.key === "checkCode") ?? null;
  /** Остальные секреты протокола: Check Code уже нарисован выше. */
  const otherSecrets = spec.secrets.filter(
    (field) => field.key !== "checkCode",
  );
  const guide = getMaintenanceGuide(printer.brand, printer.model);
  const preset =
    findPrinterPresetByModel(modelLabel) ||
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

  /**
   * Бренд поменяли — модель другой марки уходит из поля: сервер принимает только
   * модель из справочника бренда, и «FlashForge + K1C» он отклонит. Сравнение
   * терпит недописанный бренд (`findPrinterPresetsByBrand`), поэтому модель не
   * исчезает на первой букве; «Не указана» к бренду не привязана и остаётся.
   */
  function handleBrandChange(value: string) {
    setBrand(value);

    if (
      model &&
      !isUnknownPrinterModel(model) &&
      !isPresetPrinterModel(value, model)
    ) {
      setModel("");
    }
  }

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
    `inline-flex min-h-12 flex-1 items-center justify-center rounded-lg px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
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
              {name.trim() || printer.name}
            </h2>
            <p className="mt-1 text-xs text-zinc-400">
              {identityLabel || "Модель не указана"} ·{" "}
              {formatPrinterHours(printer.totalHours)} всего
            </p>
            {/*
              Бейдж протокола: по нему мастер понимает, каким API агент говорит
              с принтером. Подпись из `PRINTER_PROTOCOL_OPTIONS` — та же, что в
              `<select>` формы, поэтому «Moonraker (Klipper)» называется
              одинаково в обоих окнах.
            */}
            <p className="mt-2">
              <span
                data-printer-protocol
                className="inline-flex items-center rounded-full border border-blue-400/40 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold tracking-wide text-blue-200"
              >
                {formatPrinterProtocol(printer.protocolType)}
              </span>
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

        {/*
          Красная плашка — причина последнего отказа агента: «Bambu: неверный
          Access Code», «принтер не отвечает». Мастер у станка видит, почему
          задание не ушло, и не ищет причину в настройках. Плашка стоит выше
          вкладок: она важна в обеих, а не только в «Подключении».
        */}
        {lastError ? (
          <p
            role="alert"
            data-printer-last-error
            className="mt-4 rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm leading-relaxed text-red-100"
          >
            <span aria-hidden>⚠️ </span>
            <span className="font-semibold">Последняя ошибка агента: </span>
            {lastError}
          </p>
        ) : null}

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
              <dt className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
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
              <dt className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
                Последнее обслуживание
              </dt>
              <dd className="mt-1 text-sm font-semibold text-white">
                {formatPrinterDate(printer.lastMaintenanceDate)}
              </dd>
            </div>
            {activeJobTitle ? (
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 sm:col-span-2">
                <dt className="text-xs font-semibold tracking-wide text-blue-200 uppercase">
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
                      <p className="mt-1 text-xs tabular-nums text-zinc-400">
                        {node.interval > 0
                          ? `${formatPrinterHours(node.hours)} из ${formatPrinterHours(node.interval)}`
                          : "Смазка не требуется: стержни чистят спиртом"}
                      </p>
                    </div>
                    {level === null ? (
                      <span className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-bold tracking-wide text-zinc-400 uppercase">
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
                  Для модели «{modelLabel || "без названия"}» отдельной инструкции
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
            ключ уходят только ему. Имя, бренд и модель правятся здесь же —
            интервалы обслуживания не меняются: их задают при добавлении
            принтера.
          </p>

          {/*
            Возможности протокола: что агент умеет с этим принтером. Набор из
            `PRINTER_PROTOCOL_CAPABILITIES` — зеркала `registry.py`, поэтому
            карточка не обещает кнопку, которой протокол не умеет: камеру не
            умеет ни один из восьми, отмену — все.
          */}
          <dl className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
            <dt className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
              Возможности протокола
            </dt>
            <dd
              data-printer-capabilities
              className="mt-1 text-sm leading-relaxed font-semibold text-white"
            >
              {formatPrinterCapabilities(
                PRINTER_PROTOCOL_CAPABILITIES[printer.protocolType],
              )}
            </dd>
            <dd className="mt-1 text-xs leading-relaxed text-zinc-400">
              Форматы печати:{" "}
              {PRINTER_UPLOAD_FORMATS[printer.protocolType].join(", ")}
            </dd>
          </dl>

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
            {/*
              «Карточка принтера»: имя, бренд и модель. Бренд с моделью нужны не
              для красоты — по ним проверка совместимости 3MF сверяет файл с
              профилем слайсера, а принтер из автообнаружения приходит с
              заглушкой «Неизвестно · Найден по сети». Поэтому блок стоит первым,
              а кнопка «Сохранить» внизу одна: визитка и подключение уходят одним
              `updatePrinter`, и введённое не теряется при переключении вкладок.
            */}
            <fieldset className="space-y-4 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-4">
              <legend className="px-1 text-xs font-semibold tracking-[0.16em] text-blue-300 uppercase">
                Карточка принтера
              </legend>

              <div>
                <label
                  htmlFor="printer-connection-name"
                  className={labelClassName}
                >
                  Имя
                </label>
                <input
                  id="printer-connection-name"
                  name="name"
                  type="text"
                  autoComplete="off"
                  required
                  maxLength={PRINTER_TEXT_LIMITS.name}
                  value={name}
                  onChange={(event) => setName(event.currentTarget.value)}
                  placeholder="Мой Ender"
                  aria-describedby="printer-connection-name-hint"
                  aria-invalid={fieldErrors.name ? true : undefined}
                  className={inputClassName}
                />
                <p id="printer-connection-name-hint" className={hintClassName}>
                  Как принтер называется в парке: по имени его ищут в заказах.
                </p>
                {fieldErrors.name ? (
                  <p className={fieldErrorClassName}>{fieldErrors.name}</p>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="printer-connection-brand"
                    className={labelClassName}
                  >
                    Бренд
                  </label>
                  <input
                    id="printer-connection-brand"
                    name="brand"
                    type="text"
                    autoComplete="off"
                    list="printer-details-brands"
                    required
                    maxLength={PRINTER_TEXT_LIMITS.brand}
                    value={brand}
                    onChange={(event) => handleBrandChange(event.currentTarget.value)}
                    placeholder="Bambu Lab"
                    aria-describedby="printer-connection-brand-hint"
                    aria-invalid={fieldErrors.brand ? true : undefined}
                    className={`${inputClassName}${
                      isBrandMissing ? " ring-1 ring-amber-500/50" : ""
                    }`}
                  />
                  <datalist id="printer-details-brands">
                    {PRINTER_BRAND_OPTIONS.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                  <p
                    id="printer-connection-brand-hint"
                    className={hintClassName}
                  >
                    Из списка или свой: по бренду и модели слайсер узнаёт
                    принтер.
                  </p>
                  {fieldErrors.brand ? (
                    <p className={fieldErrorClassName}>{fieldErrors.brand}</p>
                  ) : null}
                </div>

                <div>
                  <label
                    htmlFor="printer-connection-model"
                    className={labelClassName}
                  >
                    Модель
                  </label>
                  <select
                    id="printer-connection-model"
                    name="model"
                    required
                    value={model}
                    onChange={(event) => setModel(event.currentTarget.value)}
                    aria-describedby="printer-connection-model-hint"
                    aria-invalid={fieldErrors.model ? true : undefined}
                    className={`${inputClassName}${
                      isModelMissing ? " ring-1 ring-amber-500/50" : ""
                    }`}
                  >
                    <option value="">— выберите модель —</option>
                    {brandModels.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                    <option value={UNLISTED_PRINTER_MODEL}>
                      {UNLISTED_PRINTER_MODEL} — модели нет в справочнике
                    </option>
                  </select>
                  <div id="printer-connection-model-hint">
                    <PrinterModelHint
                      brand={brand}
                      model={model}
                      options={brandModels}
                      fallback="Модель из справочника: интервалы ТО и проверка 3MF берут профиль отсюда."
                    />
                  </div>
                  {fieldErrors.model ? (
                    <p className={fieldErrorClassName}>{fieldErrors.model}</p>
                  ) : null}
                </div>
              </div>

              {identityUnknown ? (
                <p
                  data-printer-identity-warning
                  className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-100"
                >
                  <span aria-hidden>⚠️ </span>
                  Без бренда и модели проверка совместимости 3MF не сработает:
                  выберите бренд и модель из списка — по ним файл сверяется с
                  профилем слайсера. Если модели нет в списке, выберите «
                  {UNLISTED_PRINTER_MODEL}
                  ».
                </p>
              ) : identityMismatch ? (
                <p
                  data-printer-identity-mismatch
                  className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-100"
                >
                  <span aria-hidden>⚠️ </span>
                  Модель «{model.trim()}» не из справочника бренда «
                  {brand.trim()}»: произвольные профили мы не принимаем — это
                  чужой профиль слайсера и чужие лимиты температур. Выберите
                  модель из списка.
                </p>
              ) : null}
            </fieldset>

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

            {/*
              Серийный номер спрашивается всегда, а не только у Bambu и FlashForge
              (`PRINTER_SERIAL_PROTOCOLS`): агент видит в сети лишь адрес и
              протокол, номер знает мастер, и если поля нет — вписать его негде.
              Bambu строит из него MQTT-топики `device/<SN>/…`, FlashForge
              отправляет заголовком каждого запроса, поэтому у обоих поле
              обязательное; у остальных протоколов оно просто пустое и сохранится
              на случай смены протокола на Bambu или FlashForge. Номер — не
              секрет: сохранённое значение показывается в поле.
            */}
            <div>
              <label
                htmlFor="printer-connection-serial"
                className={labelClassName}
              >
                Серийный номер (SN)
              </label>
              <input
                id="printer-connection-serial"
                name="serialNumber"
                type="text"
                autoComplete="off"
                spellCheck={false}
                maxLength={PRINTER_TEXT_LIMITS.serialNumber}
                defaultValue={printer.serialNumber ?? ""}
                placeholder={
                  spec.serialNumberRequired
                    ? "Номер с наклейки принтера"
                    : "00M09A123456789"
                }
                required={spec.serialNumberRequired}
                aria-describedby="printer-connection-serial-hint"
                aria-invalid={fieldErrors.serialNumber ? true : undefined}
                className={inputClassName}
              />
              <p id="printer-connection-serial-hint" className={hintClassName}>
                {spec.serialNumberRequired
                  ? printerSerialHint(protocol)
                  : "Этому протоколу номер не нужен: он обязателен для Bambu Lab и FlashForge. Оставьте пустым, если не знаете."}
              </p>
              {fieldErrors.serialNumber ? (
                <p className={fieldErrorClassName}>
                  {fieldErrors.serialNumber}
                </p>
              ) : null}
            </div>

            {/*
              Check Code — второй секрет FlashForge: принтер сверяет пару
              Serial Number + Check Code и без неё отвечает отказом на каждый
              запрос. Поле видно при любом протоколе (обязательным не помечено:
              секреты в браузер не возвращаются, и `required` заблокировал бы
              сохранение уже настроенного принтера), а подсказка говорит, кому
              оно нужно. Пустое поле — оставить сохранённое.
            */}
            <div>
              <label
                htmlFor="printer-connection-secret-checkCode"
                className={labelClassName}
              >
                {checkCodeField?.label ?? "Check Code"}
              </label>
              <input
                id="printer-connection-secret-checkCode"
                name="checkCode"
                type="password"
                autoComplete="new-password"
                spellCheck={false}
                maxLength={PRINTER_TEXT_LIMITS.apiKey}
                defaultValue=""
                placeholder={checkCodeField?.placeholder ?? "Код с экрана принтера"}
                aria-describedby={
                  fieldErrors.checkCode
                    ? "printer-connection-secret-checkCode-error"
                    : "printer-connection-secret-checkCode-hint"
                }
                aria-invalid={fieldErrors.checkCode ? true : undefined}
                className={inputClassName}
              />
              {fieldErrors.checkCode ? (
                <p
                  id="printer-connection-secret-checkCode-error"
                  className={fieldErrorClassName}
                >
                  {fieldErrors.checkCode}
                </p>
              ) : (
                <p
                  id="printer-connection-secret-checkCode-hint"
                  className={hintClassName}
                >
                  {checkCodeField
                    ? `${checkCodeField.hint} Пустое поле — оставить сохранённое.`
                    : "Нужен только FlashForge: он сверяет пару Serial Number + Check Code. Другим протоколам поле не требуется."}
                </p>
              )}
            </div>

            {spec.apiKey ? (
              <div>
                <label
                  htmlFor="printer-connection-key"
                  className={labelClassName}
                >
                  {spec.apiKey.label}
                </label>
                <input
                  id="printer-connection-key"
                  name="apiKey"
                  type="password"
                  autoComplete="new-password"
                  spellCheck={false}
                  maxLength={spec.apiKey.maxLength}
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
                  {spec.apiKey.hint} Ключ хранится как секрет и в браузер не
                  возвращается: пустое поле — оставить сохранённый.
                </p>
                {fieldErrors.apiKey ? (
                  <p className={fieldErrorClassName}>{fieldErrors.apiKey}</p>
                ) : null}
              </div>
            ) : null}

            {/*
              Остальные секреты протокола без своей колонки (`printer_secrets`):
              логин-пароль и Device ID/Mode ID Anycubic, Mainboard ID Elegoo,
              хранилище PrusaLink. Check Code сюда не входит — он нарисован выше
              отдельным полем и виден при любом протоколе. Поля всегда пустые —
              значения в браузер не возвращаются, поэтому подсказка обещает
              «пустое поле — оставить сохранённое», а Server Action накладывает
              введённое на старый объект. `key` включает протокол: при его смене
              поля пересоздаются, и секрет одного принтера не остаётся в форме
              другого.
            */}
            {otherSecrets.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {otherSecrets.map((field) => {
                  const fieldError = fieldErrors[field.key];
                  const fieldId = `printer-connection-secret-${field.key}`;
                  const describedBy = fieldError
                    ? `${fieldId}-error`
                    : `${fieldId}-hint`;

                  return (
                    <div key={`${protocol}-${field.key}`}>
                      <label htmlFor={fieldId} className={labelClassName}>
                        {field.label}
                      </label>
                      {field.options ? (
                        <select
                          id={fieldId}
                          name={field.key}
                          defaultValue=""
                          aria-describedby={describedBy}
                          aria-invalid={fieldError ? true : undefined}
                          className={inputClassName}
                        >
                          <option value="">Не менять</option>
                          {field.options.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id={fieldId}
                          name={field.key}
                          type={field.password ? "password" : "text"}
                          autoComplete={field.password ? "new-password" : "off"}
                          spellCheck={false}
                          maxLength={PRINTER_TEXT_LIMITS.apiKey}
                          defaultValue=""
                          placeholder={field.placeholder}
                          aria-describedby={describedBy}
                          aria-invalid={fieldError ? true : undefined}
                          className={inputClassName}
                        />
                      )}
                      {fieldError ? (
                        <p
                          id={`${fieldId}-error`}
                          className={fieldErrorClassName}
                        >
                          {fieldError}
                        </p>
                      ) : (
                        <p id={`${fieldId}-hint`} className={hintClassName}>
                          {field.hint} Пустое поле — оставить сохранённое.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 border-t border-white/5 pt-4">
              <button
                type="submit"
                disabled={isBusy}
                aria-busy={isSaving}
                data-printer-connection-save
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-4 text-xs font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-wait disabled:opacity-60"
              >
                {isSaving ? "Сохраняем…" : "Сохранить"}
              </button>
              <p className="text-xs text-zinc-400">
                После сохранения страница обновится: карточка покажет новое имя,
                бренд, модель и адрес.
              </p>
            </div>
          </form>
        </div>

        <div className="mt-6 border-t border-white/5 pt-5">
          <p className="text-sm font-semibold text-white">Удалить принтер</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            Принтер исчезнет из парка, и агент перестанет его опрашивать. Заказы
            останутся: ссылка на принтер в них просто станет пустой.
          </p>

          {deleteError ? (
            <p
              role="alert"
              data-printer-delete-error
              className="mt-3 rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm leading-relaxed text-red-100"
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
