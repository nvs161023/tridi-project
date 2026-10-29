import { validateAgentToken } from "@/lib/agent-auth";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Агент закончил сканирование по просьбе мастера: сбрасывает флаг.
 *
 *   POST /api/agent/scan-complete
 *   Authorization: Bearer <agent_token>
 *   → { "success": true, "reset": true }
 *
 * Флаг снимается отдельным запросом, а не вместе с находками, и агент делает
 * этот запрос только после того, как `POST /api/agent/discover` принял список.
 * Тогда неудачная отправка (пропала сеть, сервер ответил 503) не теряет просьбу
 * мастера: флаг остаётся поднятым, и агент повторит обход — с паузой
 * `SCAN_RETRY_DELAY`, чтобы подсеть не сканировалась на каждом опросе.
 *
 * Повторный вызов безопасен: флаг пишется значением `false`, а не
 * переключается, поэтому два «готово» подряд ничего не ломают.
 *
 * Тело запроса не читается: факт запроса — уже подтверждение. Ответ `reset:
 * false` значит, что флаг было не на чем сбрасывать (строки настроек нет).
 */
export const runtime = "nodejs";

/** Роут меняет состояние мастерской: кэшировать ответ нельзя. */
export const dynamic = "force-dynamic";

const MIGRATION_HINT =
  "Флаг сканирования недоступен: в базе нет колонки workshop_settings.scan_requested. Примените supabase/workshop_farm_and_shop.sql.";

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/** Одинаковый ответ на «нет токена», «мусор» и «токен не найден». */
function unauthorized(): Response {
  return json({ error: "Токен агента не принят." }, 401);
}

/** Ошибки записи: отсутствие миграции отличаем от поломки базы. */
function writeFailure(error: SupabaseErrorLike): Response {
  console.error(
    "Агент: флаг сканирования не сброшен:",
    error.code,
    error.message,
  );

  return isMissingTableSchema(error.code, error.message)
    ? json({ error: MIGRATION_HINT }, 503)
    : json({ error: "Флаг сканирования не сброшен." }, 500);
}

/** Сколько строк обновлено (null — PostgREST не вернул строки). */
function countRows(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export async function POST(request: Request): Promise<Response> {
  const identity = await validateAgentToken(request);

  if (!identity) {
    return unauthorized();
  }

  let supabase: ReturnType<typeof createAdminClient>;

  try {
    supabase = createAdminClient();
  } catch (error) {
    console.error(
      "Агент: клиент service_role не создан:",
      error instanceof Error ? error.message : error,
    );

    return json({ error: "Сервер не настроен для агента фермы." }, 500);
  }

  const result = await supabase
    .from("workshop_settings")
    .update({ scan_requested: false })
    .eq("user_id", identity.userId)
    .select("user_id");

  if (result.error) {
    return writeFailure(result.error);
  }

  return json({ success: true, reset: countRows(result.data) > 0 });
}
