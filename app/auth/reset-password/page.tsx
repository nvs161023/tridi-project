"use client";

import type { EmailOtpType } from "@supabase/supabase-js";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent, type ReactNode } from "react";

import { createClient } from "@/lib/supabase/client";

/** Куда уводим, если ссылка не подтвердилась: на вход, с пометкой об ошибке. */
const LOGIN_ERROR_HREF = "/auth/login?error=reset_link_invalid";

/** Страница запроса нового письма — туда ведём, если ссылка не сработала. */
const FORGOT_PASSWORD_HREF = "/auth/forgot-password";

const inputClassName =
  "mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-white outline-none transition-colors placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40";

/** Главная кнопка страницы: тот же вид, что «Подтвердить email» на /auth/confirm. */
const buttonClassName =
  "mt-8 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-9 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Supabase отвечает на английском. Переводим частые причины отказа от нового пароля,
 * остальное показываем одной понятной подсказкой — технический текст пользователю
 * ничего не объясняет.
 */
function translatePasswordError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("password should be at least")) {
    return "Пароль слишком короткий — минимум 6 символов.";
  }

  if (normalized.includes("different from the old password")) {
    return "Новый пароль совпадает со старым. Придумайте другой.";
  }

  if (
    normalized.includes("rate limit") ||
    normalized.includes("too many requests")
  ) {
    return "Слишком много попыток. Подождите минуту и повторите.";
  }

  if (normalized.includes("session") || normalized.includes("jwt")) {
    return "Сессия сброса истекла. Запросите новое письмо — ссылка из него откроет форму заново.";
  }

  return "Не удалось сохранить пароль. Попробуйте ещё раз или запросите новое письмо.";
}

