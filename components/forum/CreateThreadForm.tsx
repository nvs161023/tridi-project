"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";

import { createThread } from "@/app/actions/forum";
import { emptyForumFormState } from "@/app/actions/forum-state";

const fieldClassName =
  "mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-white outline-none transition-colors placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40";

type CategoryOption = {
  id: string;
  title: string;
};

/**
 * Форма новой темы.
 *
 * Категории приходят с сервера. author_id и status в форму не передаются:
 * Server Action берёт пользователя из сессии, а RLS всё равно принудительно
 * ставит status = 'pending'.
 */
export function CreateThreadForm({
  categories,
  defaultCategoryId,
}: {
  categories: readonly CategoryOption[];
  defaultCategoryId?: string;
}) {
  const [state, formAction, isPending] = useActionState(
    createThread,
    emptyForumFormState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const fallbackCategoryId = categories[0]?.id ?? "";
  const initialCategoryId =
    defaultCategoryId &&
    categories.some((category) => category.id === defaultCategoryId)
      ? defaultCategoryId
      : fallbackCategoryId;

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  if (state.success) {
    return (
      <div className="mt-8 rounded-3xl border border-emerald-500/40 bg-emerald-500/10 p-6 sm:p-8">
        <h2 className="text-lg font-bold text-emerald-100">
          Тема отправлена на модерацию
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-emerald-100/90">
          {state.success}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-emerald-100/80">
          До одобрения тема не видна другим пользователям и поисковым системам.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/forum"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            Вернуться на форум
          </Link>
          <Link
            href="/forum/rules"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-6 text-sm font-semibold text-slate-200 transition-colors hover:border-blue-400/50 hover:text-white"
          >
            Правила форума
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="mt-8 space-y-6">
      {/* Ловушка для спам-ботов. Человек этого поля не видит. */}
      <div aria-hidden className="hidden">
        <label htmlFor="thread-website">Сайт</label>
        <input
          id="thread-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div>
        <label
          htmlFor="thread-category"
          className="block text-sm font-semibold text-slate-200"
        >
          Раздел
        </label>
        <select
          id="thread-category"
          name="categoryId"
          required
          defaultValue={initialCategoryId}
          className={fieldClassName}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="thread-title"
          className="block text-sm font-semibold text-slate-200"
        >
          Заголовок
        </label>
        <input
          id="thread-title"
          name="title"
          type="text"
          required
          minLength={5}
          maxLength={180}
          placeholder="Например: PLA расслаивается на Ender 3 — что проверить?"
          className={fieldClassName}
        />
        <p className="mt-2 text-xs text-slate-500">
          До 180 символов. Конкретный заголовок помогает найти ответ быстрее.
        </p>
      </div>

      <div>
        <label
          htmlFor="thread-content"
          className="block text-sm font-semibold text-slate-200"
        >
          Текст темы
        </label>
        <textarea
          id="thread-content"
          name="content"
          rows={10}
          required
          minLength={10}
          maxLength={20000}
          placeholder="Опишите ситуацию: принтер, пластик, слайсер, температуры и что уже пробовали."
          className={fieldClassName}
        />
      </div>


      <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-slate-300">
        <input
          type="checkbox"
          name="rules"
          required
          className="mt-1 h-4 w-4 shrink-0 rounded border-white/20 bg-slate-900 accent-blue-600"
        />
        <span>
          Я прочитал(а){" "}
          <Link
            href="/forum/rules"
            className="text-blue-300 underline underline-offset-4 transition-colors hover:text-blue-200"
          >
            правила форума
          </Link>{" "}
          и понимаю, что тема будет опубликована только после проверки.
        </span>
      </label>

      <div aria-live="polite" className="space-y-2">
        {state.error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            <span aria-hidden>⚠️</span>
            {state.error}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-8 text-base font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Отправляем…" : "Отправить на модерацию"}
        {isPending ? null : <span aria-hidden>→</span>}
      </button>
    </form>
  );
}

