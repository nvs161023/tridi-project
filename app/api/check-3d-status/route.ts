import path from "node:path";

import { after } from "next/server";

import {
  MeshFixerError,
  processGeneratedMesh,
} from "@/lib/constructor/mesh-fixer";
import { saveGenerationStl } from "@/lib/generator/generation-store";

/**
 * Опрос задачи генерации 3D и постобработка готовой модели.
 *
 * `/api/generate-3d` только создаёт задачу и отдаёт `taskId` — генерация идёт
 * минуты, поэтому клиент опрашивает этот роут:
 *
 *   GET /api/check-3d-status?taskId=<номер>&service=tripo|meshy
 *
 * Ответ всегда одной формы:
 *
 *   `{ status: "processing", progress }`          — задача ещё считается;
 *   `{ status: "failed", progress, error }`       — сеть отказала;
 *   `{ status: "success", progress, modelUrl }`   — готовая модель.
 *
 * На `success` поле `modelUrl` ведёт уже не на GLB, а на собранный STL:
 * модель скачивается и проходит «мясорубку» (`processGeneratedMesh`) — сварка
 * вершин, децимация до ~100 000 треугольников и масштаб 120 мм по самому
 * большому габариту. Ссылка отдаётся роутом `/api/generated-stl/[file]`.
 *
 * Собранный файл сразу копируется в закрытый бакет `generated-models`, а путь
 * записывается в строку задачи (`saveGenerationStl`). Делается это через
 * `after()`: загрузка не задерживает ответ, а временная папка «мясорубки»
 * после перезапуска контейнера пустеет — без копии модель пропала бы из
 * истории.
 *
 * Tripo отвечает конвертом `{ code, data }` (статус и прогресс внутри `data`),
 * Meshy — плоским объектом, где ссылка на GLB лежит в `model_urls.glb`.
 * Ошибка сети или отказ API превращается в 502: клиент не должен путать наш
 * сбой с честным `failed` самой задачи.
 */
export const runtime = "nodejs";

/** Ответ зависит от внешней сети и ключей окружения — кэшировать нельзя. */
export const dynamic = "force-dynamic";

/** Постобработка GLB на первом успешном опросе может занять минуты. */
export const maxDuration = 300;

/** Боевой адрес Tripo3D v3: домен `.ai`, а не `.com` из черновика ТЗ. */
const TRIPO_BASE_URL = "https://openapi.tripo3d.ai/v3";

/** Адрес Meshy: `/openapi/v1/...` — часть пути, как в документации. */
const MESHY_BASE_URL = "https://api.meshy.ai";

/** Один опрос статуса — короткий запрос, ответ не ждёт генерации. */
const POLL_TIMEOUT_MS = 30_000;

/** Сколько символов ответа API показываем в тексте ошибки. */
const MAX_ERROR_DETAIL = 300;

/** Статусы Tripo, после которых задача уже не изменится. */
const TRIPO_FAILED_STATUSES = new Set([
  "failed",
  "error",
  "cancelled",
  "canceled",
  "banned",
  "expired",
  "unknown",
]);

/** Статусы Meshy, после которых задача уже не изменится. */
const MESHY_FAILED_STATUSES = new Set([
  "failed",
  "expired",
  "canceled",
  "cancelled",
]);

/** Статус, который видит клиент. */
type PublicStatus = "processing" | "success" | "failed";

/** Разобранный ответ сети: статус, прогресс и ссылка на GLB при успехе. */
type PollResult = {
  status: PublicStatus;
  progress: number;
  modelUrl?: string;
  error?: string;
};

/** Ошибка сети: статус для клиента и текст причины для лога. */
class StatusError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "StatusError";
    this.status = status;
  }
}

/** JSON-объект без приведения типов: массивы и примитивы не подходят. */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Непустая строка или `undefined`: API иногда кладёт `null` вместо текста. */
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

