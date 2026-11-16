/**
 * Временное хранилище изображений для внешних сервисов и постоянное — для
 * готовых 3D-моделей.
 *
 * Gen API принимает картинки только ссылками, поэтому фото из формы сначала
 * уходит в закрытый бакет `workshop-temp`, а в запрос попадает **подписанная**
 * ссылка на час. Ссылки на готовые модели Gen API держит в своём облаке и
 * может удалить, поэтому GLB перекладывается в закрытый бакет `3d-models`, а
 * клиент получает подписанную ссылку. Загрузка идёт служебным клиентом
 * (service_role): политик Storage у пользователя нет, а бакеты общие для всех
 * генераций.
 *
 * Картинки лежат папками по дате (`2026-10-26/<uuid>.jpg`) — так временные
 * файлы проще найти и удалить. Отдельного удаления здесь нет: модели нужен
 * URL, пока идёт генерация, а чистку делает администратор базы.
 */
import { randomUUID } from "node:crypto";

import type { ProductFileKind } from "@/lib/3d/print-compatibility";
import { createAdminClient } from "@/lib/supabase/admin";

/** Бакет для картинок, которые нужны внешнему API прямо сейчас. */
export const TEMP_IMAGES_BUCKET = "workshop-temp";

/** Бакет для готовых 3D-моделей: эти файлы отдаём пользователю по подписи. */
export const MODELS_BUCKET = "3d-models";

/** Бакет для G-code каталога: агент скачивает файл по временной ссылке. */
export const GCODE_BUCKET = "workshop-gcode";

/**
 * Сколько живёт подписанная ссылка на файл Storage.
 *
 * Час — компромисс: внешний генератор успевает скачать картинку, мастер —
 * открыть файл товара, а ссылка из лога или истории браузера быстро становится
 * бесполезной. Агенту фермы ссылка выдаётся заново при каждом опросе очереди.
 */
export const STORAGE_SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Предел размера файла в бакете — тот же, что у роутов с фото. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Предел размера модели: GLB из Trellis 2 весит 15–50 МБ. */
const MAX_MODEL_BYTES = 50 * 1024 * 1024;

/** G-code с поддержками тоже бывает тяжёлым; 50 МБ хватает типичной вазе. */
const MAX_GCODE_BYTES = 50 * 1024 * 1024;

/** Форматы, которые принимает Gen API. */
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Форматы моделей: бинарный GLB и текстовый glTF. */
const MODEL_MIME_TYPES = [
  "model/gltf-binary",
  "model/gltf+json",
  "application/octet-stream",
];

/** Браузер часто не знает MIME G-code и присылает пустой тип. */
const GCODE_MIME_TYPES = [
  "text/plain",
  "application/octet-stream",
  "text/x-gcode",
  "application/x-gcode",
];

/**
 * MIME файлов печати: G-code, 3MF-контейнер и STL-модель.
 *
 * Список нужен бакету `workshop-gcode`: Supabase Storage отклоняет загрузку с
 * типом вне списка. `application/octet-stream` уже входит в набор G-code и
 * остаётся запасным вариантом — браузер определяет эти форматы не всегда.
 */
const PRINT_FILE_MIME_TYPES = [
  ...GCODE_MIME_TYPES,
  "model/3mf",
  "model/stl",
  "model/x.stl-binary",
  "application/sla",
  "application/vnd.ms-pki.stl",
];

/** Расширения файлов печати: агент фермы понимает и G-code, и 3MF, и STL. */
const PRINT_FILE_EXTENSIONS = [".gcode", ".gco", ".g", ".3mf", ".stl"] as const;

/**
 * Расширение имени файла из списка или `.gcode` по умолчанию.
 *
 * Оно попадает в имя объекта, а агент фермы выбирает по нему, что делать с
 * файлом: проект 3MF (нарезанный в Bambu Studio) уходит на принтер как есть, а
 * G-code и STL Bambu не печатает — ему нужен готовый проект `.3mf`.
 */
function printFileExtension(name: string): string {
  const lower = name.trim().toLocaleLowerCase("en-US");

  return (
    PRINT_FILE_EXTENSIONS.find((extension) => lower.endsWith(extension)) ??
    ".gcode"
  );
}

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

/** И для G-code каталога: файл не должен попасть в чужую папку. */
let gcodeBucketReady: Promise<void> | null = null;

/**
 * Создаёт закрытый бакет `workshop-temp`, если его нет, и приводит настройки
 * к нужным.
 *
 * Бакет приватный: картинка нужна только внешнему генератору на время задачи,
 * поэтому в запрос уходит подписанная ссылка. Если бакет уже был создан
 * публичным, первый вызов в процессе закрывает его — иначе старые объекты
 * остались бы доступны по прямой ссылке.
 */
