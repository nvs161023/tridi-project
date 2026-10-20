import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/seo";

/**
 * robots.txt: индексируем публичные страницы и закрываем личные разделы.
 *
 * Запрет в robots.txt не заменяет проверку доступа: /dashboard, /admin и
 * /constructor всё равно закрыты middleware и серверными проверками. Правило
 * лишь просит робота не тратить обход на страницы, которые ему не покажут.
 *
 * Центр инструментов и справочник дефектов публичные и есть в карте сайта,
 * поэтому /tools разрешён явно — чтобы будущий запрет по ошибке не отрезал
 * страницы, которые мы хотим показывать в поиске.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/tools"],
        disallow: ["/dashboard", "/admin", "/api", "/constructor", "/verify"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
