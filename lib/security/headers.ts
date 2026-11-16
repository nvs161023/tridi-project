/**
 * Заголовки безопасности сайта.
 *
 * CSP перечисляет только те внешние домены, которые действительно нужны:
 * Supabase (REST, realtime и Storage), счётчики Яндекс.Метрики, GA4 и VK.
 * `'unsafe-inline'` для скриптов остаётся: Next.js и инициализаторы счётчиков
 * вставляют inline-скрипты, а nonce-режим потребовал бы переписать разметку и
 * middleware. Стили тоже inline — Tailwind и React пишут атрибуты style.
 *
 * HSTS отдаётся только production-сборкой: на localhost он бесполезен и может
 * помешать отладке по http.
 */

/** Источники, которые нужны аналитике после согласия на cookie. */
const ANALYTICS_SCRIPT_SOURCES = [
  "https://mc.yandex.ru",
  "https://www.googletagmanager.com",
  "https://top-fwz1.mail.ru",
  "https://privacy-cs.mail.ru",
];

/** Куда счётчики и Supabase отправляют запросы. */
const ANALYTICS_CONNECT_SOURCES = [
  "https://mc.yandex.ru",
  "wss://mc.yandex.ru",
  "https://www.google-analytics.com",
  "https://region1.google-analytics.com",
  "https://www.googletagmanager.com",
  "https://top-fwz1.mail.ru",
  "https://privacy-cs.mail.ru",
];

/** Хост Supabase из env: локальный стенд может использовать не только *.supabase.co. */
function supabaseSources(): string[] {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (!raw) {
    return ["https://*.supabase.co", "wss://*.supabase.co"];
  }

  try {
    const url = new URL(raw);
    const ws = `${url.protocol === "http:" ? "ws" : "wss"}://${url.host}`;

    return [url.origin, ws];
  } catch {
    return ["https://*.supabase.co", "wss://*.supabase.co"];
  }
}

/** Собирает Content-Security-Policy для текущего окружения. */
export function contentSecurityPolicy(
  isProduction = process.env.NODE_ENV === "production",
): string {
  const scriptSources = [
    "'self'",
    "'unsafe-inline'",
    ...(isProduction ? [] : ["'unsafe-eval'"]),
    ...ANALYTICS_SCRIPT_SOURCES,
  ];
  const connectSources = [
    "'self'",
    ...supabaseSources(),
    ...ANALYTICS_CONNECT_SOURCES,
  ];
  const directives = [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "media-src 'self' blob: https:",
    `connect-src ${connectSources.join(" ")}`,
    "worker-src 'self' blob:",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://auth.robokassa.ru",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ];

  return directives.join("; ");
}

/** Полный набор заголовков в формате Next.js `headers()`. */
export function securityHeaders(
  isProduction = process.env.NODE_ENV === "production",
): Array<{ key: string; value: string }> {
  const headers = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(isProduction) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
  ];

  if (isProduction) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    });
  }

  return headers;
}
