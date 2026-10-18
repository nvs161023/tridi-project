"use client";

import { useState, useTransition } from "react";

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
}: PlanButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<{
    message: string;
    loginHref?: string;
  } | null>(null);

  function handleClick() {
    setError(null);

    startTransition(async () => {
      const result = await createRobokassaPayment(courseId);

      if ("error" in result) {
        setError({ message: result.error, loginHref: result.loginHref });
        return;
      }

      window.location.assign(result.url);
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-busy={isPending}
        className={`${baseClassName} ${variantClassName[variant]} ${sizeClassName[size]}`}
      >
        {isPending ? "Открываем оплату…" : label}
        {isPending ? null : <span aria-hidden>→</span>}
      </button>

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
    </div>
  );
}
