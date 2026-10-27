/**
 * Продающие страницы отдельных курсов: /courses/confident, /courses/engineer,
 * /courses/profit и /courses/pro.
 *
 * Названия, цены и бейджи берутся из data/courses.json, цифры и программа — из
 * файлов курсов. Здесь лежит только маркетинговый текст, которого нет в данных:
 * боль, портреты аудитории и обещанный результат.
 *
 * Пакет `pro` — это три платных уровня вместе. Его программа собирается из тех же
 * модулей, что и отдельные страницы, поэтому на лендинге не может оказаться
 * другого количества уроков, схем или тестов. Продвинутый курс на 109 уроков в
 * пакет не входит: он продаётся отдельным курсом, как и до пакета.
 */
import confidentData from "@/data/course-confident.json";
import engineerData from "@/data/course-engineer.json";
import coursesData from "@/data/courses.json";
import profitData from "@/data/course-profit.json";
import {
  PAID_LEVELS,
  type CourseLevel,
  type PaidLevelKey,
} from "@/lib/course-levels";
import { collectArtifacts, type CourseArtifact } from "@/lib/course-artifacts";
import { formatAcademicHours } from "@/lib/course-stats";

/** Курсы, для которых есть отдельная продающая страница. */
export type CourseLandingId = "confident" | "engineer" | "profit" | "pro";

/** Урок в том виде, в каком его показывает программа лендинга. */
export type LandingLesson = {
  code: string;
  title: string;
  duration: string;
  /** Написан ли материал: у пустого урока в программе стоит «Готовится». */
  hasMaterial: boolean;
};

/** Модуль курса с уроками — блок «Что вы получите». */
export type LandingModule = {
  id: string;
  title: string;
  description: string;
  lessons: LandingLesson[];
};

/** Один уровень в программе: у пакета таких групп три, у курса — одна. */
export type LandingProgramGroup = {
  key: PaidLevelKey;
  title: string;
  subtitle: string;
  lessons: number;
  modules: LandingModule[];
};

/** Портрет ученика: короткий заголовок и пояснение. */
export type LandingAudience = {
  title: string;
  text: string;
};

/** Палитра страницы: статические классы Tailwind, чтобы они попали в сборку. */
export type LandingTheme = {
  text: string;
  border: string;
  soft: string;
  gradient: string;
  glow: string;
  badge: string;
  button: "blue" | "gold";
};

/** Всё, что нужно странице /courses/[id]. */
export type CourseLanding = {
  id: CourseLandingId;
  /** Ключ товара для PlanButton и Robokassa. */
  paymentId: PaidLevelKey | "pro";
  kicker: string;
  title: string;
  subtitle: string;
  /** Проблема, с которой приходит ученик. */
  problem: string;
  /** Подробное обещание курса из data/courses.json. */
  goal: string;
  price: number;
  badge?: string;
  /** Сколько сэкономит пакет против трёх отдельных курсов. */
  saving?: number;
  modules: number;
  lessons: number;
  visuals: number;
  tests: number;
  questions: number;
  /** Файлы к урокам: у пакета — файлы всех трёх уровней без повторов. */
  artifacts: CourseArtifact[];
  hours: string;
  audience: LandingAudience[];
  results: string[];
  program: LandingProgramGroup[];
  theme: LandingTheme;
};

/** Минимум, который нужен от JSON курса для программы лендинга. */
type RawLesson = {
  lesson_id: string;
  lesson_order: number;
  lesson_title: string;
  duration: string;
  blocks: unknown[];
};

type RawModule = {
  module_id: string;
  module_order: number;
  module_title: string;
  module_description: string;
  lessons: RawLesson[];
};

/** Модули трёх платных уровней — единственный источник программы. */
const LEVEL_MODULES: Record<PaidLevelKey, RawModule[]> = {
  confident: confidentData.modules,
  engineer: engineerData.modules,
  profit: profitData.modules,
};

const LEVEL_THEMES: Record<CourseLandingId, LandingTheme> = {
  confident: {
    text: "text-violet-300",
    border: "border-violet-400/30",
    soft: "bg-violet-500/10",
    gradient: "from-violet-500/20 via-slate-900/90 to-slate-900",
    glow: "bg-violet-500/20",
    badge: "border-violet-400/40 bg-violet-500/10 text-violet-200",
    button: "blue",
  },
  engineer: {
    text: "text-emerald-300",
    border: "border-emerald-400/30",
    soft: "bg-emerald-500/10",
    gradient: "from-emerald-500/20 via-slate-900/90 to-slate-900",
    glow: "bg-emerald-500/20",
    badge: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
    button: "blue",
  },
  profit: {
    text: "text-amber-300",
    border: "border-amber-400/30",
    soft: "bg-amber-500/10",
    gradient: "from-amber-500/20 via-slate-900/90 to-slate-900",
    glow: "bg-amber-500/20",
    badge: "border-amber-400/40 bg-amber-500/10 text-amber-200",
    button: "blue",
  },
  pro: {
    text: "text-amber-300",
    border: "border-amber-300/50",
    soft: "bg-amber-400/10",
    gradient: "from-amber-300/25 via-amber-500/10 to-slate-900",
    glow: "bg-amber-400/25",
    badge: "border-amber-300/50 bg-amber-400/15 text-amber-100",
    button: "gold",
  },
};

