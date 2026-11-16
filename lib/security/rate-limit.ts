/**
 * Простой in-memory rate limiter для API-роутов.
 *
 * Это фиксированное окно на процесс: ключ (пользователь или IP) получает не
 * больше `limit` запросов за `windowMs`. Такой лимитер не требует внешнего
 * сервиса и подходит как первый барьер от случайных и параллельных запросов.
 *
 * Важное ограничение: на нескольких инстансах у каждого свои счётчики, а при
 * перезапуске процесса окна сбрасываются. Для строгого глобального лимита нужен
 * Redis/Upstash; в проекте его нет, поэтому здесь сознательно оставлена простая
 * реализация без новой зависимости.
 */

type Bucket = {
  count: number;
  resetAt: number;
};

/** Потолок словаря: старые ключи не должны копиться бесконечно. */
const MAX_BUCKETS = 10_000;

const buckets = new Map<string, Bucket>();

export type RateLimitOptions = {
  /** Сколько запросов разрешено в окне. */
  limit: number;
  /** Длина окна в миллисекундах. */
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Секунды до сброса окна — для заголовка Retry-After. */
  retryAfterSeconds: number;
};

/** Удаляет просроченные окна, когда словарь подходит к потолку. */
function prune(now: number): void {
  if (buckets.size < MAX_BUCKETS) {
    return;
  }

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }

  // Если все окна ещё живые, освобождаем хотя бы половину: ключи случайные,
  // и потеря счётчика хуже неограниченного роста памяти.
  if (buckets.size >= MAX_BUCKETS) {
    let index = 0;

    for (const key of buckets.keys()) {
      buckets.delete(key);
      index += 1;

      if (index >= Math.floor(MAX_BUCKETS / 2)) {
        break;
      }
    }
  }
}

/** Списывает одну попытку и сообщает, можно ли выполнять запрос. */
export function consumeRateLimit(
  key: string,
  options: RateLimitOptions,
  now = Date.now(),
): RateLimitResult {
  const limit = Math.max(1, Math.floor(options.limit));
  const windowMs = Math.max(1, Math.floor(options.windowMs));
  let bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    prune(now);
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  const allowed = bucket.count < limit;

  if (allowed) {
    bucket.count += 1;
  }

  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

/**
 * Ключ лимита: вошедший пользователь считается по id, гость — по IP.
 * IP берём из заголовков прокси, а при их отсутствии — общий `unknown`.
 */
export function rateLimitKey(
  request: Request,
  scope: string,
  userId?: string | null,
): string {
  return userId ? `${scope}:user:${userId}` : `${scope}:ip:${clientIp(request)}`;
}

/** IP клиента из заголовков обратного прокси. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();

    if (first) {
      return first;
    }
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Готовый ответ 429 с заголовками лимита. */
export function rateLimitResponse(
  result: RateLimitResult,
  message = "Слишком много запросов. Попробуйте через минуту.",
): Response {
  return Response.json(
    { error: message },
    {
      status: 429,
      headers: {
        "cache-control": "no-store",
        "retry-after": String(result.retryAfterSeconds),
        "x-ratelimit-limit": String(result.limit),
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String(result.retryAfterSeconds),
      },
    },
  );
}
