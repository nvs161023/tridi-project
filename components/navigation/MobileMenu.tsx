"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type MobileMenuProps = {
  isAuthorized: boolean;
  lessonsHref: string;
};

type MenuLink = {
  href: string;
  label: string;
};

/** Основные разделы сайта. */
const MAIN_LINKS: MenuLink[] = [
  { href: "/#levels", label: "Уровни" },
  { href: "/#methodology", label: "Методология" },
  { href: "/#faq", label: "Вопросы" },
  { href: "/forum", label: "Форум" },
  { href: "/subscription", label: "Тарифы" },
];

/** Инструменты — те же три ссылки, что и в десктопном меню. */
const TOOL_LINKS: MenuLink[] = [
  { href: "/tools", label: "Центр инструментов" },
  { href: "/constructor", label: "3D-Конструктор" },
  { href: "/tools/defects", label: "Диагностика дефектов" },
];

const MOBILE_LINK_CLASS =
  "flex min-h-11 items-center rounded-xl px-3 text-base font-medium text-slate-200 transition-colors hover:bg-white/5 hover:text-white focus-visible:bg-white/5 focus-visible:outline-none";

function BurgerIcon({ isOpen }: { isOpen: boolean }) {
  if (isOpen) {
    return (
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        fill="none"
        focusable="false"
        viewBox="0 0 24 24"
      >
        <path
          d="m6 6 12 12M18 6 6 18"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

/**
 * Бургер-меню для экранов уже `xl`, где десктопная навигация скрыта.
 *
 * Панель позиционируется абсолютно относительно `<header>` (у него
 * `position: sticky`), а не относительно кнопки: так на узких экранах она
 * растягивается по ширине окна и не уезжает за левый край.
 */
export function MobileMenu({ isAuthorized, lessonsHref }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!(event.target instanceof Node)) {
        return;
      }

      const isInsideButton = buttonRef.current?.contains(event.target);
      const isInsidePanel = panelRef.current?.contains(event.target);

      if (!isInsideButton && !isInsidePanel) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const closeMenu = () => setIsOpen(false);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls="mobile-menu"
        aria-label={isOpen ? "Закрыть меню" : "Открыть меню"}
        onClick={() => setIsOpen((open) => !open)}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 xl:hidden ${
          isOpen
            ? "border-blue-400/50 bg-blue-500/15 text-blue-300"
            : "border-white/15 bg-white/5 text-slate-200 hover:border-white/25 hover:text-white"
        }`}
      >
        <BurgerIcon isOpen={isOpen} />
      </button>

      {isOpen ? (
        <div
          ref={panelRef}
          id="mobile-menu"
          className="absolute inset-x-4 top-full z-50 mt-3 max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain rounded-3xl border border-white/10 bg-slate-900 p-3 shadow-2xl shadow-slate-950/60 xl:hidden"
        >
          <nav aria-label="Мобильная навигация">
            <ul className="space-y-1">
              {MAIN_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={closeMenu}
                    className={MOBILE_LINK_CLASS}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}

            </ul>

            <p className="mt-4 border-t border-white/10 px-3 pt-4 pb-2 text-[11px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
              Инструменты
            </p>
            <ul className="space-y-1">
              {TOOL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={closeMenu}
                    className={MOBILE_LINK_CLASS}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}

            </ul>

            <div className="mt-4 space-y-1 border-t border-white/10 pt-4">
              {/*
                Активация промокода — до профиля и выхода: покупатель кода из
                Ozon ищет её в конце меню, рядом с остальными действиями.
              */}
              <Link
                href="/activate"
                onClick={closeMenu}
                className={MOBILE_LINK_CLASS}
              >
                Активировать код
              </Link>

              {isAuthorized ? (
                <>
                  <Link
                    href={lessonsHref}
                    onClick={closeMenu}
                    className={MOBILE_LINK_CLASS}
                  >
                    Мои уроки
                  </Link>
                  <Link
                    href="/profiles"
                    onClick={closeMenu}
                    className={MOBILE_LINK_CLASS}
                  >
                    Профили печати
                  </Link>
                  <Link
                    href="/dashboard"
                    onClick={closeMenu}
                    className={MOBILE_LINK_CLASS}
                  >
                    Личный кабинет
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    onClick={closeMenu}
                    className={MOBILE_LINK_CLASS}
                  >
                    Войти
                  </Link>
                  <Link
                    href="/subscription"
                    onClick={closeMenu}
                    className="mt-1 flex min-h-12 items-center justify-center rounded-xl bg-blue-500 px-3 text-base font-semibold text-white transition-colors hover:bg-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                  >
                    Начать обучение
                  </Link>
                </>
              )}

            </div>
          </nav>
        </div>
      ) : null}
    </>
  );
}
