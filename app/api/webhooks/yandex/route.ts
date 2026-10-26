import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";

/**
 * Вебхук Яндекс.Маркета.
 *
 * Яндекс присылает уведомления о заказах без cookies пользователя и без
 * подписи, поэтому продавца определяет персональный адрес:
 *
 *   POST /api/webhooks/yandex?token=<uuid>
 *
 * Токен — тот же `workshop_settings.webhook_token` (uuid, unique), что и у
 * Ozon и WB: строка настроек уже привязана к владельцу, и отдельная колонка
 * площадке не нужна. Строку ищем через service_role: RLS закрывает таблицу
 * для анонимных запросов.
 *
 * Тело уведомления (пример):
 *
 *   {
 *     "orderId": "123456789",
 *     "items": [
 *       { "name": "Ваза", "quantity": 2, "price": 1500, "sku": "VZ-01" }
 *     ],
 *     "total": 3000
 *   }
 *
 * `orderId` — номер заказа Яндекса, он попадает в title («Яндекс: 123456789»).
 * `items` — состав заказа: название, количество, а также артикул и цена, если
 * площадка их прислала. `total` — сумма заказа, она ложится в `total_cost`.
 *
 * Заказ пишется с `source = 'yandex'` и `status = 'new'`. Повтор уведомления с
 * тем же номером не создаёт дубль: заказ ищется по title, который собирается
 * детерминированно. GET на этот адрес — не протокол Яндекса, а проверка для
 * человека: открыть в браузере и убедиться, что маршрут жив и его не
 * перехватывает middleware.
 *
 * Проверка соединения (`PING`) подтверждается раньше токена: кабинет Яндекса
 * сохраняет адрес только после ответа 2xx, а проверочный запрос приходит без
 * нашего токена или с обрезанным адресом. Заказ без токена по-прежнему получает
 * 403 — пропуск касается только запросов, в которых нет номера заказа.
 */
export const runtime = "nodejs";

/** Уведомления меняют заказы, поэтому ответ нельзя кэшировать. */
export const dynamic = "force-dynamic";

/** UUID из `gen_random_uuid()`: любой другой текст токеном не считаем. */
const WEBHOOK_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * Сколько символов токена попадает в лог.
 *
 * Полный токен — это пароль от адреса вебхука: зная его, можно присылать
 * заказы. Восьми символов хватает, чтобы отличить «вставили другой адрес» от
 * «вставили этот же», и мало, чтобы токен подобрать.
 */
const TOKEN_LOG_PREFIX_LENGTH = 8;

/**
 * Сколько сохранённых токенов читаем для запасного сравнения.
 *
 * Строк `workshop_settings` столько же, сколько продавцов, — их единицы.
 * Предел нужен только чтобы запрос не вырос вместе с таблицей.
 */
const MAX_STORED_TOKENS = 100;

/** `Яндекс: ` занимает 8 символов, а title в базе ограничен 80. */
const MAX_ORDER_ID_LENGTH = 72;

/** Длиннее — уже не название товара, а мусор в уведомлении. */
const MAX_ITEM_NAME_LENGTH = 120;

/** Длина артикула в уведомлении; длиннее — уже не идентификатор товара. */
const MAX_SKU_LENGTH = 128;

/** Больше позиций в notes всё равно не поместится из-за лимита text. */
const MAX_ITEMS = 100;

/** Количество одной позиции: больше миллиона единиц в заказе не бывает. */
const MAX_ITEM_QUANTITY = 1_000_000;

/** `workshop_orders.notes` — text с check до 1000 символов. */
const MAX_NOTES_LENGTH = 1000;

/** `workshop_orders.total_cost` — numeric(10,2) от 0 до 1 000 000. */
const MAX_TOTAL_COST = 1_000_000;

/** JSON-объект из тела запроса. Массивы и null объектами не считаем. */
type JsonObject = Record<string, unknown>;

/**
 * Позиция заказа в notes.
 *
 * Храним только то, что нужно мастерской: название, количество и, если они
 * пришли, артикул и цену. Произвольные поля уведомления не копируем целиком:
 * они не нужны в заказе и легко вытесняют весь состав за лимит notes.
 */
