/**
 * Проверка защиты платных курсов.
 *
 * Запуск: `npm run check:course-access` (или напрямую `node --import
 * ./scripts/register-alias.mjs scripts/test-course-access-guard.ts`).
 *
 * Что закрывает тест:
 *   1. правило «бесплатный курс можно писать всем, платный — только с доступом»
 *      (`canWriteCourseProgress`) — его используют completeLesson,
 *      completeModuleTest, reviews и страница сертификата;
 *   2. серверную сверку ответов теста: клиент присылает только выбранные
 *      варианты, результат считает `scoreModuleTestAnswers` по правильным
 *      ответам из каталога, а не по подделанным `correct`/`total`;
 *   3. что каталог действительно отдаёт вопросы для каждого курса и не
 *      принимает несуществующие номера модулей и уроков.
 *
 * Сеть и Supabase не нужны: проверяются чистые функции и данные курсов.
 */
import { courseLessonExists } from "@/lib/course-lesson-catalog";
import {
  scoreModuleTestAnswers,
  type CourseTestVariant,
} from "@/lib/module-test";
import { moduleTestQuestions } from "@/lib/module-test-questions";
import { canWriteCourseProgress } from "@/lib/subscription";
import type { MiniCheckQuestion } from "@/lib/types";

let failures = 0;

/** Печатает результат одной проверки и считает провалы. */
function check(name: string, ok: boolean, details: string) {
  console.log(`${ok ? "✓" : "✗"} ${name} — ${details}`);

  if (!ok) {
    failures += 1;
  }
}

const ALL_VARIANTS: CourseTestVariant[] = [
  "basic",
  "confident",
  "engineer",
  "profit",
  "pro",
];

/** Синтетический тест из 10 вопросов: проверяем правила, а не текст курса. */
const questions: MiniCheckQuestion[] = Array.from(
  { length: 10 },
  (_, index) => ({
    question: `Вопрос ${index + 1}`,
    answers: ["вариант 1", "вариант 2", "вариант 3"],
    correct: index % 3,
  }),
);

/** Ответы: первые `correctCount` верные, остальные — заведомо неверные. */
function answersWith(correctCount: number): number[] {
  return questions.map((question, index) =>
    index < correctCount
      ? question.correct
      : (question.correct + 1) % question.answers.length,
  );
}

console.log("=== 1. Правило доступа к прогрессу ===");

check(
  "Бесплатный курс пишется без покупки",
  canWriteCourseProgress("basic", false) === true,
  String(canWriteCourseProgress("basic", false)),
);

check(
  "Платный курс без покупки не пишется",
  canWriteCourseProgress("confident", false) === false,
  String(canWriteCourseProgress("confident", false)),
);

check(
  "Платный курс с покупкой пишется",
  canWriteCourseProgress("confident", true) === true,
  String(canWriteCourseProgress("confident", true)),
);

check(
  "Пакет pro открывает прогресс продвинутого курса",
  canWriteCourseProgress("pro", true) === true,
  String(canWriteCourseProgress("pro", true)),
);

console.log("\n=== 2. Серверная сверка ответов ===");

const perfect = scoreModuleTestAnswers(questions, answersWith(10));
check(
  "10 из 10 сдано",
  perfect?.correct === 10 && perfect.total === 10 && perfect.passed === true,
  JSON.stringify(perfect),
);

const seven = scoreModuleTestAnswers(questions, answersWith(7));
check(
  "7 из 10 сдано (порог)",
  seven?.correct === 7 && seven.passed === true,
  JSON.stringify(seven),
);

const six = scoreModuleTestAnswers(questions, answersWith(6));
check(
  "6 из 10 не сдано",
  six?.correct === 6 && six.passed === false,
  JSON.stringify(six),
);

const short = scoreModuleTestAnswers(questions, answersWith(10).slice(0, 9));
check("Нехватка ответов отклоняется", short === null, String(short));

const extra = scoreModuleTestAnswers(questions, [...answersWith(10), 0]);
check("Лишние ответы отклоняются", extra === null, String(extra));

const stringAnswer: unknown[] = answersWith(10);
stringAnswer[0] = "0";
check(
  "Строка вместо номера ответа отклоняется",
  scoreModuleTestAnswers(questions, stringAnswer) === null,
  "ответ подменён на строку",
);

const fractional: unknown[] = answersWith(10);
fractional[0] = 0.5;
check(
  "Дробный номер ответа отклоняется",
  scoreModuleTestAnswers(questions, fractional) === null,
  "ответ 0.5",
);

const outOfRange: unknown[] = answersWith(10);
outOfRange[0] = 99;
check(
  "Номер за пределами вариантов отклоняется",
  scoreModuleTestAnswers(questions, outOfRange) === null,
  "ответ 99",
);

const negative: unknown[] = answersWith(10);
negative[0] = -1;
check(
  "Отрицательный номер отклоняется",
  scoreModuleTestAnswers(questions, negative) === null,
  "ответ -1",
);

const brokenQuestion: MiniCheckQuestion[] = [
  { question: "Сломанный", answers: ["а", "б"], correct: 5 },
];
check(
  "Битый индекс correct в каталоге отклоняется",
  scoreModuleTestAnswers(brokenQuestion, [0]) === null,
  "correct=5 при двух вариантах",
);

check(
  "Пустой тест не считается сданным",
  scoreModuleTestAnswers([], []) === null,
  "0 вопросов",
);

console.log("\n=== 3. Каталог вопросов и уроков ===");

for (const variant of ALL_VARIANTS) {
  const catalog = moduleTestQuestions(variant, 1);
  const valid =
    catalog !== null &&
    catalog.length === 10 &&
    catalog.every(
      (question) =>
        Number.isInteger(question.correct) &&
        question.correct >= 0 &&
        question.correct < question.answers.length,
    );

  check(
    `${variant}: тест модуля 1 найден и корректен`,
    valid,
    catalog ? `${catalog.length} вопросов` : "null",
  );

  check(
    `${variant}: модуля 999 нет`,
    moduleTestQuestions(variant, 999) === null,
    String(moduleTestQuestions(variant, 999)),
  );

  check(
    `${variant}: урок 1 есть в каталоге`,
    courseLessonExists(variant, 1) === true,
    String(courseLessonExists(variant, 1)),
  );

  check(
    `${variant}: урока 999 нет`,
    courseLessonExists(variant, 999) === false,
    String(courseLessonExists(variant, 999)),
  );
}

check(
  "Номер урока должен быть целым",
  courseLessonExists("basic", 1.5) === false,
  String(courseLessonExists("basic", 1.5)),
);

console.log(
  failures === 0
    ? "\nИтог: все проверки пройдены."
    : `\nИтог: провалов ${failures}.`,
);
process.exit(failures === 0 ? 0 : 1);

