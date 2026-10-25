import type { Metadata } from "next";
import Link from "next/link";

import { ActivatePromoForm } from "@/components/promo/ActivatePromoForm";
import { Header } from "@/components/Header";
import { authHref } from "@/lib/auth-redirect";
import { normalizePromoCode } from "@/lib/promo-codes";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Активация промокода — TriDi",
  description:
    "Активируйте промокод на курс TriDi: доступ откроется сразу в вашем аккаунте.",
  robots: { index: false, follow: false },
};

/** Сессия проверяется на каждом запросе: страница зависит от пользователя. */
export const dynamic = "force-dynamic";

type ActivatePageProps = {
  /** Код из ссылки: /activate?code=TRIDI-ABCD-1234. */
  searchParams: Promise<{ code?: string }>;
};

/**
 * Страница активации промокода.
 *
 * Ссылку на неё печатает CSV для Ozon (lib/promo-codes.ts → buildActivationUrl).
 * Гость видит просьбу войти и возвращается сюда после входа: код привязывается
 * к аккаунту, поэтому без сессии активация невозможна.
 *
 * Сама проверка кода — в Server Action activatePromoCode: страница только
 * показывает форму и подставляет код из адреса.
 */
export default async function ActivatePage({ searchParams }: ActivatePageProps) {
  const code = normalizePromoCode((await searchParams).code ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen text-slate-100">
      <Header />

      <main className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-blue-300 uppercase">
          Промокод
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Активация промокода
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-300">
          Код открывает доступ к курсу навсегда. Каждый код одноразовый и
          привязывается к аккаунту, поэтому активируйте его под своим именем.
        </p>

        {user ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-7">
            <p className="text-sm text-slate-300">
              Вы вошли как{" "}
              <span className="font-semibold text-white">
                {user.email ?? "ученик TriDi"}
              </span>
              .
            </p>

            <ActivatePromoForm defaultCode={code} />

            <p className="mt-6 text-xs leading-relaxed text-slate-400">
              Если код не подходит, доступ к курсу можно купить на странице
              тарифа — активация ничего не списывает.
            </p>
          </div>
        ) : (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-7">
            <h2 className="text-lg font-bold text-white">
              Сначала войдите в аккаунт
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Промокод привязывается к пользователю, поэтому без входа активация
              невозможна. После входа вы вернётесь на эту страницу, код
              сохранится в ссылке.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={authHref(
                  "/auth/login",
                  code ? `/activate?code=${encodeURIComponent(code)}` : "/activate",
                )}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
              >
                Войти и активировать
              </Link>
              <Link
                href={authHref(
                  "/auth/sign-up",
                  code ? `/activate?code=${encodeURIComponent(code)}` : "/activate",
                )}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-6 text-sm font-semibold text-slate-200 transition-colors hover:border-white/30 hover:text-white"
              >
                Зарегистрироваться
              </Link>
            </div>

            {code ? (
              <p className="mt-5 text-xs text-slate-400">
                Код из ссылки:{" "}
                <span className="font-mono text-slate-200">{code}</span>
              </p>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
