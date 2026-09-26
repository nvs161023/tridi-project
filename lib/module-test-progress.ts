import { resolveUserId } from "@/lib/current-user";
import { MODULE_TEST_COURSE_TYPE } from "@/lib/module-test";
import { createClient } from "@/lib/supabase/server";

/**
 * Номера модулей, тесты которых сданы.
 *
 * Результаты лежат в lesson_progress с отдельным типом курса (см.
 * lib/module-test.ts): строка появляется только после сданного теста, поэтому
 * наличие номера = модуль сдан.
 *
 * null означает «прочитать не удалось» (нет сети, нет таблицы, нет пользователя).
 * Вызывающий код в этом случае считает тесты сданными: запереть ученика из-за
 * сбоя чтения хуже, чем показать урок (см. isModuleTestCompleted).
 */
export async function loadPassedModuleTests(): Promise<Set<number> | null> {
  const supabase = await createClient();
  const userId = await resolveUserId(supabase);

  if (!userId) {
    return null;
  }

  const { data, error } = await supabase
    .from("lesson_progress")
    .select("lesson_id")
    .eq("user_id", userId)
    .eq("course_type", MODULE_TEST_COURSE_TYPE);

  if (error) {
    console.warn(
      "Не удалось прочитать результаты тестов модулей:",
      error.message,
    );
    return null;
  }

  return new Set((data ?? []).map((row) => Number(row.lesson_id)));
}

export type { Supabase };
