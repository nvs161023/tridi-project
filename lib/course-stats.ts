/**
 * Помощники для витрин курсов.
 *
 * Цифры на страницах (сколько уроков в модуле, сколько всего уроков, сколько
 * часов идёт курс) считаются из data/lessons.json и data/lessons-pro.json,
 * а не хранятся текстом. Поэтому витрина не может «отстать» от содержимого
 * курсов, и главная со страницей тарифов показывают одинаковые числа.
 */

/** Минимум, который нужен от урока: модуль и длительность. */
export type LessonLike = {
  module: string;
  duration: string;
};

/** Превью модуля для витрины: название и число уроков в нём. */
export type ModulePreview = {
  title: string;
  lessons: number;
};

export const LESSON_FORMS: [string, string, string] = ["урок", "урока", "уроков"];
export const MODULE_FORMS: [string, string, string] = ["модуль", "модуля", "модулей"];
export const HOUR_FORMS: [string, string, string] = ["час", "часа", "часов"];

/**
 * Русская форма слова по числу: 1 урок, 2 урока, 5 уроков.
 * forms — это [для 1, для 2–4, для 5 и больше].
 */
export function pluralize(count: number, forms: [string, string, string]): string {
  const mod100 = count % 100;
  const mod10 = count % 10;

  if (mod100 >= 11 && mod100 <= 14) {
    return forms[2];
  }

  if (mod10 === 1) {
    return forms[0];
  }

  if (mod10 >= 2 && mod10 <= 4) {
    return forms[1];
  }

  return forms[2];
}

/**
 * Собирает модули из уроков: группирует по полю module, сохраняя порядок
 * появления в файле.
 */
export function groupByModule(lessons: LessonLike[]): ModulePreview[] {
  const counts = new Map<string, number>();

  for (const lesson of lessons) {
    counts.set(lesson.module, (counts.get(lesson.module) ?? 0) + 1);
  }

  return [...counts].map(([title, lessonsCount]) => ({
    title,
    lessons: lessonsCount,
  }));
}

/** «~9 часов» — округляем суммарную длительность уроков до часов. */
export function formatHours(lessons: LessonLike[]): string {
  const minutes = lessons.reduce(
    (sum, lesson) => sum + Number.parseInt(lesson.duration, 10),
    0,
  );
  const hours = Math.max(1, Math.round(minutes / 60));

  return `~${hours} ${pluralize(hours, HOUR_FORMS)}`;
}
