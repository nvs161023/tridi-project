import type { NextRequest } from "next/server";

import { isAdminEmail } from "@/lib/admin";
import { refundPurchase } from "@/lib/refund";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** service_role и cookies сессии доступны только в Node.js. */
export const runtime = "nodejs";

/** Покупки меняются после каждого возврата — без кэша. */
export const dynamic = "force-dynamic";

/** id записи в purchases: тот же формат, что проверяют действия форума. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** JSON-ответ админке: `error` показывается как есть. */
function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/**
 * Оформление возврата за курс.
 *
 * POST /api/admin/refund с телом `{ "purchaseId": "<uuid>" }`.
 *
 * Проверка доступа — по реальной сессии и `ADMIN_EMAIL`, как в `/admin/purchases`
 * и выгрузке CSV: возврат закрывает платный доступ, поэтому анонимный запрос
 * получает 403, а не «покупка не найдена».
 *
 * Коды ответа:
 *   200 — доступ закрыт (покупка получила `expires_at` = момент возврата);
 *   400 — некорректный запрос или неизвестный товар;
 *   403 — нет прав администратора **или** курс уже начат (текст оферты);
 *   404 — покупки нет; 409 — доступ уже закрыт; 500 — ошибка базы;
 *   503 — не задан ключ service_role.
 *
 * Решение принимает `lib/refund.ts`: здесь только проверка прав, разбор тела и
 * перевод результата в HTTP-код.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return json(
      { ok: false, error: "Недостаточно прав: нужен вход администратора." },
      403,
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "Некорректный запрос." }, 400);
  }

  const rawPurchaseId =
    typeof payload === "object" && payload !== null
      ? (payload as { purchaseId?: unknown }).purchaseId
      : undefined;
  const purchaseId = String(rawPurchaseId ?? "").trim();

  if (!UUID_PATTERN.test(purchaseId)) {
    return json({ ok: false, error: "Некорректная покупка." }, 400);
  }

  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch {
    return json(
      {
        ok: false,
        error:
          "Не заданы NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.",
      },
      503,
    );
  }

  const result = await refundPurchase(admin, purchaseId);

  if (!result.ok) {
    return json(
      {
        ok: false,
        error: result.error,
        ...(result.progress ? { progress: result.progress } : {}),
      },
      result.status,
    );
  }

  return json(
    {
      ok: true,
      courseId: result.courseId,
      refundedAt: result.refundedAt,
      purchase: result.purchase,
    },
    200,
  );
}
