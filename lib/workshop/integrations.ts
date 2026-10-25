/**
 * Интеграция Мастерской с Ozon Seller: Client-Id, Api-Key и токен вебхука.
 *
 * Заказы с Ozon приходят вебхуком на `/api/webhooks/ozon`. Ozon не подписывает
 * уведомления и может не присылать Client-Id в заголовках, поэтому продавца
 * определяет персональный адрес: `/api/webhooks/ozon?token=<uuid>`. Токен
 * хранится в `workshop_settings.webhook_token` (uuid, unique) и создаётся базой
 * при первой вставке строки. Роут ищет строку по токену и создаёт заказ от
 * имени владельца; без известного токена уведомление получает 403.
 *
 * Api-Key и Client-Id пока нужны только будущим запросам к Seller API, но
 * сохраняются вместе: интеграция считается настроенной, когда заполнены оба
 * поля. Оба ключа — секреты аккаунта продавца, поэтому вводятся в поле
 * `type="password"` и показываются по кнопке «Показать». Токен вебхука — не
 * секрет API: владельцу его показываем полностью, чтобы скопировать адрес.
 *
 * Модуль чистый — без Supabase и `next/cache`: его импортирует и серверная
 * страница, и клиентская вкладка «Интеграции». Поэтому здесь нет `node:crypto`:
 * токен генерирует база (`gen_random_uuid()`), а не браузер.
 */

/** Базовый адрес вебхука; полный адрес собирает `buildOzonWebhookUrl`. */
export const OZON_WEBHOOK_ENDPOINT =
  "https://tridi-print.ru/api/webhooks/ozon";

/** Доступы к личному кабинету Ozon. `null` — интеграция не настроена. */
export type WorkshopIntegrations = {
  ozonClientId: string | null;
  ozonApiKey: string | null;
  /** Персональный токен из `workshop_settings.webhook_token`. */
  webhookToken: string | null;
};

/**
 * Значения для строки без ключей: интеграция выключена, пока продавец сам не
 * заполнит оба поля — придумывать ключи за него нельзя.
 */
export const WORKSHOP_INTEGRATIONS_DEFAULTS: WorkshopIntegrations = {
  ozonClientId: null,
  ozonApiKey: null,
  webhookToken: null,
};

/** Имена полей формы: по ним же отдаются ошибки. */
export const INTEGRATIONS_FORM_NAMES = ["ozonClientId", "ozonApiKey"] as const;

export type WorkshopIntegrationField =
  (typeof INTEGRATIONS_FORM_NAMES)[number];

/** Ошибки полей формы: подсказка стоит рядом с нужным полем. */
export type WorkshopIntegrationsErrors = Partial<
  Record<WorkshopIntegrationField, string>
>;

/** Колонки Ozon, которые читает lib/workshop/store.ts. */
export const WORKSHOP_INTEGRATIONS_COLUMNS = "ozon_client_id, ozon_api_key";

/**
 * Токен вебхука читается отдельным запросом: миграцию с ним могли ещё не
 * применить, и тогда ключи Ozon всё равно должны остаться в интерфейсе.
 */
export const WORKSHOP_WEBHOOK_TOKEN_COLUMN = "webhook_token";

/** UUID из `gen_random_uuid()`: другой токен роут не примет. */
const WEBHOOK_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * Токен как строка UUID или `null`.
 *
 * PostgREST отдаёт uuid строкой в нижнем регистре, но регистр в URL может
 * измениться при копировании — приводим к нижнему. Всё, что не похоже на UUID,
 * считаем отсутствующим токеном: подставлять произвольный текст в URL нельзя.
 */
export function normalizeWebhookToken(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const token = value.trim().toLowerCase();

  return WEBHOOK_TOKEN_PATTERN.test(token) ? token : null;
}

/**
 * Полный адрес вебхука с персональным токеном.
 *
 * Пока токена нет (строка ещё не создана или миграция не применена), адреса
 * тоже нет: показывать общий URL без токена нельзя — Ozon получит 403.
 */
export function buildOzonWebhookUrl(
  token: string | null | undefined,
): string | null {
  const normalized = normalizeWebhookToken(token);

  return normalized
    ? `${OZON_WEBHOOK_ENDPOINT}?token=${encodeURIComponent(normalized)}`
    : null;
}

/** Пределы полей — как у `maxLength` в форме. */
export const INTEGRATIONS_TEXT_LIMITS = {
  ozonClientId: 64,
  ozonApiKey: 200,
} as const;

/** Client-Id Ozon — число: в Seller API это идентификатор кабинета продавца. */
const CLIENT_ID_PATTERN = /^\d+$/u;

/** Настоящий Api-Key длиннее; короткое значение — почти всегда опечатка. */
const API_KEY_MIN_LENGTH = 8;

