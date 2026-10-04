#!/usr/bin/env node
/**
 * Объём урока: блоки, слова, знаки и среднее слов на блок — одни и те же числа
 * в отчёте и в проверке.
 *
 * Зачем: правило «информации исчерпывающе, но без воды» проверяется только
 * числом. Глазами объём не измерить, а «кажется, урок тонкий» — не аргумент.
 * Скрипт считает объём одинаково для любого урока, показывает разбивку по типам
 * блоков и тут же сравнивает с базовым уровнем: видно, урок тоньше базового
 * или нет и на сколько.
 *
 * Как считаем (заголовки блоков — метаданные, в счёт не идут):
 *   text / warning / tip / analogy / diagram / image / screenshot — content;
 *   list — items, склеенные пробелом;
 *   steps — steps[].text (голая строка тоже принимается);
 *   слова — split(/\s+/) по склеенному тексту, знаки — без пробелов.
 *
 * Запуск:
 *   npm run stats:lesson                                     — все курсы списком
 *   npm run stats:lesson -- data/course-confident.json        — уроки одного файла
 *   npm run stats:lesson -- data/course-confident.json C2     — один урок подробно
 *
 * Выход: 1 — файл не найден или урока нет в файле (тогда печатаются доступные id).
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

/** Курсы, которые показываются без аргументов: базовый, продвинутый, платный. */
const COURSE_FILES = [
  "data/lessons.json",
  "data/course-pro.json",
  "data/course-confident.json",
];

/** База — точка отсчёта: с ней сравниваем объём любого другого уровня. */
const BASE_FILE = "data/lessons.json";

/**
 * Ориентир уровня «Уверенный» (правило от 04.10): уверенный пользователь, а не
 * инженер — поэтому 28–35 блоков и 4 500–6 000 слов на урок. Действует с C2;
 * C1 написан раньше и в ориентир по словам не попадает — это видно в отчёте.
 */
const CONFIDENT_TARGET = {
  file: "data/course-confident.json",
  minBlocks: 28,
  maxBlocks: 35,
  minWords: 4500,
  maxWords: 6000,
};

