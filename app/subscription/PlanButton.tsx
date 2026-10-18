"use client";

import { initializePayment } from "@/lib/payments";

type PlanButtonProps = {
  /** Текст на кнопке. */
  label: string;
  /** Ключ курса или пакета для платёжного сервиса. */
  courseId: string;
  /** Разовая цена или цена месяца подписки, в рублях. */
  price: number;
  /** Что показать в заглушке. По умолчанию — сообщение с данными платежа. */
  message?: string;
  /** Оформление: синее для курсов и подписки, золотое для пакета. */
  variant?: "blue" | "gold";
  /** Размер: компактный для узких карточек, обычный для широкого блока. */
  size?: "compact" | "default";
};

const baseClassName =
  "inline-flex w-full items-center justify-center gap-2 rounded-full font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

const variantClassName = {
  blue: "bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 focus-visible:ring-blue-400",
  gold: "bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 hover:from-amber-300 hover:to-amber-400 focus-visible:ring-amber-300",
};

const sizeClassName = {
  compact: "min-h-12 px-5 text-sm",
  default: "min-h-14 px-8 text-lg",
};

/**
 * Кнопка оформления тарифа.
 *
 * Пока показывает заглушку: оплата ещё не подключена (следующий шаг —
 * Робокасса). Данные тарифа уже уходят в initializePayment: когда появится
 * Server Action, здесь останется только перейти по ссылке на оплату.
 */
export function PlanButton({
  label,
  courseId,
  price,
  message,
  variant = "blue",
  size = "default",
}: PlanButtonProps) {
  const handleClick = () => {
    const payment = initializePayment({ courseId, price });
    const formattedPrice = new Intl.NumberFormat("ru-RU").format(payment.price);

    window.alert(
      message ??
        `Оплата «${label}» (${payment.courseId}) на ${formattedPrice} ₽ пока недоступна. Скоро здесь будет Робокасса.`,
    );
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`${baseClassName} ${variantClassName[variant]} ${sizeClassName[size]}`}
    >
      {label}
      <span aria-hidden>→</span>
    </button>
  );
}
