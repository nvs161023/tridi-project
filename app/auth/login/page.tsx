import type { Metadata } from "next";
import Link from "next/link";

import { loginIntroFor } from "@/lib/auth-login-copy";
import { authHref, safeNextPath } from "@/lib/auth-redirect";

import { LoginForm } from "./LoginForm";

/**
 * Заголовок и описание для вкладки и соцсетей.
 *
 * «TriDi» в title не дублируем: бренд подставляет шаблон корневого layout, и в
 * выдаче получается «Вход | TriDi». robots.noindex — иначе форма входа попадёт
 * в индекс и будет конкурировать в выдаче с главной, не добавляя ничего
 * полезного. follow оставляем выключенным: со страницы входа нечего обходить.
 */
export const metadata: Metadata = {
  title: "Вход",
  description:
    "Войдите в TriDi, чтобы открыть 3D-генератор, конструктор, мастерскую или продолжить обучение.",
  robots: { index: false, follow: false },
};

type LoginPageProps = {
  /** Параметры адреса: ?next= — страница, куда вернуться после входа. */
  searchParams: Promise<{ next?: string }>;
};

/**
 * Страница входа — серверный компонент.
 *
 * Клиентского кода здесь нет: разметку отдаёт сервер, а форму отправляет
 * Server Action (см. LoginForm и app/actions/auth.ts). Поэтому в браузер не
 * попадает ни клиент Supabase (~70 КБ), ни логика авторизации — только маленький
 * компонент формы.
 *
 * Сюда гостя приводит middleware с адресом страницы, которую он хотел открыть
 * (?next=/course/lesson-3): после входа человек возвращается на неё. Того, у кого
 * сессия уже есть, middleware отсюда уводит на тот же next (см.
 * lib/supabase/middleware.ts).
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  // Путь из адреса проверяем: он приходит из браузера, и без проверки вход мог бы
  // выбрасывать человека на чужой сайт (см. lib/auth-redirect.ts).
  const next = safeNextPath((await searchParams).next);
  // Текст зависит от next: человек, который шёл в генератор, не должен читать
  // про продолжение курса. Само правило живёт в lib/auth-login-copy.ts.
  const intro = loginIntroFor(next);
  return (
    <div className="min-h-screen text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-16 sm:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 self-start text-sm font-medium text-slate-300 transition-colors hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <span aria-hidden>←</span>
          На главную
        </Link>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-9">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Вход
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-300">
            {intro}
          </p>

          <LoginForm next={next} />

          <p className="mt-8 text-center text-sm text-slate-300">
            Нет аккаунта?{" "}
            <Link
              href={authHref("/auth/sign-up", next)}
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
