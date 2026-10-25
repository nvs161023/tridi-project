"use client";

import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { saveImportedFilaments } from "@/app/actions/filaments";
import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";
import { TrashIcon } from "@/components/workshop/WorkshopIcons";
import type { SaveImportedFilamentsResult } from "@/lib/workshop/filaments";
import type { InvoiceItem } from "@/lib/workshop/ocr";

type ImportStockFromPhotoDialogProps = {
  onClose: () => void;
};

/**
 * Строка таблицы в процессе правки.
 *
 * Количество и стоимость хранятся строками: с числом пустое поле сразу стало бы
 * нулём, и «1,5» было бы не набрать. В `InvoiceItem` строки превращаются только
 * перед сохранением.
 */
type EditableInvoiceItem = {
  /** Ключ строки: имя меняется при правке, поэтому ключ от полей не зависит. */
  id: string;
  name: string;
  quantity: string;
  unit: string;
  price: string;
};

/** Подсказки единиц измерения: список открывается, но ввести можно любую. */
const UNIT_SUGGESTIONS = ["г", "кг", "шт"] as const;

/** Поля таблицы в CRM-стиле: тёмный фон, тонкая обводка, синий фокус. */
const cellInputClassName =
  "w-full min-w-0 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors [appearance:textfield] placeholder:text-zinc-500 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30 focus:ring-inset [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

let nextItemId = 0;

/** Уникальный ключ строки: имя редактируется, поэтому ключ не строится из полей. */
function createItemId(): string {
  nextItemId += 1;
  return `import-item-${nextItemId}`;
}

/**
 * Проверка строки ответа: сервер уже проверяет, но сети на слово не верим.
 * Нечитаемая цена не делает строку некорректной — она просто становится null.
 */
function toInvoiceItem(value: unknown): InvoiceItem | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.name !== "string" ||
    record.name.trim() === "" ||
    typeof record.unit !== "string" ||
    record.unit.trim() === "" ||
    typeof record.quantity !== "number" ||
    !Number.isFinite(record.quantity) ||
    record.quantity <= 0
  ) {
    return null;
  }

  const price =
    typeof record.price === "number" &&
    Number.isFinite(record.price) &&
    record.price >= 0
      ? record.price
      : null;

  return {
    name: record.name.trim(),
    quantity: record.quantity,
    unit: record.unit.trim(),
    price,
  };
}

/** Распознанная строка → строка таблицы: числа без разделителей тысяч. */
function toEditableItem(item: InvoiceItem): EditableInvoiceItem {
  return {
    id: createItemId(),
    name: item.name,
    quantity: String(item.quantity),
    unit: item.unit,
    price: item.price === null ? "" : String(item.price),
  };
}

/** Число из поля ввода: запятая допустима, пустое поле — это `null`. */
function readDecimal(value: string): number | null {
  const normalized = value.trim().replace(",", ".");

  if (normalized === "") {
    return null;
  }

  const number = Number(normalized);

  return Number.isFinite(number) ? number : null;
}

/**
 * Стоимость из поля: пустое поле — «цена не распознана» (`null`), мусор или
 * отрицательное число — ошибка (`undefined`).
 */
function readPrice(value: string): number | null | undefined {
  if (value.trim() === "") {
    return null;
  }

  const price = readDecimal(value);

  return price !== null && price >= 0 ? price : undefined;
}

/**
 * Отредактированные строки → массив для Server Action.
 *
 * `null` означает, что хотя бы одна строка не готова: без названия, единицы,
 * положительного количества или с отрицательной стоимостью. Так в действие не
 * уходит заведомо битая позиция, которую сервер всё равно бы отбросил.
 */
