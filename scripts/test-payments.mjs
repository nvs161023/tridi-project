/**
 * Интеграционная проверка платежей Robokassa: чек 54-ФЗ, выдача доступа и
 * идемпотентность повторных уведомлений.
 *
 * Запуск: `npm run check:payments` (или `node scripts/test-payments.mjs`).
 *
 * Скрипт не открывает интерфейс оплаты и не списывает деньги: он подписывает
 * уведомление ResultURL паролем №2 и передаёт его прямо в роут
 * `app/api/payments/robokassa/result/route.ts`. Поэтому проверяется именно тот
 * код, который обрабатывает настоящие платежи.
 *
 * Что закрывает тест:
 *   0. миграции: обе RPC (`credit_token_purchase`,
 *      `apply_pro_subscription_purchase`) видны PostgREST — иначе тест называет
 *      файл миграции, которую нужно применить, и продление идёт без транзакции;
 *   1. чек 54-ФЗ (`buildReceipt`) для всех товаров: одна позиция, название из
 *      тарифа, сумма = `OutSum`, `tax: none`, «полный расчёт», «услуга»;
 *   2. ссылка на оплату: `Receipt` кодируется один раз, подпись считается по
 *      сырому JSON, цена не подменяется клиентом;
 *   3. пакет Standard за 500 ₽: запись в `purchases` и `token_purchases`,
 *      `user_credits.standard_tokens + 10`;
 *   4. подписка Pro за 1486 ₽: `purchases.expires_at` и `subscriptions` на
 *      30 дней, второй InvId добавляет ещё 30 дней, повторный — нет;
 *   5. курс confident за 2990 ₽: бессрочная покупка и доступ к урокам;
 *   6. повторный InvId не выдаёт товар второй раз;
 *   7. неверная подпись, чужая сумма и неизвестный товар отклоняются с 400.
 *
 * Нужны переменные из `.env.local` (или окружения): NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, ROBOKASSA_PASSWORD2, ROBOKASSA_LOGIN и
 * ROBOKASSA_PASSWORD1. Тест работает с живой базой, но только со своим
 * временным пользователем: покупки, токены, подписка и сам пользователь
 * удаляются в конце даже при провале проверки.
 *
 * Если таблиц `token_purchases` и функции `credit_token_purchase` ещё нет,
 * сначала примените `supabase/user_credits.sql`; подписке нужен
 * `supabase/subscriptions_recurring.sql`, покупкам — `supabase/purchases.sql`.
 * Тест проверяет наличие обеих функций до первого уведомления, поэтому
 * незакрытая миграция видна как провал, а не как тихая работа запасным путём.
 */
import "./register-alias.mjs";

import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const ROOT = path.resolve(import.meta.dirname, "..");

/**
 * Читает файл переменных окружения: `ключ=значение`, кавычки снимаются.
 * Формат тот же, что у Next.js в `.env.local`.
 */
