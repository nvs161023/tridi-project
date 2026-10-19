"use server";

import { revalidatePath } from "next/cache";

import {
  getCourseCompletionFromRows,
  readCourseProgressRows,
} from "@/lib/course-completion";
import {
  isReviewCourseId,
  REVIEW_BODY_MAX,
  REVIEW_BODY_MIN,
  REVIEW_MAX_RATING,
  REVIEW_MIN_RATING,
} from "@/lib/reviews";
import { createClient } from "@/lib/supabase/server";

import type { ReviewFormState } from "@/app/actions/reviews-state";

const REVIEWS_UNAVAILABLE =
  "Отзывы временно недоступны. Попробуйте ещё раз через минуту.";

/** Таблицы ещё нет — миграцию course_reviews.sql не применили. */
function isMissingReviewSchema(
  code: string | undefined,
  message: string,
): boolean {
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.toLowerCase().includes("could not find the table")
  );
}

/**
 * Оставляет отзыв о курсе.
 *
 * Порядок проверок:
 *   1. ключ курса, оценка и текст — значения пришли из браузера;
 *   2. реальная сессия (getUser, а не getSession);
 *   3. курс действительно завершён: все уроки с материалом пройдены и все
 *      тесты сданы — те же правила, что у сертификата;
 *   4. insert от своего имени. Повторный отзыв по тому же курсу ловит
 *      уникальный индекс и возвращает понятный текст.
 *
 * Honeypot `website` заполняют только боты. Им отвечаем как обычно, но строку
 * не пишем, чтобы не подсказывать, какое поле их выдало.
 */
export async function createCourseReview(
  _previousState: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const courseId = String(formData.get("courseId") ?? "").trim();

  if (!isReviewCourseId(courseId)) {
    return { error: "Неизвестный курс." };
  }

  if (String(formData.get("website") ?? "").trim() !== "") {
    return { success: "Спасибо! Отзыв опубликован." };
  }

  const rating = Number(formData.get("rating"));

  if (
    !Number.isInteger(rating) ||
    rating < REVIEW_MIN_RATING ||
    rating > REVIEW_MAX_RATING
  ) {
    return { error: "Поставьте оценку от 1 до 5 звёзд." };
  }

  const body = String(formData.get("body") ?? "")
    .replace(/\r\n/g, "\n")
    .trim();

  if (body.length < REVIEW_BODY_MIN) {
    return { error: `Расскажите чуть подробнее — минимум ${REVIEW_BODY_MIN} символов.` };
  }

  if (body.length > REVIEW_BODY_MAX) {
    return { error: `Отзыв длиннее ${REVIEW_BODY_MAX} символов. Сократите текст.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Войдите в аккаунт, чтобы оставить отзыв." };
  }

  const progress = await readCourseProgressRows(supabase, user.id, courseId);

  if (progress.failed) {
    return { error: "Не удалось проверить прогресс курса. Попробуйте ещё раз." };
  }

  const completion = getCourseCompletionFromRows(courseId, progress.rows);

  if (!completion.isComplete) {
    return { error: "Отзыв можно оставить после завершения курса." };
  }

  const { error } = await supabase.from("course_reviews").insert({
    course_id: courseId,
    user_id: user.id,
    rating,
    body,
  });

  if (error) {
    console.warn("Отзыв не сохранён:", error.code, error.message);

    if (isMissingReviewSchema(error.code, error.message)) {
      return { error: REVIEWS_UNAVAILABLE };
    }

    if (error.code === "23505") {
      return { error: "Вы уже оставили отзыв по этому курсу." };
    }

    if (error.code === "42501") {
      return { error: "Сессия истекла. Войдите заново и повторите отправку." };
    }

    return { error: "Не удалось сохранить отзыв. Попробуйте ещё раз." };
  }

  revalidatePath(`/course/${courseId}/complete`);

  return { success: "Спасибо! Отзыв опубликован." };
}
