"use client";

import { useRouter } from "next/navigation";
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  addPrinter,
  approveDiscoveredPrinters,
  fetchDiscoveredPrinters,
  requestNetworkScan,
} from "@/app/actions/printers";
import type { DiscoveredPrintersState } from "@/app/actions/printers-state";
import { emptyPrinterFormState } from "@/app/actions/printers-state";
import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";
import {
  isPrinterProtocol,
  type PrinterProtocol,
} from "@/lib/db/workshop-types";
import {
  PRINTER_BRAND_OPTIONS,
  PRINTER_PRESETS,
  findPrinterPresetByModel,
  formatPrinterPresetLabel,
} from "@/lib/workshop/printer-presets";
import {
  PRINTER_ADDRESS_MAX,
  PRINTER_INTERVAL_DEFAULTS,
  PRINTER_PROTOCOL_OPTIONS,
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
 * Пустой результат не тупик: рядом с «Искать снова» есть «Добавить вручную».
 * Сканер видит только свою подсеть, поэтому принтер из другого VLAN, принтер с
 * доступом по имени узла и выключенный во время обхода принтер находятся лишь
 * руками — форма `ManualPrinterForm` принимает адрес, протокол, бренд, модель,
 * SN и ключ доступа и вызывает то же действие `addPrinter`, что и окно парка.
 *
 * Выбор, имена и ключи доступа хранятся как «правки поверх умолчаний»: отмечено
 * всё, что в списке, имя по умолчанию — `Принтер 192.168.1.50`, ключ — пустой.
 * Поэтому обновление списка не ломает уже введённое: новые находки сразу видны и
 * отмечены, а правки старых строк остаются. Ключ вводится здесь, потому что
 * агент видит в сети только адрес и протокол: код доступа Bambu и ключ Moonraker
 * с авторизацией знает лишь мастер.
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

/** Список протоколов в ручной форме: та же рамка, что у полей, но с курсором. */
const selectClassName =
  "mt-2 w-full cursor-pointer rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors [color-scheme:dark] focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30 focus:ring-inset";

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

/**
 * Ручное добавление принтера, когда сканер ничего не нашёл.
 *
 * Агент видит сеть не всегда: принтер может стоять в другом VLAN, отвечать
 * только по имени узла или быть выключенным во время обхода. Тогда мастер
 * вводит адрес и данные подключения руками, а не уходит искать кнопку «Добавить
 * принтер» в другой вкладке.
 *
 * Форма намеренно повторяет поля окна «Добавить принтер»: то же действие
 * `addPrinter`, тот же разбор `readPrinterForm` и те же сообщения об ошибках,
 * поэтому принтер, добавленный здесь, не отличается от добавленного в парке.
 * Интервалы обслуживания уходят скрытыми полями: в мастере подключения их не
 * настраивают — для известной модели они берутся из справочника
 * `PRINTER_PRESETS`, иначе остаются значения по умолчанию миграции.
 *
 * Имя подставляется из адреса («Принтер 192.168.1.50») и перестаёт следовать за
 * ним, как только мастер его поправил: переписывать введённое значение на каждой
 * цифре было бы грубо.
 */
type ManualPrinterFormProps = {
  /** Итог: строка для тоста на вкладке «Принтеры»; окно закрывает родитель. */
  onCreated: (message: string) => void;
  /** Отказ: форма сворачивается, находки остаются на экране. */
  onCancel: () => void;
};

function ManualPrinterForm({ onCreated, onCancel }: ManualPrinterFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    addPrinter,
    emptyPrinterFormState,
  );
  const [name, setName] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [protocol, setProtocol] = useState<PrinterProtocol>("moonraker");

  /**
   * Интервалы обслуживания для известной модели: дальше их правят в карточке
   * принтера, а здесь они нужны только чтобы `readPrinterForm` принял черновик.
   */
  const preset = findPrinterPresetByModel(model);
  const nozzleInterval = preset?.nozzleHours ?? PRINTER_INTERVAL_DEFAULTS.nozzle;
  const lubricationInterval =
    preset?.lubricationHours ?? PRINTER_INTERVAL_DEFAULTS.lubrication;
  const zScrewInterval = preset?.zScrewHours ?? PRINTER_INTERVAL_DEFAULTS.zScrew;

  /**
   * Успех: страница обновляется, тост показывает результат, а окно закрывает
   * родитель тем же обработчиком, что и после подтверждения находок.
   */
  useEffect(() => {
    if (!state.success) {
      return;
    }

    router.refresh();
    onCreated(state.message ?? "Принтер добавлен.");
  }, [onCreated, router, state.message, state.success]);

  /** Адрес печатают первым: из него подставляется имя принтера. */
  function handleIpAddressChange(value: string) {
    const previousDefault = defaultDiscoveredPrinterName(ipAddress);
    const trimmed = value.trim();

    setIpAddress(value);
    setName((prev) =>
      prev === "" || prev === previousDefault
        ? trimmed
          ? defaultDiscoveredPrinterName(trimmed)
          : ""
        : prev,
    );
  }

  /**
   * Модель из справочника: подставляем бренд и интервалы. Введённый мастером
   * бренд не трогаем — «X1» не должен переписывать чужой бренд.
   */
  function handleModelChange(value: string) {
    setModel(value);

    const next = findPrinterPresetByModel(value);

    if (!next) {
      return;
    }

    if (!brand.trim()) {
      setBrand(next.brand);
    }

    setModel(next.model);
  }

  const nameError = state.fieldErrors?.name;
  const brandError = state.fieldErrors?.brand;
  const modelError = state.fieldErrors?.model;
  const ipAddressError = state.fieldErrors?.ipAddress;
  const apiKeyError = state.fieldErrors?.apiKey;
  const serialNumberError = state.fieldErrors?.serialNumber;

  return (
    <form
      action={formAction}
      autoComplete="off"
      className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-left sm:p-5"
    >
      <p className="text-sm font-semibold text-white">
        Добавить принтер вручную
      </p>
      <p className="mt-1 text-xs leading-relaxed text-zinc-400">
        Если агент принтер не увидел, введите адрес и данные подключения:
        принтер появится в парке, и агент сможет им управлять.
      </p>

      <input
        type="hidden"
        name="nozzleInterval"
        value={nozzleInterval}
        readOnly
      />
      <input
        type="hidden"
        name="lubricationInterval"
        value={lubricationInterval}
        readOnly
      />
      <input
        type="hidden"
        name="zScrewInterval"
        value={zScrewInterval}
        readOnly
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label
            htmlFor="farm-wizard-manual-name"
            className="text-xs font-semibold text-zinc-300"
          >
            Имя принтера
          </label>
          <input
            id="farm-wizard-manual-name"
            name="name"
            type="text"
            autoComplete="off"
            placeholder="Принтер 192.168.1.50"
            maxLength={PRINTER_TEXT_LIMITS.name}
            required
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            aria-invalid={nameError ? true : undefined}
            className={inputClassName}
          />
          {nameError ? (
            <p role="alert" className="mt-1.5 text-xs text-red-300">
              {nameError}
            </p>
          ) : null}
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor="farm-wizard-manual-address"
            className="text-xs font-semibold text-zinc-300"
          >
            Адрес или имя узла
          </label>
          <input
            id="farm-wizard-manual-address"
            name="ipAddress"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="192.168.1.50 или ender3.local"
            maxLength={PRINTER_ADDRESS_MAX}
            required
            value={ipAddress}
            onChange={(event) => handleIpAddressChange(event.currentTarget.value)}
            aria-invalid={ipAddressError ? true : undefined}
            className={inputClassName}
          />
          {ipAddressError ? (
            <p role="alert" className="mt-1.5 text-xs text-red-300">
              {ipAddressError}
            </p>
          ) : (
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
              Без «http://» и «/»: адрес вида 192.168.1.50 или ender3.local.
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="farm-wizard-manual-protocol"
            className="text-xs font-semibold text-zinc-300"
          >
            Протокол
          </label>
          <select
            id="farm-wizard-manual-protocol"
            name="protocol"
            value={protocol}
            onChange={(event) => {
              const next = event.currentTarget.value;

              if (isPrinterProtocol(next)) {
                setProtocol(next);
              }
            }}
            className={selectClassName}
          >
            {PRINTER_PROTOCOL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="farm-wizard-manual-brand"
            className="text-xs font-semibold text-zinc-300"
          >
            Бренд
          </label>
          <input
            id="farm-wizard-manual-brand"
            name="brand"
            type="text"
            autoComplete="off"
            list="farm-wizard-manual-brands"
            placeholder="Bambu Lab"
            maxLength={PRINTER_TEXT_LIMITS.brand}
            required
            value={brand}
            onChange={(event) => setBrand(event.currentTarget.value)}
            aria-invalid={brandError ? true : undefined}
            className={inputClassName}
          />
          <datalist id="farm-wizard-manual-brands">
            {PRINTER_BRAND_OPTIONS.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          {brandError ? (
            <p role="alert" className="mt-1.5 text-xs text-red-300">
              {brandError}
            </p>
          ) : null}
        </div>

        <div className={protocol === "bambu" ? undefined : "sm:col-span-2"}>
          <label
            htmlFor="farm-wizard-manual-model"
            className="text-xs font-semibold text-zinc-300"
          >
            Модель
          </label>
          <input
            id="farm-wizard-manual-model"
            name="model"
            type="text"
            autoComplete="off"
            list="farm-wizard-manual-models"
            placeholder="X1C"
            maxLength={PRINTER_TEXT_LIMITS.model}
            required
            value={model}
            onChange={(event) => handleModelChange(event.currentTarget.value)}
            aria-invalid={modelError ? true : undefined}
            className={inputClassName}
          />
          <datalist id="farm-wizard-manual-models">
            {PRINTER_PRESETS.map((item) => (
              <option
                key={`${item.brand}-${item.model}`}
                value={formatPrinterPresetLabel(item)}
              />
            ))}
          </datalist>
          {modelError ? (
            <p role="alert" className="mt-1.5 text-xs text-red-300">
              {modelError}
            </p>
          ) : (
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
              Из списка или своя: для известной модели интервалы ТО подставятся
              сами.
            </p>
          )}
        </div>

        {protocol === "bambu" ? (
          <div>
            <label
              htmlFor="farm-wizard-manual-serial"
              className="text-xs font-semibold text-zinc-300"
            >
              Серийный номер (SN)
            </label>
            <input
              id="farm-wizard-manual-serial"
              name="serialNumber"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="00M09A123456789"
              maxLength={PRINTER_TEXT_LIMITS.serialNumber}
              aria-invalid={serialNumberError ? true : undefined}
              className={inputClassName}
            />
            {serialNumberError ? (
              <p role="alert" className="mt-1.5 text-xs text-red-300">
                {serialNumberError}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="sm:col-span-2">
          <label
            htmlFor="farm-wizard-manual-key"
            className="text-xs font-semibold text-zinc-300"
          >
            Ключ доступа
          </label>
          <input
            id="farm-wizard-manual-key"
            name="apiKey"
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            maxLength={PRINTER_TEXT_LIMITS.apiKey}
            placeholder={
              protocol === "bambu"
                ? "Код доступа с экрана принтера"
                : "Ключ API, если принтер его требует"
            }
            aria-invalid={apiKeyError ? true : undefined}
            className={inputClassName}
          />
          {apiKeyError ? (
            <p role="alert" className="mt-1.5 text-xs text-red-300">
              {apiKeyError}
            </p>
          ) : (
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
              Необязательно. Ключ уходит только агенту и в интерфейс не
              возвращается.
            </p>
          )}
        </div>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="mt-4 rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-100"
        >
          {state.error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className={primaryButtonClassName}
        >
          {isPending ? "Добавляем…" : "Добавить принтер"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={secondaryButtonClassName}
        >
          Отмена
        </button>
      </div>
    </form>
  );
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
  /**
   * Ключи доступа, введённые мастером: ключ — адрес. Сеть ключей не знает, а без
   * них Moonraker с включённой авторизацией и Bambu (код доступа) не подпустят
   * агента. Пустое значение — «ключ не нужен».
   */
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
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
  /**
   * Ручное добавление поверх пустого результата: агент сеть не увидел, но мастер
   * знает адрес принтера — форма открывается здесь, а не в другой вкладке.
   */
  const [isManualOpen, setIsManualOpen] = useState(false);

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
  const apiKeyOf = (ipAddress: string) => apiKeys[ipAddress] ?? "";

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
        api_key: apiKeyOf(printer.ipAddress),
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
        ? "Принтеров в сети пока нет. Запустите агент фермы и повторите поиск — а если знаете адрес принтера, добавьте его вручную."
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
          <>
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
                {/*
                  Сканер не всегда прав: принтер бывает в другом VLAN, отвечает
                  по имени узла или просто выключен. Адрес мастер знает — пусть
                  введёт его здесь, а не ищет кнопку в соседней вкладке.
                */}
                <button
                  type="button"
                  onClick={() => setIsManualOpen((open) => !open)}
                  aria-expanded={isManualOpen}
                  aria-controls="farm-wizard-manual-form"
                  className={
                    isMissingTable
                      ? primaryButtonClassName
                      : secondaryButtonClassName
                  }
                >
                  {isManualOpen ? "Скрыть ручное добавление" : "Добавить вручную"}
                </button>
                <button
                  type="button"
                  onClick={closeUnlessPending}
                  className={secondaryButtonClassName}
                >
                  Закрыть
                </button>
              </div>
            </div>
            {isManualOpen ? (
              <div id="farm-wizard-manual-form">
                <ManualPrinterForm
                  onCreated={onApproved}
                  onCancel={() => setIsManualOpen(false)}
                />
              </div>
            ) : null}
          </>
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
                        <label
                          htmlFor={`${checkboxId}-key`}
                          className="sr-only"
                        >
                          Ключ доступа принтера {printer.ipAddress}
                        </label>
                        <input
                          id={`${checkboxId}-key`}
                          type="password"
                          autoComplete="new-password"
                          spellCheck={false}
                          maxLength={PRINTER_TEXT_LIMITS.apiKey}
                          disabled={!checked}
                          value={apiKeyOf(printer.ipAddress)}
                          onChange={(event) => {
                            const next = event.currentTarget.value;

                            setApiKeys((prev) => ({
                              ...prev,
                              [printer.ipAddress]: next,
                            }));
                          }}
                          placeholder={
                            printer.protocolType === "bambu"
                              ? "Код доступа с экрана принтера"
                              : "Ключ API, если принтер его требует"
                          }
                          aria-describedby={`${checkboxId}-key-hint`}
                          className={inputClassName}
                        />
                        <p
                          id={`${checkboxId}-key-hint`}
                          className="mt-1.5 text-xs leading-relaxed text-zinc-500"
                        >
                          Необязательно. Ключ уходит только агенту и в интерфейс
                          не возвращается.
                        </p>
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
