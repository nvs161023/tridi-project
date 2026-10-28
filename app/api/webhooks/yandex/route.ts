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
 * Кабинет Яндекса дописывает к сохранённому адресу `/notification`, и хвост
 * попадает внутрь значения `token`: в логах Amvera было
 * `Получен: 39fcb3b7-.../notification Ожидался: 39fcb3b7-...`, то есть верный
 * токен получал 403. Поэтому от значения берётся только часть до первого `/`.
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
 * Проверка соединения (`PING`) подтверждается раньше токена и базы: кабинет
 * Яндекса сохраняет адрес только после ответа 2xx, а проверочный запрос может
 * прийти без нашего токена. Ответ на `PING` — конверт `{ version, name, time }`,
 * а не `{ result: true }`: с чужим телом кабинет считает проверку неуспешной.
 * Проверкой считается `PING`/`TYPE_PING` в `notificationType`, `eventType`,
 * `event`, `type` или `message_type`, а также пустое тело и пустой JSON-объект:
 * заказа в них быть не может. Заказ без токена по-прежнему получает 403 —
 * пропуск касается только проверки соединения.
 */
export const runtime = "nodejs";

/** Уведомления меняют заказы, поэтому ответ нельзя кэшировать. */
export const dynamic = "force-dynamic";

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

/**
 * Тело ответа на проверку соединения.
 *
 * Кабинет Яндекса сохраняет адрес вебхука только по 2xx с этим конвертом:
 * `version` — версия протокола проверки, `name` — домен магазина, `time` —
 * момент ответа в ISO-8601. Поля лишние для нас, но именно их ждёт площадка,
 * поэтому тело фиксировано: проверку нельзя случайно «улучшить» до
 * `{ result: true }`.
 */
function pingPayload(): JsonObject {
  return {
    version: "1.0.0",
    name: "tridi-print.ru",
    time: new Date().toISOString(),
  };
}

/**
 * Ответ на проверку соединения.
 *
 * Заголовок задан здесь, а не через `json()`: адрес проверяют снаружи, и ответ
 * должен быть JSON при любом рендере — тип и кодировка прописаны явно.
 */
