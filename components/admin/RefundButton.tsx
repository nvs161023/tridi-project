"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Ответ `/api/admin/refund` в том виде, в каком его читает кнопка. */
type RefundResponse = {
  ok?: boolean;
  error?: string;
  progress?: {
    paidLessons: number;
    moduleTests: number;
  };
};

/**
 * Кнопка «Оформить возврат» в `/admin/purchases`.
 *
 * Возврат — денежная операция, поэтому сначала вопрос в `window.confirm`: доступ
 * закрывается сразу, а деньги администратор возвращает в кабинете Robokassa
 * вручную. Дальше — POST в `/api/admin/refund`; текст отказа приходит с сервера
 * (403 с формулировкой оферты), кнопка его только показывает.
 *
 * После успеха страница обновляется (`router.refresh()`): серверный компонент
 * перечитывает покупки и рисует строку уже закрытой.
 */
export function RefundButton({
  purchaseId,
  courseLabel,
  amountLabel,
}: {
  purchaseId: string;
  courseLabel: string;
  amountLabel: string;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressNote, setProgressNote] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function handleClick() {
    if (isPending) {
      return;
    }

    const confirmed = window.confirm(
      `Оформить возврат: ${courseLabel}, ${amountLabel}?\n\n` +
        "Доступ закроется сразу и восстановить его будет нельзя. " +
        "Деньги нужно вернуть в кабинете Robokassa.",
    );

    if (!confirmed) {
      return;
    }

    setIsPending(true);
    setError(null);
    setProgressNote(null);
    setDone(null);

    try {
      const response = await fetch("/api/admin/refund", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purchaseId }),
      });

      const payload = (await response.json().catch(() => null)) as
        | RefundResponse
        | null;

      if (!response.ok || !payload?.ok) {
        setError(
          payload?.error ?? "Не удалось оформить возврат. Попробуйте ещё раз.",
        );

        if (payload?.progress) {
          setProgressNote(
            `Отмечено платных уроков: ${payload.progress.paidLessons}, ` +
              `тестов модулей: ${payload.progress.moduleTests}.`,
          );
        }

        return;
      }

      setDone("Возврат оформлен, доступ закрыт. Верните деньги в Robokassa.");
      router.refresh();
    } catch {
      setError("Нет связи с сервером. Попробуйте ещё раз.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="min-w-[150px]">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending || done !== null}
        aria-busy={isPending}
        className="inline-flex min-h-9 items-center justify-center rounded-full border border-red-400/40 bg-red-500/10 px-4 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Закрываем…" : "Оформить возврат"}
      </button>

      {error ? (
        <div role="alert" className="mt-2 text-xs leading-relaxed text-red-300">
          <p>{error}</p>
          {progressNote ? (
            <p className="mt-1 text-red-200/80">{progressNote}</p>
          ) : null}
        </div>
      ) : null}

      {done ? (
        <p
          role="status"
          className="mt-2 text-xs leading-relaxed text-emerald-300"
        >
          {done}
        </p>
      ) : null}
    </div>
  );
}
