"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { completeModuleTest } from "@/app/actions/complete-module-test";
import {
  MODULE_TEST_EXCELLENT_FROM,
  MODULE_TEST_PASS_FROM,
  isModuleTestPassed,
} from "@/lib/module-test";
import type { MiniCheckQuestion } from "@/lib/types";

/** Главная и второстепенная кнопки — одни и те же во всех состояниях теста. */
const primaryButtonClassName =
  "inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-full bg-blue-600 px-9 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

const secondaryButtonClassName =
  "inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-9 text-lg font-semibold text-slate-100 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

/**
 * Тест по модулю на странице «Проверь себя».
 *
 * Отличие от мини-проверки внутри урока (components/course/MiniCheck.tsx): вопросов
 * больше, а в конце — оценка модуля и путь дальше. Тест обязателен: сданный
 * результат сохраняется на сервере (только сданный!), и по нему страница урока
 * открывает следующий модуль. Проваленную попытку не сохраняем — иначе модуль
 * откроется сам.
 *
 * Пока на вопрос не ответили, варианты выглядят обычно. После ответа выбранный
 * вариант зеленеет или краснеет, правильный подсвечивается зелёным, а под ними
 * появляется пояснение: почему выбранный ответ не подходит (или почему верен).
 */
type ModuleTestProps = {
  /** Код модуля («1»…«6») — он уходит в базу как результат теста. */
  moduleId: string;
  /** Название модуля — показываем в шапке теста. */
  moduleLabel: string;
  /** Куда вернуться: первый урок модуля. */
  lessonsHref: string;
  /** Следующий урок курса: кнопка «Следующий урок» появляется после сдачи. */
  nextLessonHref?: string;
  questions: MiniCheckQuestion[];
};

