import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Вебхук Ozon Seller.
 *
 * Ozon присылает сюда уведомления без cookies пользователя и без
 * криптографической подписи, поэтому:
 *   1. `TYPE_PING` подтверждаем сразу — это проверка соединения, база не нужна;
 *   2. продавца ищем по `client_id` из заголовка (или тела) в
 *      `workshop_settings.ozon_client_id`;
 *   3. заказ пишем только при точном совпадении, через service_role в обход RLS.
 *
 * Без совпадения `client_id` роут отвечает 403: чужой запрос не должен создать
 * заказ даже при известном URL. Заголовок `X-Ozon-Seller-Client-Id` —
 * основной, `X-Ozon-Client-Id` поддерживаем как запасной вариант.
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
  const headerClientId = readText(
    request.headers.get("x-ozon-seller-client-id") ??
      request.headers.get("x-ozon-client-id"),
  );

  if (headerClientId) {
    return headerClientId.length <= MAX_CLIENT_ID_LENGTH ? headerClientId : null;
  }

  const payload = isObject(body.payload) ? body.payload : {};

  for (const candidate of [
    body.client_id,
    body.clientId,
    payload.client_id,
    payload.clientId,
  ]) {
    const clientId = readText(candidate);

    if (clientId) {
      return clientId.length <= MAX_CLIENT_ID_LENGTH ? clientId : null;
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
    const { data, error } = await admin
      .from("workshop_settings")
      .select("user_id")
      .eq("ozon_client_id", clientId)
      .limit(2);

    if (error) {
      console.error("[Ozon] Ошибка поиска настроек продавца:", error);
      return json({ error: "database error" }, 500);
    }

    settings = (data ?? []) as SettingsRow[];
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
 * Ozon присылает JSON с `message_type`. Ping и неизвестные типы уведомлений
 * подтверждаем без записи: иначе Ozon будет повторять их бесконечно. Новый
 * заказ обрабатывается только для известного Client-Id.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  if (!isObject(body)) {
    return json({ error: "invalid json" }, 400);
  }

  const messageType = readText(body.message_type);

  if (messageType === "TYPE_PING") {
    return ok();
  }

  if (messageType !== "TYPE_NEW_POSTING") {
    // Остальные события Ozon (отмена, смена статуса) этот роут пока не
    // обрабатывает, но подтверждает, чтобы очередь уведомлений не застряла.
    return ok();
  }

  return handleNewPosting(request, body);
}

