import { Buffer } from "node:buffer";

import { deductCredit, getUserCredits, refundCredit } from "@/lib/credits";
import { createClient } from "@/lib/supabase/server";

/**
 * Умный маршрутизатор генерации 3D-модели по фото.
 *
 * Роут только создаёт задачу у провайдера и сразу отдаёт её номер: генерация
 * идёт минуты, держать столько HTTP-запрос незачем — статус читает отдельный
 * роут по `taskId`. Провайдер выбирается по входу:
 *
 *   несколько фото            → Tripo `multiview-to-model` (по видам);
 *   одно фото + quality=ultra → Meshy `image-to-3d` (модель `meshy-7.1`);
 *   одно фото + standard      → Tripo `image-to-model` (дешевле всего).
 *
 * Обе сети вызываются без текстуры: для печати нужна геометрия, а карты
 * материалов только удорожают задачу. У Tripo `texture: false` работает лишь
 * вместе с `pbr: false` — иначе включённый по умолчанию PBR снова требует
 * текстуру.
 *
 * Tripo v3 не принимает base64 в теле задачи: фото сначала уходят в `/v3/files`
 * (multipart-поле `file`), а задача получает `file_token`. Meshy принимает
 * data URL напрямую, поэтому для одного фото загрузки нет.
 *
 * Любая ошибка сети или провайдера превращается в 502 с текстом причины:
 * 500 роут не отдаёт никогда, чтобы клиент отличал наш сбой от отказа сети.
 *
 * Роут платный, поэтому порядок проверок строгий: сессия (`getUser()`, гость —
 * 401) → тело и фото (400/413) → ключ сети (503) → кредиты `user_credits`
 * (0 — 402, недоступный счётчик — 503). Кредит списывается до платного запроса,
 * чтобы две вкладки не создали две задачи по одному балансу, и возвращается
 * (`refundCredit`), если сеть отказала: 502 не должен стоить пользователю
 * денег.
 */

/** Buffer, Blob и FormData для загрузки фото в Tripo нужны только в Node.js. */
export const runtime = "nodejs";

/** Ответ зависит от ключей окружения и внешних сетей, кэшировать его нельзя. */
export const dynamic = "force-dynamic";

/** Загрузка фото и создание задачи: сама генерация идёт уже без нас. */
export const maxDuration = 120;

/** Боевой адрес Tripo3D v3 для всех стран, кроме Китая. */
const TRIPO_BASE_URL = "https://openapi.tripo3d.ai/v3";

/** Адрес Meshy из документации: `/openapi/v1/...` — часть пути. */
const MESHY_BASE_URL = "https://api.meshy.ai";

/**
 * Модель Tripo3D для обеих задач: H3.1, рекомендованная версия для v3 API.
 * Поле в теле называется `model`, без него задача отклоняется.
 */
const TRIPO_MODEL = "v3.1-20260211";

/**
 * Модель Meshy для режима ultra.
 *
 * В API Meshy модель выбирается полем `ai_model`; `model_type` — это вид
 * сетки (`standard` или `smart-topology`), а не имя модели, и значение
 * `meshy-7.1` в нём вызвало бы отказ валидации.
 */
const MESHY_MODEL = "meshy-7.1";

/** Виды для multiview: порядок кадров в `images` = порядок в этом списке. */
const MULTIVIEW_VIEWS = ["front", "left", "back", "right"] as const;

/** Tripo принимает не больше четырёх видов; лишние кадры — ошибка входа. */
const MAX_IMAGES = MULTIVIEW_VIEWS.length;

/** Лимит одного изображения: столько же разрешает Tripo (`/v3/files`). */
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/** Лимит тела запроса: четыре фото в base64 и запас на JSON-обёртку. */
const MAX_REQUEST_BYTES = 96 * 1024 * 1024;

/** Загрузка фото в Tripo: файл небольшой, но сеть может подвиснуть. */
const UPLOAD_TIMEOUT_MS = 60_000;

/** Создание задачи отвечает быстро: очередь считается на стороне сети. */
const SUBMIT_TIMEOUT_MS = 30_000;

/** Сколько символов причины из чужого ответа попадает в сообщение об ошибке. */
const MAX_ERROR_DETAIL = 300;

/** Качество генерации: `standard` — дешевле, `ultra` — самое подробное. */
type Quality = "standard" | "ultra";

/** Сеть, которая создаёт задачу. */
type Provider = "tripo" | "meshy";

/** Разобранное фото: байты и тип, определённый по сигнатуре файла. */
type ParsedImage = {
  mime: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
  bytes: Buffer;
};

/** Ошибка провайдера: статус для клиента и текст причины для лога. */
class ProviderError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
  }
}

