"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Supabase отвечает на английском. Частые случаи переводим,
 * остальное показываем как есть, чтобы ничего не потерять.
 */
function translateAuthError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("already registered") || normalized.includes("already exists")) {
    return "Пользователь с таким email уже зарегистрирован. Попробуйте войти.";
  }

  if (normalized.includes("password should be at least")) {
    return "Пароль слишком короткий — минимум 6 символов.";
  }

  if (normalized.includes("invalid email") || normalized.includes("unable to validate email")) {
    return "Проверьте, пожалуйста, адрес email — он выглядит некорректно.";
  }

  if (normalized.includes("rate limit") || normalized.includes("too many requests")) {
    return "Слишком много попыток. Подождите минуту и повторите.";
  }

  if (normalized.includes("signups not allowed") || normalized.includes("signup is disabled")) {
    return "Регистрация временно закрыта. Напишите нам, и мы поможем.";
  }

  return message;
}

export default function SignUpPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage(null);
    setInfoMessage(null);

    if (name.trim().length === 0) {
      setErrorMessage("Укажите имя — мы будем обращаться к вам по нему.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Пароль должен содержать минимум 6 символов.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: name.trim() } },
      });

      if (error) {
        setErrorMessage(translateAuthError(error.message));
        return;
      }

      if (data.session) {
        // Пользователь сразу авторизован — идём на дашборд.
        router.push("/dashboard");
        router.refresh();
        return;
      }

      // Подтверждение email включено: аккаунт создан, но сессии пока нет.
      setInfoMessage(
        `Аккаунт создан! Мы отправили письмо на ${email} — подтвердите адрес, и после этого сможете войти.`,
      );
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
            Регистрация
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-400">
            Создайте аккаунт, чтобы сохранять прогресс курса
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
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
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Как к вам обращаться"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-white outline-none transition-colors placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
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
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-white outline-none transition-colors placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
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
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Минимум 6 символов"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-white outline-none transition-colors placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
              />
              <p className="mt-2 text-xs text-slate-500">
                Минимум 6 символов
              </p>
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

            {infoMessage ? (
              <p
                role="status"
                className="flex items-start gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
              >
                <span aria-hidden>📬</span>
                {infoMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-9 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Создаём аккаунт…" : "Зарегистрироваться"}
              {isSubmitting ? null : <span aria-hidden>→</span>}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-400">
            Уже есть аккаунт?{" "}
            <Link
              href="/auth/login"
              className="font-semibold text-blue-400 transition-colors hover:text-blue-300"
            >
              Войти
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
