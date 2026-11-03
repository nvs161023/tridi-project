import { extractPrinterModelFrom3mf } from "@/lib/3d/parse-3mf";
import type { ProductFileKind } from "@/lib/3d/print-compatibility";
import { hasActiveSubscription } from "@/lib/subscription";
import { uploadGcodeToSupabase } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

/**
 * Загрузка файла товара в публичный бакет `workshop-gcode`.
 *
 * Через отдельный роут, а не Server Action: G-code и 3MF весят мегабайты, а у
 * Server Actions по умолчанию небольшой лимит тела. Клиент отправляет файл
 * сюда, получает публичный URL и уже его кладёт в скрытое поле формы товара.
 *
 * Назначение задаёт поле `kind`:
 *   `print` — файл модели (.3mf, .gcode, .gco, .g или .stl), папка print;
 *   `model` — исходник модели (.stl), папка models. Этот вид остался ради
 *     старых клиентов: форма товара загружает STL как обычный файл.
 * Без поля загрузка считается файлом модели: так работали прежние клиенты.
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
 *   3. файл из multipart-поля `file`: назначение, расширение и размер;
 *   4. модель принтера из 3MF (только для `.3mf`);
 *   5. загрузка service_role-клиентом.
 *
 * Ответ: `{ url, printerModel, kind }` — постоянная публичная ссылка, подсказка
 * о принтере для workshop_products и папка, в которую лёг файл.
 */
export const runtime = "nodejs";

/** Ответ зависит от cookies пользователя и содержимого файла. */
export const dynamic = "force-dynamic";

/** Лимит совпадает с настройками бакета. */
const MAX_PRODUCT_FILE_BYTES = 50 * 1024 * 1024;

/**
 * Файлы модели товара: 3MF и G-code агент фермы печатает как есть, STL мастер
 * нарежет сам. Один блок загрузки в форме принимает все три формата, поэтому
 * список совпадает с `PRODUCT_FILE_EXTENSIONS`.
 */
const PRODUCT_FILE_EXTENSIONS = [".3mf", ".gcode", ".gco", ".g", ".stl"] as const;

/** Исходник модели: только STL, его нарезает слайсер. */
const MODEL_FILE_EXTENSIONS = [".stl"] as const;

/** Контейнер 3MF: только у него в архиве есть модель принтера. */
const THREE_MF_EXTENSION = ".3mf";

/** Расширение имени входит в список: браузер присылает имя в любом регистре. */
function hasExtension(name: string, extensions: readonly string[]): boolean {
  return extensions.some((extension) => name.endsWith(extension));
}

/**
 * Назначение загрузки из формы.
 *
 * Без поля (и при незнакомом значении) файл считается файлом модели: форма
 * товара грузит в этот блок 3MF, G-code и STL — в `gcode_url` попадает одна
 * ссылка. `model` остался ради старых клиентов: там принимается только STL и
 * ссылка уезжает в `model_url`.
 */
function readKind(form: FormData): ProductFileKind {
  return form.get("kind") === "model" ? "model" : "print";
}

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
    return errorResponse(401, "Войдите в аккаунт, чтобы загрузить файл товара.");
  }

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return errorResponse(
      403,
      "Каталог входит в пакет «Всё включено». Оформите доступ, чтобы загрузить файл товара.",
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
    return errorResponse(400, "Прикрепите файл полем file.");
  }

  const kind = readKind(form);
  const isModel = kind === "model";
  const allowedExtensions = isModel
    ? MODEL_FILE_EXTENSIONS
    : PRODUCT_FILE_EXTENSIONS;
  const name = file.name.toLowerCase();

  if (!hasExtension(name, allowedExtensions)) {
    return errorResponse(
      415,
      isModel
        ? "Исходник — файл .stl."
        : "Поддерживаются файлы .3mf, .gcode и .stl.",
    );
  }

  if (file.size === 0) {
    return errorResponse(400, "Файл пустой. Выберите другой файл.");
  }

  if (file.size > MAX_PRODUCT_FILE_BYTES) {
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
    const url = await uploadGcodeToSupabase(user.id, file, { kind, bytes });

    return Response.json(
      { url, printerModel, kind },
      {
        headers: {
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
      },
    );
  } catch (error) {
    console.error(
      "Файл товара не загружен:",
      error instanceof Error ? error.message : error,
    );

    return errorResponse(
      503,
      isModel
        ? "Не удалось сохранить исходник. Попробуйте ещё раз."
        : "Не удалось сохранить файл модели. Попробуйте ещё раз.",
    );
  }
}
