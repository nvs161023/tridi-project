import { ButtonLink } from "@/components/ui";

/**
 * Плашка демо-режима в Мастерской.
 *
 * Появляется только у демо-аккаунта. Задача — сказать правду до первого клика:
 * данные здесь настоящие (таблицы те же), но это пример, и сохранять их нельзя.
 * Кнопка «Сохранить» в любой вкладке вернёт тот же текст из Server Action,
 * поэтому человек не решит, что интерфейс сломался.
 */
export function WorkshopDemoNotice() {
  return (
    <section
      aria-labelledby="workshop-demo-title"
      className="mb-6 rounded-2xl border border-amber-400/25 bg-amber-500/[0.07] p-4 backdrop-blur-md sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-amber-200 uppercase">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-300" />
            Демо-доступ
          </p>
          <h2
            id="workshop-demo-title"
            className="mt-3 text-lg font-extrabold tracking-tight text-white sm:text-xl"
          >
            Смотрите, но не меняйте
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-amber-100/90">
            Это настоящая Мастерская с примером данных: заказы, склад, принтеры и
            клиенты. Сохранять изменения в демо нельзя — кнопки вернут это же
            объяснение. Оформите подписку Pro, чтобы вести свои заказы.
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          <ButtonLink href="/pricing" size="sm" className="min-h-10 justify-center">
            Оформить Pro
          </ButtonLink>
          <form action="/logout" method="post">
            <button
              type="submit"
              className="inline-flex min-h-10 w-full items-center justify-center rounded-full border border-white/15 px-4 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303] sm:w-auto"
            >
              Выйти из демо
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
