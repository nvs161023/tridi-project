import { isGenerationId } from "@/lib/generator/generations";
import {
  downloadGenerationStl,
  getGenerationForDownload,
} from "@/lib/generator/generation-store";
import { createClient } from "@/lib/supabase/server";

/**
 * Скачивание готовой модели по id — единственный путь к файлу из галереи.
 *
 * Бакет `generated-models` закрыт: прямой ссылки на STL нет, поэтому файл
 * отдаёт этот роут. Он проверяет сессию, а затем право: владелец получает свою
 * модель, остальные — только опубликованную (`is_public`). Владельца сравниваем
 * с `user_id` из строки БД; `stl_url` — только путь к файлу и дополнительно
 * должен лежать в папке этого пользователя. Ссылка на галерее видна вне
 * зависимости от бакета, но без входа вернёт 401.
 *
 * Ответы на «нет файла» и «нет прав» одинаковые (404): иначе по коду можно
 * было бы перебором узнать, какие модели существуют, но скрыты.
 */
export const runtime = "nodejs";

export const dynamic = "force-dynamic";

/** Короткий ответ об ошибке в JSON: клиент показывает текст пользователю. */
function errorResponse(
  status: number,
  message: string,
  extraHeaders: Record<string, string> = {},
): Response {
  return Response.json(
    { error: message },
    {
      status,
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        ...extraHeaders,
      },
    },
  );
}

const MODEL_NOT_FOUND = "Модель не найдена или недоступна.";
const LOGIN_REQUIRED = "Скачивание STL доступно только после входа.";

/**
 * GET /api/generations/[id]/stl — отдать файл владельцу или по публичной модели.
 *
 * `id` приходит из адреса, поэтому сначала проверяется как UUID: без этого
 * запрос с мусором уходил бы в PostgREST как ошибка типа. Файл читается
 * служебным клиентом только после проверки права в этом же обработчике.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;

  if (!isGenerationId(id)) {
    return errorResponse(404, MODEL_NOT_FOUND);
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse(401, LOGIN_REQUIRED);
  }

  const generation = await getGenerationForDownload(id);

  if (
    !generation ||
    (generation.userId !== user.id && !generation.isPublic)
  ) {
    return errorResponse(404, MODEL_NOT_FOUND);
  }

  const content = await downloadGenerationStl(generation.stlPath);

  if (!content) {
    return errorResponse(404, MODEL_NOT_FOUND);
  }

  // Имя из id безопасно для заголовка: там только hex и дефисы.
  return new Response(content, {
    status: 200,
    headers: {
      "content-type": "model/stl",
      "content-disposition": `attachment; filename="tridi-${id}.stl"`,
      "content-length": String(content.byteLength),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
