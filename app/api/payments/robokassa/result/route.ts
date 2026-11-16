import type { NextRequest } from "next/server";

import { getTokenPack, type TokenPack } from "@/lib/generation-plans";
import {
  SUBSCRIPTION_PERIOD_DAYS,
  extractShpParams,
  getPaymentAmount,
  getRobokassaPassword2,
  isAcceptedPaymentCourseId,
  verifyResultSignature,
} from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";

/** MD5 и service_role доступны только в Node.js, не в Edge. */
export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AdminClient = ReturnType<typeof createAdminClient>;

/** Ошибка Supabase/PostgREST: код важен для обработки конфликтов и RPC. */
type DatabaseError = { code?: string; message: string };

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

/**
 * Записывает покупку пакета токенов и начисляет их.
 *
 * Покупка попадает в общую историю `purchases` (`expires_at = null` — токены
 * не сгорают), а начисление выполняет SQL-функция `credit_token_purchase`.
 * Она идемпотентна по `inv_id`: повторное уведомление Robokassa не начислит
 * пакет дважды, но если начисление в прошлый раз сорвалось — доведёт его.
 *
 * Ошибку начисления возвращаем как 500, чтобы Robokassa повторила запрос:
 * покупка уже записана, а повтор безопасен.
 */
async function creditTokenPack(
  admin: AdminClient,
  args: {
    invId: number;
    userId: string;
    courseId: string;
    amount: number;
    pack: TokenPack;
  },
): Promise<Response> {
  const { error: insertError } = await admin.from("purchases").insert({
    inv_id: args.invId,
    user_id: args.userId,
    course_id: args.courseId,
    amount: args.amount,
    expires_at: null,
  });

  if (insertError && insertError.code !== "23505") {
    console.error("[Robokassa] Ошибка записи пакета токенов:", insertError);

    return text("database error", 500);
  }

  if (insertError?.code === "23505") {
    console.log(
      "[Robokassa] Повторное уведомление о пакете токенов:",
      args.invId,
    );
  }

  const { error: creditError } = await admin.rpc("credit_token_purchase", {
    p_inv_id: args.invId,
    p_user_id: args.userId,
    p_kind: args.pack.kind,
    p_quantity: args.pack.quantity,
  });

  if (creditError) {
    console.error("[Robokassa] Не удалось начислить токены:", creditError);

    return text("database error", 500);
  }

  console.log("[Robokassa] Пакет токенов начислен:", {
    invId: args.invId,
    userId: args.userId,
    kind: args.pack.kind,
    quantity: args.pack.quantity,
  });

  return text(`OK${args.invId}`);
}

/**
 * Атомарно записывает покупку подписки и продлевает срок.
 *
 * Вся арифметика и блокировка живут в SQL-функции
 * `apply_pro_subscription_purchase` (`supabase/subscriptions_recurring.sql`).
 * Два одновременных вебхука с разными InvId выполняются по очереди: второй
 * видит срок, записанный первым, и добавляет свои 30 дней. Повторный InvId
 * возвращает уже сохранённый срок без второго периода.
 *
 * Ошибку возвращаем как 500: транзакция откатилась целиком, поэтому Robokassa
 * может безопасно повторить уведомление.
 */
async function applyProSubscriptionPurchase(
  admin: AdminClient,
  args: {
    invId: number;
    userId: string;
    courseId: string;
    amount: number;
  },
): Promise<{ expiresAt: string | null; error: DatabaseError | null }> {
  try {
    const { data, error } = await admin.rpc(
      "apply_pro_subscription_purchase",
      {
        p_inv_id: args.invId,
        p_user_id: args.userId,
        p_course_id: args.courseId,
        p_amount: args.amount,
        p_period_days: SUBSCRIPTION_PERIOD_DAYS,
      },
    );

    if (error) {
      return { expiresAt: null, error };
    }

    if (typeof data !== "string") {
      return {
        expiresAt: null,
        error: { message: "RPC не вернул срок подписки" },
      };
    }

    return { expiresAt: data, error: null };
  } catch (error) {
    return {
      expiresAt: null,
      error: {
        message:
          error instanceof Error ? error.message : "неизвестная ошибка RPC",
      },
    };
  }
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

  // `pro` здесь ещё принимается: это исторический товар. Новую ссылку на него
  // создать нельзя (isPaymentCourseId в lib/payments.ts), а подписанное
  // уведомление по оплате, начатой до остановки продаж, должно закрыться.
  if (!courseId || !isAcceptedPaymentCourseId(courseId)) {
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

  const tokenPack = getTokenPack(courseId);

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

  // Пакет токенов обслуживается отдельно: подписку он не продлевает, а
  // `purchases` нужен для истории и защиты от повторной выдачи по тому же InvId.
  if (tokenPack) {
    return creditTokenPack(admin, {
      invId,
      userId,
      courseId,
      amount: expectedAmount,
      pack: tokenPack,
    });
  }

  // Подписка: покупка и новый срок пишутся одной транзакцией. Два параллельных
  // уведомления с разными InvId не могут прочитать один и тот же срок, поэтому
  // каждый оплаченный месяц добавляет ровно 30 дней.
  if (courseId === "pro-subscription") {
    const { expiresAt, error } = await applyProSubscriptionPurchase(admin, {
      invId,
      userId,
      courseId,
      amount: expectedAmount,
    });

    if (error) {
      console.error("[Robokassa] Ошибка продления подписки:", error);

      return text("database error", 500);
    }

    console.log("[Robokassa] Подписка продлена до:", expiresAt);

    return text(`OK${invId}`);
  }

  let insertError: DatabaseError | null = null;

  try {
    const { error } = await admin.from("purchases").insert({
      inv_id: invId,
      user_id: userId,
      course_id: courseId,
      amount: expectedAmount,
      expires_at: null,
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
  });

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
