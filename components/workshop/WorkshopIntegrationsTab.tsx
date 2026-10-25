"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { saveWorkshopSettings } from "@/app/actions/workshop";
import { emptyWorkshopSettingsFormState } from "@/app/actions/workshop-state";
import {
  buildOzonWebhookUrl,
  buildWbWebhookUrl,
  buildYandexWebhookUrl,
  ensureWorkshopIntegrations,
  INTEGRATIONS_TEXT_LIMITS,
  isWorkshopIntegrationActive,
  MASKED_OZON_API_KEY,
  type WorkshopIntegrations,
} from "@/lib/workshop/integrations";

/**
 * Вкладка «Интеграции»: подключение Мастерской к маркетплейсам.
 *
 * Площадки сгруппированы по карточкам. У Ozon внутри карточки живут Client-Id,
 * Api-Key, кнопка «Сохранить» и персональный адрес вебхука; WB и Яндекс.Маркет
 * ключей не требуют и показывают только адрес с кнопкой копирования.
 *
 * Форма отправляется в то же действие, что калькулятор и реквизиты:
 * `saveWorkshopSettings` сам разбирается, какие поля пришли, и пишет только их —
 * сохранение ключей не затирает тарифы и данные компании.
 *
 * Api-Key — секрет: сервер хранит его зашифрованным и присылает только маску
 * `••••••••`. Открытый ключ и ciphertext в браузер не попадают. Пока поле не
 * меняли, форма отправляет маску, а Server Action оставляет сохранённое
 * значение; кнопка «Заменить» очищает поле для нового ключа.
 *
 * URL вебхука персональный: `?token=<uuid>` — токен создаётся при сохранении
 * ключей и хранится в `workshop_settings.webhook_token`. Ozon может не присылать
 * Client-Id в заголовках, поэтому именно токен определяет продавца. Тот же токен
 * используют WB и Яндекс.Маркет: их адреса отличаются только путём роута.
 * Кнопка «Скопировать» копирует полный адрес, а при запрете буфера обмена
 * (не HTTPS) показывает стандартный prompt — тот же приём, что у сертификата.
 * Состояние «Скопировано» у каждой карточки своё.
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

/** Общая рамка карточки площадки: один ритм у Ozon, WB и Яндекса. */
const platformCardClassName =
  "rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6";

/** Сколько держится подтверждение копирования. */
const COPY_FEEDBACK_MS = 3000;

/** У какого адреса сейчас показано «Скопировано». */
type WebhookTarget = "ozon" | "wb" | "yandex";

