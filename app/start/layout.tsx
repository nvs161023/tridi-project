import type { Metadata } from "next";
import type { ReactNode } from "react";

import { OG_IMAGE } from "@/lib/seo";

/**
 * Метаданные лендинга /start.
 *
 * Заголовок, описание и canonical живут в layout раздела: страница остаётся
 * сосредоточенной на разметке, а метаданные не дублируются в двух местах.
 */
const PAGE_TITLE = "Бесплатный курс по 3D-печати для новичков | TriDi";
const PAGE_DESCRIPTION =
  "8 бесплатных уроков по 3D-печати: технологии, устройство принтера, материалы, слайсер, первый слой, калибровка, 15 дефектов и первый проект. Практика с первого урока, без привязки карты.";

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
