"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { createPortal } from "react-dom";

import { addProduct } from "@/app/actions/products";
import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";

type AddProductDialogProps = {
  onClose: () => void;
};

const inputClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white outline-none transition-all duration-200 [appearance:textfield] placeholder:text-zinc-500 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30 focus:ring-inset [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const legendClassName =
  "text-xs font-semibold tracking-[0.16em] text-blue-300 uppercase";

/**
 * Окно «Добавить товар».
 *
 * Форма отправляется в Server Action `addProduct`: пока идёт запрос, кнопка
 * «Сохранить» заблокирована, а ошибка сервера показывается плашкой внутри
 * окна. После успеха каталог обновляется через `router.refresh()`, и окно
 * закрывается. Окно монтируется только открытым: состояние полей и подписка
 * на Escape живут ровно столько, сколько оно на экране. У всех полей
 * `autoComplete="off"`, чтобы браузер не рисовал белые панели автозаполнения
 * поверх тёмной формы.
 */
export function AddProductDialog({ onClose }: AddProductDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useDialogDismiss(onClose);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting || isUploading) {
      return;
    }

    // FormData собираем до await: после него event.currentTarget уже обнулён.
    const formData = new FormData(event.currentTarget);
    const file = formData.get("gcodeFile");

    // File в Server Action не отправляем: он весит мегабайты и упрётся в
    // лимит тела. Сначала файл идёт в /api/workshop/gcode, потом в форму
    // попадает только его публичная ссылка.
    formData.delete("gcodeFile");

    setError(null);
    setIsSubmitting(true);

    try {
      if (file instanceof File && file.size > 0) {
        setIsUploading(true);

        const uploadForm = new FormData();
        uploadForm.set("file", file);

        const response = await fetch("/api/workshop/gcode", {
          method: "POST",
          body: uploadForm,
        });
        const payload = (await response.json().catch(() => null)) as
          | { url?: unknown; error?: unknown }
          | null;

        if (
          !response.ok ||
          !payload ||
          typeof payload.url !== "string" ||
          !payload.url
        ) {
          setError(
            typeof payload?.error === "string"
              ? payload.error
              : "Не удалось загрузить G-code. Попробуйте ещё раз.",
          );

          return;
        }

        formData.set("gcodeUrl", payload.url);
      }

      const result = await addProduct(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      // Сервер может вернуть только полевые ошибки без общего текста.
      const fieldError = result.fieldErrors
        ? Object.values(result.fieldErrors)[0]
        : undefined;

      if (fieldError) {
        setError(fieldError);
        return;
      }

      router.refresh();
      onClose();
    } catch {
      setError(
        "Не удалось отправить форму. Проверьте соединение и попробуйте ещё раз.",
      );
    } finally {
      setIsUploading(false);
      setIsSubmitting(false);
    }
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
            <legend className={legendClassName}>Файл печати</legend>
            <div className="mt-3 space-y-4">
              <div>
                <FieldLabel htmlFor="product-gcode-url" label="Ссылка на G-code" />
                <input
                  id="product-gcode-url"
                  name="gcodeUrl"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="https://…/vase.gcode"
                  maxLength={2048}
                  className={inputClassName}
                />
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  Можно вставить публичную ссылку или выбрать файл ниже. Файл
                  заменит ссылку.
                </p>
              </div>

              <div>
                <FieldLabel htmlFor="product-gcode-file" label="Загрузить файл" />
                <input
                  id="product-gcode-file"
                  name="gcodeFile"
                  type="file"
                  accept=".gcode,.gco,.g"
                  className="mt-2 block w-full cursor-pointer rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                />
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  .gcode, .gco или .g, до 50 МБ. Файл попадёт в каталог и будет
                  доступен агенту фермы по ссылке.
                </p>
              </div>
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

          {error ? (
            <p
              role="alert"
              data-product-error
              className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-100"
            >
              <span aria-hidden>⚠️ </span>
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row">
            <button
              type="submit"
              disabled={isSubmitting || isUploading}
              aria-busy={isSubmitting || isUploading}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploading
                ? "Загрузка файла..."
                : isSubmitting
                  ? "Сохранение..."
                  : "Сохранить"}
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