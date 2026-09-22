import Link from "next/link";

import { authHref, safeNextPath } from "@/lib/auth-redirect";

import { SignUpForm } from "./SignUpForm";

type SignUpPageProps = {
  /** Параметры адреса: ?next= — страница, куда вернуться после регистрации. */
  searchParams: Promise<{ next?: string }>;
};

/**
 * Страница регистрации — серверный компонент.
 *
 * Форму отправляет Server Action (см. SignUpForm и app/actions/auth.ts), поэтому
 * клиент Supabase в браузер не загружается. Если в проекте включено
 * подтверждение email, Server Action вернёт сообщение «проверьте почту»; если
 * выключено — сразу авторизует и переведёт дальше.
 *
 * Страница принимает ?next= — адрес, с которого гостя увёл middleware (обычно
 * урок). После регистрации человек оказывается там, а не в личном кабинете.
 */
export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  // Путь из адреса проверяем: он приходит из браузера, и без проверки регистрация
  // могла бы выбрасывать человека на чужой сайт (см. lib/auth-redirect.ts).
  const next = safeNextPath((await searchParams).next);
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

          <SignUpForm next={next} />

          <p className="mt-8 text-center text-sm text-slate-400">
            Уже есть аккаунт?{" "}
            <Link
              href={authHref("/auth/login", next)}
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
