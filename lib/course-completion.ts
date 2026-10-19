/**
 * Завершение курса: когда ученику можно выдавать сертификат.
 *
 * Одного прогресса уроков недостаточно: тест модуля обязателен, и без него
 * следующий модуль закрыт (см. app/course/[id]/page.tsx). Поэтому курс считается
 * пройденным, когда выполнены оба условия:
 *   1. пройдены все уроки, у которых уже есть материал;
 *   2. сданы все тесты модулей, в которых есть вопросы.
 *
 * Уроки без материала не блокируют сертификат: страница такого урока честно
 * говорит «Материал готовится», и ученик не должен ждать недописанный урок.
 *
 * Модуль знает только чистый расчёт. Чтение строк lesson_progress и даты
 * завершения — в getCourseCompletionFromRows: её используют и кабинет, и
 * страница сертификата, поэтому правила не расходятся.
 */
import type { createClient } from "@/lib/supabase/server";

import { basicCourseModules, basicLessons } from "./basic-course";
import { confidentLessons, confidentModules } from "./confident-course";
import type { LevelKey } from "./course-levels";
import { engineerLessons, engineerModules } from "./engineer-course";
import {
  CONFIDENT_MODULE_TEST_COURSE_TYPE,
  ENGINEER_MODULE_TEST_COURSE_TYPE,
  MODULE_TEST_COURSE_TYPE,
  MODULE_TEST_COURSE_TYPES,
  PROFIT_MODULE_TEST_COURSE_TYPE,
} from "./module-test";
import { profitLessons, profitModules } from "./profit-course";

/** Что известно о завершении одного уровня. */
export type CourseCompletion = {
  level: LevelKey;
  /** Сколько уроков с материалом есть в курсе. */
  totalLessons: number;
  /** Сколько из них пройдено. */
  completedLessons: number;
  /** Сколько тестов модулей написано в данных курса. */
  totalTests: number;
  /** Сколько из них сдано. */
  passedTests: number;
  /** Все уроки с материалом пройдены и все тесты сданы. */
  isComplete: boolean;
  /**
   * Когда завершён последний обязательный шаг (ISO-строка из completed_at).
   * null — дат в прогрессе нет (например, таблица прочитана без completed_at).
   */
  issuedAt: string | null;
};

/** Строка lesson_progress в том виде, в каком её читают кабинет и сертификат. */
export type CourseProgressRow = {
  /** До миграции course_type колонки нет — старые строки принадлежат базовому курсу. */
  course_type?: string | null;
  lesson_id: number | string | null;
  completed_at?: string | null;
};

/** Результат чтения прогресса: строки либо честная ошибка без выдуманных нулей. */
export type CourseProgressRead =
  | { rows: CourseProgressRow[]; failed: false }
  | { rows: []; failed: true };

/** Тип строки с результатами тестов для каждого уровня. */
export const COURSE_TEST_TYPES: Record<LevelKey, string> = {
  basic: MODULE_TEST_COURSE_TYPE,
  confident: CONFIDENT_MODULE_TEST_COURSE_TYPE,
  engineer: ENGINEER_MODULE_TEST_COURSE_TYPE,
  profit: PROFIT_MODULE_TEST_COURSE_TYPE,
};

/** Все типы строк тестов — по ним кабинет одним запросом читает прогресс. */
export const ALL_TEST_COURSE_TYPES: string[] = Object.values(
  MODULE_TEST_COURSE_TYPES,
);

/** Уроки уровня, которые должен пройти ученик. */
const COURSE_LESSONS: Record<LevelKey, number[]> = {
  basic: basicLessons
    .filter((lesson) => lesson.blocks.length > 0)
    .map((lesson) => lesson.id),
  confident: confidentLessons
    .filter((lesson) => lesson.blocks.length > 0)
    .map((lesson) => lesson.lessonNumber),
  engineer: engineerLessons
    .filter((lesson) => lesson.blocks.length > 0)
    .map((lesson) => lesson.lessonNumber),
  profit: profitLessons
    .filter((lesson) => lesson.blocks.length > 0)
    .map((lesson) => lesson.lessonNumber),
};

/** Порядковые номера модулей, у которых есть тест с вопросами. */
const COURSE_TEST_ORDERS: Record<LevelKey, number[]> = {
  basic: basicCourseModules
    .filter((courseModule) => courseModule.questions.length > 0)
    .map((courseModule) => courseModule.moduleOrder),
  confident: confidentModules
    .filter((courseModule) => (courseModule.module_test?.questions.length ?? 0) > 0)
    .map((courseModule) => courseModule.module_order),
  engineer: engineerModules
    .filter((courseModule) => (courseModule.module_test?.questions.length ?? 0) > 0)
    .map((courseModule) => courseModule.module_order),
  profit: profitModules
    .filter((courseModule) => (courseModule.module_test?.questions.length ?? 0) > 0)
    .map((courseModule) => courseModule.module_order),
};

