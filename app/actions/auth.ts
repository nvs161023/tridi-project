"use server";

import { redirect } from "next/navigation";

import { resolveAfterAuthPath } from "@/lib/auth-redirect";
import { buildEmailRedirectUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import type { AuthFormState } from "@/app/actions/auth-state";

/**
 * Вход и регистрация на сервере (Server Actions).
 *
 * Почему это выгоднее клиентского варианта: клиент Supabase в браузере весит
 * около 70 КБ и был нужен только для того, чтобы отправить форму. Здесь всё
 * делает серверный клиент — он же умеет записывать cookies сессии прямо в ответ,
 * поэтому и переход в кабинет происходит без «гонки» между записью cookies и
 * навигацией.
 *
 * Наружу возвращаем только текст для пользователя: ошибки Supabase переводим на
 * русский, а при успехе сразу уходим дальше — на страницу, с которой человека
 * отправил middleware (скрытое поле next), или в личный кабинет.
 */

const NETWORK_ERROR_MESSAGE =
  "Не удалось связаться с сервером. Проверьте интернет и повторите.";

/**
 * Supabase отвечает на английском, и на входе важно не путать причины:
 * «неверный пароль» и «почта не подтверждена» — разные советы пользователю.
 */
function translateSignInError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("email not confirmed")) {
    return "Email ещё не подтверждён. Откройте письмо от нас и перейдите по ссылке из него.";
  }

  if (normalized.includes("rate limit") || normalized.includes("too many requests")) {
    return "Слишком много попыток входа. Подождите минуту и повторите.";
  }

  if (normalized.includes("invalid email")) {
    return "Проверьте, пожалуйста, адрес email — он выглядит некорректно.";
  }

  // invalid login credentials и всё остальное нестандартное — «неверный пароль»
  return "Неверный email или пароль";
}

/**
 * Supabase отвечает на английском. Частые случаи переводим,
 * остальное показываем как есть, чтобы ничего не потерять.
 */
function translateSignUpError(message: string): string {
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

/**
 * Вход по email и паролю.
 *
 * При успехе сервер записывает cookies сессии в ответ и переводит пользователя
 * дальше — на страницу из скрытого поля next (туда, откуда его увели на вход)
 * или в личный кабинет. Браузеру не нужно ничего решать про навигацию.
 */
export async function signInAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  // Куда вернуться после входа: путь проверяем, чтобы не уехать на чужой сайт.
  const afterAuth = resolveAfterAuthPath(String(formData.get("next") ?? ""));

  if (email.length === 0 || password.length === 0) {
    return { error: "Заполните email и пароль.", values: { email } };
  }

  const supabase = await createClient();

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return { error: translateSignInError(error.message), values: { email } };
    }
  } catch {
    // Supabase или сеть недоступны: форма не должна «падать» — покажем текст.
    return { error: NETWORK_ERROR_MESSAGE, values: { email } };
  }

  // ВАЖНО: redirect() бросает служебное исключение Next.js, поэтому вызываем его
  // вне try/catch — иначе catch перехватит переход и он не состоится.
  redirect(afterAuth);
}

/** Адрес страницы «проверьте почту» с сохранением возврата. */
function verifyEmailHref(next: string): string {
  return `/auth/verify-email?next=${encodeURIComponent(next)}`;
}

/**
 * Регистрация.
 *
 * Если в проекте Supabase выключено подтверждение email, signUp() сразу отдаёт
 * сессию — тогда уходим дальше: на страницу из next (например, в урок) или
 * в личный кабинет.
 *
 * Если подтверждение включено, сессии нет: показываем страницу «проверьте почту»
 * с формой повторной отправки. Ссылка из письма ведёт на /auth/confirm (её
 * подставляет Supabase через emailRedirectTo), где токен проверяется и адрес
 * помечается подтверждённым (см. app/auth/confirm/route.ts).
 */
export async function signUpAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  // Куда вернуться после регистрации: путь проверяем, чтобы не уехать на чужой сайт.
  const afterAuth = resolveAfterAuthPath(String(formData.get("next") ?? ""));

  if (name.length === 0) {
    return {
      error: "Укажите имя — мы будем обращаться к вам по нему.",
      values: { name, email },
    };
  }

  if (email.length === 0) {
    return {
      error: "Укажите email — на него придёт письмо для входа.",
      values: { name, email },
    };
  }

  if (password.length < 6) {
    return {
      error: "Пароль должен содержать минимум 6 символов.",
      values: { name, email },
    };
  }

  // Согласие на обработку персональных данных — обязательное условие регистрации.
  // В форме кнопка неактивна без отметки, но полагаться только на браузер нельзя:
  // Server Action — публичный адрес, поэтому проверяем согласие и на сервере.
  if (!formData.get("consent")) {
    return {
      error:
        "Чтобы зарегистрироваться, отметьте согласие на обработку персональных данных.",
      values: { name, email },
    };
  }

  const supabase = await createClient();

  // Куда Supabase вернёт человека после подтверждения: на /auth/confirm, а оттуда
  // он попадёт туда, куда шёл (обычно в урок).
  const emailRedirectTo = await buildEmailRedirectUrl(afterAuth);

  // Флаг вместо redirect() внутри try: redirect бросает служебное исключение, и
  // catch перехватил бы его, отменив переход.
  let needsEmailConfirmation = false;

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo },
    });

    if (error) {
      return { error: translateSignUpError(error.message), values: { name, email } };
    }

    needsEmailConfirmation = !data.session;
  } catch {
    return { error: NETWORK_ERROR_MESSAGE, values: { name, email } };
  }

  if (needsEmailConfirmation) {
    // Подтверждение email включено: аккаунт создан, сессии пока нет. Уводим на
    // страницу «проверьте почту» — там объяснение и повторная отправка письма.
    redirect(verifyEmailHref(afterAuth));
  }

  redirect(afterAuth);
}

/**
 * Повторная отправка письма для подтверждения адреса.
 *
 * Нужна, когда письмо не пришло, улетело в спам или ссылка в нём устарела.
 * Ответ всегда нейтральный: Supabase не сообщает, зарегистрирован ли адрес, и
 * форма не должна превращаться в способ проверять чужие адреса.
 */
export async function resendVerificationAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();

  if (email.length === 0) {
    return { error: "Укажите email, на который регистрировались." };
  }

  const supabase = await createClient();
  const emailRedirectTo = await buildEmailRedirectUrl("/dashboard");

  try {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo },
    });

    if (error) {
      const normalized = error.message.toLowerCase();

      if (
        normalized.includes("rate limit") ||
        normalized.includes("too many requests")
      ) {
        return {
          error: "Письмо уже отправлено. Подождите минуту и попробуйте снова.",
          values: { email },
        };
      }

      console.warn("Повторная отправка письма не удалась:", error.message);

      return {
        error: "Не удалось отправить письмо. Проверьте адрес и попробуйте ещё раз.",
        values: { email },
      };
    }
  } catch {
    return { error: NETWORK_ERROR_MESSAGE, values: { email } };
  }

  return {
    info: `Если адрес ${email} зарегистрирован и ещё не подтверждён, письмо отправлено — проверьте почту и папку «Спам».`,
    values: { email },
  };
}
