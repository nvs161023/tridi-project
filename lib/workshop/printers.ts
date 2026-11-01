/**
 * Принтеры Мастерской: модель для интерфейса, пределы полей, разбор формы и
 * расчёт обслуживания.
 *
 * Те же три места, что у настроек и склада: форма проверяет ввод этими
 * пределами, Server Action — теми же функциями, а
 * `supabase/workshop_printers_orders.sql` повторяет их в check-ограничениях.
 * Расхождение означало бы, что форма пропустит число, которое база отклонит.
 *
 * Интервал смазки может быть нулевым — это «смазывать нечего»: у Bambu Lab
 * карбоновые стержни чистят спиртом, а не смазывают. Интервалы сопла и винта Z
 * нулевыми быть не могут: на них делят процент износа.
 */
import { printFileExtension } from "@/lib/3d/print-compatibility";
import {
  isPrinterProtocol,
  type PrinterProtocol,
  type PrinterSecrets,
} from "@/lib/db/workshop-types";
import {
  formatWorkshopLimit,
  parseWorkshopNumber,
} from "@/lib/workshop/settings";

/** Состояния принтера, которые пишет агент фермы (check в workshop_farm_and_shop.sql). */
export const PRINTER_FARM_STATUSES = [
  "idle",
  "printing",
  "paused",
  "error",
  "offline",
] as const;

export type PrinterFarmStatus = (typeof PRINTER_FARM_STATUSES)[number];

