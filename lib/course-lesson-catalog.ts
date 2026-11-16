/**
 * Проверка «такой урок действительно есть в курсе».
 *
 * Server Action принимает номер урока из браузера. Без сверки с каталогом можно
 * записать в `lesson_progress` любую строку — например, урок 999 платного курса.
 * Счётчики сертификата читают только известные номера, но мусор в прогрессе всё
 * равно опасен: он искажает отчёты и будущие проверки.
 *
 * Наборы строятся один раз при импорте: курсы небольшие, а action вызывается на
 * каждое нажатие «Пройти урок».
 */
import proCourseData from "@/data/course-pro.json";
import type { BaseCourse } from "@/lib/types";

import { basicLessons } from "./basic-course";
import { confidentLessons } from "./confident-course";
import { engineerLessons } from "./engineer-course";
import type { CourseTestVariant } from "./module-test";
import { profitLessons } from "./profit-course";

const proCourse = proCourseData as BaseCourse;

const COURSE_LESSON_NUMBERS: Record<CourseTestVariant, ReadonlySet<number>> = {
  basic: new Set(basicLessons.map((lesson) => lesson.id)),
  confident: new Set(confidentLessons.map((lesson) => lesson.lessonNumber)),
  engineer: new Set(engineerLessons.map((lesson) => lesson.lessonNumber)),
  profit: new Set(profitLessons.map((lesson) => lesson.lessonNumber)),
  pro: new Set(
    proCourse.modules.flatMap((courseModule) =>
      courseModule.lessons.map((lesson) => lesson.lesson_order),
    ),
  ),
};

/** Есть ли урок с таким сквозным номером в серверном каталоге курса. */
export function courseLessonExists(
  courseType: CourseTestVariant,
  lessonNumber: number,
): boolean {
  return COURSE_LESSON_NUMBERS[courseType].has(lessonNumber);
}
