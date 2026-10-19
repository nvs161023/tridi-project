/**
 * Общие SEO-настройки: адрес сайта, картинка превью и микроразметка.
 *
 * Адрес берём из NEXT_PUBLIC_SITE_URL, а если переменной нет — боевой домен.
 * Для sitemap, robots и schema.org нужны абсолютные URL: относительные
 * поисковики не принимают.
 */
import { LEGAL_OPERATOR } from "@/lib/legal";

/** Боевой домен — последний резерв, если переменная окружения не задана. */
const FALLBACK_SITE_URL = LEGAL_OPERATOR.domain;

/** Адрес сайта для статических метаданных, robots и картинки OpenGraph. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || FALLBACK_SITE_URL
).replace(/\/+$/, "");

/**
 * Картинка превью для соцсетей.
 *
 * Файл app/opengraph-image.tsx собирает PNG 1200×630 на этапе запроса. В
 * метаданных достаточно относительного адреса: Next.js дополнит его
 * metadataBase из корневого layout.
 */
export const OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "TriDi — онлайн-курсы по 3D-печати",
};

/** Абсолютный адрес страницы или файла от переданного домена. */
export function absoluteUrl(path: string, siteUrl: string = SITE_URL): string {
  return new URL(path, `${siteUrl.replace(/\/+$/, "")}/`).toString();
}

/**
 * Организация для JSON-LD.
 *
 * Один и тот же объект используется на главной и как provider в карточках
 * курсов: @id связывает их в одну сущность, а не в две разные компании.
 */
export function organizationJsonLd(siteUrl: string) {
  const base = siteUrl.replace(/\/+$/, "");

  return {
    "@type": "Organization",
    "@id": `${base}/#organization`,
    name: "TriDi",
    url: base,
    logo: absoluteUrl("/icon.svg", base),
    image: absoluteUrl("/icon.svg", base),
    email: LEGAL_OPERATOR.email,
    telephone: LEGAL_OPERATOR.phone,
    legalName: LEGAL_OPERATOR.fullName,
    taxID: LEGAL_OPERATOR.inn,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: LEGAL_OPERATOR.email,
      telephone: LEGAL_OPERATOR.phone,
      availableLanguage: ["ru"],
    },
  };
}
