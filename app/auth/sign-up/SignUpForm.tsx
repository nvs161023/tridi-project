"use client";

import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";

import { signUpAction } from "@/app/actions/auth";
import { emptyAuthFormState } from "@/app/actions/auth-state";
import { validateFirstName, validateLastName } from "@/lib/person-name";

const inputClassName =
  "mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-white outline-none transition-colors placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40";

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

  /**
   * Подтверждение возраста. Своё состояние по той же причине, что и у согласия:
   * кнопка регистрации неактивна, пока отметка не поставлена. Сервер проверяет
   * поле ageConfirmed сам (см. app/actions/auth.ts) — сервис предназначен для
   * лиц от 18 лет, и полагаться на одну разметку нельзя.
   */
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  /**
   * Ошибки имени и фамилии. `undefined` — поле ещё не трогали (показываем ответ
   * сервера, если он есть), `null` — человек начал править или проверка прошла,
   * `string` — текст ошибки. Так подсказка исчезает, как только поле исправляют,
   * и не возвращается из старого ответа Server Action.
   */
  const [fieldErrors, setFieldErrors] = useState<{
    firstName?: string | null;
    lastName?: string | null;
  }>({});

  function errorFor(field: "firstName" | "lastName"): string {
    const local = fieldErrors[field];

    if (local !== undefined) {
      return local ?? "";
    }

    return state.fieldErrors?.[field] ?? "";
  }

  const firstNameError = errorFor("firstName");
  const lastNameError = errorFor("lastName");

  /**
   * Проверяем имя и фамилию до отправки: ошибка появляется рядом с полем, и
   * человек не ждёт ответа сервера. Та же проверка есть в Server Action — см.
   * app/actions/auth.ts.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const firstName = String(formData.get("firstName") ?? "");
    const lastName = String(formData.get("lastName") ?? "");
    const firstNameError = validateFirstName(firstName);
    const lastNameError = validateLastName(lastName);

    setFieldErrors({ firstName: firstNameError, lastName: lastNameError });

    if (firstNameError || lastNameError) {
      event.preventDefault();
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="mt-8 space-y-6">
      {/* Куда вернуться после регистрации: Server Action прочитает это поле
          и уйдёт на урок, с которого человека увели. */}
      {next ? <input type="hidden" name="next" defaultValue={next} /> : null}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label
            htmlFor="first-name"
            className="block text-sm font-semibold text-slate-200"
          >
            Имя
          </label>
          <input
            id="first-name"
            name="firstName"
            type="text"
            autoComplete="given-name"
            aria-required="true"
            defaultValue={state.values?.firstName ?? ""}
            placeholder="Иван"
            aria-invalid={firstNameError ? true : undefined}
            aria-describedby={firstNameError ? "first-name-error" : undefined}
            onChange={() =>
              setFieldErrors((prev) => ({ ...prev, firstName: null }))
            }
            onBlur={(event) =>
              setFieldErrors((prev) => ({
                ...prev,
                firstName: validateFirstName(event.target.value),
              }))
            }
            className={inputClassName}
          />
          {firstNameError ? (
            <p
              id="first-name-error"
              role="alert"
              className="mt-2 text-sm text-red-300"
            >
              {firstNameError}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="last-name"
            className="block text-sm font-semibold text-slate-200"
          >
            Фамилия
          </label>
          <input
            id="last-name"
            name="lastName"
            type="text"
            autoComplete="family-name"
            aria-required="true"
            defaultValue={state.values?.lastName ?? ""}
            placeholder="Иванов"
            aria-invalid={lastNameError ? true : undefined}
            aria-describedby={lastNameError ? "last-name-error" : undefined}
            onChange={() =>
              setFieldErrors((prev) => ({ ...prev, lastName: null }))
            }
            onBlur={(event) =>
              setFieldErrors((prev) => ({
                ...prev,
                lastName: validateLastName(event.target.value),
              }))
            }
            className={inputClassName}
          />
          {lastNameError ? (
            <p
              id="last-name-error"
              role="alert"
              className="mt-2 text-sm text-red-300"
            >
              {lastNameError}
            </p>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-slate-300">
        Имя и фамилия попадут в сертификат о прохождении курса.
      </p>

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
        <p className="mt-2 text-xs text-slate-300">Минимум 6 символов</p>
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
            Я согласен на обработку персональных данных в соответствии с{" "}
            <Link
              href="/legal/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className={legalLinkClassName}
            >
              Политикой обработки персональных данных
            </Link>
            .
          </span>
        </label>

        {isAccepted ? null : (
          <p aria-live="polite" className="mt-3 text-sm text-amber-200">
            <span aria-hidden>⚠️</span> Отметьте согласие — без него регистрация
            недоступна.
          </p>
        )}
      </div>

      {/* Подтверждение возраста — вторая обязательная отметка. Сервис
          предназначен для лиц от 18 лет: п. 2.5 Публичной оферты, п. 2.4
          Пользовательского соглашения и раздел 3.6 Политики обработки
          персональных данных. */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-4">
        <label
          htmlFor="age-confirmed"
          className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-slate-300"
        >
          <input
            id="age-confirmed"
            name="ageConfirmed"
            type="checkbox"
            required
            checked={ageConfirmed}
            onChange={(event) => setAgeConfirmed(event.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-white/20 bg-slate-900 accent-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          />
          <span>
            Мне исполнилось 18 лет, и я согласен с условиями{" "}
            <Link
              href="/legal/offer"
              target="_blank"
              rel="noopener noreferrer"
              className={legalLinkClassName}
            >
              Публичной оферты
            </Link>{" "}
            и{" "}
            <Link
              href="/legal/terms"
              target="_blank"
              rel="noopener noreferrer"
              className={legalLinkClassName}
            >
              Пользовательского соглашения
            </Link>
            . С{" "}
            <Link
              href="/legal/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className={legalLinkClassName}
            >
              Политикой обработки персональных данных
            </Link>{" "}
            ознакомлен.
          </span>
        </label>

        {ageConfirmed ? null : (
          <p aria-live="polite" className="mt-3 text-sm text-amber-200">
            <span aria-hidden>⚠️</span> Подтвердите, что вам исполнилось 18 лет и
            вы принимаете условия оферты, — без этого регистрация недоступна.
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending || !isAccepted || !ageConfirmed}
        aria-busy={isPending}
        className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-9 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Создаём аккаунт…" : "Зарегистрироваться"}
        {isPending ? null : <span aria-hidden>→</span>}
      </button>
    </form>
  );
}
