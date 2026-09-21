"use server";

import { createClient } from "@/lib/supabase/server";

export type CompleteLessonResult = { success: true } | { error: string };

/**
 * Отмечает урок пройденным для текущего пользователя.
 *
 * Server Action: вызывается прямо из клиентского компонента
 * (`await completeLesson(lesson.id)`), но выполняется на сервере —
 * там, где есть доступ к cookies и где безопасно работать с базой.
 *
 * Идемпотентно: повторное прохождение урока не создаёт дубликат и не падает —
 * благодаря upsert по паре (user_id, lesson_id) запись просто обновляется.
 */
export async function completeLesson(
  lessonId: number,
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

  const { error } = await supabase.from("lesson_progress").upsert(
    {
      user_id: user.id,
      lesson_id: lessonId,
    },
    { onConflict: "user_id,lesson_id" },
  );

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
