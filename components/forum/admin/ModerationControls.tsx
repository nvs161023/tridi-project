"use client";

import { useActionState } from "react";

import type { ForumAdminFormState } from "@/app/actions/forum-state";
import { emptyForumAdminFormState } from "@/app/actions/forum-state";
import { deleteThread } from "@/app/actions/forum";
import {
  banForumAuthor,
  deleteForumReply,
  liftForumBan,
} from "@/app/actions/forum-admin";

type AdminAction = (
  prevState: ForumAdminFormState,
  formData: FormData,
) => Promise<ForumAdminFormState>;

const fieldClassName =
  "mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40";

/** Компактная кнопка «Одобрить» / «Отклонить» с результатом действия. */
export function ModerationButton({
  action,
  idName,
  idValue,
  label,
  tone,
}: {
  action: AdminAction;
  idName: "threadId" | "replyId";
  idValue: string;
  label: string;
  tone: "approve" | "reject";
}) {
  const [state, formAction, isPending] = useActionState(
    action,
    emptyForumAdminFormState,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name={idName} value={idValue} />
      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className={
          tone === "approve"
            ? "inline-flex min-h-9 items-center justify-center rounded-full bg-emerald-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            : "inline-flex min-h-9 items-center justify-center rounded-full border border-red-400/40 bg-red-500/10 px-4 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {isPending ? "…" : label}
      </button>
      {state.error ? (
        <p role="alert" className="mt-2 text-xs leading-relaxed text-red-300">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/** Удаление темы вместе с ответами: действие необратимо, поэтому спрашиваем. */
export function DeleteThreadButton({ threadId }: { threadId: string }) {
  const [state, formAction, isPending] = useActionState(
    deleteThread,
    emptyForumAdminFormState,
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm("Удалить тему вместе со всеми ответами безвозвратно?")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="threadId" value={threadId} />
      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="inline-flex min-h-9 items-center justify-center rounded-full border border-red-400/40 bg-red-500/10 px-4 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Удаляем…" : "Удалить"}
      </button>
      {state.error ? (
        <p role="alert" className="mt-2 text-xs leading-relaxed text-red-300">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="mt-2 text-xs leading-relaxed text-emerald-300">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}

/** Удаление опубликованного ответа: действие необратимо, поэтому спрашиваем. */
export function DeleteReplyButton({ replyId }: { replyId: string }) {
  const [state, formAction, isPending] = useActionState(
    deleteForumReply,
    emptyForumAdminFormState,
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm("Удалить ответ безвозвратно?")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="replyId" value={replyId} />
      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="inline-flex min-h-9 items-center justify-center rounded-full border border-red-400/40 bg-red-500/10 px-4 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Удаляем…" : "Удалить"}
      </button>
      {state.error ? (
        <p role="alert" className="mt-2 text-xs leading-relaxed text-red-300">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="mt-2 text-xs leading-relaxed text-emerald-300">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}

/** Форма бана автора: причина и срок. */
export function BanAuthorForm({ userId }: { userId: string }) {
  const [state, formAction, isPending] = useActionState(
    banForumAuthor,
    emptyForumAdminFormState,
  );

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <input type="hidden" name="userId" value={userId} />

      <div>
        <label
          htmlFor={`ban-reason-${userId}`}
          className="block text-xs font-semibold text-slate-300"
        >
          Причина
        </label>
        <input
          id={`ban-reason-${userId}`}
          name="reason"
          type="text"
          required
          maxLength={300}
          defaultValue="Нарушение правил форума"
          className={fieldClassName}
        />
      </div>

      <div>
        <label
          htmlFor={`ban-days-${userId}`}
          className="block text-xs font-semibold text-slate-300"
        >
          Срок
        </label>
        <select
          id={`ban-days-${userId}`}
          name="days"
          defaultValue="7"
          className={fieldClassName}
        >
          <option value="1">1 день</option>
          <option value="7">7 дней</option>
          <option value="30">30 дней</option>
          <option value="90">90 дней</option>
          <option value="365">1 год</option>
          <option value="forever">Бессрочно</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-9 items-center justify-center rounded-full border border-red-400/40 bg-red-500/10 px-4 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Блокируем…" : "Заблокировать на форуме"}
      </button>

      {state.error ? (
        <p role="alert" className="text-xs leading-relaxed text-red-300">
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p role="status" className="text-xs leading-relaxed text-emerald-300">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}

/** Снятие бана по id записи. */
export function LiftBanButton({ banId }: { banId: string }) {
  const [state, formAction, isPending] = useActionState(
    liftForumBan,
    emptyForumAdminFormState,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="banId" value={banId} />
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-8 items-center justify-center rounded-full border border-white/15 px-3 text-xs font-semibold text-slate-300 transition-colors hover:border-emerald-400/50 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Снимаем…" : "Снять бан"}
      </button>
      {state.error ? (
        <p role="alert" className="mt-2 text-xs leading-relaxed text-red-300">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

