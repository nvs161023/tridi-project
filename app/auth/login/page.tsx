"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { createClient } from "@/lib/supabase/client";

const inputClassName =
  "mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-white outline-none transition-colors placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40";

/**
 * Supabase отвечает на английском, и на входе важно не путать причины:
 * «неверный пароль» и «почта не подтверждена» — разные советы пользователю.
 */
function translateSignInError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("email not confirmed")) {
    return "Email ещё не подтверждён. Откройте письмо от нас и перейдите по ссылке из него.";
  }

  if (normalized.includes("rate limit") || normalized.includes("too many requests")) {
    return "Слишком много попыток входа. Подождите минуту и повторите.";
  }

  if (normalized.includes("invalid email")) {
    return "Проверьте, пожалуйста, адрес email — он выглядит некорректно.";
  }

  // invalid login credentials и всё остальное нестандартное — «неверный пароль»
  return "Неверный email или пароль";
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage(null);

    if (email.trim().length === 0 || password.length === 0) {
      setErrorMessage("Заполните email и пароль.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(translateSignInError(error.message));
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setErrorMessage("Не удалось связаться с сервером. Проверьте интернет и повторите.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-16 sm:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 self-start text-sm font-medium text-slate-400 transition-colors hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <span aria-hidden>←</span>
          На главную
        </Link>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-9">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Вход
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-400">
            Войдите, чтобы продолжить курс с того места, где остановились
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
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
                value={email}
                onChange={(event) => setEmail(event.target.value)}
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
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Ваш пароль"
                className={inputClassName}
              />
            </div>

            {errorMessage ? (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
              >
                <span aria-hidden>⚠️</span>
                {errorMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-9 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Входим…" : "Войти"}
              {isSubmitting ? null : <span aria-hidden>→</span>}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-400">
            Нет аккаунта?{" "}
            <Link
              href="/auth/sign-up"
              className="font-semibold text-blue-400 transition-colors hover:text-blue-300"
            >
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
