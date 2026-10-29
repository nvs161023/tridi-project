"use server";

import { revalidatePath } from "next/cache";

import type {
  DiscoveredPrinterListState,
  DiscoveredPrintersState,
  NetworkScanRequestState,
  PrinterActionState,
  PrinterConnectionState,
  PrinterFormState,
} from "@/app/actions/printers-state";
import {
  isPrinterProtocol,
  type PrinterProtocol,
} from "@/lib/db/workshop-types";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import { createClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";
import {
  isPrinterId,
  normalizePrinterApiKey,
  normalizePrinterSerial,
  readApprovedPrinters,
  readPrinterConnectionForm,
  readPrinterForm,
} from "@/lib/workshop/printers";
import {
  createDiscoveredPrinterPayload,
  createPrinterConnectionPayload,
  createPrinterPayload,
} from "@/lib/workshop/payload";
import { getDiscoveredPrinters } from "@/lib/workshop/printer-store";

const SESSION_EXPIRED =
  "Сессия истекла. Войдите снова, чтобы изменить принтеры.";
const PRO_REQUIRED =
  "Мастерская входит в пакет «Всё включено». Оформите доступ, чтобы вести принтеры.";
const MIGRATION_MISSING =
  "Принтеры пока не сохраняются: в базе нет таблицы или колонок workshop_printers. Примените supabase/workshop_farm_and_shop.sql — он добавляет протокол, серийный номер, IP-адрес и ключ доступа; таблицу и колонки обслуживания создают workshop_printers_orders.sql и workshop_printer_z_screw.sql.";
const ADD_FAILED = "Не удалось добавить принтер. Попробуйте ещё раз.";
const UPDATE_FAILED =
  "Не удалось сохранить подключение принтера. Попробуйте ещё раз.";
const DELETE_FAILED = "Не удалось удалить принтер. Попробуйте ещё раз.";
const RESET_FAILED = "Не удалось сбросить счётчик. Попробуйте ещё раз.";
const LOAD_FAILED = "Не удалось прочитать принтер. Попробуйте ещё раз.";
const INVALID_ID = "Принтер не найден — обновите страницу.";
const NOT_FOUND = "Принтер не найден — возможно, его уже удалили. Обновите страницу.";
const DISCOVERED_MIGRATION_MISSING =
  "Список найденных принтеров пока не сохраняется: в базе нет таблицы workshop_discovered_printers или колонок агента в workshop_printers. Примените supabase/workshop_farm_and_shop.sql.";
const APPROVE_INVALID =
  "Не удалось прочитать список найденных принтеров. Обновите страницу и попробуйте снова.";
const APPROVE_NO_NAMES =
  "Укажите имя хотя бы одному принтеру — без имени добавлять нечего.";
const APPROVE_FAILED = "Не удалось добавить принтеры в парк. Попробуйте ещё раз.";
const PARK_READ_FAILED =
  "Не удалось проверить, какие принтеры уже есть в парке. Попробуйте ещё раз.";
const SCAN_REQUEST_FAILED =
  "Не удалось запросить сканирование сети. Попробуйте ещё раз.";
const SCAN_MIGRATION_MISSING =
  "Запрос сканирования пока не сохраняется: в базе нет колонки workshop_settings.scan_requested. Примените supabase/workshop_farm_and_shop.sql.";

/** Сегодняшняя дата в формате колонки date. */
function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Добавление принтера.
 *
 * Порядок проверок тот же, что у склада: разбор формы → сессия → подписка →
 * запись. Server Action — публичный endpoint, поэтому подписка проверяется и
 * здесь, а не только на странице. RLS дополнительно сверяет auth.uid().
 *
 * Адрес и ключ доступа приходят из той же формы: `readPrinterForm` проверяет их
 * вместе с остальными полями, а `createPrinterPayload` раскладывает в колонки
 * ip_address и api_key. Ключ пустой — в базе null, а не "", иначе его отклонило
 * бы check-ограничение миграции.
 */
export async function addPrinter(
  _prevState: PrinterFormState,
  formData: FormData,
): Promise<PrinterFormState> {
  const { draft, errors } = readPrinterForm(formData);

  if (!draft) {
    return { fieldErrors: errors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: SESSION_EXPIRED };
  }

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return { error: PRO_REQUIRED };
  }

  const { error } = await supabase
    .from("workshop_printers")
    .insert(createPrinterPayload(user.id, draft));

  if (error) {
    console.warn("Принтер не добавлен:", error.code, error.message);

    return {
      error: isMissingTableSchema(error.code, error.message)
        ? MIGRATION_MISSING
        : ADD_FAILED,
    };
  }

  revalidatePath("/dashboard/workshop");

  return {
    success: true,
    message: `Принтер «${draft.name}» добавлен: ${draft.brand} ${draft.model}.`,
  };
}

