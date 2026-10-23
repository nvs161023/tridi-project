"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";

import { saveConstructorProject } from "@/app/actions/projects";
import {
  MODEL_TYPE_LABELS,
  type ConstructorParams,
} from "@/lib/constructor/params";
import {
  SAVED_PROJECT_TITLE_MAX,
  SAVED_PROJECT_TITLE_MIN,
  suggestProjectTitle,
} from "@/lib/constructor/projects";

const inputClassName =
  "mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-white outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40";

const primaryButtonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-70";

const secondaryButtonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900";

/**
 * Кнопка «Сохранить проект» и окно с названием.
 *
 * Параметры модели уходят в Server Action целиком: сервер нормализует их ещё
 * раз, поэтому подменённые в DevTools размеры не попадут в базу. Название по
 * умолчанию собирается в обработчике клика — дата в браузере и на сервере
 * может отличаться, и разметка при гидратации не разойдётся.
 *
 * После сохранения окно закрывается, а рядом с кнопкой на четыре секунды
 * появляется подтверждение: оно подсказывает, где искать проект.
 */
export function SaveProjectDialog({ params }: { params: ConstructorParams }) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savedTitle, setSavedTitle] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const dialogTitleId = useId();

  /** Закрытие возвращает фокус на кнопку, с которой открыли окно. */
  const close = useCallback(() => {
    setIsOpen(false);
    setError(null);
    triggerRef.current?.focus();
  }, []);

  // Escape закрывает окно, а страница под ним не прокручивается — как в
  // остальных модальных окнах проекта.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, close]);

  // Таймер подтверждения не должен пережить компонент.
  useEffect(
    () => () => {
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
    },
    [],
  );

  function openDialog() {
    setTitle(suggestProjectTitle(params.model));
    setError(null);
    setIsOpen(true);
  }

  function showSavedNotice(value: string) {
    setSavedTitle(value);

    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }

    noticeTimerRef.current = window.setTimeout(() => {
      noticeTimerRef.current = null;
      setSavedTitle(null);
    }, 4000);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = title.trim();

    if (trimmed.length < SAVED_PROJECT_TITLE_MIN) {
      setError("Введите название проекта.");
      inputRef.current?.focus();

      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await saveConstructorProject({ title: trimmed, params });

      if (!result.ok) {
        setError(result.error);

        return;
      }

      setIsOpen(false);
      showSavedNotice(trimmed);
      triggerRef.current?.focus();
    });
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openDialog}
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 text-sm font-semibold text-slate-200 transition-colors hover:border-blue-400/50 hover:bg-blue-500/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        <span aria-hidden>💾</span>
        Сохранить проект
      </button>

      {savedTitle ? (
        <p
          role="status"
          className="text-sm font-medium text-emerald-200 sm:ml-2"
        >
          Проект «{savedTitle}» сохранён — он есть в кабинете.
        </p>
      ) : null}

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-4 backdrop-blur-sm sm:items-center"
          onMouseDown={(event) => {
            // Клик по затемнению закрывает окно, клик по карточке — нет.
            if (event.target === event.currentTarget) {
              close();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 text-left shadow-2xl shadow-slate-950/60 sm:p-7"
          >
            <h2
              id={dialogTitleId}
              className="text-xl font-extrabold tracking-tight text-white"
            >
              Название проекта
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              {MODEL_TYPE_LABELS[params.model]} сохранится со всеми текущими
              настройками. Открыть её можно в кабинете, в разделе «Мои
              3D-проекты».
            </p>

            <form onSubmit={handleSubmit} className="mt-5">
              <label
                htmlFor={`${dialogTitleId}-title`}
                className="block text-sm font-semibold text-slate-200"
              >
                Название
              </label>
              <input
                ref={inputRef}
                id={`${dialogTitleId}-title`}
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={SAVED_PROJECT_TITLE_MAX}
                required
                autoFocus
                autoComplete="off"
                className={inputClassName}
              />
              <p className="mt-2 text-xs text-slate-400">
                До {SAVED_PROJECT_TITLE_MAX} символов. Название видите только
                вы.
              </p>

              {error ? (
                <p
                  role="alert"
                  className="mt-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
                >
                  <span aria-hidden>⚠️</span> {error}
                </p>
              ) : null}

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={close}
                  className={secondaryButtonClassName}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  aria-busy={isPending}
                  className={primaryButtonClassName}
                >
                  {isPending ? "Сохраняем…" : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
