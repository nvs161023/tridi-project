import { deductCredit, getUserCredits } from "@/lib/credits";
import { uploadImageToSupabase } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

/** Buffer, multipart и Supabase Storage доступны только в Node.js. */
export const runtime = "nodejs";

/** Ответ зависит от cookies и внешнего API, кэшировать его нельзя. */
export const dynamic = "force-dynamic";

/** Trellis 2 собирает модель минуты — держим роут столько же. */
export const maxDuration = 300;

/** База Gen API: создание задачи и чтение её статуса. */
const GEN_API_BASE_URL = "https://api.gen-api.ru/api/v1";

/**
 * Поле с картинкой у каждой сети своё: Trellis 2 ждёт одну ссылку в
 * `image_url`, Tripo3D — массив в `image_urls`. Перепутанное поле Gen API
 * отклоняет с 422 «Поле image url обязательно», поэтому модель и имя поля
 * связаны в одной таблице.
 */
const GEN_API_MODELS = {
  "trellis-2": "image_url",
  "tripo-3d": "image_urls",
} as const;

type GenApiModel = keyof typeof GEN_API_MODELS;

/** Модель по умолчанию: Trellis 2 собирает 3D по одному фото. */
const DEFAULT_GEN_API_MODEL: GenApiModel = "trellis-2";

/** Разрешение текстуры, которое просим у Trellis 2. */
const TEXTURE_SIZE = 512;

/** Лимит фото: Trellis принимает изображения до 10 МБ. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Форматы, которые принимает Gen API. */
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/** Таймаут одного запроса: зависший запрос не должен держать роут. */
const GEN_API_TIMEOUT_MS = 30_000;

/** Пауза между опросами статуса задачи. */
const POLL_INTERVAL_MS = 3_000;

/** Сколько всего ждём результат: дольше роут не живёт. */
const POLL_BUDGET_MS = 240_000;

/** Предел вложенности при поиске ссылки в ответе Gen API. */
const MAX_URL_DEPTH = 5;

/** Ошибка в JSON: успешный ответ — ссылка на модель. */
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

/** Минимальная форма ответа на создание задачи. */
type GenApiCreateResponse = {
  request_id?: unknown;
  id?: unknown;
};

/**
 * Минимальная форма ответа на чтение статуса.
 *
 * `GET /request/get/{id}` отдаёт ссылки в `result` (массив строк), а
 * `full_response` — исходный ответ нейросети. Поле `output` в этом ответе не
 * встречается, но читается как запасной вариант на случай смены формата.
 */
type GenApiStatusResponse = {
  status?: unknown;
  result?: unknown;
  full_response?: unknown;
  output?: unknown;
  error?: unknown;
  message?: unknown;
};

/** Тело ответа Gen API при ошибке валидации. */
type GenApiValidationError = {
  errors_validation?: unknown;
};

/**
 * Тело ответа как текст и как JSON.
 *
 * Текст нужен для лога: у ошибок Gen API бывает HTML или пустое тело, и
 * `response.json()` на них бросает исключение, после которого тело уже не
 * прочитать.
 */
async function readBody<T>(
  response: Response,
): Promise<{ data: T | null; text: string }> {
  const text = await response.text().catch(() => "");

  if (!text) {
    return { data: null, text: "" };
  }

  try {
    return { data: JSON.parse(text) as T, text };
  } catch {
    return { data: null, text };
  }
}

/** Идентификатор задачи из ответа: Gen API отдаёт число или строку. */
function readRequestId(payload: GenApiCreateResponse): string | null {
  const value = payload.request_id ?? payload.id;

  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

/**
 * Модель из `GEN_API_MODEL`.
 *
 * Пусто — Trellis 2. Незнакомое значение опасно: поле картинки у другой сети
 * может называться иначе, и генерация упадёт уже после загрузки фото, поэтому
 * лучше сообщить об ошибке настройки сразу.
 */
function readModel(): GenApiModel | null {
  const value = process.env.GEN_API_MODEL?.trim();

  if (!value) {
    return DEFAULT_GEN_API_MODEL;
  }

  return Object.hasOwn(GEN_API_MODELS, value) ? (value as GenApiModel) : null;
}

/**
 * Тело запроса на генерацию.
 *
 * `trellis-2` принимает одно фото ссылкой в `image_url` и размер текстуры,
 * `tripo-3d` — массив ссылок в `image_urls` и не знает `texture_size`. Общее
 * поле — `callback_url`: результат забираем опросом, вебхук не нужен.
 */
function buildRequestBody(
  model: GenApiModel,
  imageUrl: string,
  imageField: string,
): Record<string, unknown> {
  const body: Record<string, unknown> =
    imageField === "image_urls"
      ? { image_urls: [imageUrl] }
      : { image_url: imageUrl };

  if (model === "trellis-2") {
    body.texture_size = TEXTURE_SIZE;
  }

  body.callback_url = null;

  return body;
}

/**
 * Первое сообщение валидации Gen API.
 *
 * При неверном теле сервис отвечает 422 и объектом
 * `{ error: true, errors_validation: { поле: ["текст"] } }`. Текст русский и
 * понятный, поэтому его можно показать пользователю вместо общего «сервис
 * перегружен»: именно это сообщение объясняет, что фотография не подошла.
 */
function readValidationMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const errors = (data as GenApiValidationError).errors_validation;

  if (!errors || typeof errors !== "object") {
    return null;
  }

  for (const value of Object.values(errors as Record<string, unknown>)) {
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }

    if (Array.isArray(value)) {
      const text = value.find(
        (item): item is string => typeof item === "string" && item.trim() !== "",
      );

      if (text) {
        return text.trim();
      }
    }
  }

  return null;
}

