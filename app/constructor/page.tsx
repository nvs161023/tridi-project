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
 * Конструктор 3D-моделей: девятнадцать параметрических моделей — от вазы и брелока
 * до трафарета, шкатулки с кодом и подарочной коробки — с предпросмотром и STL.
 *
 * **Инструмент скрыт (23.10.2026).** Модели собраны, но не проверены на печати,
 * поэтому адрес `/constructor` закрыт для всех: middleware.ts перечисляет его в
 * HIDDEN_PATH_PREFIXES и отдаёт редирект на /tools до проверки сессии. Проверка
 * ниже — вторая линия защиты: если middleware обойдут (правка matcher, прямой
 * рендер), страница всё равно не покажет интерфейс. Ссылок на конструктор нет ни
 * в навигации, ни в кабинете, ни в тарифах — раздел вернётся вместе с проверкой
 * моделей и записью в HIDDEN_PATH_PREFIXES.
 *
 * До скрытия страница стояла под авторизацией: путь был перечислен и в
 * config.matcher (middleware.ts), и в PROTECTED_PATH_PREFIXES. Проверка входа
 * ниже осталась как страховка на случай запроса мимо middleware: без неё
 * страница открылась бы любому, кто знает адрес, стоит вернуть её в сборку.
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
  title: "Конструктор 3D — TriDi",
  description:
    "Параметрические модели TriDi: вазы с восемью силуэтами и математическими узорами, брелоки с именем из кириллицы, подставки под телефон, клипсы для кабелей, вывески, коробки-органайзеры, литофаны из фотографий, кашпо, подставки под кружку, стойки для украшений, органайзеры для ручек, нашивки, плафоны для гирлянды, ёлочные игрушки, настенные крючки, клипсы для кружек, трафареты, шкатулки с кодом и подарочные коробки. Настройте размеры, проверьте модель в 3D и скачайте STL для печати — безлимитный экспорт входит в пакет «Всё включено».",
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
  // Вторая линия защиты (первая — middleware.ts). Условие читает тот же список
  // скрытых разделов, что и прослойка: пока "/constructor" в
  // HIDDEN_PATH_PREFIXES, страница отдаёт редирект, а когда строку уберут —
  // заработает снова без правок кода ниже.
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
