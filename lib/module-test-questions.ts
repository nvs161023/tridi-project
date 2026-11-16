/**
 * Вопросы теста модуля из серверного каталога курса.
 *
 * Server Action не принимает правильные ответы от клиента: он сам находит модуль
 * по номеру и берёт `module_test` из данных курса. Клиент присылает только
 * выбранные варианты (см. lib/module-test.ts → scoreModuleTestAnswers).
 *
 * Номера модулей те же, что уходят в `lesson_progress.lesson_id`:
 *   • базовый — код модуля («1»…«2»);
 *   • «Уверенный», «Инженер», «Заработок» — место модуля в уровне (1…3);
 *   • продвинутый — место модуля в курсе (1…26).
 *
 * `null` — такого модуля в каталоге нет. Пустой массив означает, что модуль
 * существует, но тест ещё не написан: сохранять по нему нечего.
 */
import proCourseData from "@/data/course-pro.json";
import type { BaseCourse, MiniCheckQuestion } from "@/lib/types";

import { findBasicModule } from "./basic-course";
import {
  confidentModuleQuestions,
  findConfidentModuleByOrder,
} from "./confident-course";
import {
  engineerModuleQuestions,
  findEngineerModuleByOrder,
} from "./engineer-course";
import type { CourseTestVariant } from "./module-test";
import {
  findProfitModuleByOrder,
  profitModuleQuestions,
} from "./profit-course";

const proCourse = proCourseData as BaseCourse;

/** Вопросы теста модуля или null, если модуля с таким номером нет. */
export function moduleTestQuestions(
  variant: CourseTestVariant,
  moduleNumber: number,
): MiniCheckQuestion[] | null {
  if (!Number.isInteger(moduleNumber) || moduleNumber <= 0) {
    return null;
  }

  switch (variant) {
    case "basic": {
      const courseModule = findBasicModule(String(moduleNumber));

      return courseModule ? courseModule.questions : null;
    }
    case "confident": {
      const courseModule = findConfidentModuleByOrder(moduleNumber);

      return courseModule ? confidentModuleQuestions(courseModule) : null;
    }
    case "engineer": {
      const courseModule = findEngineerModuleByOrder(moduleNumber);

      return courseModule ? engineerModuleQuestions(courseModule) : null;
    }
    case "profit": {
      const courseModule = findProfitModuleByOrder(moduleNumber);

      return courseModule ? profitModuleQuestions(courseModule) : null;
    }
    case "pro": {
      const courseModule = proCourse.modules.find(
        (item) => item.module_order === moduleNumber,
      );

      return courseModule?.module_test?.questions ?? null;
    }
  }
}
