"use client";

import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useRef, useState } from "react";

import { addPrinter } from "@/app/actions/printers";
import { emptyPrinterFormState } from "@/app/actions/printers-state";
import { MaintenanceGuideDialog } from "@/components/workshop/MaintenanceGuideDialog";
import { PrinterModelHint } from "@/components/workshop/PrinterModelHint";
import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";
import {
  isPrinterProtocol,
  type PrinterProtocol,
} from "@/lib/db/workshop-types";
import { getMaintenanceGuide } from "@/lib/workshop/maintenance-guides";
import {
  PRINTER_BRAND_OPTIONS,
  findPrinterPresetByModel,
  isPresetPrinterModel,
  printerModelOptions,
} from "@/lib/workshop/printer-presets";
import {
  PRINTER_ADDRESS_MAX,
  PRINTER_INTERVAL_DEFAULTS,
  PRINTER_INTERVAL_LIMITS,
  PRINTER_PROTOCOL_OPTIONS,
  PRINTER_TEXT_LIMITS,
  UNLISTED_PRINTER_MODEL,
  formatPrinterHours,
  isUnknownPrinterModel,
  printerConnectionSpec,
  printerSerialHint,
  type PrinterFormErrors,
} from "@/lib/workshop/printers";
import {
  PROBE_POLL_ATTEMPTS,
  PROBE_POLL_INTERVAL_MS,
  formatProbeCapabilities,
  formatProbeFormats,
  formatProbeHeadline,
  normalizeProbeResult,
  type PrinterProbeResult,
} from "@/lib/workshop/printer-probe";

/**
 * Результат кнопки «Проверить связь» в форме.
 *
 * `checking` — просьба в очереди, окно опрашивает ответ; `ready` — агент
 * ответил, но `result.ok` может быть false: отказ принтера (неверный код
 * доступа, принтер выключен) — тоже ответ, и мастер должен увидеть причину.
 */
type ProbeView =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ready"; result: PrinterProbeResult }
  | { status: "failed"; error: string };

/**
 * Ждать ответ агента: сервер отдаёт просьбу на ближайшем опросе (раз в пять
 * секунд), поэтому первый ответ обычно приходит через 5–10 секунд.
 *
 * Минута ожидания — предел: если агент не запущен, окно честно скажет об этом,
 * а не будет крутить «проверяем» бесконечно.
 */
async function waitForProbe(probeId: string): Promise<ProbeView> {
  for (let attempt = 0; attempt < PROBE_POLL_ATTEMPTS; attempt += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, PROBE_POLL_INTERVAL_MS);
    });

    const response = await fetch(
      `/api/agent/probe?probeId=${encodeURIComponent(probeId)}`,
      { cache: "no-store" },
    );
    const payload = (await response.json().catch(() => null)) as {
      status?: unknown;
      result?: unknown;
      error?: unknown;
    } | null;

    if (!response.ok) {
      return {
        status: "failed",
        error:
          typeof payload?.error === "string"
            ? payload.error
            : "Проверка не найдена: попробуйте ещё раз.",
      };
    }

    // pending и running — агент ещё не ответил; ждём дальше.
    if (payload?.status !== "done") {
      continue;
    }

    const result = normalizeProbeResult(payload.result);

    return result
      ? { status: "ready", result }
      : { status: "failed", error: "Агент ответил без паспорта принтера." };
  }

  return {
    status: "failed",
    error:
      "агент не ответил за минуту. Проверьте, что он запущен и видит принтер в сети.",
  };
}

