"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { updateProfileAction } from "@/app/actions/profile";
import { emptyProfileFormState } from "@/app/actions/profile-state";

const inputClassName =
  "mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-base text-white outline-none transition-colors placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40";

type ProfileEditorProps = {
  firstName: string;
  lastName: string;
  email: string | null;
};

/**
 * Кнопка «Редактировать профиль» и модальное окно с именем и фамилией.
 *
 * Модальное окно живёт в клиентском компоненте, хотя кабинет — серверный:
 * открытие и закрытие не должны вызывать переход или новый запрос к Supabase.
 * После успешного сохранения обновляем серверные данные (router.refresh):
 * приветствие и шапка читают имя из middleware, и им нужен новый запрос.
 */
export function ProfileEditor({
  firstName,
  lastName,
  email,
}: ProfileEditorProps) {
  const [state, formAction, isPending] = useActionState(
    updateProfileAction,
    emptyProfileFormState,
  );
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  // Состояние приходит новым объектом после каждой отправки. Если сохранение
  // прошло, закрываем окно и обновляем серверную часть страницы: имя в
  // приветствии подставляется middleware, а не этим компонентом.
  useEffect(() => {
    if (state.success) {
      router.refresh();
      setIsOpen(false);
    }
  }, [state, router]);

  // Escape закрывает окно — привычное поведение диалога.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Пока диалог открыт, страница под ним не прокручивается.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 text-sm font-semibold text-slate-200 transition-colors hover:border-blue-400/50 hover:bg-blue-500/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        <span aria-hidden>✎</span>
        Редактировать профиль
      </button>
      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            // Клик по затемнению закрывает окно, клик по карточке — нет.
            if (event.target === event.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-dialog-title"
            className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl shadow-black/50 sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="profile-dialog-title"
                  className="text-xl font-extrabold tracking-tight text-white"
                >
                  Редактировать профиль
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {email ?? "Email не указан"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Закрыть окно редактирования профиля"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-lg text-slate-300 transition-colors hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              >
                <span aria-hidden>×</span>
              </button>
            </div>

            <form action={formAction} className="mt-6 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="profile-first-name"
                    className="block text-sm font-semibold text-slate-200"
                  >
                    Имя
                  </label>
                  <input
                    id="profile-first-name"
                    name="firstName"
                    type="text"
                    autoComplete="given-name"
                    autoFocus
                    required
                    defaultValue={state.values?.firstName ?? firstName}
                    aria-invalid={
                      state.fieldErrors?.firstName ? true : undefined
                    }
                    aria-describedby={
                      state.fieldErrors?.firstName
                        ? "profile-first-name-error"
                        : undefined
                    }
                    className={inputClassName}
                  />
                  {state.fieldErrors?.firstName ? (
                    <p
                      id="profile-first-name-error"
                      role="alert"
                      className="mt-2 text-sm text-red-300"
                    >
                      {state.fieldErrors.firstName}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label
                    htmlFor="profile-last-name"
                    className="block text-sm font-semibold text-slate-200"
                  >
                    Фамилия
                  </label>
                  <input
                    id="profile-last-name"
                    name="lastName"
                    type="text"
                    autoComplete="family-name"
                    required
                    defaultValue={state.values?.lastName ?? lastName}
                    aria-invalid={state.fieldErrors?.lastName ? true : undefined}
                    aria-describedby={
                      state.fieldErrors?.lastName
                        ? "profile-last-name-error"
                        : undefined
                    }
                    className={inputClassName}
                  />
                  {state.fieldErrors?.lastName ? (
                    <p
                      id="profile-last-name-error"
                      role="alert"
                      className="mt-2 text-sm text-red-300"
                    >
                      {state.fieldErrors.lastName}
                    </p>
                  ) : null}
                </div>
              </div>


              <p className="text-xs leading-relaxed text-slate-500">
                Имя и фамилия попадут в сертификат о прохождении курса.
              </p>

              {state.error ? (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                >
                  <span aria-hidden>⚠️</span>
                  {state.error}
                </p>
              ) : null}

              <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 px-6 text-sm font-semibold text-slate-200 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  aria-busy={isPending}
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? "Сохраняем…" : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