/** Ошибка в JSON: успешный ответ — только номер задачи. */
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

/** Успешный ответ: номер задачи, по которому клиент опрашивает статус. */
function taskResponse(taskId: string): Response {
  return Response.json(
    { taskId },
    {
      status: 200,
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    },
  );
}

/** JSON-объект без приведения типов: массивы и примитивы не подходят. */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Непустая строка или `undefined`: сети иногда кладут `null` вместо текста. */
function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : undefined;
}

/** Разбирает тело ответа, не падая на HTML от прокси. */
function parseJson(text: string): unknown {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** Причина отказа из ответа сети: сообщение, ошибка или сырой текст. */
function errorDetail(parsed: unknown, rawText: string): string {
  const body = asRecord(parsed);
  const message =
    toNonEmptyString(body?.message) ??
    toNonEmptyString(body?.error) ??
    toNonEmptyString(rawText);

  return (message ?? "ответ без описания").slice(0, MAX_ERROR_DETAIL);
}

/**
 * Тип изображения по сигнатуре файла: MIME из data URL доверять нельзя —
 * клиент может прислать одно расширение, а байты другого формата.
 */
function detectImageType(bytes: Buffer): ParsedImage | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { mime: "image/jpeg", extension: "jpg", bytes };
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { mime: "image/png", extension: "png", bytes };
  }

  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { mime: "image/webp", extension: "webp", bytes };
  }

  return null;
}

/** Только символы base64: мусор в строке не должен доходить до Buffer. */
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Разбирает изображение из тела запроса.
 *
 * Принимаются обе формы: чистый base64 и data URL (`data:image/png;base64,...`).
 * Заголовок data URL читается только для отделения префикса — тип всё равно
 * определяется по байтам.
 */
function parseImage(value: string): ParsedImage | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  let payload = trimmed;

  if (trimmed.startsWith("data:")) {
    const comma = trimmed.indexOf(",");

    if (comma < 0) {
      return null;
    }

    const header = trimmed.slice("data:".length, comma);

    if (!header.toLowerCase().includes(";base64")) {
      return null;
    }

    payload = trimmed.slice(comma + 1);
  }

  const compact = payload.replace(/\s+/g, "");

  if (!BASE64_PATTERN.test(compact)) {
    return null;
  }

  const bytes = Buffer.from(compact, "base64");

  if (bytes.length === 0) {
    return null;
  }

  return detectImageType(bytes);
}

/**
 * Качество: незнакомое значение отклоняется, отсутствующее считается
 * `standard` — это самый дешёвый путь роутера.
 */
function readQuality(value: unknown): Quality | null {
  if (value === undefined || value === null || value === "") {
    return "standard";
  }

  return value === "standard" || value === "ultra" ? value : null;
}

/**
 * Выбор сети по входу.
 *
 * Несколько фото умеет сопоставлять только Tripo (multiview), поэтому
 * `quality` на этот выбор не влияет; для одного фото ультра-качество даёт
 * Meshy, а обычное — дешёвая Tripo.
 */
function chooseProvider(imageCount: number, quality: Quality): Provider {
  if (imageCount > 1) {
    return "tripo";
  }

  return quality === "ultra" ? "meshy" : "tripo";
}

/**
 * Запрос к Tripo3D с разбором общего конверта `{ code, data, message }`.
 *
 * HTTP-ошибка и `code !== 0` при статусе 200 — одна и та же ошибка для
 * вызывающего: текст берётся из ответа, чтобы отказ валидации Tripo
 * («неверный размер изображения») не превращался в общее «сеть не ответила».
 */
