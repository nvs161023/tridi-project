/**
 * Уровень «Заработок»: данные и разворот модулей.
 *
 * Файл data/course-profit.json устроен как data/course-engineer.json (модуль →
 * уроки → тест по модулю), а страницы работают с плоским списком уроков: у урока
 * есть сквозной номер, длительность, модуль и признак последнего урока модуля.
 * Разворот живёт здесь, в одном месте, поэтому страницы уровня ничего не знают о
 * модульной структуре файла.
 *
 * Коды уроков строковые (Z1…Z8): префикс уровня Z, а не S, потому что в
 * продвинутом курсе есть модуль S «Продвинутые техники печати» (уроки S1–S4) — в
 * данных пересечения нет, но одинаковые коды в разговорах и логах путают.
 * Сквозной номер урока (lesson_order, 1…8) уходит в lesson_progress.lesson_id:
 * колонка числовая, поэтому код урока в базу не пишется, и «Урок X из 8» в шапке
 * считается по этому же номеру.
 *
 * Материалы уровня пишутся по частям: у урока может быть пустой blocks — тогда
 * страница урока показывает «Материал готовится», а не пустую страницу.
 */
import profitData from "@/data/course-profit.json";
import type {
  LessonBlock,
  MiniCheckQuestion,
  ProfitCourse,
  ProfitModule,
} from "@/lib/types";

/** Урок уровня в плоском виде: так его ждут страницы /course/profit/**. */
export type ProfitLessonInfo = {
  /** Код урока (Z1…Z8) — он же последний сегмент адреса. */
  lessonId: string;
  /** Сквозной номер урока в уровне (1…8) — он же lesson_id в прогрессе. */
  lessonNumber: number;
  title: string;
  duration: string;
  /** Код модуля («1»…«2») — предпоследний сегмент адреса. */
  moduleId: string;
  /** Место модуля в уровне (1…2): по нему читаются результаты тестов. */
  moduleOrder: number;
  /** «Модуль 1: Продукт и цена» — подпись модуля в уроке. */
  moduleLabel: string;
  isModuleFirst: boolean;
  isModuleLast: boolean;
  /** Уровень доступа урока: у «Заработка» он платный. */
  tier: string;
  blocks: LessonBlock[];
};

export const profitCourse: ProfitCourse = profitData;

/** Подпись модуля так, как она показывается в уроках уровня. */
export function profitModuleLabel(courseModule: ProfitModule): string {
  return `Модуль ${courseModule.module_order}: ${courseModule.module_title}`;
}

/** Модули по порядку, уроки внутри — по порядку: от этого зависят номера уроков. */
export const profitModules: ProfitModule[] = [...profitCourse.modules]
  .sort((a, b) => a.module_order - b.module_order)
  .map((courseModule) => ({
    ...courseModule,
    lessons: [...courseModule.lessons].sort(
      (a, b) => a.lesson_order - b.lesson_order,
    ),
  }));

/** Уроки уровня по порядку: /course/profit/1/Z1 … /course/profit/2/Z8. */
export const profitLessons: ProfitLessonInfo[] = profitModules.flatMap(
  (courseModule) =>
    courseModule.lessons.map((lesson, index) => ({
      lessonId: lesson.lesson_id,
      lessonNumber: lesson.lesson_order,
      title: lesson.lesson_title,
      duration: lesson.duration,
      moduleId: courseModule.module_id,
      moduleOrder: courseModule.module_order,
      moduleLabel: profitModuleLabel(courseModule),
      isModuleFirst: index === 0,
      isModuleLast: index === courseModule.lessons.length - 1,
      tier: lesson.tier ?? "profit",
      blocks: lesson.blocks,
    })),
);

/** Модуль по коду из адреса или null, если такого модуля нет. */
export function findProfitModule(moduleId: string): ProfitModule | null {
  return (
    profitModules.find((courseModule) => courseModule.module_id === moduleId) ??
    null
  );
}

/** Урок по коду модуля и кода урока или null, если такого урока нет. */
export function findProfitLesson(
  moduleId: string,
  lessonId: string,
): ProfitLessonInfo | null {
  return (
    profitLessons.find(
      (lesson) => lesson.moduleId === moduleId && lesson.lessonId === lessonId,
    ) ?? null
  );
}

/** Вопросы теста модуля: у ненаписанного модуля список пустой. */
export function profitModuleQuestions(
  courseModule: ProfitModule,
): MiniCheckQuestion[] {
  return courseModule.module_test?.questions ?? [];
}

/** Модуль по месту в уровне (module_order) или null. */
export function findProfitModuleByOrder(
  moduleOrder: number,
): ProfitModule | null {
  return (
    profitModules.find(
      (courseModule) => courseModule.module_order === moduleOrder,
    ) ?? null
  );
}