export function isPrinterFarmStatus(value: unknown): value is PrinterFarmStatus {
  return (
    typeof value === "string" &&
    (PRINTER_FARM_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Текущие заказы принтеров: `printer_id` → название заказа.
 *
 * Заголовок берётся из связи `workshop_print_jobs` → `workshop_orders`, поэтому
 * серверная страница собирает карту сама, а карточка только показывает строку.
 */
export type PrinterActiveJobs = Record<string, string>;

/**
 * Причина последнего отказа принтера: `printer_id` → текст от агента.
 *
 * Хранится не в `workshop_printers`, а в `workshop_print_jobs.last_error`
 * последнего задания с `status = 'failed'`: агент пишет туда словами протокола
 * («Bambu: неверный Access Code»), и карточка показывает ту же фразу, а не
 * «печать не удалась». Карта собирается на сервере: карточке не нужен список
 * заданий, ей нужна одна строка на принтер.
 */
export type PrinterLastErrors = Record<string, string>;

/** Принтер в том виде, в каком с ним работает интерфейс. */
export type WorkshopPrinter = {
  id: string;
  /** Имя от пользователя: «Мой Ender». */
  name: string;
  brand: string;
  model: string;
  totalHours: number;
  nozzleHours: number;
  nozzleInterval: number;
  lubricationHours: number;
  lubricationInterval: number;
  zScrewHours: number;
  zScrewInterval: number;
  /** Дата последнего обслуживания в формате ГГГГ-ММ-ДД. */
  lastMaintenanceDate: string | null;
  /** Состояние от агента фермы; idle — печати нет. */
  status: PrinterFarmStatus;
  /** Прогресс текущей печати, % (0…100). */
  progress: number;
  /** Остаток текущей печати в секундах; 0 — печати нет. */
  remainingTime: number;
  /** Когда агент последний раз получил ответ; null — ещё ни разу. */
  lastSeenAt: string | null;
  /**
   * Серийный номер Bambu Lab (SN); null — не задан.
   *
   * По нему агент строит MQTT-топики device/<serial>/…, поэтому без него
   * Bambu-принтер приходится искать в сети (SSDP). У Moonraker и OctoPrint
   * такого понятия нет.
   */
  serialNumber: string | null;
  /** Чем агент управляет принтером: moonraker, octoprint или bambu. */
  protocolType: PrinterProtocol;
  /**
   * Адрес в локальной сети; null — не задан.
   *
   * Нужен не только агенту, но и карточке: форма «Подключение» правит адрес,
   * протокол и ключ по текущим значениям. Без миграции
   * `supabase/workshop_farm_and_shop.sql` колонки нет, поле показывается пустым,
   * и сохранение попросит адрес заново.
   */
  ipAddress: string | null;
  createdAt: string | null;
};

/** Проверенный ввод формы «Добавить принтер». */
export type PrinterDraft = {
  name: string;
  brand: string;
  model: string;
  /** Чем агент управляет принтером; Bambu добавляет к этому SN и LAN-режим. */
  protocolType: PrinterProtocol;
  /** SN для Bambu; пустая строка — поле скрыто или его не заполнили. */
  serialNumber: string;
  /** Адрес в локальной сети: без него агенту некуда подключаться. */
  ipAddress: string;
  /**
   * Ключ API (Moonraker/OctoPrint) или код доступа Bambu; пустая строка — не
   * задан, в базе это null. Секрет: уходит только агенту.
   */
  apiKey: string;
  /**
   * Поля протокола без своей колонки — то, что уходит в
   * `workshop_printers.printer_secrets` (jsonb): `checkCode` FlashForge,
   * логин-пароль и `deviceId`/`modeId` Anycubic, `mainboardId` Elegoo,
   * `storage` PrusaLink. Пустой объект — у протокола таких полей нет.
   */
  printerSecrets: PrinterSecrets;
  nozzleInterval: number;
  lubricationInterval: number;
  zScrewInterval: number;
};

/** Ошибки по полям формы: подсказка стоит рядом с виновным полем. */
export type PrinterFormErrors = Partial<
  Record<
    | "name"
    | "brand"
    | "model"
    | "protocol"
    | "serialNumber"
    | "ipAddress"
    | "apiKey"
    | "nozzleInterval"
    | "lubricationInterval"
    | "zScrewInterval"
    | PrinterSecretKey,
    string
  >
>;

/**
 * Базовые колонки парка — без живых полей агента.
 *
 * Нужны как запасной запрос: миграцию `supabase/workshop_farm_and_shop.sql`
 * применяют вручную, и без неё колонок status/progress/remaining_time/last_seen_at
 * в базе ещё нет. Тогда парк читается этим набором, а карточки показывают
 * обслуживание без метки состояния.
 */
export const PRINTER_BASE_COLUMNS =
  "id, name, brand, model, total_hours, nozzle_hours, nozzle_interval, lubrication_hours, lubrication_interval, z_screw_hours, z_screw_interval, last_maintenance_date, created_at";

/**
 * Колонки, которые читает lib/workshop/printer-store.ts: парк плюс живые поля
 * агента. serial_number, protocol_type и ip_address живут там же: их добавляет
 * та же миграция, а при её отсутствии printer-store перечитывает парк через
 * PRINTER_BASE_COLUMNS — карточка тогда покажет подключение пустым.
 */
export const PRINTER_COLUMNS = `${PRINTER_BASE_COLUMNS}, status, progress, remaining_time, last_seen_at, serial_number, protocol_type, ip_address`;

/** Пределы текстовых полей — как у колонок text в миграции. */
export const PRINTER_TEXT_LIMITS = {
  name: 60,
  brand: 40,
  model: 60,
  /** Серийный номер Bambu: check в workshop_farm_and_shop.sql — 1…64 символа. */
  serialNumber: 64,
  /** Ключ API / код доступа: check в workshop_farm_and_shop.sql — 1…512 символов. */
  apiKey: 512,
} as const;

/** Пределы интервалов обслуживания, ч. */
export const PRINTER_INTERVAL_LIMITS = {
  nozzleMin: 1,
  lubricationMin: 0,
  zScrewMin: 1,
  max: 10000,
} as const;

/** Интервалы по умолчанию — как в SQL, если модель не выбрана. */
export const PRINTER_INTERVAL_DEFAULTS = {
  nozzle: 400,
  lubrication: 300,
  zScrew: 720,
} as const;

/** Предел наработки: numeric(12, 2) с запасом на годы печати. */
export const PRINTER_HOURS_MAX = 1000000;

/**
 * Варианты `<select>` протокола: «Moonraker (Klipper)» понятнее, чем «Moonraker».
 *
 * Список один на форму добавления и на карточку принтера: две копии подписей
 * разъехались бы, и один и тот же протокол назывался бы по-разному.
 */
export const PRINTER_PROTOCOL_OPTIONS: readonly {
  value: PrinterProtocol;
  label: string;
}[] = [
  { value: "moonraker", label: "Moonraker (Klipper)" },
  { value: "octoprint", label: "OctoPrint" },
  { value: "bambu", label: "Bambu Lab (LAN)" },
  { value: "prusa", label: "Prusa (PrusaLink)" },
  { value: "creality", label: "Creality (K1 / K2 / Hi)" },
  { value: "anycubic", label: "Anycubic (Kobra)" },
  { value: "flashforge", label: "FlashForge (Adventurer)" },
  { value: "elegoo", label: "Elegoo (Centauri Carbon)" },
];

/**
 * Протоколы, которым нужен серийный номер принтера.
 *
 * Bambu адресует им MQTT-топики (`device/<serial>/report`), FlashForge
 * отправляет его заголовком `serialNumber` в каждом запросе. Остальным SN не
 * нужен: чужое значение в базе означало бы номер, который агент подставил бы в
 * адрес другого протокола.
 */
export const PRINTER_SERIAL_PROTOCOLS: readonly PrinterProtocol[] = [
  "bambu",
  "flashforge",
];

/** Ждёт ли этот протокол серийный номер в форме подключения. */
export function isPrinterSerialProtocol(value: PrinterProtocol): boolean {
  return PRINTER_SERIAL_PROTOCOLS.includes(value);
}

/** Подпись протокола для интерфейса: «Moonraker (Klipper)». */
export function formatPrinterProtocol(value: PrinterProtocol): string {
  return (
    PRINTER_PROTOCOL_OPTIONS.find((option) => option.value === value)?.label ??
    value
  );
}

/**
 * Имена полей `workshop_printers.printer_secrets`, которые спрашивает форма.
 *
 * Совпадают с `secrets` в `agent/adapters/registry.py`: адаптер читает ровно эти
 * ключи, и переименование в форме оставило бы его без `checkCode` или пароля.
 * `clientCert`/`clientKey`/`caCert` Anycubic (mTLS) в форме не показываются:
 * прошивки Kobra их не требуют, а файл сертификата в браузере не выбрать.
 */
export type PrinterSecretKey =
  | "checkCode"
  | "username"
  | "password"
  | "deviceId"
  | "modeId"
  | "mainboardId"
  | "storage";

/**
 * Поле формы, которое уходит не в колонку, а в `printer_secrets`.
 *
 * `required` — без значения принтер откажет на первом же запросе (FlashForge
 * сверяет `checkCode`), `fallback` — что записать, если поле оставили пустым
 * (PrusaLink без `storage` не соберёт адрес файла, а `usb` — его значение по
 * умолчанию).
 */
export type PrinterSecretField = {
  key: PrinterSecretKey;
  label: string;
  placeholder: string;
  hint: string;
  required: boolean;
  /** Поле-пароль: браузер не должен показывать и запоминать значение. */
  password?: boolean;
  /** Список вместо текста (`storage`). */
  options?: readonly { value: string; label: string }[];
  /** Значение по умолчанию, если поле оставили пустым. */
  fallback?: string;
};

/**
 * Поле ключа доступа: у Moonraker и OctoPrint это ключ API, у Bambu — код с
 * экрана принтера. `null` — протоколу поле не нужно (Creality, FlashForge,
 * Elegoo, Anycubic спрашивают своё — пароль или `checkCode`).
 */
export type PrinterApiKeyField = {
  label: string;
  placeholder: string;
  hint: string;
  required: boolean;
  maxLength: number;
  /** Ровно столько символов (8 у Access Code Bambu); 0 — без проверки. */
  exactLength?: number;
  /** Скрывать ввод: пароль, а не ключ, который копируют с экрана. */
  password?: boolean;
};

/**
 * Что форма спрашивает у выбранного протокола.
 *
 * Один справочник на разметку и на разбор: `readPrinterForm()` проверяет те же
 * поля, что рисует окно «Добавить принтер», поэтому подпись и проверка не
 * разъедутся. `serialNumberRequired` отдельно от `serialNumber`: SN нужен Bambu
 * и FlashForge, но у Bambu адаптер находит номер сам (SSDP), а FlashForge
 * отправляет его заголовком каждого запроса — без номера он не ответит.
 */
export type PrinterConnectionSpec = {
  apiKey: PrinterApiKeyField | null;
  serialNumber: boolean;
  serialNumberRequired: boolean;
  secrets: readonly PrinterSecretField[];
};

/**
 * Поля подключения по протоколам — в порядке `PRINTER_PROTOCOL_OPTIONS`.
 *
 * Правило одно: колонка `api_key` — для первичного секрета (ключ API, код
 * доступа, пароль), `printer_secrets` — для остального. У Anycubic пароль уходит
 * в `printer_secrets.password`, а не в `api_key`: адаптер читает оба поля, но
 * форма обещает «логин и пароль в секретах», и одно поле в двух колонках путало
 * бы карточку.
 */
export const PRINTER_CONNECTION_SPECS: Record<
  PrinterProtocol,
  PrinterConnectionSpec
> = {
  moonraker: {
    apiKey: {
      label: "API-ключ",
      placeholder: "Необязательно",
      hint: "Klipper часто пускает без ключа. Если Moonraker его требует — вставьте ключ из moonraker.conf.",
      required: false,
      maxLength: PRINTER_TEXT_LIMITS.apiKey,
    },
    serialNumber: false,
    serialNumberRequired: false,
    secrets: [],
  },
  octoprint: {
    apiKey: {
      label: "API-ключ",
      placeholder: "A1B2C3D4E5F6…",
      hint: "Обязателен: OctoPrint не принимает запросы без ключа. Ключ лежит в Settings → API Key.",
      required: true,
      maxLength: PRINTER_TEXT_LIMITS.apiKey,
    },
    serialNumber: false,
    serialNumberRequired: false,
    secrets: [],
  },
  bambu: {
    apiKey: {
      label: "Access Code",
      placeholder: "12345678",
      hint: "8 символов с экрана принтера (LAN-режим). Без него Bambu не пустит ни по MQTT, ни по FTPS.",
      required: true,
      maxLength: 8,
      exactLength: 8,
    },
    serialNumber: true,
    serialNumberRequired: false,
    secrets: [],
  },
  prusa: {
    apiKey: {
      label: "API-ключ",
      placeholder: "Пароль из PrusaLink",
      hint: "PrusaLink спрашивает пару логин-пароль: логин — maker, ключ — пароль из Settings → PrusaLink.",
      required: false,
      maxLength: PRINTER_TEXT_LIMITS.apiKey,
      password: true,
    },
    serialNumber: false,
    serialNumberRequired: false,
    secrets: [
      {
        key: "storage",
        label: "Хранилище",
        placeholder: "",
        hint: "Куда PrusaLink кладёт файл: флешка (usb) или внутренняя память (local).",
        required: false,
        fallback: "usb",
        options: [
          { value: "usb", label: "USB-флешка" },
          { value: "local", label: "Внутренняя память" },
        ],
      },
    ],
  },
  creality: {
    apiKey: null,
    serialNumber: false,
    serialNumberRequired: false,
    secrets: [],
  },
  anycubic: {
    apiKey: null,
    serialNumber: false,
    serialNumberRequired: false,
    secrets: [
      {
        key: "username",
        label: "Логин",
        placeholder: "anycubic",
        hint: "Логин LAN-режима. Пустое поле — логин по умолчанию anycubic.",
        required: false,
      },
      {
        key: "password",
        label: "Пароль",
        placeholder: "Пароль LAN-режима",
        hint: "Пароль, который принтер показывает в LAN-режиме. Без него брокер 9883 не пустит.",
        required: true,
        password: true,
      },
      {
        key: "deviceId",
        label: "Device ID",
        placeholder: "Необязательно",
        hint: "Адрес MQTT-топиков. Обычно принтер сообщает его сам; заполняйте, если бродкаст в сети запрещён.",
        required: false,
      },
      {
        key: "modeId",
        label: "Mode ID",
        placeholder: "Необязательно",
        hint: "Второй адрес топиков. Тоже приходит от принтера — нужен только в сети без бродкаста.",
        required: false,
      },
    ],
  },
  flashforge: {
    apiKey: null,
    serialNumber: true,
    serialNumberRequired: true,
    secrets: [
      {
        key: "checkCode",
        label: "Check Code",
        placeholder: "Код с наклейки",
        hint: "Код проверки печатается на наклейке принтера. Без него FlashForge отвечает отказом на каждый запрос.",
        required: true,
      },
    ],
  },
  elegoo: {
    apiKey: null,
    serialNumber: false,
    serialNumberRequired: false,
    secrets: [
      {
        key: "mainboardId",
        label: "Mainboard ID",
        placeholder: "Необязательно",
        hint: "Номер платы для топика sdcp/request. Обычно приходит в ответе M99999 — заполняйте, если бродкаст запрещён.",
        required: false,
      },
    ],
  },
};

/** Поля подключения выбранного протокола: их рисует форма и проверяет разбор. */
export function printerConnectionSpec(
  protocol: PrinterProtocol,
): PrinterConnectionSpec {
  return PRINTER_CONNECTION_SPECS[protocol];
}

/**
 * Возможности протокола — зеркало `capabilities` из `agent/adapters/registry.py`.
 *
 * Ключи те же, что у `CAPABILITY_*` в `agent/adapters/base.py`: по ним агент
 * решает, показывать ли кнопку паузы и отправлять ли команду отмены. Карточка
 * принтера показывает набор целиком (✓/✗), чтобы мастер видел не только «что
 * умеет», но и «чего этот протокол не умеет»: камеру не умеет ни один из
 * восьми, а отмену — все.
 *
 * Таблица, а не вычисление из одного набора: у протокола может появиться своя
 * особенность (как у Bambu с контейнером `.3mf`), и тогда правка будет в одной
 * строке, а не в условии по всему файлу.
 */
export const PRINTER_CAPABILITY_LABELS: readonly {
  key: string;
  label: string;
}[] = [
  { key: "upload", label: "Загрузка файла" },
  { key: "start", label: "Печать" },
  { key: "status", label: "Состояние" },
  { key: "pause", label: "Пауза" },
  { key: "resume", label: "Продолжить" },
  { key: "cancel", label: "Отмена" },
  { key: "camera", label: "Камера" },
];

/** Минимум, который обязан уметь любой протокол: файл, старт и состояние. */
const PRINTER_BASE_CAPABILITIES: readonly string[] = [
  "upload",
  "start",
  "status",
];

/** Полный контроль над заданием: плюс пауза, возврат и отмена. */
const PRINTER_CONTROL_CAPABILITIES: readonly string[] = [
  ...PRINTER_BASE_CAPABILITIES,
  "pause",
  "resume",
  "cancel",
];

/** Набор возможностей по протоколам — в порядке `PRINTER_PROTOCOLS`. */
export const PRINTER_PROTOCOL_CAPABILITIES: Record<
  PrinterProtocol,
  readonly string[]
> = {
  moonraker: PRINTER_CONTROL_CAPABILITIES,
  octoprint: PRINTER_CONTROL_CAPABILITIES,
  bambu: PRINTER_CONTROL_CAPABILITIES,
  prusa: PRINTER_CONTROL_CAPABILITIES,
  creality: PRINTER_CONTROL_CAPABILITIES,
  anycubic: PRINTER_CONTROL_CAPABILITIES,
  flashforge: PRINTER_CONTROL_CAPABILITIES,
  elegoo: PRINTER_CONTROL_CAPABILITIES,
};

/**
 * «Печать ✓ · Пауза ✗ · Камера ✗» — все возможности протокола, а не только
 * объявленные.
 */
export function formatPrinterCapabilities(
  capabilities: readonly string[],
): string {
  return PRINTER_CAPABILITY_LABELS.map(
    ({ key, label }) => `${label} ${capabilities.includes(key) ? "✓" : "✗"}`,
  ).join(" · ");
}

/**
 * Форматы файлов печати по протоколам.
 *
 * Наборы совпадают с `formats` в `agent/adapters/registry.py`. Матрица нужна
 * интерфейсу, чтобы отказать до постановки в очередь: агент всё равно сверит
 * формат перед загрузкой (`agent/adapters/formats.py`) и напишет причину в
 * журнал задания, но мастер увидит её только после того, как задание уйдёт на
 * принтер.
 *
 * Bambu принимает `.gcode`, потому что упаковывает его в контейнер `.3mf` сам;
 * FlashForge берёт `.3mf`, но только с готовым G-code внутри. PrusaLink `.3mf`
 * не печатает: проект PrusaSlicer уходит на принтер как `.gcode` или `.bgcode`.
 */
export const PRINTER_UPLOAD_FORMATS: Record<
  PrinterProtocol,
  readonly string[]
> = {
  moonraker: [".gcode", ".gco", ".g"],
  octoprint: [".gcode", ".gco", ".g"],
  bambu: [".3mf", ".gcode"],
  prusa: [".gcode", ".bgcode"],
  creality: [".gcode"],
  anycubic: [".gcode"],
  flashforge: [".gcode", ".3mf"],
  elegoo: [".gcode"],
};

/** Итог проверки файла печати: `ok` — принтер возьмёт файл в работу. */
export type PrintFileCheck = { ok: true } | { ok: false; reason: string };

/** Перечисление форматов для текста отказа: «.gcode, .gco или .g». */
function formatPrintFormats(formats: readonly string[]): string {
  if (formats.length <= 1) {
    return formats[0] ?? "";
  }

  return `${formats.slice(0, -1).join(", ")} или ${formats[formats.length - 1]}`;
}

/**
 * Печатает ли принтер с этим протоколом такой файл.
 *
 * Проверка одна для карточки заказа и Server Action: карточка гасит кнопку
 * заранее, а `queueOrderForPrint` повторяет её — страница могла устареть.
 *
 * Причина отказа — фраза для мастера, а не код: «Prusa (PrusaLink) не печатает
 * .3mf — переслайсите в .gcode или .bgcode». Для STL текст отдельный: это
 * модель, а не задание печати, и её нужно сначала нарезать.
 */
export function validatePrintFileForProtocol(
  protocol: PrinterProtocol,
  fileName: string,
): PrintFileCheck {
  const extension = printFileExtension(fileName);
  const accepted = PRINTER_UPLOAD_FORMATS[protocol];
  const label = formatPrinterProtocol(protocol);

  if (!extension) {
    return {
      ok: false,
      reason: `У файла нет расширения — ${label} не поймёт, что печатать. Загрузите ${formatPrintFormats(accepted)}.`,
    };
  }

  if (accepted.includes(`.${extension}`)) {
    return { ok: true };
  }

  if (extension === "stl") {
    return {
      ok: false,
      reason: `STL — это модель, а не задание печати: нарежьте её в слайсере — ${label} печатает ${formatPrintFormats(accepted)}.`,
    };
  }

  return {
    ok: false,
    reason: `${label} не печатает .${extension} — переслайсите в ${formatPrintFormats(accepted)}.`,
  };
}

/** Предел адреса принтера — как у колонки ip_address (text, 1…253 символа). */
export const PRINTER_ADDRESS_MAX = 253;

/**
 * Сколько найденных принтеров принимает одно сканирование и одно подтверждение.
 *
 * Сотня принтеров — уже крупная ферма, а 200 строк хватает и на подсеть с
 * запасом: больше — это либо чужая сеть, либо сломанный агент, и такой ответ
 * лучше обрезать, чем записать в базу мегабайт JSON.
 */
export const DISCOVERED_PRINTERS_LIMIT = 200;

/**
 * Бренд и модель принтера из автообнаружения.
 *
 * Сеть знает только адрес и протокол, а колонки brand/model в workshop_printers
 * обязательные (not null, 1…40 и 1…60 символов). Если имя, введённое мастером,
 * совпало с пресетом («Bambu Lab P1S»), бренд и модель берутся из справочника;
 * иначе карточка честно показывает «Неизвестно · Найден по сети», а не пустоту.
 */
export const DISCOVERED_PRINTER_BRAND = "Неизвестно";
export const DISCOVERED_PRINTER_MODEL = "Найден по сети";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const hoursFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
});

/** Когда принтер выходил на связь: «29.10.2026, 14:05». */
const lastSeenFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Наработка для интерфейса: «412,5 ч». */
export function formatPrinterHours(value: number): string {
  return `${hoursFormatter.format(value)} ч`;
}

/** Идентификатор принтера: мусор отсекаем до запроса к PostgREST. */
export function isPrinterId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/**
 * Адрес принтера из ответа агента или из формы: IPv4, IPv6 или имя узла.
 *
 * Разрешены только символы, из которых состоят адреса. Пробел или «/» означали
 * бы, что агент прислал не адрес, а строку URL либо подпись, — подключиться по
 * такому значению нельзя, и в workshop_printers.ip_address ему не место. Адрес
 * длиннее 253 символов не влезает в колонку и check-ограничение миграции.
 * null — это не адрес.
 */
export function normalizePrinterAddress(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  if (text.length === 0 || text.length > PRINTER_ADDRESS_MAX) {
    return null;
  }

  return /^[0-9a-zA-Z.:_-]+$/.test(text) ? text : null;
}

/**
 * Серийный номер из ответа агента: `USN` SSDP-ответа Bambu (`01S00C123456789`).
 *
 * Агент присылает номер, который принтер назвал сам, поэтому проверяем ровно то,
 * что проверит база: длину 1…64 символа и отсутствие пробелов. Пробел или «/»
 * означали бы, что пришла не подпись устройства, а строка другого формата: такой
 * номер не годится ни в MQTT-топик `device/<serial>/…`, ни в SSDP-поиск.
 * null — номера нет: Moonraker и OctoPrint его не называют вовсе.
 */
export function normalizePrinterSerial(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  if (text.length === 0 || text.length > PRINTER_TEXT_LIMITS.serialNumber) {
    return null;
  }

  return /^[0-9A-Za-z_-]+$/.test(text) ? text : null;
}

/**
 * Ключ API (Moonraker/OctoPrint) или код доступа Bambu из ответа агента.
 *
 * Содержимое не ограничиваем алфавитом: ключ Moonraker — строка из
 * `moonraker.conf`, ключ OctoPrint — 32 hex-символа, код доступа Bambu — восемь
 * знаков с экрана принтера. Проверяем ровно то, что проверит база: непустую
 * строку до 512 символов (check `char_length(api_key) between 1 and 512`).
 * Пробелы по краям не считаются частью ключа и обрезаются: перенос строки из
 * буфера обмена — частая ошибка. null — ключа нет: и «не прислали», и «прислали
 * пустое».
 */
export function normalizePrinterApiKey(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  return text.length === 0 || text.length > PRINTER_TEXT_LIMITS.apiKey
    ? null
    : text;
}

/**
 * Принтер, найденный агентом: адрес, протокол, номер и ключ, если принтер или
 * агент их назвали.
 *
 * Серийный номер приходит только от Bambu: он же отвечает на SSDP-запрос
 * заголовком `USN`. Ключ доступа агент сегодня не присылает — его вводит мастер
 * в окне подтверждения, — но поле читается здесь, чтобы ключ, присланный вместе
 * с находкой, не потерялся при подтверждении. Для Moonraker и OctoPrint оба
 * поля обычно null.
 */
export type DiscoveredPrinterDraft = {
  ipAddress: string;
  protocolType: PrinterProtocol;
  serialNumber: string | null;
  apiKey: string | null;
};

/**
 * Принтер, которого мастер подтвердил: к адресу добавлены имя и ключ.
 *
 * `apiKey` — то, что мастер ввёл в окне мастера подключения (или пустая строка,
 * если не вводил). Секрет: значение уходит только в базу, в браузер не
 * возвращается.
 */
export type ApprovedPrinterDraft = {
  ipAddress: string;
  name: string;
  apiKey: string | null;
};

/** Итог разбора списка: что приняли и сколько строк отбросили. */
export type DiscoveredPrintersRead<Draft> = {
  drafts: Draft[];
  skipped: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Ключ сравнения адресов: регистр в записи IPv6 не важен. */
function addressKey(ipAddress: string | null): string {
  return ipAddress === null ? "" : ipAddress.toLocaleLowerCase("en-US");
}

/**
 * Ответ агента `[{ "ip_address": "192.168.1.50", "protocol_type": "moonraker" }]`.
 *
 * Мусорная строка не отменяет всё сканирование: агент обходит подсеть, и одна
 * странная запись не должна стоить сотни нормальных. Такие строки считаются в
 * `skipped`. Повтор адреса схлопывается — второй сканер в той же подсети иначе
 * удвоил бы карточки. Незнакомый протокол — тоже `skipped`: агент может знать
 * больше протоколов, чем этот интерфейс, и подставлять «moonraker по умолчанию»
 * значило бы закрепить в базе неверный протокол.
 *
 * `serial_number` необязателен: его присылают Bambu (SSDP-ответ) и FlashForge
 * (UDP-ответ), у Moonraker и OctoPrint такого понятия нет. Нечитаемый номер не
 * отбрасывает находку — адрес и протокол важнее, — он просто теряется: без
 * серийника адаптер найдёт принтер сам.
 *
 * `api_key` агент сегодня не присылает: ключ вводит мастер в окне подтверждения.
 * Но если ключ пришёл вместе с находкой, он сохраняется — подтверждение
 * использует его, когда поле в окне оставлено пустым.
 *
 * null — тело не массив: это ошибка формата, а не «ничего не найдено» (пустой
 * массив как раз означает «в сети пусто», и старые находки должны исчезнуть).
 */
export function readDiscoveredPrinters(
  value: unknown,
): DiscoveredPrintersRead<DiscoveredPrinterDraft> | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const seen = new Set<string>();
  const drafts: DiscoveredPrinterDraft[] = [];
  let skipped = 0;

  for (const item of value) {
    const row = isRecord(item) ? item : null;
    const ipAddress = normalizePrinterAddress(row?.ip_address);
    const key = addressKey(ipAddress);
    const protocol = row ? row.protocol_type : null;

    // Незнакомый протокол не превращается в moonraker. Агент новой версии
    // отличает Creality от Moonraker по порту, и «догадка по умолчанию» здесь
    // закрепила бы в базе чужой протокол: печать пошла бы не тем запросом.
    // Находка пропускается и считается в skipped — она появится снова, как
    // только приложение обновится.
    if (
      ipAddress === null ||
      !isPrinterProtocol(protocol) ||
      seen.has(key) ||
      drafts.length >= DISCOVERED_PRINTERS_LIMIT
    ) {
      skipped += 1;
      continue;
    }

    seen.add(key);
    drafts.push({
      ipAddress,
      protocolType: protocol,
      serialNumber: normalizePrinterSerial(row?.serial_number),
      apiKey: normalizePrinterApiKey(row?.api_key),
    });
  }

  return { drafts, skipped };
}

/**
 * Список на подтверждение от мастера
 * `[{ "ip_address": ..., "name": ..., "api_key": ... }]`.
 *
 * Подтверждается только принтер с именем: без имени карточка в парке была бы
 * безымянной, а мастер всё равно должен понимать, какой адрес он добавляет.
 * Строка без имени, с нечитаемым адресом или повтором адреса отбрасывается и
 * считается в `skipped`: список мог устареть, пока агент пересканировал сеть.
 * Имя длиннее предела колонки обрезается, а не роняет всю пачку.
 *
 * `api_key` необязателен: пустое поле — «ключа нет» (в базе null). Слишком
 * длинный ключ не обрезается: усечённый секрет — это неверный секрет, принтер
 * молча не подключится, поэтому такой ключ считается неуказанным.
 * null — это не массив: вызывающий отвечает ошибкой, а не «ничего не выбрано».
 */
export function readApprovedPrinters(
  value: unknown,
): DiscoveredPrintersRead<ApprovedPrinterDraft> | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const seen = new Set<string>();
  const drafts: ApprovedPrinterDraft[] = [];
  let skipped = 0;

  for (const item of value) {
    const row = isRecord(item) ? item : null;
    const ipAddress = normalizePrinterAddress(row?.ip_address);
    const key = addressKey(ipAddress);
    const name =
      row && typeof row.name === "string"
        ? row.name.trim().slice(0, PRINTER_TEXT_LIMITS.name)
        : "";

    if (
      ipAddress === null ||
      name.length === 0 ||
      seen.has(key) ||
      drafts.length >= DISCOVERED_PRINTERS_LIMIT
    ) {
      skipped += 1;
      continue;
    }

    seen.add(key);
    drafts.push({
      ipAddress,
      name,
      apiKey: normalizePrinterApiKey(row?.api_key),
    });
  }

  return { drafts, skipped };
}

