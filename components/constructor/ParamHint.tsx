"use client";

import { useId, useState } from "react";

type ParamHintProps = {
  /** Подпись параметра: из неё собирается имя кнопки для скринридера. */
  label: string;
  /** Текст подсказки: абзац, который раньше стоял под полем постоянно. */
  text: string;
  /**
   * Идентификатор текста. По нему поле ссылается на подсказку через
   * `aria-describedby`, поэтому описание читается и без открытия панели.
   */
  id: string;
};

/**
 * Подсказка параметра за кнопкой «?».
 *
 * Панель конструктора тонула в абзацах: у каждого слайдера стоял текст на три
 * строки, и настройки вазы занимали три экрана, хотя менять в них обычно нужно
 * два числа. Текст не выброшен — он переехал в панель, которая открывается
 * наведением, фокусом с клавиатуры или кликом.
 *
 * Доступность: сам текст всегда лежит в DOM со своим `id`, поэтому
 * `aria-describedby` поля работает и когда панель скрыта (скрыта она визуально —
 * `sr-only`). Кнопка объявляет состояние через `aria-expanded`, а Escape
 * закрывает панель, не уводя фокус.
 */
export function ParamHint({ label, text, id }: ParamHintProps) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const buttonId = `${useId()}-hint-button`;
  const visible = pinned || hovered;

  return (
    <span className="relative inline-flex shrink-0">
      <button
        aria-controls={id}
        aria-expanded={visible}
        aria-label={`Пояснение: ${label}`}
        className="inline-flex size-5 items-center justify-center rounded-full border border-white/20 text-[0.7rem] font-bold leading-none text-slate-400 transition-colors hover:border-white/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        id={buttonId}
        onBlur={() => setPinned(false)}
        onClick={() => setPinned((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setPinned(false);
          }
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        type="button"
      >
        <span aria-hidden>?</span>
      </button>

      {/*
        Панель абсолютная: она не двигает соседние слайдеры, когда открывается.
        Ширина 16rem прижата вправо — панель параметров шириной 22rem, и от
        кнопки у левого края текст иначе вылезал бы за её границу.
      */}
      <span
        className={
          visible
            ? "absolute top-full right-0 z-30 mt-2 block w-60 rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs leading-relaxed text-slate-200 shadow-xl shadow-slate-950/60"
            : "sr-only"
        }
        id={id}
        role="tooltip"
      >
        {text}
      </span>
    </span>
  );
}
