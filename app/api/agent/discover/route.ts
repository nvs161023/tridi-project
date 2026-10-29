import { validateAgentToken } from "@/lib/agent-auth";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { readDiscoveredPrinters } from "@/lib/workshop/printers";

/**
 * Автообнаружение принтеров фермы.
 *
 *   POST /api/agent/discover
 *   Authorization: Bearer <agent_token>
 *   [{ "ip_address": "192.168.1.50", "protocol_type": "moonraker" }]
 *   [{ "ip_address": "192.168.1.60", "protocol_type": "bambu",
 *      "serial_number": "01S00C123456789" }]
 *
 * Агент обходит локальную сеть (mDNS/SSDP, порты Moonraker и OctoPrint) и
 * присылает найденные адреса. Сто принтеров, вбитых руками, — та самая причина,
 * по которой ферму не заводят: список приходит сам, мастер только даёт имена.
 * `serial_number` присылает Bambu из SSDP-ответа (заголовок `USN`): по нему
 * строятся MQTT-топики `device/<serial>/…`, поэтому номер сохраняется вместе с
 * находкой и переезжает в парк при подтверждении — мастеру не нужно вбивать его
 * вручную.
 *
 * `workshop_discovered_printers` — черновик, а не история: строки со статусом
 * `discovered` живут от сканирования до подтверждения. Поэтому порядок записи:
 *   1. старые `discovered` этой мастерской удаляются целиком — повторное
 *      сканирование не копит дубли и не показывает принтеры, которые уже
 *      выключили или перенесли вручную;
 *   2. вставляются новые находки; `name` не передаём — работает default
 *      «Неизвестный принтер», имя введёт мастер при подтверждении.
 *
 * Пустой массив — нормальный ответ «в сети ничего не нашлось»: старые находки
 * удаляются, ответ 200. Не массив — 400: молча чистить список из-за мусора в
 * теле запроса нельзя, иначе одна ошибка агента сотрёт работу сканирования.
 *
 * Отдельные строки внутри массива с мусором не отменяют всё сканирование: они
 * считаются в `skipped` (разбор — lib/workshop/printers.ts).
 *
 * Токен проверяет lib/agent-auth.ts и задаёт мастерскую: агент работает через
 * service_role, RLS его не ограничивает, поэтому `user_id` всегда берётся из
 * токена, а не из тела запроса.
 */
export const runtime = "nodejs";

/** Список меняется после каждого сканирования: кэшировать ответ нельзя. */
export const dynamic = "force-dynamic";

const MIGRATION_HINT =
  "Список найденных принтеров недоступен: в базе нет таблицы workshop_discovered_printers. Примените supabase/workshop_farm_and_shop.sql.";

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
  console.error("Агент: находки не записаны:", error.code, error.message);

  return isMissingTableSchema(error.code, error.message)
    ? json({ error: MIGRATION_HINT }, 503)
    : json({ error: fallback }, 500);
}

/** Сколько строк удалено (null — PostgREST не вернул строки). */
function countRows(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export async function POST(request: Request): Promise<Response> {
  const identity = await validateAgentToken(request);

  if (!identity) {
    return unauthorized();
  }

  // Тело может быть не JSON вовсе — это 400, а не исключение роута.
  const body: unknown = await request.json().catch(() => null);
  const parsed = readDiscoveredPrinters(body);

  if (!parsed) {
    return json(
      {
        error:
          "Тело запроса должно быть массивом найденных принтеров: [{ \"ip_address\": \"192.168.1.50\", \"protocol_type\": \"moonraker\" }].",
      },
      400,
    );
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

  // 1. Прошлые находки устарели: сеть могла измениться, а строка, оставшаяся
  // после выключенного принтера, показала бы мастеру несуществующее железо.
  const removed = await supabase
    .from("workshop_discovered_printers")
    .delete()
    .eq("user_id", identity.userId)
    .eq("status", "discovered")
    .select("id");

  if (removed.error) {
    return writeFailure(removed.error, "Старый список найденных не очищен.");
  }

  // 2. Новые находки. Пустой массив — просто ничего не вставляем.
  if (parsed.drafts.length > 0) {
    const inserted = await supabase
      .from("workshop_discovered_printers")
      .insert(
        parsed.drafts.map((printer) => ({
          user_id: identity.userId,
          ip_address: printer.ipAddress,
          protocol_type: printer.protocolType,
          // Bambu называет номер в SSDP-ответе; у Moonraker и OctoPrint его нет,
          // и колонка остаётся null.
          serial_number: printer.serialNumber,
          status: "discovered",
        })),
      );

    if (inserted.error) {
      return writeFailure(inserted.error, "Найденные принтеры не записаны.");
    }
  }

  return json({
    success: true,
    discovered: parsed.drafts.length,
    removed: countRows(removed.data),
    skipped: parsed.skipped,
  });
}
