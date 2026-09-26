import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import {
  USER_HEADER,
  encodeRequestUser,
  type RequestUser,
} from "@/lib/supabase/user-headers";
import { isAuthPath, resolveAfterAuthPath } from "@/lib/auth-redirect";

/**
 * Страницы, где нужен авторизованный пользователь.
 * Уроки (/course/*) тоже защищены: без входа курс не открыть.
 */
const PROTECTED_PATH_PREFIXES = ["/dashboard", "/course"]; // + "/constructor", когда появится

/** Страница, куда отправляем неподтверждённых пользователей. */
const VERIFY_EMAIL_PATH = "/auth/verify-email";

/**
 * Страницы /auth/*, которые открыты и авторизованным пользователям.
 *
 * /auth/verify-email нужен тем, кто ещё не подтвердил адрес (иначе получилась бы
 * петля: middleware возвращал бы в кабинет, а кабинет — сюда). /auth/confirm —
 * ссылка из письма: её должен уметь открыть и человек, у которого уже есть сессия,
 * иначе токен не будет использован и адрес останется неподтверждённым.
 */
const AUTH_PAGES_FOR_SIGNED_IN = [VERIFY_EMAIL_PATH, "/auth/confirm"];

/**
 * Подтверждён ли адрес электронной почты.
 *
 * Supabase заполняет email_confirmed_at, когда человек перешёл по ссылке из письма;
 * confirmed_at — старое поле, оно ещё встречается у аккаунтов, созданных раньше.
 * Если в проекте подтверждение email выключено, поле заполняется сразу при
 * регистрации, и проверка ничего не меняет.
 */
function isEmailConfirmed(user: User): boolean {
  return Boolean(user.email_confirmed_at ?? user.confirmed_at);
}

/** Cookie, которую Supabase попросил записать в ответ. */
type PendingCookie = {
  name: string;
  value: string;
  options?: CookieOptions;
};

/**
 * Обновляет сессию пользователя и решает, что с запросом делать дальше.
 *
 * Что происходит по шагам:
 * 1. берём cookies из входящего запроса;
 * 2. создаём Supabase-клиент, который умеет их читать и перезаписывать;
 * 3. ОДИН раз вызываем getUser(): если access-токен истёк, Supabase обменяет
 *    refresh-токен на новый и обновлённые cookies попадут в этот же ответ;
 * 4. гостя на защищённой странице отправляем на /auth/login?next=<куда он шёл>,
 *    а авторизованного на /auth/* — на тот же next (обычно это урок) или
 *    в /dashboard; проверка живёт в одном месте;
 * 5. авторизованному подкладываем его данные в заголовок USER_HEADER, чтобы
 *    страницы не вызывали getUser() второй раз (см. user-headers.ts);
 * 6. возвращаем NextResponse, который нужно вернуть из middleware.ts в корне.
 *
 * Пример будущего middleware.ts в корне проекта:
 *
 *   import { type NextRequest } from "next/server";
 *   import { updateSession } from "@/lib/supabase/middleware";
 *
 *   export async function middleware(request: NextRequest) {
 *     return await updateSession(request);
 *   }
 *
 *   export const config = {
 *     matcher: ["/dashboard/:path*", "/auth/:path*"],
 *   };
 */
export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Не заданы NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY. Добавьте их в .env.local",
    );
  }

  // Cookies и служебные заголовки, которые попросит записать Supabase.
  // Ответ собираем один раз — в конце, когда уже знаем пользователя.
  const cookiesToSet: PendingCookie[] = [];
  const headersToSet = new Headers();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies, headers) {
        for (const cookie of cookies) {
          // Обновлённые cookies должны попасть не только в ответ, но и в рендер
          // этого же запроса: иначе страница увидит старый access-токен.
          request.cookies.set(cookie.name, cookie.value);
          cookiesToSet.push(cookie);
        }

        // Заголовки кеширования от Supabase: ответ с токенами нельзя
        // кэшировать на CDN/прокси, иначе чужие сессии могут «слипнуться».
        for (const [key, value] of Object.entries(headers)) {
          headersToSet.set(key, value);
        }
      },
    },
  });

  // ВАЖНО: не удаляйте этот вызов — именно он продлевает сессию.
  // Он же — единственная проверка пользователя: страницы берут пользователя из
  // заголовка USER_HEADER, а не вызывают getUser() повторно.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  /** Переносит в ответ обновлённые cookies и заголовки Supabase. */
  const withSessionData = (response: NextResponse) => {
    for (const { name, value, options } of cookiesToSet) {
      response.cookies.set(name, value, options);
    }

    for (const [key, value] of headersToSet) {
      response.headers.set(key, value);
    }

    return response;
  };

  // Гость на защищённой странице — сразу на вход. Проверка ровно в одном месте:
  // страницам не нужно повторять её ещё раз.
  const isProtectedPage = PROTECTED_PATH_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (!user && isProtectedPage) {
    // Запоминаем, куда человек шёл: после входа вернём его на этот адрес
    // (обычно это урок), а не в личный кабинет. searchParams.set сам кодирует
    // значение, поэтому в адресе получается next=%2Fcourse%2Flesson-1.
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);

    return withSessionData(NextResponse.redirect(loginUrl));
  }

  // Адрес не подтверждён — закрываем доступ к урокам и кабинету. Без этой проверки
  // подтверждение по ссылке остаётся формальностью: человек с неподтверждённой
  // почтой всё равно попадает в учебный и платный контент.
  if (user && isProtectedPage && !isEmailConfirmed(user)) {
    const verifyUrl = new URL(VERIFY_EMAIL_PATH, request.url);
    verifyUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);

    return withSessionData(NextResponse.redirect(verifyUrl));
  }

  // Авторизованному человеку форма входа не нужна: если он открыл /auth/*,
  // отправляем его на next (обычно это урок, с которого его увели гостем),
  // а если next нет или он ведёт на /auth/* — в личный кабинет.
  // Так работает возврат после входа по прямой ссылке и не возникает петель.
  //
  // Исключение — /auth/verify-email и /auth/confirm: туда приходят и
  // неподтверждённые пользователи, и те, кто только что перешёл по ссылке из
  // письма. Если уводить их отсюда, получится петля (middleware → кабинет →
  // middleware), а токен из письма останется неиспользованным.
  if (
    user &&
    isAuthPath(pathname) &&
    !AUTH_PAGES_FOR_SIGNED_IN.includes(pathname)
  ) {
    const afterAuth = resolveAfterAuthPath(
      request.nextUrl.searchParams.get("next"),
    );

    return withSessionData(
      NextResponse.redirect(new URL(afterAuth, request.url)),
    );
  }

  // Заголовки копируем уже после работы Supabase-клиента: в них лежат
  // обновлённые cookies (auth-js пишет их через request.cookies).
  const requestHeaders = new Headers(request.headers);

  // Заголовок с пользователем подставляем сами и всегда чистим пришедший
  // снаружи: иначе клиент мог бы подделать его и выдать себя за другого.
  requestHeaders.delete(USER_HEADER);

  if (user) {
    const identity: RequestUser = {
      id: user.id,
      email: user.email ?? null,
      name:
        typeof user.user_metadata?.name === "string"
          ? user.user_metadata.name
          : null,
    };

    requestHeaders.set(USER_HEADER, encodeRequestUser(identity));
  }

  return withSessionData(
    NextResponse.next({ request: { headers: requestHeaders } }),
  );
}
