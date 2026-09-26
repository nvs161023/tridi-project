"use client";

import Link from "next/link";
import { useState } from "react";

import type { MiniCheckQuestion } from "@/lib/types";

/**
 * Тест по модулю на странице «Проверь себя».
 *
 * Отличие от мини-проверки внутри урока (components/course/MiniCheck.tsx): вопросов
 * больше, а в конце — оценка модуля и две кнопки: пройти заново или вернуться к
 * урокам. Ответы никуда не сохраняются: это самопроверка, а прогресс курса
 * отмечает кнопка «Пройти урок» на странице урока.
 *
 * Пока на вопрос не ответили, варианты выглядят обычно. После ответа выбранный
 * вариант зеленеет или краснеет, а правильный подсвечивается зелёным — видно не
 * только «мимо», но и как было верно.
 */
type ModuleTestProps = {
  /** Название модуля — показываем в шапке теста. */
  moduleLabel: string;
  /** Куда вернуться: первый урок модуля. */
  lessonsHref: string;
  questions: MiniCheckQuestion[];
};

/** С какого числа правильных ответов ставим оценку. */
const EXCELLENT_FROM = 8;
const GOOD_FROM = 5;

export function ModuleTest({ moduleLabel, lessonsHref, questions }: ModuleTestProps) {
  const total = questions.length;

  const [questionIndex, setQuestionIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  if (total === 0) {
    return null;
  }

  const question = questions[questionIndex];
  const isAnswered = picked !== null;
  const isCorrect = isAnswered && picked === question.correct;
  const isLastQuestion = questionIndex + 1 >= total;

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
      setIsFinished(true);
      return;
    }

    setQuestionIndex((index) => index + 1);
    setPicked(null);
  }

  function restart() {
    setQuestionIndex(0);
    setPicked(null);
    setCorrectCount(0);
    setIsFinished(false);
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
    const isExcellent = correctCount >= EXCELLENT_FROM;
    const isGood = correctCount >= GOOD_FROM;

    const verdict = isExcellent
      ? "🎉 Отлично! Модуль усвоен"
      : isGood
        ? "Хорошо, но можно перечитать уроки"
        : "Стоит вернуться к урокам модуля";

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
              : isGood
                ? "text-amber-200"
                : "text-red-300"
          }`}
        >
          {verdict}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={restart}
            className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-full bg-blue-600 px-9 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <span aria-hidden>↻</span>
            Пройти ещё раз
          </button>

          <Link
            href={lessonsHref}
            className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-9 text-lg font-semibold text-slate-100 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            К урокам модуля
            <span aria-hidden>→</span>
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
