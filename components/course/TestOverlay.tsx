"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ModuleTest } from "@/components/course/ModuleTest";
import { moduleTestThemes } from "@/components/course/module-test-theme";
import type { CourseTestVariant } from "@/lib/module-test";
import type { MiniCheckQuestion } from "@/lib/types";

/**
 * Тест модуля отдельным слайдом поверх урока.
 *
 * Зачем оверлей, а не переход на другую страницу: тест — обязательный шаг
 * («пока не пройдёшь — дальше не пускаем»), и человек должен видеть, что не
 * потерял урок. Поэтому слайд открывается поверх страницы урока, фон затемняется,
 * а закрыть его можно в любой момент — прогресс по уроку никуда не девается.
 *
 * Что важно в поведении:
 *  - Escape и клик по затемнению закрывают слайд, фокус возвращается на кнопку;
 *  - пока слайд открыт, страница под ним не прокручивается;
 *  - после сданного теста вызывается router.refresh(): страница урока под слайдом
 *    перерисовывается, и заблокированная кнопка «Продолжить курс» становится
 *    активной без ручной перезагрузки;
 *  - «сдал / не сдал» считает ModuleTest (layout="overlay") — логика вопросов
 *    ровно та же, что на странице /course/check/<модуль>.
 *
 * Доступность: role="dialog" + aria-modal, заголовок связан через aria-labelledby,
 * фокус при открытии уходит на кнопку «Закрыть тест».
 */
type TestOverlayProps = {
  /** Какой курс: от этого зависят цвета (синий базовый, янтарный продвинутый). */
  courseType: CourseTestVariant;
  /** Номер модуля для базы: код модуля (базовый) или место в курсе (продвинутый). */
  moduleNumber: number;
  moduleLabel: string;
  questions: MiniCheckQuestion[];
  /** Первый урок модуля — для ссылки «к урокам» на отдельной странице теста. */
  lessonsHref: string;
  /** Куда вести после сдачи: следующий урок курса или конструктор. */
  nextHref?: string;
  /** Подпись кнопки продолжения после сдачи. */
  continueLabel?: string;
  /** Текст на кнопке, которая открывает слайд. */
  triggerLabel: string;
  triggerVariant?: "primary" | "secondary";
  /** Строка под заголовком слайда: сколько вопросов и какой порог. */
  hint?: string;
};

export function TestOverlay({
  courseType,
  moduleNumber,
  moduleLabel,
  questions,
  lessonsHref,
  nextHref,
  continueLabel,
  triggerLabel,
  triggerVariant = "primary",
  hint,
}: TestOverlayProps) {
  const router = useRouter();
  const titleId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const theme = moduleTestThemes[courseType];

  const triggerClassName =
    triggerVariant === "secondary" ? theme.secondary : theme.primary;

  /** Закрыть слайд и вернуть фокус туда, откуда его открыли. */
  const close = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    const previousOverflow = document.body.style.overflow;

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, close]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        className={triggerClassName}
      >
        <span aria-hidden>🎯</span>
        {triggerLabel}
        <span aria-hidden>→</span>
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              close();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl shadow-black/60 sm:p-9"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  className={`text-xs font-semibold uppercase tracking-widest ${theme.eyebrow}`}
                >
                  Тест модуля · шаг перед следующим модулем
                </p>
                <h2
                  id={titleId}
                  className="mt-2 text-xl font-extrabold tracking-tight text-white sm:text-2xl"
                >
                  {moduleLabel}
                </h2>
                {hint ? (
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {hint}
                  </p>
                ) : null}
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                onClick={close}
                aria-label="Закрыть тест"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-lg text-slate-200 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              >
                <span aria-hidden>✕</span>
              </button>
            </div>

            <div className="mt-7">
              <ModuleTest
                layout="overlay"
                courseType={courseType}
                moduleNumber={moduleNumber}
                moduleLabel={moduleLabel}
                lessonsHref={lessonsHref}
                nextLessonHref={nextHref}
                continueLabel={continueLabel}
                questions={questions}
                onSaved={() => router.refresh()}
                onClose={close}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