async function ensureTempBucket(admin: SupabaseAdmin): Promise<void> {
  const { data } = await admin.storage.getBucket(TEMP_IMAGES_BUCKET);

  const allowedTypes = data?.allowed_mime_types ?? [];
  const allowsImages =
    allowedTypes.length === 0 ||
    ALLOWED_MIME_TYPES.every((type) => allowedTypes.includes(type));

  if (
    data &&
    !data.public &&
    (data.file_size_limit ?? 0) >= MAX_IMAGE_BYTES &&
    allowsImages
  ) {
    return;
  }

  if (data) {
    const { error } = await admin.storage.updateBucket(TEMP_IMAGES_BUCKET, {
      public: false,
      fileSizeLimit: MAX_IMAGE_BYTES,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    });

    if (error) {
      throw new Error(
        `Не удалось закрыть бакет ${TEMP_IMAGES_BUCKET}: ${error.message}`,
      );
    }

    return;
  }

  const { error } = await admin.storage.createBucket(TEMP_IMAGES_BUCKET, {
    public: false,
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
 * Создаёт закрытый бакет `3d-models`, если его нет, и приводит настройки к
 * нужным.
 *
 * Лимиты здесь другие, чем у `workshop-temp`: модель весит до 50 МБ и имеет
 * тип `model/gltf-binary`. Если бакет уже есть с настройками от картинок,
 * загрузка GLB упала бы на проверке размера и MIME, поэтому настройки
 * приводятся к нужным при первом обращении в процессе. Публичный бакет от
 * прежних версий закрывается здесь же.
 */
async function ensureModelsBucket(admin: SupabaseAdmin): Promise<void> {
  const { data } = await admin.storage.getBucket(MODELS_BUCKET);

  const allowedTypes = data?.allowed_mime_types ?? [];
  const allowsModels =
    allowedTypes.length === 0 ||
    MODEL_MIME_TYPES.every((type) => allowedTypes.includes(type));

  if (
    data &&
    !data.public &&
    (data.file_size_limit ?? 0) >= MAX_MODEL_BYTES &&
    allowsModels
  ) {
    return;
  }

  if (data) {
    const { error } = await admin.storage.updateBucket(MODELS_BUCKET, {
      public: false,
      fileSizeLimit: MAX_MODEL_BYTES,
      allowedMimeTypes: MODEL_MIME_TYPES,
    });

    if (error) {
      throw new Error(
        `Не удалось закрыть бакет ${MODELS_BUCKET}: ${error.message}`,
      );
    }

    return;
  }

  const { error } = await admin.storage.createBucket(MODELS_BUCKET, {
    public: false,
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
 * Создаёт закрытый бакет `workshop-gcode` и приводит лимиты к нужным.
 *
 * Ссылку скачивает локальный агент фермы, но не по публичному адресу: роут
 * очереди каждый раз подписывает путь на час. Поэтому угадать чужой файл или
 * переиспользовать ссылку из лога после истечения срока нельзя.
 *
 * Имя файла — UUID внутри папки пользователя: повторная загрузка не
 * перезаписывает существующий. Проверка повторяется перед каждой загрузкой
 * (первый вызов на процесс): бакет мог быть создан раньше только под G-code, и
 * тогда 3MF отклонялся бы по MIME-типу. Пустой список разрешённых типов значит
 * «принимаем любые» — его трогать не нужно.
 */
async function ensureGcodeBucket(admin: SupabaseAdmin): Promise<void> {
  const { data } = await admin.storage.getBucket(GCODE_BUCKET);

  const allowedTypes = data?.allowed_mime_types ?? [];
  const allowsPrintFiles =
    allowedTypes.length === 0 ||
    PRINT_FILE_MIME_TYPES.every((type) => allowedTypes.includes(type));

  if (
    data &&
    !data.public &&
    (data.file_size_limit ?? 0) >= MAX_GCODE_BYTES &&
    allowsPrintFiles
  ) {
    return;
  }

  if (data) {
    const { error } = await admin.storage.updateBucket(GCODE_BUCKET, {
      public: false,
      fileSizeLimit: MAX_GCODE_BYTES,
      allowedMimeTypes: PRINT_FILE_MIME_TYPES,
    });

    if (error) {
      throw new Error(
        `Не удалось закрыть бакет ${GCODE_BUCKET}: ${error.message}`,
      );
    }

    return;
  }

  const { error } = await admin.storage.createBucket(GCODE_BUCKET, {
    public: false,
    fileSizeLimit: MAX_GCODE_BYTES,
    allowedMimeTypes: PRINT_FILE_MIME_TYPES,
  });

  if (error && !/exist|duplicate/i.test(error.message)) {
    throw new Error(
      `Не удалось создать бакет ${GCODE_BUCKET}: ${error.message}`,
    );
  }
}

/**
 * Безопасный путь объекта: только относительные сегменты без `.` и `..`.
 *
 * Проверка нужна на границе разбора ссылки: путь из формы товара приходит от
 * пользователя, а Storage нормализует `..` в ключе. Без неё мастер мог бы
 * сохранить ссылку на соседний объект бакета, и каталог подписал бы его при
 * каждом чтении. Пустая строка, абсолютный путь и обратные слэши тоже
 * отклоняются: наши загрузчики таких ключей не создают.
 */
function isSafeObjectPath(path: string): boolean {
  if (!path || path.startsWith("/") || path.includes("\\")) {
    return false;
  }

  return path
    .split("/")
    .every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

/**
 * Путь из исходной строки URL до нормализации WHATWG `URL`.
 *
 * `new URL()` сам сворачивает `../` и `./`, поэтому проверять безопасность
 * только по `url.pathname` поздно: `.../bucket/user/../other/a.gcode` уже
 * превратился бы в `.../bucket/other/a.gcode` и выглядел бы нормальным. Здесь
 * нужен сырой путь; query и fragment отрезаются, чтобы точки в токене подписи
 * не считались сегментами.
 */
function rawUrlPathname(url: string): string | null {
  const match = /^[a-z][a-z\d+.-]*:\/\/[^/?#]*(\/[^?#]*)?/i.exec(url);

  if (!match) {
    return null;
  }

  return match[1] ?? "/";
}

/**
 * Путь объекта внутри бакета из публичной, подписанной или authenticated-ссылки
 * Supabase Storage.
 *
 * Внешние ссылки (облако генератора, CDN) возвращаются как `null`: подписывать
 * их нечем и не нужно. Хост сверяется с `NEXT_PUBLIC_SUPABASE_URL`, иначе
 * подставленный в форму URL вида `https://чужой-сайт/storage/v1/object/...`
 * заставил бы агент подписать и скачать файл из нашего бакета. Если переменная
 * не задана, путь тоже не разбирается: без ожидаемого хоста проверка невозможна.
 */
export function storageObjectPath(url: string, bucket: string): string | null {
  // Сырой путь проверяется до `new URL()`: иначе `..` и `.` будут свёрнуты
  // парсером и до проверки сегментов дело не дойдёт.
  const rawPath = rawUrlPathname(url);

  if (!rawPath || rawPath.startsWith("//")) {
    return null;
  }

  try {
    if (!isSafeObjectPath(decodeURIComponent(rawPath.slice(1)))) {
      return null;
    }
  } catch {
    return null;
  }

  let pathname: string;

  try {
    const parsed = new URL(url);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

    if (supabaseUrl) {
      let expectedOrigin: string;

      try {
        expectedOrigin = new URL(supabaseUrl).origin;
      } catch {
        return null;
      }

      if (parsed.origin !== expectedOrigin) {
        return null;
      }
    } else {
      // Без URL Supabase нельзя отличить наш Storage от чужого: не подписываем.
      return null;
    }

    pathname = parsed.pathname;
  } catch {
    return null;
  }

  const prefixes = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/sign/${bucket}/`,
    `/storage/v1/object/authenticated/${bucket}/`,
  ];
  const prefix = prefixes.find((candidate) => pathname.startsWith(candidate));

  if (!prefix) {
    return null;
  }

  const encoded = pathname.slice(prefix.length);

  if (!encoded) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(encoded);

    return isSafeObjectPath(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

/** Подписывает путь уже настроенным служебным клиентом. */
async function signPath(
  admin: SupabaseAdmin,
  bucket: string,
  path: string,
  ttlSeconds: number,
): Promise<string> {
  if (!isSafeObjectPath(path)) {
    throw new Error(`Недопустимый путь объекта в ${bucket}: ${path}`);
  }

  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(path, ttlSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(
      `Не удалось подписать ссылку на ${bucket}/${path}: ${
        error?.message ?? "пустой ответ Storage"
      }`,
    );
  }

  return data.signedUrl;
}

/** Подписывает путь в бакете, создавая служебный клиент при вызове. */
export async function createSignedStorageUrl(
  bucket: string,
  path: string,
  ttlSeconds = STORAGE_SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  return signPath(createAdminClient(), bucket, path, ttlSeconds);
}

/**
 * Заново подписывает сохранённую ссылку Storage.
 *
 * Ссылка в базе истекает через час, поэтому места, которые отдают её позже
 * (очередь агента), обновляют подпись из пути. Внешний URL возвращается без
 * изменений.
 */
export async function signStoredStorageUrl(
  url: string,
  bucket: string,
  ttlSeconds = STORAGE_SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const path = storageObjectPath(url, bucket);

  if (!path) {
    return url;
  }

  return createSignedStorageUrl(bucket, path, ttlSeconds);
}

/**
 * Кладёт готовую модель в `3d-models` и возвращает подписанную ссылку на час.
 *
 * Имя файла — `3d-model-${requestId}.glb`: номер задачи уникален, поэтому
 * коллизий нет, а повторная загрузка того же номера перезаписывает тот же
 * файл (идемпотентность важнее запрета перезаписи). Сам объект лежит в закрытом
 * бакете; ссылку получает только тот, кому её выдал роут. Ошибки бросаются
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

  return signPath(admin, MODELS_BUCKET, path, STORAGE_SIGNED_URL_TTL_SECONDS);
}

/**
 * Загружает изображение в `workshop-temp` и возвращает подписанную ссылку.
 *
 * Имя файла — UUID: одинаковые имена из разных браузеров не перезаписывают
 * друг друга, а `upsert: false` не даёт затереть чужую картинку случайно.
 * Внешний генератор получает ссылку на час — этого хватает, чтобы скачать
 * исходник. Ошибки бросаются исключением: роут превращает их в понятный ответ,
 * а не в 500 без текста.
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

  return signPath(
    admin,
    TEMP_IMAGES_BUCKET,
    path,
    STORAGE_SIGNED_URL_TTL_SECONDS,
  );
}

/**
 * Папки бакета по назначению файла.
 *
 * Исходники лежат отдельно от заданий печати: агенту фермы нужны только вторые,
 * а мастеру и калькулятору — первые. Папка добавляется перед датой, поэтому
 * старые ссылки вида `<userId>/<дата>/<uuid>.gcode` продолжают работать.
 */
const FILE_FOLDERS: Record<ProductFileKind, string> = {
  model: "models",
  print: "print",
};

/**
 * Загружает файл товара в закрытый бакет `workshop-gcode` и возвращает
 * подписанную ссылку на час.
 *
 * Путь начинается с `userId`: файлы разных мастерских не пересекаются даже
 * при совпадении имён. Дальше идёт папка назначения (`models` для исходника
 * STL, `print` для задания печати) и дата. Расширение сохраняется как у
 * исходного файла (`.gcode`, `.gco`, `.g`, `.3mf`, `.stl`) — по нему агент
 * фермы понимает, печатать готовый 3MF или сначала упаковать в контейнер
 * G-code. contentType берётся из файла, а если браузер его не знает —
 * `application/octet-stream`.
 *
 * В базе остаётся подписанная ссылка: она нужна интерфейсу сразу после
 * загрузки. Очередь агента обновляет подпись из пути при каждом опросе.
 */
export async function uploadGcodeToSupabase(
  userId: string,
  file: File,
  options: { kind?: ProductFileKind; bytes?: Buffer } = {},
): Promise<string> {
  const admin = createAdminClient();

  gcodeBucketReady ??= ensureGcodeBucket(admin).catch((error: unknown) => {
    gcodeBucketReady = null;
    throw error;
  });

  await gcodeBucketReady;

  // Файл без явного назначения считается заданием печати: прежние клиенты
  // присылали только его.
  const folder = FILE_FOLDERS[options.kind ?? "print"];
  const path = `${userId}/${folder}/${dateFolder()}/${randomUUID()}${printFileExtension(file.name)}`;
  // `bytes` передаёт роут, когда файл уже прочитан для разбора 3MF: читать
  // пятидесятимегабайтный архив второй раз значило бы держать его в памяти
  // дважды.
  const content = options.bytes ?? Buffer.from(await file.arrayBuffer());
  const contentType = PRINT_FILE_MIME_TYPES.includes(file.type)
    ? file.type
    : "application/octet-stream";

  const { error } = await admin.storage.from(GCODE_BUCKET).upload(path, content, {
    contentType,
    cacheControl: "31536000",
    upsert: false,
  });

  if (error) {
    throw new Error(`Не удалось загрузить файл печати: ${error.message}`);
  }

  return signPath(admin, GCODE_BUCKET, path, STORAGE_SIGNED_URL_TTL_SECONDS);
}
