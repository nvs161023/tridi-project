import { hasActiveSubscription } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { INVOICE_OCR_PROMPT, parseInvoiceItems } from "@/lib/workshop/ocr";

/** Buffer и cookies Supabase доступны только в Node.js. */
export const runtime = "nodejs";

/** Ответ зависит от cookies и ключа OpenAI, кэшировать его нельзя. */
export const dynamic = "force-dynamic";

/** Распознавание фото занимает десятки секунд — даём модели время. */
export const maxDuration = 60;

/** Модель с поддержкой изображений. */
const OPENAI_MODEL = "gpt-4o";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

/** Таймаут запроса к OpenAI: зависший запрос не должен держать роут. */
const OPENAI_TIMEOUT_MS = 45_000;

/** Лимит фото: data URL в base64 весит больше исходного файла. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Форматы, которые принимает OpenAI Vision. */
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** Ошибка в JSON: успешный ответ — массив материалов. */
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

/** Минимальная форма ответа Chat Completions, которая нужна роуту. */
type OpenAiResponse = {
  choices?: { message?: { content?: unknown } }[];
  error?: { message?: unknown };
};

/**
 * Распознавание накладной по фото.
 *
 * Порядок проверок:
 *   1. `OPENAI_API_KEY` — без ключа 503 «OCR временно недоступен»;
 *   2. сессия — `getUser()`, потому что `/api/*` не покрыт middleware;
 *   3. `hasActiveSubscription()` — OCR входит в пакет «Всё включено»;
 *   4. файл из multipart-поля `file`: формат и размер;
 *   5. запрос к OpenAI и проверка JSON-массива.
 *
 * Ключ проверяется первым: без него роут не обращается ни к Supabase, ни к
 * OpenAI, поэтому сборка и локальный запуск без настроек не падают.
 */
export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return errorResponse(503, "OCR временно недоступен");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse(401, "Войдите в аккаунт, чтобы распознать накладную.");
  }

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return errorResponse(403, "Импорт остатков входит в пакет «Всё включено».");
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
    return errorResponse(400, "Прикрепите фото накладной полем file.");
  }

  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return errorResponse(
      415,
      "Поддерживаются изображения JPEG, PNG, WebP и GIF.",
    );
  }

  if (file.size === 0) {
    return errorResponse(400, "Файл пустой. Прикрепите другое фото.");
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return errorResponse(413, "Фото больше 10 МБ. Сожмите его и попробуйте снова.");
  }

  const image = Buffer.from(await file.arrayBuffer()).toString("base64");
  const imageUrl = `data:${file.type};base64,${image}`;

  let openaiResponse: Response;

  try {
    openaiResponse = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0,
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: INVOICE_OCR_PROMPT },
              { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
            ],
          },
        ],
      }),
      // Ответ не кэшируем и не даём запросу висеть дольше таймаута.
      cache: "no-store",
      signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("OpenAI OCR: запрос не выполнен:", error);
    return errorResponse(502, "Не удалось распознать накладную");
  }

  if (!openaiResponse.ok) {
    // Тело ошибки полезно в логе, но наружу уходит только понятный текст.
    const details = await openaiResponse.text().catch(() => "");

    console.error(
      "OpenAI OCR: ответ",
      openaiResponse.status,
      details.slice(0, 300),
    );

    return errorResponse(502, "Не удалось распознать накладную");
  }

  let payload: OpenAiResponse;

  try {
    payload = (await openaiResponse.json()) as OpenAiResponse;
  } catch (error) {
    console.error("OpenAI OCR: ответ не разобран как JSON:", error);
    return errorResponse(502, "Не удалось распознать накладную");
  }

  const content = payload.choices?.[0]?.message?.content;
  const items = typeof content === "string" ? parseInvoiceItems(content) : null;

  if (!items) {
    console.warn("OpenAI OCR: модель вернула не JSON-массив материалов.");
    return errorResponse(502, "Не удалось распознать накладную");
  }

  return Response.json(items, {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