/**
 * Принтер, которого агент нашёл в сети и который ждёт решения мастера.
 *
 * Строка `workshop_discovered_printers` — очередь «что подтвердить», а не история
 * сканирований: после переноса в парк она удаляется. Поэтому здесь только то,
 * что нужно мастеру подключения: адрес, протокол, серийный номер (Bambu называет
 * его в SSDP-ответе) и время находки.
 */
export type DiscoveredPrinter = {
  ipAddress: string;
  protocolType: PrinterProtocol;
  /** Номер из SSDP-ответа Bambu; null — принтер его не назвал. */
  serialNumber: string | null;
  discoveredAt: string | null;
};

/**
 * Имя по умолчанию для найденного принтера: «Принтер 192.168.1.50».
 *
 * Мастеру не нужно придумывать имя с нуля: адрес уже отличает принтеры друг от
 * друга, а переименовать можно тут же, в мастере. Длинный адрес обрезается до
 * предела колонки name — иначе первая же отправка упёрлась бы в check базы.
 */
export function defaultDiscoveredPrinterName(ipAddress: string): string {
  return `Принтер ${ipAddress}`.slice(0, PRINTER_TEXT_LIMITS.name);
}

/**
 * Строка workshop_discovered_printers → `DiscoveredPrinter`.
 *
 * Берём только статус `discovered`: `added` — уже перенесённый в парк принтер, в
 * мастере ему делать нечего. Битый адрес даёт null: подключиться по такой строке
 * нельзя, а в списке она выглядела бы рабочей. Незнакомый протокол тоже даёт
 * null — см. комментарий в теле.
 * `serial_number` читается тем же правилом, что и в ответе агента: номер нужен
 * Bambu и FlashForge, у остальных он null.
 */
