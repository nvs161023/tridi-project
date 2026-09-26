import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { CookieBanner } from "@/components/CookieBanner";
import { EmailLinkHandler } from "@/components/EmailLinkHandler";
import { Footer } from "@/components/Footer";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "3D-печать с нуля — курс для новичков",
  description:
    "Онлайн-курс по 3D-печати для новичков. Практика с первого урока, тесты по модулям с пояснениями, AI-диагностика и конструктор 3D-моделей.",
};

/**
 * Корневой layout: шрифты, общий футер с юридическими документами и баннер
 * согласия на cookie.
 *
 * Футер и баннер живут здесь, а не на каждой странице: ссылки на политику,
 * согласие, соглашение и оферту должны быть доступны с любого экрана, а cookie-
 * баннер должен показываться один раз на весь сайт.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
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