type YandexOrderItem = {
  name: string;
  quantity: number;
  sku?: string;
  price?: number;
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
 * Номер заказа, название товара и артикул Яндекс может прислать числом,
 * поэтому числа тоже принимаем. Пустая строка — «значения нет».
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

/** Успешное уведомление: Яндекс считает заказ принятым по ответу 2xx. */
function ok(): Response {
  return json({ result: true });
}

/** Неизвестный или отсутствующий токен: заказ не создаём. */
function forbidden(): Response {
  return json({ error: "unknown seller" }, 403);
}

/** Миграция не применена: Яндекс повторит уведомление после её применения. */
function notConfigured(): Response {
  return json({ error: "webhook is not configured" }, 503);
}

/**
 * Токен без лишних пробелов и с нижним регистром.
 *
 * Один и тот же токен приходит из query-параметра, лежит в настройках и
 * попадает в лог — сравнивать их можно только после нормализации: пробел в
 * конце адреса или заглавные буквы не должны превращать заказ в 403.
 */
function normalizeToken(token: string): string {
  return token.trim().toLowerCase();
}

/** Первые символы токена для лога: полный токен в лог не пишем. */
function maskToken(token: string): string {
  return normalizeToken(token).slice(0, TOKEN_LOG_PREFIX_LENGTH);
}

/** Совпадают ли токены после нормализации; `null` — сохранённого токена нет. */
function isSameWebhookToken(
  received: string,
  expected: string | null,
): boolean {
  return (
    expected !== null && normalizeToken(received) === normalizeToken(expected)
  );
}

/**
 * Токен вебхука из query-параметра.
 *
 * Принимаем только UUID: так отсекаются случайные ссылки и попытки передать
 * произвольный текст. Регистр приводим к нижнему — PostgREST сравнивает uuid
 * без учёта регистра, но в интерфейсе адрес всегда одинаковый.
 */
function readWebhookToken(request: Request): string | null {
  const token = normalizeToken(
    new URL(request.url).searchParams.get("token") ?? "",
  );

  return WEBHOOK_TOKEN_PATTERN.test(token) ? token : null;
}

/** Тип события уведомления: `event` — поле Яндекса, остальные — запасные. */
function readEventType(body: JsonObject): string | null {
  return (
    readText(body.event) ??
    readText(body.eventType) ??
    readText(body.type) ??
    readText(body.message_type)
  );
}

/** Проверка соединения в JSON: `PING` или `TYPE_PING` в поле события. */
function isPingEvent(body: JsonObject): boolean {
  const eventType = readEventType(body)?.toUpperCase() ?? null;

  return eventType === "PING" || eventType === "TYPE_PING";
}

/** Тело проверки соединения без JSON: ровно `PING` или `TYPE_PING`. */
const PING_BODY_PATTERN = /^(?:type_)?ping$/iu;

/**
 * Похож ли запрос на проверку соединения.
 *
 * Кабинет площадки сохраняет адрес вебхука только после ответа 2xx, поэтому
 * такую проверку подтверждаем раньше токена. Признаки:
 *   - пустое тело — заказа в нём быть не может;
 *   - JSON с типом события `PING`/`TYPE_PING` (остальные поля не важны);
 *   - не-JSON тело, целиком равное `PING`/`TYPE_PING`.
 * Слово ping внутри JSON проверкой не считается: решение принимает только поле
 * события, иначе сломанный JSON заказа с товаром «Ping» вернул бы 200 и заказ
 * потерялся. По той же причине не-JSON тело сравнивается целиком, а не поиском
 * подстроки.
 */
function isPingRequest(rawBody: string): boolean {
  const text = rawBody.trim();

  if (!text) {
    return true;
  }

  if (!text.startsWith("{") && !text.startsWith("[")) {
    return PING_BODY_PATTERN.test(text);
  }

  try {
    const body: unknown = JSON.parse(text);

    return isObject(body) ? isPingEvent(body) : PING_BODY_PATTERN.test(text);
  } catch {
    return PING_BODY_PATTERN.test(text);
  }
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
  const normalized = normalizeToken(token);

  const { data, error } = await admin
    .from("workshop_settings")
    .select("user_id")
    .eq("webhook_token", normalized)
    .limit(2);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as { user_id?: unknown }[];

  if (rows.length > 1) {
    console.warn("[Yandex] Токен вебхука привязан к нескольким настройкам.");
    return null;
  }

  const userId = rows[0]?.user_id;

  if (typeof userId === "string" && userId) {
    return userId;
  }

  // Строка не нашлась точным сравнением: возможно, в настройках токен записан
  // с пробелом или в верхнем регистре (колонка `text`, а не `uuid`). Тогда
  // PostgREST вернёт пусто, хотя адрес тот же, — сравниваем сами.
  return findSellerByStoredToken(admin, normalized);
}

/**
 * Запасной поиск продавца: сравнение с сохранёнными токенами в JS.
 *
 * Нужен только если точный запрос не нашёл строку. Обычный путь — один `eq` по
 * индексу, поэтому чтение сохранённых токенов не стоит ничего на каждый заказ.
 */
async function findSellerByStoredToken(
  admin: Admin,
  token: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("workshop_settings")
    .select("user_id, webhook_token")
    .not("webhook_token", "is", null)
    .limit(MAX_STORED_TOKENS);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as { user_id?: unknown; webhook_token?: unknown }[];
  const match = rows.find((row) =>
    isSameWebhookToken(
      token,
      typeof row.webhook_token === "string" ? row.webhook_token : null,
    ),
  );
  const userId = match?.user_id;

  return typeof userId === "string" && userId ? userId : null;
}

/**
 * Первый сохранённый токен вебхука: им подписан лог несовпадения.
 *
 * Токен уникален, поэтому «ожидаемый» — это токен из строки настроек. Если
 * строк несколько (несколько продавцов), для лога всё равно берём первый: он
 * отвечает на вопрос «какой токен сейчас в настройках», а не «чей это адрес».
 */
async function readStoredToken(admin: Admin): Promise<string | null> {
  const { data, error } = await admin
    .from("workshop_settings")
    .select("webhook_token")
    .not("webhook_token", "is", null)
    .limit(1);

  if (error) {
    throw error;
  }

  const stored = (data ?? [])[0]?.webhook_token;

  if (typeof stored !== "string" || !stored.trim()) {
    return null;
  }

  return normalizeToken(stored);
}

/**
 * Лог несовпадения токена.
 *
 * Пишем только первые символы обоих токенов (см. `TOKEN_LOG_PREFIX_LENGTH`):
 * по логу видно, тот ли адрес вставлен в кабинете площадки, а сам токен в
 * логах не оседает. Ожидаемый токен читаем из настроек — он и есть эталон.
 *
 * `admin` передаётся, если клиент service_role уже создан: второй раз его
 * создавать незачем.
 */
async function reportTokenMismatch(
  received: string,
  admin: Admin | null = null,
): Promise<void> {
  console.warn(`[Yandex] Получен токен: ${maskToken(received)}`);

  let client: Admin;

  try {
    client = admin ?? createAdminClient();
  } catch (error) {
    console.warn(
      "[Yandex] Ожидаемый токен: не удалось создать service_role-клиент —",
      readErrorMessage(error),
    );

    return;
  }

  try {
    const expected = await readStoredToken(client);

    console.warn(
      expected === null
        ? "[Yandex] Ожидаемый токен: (в настройках нет сохранённого токена)"
        : `[Yandex] Ожидаемый токен: ${maskToken(expected)}`,
    );

    if (isSameWebhookToken(received, expected)) {
      // Сюда не попадаем при обычном поиске: он тоже сравнивает нормализованно.
      // Строка нужна, если токен пришёл в неверном формате (не UUID), но
      // совпадает с настройками посимвольно.
      console.warn(
        "[Yandex] Токен совпадает с настройками после нормализации, но не прошёл проверку формата UUID.",
      );
    }
  } catch (error) {
    console.warn(
      "[Yandex] Ожидаемый токен: не удалось прочитать настройки —",
      readErrorCode(error) ?? readErrorMessage(error),
    );
  }
}

/**
 * Поиск продавца с готовым ответом на любую ошибку.
 *
 * Отсутствие токена — это 403. Ошибка базы — 500, а неприменённая миграция —
 * 503: Яндекс повторит уведомление, когда владелец применит SQL, и заказ не
 * потеряется.
 */
async function resolveSeller(token: string): Promise<SellerLookup> {
  let admin: Admin;

  try {
    admin = createAdminClient();
  } catch (error) {
    console.error(
      "[Yandex] Не удалось создать service_role-клиент:",
      readErrorMessage(error),
    );

    return { admin: null, userId: null, failure: notConfigured() };
  }

  try {
    const userId = await findSellerByToken(admin, token);

    if (!userId) {
      await reportTokenMismatch(token, admin);

      return { admin: null, userId: null, failure: forbidden() };
    }

    return { admin, userId, failure: null };
  } catch (error) {
    const code = readErrorCode(error);
    const message = readErrorMessage(error);

    console.error("[Yandex] Ошибка поиска продавца по токену:", code, message);

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
 * Номер заказа из `orderId`.
 *
 * Без номера заказ не создать: title собирается из него, а по title
 * проверяется дубль. Управляющие символы в title не нужны, поэтому такой
 * номер считаем некорректным.
 */
function readOrderId(body: JsonObject): string | null {
  const orderId = readText(body.orderId);

  if (!orderId || orderId.length > MAX_ORDER_ID_LENGTH) {
    return null;
  }

  return /[\u0000-\u001f\u007f]/.test(orderId) ? null : orderId;
}

/**
 * Сумма из `total` или `price`.
 *
 * Яндекс может прислать число или строку с точкой/запятой и пробелами между
 * разрядами. `null` — значение не число, отрицательное или больше лимита
 * `numeric(10,2)`; такой заказ или цена не должны ронять вставку.
 */
function readMoney(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim().replace(/\s+/g, "").replace(",", "."))
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_TOTAL_COST) {
    return null;
  }

  // numeric(10,2): округляем, чтобы 1499.999 не превратилось в ошибку базы.
  return Math.round(parsed * 100) / 100;
}

/**
 * Сумма заказа из `total`.
 *
 * Отсутствующая сумма — это 0: заказ важнее суммы, её можно поправить в
 * мастерской. Явно некорректная сумма отклоняется, иначе `total_cost` не
 * пройдёт check и заказ потеряется с 500.
 */
function readTotal(body: JsonObject): number | null {
  const raw = body.total;

  if (raw === undefined || raw === null || raw === "") {
    return 0;
  }

  return readMoney(raw);
}

/**
 * Количество позиции.
 *
 * Яндекс присылает его числом или строкой; неизвестное и нулевое значение
 * считаем одной единицей, чтобы позиция не исчезла из состава. Дробное
 * количество округляем: в заказе мастерской считаются целые изделия.
 */
function readQuantity(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim().replace(",", "."))
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }

  return Math.min(MAX_ITEM_QUANTITY, Math.max(1, Math.round(parsed)));
}