export function normalizeDiscoveredPrinterRow(
  row: Partial<Record<string, unknown>>,
): DiscoveredPrinter | null {
  const ipAddress = normalizePrinterAddress(row.ip_address);
  const protocolType = row.protocol_type;

  if (ipAddress === null || row.status !== "discovered") {
    return null;
  }

  // Протокол проверяем и здесь: строка пришла из базы, а база новее этого
  // приложения (check-ограничение уже знает протокол, интерфейс — ещё нет).
  // Показать её как moonraker значило бы подтвердить принтер с чужим
  // протоколом, поэтому находка ждёт обновления приложения.
  if (!isPrinterProtocol(protocolType)) {
    return null;
  }

  return {
    ipAddress,
    protocolType,
    serialNumber: normalizePrinterSerial(row.serial_number),
    discoveredAt: typeof row.created_at === "string" ? row.created_at : null,
  };
}

/** Дата из формы или базы: только настоящий день в формате ГГГГ-ММ-ДД. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Процент износа узла для полоски: 0…∞ с одним знаком после запятой,
 * null — у узла нет регламента (интервал 0).
 *
 * Дробный процент, а не целый: при 100,3 % полоска уже красная, и подпись не
 * должна показывать «100 %», иначе цвет спорит с числом.
 */
export function printerMaintenancePercent(
  hours: number,
  interval: number,
): number | null {
  if (!Number.isFinite(hours) || !Number.isFinite(interval) || interval <= 0) {
    return null;
  }

  return Math.max(0, Math.round((hours / interval) * 1000) / 10);
}

