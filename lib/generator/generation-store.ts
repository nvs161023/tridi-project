/**
 * Хранилище истории генераций: строки таблицы `generations` и STL в бакете.
 *
 * Зачем отдельный модуль: готовую модель нужно сохранить один раз, а читать её
 * из двух разных мест («Мои модели» и галерея). Здесь собраны все запросы к
 * таблице и Storage, чтобы страницы, роут скачивания и API генерации не
 * повторяли имена колонок и не забывали про фильтр `stl_url is not null`.
 *
 * Запись идёт служебным клиентом (service_role): строку создаёт роут после
 * проверки сессии, а файл кладётся в закрытый бакет мимо политик Storage.
 * Чтение списков — клиентом пользователя, поэтому RLS всё равно решает, что
 * ему видно. Ошибки записи не ломают генерацию: история — не критичный путь.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_GENERATION_CATEGORY,
  parseGenerationCategory,
  type GenerationCategory,
} from "@/lib/generator/categories";
import {
  GENERATED_MODELS_BUCKET,
  GENERATIONS_LIMIT,
  GENERATIONS_TABLE,
  GENERATION_PREVIEW_TTL_SECONDS,
  formatGenerationDate,
  parseGenerationService,
  type GenerationCardData,
  type StoredGeneration,
} from "@/lib/generator/generations";
import type { GeneratorService } from "@/lib/generator/photo-generator";
import { isMissingColumnSchema } from "@/lib/supabase/schema-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type SupabaseAdmin = ReturnType<typeof createAdminClient>;

/** Предел размера STL в бакете — тот же, что у `3d-models`. */
const MAX_STL_BYTES = 50 * 1024 * 1024;

/** Типы, которые принимает бакет: browsers и старые клиенты шлют разные. */
const STL_MIME_TYPES = [
  "model/stl",
  "application/sla",
  "application/octet-stream",
];

/** Колонки списка: путь к файлу отдельно, чтобы не читать лишнего. */
const LIST_COLUMNS = "id, service, stl_url, is_public, category, created_at";

/**
 * Те же колонки без `category`.
 *
 * Колонку добавляют вручную (`supabase/generations_category.sql`), поэтому
 * живая база может быть на schema-шаг назад. Тогда списки читаются без неё,
 * а карточки показывают «Другое» — терять всю историю из-за необязательного
 * поля нельзя.
 */
const LIST_COLUMNS_WITHOUT_CATEGORY =
  "id, service, stl_url, is_public, created_at";

/** Строка таблицы в том виде, в каком её вернул PostgREST. */
type GenerationRow = {
  id?: string | null;
  user_id?: string | null;
  task_id?: string | null;
  service?: string | null;
  stl_url?: string | null;
  is_public?: boolean | null;
  category?: string | null;
  created_at?: string | null;
};

/** Бакет проверяется один раз на процесс; при ошибке кэш сбрасывается. */
let bucketReady: Promise<void> | null = null;

/**
 * Создаёт закрытый бакет `generated-models`, если его нет, и приводит
 * настройки к нужным.
 *
 * Бакет мог быть создан вручную в Dashboard или раньше с другими лимитами:
 * тогда 50-мегабайтная модель не загрузилась бы на проверке размера, а
 * публичный бакет отдал бы чужой STL по прямой ссылке. Поэтому публичность,
 * размер и MIME-типы проверяются перед первой загрузкой в процессе.
 */
