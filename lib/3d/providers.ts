/**
 * Провайдеры генерации 3D-модели по фотографии.
 *
 * Роут `/api/3d/generate` пока работает напрямую с Gen API, но цена и
 * надёжность у сетей разные. Чтобы переключение не превращалось в правку
 * роута, каждая сеть прячется за одним интерфейсом: отправить фото, узнать
 * статус задачи и скачать готовый файл. Конкретные поля запроса остаются
 * внутри провайдера — снаружи видно только `taskId`, `status` и `modelUrl`.
 *
 * Tripo3D работает через v3 REST API. В отличие от Gen API, base64 в теле
 * задачи он не принимает: фото сначала загружается multipart-запросом в
 * `/v3/files`, а задача получает выданный `file_token`. Ссылка на модель
 * живёт недолго (по документации около пяти минут), поэтому скачивать её
 * нужно сразу после статуса `success`.
 */
import { Buffer } from "node:buffer";

/** Провайдеры, между которыми можно переключаться. */
export type ProviderName = "tripo3d" | "stability" | "genapi";

/** Состояние задачи в общем для всех провайдеров виде. */
export type GenerationStatus = "pending" | "success" | "failed";

/** Результат одного опроса задачи. */
export type GenerationPollResult = {
  status: GenerationStatus;
  /** Постоянная или временная ссылка на GLB; есть только при `success`. */
  modelUrl?: string;
  /** Причина отказа; есть только при `failed`. */
  error?: string;
};

/**
 * Параметры отправки задачи.
 *
 * Набор полей зависит от провайдера, поэтому общий интерфейс не пытается их
 * перечислить. `Tripo3DProvider` принимает имена полей v3 API: `model`,
 * `texture`, `pbr`, `texture_quality`, `geometry_quality`, `face_limit` и
 * другие. Поле `input` провайдер заполняет сам — переданное значение будет
 * заменено на `file_token` загруженного изображения.
 */
export type GenerationOptions = Record<string, unknown>;

/** Один провайдер генерации: отправка, опрос и скачивание результата. */
export interface GenerationProvider {
  /** Имя провайдера, например `tripo3d`. */
  name: ProviderName;

  /** Отправляет изображение и возвращает номер созданной задачи. */
  submit(
    imageBuffer: Buffer,
    options?: GenerationOptions,
  ): Promise<{ taskId: string }>;

  /**
   * Читает состояние задачи. `pending` значит «ещё считает», а не ошибку:
   * вызывающий сам решает, сколько раз и с какой паузой опрашивать.
   */
  poll(taskId: string): Promise<GenerationPollResult>;

  /** Скачивает готовый файл по ссылке из `poll`. */
  download(modelUrl: string): Promise<Buffer>;
}

/** Боевой адрес Tripo3D v3 для всех стран, кроме Китая. */
const TRIPO3D_BASE_URL = "https://openapi.tripo3d.ai/v3";

/**
 * Модель Tripo3D по умолчанию.
 *
 * `v3.1-20260211` — актуальная H3.1 на момент подключения. Поле в API
 * называется `model` (не `model_version`), и без него задача отклоняется.
 */
const TRIPO3D_DEFAULT_MODEL = "v3.1-20260211";

/** Tripo3D принимает изображения до 10 МБ, как и роут генерации. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Загрузка фото: файл небольшой, но сеть может подвиснуть. */
const UPLOAD_TIMEOUT_MS = 60_000;

/** Создание задачи отвечает быстро: очередь считается на стороне Tripo3D. */
const SUBMIT_TIMEOUT_MS = 30_000;

/** Один опрос статуса — короткий запрос, ответ не ждёт генерации. */
const POLL_TIMEOUT_MS = 30_000;

/** Скачивание GLB из чужого облака: модель может весить десятки мегабайт. */
const DOWNLOAD_TIMEOUT_MS = 120_000;

/** Предел модели: столько же разрешает бакет `3d-models` в Supabase. */
const MAX_MODEL_BYTES = 50 * 1024 * 1024;

