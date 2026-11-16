"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  visibleToolLinks,
  type ToolIconName,
  type ToolLink,
} from "@/components/navigation/tool-links";

/**
 * Пункт «Мастерская (Pro)»: ссылка и подпись под ним.
 *
 * Куда вести — решает шапка, а не меню: гость уходит на вход, ученик без
 * пакета — на тарифы, обладатель пакета — в саму мастерскую. Так меню остаётся
 * простым клиентским компонентом и не знает про сессию и подписку.
 */
export type WorkshopLink = {
  href: string;
  note: string;
};

/** Маленькая стрелка вниз: поворачивается, когда меню открыто. */
function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 12 12"
    >
      <path
        d="m2.5 4.5 3.5 3.5 3.5-3.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

/**
 * Иконка инструмента. Рисунок мелкий и декоративный: смысл несёт подпись,
 * поэтому `aria-hidden`, а размер задаёт иконка-обёртка в ссылке.
 */
function ToolIcon({
  name,
  className,
}: {
  name: ToolIconName;
  className?: string;
}) {
  if (name === "workshop") {
    // Принтер: мастерская — про заказы, склад и печать.
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        focusable="false"
        viewBox="0 0 24 24"
      >
        <path
          d="M7.4 9V4.5h9.2V9"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M7.4 17.6H5.4A1.4 1.4 0 0 1 4 16.2v-5.4A1.4 1.4 0 0 1 5.4 9.4h13.2A1.4 1.4 0 0 1 20 10.8v5.4a1.4 1.4 0 0 1-1.4 1.4h-2"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M7.4 14.4h9.2V20H7.4z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M16.6 12.4h.9"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.7"
        />
      </svg>
    );
  }

  if (name === "constructor") {
    // Куб: конструктор собирает объёмные модели из параметров.
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        focusable="false"
        viewBox="0 0 24 24"
      >
        <path
          d="m12 3.4 7.6 4.3v8.6L12 20.6 4.4 16.3V7.7L12 3.4Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="m4.6 7.8 7.4 4.2 7.4-4.2"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M12 12v8.5"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  if (name === "gallery") {
    // Картина: галерея показывает работы сообщества.
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        focusable="false"
        viewBox="0 0 24 24"
      >
        <path
          d="M4.2 5.6h15.6v12.8H4.2z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <circle
          cx="8.8"
          cy="9.8"
          r="1.4"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="m4.6 16.4 4.4-4.2 3.3 3.1 2.6-2.4 4.5 4.3"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  if (name === "models") {
    // Четыре плитки: история генераций — это коллекция моделей.
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        focusable="false"
        viewBox="0 0 24 24"
      >
        <path
          d="M4.6 4.6h5.6v5.6H4.6zM13.8 4.6h5.6v5.6h-5.6zM4.6 13.8h5.6v5.6H4.6zM13.8 13.8h5.6v5.6h-5.6z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  if (name === "generate") {
    // Камера: генератор собирает 3D-модель по одному снимку.
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        focusable="false"
        viewBox="0 0 24 24"
      >
        <path
          d="M4.2 8.4h3.1l1.3-2.1h6.8l1.3 2.1h3.1v10.2H4.2z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <circle
          cx="12"
          cy="13.3"
          r="3"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  if (name === "profiles") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        focusable="false"
        viewBox="0 0 24 24"
      >
        <path
          d="m12 3.5 8.4 4.3-8.4 4.3-8.4-4.3L12 3.5Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="m3.6 12 8.4 4.3 8.4-4.3"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <circle
        cx="10.6"
        cy="10.6"
        r="6.4"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="m15.4 15.4 4.4 4.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/**
 * Выпадающее меню «Инструменты» для десктопной навигации.
 *
 * Это единственный клиентский элемент шапки: остальная навигация остаётся
 * серверной. Меню закрывается по Escape, клику вне панели и переходу по
 * ссылке; после Escape фокус возвращается на кнопку. Список ссылок — обычный
 * `<ul>`, а не `role="menu"`: так ссылки работают привычными Tab/Enter без
 * собственной реализации клавиатурного меню.
 *
 * Инструменты идут в общем порядке (`TOOL_LINKS`), «Мастерская (Pro)» — последней
 * и подписана по доступу: подпись «Требуется подписка Pro» объясняет, почему
 * пункт ведёт на тарифы. «Мои модели» гость не видит: шапка передаёт
 * `isAuthorized`, а фильтр списка общий с бургер-меню.
 */
export function ToolsDropdown({
  workshop,
  isAuthorized,
}: {
  workshop: WorkshopLink;
  isAuthorized: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const toolLinks: ToolLink[] = [
    ...visibleToolLinks(isAuthorized),
    {
      href: workshop.href,
      title: "Мастерская (Pro)",
      description: workshop.note,
      icon: "workshop",
      badge: "Pro",
    },
  ];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
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

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls="tools-dropdown"
        onClick={() => setIsOpen((open) => !open)}
        className={`inline-flex items-center gap-1.5 transition-colors hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
          isOpen ? "text-blue-400" : ""
        }`}
      >
        Инструменты
        <ChevronIcon
          className={`h-3 w-3 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen ? (
        <div
          id="tools-dropdown"
          className="absolute top-full left-1/2 z-50 mt-3 w-80 -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-900 p-2 shadow-2xl shadow-slate-950/60"
        >
          <p className="px-3 pt-2 pb-2 text-[11px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
            Инструменты TriDi
          </p>
          <ul className="space-y-1">
            {toolLinks.map((tool) => (
              <li key={tool.href}>
                <Link
                  href={tool.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.07] focus-visible:bg-white/[0.07] focus-visible:outline-none"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300">
                    <ToolIcon name={tool.icon} className="h-4 w-4" />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                      {tool.title}
                      {tool.badge ? (
                        <span className="rounded-full border border-blue-400/30 bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.1em] text-blue-300 uppercase">
                          {tool.badge}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs leading-relaxed text-slate-300">
                      {tool.description}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {/*
            Подвал меню: каталог со всеми разделами (`/tools`). Там диагностика
            дефектов и остальные страницы, которые в список инструментов не
            входят, поэтому ссылка стоит после `<ul>`, а не пунктом списка.
          */}
          <Link
            href="/tools"
            onClick={() => setIsOpen(false)}
            className="mt-1 flex items-center justify-between gap-2 rounded-xl border-t border-white/10 px-3 pt-3 pb-2 text-xs font-semibold text-slate-300 transition-colors hover:text-white focus-visible:text-white focus-visible:outline-none"
          >
            Все инструменты
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