/** Название позиции: `name` — основное поле, остальные — запасные. */
function readItemName(item: JsonObject): string | null {
  const name =
    readText(item.name) ?? readText(item.title) ?? readText(item.offerName);

  return name ? name.slice(0, MAX_ITEM_NAME_LENGTH) : null;
}

/** Артикул позиции: `sku`, `offerId` или `shopSku`. */
function readItemSku(item: JsonObject): string | null {
  const sku =
    readText(item.sku) ?? readText(item.offerId) ?? readText(item.shopSku);

  return sku ? sku.slice(0, MAX_SKU_LENGTH) : null;
}

/**
 * Состав заказа из `items`.
 *
 * Ожидается массив объектов, но строку или один объект тоже принимаем как
 * одну позицию — так уведомление не потеряется из-за формата. Позиция без
 * названия и артикула бесполезна и пропускается. Количество и цену не
 * отбрасываем: по ним мастерская видит, что именно заказали.
 */
function readItems(body: JsonObject): YandexOrderItem[] {
  const raw = body.items;
  const values = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
  const items: YandexOrderItem[] = [];

  for (const value of values) {
    if (items.length >= MAX_ITEMS) {
      break;
    }

    if (typeof value === "string") {
      const name = value.trim().slice(0, MAX_ITEM_NAME_LENGTH);

      if (name) {
        items.push({ name, quantity: 1 });
      }

      continue;
    }

    if (!isObject(value)) {
      continue;
    }

    const name = readItemName(value);
    const sku = readItemSku(value);
    const title = name ?? sku;

    if (!title) {
      continue;
    }

    const item: YandexOrderItem = {
      name: title,
      quantity: readQuantity(value.quantity ?? value.count),
    };

    if (sku) {
      item.sku = sku;
    }

    const price = readMoney(value.price);

    if (price !== null) {
      item.price = price;
    }

    items.push(item);
  }

  return items;
}

