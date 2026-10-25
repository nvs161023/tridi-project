"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import type { WorkshopSettingsFormState } from "@/app/actions/workshop-state";
import { encrypt, isEncryptedSecret } from "@/lib/crypto";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import { createClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";
import {
  hasWorkshopIntegrationFormFields,
  isMaskedOzonApiKey,
  MASKED_OZON_API_KEY,
  normalizeWebhookToken,
  readWorkshopIntegrationForm,
  type WorkshopIntegrations,
} from "@/lib/workshop/integrations";
import { createWorkshopSettingsPayload } from "@/lib/workshop/payload";
import {
  hasWorkshopRequisitesFormFields,
  readWorkshopRequisitesForm,
} from "@/lib/workshop/requisites";
import {
  readWorkshopSettingsForm,
  WORKSHOP_FIELDS,
} from "@/lib/workshop/settings";

const SESSION_EXPIRED =
  "Сессия истекла. Войдите снова, чтобы сохранить настройки.";
const PRO_REQUIRED =
  "Мастерская входит в пакет «Всё включено». Оформите доступ, чтобы сохранять настройки.";
const MIGRATION_MISSING =
  "Настройки пока не сохраняются: в базе нет нужных таблиц или колонок. Примените миграции supabase/workshop_settings.sql, supabase/workshop_requisites.sql и supabase/workshop_marketplace_integration.sql.";
const SAVE_FAILED = "Не удалось сохранить настройки. Попробуйте ещё раз.";
const EMPTY_FORM = "Форма пустая: нечего сохранять. Обновите страницу.";
const API_KEY_SAVE_FAILED =
  "Не удалось подготовить Api-Key к сохранению. Попробуйте ещё раз.";
const STORED_API_KEY_MISSING =
  "Сохранённый Api-Key не найден. Введите ключ заново.";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Токен вебхука для сохранённых ключей.
 *
 * Обычно токен уже создан базой (`default gen_random_uuid()`): тогда просто
 * читаем его. Если строка появилась до миграции и колонка пустая, генерируем
 * uuid здесь, на сервере, и записываем в свою строку. Браузер токен не
 * присылает: иначе его можно было бы подменить.
 *
 * Колонки может не быть вовсе — миграцию применяют вручную. Это не повод
 * считать сохранение ключей неудачным: возвращаем `null`, а вкладка
 * «Интеграции» подскажет применить SQL.
 */
async function ensureWebhookToken(
  supabase: Supabase,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("workshop_settings")
    .select("webhook_token")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn(
      "Токен вебхука Ozon не прочитан:",
      error.code,
      error.message,
    );

    return null;
  }

  const existing = normalizeWebhookToken(
    (data as { webhook_token?: unknown } | null)?.webhook_token,
  );

  if (existing) {
    return existing;
  }

  const generated = randomUUID();
  const { error: updateError } = await supabase
    .from("workshop_settings")
    .update({ webhook_token: generated })
    .eq("user_id", userId);

  if (updateError) {
    console.warn(
      "Токен вебхука Ozon не записан:",
      updateError.code,
      updateError.message,
    );

    return null;
  }

  return generated;
}

/**
 * Api-Key перед записью в базу.
 *
 * Новый ключ шифруется. Если из формы пришла маска, значит, продавец не менял
 * ключ: читаем сохранённое значение и оставляем его как есть, чтобы не
 * перешифровывать и не терять доступ. Старую открытую строку (до появления
 * шифрования) при этом шифруем — это единственный момент, когда она снова
 * проходит через приложение.
 *
 * Ошибка чтения или шифрования не должна превращаться в запись `null`:
 * случайная очистка ключа сломала бы интеграцию молча.
 */
async function prepareOzonApiKey(
  supabase: Supabase,
  userId: string,
  submittedKey: string | null,
): Promise<{ apiKey: string | null } | { error: string }> {
  if (!submittedKey) {
    return { apiKey: null };
  }

  if (!isMaskedOzonApiKey(submittedKey)) {
    try {
      return { apiKey: encrypt(submittedKey) };
    } catch (error) {
      console.warn(
        "Api-Key Ozon не зашифрован:",
        error instanceof Error ? error.message : "неизвестная ошибка",
      );

      return { error: API_KEY_SAVE_FAILED };
    }
  }

  const { data, error } = await supabase
    .from("workshop_settings")
    .select("ozon_api_key")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn(
      "Сохранённый Api-Key Ozon не прочитан:",
      error.code,
      error.message,
    );

    return { error: API_KEY_SAVE_FAILED };
  }

  const storedKey =
    (data as { ozon_api_key?: unknown } | null)?.ozon_api_key;

  if (typeof storedKey !== "string" || !storedKey.trim()) {
    return { error: STORED_API_KEY_MISSING };
  }

  const normalized = storedKey.trim();

  if (isMaskedOzonApiKey(normalized)) {
    return { error: STORED_API_KEY_MISSING };
  }

  try {
    return {
      apiKey: isEncryptedSecret(normalized)
        ? normalized
        : encrypt(normalized),
    };
  } catch (error) {
    console.warn(
      "Api-Key Ozon не зашифрован:",
      error instanceof Error ? error.message : "неизвестная ошибка",
    );

    return { error: API_KEY_SAVE_FAILED };
  }
}