async function ensureModelsBucket(admin: SupabaseAdmin): Promise<void> {
  const { data } = await admin.storage.getBucket(GENERATED_MODELS_BUCKET);

  const allowedTypes = data?.allowed_mime_types ?? [];
  const allowsStl =
    allowedTypes.length === 0 ||
    STL_MIME_TYPES.every((type) => allowedTypes.includes(type));

  if (
    data &&
    !data.public &&
    (data.file_size_limit ?? 0) >= MAX_STL_BYTES &&
    allowsStl
  ) {
    return;
  }

  if (data) {
    const { error } = await admin.storage.updateBucket(GENERATED_MODELS_BUCKET, {
      public: false,
      fileSizeLimit: MAX_STL_BYTES,
      allowedMimeTypes: STL_MIME_TYPES,
    });

    if (error) {
      throw new Error(
        `Не удалось настроить бакет ${GENERATED_MODELS_BUCKET}: ${error.message}`,
      );
    }

    return;
  }

  const { error } = await admin.storage.createBucket(GENERATED_MODELS_BUCKET, {
    public: false,
    fileSizeLimit: MAX_STL_BYTES,
    allowedMimeTypes: STL_MIME_TYPES,
  });

  // Параллельный запрос мог создать бакет первым — это не ошибка.
  if (error && !/exist|duplicate/i.test(error.message)) {
    throw new Error(
      `Не удалось создать бакет ${GENERATED_MODELS_BUCKET}: ${error.message}`,
    );
  }
}

/** Одна строка лога: сообщение и код PostgREST, если он есть. */
function warnAboutHistory(message: string, cause: unknown): void {
  const detail =
    cause instanceof Error
      ? cause.message
      : typeof cause === "string"
        ? cause
        : "нет подробностей";

  console.warn(`[generations] ${message}:`, detail);
}

/**
 * Запоминает созданную задачу.
 *
 * Вызывается из `/api/generate-3d` после ответа сети: без строки успешный
 * опрос не найдёт, куда положить STL. Ошибка не мешает ответу `{ taskId }`:
 * пользователь получит модель, даже если история временно недоступна.
 *
 * Категория пишется вместе с задачей: фильтр галереи работает по строке, а не
 * по модели, и догонять её отдельным запросом значило бы терять значение, пока
 * модель считается.
 */
export async function rememberGenerationTask(input: {
  userId: string;
  taskId: string;
  service: GeneratorService;
  category: GenerationCategory;
  isPublic: boolean;
}): Promise<void> {
  const row = {
    user_id: input.userId,
    task_id: input.taskId,
    service: input.service,
    is_public: input.isPublic,
  };

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from(GENERATIONS_TABLE)
      .insert({ ...row, category: input.category });

    if (!error) {
      return;
    }

    // 23505 — сеть вернула уже известный номер: строка есть, повтор не нужен.
    if (error.code === "23505") {
      return;
    }

    // Колонку добавляют вручную: без неё нельзя потерять всю строку истории.
    if (isMissingColumnSchema(error.code, error.message, "category")) {
      const retry = await admin.from(GENERATIONS_TABLE).insert(row);

      if (retry.error && retry.error.code !== "23505") {
        warnAboutHistory(
          `задача ${input.taskId} не записана без категории (${retry.error.code ?? "без кода"})`,
          retry.error.message,
        );
      }

      return;
    }

    warnAboutHistory(
      `задача ${input.taskId} не записана (${error.code ?? "без кода"})`,
      error.message,
    );
  } catch (error) {
    warnAboutHistory("история недоступна", error);
  }
}

/**
 * Кладёт готовый STL в закрытый бакет и записывает путь в строку задачи.
 *
 * Временная папка «мясорубки» живёт до перезапуска контейнера, поэтому файл
 * копируется в Storage сразу после постобработки. Путь строится от `user_id`:
 * у каждого пользователя своя папка, а имя файла — тот же хэш, что и во
 * временной папке.
 */
