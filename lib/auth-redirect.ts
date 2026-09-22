/**
 * Правила возврата пользователя на страницу, с которой его отправили на вход.
 *
 * Зачем это нужно: гость открывает /course/lesson-3, middleware уводит его на
 * /auth/login?next=/course/lesson-3, и после входа человек должен оказаться в
 * уроке, а не в личном кабинете.
 *
 * Параметр next приходит из адресной строки, то есть его может подставить кто
 * угодно. Поэтому принимать его можно только с проверкой — иначе получится
 * «открытый редирект»: ссылка на наш сайт выбрасывает человека на чужой.
 *
 * Модуль общий для middleware (Edge) и Server Actions, чтобы правило проверки
 * жило ровно в одном месте.
 */

/** Куда идём, если возвращаться некуда. */
export const DEFAULT_AFTER_AUTH_PATH = "/dashboard";

/** Это страница входа или регистрации? */
export function isAuthPath(pathname: string): boolean {
  return pathname === "/auth" || pathname.startsWith("/auth/");
}

/**
 * Проверяет путь из параметра next и возвращает его же, либо null — если путь
 * небезопасен:
 *  - «https://evil.com» — внешний адрес;
 *  - «//evil.com» — адрес без протокола, но тоже внешний;
 *  - «/\evil.com» — браузеры превращают «\» в «/» и получается тот же «//».
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }

  return value;
}

/**
 * Куда перейти после успешного входа или регистрации: безопасный next
 * или личный кабинет.
 *
 * Пути внутри /auth/* не принимаем: вход, который ведёт на страницу входа,
 * после срабатывания middleware зациклился бы.
 */
export function resolveAfterAuthPath(value: string | null | undefined): string {
  const next = safeNextPath(value);

  if (!next || isAuthPath(next)) {
    return DEFAULT_AFTER_AUTH_PATH;
  }

  return next;
}

/**
 * Ссылка на страницу входа или регистрации с сохранением возврата:
 * authHref("/auth/login", "/course/lesson-1") → "/auth/login?next=%2Fcourse%2Flesson-1".
 */
export function authHref(pathname: string, next: string | null): string {
  return next ? `${pathname}?next=${encodeURIComponent(next)}` : pathname;
}
