"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { createPortal } from "react-dom";

import { addClient } from "@/app/actions/clients";
import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";

type AddClientDialogProps = {
  onClose: () => void;
};

/**
 * Пределы полей. Совпадают с `CLIENT_TEXT_LIMITS` из `lib/workshop/clients.ts`:
 * импортировать константу оттуда нельзя — модуль тянет серверный клиент
 * Supabase и `next/cache`, а это клиентский компонент. Совпадение проверяет
 * серверное действие: оно валидирует те же длины.
 */
const LIMITS = {
  name: 160,
  phone: 40,
  email: 160,
  address: 300,
  notes: 2000,
} as const;

const inputClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white outline-none transition-all duration-200 placeholder:text-zinc-500 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30 focus:ring-inset";

const legendClassName =
  "text-xs font-semibold tracking-[0.16em] text-blue-300 uppercase";

/**
 * Окно «Добавить клиента».
 *
 * Форма отправляется в Server Action `addClient`: пока идёт запрос, кнопка
 * «Сохранить» заблокирована, а ошибка сервера показывается плашкой внутри
 * окна. После успеха база обновляется через `router.refresh()`, и окно
 * закрывается — новый клиент сразу виден в таблице.
 *
 * Окно монтируется только открытым: состояние полей и подписка на Escape живут
 * ровно столько, сколько оно на экране. У полей `autoComplete="off"`, чтобы
 * браузер не рисовал светлые панели автозаполнения поверх тёмной формы.
 */
export function AddClientDialog({ onClose }: AddClientDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useDialogDismiss(onClose);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    // FormData собираем до await: после него event.currentTarget уже обнулён.
    const formData = new FormData(event.currentTarget);

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await addClient(formData);

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
      setIsSubmitting(false);
    }
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      role="presentation"
      data-client-dialog-overlay
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
        aria-labelledby="add-client-title"
        data-client-dialog
        className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl shadow-black/60 sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-blue-400 uppercase">
              Клиенты
            </p>
            <h2
              id="add-client-title"
              className="mt-3 text-2xl font-extrabold tracking-tight text-white"
            >
              Добавить клиента
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
              Сохраните контакты один раз — имя, телефон и адрес подставятся в
              заказы. Обязательно только имя.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно добавления клиента"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-lg text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          autoComplete="off"
          data-client-form
          className="mt-6 space-y-6"
        >
          <fieldset>
            <legend className={legendClassName}>Контакты</legend>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <TextField
                id="client-name"
                name="name"
                label="Имя или название"
                placeholder="Ирина Петрова"
                required
                autoFocus
                maxLength={LIMITS.name}
                className="sm:col-span-2"
              />
              <TextField
                id="client-phone"
                name="phone"
                label="Телефон"
                placeholder="+7 (999) 123-45-67"
                type="tel"
                inputMode="tel"
                maxLength={LIMITS.phone}
              />
              <TextField
                id="client-email"
                name="email"
                label="Email"
                placeholder="client@example.com"
                type="email"
                inputMode="email"
                maxLength={LIMITS.email}
              />
            </div>
          </fieldset>

          <fieldset>
            <legend className={legendClassName}>Доставка и заметки</legend>
            <div className="mt-3 grid gap-4">
              <TextField
                id="client-address"
                name="address"
                label="Адрес доставки"
                placeholder="Москва, ул. Лесная, 7, кв. 12"
                maxLength={LIMITS.address}
              />
              <TextareaField
                id="client-notes"
                name="notes"
                label="Заметки"
                placeholder="Скидка 10 %, удобно писать в Telegram, самовывоз"
                maxLength={LIMITS.notes}
              />
            </div>
          </fieldset>

          {error ? (
            <p
              role="alert"
              data-client-error
              className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-100"
            >
              <span aria-hidden>⚠️ </span>
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row">
            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Сохранение..." : "Сохранить"}
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

/** Текстовое поле с тёмной поверхностью: телефон и email получают свой тип. */
function TextField({
  id,
  name,
  label,
  placeholder,
  required,
  autoFocus,
  maxLength,
  type = "text",
  inputMode,
  className,
}: {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  required?: boolean;
  autoFocus?: boolean;
  maxLength: number;
  type?: "text" | "tel" | "email";
  inputMode?: "text" | "tel" | "email";
  className?: string;
}) {
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} label={label} required={required} />
      <input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
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

/** Многострочные заметки: та же поверхность, но с ручным resize. */
function TextareaField({
  id,
  name,
  label,
  placeholder,
  maxLength,
}: {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  maxLength: number;
}) {
  return (
    <div>
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
