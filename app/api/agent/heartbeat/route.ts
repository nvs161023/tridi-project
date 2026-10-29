import { validateAgentToken } from "@/lib/agent-auth";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Пульс локального агента 3D-фермы.
 *
 *   POST /api/agent/heartbeat
 *   Authorization: Bearer <agent_token>
 *   { "resetErrors": true }   // необязательно, только при старте агента
 *
 * Агент отправляет пульс каждые 30 секунд, даже когда очередь пуста и печать не
 * идёт. Именно по `workshop_printers.last_seen_at` вкладка «Принтеры» отличает
 * «агент потерял принтер» (подпись «Офлайн») от «агент жив, принтер свободен»:
 * статус `idle` сам по себе молчание агента не выдаёт.
 *
 * Пульс отмечает все принтеры мастерской, найденной по токену, и ничего не
 * меняет, кроме `last_seen_at`. Повтор безопасен: значение перезаписывается
 * текущим временем, а не приращивается. Нет принтеров — ответ всё равно 200:
 * пульс живого агента без парка не ошибка.
 *
 * `resetErrors: true` — агент только что запустился и первым делом снимает
 * `error`, оставшийся после прошлого сбоя (упал агент, пропала сеть, закрыли
 * крышку). Ошибки печати уже нет, а без сброса мастер видел бы красную карточку
 * до первой печати. Прогресс сбрасывается вместе со статусом — так же, как
 * роут статусов закрывает задание через `done`.
 *
 * Тело запроса необязательно: пульс — это сам факт запроса, поэтому пустое или
 * не-JSON тело означает «без сброса», а не 400.
 */
export const runtime = "nodejs";

/** Пульс меняет состояние принтеров: кэшировать ответ нельзя. */
export const dynamic = "force-dynamic";

const MIGRATION_HINT =
  "Пульс недоступен: в базе нет нужных таблиц или колонок. Примените supabase/workshop_farm_and_shop.sql.";

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
function writeFailure(error: SupabaseErrorLike, fallback: string): Response {
  console.error("Агент: пульс не записан:", error.code, error.message);

  return isMissingTableSchema(error.code, error.message)
    ? json({ error: MIGRATION_HINT }, 503)
    : json({ error: fallback }, 500);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Флаг «агент запустился, сними прошлые ошибки».
 *
 * Принимаем и camelCase, и snake_case: тело собирает агент, а собранный вручную
 * запрос не должен молча терять сброс. Строго `true`: случайная строка
 * `"false"` не должна стирать настоящую ошибку печати.
 */
function readResetErrors(value: unknown): boolean {
  if (!isObject(value)) {
    return false;
  }

  return value.resetErrors === true || value.reset_errors === true;
}

/** Сколько принтеров попало в ответ update (null — PostgREST не вернул строки). */
function countRows(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export async function POST(request: Request): Promise<Response> {
  const identity = await validateAgentToken(request);

  if (!identity) {
    return unauthorized();
  }

  // Тело необязательно: агент может прислать `{}` или вообще ничего.
  const body: unknown = await request.json().catch(() => null);
  const resetErrors = readResetErrors(body);

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

  // 1. Все принтеры мастерской живы: время одно на запрос, чтобы карточки не
  // разошлись на доли секунды и выглядели как разные пульсы.
  const seenAt = new Date().toISOString();

  const seen = await supabase
    .from("workshop_printers")
    .update({ last_seen_at: seenAt })
    .eq("user_id", identity.userId)
    .select("id");

  if (seen.error) {
    return writeFailure(seen.error, "Пульс не записан.");
  }

  // 2. Только при старте: принтер, стоявший в ошибке, возвращается в работу.
  let reset = 0;

  if (resetErrors) {
    const resetResult = await supabase
      .from("workshop_printers")
      .update({ status: "idle", progress: 0 })
      .eq("user_id", identity.userId)
      .eq("status", "error")
      .select("id");

    if (resetResult.error) {
      return writeFailure(resetResult.error, "Состояние принтеров не сброшено.");
    }

    reset = countRows(resetResult.data);
  }

  return json({ success: true, printers: countRows(seen.data), reset });
}