/** Перенос строки из буфера обмена — не часть ключа: пробелы выбрасываем. */
const KEY_SPACES = /[\s\u00a0]/g;

/** Настроена ли интеграция: нужны оба ключа — Client-Id и Api-Key. */
export function isWorkshopIntegrationActive(
  integrations: WorkshopIntegrations | null | undefined,
): boolean {
  return Boolean(integrations?.ozonClientId && integrations?.ozonApiKey);
}

/** Пришли ли данные вкладки «Интеграции»: другие формы этих полей не содержат. */
export function hasWorkshopIntegrationFormFields(formData: FormData): boolean {
  return INTEGRATIONS_FORM_NAMES.some((name) => formData.has(name));
}

/** Текст из формы или строки базы без пробелов: ключ копируют из кабинета. */
function readKey(value: unknown): string {
  return typeof value === "string" ? value.replace(KEY_SPACES, "") : "";
}

/**
 * Объект для интерфейса из любых данных.
 *
 * Клиентская вкладка получает значения из RSC-пейлоада. Если страница была
 * открыта до деплоя, старый пейлоад может не содержать новых полей, поэтому
 * `undefined` и отсутствующие ключи не должны ронять рендер: возвращаем
 * значения по умолчанию.
 */
export function ensureWorkshopIntegrations(
  value: Partial<WorkshopIntegrations> | null | undefined,
): WorkshopIntegrations {
  if (!value) {
    return { ...WORKSHOP_INTEGRATIONS_DEFAULTS };
  }

  return {
    ozonClientId: readKey(value.ozonClientId) || null,
    ozonApiKey: readKey(value.ozonApiKey) || null,
    webhookToken: normalizeWebhookToken(value.webhookToken),
  };
}

/**
 * Строка `workshop_settings` → ключи для интерфейса.
 *
 * Пустой текст становится `null`: в базе это «интеграция не настроена», а не
 * пустая строка. Отсутствующая строка или неприменённая миграция — значения по
 * умолчанию, чтобы страница не падала.
 */
export function normalizeWorkshopIntegrations(
  row: Partial<Record<string, unknown>> | null | undefined,
): WorkshopIntegrations {
  if (!row) {
    return { ...WORKSHOP_INTEGRATIONS_DEFAULTS };
  }

  return ensureWorkshopIntegrations({
    ozonClientId: readKey(row.ozon_client_id) || null,
    ozonApiKey: readKey(row.ozon_api_key) || null,
    webhookToken: normalizeWebhookToken(row.webhook_token),
  });
}

/**
 * Форма → ключи для записи.
 *
 * Оба поля пустые — это отключение интеграции, а не ошибка: продавец вправе
 * убрать ключи. Если заполнено только одно поле, форма не сохраняется:
 * половина пары не работает, а непонятная ошибка базы хуже подсказки.
 */
export function readWorkshopIntegrationForm(formData: FormData): {
  integrations: WorkshopIntegrations | null;
  errors: WorkshopIntegrationsErrors;
} {
  const errors: WorkshopIntegrationsErrors = {};
  const ozonClientId = readKey(formData.get("ozonClientId"));
  const ozonApiKey = readKey(formData.get("ozonApiKey"));

  if (!ozonClientId && !ozonApiKey) {
    return { integrations: { ...WORKSHOP_INTEGRATIONS_DEFAULTS }, errors };
  }

  if (!ozonClientId) {
    errors.ozonClientId =
      "Client-Id — обязательное поле: без него не заработают запросы к Seller API.";
  } else if (ozonClientId.length > INTEGRATIONS_TEXT_LIMITS.ozonClientId) {
    errors.ozonClientId = `Client-Id: не больше ${INTEGRATIONS_TEXT_LIMITS.ozonClientId} символов.`;
  } else if (!CLIENT_ID_PATTERN.test(ozonClientId)) {
    errors.ozonClientId =
      "Client-Id Ozon — только цифры: номер кабинета продавца из Seller API.";
  }

  if (!ozonApiKey) {
    errors.ozonApiKey =
      "Api-Key — обязательное поле: без него интеграция не заработает.";
  } else if (ozonApiKey.length > INTEGRATIONS_TEXT_LIMITS.ozonApiKey) {
    errors.ozonApiKey = `Api-Key: не больше ${INTEGRATIONS_TEXT_LIMITS.ozonApiKey} символов.`;
  } else if (ozonApiKey.length < API_KEY_MIN_LENGTH) {
    errors.ozonApiKey = `Api-Key: не короче ${API_KEY_MIN_LENGTH} символов — проверьте, что скопировали ключ целиком.`;
  }

  return Object.keys(errors).length > 0
    ? { integrations: null, errors }
    : {
        integrations: { ozonClientId, ozonApiKey, webhookToken: null },
        errors,
      };
}
