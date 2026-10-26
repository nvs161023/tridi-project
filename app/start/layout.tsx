import type { Metadata } from "next";
import type { ReactNode } from "react";

import { OG_IMAGE } from "@/lib/seo";

/**
 * Метаданные лендинга /start.
 *
 * Сама страница — клиентский компонент (на ней работает таймер), а экспорт
 * metadata в клиентском компоненте Next.js не поддерживает. Поэтому заголовок,
 * описание и canonical живут в layout этого раздела: остальные страницы сайта
 * свой layout не меняют.
 */
const PAGE_TITLE = "Бесплатный курс по 3D-печати для новичков | TriDi";
const PAGE_DESCRIPTION =
  "8 бесплатных уроков по 3D-печати: первый слой, слайсер, прочность деталей и диагностика дефектов. Практика с первого урока, без привязки карты.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/start" },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "TriDi",
    url: "/start",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

export default function StartLayout({ children }: { children: ReactNode }) {
  return children;
}
