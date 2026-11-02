"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";

import { readCookieConsent } from "@/components/CookieBanner";

/**
 * Счётчик Яндекс.Метрики с поддержкой клиентской навигации.
 *
 * Свой компонент, а не пакет вроде next-ym: сторонняя обёртка тянет свой peer
 * dependency на React и может отстать от React 19, а вся работа здесь — один
 * вставленный скрипт и повторный «hit» на смену маршрута.
 *
 * Почему не просто <Script> в layout, а обёртка с состоянием:
 * 1. Номер счётчика приходит из NEXT_PUBLIC_YM_ID. Пока переменной нет (локальная
 *    разработка, превью-сборка), компонент не рисует ничего — ни строчки
 *    стороннего кода на странице.
 * 2. Метрика — аналитический счётчик, поэтому он подключается только после
 *    выбора «Принять все» в cookie-баннере (readCookieConsent). Пока решения нет
 *    или выбрано «Только необходимые», скрипт не загружается.
 * 3. Next.js не перезагружает страницу при переходах: обычный счётчик увидел бы
 *    только первый экран. Поэтому на каждую смену pathname отправляется
 *    повторный ym(…, "hit", …).
 *
 * Про query-строку: смена только параметров (фильтры, «?page=2») новым переходом
 * не считается — usePathname её не видит, а useSearchParams потребовал бы
 * Suspense на каждой статической странице ради сомнительной пользы в отчётах.
 */
const COUNTER_ID = process.env.NEXT_PUBLIC_YM_ID?.trim() ?? "";

/** Событие, которое рассылает cookie-баннер после выбора (см. CookieBanner.tsx). */
const CONSENT_EVENT = "tridi:cookie-consent";

/**
 * Счётчик Метрики в window. Библиотека `tag.js` кладёт её саму, поэтому тип
 * объявлен вручную: вызываем только "hit", а "init" делает вставленный скрипт.
 *
 * `__tridiYmPage` — адрес страницы, который посчитал init. Его ставит тот же
 * скрипт: без этой метки первый экран после «Принять все» попал бы в отчёт
 * дважды — один раз из init, второй из эффекта ниже.
 */
declare global {
  interface Window {
    ym?: (counterId: string, action: string, ...args: unknown[]) => void;
    __tridiYmPage?: string;
  }
}

/**
 * Стандартный код инициализации Метрики.
 *
 * Номер счётчика подставляется шаблонной строкой: в разметке он оказывается
 * числовым литералом, как в примере из кабинета Метрики. Проверка
 * `document.scripts[j].src === r` не даёт загрузить tag.js дважды, если компонент
 * смонтируется повторно.
 */
const INIT_SCRIPT = `
(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();
for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

ym(${COUNTER_ID}, "init", {clickmap:true, trackLinks:true, accurateTrackBounce:true, webvisor:true});
window.__tridiYmPage = window.location.pathname + window.location.search;
`;

export function YandexMetrica() {
  const pathname = usePathname();
  const [isAllowed, setIsAllowed] = useState(false);
  const lastPath = useRef<string | null>(null);

  /**
   * Согласие читается в эффекте, а не при отрисовке: localStorage есть только в
   * браузере, и до гидратации разметка сервера с клиентом разошлась бы.
   * Слушаем событие баннера, чтобы «Принять все» включало счётчик сразу, без
   * перезагрузки страницы.
   */
  useEffect(() => {
    function syncConsent() {
      setIsAllowed(readCookieConsent() === "all");
    }

    syncConsent();
    window.addEventListener(CONSENT_EVENT, syncConsent);

    return () => window.removeEventListener(CONSENT_EVENT, syncConsent);
  }, []);

  /**
   * Повторный просмотр на клиентский переход. Первый экран считает сам init,
   * поэтому здесь отправляем hit только когда библиотека уже загружена, а адрес
   * отличается от предыдущего. Иначе переход «туда-обратно» удвоил бы визит.
   */
  useEffect(() => {
    if (!COUNTER_ID || !isAllowed) {
      return;
    }

    const ym = window.ym;

    if (typeof ym !== "function") {
      return;
    }

    const url = `${window.location.pathname}${window.location.search}`;
    // Метка init надёжнее порядка эффектов: скрипт может выполниться и до
    // эффекта, и после него, а посчитанная страница известна в обоих случаях.
    const countedPath = lastPath.current ?? window.__tridiYmPage ?? null;

    if (countedPath === url) {
      return;
    }

    const referer = countedPath
      ? `${window.location.origin}${countedPath}`
      : document.referrer;

    ym(COUNTER_ID, "hit", url, { title: document.title, referer });
    lastPath.current = url;
  }, [pathname, isAllowed]);

  if (!COUNTER_ID || !isAllowed) {
    return null;
  }

  return (
    <Script
      id="yandex-metrica"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }}
    />
  );
}
