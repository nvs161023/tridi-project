"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { saveWorkshopSettings } from "@/app/actions/workshop";
import { emptyWorkshopSettingsFormState } from "@/app/actions/workshop-state";
import {
  buildOzonWebhookUrl,
  ensureWorkshopIntegrations,
  INTEGRATIONS_TEXT_LIMITS,
  isWorkshopIntegrationActive,
  type WorkshopIntegrations,
} from "@/lib/workshop/integrations";

/**
 * Вкладка «Интеграции»: подключение Мастерской к Ozon Seller.
 *
 * Форма отправляется в то же действие, что калькулятор и реквизиты:
 * `saveWorkshopSettings` сам разбирается, какие поля пришли, и пишет только их —
 * сохранение ключей не затирает тарифы и данные компании.
 *
 * Api-Key — секрет: поле ввода показывает звёздочки, а значение раскрывается
 * кнопкой «Показать». Ключи приходят с сервера, потому что после перезагрузки
 * страницы они должны остаться в полях; RLS не даёт прочитать чужую строку.
 *
 * URL вебхука персональный: `?token=<uuid>` — токен создаётся при сохранении
 * ключей и хранится в `workshop_settings.webhook_token`. Ozon может не присылать
 * Client-Id в заголовках, поэтому именно токен определяет продавца. Кнопка
 * «Скопировать» копирует полный адрес, а при запрете буфера обмена (не HTTPS)
 * показывает стандартный prompt — тот же приём, что у сертификата.
 *
 * `integrations` может прийти `undefined`, если страница была открыта до
 * деплоя и клиент получил старый RSC-пейлоад без новых полей. Поэтому значения
 * проходят через `ensureWorkshopIntegrations`, а не читаются напрямую.
 */

type WorkshopIntegrationsTabProps = {
  integrations?: WorkshopIntegrations | null;
  /** В таблице нет колонок Ozon — миграция не применена. */
  isMissingTable: boolean;
};

const fieldClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white outline-none transition-all duration-200 placeholder:text-zinc-500 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30 focus:ring-inset";

/** Сколько держится подтверждение копирования. */
const COPY_FEEDBACK_MS = 3000;

