import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";

/**
 * Вебхук Wildberries.
 *
 * WB присылает уведомления о заказах без cookies пользователя и без подписи,
 * поэтому продавца определяет персональный адрес:
 *
 *   POST /api/webhooks/wb?token=<uuid>
 *
 * Токен — тот же `workshop_settings.webhook_token` (uuid, unique), что и у
 * Ozon: строка настроек уже привязана к владельцу, и отдельная колонка для WB
 * не нужна. Строку ищем через service_role: RLS закрывает таблицу для
 * анонимных запросов.
 *
 * Поля уведомления — из модели заказа WB, которую описывает спека
 * `03-orders-fbs` (dev.wildberries.ru/api/swagger/yaml/ru/03-orders-fbs.yaml):
 *
 *   {
 *     "id": 1234567890,
 *     "skus": ["6665956397512", "6665956397512"],
 *     "price": 1014
 *   }
 *
 * `id` — «ID сборочного задания»; в методах DBW и DBS то же задание называется
 * `orderId`, поэтому поле ищем по обоим именам. Номер попадает в title
 * («WB: 1234567890»). `skus` — «список баркодов»: повтор артикула означает
 * несколько единиц товара. `price` — «цена в валюте продажи с учётом всех
 * скидок, умноженная на 100»: 1014 — это 10,14 ₽, поэтому в `total_cost`
 * сумма делится на 100.
 *
 * WB может прислать заказ и в конверте со служебными полями
 * (`sellerId`, `createdAt`, `status`) — тогда заказ лежит в `body`.
 *
 * Заказ пишется с `source = 'wb'` и `status = 'new'`. Повтор уведомления с тем
 * же номером не создаёт дубль: заказ ищется по title, который собирается
 * детерминированно. GET на этот адрес — не протокол WB, а проверка для
 * человека: открыть в браузере и убедиться, что маршрут жив и его не
 * перехватывает middleware.
 */
export const runtime = "nodejs";

/** Уведомления меняют заказы, поэтому ответ нельзя кэшировать. */
export const dynamic = "force-dynamic";

/** UUID из `gen_random_uuid()`: любой другой текст токеном не считаем. */
const WEBHOOK_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/** `WB: ` занимает 4 символа, а title в базе ограничен 80. */
const MAX_ORDER_ID_LENGTH = 76;

/** Длина артикула в уведомлении; длиннее — уже не идентификатор товара. */
const MAX_SKU_LENGTH = 128;

/** Больше позиций в notes всё равно не поместится из-за лимита text. */
const MAX_SKUS = 100;

/** `workshop_orders.notes` — text с check до 1000 символов. */
const MAX_NOTES_LENGTH = 1000;

/** `workshop_orders.total_cost` — numeric(10,2) от 0 до 1 000 000. */
const MAX_TOTAL_COST = 1_000_000;

/**
 * Поля заказа WB с суммой, все — умноженные на 100.
 *
 * `price` — цена продажи с учётом всех скидок; `finalPrice` — сумма к оплате
 * покупателем; `salePrice` — цена продавца. Порядок важен: основное поле
 * первое, остальные страхуют уведомление без `price`.
 */
const WB_PRICE_FIELDS = ["price", "finalPrice", "salePrice"] as const;

/** JSON-объект из тела запроса. Массивы и null объектами не считаем. */
type JsonObject = Record<string, unknown>;

/** Позиция заказа WB: артикул и сколько раз он встретился в `skus`. */
type WbProductLine = {
  sku: string;
  quantity: number;
};

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Результат поиска продавца.
 *
 * При успехе отдаём и клиента service_role: тот же клиент нужен для проверки
 * дубля и записи заказа, второй раз его создавать незачем.
 */
type SellerLookup =
  | { admin: Admin; userId: string; failure: null }
  | { admin: null; userId: null; failure: Response };

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Текст из JSON.
 *
 * Номер заказа и артикулы WB может прислать числом, поэтому числа тоже
 * принимаем. Пустая строка — «значения нет».
 */