export function ModuleTest({
  moduleId,
  moduleLabel,
  lessonsHref,
  nextLessonHref,
  questions,
}: ModuleTestProps) {
  const total = questions.length;

  const [questionIndex, setQuestionIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  if (total === 0) {
    return null;
  }

  const question = questions[questionIndex];
  const isAnswered = picked !== null;
  const isCorrect = isAnswered && picked === question.correct;
  const isLastQuestion = questionIndex + 1 >= total;
  const isPassed = isModuleTestPassed(correctCount, total);
  const explanation = picked === null ? undefined : question.explanations?.[picked];

  /** Сколько вопросов закрыто — вместе с текущим, если на него уже ответили. */
  const answeredCount = isFinished ? total : questionIndex + (isAnswered ? 1 : 0);
  const progressPercent = Math.round((answeredCount / total) * 100);

  function pickAnswer(answerIndex: number) {
    if (isAnswered) {
      return;
    }

    setPicked(answerIndex);

    if (answerIndex === question.correct) {
      setCorrectCount((count) => count + 1);
    }
  }

  function goNext() {
    if (isLastQuestion) {
      finish();
      return;
    }

    setQuestionIndex((index) => index + 1);
    setPicked(null);
  }

  /**
   * Тест закончен: показываем итог и сохраняем результат, если он сдан.
   *
   * Сохранение идёт через Server Action: без него страница урока не узнает, что
   * модуль сдан, и следующий модуль останется закрытым.
   */
  function finish() {
    setIsFinished(true);

    if (!isModuleTestPassed(correctCount, total)) {
      return;
    }

    startSaving(async () => {
      const result = await completeModuleTest(
        Number(moduleId),
        correctCount,
        total,
      );

      if ("error" in result) {
        console.warn("Результат теста не сохранён:", result.error);
        setSaveError(result.error);
        return;
      }

      setSaveError(null);
    });
  }

  function restart() {
    setQuestionIndex(0);
    setPicked(null);
    setCorrectCount(0);
    setIsFinished(false);
    setSaveError(null);
  }

  /** Вид кнопки-варианта: обычный, верный, выбранный неверный или погашенный. */
  function answerClassName(answerIndex: number): string {
    const base =
      "flex w-full items-start gap-3 rounded-2xl border px-5 py-4 text-left text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

    if (!isAnswered) {
      return `${base} border-white/15 bg-white/5 text-slate-200 hover:border-blue-400/60 hover:bg-white/10`;
    }

    if (answerIndex === question.correct) {
      return `${base} border-emerald-500/60 bg-emerald-500/15 text-emerald-100`;
    }

    if (answerIndex === picked) {
      return `${base} border-red-500/60 bg-red-500/15 text-red-100`;
    }

    return `${base} border-white/10 bg-white/5 text-slate-400 opacity-60`;
  }

  /** Значок перед вариантом: после ответа — галочка или крестик. */
  function answerMark(answerIndex: number): string {
    if (!isAnswered) {
      return "•";
    }

    if (answerIndex === question.correct) {
      return "✓";
    }

    return answerIndex === picked ? "✕" : "•";
  }

  if (isFinished) {
    const isExcellent = correctCount >= MODULE_TEST_EXCELLENT_FROM;

    const verdict = isExcellent
      ? "🎉 Отлично! Модуль усвоен"
      : isPassed
        ? "Хорошо, но можно перечитать уроки"
        : "Стоит вернуться к урокам модуля";

    /** Что дальше: сданный тест открывает следующий модуль. */
    const nextStep = isPassed
      ? "Следующий модуль открыт."
      : `Без сданного теста следующий модуль закрыт: нужно ${MODULE_TEST_PASS_FROM} правильных из ${total}.`;

    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-9">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
          {moduleLabel}
        </p>

        <p className="mt-4 text-2xl font-extrabold text-white sm:text-3xl">
          {correctCount} из {total} правильных
        </p>

        <p
          className={`mt-4 text-lg font-semibold ${
            isExcellent
              ? "text-emerald-300"
              : isPassed
                ? "text-amber-200"
                : "text-red-300"
          }`}
        >
          {verdict}
        </p>

        <p className="mt-2 text-base leading-relaxed text-slate-400">
          {nextStep}
        </p>

        {isSaving ? (
          <p className="mt-4 text-sm text-slate-400">Сохраняем результат…</p>
        ) : null}

        {saveError ? (
          <p className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <span aria-hidden>⚠️</span> Результат не сохранился — пройди тест ещё
            раз, чтобы открыть следующий модуль.
          </p>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {isPassed && nextLessonHref ? (
            <Link href={nextLessonHref} className={primaryButtonClassName}>
              Следующий урок
              <span aria-hidden>→</span>
            </Link>
          ) : null}

          <button
            type="button"
            onClick={restart}
            className={
              isPassed && nextLessonHref
                ? secondaryButtonClassName
                : primaryButtonClassName
            }
          >
            <span aria-hidden>↻</span>
            Пройти ещё раз
          </button>

          <Link href={lessonsHref} className={secondaryButtonClassName}>
            К урокам модуля
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-9">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-white sm:text-xl">{moduleLabel}</h2>
        <span className="text-sm font-semibold text-blue-300">
          {correctCount} из {total} верных
        </span>
      </div>

      <div
        role="progressbar"
        aria-label="Прогресс теста"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
      >
        <div
          className="h-full rounded-full bg-blue-600 transition-[width] duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-slate-400">
        Вопрос {questionIndex + 1} из {total}
      </p>
      <h3 className="mt-2 text-base font-bold text-white sm:text-lg">
        {question.question}
      </h3>

      <div className="mt-5 space-y-3" role="group" aria-label="Варианты ответа">
        {question.answers.map((answer, answerIndex) => (
          <button
            key={`${answerIndex}-${answer}`}
            type="button"
            onClick={() => pickAnswer(answerIndex)}
            disabled={isAnswered}
            aria-pressed={picked === answerIndex}
            className={answerClassName(answerIndex)}
          >
            <span aria-hidden className="mt-0.5 shrink-0">
              {answerMark(answerIndex)}
            </span>
            <span>{answer}</span>
          </button>
        ))}
      </div>

      <p
        aria-live="polite"
        className={`mt-5 min-h-6 text-sm font-semibold leading-relaxed ${
          isAnswered
            ? isCorrect
              ? "text-emerald-300"
              : "text-red-300"
            : "text-transparent"
        }`}
      >
        {isAnswered
          ? isCorrect
            ? "Верно!"
            : `Мимо. Правильный ответ: ${question.answers[question.correct]}`
          : "Ответ ещё не выбран."}
      </p>

      {/* Пояснение к выбранному варианту: почему он не подходит или почему верен.
          Пояснений может не быть (старые данные) — тогда блок не выводим. */}
      {isAnswered && explanation ? (
        <p className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 px-5 py-4 text-sm leading-relaxed text-slate-300 sm:text-base">
          <span className="font-semibold text-slate-100">
            {isCorrect
              ? "Почему это верно: "
              : "Почему этот вариант не подходит: "}
          </span>
          {explanation}
        </p>
      ) : null}

      {isAnswered ? (
        <button
          type="button"
          onClick={goNext}
          className="mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-9 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:w-auto"
        >
          {isLastQuestion ? "Завершить" : "Дальше"}
          <span aria-hidden>→</span>
        </button>
      ) : null}
    </section>
  );
}