/**
 * Заметки заказа: JSON с составом.
 *
 * notes ограничены 1000 символами, а названия и артикулы бывают длинными.
 * Поэтому отбрасываем позиции с конца, пока JSON помещается, и честно пишем,
 * сколько позиций не вошло: обрезанная строка ломала бы JSON.
 */
function buildNotes(items: YandexOrderItem[]): string {
  const notes = JSON.stringify({ items });

  if (notes.length <= MAX_NOTES_LENGTH) {
    return notes;
  }

  const kept = [...items];

  while (kept.length > 0) {
    kept.pop();

    const candidate = JSON.stringify({
      items: kept,
      omitted: items.length - kept.length,
    });

    if (candidate.length <= MAX_NOTES_LENGTH) {
      return candidate;
    }
  }

  return JSON.stringify({ items: [], omitted: items.length });
}

/**
 * Новый заказ Яндекс.Маркета.
 *
 * Порядок:
 *   1. ищем продавца: без известного токена уведомление получает 403, даже
 *      если тело не похоже на заказ;
 *   2. разбираем номер, сумму и состав — без номера заказ не создать;
 *   3. повторное уведомление по тому же номеру не создаёт дубль;
 *   4. пишем заказ с `source = 'yandex'`, `status = 'new'` и `total_cost`.
 */
