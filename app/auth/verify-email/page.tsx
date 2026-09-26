import type { Metadata } from "next";
import Link from "next/link";

import { authHref, safeNextPath } from "@/lib/auth-redirect";
import { LEGAL_OPERATOR } from "@/lib/legal";

import { ResendForm } from "./ResendForm";

export const metadata: Metadata = {
  title: "Подтверждение email",
  description:
    "Подтвердите адрес электронной почты, чтобы завершить регистрацию в сервисе TriDi и открыть доступ к курсам и личному кабинету.",
  // Служебная страница: индексировать её незачем.
  robots: { index: false, follow: false },
};

type VerifyEmailPageProps = {
  /** status — результат перехода по ссылке из письма, next — куда вернуться. */
  searchParams: Promise<{ status?: string; next?: string }>;
};

/**
 * Страница подтверждения адреса электронной почты.
 *
 * Сюда попадают в трёх случаях:
 *   • сразу после регистрации — «проверьте почту» и форма повторной отправки;
 *   • по ссылке из письма — маршрут /auth/confirm проверил токен и вернул статус
 *     (ok или error); для ссылок старого формата здесь срабатывает клиентский
 *     обработчик EmailLinkHandler, подключённый в корневом layout;
 *   • из middleware — если адрес ещё не подтверждён, доступ к урокам и кабинету
 *     закрыт и человека отправляют сюда.
 *
 * Полезное действие на любой из этих случаев одно: запросить новое письмо, если
 * прежнее не пришло или ссылка испортилась.
 */
export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const { status, next: rawNext } = await searchParams;
  const next = safeNextPath(rawNext);
  const continueHref = next ?? "/dashboard";

  const isConfirmed = status === "ok";
  const isChecking = status === "checking";
  const hasError = status === "error";

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
          {isConfirmed ? (
            <>
              <span aria-hidden className="text-4xl">
                ✅
              </span>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Почта подтверждена
              </h1>
              <p className="mt-3 text-base leading-relaxed text-slate-300">
                Адрес подтверждён, доступ к курсам и личному кабинету открыт.
              </p>
              <Link
                href={continueHref}
                className="mt-8 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-9 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Продолжить
                <span aria-hidden>→</span>
              </Link>
            </>
          ) : (
            <>
              <span aria-hidden className="text-4xl">
                {hasError ? "⚠️" : "📬"}
              </span>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                {hasError
                  ? "Ссылка не сработала"
                  : isChecking
                    ? "Завершаем подтверждение…"
                    : "Проверьте почту"}
              </h1>

              {hasError ? (
                <p className="mt-3 text-base leading-relaxed text-slate-300">
                  Возможно, ссылка истекла или уже была использована — так бывает,
                  если открыть письмо повторно. Запросите новое письмо: оно придёт
                  на тот же адрес.
                </p>
              ) : isChecking ? (
                <p className="mt-3 text-base leading-relaxed text-slate-300">
                  Секунду — проверяем ссылку из письма и открываем доступ.
                </p>
              ) : (
                <p className="mt-3 text-base leading-relaxed text-slate-300">
                  Мы отправили письмо со ссылкой для подтверждения. Перейдите по
                  ней — и аккаунт активируется: откроются курсы, тесты и личный
                  кабинет.
                </p>
              )}

              {isChecking ? (
                <p className="mt-4 text-sm leading-relaxed text-slate-400">
                  Если через несколько секунд ничего не произошло, ссылка, скорее
                  всего, уже использована — запросите новое письмо ниже.
                </p>
              ) : (
                <ul className="mt-5 list-disc space-y-2 pl-6 text-sm leading-relaxed text-slate-400 marker:text-slate-500">
                  <li>письмо обычно приходит в течение пары минут;</li>
                  <li>
                    если его не видно — загляните в папки «Спам» и «Промоакции»;
                  </li>
                  <li>
                    ссылка действует ограниченное время, поэтому старое письмо
                    лучше не использовать.
                  </li>
                </ul>
              )}

              <ResendForm />

              <p className="mt-6 text-sm leading-relaxed text-slate-400">
                Письмо не приходит совсем? Напишите на{" "}
                <a
                  href={`mailto:${LEGAL_OPERATOR.email}`}
                  className="font-semibold text-blue-300 underline underline-offset-4 transition-colors hover:text-blue-200"
                >
                  {LEGAL_OPERATOR.email}
                </a>{" "}
                — поможем вручную.
              </p>
            </>
          )}

          <p className="mt-8 text-center text-sm text-slate-400">
            Уже подтвердили адрес?{" "}
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
