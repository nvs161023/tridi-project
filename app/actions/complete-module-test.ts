"use server";

import {
  MODULE_TEST_COURSE_TYPE,
  isModuleTestPassed,
} from "@/lib/module-test";
import { createClient } from "@/lib/supabase/server";

export type CompleteModuleTestResult = { success: true } | { error: string };

/**
 * Сохраняет результат теста модуля.
 *
 * Пишем только СДАННЫЙ тест: наличие строки в lesson_progress означает «модуль
 * сдан», и именно по ней страница урока открывает следующий модуль. Проваленная
 * попытка ничего не сохраняет, поэтому закрытый модуль остаётся закрытым.
 *
 * Курс отдельный (course_type = "basic-test"): так результаты тестов не попадают
 * в прогресс уроков и не ломают счётчик «пройдено X из 15» на дашборде.
 *
 * ВАЖНО: lesson_id в lesson_progress — число, поэтому пишем номер модуля
 * (1…6). Идемпотентно: повторная сдача обновляет ту же строку благодаря
 * уникальному индексу (user_id, course_type, lesson_id).
 */
export async function completeModuleTest(
  moduleId: number,
  correct: number,
  total: number,
): Promise<CompleteModuleTestResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Не авторизован" };
  }

  // Server Action — публичный адрес: значения приходят из браузера, поэтому
  // проверяем их здесь, а не полагаемся на типы TypeScript.
  if (!Number.isInteger(moduleId) || moduleId <= 0) {
    return { error: "Некорректный номер модуля" };
  }

  if (
    !Number.isInteger(correct) ||
    !Number.isInteger(total) ||
    total <= 0 ||
    correct < 0 ||
    correct > total
  ) {
    return { error: "Некорректный результат теста" };
  }

  if (!isModuleTestPassed(correct, total)) {
    return { error: "Тест не сдан" };
  }

  const { error } = await supabase.from("lesson_progress").upsert(
    {
      user_id: user.id,
      lesson_id: moduleId,
      course_type: MODULE_TEST_COURSE_TYPE,
    },
    { onConflict: "user_id,course_type,lesson_id" },
  );

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
