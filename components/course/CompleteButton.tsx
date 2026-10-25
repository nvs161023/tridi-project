"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { completeLesson, type CourseType } from "@/app/actions/complete-lesson";
import { LESSON_PRIMARY } from "@/components/course/lesson-ui";

type CompleteButtonProps = {
  /** Номер урока, который отмечаем пройденным. */
  lessonId: number;
  /** Куда перейти после сохранения (следующий урок или «Центр выпускника»). */
  href: string;
  /** Текст кнопки в обычном состоянии. */
  label: string;
  /**
   * Какой это курс: базовый или продвинутый. По умолчанию базовый — так кнопка
   * работает на страницах /course/lesson-*, а продвинутые уроки передают "pro".
   */
  courseType?: CourseType;
};

/**
 * Кнопка «пройти дальше»: сначала сохраняет прогресс на сервере,
 * затем ведёт на следующую страницу.
 *
 * Если пользователь не авторизован (или сохранение не удалось) — просто
 * переходим дальше: прохождение курса важнее, чем запись прогресса. Поэтому и
 * незакрытая миграция с колонкой course_type (см. supabase/pro_course_access.sql)
 * не мешает пройти урок — прогресс просто не запишется.
 */
export function CompleteButton({
  lessonId,
  href,
  label,
  courseType = "basic",
}: CompleteButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await completeLesson(lessonId, courseType);

      if ("error" in result) {
        console.warn("Прогресс не сохранён:", result.error);
      }

      router.push(href);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-busy={isPending}
      className={`${LESSON_PRIMARY} min-h-14 w-full px-9 text-lg sm:w-auto`}
    >
      {isPending ? "Сохранение…" : label}
      {isPending ? null : <span aria-hidden>→</span>}
    </button>
  );
}
