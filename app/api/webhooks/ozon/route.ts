import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Вебхук Ozon Seller.
 *
 * Ozon присылает сюда уведомления без cookies пользователя и без
 * криптографической подписи, поэтому:
 *   1. `TYPE_PING` подтверждаем самым первым — до разбора полей, до базы и до
 *      любых проверок Client-Id: это только проверка соединения;
 *   2. продавца ищем по `client_id` из заголовка (или тела) в
 *      `workshop_settings.ozon_client_id`, сравнивая значения без пробелов;
 *   3. заказ пишем только при точном совпадении, через service_role в обход RLS.
 *
 * Без совпадения `client_id` роут отвечает 403: чужой запрос не должен создать
 * заказ даже при известном URL. Заголовок `X-Ozon-Seller-Client-Id` —
 * основной, `X-Ozon-Client-Id` поддерживаем как запасной вариант.
 *
 * GET на этот адрес — не протокол Ozon, а проверка для человека: открыть в
 * браузере и убедиться, что маршрут жив и его не перехватывает middleware.
 */
export const runtime = "nodejs";

/** Уведомления меняют заказы, поэтому ответ нельзя кэшировать. */
export const dynamic = "force-dynamic";

/** Client-Id Ozon — короткое число, но запас оставляем на строковый формат. */
const MAX_CLIENT_ID_LENGTH = 128;

/** `Ozon: ` занимает 6 символов, а title в базе ограничен 80. */
const MAX_POSTING_NUMBER_LENGTH = 74;

/** Длина SKU в уведомлении; длиннее — уже не идентификатор товара. */
const MAX_SKU_LENGTH = 128;

/** Больше строк в notes всё равно не поместится из-за лимита text. */
const MAX_PRODUCTS = 100;

/** `workshop_orders.notes` — text с check до 1000 символов. */
const MAX_NOTES_LENGTH = 1000;

/**
 * Сколько строк настроек читать на запасном проходе поиска продавца.
 *
 * Запасной проход нужен только для старых записей с пробелами в Client-Id.
 * Ограничение защищает от выгрузки всей таблицы на большом числе продавцов.
 */
const MAX_SELLER_ROWS = 1000;

/** JSON-объект из тела запроса. Массивы и null объектами не считаем. */
type JsonObject = Record<string, unknown>;

/** Нормализованная строка товара из `payload.products`. */
type OzonProductLine = {
  sku: string;
  quantity: number;
};

