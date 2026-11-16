"use server";

import { courseLessonExists } from "@/lib/course-lesson-catalog";
import {
  canWriteCourseProgress,
  hasCourseAccess,
} from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";

export type CompleteLessonResult = { success: true } | { error: string };

/**
 * Какой курс проходим: базовый (8 уроков), «Уверенный» (12 уроков), «Инженер»
 * (10 уроков), «Заработок» (8 уроков) или продвинутый курс (109 уроков). Прогресс
 * хранится отдельно по курсам: урок №1 есть и в базовом, и в других уровнях.
 */
export type CourseType = "basic" | "confident" | "engineer" | "profit" | "pro";

/**
 * Отмечает урок пройденным для текущего пользователя.
 *
 * Server Action: вызывается прямо из клиентского компонента
 * (`await completeLesson(lesson.id, "pro")`), но выполняется на сервере —
 * там, где есть доступ к cookies и где безопасно работать с базой.
 *
 * Идемпотентно: повторное прохождение урока не создаёт дубликат и не падает —
 * благодаря upsert по тройке (user_id, course_type, lesson_id) запись
 * обновляется.
 *
 * ВАЖНО: для onConflict в базе нужен уникальный индекс ровно на эти три колонки
 * (SQL — в supabase/pro_course_access.sql). Без него Supabase ответит ошибкой
 * 42P10 и прогресс не сохранится; кнопка при этом всё равно ведёт дальше — см.
 * components/course/CompleteButton.tsx.
 *
 * ДОСТУП: платный курс нельзя пройти без покупки или промокода, даже если
 * страница урока открыта. Проверка стоит на сервере: браузер может вызвать
 * action напрямую. Номер урока тоже сверяется с каталогом курса.
 */
export async function completeLesson(
  lessonId: number,
  courseType: CourseType,
): Promise<CompleteLessonResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Не авторизован" };
  }

  if (!Number.isInteger(lessonId) || lessonId <= 0) {
    return { error: "Некорректный номер урока" };
  }

  // Server Action — публичный адрес: значение приходит из браузера, поэтому
  // проверяем его здесь, а не полагаемся на типы TypeScript.
  if (
    courseType !== "basic" &&
    courseType !== "confident" &&
    courseType !== "engineer" &&
    courseType !== "profit" &&
    courseType !== "pro"
  ) {
    return { error: "Неизвестный тип курса" };
  }

  if (!courseLessonExists(courseType, lessonId)) {
    return { error: "Такого урока нет в курсе" };
  }

  // Бесплатный курс не требует запроса к purchases. Для платных доступ
  // проверяется по покупке или активированному промокоду — те же правила, что
  // у страниц курса (lib/subscription.ts).
  const hasAccess =
    courseType === "basic"
      ? true
      : await hasCourseAccess(supabase, user.id, courseType);

  if (!canWriteCourseProgress(courseType, hasAccess)) {
    return { error: "Этот курс не открыт в вашем аккаунте." };
  }

  const { error } = await supabase.from("lesson_progress").upsert(
    {
      user_id: user.id,
      lesson_id: lessonId,
      course_type: courseType,
    },
    { onConflict: "user_id,course_type,lesson_id" },
  );

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