function readEnv(file) {
  const full = path.join(ROOT, file);

  if (!fs.existsSync(full)) {
    return {};
  }

  const env = {};

  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");

    if (index <= 0) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

const localEnv = readEnv(".env.local");

/** Значение из окружения важнее `.env.local`: так тест можно запускать в CI. */
function fromEnv(name) {
  return process.env[name] ?? localEnv[name] ?? "";
}

const supabaseUrl = fromEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = fromEnv("SUPABASE_SERVICE_ROLE_KEY");
const password2 = fromEnv("ROBOKASSA_PASSWORD2");
const login = fromEnv("ROBOKASSA_LOGIN");
const password1 = fromEnv("ROBOKASSA_PASSWORD1");

const missing = [
  ["NEXT_PUBLIC_SUPABASE_URL", supabaseUrl],
  ["SUPABASE_SERVICE_ROLE_KEY", serviceKey],
  ["ROBOKASSA_PASSWORD2", password2],
  ["ROBOKASSA_LOGIN", login],
  ["ROBOKASSA_PASSWORD1", password1],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missing.length > 0) {
  console.error(
    `Не заданы переменные: ${missing.join(", ")}.\n` +
      "Добавьте их в .env.local или передайте в окружении. ROBOKASSA_PASSWORD2 " +
      "нужен для подписи уведомления, ROBOKASSA_LOGIN и ROBOKASSA_PASSWORD1 — " +
      "для проверки ссылки на оплату.",
  );
  process.exit(1);
}

// Роут читает окружение при вызове, поэтому достаточно выставить значения до
// первого запроса. Тестовый режим не влияет на вебхук, но нужен ссылке оплаты.
process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
process.env.ROBOKASSA_PASSWORD2 = password2;
process.env.ROBOKASSA_LOGIN = login;
process.env.ROBOKASSA_PASSWORD1 = password1;

if (!process.env.ROBOKASSA_IS_TEST && localEnv.ROBOKASSA_IS_TEST) {
  process.env.ROBOKASSA_IS_TEST = localEnv.ROBOKASSA_IS_TEST;
}

const {
  PAYMENT_PLANS,
  SUBSCRIPTION_PERIOD_DAYS,
  buildReceipt,
  buildResultSignature,
  buildShpSignaturePart,
  formatOutSum,
  getPaymentAmount,
  initializePayment,
} = await import("@/lib/payments");
const { TOKEN_PACKS } = await import("@/lib/generation-plans");
const { POST } = await import("@/app/api/payments/robokassa/result/route");
const { hasActiveSubscription, hasCourseAccess } = await import(
  "@/lib/subscription"
);

const admin = createSupabaseClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DAY_MS = 24 * 60 * 60 * 1000;

let failures = 0;

/** Печатает результат одной проверки и считает провалы. */
function check(name, ok, details) {
  console.log(`${ok ? "✓" : "✗"} ${name} — ${details}`);

  if (!ok) {
    failures += 1;
  }
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

/** MD5 в нижнем регистре — формат подписи Robokassa. */
function md5(value) {
  return createHash("md5").update(value, "utf8").digest("hex");
}

/** Время даты в миллисекундах; null и мусор — NaN. */
function timeOf(value) {
  if (!value) {
    return Number.NaN;
  }

  return Date.parse(value);
}

/**
 * Номер заказа для уведомления. Как и `nextInvId` в приложении, это
 * миллисекунды с хвостом: значения не пересекаются с настоящими платежами.
 */
const invBase = Date.now() * 1000 + randomInt(0, 1000);
let invOffset = 0;

function nextInvId() {
  invOffset += 1;

  return invBase + invOffset;
}

/** Строка `purchases` по номеру заказа; null — покупки нет. */
async function readPurchase(invId) {
  const { data, error } = await admin
    .from("purchases")
    .select("inv_id, user_id, course_id, amount, expires_at")
    .eq("inv_id", invId)
    .maybeSingle();

  if (error) {
    throw new Error(`Не удалось прочитать purchases: ${error.message}`);
  }

  return data;
}

/** Строка `token_purchases` по номеру заказа; null — пакет не начислен. */
async function readTokenPurchase(invId) {
  const { data, error } = await admin
    .from("token_purchases")
    .select("inv_id, user_id, kind, quantity")
    .eq("inv_id", invId)
    .maybeSingle();

  if (error) {
    throw new Error(`Не удалось прочитать token_purchases: ${error.message}`);
  }

  return data;
}

/** Баланс токенов пользователя; null — строки ещё нет. */
async function readCredits(userId) {
  const { data, error } = await admin
    .from("user_credits")
    .select("standard_tokens, ultra_tokens")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Не удалось прочитать user_credits: ${error.message}`);
  }

  return data;
}

/** Последняя строка подписки пользователя (по updated_at). */
async function readSubscription(userId) {
  const { data, error } = await admin
    .from("subscriptions")
    .select("id, status, expires_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Не удалось прочитать subscriptions: ${error.message}`);
  }

  return data;
}

/** Сколько строк с таким номером заказа осталось в таблице. */
async function countByInvId(table, invId) {
  const { count, error } = await admin
    .from(table)
    .select("inv_id", { count: "exact", head: true })
    .eq("inv_id", invId);

  if (error) {
    throw new Error(`Не удалось посчитать ${table}: ${error.message}`);
  }

  return count ?? 0;
}

