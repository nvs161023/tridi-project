"use client";

import { useEffect, useId, useRef, useState } from "react";

import { HelpIcon } from "@/components/workshop/WorkshopIcons";
import type { TabHelpEntry } from "@/components/workshop/workshop-tab-help";

/**
 * Подсказка «?» в шапке вкладки Мастерской.
 *
 * Мастер открывает вкладку «Склад» и не помнит, что там за «порог покупки» —
 * запускать ради этого тур из десяти шагов смешно. Кнопка открывает поповер с
 * тем же описанием, что в шаге тура: текст берётся из `TAB_HELP`, поэтому
 * подсказка и тур не расходятся.
 *
 * Поповер, а не модалка: он не блокирует прокрутку и не крадёт фокус у
 * страницы, а закрывается кликом мимо и Escape — как ожидается от подсказки.
 * `aria-expanded` и `aria-controls` связывают кнопку с панелью: скринридер
 * сообщает, что подсказка открыта, и читает её при переходе.
 */

type TabHelpButtonProps = {
  help: TabHelpEntry;
  /** Дополнительный класс обёртки: отступы в шапке вкладки задаёт родитель. */
  className?: string;
};

export function TabHelpButton({ help, className = "" }: TabHelpButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    // Escape возвращает фокус на кнопку: иначе он остаётся на исчезнувшей
    // панели, и следующее нажатие Tab начинается с начала страницы.
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={`Что делает вкладка «${help.title}»`}
        title={`Что делает вкладка «${help.title}»`}
        data-tab-help={help.id}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] ${
          isOpen
            ? "border-blue-400/40 bg-blue-500/15 text-blue-200"
            : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
        }`}
      >
        <HelpIcon className="h-4 w-4 shrink-0" />
      </button>

      {isOpen ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={`Подсказка: ${help.title}`}
          className="absolute top-full right-0 z-30 mt-2 w-[min(20rem,calc(100vw-2.5rem))] rounded-2xl border border-white/10 bg-[#0a0a0a] p-4 text-left shadow-[0_24px_70px_-30px_rgba(0,0,0,0.95)]"
        >
          <p className="text-[10px] font-semibold tracking-[0.18em] text-blue-300 uppercase">
            {help.title}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-zinc-300">{help.text}</p>
        </div>
      ) : null}
    </div>
  );
}