/** Сколько символов ответа API показываем в тексте ошибки. */
const MAX_ERROR_DETAIL = 300;

/** Форматы, которые Tripo3D принимает на вход. */
type ImageType = { mime: string; extension: string };

/** Статусы Tripo3D, после которых задача уже не изменится. */
const FAILED_STATUSES = new Set([
  "failed",
  "error",
  "cancelled",
  "canceled",
  "banned",
  "expired",
  "unknown",
]);

/** Настройки провайдера: ключ и адрес можно подменить в тестах. */
export type Tripo3DProviderConfig = {
  /** По умолчанию берётся из `TRIPO3D_API_KEY`. */
  apiKey?: string;
  /** По умолчанию — глобальный `https://openapi.tripo3d.ai/v3`. */
  baseUrl?: string;
};

/**
 * Tripo3D v3: загрузка фото в `/files`, задача `image-to-model`, опрос
 * `/tasks/{id}`.
 *
 * Ключ читается в конструкторе, но ошибка выдаётся при первом запросе: модуль
 * можно импортировать в сборке, где секрета ещё нет, и он не упадёт на этапе
 * загрузки. Ключ никогда не отправляется при скачивании модели — ссылка на
 * файл уже подписана, а лишний заголовок чужое хранилище отклоняет.
 */
export class Tripo3DProvider implements GenerationProvider {
  readonly name = "tripo3d" as const;

  readonly #apiKey: string;
  readonly #baseUrl: string;

  constructor(config: Tripo3DProviderConfig = {}) {
    this.#apiKey =
      config.apiKey?.trim() || process.env.TRIPO3D_API_KEY?.trim() || "";
    this.#baseUrl = (config.baseUrl ?? TRIPO3D_BASE_URL).replace(/\/+$/, "");
  }

  /** Загружает фото, создаёт задачу и возвращает её номер. */
  async submit(
    imageBuffer: Buffer,
    options: GenerationOptions = {},
  ): Promise<{ taskId: string }> {
    const image = detectImageType(imageBuffer);

    if (!image) {
      throw new Error(
        "Tripo3D: поддерживаются только изображения JPEG, PNG и WebP.",
      );
    }

    if (imageBuffer.length === 0 || imageBuffer.length > MAX_IMAGE_BYTES) {
      throw new Error(
        `Tripo3D: изображение должно весить от 1 байта до ${
          MAX_IMAGE_BYTES / 1024 / 1024
        } МБ.`,
      );
    }

    const requestedModel = toNonEmptyString(options.model);

    if (options.model !== undefined && !requestedModel) {
      throw new Error("Tripo3D: параметр model должен быть непустой строкой.");
    }

    const fileToken = await this.#uploadImage(imageBuffer, image);
    const payload = { ...options };

    // Эти поля относятся к загрузке или к чужому формату. Оставлять их в
    // теле задачи нельзя: `input` должен указывать на наш file_token, а
    // `model_version` v3 не знает — поле называется `model`.
    delete payload.input;
    delete payload.file;
    delete payload.file_token;
    delete payload.url;
    delete payload.model_version;
    delete payload.modelVersion;

    payload.input = fileToken;
    payload.model = requestedModel ?? TRIPO3D_DEFAULT_MODEL;

    // Печать важнее текстуры, но по умолчанию оставляем текстуру включённой:
    // вызывающий может отключить её через `{ texture: false }`, чтобы не
    // платить за лишний проход.
    if (payload.texture === undefined) {
      payload.texture = true;
    }

    const body = await this.#requestJson(
      "/generation/image-to-model",
      {
        method: "POST",
        headers: {
          ...this.#authHeaders(),
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      },
      SUBMIT_TIMEOUT_MS,
      "создание задачи",
    );

    const taskId = toNonEmptyString(body.task_id);

    if (!taskId) {
      throw new Error("Tripo3D: сервис не вернул номер задачи.");
    }

    return { taskId };
  }

