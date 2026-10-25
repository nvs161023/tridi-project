"use client";

import { type ChangeEvent, type FormEvent, useState } from "react";
import { createPortal } from "react-dom";

import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";

type ImportPlatform = "ozon" | "wb";

type ImportProductsDialogProps = {
  onClose: () => void;
};

/** Подсказка о колонках, которые ждёт серверный импорт. */
const CSV_COLUMN_HINTS: Record<ImportPlatform, string> = {
  ozon: "Offer ID, Name, Price, Weight",
  wb: "Артикул продавца, Наименование, Цена, Вес с упаковкой",
};

const inputClassName =
  "mt-2 w-full appearance-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white outline-none transition-all duration-200 [color-scheme:dark] focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30 focus:ring-inset";

/**
 * Окно «Импорт товаров».
 *
 * Пока это только UI: файл никуда не отправляется, а «Импортировать» пишет
 * имя файла и площадку в консоль и закрывает окно. Портал, overlay, Escape и
 * блокировка прокрутки повторяют остальные окна Мастерской. У формы и полей
 * `autoComplete="off"`, а у файла нет нативного текстового поля, поэтому
 * белые браузерные подсказки поверх тёмной формы не появляются.
 */
export function ImportProductsDialog({ onClose }: ImportProductsDialogProps) {
  const [platform, setPlatform] = useState<ImportPlatform>("ozon");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useDialogDismiss(onClose);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
    setError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setError("Выберите CSV-файл.");
      return;
    }

    console.log(`Файл выбран: ${selectedFile.name}`);
    console.log(`Платформа: ${platform}`);
    onClose();
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      role="presentation"
      data-import-products-dialog-overlay
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-products-title"
        data-import-products-dialog
        className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl shadow-black/60 sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-blue-400 uppercase">
              Товары
            </p>
            <h2
              id="import-products-title"
              className="mt-3 text-2xl font-extrabold tracking-tight text-white"
            >
              Импорт товаров
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-400">
              Выберите площадку и CSV-файл с товарами. Колонки зависят от
              маркетплейса.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно импорта товаров"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-lg text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          autoComplete="off"
          noValidate
          data-import-products-form
          className="mt-6 space-y-6"
        >
          <div>
            <label
              htmlFor="import-products-platform"
              className="block text-sm font-semibold text-slate-200"
            >
              Площадка
            </label>
            <div className="relative">
              <select
                id="import-products-platform"
                name="platform"
                autoComplete="off"
                autoFocus
                value={platform}
                onChange={(event) =>
                  setPlatform(event.target.value as ImportPlatform)
                }
                aria-describedby="import-products-columns-hint"
                className={`${inputClassName} pr-11`}
              >
                <option value="ozon">Ozon</option>
                <option value="wb">Wildberries</option>
              </select>
              <span
                aria-hidden
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500"
              >
                ▾
              </span>
            </div>
            <p
              id="import-products-columns-hint"
              className="mt-2 text-xs leading-relaxed text-zinc-500"
            >
              Ожидаемые колонки: {CSV_COLUMN_HINTS[platform]}.
            </p>
          </div>

          <div>
            <p className="block text-sm font-semibold text-slate-200">
              Файл CSV
            </p>
            <div className="mt-2 rounded-xl border border-dashed border-white/10 bg-black/30 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p
                    className={`truncate text-sm font-semibold ${
                      selectedFile ? "text-white" : "text-zinc-400"
                    }`}
                  >
                    {selectedFile ? selectedFile.name : "Файл не выбран"}
                  </p>
                  <p
                    id="import-products-file-hint"
                    className="mt-1 text-xs leading-relaxed text-zinc-500"
                  >
                    CSV из личного кабинета Ozon или Wildberries.
                  </p>
                </div>
                <label
                  htmlFor="import-products-file"
                  className="inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-within:ring-2 focus-within:ring-blue-500/60 focus-within:ring-offset-2 focus-within:ring-offset-[#0a0a0a]"
                >
                  {selectedFile ? "Другой файл" : "Выбрать файл"}
                  <input
                    id="import-products-file"
                    name="csvFile"
                    type="file"
                    autoComplete="off"
                    accept=".csv,text/csv"
                    aria-describedby="import-products-file-hint"
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </label>
              </div>
              {selectedFile ? (
                <p role="status" className="mt-3 text-xs text-blue-200">
                  Файл выбран: {selectedFile.name}
                </p>
              ) : null}
            </div>
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-200"
            >
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-6 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
            >
              Импортировать
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