/**
 * Правка подключения из карточки принтера.
 *
 * Порядок проверок как у остальных действий: UUID → разбор формы → сессия →
 * подписка → `update` с фильтром по `user_id`. Меняются только адрес, протокол,
 * серийный номер и ключ доступа: имя, модель, интервалы и счётчики не трогаются,
 * иначе правка адреса сбрасывала бы обслуживание, а правка ключа — наработку.
 *
 * Ключ доступа приходит из формы пустым, когда его не меняли: в браузер секрет
 * не попадает, и `createPrinterConnectionPayload` просто не включает колонку в
 * `update` — сохранённый ключ остаётся как был.
 *
 * `select("name")` возвращает обновлённую строку: пустой ответ означает, что
 * принтер уже удалили в другой вкладке, — тогда честнее сказать «не найден», чем
 * «сохранено». Имя нужно только для сообщения об успехе.
 */
export async function updatePrinter(
  printerId: string,
  formData: FormData,
): Promise<PrinterConnectionState> {
  if (!isPrinterId(printerId)) {
    return { ok: false, error: INVALID_ID };
  }

  const { draft, errors } = readPrinterConnectionForm(formData);

  if (!draft) {
    return { ok: false, fieldErrors: errors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: SESSION_EXPIRED };
  }

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return { ok: false, error: PRO_REQUIRED };
  }

  const { data, error } = await supabase
    .from("workshop_printers")
    .update(createPrinterConnectionPayload(draft))
    .eq("id", printerId)
    .eq("user_id", user.id)
    .select("name")
    .maybeSingle();

  if (error) {
    console.warn("Подключение не сохранено:", error.code, error.message);

    return {
      ok: false,
      error: isMissingTableSchema(error.code, error.message)
        ? MIGRATION_MISSING
        : UPDATE_FAILED,
    };
  }

  if (!data) {
    return { ok: false, error: NOT_FOUND };
  }

  revalidatePath("/dashboard/workshop");

  const row = data as { name?: unknown };
  const name =
    typeof row.name === "string" && row.name.trim()
      ? row.name.trim()
      : "принтер";

  return { ok: true, message: `Подключение «${name}» сохранено.` };
}

/**
 * Удаление принтера из парка.
 *
 * Порядок проверок как у удаления заказа: UUID → сессия → подписка → `delete` с
 * фильтром по `user_id`, поэтому чужой принтер не удалится даже при известном
 * id. `select("name")` возвращает удалённую строку: пустой ответ — принтер уже
 * удалили в другой вкладке, и карточка не должна рапортовать об успехе.
 *
 * История при удалении не пропадает: `printer_id` в заказах и заданиях печати
 * объявлен `on delete set null` (supabase/workshop_printers_orders.sql и
 * supabase/workshop_farm_and_shop.sql), поэтому заказы остаются на месте, а
 * карточка заказа показывает «принтер не указан». Отдельного удаления заданий не
 * нужно.
 */
export async function deletePrinter(
  printerId: string,
): Promise<PrinterActionState> {
  if (!isPrinterId(printerId)) {
    return { ok: false, error: INVALID_ID };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: SESSION_EXPIRED };
  }

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return { ok: false, error: PRO_REQUIRED };
  }

  const { data, error } = await supabase
    .from("workshop_printers")
    .delete()
    .eq("id", printerId)
    .eq("user_id", user.id)
    .select("name")
    .maybeSingle();

  if (error) {
    console.warn("Принтер не удалён:", error.code, error.message);

    return {
      ok: false,
      error: isMissingTableSchema(error.code, error.message)
        ? MIGRATION_MISSING
        : DELETE_FAILED,
    };
  }

  if (!data) {
    return { ok: false, error: NOT_FOUND };
  }

  const row = data as { name?: unknown };
  const name =
    typeof row.name === "string" && row.name.trim()
      ? row.name.trim()
      : "принтер";

  revalidatePath("/dashboard/workshop");

  return { ok: true, message: `Принтер «${name}» удалён из парка.` };
}