export async function saveGenerationStl(input: {
  taskId: string;
  filePath: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from(GENERATIONS_TABLE)
      .select("id, user_id, stl_url")
      .eq("task_id", input.taskId)
      .maybeSingle();

    if (error) {
      warnAboutHistory(
        `задача ${input.taskId} не найдена (${error.code ?? "без кода"})`,
        error.message,
      );
      return;
    }

    if (!data?.id || !data.user_id) {
      warnAboutHistory(
        `задача ${input.taskId} не найдена`,
        "строки в таблице нет — история не записалась при создании задачи",
      );
      return;
    }

    // Повторный опрос после успеха не должен снова грузить тот же файл.
    if (data.stl_url) {
      return;
    }

    const objectPath = `${data.user_id}/${path.basename(input.filePath)}`;

    bucketReady ??= ensureModelsBucket(admin).catch((cause: unknown) => {
      // Неудачная попытка не должна запоминаться на весь процесс.
      bucketReady = null;
      throw cause;
    });

    await bucketReady;

    const file = await readFile(input.filePath);
    const { error: uploadError } = await admin.storage
      .from(GENERATED_MODELS_BUCKET)
      .upload(objectPath, file, {
        contentType: "model/stl",
        cacheControl: "31536000",
        upsert: true,
      });

    if (uploadError) {
      warnAboutHistory(`STL не загружен (${objectPath})`, uploadError.message);
      return;
    }

    const { error: updateError } = await admin
      .from(GENERATIONS_TABLE)
      .update({ stl_url: objectPath })
      .eq("task_id", input.taskId);

    if (updateError) {
      warnAboutHistory(
        `путь STL не записан (${input.taskId})`,
        updateError.message,
      );

      // Файл без строки — мусор в бакете: убираем, чтобы не копился.
      await admin.storage
        .from(GENERATED_MODELS_BUCKET)
        .remove([objectPath])
        .then(({ error: removeError }) => {
          if (removeError) {
            warnAboutHistory(
              `лишний файл не удалён (${objectPath})`,
              removeError.message,
            );
          }
        });
    }
  } catch (error) {
    warnAboutHistory(`STL задачи ${input.taskId} не сохранён`, error);
  }
}


/** Строка базы в готовую модель: неполные значения пропускаются. */
function toStoredGeneration(row: GenerationRow): StoredGeneration | null {
  const service = parseGenerationService(row.service);

  if (!row.id || !service || !row.stl_url) {
    return null;
  }

  return {
    id: row.id,
    service,
    // Старая строка или неприменённая миграция читаются как «Другое»: без
    // категории карточка не должна исчезать из истории.
    category: parseGenerationCategory(row.category) ?? DEFAULT_GENERATION_CATEGORY,
    isPublic: row.is_public === true,
    createdAtLabel: formatGenerationDate(row.created_at ?? ""),
    stlPath: row.stl_url,
  };
}

/**
 * Список моделей с файлом: свои строки или публичная лента.
 *
 * `stl_url is not null` — обязательный фильтр: строка появляется раньше, чем
 * готова модель, и карточке без файла нечего показывать и нечего скачивать.
 *
 * `category` — фильтр галереи; в «Моих моделях» не передаётся, там видны все
 * модели. Если колонки в живой базе ещё нет, лента без фильтра читается без
 * неё, а фильтр по категории честно отдаёт пусто: подписывать модели чужой
 * категорией нельзя.
 */
