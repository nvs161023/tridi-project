/**
 * Помощники для витрин курсов.
 *
 * Цифры на страницах (сколько уроков в модуле, сколько всего уроков, сколько
 * часов идёт курс) считаются из data/lessons.json и data/course-pro.json,
 * а не хранятся текстом. Поэтому витрина не может «отстать» от содержимого
 * курсов, и главная со страницей тарифов показывают одинаковые числа.
 *
 * Оба курса лежат модулями, поэтому сводку для витрины считает summarizeCourse.
 * groupByModule остаётся для карточек, где модули показываются списком с числом
 * уроков, — на вход он получает уже развёрнутые уроки (см. lib/basic-course.ts).
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
export const VISUAL_FORMS: [string, string, string] = ["схема", "схемы", "схем"];
export const TEST_FORMS: [string, string, string] = ["тест", "теста", "тестов"];

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

/**
 * «~18 часов» — объём программы в академических часах.
 *
 * Часы берутся из data/courses.json (estimated_hours) и означают работу с
 * практикой, а не время чтения текста. Время чтения лежит в duration урока
 * (см. tmp-замер в COURSES-AUDIT.md): витрина раньше складывала duration и
 * обещала «~5 часов», хотя сертификат печатал 18. Теперь число одно на всех
 * экранах — карточка уровня, страница курса и сертификат.
 */
export function formatAcademicHours(hours: number): string {
  return `~${hours} ${pluralize(hours, HOUR_FORMS)}`;
}

/** Курс, разложенный по модулям: минимум, нужный витрине для подсчёта чисел. */
export type ModularCourseLike = {
  modules: { lessons: unknown[] }[];
};

/**
 * Курс, из которого витрина считает схемы и тесты.
 *
 * Блок с полем visual_file — это блок, для которого нарисован кадр. Считаем
 * именно такие блоки: витрина не должна обещать больше картинок, чем лежит в
 * курсе. Тест модуля считается написанным, если в нём есть вопросы.
 */
export type CourseContentLike = {
  modules: {
    lessons: { duration: string; blocks: { visual_file?: string | null }[] }[];
    module_test?: { questions: { explanations?: unknown[] }[] } | null;
  }[];
};

/** Сколько блоков курса обеспечены собственной нарисованной схемой. */
export function countVisualBlocks(course: CourseContentLike): number {
  return course.modules
    .flatMap((courseModule) => courseModule.lessons)
    .flatMap((lesson) => lesson.blocks)
    .filter((block) => Boolean(block.visual_file)).length;
}

/** Сколько тестов модулей написано (в модуле есть хотя бы один вопрос). */
export function countModuleTests(course: CourseContentLike): number {
  return course.modules.filter(
    (courseModule) => (courseModule.module_test?.questions.length ?? 0) > 0,
  ).length;
}

/** Сколько вопросов во всех тестах курса. */
export function countQuestions(course: CourseContentLike): number {
  return course.modules.reduce(
    (sum, courseModule) =>
      sum + (courseModule.module_test?.questions.length ?? 0),
    0,
  );
}

/** Сколько пояснений к ответам лежит во всех тестах курса. */
export function countExplanations(course: CourseContentLike): number {
  return course.modules.reduce(
    (sum, courseModule) =>
      sum +
      (courseModule.module_test?.questions ?? []).reduce(
        (questionSum, question) =>
          questionSum + (question.explanations?.length ?? 0),
        0,
      ),
    0,
  );
}

/**
 * Сводка курса для витрины: сколько модулей и уроков.
 *
 * Часы сюда не входят: объём программы живёт в data/courses.json
 * (estimated_hours) и читается через formatAcademicHours. Складывать duration
 * уроков для «длительности курса» нельзя — это время чтения, а не программа.
 *
 * В data/course-pro.json курс уже лежит модулями, поэтому группировать нечего —
 * считаем прямо по файлу. Так главная, тарифы и финал базового курса показывают
 * те же числа, что лежат в курсе, и не могут «отстать» от него.
 *
 * Уроки считаем по самим модулям, а не по полю total_lessons: поле — метаданные
 * витрины, и оно уже однажды разошлось с содержимым (заявляло 110 уроков при
 * 109). Совпадение полей проверяет `npm run check:docs`.
 */
export function summarizeCourse(course: ModularCourseLike): {
  modules: number;
  lessons: number;
} {
  const lessons = course.modules.flatMap((courseModule) => courseModule.lessons);

  return {
    modules: course.modules.length,
    lessons: lessons.length,
  };
}
