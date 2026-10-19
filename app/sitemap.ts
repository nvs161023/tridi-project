import type { MetadataRoute } from "next";

import { COURSE_LANDING_IDS } from "@/lib/course-landing";
import { getApprovedThreadsForSitemap } from "@/lib/forum";
import { resolveSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

/**
 * Карта сайта собирается на каждый запрос: список одобренных тем форума
 * меняется, а статический файл на этапе сборки быстро устарел бы.
 */
export const dynamic = "force-dynamic";

const STATIC_PAGES: {
  path: string;
  changeFrequency: "weekly" | "monthly" | "daily";
  priority: number;
}[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/subscription", changeFrequency: "weekly", priority: 0.9 },
  { path: "/forum", changeFrequency: "daily", priority: 0.8 },
];

/** Карта сайта: витрина, тарифы, курсы и все опубликованные темы форума. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = await resolveSiteUrl();
  const supabase = await createClient();
  const threads = await getApprovedThreadsForSitemap(supabase);

  return [
    ...STATIC_PAGES.map((page) => ({
      url: `${siteUrl}${page.path}`,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
    ...COURSE_LANDING_IDS.map((id) => ({
      url: `${siteUrl}/courses/${id}`,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    ...threads.map((thread) => ({
      url: `${siteUrl}/forum/${thread.slug}`,
      lastModified: new Date(thread.created_at),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