async function tripoRequest(
  apiKey: string,
  path: string,
  init: RequestInit,
  timeoutMs: number,
  action: string,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response: Response;

    try {
      response = await fetch(`${TRIPO_BASE_URL}${path}`, {
        ...init,
        headers: { ...init.headers, authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      });
    } catch {
      throw new ProviderError(
        502,
        controller.signal.aborted
          ? `Tripo3D: ${action} заняла больше ${timeoutMs / 1000} с.`
          : `Tripo3D: ${action} не удалась — сеть недоступна.`,
      );
    }

    const text = await response.text();
    const parsed = parseJson(text);

    if (!response.ok) {
      throw new ProviderError(
        502,
        `Tripo3D: ${action} не удалась (HTTP ${response.status}): ` +
          errorDetail(parsed, text),
      );
    }

    const body = asRecord(parsed);
    const code = typeof body?.code === "number" ? body.code : 0;

    if (code !== 0) {
      throw new ProviderError(
        502,
        `Tripo3D: ${action} не удалась (код ${code}): ` +
          errorDetail(parsed, text),
      );
    }

    if (!body) {
      throw new ProviderError(502, `Tripo3D: ${action} вернула пустой ответ.`);
    }

    return asRecord(body.data) ?? body;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Загружает фото в Tripo3D и возвращает `file_token`.
 *
 * Задача v3 принимает файл только по токену или публичной ссылке, поэтому
 * base64 сначала превращается в multipart-загрузку полем `file`.
 */
async function uploadTripoImage(
  apiKey: string,
  image: ParsedImage,
): Promise<string> {
  const form = new FormData();

  form.append(
    "file",
    new Blob([new Uint8Array(image.bytes)], { type: image.mime }),
    `photo.${image.extension}`,
  );

  const data = await tripoRequest(
    apiKey,
    "/files",
    { method: "POST", body: form },
    UPLOAD_TIMEOUT_MS,
    "загрузка изображения",
  );

  const fileToken = toNonEmptyString(data.file_token);

  if (!fileToken) {
    throw new ProviderError(
      502,
      "Tripo3D: сервис не вернул file_token изображения.",
    );
  }

  return fileToken;
}

/** Номер задачи Tripo: `task_id` в `data`, без него задача не создана. */
function readTaskId(data: Record<string, unknown>): string {
  const taskId = toNonEmptyString(data.task_id);

  if (!taskId) {
    throw new ProviderError(502, "Tripo3D: сервис не вернул номер задачи.");
  }

  return taskId;
}

/** Одно фото: Tripo `image-to-model`, самая дешёвая задача без текстуры. */
async function createTripoImageTask(
  apiKey: string,
  image: ParsedImage,
): Promise<string> {
  const fileToken = await uploadTripoImage(apiKey, image);

  const data = await tripoRequest(
    apiKey,
    "/generation/image-to-model",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: fileToken,
        model: TRIPO_MODEL,
        texture: false,
        // Без этого флага PBR (по умолчанию включён) снова включает текстуру.
        pbr: false,
      }),
    },
    SUBMIT_TIMEOUT_MS,
    "создание задачи",
  );

  return readTaskId(data);
}

/**
 * Несколько фото: Tripo `multiview-to-model` с видами по порядку кадров.
 *
 * `inputs` в формате view-key: первый кадр — фронт (его сеть требует всегда),
 * дальше левый, задний и правый виды. Двух кадров достаточно, четыре — предел.
 */
async function createTripoMultiviewTask(
  apiKey: string,
  images: ParsedImage[],
): Promise<string> {
  const tokens = await Promise.all(
    images.map((image) => uploadTripoImage(apiKey, image)),
  );

  const inputs = tokens.map((fileToken, index) => ({
    [MULTIVIEW_VIEWS[index]]: fileToken,
  }));

  const data = await tripoRequest(
    apiKey,
    "/generation/multiview-to-model",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        inputs,
        model: TRIPO_MODEL,
        texture: false,
        pbr: false,
      }),
    },
    SUBMIT_TIMEOUT_MS,
    "создание задачи",
  );

  return readTaskId(data);
}

/**
 * Одно фото, ультра-качество: Meshy `image-to-3d`.
 *
 * Meshy принимает изображение как data URL, поэтому отдельной загрузки нет.
 * Ответ — `{ result: "<task_id>" }`.
 */
async function createMeshyTask(
  apiKey: string,
  image: ParsedImage,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);

  try {
    let response: Response;

    try {
      response = await fetch(`${MESHY_BASE_URL}/openapi/v1/image-to-3d`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          image_url: `data:${image.mime};base64,${image.bytes.toString(
            "base64",
          )}`,
          ai_model: MESHY_MODEL,
          should_texture: false,
        }),
        signal: controller.signal,
      });
    } catch {
      throw new ProviderError(
        502,
        controller.signal.aborted
          ? `Meshy: создание задачи заняло больше ${
              SUBMIT_TIMEOUT_MS / 1000
            } с.`
          : "Meshy: создание задачи не удалось — сеть недоступна.",
      );
    }

    const text = await response.text();
    const parsed = parseJson(text);

    if (!response.ok) {
      throw new ProviderError(
        502,
        `Meshy: создание задачи не удалось (HTTP ${response.status}): ` +
          errorDetail(parsed, text),
      );
    }

    const taskId = toNonEmptyString(asRecord(parsed)?.result);

    if (!taskId) {
      throw new ProviderError(502, "Meshy: сервис не вернул номер задачи.");
    }

    return taskId;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Создание задачи генерации 3D-модели по фото.
 *
 * Порядок проверок:
 *   1. сессия — без неё 401, тело даже не разбирается;
 *   2. тело — JSON с массивом `images` (base64 или data URL) и `quality`;
 *   3. каждый кадр — настоящий JPEG, PNG или WebP до 20 МБ;
 *   4. ключ выбранной сети — без него 503, платный запрос не отправляется;
 *   5. кредиты `user_credits` — 0 даёт 402, недоступный счётчик — 503; кредит
 *      списывается здесь же, до вызова сети;
 *   6. создание задачи — и сразу ответ `{ taskId }`, без ожидания модели.
 *      Отказ сети возвращает кредит и отвечает 502.
 */
