import type { NextRequest } from "next/server";

import { isAdminEmail } from "@/lib/admin";
import {
  PROMO_COURSE_LABELS,
  buildOzonCsv,
  isPromoCourseId,
} from "@/lib/promo-codes";
import { resolveSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** service_role и cookies сессии доступны только в Node.js. */
export const runtime = "nodejs";

/** Файл всегда собирается заново: коды меняются после каждой активации. */
export const dynamic = "force-dynamic";

/** Понятная ошибка вместо страницы Next.js: запрос идёт из админки. */
function errorResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/** Строка promo_codes, которая попадает в CSV. */
type PromoRow = {
  code: string;
};

/**
 * Выгрузка CSV для Ozon.
 *
 * Проверка доступа — по реальной сессии и ADMIN_EMAIL, как в /admin/promo:
 * свободные коды нельзя отдавать никому, кроме администратора. Даже при утечке
 * ссылки чужой человек получит 403, а не список кодов.
 *
 * В файл попадают только `used_at is null` строки выбранного курса: активированные
 * коды Ozon продавать повторно нельзя. Истёкшие по сроку коды остаются в файле —
 * они ещё не использованы, но админка помечает их отдельно; если такие не нужны
 * в выгрузке, их можно отфильтровать по expires_at.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return errorResponse("Недостаточно прав: нужен вход администратора.", 403);
  }

  const courseId = new URL(request.url).searchParams.get("course") ?? "";

  if (!isPromoCourseId(courseId)) {
    return errorResponse("Выберите курс: confident, engineer или profit.", 400);
  }

  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch {
    return errorResponse(
      "Не заданы NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.",
      503,
    );
  }

  const { data, error } = await admin
    .from("promo_codes")
    .select("code")
    .eq("course_id", courseId)
    .is("used_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      return errorResponse(
        "Таблица promo_codes не создана. Примените supabase/promo_codes.sql.",
        503,
      );
    }

    console.warn("Не удалось выгрузить промокоды:", error.message);

    return errorResponse("Не удалось прочитать коды. Попробуйте ещё раз.", 500);
  }

  const codes = ((data as PromoRow[] | null) ?? []).map((row) => row.code);

  if (codes.length === 0) {
    return errorResponse(
      `Для курса «${PROMO_COURSE_LABELS[courseId]}» нет свободных кодов.`,
      409,
    );
  }

  const siteUrl = await resolveSiteUrl();
  const csv = buildOzonCsv(codes, siteUrl);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `tridi-ozon-${courseId}-${date}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