export function WorkshopIntegrationsTab({
  integrations,
  isMissingTable,
}: WorkshopIntegrationsTabProps) {
  const [state, formAction, isPending] = useActionState(
    saveWorkshopSettings,
    emptyWorkshopSettingsFormState,
  );
  const router = useRouter();
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Старый пейлоад мог не содержать новых полей: не бросаем на этом рендер.
  const safeIntegrations = ensureWorkshopIntegrations(integrations);
  // После сохранения бейдж и адрес сразу отражают ответ действия, не дожидаясь
  // router.refresh(); до первой отправки — значения со страницы.
  const isActive = state.integrations
    ? isWorkshopIntegrationActive(state.integrations)
    : isWorkshopIntegrationActive(safeIntegrations);
  const webhookToken =
    state.integrations?.webhookToken ?? safeIntegrations.webhookToken;
  const webhookUrl = isActive ? buildOzonWebhookUrl(webhookToken) : null;

  // Состояние приходит новым объектом после каждой отправки: успех обновляет
  // серверные данные страницы, чтобы следующий заход показал сохранённое.
  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state, router]);

  useEffect(() => {
    if (!isCopied) {
      return;
    }

    const timer = window.setTimeout(() => setIsCopied(false), COPY_FEEDBACK_MS);

    return () => window.clearTimeout(timer);
  }, [isCopied]);

  async function copyWebhookUrl() {
    if (!webhookUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(webhookUrl);
      setIsCopied(true);
    } catch {
      window.prompt("Скопируйте URL для вебхука", webhookUrl);
    }
  }

  const clientIdError = state.integrationFieldErrors?.ozonClientId;
  const apiKeyError = state.integrationFieldErrors?.ozonApiKey;

  return (
    <section aria-labelledby="workshop-integrations-title">
      {isMissingTable ? (
        <p
          role="status"
          className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100"
        >
          <span aria-hidden>⚠️ </span>
          Ключи пока не сохраняются: в таблице workshop_settings нет колонок Ozon.
          Примените миграцию supabase/workshop_marketplace_integration.sql.
        </p>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_24px_80px_-48px_rgba(59,130,246,0.45)] backdrop-blur-md sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.16em] text-blue-300 uppercase">
              Маркетплейсы
            </p>
            <h2
              id="workshop-integrations-title"
              className="mt-2 text-xl font-extrabold tracking-tight text-white"
            >
              Интеграция с Ozon
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
              Автоматически получайте заказы с Ozon прямо в Мастерскую.
            </p>
          </div>

          <p className="shrink-0">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold ${
                isActive
                  ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                  : "border-white/10 bg-white/[0.03] text-zinc-400"
              }`}
            >
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${
                  isActive
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
                    : "bg-zinc-500"
                }`}
              />
              {isActive ? "Интеграция активна" : "Интеграция не настроена"}
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
              htmlFor="workshop-integrations-ozonClientId"
              className="block text-sm font-semibold text-zinc-200"
            >
              Client-Id
            </label>
            <input
              id="workshop-integrations-ozonClientId"
              name="ozonClientId"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={INTEGRATIONS_TEXT_LIMITS.ozonClientId}
              defaultValue={safeIntegrations.ozonClientId ?? ""}
              placeholder="1234567"
              aria-invalid={clientIdError ? true : undefined}
              aria-describedby={
                clientIdError
                  ? "workshop-integrations-ozonClientId-error"
                  : "workshop-integrations-ozonClientId-hint"
              }
              className={fieldClassName}
            />
            {clientIdError ? (
              <p
                id="workshop-integrations-ozonClientId-error"
                role="alert"
                className="mt-1.5 text-sm text-red-300"
              >
                {clientIdError}
              </p>
            ) : (
              <p
                id="workshop-integrations-ozonClientId-hint"
                className="mt-1.5 text-xs leading-relaxed text-zinc-500"
              >
                Номер кабинета продавца из личного кабинета Ozon, раздел Seller API.
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="workshop-integrations-ozonApiKey"
                className="block text-sm font-semibold text-zinc-200"
              >
                Api-Key
              </label>
              <button
                type="button"
                onClick={() => setIsKeyVisible((visible) => !visible)}
                aria-pressed={isKeyVisible}
                aria-controls="workshop-integrations-ozonApiKey"
                className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-zinc-300 transition-colors hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
              >
                {isKeyVisible ? "Скрыть" : "Показать"}
              </button>
            </div>
            <input
              id="workshop-integrations-ozonApiKey"
              name="ozonApiKey"
              type={isKeyVisible ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              maxLength={INTEGRATIONS_TEXT_LIMITS.ozonApiKey}
              defaultValue={safeIntegrations.ozonApiKey ?? ""}
              placeholder="Ключ из приложения Seller API"
              aria-invalid={apiKeyError ? true : undefined}
              aria-describedby={
                apiKeyError
                  ? "workshop-integrations-ozonApiKey-error"
                  : "workshop-integrations-ozonApiKey-hint"
              }
              className={fieldClassName}
            />
            {apiKeyError ? (
              <p
                id="workshop-integrations-ozonApiKey-error"
                role="alert"
                className="mt-1.5 text-sm text-red-300"
              >
                {apiKeyError}
              </p>
            ) : (
              <p
                id="workshop-integrations-ozonApiKey-hint"
                className="mt-1.5 text-xs leading-relaxed text-zinc-500"
              >
                Секретный ключ приложения. Поле скрыто звёздочками — нажмите
                «Показать», чтобы проверить значение.
              </p>
            )}
          </div>

          <div className="pt-1 sm:col-span-2">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-8"
            >
              {isPending ? "Сохраняем…" : "Сохранить"}
            </button>

            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Чтобы отключить интеграцию, очистите оба поля и сохраните.
            </p>

            <div aria-live="polite" className="mt-3 min-h-5 text-sm">
              {state.error ? (
                <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-rose-200">
                  {state.error}
                </p>
              ) : null}
              {!state.error && state.success ? (
                <p
                  role="status"
                  className={`rounded-xl border px-4 py-3 ${
                    isActive
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                      : "border-white/10 bg-white/[0.03] text-zinc-300"
                  }`}
                >
                  {isActive
                    ? "Ключи сохранены — интеграция активна."
                    : "Ключи удалены — интеграция отключена."}
                </p>
              ) : null}
            </div>
          </div>
        </form>

        <div className="mt-6 rounded-2xl border border-white/[0.07] bg-black/30 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
                Персональный URL для вебхука
              </p>
              {webhookUrl ? (
                <code className="mt-2 block overflow-x-auto rounded-lg border border-white/[0.06] bg-black/50 px-3 py-2 font-mono text-xs whitespace-nowrap text-blue-200 sm:text-sm">
                  {webhookUrl}
                </code>
              ) : (
                <p className="mt-2 rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-2 text-xs leading-relaxed text-zinc-400">
                  {isActive
                    ? "Токен вебхука ещё не создан. Примените миграцию supabase/workshop_marketplace_integration.sql и сохраните ключи ещё раз."
                    : "Сохраните Client-Id и Api-Key — здесь появится персональный адрес с токеном."}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={copyWebhookUrl}
              disabled={!webhookUrl}
              aria-live="polite"
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-xs font-semibold text-zinc-200 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span aria-hidden>{isCopied ? "✓" : "⧉"}</span>
              {isCopied ? "Скопировано" : "Скопировать"}
            </button>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-zinc-500">
            Скопируйте адрес целиком, вместе с <code>?token=…</code>: по токену
            Ozon находит вашу мастерскую, даже если не присылает Client-Id. Этот
            адрес не публикуйте — он открывает приём заказов.
          </p>
        </div>
      </div>
    </section>
  );
}
