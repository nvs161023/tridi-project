import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Восстановление пароля",
  description:
    "Запросите письмо со ссылкой для сброса пароля, чтобы вернуться к курсам TriDi и личному кабинету.",
  // Служебная страница: в поиске ей делать нечего.
  robots: { index: false, follow: false },
};

/**
 * Страница «забыли пароль» — серверный компонент.
 *
 * Сама страница ничего не отправляет: форму обрабатывает Server Action
 * `resetPasswordAction` (см. app/actions/auth.ts), поэтому клиент Supabase в
 * браузер не загружается. Ответ формы всегда нейтральный — «если аккаунт
 * существует, письмо отправлено», — чтобы по ней нельзя было проверять, какие
 * адреса зарегистрированы.
 *
 * Дальше человек идёт по ссылке из письма на /auth/reset-password: там ссылку
 * подтверждает кнопка, и только потом открывается форма нового пароля.
 */
export default function ForgotPasswordPage() {
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
            Восстановление пароля
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-400">
            Укажите email, на который регистрировались, — пришлём ссылку для нового
            пароля
          </p>

          <ForgotPasswordForm />

          <p className="mt-8 text-center text-sm text-slate-400">
            Вспомнили пароль?{" "}
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
