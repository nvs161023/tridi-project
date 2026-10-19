"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Defect } from "@/lib/defects";

type DefectsExplorerProps = {
  defects: Defect[];
};

/** Цвета карточек: чередуются, чтобы сетка не выглядела однообразной. */
const CARD_ACCENTS = [
  "border-blue-400/25 bg-blue-500/10 text-blue-300",
  "border-violet-400/25 bg-violet-500/10 text-violet-300",
  "border-amber-400/25 bg-amber-500/10 text-amber-300",
  "border-rose-400/25 bg-rose-500/10 text-rose-300",
  "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
  "border-cyan-400/25 bg-cyan-500/10 text-cyan-300",
];

/** Треугольник с восклицательным знаком — общий маркер дефекта. */
function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 3.6 21 19.2H3L12 3.6Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M12 9.4v4.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="16.4" fill="currentColor" r="0.9" />
    </svg>
  );
}

/**
 * Каталог дефектов: сетка карточек и модальное окно с причинами и решениями.
 *
 * Клиентский компонент нужен только ради открытия карточки: сами данные
 * приходят из серверной страницы (`lib/defects.ts`), поэтому справочник можно
 * читать и без JavaScript — текст карточек остаётся в HTML.
 *
 * В модальном окне закрытие работает по Escape, клику по фону и кнопке;
 * фокус переводится на кнопку закрытия и возвращается на карточку после
 * закрытия. Прокрутка страницы под окном блокируется.
 */
export function DefectsExplorer({ defects }: DefectsExplorerProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  const activeDefect =
    activeIndex === null ? null : (defects[activeIndex] ?? null);

  const closeDialog = useCallback(() => {
    setActiveIndex(null);
    // Возвращаем фокус на карточку, с которой открыли окно, — иначе после
    // Escape клавиатурный пользователь оказывается в начале страницы.
    window.requestAnimationFrame(() => lastFocusedRef.current?.focus());
  }, []);

  function openDialog(index: number) {
    lastFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    setActiveIndex(index);
  }

  useEffect(() => {
    if (!activeDefect) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) {
        return;
      }

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const focusTimer = window.setTimeout(
      () => closeButtonRef.current?.focus(),
      0,
    );

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [activeDefect, closeDialog]);

  return (
    <>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {defects.map((defect, index) => {
          const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];

          return (
            <button
              key={defect.id}
              type="button"
              aria-haspopup="dialog"
              onClick={() => openDialog(index)}
              className="group flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-left transition duration-200 hover:-translate-y-1 hover:border-blue-400/50 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:p-7"
            >
              <span className="flex items-start justify-between gap-4">
                <span
                  className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border ${accent}`}
                >
                  <WarningIcon className="h-6 w-6" />
                </span>
                <span className="font-mono text-xs tracking-widest text-slate-400">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </span>

              <span className="mt-5 block text-xl font-bold tracking-tight text-white sm:text-2xl">
                {defect.title}
              </span>

              <span className="mt-3 block flex-1 text-base leading-relaxed text-slate-200">
                {defect.description}
              </span>

              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-300 transition-colors group-hover:text-blue-200">
                Причины и решения
                <span
                  aria-hidden="true"
                  className="transition-transform duration-200 group-hover:translate-x-1"
                >
                  →
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {activeDefect && activeIndex !== null ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDialog();
            }
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="defect-dialog-title"
            className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-900 shadow-2xl shadow-slate-950/60 sm:rounded-3xl"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-slate-900/95 px-5 py-5 backdrop-blur sm:px-7">
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-[0.18em] text-blue-300 uppercase">
                  Дефект {activeIndex + 1} из {defects.length}
                </p>
                <h2
                  id="defect-dialog-title"
                  className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
                >
                  {activeDefect.title}
                </h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeDialog}
                aria-label="Закрыть окно"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-200 transition-colors hover:border-blue-400/50 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              >
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  focusable="false"
                  viewBox="0 0 20 20"
                >
                  <path
                    d="m5 5 10 10M15 5 5 15"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.7"
                  />
                </svg>
              </button>
            </div>

            <div className="px-5 py-6 sm:px-7 sm:py-7">
              <p className="text-base leading-relaxed text-slate-200 sm:text-lg">
                {activeDefect.description}
              </p>

              <section className="mt-7" aria-labelledby="defect-causes-title">
                <h3
                  id="defect-causes-title"
                  className="text-lg font-bold text-white sm:text-xl"
                >
                  Почему так происходит
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {activeDefect.causes.map((cause) => (
                    <li
                      key={cause}
                      className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-base leading-relaxed text-slate-200"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"
                      />
                      <span>{cause}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="mt-7" aria-labelledby="defect-solutions-title">
                <h3
                  id="defect-solutions-title"
                  className="text-lg font-bold text-white sm:text-xl"
                >
                  Что делать по шагам
                </h3>
                <ol className="mt-4 space-y-2.5">
                  {activeDefect.solutions.map((solution, index) => (
                    <li
                      key={solution}
                      className="flex gap-3 rounded-2xl border border-blue-400/15 bg-blue-500/[0.06] px-4 py-3 text-base leading-relaxed text-slate-200"
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/20 font-mono text-xs font-bold text-blue-200"
                      >
                        {index + 1}
                      </span>
                      <span className="pt-0.5">{solution}</span>
                    </li>
                  ))}
                </ol>
              </section>

              <p className="mt-7 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.07] px-4 py-3.5 text-sm leading-relaxed text-slate-200 sm:text-base">
                <span className="font-semibold text-emerald-200">Совет:</span>{" "}
                меняйте одну настройку за раз и печатайте короткий тест. Так вы
                поймёте, что именно убрало дефект, а не будете угадывать по
                готовой детали.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
