"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";

import { submitConstructorFeedback } from "@/app/actions/projects";
import {
  MODEL_TYPE_LABELS,
  type ModelType,
} from "@/lib/constructor/params";
import {
  FEEDBACK_RATING_MAX,
  FEEDBACK_TEXT_MAX,
} from "@/lib/constructor/projects";

const STARS = Array.from(
  { length: FEEDBACK_RATING_MAX },
  (_, index) => index + 1,
);

const textareaClassName =
  "mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-white outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40";

/**
 * Короткий опрос после скачивания STL.
 *
 * Окно открывает конструктор: после третьего скачивания и дальше каждый
 * десятый файл. Оценка 1–5 обязательна, комментарий — нет. «Пропустить» и
 * Escape закрывают окно без записи в базу: навязывать отзыв нельзя.
 *
 * После успеха показываем «Спасибо» и закрываемся сами через 1.8 секунды —
 * так же ведёт себя окно отзыва о курсе.
 */
export function FeedbackDialog({
  model,
  onClose,
}: {
  model: ModelType;
  /** Закрытие окна: конструктор убирает его из разметки. */
  onClose: () => void;
}) {
  const [rating, setRating] = useState(FEEDBACK_RATING_MAX);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dialogTitleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  /** Escape закрывает окно, как в остальных диалогах проекта. */
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Подтверждение живёт недолго: после успеха окно закрывается само.
  useEffect(() => {
    if (!done) {
      return;
    }

    const timeout = window.setTimeout(onClose, 1800);

    return () => window.clearTimeout(timeout);
  }, [done, onClose]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await submitConstructorFeedback({
        modelType: model,
        rating,
        feedbackText: text,
      });

      if (!result.ok) {
        setError(result.error);

        return;
      }

      setDone(true);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(event) => {
        // Клик по затемнению закрывает окно, клик по карточке — нет.
        if (event.target === event.currentTarget && !isPending) {
          onClose();
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
          {done ? "Спасибо!" : "Как вам конструктор?"}
        </h2>

        {done ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Оценка сохранена. Мы читаем каждое сообщение и правим по ним
              модели и подсказки.
            </p>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              autoFocus
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            >
              Закрыть
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Вы скачали модель «{MODEL_TYPE_LABELS[model]}». Оцените, насколько
              удобно было её настраивать, — это займёт несколько секунд.
            </p>

            <fieldset className="mt-5">
              <legend className="text-sm font-semibold text-slate-200">
                Оценка
              </legend>
              <div className="mt-2 flex items-center gap-1">
                {STARS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    aria-label={`${value} из ${FEEDBACK_RATING_MAX}`}
                    aria-pressed={value <= rating}
                    className={`text-3xl leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                      value <= rating
                        ? "text-amber-300 hover:text-amber-200"
                        : "text-slate-600 hover:text-slate-400"
                    }`}
                  >
                    <span aria-hidden>★</span>
                  </button>
                ))}
                <span className="ml-2 text-sm font-semibold tabular-nums text-slate-300">
                  {rating} из {FEEDBACK_RATING_MAX}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-300">
                {rating >= 4
                  ? "Рады, что конструктор пригодился."
                  : "Честная оценка помогает исправить неудобное."}
              </p>
            </fieldset>

            <div className="mt-4">
              <label
                htmlFor={`${dialogTitleId}-text`}
                className="block text-sm font-semibold text-slate-200"
              >
                Комментарий (необязательно)
              </label>
              <textarea
                id={`${dialogTitleId}-text`}
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={3}
                maxLength={FEEDBACK_TEXT_MAX}
                placeholder="Что пошло не так или чего не хватило?"
                className={textareaClassName}
              />
              <p className="mt-2 text-xs text-slate-400">
                До {FEEDBACK_TEXT_MAX} символов. Сообщение видит только команда
                TriDi.
              </p>
            </div>

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
                onClick={onClose}
                disabled={isPending}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Пропустить
              </button>
              <button
                type="submit"
                disabled={isPending}
                aria-busy={isPending}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isPending ? "Отправляем…" : "Отправить оценку"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