/** Маркетинговый текст, которого нет в data/courses.json. */
const COURSE_COPY: Record<
  CourseLandingId,
  {
    kicker: string;
    problem: string;
    audience: LandingAudience[];
    results: string[];
  }
> = {
  confident: {
    kicker: "Второй уровень программы",
    problem:
      "Сложные детали падают, поддержки оставляют следы, а мастерская пахнет пластиком? Курс закрывает то, что ломается после первых успешных печатей.",
    audience: [
      {
        title: "Прошли «Новичка»",
        text: "Печатаете простые модели и хотите перейти к деталям со свесами, мостами и подвижными элементами.",
      },
      {
        title: "Печатаете дома",
        text: "Нужна безопасная мастерская: понятная вентиляция, хранение химии и защита от вредных испарений.",
      },
      {
        title: "Боитесь сложных моделей",
        text: "Поддержки, модификаторы и детали больше стола пока кажутся лотереей, а не управляемым процессом.",
      },
    ],
    results: [
      "Настроите безопасность мастерской: воздух, химия, хранение и защита.",
      "Научитесь ставить поддержки и модификаторы без следов и лишнего пластика.",
      "Напечатаете деталь больше стола и соберёте её без перекоса.",
      "Настроите удалённый контроль печати и раннее обнаружение дефектов.",
    ],
  },
  engineer: {
    kicker: "Третий уровень программы",
    problem:
      "Деталь ломается под нагрузкой, а повтор чужой модели превращается в угадайку? Курс учит считать, проверять и воспроизводить, а не подбирать наугад.",
    audience: [
      {
        title: "Делаете функциональные детали",
        text: "Кронштейны, втулки, крепления и корпуса, где важна не только форма, но и прочность.",
      },
      {
        title: "Работаете с нагрузками",
        text: "Нужно понимать, какой материал, какое сечение и какие рёбра выдержат условия эксплуатации.",
      },
      {
        title: "Повторяете чужие модели",
        text: "Хотите воспроизводить деталь по замерам или скану и быть уверенным в посадке.",
      },
    ],
    results: [
      "Подберёте материал под нагрузку, температуру и условия эксплуатации.",
      "Добавите рёбра и проверите расчёт симуляцией до печати.",
      "Повторите чужую деталь по замерам или скану без угадывания.",
      "Запишете свою процедуру печати, чтобы результат повторялся.",
    ],
  },
  profit: {
    kicker: "Четвёртый уровень программы",
    problem:
      "Печать есть, а дохода нет: цена берётся с потолка, партия не повторяется, покупатели не возвращаются? Курс собирает это в систему.",
    audience: [
      {
        title: "Хотите монетизировать хобби",
        text: "Печать уже получается, но непонятно, что продавать, кому и по какой цене.",
      },
      {
        title: "Уже продаёте",
        text: "Нужна система: себестоимость, повторяемая партия, контроль качества, фото и документы.",
      },
      {
        title: "Планируете мини-производство",
        text: "Хотите прийти к повторяемому продукту, а не к разовым заказам «срочно на завтра».",
      },
    ],
    results: [
      "Выберете нишу и продукт, который готовы покупать.",
      "Посчитаете себестоимость и поставите цену на числах, а не на ощущениях.",
      "Соберёте партию и настроите контроль качества.",
      "Подготовите фото, продажи, доставку и оформление дохода.",
    ],
  },
  pro: {
    kicker: "Пакет «Всё включено»",
    problem:
      "Не хотите выбирать между уровнями и покупать по одному? Пакет собирает весь платный путь: от безопасности мастерской до продаж и оформления дохода.",
    audience: [
      {
        title: "Хотите пройти путь целиком",
        text: "Нужна последовательная программа без пропусков и лишних покупок.",
      },
      {
        title: "Планируете зарабатывать",
        text: "Нужна база от безопасной печати до расчёта цены и продаж.",
      },
      {
        title: "Любите выгоду",
        text: "Пакет дешевле трёх курсов по отдельности, а доступ остаётся навсегда.",
      },
    ],
    results: [
      "Пройдёте все три платных уровня в правильном порядке.",
      "Закроете безопасность, слайсер, инженерию и продажи.",
      "Разберёте практику на своём принтере, а не только теорию.",
      "Сохраните доступ навсегда и сэкономите против покупки уровней по отдельности.",
    ],
  },
};

