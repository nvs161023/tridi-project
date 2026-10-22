"use client";

import { useActionState } from "react";

import { createPromoCodes } from "@/app/actions/promo-admin";
import { emptyPromoAdminFormState } from "@/app/actions/promo-state";
import {
  PROMO_COURSE_IDS,
  PROMO_COURSE_LABELS,
  PROMO_MAX_BATCH,
} from "@/lib/promo-codes";

const fieldClassName =
  "mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40";

const labelClassName = "block text-xs font-semibold text-slate-300";

/**
 * Выпуск партии промокодов.
 *
 * Клиентский компонент только собирает форму: сами коды генерирует Server
 * Action (createPromoCodes) и возвращает список — его показываем сразу, чтобы
 * админ видел, что партия создана, не открывая базу.
 */
export function PromoCodeForm() {
  const [state, formAction, isPending] = useActionState(
    createPromoCodes,
    emptyPromoAdminFormState,
  );

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-7">
      <h2 className="text-xl font-extrabold tracking-tight text-white">
        Выпустить партию
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">
        Коды создаются на сервере и сразу попадают в таблицу. Выгрузить их для
        Ozon можно кнопкой «Скачать CSV» — в файл попадут только неиспользованные
        коды выбранного курса.
      </p>

      <form action={formAction} className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="promo-course" className={labelClassName}>
            Курс
          </label>
          <select
            id="promo-course"
            name="course"
            defaultValue={PROMO_COURSE_IDS[0]}
            className={fieldClassName}
          >
            {PROMO_COURSE_IDS.map((courseId) => (
              <option key={courseId} value={courseId}>
                {PROMO_COURSE_LABELS[courseId]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="promo-count" className={labelClassName}>
            Сколько кодов
          </label>
          <input
            id="promo-count"
            name="count"
            type="number"
            min={1}
            max={PROMO_MAX_BATCH}
            step={1}
            defaultValue={50}
            required
            className={fieldClassName}
          />
        </div>

        <div>
          <label htmlFor="promo-batch" className={labelClassName}>
            Партия
          </label>
          <input
            id="promo-batch"
            name="batch"
            type="text"
            maxLength={60}
            defaultValue="ozon"
            placeholder="ozon-2026-10"
            className={fieldClassName}
          />
        </div>

        <div>
          <label htmlFor="promo-days" className={labelClassName}>
            Срок действия
          </label>
          <select
            id="promo-days"
            name="days"
            defaultValue="0"
            className={fieldClassName}
          >
            <option value="0">Бессрочно</option>
            <option value="30">30 дней</option>
            <option value="90">90 дней</option>
            <option value="180">180 дней</option>
            <option value="365">1 год</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="promo-note" className={labelClassName}>
            Примечание (необязательно)
          </label>
          <input
            id="promo-note"
            name="note"
            type="text"
            maxLength={200}
            placeholder="Например: осенняя акция Ozon"
            className={fieldClassName}
          />
        </div>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={isPending}
            aria-busy={isPending}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Выпускаем…" : "Выпустить"}
          </button>
        </div>
      </form>

      {state.error ? (
        <p role="alert" className="mt-4 text-sm leading-relaxed text-red-300">
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p role="status" className="mt-4 text-sm leading-relaxed text-emerald-300">
          {state.success}
        </p>
      ) : null}

      {state.created && state.created.length > 0 ? (
        <details className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <summary className="cursor-pointer text-xs font-semibold text-slate-300">
            Показать коды партии ({state.created.length})
          </summary>
          <ul className="mt-3 grid gap-1 font-mono text-xs text-slate-200 sm:grid-cols-2">
            {state.created.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
