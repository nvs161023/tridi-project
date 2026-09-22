import Link from "next/link";

import { LoginForm } from "./LoginForm";

/**
 * Страница входа — серверный компонент.
 *
 * Клиентского кода здесь нет: разметку отдаёт сервер, а форму отправляет
 * Server Action (см. LoginForm и app/actions/auth.ts). Поэтому в браузер не
 * попадает ни клиент Supabase (~70 КБ), ни логика авторизации — только маленький
 * компонент формы.
 *
 * Авторизованного пользователя сюда не пустит middleware: он уведёт его в
 * /dashboard (см. lib/supabase/middleware.ts).
 */
export default function LoginPage() {
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

          <LoginForm />

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