  /** Читает статус задачи и достаёт ссылку на модель. */
  async poll(taskId: string): Promise<GenerationPollResult> {
    if (!taskId.trim()) {
      throw new Error("Tripo3D: номер задачи не может быть пустым.");
    }

    const body = await this.#requestJson(
      `/tasks/${encodeURIComponent(taskId)}`,
      { method: "GET", headers: this.#authHeaders() },
      POLL_TIMEOUT_MS,
      "чтение статуса",
    );

    const status = toNonEmptyString(body.status)?.toLowerCase();

    if (!status) {
      throw new Error("Tripo3D: ответ статуса не содержит поле status.");
    }

    if (status === "success") {
      const modelUrl = extractModelUrl(body);

      if (!modelUrl) {
        return {
          status: "failed",
          error: "Tripo3D: задача завершена, но ссылки на модель нет.",
        };
      }

      return { status: "success", modelUrl };
    }

    if (FAILED_STATUSES.has(status)) {
      const details =
        toNonEmptyString(body.error_message) ??
        toNonEmptyString(body.message) ??
        toNonEmptyString(body.error) ??
        `задача завершилась со статусом «${status}»`;

      return { status: "failed", error: `Tripo3D: ${details}` };
    }

    // queued, running и любые новые промежуточные статусы — ждём дальше.
    return { status: "pending" };
  }

  /** Скачивает готовую модель. Ключ API к чужому URL не прикладывается. */
  async download(modelUrl: string): Promise<Buffer> {
    let url: URL;

    try {
      url = new URL(modelUrl);
    } catch {
      throw new Error("Tripo3D: ссылка на модель имеет неверный формат.");
    }

    if (url.protocol !== "https:") {
      throw new Error(
        "Tripo3D: ссылка на модель должна начинаться с https://.",
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Tripo3D: не удалось скачать модель (HTTP ${response.status}).`,
        );
      }

      const contentType = response.headers.get("content-type")?.toLowerCase();

      // Вместо GLB по ссылке может прийти страница ошибки или JSON с
      // описанием отказа. Такой ответ нельзя отдавать как модель.
      if (
        contentType?.includes("text/html") ||
        contentType?.includes("application/json")
      ) {
        throw new Error(
          `Tripo3D: по ссылке пришёл не файл модели (${contentType}).`,
        );
      }

      const declaredLength = Number(response.headers.get("content-length"));

      if (Number.isFinite(declaredLength) && declaredLength > MAX_MODEL_BYTES) {
        throw new Error(
          `Tripo3D: модель больше ${MAX_MODEL_BYTES / 1024 / 1024} МБ.`,
        );
      }

      const bytes = Buffer.from(await response.arrayBuffer());

      if (bytes.length === 0) {
        throw new Error("Tripo3D: сервис вернул пустой файл модели.");
      }

      if (bytes.length > MAX_MODEL_BYTES) {
        throw new Error(
          `Tripo3D: модель больше ${MAX_MODEL_BYTES / 1024 / 1024} МБ.`,
        );
      }

      return bytes;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error("Tripo3D: скачивание модели заняло больше 120 с.");
      }

      if (error instanceof Error) {
        throw error;
      }

      throw new Error("Tripo3D: не удалось скачать модель.");
    } finally {
      clearTimeout(timer);
    }
  }

  /** Загружает изображение в Tripo3D и возвращает `file_token`. */
  async #uploadImage(
    imageBuffer: Buffer,
    image: ImageType,
  ): Promise<string> {
    const form = new FormData();
    const bytes = new Uint8Array(imageBuffer);

    form.append(
      "file",
      new Blob([bytes], { type: image.mime }),
      `photo.${image.extension}`,
    );

    const body = await this.#requestJson(
      "/files",
      {
        method: "POST",
        headers: this.#authHeaders(),
        body: form,
      },
      UPLOAD_TIMEOUT_MS,
      "загрузка изображения",
    );

    const fileToken = toNonEmptyString(body.file_token);

    if (!fileToken) {
      throw new Error("Tripo3D: сервис не вернул file_token изображения.");
    }

    return fileToken;
  }

  /** Заголовок авторизации: без ключа не начинаем платный запрос. */
  #authHeaders(): Record<string, string> {
    if (!this.#apiKey) {
      throw new Error(
        "Tripo3D: не задан TRIPO3D_API_KEY — генерация недоступна.",
      );
    }

    return { authorization: `Bearer ${this.#apiKey}` };
  }

  /**
   * Запрос к API и разбор стандартного конверта `{ code, data, message }`.
   *
   * HTTP-ошибка и `code !== 0` при статусе 200 — одна и та же ошибка для
   * вызывающего: текст сообщения берётся из ответа, чтобы отказ валидации
   * Tripo3D («неверный размер изображения») не превращался в общее «сервис
   * не ответил».
   */
  async #requestJson(
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
        response = await fetch(`${this.#baseUrl}${path}`, {
          ...init,
          signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          throw new Error(
            `Tripo3D: ${action} не завершилась за ${timeoutMs / 1000} с.`,
          );
        }

        const reason =
          error instanceof Error ? error.message : "сетевая ошибка";

        throw new Error(`Tripo3D: ${action} не удалась — ${reason}.`);
      }

      let text: string;

      try {
        text = await response.text();
      } catch (error) {
        if (controller.signal.aborted) {
          throw new Error(
            `Tripo3D: ${action} не завершилась за ${timeoutMs / 1000} с.`,
          );
        }

        const reason =
          error instanceof Error ? error.message : "сетевая ошибка";

        throw new Error(`Tripo3D: ${action} не удалась — ${reason}.`);
      }

      const parsed = parseJson(text);

      if (!response.ok) {
        throw new Error(formatApiError(action, response.status, parsed, text));
      }

      const envelope = asRecord(parsed);

      if (!envelope) {
        throw new Error(`Tripo3D: ${action} вернула пустой ответ.`);
      }

      const code = typeof envelope.code === "number" ? envelope.code : 0;

      if (code !== 0) {
        throw new Error(formatApiError(action, response.status, parsed, text));
      }

      return asRecord(envelope.data) ?? envelope;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Тип изображения по сигнатуре файла: MIME от браузера доверять нельзя. */
function detectImageType(bytes: Buffer): ImageType | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { mime: "image/jpeg", extension: "jpg" };
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
    return { mime: "image/png", extension: "png" };
  }

  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { mime: "image/webp", extension: "webp" };
  }

  return null;
}

/** Непустая строка или `undefined`: API иногда кладёт `null` вместо текста. */
function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : undefined;
}

