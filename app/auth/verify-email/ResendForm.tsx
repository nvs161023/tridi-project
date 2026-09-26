"use client";

import { useActionState } from "react";

import { resendVerificationAction } from "@/app/actions/auth";
import { emptyAuthFormState } from "@/app/actions/auth-state";

const inputClassName =
  "mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-white outline-none transition-colors placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40";

/**
 * Повторная отправка письма для подтверждения адреса.
 *
 * Работает через Server Action: письмо отправляет сервер, клиентский Supabase в
 * браузер не загружается. Ссылку в письме и её проверку обрабатывает
 * app/auth/confirm/route.ts.
 */
export function ResendForm() {
  const [state, formAction, isPending] = useActionState(
    resendVerificationAction,
    emptyAuthFormState,
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label
          htmlFor="resend-email"
          className="block text-sm font-semibold text-slate-200"
        >
          Email, указанный при регистрации
        </label>
        <input
          id="resend-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email ?? ""}
          placeholder="you@example.com"
          className={inputClassName}
        />
      </div>

      {state.error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          <span aria-hidden>⚠️</span>
          {state.error}
        </p>
      ) : null}

      {state.info ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
        >
          <span aria-hidden>📬</span>
          {state.info}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-8 text-base font-semibold text-slate-100 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Отправляем…" : "Отправить письмо ещё раз"}
      </button>
    </form>
  );
}
