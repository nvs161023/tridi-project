"use client";

import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { importProductsFromCsv } from "@/app/actions/products";
import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";
import type { ImportProductsResult } from "@/lib/workshop/products";

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
 * Файл читается в браузере и уходит в Server Action `importProductsFromCsv`.
 * Пока запрос идёт, кнопка заблокирована и показывает «Импорт...», а закрыть
 * окно нельзя — иначе импорт продолжится без видимого результата. Успешный
 * импорт показывает счётчики и ошибки отдельных строк, обновляет каталог через
 * `router.refresh()` и закрывается сам через три секунды; кнопка «Готово»
 * закрывает окно сразу. Сервер возвращает `{ imported, updated, errors }`:
 * если не записана ни одна карточка, первая ошибка становится красной плашкой,
 * остальные — списком под ней.
 *
 * Портал, overlay, Escape и блокировка прокрутки повторяют остальные окна
 * Мастерской. У формы и полей `autoComplete="off"`, а у файла нет нативного
 * текстового поля, поэтому белые браузерные подсказки поверх тёмной формы не
 * появляются.
 */
export function ImportProductsDialog({ onClose }: ImportProductsDialogProps) {
  const router = useRouter();
  const [platform, setPlatform] = useState<ImportPlatform>("ozon");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ImportProductsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const successReport =
    result && result.imported + result.updated > 0 ? result : null;

  const closeIfIdle = useCallback(() => {
    if (!isSubmitting) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  useDialogDismiss(closeIfIdle);

  useEffect(() => {
    if (!successReport) {
      return;
    }

    router.refresh();

    const timer = window.setTimeout(onClose, 3000);

    return () => window.clearTimeout(timer);
  }, [onClose, router, successReport]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
    setResult(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!selectedFile) {
      setError("Выберите CSV-файл.");
      return;
    }

    setError(null);
    setResult(null);
    setIsSubmitting(true);

    try {
      const csvString = await selectedFile.text();

      if (!csvString.trim()) {
        setError("CSV-файл пуст. Выберите файл с товарами.");
        return;
      }

      const importResult = await importProductsFromCsv(csvString, platform);

      if (importResult.imported + importResult.updated === 0) {
        setError(
          importResult.errors[0] ?? "Импорт не добавил ни одного товара.",
        );
        setResult(
          importResult.errors.length > 1
            ? {
                imported: 0,
                updated: 0,
                errors: importResult.errors.slice(1),
              }
            : null,
        );
        return;
      }

      setResult(importResult);
    } catch {
      setError(
        "Не удалось импортировать товары. Проверьте соединение и попробуйте ещё раз.",
      );
    } finally {
      setIsSubmitting(false);
    }
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
          closeIfIdle();
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
            onClick={closeIfIdle}
            disabled={isSubmitting}
            aria-label="Закрыть окно импорта товаров"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-lg text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-60"
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
                disabled={isSubmitting}
                value={platform}
                onChange={(event) =>
                  setPlatform(event.target.value as ImportPlatform)
                }
                aria-describedby="import-products-columns-hint"
                className={`${inputClassName} pr-11 disabled:cursor-not-allowed disabled:opacity-60`}
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
                  className={`inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-zinc-200 transition-colors focus-within:ring-2 focus-within:ring-blue-500/60 focus-within:ring-offset-2 focus-within:ring-offset-[#0a0a0a] ${
                    isSubmitting
                      ? "cursor-not-allowed opacity-60"
                      : "cursor-pointer hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
                  }`}
                >
                  {selectedFile ? "Другой файл" : "Выбрать файл"}
                  <input
                    id="import-products-file"
                    name="csvFile"
                    type="file"
                    autoComplete="off"
                    accept=".csv,text/csv"
                    disabled={isSubmitting}
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

          {successReport ? (
            <div
              role="status"
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3"
            >
              <p className="text-sm font-bold text-emerald-100">
                Импортировано: {successReport.imported}, Обновлено:{" "}
                {successReport.updated}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-200/80">
                Каталог обновлён. Окно закроется через 3 секунды.
              </p>
            </div>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-200"
            >
              <span aria-hidden>⚠️ </span>
              {error}
            </p>
          ) : null}

          {result && result.errors.length > 0 ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <p className="text-xs font-bold tracking-wide text-amber-100 uppercase">
                Ошибки в строках
              </p>
              <ul className="mt-2 space-y-1 text-xs leading-relaxed text-amber-100/90">
                {result.errors.map((message, index) => (
                  <li key={`${index}-${message}`}>{message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
            {successReport ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
              >
                Готово
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={closeIfIdle}
                  disabled={isSubmitting}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-6 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Импорт..." : "Импортировать"}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
