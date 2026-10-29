"use client";

import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useRef, useState } from "react";

import { addPrinter } from "@/app/actions/printers";
import { emptyPrinterFormState } from "@/app/actions/printers-state";
import { MaintenanceGuideDialog } from "@/components/workshop/MaintenanceGuideDialog";
import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";
import {
  isPrinterProtocol,
  type PrinterProtocol,
} from "@/lib/db/workshop-types";
import { getMaintenanceGuide } from "@/lib/workshop/maintenance-guides";
import {
  PRINTER_BRAND_OPTIONS,
  PRINTER_PRESETS,
  findPrinterPresetByModel,
  formatPrinterPresetLabel,
  normalizePrinterModel,
} from "@/lib/workshop/printer-presets";
import {
  PRINTER_ADDRESS_MAX,
  PRINTER_INTERVAL_DEFAULTS,
  PRINTER_INTERVAL_LIMITS,
  PRINTER_TEXT_LIMITS,
  formatPrinterHours,
} from "@/lib/workshop/printers";

/**
 * Окно «Добавить принтер».
 *
 * Бренд и модель — поля с `<datalist>`: можно выбрать модель из справочника
 * `PRINTER_PRESETS` или ввести свою. Для известной модели форма подставляет
 * интервалы обслуживания и показывает подсказку `note`, для своей — оставляет
 * значения по умолчанию. Интервалы можно поправить в любом случае.
 *
 * Ниже — данные подключения: протокол, SN для Bambu, IP-адрес и код доступа.
 * Без них агент фермы не знает, куда и как стучаться, и принтер, добавленный
 * руками, оставался бы карточкой без печати.
 *
 * Проверки живут в lib/workshop/printers.ts, здесь только разметка и ошибки,
 * которые вернул Server Action. После успеха окно закрывается, список
 * обновляется через router.refresh().
 */

type AddPrinterDialogProps = {
  onClose: () => void;
  /** Сообщение для строки состояния на вкладке. */
  onCreated: (message: string) => void;
};

/**
 * Протоколы в форме: агент управляет принтером по одному из трёх API.
 *
 * Порядок — от самого частого. В окне автообнаружения протокол только читают,
 * поэтому там подписи короче; здесь мастер выбирает, и подпись уточняет API:
 * «Moonraker (Klipper)» понятнее, чем «Moonraker».
 */
const PROTOCOL_OPTIONS: { value: PrinterProtocol; label: string }[] = [
  { value: "moonraker", label: "Moonraker (Klipper)" },
  { value: "octoprint", label: "OctoPrint" },
  { value: "bambu", label: "Bambu Lab (LAN)" },
];

const inputClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white outline-none transition-all duration-200 [appearance:textfield] placeholder:text-zinc-500 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30 focus:ring-inset [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

/** Список протоколов: та же рамка, что у полей, но с курсором и тёмной схемой. */
const selectClassName =
  "mt-2 w-full cursor-pointer rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white outline-none transition-all duration-200 [color-scheme:dark] focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30 focus:ring-inset";

export function AddPrinterDialog({
  onClose,
  onCreated,
}: AddPrinterDialogProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    addPrinter,
    emptyPrinterFormState,
  );
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [protocol, setProtocol] = useState<PrinterProtocol>("moonraker");
  const [nozzleInterval, setNozzleInterval] = useState(
    String(PRINTER_INTERVAL_DEFAULTS.nozzle),
  );
  const [lubricationInterval, setLubricationInterval] = useState(
    String(PRINTER_INTERVAL_DEFAULTS.lubrication),
  );
  const [zScrewInterval, setZScrewInterval] = useState(
    String(PRINTER_INTERVAL_DEFAULTS.zScrew),
  );
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const guideTriggerRef = useRef<HTMLButtonElement>(null);

  /**
   * Пока открыта инструкция, Escape должен закрывать только её. Обработчик
   * родительского окна остаётся подписанным, но ничего не делает.
   */
  const closeAddUnlessGuide = useCallback(() => {
    if (!isGuideOpen) {
      onClose();
    }
  }, [isGuideOpen, onClose]);

  useDialogDismiss(closeAddUnlessGuide);

  const closeGuide = useCallback(() => {
    setIsGuideOpen(false);
    guideTriggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!state.success) {
      return;
    }

    router.refresh();
    onCreated(state.message ?? "Принтер добавлен.");
    onClose();
  }, [onClose, onCreated, router, state.message, state.success]);

  const preset = findPrinterPresetByModel(model);
  const guide = preset
    ? getMaintenanceGuide(preset.brand, preset.model)
    : null;
  const nameError = state.fieldErrors?.name;
  const brandError = state.fieldErrors?.brand;
  const modelError = state.fieldErrors?.model;
  const serialNumberError = state.fieldErrors?.serialNumber;
  const ipAddressError = state.fieldErrors?.ipAddress;
  const apiKeyError = state.fieldErrors?.apiKey;
  const nozzleError = state.fieldErrors?.nozzleInterval;
  const lubricationError = state.fieldErrors?.lubricationInterval;
  const zScrewError = state.fieldErrors?.zScrewInterval;

  /**
   * Ввод модели: для известной модели подставляем бренд и интервалы, для своей
   * оставляем 400/300/720. Бренд не перезаписываем, если пользователь уже ввёл
   * свой: модель «X1» сама по себе не должна менять чужой бренд.
   */
  function handleModelChange(value: string) {
    setModel(value);
    setIsGuideOpen(false);

    const next = findPrinterPresetByModel(value);

    if (!next) {
      setNozzleInterval(String(PRINTER_INTERVAL_DEFAULTS.nozzle));
      setLubricationInterval(String(PRINTER_INTERVAL_DEFAULTS.lubrication));
      setZScrewInterval(String(PRINTER_INTERVAL_DEFAULTS.zScrew));
      return;
    }

    const typedBrand = normalizePrinterModel(brand);

    if (!typedBrand || normalizePrinterModel(value).startsWith(typedBrand)) {
      setBrand(next.brand);
    }

    setModel(next.model);
    setNozzleInterval(String(next.nozzleHours));
    setLubricationInterval(String(next.lubricationHours));
    setZScrewInterval(String(next.zScrewHours));
  }

  return (
    <div
      role="presentation"
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
        aria-labelledby="add-printer-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl shadow-black/60 sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-blue-400 uppercase">
              Принтеры
            </p>
            <h2
              id="add-printer-title"
              className="mt-3 text-2xl font-extrabold tracking-tight text-white"
            >
              Добавить принтер
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно добавления принтера"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-lg text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        <form
          action={formAction}
          autoComplete="off"
          className="mt-6 space-y-4"
        >
          <div>
            <label
              htmlFor="printer-name"
              className="block text-sm font-semibold text-slate-200"
            >
              Имя принтера
            </label>
            <input
              id="printer-name"
              name="name"
              type="text"
              autoComplete="new-password"
              placeholder="Мой Ender"
              maxLength={PRINTER_TEXT_LIMITS.name}
              required
              autoFocus
              aria-invalid={nameError ? true : undefined}
              aria-describedby={
                nameError ? "printer-name-error" : "printer-name-hint"
              }
              className={inputClassName}
            />
            {nameError ? (
              <p
                id="printer-name-error"
                role="alert"
                className="mt-1.5 text-sm text-red-300"
              >
                {nameError}
              </p>
            ) : (
              <p
                id="printer-name-hint"
                className="mt-1.5 text-xs leading-relaxed text-slate-400"
              >
                Как вы его называете: «Мой Ender», «Принтер в гараже».
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="printer-brand"
                className="block text-sm font-semibold text-slate-200"
              >
                Бренд
              </label>
              <input
                id="printer-brand"
                name="brand"
                type="text"
                autoComplete="off"
                list="printer-brands-list"
                placeholder="Bambu Lab"
                maxLength={PRINTER_TEXT_LIMITS.brand}
                required
                value={brand}
                onChange={(event) => setBrand(event.currentTarget.value)}
                aria-invalid={brandError ? true : undefined}
                aria-describedby={
                  brandError ? "printer-brand-error" : "printer-brand-hint"
                }
                className={inputClassName}
              />
              <datalist id="printer-brands-list">
                {PRINTER_BRAND_OPTIONS.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
              {brandError ? (
                <p
                  id="printer-brand-error"
                  role="alert"
                  className="mt-1.5 text-sm text-red-300"
                >
                  {brandError}
                </p>
              ) : (
                <p
                  id="printer-brand-hint"
                  className="mt-1.5 text-xs leading-relaxed text-slate-400"
                >
                  Начните вводить — подскажем известные бренды. Свой тоже можно.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="printer-model"
                className="block text-sm font-semibold text-slate-200"
              >
                Модель
              </label>
              <input
                id="printer-model"
                name="model"
                type="text"
                autoComplete="off"
                list="printer-models-list"
                placeholder="X1"
                maxLength={PRINTER_TEXT_LIMITS.model}
                required
                value={model}
                onChange={(event) => handleModelChange(event.currentTarget.value)}
                aria-invalid={modelError ? true : undefined}
                aria-describedby={
                  modelError ? "printer-model-error" : "printer-model-hint"
                }
                className={inputClassName}
              />
              <datalist id="printer-models-list">
                {PRINTER_PRESETS.map((item) => (
                  <option
                    key={`${item.brand}-${item.model}`}
                    value={formatPrinterPresetLabel(item)}
                  />
                ))}
              </datalist>
              {modelError ? (
                <p
                  id="printer-model-error"
                  role="alert"
                  className="mt-1.5 text-sm text-red-300"
                >
                  {modelError}
                </p>
              ) : (
                <p
                  id="printer-model-hint"
                  className="mt-1.5 text-xs leading-relaxed text-slate-400"
                >
                  Выберите из списка или введите свою — интервалы подставятся
                  автоматически для известной модели.
                </p>
              )}
            </div>
          </div>

          {/*
            Протокол выбирает мастер: от него зависит, каким API агент управляет
            принтером. Раньше протокол ставился только автообнаружением, и
            Bambu-принтер, добавленный руками, уходил в базу как Moonraker —
            агент стучался в него не тем API. Серийный номер нужен только Bambu,
            поэтому поле появляется вместе с этим протоколом и исчезает вместе
            с ним: у Moonraker и OctoPrint такого понятия нет.
          */}
          <div>
            <label
              htmlFor="printer-protocol"
              className="block text-sm font-semibold text-slate-200"
            >
              Протокол
            </label>
            <select
              id="printer-protocol"
              name="protocol"
              value={protocol}
              onChange={(event) => {
                const next = event.currentTarget.value;

                if (isPrinterProtocol(next)) {
                  setProtocol(next);
                }
              }}
              aria-describedby="printer-protocol-hint"
              className={selectClassName}
            >
              {PROTOCOL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p
              id="printer-protocol-hint"
              className="mt-1.5 text-xs leading-relaxed text-slate-400"
            >
              Как агент управляет принтером. Bambu работает в LAN-режиме: MQTT и
              FTPS, без облака.
            </p>
          </div>

          {protocol === "bambu" ? (
            <div>
              <label
                htmlFor="printer-serial-number"
                className="block text-sm font-semibold text-slate-200"
              >
                Серийный номер (SN)
              </label>
              <input
                id="printer-serial-number"
                name="serialNumber"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="00M09A123456789"
                maxLength={PRINTER_TEXT_LIMITS.serialNumber}
                aria-invalid={serialNumberError ? true : undefined}
                aria-describedby={
                  serialNumberError
                    ? "printer-serial-number-error"
                    : "printer-serial-number-hint"
                }
                className={inputClassName}
              />
              {serialNumberError ? (
                <p
                  id="printer-serial-number-error"
                  role="alert"
                  className="mt-1.5 text-sm text-red-300"
                >
                  {serialNumberError}
                </p>
              ) : (
                <p
                  id="printer-serial-number-hint"
                  className="mt-1.5 text-xs leading-relaxed text-slate-400"
                >
                  С наклейки на задней стенке. Можно оставить пустым — тогда
                  агент найдёт номер сам, поиском в сети.
                </p>
              )}
            </div>
          ) : null}

          {/*
            Данные подключения: их читает агент, а не интерфейс. Без адреса
            принтер в парке есть, а печатать не на чем, поэтому поле
            обязательное. Ключ необязателен — Moonraker и OctoPrint часто
            пускают без пароля, а у Bambu это 8-значный код доступа с экрана
            (LAN-режим). Поля не держат состояние: подсказка зависит только от
            протокола, а значения браузер отправляет как есть.
          */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="printer-ip-address"
                className="block text-sm font-semibold text-slate-200"
              >
                IP-адрес
              </label>
              <input
                id="printer-ip-address"
                name="ipAddress"
                type="text"
                autoComplete="off"
                spellCheck={false}
                required
                placeholder="192.168.1.50"
                maxLength={PRINTER_ADDRESS_MAX}
                aria-invalid={ipAddressError ? true : undefined}
                aria-describedby={
                  ipAddressError
                    ? "printer-ip-address-error"
                    : "printer-ip-address-hint"
                }
                className={inputClassName}
              />
              {ipAddressError ? (
                <p
                  id="printer-ip-address-error"
                  role="alert"
                  className="mt-1.5 text-sm text-red-300"
                >
                  {ipAddressError}
                </p>
              ) : (
                <p
                  id="printer-ip-address-hint"
                  className="mt-1.5 text-xs leading-relaxed text-slate-400"
                >
                  Адрес в сети мастерской: на экране принтера или в списке
                  клиентов роутера.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="printer-api-key"
                className="block text-sm font-semibold text-slate-200"
              >
                API-ключ / Код доступа
              </label>
              <input
                id="printer-api-key"
                name="apiKey"
                type="password"
                autoComplete="new-password"
                spellCheck={false}
                maxLength={PRINTER_TEXT_LIMITS.apiKey}
                aria-invalid={apiKeyError ? true : undefined}
                aria-describedby={
                  apiKeyError ? "printer-api-key-error" : "printer-api-key-hint"
                }
                className={inputClassName}
              />
              {apiKeyError ? (
                <p
                  id="printer-api-key-error"
                  role="alert"
                  className="mt-1.5 text-sm text-red-300"
                >
                  {apiKeyError}
                </p>
              ) : (
                <p
                  id="printer-api-key-hint"
                  className="mt-1.5 text-xs leading-relaxed text-slate-400"
                >
                  {protocol === "bambu"
                    ? "8-значный код доступа с экрана принтера. Хранится только для агента."
                    : "Оставьте пустым, если не требуется."}
                </p>
              )}
            </div>
          </div>

          {preset ? (
            <div
              aria-live="polite"
              className="rounded-2xl border border-blue-400/30 bg-blue-500/10 px-4 py-3"
            >
              <p className="text-xs font-semibold tracking-wide text-blue-200 uppercase">
                {preset.brand} {preset.model}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-200">
                {preset.note}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                Сопло — каждые {formatPrinterHours(preset.nozzleHours)}
                {preset.lubricationHours > 0
                  ? ` · смазка осей — каждые ${formatPrinterHours(preset.lubricationHours)}`
                  : " · смазка осей не требуется"}
                {` · винт Z — каждые ${formatPrinterHours(preset.zScrewHours)}`}
              </p>
              {guide ? (
                <button
                  ref={guideTriggerRef}
                  type="button"
                  onClick={() => setIsGuideOpen(true)}
                  aria-haspopup="dialog"
                  className="mt-3 inline-flex min-h-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] px-3.5 text-xs font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
                >
                  Инструкция по ТО
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="printer-nozzle-interval"
                className="block text-sm font-semibold text-slate-200"
              >
                Сопло, ч
              </label>
              <input
                id="printer-nozzle-interval"
                name="nozzleInterval"
                type="number"
                autoComplete="off"
                inputMode="numeric"
                step="1"
                min={PRINTER_INTERVAL_LIMITS.nozzleMin}
                max={PRINTER_INTERVAL_LIMITS.max}
                required
                value={nozzleInterval}
                onChange={(event) => setNozzleInterval(event.target.value)}
                aria-invalid={nozzleError ? true : undefined}
                aria-describedby={
                  nozzleError
                    ? "printer-nozzle-interval-error"
                    : "printer-nozzle-interval-hint"
                }
                className={inputClassName}
              />
              {nozzleError ? (
                <p
                  id="printer-nozzle-interval-error"
                  role="alert"
                  className="mt-1.5 text-sm text-red-300"
                >
                  {nozzleError}
                </p>
              ) : (
                <p
                  id="printer-nozzle-interval-hint"
                  className="mt-1.5 text-xs leading-relaxed text-slate-400"
                >
                  Через сколько часов менять сопло.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="printer-lubrication-interval"
                className="block text-sm font-semibold text-slate-200"
              >
                Смазка, ч
              </label>
              <input
                id="printer-lubrication-interval"
                name="lubricationInterval"
                type="number"
                autoComplete="off"
                inputMode="numeric"
                step="1"
                min={PRINTER_INTERVAL_LIMITS.lubricationMin}
                max={PRINTER_INTERVAL_LIMITS.max}
                required
                value={lubricationInterval}
                onChange={(event) =>
                  setLubricationInterval(event.target.value)
                }
                aria-invalid={lubricationError ? true : undefined}
                aria-describedby={
                  lubricationError
                    ? "printer-lubrication-interval-error"
                    : "printer-lubrication-interval-hint"
                }
                className={inputClassName}
              />
              {lubricationError ? (
                <p
                  id="printer-lubrication-interval-error"
                  role="alert"
                  className="mt-1.5 text-sm text-red-300"
                >
                  {lubricationError}
                </p>
              ) : (
                <p
                  id="printer-lubrication-interval-hint"
                  className="mt-1.5 text-xs leading-relaxed text-slate-400"
                >
                  0 — смазка не требуется, например у карбоновых стержней.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="printer-z-screw-interval"
                className="block text-sm font-semibold text-slate-200"
              >
                Винт Z, ч
              </label>
              <input
                id="printer-z-screw-interval"
                name="zScrewInterval"
                type="number"
                autoComplete="off"
                inputMode="numeric"
                step="1"
                min={PRINTER_INTERVAL_LIMITS.zScrewMin}
                max={PRINTER_INTERVAL_LIMITS.max}
                required
                value={zScrewInterval}
                onChange={(event) => setZScrewInterval(event.target.value)}
                aria-invalid={zScrewError ? true : undefined}
                aria-describedby={
                  zScrewError
                    ? "printer-z-screw-interval-error"
                    : "printer-z-screw-interval-hint"
                }
                className={inputClassName}
              />
              {zScrewError ? (
                <p
                  id="printer-z-screw-interval-error"
                  role="alert"
                  className="mt-1.5 text-sm text-red-300"
                >
                  {zScrewError}
                </p>
              ) : (
                <p
                  id="printer-z-screw-interval-hint"
                  className="mt-1.5 text-xs leading-relaxed text-slate-400"
                >
                  Через сколько часов смазывать винт Z.
                </p>
              )}
            </div>
          </div>

          {state.error ? (
            <p
              role="alert"
              className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100"
            >
              <span aria-hidden>⚠️ </span>
              {state.error}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <button
              type="submit"
              disabled={isPending}
              aria-busy={isPending}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Добавляем…" : "Добавить принтер"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-6 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>

      {isGuideOpen && preset && guide ? (
        <MaintenanceGuideDialog
          title={`${preset.brand} ${preset.model}`}
          guide={guide}
          onClose={closeGuide}
        />
      ) : null}
    </div>
  );
}
