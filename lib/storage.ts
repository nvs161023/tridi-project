/**
 * Временное хранилище изображений для внешних сервисов и постоянное — для
 * готовых 3D-моделей.
 *
 * Gen API принимает картинки только ссылками, поэтому фото из формы сначала
 * уходит в публичный бакет `workshop-temp`, а в запрос попадает public URL.
 * Ссылки на готовые модели Gen API держит в своём облаке и может удалить,
 * поэтому GLB перекладывается в бакет `3d-models` и клиент получает наш
 * постоянный адрес. Загрузка идёт служебным клиентом (service_role): политик
 * Storage у пользователя нет, а бакеты общие для всех генераций.
 *
 * Картинки лежат папками по дате (`2026-10-26/<uuid>.jpg`) — так временные
 * файлы проще найти и удалить. Отдельного удаления здесь нет: модели нужен
 * URL, пока идёт генерация, а чистку делает администратор базы.
 */
import { randomUUID } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

/** Бакет для картинок, которые нужны внешнему API прямо сейчас. */
export const TEMP_IMAGES_BUCKET = "workshop-temp";

/** Бакет для готовых 3D-моделей: эти файлы отдаём пользователю навсегда. */
export const MODELS_BUCKET = "3d-models";

/** Предел размера файла в бакете — тот же, что у роутов с фото. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Предел размера модели: GLB из Trellis 2 весит 15–50 МБ. */
const MAX_MODEL_BYTES = 50 * 1024 * 1024;

/** Форматы, которые принимает Gen API. */
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Форматы моделей: бинарный GLB и текстовый glTF. */
const MODEL_MIME_TYPES = [
  "model/gltf-binary",
  "model/gltf+json",
  "application/octet-stream",
];

/** Расширение по MIME-типу: внешний сервис смотрит и на имя файла. */
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

/** Бакет проверяется один раз на процесс; при ошибке кэш сбрасывается. */
let bucketReady: Promise<void> | null = null;

/** То же для бакета с моделями: проверка отдельная, лимиты другие. */
let modelsBucketReady: Promise<void> | null = null;

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
 * Создаёт бакет `3d-models`, если его нет, и открывает публичный доступ.
 *
 * Лимиты здесь другие, чем у `workshop-temp`: модель весит до 50 МБ и имеет
 * тип `model/gltf-binary`. Если бакет уже есть с настройками от картинок,
 * загрузка GLB упала бы на проверке размера и MIME, поэтому настройки
 * приводятся к нужным при первом обращении в процессе.
 */
async function ensureModelsBucket(admin: SupabaseAdmin): Promise<void> {
  const { data } = await admin.storage.getBucket(MODELS_BUCKET);

  if (data?.public) {
    const limit = data.file_size_limit ?? MAX_MODEL_BYTES;

    if (limit >= MAX_MODEL_BYTES) {
      return;
    }
  }

  if (data) {
    const { error } = await admin.storage.updateBucket(MODELS_BUCKET, {
      public: true,
      fileSizeLimit: MAX_MODEL_BYTES,
      allowedMimeTypes: MODEL_MIME_TYPES,
    });

    if (error) {
      throw new Error(
        `Не удалось настроить бакет ${MODELS_BUCKET}: ${error.message}`,
      );
    }

    return;
  }

  const { error } = await admin.storage.createBucket(MODELS_BUCKET, {
    public: true,
    fileSizeLimit: MAX_MODEL_BYTES,
    allowedMimeTypes: MODEL_MIME_TYPES,
  });

  // Параллельный запрос мог создать бакет первым — это не ошибка.
  if (error && !/exist|duplicate/i.test(error.message)) {
    throw new Error(
      `Не удалось создать бакет ${MODELS_BUCKET}: ${error.message}`,
    );
  }
}

/**
 * Кладёт готовую модель в `3d-models` и возвращает постоянный публичный URL.
 *
 * Имя файла — `3d-model-${requestId}.glb`: номер задачи уникален, поэтому
 * коллизий нет, а повторная загрузка того же номера перезаписывает тот же
 * файл (идемпотентность важнее запрета перезаписи). Ошибки бросаются
 * исключением: роут превращает их в 502 и не списывает кредит.
 */
export async function uploadModelToSupabase(
  requestId: string,
  bytes: Buffer,
  options: { extension: string; contentType: string },
): Promise<string> {
  const admin = createAdminClient();

  modelsBucketReady ??= ensureModelsBucket(admin).catch((error: unknown) => {
    // Неудачная попытка не должна запоминаться на весь процесс.
    modelsBucketReady = null;
    throw error;
  });

  await modelsBucketReady;

  const path = `${dateFolder()}/3d-model-${requestId}.${options.extension}`;

  const { error } = await admin.storage
    .from(MODELS_BUCKET)
    .upload(path, bytes, {
      contentType: options.contentType,
      cacheControl: "31536000",
      upsert: true,
    });

  if (error) {
    throw new Error(`Не удалось сохранить 3D-модель: ${error.message}`);
  }

  return admin.storage.from(MODELS_BUCKET).getPublicUrl(path).data.publicUrl;
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