function toInvoiceItems(items: EditableInvoiceItem[]): InvoiceItem[] | null {
  const result: InvoiceItem[] = [];

  for (const item of items) {
    const name = item.name.trim();
    const unit = item.unit.trim();
    const quantity = readDecimal(item.quantity);
    const price = readPrice(item.price);

    if (
      !name ||
      !unit ||
      quantity === null ||
      quantity <= 0 ||
      price === undefined
    ) {
      return null;
    }

    result.push({ name, quantity, unit, price });
  }

  return result;
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
 * редактируемой таблицей «Материал / Количество / Ед. изм. / Стоимость (₽)»:
 * название, количество, единицу и стоимость можно исправить, а лишнюю строку —
 * удалить корзиной. Пустое название, нулевое количество или отрицательная
 * стоимость не дают сохранить — под таблицей появляется ошибка. Если цена не
 * распознана, поле остаётся пустым.
 *
 * Кнопка «Сохранить на склад» вызывает Server Action и отправляет именно
 * отредактированный массив: строки таблицы превращаются в `InvoiceItem` перед
 * запросом. Действие создаёт катушки в workshop_filaments. После успеха зелёная
 * плашка показывает число позиций, а через две секунды окно закрывается и
 * router.refresh() обновляет склад. Пока идёт сохранение, окно тоже нельзя
 * закрыть.
 *
 * Портал, overlay, Escape и блокировка прокрутки повторяют остальные окна
 * Мастерской; фокус после закрытия возвращает вкладка «Склад».
 */
export function ImportStockFromPhotoDialog({
  onClose,
}: ImportStockFromPhotoDialogProps) {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [items, setItems] = useState<EditableInvoiceItem[] | null>(null);
  const [saveResult, setSaveResult] =
    useState<SaveImportedFilamentsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isBusy = isRecognizing || isSaving || saveResult !== null;

  const closeIfIdle = useCallback(() => {
    if (!isBusy) {
      onClose();
    }
  }, [isBusy, onClose]);

  useDialogDismiss(closeIfIdle);

  // После успеха окно закрывается само: сначала обновляем серверный список,
  // затем возвращаем фокус на кнопку «Импорт из фото» в родительской вкладке.
  useEffect(() => {
    if (!saveResult) {
      return;
    }

    const timer = window.setTimeout(() => {
      router.refresh();
      onClose();
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [onClose, router, saveResult]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
    setItems(null);
    setSaveResult(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isRecognizing || isSaving || saveResult) {
      return;
    }

    if (!selectedFile) {
      setError("Выберите фото накладной.");
      return;
    }

    setError(null);
    setItems(null);
    setSaveResult(null);
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

      const recognized = payload
        .map(toInvoiceItem)
        .filter((item): item is InvoiceItem => item !== null);

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

      setItems(recognized.map(toEditableItem));
    } catch {
      setError(
        "Не удалось связаться с сервером. Проверьте соединение и попробуйте ещё раз.",
      );
    } finally {
      setIsRecognizing(false);
    }
  }

  /** Правка одной ячейки: меняем только нужное поле, остальные строки не трогаем. */
  function updateItem(
    id: string,
    patch: Partial<Omit<EditableInvoiceItem, "id">>,
  ) {
    setError(null);
    setItems((current) =>
      current
        ? current.map((item) => (item.id === id ? { ...item, ...patch } : item))
        : current,
    );
  }

  /** Корзина в строке: удаляем ошибочно распознанную позицию. */
  function removeItem(id: string) {
    setError(null);
    setItems((current) =>
      current ? current.filter((item) => item.id !== id) : current,
    );
  }

  /** Enter в поле таблицы не должен отправлять форму распознавания заново. */
  function handleFieldKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
    }
  }

  async function handleSave() {
    if (!items || items.length === 0 || isSaving || saveResult) {
      return;
    }

    const editedItems = toInvoiceItems(items);

    if (!editedItems) {
      setError(
        "Проверьте таблицу: название и единица измерения не должны быть пустыми, количество — больше нуля, стоимость — не отрицательной.",
      );
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const result = await saveImportedFilaments(editedItems);

      if (result.saved === 0) {
        setError(
          result.error ?? "Не удалось сохранить позиции. Попробуйте ещё раз.",
        );
        return;
      }

      setSaveResult(result);
    } catch {
      setError(
        "Не удалось сохранить позиции. Проверьте соединение и попробуйте ещё раз.",
      );
    } finally {
      setIsSaving(false);
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
              количество, единицы измерения и стоимость.
            </p>
          </div>
          <button
            type="button"
            onClick={closeIfIdle}
            disabled={isBusy}
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
                  isBusy
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
                  disabled={isBusy}
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

          {isSaving ? (
            <p
              role="status"
              className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm leading-relaxed text-blue-100"
            >
              Сохраняем позиции на складе...
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
              <datalist id="import-stock-units">
                {UNIT_SUGGESTIONS.map((unit) => (
                  <option key={unit} value={unit} />
                ))}
              </datalist>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] border-collapse text-sm">
                  <caption className="sr-only">
                    Распознанные материалы накладной: название, количество,
                    единица измерения и стоимость можно править перед
                    сохранением
                  </caption>
                  <thead>
                    <tr className="border-b border-white/10 text-left text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">
                      <th scope="col" className="px-3 py-3">
                        Материал
                      </th>
                      <th scope="col" className="w-20 px-3 py-3">
                        Количество
                      </th>
                      <th scope="col" className="w-20 px-3 py-3">
                        Ед. изм.
                      </th>
                      <th scope="col" className="w-24 px-3 py-3">
                        Стоимость (₽)
                      </th>
                      <th scope="col" className="w-12 px-2 py-3">
                        <span className="sr-only">Действия</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-6 text-center text-sm text-zinc-500"
                        >
                          Все строки удалены — сохранять на склад нечего.
                        </td>
                      </tr>
                    ) : (
                      items.map((item, index) => (
                        <tr
                          key={item.id}
                          className="border-b border-white/5 last:border-0"
                        >
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(event) =>
                                updateItem(item.id, {
                                  name: event.target.value,
                                })
                              }
                              onKeyDown={handleFieldKeyDown}
                              disabled={isBusy}
                              autoComplete="off"
                              maxLength={120}
                              placeholder="Название материала"
                              aria-label={`Материал, строка ${index + 1}`}
                              className={`${cellInputClassName} font-semibold`}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(event) =>
                                updateItem(item.id, {
                                  quantity: event.target.value,
                                })
                              }
                              onKeyDown={handleFieldKeyDown}
                              disabled={isBusy}
                              autoComplete="off"
                              inputMode="decimal"
                              min="0"
                              step="any"
                              placeholder="0"
                              aria-label={`Количество, строка ${index + 1}`}
                              className={`${cellInputClassName} tabular-nums`}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              value={item.unit}
                              onChange={(event) =>
                                updateItem(item.id, {
                                  unit: event.target.value,
                                })
                              }
                              onKeyDown={handleFieldKeyDown}
                              disabled={isBusy}
                              autoComplete="off"
                              list="import-stock-units"
                              maxLength={20}
                              placeholder="г"
                              aria-label={`Единица измерения, строка ${index + 1}`}
                              className={cellInputClassName}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              value={item.price}
                              onChange={(event) =>
                                updateItem(item.id, {
                                  price: event.target.value,
                                })
                              }
                              onKeyDown={handleFieldKeyDown}
                              disabled={isBusy}
                              autoComplete="off"
                              inputMode="decimal"
                              min="0"
                              step="any"
                              placeholder="—"
                              aria-label={`Стоимость, строка ${index + 1}`}
                              className={`${cellInputClassName} tabular-nums`}
                            />
                          </td>
                          <td className="px-2 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              disabled={isBusy}
                              aria-label={`Удалить строку ${index + 1}: ${
                                item.name.trim() || "без названия"
                              }`}
                              title="Удалить строку"
                              data-import-stock-remove
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-white/5 px-4 py-3 text-xs leading-relaxed text-zinc-500">
                Проверьте таблицу: название, количество, единицу и стоимость
                можно исправить, а лишние строки — удалить корзиной.
              </p>
            </div>
          ) : null}

          {saveResult ? (
            <div
              role="status"
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm leading-relaxed text-emerald-100"
            >
              <p className="font-semibold">
                <span aria-hidden>✓ </span>
                Сохранено: {saveResult.saved} позиций
              </p>
              {saveResult.failed > 0 ? (
                <p className="mt-1 text-amber-200">
                  Не удалось сохранить: {saveResult.failed} позиций.
                </p>
              ) : null}
              <p className="mt-1 text-xs text-emerald-200/70">
                Окно закроется через 2 секунды.
              </p>
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeIfIdle}
              disabled={isBusy}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-6 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {items ? "Закрыть" : "Отмена"}
            </button>
            {items ? (
              <button
                type="button"
                onClick={handleSave}
                disabled={
                  isSaving || saveResult !== null || items.length === 0
                }
                aria-busy={isSaving}
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Сохраняем..." : "Сохранить на склад"}
              </button>
            ) : (
              <button
                type="submit"
                disabled={isRecognizing}
                aria-busy={isRecognizing}
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRecognizing ? "Идет распознавание..." : "Распознать"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