/** Прогресс задачи: число 0–100, всё остальное — запасное значение. */
function readProgress(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

/** Ответ клиенту: статус задачи, прогресс и ссылка на модель. */
function statusResponse(result: PollResult): Response {
  return Response.json(
    {
      status: result.status,
      progress: result.progress,
      ...(result.modelUrl ? { modelUrl: result.modelUrl } : {}),
      ...(result.error ? { error: result.error } : {}),
    },
    {
      status: 200,
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    },
  );
}

/** Ошибка входа или сети: JSON с причиной и запретом кэша. */
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

/**
 * Запрос статуса к сети с Bearer-ключом.
 *
 * Ключ прикладывается только к API провайдера: ссылки на готовые GLB уже
 * подписаны, и лишний заголовок чужое хранилище может отклонить.
 */
async function fetchProvider(
  url: string,
  apiKey: string,
  label: string,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), POLL_TIMEOUT_MS);

  try {
    let response: Response;

    try {
      response = await fetch(url, {
        method: "GET",
        headers: { authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
        // `cache` здесь не передаём: в dev-сервере Next патченный fetch с явным
        // `cache` на внешнем запросе зависает до таймаута и рвёт соединение.
        // Роут и так `force-dynamic`, кэшировать ответ некому.
      });
    } catch {
      throw new StatusError(
        502,
        controller.signal.aborted
          ? `${label}: статус не получен за ${POLL_TIMEOUT_MS / 1000} с.`
          : `${label}: статус не получен — сеть недоступна.`,
      );
    }

    let text: string;

    try {
      text = await response.text();
    } catch {
      throw new StatusError(
        502,
        controller.signal.aborted
          ? `${label}: статус не получен за ${POLL_TIMEOUT_MS / 1000} с.`
          : `${label}: не удалось прочитать ответ сети.`,
      );
    }

    const parsed = parseJson(text);

    if (!response.ok) {
      throw new StatusError(
        502,
        `${label}: запрос статуса не удался (HTTP ${response.status}): ` +
          errorDetail(parsed, text),
      );
    }

    const body = asRecord(parsed);

    if (!body) {
      throw new StatusError(502, `${label}: сервис вернул пустой ответ.`);
    }

    return body;
  } finally {
    clearTimeout(timer);
  }
}

