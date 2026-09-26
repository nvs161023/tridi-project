"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { completeModuleTest } from "@/app/actions/complete-module-test";
import { moduleTestThemes } from "@/components/course/module-test-theme";
import {
  MODULE_TEST_EXCELLENT_FROM,
  MODULE_TEST_PASS_FROM,
  isModuleTestPassed,
  type CourseTestVariant,
} from "@/lib/module-test";
import type { MiniCheckQuestion } from "@/lib/types";

/**
 * Тест по модулю на странице «Проверь себя» — общий для базового и продвинутого
 * курса (components/course/MiniCheck.tsx остаётся поддержкой «проверки внутри
 * урока», но в данных курсов таких блоков больше нет).
 *
 * Проверка знаний живёт здесь: вопросы теста модуля плюс вопросы, которые раньше
 * стояли мини-проверками в уроках. В конце — оценка модуля и путь дальше. Тест
 * обязателен: сданный результат сохраняется на сервере (только сданный!), и по
 * нему страница урока открывает следующий модуль. Проваленную попытку не
 * сохраняем — иначе модуль откроется сам.
 *
 * Пока на вопрос не ответили, варианты выглядят обычно. После ответа выбранный
 * вариант зеленеет или краснеет, правильный подсвечивается зелёным, а под ними
 * появляется пояснение: почему выбранный ответ не подходит (или почему верен).
 */
type ModuleTestProps = {
  /** Какой курс проходим: от этого зависят цвета и тип строки в базе. */
  courseType: CourseTestVariant;
  /**
   * Где тест показан: на отдельной странице или слайдом поверх урока.
   *
   * На странице это карточка с рамкой, в оверлее — содержимое без рамки и с
   * кнопкой «Закрыть» вместо ссылки на уроки модуля: саму рамку и выход рисует
   * components/course/TestOverlay.tsx.
   */
  layout?: "page" | "overlay";
  /** Сданный тест сохранился: родитель может обновить страницу под собой. */
  onSaved?: () => void;
  /** Закрыть оверлей (в режиме overlay). */
  onClose?: () => void;
  /** Подпись кнопки продолжения после сдачи (в оверлее — «Продолжить курс»). */
  continueLabel?: string;
  /**
   * Номер модуля в курсе (1…26) — он уходит в базу как результат теста.
   *
   * У базового курса это код модуля («1»…«6»), у продвинутого — место модуля в
   * курсе: коды pro буквенные («A», «T-тизер»), в числовую колонку lesson_id их
   * не записать.
   */
  moduleNumber: number;
  /** Название модуля — показываем в шапке теста. */
  moduleLabel: string;
  /** Куда вернуться: первый урок модуля. */
  lessonsHref: string;
  /** Следующий урок курса: кнопка «Следующий урок» появляется после сдачи. */
  nextLessonHref?: string;
  questions: MiniCheckQuestion[];
};

export function ModuleTest({
  courseType,
  moduleNumber,
  moduleLabel,
  lessonsHref,
  nextLessonHref,
  questions,
  layout = "page",
  onSaved,
  onClose,
  continueLabel = "Следующий урок",
}: ModuleTestProps) {
  const total = questions.length;
  const theme = moduleTestThemes[courseType];
  const isOverlay = layout === "overlay";

  /** Оболочка: на странице — карточка с рамкой, в оверлее рамку рисует сам слайд. */
  const shell = isOverlay
    ? ""
    : "rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-9";

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
   * модуль сдан, и следующий модуль останется закрытым. После удачного
   * сохранения сообщаем родителю (onSaved): карточка на уроке обновляет страницу,
   * чтобы кнопка «Продолжить курс» разблокировалась без перезагрузки вручную.
   */
  function finish() {
    setIsFinished(true);

    if (!isModuleTestPassed(correctCount, total)) {
      return;
    }

    startSaving(async () => {
      const result = await completeModuleTest(
        courseType,
        moduleNumber,
        correctCount,
        total,
      );

      if ("error" in result) {
        console.warn("Результат теста не сохранён:", result.error);
        setSaveError(result.error);
        return;
      }

      setSaveError(null);
      onSaved?.();
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
      `flex w-full items-start gap-3 rounded-2xl border px-5 py-4 text-left text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${theme.ring}`;

    if (!isAnswered) {
      return `${base} border-white/15 bg-white/5 text-slate-200 ${theme.optionHover} hover:bg-white/10`;
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
      <section className={shell}>
        <p
          className={`text-sm font-semibold uppercase tracking-widest ${theme.eyebrow}`}
        >
          {isOverlay ? "Результат теста" : moduleLabel}
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
            <Link href={nextLessonHref} className={theme.primary}>
              {isOverlay ? continueLabel : "Следующий урок"}
              <span aria-hidden>→</span>
            </Link>
          ) : null}

          <button
            type="button"
            onClick={restart}
            className={
              isPassed && nextLessonHref ? theme.secondary : theme.primary
            }
          >
            <span aria-hidden>↻</span>
            Пройти ещё раз
          </button>

          {/* В оверлее выхода «к урокам модуля» нет: слайд нужно просто закрыть. */}
          {isOverlay ? (
            <button type="button" onClick={onClose} className={theme.secondary}>
              Закрыть
            </button>
          ) : (
            <Link href={lessonsHref} className={theme.secondary}>
              К урокам модуля
            </Link>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className={shell}>
      <div
        className={`flex flex-wrap items-center gap-3 ${
          isOverlay ? "justify-end" : "justify-between"
        }`}
      >
        {/* В оверлее название модуля уже стоит в шапке слайда — не повторяем. */}
        {isOverlay ? null : (
          <h2 className="text-lg font-bold text-white sm:text-xl">
            {moduleLabel}
          </h2>
        )}
        <span className={`text-sm font-semibold ${theme.accentText}`}>
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
          className={`h-full rounded-full transition-[width] duration-500 ${theme.bar}`}
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
          className={`mt-6 w-full sm:w-auto ${theme.primary}`}
        >
          {isLastQuestion ? "Завершить" : "Дальше"}
          <span aria-hidden>→</span>
        </button>
      ) : null}
    </section>
  );
}
