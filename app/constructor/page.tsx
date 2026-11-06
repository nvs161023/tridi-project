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
import { HIDDEN_REDIRECT_PATH, isHiddenPath } from "@/lib/hidden-routes";
import { hasActiveSubscription } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { USER_HEADER, decodeRequestUser } from "@/lib/supabase/user-headers";

/**
 * Конструктор 3D-моделей: одиннадцать параметрических моделей — от вазы и
 * брелока до органайзера для ручек и термопринта — с предпросмотром и STL.
 *
 * **Раздел вернулся 6 ноября 2026.** Инструмент скрывали с 23.10.2026 — модели не
 * были проверены на печати. Ограничение снято осознанно: адрес снова открыт
 * вошедшим, ссылки на него стоят в шапке (пункт «Инструменты») и в центре
 * инструментов, а `/constructor` больше нет в HIDDEN_PATH_PREFIXES
 * (lib/hidden-routes.ts).
 *
 * Проверка входа: путь перечислен и в config.matcher (middleware.ts), и в
 * PROTECTED_PATH_PREFIXES (lib/supabase/middleware.ts), поэтому гость уходит на
 * вход с возвратом на эту же страницу. Проверка ниже — страховка на случай
 * запроса мимо middleware: без неё страница открылась бы любому, кто знает адрес.
 *
 * Предпросмотр доступен всем авторизованным. С пакетом «Всё включено» STL
 * скачивается без ограничений, без активного доступа — три раза в календарный
 * месяц по UTC. hasActiveSubscription() проверяет бессрочный пакет `pro`,
 * легаси-подписку `pro-subscription` и активную запись в subscriptions. Остаток
 * передаём в клиентский компонент, но
 * интерфейсом доступ не ограничивается: серверный роут экспорта считает
 * скачивания заново — адрес API можно открыть руками.
 *
 * robots: noindex — инструмент платформы в поиске делать нечего, как и
 * странице подтверждения email.
 */
export const metadata: Metadata = {
  title: "Конструктор 3D",
  description:
    "Параметрические модели TriDi: вазы с восемью силуэтами и математическими узорами, брелоки с именем из кириллицы, подставки под телефон, вывески, коробки-органайзеры, литофаны из фотографий, кашпо, подставки под кружку, стойки для украшений, органайзеры для ручек и термопринты логотипа из PNG или SVG. Настройте размеры, проверьте модель в 3D и скачайте STL для печати — безлимитный экспорт входит в пакет «Всё включено».",
  robots: {
    index: false,
    follow: false,
  },
};

/** Страница читает cookies и подписку — собираем её на каждый запрос. */
export const dynamic = "force-dynamic";

type ConstructorPageProps = {
  /** `?project=ID` — проект из кабинета, который нужно открыть в конструкторе. */
  searchParams: Promise<{ project?: string | string[] }>;
};

/** Собственный адрес страницы — сверяется со списком скрытых путей. */
const PAGE_PATH = "/constructor";

export default async function ConstructorPage({
  searchParams,
}: ConstructorPageProps) {
  // Страховка на случай запроса мимо middleware. Сейчас список скрытых разделов
  // пуст и условие ничего не делает, но если раздел снова признают неготовым,
  // страница закроется той же строкой в lib/hidden-routes.ts — без правок здесь.
  if (isHiddenPath(PAGE_PATH)) {
    redirect(HIDDEN_REDIRECT_PATH);
  }

  const identity = decodeRequestUser((await headers()).get(USER_HEADER));
  const query = await searchParams;
  // Параметр может прийти массивом (`?project=a&project=b`) — берём первый.
  const projectParam = Array.isArray(query.project)
    ? query.project[0]
    : query.project;
  const initialProjectId =
    typeof projectParam === "string" && projectParam ? projectParam : null;

  if (!identity) {
    // Возврат после входа сохраняет проект: ссылка из кабинета должна открыть
    // ту же модель, а не пустой конструктор.
    const next = initialProjectId
      ? `/constructor?project=${encodeURIComponent(initialProjectId)}`
      : "/constructor";

    redirect(authHref("/auth/login", next));
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
    <div className="min-h-screen text-slate-100">
      <Header />
      <ConstructorClient
        freeDownloadsLeft={freeDownloadsLeft}
        hasPro={hasPro}
        initialProjectId={initialProjectId}
      />
    </div>
  );
}
