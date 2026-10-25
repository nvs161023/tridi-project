"use client";

/**
 * Кнопка печати накладной.
 *
 * Отдельный клиентский компонент нужен только ради `window.print()`: сама
 * накладная — серверная страница и остаётся доступной без JavaScript. В
 * диалоге печати можно выбрать принтер или «Сохранить как PDF».
 */
export function WaybillPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      data-waybill-print
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
    >
      <span aria-hidden>🖨</span>
      Печать
    </button>
  );
}
