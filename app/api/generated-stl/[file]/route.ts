import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  GENERATED_STL_DIR,
  resolveGeneratedStl,
} from "@/lib/constructor/mesh-fixer";
import { canAccessGeneration } from "@/lib/generator/generation-access";
import { getGenerationAccessByTaskId } from "@/lib/generator/generation-store";
import { verifyGeneratedFileLink } from "@/lib/security/signed-links";
import { createClient } from "@/lib/supabase/server";

/**
 * Отдача готового STL из «мясорубки».
 *
 * Ссылку возвращает `/api/check-3d-status` после постобработки GLB:
 *
 *   GET /api/generated-stl/<40 hex-символов>.stl
 *       ?taskId=<номер>&expires=<unix>&signature=<hmac>
 *
 * Имя файла — SHA-256 от ссылки на исходный GLB. Роут принимает только этот
 * шаблон (`resolveGeneratedStl`), поэтому выйти из временной папки через `..`
 * или подставить чужой путь нельзя.
 *
 * Право проверяется дважды: HMAC-подпись подтверждает, что ссылку выдал наш
 * сервер, а строка `generations` — что вошедший пользователь владеет задачей
 * или модель опубликована. Гость получает 401, чужая приватная задача — 403,
 * просроченная подпись — 403. Без проверки любой, кто узнал имя файла, скачал
 * бы чужую модель.
 */
export const runtime = "nodejs";

/** Список файлов меняется от запроса к запросу, кэш тут не нужен. */
export const dynamic = "force-dynamic";

/** Короткий ответ об ошибке в JSON: клиент показывает текст пользователю. */
function errorResponse(status: number, message: string): Response {
  return Response.json(
    { error: message },
    {
      status,
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    },
  );
}

/** ASCII-вариант имени для старых клиентов, не понимающих filename*. */
function asciiFileName(name: string): string {
  return name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
}

/**
 * GET /api/generated-stl/[file] — скачивание готовой модели.
 *
 * В Next 15 параметры маршрута приходят промисом. Файл ищется только во
 * временной папке «мясорубки»: имя проверяется шаблоном, а путь дополнительно
 * сверяется с корнем папки — защита от ошибки в самом шаблоне.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ file: string }> },
): Promise<Response> {
  const { file } = await context.params;
  const filePath = resolveGeneratedStl(file);

  if (!filePath) {
    return errorResponse(404, "Такой модели нет.");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse(401, "Войдите в аккаунт, чтобы скачать модель.");
  }

  const params = new URL(request.url).searchParams;
  const taskId = params.get("taskId");

  if (!taskId) {
    return errorResponse(403, "Ссылка на модель повреждена.");
  }

  // Строка задачи нужна до проверки подписи: подпись выдана на владельца
  // задачи, а скачать опубликованную модель может любой вошедший пользователь.
  const generation = await getGenerationAccessByTaskId(taskId);

  if (!generation) {
    return errorResponse(404, "Такой модели нет.");
  }

  if (
    !verifyGeneratedFileLink({
      file,
      taskId,
      userId: generation.userId,
      expires: params.get("expires"),
      signature: params.get("signature"),
    })
  ) {
    return errorResponse(
      403,
      "Ссылка на модель устарела или повреждена. Сгенерируйте модель заново.",
    );
  }

  if (!canAccessGeneration(user.id, generation)) {
    return errorResponse(403, "Эта модель создана в другом аккаунте.");
  }

  const relativePath = path.relative(GENERATED_STL_DIR, filePath);

  if (
    relativePath === "" ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    return errorResponse(404, "Такой модели нет.");
  }

  let content: Buffer;

  try {
    content = await readFile(filePath);
  } catch {
    // Файл живёт во временной папке: после перезапуска контейнера его нет.
    // Для клиента это 404, а не 500 — модель нужно сгенерировать заново.
    console.error("[generated-stl] Файл не найден:", relativePath);

    return errorResponse(
      404,
      "Модель не найдена: возможно, сервер перезапускался. Сгенерируйте её заново.",
    );
  }

  const downloadName = `tridi-${path.basename(filePath, ".stl")}.stl`;

  return new Response(new Uint8Array(content), {
    status: 200,
    headers: {
      "content-type": "model/stl",
      "content-disposition": `attachment; filename="${asciiFileName(
        downloadName,
      )}"`,
      "content-length": String(content.byteLength),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