/** Названия для системного prompt, когда буфер обмена запрещён. */
const WEBHOOK_TARGET_LABELS: Record<WebhookTarget, string> = {
  ozon: "Ozon",
  wb: "Wildberries",
  yandex: "Яндекс.Маркета",
};

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
  const [copiedWebhook, setCopiedWebhook] = useState<WebhookTarget | null>(null);

  // Старый пейлоад мог не содержать новых полей: не бросаем на этом рендер.
  const safeIntegrations = ensureWorkshopIntegrations(integrations);
  const storedApiKey = safeIntegrations.ozonApiKey;
  // Значение поля живёт локально: маска из сервера заменяется при вводе, а
  // после ошибки сохранения введённый ключ не пропадает.
  const [apiKeyValue, setApiKeyValue] = useState(storedApiKey ?? "");

  // После сохранения бейдж и адрес сразу отражают ответ действия, не дожидаясь
  // router.refresh(); до первой отправки — значения со страницы.
  const isActive = state.integrations
    ? isWorkshopIntegrationActive(state.integrations)
    : isWorkshopIntegrationActive(safeIntegrations);
  const webhookToken =
    state.integrations?.webhookToken ?? safeIntegrations.webhookToken;
  const ozonWebhookUrl = isActive ? buildOzonWebhookUrl(webhookToken) : null;
  // WB и Яндексу ключи Ozon не нужны: их роутам достаточно токена, поэтому
  // адреса показываем всегда, когда токен уже есть.
  const wbWebhookUrl = buildWbWebhookUrl(webhookToken);
  const yandexWebhookUrl = buildYandexWebhookUrl(webhookToken);
  const webhookUrls: Record<WebhookTarget, string | null> = {
    ozon: ozonWebhookUrl,
    wb: wbWebhookUrl,
    yandex: yandexWebhookUrl,
  };

  // Состояние приходит новым объектом после каждой отправки: успех обновляет
  // серверные данные страницы, чтобы следующий заход показал сохранённое.
  // В поле возвращается только маска из ответа действия, не открытый ключ.
  useEffect(() => {
    if (state.success) {
      setApiKeyValue(
        state.integrations
          ? (state.integrations.ozonApiKey ?? "")
          : (storedApiKey ?? ""),
      );
      router.refresh();
    }
  }, [state, router, storedApiKey]);

  useEffect(() => {
    if (!copiedWebhook) {
      return;
    }

    const timer = window.setTimeout(
      () => setCopiedWebhook(null),
      COPY_FEEDBACK_MS,
    );

    return () => window.clearTimeout(timer);
  }, [copiedWebhook]);

  async function copyWebhookUrl(target: WebhookTarget) {
    const url = webhookUrls[target];

    if (!url) {
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopiedWebhook(target);
    } catch {
      window.prompt(
        `Скопируйте URL для вебхука ${WEBHOOK_TARGET_LABELS[target]}`,
        url,
      );
    }
  }

  const clientIdError = state.integrationFieldErrors?.ozonClientId;
  const apiKeyError = state.integrationFieldErrors?.ozonApiKey;

  return (
    <section
      aria-labelledby="workshop-integrations-title"
      className="space-y-4 sm:space-y-5"
    >
      {isMissingTable ? (
        <p
          role="status"
          className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100"
        >
          <span aria-hidden>⚠️ </span>
          Ключи пока не сохраняются: в таблице workshop_settings нет колонок Ozon.
          Примените миграцию supabase/workshop_marketplace_integration.sql.
        </p>
      ) : null}

      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-[0.16em] text-blue-300 uppercase">
          Маркетплейсы
        </p>
        <h2
          id="workshop-integrations-title"
          className="mt-2 text-xl font-extrabold tracking-tight text-white"
        >
          Подключение площадок
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Каждая площадка — отдельная карточка. Ключи Ozon сохраняются здесь же, а
          адрес вебхука копируется одной кнопкой.
        </p>
      </div>

      <article
        aria-labelledby="workshop-integrations-ozon-title"
        className={platformCardClassName}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3
              id="workshop-integrations-ozon-title"
              className="text-lg font-extrabold tracking-tight text-white"
            >
              Ozon
            </h3>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-zinc-400">
              Автоматически получайте заказы с Ozon прямо в Мастерскую.
            </p>
          </div>

          <StatusBadge tone={isActive ? "active" : "off"}>
            {isActive ? "Активна" : "Не настроена"}
          </StatusBadge>
        </div>

        <form
          action={formAction}
          autoComplete="off"
          className="mt-5 grid gap-4 sm:grid-cols-2"
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
                onClick={() => {
                  if (apiKeyValue === MASKED_OZON_API_KEY) {
                    // Маску нельзя «показать»: открытого ключа в браузере нет.
                    // Очищаем поле, чтобы ввести новый ключ.
                    setApiKeyValue("");
                    return;
                  }

                  setIsKeyVisible((visible) => !visible);
                }}
                aria-pressed={
                  apiKeyValue === MASKED_OZON_API_KEY
                    ? undefined
                    : isKeyVisible
                }
                aria-controls="workshop-integrations-ozonApiKey"
                className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-zinc-300 transition-colors hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
              >
                {apiKeyValue === MASKED_OZON_API_KEY
                  ? "Заменить"
                  : isKeyVisible
                    ? "Скрыть"
                    : "Показать"}
              </button>
            </div>
            <input
              id="workshop-integrations-ozonApiKey"
              name="ozonApiKey"
              type={isKeyVisible ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              maxLength={INTEGRATIONS_TEXT_LIMITS.ozonApiKey}
              value={apiKeyValue}
              onChange={(event) => setApiKeyValue(event.currentTarget.value)}
              onFocus={(event) => {
                // Маска — не ключ: выделяем её, чтобы первый введённый символ
                // заменил всё значение, а не дописался к точкам.
                if (event.currentTarget.value === MASKED_OZON_API_KEY) {
                  event.currentTarget.select();
                }
              }}
              onClick={(event) => {
                if (event.currentTarget.value === MASKED_OZON_API_KEY) {
                  event.currentTarget.select();
                }
              }}
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
                {apiKeyValue === MASKED_OZON_API_KEY
                  ? "Сохранённый ключ скрыт. Нажмите «Заменить», чтобы ввести новый: без изменений останется прежний."
                  : "Секретный ключ приложения. Поле скрыто звёздочками — нажмите «Показать», чтобы проверить значение."}
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
          <div className="border-t border-white/[0.07] pt-5 sm:col-span-2">
            <WebhookUrlField
              title="URL для вебхука Ozon"
              url={ozonWebhookUrl}
              emptyText={
                isActive
                  ? "Токен вебхука ещё не создан. Примените миграцию supabase/workshop_marketplace_integration.sql и сохраните ключи ещё раз."
                  : "Сохраните Client-Id и Api-Key — здесь появится персональный адрес с токеном."
              }
              hint={
                <>
                  Скопируйте адрес целиком, вместе с <code>?token=…</code>: по
                  токену Ozon находит вашу мастерскую, даже если не присылает
                  Client-Id. Этот адрес не публикуйте — он открывает приём
                  заказов.
                </>
              }
              isCopied={copiedWebhook === "ozon"}
              onCopy={() => copyWebhookUrl("ozon")}
            />
          </div>
        </form>
      </article>

      <article
        aria-labelledby="workshop-integrations-wb-title"
        className={platformCardClassName}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3
              id="workshop-integrations-wb-title"
              className="text-lg font-extrabold tracking-tight text-white"
            >
              Wildberries (WB)
            </h3>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-zinc-400">
              Для получения заказов с WB не нужны API-ключи — достаточно указать
              этот URL в настройках WB.
            </p>
          </div>

          <StatusBadge tone={wbWebhookUrl ? "active" : "ready"}>
            {wbWebhookUrl ? "Активна" : "Готово к подключению"}
          </StatusBadge>
        </div>

        <div className="mt-5 border-t border-white/[0.07] pt-5">
          <WebhookUrlField
            title="URL для вебхука WB"
            url={wbWebhookUrl}
            emptyText={
              isMissingTable
                ? "Токен вебхука ещё не создан. Примените миграцию supabase/workshop_marketplace_integration.sql."
                : "Токен вебхука ещё не создан. Сохраните настройки ещё раз — адрес появится здесь."
            }
            hint={
              <>
                В личном кабинете WB перейдите в Настройки → Интеграции →
                Уведомления и укажите этот адрес для получения новых заказов.
                Токен общий с Ozon — адрес не публикуйте.
              </>
            }
            isCopied={copiedWebhook === "wb"}
            onCopy={() => copyWebhookUrl("wb")}
          />
        </div>
      </article>

      <article
        aria-labelledby="workshop-integrations-yandex-title"
        className={platformCardClassName}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3
              id="workshop-integrations-yandex-title"
              className="text-lg font-extrabold tracking-tight text-white"
            >
              Яндекс.Маркет
            </h3>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-zinc-400">
              API-ключи для этого адреса не нужны: достаточно указать его в
              настройках Яндекс.Маркета.
            </p>
          </div>

          <StatusBadge tone="ready">Готово к подключению</StatusBadge>
        </div>

        <div className="mt-5 border-t border-white/[0.07] pt-5">
          <WebhookUrlField
            title="URL для вебхука Яндекса"
            url={yandexWebhookUrl}
            emptyText={
              isMissingTable
                ? "Токен вебхука ещё не создан. Примените миграцию supabase/workshop_marketplace_integration.sql."
                : "Токен вебхука ещё не создан. Сохраните настройки ещё раз — адрес появится здесь."
            }
            hint={
              <>
                Укажите этот адрес в настройках уведомлений Яндекс.Маркета.
                Токен общий с Ozon — адрес не публикуйте.
              </>
            }
            isCopied={copiedWebhook === "yandex"}
            onCopy={() => copyWebhookUrl("yandex")}
          />
        </div>
      </article>
    </section>
  );
}