function readText(value: unknown): string | null {
  if (typeof value === "string") {
    const text = value.trim();

    return text || null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

/** JSON-ответ: уведомления и ошибки отдаём одним форматом. */
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

/** Успешное уведомление: WB считает заказ принятым по ответу 2xx. */
function ok(): Response {
  return json({ result: true });
}

/** Неизвестный или отсутствующий токен: заказ не создаём. */
function forbidden(): Response {
  return json({ error: "unknown seller" }, 403);
}

/** Миграция не применена: WB повторит уведомление после её применения. */
function notConfigured(): Response {
  return json({ error: "webhook is not configured" }, 503);
}

/**
 * Токен вебхука из query-параметра.
 *
 * Принимаем только UUID: так отсекаются случайные ссылки и попытки передать
 * произвольный текст. Регистр приводим к нижнему — PostgREST сравнивает uuid
 * без учёта регистра, но в интерфейсе адрес всегда одинаковый.
 */
function readWebhookToken(request: Request): string | null {
  const token =
    new URL(request.url).searchParams.get("token")?.trim().toLowerCase() ?? "";

  return WEBHOOK_TOKEN_PATTERN.test(token) ? token : null;
}

/** Код ошибки PostgREST/Supabase; у обычных Error его нет. */
function readErrorCode(error: unknown): string | null {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
    ? String((error as { code?: unknown }).code)
    : null;
}

/** Текст ошибки для лога: Error, объект с message или что угодно ещё. */
function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  const message = (error as { message?: unknown } | null)?.message;

  return typeof message === "string" ? message : String(error);
}

/**
 * Владелец настроек по токену вебхука.
 *
 * Токен уникален (`unique` в миграции), поэтому строка либо одна, либо её нет.
 * Если строк несколько (индекс не применён или данные испорчены), выбирать
 * владельца наугад нельзя — считаем токен неизвестным.
 */
async function findSellerByToken(
  admin: Admin,
  token: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("workshop_settings")
    .select("user_id")
    .eq("webhook_token", token)
    .limit(2);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as { user_id?: unknown }[];

  if (rows.length > 1) {
    console.warn("[WB] Токен вебхука привязан к нескольким настройкам.");
    return null;
  }

  const userId = rows[0]?.user_id;

  return typeof userId === "string" && userId ? userId : null;
}

/**
 * Поиск продавца с готовым ответом на любую ошибку.
 *
 * Отсутствие токена — это 403. Ошибка базы — 500, а неприменённая миграция —
 * 503: WB повторит уведомление, когда владелец применит SQL, и заказ не
 * потеряется.
 */
async function resolveSeller(token: string): Promise<SellerLookup> {
  let admin: Admin;

  try {
    admin = createAdminClient();
  } catch (error) {
    console.error(
      "[WB] Не удалось создать service_role-клиент:",
      readErrorMessage(error),
    );

    return { admin: null, userId: null, failure: notConfigured() };
  }

  try {
    const userId = await findSellerByToken(admin, token);

    return userId
      ? { admin, userId, failure: null }
      : { admin: null, userId: null, failure: forbidden() };
  } catch (error) {
    const code = readErrorCode(error);
    const message = readErrorMessage(error);

    console.error("[WB] Ошибка поиска продавца по токену:", code, message);

    // 42703 — в базе нет колонки `webhook_token`: миграция не применена.
    // PostgREST может ответить и PGRST204; обе ситуации лечит один SQL.
    const isMissingColumn =
      code === "42703" || isMissingTableSchema(code, message);

    return {
      admin: null,
      userId: null,
      failure: isMissingColumn
        ? notConfigured()
        : json({ error: "database error" }, 500),
    };
  }
}

/**
 * Объект заказа из уведомления.
 *
 * WB присылает либо сам заказ, либо конверт со служебными полями (`sellerId`,
 * `createdAt`, `status`), в котором заказ лежит в `body`. Разбираем вложенный
 * объект, если он есть: иначе номер заказа искался бы среди служебных полей, а
 * повтор уведомления создавал бы новый заказ.
 */
function readOrderPayload(body: JsonObject): JsonObject {
  const nested = body.body;

  return isObject(nested) ? nested : body;
}

/**
 * Номер заказа из `id`.
 *
 * Без номера заказ не создать: title собирается из него, а по title
 * проверяется дубль. Управляющие символы в title не нужны, поэтому такой
 * номер считаем некорректным. В методах DBW и DBS сборочное задание
 * называется `orderId` — берём его, если `id` нет.
 */
function readOrderId(payload: JsonObject): string | null {
  const orderId = readText(payload.id) ?? readText(payload.orderId);

  if (!orderId || orderId.length > MAX_ORDER_ID_LENGTH) {
    return null;
  }

  return /[\u0000-\u001f\u007f]/.test(orderId) ? null : orderId;
}

/**
 * Артикулы заказа с количеством.
 *
 * WB присылает `skus` массивом; строку или число принимаем как одну позицию —
 * так уведомление не потеряется из-за формата. Повтор артикула означает
 * несколько единиц товара, поэтому считаем количество, а не отбрасываем дубли.
 * Некорректные значения пропускаем, как в вебхуке Ozon.
 */
function readProducts(payload: JsonObject): WbProductLine[] {
  const raw = payload.skus;
  const values = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
  const lines = new Map<string, WbProductLine>();

  for (const value of values) {
    const sku = readText(value);

    if (!sku || sku.length > MAX_SKU_LENGTH) {
      continue;
    }

    const line = lines.get(sku);

    if (line) {
      line.quantity += 1;
      continue;
    }

    if (lines.size >= MAX_SKUS) {
      break;
    }

    lines.set(sku, { sku, quantity: 1 });
  }

  return [...lines.values()];
}

/**
 * Сумма заказа из `price`.
 *
 * В модели заказа WB суммы приходят умноженными на 100: `price: 1014` — это
 * 10,14 ₽. Поэтому значение без дробной части делится на 100. Строка с точкой
 * или запятой («1500.00», «1500,00») пришла не из модели заказа — её считаем
 * рублями, иначе сумма уменьшилась бы в сто раз.
 *
 * WB может прислать число или строку с точкой/запятой. Отсутствующая цена —
 * это 0: заказ важнее суммы, её можно поправить в мастерской. Явно
 * некорректная цена (текст, минус, больше лимита базы) отклоняется, иначе
 * `total_cost` не пройдёт check и заказ потеряется с 500.
 */
function readPrice(payload: JsonObject): number | null {
  for (const field of WB_PRICE_FIELDS) {
    const raw = payload[field];

    if (raw === undefined || raw === null || raw === "") {
      continue;
    }

    return readAmount(raw);
  }

  return 0;
}

/**
 * Рубли из суммы WB: умноженное на 100 — копейки, с дробной частью — рубли.
 *
 * Признак дробной части берём у исходного значения: у строки — по точке или
 * запятой («1500.00» — рубли, «1500» — копейки), у числа — по остатку от
 * деления. Иначе «1500.00» после `Number()` выглядело бы целым и сумма
 * уменьшилась бы в сто раз.
 */
function readAmount(raw: unknown): number | null {
  const text = typeof raw === "string" ? raw.trim().replace(",", ".") : null;
  const value = typeof raw === "number" ? raw : text ? Number(text) : Number.NaN;

  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  const hasFraction = text ? text.includes(".") : !Number.isInteger(value);
  const rubles = hasFraction ? value : value / 100;

  if (rubles > MAX_TOTAL_COST) {
    return null;
  }

  // numeric(10,2): округляем, чтобы 1499.999 не превратилось в ошибку базы.
  return Math.round(rubles * 100) / 100;
}

/**
 * Заметки заказа: JSON с артикулами и количеством.
 *
 * notes ограничены 1000 символами, а артикулы бывают длинными. Поэтому
 * отбрасываем позиции с конца, пока JSON помещается, и честно пишем, сколько
 * позиций не вошло: обрезанная строка ломала бы JSON.
 */
function buildNotes(products: WbProductLine[]): string {
  const notes = JSON.stringify({ items: products });

  if (notes.length <= MAX_NOTES_LENGTH) {
    return notes;
  }

  const kept = [...products];

  while (kept.length > 0) {
    kept.pop();

    const candidate = JSON.stringify({
      items: kept,
      omitted: products.length - kept.length,
    });

    if (candidate.length <= MAX_NOTES_LENGTH) {
      return candidate;
    }
  }

  return JSON.stringify({ items: [], omitted: products.length });
}

/**
 * Новый заказ WB.
 *
 * Порядок:
 *   1. разбираем номер, артикулы и цену — без номера заказ не создать;
 *   2. ищем ровно одну строку `workshop_settings` по токену;
 *   3. повторное уведомление по тому же номеру не создаёт дубль;
 *   4. пишем заказ с `source = 'wb'`, `status = 'new'` и `total_cost`.
 */
async function handleOrder(token: string, body: JsonObject): Promise<Response> {
  const payload = readOrderPayload(body);
  const orderId = readOrderId(payload);

  if (!orderId) {
    return json({ error: "invalid order id" }, 400);
  }

  const price = readPrice(payload);

  if (price === null) {
    return json({ error: "invalid price" }, 400);
  }

  const products = readProducts(payload);
  const title = `WB: ${orderId}`;
  const notes = buildNotes(products);

  const seller = await resolveSeller(token);

  if (seller.failure) {
    return seller.failure;
  }

  const { admin, userId } = seller;

  try {
    // Отдельной колонки с номером заказа WB нет, поэтому повтор ищем по title:
    // он собирается из `id` детерминированно.
    const { data: existing, error: existingError } = await admin
      .from("workshop_orders")
      .select("id")
      .eq("user_id", userId)
      .eq("source", "wb")
      .eq("title", title)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error("[WB] Ошибка проверки повторного заказа:", existingError);

      return isMissingTableSchema(
        existingError.code,
        existingError.message,
      )
        ? notConfigured()
        : json({ error: "database error" }, 500);
    }

    if (existing) {
      console.log("[WB] Повторное уведомление, заказ уже создан:", {
        userId,
        orderId,
      });

      return ok();
    }
  } catch (error) {
    console.error("[WB] Ошибка проверки повторного заказа:", error);

    return json({ error: "database error" }, 500);
  }

  try {
    const { error } = await admin.from("workshop_orders").insert({
      user_id: userId,
      source: "wb",
      title,
      status: "new",
      total_cost: price,
      notes,
    });

    if (error) {
      // Уникального индекса на номер заказа нет, но если он появится,
      // повтор уведомления должен остаться успешным для WB.
      if (error.code === "23505") {
        return ok();
      }

      console.error("[WB] Ошибка записи заказа:", error);

      return isMissingTableSchema(error.code, error.message)
        ? notConfigured()
        : json({ error: "database error" }, 500);
    }
  } catch (error) {
    console.error("[WB] Ошибка записи заказа:", error);

    return json({ error: "database error" }, 500);
  }

  console.log("[WB] Заказ создан:", {
    userId,
    orderId,
    products: products.length,
    price,
  });

  return ok();
}

