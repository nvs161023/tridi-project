"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { signUpAction } from "@/app/actions/auth";
import { emptyAuthFormState } from "@/app/actions/auth-state";

const inputClassName =
  "mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-white outline-none transition-colors placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40";

/** Ссылка на юридический документ внутри текста согласия. */
const legalLinkClassName =
  "font-semibold text-blue-300 underline underline-offset-4 transition-colors hover:text-blue-200";

type SignUpFormProps = {
  /**
   * Куда вернуться после регистрации: страница, с которой middleware увёл гостя
   * на вход (обычно урок, например /course/lesson-3). Значение уже проверено на
   * сервере — см. lib/auth-redirect.ts.
   */
  next?: string | null;
};

/**
 * Форма регистрации — клиентская часть страницы.
 *
 * Работает так же, как форма входа: useActionState отдаёт состояние (ошибку или
 * сообщение «подтвердите email»), готовый formAction и признак ожидания ответа.
 * Все данные читает Server Action на сервере, поэтому клиент Supabase в браузер
 * не попадает.
 */
export function SignUpForm({ next = null }: SignUpFormProps) {
  const [state, formAction, isPending] = useActionState(
    signUpAction,
    emptyAuthFormState,
  );

  /**
   * Отметка согласия. Состояние нужно, потому что кнопка регистрации неактивна,
   * пока согласие не дано. Серверная проверка при этом тоже есть
   * (см. app/actions/auth.ts): форма не должна отправляться без согласия, даже
   * если разметку кто-то подменил.
   */
  const [isAccepted, setIsAccepted] = useState(false);

  return (
    <form action={formAction} className="mt-8 space-y-6">
      {/* Куда вернуться после регистрации: Server Action прочитает это поле
          и уйдёт на урок, с которого человека увели. */}
      {next ? <input type="hidden" name="next" defaultValue={next} /> : null}
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-semibold text-slate-200"
        >
          Имя
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          defaultValue={state.values?.name ?? ""}
          placeholder="Как к вам обращаться"
          className={inputClassName}
        />
      </div>

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

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-semibold text-slate-200"
        >
          Пароль
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          placeholder="Минимум 6 символов"
          className={inputClassName}
        />
        <p className="mt-2 text-xs text-slate-500">Минимум 6 символов</p>
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

      {/* Согласие на обработку персональных данных — обязательная отметка.
          Ссылки на документы открываются в новой вкладке: так человек не теряет
          заполненную форму. */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-4">
        <label
          htmlFor="consent"
          className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-slate-300"
        >
          <input
            id="consent"
            name="consent"
            type="checkbox"
            required
            checked={isAccepted}
            onChange={(event) => setIsAccepted(event.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-white/20 bg-slate-900 accent-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          />
          <span>
            Я принимаю{" "}
            <Link
              href="/legal/terms"
              target="_blank"
              rel="noopener noreferrer"
              className={legalLinkClassName}
            >
              Пользовательское соглашение
            </Link>{" "}
            и даю{" "}
            <Link
              href="/legal/consent"
              target="_blank"
              rel="noopener noreferrer"
              className={legalLinkClassName}
            >
              согласие на обработку персональных данных
            </Link>
          </span>
        </label>

        {isAccepted ? null : (
          <p aria-live="polite" className="mt-3 text-sm text-amber-200">
            <span aria-hidden>⚠️</span> Отметьте согласие — без него регистрация
            недоступна.
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending || !isAccepted}
        aria-busy={isPending}
        className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-9 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Создаём аккаунт…" : "Зарегистрироваться"}
        {isPending ? null : <span aria-hidden>→</span>}
      </button>
    </form>
  );
}