/**
 * «Заменить сопло»: сбрасывает наработку сопла и отмечает обслуживание
 * сегодняшним днём. Общая наработка и счётчик смазки не меняются.
 */
export async function resetPrinterNozzle(
  printerId: string,
): Promise<PrinterActionState> {
  return resetPrinterCounter(printerId, "nozzle");
}

/**
 * «Смазать оси»: сбрасывает наработку смазки и отмечает обслуживание.
 * Для моделей с интервалом 0 кнопки в карточке нет, но действие остаётся:
 * почистить направляющие всё равно можно.
 */
export async function resetPrinterLubrication(
  printerId: string,
): Promise<PrinterActionState> {
  return resetPrinterCounter(printerId, "lubrication");
}

/**
 * «Смазать винт Z»: сбрасывает наработку винта и отмечает обслуживание.
 * Общая наработка, сопло и смазка осей не меняются.
 */
export async function resetPrinterZScrew(
  printerId: string,
): Promise<PrinterActionState> {
  return resetPrinterCounter(printerId, "zScrew");
}

type MaintenanceCounter = "nozzle" | "lubrication" | "zScrew";

/** Какая колонка обнуляется и что сказать после успеха. */
const COUNTER_CONFIG: Record<
  MaintenanceCounter,
  { column: "nozzle_hours" | "lubrication_hours" | "z_screw_hours"; done: string }
> = {
  nozzle: {
    column: "nozzle_hours",
    done: "Сопло заменено",
  },
  lubrication: {
    column: "lubrication_hours",
    done: "Оси смазаны",
  },
  zScrew: {
    column: "z_screw_hours",
    done: "Винт Z смазан",
  },
};

/** Общий путь сброса: проверки, чтение имени, update и ответ для вкладки. */
async function resetPrinterCounter(
  printerId: string,
  counter: MaintenanceCounter,
): Promise<PrinterActionState> {
  if (!isPrinterId(printerId)) {
    return { ok: false, error: INVALID_ID };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: SESSION_EXPIRED };
  }

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return { ok: false, error: PRO_REQUIRED };
  }

  const { data, error } = await supabase
    .from("workshop_printers")
    .select("name")
    .eq("id", printerId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.warn("Принтер не прочитан:", error.code, error.message);

    return {
      ok: false,
      error: isMissingTableSchema(error.code, error.message)
        ? MIGRATION_MISSING
        : LOAD_FAILED,
    };
  }

  if (!data) {
    return { ok: false, error: NOT_FOUND };
  }

  const name =
    typeof (data as { name?: unknown }).name === "string"
      ? (data as { name: string }).name
      : "принтер";
  const date = todayIsoDate();

  const config = COUNTER_CONFIG[counter];

  const { error: updateError } = await supabase
    .from("workshop_printers")
    .update({ [config.column]: 0, last_maintenance_date: date })
    .eq("id", printerId)
    .eq("user_id", user.id);

  if (updateError) {
    console.warn("Счётчик не сброшен:", updateError.code, updateError.message);

    return {
      ok: false,
      error: isMissingTableSchema(updateError.code, updateError.message)
        ? MIGRATION_MISSING
        : RESET_FAILED,
    };
  }

  revalidatePath("/dashboard/workshop");

  return {
    ok: true,
    message: `${config.done}: «${name}», счётчик снова 0 ч.`,
  };
}

type Row = Partial<Record<string, unknown>>;

/** Строки ответа PostgREST: только объекты, без доверия к схеме. */
function readRows(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.filter(
        (row): row is Row =>
          typeof row === "object" && row !== null && !Array.isArray(row),
      )
    : [];
}

/** Ключ сравнения адресов: регистр в записи IPv6 не важен. */
function printerAddressKey(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLocaleLowerCase("en-US")
    : "";
}

