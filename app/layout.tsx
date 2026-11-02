import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { CookieBanner } from "@/components/CookieBanner";
import { EmailLinkHandler } from "@/components/EmailLinkHandler";
import { Footer } from "@/components/Footer";
import { OG_IMAGE, organizationJsonLd, SITE_URL } from "@/lib/seo";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_NAME = "TriDi";
const SITE_TITLE = "TriDi — Курсы по 3D-печати и CRM для мастеров";
const SITE_DESCRIPTION =
  "Онлайн-курсы по 3D-печати для новичков и мастеров и CRM для мастерских: уроки с практикой, тесты с пояснениями, справочник дефектов, библиотека профилей печати и учёт заказов.";

export const metadata: Metadata = {
  // Абсолютные адреса для canonical, og:image и twitter:image собираются из
  // этого домена. На хостинге его задаёт NEXT_PUBLIC_SITE_URL.
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  // Шаблон подставляет бренд к заголовкам отдельных страниц: страница задаёт
  // «Тарифы», а в выдаче и вкладке браузера получается «Тарифы | TriDi».
  // Сами страницы поэтому не дублируют «TriDi» в своих заголовках.
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  // Индексировать можно: закрытые разделы перекрывают это значение своим
  // robots из middleware и собственных метаданных страниц.
  robots: { index: true, follow: true },
  // Коды подтверждения владения сайтом. Next.js выводит их в <head> как
  // <meta name="google-site-verification" …> и <meta name="yandex-verification" …>
  // на всех страницах сайта. Значения берутся из кабинетов Search Console и
  // Вебмастера: при перевыпуске кода меняется соответствующая строка.
  verification: {
    google: "e-K21i30Kbj__NNi-URYQaGokY-DDRQKScl_QLhz9Rk",
    yandex: "e9f08ad5d53f1863",
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: SITE_NAME,
    url: "/",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

/**
 * Organization для поиска: название, адрес сайта, логотип и контакты.
 *
 * Разметка живёт в корневом layout, а не на главной, чтобы карточка компании
 * была на каждой странице: поисковик связывает её по @id с provider в
 * разметке курсов и с авторами тем форума.
 */
const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  ...organizationJsonLd(SITE_URL),
};

/**
 * Корневой layout: шрифты, JSON-LD организации, общий футер с юридическими
 * документами и баннер согласия на cookie.
 *
 * Футер и баннер живут здесь, а не на каждой странице: ссылки на политику,
 * согласие, соглашение и оферту должны быть доступны с любого экрана, а cookie-
 * баннер должен показываться один раз на весь сайт.
 *
 * Canonical здесь намеренно не задан: metadata наследуется вложенными
 * сегментами, и canonical из layout объявил бы канонической главную для всех
 * страниц сразу. Каждая публичная страница указывает свой адрес сама.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${geistSans.variable} ${geistMono.variable} site-background text-foreground antialiased`}
      >
        {/* Organization на каждой странице: поисковик получает карточку
            компании с любого адреса, а не только с главной. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(ORGANIZATION_JSON_LD).replace(/</g, "\\u003c"),
          }}
        />
        {children}
        <Footer />
        <CookieBanner />
        {/* Ссылка из письма Supabase может прийти с токенами во фрагменте адреса —
            разбирает его этот обработчик (см. components/EmailLinkHandler.tsx). */}
        <EmailLinkHandler />
      </body>
    </html>
  );
}