/** Уровень обслуживания: зелёный до 80 %, жёлтый 80–100 %, красный сверх. */
export type MaintenanceLevel = "ok" | "due" | "overdue";

/** Уровень узла или null, если регламента нет (интервал смазки 0). */
export function printerMaintenanceLevel(
  hours: number,
  interval: number,
): MaintenanceLevel | null {
  if (!Number.isFinite(hours) || !Number.isFinite(interval) || interval <= 0) {
    return null;
  }

  const ratio = hours / interval;

  if (ratio > 1) {
    return "overdue";
  }

  return ratio >= 0.8 ? "due" : "ok";
}

/** Сколько узлов принтера требует внимания: для сводки над карточками. */
export function countMaintenanceDue(printer: WorkshopPrinter): number {
  const nozzle = printerMaintenanceLevel(
    printer.nozzleHours,
    printer.nozzleInterval,
  );
  const lubrication = printerMaintenanceLevel(
    printer.lubricationHours,
    printer.lubricationInterval,
  );
  const zScrew = printerMaintenanceLevel(
    printer.zScrewHours,
    printer.zScrewInterval,
  );

  return [nozzle, lubrication, zScrew].filter(
    (level) => level !== null && level !== "ok",
  ).length;
}
/**
 * Общая часть форм подключения: серийный номер, ключ доступа и секреты
 * протокола.
 *
 * Одна функция на форму добавления, на кнопку «Проверить связь» и на карточку
 * принтера: проверки не разъедутся, и кнопка не станет ругаться на поле, которое
 * сохранение пропустит. Поля берутся из `PRINTER_CONNECTION_SPECS` — того же
 * справочника, по которому они рисуются.
 *
 * `mode` различает два разговора с мастером. `create` — форма добавления: пустое
 * обязательное поле это ошибка, а у поля с `fallback` пишется значение по
 * умолчанию (PrusaLink без `storage` не соберёт адрес файла). `update` — карточка
 * принтера: секреты в браузер не возвращаются, поэтому все поля секретов
 * показываются пустыми, и пустота здесь значит «оставь сохранённое». Требовать
 * их заново и подставлять `fallback` в этом режиме нельзя: сохранённый
 * `checkCode` затёрся бы ошибкой формы, а `storage` — значением по умолчанию.
 */