/** Рамка страницы: тёмный фон и карточка по центру — как на входе и регистрации. */
function ResetShell({ children }: { children: ReactNode }) {
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
 * Заглушка до гидратации: её отдаёт сервер, поэтому в ответе нет ни токена, ни
 * кнопки. Почтовый сервис, открывший ссылку автоматически, не увидит и не нажмёт
 * здесь ничего — токен остаётся живым до прихода человека.
 */
function ResetPlaceholder() {
  return (
    <ResetShell>
      <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
        Сброс пароля
      </h1>
      <p className="mt-3 text-base leading-relaxed text-slate-300">
        Секунду — готовим страницу сброса пароля…
      </p>
    </ResetShell>
  );
}

/**
 * Страница сброса пароля.
 *
 * Работает в два шага, как подтверждение email (`app/auth/confirm/page.tsx`):
 * сначала ссылка из письма подтверждается кнопкой, и только затем открывается форма
 * нового пароля. Сам адрес не делает ничего: его может открыть почтовый сервис,
 * который проверяет ссылки в письмах, и одноразовый токен не сгорит до того, как
 * письмо прочитает человек.
 *
 * Обе операции выполняет браузерный клиент (`lib/supabase/client.ts`): `verifyOtp`
 * записывает cookies восстановительной сессии, а `updateUser` меняет пароль в этой
 * же сессии. Серверный клиент здесь не подошёл бы: в Server Component запись cookies
 * запрещена, а `lib/supabase/server.ts` такие ошибки глушит — сессия молча не
 * сохранилась бы.
 *
 * `useSearchParams()` требует Suspense: без него Next.js не может ни отрендерить
 * страницу статически, ни собрать проект (CSR bailout).
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPlaceholder />}>
      <ResetPasswordScreen />
    </Suspense>
  );
}

/** Шаги страницы: подтверждение ссылки → новый пароль → готово. */
type ResetStep = "confirm" | "password" | "done";

function ResetPasswordScreen() {
  const searchParams = useSearchParams();

  const tokenHash = searchParams.get("token_hash");
  // type приходит в адресе из письма (для сброса это recovery). Наличие проверяем,
  // но само значение в Supabase не отправляем: токен сброса принимается только
  // типом recovery, а значение из адреса человек мог подменить.
  const type = searchParams.get("type");
  // Supabase умеет сообщать о неудаче прямо в адресе, например
  // ?error=access_denied&error_code=otp_expired: ссылка устарела или её уже открыл
  // почтовый сервис, и токен сгорел.
  const supabaseError =
    searchParams.get("error") ?? searchParams.get("error_code");
  // Сбрасывать нечего: либо Supabase сообщил об ошибке, либо в ссылке нет токена.
  const isBroken = Boolean(supabaseError) || !tokenHash || !type;

  const [step, setStep] = useState<ResetStep>("confirm");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  /** Первый шаг: обменять токен из письма на сессию восстановления. */
  const handleVerify = async () => {
    // Проверка нужна только для типов: разметка ниже кнопку не показывает.
    if (!tokenHash) {
      return;
    }

    setIsVerifying(true);
    setVerifyError(null);

    try {
      const supabase = createClient();
      // В Supabase уходит фиксированный type: принимается только токен сброса пароля.
      const { error } = await supabase.auth.verifyOtp({
        type: "recovery" as EmailOtpType,
        token_hash: tokenHash,
      });

      if (error) {
        // Ссылка устарела, уже использована или пришла не из письма о сбросе:
        // уводим на вход с пометкой об ошибке.
        window.location.replace(LOGIN_ERROR_HREF);

        return;
      }

      setIsVerifying(false);
      setStep("password");
    } catch {
      // Проблема с сетью: токен не «сжигаем» — кнопку можно нажать ещё раз.
      setIsVerifying(false);
      setVerifyError(
        "Не удалось связаться с сервером. Проверьте интернет и нажмите кнопку ещё раз.",
      );
    }
  };

  /** Второй шаг: сохранить новый пароль в сессии восстановления. */
  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (password.length < 6) {
      setFormError("Пароль должен содержать минимум 6 символов.");

      return;
    }

    if (password !== repeat) {
      setFormError("Пароли не совпадают. Проверьте раскладку и повторите ввод.");

      return;
    }

    setIsSaving(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setIsSaving(false);
        setFormError(translatePasswordError(error.message));

        return;
      }

      setIsSaving(false);
      setStep("done");
    } catch {
      setIsSaving(false);
      setFormError(
        "Не удалось связаться с сервером. Проверьте интернет и повторите.",
      );
    }
  };

  // Ссылка негодная: подтверждать и сбрасывать нечего — предлагаем запросить новое
  // письмо (тем же действием занята страница /auth/forgot-password).
  if (isBroken) {
    return (
      <ResetShell>
        <span aria-hidden className="text-4xl">
          ⚠️
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Ссылка не сработала
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-300">
          Ссылка не сработала или устарела. Запросите новое письмо — оно придёт на тот
          же адрес.
        </p>
        <Link href={FORGOT_PASSWORD_HREF} className={buttonClassName}>
          Запросить новое письмо
          <span aria-hidden>→</span>
        </Link>

        <p className="mt-6 text-center text-sm text-slate-400">
          Вспомнили пароль?{" "}
          <Link
            href="/auth/login"
            className="font-semibold text-blue-400 transition-colors hover:text-blue-300"
          >
            Войти
          </Link>
        </p>
      </ResetShell>
    );
  }

  if (step === "done") {
    return (
      <ResetShell>
        <span aria-hidden className="text-4xl">
          ✅
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Пароль обновлён
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-300">
          Новый пароль сохранён. Войдите с ним — и продолжите курс с того места, где
          остановились.
        </p>
        <Link href="/auth/login" className={buttonClassName}>
          Войти
          <span aria-hidden>→</span>
        </Link>
      </ResetShell>
    );
  }

  if (step === "password") {
    return (
      <ResetShell>
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Новый пароль
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-400">
          Ссылка подтверждена. Придумайте новый пароль и сохраните его.
        </p>

        {/* Поля контролируемые: рядом с ними нужна своя проверка (длина и
            совпадение), а её результат — понятный текст, а не ответ Supabase. */}
        <form onSubmit={handleSave} className="mt-8 space-y-6">
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-slate-200"
            >
              Новый пароль
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
              className={inputClassName}
            />
            <p className="mt-2 text-xs text-slate-500">Минимум 6 символов</p>
          </div>

          <div>
            <label
              htmlFor="repeat"
              className="block text-sm font-semibold text-slate-200"
            >
              Повторите пароль
            </label>
            <input
              id="repeat"
              name="repeat"
              type="password"
              autoComplete="new-password"
              required
              value={repeat}
              onChange={(event) => setRepeat(event.target.value)}
              placeholder="Ещё раз"
              className={inputClassName}
            />
          </div>

          {formError ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
            >
              <span aria-hidden>⚠️</span>
              {formError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSaving}
            aria-busy={isSaving}
            className={buttonClassName}
          >
            {isSaving ? "Сохраняем…" : "Сохранить пароль"}
            {isSaving ? null : <span aria-hidden>→</span>}
          </button>
        </form>
      </ResetShell>
    );
  }

  return (
    <ResetShell>
      <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
        Сброс пароля
      </h1>
      <p className="mt-3 text-base leading-relaxed text-slate-300">
        Нажмите кнопку ниже, чтобы продолжить.
      </p>

      {verifyError ? (
        <p
          role="alert"
          className="mt-6 flex items-start gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          <span aria-hidden>⚠️</span>
          {verifyError}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleVerify}
        disabled={isVerifying}
        aria-busy={isVerifying}
        className={buttonClassName}
      >
        {isVerifying ? "Проверяем ссылку…" : "Подтвердить"}
        {isVerifying ? null : <span aria-hidden>→</span>}
      </button>

      <p className="mt-6 text-sm leading-relaxed text-slate-400">
        Кнопка нужна, чтобы ссылку не сожгли до вас: письма иногда открывают почтовые
        сервисы, которые проверяют ссылки автоматически, — токен уходит в Supabase
        только после нажатия.
      </p>
    </ResetShell>
  );
}

