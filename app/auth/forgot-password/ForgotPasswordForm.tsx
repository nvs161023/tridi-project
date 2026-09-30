"use client";

import { useActionState } from "react";

import { resetPasswordAction } from "@/app/actions/auth";
import { emptyAuthFormState } from "@/app/actions/auth-state";

const inputClassName =
  "mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-white outline-none transition-colors placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40";

/**
 * Форма запроса письма для сброса пароля — единственная клиентская часть страницы.
 *
 * Работает как форма входа: `useActionState` отдаёт состояние (нейтральное
 * сообщение или ошибку), готовый `formAction` и признак ожидания ответа. Поля
 * неконтролируемые, поэтому форма отправляется и без JavaScript — это встроенное
 * свойство Server Actions. Введённый адрес возвращается в поле после ошибки
 * (`state.values.email`), чтобы его не приходилось печатать заново.
 */
export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    resetPasswordAction,
    emptyAuthFormState,
  );

  return (
    <form action={formAction} className="mt-8 space-y-6">
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-semibold text-slate-200"
        >
          Email
        </label>
        <input
          id="email"
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
        className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-9 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Отправляем…" : "Отправить письмо для сброса"}
        {isPending ? null : <span aria-hidden>→</span>}
      </button>
    </form>
  );
}