function readConnectionFields(
  formData: FormData,
  protocolType: PrinterProtocol,
  mode: "create" | "update" = "create",
): {
  serialNumber: string;
  apiKey: string;
  printerSecrets: PrinterSecrets;
  errors: PrinterFormErrors;
} {
  const spec = printerConnectionSpec(protocolType);
  const errors: PrinterFormErrors = {};

  // SN нужен Bambu (топики MQTT) и FlashForge (заголовок каждого запроса): у
  // остальных протоколов такого понятия нет, а чужое значение агент подставил бы
  // в топик чужого протокола.
  const serialNumber = spec.serialNumber
    ? readFormText(formData.get("serialNumber"))
    : "";

  if (serialNumber.length > PRINTER_TEXT_LIMITS.serialNumber) {
    errors.serialNumber = `Не больше ${PRINTER_TEXT_LIMITS.serialNumber} символов.`;
  } else if (mode === "create" && spec.serialNumberRequired && !serialNumber) {
    errors.serialNumber =
      "Введите серийный номер с наклейки: FlashForge отправляет его в каждом запросе.";
  }

  // Ключ доступа: у Moonraker, OctoPrint и PrusaLink это ключ API, у Bambu — код
  // с экрана принтера. Пустое поле становится null в базе (check-ограничение не
  // принимает api_key длины 0), поэтому проверяется длина, а не пустота.
  const apiKey = spec.apiKey ? readFormText(formData.get("apiKey")) : "";

  if (spec.apiKey) {
    if (apiKey.length > spec.apiKey.maxLength) {
      errors.apiKey = `Не больше ${spec.apiKey.maxLength} символов.`;
    } else if (mode === "create" && spec.apiKey.required && !apiKey) {
      errors.apiKey =
        "Заполните поле: без него принтер не примет команды агента.";
    } else if (
      spec.apiKey.exactLength &&
      apiKey.length !== spec.apiKey.exactLength
    ) {
      errors.apiKey = `Нужно ровно ${spec.apiKey.exactLength} символов — как на экране принтера.`;
    }
  }

  // Секреты протокола — то, для чего нет колонки: `checkCode` FlashForge,
  // логин-пароль и `deviceId`/`modeId` Anycubic, `mainboardId` Elegoo, `storage`
  // PrusaLink. Пустое необязательное поле в объект не попадает: в jsonb лежит
  // только заполненное. `fallback` записывается всегда — PrusaLink без `storage`
  // не соберёт адрес файла.
  const printerSecrets: PrinterSecrets = {};

  for (const field of spec.secrets) {
    const value = readFormText(formData.get(field.key));

    if (!value) {
      // Карточка принтера: пустое поле — «оставь сохранённый секрет». Значения в
      // браузер не приходят, поэтому все поля показаны пустыми, и требовать их
      // заново (или подставлять `fallback` вместо сохранённого) нельзя.
      if (mode === "update") {
        continue;
      }

      if (field.required) {
        errors[field.key] = `Заполните поле «${field.label}».`;
      } else if (field.fallback) {
        printerSecrets[field.key] = field.fallback;
      }

      continue;
    }

    if (value.length > PRINTER_TEXT_LIMITS.apiKey) {
      errors[field.key] = `Не больше ${PRINTER_TEXT_LIMITS.apiKey} символов.`;
      continue;
    }

    if (
      field.options &&
      !field.options.some((option) => option.value === value)
    ) {
      errors[field.key] = "Выберите значение из списка.";
      continue;
    }

    printerSecrets[field.key] = value;
  }

  return { serialNumber, apiKey, printerSecrets, errors };
}



/**
 * Форма «Добавить принтер» → проверенные значения.
 *
 * Бренд и модель — свободный текст: справочник `PRINTER_PRESETS` только
 * подставляет интервалы в форме, а модель может быть любой. Сервер проверяет
 * длину названий и интервалы теми же пределами, что SQL.
 *
 * Адрес обязателен: агент подключается к принтеру напрямую, и без `ip_address`
 * карточка в парке осталась бы мёртвой. Остальные поля подключения зависят от
 * протокола (`PRINTER_CONNECTION_SPECS`): ключ API или код доступа, SN,
 * `checkCode`, логин-пароль. Пустое поле ключа становится null, потому что
 * check-ограничение миграции не принимает пустую строку.
 */
