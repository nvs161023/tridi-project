/**
 * Четыре уровня курса для витрины: названия, аудитория, обещание и цифры.
 *
 * Цифры не пишутся текстом: уроки, схемы и тесты считаются из файлов курсов
 * (data/lessons.json и data/course-*.json), а названия и goal берутся из
 * data/courses.json. Поэтому главная и тарифы не могут разойтись с содержимым:
 * оба экрана читают этот модуль, а не собственные копии чисел.
 *
 * Старый продвинутый курс (data/course-pro.json) выведен из доступа и витрины:
 * его данные остаются в репозитории как архив, но в счётчики не входят.
 */
import confidentData from "@/data/course-confident.json";
import engineerData from "@/data/course-engineer.json";
import coursesData from "@/data/courses.json";
import lessonsData from "@/data/lessons.json";
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

/** Платные уровни: всё, что покупается по отдельности или пакетом. */
export type PaidLevelKey = Exclude<LevelKey, "basic">;

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
  /** Разовая цена курса из data/courses.json; у бесплатного уровня — 0. */
  price: number;
  /**
   * Старая цена до акции из data/courses.json.
   * Показывается зачёркнутой рядом с текущей ценой.
   */
  oldPrice?: number;
  /** Маркетинговый бейдж из data/courses.json: «Акция», «-40%». */
  badge?: string;
  modules: number;
  lessons: number;
  /** Число уроков из data/courses.json (totalLessons). */
  totalLessons: number;
  /** Оценка объёма из data/courses.json (estimated_hours), в академических часах. */
  estimatedHours: number;
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
    href: key === "basic" ? "/course/lesson-1" : `/courses/${key}`,
    isFree: key === "basic",
    price: "price" in meta ? meta.price : 0,
    oldPrice: "oldPrice" in meta ? meta.oldPrice : undefined,
    badge: "badge" in meta ? meta.badge : undefined,
    modules: summary.modules,
    lessons: summary.lessons,
    totalLessons: meta.totalLessons,
    estimatedHours: meta.estimated_hours,
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
export const PAID_LEVELS = LEVELS.filter(
  (level): level is CourseLevel & { key: PaidLevelKey } => !level.isFree,
);

/** Программа на сертификате: один уровень или весь пакет «Все 3 уровня». */
export type CertificateProgram = {
  /** Строка курса: «Уровень «Новичок»: 3D-печать с нуля» или «Полный курс (…)». */
  title: string;
  lessons: number;
  hours: number;
};

/**
 * Что напечатать на сертификате.
 *
 * Для отдельного уровня берём название из data/courses.json и объём из
 * totalLessons / estimated_hours. Для пакета pro показываем все три платных
 * уровня и их суммарный объём — иначе сертификат за пакет выглядел бы как
 * сертификат за один курс.
 */
export function getCertificateProgram(
  level: CourseLevel,
  fullCourse: boolean,
): CertificateProgram {
  if (fullCourse) {
    const levels = PAID_LEVELS.map((item) => item.shortTitle).join(", ");

    return {
      title: `Полный курс (Уровни: ${levels})`,
      lessons: PAID_LEVELS.reduce((sum, item) => sum + item.totalLessons, 0),
      hours: PAID_LEVELS.reduce((sum, item) => sum + item.estimatedHours, 0),
    };
  }

  return {
    title: `Уровень «${level.shortTitle}»: ${level.title}`,
    lessons: level.totalLessons,
    hours: level.estimatedHours,
  };
}

/** Продвинутый курс выведен из доступа, поэтому витрина считает только уровни. */
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

/** Все схемы относятся к четырём доступным уровням. */
export const TOTAL_VISUALS = TOTAL_LEVEL_VISUALS;

export const PAID_LESSONS = PAID_LEVELS.reduce(
  (sum, level) => sum + level.lessons,
  0,
);
export const PAID_VISUALS = PAID_LEVELS.reduce(
  (sum, level) => sum + level.visuals,
  0,
);
export const PAID_TESTS = PAID_LEVELS.reduce((sum, level) => sum + level.tests, 0);
