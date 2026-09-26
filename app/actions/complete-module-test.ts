"use server";

import {
  isModuleTestPassed,
  moduleTestCourseType,
  type CourseTestVariant,
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
 * У каждого курса свой тип строки (см. lib/module-test.ts): базовый пишет
 * "basic-test", продвинутый — "pro-test". Так результаты тестов не попадают в
 * прогресс уроков и не ломают счётчики «пройдено X из 15» и «урок X из 109».
 *
 * ВАЖНО: lesson_id в lesson_progress — число. Базовый курс пишет туда код модуля
 * (1…6), продвинутый — место модуля в курсе (1…26): у pro коды буквенные
 * («A», «T-тизер»), числом их не выразить. Идемпотентно: повторная сдача
 * обновляет ту же строку благодаря уникальному индексу
 * (user_id, course_type, lesson_id).
 */
export async function completeModuleTest(
  variant: CourseTestVariant,
  moduleNumber: number,
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
  if (variant !== "basic" && variant !== "pro") {
    return { error: "Неизвестный тип курса" };
  }

  if (!Number.isInteger(moduleNumber) || moduleNumber <= 0) {
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
      lesson_id: moduleNumber,
      course_type: moduleTestCourseType(variant),
    },
    { onConflict: "user_id,course_type,lesson_id" },
  );

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
