"use client";

import { useRouter } from "next/navigation";
import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { createCourseReview } from "@/app/actions/reviews";
import { emptyReviewFormState } from "@/app/actions/reviews-state";
import {
  REVIEW_BODY_MAX,
  REVIEW_BODY_MIN,
  REVIEW_MAX_RATING,
  type ReviewCourseId,
} from "@/lib/reviews";

const fieldClassName =
  "mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-white outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40";

const STARS = Array.from({ length: REVIEW_MAX_RATING }, (_, index) => index + 1);

/**
 * Модальное окно отзыва о курсе.
 *
 * Отзыв доступен только выпускнику: страница «Центр выпускника» открывается
 * после завершения курса, а Server Action повторно проверяет прогресс. Оценка
 * выбирается звёздами, текст уходит в форму вместе со скрытым полем rating.
 *
 * После успешной отправки окно показывает подтверждение, а «Готово» закрывает
 * его и обновляет страницу — новый отзыв появляется в списке без перезагрузки.
 */
export function ReviewFormModal({
  courseId,
  courseTitle,
}: {
  courseId: ReviewCourseId;
  courseTitle: string;
}) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(REVIEW_MAX_RATING);
  const [state, formAction, isPending] = useActionState(
    createCourseReview,
    emptyReviewFormState,
  );

  // После закрытия возвращаем фокус на кнопку, которая открыла окно: так
  // клавиатурный пользователь не теряет место на странице. Если отзыв ушёл
  // успешно, дополнительно обновляем серверные данные — новый отзыв появляется
  // в списке без ручной перезагрузки.
  const close = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();

    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, close]);

  // Пока диалог открыт, страница под ним не прокручивается — как в остальных
  // модальных окнах проекта.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-blue-600 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        <span aria-hidden>★</span>
        Оставить отзыв
      </button>

      {isOpen ? (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              close();
            }
          }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-4 backdrop-blur-sm sm:items-center"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-modal-title"
            className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black/50 sm:p-8"
          >
            {state.success ? (
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
                  Готово
                </p>
                <h2
                  id="review-modal-title"
                  className="mt-3 text-2xl font-extrabold tracking-tight text-white"
                >
                  Спасибо за отзыв!
                </h2>
                <p className="mt-3 text-base leading-relaxed text-slate-300">
                  {state.success} Он уже виден другим выпускникам курса
                  «{courseTitle}».
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  Готово
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
                      Отзыв о курсе
                    </p>
                    <h2
                      id="review-modal-title"
                      className="mt-3 text-2xl font-extrabold tracking-tight text-white"
                    >
                      {courseTitle}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Закрыть окно отзыва"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-lg text-slate-300 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  >
                    <span aria-hidden>✕</span>
                  </button>
                </div>

                <form action={formAction} className="mt-6 space-y-5">
                  <input type="hidden" name="courseId" value={courseId} />
                  <input type="hidden" name="rating" value={rating} />

                  {/* Ловушка для спам-ботов. Человек этого поля не видит. */}
                  <div aria-hidden className="hidden">
                    <label htmlFor="review-website">Сайт</label>
                    <input
                      id="review-website"
                      name="website"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </div>

                  <fieldset>
                    <legend className="text-sm font-semibold text-slate-200">
                      Оценка
                    </legend>
                    <div className="mt-2 flex items-center gap-1">
                      {STARS.map((star) => {
                        const isActive = star <= rating;

                        return (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRating(star)}
                            aria-label={`${star} из ${REVIEW_MAX_RATING}`}
                            aria-pressed={rating === star}
                            className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-3xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                              isActive
                                ? "text-amber-300 hover:text-amber-200"
                                : "text-slate-600 hover:text-slate-400"
                            }`}
                          >
                            <span aria-hidden>★</span>
                          </button>
                        );
                      })}
                      <span className="ml-2 text-sm font-semibold tabular-nums text-slate-300">
                        {rating} из {REVIEW_MAX_RATING}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-300">
                      {rating >= 4
                        ? "Рады, что курс пригодился."
                        : "Честная оценка помогает сделать курс лучше."}
                    </p>
                  </fieldset>

                  <div>
                    <label
                      htmlFor="review-body"
                      className="block text-sm font-semibold text-slate-200"
                    >
                      Что запомнилось
                    </label>
                    <textarea
                      id="review-body"
                      name="body"
                      rows={6}
                      required
                      minLength={REVIEW_BODY_MIN}
                      maxLength={REVIEW_BODY_MAX}
                      autoFocus
                      placeholder="Что получилось после курса? Какой урок оказался самым полезным?"
                      className={fieldClassName}
                    />
                    <p className="mt-2 text-xs text-slate-300">
                      От {REVIEW_BODY_MIN} до {REVIEW_BODY_MAX} символов. Отзыв
                      публикуется сразу и подписывается именем из профиля.
                    </p>
                  </div>

                  {state.error ? (
                    <p
                      role="alert"
                      className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
                    >
                      <span aria-hidden>⚠️</span> {state.error}
                    </p>
                  ) : null}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="submit"
                      disabled={isPending}
                      aria-busy={isPending}
                      className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isPending ? "Отправляем…" : "Опубликовать отзыв"}
                    </button>
                    <button
                      type="button"
                      onClick={close}
                      className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 px-6 text-sm font-semibold text-slate-200 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    >
                      Отмена
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