/** JSON-объект без приведения типов. */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
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

/** Текст ошибки с кодом и подсказкой Tripo3D, если они есть. */
function formatApiError(
  action: string,
  status: number,
  parsed: unknown,
  rawText: string,
): string {
  const body = asRecord(parsed);
  const message =
    toNonEmptyString(body?.message) ??
    toNonEmptyString(body?.error) ??
    toNonEmptyString(rawText);
  const suggestion = toNonEmptyString(body?.suggestion);
  const code = typeof body?.code === "number" ? body.code : undefined;
  const details = [message, suggestion].filter(Boolean).join(" ");

  const prefix = `Tripo3D: ${action} не удалась (HTTP ${status}${
    code !== undefined ? `, код ${code}` : ""
  })`;

  if (!details) {
    return `${prefix}.`;
  }

  return `${prefix}: ${details.slice(0, MAX_ERROR_DETAIL)}`;
}

/** Первая непустая ссылка из вывода задачи. */
function extractModelUrl(task: Record<string, unknown>): string | undefined {
  const output = asRecord(task.output);
  const modelUrls = Array.isArray(output?.model_urls)
    ? output.model_urls
    : [];

  return (
    toNonEmptyString(output?.model_url) ??
    toNonEmptyString(output?.pbr_model) ??
    toNonEmptyString(output?.base_model) ??
    toNonEmptyString(output?.model) ??
    toNonEmptyString(modelUrls[0]) ??
    toNonEmptyString(task.model_url)
  );
}
