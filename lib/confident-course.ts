/**
 * Уровень «Уверенный»: данные и разворот модулей.
 *
 * Файл data/course-confident.json устроен как data/course-pro.json (модуль →
 * уроки → тест по модулю), а страницы работают с плоским списком уроков: у урока
 * есть сквозной номер, длительность, модуль и признак последнего урока модуля.
 * Разворот живёт здесь, в одном месте, поэтому страницы уровня ничего не знают о
 * модульной структуре файла.
 *
 * Коды уроков строковые (C1…C12) — как у продвинутого курса (A1, C1-1), — а
 * сквозной номер урока (lesson_order, 1…12) уходит в lesson_progress.lesson_id:
 * колонка числовая, поэтому код урока в базу не пишется, и «Урок X из 12» в шапке
 * считается по этому же номеру.
 *
 * Материалы уровня пишутся по частям: у урока может быть пустой blocks — тогда
 * страница урока показывает «Материал готовится», а не пустую страницу.
 */
import confidentData from "@/data/course-confident.json";
import type {
  ConfidentCourse,
  ConfidentModule,
  LessonBlock,
  MiniCheckQuestion,
} from "@/lib/types";

/** Урок уровня в плоском виде: так его ждут страницы /course/confident/**. */
export type ConfidentLessonInfo = {
  /** Код урока (C1…C12) — он же последний сегмент адреса. */
  lessonId: string;
  /** Сквозной номер урока в уровне (1…12) — он же lesson_id в прогрессе. */
  lessonNumber: number;
  title: string;
  duration: string;
  /** Код модуля («1»…«3») — предпоследний сегмент адреса. */
  moduleId: string;
  /** Место модуля в уровне (1…3): по нему читаются результаты тестов. */
  moduleOrder: number;
  /** «Модуль 1: Безопасность и контроль» — подпись модуля в уроке. */
  moduleLabel: string;
  isModuleFirst: boolean;
  isModuleLast: boolean;
  /** Уровень доступа урока: у «Уверенного» он платный. */
  tier: string;
  blocks: LessonBlock[];
};

export const confidentCourse: ConfidentCourse = confidentData;

/** Подпись модуля так, как она показывается в уроках уровня. */
export function confidentModuleLabel(courseModule: ConfidentModule): string {
  return `Модуль ${courseModule.module_order}: ${courseModule.module_title}`;
}

/** Модули по порядку, уроки внутри — по порядку: от этого зависят номера уроков. */
export const confidentModules: ConfidentModule[] = [
  ...confidentCourse.modules,
]
  .sort((a, b) => a.module_order - b.module_order)
  .map((courseModule) => ({
    ...courseModule,
    lessons: [...courseModule.lessons].sort(
      (a, b) => a.lesson_order - b.lesson_order,
    ),
  }));

/** Уроки уровня по порядку: /course/confident/1/C1 … /course/confident/3/C12. */
export const confidentLessons: ConfidentLessonInfo[] = confidentModules.flatMap(
  (courseModule) =>
    courseModule.lessons.map((lesson, index) => ({
      lessonId: lesson.lesson_id,
      lessonNumber: lesson.lesson_order,
      title: lesson.lesson_title,
      duration: lesson.duration,
      moduleId: courseModule.module_id,
      moduleOrder: courseModule.module_order,
      moduleLabel: confidentModuleLabel(courseModule),
      isModuleFirst: index === 0,
      isModuleLast: index === courseModule.lessons.length - 1,
      tier: lesson.tier ?? "confident",
      blocks: lesson.blocks,
    })),
);

/** Модуль по коду из адреса или null, если такого модуля нет. */
export function findConfidentModule(moduleId: string): ConfidentModule | null {
  return (
    confidentModules.find(
      (courseModule) => courseModule.module_id === moduleId,
    ) ?? null
  );
}

/** Урок по коду модуля и кода урока или null, если такого урока нет. */
export function findConfidentLesson(
  moduleId: string,
  lessonId: string,
): ConfidentLessonInfo | null {
  return (
    confidentLessons.find(
      (lesson) => lesson.moduleId === moduleId && lesson.lessonId === lessonId,
    ) ?? null
  );
}

/** Вопросы теста модуля: у ненаписанного модуля список пустой. */
export function confidentModuleQuestions(
  courseModule: ConfidentModule,
): MiniCheckQuestion[] {
  return courseModule.module_test?.questions ?? [];
}

/** Модуль по месту в уровне (module_order) или null. */
export function findConfidentModuleByOrder(
  moduleOrder: number,
): ConfidentModule | null {
  return (
    confidentModules.find(
      (courseModule) => courseModule.module_order === moduleOrder,
    ) ?? null
  );
}