/**
 * «Мастер подключения фермы»: найденные агентом принтеры → парк мастерской.
 *
 * Агент сканирует сеть и складывает находки в workshop_discovered_printers
 * (POST /api/agent/discover), мастер только даёт имена (и, если принтер их
 * требует, вводит ключи доступа). Порядок:
 *   1. разбор списка (lib/workshop/printers.ts): строка без имени, с мусорным
 *      адресом или повтором адреса отбрасывается, а не роняет всю пачку;
 *   2. сессия и подписка — как у добавления принтера вручную: Server Action
 *      публичный endpoint, RLS одна не защищает от чужой подписки;
 *   3. протокол берём из находки агента (он видел, каким API ответил принтер);
 *      строку могли уже убрать — тогда работает default колонки moonraker.
 *      Серийный номер тоже из находки: Bambu называет его в SSDP-ответе, и терять
 *      его при подтверждении нельзя — без номера адаптер ищет принтер заново.
 *      Ключ доступа приходит из окна мастера; если поле оставили пустым, берётся
 *      ключ из находки (агент его сегодня не присылает), а иначе null — адаптер
 *      попробует подключиться без ключа;
 *   4. адреса, которые уже есть в парке, пропускаем: повторное подтверждение
 *      старого списка не должно удвоить ферму;
 *   5. вставка в workshop_printers, затем удаление подтверждённых находок —
 *      таблица найденного остаётся списком «что ждёт мастера», а не историей
 *      сканирований.
 *
 * Ошибка удаления находок не отменяет успех: принтеры уже в парке, и говорить
 * «ничего не добавилось» было бы неправдой. Строка останется до следующего
 * сканирования — оно заменяет весь список `discovered` целиком.
 */
export async function approveDiscoveredPrinters(
  printers: { ip_address: string; name: string; api_key?: string | null }[],
): Promise<DiscoveredPrintersState> {
  const parsed = readApprovedPrinters(printers);

  if (!parsed) {
    return { ok: false, error: APPROVE_INVALID };
  }

  if (parsed.drafts.length === 0) {
    return { ok: false, error: APPROVE_NO_NAMES };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: SESSION_EXPIRED };
  }

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return { ok: false, error: PRO_REQUIRED };
  }

  const addresses = parsed.drafts.map((draft) => draft.ipAddress);

  const discoveredResult = await supabase
    .from("workshop_discovered_printers")
    .select("ip_address, protocol_type, serial_number, api_key")
    .eq("user_id", user.id)
    .in("ip_address", addresses);

  if (discoveredResult.error) {
    console.warn(
      "Найденные принтеры не прочитаны:",
      discoveredResult.error.code,
      discoveredResult.error.message,
    );

    return {
      ok: false,
      error: isMissingTableSchema(
        discoveredResult.error.code,
        discoveredResult.error.message,
      )
        ? DISCOVERED_MIGRATION_MISSING
        : LOAD_FAILED,
    };
  }

  const protocols = new Map<string, PrinterProtocol>();
  const serials = new Map<string, string>();
  const apiKeys = new Map<string, string>();

  for (const row of readRows(discoveredResult.data)) {
    const key = printerAddressKey(row.ip_address);

    if (!key) {
      continue;
    }

    if (isPrinterProtocol(row.protocol_type)) {
      protocols.set(key, row.protocol_type);
    }

    // Номер принтер назвал сам (Bambu — USN в SSDP-ответе): он переезжает в
    // парк вместе с адресом, чтобы мастеру не искать SN на корпусе.
    const serialNumber = normalizePrinterSerial(row.serial_number);

    if (serialNumber) {
      serials.set(key, serialNumber);
    }

    // Ключ доступа: мастер вводит его в окне подтверждения, но если ключ пришёл
    // вместе с находкой, он тоже переезжает в парк — иначе пришлось бы
    // подключать принтер без ключа и вводить его заново.
    const apiKey = normalizePrinterApiKey(row.api_key);

    if (apiKey) {
      apiKeys.set(key, apiKey);
    }
  }

  const parkResult = await supabase
    .from("workshop_printers")
    .select("ip_address")
    .eq("user_id", user.id);

  if (parkResult.error) {
    console.warn(
      "Парк не прочитан:",
      parkResult.error.code,
      parkResult.error.message,
    );

    return {
      ok: false,
      error: isMissingTableSchema(
        parkResult.error.code,
        parkResult.error.message,
      )
        ? DISCOVERED_MIGRATION_MISSING
        : PARK_READ_FAILED,
    };
  }

  const inPark = new Set(
    readRows(parkResult.data)
      .map((row) => printerAddressKey(row.ip_address))
      .filter((key) => key.length > 0),
  );

  const payloads = parsed.drafts
    .filter((draft) => !inPark.has(printerAddressKey(draft.ipAddress)))
    .map((draft) => {
      const key = printerAddressKey(draft.ipAddress);

      return createDiscoveredPrinterPayload(
        user.id,
        draft,
        protocols.get(key) ?? "moonraker",
        serials.get(key) ?? null,
        // Ключ из окна мастера важнее ключа из находки: мастер мог его исправить.
        draft.apiKey ?? apiKeys.get(key) ?? null,
      );
    });

  if (payloads.length > 0) {
    const { error } = await supabase
      .from("workshop_printers")
      .insert(payloads);

    if (error) {
      console.warn("Найденные принтеры не добавлены:", error.code, error.message);

      return {
        ok: false,
        error: isMissingTableSchema(error.code, error.message)
          ? DISCOVERED_MIGRATION_MISSING
          : APPROVE_FAILED,
      };
    }
  }

  const clearResult = await supabase
    .from("workshop_discovered_printers")
    .delete()
    .eq("user_id", user.id)
    .eq("status", "discovered")
    .in("ip_address", addresses);

  if (clearResult.error) {
    console.warn(
      "Список найденных не очищен:",
      clearResult.error.code,
      clearResult.error.message,
    );
  }

  revalidatePath("/dashboard/workshop");

  const added = payloads.length;
  const skipped = parsed.skipped + (parsed.drafts.length - added);

  return {
    ok: true,
    added,
    skipped,
    message:
      added > 0
        ? `Добавлено принтеров: ${added}.${skipped > 0 ? ` Пропущено: ${skipped}.` : ""}`
        : "Все найденные принтеры уже есть в парке.",
  };
}

