"use client";

import type { EmailOtpType } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";

import { resolveAfterAuthPath } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/client";

/**
 * Адрес страницы статуса для неудачного подтверждения: там объяснение и форма
 * повторной отправки письма.
 */
function failureHref(next: string): string {
  return `/auth/verify-email?status=error&next=${encodeURIComponent(next)}`;
}

/** Рамка страницы: тёмный фон и карточка по центру — как на входе и регистрации. */
function ConfirmShell({ children }: { children: ReactNode }) {
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
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Заглушка, пока Suspense ждёт гидратации: именно её видит браузер в первом
 * ответе сервера (и почтовый сканер), поэтому в ней нет ни кнопки, ни токена.
 */
function ConfirmPlaceholder() {
  return (
    <ConfirmShell>
      <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
        Подтвердите ваш email
      </h1>
      <p className="mt-3 text-base leading-relaxed text-slate-400">
        Секунду — готовим страницу подтверждения…
      </p>
    </ConfirmShell>
  );
}

/**
 * Страница подтверждения email — сюда ведёт ссылка из письма.
 *
 * Главное отличие от прежнего Route Handler: сам адрес ничего не подтверждает.
 * Почтовые сервисы (Mail.ru и подобные) открывают ссылки из писем, чтобы их
 * проверить, и одноразовый токен сгорал до того, как письмо прочитает человек.
 * Теперь токен уходит в Supabase только после нажатия кнопки (`verifyOtp`),
 * поэтому автоматический обход ссылки ничего не потребляет.
 *
 * Параметры адреса: `token_hash` и `type` приходят из шаблона письма,
 * `next` — куда вернуться после подтверждения. Если Supabase сообщил об ошибке
 * (`?error=…` или `?error_code=…`) либо параметров нет, показывать кнопку
 * нечего: уводим на страницу статуса со статусом error.
 *
 * `useSearchParams()` требует Suspense: без него Next.js не может ни
 * отрендерить такую страницу статически, ни собрать проект (CSR bailout).
 */
export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={<ConfirmPlaceholder />}>
      <ConfirmEmailScreen />
    </Suspense>
  );
}

function ConfirmEmailScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  // next приходит из нашего шаблона письма, redirect_to — от Supabase. Оба
  // проверяем: адрес виден пользователю, и подставить туда можно что угодно
  // (см. lib/auth-redirect.ts — пускает только внутренние пути).
  const next = resolveAfterAuthPath(
    searchParams.get("next") ?? searchParams.get("redirect_to"),
  );
  // Supabase умеет сообщать о неудаче прямо в адресе, например
  // ?error=access_denied&error_code=otp_expired: чаще всего это значит, что
  // ссылку уже открыл почтовый сервис и токен сгорел.
  const supabaseError =
    searchParams.get("error") ?? searchParams.get("error_code");
  // Подтверждать нечего: либо Supabase сообщил об ошибке, либо в ссылке нет
  // токена. Такой адрес не должен выглядеть рабочим.
  const isBroken = Boolean(supabaseError) || !tokenHash || !type;

  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (!isBroken) {
      return;
    }

    router.replace(failureHref(next));
  }, [isBroken, next, router]);

  const handleConfirm = async () => {
    // Проверка нужна только для типов: разметка ниже кнопку не показывает.
    if (!tokenHash || !type) {
      return;
    }

    setIsPending(true);

    try {
      const supabase = createClient();
      // type уходит в Supabase как есть, а сам токен проверяет Supabase:
      // чужой или неизвестный тип проверку не пройдёт.
      const { error } = await supabase.auth.verifyOtp({
        type: type as EmailOtpType,
        token_hash: tokenHash,
      });

      if (error) {
        console.warn("Подтверждение по ссылке не удалось:", error.message);
        window.location.replace(failureHref(next));

        return;
      }

      // Полная перезагрузка, а не router.push: серверные компоненты должны
      // увидеть cookies новой сессии.
      window.location.replace(next);
    } catch (cause) {
      // Чаще всего это отсутствие NEXT_PUBLIC_SUPABASE_* или недоступный
      // Supabase. Показать техническую ошибку нечем — ведём на страницу
      // статуса, откуда можно запросить новое письмо.
      console.error("Не удалось проверить ссылку подтверждения:", cause);
      window.location.replace(failureHref(next));
    }
  };

  if (isBroken) {
    // Кнопка не нужна: useEffect выше уже уводит на страницу статуса.
    return (
      <ConfirmShell>
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Ссылка не сработала
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-300">
          Открываем страницу подтверждения…
        </p>
      </ConfirmShell>
    );
  }

  return (
    <ConfirmShell>
      <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
        Подтвердите ваш email
      </h1>
      <p className="mt-3 text-base leading-relaxed text-slate-300">
        Нажмите кнопку ниже, чтобы завершить регистрацию.
      </p>

      <button
        type="button"
        onClick={handleConfirm}
        disabled={isPending}
        aria-busy={isPending}
        className="mt-8 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-9 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Подтверждаем…" : "Подтвердить email"}
        {isPending ? null : <span aria-hidden>→</span>}
      </button>

      {/* Объясняем, зачем нужен клик: иначе «кнопка вместо ссылки» выглядит как
          лишний шаг. */}
      <p className="mt-6 text-sm leading-relaxed text-slate-400">
        Подтверждение запускает кнопка — так ссылку из письма не сможет
        использовать почтовый сервис, который открывает письма автоматически.
      </p>
    </ConfirmShell>
  );
}