/** Сколько строк подписки у пользователя. */
async function countSubscriptions(userId) {
  const { count, error } = await admin
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Не удалось посчитать subscriptions: ${error.message}`);
  }

  return count ?? 0;
}

/**
 * Подписанное уведомление ResultURL — ровно так его присылает Robokassa.
 *
 * `signature` можно подменить, чтобы проверить отказ: остальные параметры
 * остаются корректными.
 */
async function webhook({ invId, courseId, userId, outSum, signature = "" }) {
  const shp = { course: courseId, user: userId };
  const params = new URLSearchParams({
    OutSum: outSum,
    InvId: String(invId),
    SignatureValue:
      signature || buildResultSignature(outSum, String(invId), shp, password2),
    Shp_course: courseId,
    Shp_user: userId,
  });

  const response = await POST(
    new Request("http://localhost/api/payments/robokassa/result", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    }),
  );

  return { status: response.status, body: (await response.text()).trim() };
}

/** Ответ Robokassa: 200 и текст `OK{InvId}`. */
function isOk(answer, invId) {
  return answer.status === 200 && answer.body === `OK${invId}`;
}

/**
 * Видна ли SQL-функция из PostgREST.
 *
 * OpenAPI-описание схемы (`GET /rest/v1/`) перечисляет доступные RPC. Проверка
 * отделяет «миграция применена» от «вебхук сработал запасным путём»: без
 * `apply_pro_subscription_purchase` два одновременных уведомления продлевают
 * подписку не атомарно, а без `credit_token_purchase` токены начисляются
 * отдельными запросами. Оба случая тест должен называть вслух, а не скрывать.
 */
async function hasRpc(name) {
  const response = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
  });

  if (!response.ok) {
    throw new Error(`PostgREST ответил ${response.status} на описание схемы`);
  }

  const spec = await response.json();

  return Object.keys(spec.paths ?? {}).includes(`/rpc/${name}`);
}

/**
 * Удаляет всё, что создал тест: покупки, пакеты, подписку, баланс и временного
 * пользователя. Ошибки печатаем, но не бросаем — иначе они скроют итог.
 */
async function cleanup(userId) {
  if (!userId) {
    console.log("Очистка: временный пользователь не создавался.");

    return;
  }

  const tables = ["token_purchases", "purchases", "subscriptions", "user_credits"];

  for (const table of tables) {
    const { error } = await admin.from(table).delete().eq("user_id", userId);

    if (error) {
      console.warn(`Очистка ${table}: ${error.code ?? ""} ${error.message}`);
    }
  }

  const { error } = await admin.auth.admin.deleteUser(userId);

  check(
    "Временный пользователь и его данные удалены",
    !error,
    error ? `${error.code ?? ""} ${error.message}` : userId,
  );
}

let userId = "";
let userEmail = "";

try {
  section("0. Временный пользователь");

  userEmail = `payments-test-${Date.now()}-${randomBytes(4).toString("hex")}` +
    "@example.com";

  const { data, error } = await admin.auth.admin.createUser({
    email: userEmail,
    password: `Pay-${randomBytes(12).toString("hex")}`,
    email_confirm: true,
  });

  if (error || !data?.user) {
    throw new Error(
      `Не удалось создать временного пользователя: ${
        error?.message ?? "пользователь не вернулся"
      }`,
    );
  }

  userId = data.user.id;
  check("Пользователь создан", true, `${userEmail} (${userId})`);

  section("0.1. SQL-функции в базе");

  const creditsRpc = await hasRpc("credit_token_purchase");
  const renewalRpc = await hasRpc("apply_pro_subscription_purchase");

  check(
    "credit_token_purchase доступна PostgREST",
    creditsRpc,
    creditsRpc
      ? "миграция user_credits.sql применена"
      : "примените supabase/user_credits.sql — токены начисляются без RPC",
  );

  check(
    "apply_pro_subscription_purchase доступна PostgREST",
    renewalRpc,
    renewalRpc
      ? "миграция subscriptions_recurring.sql применена"
      : "примените supabase/subscriptions_recurring.sql — продление без транзакции",
  );

  section("1. Чек 54-ФЗ для всех товаров");

  const expectedFields = [
    "name",
    "payment_method",
    "payment_object",
    "quantity",
    "sum",
    "tax",
  ].join(",");

  for (const [courseId, plan] of Object.entries(PAYMENT_PLANS)) {
    const amount = getPaymentAmount(courseId);
    const receipt = buildReceipt(courseId, amount);
    const item = receipt.items[0];

    check(
      `Чек ${courseId}: название, сумма и количество`,
      receipt.items.length === 1 &&
        item.name === plan.title &&
        item.sum === amount &&
        item.quantity === 1,
      `${item.name} — ${item.sum} ₽ × ${item.quantity}`,
    );

    check(
      `Чек ${courseId}: услуга, полный расчёт, без НДС`,
      item.payment_method === "full_payment" &&
        item.payment_object === "service" &&
        item.tax === "none" &&
        Object.keys(item).sort().join(",") === expectedFields,
      `${item.payment_method}/${item.payment_object}/tax=${item.tax}`,
    );

    check(
      `Чек ${courseId}: название короче 128 символов`,
      item.name.length <= 128,
      `${item.name.length} символов`,
    );
  }

  check(
    "Чек Standard содержит количество генераций",
    buildReceipt(TOKEN_PACKS.standard.courseId, TOKEN_PACKS.standard.price)
      .items[0].name.includes(String(TOKEN_PACKS.standard.quantity)),
    buildReceipt(TOKEN_PACKS.standard.courseId, TOKEN_PACKS.standard.price)
      .items[0].name,
  );

  section("2. Ссылка на оплату: Receipt и подпись");

  const pack = TOKEN_PACKS.standard;
  const packAmount = getPaymentAmount(pack.courseId);
  const intent = initializePayment({
    courseId: pack.courseId,
    amount: packAmount,
    userEmail,
    userId,
  });
  const intentUrl = new URL(intent.url);
  const receiptJson = JSON.stringify(buildReceipt(pack.courseId, packAmount));
  const receiptInUrl = intentUrl.searchParams.get("Receipt");
  const shp = { course: pack.courseId, user: userId };

  check(
    "OutSum в ссылке — два знака после точки",
    intentUrl.searchParams.get("OutSum") === formatOutSum(packAmount),
    intentUrl.searchParams.get("OutSum") ?? "нет",
  );

  check(
    "Receipt кодируется один раз и совпадает с buildReceipt",
    receiptInUrl === receiptJson &&
      !intent.url.includes("%257B") &&
      intent.url.includes("&Receipt=%7B"),
    receiptInUrl === receiptJson ? "JSON совпал" : "JSON не совпал",
  );

  const expectedLinkSignature = md5(
    `${login}:${formatOutSum(packAmount)}:${intent.invId}:${receiptJson}:` +
      `${password1}${buildShpSignaturePart(shp)}`,
  );

  check(
    "Подпись ссылки считается по сырому JSON чека",
    intentUrl.searchParams.get("SignatureValue") === expectedLinkSignature,
    expectedLinkSignature,
  );

  check(
    "В ссылке есть IsTest и Shp_*",
    ["IsTest", "Shp_course", "Shp_user"].every((key) =>
      intentUrl.searchParams.has(key),
    ),
    `IsTest=${intentUrl.searchParams.get("IsTest")}, ` +
      `Shp_course=${intentUrl.searchParams.get("Shp_course")}`,
  );

  let amountError = "";

  try {
    initializePayment({
      courseId: "confident",
      amount: 1,
      userEmail,
      userId,
    });
  } catch (error) {
    amountError = error instanceof Error ? error.message : String(error);
  }

  check(
    "Ссылка не принимает сумму ниже тарифа",
    amountError.includes("Сумма платежа"),
    amountError || "исключения не было",
  );

  section("3. Пакет Standard: 500 ₽ → +10 standard_tokens");

  const packInvId = nextInvId();
  const packAnswer = await webhook({
    invId: packInvId,
    courseId: pack.courseId,
    userId,
    outSum: formatOutSum(packAmount),
  });

  check(
    "Пакет: Robokassa получила OK{InvId}",
    isOk(packAnswer, packInvId),
    `${packAnswer.status}/${packAnswer.body}`,
  );

  const packPurchase = await readPurchase(packInvId);

  check(
    "Пакет: покупка записана в purchases",
    packPurchase?.user_id === userId &&
      packPurchase?.course_id === pack.courseId &&
      Number(packPurchase?.amount) === packAmount &&
      packPurchase?.expires_at === null,
    JSON.stringify(packPurchase),
  );

  const tokenPurchase = await readTokenPurchase(packInvId);

  check(
    `Пакет: token_purchases — ${pack.kind} × ${pack.quantity}`,
    tokenPurchase?.user_id === userId &&
      tokenPurchase?.kind === pack.kind &&
      tokenPurchase?.quantity === pack.quantity,
    JSON.stringify(tokenPurchase),
  );

  const creditsAfterPack = await readCredits(userId);

  check(
    `Пакет: user_credits.standard_tokens = ${pack.quantity}`,
    creditsAfterPack?.standard_tokens === pack.quantity &&
      (creditsAfterPack?.ultra_tokens ?? 0) === 0,
    JSON.stringify(creditsAfterPack),
  );

  const packRepeat = await webhook({
    invId: packInvId,
    courseId: pack.courseId,
    userId,
    outSum: formatOutSum(packAmount),
  });
  const creditsAfterRepeat = await readCredits(userId);

  check(
    "Пакет: повторный InvId принят, но товар не выдан второй раз",
    isOk(packRepeat, packInvId) &&
      (await countByInvId("purchases", packInvId)) === 1 &&
      (await countByInvId("token_purchases", packInvId)) === 1 &&
      creditsAfterRepeat?.standard_tokens === pack.quantity,
    `${packRepeat.status}/${packRepeat.body}, ` +
      `standard_tokens=${creditsAfterRepeat?.standard_tokens}`,
  );

  section("4. Подписка Pro: 1486 ₽ → +30 дней");

  const subAmount = getPaymentAmount("pro-subscription");
  const subInvId = nextInvId();
  const subStartedAt = Date.now();
  const subAnswer = await webhook({
    invId: subInvId,
    courseId: "pro-subscription",
    userId,
    outSum: formatOutSum(subAmount),
  });

  check(
    "Подписка: Robokassa получила OK{InvId}",
    isOk(subAnswer, subInvId),
    `${subAnswer.status}/${subAnswer.body}`,
  );

  const subPurchase = await readPurchase(subInvId);
  const firstExpiresAt = timeOf(subPurchase?.expires_at);
  const firstPeriodDays = (firstExpiresAt - subStartedAt) / DAY_MS;

  check(
    "Подписка: purchases.expires_at ≈ сейчас + 30 дней",
    subPurchase?.course_id === "pro-subscription" &&
      Number(subPurchase?.amount) === subAmount &&
      firstPeriodDays > SUBSCRIPTION_PERIOD_DAYS - 0.01 &&
      firstPeriodDays < SUBSCRIPTION_PERIOD_DAYS + 0.01,
    `${firstPeriodDays.toFixed(4)} дней, expires_at=${subPurchase?.expires_at}`,
  );

  const subRow = await readSubscription(userId);

  check(
    "Подписка: subscriptions active с тем же сроком",
    subRow?.status === "active" &&
      Math.abs(timeOf(subRow?.expires_at) - firstExpiresAt) < 1000,
    `status=${subRow?.status}, expires_at=${subRow?.expires_at}`,
  );

  const subscriptionActive = await hasActiveSubscription(admin, userId);

  check(
    "Подписка: hasActiveSubscription = true",
    subscriptionActive,
    `hasActiveSubscription=${subscriptionActive}`,
  );

  const subRepeat = await webhook({
    invId: subInvId,
    courseId: "pro-subscription",
    userId,
    outSum: formatOutSum(subAmount),
  });
  const subRowAfterRepeat = await readSubscription(userId);

  check(
    "Подписка: повторный InvId не добавляет вторые 30 дней",
    isOk(subRepeat, subInvId) &&
      (await countByInvId("purchases", subInvId)) === 1 &&
      timeOf(subRowAfterRepeat?.expires_at) === firstExpiresAt,
    `${subRepeat.status}/${subRepeat.body}, ` +
      `expires_at=${subRowAfterRepeat?.expires_at}`,
  );

  const secondSubInvId = nextInvId();
  const secondSubAnswer = await webhook({
    invId: secondSubInvId,
    courseId: "pro-subscription",
    userId,
    outSum: formatOutSum(subAmount),
  });
  const secondSubPurchase = await readPurchase(secondSubInvId);
  const secondExpiresAt = timeOf(secondSubPurchase?.expires_at);
  const addedDays = (secondExpiresAt - firstExpiresAt) / DAY_MS;

  check(
    "Подписка: второй InvId добавляет ровно 30 дней к текущему сроку",
    isOk(secondSubAnswer, secondSubInvId) &&
      Math.abs(addedDays - SUBSCRIPTION_PERIOD_DAYS) < 0.001,
    `${addedDays.toFixed(4)} дней, expires_at=${secondSubPurchase?.expires_at}`,
  );

  check(
    "Подписка: в subscriptions осталась одна строка",
    (await countSubscriptions(userId)) === 1,
    `строк=${await countSubscriptions(userId)}`,
  );

  section("5. Курс confident: 2990 ₽ → бессрочный доступ");

  const courseAmount = getPaymentAmount("confident");
  const courseInvId = nextInvId();
  const courseAnswer = await webhook({
    invId: courseInvId,
    courseId: "confident",
    userId,
    outSum: formatOutSum(courseAmount),
  });

  check(
    "Курс: Robokassa получила OK{InvId}",
    isOk(courseAnswer, courseInvId),
    `${courseAnswer.status}/${courseAnswer.body}`,
  );

  const coursePurchase = await readPurchase(courseInvId);

  check(
    "Курс: покупка записана навсегда (expires_at = null)",
    coursePurchase?.user_id === userId &&
      coursePurchase?.course_id === "confident" &&
      Number(coursePurchase?.amount) === courseAmount &&
      coursePurchase?.expires_at === null,
    JSON.stringify(coursePurchase),
  );

  const confidentAccess = await hasCourseAccess(admin, userId, "confident");
  const engineerAccess = await hasCourseAccess(admin, userId, "engineer");

  check(
    "Курс: confident открыт, engineer закрыт",
    confidentAccess && !engineerAccess,
    `confident=${confidentAccess}, engineer=${engineerAccess}`,
  );

  const courseRepeat = await webhook({
    invId: courseInvId,
    courseId: "confident",
    userId,
    outSum: formatOutSum(courseAmount),
  });

  check(
    "Курс: повторный InvId не создаёт вторую покупку",
    isOk(courseRepeat, courseInvId) &&
      (await countByInvId("purchases", courseInvId)) === 1,
    `${courseRepeat.status}/${courseRepeat.body}, ` +
      `покупок=${await countByInvId("purchases", courseInvId)}`,
  );

  section("6. Некорректные уведомления отклоняются");

  const badSignatureInvId = nextInvId();
  const badSignatureAnswer = await webhook({
    invId: badSignatureInvId,
    courseId: "confident",
    userId,
    outSum: formatOutSum(courseAmount),
    signature: "0".repeat(32),
  });

  check(
    "Неверная подпись → 400, покупки нет",
    badSignatureAnswer.status === 400 &&
      badSignatureAnswer.body === "invalid signature" &&
      (await countByInvId("purchases", badSignatureInvId)) === 0,
    `${badSignatureAnswer.status}/${badSignatureAnswer.body}`,
  );

  const lowAmountInvId = nextInvId();
  const lowAmountAnswer = await webhook({
    invId: lowAmountInvId,
    courseId: "confident",
    userId,
    outSum: "1.00",
  });

  check(
    "Сумма ниже тарифа → 400, покупки нет",
    lowAmountAnswer.status === 400 &&
      lowAmountAnswer.body === "amount does not match plan" &&
      (await countByInvId("purchases", lowAmountInvId)) === 0,
    `${lowAmountAnswer.status}/${lowAmountAnswer.body}`,
  );

  const unknownCourseInvId = nextInvId();
  const unknownCourseAnswer = await webhook({
    invId: unknownCourseInvId,
    courseId: "stolen-plan",
    userId,
    outSum: formatOutSum(courseAmount),
  });

  check(
    "Неизвестный товар → 400, покупки нет",
    unknownCourseAnswer.status === 400 &&
      unknownCourseAnswer.body === "invalid course" &&
      (await countByInvId("purchases", unknownCourseInvId)) === 0,
    `${unknownCourseAnswer.status}/${unknownCourseAnswer.body}`,
  );
} catch (error) {
  failures += 1;
  console.error(
    "\nОшибка выполнения:",
    error instanceof Error ? error.message : error,
  );
} finally {
  section("7. Очистка");
  await cleanup(userId);
}

console.log(
  failures === 0
    ? "\nИтог: все проверки пройдены."
    : `\nИтог: провалов ${failures}.`,
);
process.exit(failures === 0 ? 0 : 1);