/** Строка `workshop_settings`, нужная для поиска владельца заказа. */
type SettingsRow = {
  user_id?: unknown;
  ozon_client_id?: unknown;
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Текст из JSON или заголовка.
 *
 * Ozon может прислать `sku` и `client_id` числом, поэтому числа тоже
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

/**
 * Client-Id без пробелов.
 *
 * Продавец копирует значение из личного кабинета, и туда легко попадает
 * неразрывный пробел. Client-Id — число, поэтому пробелы не значат ничего:
 * убираем их и в заголовке, и в теле, и в значении из базы. Пустое значение
 * или переполнение длины — `null`, то есть «идентификатора нет».
 */
function normalizeClientId(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const clientId = value.replace(/[\s\u00a0\u2007\u202f]+/g, "");

  if (!clientId || clientId.length > MAX_CLIENT_ID_LENGTH) {
    return null;
  }

  return clientId;
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

/** Успешное уведомление: тело одинаковое для ping и новых заказов. */
function ok(): Response {
  return json({ result: true });
}

/**
 * Client-Id продавца.
 *
 * Сначала заголовок: Ozon передаёт его в `X-Ozon-Seller-Client-Id`. Если
 * заголовка нет, смотрим `client_id` в корне тела и в `payload` — так удобно
 * тестировать роут через curl и совместимо с теми, кто кладёт поле в JSON.
 */
function readClientId(request: Request, body: JsonObject): string | null {
  const headerClientId = normalizeClientId(
    request.headers.get("x-ozon-seller-client-id") ??
      request.headers.get("x-ozon-client-id"),
  );

  if (headerClientId) {
    return headerClientId;
  }

  const payload = isObject(body.payload) ? body.payload : {};

  for (const candidate of [
    body.client_id,
    body.clientId,
    payload.client_id,
    payload.clientId,
  ]) {
    const clientId = normalizeClientId(readText(candidate));

    if (clientId) {
      return clientId;
    }
  }

  return null;
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

/** Ответ для неизвестного продавца: заказ не создаём. */
function forbidden(): Response {
  return json({ error: "unknown seller" }, 403);
}

/**
 * Настройки продавца по Client-Id.
 *
 * Сначала точное совпадение: так работает обычный случай и используется
 * индекс. Если строк нет, делаем один запасной проход — старые записи могли
 * сохраниться с пробелом внутри Client-Id. Сравнение во втором проходе идёт
 * по нормализованным значениям, поэтому `"12 345"` и `"12345"` совпадут.
 */
async function findSellerSettings(
  admin: ReturnType<typeof createAdminClient>,
  clientId: string,
): Promise<SettingsRow[]> {
  const { data, error } = await admin
    .from("workshop_settings")
    .select("user_id")
    .eq("ozon_client_id", clientId)
    .limit(2);

  if (error) {
    throw error;
  }

  const exact = (data ?? []) as SettingsRow[];

  if (exact.length > 0) {
    return exact;
  }

  const { data: rows, error: fallbackError } = await admin
    .from("workshop_settings")
    .select("user_id, ozon_client_id")
    .not("ozon_client_id", "is", null)
    .limit(MAX_SELLER_ROWS);

  if (fallbackError) {
    throw fallbackError;
  }

  const all = (rows ?? []) as SettingsRow[];

  if (all.length >= MAX_SELLER_ROWS) {
    console.warn("[Ozon] Запасной поиск продавца упёрся в лимит строк.", {
      limit: MAX_SELLER_ROWS,
    });
  }

  return all.filter(
    (row) => normalizeClientId(readText(row.ozon_client_id)) === clientId,
  );
}

/**
 * Новый заказ Ozon.
 *
 * Порядок:
 *   1. без `client_id` — сразу 403, базу не трогаем;
 *   2. ищем ровно одну строку `workshop_settings` с этим Client-Id;
 *   3. повторное уведомление по тому же отправлению не создаёт дубль;
 *   4. пишем заказ с `source = 'ozon'`, `status = 'new'` и заметками.
 */
async function handleNewPosting(
  request: Request,
  body: JsonObject,
): Promise<Response> {
  const clientId = readClientId(request, body);

  if (!clientId) {
    // Без Client-Id владельца не определить. В лог пишем только имена
    // заголовков: значения могут содержать Api-Key.
    console.warn("[Ozon] Client-Id не найден в запросе, заказ отклонён.", {
      ozonHeaders: [...request.headers.keys()].filter((name) =>
        name.includes("ozon"),
      ),
      bodyKeys: Object.keys(body).slice(0, 10),
    });

    return forbidden();
  }

  const posting = readPosting(body);
  const postingNumber = readPostingNumber(posting);

  if (!postingNumber) {
    return json({ error: "invalid posting number" }, 400);
  }

  const inProcessAt = readInProcessAt(posting);
  const products = readProducts(posting);
  const title = `Ozon: ${postingNumber}`;
  const notes = buildNotes(postingNumber, inProcessAt, products);

  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch (error) {
    console.error(
      "[Ozon] Не удалось создать service_role-клиент:",
      error instanceof Error ? error.message : "неизвестная ошибка",
    );

    return json({ error: "webhook is not configured" }, 503);
  }

  let settings: SettingsRow[];

  try {
    settings = await findSellerSettings(admin, clientId);
  } catch (error) {
    console.error("[Ozon] Ошибка запроса настроек продавца:", error);
    return json({ error: "database error" }, 500);
  }

  // Ноль строк — ключи не настроены. Две и больше — один Client-Id занят
  // несколькими аккаунтами: выбирать владельца наугад нельзя.
  if (settings.length !== 1) {
    if (settings.length > 1) {
      console.warn(
        "[Ozon] Client-Id привязан к нескольким настройкам, заказ отклонён.",
      );
    }

    return forbidden();
  }

  const userId = settings[0].user_id;

  if (typeof userId !== "string" || !userId) {
    return forbidden();
  }

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
 * POST /api/webhooks/ozon.
 *
 * Порядок важен: `TYPE_PING` подтверждается до любых проверок Client-Id и до
 * запросов в базу — это проверка соединения, а не заказ. Неизвестные типы
 * уведомлений тоже подтверждаем, иначе Ozon будет повторять их бесконечно.
 * Новый заказ обрабатывается только для известного Client-Id.
 *
 * Тело читаем текстом: так ping подтверждается даже при не-JSON теле, а в
 * лог попадает длина и content-type — по ним видно, что именно прислал Ozon.
 */
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();

  // Пустое тело не может быть заказом: подтверждаем, чтобы Ozon не повторял.
  if (!rawBody.trim()) {
    console.warn("[Ozon] Пустое тело запроса, подтверждено без обработки.", {
      contentType: request.headers.get("content-type"),
    });

    return ok();
  }

  let body: unknown;

  try {
    body = JSON.parse(rawBody);
  } catch {
    // Ozon подтверждает соединение простым `TYPE_PING`; если тело пришло не
    // JSON, проверку всё равно надо закрыть успешно.
    if (looksLikePing(rawBody)) {
      console.log("[Ozon] Ping без JSON-тела, подтверждён.");

      return ok();
    }

    console.warn("[Ozon] Тело запроса не JSON:", {
      contentType: request.headers.get("content-type"),
      length: rawBody.length,
    });

    return json({ error: "invalid json" }, 400);
  }

  if (!isObject(body)) {
    if (looksLikePing(rawBody)) {
      console.log("[Ozon] Ping без JSON-объекта, подтверждён.");

      return ok();
    }

    return json({ error: "invalid json" }, 400);
  }

  const messageType = readMessageType(body)?.toUpperCase() ?? null;

  // Ping — самый первый выход: ни Client-Id, ни база здесь не нужны.
  if (messageType === "TYPE_PING") {
    console.log("[Ozon] Ping подтверждён.");

    return ok();
  }

  if (messageType !== "TYPE_NEW_POSTING") {
    // Остальные события Ozon (отмена, смена статуса) этот роут пока не
    // обрабатывает, но подтверждает, чтобы очередь уведомлений не застряла.
    console.log("[Ozon] Уведомление без обработки:", { messageType });

    return ok();
  }

  return handleNewPosting(request, body);
}

/**
 * GET /api/webhooks/ozon.
 *
 * Не часть протокола Ozon: адрес удобно открыть в браузере и увидеть, что
 * маршрут жив, а middleware его не перехватывает. Уведомления приходят POST.
 */
export async function GET(): Promise<Response> {
  return json({ ok: true, endpoint: "ozon-webhook" });
}

