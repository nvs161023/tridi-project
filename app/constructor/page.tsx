import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ConstructorClient } from "@/app/constructor/ConstructorClient";
import { Header } from "@/components/Header";
import { authHref } from "@/lib/auth-redirect";
import { hasActiveSubscription } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { USER_HEADER, decodeRequestUser } from "@/lib/supabase/user-headers";

/**
 * Конструктор 3D-моделей: параметрическая ваза с предпросмотром и STL.
 *
 * Страница под авторизацией: путь перечислен в config.matcher (middleware.ts)
 * и в PROTECTED_PATH_PREFIXES, поэтому гостя middleware уводит на вход.
 * Проверка ниже — страховка на случай запроса мимо middleware (та же логика,
 * что в кабинете): без неё страница открылась бы любому, кто знает адрес.
 *
 * Предпросмотр доступен всем авторизованным, а скачивание STL — только Pro.
 * hasActiveSubscription() проверяет бессрочный пакет `pro`, подписку
 * `pro-subscription` и активную запись в subscriptions. Флаг передаём в
 * клиентский компонент, но интерфейсом доступ не ограничивается: серверный
 * роут экспорта проверит подписку заново — адрес API можно открыть руками.
 *
 * robots: noindex — инструмент подписки в поиске делать нечего, как и
 * странице подтверждения email.
 */
export const metadata: Metadata = {
  title: "Конструктор 3D — TriDi",
  description:
    "Параметрические вазы TriDi: шесть силуэтов, математические узоры, настройка высоты, диаметра и толщины стенки. Проверьте модель в 3D и скачайте STL для печати — экспорт входит в подписку Pro.",
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />
      <ConstructorClient hasPro={hasPro} />
    </div>
  );
}