type WebhookUrlFieldProps = {
  /** Подпись над адресом: она же попадает в aria-label кнопки. */
  title: string;
  url: string | null;
  /** Что показать вместо адреса, пока токена нет. */
  emptyText: string;
  hint: ReactNode;
  isCopied: boolean;
  onCopy: () => void;
};

/**
 * Поле персонального адреса вебхука с кнопкой «Скопировать».
 *
 * Ozon, WB и Яндекс отличаются только путём роута, поэтому разметка общая: так
 * все площадки получают одинаковую подсказку, disabled-состояние и
 * подтверждение. `isCopied` у каждого поля свой, иначе клик по одной кнопке
 * менял бы текст на всех трёх.
 */
function WebhookUrlField({
  title,
  url,
  emptyText,
  hint,
  isCopied,
  onCopy,
}: WebhookUrlFieldProps) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/30 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
            {title}
          </p>
          {url ? (
            <code className="mt-2 block overflow-x-auto rounded-lg border border-white/[0.06] bg-black/50 px-3 py-2 font-mono text-xs whitespace-nowrap text-blue-200 sm:text-sm">
              {url}
            </code>
          ) : (
            <p className="mt-2 rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-2 text-xs leading-relaxed text-zinc-400">
              {emptyText}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onCopy}
          disabled={!url}
          aria-live="polite"
          aria-label={
            isCopied ? `Скопировано: ${title}` : `Скопировать ${title}`
          }
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-xs font-semibold text-zinc-200 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span aria-hidden>{isCopied ? "✓" : "⧉"}</span>
          {isCopied ? "Скопировано" : "Скопировать"}
        </button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-zinc-500">{hint}</p>
    </div>
  );
}

/** Состояние площадки в бейдже карточки. */
type StatusTone = "active" | "ready" | "off";

const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  active: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
  ready: "border-blue-400/25 bg-blue-500/10 text-blue-200",
  off: "border-white/10 bg-white/[0.03] text-zinc-400",
};

const STATUS_DOT_CLASSES: Record<StatusTone, string> = {
  active: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]",
  ready: "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.9)]",
  off: "bg-zinc-500",
};

/** Бейдж площадки: активна, готова к подключению или не настроена. */
function StatusBadge({
  tone,
  children,
}: {
  tone: StatusTone;
  children: ReactNode;
}) {
  return (
    <p className="shrink-0">
      <span
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold ${STATUS_TONE_CLASSES[tone]}`}
      >
        <span
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_CLASSES[tone]}`}
        />
        {children}
      </span>
    </p>
  );
}
