"use client";

import Link from "next/link";
import { useActionState } from "react";

import { activatePromoCode } from "@/app/actions/promo";
import { emptyActivatePromoFormState } from "@/app/actions/promo-state";

/**
 * Форма активации кода.
 *
 * Поле редактируемое: человек может прийти по ссылке из письма, а может ввести
 * код руками с карточки Ozon. Канонический вид (TRIDI-ABCD-1234) приводит
 * серверное действие — здесь только trim средствами браузера.
 */
export function ActivatePromoForm({ defaultCode }: { defaultCode: string }) {
  const [state, formAction, isPending] = useActionState(
    activatePromoCode,
    emptyActivatePromoFormState,
  );

  if (state.success) {
    return (
      <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-5">
        <p role="status" className="text-sm font-semibold text-emerald-200">
          {state.success}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {state.courseHref ? (
            <Link
              href={state.courseHref}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
            >
              Перейти к курсу
            </Link>
          ) : null}
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-6 text-sm font-semibold text-slate-200 transition-colors hover:border-white/30 hover:text-white"
          >
            В личный кабинет
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label
          htmlFor="promo-code"
          className="block text-xs font-semibold text-slate-300"
        >
          Промокод
        </label>
        <input
          id="promo-code"
          name="code"
          type="text"
          required
          defaultValue={defaultCode}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="TRIDI-ABCD-1234"
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 font-mono text-base tracking-wider text-white uppercase outline-none transition-colors placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Проверяем…" : "Активировать код"}
      </button>

      {state.error ? (
        <p role="alert" className="text-sm leading-relaxed text-red-300">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
