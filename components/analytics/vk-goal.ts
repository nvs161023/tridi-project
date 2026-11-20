"use client";

import { readCookieConsent } from "@/components/CookieBanner";

/**
 * Цели пикселя VK Рекламы (`reachGoal`) — отдельно от просмотров страниц.
 *
 * Просмотры (`pageView`) отправляет Analytics.tsx при загрузке code.js и на каждый
 * клиентский переход. Цели — это действия, и отправляются они только по факту
 * действия, поэтому helper живёт отдельно: Analytics.tsx остаётся тем же
 * единственным местом, где пиксель подключается.
 *
 * Правила, которые helper соблюдает сам, чтобы их нельзя было забыть на месте
 * вызова:
 * 1. Согласие: цель уходит только при выборе «Принять все» (scope === "all").
 *    Пока решения нет или выбрано «Только необходимые», событие не отправляется и
 *    никуда не откладывается — очередь появилась бы только ради обхода отказа.
 * 2. Персональные данные: в событии нет ни email, ни имени, ни телефона — только
 *    номер пикселя, тип и имя цели.
 * 3. Дубли: с `once` цель отправляется один раз на вкладку — метка в памяти
 *    защищает от повторного запуска эффекта, метка в sessionStorage — от
 *    перезагрузки страницы с тем же адресом.
 * 4. Второй экземпляр пикселя не создаётся: helper кладёт событие в уже
 *    существующую очередь `window._tmr` (до загрузки code.js это массив
 *    отложенных событий, после — объект библиотеки).
 */

/** Имя цели в коде. В кабинете VK у неё свой Event ID (8921483). */
export const VK_SIGNUP_GOAL = "signup_success";

/** Тот же номер, что подключает Analytics.tsx: отдельного пикселя не заводим. */
const VK_PIXEL_ID = process.env.NEXT_PUBLIC_VK_PIXEL_ID?.trim() ?? "";

/** Ключ sessionStorage: «эта цель уже отправлена в этой вкладке». */
const SENT_STORAGE_PREFIX = "tridi:vk-goal:";

/** Что уже отправлено на этой странице — защита от повторного запуска эффекта. */
const sentOnThisPage = new Set<string>();

/** Очередь пикселя: массив до загрузки code.js, объект библиотеки после. */
type TmrQueue = { push: (hit: Record<string, unknown>) => void };

function readSentFlag(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    // Запрет хранилища: остаются защита в памяти и снятый маркер в адресе.
    return false;
  }
}

function saveSentFlag(key: string) {
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Приватный режим: см. readSentFlag.
  }
}

/**
 * Очередь `_tmr`. Если code.js ещё не выполнился, создаём массив отложенных
 * событий — ровно тот, который init-скрипт подхватывает через
 * `window._tmr || (window._tmr = [])`. Второй `<script>` пикселя не появляется.
 */
function tmrQueue(): TmrQueue | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (!window._tmr) {
    window._tmr = [] as unknown as TmrQueue;
  }

  return window._tmr;
}

/**
 * Отправляет цель в пиксель VK Рекламы.
 *
 * Возвращает true, только если событие действительно попало в очередь пикселя.
 * `once` — имя цели, которое запоминается, чтобы не отправить её повторно.
 */
export function trackVkGoal(
  goal: string,
  options: { once?: string } = {},
): boolean {
  if (VK_PIXEL_ID === "" || typeof window === "undefined") {
    return false;
  }

  // Согласие проверяем в момент отправки, а не при вызове из эффекта: решение
  // пользователя могло измениться, а при отказе событие не должно ждать в очереди.
  if (readCookieConsent() !== "all") {
    return false;
  }

  const onceKey = options.once ? `${SENT_STORAGE_PREFIX}${options.once}` : null;

  if (onceKey && (sentOnThisPage.has(onceKey) || readSentFlag(onceKey))) {
    return false;
  }

  const queue = tmrQueue();

  if (!queue) {
    return false;
  }

  try {
    // Личные данные не передаём: только номер пикселя, тип события и имя цели.
    queue.push({ id: Number(VK_PIXEL_ID), type: "reachGoal", goal });
  } catch {
    return false;
  }

  if (onceKey) {
    sentOnThisPage.add(onceKey);
    saveSentFlag(onceKey);
  }

  return true;
}