function pingOk(): Response {
  return new Response(JSON.stringify(pingPayload()), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
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
 * Токен в виде, пригодном для сравнения с базой: без хвоста адреса, без лишних
 * пробелов и в нижнем регистре.
 *
 * Один и тот же токен приходит из адреса, лежит в настройках и попадает в лог —
 * сравнивать их можно только после нормализации. Отрезаем всё после первого
 * `/`: кабинет Яндекса дописывает к адресу `/notification`, и без этого верный
 * токен превращался в `<uuid>/notification` и получал 403. Сам по себе токен
 * (uuid) косой черты не содержит, так что отрезать безопасно; пробел в конце
 * адреса и заглавные буквы тоже не должны давать 403.
 */
function normalizeToken(token: string): string {
  return (token.split("/")[0] ?? "").trim().toLowerCase();
}

/**
 * Текст без BOM.
 *
 * JSON от площадки может начинаться с `\uFEFF`: `JSON.parse` на такой строке
 * падает, и проверка `PING` не срабатывала бы — запрос уходил на проверку
 * токена и получал 403. `trim()` BOM не удаляет.
 */
function stripBom(text: string): string {
  return text.replace(/^\uFEFF/u, "");
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
 * Токен вебхука из query-параметра `token`.
 *
 * Хвост `/notification` отрезает `normalizeToken()`: кабинет дописывает его
 * прямо к значению в адресе, поэтому проверять формат здесь бессмысленно —
 * решает сравнение с сохранённым значением после очистки. Отдельного разбора
 * сегментов пути нет: лишний сегмент Next.js не отдаёт этому маршруту вовсе
 * (`/api/webhooks/yandex/<токен>/notification` — 404), поэтому токен приходит
 * только в query.
 */
function readWebhookToken(request: Request): string {
  return new URL(request.url).searchParams.get("token") ?? "";
}

/**
 * Поля, где площадка кладёт тип уведомления.
 *
 * `notificationType` и `event` — имена Яндекса, `eventType`, `type` и
 * `message_type` — запасные: кабинет присылает проверку разными полями, и по
 * любому из них `PING` должен подтверждаться.
 */
const PING_FIELDS = [
  "notificationType",
  "event",
  "eventType",
  "type",
  "message_type",
] as const;

/** Проверка соединения: `PING` или `TYPE_PING` в значении типа события. */
function isPingEventType(value: unknown): boolean {
  const eventType = readText(value)?.toUpperCase() ?? "";

  return eventType === "PING" || eventType === "TYPE_PING";
}

/** Тело проверки соединения без JSON: ровно `PING` или `TYPE_PING`. */
const PING_BODY_PATTERN = /^(?:type_)?ping$/iu;

/**
 * Почему запрос считается проверкой соединения.
 *
 * Возвращает имя признака или `null`, если это не проверка: имя уходит в лог,
 * и по нему видно, какое поле прислал кабинет, — не приходится угадывать,
 * почему `PING` не подтвердился.
 *
 * Кабинет площадки сохраняет адрес вебхука только после ответа 2xx, поэтому
 * проверку подтверждаем первым делом — до токена и запросов в базу. Признаки:
 *   - пустое тело или пустой JSON-объект `{}` — заказа в них быть не может;
 *   - JSON, где `PING`/`TYPE_PING` лежит в одном из `PING_FIELDS` (остальные
 *     поля не важны);
 *   - простое текстовое тело `PING`/`TYPE_PING`;
 *   - форма `notificationType=PING` (так проверку присылают некоторые клиенты).
 * Слово ping внутри JSON проверкой не считается: решение принимает только поле
 * типа события, иначе сломанный JSON заказа с товаром «Ping» вернул бы 200 и
 * заказ потерялся. BOM в начале тела снимаем: иначе `JSON.parse` падает и
 * `PING` уходил бы на проверку токена.
 */
function readPingSource(bodyText: string): string | null {
  const text = stripBom(bodyText).trim();

  if (!text) {
    return "пустое тело";
  }

  if (PING_BODY_PATTERN.test(text)) {
    return "тело PING";
  }

  try {
    const body: unknown = JSON.parse(text);

    if (!isObject(body)) {
      return null;
    }

    const field = PING_FIELDS.find((name) => isPingEventType(body[name]));

    if (field) {
      return field;
    }

    return Object.keys(body).length === 0 ? "пустой JSON" : null;
  } catch {
    // Не JSON: возможно, проверка пришла формой — смотрим поля ниже.
  }

  const form = new URLSearchParams(text);
  const field = PING_FIELDS.find((name) => isPingEventType(form.get(name)));

  return field ? `форма ${field}` : null;
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
    // 22P02 — значение не приводится к uuid: колонка ещё uuid, а в адресе не
    // UUID. Это не сбой базы, а просто чужой токен — сравниваем с сохранёнными.
    if (readErrorCode(error) === "22P02") {
      return findSellerByStoredToken(admin, normalized);
    }

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
      let savedToken: string | null = null;

      try {
        savedToken = await readStoredToken(admin);
      } catch (error) {
        console.error(
          "[Yandex] Не удалось прочитать сохранённый токен:",
          readErrorCode(error) ?? readErrorMessage(error),
        );
      }

      // Полные значения пишем намеренно: без них в логах Amvera видно только
      // одинаковые префиксы и нельзя понять, какой именно адрес сохранён. Токен
      // здесь уже очищен от хвоста адреса (`normalizeToken`), поэтому «Получен»
      // показывает ровно то значение, которое искали в базе.
      if (savedToken === null) {
        console.error("[Yandex] Токен не найден в базе:", token);
      } else {
        console.error(
          "[Yandex] Токен не совпал. Получен:",
          token,
          "Ожидался:",
          savedToken,
        );
      }

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
 *   1. читаем тело текстом и сразу пишем в лог первые 500 символов — по нему
 *      видно, что именно прислал Яндекс;
 *   2. проверка соединения (`PING`) подтверждается до токена и базы: кабинет
 *      сохраняет адрес только по ответу 2xx, а сам `PING` может прийти без
 *      нашего токена. Ответ — `{ version, name, time }` с
 *      `Content-Type: application/json; charset=utf-8`, а в лог идёт признак,
 *      по которому проверка распознана;
 *   3. для остальных запросов читаем `token` из query и очищаем его от хвоста
 *      `/notification`, который дописывает кабинет, — иначе верный токен не
 *      совпадёт с базой;
 *   4. тело заказа разбираем как JSON.
 */
export async function POST(request: Request): Promise<Response> {
  const bodyText = await request.text();

  console.log("[Yandex] Входящий запрос. Body:", bodyText.slice(0, 500));

  // Проверка соединения — первое, что делает маршрут: ни токена, ни базы, ни
  // разбора заказа. Кабинет сохраняет адрес только по этому ответу, а сам
  // `PING` приходит без нашего токена и без номера заказа, поэтому любая
  // проверка перед ним (в том числе токена) превращала подтверждение в 403.
  const pingSource = readPingSource(bodyText);

  if (pingSource) {
    console.log("[Yandex] PING подтверждён:", pingSource);

    return pingOk();
  }

  const rawToken = readWebhookToken(request);
  const token = normalizeToken(rawToken);

  // Яндекс дописывает к сохранённому адресу `/notification`, и хвост попадает в
  // значение `token`. Пишем в лог и то, что пришло, и очищенное значение: по
  // логу должно быть видно, какой именно токен сравнивался с базой.
  if (rawToken.includes("/")) {
    console.warn("[Yandex] Хвост адреса отброшен от токена:", {
      received: rawToken,
      token,
    });
  }

  if (!token) {
    console.error("[Yandex] Токен не передан в адресе запроса:", {
      path: new URL(request.url).pathname,
    });

    return forbidden();
  }

  let body: unknown;

  try {
    body = JSON.parse(stripBom(bodyText).trim());
  } catch {
    console.warn("[Yandex] Тело запроса не JSON:", {
      contentType: request.headers.get("content-type"),
      length: bodyText.length,
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
 * базу мы не ходим: уведомления приходят POST. В ответ добавлен конверт
 * проверки (`version`, `name`, `time`): если кабинет проверяет адрес не POST-ом,
 * а обычным запросом, он получит те же поля, что и в ответ на `PING`.
 */
export async function GET(): Promise<Response> {
  return json({ ok: true, endpoint: "yandex-webhook", ...pingPayload() });
}
