import type { NextRequest } from "next/server";

import {
  SUBSCRIPTION_PERIOD_DAYS,
  extractShpParams,
  getPaymentAmount,
  getRobokassaPassword2,
  isPaymentCourseId,
  verifyResultSignature,
} from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";

/** MD5 и service_role доступны только в Node.js, не в Edge. */
export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Длина оплаченного периода подписки Pro — та же, что в ссылке на оплату. */
const SUBSCRIPTION_PERIOD_MS = SUBSCRIPTION_PERIOD_DAYS * 24 * 60 * 60 * 1000;

type AdminClient = ReturnType<typeof createAdminClient>;

/** Ошибка Supabase/PostgREST: код нужен, чтобы отличить старую схему базы. */
type DatabaseError = { code?: string; message: string };

/** Из subscriptions читаем срок оплаты и запасной trial_ends_at. */
type SubscriptionRow = {
  id: string;
  status: string | null;
  expires_at: string | null;
  trial_ends_at: string | null;
};

/** Покупка, по которой пришло повторное уведомление. */
type PurchaseRow = {
  user_id: string;
  course_id: string;
  expires_at: string | null;
};

/** Robokassa ждёт обычный текст `OK{InvId}` или ошибку. */
function text(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/**
 * Все параметры уведомления одной строкой для логов.
 *
 * Robokassa присылает `OutSum`, `InvId`, `SignatureValue` и `Shp_*`; пароли
 * магазина в запросе не приходят, поэтому логировать параметры безопасно.
 */
function logIncoming(method: string, params: URLSearchParams): void {
  console.log(
    "[Robokassa] Входящий запрос:",
    method,
    Object.fromEntries(params.entries()),
  );
}

/** Время даты в миллисекундах; null и мусор — «даты нет». */
function timeOf(value: string | null): number {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const time = new Date(value).getTime();

  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

/** Самая поздняя дата из списка; null — дат не было. */
function latestDate(values: (string | null)[]): string | null {
  let latest: string | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const value of values) {
    const time = timeOf(value);

    if (time > latestTime) {
      latest = value;
      latestTime = time;
    }
  }

  return latest;
}

/**
 * Ошибка «в базе ещё нет колонки или таблицы».
 *
 * Колонку `subscriptions.expires_at` добавляет вручную
 * `supabase/subscriptions_recurring.sql`. Пока её не применили, покупка всё
 * равно записывается в `purchases`, и доступ открывается по ней. Поэтому такую
 * ошибку не считаем потерей платежа и не просим Robokassa присылать уведомление
 * снова.
 */
function isMissingSchemaError(error: DatabaseError): boolean {
  return (
    error.code === "42703" || // undefined_column
    error.code === "42P01" || // undefined_table
    error.code === "PGRST204" // колонки нет в схеме PostgREST
  );
}

/** Подписки пользователя вместе с ошибкой: нужна и для чтения, и для записи. */
async function readSubscriptions(
  admin: AdminClient,
  userId: string,
): Promise<{ rows: SubscriptionRow[]; error: DatabaseError | null }> {
  const { data, error } = await admin
    .from("subscriptions")
    .select("id, status, expires_at, trial_ends_at")
    .eq("user_id", userId);

  if (error) {
    return { rows: [], error };
  }

  return { rows: (data as SubscriptionRow[] | null) ?? [], error: null };
}

/**
 * До какой даты подписка уже оплачена.
 *
 * Берём максимум из трёх источников: `purchases.expires_at` прошлых платежей,
 * `subscriptions.expires_at` и запасного `trial_ends_at`. Покупки важны при
 * первом продлении после обновления: в старой схеме срок лежал только там, и
 * оставшиеся дни не должны сгореть.
 */
async function readPaidUntil(
  admin: AdminClient,
  userId: string,
): Promise<Date> {
  const [purchases, subscriptions] = await Promise.all([
    admin
      .from("purchases")
      .select("expires_at")
      .eq("user_id", userId)
      .eq("course_id", "pro-subscription"),
    readSubscriptions(admin, userId),
  ]);

  if (purchases.error) {
    console.warn(
      "[Robokassa] Не удалось прочитать срок покупок:",
      purchases.error.message,
    );
  }

  if (subscriptions.error) {
    console.warn(
      "[Robokassa] Не удалось прочитать срок подписки:",
      subscriptions.error.message,
    );
  }

  const dates = [
    ...(((purchases.data as { expires_at: string | null }[] | null) ?? []).map(
      (row) => row.expires_at,
    )),
    ...subscriptions.rows.flatMap((row) => [
      row.expires_at,
      row.trial_ends_at,
    ]),
  ];

  const stored = latestDate(dates);

  return new Date(Math.max(Date.now(), timeOf(stored)));
}

/**
 * Продлевает подписку Pro до оплаченной даты.
 *
 * Обновляем строку с самым поздним сроком: так у пользователя с несколькими
 * записями продление попадает в действующую. Если эта строка уже оплачена до
 * нужной даты (повторное уведомление по тому же заказу), ничего не меняем —
 * вторые 30 дней не добавляются.
 */
async function extendSubscription(
  admin: AdminClient,
  userId: string,
  paidUntil: string,
): Promise<{ error: DatabaseError | null }> {
  const { rows, error } = await readSubscriptions(admin, userId);

  if (error) {
    return { error };
  }

  const target = rows.reduce<SubscriptionRow | null>((best, row) => {
    if (!best) {
      return row;
    }

    return timeOf(row.expires_at) > timeOf(best.expires_at) ? row : best;
  }, null);

  if (!target) {
    const { error: insertError } = await admin.from("subscriptions").insert({
      user_id: userId,
      status: "active",
      expires_at: paidUntil,
      updated_at: new Date().toISOString(),
    });

    return { error: insertError };
  }

  if (timeOf(target.expires_at) >= timeOf(paidUntil)) {
    return { error: null };
  }

  const { error: updateError } = await admin
    .from("subscriptions")
    .update({
      status: "active",
      expires_at: paidUntil,
      updated_at: new Date().toISOString(),
    })
    .eq("id", target.id);

  return { error: updateError };
}

/**
 * Повторное уведомление по уже записанному заказу.
 *
 * Срок этого платежа сохранён в `purchases.expires_at`, поэтому подписку можно
 * довести до него без повторного расчёта «сейчас + 30 дней». Так ретрай
 * Robokassa после сбоя записи подписки безопасен.
 */
async function syncSubscriptionFromPurchase(
  admin: AdminClient,
  invId: number,
): Promise<DatabaseError | null> {
  const { data, error } = await admin
    .from("purchases")
    .select("user_id, course_id, expires_at")
    .eq("inv_id", invId)
    .maybeSingle();

  if (error) {
    return error;
  }

  const purchase = data as PurchaseRow | null;

  if (
    !purchase ||
    purchase.course_id !== "pro-subscription" ||
    !purchase.expires_at
  ) {
    return null;
  }

  const { error: extendError } = await extendSubscription(
    admin,
    purchase.user_id,
    purchase.expires_at,
  );

  return extendError;
}

/**
 * Разбирает уведомление Robokassa и записывает покупку.
 *
 * Ответ `OK{InvId}` — единственный признак успешной обработки для Robokassa.
 * При ошибке базы возвращаем 500, чтобы платёж не потерялся и уведомление
 * пришло повторно.
 */
async function handleResult(
  method: string,
  params: URLSearchParams,
): Promise<Response> {
  logIncoming(method, params);

  const outSum = params.get("OutSum")?.trim() ?? "";
  const invIdRaw = params.get("InvId")?.trim() ?? "";
  const signatureValue = params.get("SignatureValue")?.trim() ?? "";

  if (!outSum || !invIdRaw || !signatureValue) {
    return text("missing required parameters", 400);
  }

  if (!/^\d+$/.test(invIdRaw)) {
    return text("invalid InvId", 400);
  }

  const invId = Number(invIdRaw);

  if (!Number.isSafeInteger(invId) || invId <= 0) {
    return text("invalid InvId", 400);
  }

  const shp = extractShpParams(params.entries());
  let password2: string;

  try {
    password2 = getRobokassaPassword2();
  } catch (error) {
    console.error(
      "[Robokassa] Ошибка конфигурации: не задан ROBOKASSA_PASSWORD2:",
      error instanceof Error ? error.message : "неизвестная ошибка",
    );
    return text("payment configuration error", 500);
  }

  // Подпись включает Shp_*-параметры и сортирует их по имени — см.
  // buildShpSignaturePart в lib/payments.ts.
  const signatureIsValid = verifyResultSignature(
    outSum,
    invIdRaw,
    signatureValue,
    shp,
    password2,
  );

  console.log("[Robokassa] Подпись верна:", signatureIsValid);

  if (!signatureIsValid) {
    return text("invalid signature", 400);
  }

  const courseId = shp.course;
  const userId = shp.user;

  if (!courseId || !isPaymentCourseId(courseId)) {
    return text("invalid course", 400);
  }

  if (!userId || !UUID_PATTERN.test(userId)) {
    return text("invalid user", 400);
  }

  if (!/^\d+(\.\d+)?$/.test(outSum)) {
    return text("invalid amount", 400);
  }

  const expectedAmount = getPaymentAmount(courseId);
  const paidAmount = Number(outSum);

  // Сумма в подписи защищена паролем №2, но сверяем её ещё и с тарифом:
  // так ошибка в настройках или старая цена не выдаст доступ за 1 ₽.
  if (Math.round(paidAmount * 100) !== expectedAmount * 100) {
    return text("amount does not match plan", 400);
  }

  let admin: AdminClient;

  try {
    admin = createAdminClient();
  } catch (error) {
    console.error(
      "[Robokassa] Ошибка конфигурации: не удалось создать service_role:",
      error,
    );
    return text("payment configuration error", 500);
  }

  const isSubscription = courseId === "pro-subscription";

  // Подписка продлевается от текущего срока, а не от «сейчас»: если человек
  // платит заранее, оставшиеся дни не сгорают. Автопродление приходит таким же
  // уведомлением с новым InvId, поэтому считается по той же формуле.
  const expiresAt = isSubscription
    ? new Date(
        (await readPaidUntil(admin, userId)).getTime() + SUBSCRIPTION_PERIOD_MS,
      ).toISOString()
    : null;

  let insertError: DatabaseError | null = null;

  try {
    const { error } = await admin.from("purchases").insert({
      inv_id: invId,
      user_id: userId,
      course_id: courseId,
      amount: expectedAmount,
      expires_at: expiresAt,
    });

    insertError = error;
  } catch (error) {
    console.error("[Robokassa] Ошибка БД:", error);
    return text("database error", 500);
  }

  if (insertError) {
    // Robokassa может прислать одно и то же уведомление несколько раз.
    // Уникальный inv_id делает обработку идемпотентной.
    if (insertError.code === "23505") {
      console.log(
        "[Robokassa] Повторное уведомление, покупка уже записана:",
        invId,
      );

      // Подписку доводим до уже сохранённого срока: если запись подписки
      // сорвалась в прошлый раз, ретрай её починит, но вторые 30 дней не
      // добавит.
      if (isSubscription) {
        const syncError = await syncSubscriptionFromPurchase(admin, invId);

        if (syncError && !isMissingSchemaError(syncError)) {
          console.error("[Robokassa] Ошибка продления подписки:", syncError);

          return text("database error", 500);
        }
      }

      return text(`OK${invId}`);
    }

    console.error("[Robokassa] Ошибка БД:", insertError);

    return text("database error", 500);
  }

  console.log("[Robokassa] Покупка записана:", {
    invId,
    userId,
    courseId,
    amount: expectedAmount,
    expiresAt,
  });

  if (isSubscription && expiresAt) {
    const { error: extensionError } = await extendSubscription(
      admin,
      userId,
      expiresAt,
    );

    if (!extensionError) {
      console.log("[Robokassa] Подписка продлена до:", expiresAt);
    } else if (isMissingSchemaError(extensionError)) {
      // Колонки ещё нет в базе: покупка записана, доступ откроется по
      // purchases. Повтор уведомления ничего не изменит, поэтому отвечаем OK.
      console.warn(
        "[Robokassa] subscriptions.expires_at недоступен, подписка не записана:",
        extensionError.message,
      );
    } else {
      console.error("[Robokassa] Ошибка продления подписки:", extensionError);

      return text("database error", 500);
    }
  }

  return text(`OK${invId}`);
}

/** ResultURL может быть настроен на GET — поддерживаем оба метода. */
export async function GET(request: NextRequest): Promise<Response> {
  return handleResult("GET", new URL(request.url).searchParams);
}

export async function POST(request: NextRequest): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";

  if (
    !contentType.includes("application/x-www-form-urlencoded") &&
    !contentType.includes("multipart/form-data")
  ) {
    console.error(
      "[Robokassa] Неподдерживаемый Content-Type:",
      contentType || "(пусто)",
    );
    return text("unsupported content type", 415);
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch (error) {
    console.error("[Robokassa] Не удалось разобрать тело запроса:", error);
    return text("invalid request body", 400);
  }

  const params = new URLSearchParams();

  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      params.append(key, value);
    }
  }

  return handleResult("POST", params);
}