/**
 * Ключи для ответа действию: только маска, без ciphertext и открытого текста.
 */
function maskIntegrationsForClient(
  integrations: WorkshopIntegrations,
): WorkshopIntegrations {
  return {
    ...integrations,
    ozonApiKey: integrations.ozonApiKey ? MASKED_OZON_API_KEY : null,
  };
}

/**
 * Сохранение настроек Мастерской.
 *
 * Одно действие на три вкладки: «Калькулятор» присылает четыре числа,
 * «Реквизиты» — данные компании, «Интеграции» — Client-Id и Api-Key Ozon.
 * Разбор формы определяет, какие поля пришли: так сохранение одной вкладки не
 * затирает значения другой, а первое сохранение с любой вкладки создаёт строку.
 *
 * Порядок проверок повторяет /dashboard/workshop: разбор формы → сессия →
 * подписка → запись. Подписка проверяется и здесь, а не только на странице:
 * Server Action — публичный endpoint, и её можно вызвать запросом в обход
 * интерфейса.
 *
 * Запись — upsert по user_id: одна строка на пользователя, первое сохранение
 * создаёт её, повторное обновляет. RLS всё равно проверяет auth.uid(), так что
 * записать чужую строку не получится даже подделав user_id.
 */
export async function saveWorkshopSettings(
  _prevState: WorkshopSettingsFormState,
  formData: FormData,
): Promise<WorkshopSettingsFormState> {
  const hasSettingsFields = WORKSHOP_FIELDS.some((field) =>
    formData.has(field.formName),
  );
  const hasRequisitesFields = hasWorkshopRequisitesFormFields(formData);
  const hasIntegrationFields = hasWorkshopIntegrationFormFields(formData);

  if (!hasSettingsFields && !hasRequisitesFields && !hasIntegrationFields) {
    return { error: EMPTY_FORM };
  }

  const settingsResult = hasSettingsFields
    ? readWorkshopSettingsForm(formData)
    : null;
  const requisitesResult = hasRequisitesFields
    ? readWorkshopRequisitesForm(formData)
    : null;
  const integrationsResult = hasIntegrationFields
    ? readWorkshopIntegrationForm(formData)
    : null;

  // Ошибки полей важнее общего текста: пользователь сразу видит, что исправить.
  if (
    (settingsResult && !settingsResult.settings) ||
    (requisitesResult && !requisitesResult.requisites) ||
    (integrationsResult && !integrationsResult.integrations)
  ) {
    return {
      fieldErrors: settingsResult?.errors,
      requisitesFieldErrors: requisitesResult?.errors,
      integrationFieldErrors: integrationsResult?.errors,
    };
  }

  const settings = settingsResult?.settings ?? null;
  const requisites = requisitesResult?.requisites ?? null;
  const integrations = integrationsResult?.integrations ?? null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: SESSION_EXPIRED, values: settings ?? undefined };
  }

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return { error: PRO_REQUIRED, values: settings ?? undefined };
  }

  // В базу уходит только шифротекст. Маска означает «ключ не меняли»: тогда
  // сохраняем прежнее значение, а не открываем его заново.
  let storedIntegrations = integrations;

  if (integrations) {
    const prepared = await prepareOzonApiKey(
      supabase,
      user.id,
      integrations.ozonApiKey,
    );

    if ("error" in prepared) {
      return {
        integrationFieldErrors: { ozonApiKey: prepared.error },
        values: settings ?? undefined,
      };
    }

    storedIntegrations = { ...integrations, ozonApiKey: prepared.apiKey };
  }

  const { error } = await supabase
    .from("workshop_settings")
    .upsert(
      createWorkshopSettingsPayload(
        user.id,
        settings,
        requisites,
        storedIntegrations,
      ),
      {
        onConflict: "user_id",
      },
    );

  if (error) {
    console.warn(
      "Настройки мастерской не сохранены:",
      error.code,
      error.message,
    );

    // Ключи в ответе не повторяем: даже при ошибке открытый Api-Key не должен
    // вернуться в браузер. Поля формы сохранят введённое значение локально.
    return {
      error: isMissingTableSchema(error.code, error.message)
        ? MIGRATION_MISSING
        : SAVE_FAILED,
      values: settings ?? undefined,
      requisites: requisites ?? undefined,
    };
  }

  // Токен нужен сразу в ответе: вкладка показывает адрес вебхука, не дожидаясь
  // router.refresh(). Если ключи не сохраняли, лишний запрос не нужен.
  const savedIntegrations = storedIntegrations
    ? {
        ...maskIntegrationsForClient(storedIntegrations),
        webhookToken: await ensureWebhookToken(supabase, user.id),
      }
    : null;

  // Страница рисует настройки на сервере: без этого следующий переход покажет
  // старые значения из кэша.
  revalidatePath("/dashboard/workshop");

  return {
    success: true,
    values: settings ?? undefined,
    requisites: requisites ?? undefined,
    integrations: savedIntegrations ?? undefined,
  };
}