/** Число с разделителем разрядов: 10338 → «10 338». */
function formatNumber(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Дробное число в русской записи: 107 → «107,0». */
function formatDecimal(value) {
  return value.toFixed(1).replace(".", ",");
}

/** Отношение к базе словами: «короче на 54,1 %», «длиннее на 20,5 %». */
function formatDelta(value, reference) {
  const percent = ((value - reference) / reference) * 100;

  if (Math.abs(percent) < 0.05) {
    return "столько же";
  }

  return `${percent < 0 ? "короче" : "длиннее"} на ${formatDecimal(
    Math.abs(percent),
  )} %`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function courseLessons(course) {
  return course.modules.flatMap((module) => module.lessons ?? []);
}

/**
 * Текст блока из полей, которые читает LessonBlocks. Заголовок не берём: он
 * метаданные, а не содержание.
 */
function blockText(block) {
  const parts = [];

  if (typeof block.content === "string") {
    parts.push(block.content);
  }

  if (Array.isArray(block.items)) {
    parts.push(block.items.join(" "));
  }

  if (Array.isArray(block.steps)) {
    parts.push(
      block.steps
        .map((step) => (typeof step === "string" ? step : (step.text ?? "")))
        .join(" "),
    );
  }

  return parts.join(" ").trim();
}

function countWords(text) {
  return text ? text.split(/\s+/).length : 0;
}

/** Знаки без пробелов — как в отчёте: пробелы и переводы строк не считаем. */
function countChars(text) {
  return text.replace(/\s/g, "").length;
}

function lessonStats(lesson) {
  const blocks = lesson.blocks ?? [];
  const byType = new Map();
  let words = 0;
  let chars = 0;
  let visuals = 0;

  for (const block of blocks) {
    const text = blockText(block);
    const blockWords = countWords(text);

    words += blockWords;
    chars += countChars(text);

    if (block.visual_file) {
      visuals += 1;
    }

    const entry = byType.get(block.type) ?? { blocks: 0, words: 0 };
    entry.blocks += 1;
    entry.words += blockWords;
    byType.set(block.type, entry);
  }

  return {
    blocks: blocks.length,
    words,
    chars,
    visuals,
    perBlock: blocks.length ? words / blocks.length : 0,
    byType: [...byType].sort(
      (a, b) => b[1].blocks - a[1].blocks || b[1].words - a[1].words,
    ),
  };
}

/** Разбивка по типам блоков — таблицей: видно, чем урок набран по объёму. */
function printTypeTable(stats) {
  console.log("| Тип | Блоков | Слов | Слов на блок |");
  console.log("|---|---|---|---|");

  for (const [type, entry] of stats.byType) {
    console.log(
      `| ${type} | ${entry.blocks} | ${formatNumber(entry.words)} | ${formatDecimal(
        entry.words / entry.blocks,
      )} |`,
    );
  }
}

/** Сравнение с базой — ради него скрипт и написан: тоньше урок или плотнее. */
function printComparison(stats, baseLessons) {
  const baseStats = baseLessons.map((lesson) => ({
    lesson,
    stats: lessonStats(lesson),
  }));
  const averageWords =
    baseStats.reduce((sum, item) => sum + item.stats.words, 0) / baseStats.length;
  const averageBlocks =
    baseStats.reduce((sum, item) => sum + item.stats.blocks, 0) / baseStats.length;
  const closest = [...baseStats].sort(
    (a, b) =>
      Math.abs(a.stats.words - stats.words) - Math.abs(b.stats.words - stats.words),
  )[0];
  const heaviest = [...baseStats].sort((a, b) => b.stats.words - a.stats.words)[0];

  console.log(
    `Сравнение с базовым уровнем (${BASE_FILE}: ${baseStats.length} уроков, средний — ${formatNumber(
      Math.round(averageWords),
    )} слов и ${formatDecimal(averageBlocks)} блока):`,
  );
  console.log(
    `  • средний базовый урок (${formatNumber(
      Math.round(averageWords),
    )} слов) — ${formatDelta(stats.words, averageWords)}`,
  );
  console.log(
    `  • ближайший по объёму — ${closest.lesson.lesson_id} «${
      closest.lesson.lesson_title
    }» (${formatNumber(closest.stats.words)} слов) — ${formatDelta(
      stats.words,
      closest.stats.words,
    )}`,
  );
  console.log(
    `  • самый объёмный — ${heaviest.lesson.lesson_id} «${
      heaviest.lesson.lesson_title
    }» (${formatNumber(heaviest.stats.words)} слов) — ${formatDelta(
      stats.words,
      heaviest.stats.words,
    )}`,
  );
}

/** Ориентир платного уровня: печатается только для файла «Уверенного». */
function printTarget(stats, file) {
  if (file !== CONFIDENT_TARGET.file) {
    return;
  }

  const blocksOk =
    stats.blocks >= CONFIDENT_TARGET.minBlocks &&
    stats.blocks <= CONFIDENT_TARGET.maxBlocks;
  const wordsOk =
    stats.words >= CONFIDENT_TARGET.minWords &&
    stats.words <= CONFIDENT_TARGET.maxWords;

  console.log(
    `Ориентир «Уверенного»: ${CONFIDENT_TARGET.minBlocks}–${
      CONFIDENT_TARGET.maxBlocks
    } блоков — ${blocksOk ? "в норме" : "вне нормы"}, ${formatNumber(
      CONFIDENT_TARGET.minWords,
    )}–${formatNumber(CONFIDENT_TARGET.maxWords)} слов — ${
      wordsOk ? "в норме" : "вне нормы"
    }`,
  );
}

/** Список уроков файла: колонки те же, что в отчёте. */
function printCourse(file) {
  const course = readJson(file);
  const lessons = courseLessons(course);

  console.log(`\n## ${file} — «${course.course_title}»\n`);
  console.log("| Урок | Название | Блоков | Слов | Знаков | Слов на блок |");
  console.log("|---|---|---|---|---|---|");

  for (const lesson of lessons) {
    const stats = lessonStats(lesson);

    console.log(
      `| ${lesson.lesson_id} | ${lesson.lesson_title} | ${
        stats.blocks
      } | ${formatNumber(stats.words)} | ${formatNumber(
        stats.chars,
      )} | ${formatDecimal(stats.perBlock)} |`,
    );
  }
}

/** Один урок: метрики отчёта, разбивка по типам, сравнение с базой. */
function printLesson(file, lessonId) {
  const course = readJson(file);
  const lessons = courseLessons(course);
  const lesson = lessons.find(
    (item) => String(item.lesson_id).toLowerCase() === lessonId.toLowerCase(),
  );

  if (!lesson) {
    console.error(
      `Урок «${lessonId}» не найден в ${file}. Доступны: ${lessons
        .map((item) => item.lesson_id)
        .join(", ")}.`,
    );
    process.exit(1);
  }

  const stats = lessonStats(lesson);

  console.log(`\n## ${lesson.lesson_id} «${lesson.lesson_title}» — ${file}\n`);
  console.log("| Метрика | Значение |");
  console.log("|---|---|");
  console.log(`| Блоков | ${stats.blocks} |`);
  console.log(`| Слов | ${formatNumber(stats.words)} |`);
  console.log(`| Знаков без пробелов | ${formatNumber(stats.chars)} |`);
  console.log(`| Среднее слов на блок | ${formatDecimal(stats.perBlock)} |`);
  console.log(`| Блоков с visual_file | ${stats.visuals} |`);
  console.log("");
  printTypeTable(stats);
  console.log("");
  printComparison(stats, courseLessons(readJson(BASE_FILE)));
  printTarget(stats, file);
}

const [file, lessonId] = process.argv.slice(2);

if (file && !fs.existsSync(path.join(root, file))) {
  console.error(
    `Файл ${file} не найден. Запуск без аргументов покажет все курсы.`,
  );
  process.exit(1);
}

if (file) {
  if (lessonId) {
    printLesson(file, lessonId);
  } else {
    printCourse(file);
  }
} else {
  for (const courseFile of COURSE_FILES) {
    printCourse(courseFile);
  }
}