async function handleOrder(token: string, body: JsonObject): Promise<Response> {
  const seller = await resolveSeller(token);

  if (seller.failure) {
    return seller.failure;
  }

  const orderId = readOrderId(body);

  if (!orderId) {
    return json({ error: "invalid order id" }, 400);
  }

  const total = readTotal(body);

  if (total === null) {
    return json({ error: "invalid total" }, 400);
  }

  const items = readItems(body);
  const title = `Яндекс: ${orderId}`;
  const notes = buildNotes(items);
  const { admin, userId } = seller;

  try {
    // Отдельной колонки с номером заказа Яндекса нет, поэтому повтор ищем по
    // title: он собирается из `orderId` детерминированно.
    const { data: existing, error: existingError } = await admin
      .from("workshop_orders")
      .select("id")
      .eq("user_id", userId)
      .eq("source", "yandex")
      .eq("title", title)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error("[Yandex] Ошибка проверки повторного заказа:", existingError);

      return isMissingTableSchema(
        existingError.code,
        existingError.message,
      )
        ? notConfigured()
        : json({ error: "database error" }, 500);
    }

    if (existing) {
      console.log("[Yandex] Повторное уведомление, заказ уже создан:", {
        userId,
        orderId,
      });

      return ok();
    }
  } catch (error) {
    console.error("[Yandex] Ошибка проверки повторного заказа:", error);

    return json({ error: "database error" }, 500);
  }

  try {
    const { error } = await admin.from("workshop_orders").insert({
      user_id: userId,
      source: "yandex",
      title,
      status: "new",
      total_cost: total,
      notes,
    });

    if (error) {
      // Уникального индекса на номер заказа нет, но если он появится, повтор
      // уведомления должен остаться успешным для Яндекса.
      if (error.code === "23505") {
        return ok();
      }

      console.error("[Yandex] Ошибка записи заказа:", error);

      return isMissingTableSchema(error.code, error.message)
        ? notConfigured()
        : json({ error: "database error" }, 500);
    }
  } catch (error) {
    console.error("[Yandex] Ошибка записи заказа:", error);

    return json({ error: "database error" }, 500);
  }

  console.log("[Yandex] Заказ создан:", {
    userId,
    orderId,
    items: items.length,
    total,
  });

  return ok();
}

/**
 * POST /api/webhooks/yandex?token=<uuid>.
 *
 * Порядок:
 *   1. проверка соединения (`PING`) подтверждается сразу, до токена и базы:
 *      иначе кабинет Яндекса не сохранит адрес;
 *   2. без корректного UUID в адресе отвечаем 403 до запросов в базу, а в лог
 *      пишем первые символы полученного и сохранённого токенов — так видно, тот
 *      ли адрес вставлен в кабинете;
 *   3. остальное — заказ из тела.
 *
 * Тело читаем текстом: в лог попадают длина и content-type, по ним видно, что
 * именно прислал Яндекс, а не просто «invalid json».
 */
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();

  if (isPingRequest(rawBody)) {
    console.log("[Yandex] Ping подтверждён.", {
      hasToken: new URL(request.url).searchParams.has("token"),
      contentType: request.headers.get("content-type"),
    });

    return ok();
  }

  const token = readWebhookToken(request);
  const rawToken = new URL(request.url).searchParams.get("token");

  if (!token) {
    console.warn("[Yandex] Запрос без корректного токена вебхука, отклонён.", {
      hasToken: rawToken !== null,
      contentType: request.headers.get("content-type"),
    });

    // Токен пришёл, но не UUID: пишем в лог, что именно пришло. Пустой
    // параметр не логируем — это не «несовпадение», а запрос без токена.
    if (rawToken !== null && rawToken.trim()) {
      await reportTokenMismatch(rawToken);
    }

    return forbidden();
  }

  let body: unknown;

  try {
    body = JSON.parse(rawBody);
  } catch {
    console.warn("[Yandex] Тело запроса не JSON:", {
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
 * GET /api/webhooks/yandex.
 *
 * Не часть протокола Яндекса: адрес удобно открыть в браузере и увидеть, что
 * маршрут жив, а middleware его не перехватывает. Токен здесь не нужен и в
 * базу мы не ходим: уведомления приходят POST.
 */
export async function GET(): Promise<Response> {
  return json({ ok: true, endpoint: "yandex-webhook" });
}
