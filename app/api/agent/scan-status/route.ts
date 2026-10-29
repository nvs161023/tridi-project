import { validateAgentToken } from "@/lib/agent-auth";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Просьба мастера «просканировать сеть» для локального агента.
 *
 *   GET /api/agent/scan-status
 *   Authorization: Bearer <agent_token>
 *   → { "scan_requested": true }
 *
 * Браузер не видит локальную сеть мастерской — её видит только агент, который
 * стоит рядом с принтерами. Поэтому кнопка «Найти принтеры в сети» не сканирует
 * сама: Server Action requestNetworkScan() ставит
 * `workshop_settings.scan_requested = true`, а агент спрашивает флаг в цикле
 * опроса (раз в `POLL_INTERVAL` секунд, agent/main.py) и запускает
 * `scan_network()`.
 *
 * Ответ намеренно без подробностей: `false` — и когда мастер ничего не просил, и
 * когда строки настроек ещё нет. Агент не должен различать эти состояния:
 * сканирование запускается только по явному `true`, иначе сеть обходилась бы
 * «на всякий случай».
 *
 * Если колонки scan_requested в базе нет (миграция не применена), роут отвечает
 * 503 с подсказкой, а не `false`: иначе кнопка в интерфейсе молча ничего не
 * делала бы, и причину искали бы в агенте. Агент пишет такую ошибку в журнал
 * один раз, а не каждые пять секунд (см. agent/main.py).
 *
 * Токен проверяет lib/agent-auth.ts и задаёт мастерскую: агент работает через
 * service_role, RLS его не ограничивает, поэтому `user_id` берётся из токена.
 */
export const runtime = "nodejs";

/** Флаг меняется по кнопке из интерфейса: кэшировать ответ нельзя. */
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

/** Ошибки чтения: отсутствие миграции отличаем от поломки базы. */
function readFailure(error: SupabaseErrorLike): Response {
  console.error(
    "Агент: флаг сканирования не прочитан:",
    error.code,
    error.message,
  );

  return isMissingTableSchema(error.code, error.message)
    ? json({ error: MIGRATION_HINT }, 503)
    : json({ error: "Флаг сканирования не прочитан." }, 500);
}

export async function GET(request: Request): Promise<Response> {
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
    .select("scan_requested")
    .eq("user_id", identity.userId)
    .maybeSingle();

  if (result.error) {
    return readFailure(result.error);
  }

  // Строки настроек может не быть (её создаёт первое сохранение калькулятора):
  // это «сканировать не просили», а не ошибка.
  const row = result.data as { scan_requested?: unknown } | null;

  return json({ scan_requested: row?.scan_requested === true });
}
