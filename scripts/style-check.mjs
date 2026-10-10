#!/usr/bin/env node
/**
 * Проверка стиля урока: длина предложения и длина абзаца.
 *
 * Зачем: с 04.10 уроки уровня «Уверенный» пишутся простым языком — предложение не
 * длиннее 12 слов, абзац — не длиннее 4 предложений, абзацы разделены пустой
 * строкой. Правило проверяется только числом: глазами длинное предложение
 * «читается нормально», а читатель на нём спотыкается. Скрипт считает слова в
 * каждом предложении и предложения в каждом абзаце и показывает, где нарушено.
 *
 * Считаем по тем же полям, что читает LessonBlocks:
 *   text / warning / tip / analogy / diagram / image / screenshot — content;
 *   list — items (каждый пункт отдельно);
 *   steps — steps[].text (голая строка тоже принимается);
 *   абзац — кусок текста между пустыми строками, предложение — до «.!?…».
 * Разметка **жирного** не считается: звёздочки снимаются до подсчёта слов.
 *
 * Уроки из LEGACY_LESSONS пропускаются: они написаны до нового правила, и это
 * записано техдолгом в PROJECT.md. Если урок назвать аргументом, он проверится,
 * даже если он в списке: так видно, сколько в нём нарушений сейчас.
 *
 * Запуск:
 *   npm run check:style                                    — уроки «Уверенного»
 *   npm run check:style -- data/course-confident.json C3    — один урок
 *   npm run check:style -- data/lessons.json                — другой файл курса
 *
 * Выход: 1 — есть нарушения (или файла/урока нет в файле), 0 — правило выполнено.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

/** Что проверяется без аргументов: новый стиль пишется в уровне «Уверенный». */
const DEFAULT_FILE = "data/course-confident.json";

/** Правило стиля от 04.10: предложение — не длиннее 12 слов. */
const MAX_WORDS = 12;

/** Правило стиля от 04.10: абзац — не длиннее 4 предложений. */
const MAX_SENTENCES = 4;

/**
 * Уроки, написанные до нового правила. Сейчас таких нет: C1 и C2 переписаны,
 * список пуст. Механизм оставлен на случай, если в старом стиле найдётся
 * ещё урок; техдолг и его закрытие описаны в PROJECT.md.
 */
const LEGACY_LESSONS = new Set();

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function courseLessons(course) {
  return course.modules.flatMap((module) => module.lessons ?? []);
}

/** Текст блока по частям: каждый пункт списка и каждый шаг проверяются отдельно. */
function blockFragments(block) {
  const fragments = [];

  if (typeof block.content === "string") {
    fragments.push({ field: "content", text: block.content });
  }

  if (Array.isArray(block.items)) {
    block.items.forEach((item, index) => {
      fragments.push({ field: `items[${index}]`, text: item });
    });
  }

  if (Array.isArray(block.steps)) {
    block.steps.forEach((step, index) => {
      fragments.push({
        field: `steps[${index}]`,
        text: typeof step === "string" ? step : (step.text ?? ""),
      });
    });
  }

  return fragments;
}

/** Звёздочки разметки — не слова: снимаем их до подсчёта. */
function plainText(text) {
  return text.replace(/\*\*/g, " ");
}

/** Абзацы текста: пустая строка — граница абзаца. */
function paragraphs(text) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n/g, " ").trim())
    .filter(Boolean);
}

