"use client";

import { type FormEvent, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

const inputClassName =
  "mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-white outline-none transition-colors placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40";

/**
 * Ключ, под которым адрес сохраняется при регистрации. Читаем его только для
 * удобства: если ключа нет, человек просто введёт адрес сам.
 */
const PENDING_EMAIL_KEY = "pending_email";

const CODE_ERROR_MESSAGE = "Неверный или истёкший код. Запросите новое письмо.";

type OtpFormProps = {
  /** Куда перейти после подтверждения: проверенный next или личный кабинет. */
  next: string;
};

/**
 * Ввод кода из письма — запасной путь подтверждения адреса.
 *
 * Зачем нужен: почтовые сервисы (например, Mail.ru) автоматически открывают ссылки
 * из писем, и одноразовый токен сгорает раньше, чем письмо прочитает человек.
 * Ссылка тогда не срабатывает, но код из письма ещё действует — его и просим.
 *
 * Код проверяет клиент Supabase в браузере: он же записывает cookies сессии.
 * Поэтому после успеха страница перезагружается целиком — иначе серверные
 * компоненты не увидели бы новую сессию.
 */
export function OtpForm({ next }: OtpFormProps) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  // Адрес из localStorage подставляем в useEffect, а не при отрисовке: в браузере
  // хранилище доступно не сразу, и разметка сервера с разметкой клиента разошлась бы.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PENDING_EMAIL_KEY);

      if (stored) {
        setEmail((current) => current || stored);
      }
    } catch {
      // Приватный режим или запрет хранилища: поле просто останется пустым.
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPending) {
      return;
    }

    const trimmedEmail = email.trim();
    const token = code.trim();

    if (trimmedEmail.length === 0 || token.length === 0) {
      setError("Введите email и код из письма.");
      return;
    }

    setError(null);
    setIsPending(true);

    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token,
        type: "signup",
      });

      if (verifyError) {
        console.warn("Подтверждение кодом не удалось:", verifyError.message);

        setError(CODE_ERROR_MESSAGE);
        setIsPending(false);

        return;
      }
    } catch {
      // createClient() бросает исключение, если не заданы переменные окружения,
      // verifyOtp — если пропала сеть. Пользователю показываем одно и то же.
      console.warn(
        "Не удалось подтвердить код: недоступны сеть или настройки Supabase",
      );

      setError(
        "Не удалось связаться с сервером. Проверьте интернет и повторите.",
      );
      setIsPending(false);

      return;
    }

    // Сессию в cookies записал клиент Supabase — перезагружаем страницу целиком,
    // чтобы серверные компоненты увидели вход.
    window.location.replace(next);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label
          htmlFor="otp-email"
          className="block text-sm font-semibold text-slate-200"
        >
          Email, указанный при регистрации
        </label>
        <input
          id="otp-email"
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
          htmlFor="otp-code"
          className="block text-sm font-semibold text-slate-200"
        >
          Код из письма
        </label>
        <input
          id="otp-code"
          name="token"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          pattern="[0-9]{6}"
          required
          // Держим в поле только цифры: код всегда шестизначный, а лишние символы
          // появляются при копировании из письма вместе с пробелами.
          value={code}
          onChange={(event) =>
            setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
          }
          placeholder="123456"
          className={inputClassName}
        />
        <p className="mt-2 text-xs text-slate-500">Шесть цифр из письма</p>
      </div>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          <span aria-hidden>⚠️</span>
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-9 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Проверяем…" : "Подтвердить код"}
        {isPending ? null : <span aria-hidden>→</span>}
      </button>
    </form>
  );
}
