"use client";

import Link from "next/link";
import { useEffect, useId, useState, useTransition } from "react";

import { createRobokassaPayment } from "@/app/actions/payments";

type PlanButtonProps = {
  /** Текст на кнопке. */
  label: string;
  /** Ключ курса или пакета для платёжного сервиса. */
  courseId: string;
  /** Оформление: синее для курсов и подписки, золотое для пакета. */
  variant?: "blue" | "gold";
  /** Размер: компактный для узких карточек, обычный для широкого блока. */
  size?: "compact" | "default";
  /**
   * Куда вернуть гостя после входа. Лендинг курса передаёт свой адрес, чтобы
   * после регистрации человек попал обратно на страницу курса, а не в тарифы.
   */
  loginHref?: string;
};

const baseClassName =
  "inline-flex w-full items-center justify-center gap-2 rounded-full font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-70";

const variantClassName = {
  blue: "bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 focus-visible:ring-blue-400",
  gold: "bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 hover:from-amber-300 hover:to-amber-400 focus-visible:ring-amber-300",
};

const sizeClassName = {
  compact: "min-h-12 px-5 text-sm",
  default: "min-h-14 px-8 text-lg",
};

/**
 * Кнопка оформления тарифа.
 *
 * Цену в браузер не передаём: Server Action берёт её из data/courses.json и
 * создаёт подписанную ссылку Robokassa. Здесь остаётся только перейти по ней.
 */
export function PlanButton({
  label,
  courseId,
  variant = "blue",
  size = "default",
  loginHref,
}: PlanButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<{
    message: string;
    loginHref?: string;
  } | null>(null);

  /** Окно подтверждения 18+ и оферты открывается до создания платежа. */
  const [isAgeDialogOpen, setIsAgeDialogOpen] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const dialogTitleId = useId();

  /**
   * Пока окно открыто, Escape закрывает его, а страница под ним не прокручивается.
   * Возврат фокуса не делаем вручную: после закрытия браузер вернёт его на кнопку,
   * с которой открыли диалог.
   */
  useEffect(() => {
    if (!isAgeDialogOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsAgeDialogOpen(false);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAgeDialogOpen]);

  /**
   * Кнопка «Купить» сначала показывает подтверждение возраста: без отдельной
   * отметки 18+ платёж не создаётся. Серверная проверка продублирована в
   * createRobokassaPayment, поэтому обойти окно подменой разметки нельзя.
   */
  function openAgeDialog() {
    setError(null);
    setAgeConfirmed(false);
    setIsAgeDialogOpen(true);
  }

  function handlePayment() {
    if (!ageConfirmed) {
      return;
    }

    setIsAgeDialogOpen(false);
    setError(null);

    startTransition(async () => {
      const result = await createRobokassaPayment(courseId, true);

      if ("error" in result) {
        setError({
          message: result.error,
          loginHref: result.loginHref ? loginHref ?? result.loginHref : undefined,
        });
        return;
      }

      window.location.assign(result.url);
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={openAgeDialog}
        disabled={isPending}
        aria-busy={isPending}
        className={`${baseClassName} ${variantClassName[variant]} ${sizeClassName[size]}`}
      >
        {isPending ? "Открываем оплату…" : label}
        {isPending ? null : <span aria-hidden>→</span>}
      </button>

      <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-500">
        Для оплаты нужно подтвердить, что вам исполнилось 18 лет.
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-left text-xs leading-relaxed text-rose-100"
        >
          {error.message}{" "}
          {error.loginHref ? (
            <a
              href={error.loginHref}
              className="font-semibold text-white underline underline-offset-4 hover:text-rose-50"
            >
              Войти
            </a>
          ) : null}
        </p>
      ) : null}

      {isAgeDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-4 backdrop-blur-sm sm:items-center"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsAgeDialogOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-900 p-6 text-left shadow-2xl shadow-slate-950/60 sm:p-7"
          >
            <h2
              id={dialogTitleId}
              className="text-xl font-extrabold tracking-tight text-white"
            >
              Подтвердите возраст
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Сервис и платные материалы TriDi предназначены для лиц старше 18
              лет. Перед переходом к оплате подтвердите возраст и ознакомьтесь с{" "}
              <Link
                href="/legal/offer"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-blue-300 underline underline-offset-4 transition-colors hover:text-blue-200"
              >
                условиями Публичной оферты
              </Link>{" "}
              и{" "}
              <Link
                href="/legal/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-blue-300 underline underline-offset-4 transition-colors hover:text-blue-200"
              >
                Политикой обработки персональных данных
              </Link>
              .
            </p>

            <label
              htmlFor={`${dialogTitleId}-age`}
              className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm leading-relaxed text-slate-200"
            >
              <input
                id={`${dialogTitleId}-age`}
                type="checkbox"
                checked={ageConfirmed}
                onChange={(event) => setAgeConfirmed(event.target.checked)}
                autoFocus
                className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-white/20 bg-slate-900 accent-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              />
              <span>
                Подтверждаю, что мне исполнилось 18 лет и я согласен с условиями
                Публичной оферты.
              </span>
            </label>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsAgeDialogOpen(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handlePayment}
                disabled={!ageConfirmed}
                className={`${baseClassName} ${variantClassName[variant]} ${sizeClassName.compact}`}
              >
                Перейти к оплате
                <span aria-hidden>→</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
