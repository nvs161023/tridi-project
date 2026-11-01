import { validateAgentToken } from "@/lib/agent-auth";
import {
  isWorkshopUuid,
  readPrinterSecrets,
} from "@/lib/db/workshop-types";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";
import {
  isPrinterProbeStatus,
  normalizeProbeResult,
} from "@/lib/workshop/printer-probe";
import { readPrinterProbeForm } from "@/lib/workshop/printers";

/**
 * Проверка связи с принтером: очередь «Проверить связь».
 *
 *   POST /api/agent/probe            — браузер кладёт просьбу (форма принтера)
 *   POST /api/agent/probe            — агент возвращает результат (Bearer-токен)
 *   GET  /api/agent/probe            — агент забирает pending-просьбы
 *   GET  /api/agent/probe?probeId=…  — браузер читает результат
 *
 * Почему очередь, а не прямой вызов: `adapter.probe()` живёт в локальном агенте
 * на компьютере мастера, у сервера нет к нему входящего доступа. Поэтому форма
 * кладёт просьбу в `workshop_printer_probes`, агент забирает её на ближайшем
 * опросе (раз в POLL_INTERVAL секунд), проверяет принтер и возвращает ответ в ту
 * же строку — так же, как устроена просьба просканировать сеть.
 *
 * Две роли на одном адресе различаются заголовком: `Authorization: Bearer
 * <agent_token>` — агент, всё остальное — сессия мастера. Агентские вызовы идут
 * через service_role (он видит строки любой мастерской), браузерные — через
 * пользовательский клиент, где работает RLS: подделать результат пробы из
 * окна нельзя, политика запрещает update.
 *
 * Секреты (`api_key`, `printer_secrets`) попадают в строку очереди, потому что
 * форма проверяет принтер ДО сохранения. Наружу они уходят только агенту —
 * браузер получает модель, возможности и причину отказа.
 */
export const runtime = "nodejs";

/** Очередь меняется после каждой проверки: кэшировать ответ нельзя. */
export const dynamic = "force-dynamic";

const MIGRATION_HINT =
  "Проверка связи пока недоступна: в базе нет таблицы workshop_printer_probes. Примените supabase/workshop_printer_probe.sql.";

const SESSION_EXPIRED =
  "Сессия истекла. Войдите снова, чтобы проверить принтер.";

const PRO_REQUIRED =
  "Мастерская входит в пакет «Всё включено». Оформите доступ, чтобы проверять принтеры.";

const QUEUE_FAILED = "Проверка не поставлена в очередь. Попробуйте ещё раз.";

const PROBE_NOT_FOUND =
  "Проверка не найдена — возможно, она уже удалена. Попробуйте ещё раз.";

/** Сколько просьб агент забирает за один опрос: больше мастер не отправит. */
const PROBE_LIMIT = 5;

/** Через сутки строка очереди — мусор: секреты в ней хранить незачем. */
const PROBE_TTL_MS = 24 * 60 * 60 * 1000;

/** Предел текста ответа: `last_error` адаптера не длиннее 500 символов. */
const ERROR_TEXT_MAX = 500;

type Row = Partial<Record<string, unknown>>;

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/** Строка из базы или из тела запроса: объект, а не массив и не null. */
function readRow(value: unknown): Row | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Row)
    : null;
}

function readText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  return text ? text.slice(0, maxLength) : null;
}

/** Ошибки записи: отсутствие миграции отличаем от поломки базы. */
function writeFailure(error: SupabaseErrorLike, fallback: string): Response {
  console.error("Проверка принтера: запись не удалась:", error.code, error.message);

  return isMissingTableSchema(error.code, error.message)
    ? json({ error: MIGRATION_HINT }, 503)
    : json({ error: fallback }, 500);
}

/**
 * Браузер: «Проверить связь» из формы принтера.
 *
 * Тело — та же `FormData`, что уходит в Server Action добавления, но проверяет
 * её `readPrinterProbeForm()`: для пробы не нужны имя, бренд, модель и интервалы
 * обслуживания, достаточно протокола, адреса, ключа, SN и секретов. Мастер видит
 * ошибки полей до того, как строка попадёт в очередь, а не «принтер не отвечает»
 * после минуты ожидания.
 */