/** Модули курса по порядку, уроки внутри — тоже по порядку. */
function buildModules(rawModules: RawModule[]): LandingModule[] {
  return [...rawModules]
    .sort((a, b) => a.module_order - b.module_order)
    .map((courseModule) => ({
      id: courseModule.module_id,
      title: courseModule.module_title,
      description: courseModule.module_description,
      lessons: [...courseModule.lessons]
        .sort((a, b) => a.lesson_order - b.lesson_order)
        .map((lesson) => ({
          code: lesson.lesson_id,
          title: lesson.lesson_title,
          duration: lesson.duration,
          hasMaterial: lesson.blocks.length > 0,
        })),
    }));
}

/** Уровень витрины по ключу: PAID_LEVELS всегда содержит все три. */
function getPaidLevel(key: PaidLevelKey): CourseLevel {
  const level = PAID_LEVELS.find((item) => item.key === key);

  if (!level) {
    throw new Error(`Не найден платный уровень ${key}`);
  }

  return level;
}

/** Группа программы для одного уровня. */
function buildProgramGroup(key: PaidLevelKey): LandingProgramGroup {
  const level = getPaidLevel(key);

  return {
    key,
    title: level.title,
    subtitle: level.subtitle,
    lessons: level.lessons,
    modules: buildModules(LEVEL_MODULES[key]),
  };
}

/** Собирает страницу отдельного платного уровня. */
function buildLevelLanding(key: PaidLevelKey): CourseLanding {
  const level = getPaidLevel(key);
  const copy = COURSE_COPY[key];
  const program = [buildProgramGroup(key)];

  return {
    id: key,
    paymentId: key,
    kicker: copy.kicker,
    title: level.title,
    subtitle: level.subtitle,
    problem: copy.problem,
    goal: level.goal,
    price: level.price,
    modules: level.modules,
    lessons: level.lessons,
    visuals: level.visuals,
    tests: level.tests,
    questions: level.questions,
    artifacts: collectArtifacts(LEVEL_MODULES[key]),
    hours: level.hours,
    audience: copy.audience,
    results: copy.results,
    program,
    theme: LEVEL_THEMES[key],
  };
}

/** Собирает страницу пакета из трёх платных уровней. */
function buildProLanding(): CourseLanding {
  const copy = COURSE_COPY.pro;
  const levels = PAID_LEVELS.map((level) => buildProgramGroup(level.key));
  const separatePrice = PAID_LEVELS.reduce((sum, level) => sum + level.price, 0);
  const price = coursesData.pro.price;

  return {
    id: "pro",
    paymentId: "pro",
    kicker: copy.kicker,
    title: coursesData.pro.bundleTitle,
    subtitle: coursesData.pro.bundleSubtitle,
    problem: copy.problem,
    goal: coursesData.pro.goal,
    price,
    badge: coursesData.pro.badge,
    saving: Math.max(0, separatePrice - price),
    modules: levels.reduce((sum, level) => sum + level.modules.length, 0),
    lessons: levels.reduce((sum, level) => sum + level.lessons, 0),
    visuals: PAID_LEVELS.reduce((sum, level) => sum + level.visuals, 0),
    tests: PAID_LEVELS.reduce((sum, level) => sum + level.tests, 0),
    questions: PAID_LEVELS.reduce((sum, level) => sum + level.questions, 0),
    artifacts: collectArtifacts(
      PAID_LEVELS.flatMap((level) => LEVEL_MODULES[level.key]),
    ),
    hours: formatAcademicHours(
      PAID_LEVELS.reduce((sum, level) => sum + level.estimatedHours, 0),
    ),
    audience: copy.audience,
    results: copy.results,
    program: levels,
    theme: LEVEL_THEMES.pro,
  };
}

const COURSE_LANDINGS: Record<CourseLandingId, CourseLanding> = {
  confident: buildLevelLanding("confident"),
  engineer: buildLevelLanding("engineer"),
  profit: buildLevelLanding("profit"),
  pro: buildProLanding(),
};

/** Порядок курсов: от второго уровня к пакету. */
export const COURSE_LANDING_IDS: CourseLandingId[] = [
  "confident",
  "engineer",
  "profit",
  "pro",
];

/** Страница по ключу из адреса или null — неизвестный адрес отдаёт 404. */
export function getCourseLanding(id: string): CourseLanding | null {
  if (!COURSE_LANDING_IDS.includes(id as CourseLandingId)) {
    return null;
  }

  return COURSE_LANDINGS[id as CourseLandingId];
}
