"use client";

import { useState } from "react";

import {
  LESSON_CARD,
  LESSON_EYEBROW,
  LESSON_PRIMARY,
  LESSON_SECONDARY,
} from "@/components/course/lesson-ui";
import type { MiniCheckQuestion } from "@/lib/types";

/**
 * Мини-проверка по уроку: вопросы идут по одному, ответ — кнопкой.
 *
 * Клиентский компонент: без него каждый ответ уходил бы на сервер. Ответы никуда
 * не сохраняются — это самопроверка, а не экзамен; прогресс курса отмечает
 * кнопка «Пройти урок» под блоками урока.
 *
 * Пока на вопрос не ответили, варианты выглядят обычно. После ответа выбранный
 * вариант зеленеет или краснеет, а правильный (если ошиблись) подсвечивается
 * зелёным — так видно не только «мимо», но и как было верно.
 */
type MiniCheckProps = {
  /** Заголовок блока из данных урока. */
  title?: string;
  questions: MiniCheckQuestion[];
};

export function MiniCheck({ title, questions }: MiniCheckProps) {
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
  /** Пояснение к выбранному варианту: почему он не подходит или почему верен. */
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
      "flex w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left text-[15px] font-medium leading-7 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] sm:text-base";

    if (!isAnswered) {
      return `${base} border-white/10 bg-white/[0.02] text-zinc-300 hover:border-white/25 hover:bg-white/[0.06]`;
    }

    if (answerIndex === question.correct) {
      return `${base} border-emerald-500/40 bg-emerald-500/10 text-emerald-100`;
    }

    if (answerIndex === picked) {
      return `${base} border-red-500/40 bg-red-500/10 text-red-100`;
    }

    return `${base} border-white/5 bg-white/[0.02] text-zinc-400 opacity-60`;
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
    const isAllCorrect = correctCount === total;

    return (
      <section className={LESSON_CARD}>
        <p className={LESSON_EYEBROW}>Мини-проверка</p>
        <h2 className="mt-3 text-lg font-semibold text-white sm:text-xl">
          {title ?? "Проверь себя"}
        </h2>

        <p className="mt-6 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          <span aria-hidden>{isAllCorrect ? "🏆" : "📊"}</span> {correctCount} из{" "}
          {total} правильных
        </p>

        <p className="mt-3 text-[16px] leading-8 text-slate-300 sm:text-[17px]">
          {isAllCorrect
            ? "Все ответы верные — можно идти дальше."
            : "Загляни в блоки выше: на каждый вопрос там есть подсказка."}
        </p>

        <button
          type="button"
          onClick={restart}
          className={`${LESSON_SECONDARY} mt-8 min-h-12 w-full px-6 sm:w-auto`}
        >
          <span aria-hidden>↻</span>
          Пройти заново
        </button>
      </section>
    );
  }

  return (
    <section className={LESSON_CARD}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white sm:text-xl">
          <span aria-hidden className="mr-2">
            📝
          </span>
          {title ?? "Проверь себя"}
        </h2>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold text-zinc-300">
          {correctCount} из {total} верных
        </span>
      </div>

      <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-white transition-[width] duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <p className="mt-6 text-[11px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
        Вопрос {questionIndex + 1} из {total}
      </p>
      <h3 className="mt-2 text-base font-semibold text-white sm:text-lg">
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

      {/* Пояснение к выбранному варианту. Пояснений может не быть (например, в
          продвинутом курсе) — тогда блок не выводим. */}
      {isAnswered && explanation ? (
        <p className="mt-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3.5 text-[15px] leading-7 text-slate-300 sm:text-base">
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
          className={`${LESSON_PRIMARY} mt-6 min-h-12 w-full px-6 sm:w-auto`}
        >
          {isLastQuestion ? "Показать результат" : "Следующий вопрос"}
          <span aria-hidden>→</span>
        </button>
      ) : null}
    </section>
  );
}