/** Ссылка из ответа: абсолютная или относительная от `api.gen-api.ru`. */
function toAbsoluteUrl(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : trimmed.startsWith("/")
      ? `https://api.gen-api.ru${trimmed}`
      : null;

  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(candidate);

    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/** Собирает все ссылки из поля `output`: строка, массив или объект. */
function collectUrls(value: unknown, found: string[], depth = 0): void {
  if (depth > MAX_URL_DEPTH) {
    return;
  }

  if (typeof value === "string") {
    const url = toAbsoluteUrl(value);

    if (url) {
      found.push(url);
    }

    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectUrls(item, found, depth + 1);
    }

    return;
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectUrls(item, found, depth + 1);
    }
  }
}

/**
 * Ссылка на GLB из ответа Gen API.
 *
 * `GET /request/get/{id}` отдаёт ссылки в `result` (массив строк), но формат
 * зависит от сети: у одних моделей это строка, у других — массив или объект с
 * полями `url` / `model_url`. Сначала ищем файл с расширением `.glb`, иначе
 * берём первую ссылку: если сервис отдаст превью вместе с моделью, клиент всё
 * равно получит модель.
 */
function extractModelUrl(result: unknown): string | null {
  const urls: string[] = [];
  collectUrls(result, urls);

  return urls.find((url) => /\.glb(\?|#|$)/i.test(url)) ?? urls[0] ?? null;
}

/** Пауза между опросами статуса. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Генерация 3D-модели по фотографии через Gen API (`trellis-2` по умолчанию).
 *
 * Порядок проверок:
 *   1. `GEN_API_KEY` — без ключа 503 «Генерация 3D временно недоступна»;
 *   2. `GEN_API_MODEL` — неизвестная сеть даёт 503 «настроена неверно»;
 *   3. сессия — `getUser()`, потому что `/api/*` не покрыт middleware;
 *   4. `getUserCredits()` — 0 кредитов дают 403, недоступный счётчик — 503;
 *   5. файл из multipart-поля `file`: формат и размер;
 *   6. загрузка в `workshop-temp` и запуск задачи в Gen API;
 *   7. опрос `GET /request/get/{request_id}` до `success` или `error`.
 *
 * Кредит списывается только после успеха: неудачная генерация и истёкшее
 * ожидание ничего не стоят пользователю. Ответ — `{ modelUrl, requestId }`.
 */
export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.GEN_API_KEY?.trim();

  if (!apiKey) {
    return errorResponse(503, "Генерация 3D временно недоступна");
  }

  const model = readModel();

  if (!model) {
    console.error(
      "[3d/generate] Неизвестная модель Gen API:",
      process.env.GEN_API_MODEL,
    );

    return errorResponse(
      503,
      "Генерация 3D настроена неверно. Сообщите администратору.",
    );
  }

  const imageField = GEN_API_MODELS[model];

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse(
      401,
      "Войдите в аккаунт, чтобы сгенерировать 3D-модель.",
    );
  }

  const credits = await getUserCredits(user.id);

  // `null` — счётчик недоступен, а не «0 кредитов»: покупать пакет из-за
  // сбоя базы человек не должен.
  if (credits === null) {
    return errorResponse(503, "Не удалось проверить кредиты. Попробуйте позже.");
  }

  if (credits <= 0) {
    return errorResponse(403, "Кредиты закончились. Купите пакет генераций");
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return errorResponse(
      400,
      "Не удалось прочитать файл. Отправьте изображение полем file.",
    );
  }

  const file = form.get("file");

  if (!file || typeof file === "string") {
    return errorResponse(400, "Прикрепите изображение полем file.");
  }

  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return errorResponse(415, "Поддерживаются изображения JPEG, PNG и WebP.");
  }

  if (file.size === 0) {
    return errorResponse(400, "Файл пустой. Прикрепите другое изображение.");
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return errorResponse(
      413,
      "Изображение больше 10 МБ. Сожмите его и попробуйте снова.",
    );
  }

  let imageUrl: string;

  try {
    imageUrl = await uploadImageToSupabase(file);
  } catch (error) {
    console.error(
      "Gen API: изображение не загружено в Storage:",
      error instanceof Error ? error.message : error,
    );

    return errorResponse(
      502,
      "Не удалось подготовить изображение. Попробуйте ещё раз.",
    );
  }

  let createResponse: Response;

  try {
    createResponse = await fetch(
      `${GEN_API_BASE_URL}/networks/${model}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(buildRequestBody(model, imageUrl, imageField)),
        cache: "no-store",
        signal: AbortSignal.timeout(GEN_API_TIMEOUT_MS),
      },
    );
  } catch (error) {
    console.error("Gen API: запрос на генерацию не выполнен:", error);

    return errorResponse(
      502,
      "Не удалось запустить генерацию. Попробуйте позже.",
    );
  }

  const created = await readBody<GenApiCreateResponse>(createResponse);

  if (!createResponse.ok) {
    console.error(
      "Gen API: генерация не запущена:",
      createResponse.status,
      created.text.slice(0, 300),
    );

    // 422 — сервис не принял параметры (например, картинка не скачалась).
    // Его текст точнее общего «сервис перегружен», поэтому отдаём его.
    if (createResponse.status === 422) {
      return errorResponse(
        400,
        readValidationMessage(created.data) ??
          "Сервис генерации отклонил фото. Попробуйте другое изображение.",
      );
    }

    return errorResponse(
      502,
      "Не удалось запустить генерацию. Попробуйте позже.",
    );
  }

  const requestId = created.data ? readRequestId(created.data) : null;

  if (!requestId) {
    console.error(
      "Gen API: в ответе нет request_id:",
      created.text.slice(0, 300),
    );

    return errorResponse(502, "Gen API не вернул номер задачи.");
  }

  const startedAt = Date.now();

  while (Date.now() - startedAt < POLL_BUDGET_MS) {
    await sleep(POLL_INTERVAL_MS);

    let statusResponse: Response;

    try {
      statusResponse = await fetch(
        `${GEN_API_BASE_URL}/request/get/${encodeURIComponent(requestId)}`,
        {
          headers: {
            authorization: `Bearer ${apiKey}`,
            accept: "application/json",
          },
          cache: "no-store",
          signal: AbortSignal.timeout(GEN_API_TIMEOUT_MS),
        },
      );
    } catch (error) {
      console.error("Gen API: статус задачи не получен:", error);

      return errorResponse(
        502,
        "Не удалось получить результат генерации. Попробуйте позже.",
      );
    }

    const status = await readBody<GenApiStatusResponse>(statusResponse);

    if (!statusResponse.ok) {
      console.error(
        "Gen API: ошибка чтения статуса:",
        statusResponse.status,
        status.text.slice(0, 300),
      );

      return errorResponse(
        502,
        "Не удалось получить результат генерации. Попробуйте позже.",
      );
    }

    const state =
      typeof status.data?.status === "string"
        ? status.data.status.toLowerCase()
        : "";

    if (
      state === "success" ||
      state === "succeeded" ||
      state === "completed"
    ) {
      // `result` — массив ссылок на файлы; `full_response` — исходный ответ
      // нейросети, где ссылки могут лежать глубже.
      const modelUrl = extractModelUrl(
        status.data?.result ??
          status.data?.full_response ??
          status.data?.output,
      );

      if (!modelUrl) {
        console.error(
          "Gen API: в успешном ответе нет ссылки на модель:",
          status.text.slice(0, 300),
        );

        return errorResponse(502, "Gen API не вернул ссылку на модель.");
      }

      // Кредит списываем только за готовую модель. Если списать не удалось,
      // модель всё равно отдаём: генерация уже выполнена на стороне Gen API,
      // и терять результат из-за счётчика нельзя.
      const deducted = await deductCredit(user.id);

      if (!deducted) {
        console.error(
          "[3d/generate] Кредит не списан после успешной генерации:",
          user.id,
        );
      }

      return Response.json(
        { modelUrl, requestId },
        {
          status: 200,
          headers: {
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
          },
        },
      );
    }

    if (
      state === "failed" ||
      state === "error" ||
      state === "canceled" ||
      state === "cancelled"
    ) {
      const details =
        typeof status.data?.error === "string"
          ? status.data.error
          : typeof status.data?.message === "string"
            ? status.data.message
            : status.text;

      console.error(
        "Gen API: генерация завершилась ошибкой:",
        requestId,
        details.slice(0, 300),
      );

      return errorResponse(
        502,
        "Не удалось сгенерировать 3D-модель. Попробуйте другое фото.",
      );
    }

    // pending / processing / in_progress и незнакомые статусы — ждём дальше.
  }

  console.warn("Gen API: истёк лимит ожидания:", requestId);

  return errorResponse(
    504,
    "Генерация занимает слишком много времени. Попробуйте позже.",
  );
}

