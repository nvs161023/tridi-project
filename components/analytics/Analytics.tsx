"use client";

import { GoogleAnalytics, sendGAEvent } from "@next/third-parties/google";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";

import { readCookieConsent } from "@/components/CookieBanner";

/**
 * Вся аналитика сайта в одном компоненте: Яндекс.Метрика и Google Analytics 4.
 *
 * Оба счётчика подключаются по одному правилу — только после «Принять все» в
 * cookie-баннере (readCookieConsent). Пока решения нет или выбрано «Только
 * необходимые», ни tag.js, ни gtag.js на страницу не попадают. Поэтому оба
 * счётчика живут здесь: одна проверка согласия и одно место, где виден весь набор
 * передаваемых наружу данных (см. «Политика использования cookie», раздел 2).
 *
 * Метрика — свой компонент, а не пакет вроде next-ym: сторонняя обёртка тянет
 * свой peer dependency на React и может отстать от React 19, а вся работа здесь —
 * один вставленный скрипт и повторный «hit» на смену маршрута. GA4, наоборот,
 * подключается официальным `GoogleAnalytics` из @next/third-parties.
 *
 * Почему не просто <Script> в layout, а обёртка с состоянием:
 * 1. Идентификаторы приходят из NEXT_PUBLIC_YM_ID и NEXT_PUBLIC_GA_ID. Пока
 *    переменной нет (локальная разработка, превью-сборка), соответствующий
 *    счётчик не рисует ничего — ни строчки стороннего кода на странице.
 * 2. Счётчики аналитические, поэтому подключаются только после выбора «Принять
 *    все». Пока решения нет или выбрано «Только необходимые», скрипты не
 *    загружаются.
 * 3. Next.js не перезагружает страницу при переходах: обычный счётчик увидел бы
 *    только первый экран. Поэтому на каждую смену pathname отправляется
 *    повторный просмотр — ym(…, "hit", …) и событие page_view в GA4.
 *
 * Про query-строку: смена только параметров (фильтры, «?page=2») новым переходом
 * не считается — usePathname её не видит, а useSearchParams потребовал бы
 * Suspense на каждой статической странице ради сомнительной пользы в отчётах.
 */
const YM_COUNTER_ID = process.env.NEXT_PUBLIC_YM_ID?.trim() ?? "";
const GA_ID = process.env.NEXT_PUBLIC_GA_ID?.trim() ?? "";

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

ym(${YM_COUNTER_ID}, "init", {clickmap:true, trackLinks:true, accurateTrackBounce:true, webvisor:true});
window.__tridiYmPage = window.location.pathname + window.location.search;
`;


export function Analytics() {
  const pathname = usePathname();
  const [isAllowed, setIsAllowed] = useState(false);
  const lastPath = useRef<string | null>(null);
  const lastGaPath = useRef<string | null>(null);

  /**
   * Согласие читается в эффекте, а не при отрисовке: localStorage есть только в
   * браузере, и до гидратации разметка сервера с клиентом разошлась бы.
   * Слушаем событие баннера, чтобы «Принять все» включало счётчики сразу, без
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
   * Повторный просмотр Метрики на клиентский переход. Первый экран считает сам
   * init, поэтому здесь отправляем hit только когда библиотека уже загружена, а
   * адрес отличается от предыдущего. Иначе переход «туда-обратно» удвоил бы
   * визит.
   */
  useEffect(() => {
    if (!YM_COUNTER_ID || !isAllowed) {
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

    ym(YM_COUNTER_ID, "hit", url, { title: document.title, referer });
    lastPath.current = url;
  }, [pathname, isAllowed]);

  /**
   * Просмотры GA4 на клиентские переходы. `GoogleAnalytics` отправляет page_view
   * только при загрузке gtag.js — то есть первый экран (и тот, на котором нажали
   * «Принять все») уже посчитан. Его адрес запоминается при первом запуске
   * эффекта, дальше событие уходит только на смену маршрута: иначе первый
   * просмотр попал бы в отчёт дважды.
   */
  useEffect(() => {
    if (!GA_ID || !isAllowed) {
      return;
    }

    const url = `${window.location.pathname}${window.location.search}`;
    const countedPath = lastGaPath.current;

    if (countedPath === null) {
      lastGaPath.current = url;
      return;
    }

    if (countedPath === url) {
      return;
    }

    sendGAEvent("event", "page_view", {
      page_path: url,
      page_location: `${window.location.origin}${url}`,
      page_title: document.title,
      page_referrer: `${window.location.origin}${countedPath}`,
    });
    lastGaPath.current = url;
  }, [pathname, isAllowed]);

  const isYmEnabled = YM_COUNTER_ID !== "" && isAllowed;
  const isGaEnabled = GA_ID !== "" && isAllowed;

  if (!isYmEnabled && !isGaEnabled) {
    return null;
  }

  return (
    <>
      {isYmEnabled ? (
        <Script
          id="yandex-metrica"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }}
        />
      ) : null}
      {isGaEnabled ? <GoogleAnalytics gaId={GA_ID} /> : null}
    </>
  );
}

