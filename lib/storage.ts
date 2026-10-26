/**
 * Временное хранилище изображений для внешних сервисов.
 *
 * Gen API принимает картинки только ссылками, поэтому фото из формы сначала
 * уходит в публичный бакет `workshop-temp`, а в запрос попадает public URL.
 * Загрузка идёт служебным клиентом (service_role): политик Storage у
 * пользователя нет, а бакет общий для всех генераций.
 *
 * Файлы лежат папками по дате (`2026-10-26/<uuid>.jpg`) — так временные
 * картинки проще найти и удалить. Отдельного удаления здесь нет: модели нужен
 * URL, пока идёт генерация, а чистку делает администратор базы.
 */
import { randomUUID } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

/** Бакет для картинок, которые нужны внешнему API прямо сейчас. */
export const TEMP_IMAGES_BUCKET = "workshop-temp";

/** Предел размера файла в бакете — тот же, что у роутов с фото. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Форматы, которые принимает Gen API. */
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Расширение по MIME-типу: внешний сервис смотрит и на имя файла. */
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

/** Бакет проверяется один раз на процесс; при ошибке кэш сбрасывается. */
let bucketReady: Promise<void> | null = null;

/**
 * Создаёт бакет `workshop-temp`, если его нет, и открывает публичный доступ.
 *
 * Публичность обязательна: Gen API скачивает картинку по ссылке без наших
 * ключей. В закрытом бакете ссылка вернула бы 400, и генерация упала бы уже на
 * стороне сервиса, поэтому права проверяются перед каждой загрузкой (первый
 * вызов на процесс), а не один раз при настройке.
 */
async function ensureTempBucket(admin: SupabaseAdmin): Promise<void> {
  const { data } = await admin.storage.getBucket(TEMP_IMAGES_BUCKET);

  if (data?.public) {
    return;
  }

  if (data) {
    const { error } = await admin.storage.updateBucket(TEMP_IMAGES_BUCKET, {
      public: true,
      fileSizeLimit: MAX_IMAGE_BYTES,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    });

    if (error) {
      throw new Error(
        `Не удалось открыть бакет ${TEMP_IMAGES_BUCKET}: ${error.message}`,
      );
    }

    return;
  }

  const { error } = await admin.storage.createBucket(TEMP_IMAGES_BUCKET, {
    public: true,
    fileSizeLimit: MAX_IMAGE_BYTES,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
  });

  // Параллельный запрос мог создать бакет первым — это не ошибка.
  if (error && !/exist|duplicate/i.test(error.message)) {
    throw new Error(
      `Не удалось создать бакет ${TEMP_IMAGES_BUCKET}: ${error.message}`,
    );
  }
}

/** Папка по дате в UTC: одинаковый вид на сервере и в браузере. */
function dateFolder(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Загружает изображение в `workshop-temp` и возвращает публичный URL.
 *
 * Имя файла — UUID: одинаковые имена из разных браузеров не перезаписывают
 * друг друга, а `upsert: false` не даёт затереть чужую картинку случайно.
 * Ошибки бросаются исключением: роут превращает их в понятный ответ, а не в
 * 500 без текста.
 */
export async function uploadImageToSupabase(file: File): Promise<string> {
  const admin = createAdminClient();

  bucketReady ??= ensureTempBucket(admin).catch((error: unknown) => {
    // Неудачная попытка не должна запоминаться на весь процесс.
    bucketReady = null;
    throw error;
  });

  await bucketReady;

  const extension = EXTENSIONS[file.type] ?? "jpg";
  const path = `${dateFolder()}/${randomUUID()}.${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error } = await admin.storage
    .from(TEMP_IMAGES_BUCKET)
    .upload(path, bytes, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw new Error(`Не удалось загрузить изображение: ${error.message}`);
  }

  return admin.storage.from(TEMP_IMAGES_BUCKET).getPublicUrl(path).data
    .publicUrl;
}
