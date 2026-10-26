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

/** Сеть (модель) генерации 3D по фото. */
const TRELLIS_NETWORK = "trellis-2";

/** Разрешение текстуры, которое просим у Gen API. */
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

/** Минимальная форма ответа на чтение статуса. */
type GenApiStatusResponse = {
  status?: unknown;
  output?: unknown;
  error?: unknown;
  message?: unknown;
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
 * Формат `output` зависит от сети: у одних моделей это строка, у других —
 * массив или объект с полями `url` / `model_url`. Сначала ищем файл с
 * расширением `.glb`, иначе берём первую ссылку: если сервис отдаст превью
 * вместе с моделью, клиент всё равно получит модель.
 */
function extractModelUrl(output: unknown): string | null {
  const urls: string[] = [];
  collectUrls(output, urls);

  return urls.find((url) => /\.glb(\?|#|$)/i.test(url)) ?? urls[0] ?? null;
}

/** Пауза между опросами статуса. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Генерация 3D-модели по фотографии через Gen API (Trellis 2).
 *
 * Порядок проверок:
 *   1. `GEN_API_KEY` — без ключа 503 «Генерация 3D временно недоступна»;
 *   2. сессия — `getUser()`, потому что `/api/*` не покрыт middleware;
 *   3. `getUserCredits()` — 0 кредитов дают 403, недоступный счётчик — 503;
 *   4. файл из multipart-поля `file`: формат и размер;
 *   5. загрузка в `workshop-temp` и запуск задачи в Gen API;
 *   6. опрос `GET /requests/{request_id}` до `success` или `failed`.
 *
 * Кредит списывается только после успеха: неудачная генерация и истёкшее
 * ожидание ничего не стоят пользователю. Ответ — `{ modelUrl, requestId }`.
 */
export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.GEN_API_KEY?.trim();

  if (!apiKey) {
    return errorResponse(503, "Генерация 3D временно недоступна");
  }

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
      `${GEN_API_BASE_URL}/networks/${TRELLIS_NETWORK}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          image_urls: [imageUrl],
          texture_size: TEXTURE_SIZE,
          callback_url: null,
        }),
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
        `${GEN_API_BASE_URL}/requests/${encodeURIComponent(requestId)}`,
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
      const modelUrl = extractModelUrl(status.data?.output);

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

