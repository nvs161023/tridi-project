import type { MetadataRoute } from "next";

import { getAllPosts } from "@/lib/blog";
import { COURSE_LANDING_IDS } from "@/lib/course-landing";
import { getApprovedThreadsForSitemap, getForumCategories } from "@/lib/forum";
import { profilesUpdatedAt } from "@/lib/profiles";
import { resolveSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

/**
 * Карта сайта собирается на каждый запрос: список одобренных тем форума
 * меняется, а статический файл на этапе сборки быстро устарел бы.
 */
export const dynamic = "force-dynamic";

/**
 * Дата последней ревизии текстов публичных страниц (ISO).
 *
 * Нужна для lastModified: дата «сейчас» на каждом запросе бессмысленна для
 * поисковика — он перестаёт верить lastmod и обходит карту по своему графику.
 * При правках контента страницы дату меняем руками.
 */
const CONTENT_REVIEWED_AT = new Date("2026-11-19");

const STATIC_PAGES: {
  path: string;
  changeFrequency: "weekly" | "monthly" | "daily" | "yearly";
  priority: number;
  /** Дата обновления конкретной страницы, если известна точнее общей. */
  lastModified?: Date;
}[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/start", changeFrequency: "monthly", priority: 0.7 },
  { path: "/subscription", changeFrequency: "weekly", priority: 0.7 },
  // Витрина генератора: подписка и пакеты токенов. Публичная и индексируемая;
  // сам /3d-generator с 16 ноября 2026 тоже открыт для поиска, но требует входа.
  { path: "/pricing", changeFrequency: "monthly", priority: 0.8 },
  // Витрины инструментов. Сам /constructor и /3d-generator закрыты входом
  // (PROTECTED_PATH_PREFIXES в lib/supabase/middleware.ts): гость получает 307
  // на /auth/login, поэтому в карте сайта стоят открытые версии.
  { path: "/preview/constructor", changeFrequency: "monthly", priority: 0.85 },
  { path: "/preview/generator", changeFrequency: "monthly", priority: 0.85 },
  // Галерея обновляется с каждой публикацией модели, поэтому weekly.
  { path: "/gallery", changeFrequency: "weekly", priority: 0.8 },
  { path: "/forum", changeFrequency: "daily", priority: 0.7 },
  { path: "/tools", changeFrequency: "weekly", priority: 0.8 },
  // Витрина мастерской: публичное описание CRM, которую открывает подписка Pro.
  // Сам /dashboard/workshop закрыт сессией и noindex — из поиска человек
  // попадает сюда и уже отсюда идёт в /pricing.
  { path: "/tools/workshop", changeFrequency: "monthly", priority: 0.8 },
  { path: "/tools/defects", changeFrequency: "monthly", priority: 0.7 },
  // Блог — точка входа для поисковых запросов по ошибкам принтеров: статьи
  // обновляются чаще остальных текстов, поэтому changeFrequency weekly.
  { path: "/blog", changeFrequency: "weekly", priority: 0.8 },
  {
    path: "/profiles",
    changeFrequency: "monthly",
    priority: 0.7,
    // Каталог профилей обновляется отдельно от текстов — дату берём из него.
    lastModified: new Date(profilesUpdatedAt),
  },
  { path: "/forum/rules", changeFrequency: "monthly", priority: 0.4 },
  { path: "/legal", changeFrequency: "yearly", priority: 0.4 },
  // Адрес /legal/oferta — редирект (next.config.ts), в карте сайта указываем
  // конечный адрес: робот должен получать 200, а не 308.
  { path: "/legal/offer", changeFrequency: "yearly", priority: 0.7 },
  { path: "/legal/privacy", changeFrequency: "yearly", priority: 0.7 },
  { path: "/legal/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/legal/consent", changeFrequency: "yearly", priority: 0.3 },
  { path: "/legal/cookies", changeFrequency: "yearly", priority: 0.3 },
];

/**
 * Карта сайта: витрина, бесплатный курс, тарифы, курсы, витрины инструментов,
 * центр инструментов, библиотека профилей, блог, разделы и темы форума,
 * юридические документы.
 *
 * Закрытые разделы сюда не попадают: /dashboard, /course/*, /constructor,
 * /3d-generator и /admin закрыты middleware (гость получает 307), а личные
 * страницы (/my-models, /activate, /verify) держат noindex. `/verify` вдобавок
 * проверяет конкретный сертификат по токену — это не страница для поиска.
 * Вместо закрытых инструментов в карте стоят открытые витрины /preview/*.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = await resolveSiteUrl();
  const supabase = await createClient();
  const [threads, categories] = await Promise.all([
    getApprovedThreadsForSitemap(supabase),
    // Разделы форума тоже публичные и индексируемые: без них в карте оставались
    // только темы, а страницы /forum/category/<slug> жили на одних внутренних
    // ссылках.
    getForumCategories(supabase),
  ]);

  return [
    ...STATIC_PAGES.map((page) => ({
      url: `${siteUrl}${page.path}`,
      lastModified: page.lastModified ?? CONTENT_REVIEWED_AT,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
    ...COURSE_LANDING_IDS.map((id) => ({
      url: `${siteUrl}/courses/${id}`,
      lastModified: CONTENT_REVIEWED_AT,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    ...getAllPosts().map((post) => ({
      url: `${siteUrl}/blog/${post.slug}`,
      lastModified: new Date(post.updated),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...categories.map((category) => ({
      url: `${siteUrl}/forum/category/${category.slug}`,
      // У категории нет своей даты правки: раздел меняется вместе с темами,
      // поэтому берём общую дату ревизии контента, а не «сейчас».
      lastModified: CONTENT_REVIEWED_AT,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...threads.map((thread) => ({
      url: `${siteUrl}/forum/${thread.slug}`,
      lastModified: new Date(thread.created_at),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}

