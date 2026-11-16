"use server";

import {
  moduleTestCourseType,
  moduleTestPassFrom,
  scoreModuleTestAnswers,
  type CourseTestVariant,
} from "@/lib/module-test";
import { moduleTestQuestions } from "@/lib/module-test-questions";
import {
  canWriteCourseProgress,
  hasCourseAccess,
} from "@/lib/subscription";
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
 * "basic-test", «Уверенный» — "confident-test", «Инженер» — "engineer-test",
 * «Заработок» — "profit-test", продвинутый — "pro-test". Так результаты тестов не
 * попадают в прогресс уроков и не ломают счётчики «пройдено X из 8», «урок X из
 * 12» и «урок X из 109».
 *
 * ВАЖНО: lesson_id в lesson_progress — число. Базовый курс пишет туда код модуля
 * (1…6), «Уверенный» — место модуля в уровне (1…3), «Инженер» — место модуля в
 * уровне (1…2), «Заработок» — тоже место модуля (1…2), продвинутый — место модуля
 * в курсе (1…26): у pro коды буквенные («A», «T-тизер»), числом их не выразить.
 * Идемпотентно: повторная сдача обновляет ту же строку благодаря уникальному
 * индексу (user_id, course_type, lesson_id).
 */
export async function completeModuleTest(
  variant: CourseTestVariant,
  moduleNumber: number,
  answers: number[],
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
  if (
    variant !== "basic" &&
    variant !== "confident" &&
    variant !== "engineer" &&
    variant !== "profit" &&
    variant !== "pro"
  ) {
    return { error: "Неизвестный тип курса" };
  }

  if (!Number.isInteger(moduleNumber) || moduleNumber <= 0) {
    return { error: "Некорректный номер модуля" };
  }

  if (
    !Array.isArray(answers) ||
    answers.length === 0 ||
    !answers.every((answer) => Number.isInteger(answer))
  ) {
    return { error: "Некорректные ответы теста" };
  }

  // Платный уровень без покупки или промокода не сохраняет тест: страница
  // теста могла быть открыта в обход, а action вызывается напрямую.
  const hasAccess =
    variant === "basic"
      ? true
      : await hasCourseAccess(supabase, user.id, variant);

  if (!canWriteCourseProgress(variant, hasAccess)) {
    return { error: "Этот курс не открыт в вашем аккаунте." };
  }

  // Правильные ответы берём только из серверного каталога. Клиент присылает
  // выбранные варианты, а не готовое число правильных: подделать `correct` и
  // `total` больше нельзя.
  const questions = moduleTestQuestions(variant, moduleNumber);

  if (questions === null) {
    return { error: "Такого модуля нет в курсе" };
  }

  const score = scoreModuleTestAnswers(
    questions,
    answers,
    moduleTestPassFrom(variant),
  );

  if (score === null) {
    return { error: "Некорректные ответы теста" };
  }

  if (!score.passed) {
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