async function requestProbe(request: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return json({ error: SESSION_EXPIRED }, 401);
  }

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return json({ error: PRO_REQUIRED }, 403);
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return json({ error: "Форма не прочитана: обновите страницу." }, 400);
  }

  const { draft, errors } = readPrinterProbeForm(formData);

  if (!draft) {
    return json(
      { error: "Проверьте поля подключения.", fieldErrors: errors },
      422,
    );
  }

  // Уборка суточных строк: в них лежат копии секретов, и без уборки таблица
  // росла бы после каждой неудачной попытки. Ошибку уборки не показываем —
  // проверить принтер важнее.
  const cutoff = new Date(Date.now() - PROBE_TTL_MS).toISOString();

  await supabase
    .from("workshop_printer_probes")
    .delete()
    .eq("user_id", user.id)
    .lt("created_at", cutoff);

  const result = await supabase
    .from("workshop_printer_probes")
    .insert({
      user_id: user.id,
      protocol_type: draft.protocolType,
      ip_address: draft.ipAddress,
      // Пустые значения — null: в базе «нет поля», а не пустая строка.
      serial_number: draft.serialNumber || null,
      api_key: draft.apiKey || null,
      printer_secrets:
        Object.keys(draft.printerSecrets).length > 0
          ? draft.printerSecrets
          : null,
    })
    .select("id")
    .maybeSingle();

  if (result.error) {
    return writeFailure(result.error, QUEUE_FAILED);
  }

  const probeId = readRow(result.data)?.id;

  if (!isWorkshopUuid(probeId)) {
    console.error("Проверка принтера: база не вернула id строки очереди.");

    return json({ error: QUEUE_FAILED }, 500);
  }

  return json({ probeId, status: "pending" }, 202);
}

/**
 * Агент: результат пробы.
 *
 * Тело: `{ probeId, ok, model, serialNumber, firmware, capabilities, formats,
 * error }`. Отказ принтера — тоже результат (`ok: false` и `error`), поэтому
 * статус строки всегда `done`: «не ответил» не значит «очередь сломалась».
 * Фильтр по `user_id` обязателен: токен агента одной мастерской не должен
 * закрывать проверки другой, даже зная id строки.
 */
async function completeProbe(
  request: Request,
  identity: { userId: string },
): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json({ error: "Тело запроса не JSON." }, 400);
  }

  const row = readRow(body);
  const probeId = row?.probeId;

  if (!row || !isWorkshopUuid(probeId)) {
    return json({ error: "Нужен probeId строки очереди." }, 400);
  }

  // Агент может прислать результат и плоско, и вложенным в `result` — берём то,
  // что есть, чтобы старая версия агента не потеряла ответ.
  const payload = readRow(row.result) ?? row;

  if (typeof payload.ok !== "boolean") {
    return json({ error: "В ответе нет поля ok." }, 400);
  }

  const result = normalizeProbeResult(payload);
  const errorText = readText(payload.error, ERROR_TEXT_MAX);

  let supabase: ReturnType<typeof createAdminClient>;

  try {
    supabase = createAdminClient();
  } catch (error) {
    console.error(
      "Проверка принтера: клиент service_role не создан:",
      error instanceof Error ? error.message : error,
    );

    return json({ error: "Сервер не настроен для агента фермы." }, 500);
  }

  const update = await supabase
    .from("workshop_printer_probes")
    .update({
      status: "done",
      result,
      error: errorText,
      finished_at: new Date().toISOString(),
    })
    .eq("id", probeId)
    .eq("user_id", identity.userId)
    .select("id");

  if (update.error) {
    return writeFailure(update.error, "Результат проверки не сохранён.");
  }

  return json({
    success: true,
    saved: Array.isArray(update.data) && update.data.length > 0,
  });
}

