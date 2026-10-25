import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";

/**
 * Вебхук Ozon Seller.
 *
 * Ozon присылает уведомления без cookies пользователя и без подписи, поэтому
 * продавца определяет персональный адрес:
 *
 *   POST /api/webhooks/ozon?token=<uuid>
 *
 * Токен хранится в `workshop_settings.webhook_token` (uuid, unique) и создаётся
 * базой вместе со строкой настроек. Строку ищем через service_role: RLS
 * закрывает таблицу для анонимных запросов.
 *
 * Порядок:
 *   1. токен из query-параметра; без UUID — сразу 403, база не нужна;
 *   2. `TYPE_PING` подтверждаем после поиска строки по токену: это проверка
 *      соединения, поля заказа и Client-Id в ней не участвуют;
 *   3. `TYPE_NEW_POSTING` создаёт заказ и не дублирует его при повторе;
 *   4. незнакомые события подтверждаем, чтобы очередь Ozon не застряла.
 *
 * Client-Id из заголовков больше не используется: Ozon может его не присылать
 * (`ozonHeaders: []` в логах), а короткий числовой идентификатор легко подобрать.
 *
 * GET на этот адрес — не протокол Ozon, а проверка для человека: открыть в
 * браузере и убедиться, что маршрут жив и его не перехватывает middleware.
 */
export const runtime = "nodejs";

/** Уведомления меняют заказы, поэтому ответ нельзя кэшировать. */
export const dynamic = "force-dynamic";

/** UUID из `gen_random_uuid()`: любой другой текст токеном не считаем. */
const WEBHOOK_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/** `Ozon: ` занимает 6 символов, а title в базе ограничен 80. */
const MAX_POSTING_NUMBER_LENGTH = 74;

/** Длина SKU в уведомлении; длиннее — уже не идентификатор товара. */
const MAX_SKU_LENGTH = 128;

/** Больше строк в notes всё равно не поместится из-за лимита text. */
const MAX_PRODUCTS = 100;

/** `workshop_orders.notes` — text с check до 1000 символов. */
const MAX_NOTES_LENGTH = 1000;

/** JSON-объект из тела запроса. Массивы и null объектами не считаем. */
type JsonObject = Record<string, unknown>;

/** Нормализованная строка товара из `payload.products`. */
type OzonProductLine = {
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
 * Ozon может прислать `sku` числом, поэтому числа тоже принимаем. Пустая
 * строка — «значения нет».
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

/** Тип уведомления: `message_type` — поле Ozon, `messageType` — запасное. */
function readMessageType(body: JsonObject): string | null {
  return readText(body.message_type) ?? readText(body.messageType);
}

/**
 * Похоже ли тело на ping.
 *
 * Нужно только тогда, когда тело не разобралось как JSON: Ozon подтверждает
 * соединение простым `TYPE_PING`, и повторять проверку из-за формата тела
 * незачем. Для обычного JSON-запроса решение принимает `readMessageType`.
 */
function looksLikePing(rawBody: string): boolean {
  return /type_ping/i.test(rawBody);
}

/** JSON-ответ: Ozon ждёт `{"result": true}` на успешные уведомления. */
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
    console.warn("[Ozon] Токен вебхука привязан к нескольким настройкам.");
    return null;
  }

  const userId = rows[0]?.user_id;

  return typeof userId === "string" && userId ? userId : null;
}

/**
 * Поиск продавца с готовым ответом на любую ошибку.
 *
 * Отсутствие токена — это 403. Ошибка базы — 500, а неприменённая миграция —
 * 503: Ozon повторит уведомление, когда владелец применит SQL, и заказ не
 * потеряется.
 */
async function resolveSeller(token: string): Promise<SellerLookup> {
  let admin: Admin;

  try {
    admin = createAdminClient();
  } catch (error) {
    console.error(
      "[Ozon] Не удалось создать service_role-клиент:",
      error instanceof Error ? error.message : "неизвестная ошибка",
    );

    return {
      admin: null,
      userId: null,
      failure: json({ error: "webhook is not configured" }, 503),
    };
  }

  try {
    const userId = await findSellerByToken(admin, token);

    return userId
      ? { admin, userId, failure: null }
      : { admin: null, userId: null, failure: forbidden() };
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : null;
    const message =
      error instanceof Error
        ? error.message
        : typeof (error as { message?: unknown } | null)?.message === "string"
          ? String((error as { message?: unknown }).message)
          : String(error);

    console.error("[Ozon] Ошибка поиска продавца по токену:", code, message);

    // 42703 — в базе нет колонки `webhook_token`: миграция не применена.
    // PostgREST может ответить и PGRST204; обе ситуации лечит один SQL.
    const isMissingColumn =
      code === "42703" || isMissingTableSchema(code, message);

    return {
      admin: null,
      userId: null,
      failure: isMissingColumn
        ? json({ error: "webhook is not configured" }, 503)
        : json({ error: "database error" }, 500),
    };
  }
}