/** Число уроков с материалом: столько ученик реально может пройти. */
export function courseLessonCount(level: LevelKey): number {
  return COURSE_LESSONS[level].length;
}

/** Число написанных тестов модулей курса. */
export function courseTestCount(level: LevelKey): number {
  return COURSE_TEST_ORDERS[level].length;
}

/**
 * Чистый расчёт завершения по номерам уроков и порядковым номерам модулей.
 *
 * Принимаем именно номера, а не готовые объекты: в lesson_progress.lesson_id
 * лежит сквозной номер урока, а у тестов — module_order.
 */
export function getCourseCompletion(
  level: LevelKey,
  completedLessonIds: Iterable<number>,
  passedModuleOrders: Iterable<number>,
  issuedAt: string | null = null,
): CourseCompletion {
  const completedLessons = new Set(completedLessonIds);
  const passedOrders = new Set(passedModuleOrders);
  const lessonNumbers = COURSE_LESSONS[level];
  const testOrders = COURSE_TEST_ORDERS[level];

  const completedCount = lessonNumbers.reduce(
    (sum, lessonNumber) => sum + (completedLessons.has(lessonNumber) ? 1 : 0),
    0,
  );
  const passedCount = testOrders.reduce(
    (sum, moduleOrder) => sum + (passedOrders.has(moduleOrder) ? 1 : 0),
    0,
  );

  return {
    level,
    totalLessons: lessonNumbers.length,
    completedLessons: completedCount,
    totalTests: testOrders.length,
    passedTests: passedCount,
    isComplete:
      lessonNumbers.length > 0 &&
      completedCount === lessonNumbers.length &&
      passedCount === testOrders.length,
    issuedAt,
  };
}

/**
 * Завершение курса по строкам lesson_progress.
 *
 * Строки других курсов пропускаем. Строка без course_type — наследие старой
 * базы: она относится к базовому курсу. Тесты без course_type прочитать нельзя,
 * поэтому в такой базе сертификат не выдаётся — это безопаснее, чем выдать его
 * без сдачи тестов.
 */
export function getCourseCompletionFromRows(
  level: LevelKey,
  rows: readonly CourseProgressRow[],
): CourseCompletion {
  const lessonIds = new Set<number>();
  const testOrders = new Set<number>();
  let issuedAt: string | null = null;
  let latestTimestamp = 0;

  for (const row of rows) {
    const courseType = row.course_type ?? "basic";
    const rawId = Number(row.lesson_id);

    if (!Number.isFinite(rawId)) {
      continue;
    }

    const isLesson = courseType === level;
    const isTest = courseType === COURSE_TEST_TYPES[level];

    if (!isLesson && !isTest) {
      continue;
    }

    if (isLesson) {
      lessonIds.add(rawId);
    } else {
      testOrders.add(rawId);
    }

    if (typeof row.completed_at === "string") {
      const timestamp = Date.parse(row.completed_at);

      if (Number.isFinite(timestamp) && timestamp > latestTimestamp) {
        latestTimestamp = timestamp;
        issuedAt = row.completed_at;
      }
    }
  }

  return getCourseCompletion(level, lessonIds, testOrders, issuedAt);
}

/**
 * Читает строки прогресса одного уровня из lesson_progress.
 *
 * Сначала пробуем полный набор колонок. Если база ещё без миграции
 * pro_course_access.sql (нет course_type), повторяем запрос без него: старые
 * строки относятся к базовому курсу, и завершение по ним не подтвердится, пока
 * нет строк тестов. Так страница не падает, а честно показывает незавершённость.
 *
 * Функция используется и страницей сертификата, и проверкой права на отзыв:
 * правила завершения курса должны совпадать.
 */
export async function readCourseProgressRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  level: LevelKey,
): Promise<CourseProgressRead> {
  const fullResult = await supabase
    .from("lesson_progress")
    .select("course_type, lesson_id, completed_at")
    .eq("user_id", userId)
    .in("course_type", [level, COURSE_TEST_TYPES[level]]);

  if (!fullResult.error) {
    return {
      rows: (fullResult.data as CourseProgressRow[] | null) ?? [],
      failed: false,
    };
  }

  const fallbackResult = await supabase
    .from("lesson_progress")
    .select("lesson_id, completed_at")
    .eq("user_id", userId);

  if (fallbackResult.error) {
    return { rows: [], failed: true };
  }

  return {
    rows: (fallbackResult.data as CourseProgressRow[] | null) ?? [],
    failed: false,
  };
}