export function readPrinterForm(formData: FormData): {
  draft: PrinterDraft | null;
  errors: PrinterFormErrors;
} {
  const errors: PrinterFormErrors = {};

  const name = readFormText(formData.get("name"));

  if (!name) {
    errors.name = "Введите имя принтера.";
  } else if (name.length > PRINTER_TEXT_LIMITS.name) {
    errors.name = `Не больше ${PRINTER_TEXT_LIMITS.name} символов.`;
  }

  const brand = readFormText(formData.get("brand"));

  if (!brand) {
    errors.brand = "Введите бренд принтера.";
  } else if (brand.length > PRINTER_TEXT_LIMITS.brand) {
    errors.brand = `Не больше ${PRINTER_TEXT_LIMITS.brand} символов.`;
  }

  const model = readFormText(formData.get("model"));

  if (!model) {
    errors.model = "Введите модель принтера.";
  } else if (model.length > PRINTER_TEXT_LIMITS.model) {
    errors.model = `Не больше ${PRINTER_TEXT_LIMITS.model} символов.`;
  }

  // Протокол приходит из `<select>`. Незнакомое значение — не повод терять
  // принтер: Moonraker — и default колонки в миграции, и самый частый выбор.
  const protocol = readFormText(formData.get("protocol"));
  const protocolType: PrinterProtocol = isPrinterProtocol(protocol)
    ? protocol
    : "moonraker";

  // Поля подключения зависят от протокола: `PRINTER_CONNECTION_SPECS` — тот же
  // справочник, по которому рисуется форма, поэтому подписи и проверки не
  // разъедутся.
  const connection = readConnectionFields(formData, protocolType);
  Object.assign(errors, connection.errors);

  // Адрес проверяется тем же normalizePrinterAddress, что и находки агента:
  // «192.168.1.50» и «ender3.local» проходят, а «http://192.168.1.50» или
  // строка с пробелом — нет. Без адреса принтер не подключить, поэтому поле
  // обязательное.
  const ipAddress = normalizePrinterAddress(formData.get("ipAddress"));

  if (!ipAddress) {
    errors.ipAddress =
      "Укажите адрес вида 192.168.1.50 или имя узла (ender3.local) — без пробелов и «/».";
  }

  const nozzleInterval = readInterval(
    formData.get("nozzleInterval"),
    PRINTER_INTERVAL_LIMITS.nozzleMin,
  );

  if (nozzleInterval === null) {
    errors.nozzleInterval = `Допустимо от ${PRINTER_INTERVAL_LIMITS.nozzleMin} до ${formatWorkshopLimit(PRINTER_INTERVAL_LIMITS.max)} ч.`;
  }

  const lubricationInterval = readInterval(
    formData.get("lubricationInterval"),
    PRINTER_INTERVAL_LIMITS.lubricationMin,
  );

  if (lubricationInterval === null) {
    errors.lubricationInterval = `Допустимо от ${PRINTER_INTERVAL_LIMITS.lubricationMin} до ${formatWorkshopLimit(PRINTER_INTERVAL_LIMITS.max)} ч. 0 — смазка не требуется.`;
  }

  const zScrewInterval = readInterval(
    formData.get("zScrewInterval"),
    PRINTER_INTERVAL_LIMITS.zScrewMin,
  );

  if (zScrewInterval === null) {
    errors.zScrewInterval = `Допустимо от ${PRINTER_INTERVAL_LIMITS.zScrewMin} до ${formatWorkshopLimit(PRINTER_INTERVAL_LIMITS.max)} ч.`;
  }

  if (
    brand.length === 0 ||
    model.length === 0 ||
    ipAddress === null ||
    nozzleInterval === null ||
    lubricationInterval === null ||
    zScrewInterval === null ||
    Object.keys(errors).length > 0
  ) {
    return { draft: null, errors };
  }

  return {
    draft: {
      name,
      brand,
      model,
      protocolType,
      serialNumber: connection.serialNumber,
      ipAddress,
      apiKey: connection.apiKey,
      printerSecrets: connection.printerSecrets,
      nozzleInterval,
      lubricationInterval,
      zScrewInterval,
    },
    errors,
  };
}
/** Проверенный ввод кнопки «Проверить связь»: только данные подключения. */
export type PrinterProbeDraft = {
  protocolType: PrinterProtocol;
  ipAddress: string;
  serialNumber: string;
  apiKey: string;
  printerSecrets: PrinterSecrets;
};

/**
 * Разбор формы «Проверить связь».
 *
 * Отличается от `readPrinterForm` тем, что не требует имени, бренда, модели и
 * интервалов обслуживания: мастер вправе проверить принтер до того, как придумал
 * ему имя, а просьба в очередь на эти поля не опирается. Поля подключения
 * проверяются общей `readConnectionFields()`, поэтому набор ошибок тот же, что
 * у сохранения.
 */
export function readPrinterProbeForm(formData: FormData): {
  draft: PrinterProbeDraft | null;
  errors: PrinterFormErrors;
} {
  const errors: PrinterFormErrors = {};

  // Протокол как у формы добавления: незнакомое значение — Moonraker, а не
  // отказ. Кнопка проверки стоит в той же форме, и `<select>` уже выбрал
  // значение; мусор сюда попадает только из подделанного запроса.
  const protocol = readFormText(formData.get("protocol"));
  const protocolType: PrinterProtocol = isPrinterProtocol(protocol)
    ? protocol
    : "moonraker";

  const connection = readConnectionFields(formData, protocolType);
  Object.assign(errors, connection.errors);

  const ipAddress = normalizePrinterAddress(formData.get("ipAddress"));

  if (!ipAddress) {
    errors.ipAddress =
      "Укажите адрес вида 192.168.1.50 или имя узла (ender3.local) — без пробелов и «/».";
  }

  if (!ipAddress || Object.keys(errors).length > 0) {
    return { draft: null, errors };
  }

  return {
    draft: {
      protocolType,
      ipAddress,
      serialNumber: connection.serialNumber,
      apiKey: connection.apiKey,
      printerSecrets: connection.printerSecrets,
    },
    errors,
  };
}



/**
 * Проверенный ввод формы «Подключение» в карточке принтера.
 *
 * Отличается от `PrinterDraft` тем, что имя, бренд, модель и интервалы
 * обслуживания карточка не меняет — их задают при добавлении. Ключ доступа и
 * секреты протокола приходят пустыми, когда мастер их не трогал: пустая строка
 * означает «оставь сохранённый секрет», а не «сотри ключ».
 */
export type PrinterConnectionDraft = {
  protocolType: PrinterProtocol;
  ipAddress: string;
  /** SN для Bambu и FlashForge; пустая строка — в базе null. */
  serialNumber: string;
  apiKey: string;
  /**
   * Новые секреты протокола из `printer_secrets`: `checkCode` FlashForge, логин
   * и пароль Anycubic. Только заполненные поля — Server Action накладывает их на
   * сохранённый объект, поэтому пустое поле старый секрет не стирает.
   */
  printerSecrets: PrinterSecrets;
};

/**
 * Разбор формы «Подключение».
 *
 * Проверки те же, что у формы добавления (`normalizePrinterAddress`, длина SN и
 * ключа из `PRINTER_TEXT_LIMITS`, поля протокола из `PRINTER_CONNECTION_SPECS`),
 * но протокол здесь обязателен: при добавлении незнакомое значение молча
 * становилось moonraker, а при правке это означало бы «смени протокол» — принтер
 * перестал бы отвечать агенту.
 *
 * Режим у общей `readConnectionFields()` — `update`: секреты в браузер не
 * возвращаются, поля показываются пустыми, и пустота значит «оставить
 * сохранённое», а не «заполните заново».
 */
export function readPrinterConnectionForm(formData: FormData): {
  draft: PrinterConnectionDraft | null;
  errors: PrinterFormErrors;
} {
  const errors: PrinterFormErrors = {};

  const protocol = readFormText(formData.get("protocol"));

  if (!isPrinterProtocol(protocol)) {
    errors.protocol = "Выберите протокол из списка — по нему агент говорит с принтером.";
  }

  const protocolType: PrinterProtocol = isPrinterProtocol(protocol)
    ? protocol
    : "moonraker";

  const ipAddress = normalizePrinterAddress(formData.get("ipAddress"));

  if (!ipAddress) {
    errors.ipAddress =
      "Укажите адрес вида 192.168.1.50 или имя узла (ender3.local) — без пробелов и «/».";
  }

  const connection = readConnectionFields(formData, protocolType, "update");
  Object.assign(errors, connection.errors);

  if (ipAddress === null || Object.keys(errors).length > 0) {
    return { draft: null, errors };
  }

  return {
    draft: {
      protocolType,
      ipAddress,
      serialNumber: connection.serialNumber,
      apiKey: connection.apiKey,
      printerSecrets: connection.printerSecrets,
    },
    errors,
  };
}