/** Полезная нагрузка заказа: реальный Ozon кладёт её в `payload`. */
function readPosting(body: JsonObject): JsonObject {
  return isObject(body.payload) ? body.payload : body;
}

/** Номер отправления из `posting_number`; он же попадает в title. */
function readPostingNumber(posting: JsonObject): string | null {
  const postingNumber = readText(posting.posting_number);

  if (!postingNumber || postingNumber.length > MAX_POSTING_NUMBER_LENGTH) {
    return null;
  }

  // Управляющие символы в title не нужны: номер состоит из цифр, букв и дефиса.
  return /[\u0000-\u001f\u007f]/.test(postingNumber) ? null : postingNumber;
}

/** Дата передачи заказа в обработку; необязательная, поэтому null допустим. */
function readInProcessAt(posting: JsonObject): string | null {
  const inProcessAt = readText(posting.in_process_at);

  if (!inProcessAt || inProcessAt.length > 64) {
    return null;
  }

  return inProcessAt;
}

/**
 * Товары заказа: SKU и количество.
 *
 * Некорректные строки пропускаем, а не роняем весь заказ: Ozon может добавить
 * новые поля, но `sku` и `quantity` остаются обязательными для нас.
 */
function readProducts(posting: JsonObject): OzonProductLine[] {
  const products = posting.products;

  if (!Array.isArray(products)) {
    return [];
  }

  const lines: OzonProductLine[] = [];

  for (const product of products) {
    if (!isObject(product)) {
      continue;
    }

    const sku = readText(product.sku);

    if (!sku || sku.length > MAX_SKU_LENGTH) {
      continue;
    }

    const rawQuantity = product.quantity;
    const quantity =
      typeof rawQuantity === "number"
        ? rawQuantity
        : typeof rawQuantity === "string"
          ? Number(rawQuantity)
          : Number.NaN;

    if (
      !Number.isSafeInteger(quantity) ||
      quantity <= 0 ||
      quantity > 1_000_000
    ) {
      continue;
    }

    lines.push({ sku, quantity });

    if (lines.length >= MAX_PRODUCTS) {
      break;
    }
  }

  return lines;
}

/**
 * Заметки заказа: номер отправления, дата обработки и состав.
 *
 * JSON с товарами может не поместиться в 1000 символов, поэтому храним
 * компактный текст. Он читается в карточке заказа и не теряет SKU/количество.
 */
function buildNotes(
  postingNumber: string,
  inProcessAt: string | null,
  products: OzonProductLine[],
): string {
  const parts = [`Ozon ${postingNumber}`];

  if (inProcessAt) {
    parts.push(`in_process_at: ${inProcessAt}`);
  }

  if (products.length > 0) {
    parts.push(
      `товары: ${products
        .map(({ sku, quantity }) => `SKU ${sku} x ${quantity}`)
        .join(", ")}`,
    );
  }

  const notes = parts.join("; ");

  // Запасной обрез: база отклонит notes длиннее 1000 символов.
  return notes.length > MAX_NOTES_LENGTH
    ? `${notes.slice(0, MAX_NOTES_LENGTH - 1)}…`
    : notes;
}

/** Успешное уведомление: тело одинаковое для ping и новых заказов. */
function ok(): Response {
  return json({ result: true });
}

