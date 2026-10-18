import type { NextRequest } from "next/server";

import {
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

  const expiresAt =
    courseId === "pro-subscription"
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null;

  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch (error) {
    console.error(
      "[Robokassa] Ошибка конфигурации: не удалось создать service_role:",
      error,
    );
    return text("payment configuration error", 500);
  }

  let insertError: { code?: string; message: string } | null = null;

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
