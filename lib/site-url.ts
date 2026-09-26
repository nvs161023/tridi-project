import { headers } from "next/headers";

/**
 * Адрес сайта — нужен для ссылок в письмах (подтверждение email).
 *
 * Порядок определения:
 *   1. переменная окружения NEXT_PUBLIC_SITE_URL — её задают на хостинге, чтобы
 *      письма всегда вели на боевой домен, независимо от того, какой адрес
 *      пришёл в запросе;
 *   2. в разработке — адрес из запроса (localhost:3000 и т.п.), иначе локальные
 *      письма вели бы на продовый домен;
 *   3. боевой домен как последний резерв, чтобы ссылка никогда не была пустой.
 *
 * Адрес из заголовков Host берём только вне продакшена: подделанный Host не
 * должен уводить ссылку из письма на чужой домен.
 */
const PRODUCTION_SITE_URL = "https://tridi-print.ru";

export async function resolveSiteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV !== "production") {
    try {
      const headerList = await headers();
      const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
      const protocol = headerList.get("x-forwarded-proto") ?? "http";

      if (host) {
        return `${protocol}://${host}`;
      }
    } catch {
      // Заголовки недоступны (например, вызов вне запроса) — идём к резерву.
    }
  }

  return PRODUCTION_SITE_URL;
}

/**
 * Ссылка, на которую Supabase вернёт пользователя после подтверждения email.
 *
 * next передаём внутри адреса: после подтверждения человек попадает туда, откуда
 * его отправили регистрироваться (обычно в урок), а не в личный кабинет.
 */
export async function buildEmailRedirectUrl(nextPath: string): Promise<string> {
  const siteUrl = await resolveSiteUrl();

  return `${siteUrl}/auth/confirm?next=${encodeURIComponent(nextPath)}`;
}
