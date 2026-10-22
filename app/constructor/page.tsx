import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ConstructorClient } from "@/app/constructor/ConstructorClient";
import { Header } from "@/components/Header";
import { authHref } from "@/lib/auth-redirect";
import {
  countConstructorDownloadsThisMonth,
  remainingFreeDownloads,
} from "@/lib/constructor/downloads";
import { hasActiveSubscription } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { USER_HEADER, decodeRequestUser } from "@/lib/supabase/user-headers";

/**
 * Конструктор 3D-моделей: ваза, брелок, подставка, клипсы, вывеска, коробка и
 * литофан с предпросмотром и STL.
 *
 * Страница под авторизацией: путь перечислен в config.matcher (middleware.ts)
 * и в PROTECTED_PATH_PREFIXES, поэтому гостя middleware уводит на вход.
 * Проверка ниже — страховка на случай запроса мимо middleware (та же логика,
 * что в кабинете): без неё страница открылась бы любому, кто знает адрес.
 *
 * Предпросмотр доступен всем авторизованным. Pro скачивает STL без ограничений,
 * Free — три раза в календарный месяц по UTC. hasActiveSubscription()
 * проверяет бессрочный пакет `pro`, подписку `pro-subscription` и активную
 * запись в subscriptions. Остаток передаём в клиентский компонент, но
 * интерфейсом доступ не ограничивается: серверный роут экспорта считает
 * скачивания заново — адрес API можно открыть руками.
 *
 * robots: noindex — инструмент подписки в поиске делать нечего, как и
 * странице подтверждения email.
 */
export const metadata: Metadata = {
  title: "Конструктор 3D — TriDi",
  description:
    "Параметрические модели TriDi: вазы с восемью силуэтами и математическими узорами, брелоки с именем из кириллицы, подставки под телефон, клипсы для кабелей, вывески, коробки-органайзеры и литофаны из фотографий. Настройте размеры, проверьте модель в 3D и скачайте STL для печати — экспорт входит в подписку Pro.",
  robots: {
    index: false,
    follow: false,
  },
};

/** Страница читает cookies и подписку — собираем её на каждый запрос. */
export const dynamic = "force-dynamic";

export default async function ConstructorPage() {
  const identity = decodeRequestUser((await headers()).get(USER_HEADER));

  if (!identity) {
    redirect(authHref("/auth/login", "/constructor"));
  }

  const supabase = await createClient();
  const hasPro = await hasActiveSubscription(supabase, identity.id);

  let freeDownloadsLeft = 0;

  if (!hasPro) {
    const usage = await countConstructorDownloadsThisMonth(
      supabase,
      identity.id,
    );

    if (usage.error) {
      // Интерфейс — не защита: API повторит подсчёт и вернёт 503, если таблица
      // недоступна. Здесь показываем полный лимит, чтобы не пугать человека
      // ложным «0 из 3» из-за временной ошибки чтения.
      console.warn(
        "Не удалось посчитать бесплатные скачивания:",
        usage.error,
      );
    }

    freeDownloadsLeft = remainingFreeDownloads(usage.count ?? 0);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />
      <ConstructorClient
        freeDownloadsLeft={freeDownloadsLeft}
        hasPro={hasPro}
      />
    </div>
  );
}
