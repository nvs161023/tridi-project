/**
 * Маркер успешной регистрации и правило «Supabase создал новый аккаунт».
 *
 * Зачем маркер в адресе: регистрацию выполняет Server Action (app/actions/auth.ts),
 * а цель в пиксель VK Рекламы (`reachGoal`) можно отправить только в браузере.
 * Поэтому действие не отправляет событие само, а добавляет `signup=1` к адресу
 * перехода; компонент аналитики (components/analytics/Analytics.tsx) видит маркер,
 * отправляет цель и убирает параметр из адреса. Так событие не зависит от кнопки,
 * не отправляется дважды и не требует второго экземпляра пикселя.
 *
 * Почему проверка `identities` вынесена в отдельную функцию: при включённой
 * защите от перебора адресов Supabase не отвечает ошибкой на уже
 * зарегистрированный email, а возвращает пользователя с пустым массивом
 * `identities`. Считать такую попытку регистрацией нельзя — иначе повторная
 * отправка формы на существующий адрес давала бы ложные цели.
 *
 * Модуль без "use client" и без побочных эффектов: его импортируют и серверный
 * Server Action, и браузерный компонент аналитики.
 */

/** Параметр адреса, которым signUpAction помечает успешную регистрацию. */
export const SIGNUP_MARKER_PARAM = "signup";

/** Значение параметра: ровно `signup=1`. */
export const SIGNUP_MARKER_VALUE = "1";

/**
 * Создал ли Supabase новый аккаунт.
 *
 * Принимает `data.user` из ответа `supabase.auth.signUp` без ошибки. Пустой или
 * отсутствующий `identities` означает, что аккаунт не создан (адрес уже занят) —
 * регистрацией это не считаем.
 */
export function isNewAccountSignUp(
  user: { identities?: unknown[] | null } | null | undefined,
): boolean {
  return Boolean(user && Array.isArray(user.identities) && user.identities.length > 0);
}

/**
 * Добавляет маркер к адресу перехода: `/dashboard` → `/dashboard?signup=1`,
 * `/auth/verify-email?next=%2Fdashboard` → `…&signup=1`. Хвост `#…` сохраняется.
 * Если аккаунт не новый, адрес возвращается без изменений.
 */
export function withSignupMarker(href: string, isNewAccount: boolean): string {
  if (!isNewAccount) {
    return href;
  }

  const hashIndex = href.indexOf("#");
  const path = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : href.slice(hashIndex);
  const separator = path.includes("?") ? "&" : "?";

  return `${path}${separator}${SIGNUP_MARKER_PARAM}=${SIGNUP_MARKER_VALUE}${hash}`;
}

/** Есть ли в query-строке маркер успешной регистрации (`?signup=1`). */
export function hasSignupMarker(search: string): boolean {
  if (!search) {
    return false;
  }

  return new URLSearchParams(search).get(SIGNUP_MARKER_PARAM) === SIGNUP_MARKER_VALUE;
}

/**
 * Возвращает query-строку без маркера регистрации: `?signup=1&next=%2Fdashboard`
 * → `?next=%2Fdashboard`, а `?signup=1` → пустая строка.
 */
export function withoutSignupMarker(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(SIGNUP_MARKER_PARAM);

  const rest = params.toString();

  return rest ? `?${rest}` : "";
}
