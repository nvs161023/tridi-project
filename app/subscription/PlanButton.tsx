"use client";

type PlanButtonProps = {
  /** Текст на кнопке. */
  label: string;
  /** Что показать в заглушке. По умолчанию — «Скоро появится». */
  message?: string;
  /** Оформление: синее для Maker, золотое для Pro. */
  variant?: "blue" | "gold";
};

const blueClassName =
  "inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-8 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

const goldClassName =
  "inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-8 text-lg font-semibold text-slate-950 shadow-lg shadow-amber-500/25 transition-colors hover:from-amber-300 hover:to-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

/**
 * Кнопка оформления тарифа.
 *
 * Пока показывает заглушку: оплата ещё не подключена (ЮKassa в процессе).
 * Когда появится интеграция, здесь будет вызов Server Action, который создаёт
 * платёж и возвращает ссылку на оплату — тогда клиентский компонент нужен
 * ровно так же, просто вместо alert(...) будет переход на страницу оплаты.
 */
export function PlanButton({
  label,
  message = "Скоро появится",
  variant = "blue",
}: PlanButtonProps) {
  return (
    <button
      type="button"
      onClick={() => window.alert(message)}
      className={variant === "gold" ? goldClassName : blueClassName}
    >
      {label}
      <span aria-hidden>→</span>
    </button>
  );
}
