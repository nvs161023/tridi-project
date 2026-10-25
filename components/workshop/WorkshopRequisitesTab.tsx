"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { saveWorkshopSettings } from "@/app/actions/workshop";
import { emptyWorkshopSettingsFormState } from "@/app/actions/workshop-state";
import {
  COMPANY_TYPES,
  REQUISITES_TEXT_LIMITS,
  workshopCompanyTypeLabel,
  type WorkshopRequisites,
  type WorkshopRequisitesField,
} from "@/lib/workshop/requisites";

/**
 * Вкладка «Реквизиты»: данные компании, от имени которой работает мастерская.
 *
 * Форма отправляется в то же действие, что и настройки калькулятора:
 * `saveWorkshopSettings` сам разбирается, какие поля пришли, и пишет только их —
 * поэтому сохранение реквизитов не затирает тарифы, и наоборот.
 *
 * Поля выводятся из списка FIELDS: подпись, подсказка, предел длины и тип
 * клавиатуры описаны один раз, а разметка одна на все восемь полей. Пределы
 * берутся из `REQUISITES_TEXT_LIMITS` — те же числа стоят в check-ограничениях
 * `supabase/workshop_requisites.sql`.
 *
 * Поля необязательные, кроме типа организации и названия: ИНН, ОГРН и банк
 * можно заполнить позже, когда они понадобятся для счёта.
 */

type WorkshopRequisitesTabProps = {
  requisites: WorkshopRequisites;
  /** В таблице нет колонок реквизитов — миграция не применена. */
  isMissingTable: boolean;
};

type RequisitesTextField = Exclude<WorkshopRequisitesField, "companyType">;

type RequisitesTextConfig = {
  key: RequisitesTextField;
  label: string;
  hint: string;
  placeholder: string;
  maxLength: number;
  type?: "text" | "tel" | "email";
  inputMode?: "text" | "tel" | "email" | "numeric";
  autoComplete?: string;
  /** Адрес и банк — многострочные: в одну строку их не вписать. */
  multiline?: boolean;
  rows?: number;
  required?: boolean;
};

const FIELDS: readonly RequisitesTextConfig[] = [
  {
    key: "companyName",
    label: "Название компании или ФИО",
    hint: "Так мастерская представится в счёте и накладной: «ИП Петров Иван» или «ООО Ромашка».",
    placeholder: "ИП Петров Иван Сергеевич",
    maxLength: REQUISITES_TEXT_LIMITS.companyName,
    autoComplete: "organization",
    required: true,
  },
  {
    key: "inn",
    label: "ИНН",
    hint: "10 цифр у ООО, 12 — у ИП и самозанятого. Пробелы можно ставить как удобно.",
    placeholder: "7707083893",
    maxLength: REQUISITES_TEXT_LIMITS.inn,
    inputMode: "numeric",
  },
  {
    key: "ogrn",
    label: "ОГРН / ОГРНИП",
    hint: "13 цифр у ООО, 15 — у ОГРНИП. У самозанятого этого номера нет.",
    placeholder: "1027700132195",
    maxLength: REQUISITES_TEXT_LIMITS.ogrn,
    inputMode: "numeric",
  },
  {
    key: "legalAddress",
    label: "Юридический адрес",
    hint: "Адрес из документов: город, улица, дом, помещение.",
    placeholder: "г. Москва, ул. Ленина, д. 1, пом. 12",
    maxLength: REQUISITES_TEXT_LIMITS.legalAddress,
    multiline: true,
    rows: 2,
  },
  {
    key: "bankDetails",
    label: "Банковские реквизиты",
    hint: "Расчётный счёт, банк, БИК и корреспондентский счёт — по строке на каждый.",
    placeholder:
      "Р/с 40702810100000012345 в ПАО «Сбербанк»\nБИК 044525225\nК/с 30101810400000000225",
    maxLength: REQUISITES_TEXT_LIMITS.bankDetails,
    multiline: true,
    rows: 4,
  },
  {
    key: "contactPhone",
    label: "Телефон",
    hint: "По нему клиент свяжется по заказу.",
    placeholder: "+7 (999) 123-45-67",
    maxLength: REQUISITES_TEXT_LIMITS.contactPhone,
    type: "tel",
    inputMode: "tel",
    autoComplete: "tel",
  },
  {
    key: "contactEmail",
    label: "Email",
    hint: "Почта для счетов и переписки с клиентом.",
    placeholder: "master@example.ru",
    maxLength: REQUISITES_TEXT_LIMITS.contactEmail,
    type: "email",
    inputMode: "email",
    autoComplete: "email",
  },
];

const fieldClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white outline-none transition-all duration-200 placeholder:text-zinc-500 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30 focus:ring-inset";

