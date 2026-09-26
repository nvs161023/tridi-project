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
 * К какому курсу относится тест. От варианта зависит и тип строки в базе, и
 * оформление страницы теста (базовый — синий, продвинутый — янтарный).
 */
export type CourseTestVariant = "basic" | "pro";

/**
 * Тип курса для результатов тестов модулей базового курса в lesson_progress.
 *
 * Отдельный от "basic": иначе строки тестов попадали бы в прогресс уроков и
 * «пройдено X из 15» на дашборде считалось бы неверно.
 */
export const MODULE_TEST_COURSE_TYPE = "basic-test";

/**
 * Тип курса для результатов тестов модулей продвинутого курса.
 *
 * Тоже отдельный — и от "pro", и от "basic-test": прогресс уроков pro считается
 * по course_type="pro" (уроки 1…109), а тесты модулей пишутся сюда, чтобы не
 * сдвигать счётчик уроков. Номер модуля лежит в lesson_id (1…26).
 */
export const PRO_MODULE_TEST_COURSE_TYPE = "pro-test";

/**
 * Тип курса для записи результата теста: у базового и продвинутого курса свои
 * строки в lesson_progress.
 */
export function moduleTestCourseType(variant: CourseTestVariant): string {
  return variant === "pro" ? PRO_MODULE_TEST_COURSE_TYPE : MODULE_TEST_COURSE_TYPE;
}

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

/**
 * Сдан ли тест модуля продвинутого курса.
 *
 * У базового курса код модуля — число («1»…«6»), а у продвинутого — буквенный
 * («A», «T-тизер»), поэтому в базе лежит не код, а место модуля в курсе
 * (module_order, 1…26). Эта проверка сравнивает именно порядковый номер.
 *
 * passed = null означает, что результаты прочитать не удалось: в этом случае
 * считаем тест сданным (то же правило, что и в isModuleTestCompleted).
 */
export function isModuleTestCompletedByOrder(
  passed: Set<number> | null,
  moduleOrder: number,
): boolean {
  return passed === null || passed.has(moduleOrder);
}
