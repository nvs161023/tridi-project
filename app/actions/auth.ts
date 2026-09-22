"use server";

import { redirect } from "next/navigation";

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
 * русский, а при успехе сразу уходим в личный кабинет.
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
 * в /dashboard — браузеру не нужно ничего решать про навигацию.
 */
export async function signInAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

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
  redirect("/dashboard");
}

/**
 * Регистрация.
 *
 * Если в проекте Supabase выключено подтверждение email, signUp() сразу отдаёт
 * сессию — тогда уходим в личный кабинет. Если подтверждение включено, сессии
 * нет: показываем просьбу подтвердить адрес и остаёмся на странице.
 */
export async function signUpAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

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

  const supabase = await createClient();

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (error) {
      return { error: translateSignUpError(error.message), values: { name, email } };
    }

    if (!data.session) {
      // Подтверждение email включено: аккаунт создан, но сессии пока нет.
      return {
        info: `Аккаунт создан! Мы отправили письмо на ${email} — подтвердите адрес, и после этого сможете войти.`,
      };
    }
  } catch {
    return { error: NETWORK_ERROR_MESSAGE, values: { name, email } };
  }

  redirect("/dashboard");
}