/**
 * Строка `workshop_printers` → принтер для интерфейса.
 *
 * Битое число заменяется значением по умолчанию, строка без корректного id
 * отбрасывается: без id принтер нельзя ни показать, ни обслужить. Нулевой
 * интервал сопла из старой строки не роняет карточку — он покажется как
 * «нет регламента», а не как деление на ноль.
 */
export function normalizePrinterRow(
  row: Partial<Record<string, unknown>> | null | undefined,
): WorkshopPrinter | null {
  if (!row || !isPrinterId(row.id)) {
    return null;
  }

  const nozzleInterval =
    readNumberInRange(
      row.nozzle_interval,
      PRINTER_INTERVAL_LIMITS.nozzleMin,
      PRINTER_INTERVAL_LIMITS.max,
      true,
    ) ?? PRINTER_INTERVAL_DEFAULTS.nozzle;

  const lubricationInterval =
    readNumberInRange(
      row.lubrication_interval,
      PRINTER_INTERVAL_LIMITS.lubricationMin,
      PRINTER_INTERVAL_LIMITS.max,
      true,
    ) ?? PRINTER_INTERVAL_DEFAULTS.lubrication;

  const zScrewInterval =
    readNumberInRange(
      row.z_screw_interval,
      PRINTER_INTERVAL_LIMITS.zScrewMin,
      PRINTER_INTERVAL_LIMITS.max,
      true,
    ) ?? PRINTER_INTERVAL_DEFAULTS.zScrew;

  return {
    id: row.id,
    name:
      readText(row.name, PRINTER_TEXT_LIMITS.name) || "Принтер без имени",
    brand: readText(row.brand, PRINTER_TEXT_LIMITS.brand),
    model: readText(row.model, PRINTER_TEXT_LIMITS.model),
    totalHours: readNumberInRange(row.total_hours, 0, PRINTER_HOURS_MAX) ?? 0,
    nozzleHours: readNumberInRange(row.nozzle_hours, 0, PRINTER_HOURS_MAX) ?? 0,
    nozzleInterval,
    lubricationHours:
      readNumberInRange(row.lubrication_hours, 0, PRINTER_HOURS_MAX) ?? 0,
    lubricationInterval,
    zScrewHours: readNumberInRange(row.z_screw_hours, 0, PRINTER_HOURS_MAX) ?? 0,
    zScrewInterval,
    lastMaintenanceDate: isIsoDate(row.last_maintenance_date)
      ? row.last_maintenance_date
      : null,
    // Живые поля агента: незнакомый статус не ломает карточку, а читается как
    // «свободен» — так же, как default колонки в миграции.
    status: isPrinterFarmStatus(row.status) ? row.status : "idle",
    progress: readNumberInRange(row.progress, 0, 100, true) ?? 0,
    remainingTime:
      readNumberInRange(row.remaining_time, 0, Number.MAX_SAFE_INTEGER, true) ??
      0,
    lastSeenAt: typeof row.last_seen_at === "string" ? row.last_seen_at : null,
    // Пустая строка и null — одно и то же «номера нет»: форма присылает "".
    serialNumber:
      readText(row.serial_number, PRINTER_TEXT_LIMITS.serialNumber) || null,
    // Подключение: без миграции колонок нет — протокол читается как default
    // базы (moonraker), адрес остаётся пустым.
    protocolType: isPrinterProtocol(row.protocol_type)
      ? row.protocol_type
      : "moonraker",
    ipAddress: normalizePrinterAddress(row.ip_address),
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
  };
}

/**
 * Дата обслуживания: «24.10.2026» вместо машинного «2026-10-24».
 */
export function formatPrinterDate(value: string | null): string {
  if (!isIsoDate(value)) {
    return "—";
  }

  const [year, month, day] = value.split("-");

  return `${day}.${month}.${year}`;
}

/**
 * Когда принтер последний раз выходил на связь.
 *
 * `last_seen_at` пишет пульс агента фермы; null — агент ещё ни разу не
 * отчитался по этому принтеру. Строка «ещё не выходил на связь» честнее
 * прочерка: в карточке принтера она отвечает на вопрос «агент его видит?».
 */
export function formatPrinterLastSeen(value: string | null): string {
  if (typeof value !== "string") {
    return "ещё не выходил на связь";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "ещё не выходил на связь";
  }

  return lastSeenFormatter.format(date);
}

/** Сколько принтер может молчать: дольше — «офлайн», даже если status говорит иное. */
export const PRINTER_OFFLINE_AFTER_MS = 2 * 60 * 1000;

/**
 * Состояние для карточки с поправкой на давность ответа.
 *
 * `last_seen_at` старше двух минут значит, что агент потерял принтер: прогресс
 * застыл, и подпись «Печатает» была бы обманом. Отметки нет (null) — агент ещё
 * ни разу не отчитывался, судить об офлайне не по чему: метку даёт сам статус.
 * Без этой оговорки парк, добавленный вручную и ещё не подключённый, выглядел
 * бы серым целиком.
 *
 * `now === null` — разметка до монтирования в браузере: время сервера и клиента
 * может разойтись, поэтому срок не проверяется и SSR с гидратацией дают
 * одинаковый результат.
 */
export function resolvePrinterLiveStatus(
  printer: Pick<WorkshopPrinter, "status" | "lastSeenAt">,
  now: number | null,
): PrinterFarmStatus {
  if (printer.status === "offline" || now === null) {
    return printer.status;
  }

  const seenAt = printer.lastSeenAt
    ? Date.parse(printer.lastSeenAt)
    : Number.NaN;

  if (Number.isNaN(seenAt)) {
    return printer.status;
  }

  return now - seenAt > PRINTER_OFFLINE_AFTER_MS ? "offline" : printer.status;
}

/**
 * Остаток печати словами: «меньше минуты», «45 мин», «1 ч 20 мин».
 * null — показывать нечего: печати нет или пришёл ноль вместо секунд.
 */
export function formatPrinterRemaining(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  if (seconds < 60) {
    return "меньше минуты";
  }

  const minutes = Math.ceil(seconds / 60);

  if (minutes < 60) {
    return `${minutes} мин`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} мин`;
}

/** Интервал из формы: целое число в допустимых пределах или null. */
function readInterval(
  value: FormDataEntryValue | null,
  min: number,
): number | null {
  const parsed = parseWorkshopNumber(value);

  if (parsed === null) {
    return null;
  }

  const rounded = Math.round(parsed);

  return rounded >= min && rounded <= PRINTER_INTERVAL_LIMITS.max
    ? rounded
    : null;
}

/** Число из строки формы или ответа PostgREST: только в пределах. */
function readNumberInRange(
  value: unknown,
  min: number,
  max: number,
  integer = false,
): number | null {
  const parsed = parseWorkshopNumber(value);

  if (parsed === null) {
    return null;
  }

  const rounded = integer ? Math.round(parsed) : Math.round(parsed * 100) / 100;

  return rounded < min || rounded > max ? null : rounded;
}

/** Текст из строки базы: обрезаем пробелы и лишнюю длину. */
function readText(value: unknown, limit: number): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

/** Текст из формы: пробелы по краям не считаются содержимым. */
function readFormText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}
