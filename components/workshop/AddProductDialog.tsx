"use client";

import { type FormEvent } from "react";
import { createPortal } from "react-dom";

import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";

type AddProductDialogProps = {
  onClose: () => void;
};

type ProductFormData = {
  sku: string;
  name: string;
  description: string;
  price: number | null;
  oldPrice: number | null;
  weightG: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  brand: string;
  color: string;
  size: string;
  barcode: string;
  category: string;
};

const inputClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white outline-none transition-all duration-200 [appearance:textfield] placeholder:text-zinc-500 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30 focus:ring-inset [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const legendClassName =
  "text-xs font-semibold tracking-[0.16em] text-blue-300 uppercase";

/** Пустая строка и пробелы превращаются в пустую строку. */
function readText(formData: FormData, name: keyof ProductFormData): string {
  return String(formData.get(name) ?? "").trim();
}

/** Пустое поле — null, иначе конечное число. Запятая тоже принимается. */
function readNumber(
  formData: FormData,
  name: keyof ProductFormData,
): number | null {
  const raw = readText(formData, name).replace(",", ".");

  if (!raw) {
    return null;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * Окно «Добавить товар» — пока только визуальная часть.
 *
 * Форма собирает значения в объект, выводит его в консоль и закрывается.
 * Server Action и запись в `workshop_products` появятся на следующем шаге.
 * Окно монтируется только открытым: состояние полей и подписка на Escape
 * живут ровно столько, сколько оно на экране. У всех полей
 * `autoComplete="off"`, чтобы браузер не рисовал белые панели автозаполнения
 * поверх тёмной формы.
 */
export function AddProductDialog({ onClose }: AddProductDialogProps) {
  useDialogDismiss(onClose);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const data: ProductFormData = {
      sku: readText(formData, "sku"),
      name: readText(formData, "name"),
      description: readText(formData, "description"),
      price: readNumber(formData, "price"),
      oldPrice: readNumber(formData, "oldPrice"),
      weightG: readNumber(formData, "weightG"),
      lengthMm: readNumber(formData, "lengthMm"),
      widthMm: readNumber(formData, "widthMm"),
      heightMm: readNumber(formData, "heightMm"),
      brand: readText(formData, "brand"),
      color: readText(formData, "color"),
      size: readText(formData, "size"),
      barcode: readText(formData, "barcode"),
      category: readText(formData, "category"),
    };

    console.log("[AddProductDialog] data", JSON.stringify(data, null, 2));
    onClose();
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      role="presentation"
      data-product-dialog-overlay
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
        aria-labelledby="add-product-title"
        data-product-dialog
        className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl shadow-black/60 sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-blue-400 uppercase">
              Товары
            </p>
            <h2
              id="add-product-title"
              className="mt-3 text-2xl font-extrabold tracking-tight text-white"
            >
              Добавить товар
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
              Заполните карточку изделия. Поля со звёздочкой обязательны.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно добавления товара"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-lg text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          autoComplete="off"
          data-product-form
          className="mt-6 space-y-6"
        >
          <fieldset>
            <legend className={legendClassName}>Основное</legend>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <TextField
                id="product-sku"
                name="sku"
                label="Артикул (SKU)"
                placeholder="VASE-001"
                required
                autoFocus
                maxLength={64}
              />
              <TextField
                id="product-name"
                name="name"
                label="Название"
                placeholder="Ваза «Спираль»"
                required
                maxLength={160}
              />
              <TextareaField
                id="product-description"
                name="description"
                label="Описание"
                placeholder="Материал, особенности, что входит в комплект"
                className="sm:col-span-2"
                maxLength={2000}
              />
            </div>
          </fieldset>

          <fieldset>
            <legend className={legendClassName}>Цены</legend>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <NumberField
                id="product-price"
                name="price"
                label="Цена (₽)"
                placeholder="1 490"
                required
                step="0.01"
              />
              <NumberField
                id="product-old-price"
                name="oldPrice"
                label="Старая цена (₽)"
                placeholder="1 990"
                step="0.01"
              />
            </div>
          </fieldset>

          <fieldset>
            <legend className={legendClassName}>Габариты</legend>
            <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <NumberField
                id="product-weight"
                name="weightG"
                label="Вес (г)"
                placeholder="250"
                step="1"
              />
              <NumberField
                id="product-length"
                name="lengthMm"
                label="Длина (мм)"
                placeholder="120"
                step="1"
              />
              <NumberField
                id="product-width"
                name="widthMm"
                label="Ширина (мм)"
                placeholder="120"
                step="1"
              />
              <NumberField
                id="product-height"
                name="heightMm"
                label="Высота (мм)"
                placeholder="180"
                step="1"
              />
            </div>
          </fieldset>

          <fieldset>
            <legend className={legendClassName}>Дополнительно</legend>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <TextField
                id="product-brand"
                name="brand"
                label="Бренд"
                placeholder="Ваша мастерская"
                maxLength={80}
              />
              <TextField
                id="product-color"
                name="color"
                label="Цвет"
                placeholder="Графит"
                maxLength={80}
              />
              <TextField
                id="product-size"
                name="size"
                label="Размер"
                placeholder="M"
                maxLength={80}
              />
              <TextField
                id="product-barcode"
                name="barcode"
                label="Штрихкод"
                placeholder="2000000000000"
                maxLength={64}
              />
              <TextField
                id="product-category"
                name="category"
                label="Категория"
                placeholder="Декор"
                className="sm:col-span-2"
                maxLength={80}
              />
            </div>
          </fieldset>

          <div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row">
            <button
              type="submit"
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
            >
              Сохранить
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-6 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

/** Подпись поля: звёздочка обязательного поля не попадает в озвучку. */
function FieldLabel({
  htmlFor,
  label,
  required,
}: {
  htmlFor: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm font-semibold text-slate-200"
    >
      {label}
      {required ? (
        <span aria-hidden className="ml-0.5 text-blue-300">
          {" "}
          *
        </span>
      ) : null}
    </label>
  );
}

/** Обычное текстовое поле с тёмной поверхностью и autoComplete off. */
function TextField({
  id,
  name,
  label,
  placeholder,
  required,
  autoFocus,
  maxLength,
  className,
}: {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  required?: boolean;
  autoFocus?: boolean;
  maxLength: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} label={label} required={required} />
      <input
        id={id}
        name={name}
        type="text"
        autoComplete="off"
        autoFocus={autoFocus}
        spellCheck={false}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        className={inputClassName}
      />
    </div>
  );
}

/** Многострочное описание: та же поверхность, но с ручным resize. */
function TextareaField({
  id,
  name,
  label,
  placeholder,
  maxLength,
  className,
}: {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  maxLength: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} label={label} />
      <textarea
        id={id}
        name={name}
        autoComplete="off"
        rows={3}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`${inputClassName} min-h-24 resize-y`}
      />
    </div>
  );
}

/** Числовое поле: без спиннеров, с десятичной клавиатурой на мобильном. */
function NumberField({
  id,
  name,
  label,
  placeholder,
  required,
  step,
}: {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  required?: boolean;
  step: string;
}) {
  return (
    <div>
      <FieldLabel htmlFor={id} label={label} required={required} />
      <input
        id={id}
        name={name}
        type="number"
        inputMode="decimal"
        autoComplete="off"
        min="0"
        step={step}
        placeholder={placeholder}
        required={required}
        className={inputClassName}
      />
    </div>
  );
}