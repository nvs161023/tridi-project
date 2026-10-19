import { ReviewFormModal } from "@/components/reviews/ReviewFormModal";
import {
  formatReviewDate,
  pluralizeReviews,
  REVIEW_MAX_RATING,
  type CourseReview,
  type CourseReviewStats,
  type ReviewCourseId,
} from "@/lib/reviews";

const ratingFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const STARS = Array.from({ length: REVIEW_MAX_RATING }, (_, index) => index + 1);

/** Пять звёзд с заполнением по оценке — без иконочных библиотек. */
function RatingStars({ rating }: { rating: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`Оценка ${rating} из ${REVIEW_MAX_RATING}`}
    >
      {STARS.map((star) => (
        <span
          key={star}
          aria-hidden
          className={star <= rating ? "text-amber-300" : "text-slate-700"}
        >
          ★
        </span>
      ))}
    </span>
  );
}

/** Один отзыв: имя выпускника, звёзды, дата и текст с сохранёнными переносами. */
function ReviewCard({ review }: { review: CourseReview }) {
  return (
    <li className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white">{review.authorName}</p>
        <time dateTime={review.createdAt} className="text-xs text-slate-400">
          {formatReviewDate(review.createdAt)}
        </time>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <RatingStars rating={review.rating} />
        <span className="text-xs font-semibold text-slate-300">
          {review.rating}/{REVIEW_MAX_RATING}
        </span>
      </div>
      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
        {review.body}
      </p>
    </li>
  );
}

/**
 * Блок отзывов в «Центре выпускника».
 *
 * Список читается на сервере вместе с прогрессом, а форма показывается только
 * тому, кто завершил этот курс. Средняя оценка считается по загруженным отзывам
 * (последние 30) и не подменяется нулём, пока отзывов нет.
 */
export function CourseReviews({
  courseId,
  courseTitle,
  reviews,
  stats,
  canReview,
  hasReviewed = false,
}: {
  courseId: ReviewCourseId;
  courseTitle: string;
  reviews: CourseReview[];
  stats: CourseReviewStats;
  canReview: boolean;
  /** Ученик уже оставил отзыв: форма не нужна, но стоит сказать об этом. */
  hasReviewed?: boolean;
}) {
  return (
    <section
      aria-labelledby="course-reviews-title"
      className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            id="course-reviews-title"
            className="text-2xl font-extrabold tracking-tight text-white"
          >
            Отзывы выпускников
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            {stats.count > 0
              ? `${ratingFormatter.format(stats.average)} из ${REVIEW_MAX_RATING} · ${stats.count} ${pluralizeReviews(stats.count)}`
              : "Пока никто не оставил отзыв. Будьте первым."}
          </p>
          {stats.count > 0 ? (
            <div className="mt-2 flex items-center gap-2">
              <RatingStars rating={Math.round(stats.average)} />
              <span className="text-xs text-slate-400">
                Средняя оценка по отзывам
              </span>
            </div>
          ) : null}
        </div>

        {canReview ? (
          <ReviewFormModal courseId={courseId} courseTitle={courseTitle} />
        ) : hasReviewed ? (
          <p className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-200">
            Спасибо, ваш отзыв уже опубликован
          </p>
        ) : null}
      </div>

      {reviews.length > 0 ? (
        <ul className="mt-6 space-y-4">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </ul>
      ) : (
        <p className="mt-6 rounded-2xl border border-dashed border-white/15 px-5 py-6 text-sm leading-relaxed text-slate-300">
          Отзыв могут оставить выпускники курса. Завершите все уроки и тесты —
          и расскажите, что получилось.
        </p>
      )}
    </section>
  );
}
