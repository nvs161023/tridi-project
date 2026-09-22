import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

/**
 * Стиль кнопки в шапке: синий акцент, компактный размер, скруглённые углы.
 * Один и тот же класс для «Войти» и «Личный кабинет», чтобы кнопка не
 * «прыгала» при смене состояния.
 */
const authButtonClassName =
  "inline-flex shrink-0 items-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

/**
 * Шапка сайта с «умной» кнопкой авторизации.
 *
 * Это серверный компонент: он читает cookies текущего запроса через
 * Supabase-клиент (@/lib/supabase/server) и знает, кто открыл страницу, ещё до
 * отправки HTML. Поэтому нужная кнопка уже стоит в готовой разметке — браузеру
 * не нужно досчитывать её на клиенте и нет мигания «Войти» → «Личный кабинет».
 *
 * Сессию читаем через getSession(): он только разбирает cookie и НЕ ходит в
 * сеть, поэтому главная отрисовывается сразу. Для выбора кнопки этого
 * достаточно: доступ в кабинет всё равно проверяет middleware на защищённых
 * путях, и там используется проверенный getUser().
 *
 * Нюанс: если access-токен успел истечь, getSession() сам обменяет
 * refresh-токен — тогда один сетевой запрос всё же случится. Но у getUser() он
 * был бы при каждом заходе, так что это всё равно выигрыш. Сохранить обновлённые
 * cookies Server Component не может — этим занимается middleware, когда
 * пользователь возвращается в кабинет.
 *
 * Из сессии мы только проверяем наличие пользователя и не читаем его поля:
 * на сервере auth-js намеренно предупреждает, что данные из getSession() не
 * проверены на стороне Supabase (для подписи имени в шапке это было бы
 * небезопасно, для выбора кнопки — совершенно нормально).
 *
 * Важно: cookies() делает страницу, где стоит шапка, динамической — Next.js
 * отдаёт её на каждый запрос, без статической генерации. Для страницы с
 * персональной кнопкой это ожидаемая цена.
 */
export async function Header() {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isAuthorized = Boolean(session?.user);

  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2 text-base font-bold">
          <span aria-hidden>🖨️</span>
          <span>3D-печать с нуля</span>
        </Link>

        <div className="flex items-center gap-4 sm:gap-8">
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-300 sm:flex">
            <a className="transition-colors hover:text-blue-400" href="#benefits">
              Что вы получите
            </a>
            <a className="transition-colors hover:text-blue-400" href="#program">
              Программа
            </a>
            <a className="transition-colors hover:text-blue-400" href="#about">
              О проекте
            </a>
          </nav>

          {isAuthorized ? (
            <Link href="/dashboard" className={authButtonClassName}>
              Личный кабинет
            </Link>
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