/**
 * Агент: забрать pending-просьбы своей мастерской.
 *
 * Строки сразу переводятся в `running`: иначе второй агент той же мастерской
 * (мастер запустил его на другом компьютере) проверял бы тот же принтер
 * повторно. Если агент упадёт между «забрал» и «ответил», строка останется
 * `running` и окно скажет «агент не ответил» — повторная проверка создаст новую
 * строку, а старая уберётся суточной уборкой.
 */
async function claimPendingProbes(identity: {
  userId: string;
}): Promise<Response> {
  let supabase: ReturnType<typeof createAdminClient>;

  try {
    supabase = createAdminClient();
  } catch (error) {
    console.error(
      "Проверка принтера: клиент service_role не создан:",
      error instanceof Error ? error.message : error,
    );

    return json({ error: "Сервер не настроен для агента фермы." }, 500);
  }

  const pending = await supabase
    .from("workshop_printer_probes")
    .select(
      "id, protocol_type, ip_address, serial_number, api_key, printer_secrets",
    )
    .eq("user_id", identity.userId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(PROBE_LIMIT);

  if (pending.error) {
    return writeFailure(pending.error, "Очередь проверок не прочитана.");
  }

  const rows = Array.isArray(pending.data) ? (pending.data as Row[]) : [];

  if (rows.length === 0) {
    return json({ probes: [] });
  }

  const ids = rows
    .map((row) => row.id)
    .filter((id): id is string => isWorkshopUuid(id));

  const claimed = await supabase
    .from("workshop_printer_probes")
    .update({ status: "running", started_at: new Date().toISOString() })
    .in("id", ids)
    .eq("user_id", identity.userId)
    .select("id");

  if (claimed.error) {
    // Ответ агента важнее: без него проверка не начнётся. Дубль возможен только
    // при двух агентах одной мастерской, и это дешевле потерянной просьбы.
    console.warn(
      "Проверка принтера: строки не помечены running:",
      claimed.error.code,
      claimed.error.message,
    );
  }

  return json({
    probes: rows.map((row) => ({
      id: row.id,
      protocolType: row.protocol_type,
      ipAddress: row.ip_address,
      apiKey: row.api_key,
      serialNumber: row.serial_number,
      secrets: readPrinterSecrets(row.printer_secrets),
    })),
  });
}

/**
 * Браузер: результат своей проверки.
 *
 * `status` нужен окну, чтобы отличить «агент ещё не взял просьбу» (`pending`),
 * «взял и проверяет» (`running`) и «ответил» (`done`): только в последнем случае
 * показывается результат или причина отказа. Фильтр по `user_id` — тот же, что у
 * остальных чтений: RLS скрывает чужое, а лишняя проверка не мешает.
 */
async function readProbe(request: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return json({ error: SESSION_EXPIRED }, 401);
  }

  const probeId =
    new URL(request.url).searchParams.get("probeId")?.trim() ?? "";

  if (!isWorkshopUuid(probeId)) {
    return json({ error: PROBE_NOT_FOUND }, 404);
  }

  const result = await supabase
    .from("workshop_printer_probes")
    .select("id, status, result, error")
    .eq("id", probeId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (result.error) {
    return writeFailure(result.error, PROBE_NOT_FOUND);
  }

  const row = readRow(result.data);

  if (!row || !isWorkshopUuid(row.id)) {
    return json({ error: PROBE_NOT_FOUND }, 404);
  }

  return json({
    probeId: row.id,
    status: isPrinterProbeStatus(row.status) ? row.status : "pending",
    result: normalizeProbeResult(row.result),
    error: readText(row.error, ERROR_TEXT_MAX),
  });
}

/**
 * Роль определяется заголовком Authorization: агент присылает результат, окно
 * ставит просьбу. Разделять их на два адреса незачем — и агент, и форма
 * обращаются к одному `/api/agent/probe`, как и было задумано в задаче.
 */
export async function POST(request: Request): Promise<Response> {
  const identity = await validateAgentToken(request);

  return identity ? completeProbe(request, identity) : requestProbe(request);
}

/** GET без токена — окно читает результат, с токеном — агент забирает очередь. */
export async function GET(request: Request): Promise<Response> {
  const identity = await validateAgentToken(request);

  return identity ? claimPendingProbes(identity) : readProbe(request);
}
