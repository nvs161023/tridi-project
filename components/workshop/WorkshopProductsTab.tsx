"use client";

import { ProductsIcon } from "@/components/workshop/WorkshopIcons";

/**
 * Вкладка «Товары».
 *
 * Это каркас каталога: таблица `workshop_products` в базе уже есть, но чтение
 * товаров, карточки и форма добавления появятся на следующих шагах. Пока
 * вкладка честно показывает пустое состояние, а кнопка добавления сообщает,
 * что форма ещё в разработке.
 */
export function WorkshopProductsTab() {
  return (
    <section
      aria-labelledby="workshop-products-title"
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7"
    >
      <p className="text-xs font-semibold tracking-[0.16em] text-blue-300 uppercase">
        Каталог изделий
      </p>
      <h2
        id="workshop-products-title"
        className="mt-2 text-xl font-extrabold tracking-tight text-white"
      >
        Товары
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
        Готовые изделия с ценой и составом: добавьте товар один раз и
        подставляйте его в заказы.
      </p>

      <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-[#0a0a0a] px-5 py-12 text-center sm:py-16">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-blue-300 shadow-[0_18px_60px_-28px_rgba(59,130,246,0.7)]">
          <ProductsIcon className="h-8 w-8" />
        </span>
        <h3 className="mt-5 text-lg font-bold tracking-tight text-white">
          Каталог пока пуст
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
          У вас пока нет товаров. Добавьте первый товар, чтобы использовать его
          в заказах
        </p>
        <button
          type="button"
          onClick={() => window.alert("В разработке")}
          className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
        >
          <span aria-hidden className="text-lg leading-none">
            +
          </span>
          Добавить товар
        </button>
      </div>
    </section>
  );
}
