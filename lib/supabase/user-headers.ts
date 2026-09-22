/**
 * Передача авторизованного пользователя из middleware в Server Components.
 *
 * Зачем это нужно: middleware всё равно вызывает сетевой getUser() на каждом
 * защищённом запросе — он продлевает сессию и заодно проверяет пользователя.
 * Если страница вызовет getUser() ещё раз, это лишний круг до Supabase
 * (десятки–сотни миллисекунд) на каждый переход. Поэтому middleware кладёт
 * данные пользователя в заголовок запроса, а страница читает их оттуда.
 *
 * Безопасность: middleware всегда УДАЛЯЕТ этот заголовок из входящего запроса и
 * подставляет своё значение, иначе клиент мог бы подделать его и выдать себя за
 * другого пользователя. Поэтому читать заголовок можно только на маршрутах,
 * которые попадают в matcher middleware (см. middleware.ts).
 *
 * Никаких секретов тут нет: id, email и имя и так известны браузеру
 * пользователя. Токены сессии в заголовок не попадают.
 */

/** Данные пользователя, известные middleware после проверки сессии. */
export type RequestUser = {
  id: string;
  email: string | null;
  name: string | null;
};

/** Заголовок, через который передаются данные пользователя. */
export const USER_HEADER = "x-supabase-user";

/**
 * Значения HTTP-заголовков должны быть ASCII, а имя пользователя может быть на
 * кириллице — поэтому кодируем по URL.
 */
export function encodeRequestUser(user: RequestUser): string {
  return encodeURIComponent(JSON.stringify(user));
}

/**
 * Читает пользователя из заголовка запроса.
 *
 * Возвращает null, если заголовка нет или он испорчен — это значит, что запрос
 * прошёл мимо middleware, и страница должна сама отправить гостя на вход.
 */
export function decodeRequestUser(rawValue: string | null | undefined): RequestUser | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(rawValue)) as Partial<RequestUser>;

    if (typeof parsed.id !== "string" || parsed.id.length === 0) {
      return null;
    }

    return {
      id: parsed.id,
      email: typeof parsed.email === "string" ? parsed.email : null,
      name: typeof parsed.name === "string" ? parsed.name : null,
    };
  } catch {
    return null;
  }
}
