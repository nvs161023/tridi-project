"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Баннер согласия на использование cookie.
 *
 * Зачем баннер, а не строчка «продолжая пользоваться сайтом, вы соглашаетесь»:
 * с 2025 года такое «молчаливое согласие» недействительно — решение должно быть
 * явным действием пользователя. Поэтому здесь две кнопки, и выбор запоминается.
 *
 * Что храним: в localStorage лежит выбранный вариант и дата выбора. Аналитику сайт
 * сейчас не подключает, поэтому «Только необходимые» и «Принять все» дают один и
 * тот же практический результат — но выбор пользователя уже зафиксирован, и когда
 * появится аналитика, её можно будет включать только при scope = "all".
 *
 * Баннер не показывается, если выбор уже сделан. Проверка идёт в useEffect, а не
 * при отрисовке: localStorage доступен только в браузере, и до гидратации мы не
 * знаем ответа — иначе разметка сервера и клиента разошлись бы.
 */
const STORAGE_KEY = "tridi-cookie-consent";

/** Что выбрал пользователь: согласие на всё или только необходимые cookie. */
export type CookieConsentScope = "all" | "necessary";

type StoredConsent = {
  scope: CookieConsentScope;
  savedAt: string;
};

/**
 * Что пользователь выбрал раньше (или null, если ещё не выбирал).
 *
 * Функция пригодится, когда появится аналитика: подключать её можно только при
 * scope === "all".
 */
export function readCookieConsent(): CookieConsentScope | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredConsent>;

    return parsed.scope === "all" || parsed.scope === "necessary"
      ? parsed.scope
      : null;
  } catch {
    return null;
  }
}

function saveConsent(scope: CookieConsentScope) {
  const value: StoredConsent = { scope, savedAt: new Date().toISOString() };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Приватный режим или запрет хранилища: баннер просто скроется до следующего
    // захода — сообщить об этом пользователю нечего.
  }
}

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(readCookieConsent() === null);
  }, []);

  function choose(scope: CookieConsentScope) {
    saveConsent(scope);

    // Событие для тех, кто захочет повесить на него подключение аналитики.
    window.dispatchEvent(
      new CustomEvent("tridi:cookie-consent", { detail: { scope } }),
    );

    setIsVisible(false);
  }

  if (!isVisible) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-label="Согласие на использование cookie"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-slate-900/95 px-4 py-5 backdrop-blur sm:px-6"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
          Мы используем cookie для работы авторизации. Подробнее — в{" "}
          <Link
            href="/legal/cookies"
            className="font-semibold text-blue-300 underline underline-offset-4 transition-colors hover:text-blue-200"
          >
            Политике использования cookie
          </Link>
          .
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/legal/cookies"
            className="text-sm font-medium text-slate-400 underline underline-offset-4 transition-colors hover:text-slate-200"
          >
            Политика cookie
          </Link>
          <button
            type="button"
            onClick={() => choose("necessary")}
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Только необходимые
          </button>
          <button
            type="button"
            onClick={() => choose("all")}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Принять все
          </button>
        </div>
      </div>
    </div>
  );
}
