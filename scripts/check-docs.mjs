#!/usr/bin/env node
/**
 * Проверка сводки по проекту (PROJECT.md) перед деплоем.
 *
 * Зачем: сводка и данные курсов стареют молча. Файл переименовали — в тексте
 * остался старый путь; поправили число уроков — в сводке (или в полях
 * total_lessons / totalLessons) осталось прежнее. Здесь это ловится до того, как
 * мимо пройдёт сборка.
 *
 * Что проверяется:
 *   1. числовые проверки сводки — совпадают ли уроки, модули, вопросы и т.д.
 *   2. текст PROJECT.md: числа и слова в нём совпадают с содержимым данных
 *      (включая правильную форму слова: «6 модулей», «109 уроков», «741 блок»);
 *   3. *заявленные* числа в файлах курсов и метаданных витрины равны фактическим.
 *
 * Запуск: npm run check:docs
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const DOCS_PATH = "PROJECT.md";

/**
 * Примеры путей, которые в сводке описывают то, чего ещё нет (визуализации
 * Этапа 2). Отсутствие такого файла — ожидаемый результат, а не ошибка.
 */
const EXAMPLE_PATHS = new Set(["components/lesson-visuals/basic-1-image-0.tsx"]);

/**
 * Пути, которые сводка упоминает как удалённые (раздел «Закрыто в P0»).
 * Их отсутствие в репозитории — правильное состояние.
 */
const REMOVED_PATHS = new Set(["data/course.json"]);

/** Префиксы, по которым отличаем путь к файлу проекта от обычного слова. */
const PATH_PREFIXES = [
  "app/",
  "components/",
  "data/",
  "lib/",
  "public/",
  "scripts/",
  "supabase/",
];

const problems = [];

/** Всё, что отслеживает git: по этому списку проверяем существование путей. */
function trackedFiles() {
  // --others (+ --exclude-standard) добавляет новые файлы, которые ещё не в
  // индексе: иначе проверка падала бы до первого `git add`.
  const output = execSync("git ls-files --cached --others --exclude-standard", {
    cwd: root,
    encoding: "utf8",
  });

  return output.split(/\r?\n/).filter(Boolean);
}

