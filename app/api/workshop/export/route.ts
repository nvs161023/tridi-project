import type { NextRequest } from "next/server";

import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import { hasActiveSubscription } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { buildProductsCsv, isExportPlatform } from "@/lib/workshop/export";
import {
  normalizeProductRow,
  PRODUCT_COLUMNS,
  type WorkshopProduct,
} from "@/lib/workshop/products";

/** Supabase-клиент и cookies доступны только в Node.js. */
export const runtime = "nodejs";

/** Ответ зависит от cookies и каталога пользователя, кэшировать его нельзя. */
export const dynamic = "force-dynamic";

/** PostgREST по умолчанию отдаёт не больше 1000 строк — читаем порциями. */
const PAGE_SIZE = 1000;

/** Ошибка в JSON: успешный ответ всегда CSV, ошибки остаются машинными. */
function errorResponse(status: number, error: string, message: string): Response {
  return Response.json(
    { error, message },
    {
      status,
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    },
  );
}

/** Поля ошибки PostgREST, по которым выбирается ответ пользователю. */
type ReadError = {
  code?: string | null;
  message?: string | null;
};

/**
 * Читает весь каталог пользователя.
 *
 * `range` нужен из-за лимита PostgREST: без него на большом каталоге в файл
 * попали бы только первые 1000 товаров. Сортировка по `created_at` и `id`
 * стабильна, поэтому страницы не пересекаются.
 */
async function readProducts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<{ products: WorkshopProduct[]; error: ReadError | null }> {
  const products: WorkshopProduct[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("workshop_products")
      .select(PRODUCT_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      return { products, error };
    }

    const rows = (data ?? []) as Partial<Record<string, unknown>>[];

    for (const row of rows) {
      const product = normalizeProductRow(row);

      if (product) {
        products.push(product);
      }
    }

    if (rows.length < PAGE_SIZE) {
      return { products, error: null };
    }
  }
}

/**
 * Выгрузка каталога Мастерской в CSV для маркетплейса.
 *
 * Порядок проверок:
 *   1. `platform` — только ozon, wb, yandex, avito или megamarket;
 *   2. сессия — `getUser()`, потому что `/api/*` не покрыт middleware;
 *   3. `hasActiveSubscription()` — Мастерская входит в пакет «Всё включено»;
 *   4. каталог читается с фильтром по `user_id` и порциями.
 *
 * Гость и пользователь без пакета получают 403: выгрузка не должна открывать
 * каталог в обход страницы. Неизвестная площадка — 400. Пустой каталог — 200 с
 * CSV из одних заголовков.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const platform = request.nextUrl.searchParams.get("platform");

  if (!isExportPlatform(platform)) {
    return errorResponse(
      400,
      "invalid_platform",
      "Выберите площадку: ozon, wb, yandex, avito или megamarket.",
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse(
      403,
      "unauthorized",
      "Войдите в аккаунт, чтобы выгрузить товары.",
    );
  }

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return errorResponse(
      403,
      "pro_required",
      "Выгрузка каталога входит в пакет «Всё включено».",
    );
  }

  const result = await readProducts(supabase, user.id);

  if (result.error) {
    const { error } = result;

    console.warn("Каталог для экспорта не прочитан:", error.code, error.message);

    if (isMissingTableSchema(error.code, error.message)) {
      return errorResponse(
        503,
        "migration_missing",
        "Каталог пока недоступен: в базе нет таблицы workshop_products. Примените миграцию supabase/workshop_products.sql.",
      );
    }

    return errorResponse(
      500,
      "read_failed",
      "Не удалось прочитать каталог. Попробуйте ещё раз.",
    );
  }

  const csv = buildProductsCsv(result.products, platform);

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="tridi_export_${platform}.csv"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
