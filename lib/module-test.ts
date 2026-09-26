/**
 * Правила проверки знаний по модулю.
 *
 * Тест модуля обязателен: пока он не сдан, следующий модуль закрыт (см.
 * app/course/[id]/page.tsx). Пороги лежат здесь, а не в компоненте теста: их
 * используют и клиентский тест, и серверный action, и страницы уроков.
 */

/** С какого числа правильных ответов тест считается сданным. */
export const MODULE_TEST_PASS_FROM = 5;

/** С какого числа правильных ответов ставим «отлично». */
export const MODULE_TEST_EXCELLENT_FROM = 8;

/**
 * Тип курса для результатов тестов модулей в lesson_progress.
 *
 * Отдельный от "basic": иначе строки тестов попадали бы в прогресс уроков и
 * «пройдено X из 15» на дашборде считалось бы неверно.
 */
export const MODULE_TEST_COURSE_TYPE = "basic-test";

/** Сдан ли тест модуля по числу правильных ответов. */
export function isModuleTestPassed(correct: number, total: number): boolean {
  // Если вопросов меньше порога, требовать больше правильных нельзя.
  return correct >= Math.min(MODULE_TEST_PASS_FROM, Math.max(total, 1));
}

/**
 * Сдан ли тест модуля по данным из базы.
 *
 * passed — номера сданных модулей; null означает, что результаты прочитать не
 * удалось (нет сети, нет таблицы). Тогда считаем тест сданным: запереть ученика
 * из-за сбоя чтения хуже, чем показать урок.
 */
export function isModuleTestCompleted(
  passed: Set<number> | null,
  moduleId: string,
): boolean {
  if (passed === null) {
    return true;
  }

  const parsed = Number(moduleId);

  return Number.isFinite(parsed) ? passed.has(parsed) : false;
}
