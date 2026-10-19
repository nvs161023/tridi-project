import Link from "next/link";
import { headers } from "next/headers";

import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/server";
import { USER_HEADER, decodeRequestUser } from "@/lib/supabase/user-headers";

/**
 * Стиль гостевой кнопки в шапке: синий акцент, компактный размер, скруглённые
 * углы.
 */
const authButtonClassName =
  "inline-flex shrink-0 items-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

/** Две буквы email для кружка-аватара: «e2e.audit@…» → «EA». */
function getInitials(email: string | null): string {
  const localPart = email?.split("@")[0] ?? "";
  const parts = localPart.split(/[._-]+/).filter(Boolean);

  if (parts.length > 1) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "ID";
  }

  return localPart.slice(0, 2).toUpperCase() || "ID";
}

/**
 * Шапка сайта с навигацией и данными авторизованного пользователя.
 *
 * Это серверный компонент: он читает cookies текущего запроса через
 * Supabase-клиент (@/lib/supabase/server) и знает, кто открыл страницу, ещё до
 * отправки HTML. Поэтому нужные ссылки уже стоят в готовой разметке — браузеру
 * не нужно досчитывать их на клиенте и нет мигания «Войти» → «Аккаунт».
 *
 * На защищённых страницах middleware уже проверил пользователя и положил его
 * данные в USER_HEADER. Здесь читаем этот заголовок, чтобы не делать второй
 * сетевой getUser(). На публичных страницах заголовка нет — тогда проверяем
 * сессию через getUser(): он валидирует токен на сервере, а не доверяет
 * данным cookie. Email используется только для подписи в шапке; доступ к
 * кабинету и урокам по-прежнему проверяет middleware.
 *
 * Важно: cookies() делает страницу, где стоит шапка, динамической — Next.js
 * отдаёт её на каждый запрос, без статической генерации. Для страницы с
 * персональной шапкой это ожидаемая цена.
 */
export async function Header() {
  const requestUser = decodeRequestUser((await headers()).get(USER_HEADER));
  const supabase = await createClient();

  let isAuthorized = Boolean(requestUser);
  let userEmail = requestUser?.email ?? null;

  if (!isAuthorized) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    isAuthorized = Boolean(user);
    userEmail = user?.email ?? null;
  }

  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/80 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Logo lessonsHref={isAuthorized ? "/dashboard" : "/course/lesson-1"} />

        <div className="flex items-center gap-3 sm:gap-5">
          <nav
            aria-label="Основная навигация"
            className="hidden items-center gap-5 text-sm font-medium text-slate-300 xl:flex xl:gap-7"
          >
            <Link
              className="transition-colors hover:text-blue-400"
              href="/#levels"
            >
              Уровни
            </Link>
            <Link
              className="transition-colors hover:text-blue-400"
              href="/#gallery"
            >
              Галерея
            </Link>
            <Link className="transition-colors hover:text-blue-400" href="/#faq">
              Вопросы
            </Link>
            <Link
              className="transition-colors hover:text-blue-400"
              href="/forum"
            >
              Форум
            </Link>
            <Link
              className="transition-colors hover:text-blue-400"
              href="/subscription"
            >
              Тарифы
            </Link>
            {isAuthorized ? (
              <Link
                className="transition-colors hover:text-blue-400"
                href="/profiles"
              >
                Профили
              </Link>
            ) : null}
          </nav>

          {isAuthorized ? (
            <>
              <Link
                href="/dashboard"
                aria-label={
                  userEmail
                    ? `Личный кабинет: ${userEmail}`
                    : "Личный кабинет"
                }
                className="group flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1.5 pr-2.5 pl-1.5 transition-colors hover:border-blue-400/40 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                <span
                  data-avatar
                  role="img"
                  aria-label="Аватар пользователя"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-xs font-extrabold tracking-wide text-white shadow-inner"
                >
                  {getInitials(userEmail)}
                </span>
                <span className="hidden min-w-0 text-left lg:block">
                  <span className="block text-[10px] font-semibold tracking-[0.14em] text-slate-300 uppercase">
                    Аккаунт
                  </span>
                  <span className="block max-w-36 truncate text-xs font-semibold text-slate-200">
                    {userEmail ?? "Профиль"}
                  </span>
                </span>
              </Link>

              <form action="/logout" method="post">
                <button
                  type="submit"
                  className="inline-flex shrink-0 items-center rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:px-4 sm:text-sm"
                >
                  Выйти
                </button>
              </form>
            </>
          ) : (
            <Link href="/auth/login" className={authButtonClassName}>
              Войти
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
