/**
 * Четыре уровня курса для витрины: названия, аудитория, обещание и цифры.
 *
 * Цифры не пишутся текстом: уроки, схемы и тесты считаются из файлов курсов
 * (data/lessons.json и data/course-*.json), а названия и goal берутся из
 * data/courses.json. Поэтому главная и тарифы не могут разойтись с содержимым:
 * оба экрана читают этот модуль, а не собственные копии чисел.
 *
 * Продвинутый курс (data/course-pro.json) в четыре уровня не входит: это
 * отдельный большой курс, который открывается той же подпиской Pro. Его схемы
 * нужны только для общего счётчика проекта — 410 кадров.
 */
import confidentData from "@/data/course-confident.json";
import engineerData from "@/data/course-engineer.json";
import coursesData from "@/data/courses.json";
import lessonsData from "@/data/lessons.json";
import courseProData from "@/data/course-pro.json";
import profitData from "@/data/course-profit.json";
import {
  countExplanations,
  countModuleTests,
  countQuestions,
  countVisualBlocks,
  summarizeCourse,
  type CourseContentLike,
} from "./course-stats";

export type LevelKey = "basic" | "confident" | "engineer" | "profit";

/** Уровень в том виде, в каком его показывает витрина. */
export type CourseLevel = {
  key: LevelKey;
  /** Короткий код уровня: L, C, IN, Z. */
  code: string;
  /** Название для колонки тарифов: «Новичок», «Уверенный», … */
  shortTitle: string;
  /** Полное название курса из data/courses.json. */
  title: string;
  subtitle: string;
  /** Кому уровень: одна строка для карточки. */
  audience: string;
  /** Обещание результата из data/courses.json. */
  goal: string;
  /** Что человек унесёт с уровня — короткие пункты для карточки. */
  outcomes: string[];
  /** Куда ведёт кнопка уровня. */
  href: string;
  isFree: boolean;
  modules: number;
  lessons: number;
  hours: string;
  visuals: number;
  tests: number;
  questions: number;
};

/** Файлы четырёх уровней — единственный источник цифр витрины. */
const LEVEL_CONTENT: Record<LevelKey, CourseContentLike> = {
  basic: lessonsData,
  confident: confidentData,
  engineer: engineerData,
  profit: profitData,
};

/** Тексты, которых нет в данных курсов: аудитория и короткие итоги. */
const LEVEL_COPY: Record<
  LevelKey,
  { code: string; shortTitle: string; audience: string; outcomes: string[] }
> = {
  basic: {
    code: "L1–L8",
    shortTitle: "Новичок",
    audience: "Только распаковал принтер",
    outcomes: [
      "Технологии печати и калибровка",
      "Первый слой и адгезия",
      "Диагностика 15 дефектов",
      "Первый проект целиком",
    ],
  },
  confident: {
    code: "C1–C12",
    shortTitle: "Уверенный",
    audience: "Печатает, но боится сложных деталей",
    outcomes: [
      "Безопасность: воздух и химия",
      "Поддержки и модификаторы слайсера",
      "Детали больше стола",
      "Удалённое управление принтером",
    ],
  },
  engineer: {
    code: "IN1–IN10",
    shortTitle: "Инженер",
    audience: "Делает функциональные детали",
    outcomes: [
      "Материал под нагрузку и температуру",
      "Рёбра и расчёт до печати",
      "Проверка расчёта симуляцией",
      "Повтор чужой детали по замерам",
    ],
  },
  profit: {
    code: "Z1–Z8",
    shortTitle: "Заработок",
    audience: "Хочет превратить печать в доход",
    outcomes: [
      "Ниша и продукт",
      "Себестоимость и цена на числах",
      "Партия и контроль качества",
      "Фото, продажи и налоги",
    ],
  },
};

/** Собирает уровень: метаданные из courses.json, цифры — из файла курса. */
function buildLevel(key: LevelKey): CourseLevel {
  const content = LEVEL_CONTENT[key];
  const meta = coursesData[key];
  const summary = summarizeCourse(content);
  const copy = LEVEL_COPY[key];

  return {
    key,
    code: copy.code,
    shortTitle: copy.shortTitle,
    title: meta.title,
    subtitle: meta.subtitle,
    audience: copy.audience,
    goal: meta.goal,
    outcomes: copy.outcomes,
    href: key === "basic" ? "/course/lesson-1" : "/subscription",
    isFree: key === "basic",
    modules: summary.modules,
    lessons: summary.lessons,
    hours: summary.hours,
    visuals: countVisualBlocks(content),
    tests: countModuleTests(content),
    questions: countQuestions(content),
  };
}

/** Четыре уровня в порядке прохождения. */
export const LEVELS: CourseLevel[] = [
  buildLevel("basic"),
  buildLevel("confident"),
  buildLevel("engineer"),
  buildLevel("profit"),
];

/** Всё, что открывает подписка: три платных уровня без базового. */
export const PAID_LEVELS: CourseLevel[] = LEVELS.filter((level) => !level.isFree);

/** Продвинутый курс — бонус подписки и часть общего счётчика 410 схем. */
const proSummary = summarizeCourse(courseProData);
export const PRO_VISUALS = countVisualBlocks(courseProData);
export const PRO_LESSONS = proSummary.lessons;
export const PRO_HOURS = proSummary.hours;

export const TOTAL_LESSONS = LEVELS.reduce((sum, level) => sum + level.lessons, 0);
export const TOTAL_LEVEL_VISUALS = LEVELS.reduce(
  (sum, level) => sum + level.visuals,
  0,
);
export const TOTAL_TESTS = LEVELS.reduce((sum, level) => sum + level.tests, 0);
export const TOTAL_QUESTIONS = LEVELS.reduce(
  (sum, level) => sum + level.questions,
  0,
);
export const TOTAL_EXPLANATIONS = LEVELS.reduce(
  (sum, level) => sum + countExplanations(LEVEL_CONTENT[level.key]),
  0,
);

/** 410 схем проекта: 250 в четырёх уровнях + 160 в продвинутом курсе. */
export const TOTAL_VISUALS = TOTAL_LEVEL_VISUALS + PRO_VISUALS;

export const PAID_LESSONS = PAID_LEVELS.reduce(
  (sum, level) => sum + level.lessons,
  0,
);
export const PAID_VISUALS = PAID_LEVELS.reduce(
  (sum, level) => sum + level.visuals,
  0,
);
export const PAID_TESTS = PAID_LEVELS.reduce((sum, level) => sum + level.tests, 0);