export async function POST(request: Request): Promise<Response> {
  // Сессия — первая проверка: без неё платный запрос не должен даже
  // разбираться, иначе гость получал бы 400 вместо честного 401.
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

  const declaredLength = Number(request.headers.get("content-length"));

  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_REQUEST_BYTES
  ) {
    return errorResponse(
      413,
      "Фото слишком большие. Сожмите кадры и попробуйте снова.",
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(
      400,
      "Тело запроса должно быть JSON: { images: string[], quality }.",
    );
  }

  const payload = asRecord(body);

  if (!payload) {
    return errorResponse(
      400,
      "Тело запроса должно быть JSON: { images: string[], quality }.",
    );
  }

  const quality = readQuality(payload.quality);

  if (!quality) {
    return errorResponse(
      400,
      "Параметр quality принимает только standard или ultra.",
    );
  }

  const rawImages = payload.images;

  if (!Array.isArray(rawImages) || rawImages.length === 0) {
    return errorResponse(
      400,
      "Передайте хотя бы одно фото в массиве images в base64.",
    );
  }

  if (rawImages.length > MAX_IMAGES) {
    return errorResponse(
      400,
      `Многовидовая генерация принимает не больше ${MAX_IMAGES} фото.`,
    );
  }

  const images: ParsedImage[] = [];

  for (const raw of rawImages) {
    if (typeof raw !== "string") {
      return errorResponse(400, "Каждое фото в images должно быть строкой.");
    }

    const image = parseImage(raw);

    if (!image) {
      return errorResponse(
        400,
        "Фото не разобрано. Ожидается base64 или data URL с JPEG, PNG или WebP.",
      );
    }

    if (image.bytes.length > MAX_IMAGE_BYTES) {
      return errorResponse(
        413,
        "Фото больше 20 МБ. Сожмите его и попробуйте снова.",
      );
    }

    images.push(image);
  }

  const provider = chooseProvider(images.length, quality);
  const keyName = provider === "meshy" ? "MESHY_API_KEY" : "TRIPO_API_KEY";
  const apiKey = process.env[keyName]?.trim();

  if (!apiKey) {
    return errorResponse(
      503,
      `Генерация 3D временно недоступна: не задан ${keyName}.`,
    );
  }

  const credits = await getUserCredits(user.id);

  // `null` — счётчик недоступен, а не «0 кредитов»: 402 из-за сбоя базы
  // отправил бы человека пополнять баланс, который на самом деле есть.
  if (credits === null) {
    return errorResponse(
      503,
      "Не удалось проверить кредиты. Попробуйте позже.",
    );
  }

  if (credits <= 0) {
    return errorResponse(
      402,
      "Кредиты закончились. Одна генерация списывает один кредит.",
    );
  }

  // Списываем до платного запроса: иначе две вкладки успели бы создать две
  // задачи, а баланс остался бы прежним. Отказ сети вернёт кредит ниже.
  if (!(await deductCredit(user.id))) {
    return errorResponse(
      402,
      "Кредиты закончились. Одна генерация списывает один кредит.",
    );
  }

  try {
    const taskId =
      provider === "meshy"
        ? await createMeshyTask(apiKey, images[0])
        : images.length > 1
          ? await createTripoMultiviewTask(apiKey, images)
          : await createTripoImageTask(apiKey, images[0]);

    console.info(
      "[generate-3d] Задача создана:",
      provider,
      quality,
      images.length,
      "фото",
      taskId,
    );

    return taskResponse(taskId);
  } catch (error) {
    // Задача не создана — платного запроса не было, значит и кредита быть не
    // должно. Возврат пишем в лог: он не должен скрыть исходную ошибку.
    if (!(await refundCredit(user.id))) {
      console.error(
        "[generate-3d] Не удалось вернуть кредит после отказа сети.",
      );
    }

    if (error instanceof ProviderError) {
      console.error("[generate-3d] Отказ сети:", error.message);

      return errorResponse(error.status, error.message);
    }

    console.error("[generate-3d] Неожиданная ошибка:", error);

    return errorResponse(
      502,
      "Не удалось создать задачу генерации. Попробуйте позже.",
    );
  }
}
