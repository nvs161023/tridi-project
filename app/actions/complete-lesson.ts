"use server";

import { createClient } from "@/lib/supabase/server";

export type CompleteLessonResult = { success: true } | { error: string };

/**
 * Какой курс проходим: базовый (15 уроков) или продвинутый (109 уроков).
 * Прогресс хранится отдельно по курсам: урок №1 есть и в базовом, и в pro.
 */
export type CourseType = "basic" | "pro";

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
  if (courseType !== "basic" && courseType !== "pro") {
    return { error: "Неизвестный тип курса" };
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
