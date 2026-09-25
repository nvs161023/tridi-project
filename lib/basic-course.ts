/**
 * Базовый курс: данные и разворот модулей.
 *
 * В data/lessons.json курс лежит модулями (как и продвинутый в
 * data/course-pro.json), а страницы и витрина работают с плоским списком уроков:
 * у урока есть номер, длительность и название модуля. Разворот живёт здесь, в
 * одном месте, поэтому страницы ничего не знают о модульной структуре файла.
 *
 * Номера уроков — это lesson_id из файла: в базовом курсе они числовые (1…15),
 * поэтому адреса остались прежними — /course/lesson-N, и записи в
 * lesson_progress с lesson_id = 1…12 продолжают работать без миграций.
 */
import lessonsData from "@/data/lessons.json";
import type { BaseCourse, LessonBlock } from "@/lib/types";

/** Урок в том виде, в каком его ждут страницы базового курса. */
export type BasicLesson = {
  /** Номер урока: он же lesson_id в lesson_progress и номер в адресе урока. */
  id: number;
  title: string;
  duration: string;
  /** Название модуля строкой — «Модуль 1: Знакомство». */
  module: string;
  /** Уровень доступа: базовый курс бесплатный, у всех уроков "basic". */
  tier: string;
  blocks: LessonBlock[];
};

const course: BaseCourse = lessonsData;

/** Модули по порядку, уроки внутри — по порядку: от этого зависят номера уроков. */
const modules = [...course.modules]
  .sort((a, b) => a.module_order - b.module_order)
  .map((courseModule) => ({
    ...courseModule,
    lessons: [...courseModule.lessons].sort(
      (a, b) => a.lesson_order - b.lesson_order,
    ),
  }));

/**
 * Уроки курса по порядку: /course/lesson-1 … /course/lesson-15.
 *
 * Название модуля собираем как «Модуль N: Название» — ровно так оно выглядело в
 * старом файле курса, поэтому страницам не пришлось меняться.
 */
export const basicLessons: BasicLesson[] = modules.flatMap((courseModule) =>
  courseModule.lessons.map((lesson) => ({
    id: Number(lesson.lesson_id),
    title: lesson.lesson_title,
    duration: lesson.duration,
    module: `Модуль ${courseModule.module_order}: ${courseModule.module_title}`,
    tier: lesson.tier ?? "basic",
    blocks: lesson.blocks,
  })),
);
