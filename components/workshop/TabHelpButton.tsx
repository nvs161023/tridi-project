"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

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
 *
 * Позиционирование считается руками — `@floating-ui` в зависимостях нет, а
 * тянуть библиотеку ради одной панели не стоит. Панель живёт в портале с
 * `position: fixed`: абсолютный потомок обрезался бы `overflow-hidden` рабочей
 * области Мастерской и на 375px уезжал бы за экран. Координаты считает
 * `panelPosition`: по умолчанию панель раскрывается влево от кнопки (она стоит у
 * правого края шапки вкладки), а если слева места мало — вправо; по горизонтали
 * и вертикали результат зажимается в окно с отступом `EDGE_GAP`. Пересчёт идёт
 * на resize и на прокрутку, поэтому панель не отрывается от кнопки.
 */

/** Ширина панели на широком экране: 20rem, как было у подсказки в шапке. */
const PANEL_WIDTH = 320;

/** Отступ панели от краёв окна: чтобы она не прилипала к рамке экрана. */
const EDGE_GAP = 8;

/** Промежуток между кнопкой и панелью. */
const BUTTON_GAP = 8;

type PanelPosition = {
  top: number;
  left: number;
  width: number;
};

/**
 * Где рисовать панель: под кнопкой или над ней, слева или справа от неё.
 *
 * Высота берётся из DOM: она зависит от длины текста подсказки, и угадывать её
 * нельзя — панель «Интеграций» втрое выше панели «Склада».
 */
function panelPosition(button: HTMLElement, panel: HTMLElement): PanelPosition {
  const rect = button.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const width = Math.min(PANEL_WIDTH, viewportWidth - EDGE_GAP * 2);
  const height = panel.offsetHeight;

  const spaceLeft = rect.right - EDGE_GAP;
  const spaceRight = viewportWidth - rect.left - EDGE_GAP;

  // Раскрываем влево по умолчанию: кнопка «?» стоит у правого края шапки.
  // Вправо переходим, только если слева панель не влезает, а справа влезает.
  const openRight = spaceLeft < width && spaceRight > spaceLeft;
  const preferredLeft = openRight ? rect.left : rect.right - width;
  const left = Math.min(
    Math.max(preferredLeft, EDGE_GAP),
    viewportWidth - width - EDGE_GAP,
  );

  const spaceBelow = viewportHeight - rect.bottom - EDGE_GAP;
  const spaceAbove = rect.top - EDGE_GAP;
  const preferredTop =
    spaceBelow >= height || spaceBelow >= spaceAbove
      ? rect.bottom + BUTTON_GAP
      : rect.top - height - BUTTON_GAP;
  const top = Math.min(
    Math.max(preferredTop, EDGE_GAP),
    Math.max(viewportHeight - height - EDGE_GAP, EDGE_GAP),
  );

  return { top, left, width };
}

type TabHelpButtonProps = {
  help: TabHelpEntry;
  /** Дополнительный класс обёртки: отступы в шапке вкладки задаёт родитель. */
  className?: string;
};

export function TabHelpButton({ help, className = "" }: TabHelpButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const recalculate = useCallback(() => {
    const button = buttonRef.current;
    const panel = panelRef.current;

    if (!button || !panel) {
      return;
    }

    setPosition(panelPosition(button, panel));
  }, []);

  // Панель живёт в портале, поэтому «клик мимо» проверяет и обёртку, и саму
  // панель: иначе нажатие на текст подсказки закрывало бы её.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (
        wrapperRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }

      setIsOpen(false);
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

  /*
    Первый расчёт — в `useLayoutEffect`: панель уже отрисована (пусть и невидимая),
    координаты ставятся до отрисовки кадра, поэтому панель не «прыгает» из угла в
    позицию у кнопки. Прокрутка слушается в фазе перехвата: подсказка открывается
    и в уже прокрученной вкладке.
  */
  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    recalculate();

    window.addEventListener("resize", recalculate);
    window.addEventListener("scroll", recalculate, true);

    return () => {
      window.removeEventListener("resize", recalculate);
      window.removeEventListener("scroll", recalculate, true);
    };
  }, [isOpen, recalculate]);

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

      {isOpen
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-label={`Подсказка: ${help.title}`}
              data-tab-help-panel={help.id}
              style={
                position
                  ? {
                      top: position.top,
                      left: position.left,
                      width: position.width,
                    }
                  : // До первого расчёта панель не видна: иначе она мигнула бы
                    // в левом верхнем углу экрана.
                    { top: 0, left: 0, width: PANEL_WIDTH, visibility: "hidden" }
              }
              className="fixed z-[70] rounded-2xl border border-white/10 bg-[#0a0a0a] p-4 text-left shadow-[0_24px_70px_-30px_rgba(0,0,0,0.95)]"
            >
              <p className="text-xs font-semibold tracking-[0.18em] text-blue-300 uppercase">
                {help.title}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-300">
                {help.text}
              </p>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
