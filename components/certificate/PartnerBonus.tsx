/**
 * Бонусы партнёров на странице готового сертификата.
 *
 * Промокод включается переменной NEXT_PUBLIC_ENABLE_PARTNER_PROMO=true. Пока
 * флаг выключен, блок показывает честную заглушку «скоро» — страница не
 * обещает скидку, которой ещё нет. На печать блок не попадает: сертификат
 * должен оставаться документом, а не рекламной листовкой.
 */
export function PartnerBonus() {
  const isEnabled = process.env.NEXT_PUBLIC_ENABLE_PARTNER_PROMO === "true";

  return (
    <aside
      aria-labelledby="partner-bonus-title"
      className="mt-8 rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-400/10 via-slate-900/80 to-slate-900/80 p-5 print:hidden sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-amber-300 uppercase">
            Бонусы от партнеров
          </p>
          <h2
            id="partner-bonus-title"
            className="mt-2 text-lg font-bold tracking-tight text-white"
          >
            Скидка на пластик от «Слойтек»
          </h2>

          {isEnabled ? (
            <>
              <p className="mt-3 text-sm leading-relaxed text-slate-200">
                Ваш промокод на пластик:{" "}
                <span className="select-all rounded-lg border border-amber-400/40 bg-amber-400/10 px-2 py-1 font-mono font-semibold text-amber-200">
                  TRIDI-SLOYTECH
                </span>
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                Назовите промокод при заказе у партнёра — он действует для
                выпускников курса TriDi.
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Партнерская программа скоро.
            </p>
          )}
        </div>

        {isEnabled ? (
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-200">
            <span aria-hidden>🎁</span>
            Подарок выпускнику
          </span>
        ) : null}
      </div>
    </aside>
  );
}
