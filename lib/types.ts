/**
 * Типы данных курсов.
 *
 * Здесь только форма данных: и базовый (data/lessons.json), и продвинутый
 * (data/course-pro.json) курс лежат модулями — модуль, уроки внутри него и тест по
 * модулю. Внешний вид блоков живёт в components/course/LessonBlocks.tsx, цифры для
 * витрины считает lib/course-stats.ts, а разворот базового курса в плоский список
 * уроков — lib/basic-course.ts.
 */

/**
 * Типы блоков урока, которые умеет рисовать LessonBlocks.
 *
 * text, list, tip, warning, analogy, steps — текст, списки и подсказки;
 * image, animation, screenshot, diagram — визуализация (на Этапе 2 свой SVG,
 * пока — заглушка с иконкой);
 * mini_check — мини-проверка в конце урока (components/course/MiniCheck.tsx).
 */
export type LessonBlockType =
  | "text"
  | "list"
  | "tip"
  | "warning"
  | "analogy"
  | "steps"
  | "image"
  | "animation"
  | "screenshot"
  | "diagram"
  | "mini_check";

/** Шаг инструкции: заголовок и пояснение к нему. */
export type LessonBlockStep = {
  title: string;
  text: string;
};

/** Вопрос мини-проверки: варианты ответа и номер правильного (с нуля). */
export type MiniCheckQuestion = {
  question: string;
  answers: string[];
  correct: number;
  /**
   * Пояснение к каждому варианту — в том же порядке, что answers: почему вариант
   * верен или почему не подходит. Поле необязательное: у данных без пояснений
   * тест просто показывает правильность, ничего не выдумывая.
   */
  explanations?: string[];
};

/**
 * Блок урока.
 *
 * type — строка, а не LessonBlockType: блоки приходят из JSON, где TypeScript
 * выводит обычную строку, и строгий union заставил бы приводить тип всему файлу
 * курса. Незнакомый тип просто не рисуется (см. LessonBlocks).
 */
export type LessonBlock = {
  /** Тип блока — см. LessonBlockType. */
  type: string;
  title?: string;
  content?: string;
  /** Готовый файл картинки, если у блока он есть. */
  src?: string;
  /** Имя файла визуализации из источника: по нему на Этапе 2 соберётся SVG. */
  visual_file?: string;
  /** Пункты блока list. */
  items?: string[];
  /** Шаги блока steps: строки или пары «заголовок — пояснение». */
  steps?: (LessonBlockStep | string)[];
  /** Вопросы блока mini_check. */
  questions?: MiniCheckQuestion[];
};

/** Урок продвинутого курса. */
export type ProLesson = {
  /** Код урока: A1, C1-1, T14 — он же последний сегмент адреса. */
  lesson_id: string;
  /** Место урока внутри модуля, с единицы. */
  lesson_order: number;
  lesson_title: string;
  /** Длительность строкой: «25 мин». */
  duration: string;
  blocks: LessonBlock[];
};

/** Тест по модулю: та же форма, что у mini_check. */
export type ProModuleTest = {
  questions: MiniCheckQuestion[];
};

/** Модуль продвинутого курса. */
export type ProModule = {
  /** Код модуля: A, C1, T-тизер — он же предпоследний сегмент адреса. */
  module_id: string;
  /** Место модуля в курсе, с единицы. */
  module_order: number;
  module_title: string;
  module_description: string;
  lessons: ProLesson[];
  module_test?: ProModuleTest;
};

/** Файл продвинутого курса целиком (data/course-pro.json). */
export type ProCourse = {
  course_id: string;
  course_title: string;
  version: string;
  /**
   * Заявленные в файле числа. Показывать их нельзя — считать надёжнее по самим
   * модулям: в текущей версии файла total_lessons заявляет 110 уроков, а лежит
   * 109 (см. lib/course-stats.ts, summarizeCourse).
   */
  total_modules: number;
  total_lessons: number;
  modules: ProModule[];
};

/**
 * Урок базового курса (data/lessons.json).
 *
 * Форма та же, что у продвинутого урока, плюс уровень доступа: базовый курс
 * бесплатный, поэтому у всех уроков tier = "basic".
 */
export type BaseLesson = {
  /** Номер урока строкой: "1"…"15" — он же номер в адресе /course/lesson-N. */
  lesson_id: string;
  /** Место урока внутри модуля, с единицы. */
  lesson_order: number;
  lesson_title: string;
  /** Длительность строкой: «15 мин». */
  duration: string;
  /** Уровень доступа урока. */
  tier?: string;
  blocks: LessonBlock[];
};

/** Модуль базового курса — та же форма, что у продвинутого. */
export type BaseModule = {
  /** Номер модуля строкой: "1"…"6". */
  module_id: string;
  /** Место модуля в курсе, с единицы. */
  module_order: number;
  module_title: string;
  module_description: string;
  lessons: BaseLesson[];
  module_test?: ProModuleTest;
};

/**
 * Файл базового курса целиком (data/lessons.json).
 *
 * Как и у продвинутого курса, число уроков считаем по модулям, а не по
 * total_lessons: заявленные числа — это метаданные витрины, они легко отстают от
 * содержимого.
 */
export type BaseCourse = {
  course_id: string;
  course_title: string;
  version: string;
  /** Назначение курса в воронке, например "free_funnel". */
  type?: string;
  total_modules: number;
  total_lessons: number;
  /** Сколько практикумов, тестов по модулям и мини-проверок заявлено в файле. */
  total_practicums?: number;
  total_module_tests?: number;
  total_mini_checks?: number;
  modules: BaseModule[];
};
