"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";

import { createReply } from "@/app/actions/forum";
import { emptyForumFormState } from "@/app/actions/forum-state";

const textareaClassName =
  "mt-2 w-full resize-y rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-white outline-none transition-colors placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40";

/**
 * Форма ответа в теме.
 *
 * Клиентская только из-за useActionState: сам текст уходит в Server Action,
 * который заново проверяет сессию, бан, стоп-слова и статус темы. Скрытых
 * «доверенных» полей здесь нет — author_id и status ставит база.
 */
export function ReplyForm({ threadId }: { threadId: string }) {
  const [state, formAction, isPending] = useActionState(
    createReply,
    emptyForumFormState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="mt-5">
      <input type="hidden" name="threadId" value={threadId} />

      <label
        htmlFor="reply-content"
        className="block text-sm font-semibold text-slate-200"
      >
        Ваш ответ
      </label>
      <textarea
        id="reply-content"
        name="content"
        rows={5}
        required
        minLength={3}
        maxLength={20000}
        placeholder="Ответьте по существу: что помогло, какие настройки использовали, что стоит проверить."
        className={textareaClassName}
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-relaxed text-slate-500">
          Ответ публикуется сразу.{" "}
          <Link
            href="/forum/rules"
            className="text-blue-300 underline underline-offset-4 transition-colors hover:text-blue-200"
          >
            Правила форума
          </Link>
          {" · "}
          <Link
            href="/legal/privacy"
            className="text-blue-300 underline underline-offset-4 transition-colors hover:text-blue-200"
          >
            Политика обработки персональных данных
          </Link>
        </p>
        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-blue-600 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Отправляем…" : "Отправить ответ"}
          {isPending ? null : <span aria-hidden>→</span>}
        </button>
      </div>

      <div aria-live="polite" className="mt-4 space-y-2">
        {state.error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            <span aria-hidden>⚠️</span>
            {state.error}
          </p>
        ) : null}

        {state.success ? (
          <p
            role="status"
            className="flex items-start gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
          >
            <span aria-hidden>✓</span>
            {state.success}
          </p>
        ) : null}
      </div>
    </form>
  );
}