/** Предложения абзаца: делим по «.!?…», пустые куски выбрасываем. */
function sentences(paragraph) {
  return paragraph
    .split(/(?<=[.!?…])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function countWords(text) {
  return plainText(text).split(/\s+/).filter(Boolean).length;
}

/** Обрезка длинного текста для отчёта: в консоль влезает не всё. */
function shorten(text, limit = 90) {
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

/** Проверка одного урока: нарушения, число предложений и абзацев. */
function checkLesson(lesson) {
  const violations = [];
  let sentenceCount = 0;
  let paragraphCount = 0;

  lesson.blocks.forEach((block, blockIndex) => {
    for (const fragment of blockFragments(block)) {
      for (const paragraph of paragraphs(fragment.text)) {
        paragraphCount += 1;
        const parts = sentences(paragraph);

        if (parts.length > MAX_SENTENCES) {
          violations.push({
            blockIndex,
            block,
            field: fragment.field,
            kind: `абзац из ${parts.length} предложений`,
            text: shorten(paragraph),
          });
        }

        for (const sentence of parts) {
          sentenceCount += 1;
          const words = countWords(sentence);

          if (words > MAX_WORDS) {
            violations.push({
              blockIndex,
              block,
              field: fragment.field,
              kind: `предложение из ${words} слов`,
              text: shorten(sentence),
            });
          }
        }
      }
    }
  });

  return { violations, sentenceCount, paragraphCount };
}

/** Отчёт по уроку. Возвращает число нарушений: по нему считается код выхода. */
function printLesson(file, lesson, result) {
  const { violations, sentenceCount, paragraphCount } = result;

  console.log(`\n## ${lesson.lesson_id} «${lesson.lesson_title}» — ${file}\n`);

  if (lesson.blocks.length === 0) {
    console.log("Блоков нет — урок ещё не написан, проверять нечего.");
    return 0;
  }

  console.log(
    `Проверено: ${lesson.blocks.length} блоков, ${sentenceCount} предложений в ${paragraphCount} абзацах.`,
  );

  if (violations.length === 0) {
    console.log(
      `✓ Правило стиля выполнено: не длиннее ${MAX_WORDS} слов в предложении и ${MAX_SENTENCES} предложений в абзаце.`,
    );
    return 0;
  }

  console.log(`\nНарушений: ${violations.length}\n`);

  for (const violation of violations) {
    const title = violation.block.title ?? violation.block.type;
    console.log(
      `✗ блок ${violation.blockIndex + 1} (${violation.block.type} «${title}»), ${violation.field} — ${violation.kind}:`,
    );
    console.log(`  «${violation.text}»`);
  }

  return violations.length;
}

const [fileArg, lessonArg] = process.argv.slice(2);
const file = fileArg ?? DEFAULT_FILE;

if (fileArg && !fs.existsSync(path.join(root, fileArg))) {
  console.error(
    `Файл ${fileArg} не найден. Без аргументов проверяется ${DEFAULT_FILE}.`,
  );
  process.exit(1);
}

const lessons = courseLessons(readJson(file));
const selected = lessonArg
  ? lessons.filter(
      (lesson) =>
        String(lesson.lesson_id).toLowerCase() === lessonArg.toLowerCase(),
    )
  : lessons;

if (lessonArg && selected.length === 0) {
  console.error(
    `Урок «${lessonArg}» не найден в ${file}. Доступны: ${lessons
      .map((lesson) => lesson.lesson_id)
      .join(", ")}.`,
  );
  process.exit(1);
}

console.log(
  `Стиль урока (${file}): предложение — не длиннее ${MAX_WORDS} слов, абзац — не длиннее ${MAX_SENTENCES} предложений.`,
);

let violations = 0;
let checked = 0;
const skipped = [];

for (const lesson of selected) {
  // Урок, названный аргументом, проверяется всегда — даже если он старого стиля.
  if (!lessonArg && LEGACY_LESSONS.has(lesson.lesson_id)) {
    skipped.push(lesson.lesson_id);
    continue;
  }

  checked += 1;
  violations += printLesson(file, lesson, checkLesson(lesson));
}

if (skipped.length > 0) {
  console.log(
    `\nПропущены уроки старого стиля: ${skipped.join(", ")} — техдолг записан в PROJECT.md.`,
  );
}

console.log(`\nИтог: проверено уроков ${checked}, нарушений ${violations}.`);

process.exit(violations > 0 ? 1 : 0);
