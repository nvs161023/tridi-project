"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { completeLesson, type CourseType } from "@/app/actions/complete-lesson";

type CompleteButtonProps = {
  /** Номер урока, который отмечаем пройденным. */
  lessonId: number;
  /** Куда перейти после сохранения (следующий урок или конструктор). */
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
      className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-9 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {isPending ? "Сохранение…" : label}
      {isPending ? null : <span aria-hidden>→</span>}
    </button>
  );
}