/** Ссылка на GLB из вывода Tripo: разные модели кладут её в разные поля. */
function extractTripoModelUrl(
  task: Record<string, unknown>,
): string | undefined {
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

/** Ссылка на GLB из ответа Meshy: основное поле — `model_urls.glb`. */
function extractMeshyModelUrl(
  task: Record<string, unknown>,
): string | undefined {
  const modelUrls = asRecord(task.model_urls);

  return (
    toNonEmptyString(modelUrls?.glb) ??
    toNonEmptyString(task.model_url) ??
    toNonEmptyString(task.glb_url)
  );
}

/** Читает задачу Tripo: конверт `{ code, data }` и статусы queued/running. */
async function pollTripo(apiKey: string, taskId: string): Promise<PollResult> {
  const envelope = await fetchProvider(
    `${TRIPO_BASE_URL}/tasks/${encodeURIComponent(taskId)}`,
    apiKey,
    "Tripo3D",
  );
  const code = typeof envelope.code === "number" ? envelope.code : 0;
  const data = asRecord(envelope.data);

  if (code !== 0 || !data) {
    throw new StatusError(
      502,
      `Tripo3D: запрос статуса не удался` +
        `${code !== 0 ? ` (код ${code})` : ""}: ${errorDetail(envelope, "")}`,
    );
  }

  const status = toNonEmptyString(data.status)?.toLowerCase();

  if (!status) {
    throw new StatusError(
      502,
      "Tripo3D: ответ статуса не содержит поле status.",
    );
  }

  if (status === "success") {
    const modelUrl = extractTripoModelUrl(data);

    if (!modelUrl) {
      return {
        status: "failed",
        progress: 100,
        error: "Tripo3D: задача завершена, но ссылки на модель нет.",
      };
    }

    return { status: "success", progress: 100, modelUrl };
  }

  const progress = readProgress(data.progress, 0);

  if (TRIPO_FAILED_STATUSES.has(status)) {
    const details =
      toNonEmptyString(data.error_message) ??
      toNonEmptyString(data.message) ??
      toNonEmptyString(data.error) ??
      `задача завершилась со статусом «${status}»`;

    return { status: "failed", progress, error: `Tripo3D: ${details}` };
  }

  // queued, running и любые новые промежуточные статусы — ждём дальше.
  return { status: "processing", progress };
}

/** Читает задачу Meshy: плоский объект со статусом и `model_urls`. */
async function pollMeshy(apiKey: string, taskId: string): Promise<PollResult> {
  const task = await fetchProvider(
    `${MESHY_BASE_URL}/openapi/v1/image-to-3d/${encodeURIComponent(taskId)}`,
    apiKey,
    "Meshy",
  );

  const status = toNonEmptyString(task.status)?.toLowerCase();

  if (!status) {
    throw new StatusError(502, "Meshy: ответ статуса не содержит поле status.");
  }

  const progress = readProgress(task.progress, 0);

  if (status === "succeeded" || status === "success") {
    const modelUrl = extractMeshyModelUrl(task);

    if (!modelUrl) {
      return {
        status: "failed",
        progress: 100,
        error: "Meshy: задача завершена, но ссылки на GLB нет.",
      };
    }

    return { status: "success", progress: 100, modelUrl };
  }

  if (MESHY_FAILED_STATUSES.has(status)) {
    const taskError = asRecord(task.task_error);
    const details =
      toNonEmptyString(taskError?.message) ??
      toNonEmptyString(task.task_error) ??
      `задача завершилась со статусом «${status}»`;

    return { status: "failed", progress, error: `Meshy: ${details}` };
  }

  return { status: "processing", progress };
}

/**
 * GET /api/check-3d-status?taskId=<номер>&service=tripo|meshy
 *
 * На первом успешном опросе модель проходит постобработку. Всё, что после
 * этого может пойти не так (битый GLB, пустая сетка), возвращается как 502 с
 * понятным текстом: клиент показывает его вместо бесконечного «обрабатываем».
 */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const taskId = params.get("taskId")?.trim() ?? "";
  const service = params.get("service");

  if (!taskId) {
    return errorResponse(400, "Передайте номер задачи в параметре taskId.");
  }

  if (service !== "tripo" && service !== "meshy") {
    return errorResponse(
      400,
      "Параметр service принимает только tripo или meshy.",
    );
  }

  // Ключ нужен только для опроса: ссылки на готовые модели подписаны.
  const keyName = service === "tripo" ? "TRIPO_API_KEY" : "MESHY_API_KEY";
  const apiKey = process.env[keyName]?.trim();

  if (!apiKey) {
    console.error(`[check-3d-status] Не задан ${keyName}.`);

    return errorResponse(
      503,
      `Проверка статуса недоступна: не задан ${keyName}.`,
    );
  }

  try {
    const result =
      service === "tripo"
        ? await pollTripo(apiKey, taskId)
        : await pollMeshy(apiKey, taskId);

    // Задача ещё считается или уже провалилась — отдаём статус как есть.
    if (result.status !== "success" || !result.modelUrl) {
      return statusResponse(result);
    }

    const stlPath = await processGeneratedMesh(result.modelUrl);

    console.info(
      "[check-3d-status] Модель обработана:",
      service,
      taskId,
      "→",
      path.basename(stlPath),
    );

    // Файл лежит во временной папке до перезапуска контейнера: копируем его в
    // бакет после ответа, чтобы загрузка не задерживала последний опрос.
    // Внутри ошибки только логируются — история не должна ломать генерацию.
    after(saveGenerationStl({ taskId, filePath: stlPath }));

    return statusResponse({
      status: "success",
      progress: 100,
      modelUrl: `/api/generated-stl/${path.basename(stlPath)}`,
    });
  } catch (error) {
    if (error instanceof StatusError) {
      console.error("[check-3d-status]", service, taskId, error.message);

      return errorResponse(error.status, error.message);
    }

    if (error instanceof MeshFixerError) {
      console.error(
        "[check-3d-status] Постобработка не удалась:",
        service,
        taskId,
        error.message,
      );

      return errorResponse(502, error.message);
    }

    console.error("[check-3d-status] Неизвестная ошибка:", error);

    return errorResponse(
      502,
      "Не удалось проверить статус задачи. Попробуйте позже.",
    );
  }
}

