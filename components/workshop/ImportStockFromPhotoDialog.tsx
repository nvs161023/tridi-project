"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";
import type { InvoiceItem } from "@/lib/workshop/ocr";

type ImportStockFromPhotoDialogProps = {
  onClose: () => void;
};

/** Количество в таблице: целые без дробной части, дробные — с запятой. */
const quantityFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 3,
});

/** Проверка строки ответа: сервер уже проверяет, но сети на слово не верим. */
function isInvoiceItem(value: unknown): value is InvoiceItem {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.name === "string" &&
    record.name.trim() !== "" &&
    typeof record.unit === "string" &&
    record.unit.trim() !== "" &&
    typeof record.quantity === "number" &&
    Number.isFinite(record.quantity) &&
    record.quantity > 0
  );
}

/** Текст ошибки из JSON роута: `{ error: "..." }`. */
function readErrorMessage(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const { error } = payload as { error?: unknown };

  return typeof error === "string" && error.trim() ? error : null;
}

/**
 * Окно «Импорт из фото».
 *
 * Фото уходит в `/api/workshop/ocr` как multipart-поле `file`; сессию, подписку
 * и формат проверяет сервер. Пока идёт распознавание, окно нельзя закрыть —
 * иначе результат придёт в размонтированный компонент. Успех показывается
 * таблицей «Материал / Количество / Ед. изм.», пустой ответ и ошибка — красной
 * плашкой. В базу ничего не пишем: сохранение остатков — следующий шаг.
 *
 * Портал, overlay, Escape и блокировка прокрутки повторяют остальные окна
 * Мастерской; фокус после закрытия возвращает вкладка «Склад».
 */
export function ImportStockFromPhotoDialog({
  onClose,
}: ImportStockFromPhotoDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [items, setItems] = useState<InvoiceItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const closeIfIdle = useCallback(() => {
    if (!isRecognizing) {
      onClose();
    }
  }, [isRecognizing, onClose]);

  useDialogDismiss(closeIfIdle);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
    setItems(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isRecognizing) {
      return;
    }

    if (!selectedFile) {
      setError("Выберите фото накладной.");
      return;
    }

    setError(null);
    setItems(null);
    setIsRecognizing(true);

    try {
      const body = new FormData();
      body.append("file", selectedFile);

      const response = await fetch("/api/workshop/ocr", {
        method: "POST",
        body,
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          readErrorMessage(payload) ??
            "Не удалось распознать накладную. Попробуйте ещё раз.",
        );
        return;
      }

      if (!Array.isArray(payload)) {
        setError("Сервер вернул неожиданный ответ. Попробуйте ещё раз.");
        return;
      }

      const recognized = payload.filter(isInvoiceItem);

      if (recognized.length === 0) {
        setError(
          "На фото не удалось найти материалы. Попробуйте другое фото или сфотографируйте накладную ровнее.",
        );
        return;
      }

      if (recognized.length !== payload.length) {
        setError(
          "В ответе сервера есть некорректные строки. Попробуйте ещё раз.",
        );
        return;
      }

      setItems(recognized);
    } catch {
      setError(
        "Не удалось связаться с сервером. Проверьте соединение и попробуйте ещё раз.",
      );
    } finally {
      setIsRecognizing(false);
    }
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      role="presentation"
      data-import-stock-dialog-overlay
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
        aria-labelledby="import-stock-title"
        data-import-stock-dialog
        className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl shadow-black/60 sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-blue-400 uppercase">
              Склад
            </p>
            <h2
              id="import-stock-title"
              className="mt-3 text-2xl font-extrabold tracking-tight text-white"
            >
              Импорт из фото
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-400">
              Загрузите фотографию накладной — модель найдёт материалы,
              количество и единицы измерения.
            </p>
          </div>
          <button
            type="button"
            onClick={closeIfIdle}
            disabled={isRecognizing}
            aria-label="Закрыть окно импорта из фото"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-lg text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          autoComplete="off"
          noValidate
          data-import-stock-form
          className="mt-6 space-y-5"
        >
          <div className="rounded-xl border border-dashed border-white/10 bg-black/30 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p
                  className={`truncate text-sm font-semibold ${
                    selectedFile ? "text-white" : "text-zinc-400"
                  }`}
                >
                  {selectedFile ? selectedFile.name : "Фото не выбрано"}
                </p>
                <p
                  id="import-stock-file-hint"
                  className="mt-1 text-xs leading-relaxed text-zinc-500"
                >
                  JPEG, PNG, WebP или GIF до 10 МБ.
                </p>
              </div>
              <label
                htmlFor="import-stock-file"
                className={`inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-zinc-200 transition-colors focus-within:ring-2 focus-within:ring-blue-500/60 focus-within:ring-offset-2 focus-within:ring-offset-[#0a0a0a] ${
                  isRecognizing
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                {selectedFile ? "Другое фото" : "Выбрать фото"}
                <input
                  id="import-stock-file"
                  name="file"
                  type="file"
                  accept="image/*"
                  autoComplete="off"
                  disabled={isRecognizing}
                  aria-describedby="import-stock-file-hint"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>
            </div>
            {selectedFile ? (
              <p role="status" className="mt-3 text-xs text-blue-200">
                Фото выбрано: {selectedFile.name}
              </p>
            ) : null}
          </div>

          {isRecognizing ? (
            <p
              role="status"
              className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm leading-relaxed text-blue-100"
            >
              Идет распознавание...
            </p>
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

          {items ? (
            <div
              data-import-stock-result
              className="overflow-hidden rounded-2xl border border-white/10 bg-black/30"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
                <p className="text-xs font-bold tracking-wide text-zinc-300 uppercase">
                  Распознанные материалы
                </p>
                <p className="text-xs font-semibold text-zinc-500">
                  Найдено: {items.length}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <caption className="sr-only">
                    Распознанные материалы накладной: название, количество и
                    единица измерения
                  </caption>
                  <thead>
                    <tr className="border-b border-white/10 text-left text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">
                      <th scope="col" className="px-4 py-3">
                        Материал
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Количество
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Ед. изм.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr
                        key={`${index}-${item.name}`}
                        className="border-b border-white/5 last:border-0"
                      >
                        <th
                          scope="row"
                          className="px-4 py-3 text-left text-sm font-semibold text-white"
                        >
                          {item.name}
                        </th>
                        <td className="px-4 py-3 text-sm tabular-nums text-zinc-200">
                          {quantityFormatter.format(item.quantity)}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-400">
                          {item.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-white/5 px-4 py-3 text-xs leading-relaxed text-zinc-500">
                В склад пока не сохраняем: проверьте таблицу и закройте окно.
              </p>
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeIfIdle}
              disabled={isRecognizing}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-6 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isRecognizing}
              aria-busy={isRecognizing}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRecognizing ? "Идет распознавание..." : "Распознать"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