/** Русская форма слова по числу: 1 урок, 2 урока, 5 уроков. */
function pluralize(count, forms) {
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

/** Сводка по файлу курса: столько же полей, сколько в lib/course-stats.ts. */
function summarizeCourse(course) {
  const lessons = course.modules.flatMap((module) => module.lessons);
  const blocks = lessons.flatMap((lesson) => lesson.blocks);
  const questions = course.modules.flatMap(
    (module) => module.module_test?.questions ?? [],
  );

  return {
    modules: course.modules.length,
    lessons: lessons.length,
    blocks: blocks.length,
    visualBlocks: blocks.filter((block) => block.visual_file).length,
    questions: questions.length,
    explanations: questions.reduce(
      (sum, question) => sum + (question.explanations?.length ?? 0),
      0,
    ),
    declared: {
      modules: course.total_modules,
      lessons: course.total_lessons,
    },
  };
}

const MODULE_FORMS = ["модуль", "модуля", "модулей"];
const LESSON_FORMS = ["урок", "урока", "уроков"];
const BLOCK_FORMS = ["блок", "блока", "блоков"];
const QUESTION_FORMS = ["вопрос", "вопроса", "вопросов"];
const EXPLANATION_FORMS = ["пояснение", "пояснения", "пояснений"];

/** Число с правильной формой слова: «741 блок», «109 уроков». */
function withCount(value, forms) {
  return `${value} ${pluralize(value, forms)}`;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

const docs = fs.readFileSync(path.join(root, DOCS_PATH), "utf8");
const basic = summarizeCourse(readJson("data/lessons.json"));
const pro = summarizeCourse(readJson("data/course-pro.json"));

/** Проверка «в сводке есть такая строка». */
function expectInDocs(needle, label) {
  if (docs.includes(needle)) {
    console.log(`✓ ${label}: «${needle}»`);
    return;
  }

  problems.push(`${DOCS_PATH}: нет строки «${needle}» (${label})`);
  console.log(`✗ ${label}: не найдено «${needle}»`);
}

// ── 1. Пути, упомянутые в сводке, должны существовать в репозитории ─────────
const tracked = new Set(trackedFiles());

const mentionedPaths = [
  ...new Set(
    [...docs.matchAll(/`([^`\n]+)`/g)]
      .map((match) => match[1])
      .flatMap((token) => token.split(/[\s,()]+/))
      .map((token) => token.replace(/[.,;:]+$/, ""))
      .filter((token) => PATH_PREFIXES.some((prefix) => token.startsWith(prefix)))
      // Шаблоны (`app/course/pro/**`), параметры ([id]) и перечисления
      // (`public/{file,globe}.svg`) — не конкретные пути.
      .filter((token) => !/[*[\]{}]/.test(token))
      .map((token) => token.replace(/\/$/, "")),
  ),
].sort();

const missingPaths = [];
let directories = 0;
let examples = 0;

for (const candidate of mentionedPaths) {
  if (tracked.has(candidate)) {
    continue;
  }

  if (EXAMPLE_PATHS.has(candidate) || REMOVED_PATHS.has(candidate)) {
    examples += 1;
    continue;
  }

  // Каталог, в котором есть файлы, — тоже существующий путь.
  if ([...tracked].some((file) => file.startsWith(`${candidate}/`))) {
    directories += 1;
    continue;
  }

  missingPaths.push(candidate);
}

console.log(`\n=== 1. Пути из ${DOCS_PATH} ===`);
console.log(
  `Упомянуто путей: ${mentionedPaths.length} (каталогов: ${directories}, исключений: ${examples})`,
);

if (missingPaths.length === 0) {
  console.log("✓ Все упомянутые пути существуют в репозитории.");
} else {
  for (const candidate of missingPaths) {
    problems.push(`${DOCS_PATH}: путь ${candidate} не найден в репозитории`);
    console.log(`✗ ${candidate} — нет в репозитории`);
  }
}

// ── 2. Числа в тексте сводки должны совпадать с содержимым данных ───────────
console.log(`\n=== 2. Числа в тексте ${DOCS_PATH} ===`);

expectInDocs(
  `${withCount(basic.modules, MODULE_FORMS)}, ${withCount(basic.lessons, LESSON_FORMS)}, ${withCount(basic.blocks, BLOCK_FORMS)}`,
  "Сводка по базовому курсу",
);
expectInDocs(
  `${withCount(pro.modules, MODULE_FORMS)}, ${withCount(pro.lessons, LESSON_FORMS)}, ${withCount(pro.blocks, BLOCK_FORMS)}`,
  "Сводка по продвинутому курсу",
);
expectInDocs(withCount(basic.questions, QUESTION_FORMS), "Вопросы базового курса");
expectInDocs(
  withCount(basic.explanations, EXPLANATION_FORMS),
  "Пояснения базового курса",
);
expectInDocs(withCount(pro.questions, QUESTION_FORMS), "Вопросы продвинутого курса");
expectInDocs(
  withCount(pro.explanations, EXPLANATION_FORMS),
  "Пояснения продвинутого курса",
);
expectInDocs(
  `${withCount(basic.visualBlocks + pro.visualBlocks, BLOCK_FORMS)} ссылаются на будущий файл визуализации`,
  "Блоки с визуализациями",
);

// ── 3. Заявленные числа в данных должны совпадать с фактическими ────────────
console.log("\n=== 3. Заявленные числа в данных курсов ===");

function expectDeclared(relativePath, course) {
  const declared = `total_modules=${course.declared.modules}, total_lessons=${course.declared.lessons}`;
  const actual = `total_modules=${course.modules}, total_lessons=${course.lessons}`;
  const ok = declared === actual;

  if (ok) {
    console.log(`✓ ${relativePath}: ${declared}`);
    return;
  }

  problems.push(`${relativePath}: заявлено ${declared}, а фактически ${actual}`);
  console.log(`✗ ${relativePath}: ${declared} — фактически ${actual}`);
}

expectDeclared("data/lessons.json", basic);
expectDeclared("data/course-pro.json", pro);

/** Метаданные витрины: там числа уроков лежат в totalLessons. */
const coursesMeta = readJson("data/courses.json");

for (const [key, course, summary] of [
  ["basic", coursesMeta.basic, basic],
  ["pro", coursesMeta.pro, pro],
]) {
  if (course.totalLessons === summary.lessons) {
    console.log(`✓ data/courses.json: ${key}.totalLessons=${course.totalLessons}`);
    continue;
  }

  problems.push(
    `data/courses.json: ${key}.totalLessons=${course.totalLessons}, а уроков ${summary.lessons}`,
  );
  console.log(
    `✗ data/courses.json: ${key}.totalLessons=${course.totalLessons} — фактически ${summary.lessons}`,
  );
}

// ── Итог ───────────────────────────────────────────────────────────────────
if (problems.length === 0) {
  console.log(`\nСводка и данные согласованы: ${DOCS_PATH} не отстал от курсов.`);
  process.exit(0);
}

console.log(`\nНайдено проблем: ${problems.length}`);
for (const problem of problems) {
  console.log(`  • ${problem}`);
}
process.exit(1);