export function WorkshopRequisitesTab({
  requisites,
  isMissingTable,
}: WorkshopRequisitesTabProps) {
  const [state, formAction, isPending] = useActionState(
    saveWorkshopSettings,
    emptyWorkshopSettingsFormState,
  );
  const router = useRouter();

  // Состояние приходит новым объектом после каждой отправки: успех обновляет
  // серверные данные страницы, чтобы следующий заход показал сохранённое.
  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state, router]);

  const companyTypeError = state.requisitesFieldErrors?.companyType;
  const savedName = state.requisites?.companyName ?? "";

  return (
    <section aria-labelledby="workshop-requisites-title">
      {isMissingTable ? (
        <p
          role="status"
          className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100"
        >
          <span aria-hidden>⚠️ </span>
          Реквизиты пока не сохраняются: в таблице workshop_settings нет нужных
          колонок. Примените миграцию supabase/workshop_requisites.sql.
        </p>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_24px_80px_-48px_rgba(59,130,246,0.45)] backdrop-blur-md sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.16em] text-blue-300 uppercase">
              Документы
            </p>
            <h2
              id="workshop-requisites-title"
              className="mt-2 text-xl font-extrabold tracking-tight text-white"
            >
              Реквизиты компании
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
              Мастерская работает от имени компании: эти данные попадут в счета,
              накладные и акты, которые вы выставляете клиенту.
            </p>
          </div>

          <p className="flex shrink-0 flex-wrap items-center gap-2 text-[11px] font-semibold">
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-zinc-300">
              {workshopCompanyTypeLabel(requisites.companyType)}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 ${
                requisites.companyName
                  ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                  : "border-white/10 bg-white/[0.03] text-zinc-400"
              }`}
            >
              {requisites.companyName || "Ещё не заполнено"}
            </span>
          </p>
        </div>

        <form
          action={formAction}
          autoComplete="off"
          className="mt-6 grid gap-4 sm:grid-cols-2"
        >
          <div>
            <label
              htmlFor="workshop-requisites-companyType"
              className="block text-sm font-semibold text-zinc-200"
            >
              Тип организации
            </label>
            <select
              id="workshop-requisites-companyType"
              name="companyType"
              autoComplete="off"
              defaultValue={requisites.companyType}
              aria-invalid={companyTypeError ? true : undefined}
              aria-describedby={
                companyTypeError
                  ? "workshop-requisites-companyType-error"
                  : "workshop-requisites-companyType-hint"
              }
              className={`${fieldClassName} [color-scheme:dark]`}
            >
              {COMPANY_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {companyTypeError ? (
              <p
                id="workshop-requisites-companyType-error"
                role="alert"
                className="mt-1.5 text-sm text-red-300"
              >
                {companyTypeError}
              </p>
            ) : (
              <p
                id="workshop-requisites-companyType-hint"
                className="mt-1.5 text-xs leading-relaxed text-zinc-500"
              >
                Самозанятый, ИП или ООО — от этого зависит набор документов.
              </p>
            )}
          </div>

          {FIELDS.map((field) => {
            const fieldId = `workshop-requisites-${field.key}`;
            const error = state.requisitesFieldErrors?.[field.key];
            const value = requisites[field.key] ?? "";
            const descriptionId = error
              ? `${fieldId}-error`
              : `${fieldId}-hint`;

            return (
              <div
                key={field.key}
                className={field.multiline ? "sm:col-span-2" : undefined}
              >
                <label
                  htmlFor={fieldId}
                  className="block text-sm font-semibold text-zinc-200"
                >
                  {field.label}
                  {field.required ? null : (
                    <span className="ml-1 text-xs font-normal text-zinc-500">
                      (необязательно)
                    </span>
                  )}
                </label>

                {field.multiline ? (
                  <textarea
                    id={fieldId}
                    name={field.key}
                    rows={field.rows ?? 3}
                    maxLength={field.maxLength}
                    required={field.required}
                    defaultValue={value}
                    placeholder={field.placeholder}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={descriptionId}
                    className={`${fieldClassName} resize-y`}
                  />
                ) : (
                  <input
                    id={fieldId}
                    name={field.key}
                    type={field.type ?? "text"}
                    inputMode={field.inputMode}
                    autoComplete={field.autoComplete ?? "off"}
                    maxLength={field.maxLength}
                    required={field.required}
                    defaultValue={value}
                    placeholder={field.placeholder}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={descriptionId}
                    className={fieldClassName}
                  />
                )}

                {error ? (
                  <p
                    id={`${fieldId}-error`}
                    role="alert"
                    className="mt-1.5 text-sm text-red-300"
                  >
                    {error}
                  </p>
                ) : (
                  <p
                    id={`${fieldId}-hint`}
                    className="mt-1.5 text-xs leading-relaxed text-zinc-500"
                  >
                    {field.hint}
                  </p>
                )}
              </div>
            );
          })}

          <div className="pt-1 sm:col-span-2">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-8"
            >
              {isPending ? "Сохраняем…" : "Сохранить"}
            </button>

            <div aria-live="polite" className="mt-3 min-h-5 text-sm">
              {state.error ? (
                <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-rose-200">
                  {state.error}
                </p>
              ) : null}
              {!state.error && state.success ? (
                <p
                  role="status"
                  className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-200"
                >
                  Реквизиты сохранены
                  {savedName
                    ? ` — документы мастерской оформляются от имени «${savedName}»`
                    : ""}
                  .
                </p>
              ) : null}
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