/**
 * POST /api/webhooks/wb?token=<uuid>.
 *
 * Без корректного UUID в адресе отвечаем 403 до чтения тела и запросов в базу.
 * Тело читаем текстом: в лог попадают длина и content-type, по ним видно, что
 * именно прислал WB, а не просто «invalid json».
 */
export async function POST(request: Request): Promise<Response> {
  const token = readWebhookToken(request);

  if (!token) {
    console.warn("[WB] Запрос без корректного токена вебхука, отклонён.", {
      hasToken: new URL(request.url).searchParams.has("token"),
      contentType: request.headers.get("content-type"),
    });

    return forbidden();
  }

  const rawBody = await request.text();

  if (!rawBody.trim()) {
    return json({ error: "invalid json" }, 400);
  }

  let body: unknown;

  try {
    body = JSON.parse(rawBody);
  } catch {
    console.warn("[WB] Тело запроса не JSON:", {
      contentType: request.headers.get("content-type"),
      length: rawBody.length,
    });

    return json({ error: "invalid json" }, 400);
  }

  if (!isObject(body)) {
    return json({ error: "invalid json" }, 400);
  }

  return handleOrder(token, body);
}

/**
 * GET /api/webhooks/wb.
 *
 * Не часть протокола WB: адрес удобно открыть в браузере и увидеть, что
 * маршрут жив, а middleware его не перехватывает. Токен здесь не нужен и в
 * базу мы не ходим: уведомления приходят POST.
 */
export async function GET(): Promise<Response> {
  return json({ ok: true, endpoint: "wb-webhook" });
}
