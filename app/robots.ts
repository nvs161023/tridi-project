import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/seo";

/**
 * robots.txt: индексируем публичные страницы и закрываем личные разделы.
 *
 * Запрет в robots.txt не заменяет проверку доступа: /dashboard, /admin,
 * /course и /certificate всё равно закрыты middleware и серверными проверками.
 * Правило лишь просит робота не тратить обход на страницы, которые ему не
 * покажут.
 *
 * /constructor в списке остаётся, хотя раздел скрыт целиком: middleware.ts
 * отдаёт по этому адресу редирект на /tools (см. lib/hidden-routes.ts), а
 * страница держит noindex. Запрет — третья страховка на случай, если робот
 * всё-таки придёт по старой ссылке.
 *
 * Центр инструментов, справочник дефектов и библиотека профилей публичные и
 * есть в карте сайта, поэтому /tools и /profiles разрешены явно — чтобы
 * будущий запрет по ошибке не отрезал страницы, которые мы хотим показывать
 * в поиске.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/tools", "/profiles"],
        disallow: [
          "/dashboard",
          "/admin",
          "/api",
          "/constructor",
          "/course",
          "/certificate",
          "/verify",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