async function listGenerations(
  supabase: Supabase,
  filter: { userId: string | null; category?: GenerationCategory | null },
): Promise<StoredGeneration[]> {
  const build = (columns: string) => {
    let query = supabase
      .from(GENERATIONS_TABLE)
      .select(columns)
      .not("stl_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(GENERATIONS_LIMIT);

    query = filter.userId
      ? query.eq("user_id", filter.userId)
      : query.eq("is_public", true);

    if (filter.category) {
      query = query.eq("category", filter.category);
    }

    return query;
  };

  const { data, error } = await build(LIST_COLUMNS);
  let rows = (data ?? []) as GenerationRow[];

  if (error) {
    if (!isMissingColumnSchema(error.code, error.message, "category")) {
      warnAboutHistory(
        `список не прочитан (${error.code ?? "без кода"})`,
        error.message,
      );
      return [];
    }

    // Фильтра по категории без колонки не существует: пустая лента честнее
    // списка, в котором «Игрушки» показывают что угодно.
    if (filter.category) {
      return [];
    }

    const fallback = await build(LIST_COLUMNS_WITHOUT_CATEGORY);

    if (fallback.error) {
      warnAboutHistory(
        `список не прочитан (${fallback.error.code ?? "без кода"})`,
        fallback.error.message,
      );
      return [];
    }

    rows = (fallback.data ?? []) as GenerationRow[];
  }

  return rows
    .map(toStoredGeneration)
    .filter((item): item is StoredGeneration => item !== null);
}

/** «Мои модели»: всё, что пользователь сгенерировал, включая скрытые. */
export async function getMyGenerations(
  supabase: Supabase,
  userId: string,
): Promise<StoredGeneration[]> {
  return listGenerations(supabase, { userId });
}

/**
 * Галерея: только опубликованные модели всех пользователей.
 *
 * `category` приходит из адреса (`?category=toy`) и уже проверена вызывающим
 * кодом; `null` — вкладка «Все».
 */
export async function getPublicGenerations(
  supabase: Supabase,
  category: GenerationCategory | null = null,
): Promise<StoredGeneration[]> {
  return listGenerations(supabase, { userId: null, category });
}

/** Подписанная ссылка на один STL: живёт час и только для чтения файла. */
async function signPreview(
  admin: SupabaseAdmin,
  stlPath: string,
): Promise<string | null> {
  const { data, error } = await admin.storage
    .from(GENERATED_MODELS_BUCKET)
    .createSignedUrl(stlPath, GENERATION_PREVIEW_TTL_SECONDS);

  if (error) {
    warnAboutHistory(
      `превью не подписано (${stlPath})`,
      error.message,
    );
    return null;
  }

  return data?.signedUrl ?? null;
}

/**
 * Добавляет к строкам подписанные ссылки для вьювера.
 *
 * Одна ссылка на карточку: `GeneratedModelViewer` скачивает STL из браузера,
 * а приватный бакет без подписи отдал бы 400. Если service_role недоступен
 * (нет переменных окружения), карточки всё равно рисуются — с заглушкой и
 * кнопкой скачивания через наш роут.
 */
export async function attachGenerationPreviews(
  items: StoredGeneration[],
): Promise<GenerationCardData[]> {
  if (items.length === 0) {
    return [];
  }

  let admin: SupabaseAdmin;

  try {
    admin = createAdminClient();
  } catch (error) {
    warnAboutHistory("превью недоступны", error);

    return items.map((item) => ({
      id: item.id,
      service: item.service,
      category: item.category,
      isPublic: item.isPublic,
      createdAtLabel: item.createdAtLabel,
      previewUrl: null,
    }));
  }

  return Promise.all(
    items.map(async (item) => ({
      id: item.id,
      service: item.service,
      category: item.category,
      isPublic: item.isPublic,
      createdAtLabel: item.createdAtLabel,
      previewUrl: await signPreview(admin, item.stlPath),
    })),
  );
}

/** Что нужно роуту скачивания, чтобы проверить право и отдать файл. */
export type DownloadableGeneration = {
  userId: string;
  stlPath: string;
  isPublic: boolean;
};

/**
 * Ищет модель для скачивания.
 *
 * Читаем служебным клиентом: гость галереи не должен получать строку через
 * RLS, пока роут сам не решил, что модель публичная. Проверку права делает
 * вызывающий код — здесь только данные.
 */
export async function getGenerationForDownload(
  id: string,
): Promise<DownloadableGeneration | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from(GENERATIONS_TABLE)
      .select("user_id, stl_url, is_public")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      warnAboutHistory(
        `модель ${id} не прочитана (${error.code ?? "без кода"})`,
        error.message,
      );
      return null;
    }

    if (!data?.user_id || !data.stl_url) {
      return null;
    }

    return {
      userId: data.user_id,
      stlPath: data.stl_url,
      isPublic: data.is_public === true,
    };
  } catch (error) {
    warnAboutHistory(`модель ${id} не прочитана`, error);
    return null;
  }
}

/** Скачивает файл из закрытого бакета: `null` — файла нет или Storage отказал. */
export async function downloadGenerationStl(
  stlPath: string,
): Promise<ArrayBuffer | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(GENERATED_MODELS_BUCKET)
      .download(stlPath);

    if (error || !data) {
      warnAboutHistory(
        `файл не скачан (${stlPath})`,
        error?.message ?? "пустой ответ Storage",
      );
      return null;
    }

    return data.arrayBuffer();
  } catch (error) {
    warnAboutHistory(`файл не скачан (${stlPath})`, error);
    return null;
  }
}

