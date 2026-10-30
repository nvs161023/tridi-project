import { extractPrinterModelFrom3mf } from "@/lib/3d/parse-3mf";
import { hasActiveSubscription } from "@/lib/subscription";
import { uploadGcodeToSupabase } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

/**
 * Загрузка файла печати товара в публичный бакет `workshop-gcode`.
 *
 * Через отдельный роут, а не Server Action: G-code и 3MF весят мегабайты, а у
 * Server Actions по умолчанию небольшой лимит тела. Клиент отправляет файл
 * сюда, получает публичный URL и уже его кладёт в скрытое поле формы товара.
 *
 * Кроме ссылки роут возвращает модель принтера из метаданных 3MF
 * (`printerModel`). Разбор идёт здесь, пока архив уже прочитан в память; в
 * Server Action повторно скачивать файл нельзя — адрес вводит пользователь, и
 * серверный fetch по чужой ссылке стал бы дырой. У STL и G-code разметки нет:
 * для них `printerModel` — null.
 *
 * Порядок проверок:
 *   1. сессия — `/api/*` не покрыт middleware;
 *   2. `hasActiveSubscription()` — каталог входит в пакет «Всё включено»;
 *   3. файл из multipart-поля `file`: расширение и размер;
 *   4. модель принтера из 3MF (только для `.3mf`);
 *   5. загрузка service_role-клиентом.
 *
 * Ответ: `{ url, printerModel }` — постоянная публичная ссылка и подсказка о
 * принтере для workshop_products.
 */
export const runtime = "nodejs";

/** Ответ зависит от cookies пользователя и содержимого файла. */
export const dynamic = "force-dynamic";

/** Лимит совпадает с настройками бакета. */
const MAX_PRINT_FILE_BYTES = 50 * 1024 * 1024;

/** Расширения слайсеров и моделей: G-code, 3MF-контейнер и STL. */
const PRINT_FILE_EXTENSIONS = [".gcode", ".gco", ".g", ".3mf", ".stl"];

/** Контейнер 3MF: только у него в архиве есть модель принтера. */
const THREE_MF_EXTENSION = ".3mf";

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

  if (!PRINT_FILE_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return errorResponse(
      415,
      "Поддерживаются файлы .gcode, .gco, .g, .3mf и .stl.",
    );
  }

  if (file.size === 0) {
    return errorResponse(400, "Файл пустой. Выберите другой файл печати.");
  }

  if (file.size > MAX_PRINT_FILE_BYTES) {
    return errorResponse(413, "Файл больше 50 МБ. Уменьшите его.");
  }

  // 3MF читается целиком: модель принтера лежит в ZIP-оглавлении архива.
  // Битый архив не повод молча приложить файл без разметки — мастер выбрал
  // 3MF именно ради готового профиля, поэтому такой файл отклоняется.
  let bytes: Buffer | undefined;
  let printerModel: string | null = null;

  if (name.endsWith(THREE_MF_EXTENSION)) {
    bytes = Buffer.from(await file.arrayBuffer());

    try {
      printerModel = extractPrinterModelFrom3mf(bytes);
    } catch (error) {
      console.warn(
        "3MF не разобран:",
        error instanceof Error ? error.message : error,
      );

      return errorResponse(
        415,
        "3MF не читается как архив. Сохраните файл заново в слайсере.",
      );
    }
  }

  try {
    const url = await uploadGcodeToSupabase(user.id, file, bytes);

    return Response.json(
      { url, printerModel },
      {
        headers: {
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
      },
    );
  } catch (error) {
    console.error(
      "Файл печати не загружен:",
      error instanceof Error ? error.message : error,
    );

    return errorResponse(
      503,
      "Не удалось сохранить файл печати. Попробуйте ещё раз.",
    );
  }
}