/** Неизвестный или отсутствующий токен: заказ не создаём. */
function forbidden(): Response {
  return json({ error: "unknown seller" }, 403);
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
/**
 * Ping Ozon.
 *
 * Токен всё равно проверяем: подтверждать соединение неизвестной ссылке
 * незачем. Тело ping не разбираем — Ozon присылает только тип события.
 */
async function handlePing(token: string): Promise<Response> {
  const seller = await resolveSeller(token);

  if (seller.failure) {
    return seller.failure;
  }

  console.log("[Ozon] Ping подтверждён для продавца:", seller.userId);

  return ok();
}

/**
 * Новый заказ Ozon.
 *
 * Порядок:
 *   1. разбираем номер отправления и товары — без них заказ не создать;
 *   2. ищем ровно одну строку `workshop_settings` по токену;
 *   3. повторное уведомление по тому же отправлению не создаёт дубль;
 *   4. пишем заказ с `source = 'ozon'`, `status = 'new'` и заметками.
 */
async function handleNewPosting(
  token: string,
  body: JsonObject,
): Promise<Response> {
  const posting = readPosting(body);
  const postingNumber = readPostingNumber(posting);

  if (!postingNumber) {
    return json({ error: "invalid posting number" }, 400);
  }

  const inProcessAt = readInProcessAt(posting);
  const products = readProducts(posting);
  const title = `Ozon: ${postingNumber}`;
  const notes = buildNotes(postingNumber, inProcessAt, products);

  const seller = await resolveSeller(token);

  if (seller.failure) {
    return seller.failure;
  }

  const { admin, userId } = seller;

  try {
    // Ozon повторяет уведомление, если не получил 2xx или ответ потерялся.
    // Отдельной колонки posting_number в заказе нет, поэтому ищем по title,
    // который собирается детерминированно.
    const { data: existing, error: existingError } = await admin
      .from("workshop_orders")
      .select("id")
      .eq("user_id", userId)
      .eq("source", "ozon")
      .eq("title", title)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error("[Ozon] Ошибка проверки повторного заказа:", existingError);
      return json({ error: "database error" }, 500);
    }

    if (existing) {
      console.log("[Ozon] Повторное уведомление, заказ уже создан:", {
        userId,
        postingNumber,
      });

      return ok();
    }
  } catch (error) {
    console.error("[Ozon] Ошибка проверки повторного заказа:", error);
    return json({ error: "database error" }, 500);
  }

  try {
    const { error } = await admin.from("workshop_orders").insert({
      user_id: userId,
      source: "ozon",
      title,
      status: "new",
      notes,
    });

    if (error) {
      // Уникального индекса на отправление пока нет, но если он появится,
      // повтор уведомления должен остаться успешным для Ozon.
      if (error.code === "23505") {
        return ok();
      }

      console.error("[Ozon] Ошибка записи заказа:", error);
      return json({ error: "database error" }, 500);
    }
  } catch (error) {
    console.error("[Ozon] Ошибка записи заказа:", error);
    return json({ error: "database error" }, 500);
  }

  console.log("[Ozon] Заказ создан:", {
    userId,
    postingNumber,
    products: products.length,
  });

  return ok();
}

/**
 * POST /api/webhooks/ozon?token=<uuid>.
 *
 * Без корректного UUID в адресе отвечаем 403 до чтения тела и запросов в базу.
 * `TYPE_PING` подтверждается после проверки токена, но без разбора заказа.
 * Неизвестные события тоже подтверждаем, иначе Ozon будет повторять их
 * бесконечно.
 *
 * Тело читаем текстом: так ping подтверждается даже при не-JSON теле, а в
 * лог попадает длина и content-type — по ним видно, что именно прислал Ozon.
 */
export async function POST(request: Request): Promise<Response> {
  const token = readWebhookToken(request);

  if (!token) {
    console.warn("[Ozon] Запрос без корректного токена вебхука, отклонён.", {
      hasToken: new URL(request.url).searchParams.has("token"),
      contentType: request.headers.get("content-type"),
    });

    return forbidden();
  }

  const rawBody = await request.text();

  // Пустое тело не может быть заказом: это проверка соединения.
  if (!rawBody.trim()) {
    return handlePing(token);
  }

  let body: unknown;

  try {
    body = JSON.parse(rawBody);
  } catch {
    // Ozon подтверждает соединение простым `TYPE_PING`; если тело пришло не
    // JSON, проверку всё равно надо закрыть успешно.
    if (looksLikePing(rawBody)) {
      return handlePing(token);
    }

    console.warn("[Ozon] Тело запроса не JSON:", {
      contentType: request.headers.get("content-type"),
      length: rawBody.length,
    });

    return json({ error: "invalid json" }, 400);
  }

  if (!isObject(body)) {
    if (looksLikePing(rawBody)) {
      return handlePing(token);
    }

    return json({ error: "invalid json" }, 400);
  }

  const messageType = readMessageType(body)?.toUpperCase() ?? null;

  if (messageType === "TYPE_PING") {
    return handlePing(token);
  }

  if (messageType !== "TYPE_NEW_POSTING") {
    // Остальные события Ozon (отмена, смена статуса) этот роут пока не
    // обрабатывает, но подтверждает, чтобы очередь уведомлений не застряла.
    // Токен всё равно проверяем: чужой адрес не должен получать 200.
    const seller = await resolveSeller(token);

    if (seller.failure) {
      return seller.failure;
    }

    console.log("[Ozon] Уведомление без обработки:", { messageType });

    return ok();
  }

  return handleNewPosting(token, body);
}

/**
 * GET /api/webhooks/ozon.
 *
 * Не часть протокола Ozon: адрес удобно открыть в браузере и увидеть, что
 * маршрут жив, а middleware его не перехватывает. Токен здесь не нужен и в
 * базу мы не ходим: уведомления приходят POST.
 */
export async function GET(): Promise<Response> {
  return json({ ok: true, endpoint: "ozon-webhook" });
}
