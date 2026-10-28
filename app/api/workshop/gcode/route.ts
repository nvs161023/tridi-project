import { hasActiveSubscription } from "@/lib/subscription";
import { uploadGcodeToSupabase } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

/**
 * Загрузка G-code товара в публичный бакет `workshop-gcode`.
 *
 * Через отдельный роут, а не Server Action: G-code весит мегабайты, а у
 * Server Actions по умолчанию небольшой лимит тела. Клиент отправляет файл
 * сюда, получает публичный URL и уже его кладёт в скрытое поле формы товара.
 *
 * Порядок проверок:
 *   1. сессия — `/api/*` не покрыт middleware;
 *   2. `hasActiveSubscription()` — каталог входит в пакет «Всё включено»;
 *   3. файл из multipart-поля `file`: расширение и размер;
 *   4. загрузка service_role-клиентом.
 *
 * Ответ: `{ url }` — постоянная публичная ссылка для workshop_products.
 */
export const runtime = "nodejs";

/** Ответ зависит от cookies пользователя и содержимого файла. */
export const dynamic = "force-dynamic";

/** Лимит совпадает с настройками бакета. */
const MAX_GCODE_BYTES = 50 * 1024 * 1024;

/** Расширения слайсеров: .gcode, .gco и короткий .g. */
const GCODE_EXTENSIONS = [".gcode", ".gco", ".g"];

function errorResponse(status: number, error: string): Response {
  return Response.json(
    { error },
    {
      status,
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    },
  );
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse(401, "Войдите в аккаунт, чтобы загрузить G-code.");
  }

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return errorResponse(
      403,
      "Каталог входит в пакет «Всё включено». Оформите доступ, чтобы загрузить G-code.",
    );
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return errorResponse(400, "Не удалось прочитать файл. Отправьте его полем file.");
  }

  const file = form.get("file");

  if (!file || typeof file === "string") {
    return errorResponse(400, "Прикрепите файл G-code полем file.");
  }

  const name = file.name.toLowerCase();

  if (!GCODE_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return errorResponse(
      415,
      "Поддерживаются файлы .gcode, .gco и .g.",
    );
  }

  if (file.size === 0) {
    return errorResponse(400, "Файл пустой. Выберите другой G-code.");
  }

  if (file.size > MAX_GCODE_BYTES) {
    return errorResponse(413, "G-code больше 50 МБ. Уменьшите файл.");
  }

  try {
    const url = await uploadGcodeToSupabase(user.id, file);

    return Response.json(
      { url },
      {
        headers: {
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
      },
    );
  } catch (error) {
    console.error(
      "G-code не загружен:",
      error instanceof Error ? error.message : error,
    );

    return errorResponse(503, "Не удалось сохранить G-code. Попробуйте ещё раз.");
  }
}