/**
 * Окно «Добавить принтер».
 *
 * Бренд — поле с `<datalist>` (своя марка тоже бывает), а модель — строгий
 * `<select>` по справочнику `PRINTER_PRESETS`: в списке только то, что выпускает
 * выбранный бренд (`printerModelOptions`), поэтому «K1C» рядом с FlashForge не
 * появится, а вписать произвольный профиль нельзя. Профиль — это кинематика и
 * лимиты температур конкретного станка, и за выдуманный никто не отвечает;
 * сервер (`readPrinterIdentity`) отклоняет модель вне справочника, даже если
 * запрос подделан. Если модели нет в списке, выбирают пункт «Не указана»: тогда
 * проверка совместимости 3MF молчит, а не сверяет файл с чужим профилем.
 * Для модели из справочника форма подставляет интервалы обслуживания и
 * показывает подсказку `note`, для «Не указана» — оставляет значения по
 * умолчанию. Интервалы можно поправить в любом случае.
 *
 * Ниже — данные подключения: протокол, IP-адрес и поля, которые нужны именно
 * этому протоколу (`PRINTER_CONNECTION_SPECS`): ключ API или код доступа, SN,
 * `checkCode`, логин-пароль. Без них агент фермы не знает, куда и как стучаться,
 * и принтер, добавленный руками, оставался бы карточкой без печати.
 *
 * Кнопка «Проверить связь» отправляет ту же форму в `/api/agent/probe`: сервер
 * ставит просьбу в очередь, локальный агент проверяет принтер и возвращает
 * модель, SN и возможности. Так мастер видит «тот ли это принтер» до сохранения.
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
 * Подписи приходят из `PRINTER_PROTOCOL_OPTIONS`: тот же список показывает
 * карточка принтера, поэтому «Moonraker (Klipper)» называется одинаково в обоих
 * окнах — мастер выбирает и там, и там.
 */

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
  const formRef = useRef<HTMLFormElement>(null);
  const [probe, setProbe] = useState<ProbeView>({ status: "idle" });
  /**
   * Ошибки полей от проверки связи: сервер отвечает 422 с `fieldErrors`, когда
   * данные подключения не прошли `readConnectionFields()`. Показываем их под
   * теми же полями, что и ошибки сохранения, — иначе мастер видел бы общую
   * фразу «проверьте поля» и не знал, какую.
   */
  const [probeFieldErrors, setProbeFieldErrors] = useState<PrinterFormErrors>({});

  /**
   * «Проверить связь»: та же `FormData`, что уйдёт в Server Action, поэтому
   * сервер проверяет её тем же `readPrinterForm()`. Дальше окно опрашивает
   * результат: агент забирает просьбу на ближайшем опросе, ответ приходит не
   * сразу, и «проверяем» честно висит до него.
   */
  const handleProbe = useCallback(async () => {
    const form = formRef.current;

    if (!form) {
      return;
    }

    setProbe({ status: "checking" });
    setProbeFieldErrors({});

    try {
      const response = await fetch("/api/agent/probe", {
        method: "POST",
        body: new FormData(form),
      });
      const payload = (await response.json().catch(() => null)) as {
        probeId?: unknown;
        error?: unknown;
        fieldErrors?: unknown;
      } | null;
      const probeId = payload?.probeId;

      if (!response.ok || typeof probeId !== "string") {
        // `fieldErrors` — объект строк от `readPrinterProbeForm()`: ключи те же,
        // что у ошибок сохранения, поэтому подписи под полями менять не нужно.
        if (
          typeof payload?.fieldErrors === "object" &&
          payload.fieldErrors !== null
        ) {
          setProbeFieldErrors(payload.fieldErrors as PrinterFormErrors);
        }

        setProbe({
          status: "failed",
          error:
            typeof payload?.error === "string"
              ? payload.error
              : "Не удалось отправить проверку. Попробуйте ещё раз.",
        });

        return;
      }

      setProbe(await waitForProbe(probeId));
    } catch {
      setProbe({
        status: "failed",
        error: "сеть недоступна — проверьте подключение и попробуйте ещё раз.",
      });
    }
  }, []);

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
  /** Модели выбранного бренда: пункты `<select>` «Модель» строятся по ним. */
  const brandModels = printerModelOptions(brand);
  /** Поля подключения выбранного протокола: разметка и проверки из одного справочника. */
  const spec = printerConnectionSpec(protocol);
  const guide = preset
    ? getMaintenanceGuide(preset.brand, preset.model)
    : null;
  const nameError = state.fieldErrors?.name;
  const brandError = state.fieldErrors?.brand;
  const modelError = state.fieldErrors?.model;
  const serialNumberError =
    state.fieldErrors?.serialNumber ?? probeFieldErrors.serialNumber;
  const ipAddressError =
    state.fieldErrors?.ipAddress ?? probeFieldErrors.ipAddress;
  const apiKeyError = state.fieldErrors?.apiKey ?? probeFieldErrors.apiKey;
  const nozzleError = state.fieldErrors?.nozzleInterval;
  const lubricationError = state.fieldErrors?.lubricationInterval;
  const zScrewError = state.fieldErrors?.zScrewInterval;

  /**
   * Модель выбирают `<select>`-ом: значение приходит либо из справочника бренда,
   * либо «Не указана». Для модели из справочника подставляем бренд и интервалы
   * ТО, для «Не указана» оставляем значения по умолчанию — произвольного профиля
   * в форме больше нет.
   */
  function handleModelChange(value: string) {
    setModel(value);
    setIsGuideOpen(false);

    const next = isUnknownPrinterModel(value)
      ? null
      : findPrinterPresetByModel(value);

    if (!next) {
      resetIntervals();
      return;
    }

    setBrand(next.brand);
    setModel(next.model);
    setNozzleInterval(String(next.nozzleHours));
    setLubricationInterval(String(next.lubricationHours));
    setZScrewInterval(String(next.zScrewHours));
  }

  /** Интервалы по умолчанию: у выбранной модели справочник их не знает. */
  function resetIntervals() {
    setNozzleInterval(String(PRINTER_INTERVAL_DEFAULTS.nozzle));
    setLubricationInterval(String(PRINTER_INTERVAL_DEFAULTS.lubrication));
    setZScrewInterval(String(PRINTER_INTERVAL_DEFAULTS.zScrew));
  }

  /**
   * Бренд: список моделей сузился до выпускаемых им, поэтому модель другого
   * бренда сбрасывается вместе с интервалами — иначе в форме осталась бы пара,
   * которую сервер отклонит, а мастер не заметил бы подмены.
   *
   * Сравнение идёт по справочнику бренда и терпит недописанное название
   * (`findPrinterPresetsByBrand`): пока марку набирают по буквам, модель не
   * исчезает. «Не указана» смены бренда не боится — она ни к какому бренду не
   * привязана.
   */
  function handleBrandChange(value: string) {
    setBrand(value);
    setIsGuideOpen(false);

    if (
      !model ||
      isUnknownPrinterModel(model) ||
      isPresetPrinterModel(value, model)
    ) {
      return;
    }

    setModel("");
    resetIntervals();
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
          ref={formRef}
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
                onChange={(event) => handleBrandChange(event.currentTarget.value)}
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
              <select
                id="printer-model"
                name="model"
                required
                value={model}
                onChange={(event) => handleModelChange(event.currentTarget.value)}
                aria-invalid={modelError ? true : undefined}
                aria-describedby={
                  modelError ? "printer-model-error" : "printer-model-hint"
                }
                className={selectClassName}
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
              {modelError ? (
                <p
                  id="printer-model-error"
                  role="alert"
                  className="mt-1.5 text-sm text-red-300"
                >
                  {modelError}
                </p>
              ) : (
                <div id="printer-model-hint">
                  <PrinterModelHint
                    brand={brand}
                    model={model}
                    options={brandModels}
                    fallback="Модель из справочника: интервалы ТО подставятся сами, а проверка 3MF сверит профиль слайсера."
                  />
                </div>
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
                  // Результат пробы относится к прежнему протоколу: адрес и
                  // секреты другого API, поэтому плашка сбрасывается.
                  setProbe({ status: "idle" });
                }
              }}
              aria-describedby="printer-protocol-hint"
              className={selectClassName}
            >
              {PRINTER_PROTOCOL_OPTIONS.map((option) => (
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

          {spec.serialNumber ? (
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
                required={spec.serialNumberRequired}
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
                  {printerSerialHint(protocol)}
                </p>
              )}
            </div>
          ) : null}

          {/*
            Данные подключения: их читает агент, а не интерфейс. Без адреса
            принтер в парке есть, а печатать не на чем, поэтому поле
            обязательное. Остальные поля зависят от протокола
            (`PRINTER_CONNECTION_SPECS`): Moonraker пускает без ключа, OctoPrint
            требует всегда, Bambu спрашивает 8-значный код доступа, FlashForge —
            SN и Check Code, Anycubic — логин и пароль LAN-режима. Поля не
            держат состояние: подсказка зависит только от протокола, а значения
            браузер отправляет как есть.
          */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={spec.apiKey ? undefined : "sm:col-span-2"}>
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

            {spec.apiKey ? (
              <div key={`api-key-${protocol}`}>
                <label
                  htmlFor="printer-api-key"
                  className="block text-sm font-semibold text-slate-200"
                >
                  {spec.apiKey.label}
                </label>
                <input
                  id="printer-api-key"
                  name="apiKey"
                  type={spec.apiKey.password ? "password" : "text"}
                  autoComplete="new-password"
                  spellCheck={false}
                  maxLength={spec.apiKey.maxLength}
                  required={spec.apiKey.required}
                  placeholder={spec.apiKey.placeholder}
                  aria-invalid={apiKeyError ? true : undefined}
                  aria-describedby={
                    apiKeyError
                      ? "printer-api-key-error"
                      : "printer-api-key-hint"
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
                    {spec.apiKey.hint}
                  </p>
                )}
              </div>
            ) : null}
          </div>

          {/*
            Секреты протокола без своей колонки: checkCode FlashForge, логин и
            пароль Anycubic, хранилище PrusaLink. Уходят в `printer_secrets`
            (jsonb), в браузер не возвращаются. `key` включает протокол: при его
            смене поля пересоздаются, и пароль от одного принтера не остаётся в
            форме другого.
          */}
          {spec.secrets.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {spec.secrets.map((field) => {
                const error =
                  state.fieldErrors?.[field.key] ?? probeFieldErrors[field.key];

                return (
                  <div key={`${protocol}-${field.key}`}>
                    <label
                      htmlFor={`printer-secret-${field.key}`}
                      className="block text-sm font-semibold text-slate-200"
                    >
                      {field.label}
                    </label>
                    {field.options ? (
                      <select
                        id={`printer-secret-${field.key}`}
                        name={field.key}
                        defaultValue={field.fallback ?? field.options[0]?.value}
                        aria-describedby={
                          error
                            ? `printer-secret-${field.key}-error`
                            : `printer-secret-${field.key}-hint`
                        }
                        className={selectClassName}
                      >
                        {field.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={`printer-secret-${field.key}`}
                        name={field.key}
                        type={field.password ? "password" : "text"}
                        autoComplete={field.password ? "new-password" : "off"}
                        spellCheck={false}
                        maxLength={PRINTER_TEXT_LIMITS.apiKey}
                        required={field.required}
                        placeholder={field.placeholder}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={
                          error
                            ? `printer-secret-${field.key}-error`
                            : `printer-secret-${field.key}-hint`
                        }
                        className={inputClassName}
                      />
                    )}
                    {error ? (
                      <p
                        id={`printer-secret-${field.key}-error`}
                        role="alert"
                        className="mt-1.5 text-sm text-red-300"
                      >
                        {error}
                      </p>
                    ) : (
                      <p
                        id={`printer-secret-${field.key}-hint`}
                        className="mt-1.5 text-xs leading-relaxed text-slate-400"
                      >
                        {field.hint}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}

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

          {probe.status === "checking" ? (
            <p
              role="status"
              className="rounded-2xl border border-blue-400/30 bg-blue-500/10 px-4 py-3 text-sm leading-relaxed text-blue-100"
            >
              <span aria-hidden>⏳ </span>
              Агент проверяет принтер… Ответ обычно приходит за 5–10 секунд.
            </p>
          ) : null}

          {probe.status === "failed" ? (
            <p
              role="alert"
              className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-100"
            >
              <span aria-hidden>⚠️ </span>
              Принтер недоступен: {probe.error}
            </p>
          ) : null}

          {probe.status === "ready" ? (
            <div
              role="status"
              data-printer-probe
              className={
                probe.result.ok
                  ? "rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm leading-relaxed text-emerald-100"
                  : "rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-100"
              }
            >
              <p className="font-semibold">
                <span aria-hidden>{probe.result.ok ? "✓ " : "⚠️ "}</span>
                {probe.result.ok
                  ? formatProbeHeadline(probe.result)
                  : `Принтер не ответил: ${probe.result.error ?? "причина неизвестна"}`}
              </p>
              <p className="mt-1 text-xs leading-relaxed">
                {formatProbeCapabilities(probe.result.capabilities)}
              </p>
              {formatProbeFormats(probe.result) ? (
                <p className="mt-1 text-xs leading-relaxed">
                  Форматы: {formatProbeFormats(probe.result)}
                </p>
              ) : null}
              {probe.result.ok && probe.result.error ? (
                <p className="mt-1 text-xs leading-relaxed">
                  {probe.result.error}
                </p>
              ) : null}
            </div>
          ) : null}

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
              onClick={handleProbe}
              disabled={isPending || probe.status === "checking"}
              aria-busy={probe.status === "checking"}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-blue-400/40 bg-blue-500/10 px-5 text-sm font-semibold text-blue-100 transition-colors hover:border-blue-400/60 hover:bg-blue-500/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-wait disabled:opacity-60"
            >
              {probe.status === "checking" ? "Проверяем…" : "Проверить связь"}
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
