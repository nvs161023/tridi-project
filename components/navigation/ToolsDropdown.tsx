"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type ToolLink = {
  href: string;
  title: string;
  description: string;
};

/** Три инструмента, на которые ведёт меню «Инструменты» в шапке. */
const TOOL_LINKS: ToolLink[] = [
  {
    href: "/constructor",
    title: "3D-Конструктор",
    description: "Параметрические вазы и брелоки, экспорт STL",
  },
  {
    href: "/profiles",
    title: "Библиотека профилей",
    description: "Настройки слайсеров и материалов",
  },
  {
    href: "/tools/defects",
    title: "Диагностика дефектов",
    description: "Причины и пошаговые решения",
  },
];

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
 * Выпадающее меню «Инструменты» для десктопной навигации.
 *
 * Это единственный клиентский элемент шапки: остальная навигация остаётся
 * серверной. Меню закрывается по Escape, клику вне панели и переходу по
 * ссылке; после Escape фокус возвращается на кнопку. Список ссылок — обычный
 * `<ul>`, а не `role="menu"`: так ссылки работают привычными Tab/Enter без
 * собственной реализации клавиатурного меню.
 */
export function ToolsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
            {TOOL_LINKS.map((tool) => (
              <li key={tool.href}>
                <Link
                  href={tool.href}
                  onClick={() => setIsOpen(false)}
                  className="flex flex-col gap-0.5 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.07] focus-visible:bg-white/[0.07] focus-visible:outline-none"
                >
                  <span className="text-sm font-semibold text-slate-100">
                    {tool.title}
                  </span>
                  <span className="text-xs leading-relaxed text-slate-300">
                    {tool.description}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