/**
 * Просьба мастера просканировать сеть: `workshop_settings.scan_requested = true`.
 *
 * Браузер не видит локальную сеть мастерской — с ней работает только агент,
 * который стоит рядом с принтерами. Поэтому кнопка «Найти принтеры в сети» не
 * сканирует сама, а поднимает флаг: агент читает его в цикле опроса
 * (`GET /api/agent/scan-status`), обходит сеть и сбрасывает флаг
 * (`POST /api/agent/scan-complete`).
 *
 * Строки настроек может ещё не быть: её создаёт первое сохранение калькулятора.
 * Поэтому upsert по `user_id` (колонка unique), а не update: иначе флаг ставился
 * бы в пустоту, и мастер видел бы «сканирую», пока агент ничего не делает.
 *
 * `ok: true` — флаг записан, а не «принтеры уже найдены»: находки придут
 * отдельным запросом агента (`POST /api/agent/discover`), а окно мастера
 * опрашивает их само (`fetchDiscoveredPrinters`).
 */
export async function requestNetworkScan(): Promise<NetworkScanRequestState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: SESSION_EXPIRED };
  }

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return { ok: false, error: PRO_REQUIRED };
  }

  const { error } = await supabase
    .from("workshop_settings")
    .upsert(
      { user_id: user.id, scan_requested: true },
      { onConflict: "user_id" },
    );

  if (error) {
    console.warn("Запрос сканирования не сохранён:", error.code, error.message);

    return {
      ok: false,
      error: isMissingTableSchema(error.code, error.message)
        ? SCAN_MIGRATION_MISSING
        : SCAN_REQUEST_FAILED,
    };
  }

  return { ok: true };
}

/**
 * Находки агента для окна мастера подключения: тот же список, что у страницы.
 *
 * Нужен, пока идёт сканирование: сеть обходит агент, находки приходят в базу
 * асинхронно, и окно спрашивает их раз в три секунды (DiscoverPrintersDialog).
 * Чтение идёт через `getDiscoveredPrinters()` — один запрос вместо
 * `router.refresh()` всей страницы с семью запросами, и та же нормализация
 * строк, что у серверного рендера.
 *
 * `ok: false` — сессия, подписка или база: опрос прекращается, окно показывает
 * ошибку. Пустой список ошибкой не считается: агент мог ещё не прислать находки.
 */
export async function fetchDiscoveredPrinters(): Promise<
  DiscoveredPrinterListState
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: SESSION_EXPIRED };
  }

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return { ok: false, error: PRO_REQUIRED };
  }

  const snapshot = await getDiscoveredPrinters(supabase, user.id);

  return {
    ok: true,
    printers: snapshot.printers,
    isMissingTable: snapshot.isMissingTable,
  };
}
