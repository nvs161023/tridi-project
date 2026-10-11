/**
 * Уровень «Инженер»: данные и разворот модулей.
 *
 * Файл data/course-engineer.json устроен как data/course-confident.json (модуль →
 * уроки → тест по модулю), а страницы работают с плоским списком уроков: у урока
 * есть сквозной номер, длительность, модуль и признак последнего урока модуля.
 * Разворот живёт здесь, в одном месте, поэтому страницы уровня ничего не знают о
 * модульной структуре файла.
 *
 * Коды уроков строковые (IN1…IN10): префикс уровня IN, а не I, потому что уроки
 * I1–I5 есть в продвинутом курсе («Качество печати») — в данных пересечения нет,
 * но одинаковые коды в разговорах и логах путают. Сквозной номер урока
 * (lesson_order, 1…10) уходит в lesson_progress.lesson_id: колонка числовая,
 * поэтому код урока в базу не пишется, и «Урок X из 10» в шапке считается по
 * этому же номеру.
 *
 * Материалы уровня пишутся по частям: у урока может быть пустой blocks — тогда
 * страница урока показывает «Материал готовится», а не пустую страницу.
 */
import engineerData from "@/data/course-engineer.json";
import type {
  EngineerCourse,
  EngineerModule,
  LessonBlock,
  MiniCheckQuestion,
} from "@/lib/types";

/** Урок уровня в плоском виде: так его ждут страницы /course/engineer/**. */
export type EngineerLessonInfo = {
  /** Код урока (IN1…IN10) — он же последний сегмент адреса. */
  lessonId: string;
  /** Сквозной номер урока в уровне (1…10) — он же lesson_id в прогрессе. */
  lessonNumber: number;
  title: string;
  duration: string;
  /** Код модуля («1»…«2») — предпоследний сегмент адреса. */
  moduleId: string;
  /** Место модуля в уровне (1…2): по нему читаются результаты тестов. */
  moduleOrder: number;
  /** «Модуль 1: Расчёт и проектирование» — подпись модуля в уроке. */
  moduleLabel: string;
  isModuleFirst: boolean;
  isModuleLast: boolean;
  /** Уровень доступа урока: у «Инженера» он платный. */
  tier: string;
  blocks: LessonBlock[];
};

export const engineerCourse: EngineerCourse = engineerData;

/** Подпись модуля так, как она показывается в уроках уровня. */
export function engineerModuleLabel(courseModule: EngineerModule): string {
  return `Модуль ${courseModule.module_order}: ${courseModule.module_title}`;
}

/** Модули по порядку, уроки внутри — по порядку: от этого зависят номера уроков. */
export const engineerModules: EngineerModule[] = [...engineerCourse.modules]
  .sort((a, b) => a.module_order - b.module_order)
  .map((courseModule) => ({
    ...courseModule,
    lessons: [...courseModule.lessons].sort(
      (a, b) => a.lesson_order - b.lesson_order,
    ),
  }));

/** Уроки уровня по порядку: /course/engineer/1/IN1 … /course/engineer/2/IN10. */
export const engineerLessons: EngineerLessonInfo[] = engineerModules.flatMap(
  (courseModule) =>
    courseModule.lessons.map((lesson, index) => ({
      lessonId: lesson.lesson_id,
      lessonNumber: lesson.lesson_order,
      title: lesson.lesson_title,
      duration: lesson.duration,
      moduleId: courseModule.module_id,
      moduleOrder: courseModule.module_order,
      moduleLabel: engineerModuleLabel(courseModule),
      isModuleFirst: index === 0,
      isModuleLast: index === courseModule.lessons.length - 1,
      tier: lesson.tier ?? "engineer",
      blocks: lesson.blocks,
    })),
);

/** Модуль по коду из адреса или null, если такого модуля нет. */
export function findEngineerModule(moduleId: string): EngineerModule | null {
  return (
    engineerModules.find((courseModule) => courseModule.module_id === moduleId) ??
    null
  );
}

/** Урок по коду модуля и кода урока или null, если такого урока нет. */
export function findEngineerLesson(
  moduleId: string,
  lessonId: string,
): EngineerLessonInfo | null {
  return (
    engineerLessons.find(
      (lesson) => lesson.moduleId === moduleId && lesson.lessonId === lessonId,
    ) ?? null
  );
}

/** Вопросы теста модуля: у ненаписанного модуля список пустой. */
export function engineerModuleQuestions(
  courseModule: EngineerModule,
): MiniCheckQuestion[] {
  return courseModule.module_test?.questions ?? [];
}

/** Модуль по месту в уровне (module_order) или null. */
export function findEngineerModuleByOrder(
  moduleOrder: number,
): EngineerModule | null {
  return (
    engineerModules.find(
      (courseModule) => courseModule.module_order === moduleOrder,
    ) ?? null
  );
}
