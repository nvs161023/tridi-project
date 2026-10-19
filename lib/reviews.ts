/**
 * Отзывы о курсах: типы, проверки и выборка для «Центра выпускника».
 *
 * Отзыв привязан к одному из четырёх уровней и к пользователю. Один ученик
 * оставляет один отзыв на курс — это гарантирует уникальный индекс в базе
 * (supabase/course_reviews.sql), а не только проверка в форме.
 *
 * Чтение идёт клиентом текущего пользователя: RLS разрешает select всем, а
 * имена авторов приходят из представления course_review_authors — profiles
 * закрыта и чужие имена напрямую не отдаёт.
 */
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Уровни, по которым можно оставить отзыв. */
export const REVIEW_COURSE_IDS = [
  "basic",
  "confident",
  "engineer",
  "profit",
] as const;

export type ReviewCourseId = (typeof REVIEW_COURSE_IDS)[number];

/** Проверка ключа из адреса или формы: доверять строке снаружи нельзя. */
export function isReviewCourseId(value: string): value is ReviewCourseId {
  return (REVIEW_COURSE_IDS as readonly string[]).includes(value);
}

/** Оценка: целое число от 1 до 5. */
export const REVIEW_MIN_RATING = 1;
export const REVIEW_MAX_RATING = 5;

/** Длина текста отзыва: короткий отзыв бесполезен, длинный не помещается. */
export const REVIEW_TEXT_MIN = 10;
export const REVIEW_TEXT_MAX = 1000;

/** Строка course_reviews в том виде, в каком её отдаёт PostgREST. */
export type CourseReviewRow = {
  id: string;
  course_id: string;
  user_id: string;
  rating: number;
  text: string;
  created_at: string;
};

/** Отзыв вместе с публичным именем автора. */
export type CourseReview = {
  id: string;
  courseId: ReviewCourseId;
  /** Автор отзыва: по нему страница понимает, что ученик уже высказался. */
  userId: string;
  authorName: string;
  rating: number;
  text: string;
  createdAt: string;
};

/** Публичное имя автора из представления course_review_authors. */
type ReviewAuthor = {
  id: string;
  display_name: string;
};

/** Если имени в профиле нет. */
export const REVIEW_AUTHOR_FALLBACK = "Ученик TriDi";

/** Средняя оценка и распределение по звёздам. */
export type CourseReviewStats = {
  count: number;
  /** Средняя с одним знаком после запятой; 0, если отзывов нет. */
  average: number;
  /** Сколько отзывов поставили каждую оценку: ключи 1…5. */
  distribution: Record<number, number>;
};

/** Ошибки Supabase не показываем пользователю — только пишем в лог. */
function warnReviewQuery(label: string, message: string) {
  console.warn(`Отзывы: не удалось ${label}:`, message);
}

/**
 * Отзывы одного курса, свежие сверху.
 *
 * При недоступной базе возвращаем пустой список: страница выпускника должна
 * открываться, даже если миграцию ещё не применили. Пустое состояние честно
 * говорит «отзывов пока нет».
 */
export async function getCourseReviews(
  supabase: Supabase,
  courseId: ReviewCourseId,
  limit = 30,
): Promise<CourseReview[]> {
  const { data, error } = await supabase
    .from("course_reviews")
    .select("id, course_id, user_id, rating, text, created_at")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    warnReviewQuery("загрузить отзывы", error.message);
    return [];
  }

  const rows = (data as CourseReviewRow[] | null) ?? [];

  if (rows.length === 0) {
    return [];
  }

  const authorIds = [...new Set(rows.map((row) => row.user_id))];
  const authorsResult = await supabase
    .from("course_review_authors")
    .select("id, display_name")
    .in("id", authorIds);

  if (authorsResult.error) {
    warnReviewQuery("загрузить имена авторов", authorsResult.error.message);
  }

  const authors = new Map(
    ((authorsResult.data as ReviewAuthor[] | null) ?? []).map((author) => [
      author.id,
      author.display_name,
    ]),
  );

  return rows.map((row) => ({
    id: row.id,
    courseId: courseId,
    userId: row.user_id,
    authorName: authors.get(row.user_id) ?? REVIEW_AUTHOR_FALLBACK,
    rating: row.rating,
    text: row.text,
    createdAt: row.created_at,
  }));
}

/**
 * Оставил ли ученик отзыв об этом курсе.
 *
 * Отдельный запрос, а не поиск в загруженном списке: список ограничен
 * последними 30 отзывами, и старый отзыв выпускника мог в него не попасть.
 * Тогда форма показывалась бы снова, а Server Action отвечал бы ошибкой
 * уникального индекса. При недоступной базе возвращаем false — форма
 * откроется, но действие честно сообщит, что отзывы временно недоступны.
 */
export async function hasUserReviewedCourse(
  supabase: Supabase,
  courseId: ReviewCourseId,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("course_reviews")
    .select("id")
    .eq("course_id", courseId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    warnReviewQuery("проверить отзыв пользователя", error.message);
    return false;
  }

  return Boolean(data);
}

/** Средняя оценка и сколько раз поставили каждую звезду. */
export function getCourseReviewStats(
  reviews: readonly CourseReview[],
): CourseReviewStats {
  const distribution: Record<number, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  let sum = 0;

  for (const review of reviews) {
    sum += review.rating;
    distribution[review.rating] = (distribution[review.rating] ?? 0) + 1;
  }

  return {
    count: reviews.length,
    average:
      reviews.length > 0 ? Math.round((sum / reviews.length) * 10) / 10 : 0,
    distribution,
  };
}

/** Дата отзыва в русском формате: «18 октября 2026». */
export function formatReviewDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Подпись к количеству отзывов: «1 отзыв», «2 отзыва», «5 отзывов». */
export function pluralizeReviews(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;

  if (mod100 >= 11 && mod100 <= 14) return "отзывов";
  if (mod10 === 1) return "отзыв";
  if (mod10 >= 2 && mod10 <= 4) return "отзыва";
  return "отзывов";
}
