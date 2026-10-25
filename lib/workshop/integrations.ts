/**
 * Интеграция Мастерской с Ozon Seller: Client-Id и Api-Key.
 *
 * Заказы с Ozon приходят вебхуком на `/api/webhooks/ozon`. Ozon передаёт свой
 * Client-Id, роут ищет по нему строку `workshop_settings` и создаёт заказ от
 * имени владельца. Поэтому Client-Id — не подпись в интерфейсе, а ключ поиска
 * продавца: без него уведомление получит ответ 403.
 *
 * Api-Key пока нужен только будущим запросам к Seller API, но сохраняется
 * вместе с Client-Id: интеграция считается настроенной, когда заполнены оба
 * поля. Оба ключа — секреты аккаунта продавца, поэтому вводятся в поле
 * `type="password"` и показываются по кнопке «Показать».
 *
 * Модуль чистый — без Supabase и `next/cache`: его импортирует и серверная
 * страница, и клиентская вкладка «Интеграции».
 */

/** Адрес вебхука, который продавец указывает в Seller API Ozon. */
export const OZON_WEBHOOK_URL = "https://tridi-print.ru/api/webhooks/ozon";

/** Доступы к личному кабинету Ozon. `null` — интеграция не настроена. */
export type WorkshopIntegrations = {
  ozonClientId: string | null;
  ozonApiKey: string | null;
};

/**
 * Значения для строки без ключей: интеграция выключена, пока продавец сам не
 * заполнит оба поля — придумывать ключи за него нельзя.
 */
export const WORKSHOP_INTEGRATIONS_DEFAULTS: WorkshopIntegrations = {
  ozonClientId: null,
  ozonApiKey: null,
};

/** Имена полей формы: по ним же отдаются ошибки. */
export const INTEGRATIONS_FORM_NAMES = ["ozonClientId", "ozonApiKey"] as const;

export type WorkshopIntegrationField =
  (typeof INTEGRATIONS_FORM_NAMES)[number];

/** Ошибки полей формы: подсказка стоит рядом с нужным полем. */
export type WorkshopIntegrationsErrors = Partial<
  Record<WorkshopIntegrationField, string>
>;

/** Колонки, которые читает lib/workshop/store.ts. */
export const WORKSHOP_INTEGRATIONS_COLUMNS = "ozon_client_id, ozon_api_key";

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
  integrations: WorkshopIntegrations,
): boolean {
  return Boolean(integrations.ozonClientId && integrations.ozonApiKey);
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

  const ozonClientId = readKey(row.ozon_client_id);
  const ozonApiKey = readKey(row.ozon_api_key);

  return {
    ozonClientId: ozonClientId || null,
    ozonApiKey: ozonApiKey || null,
  };
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
    errors.ozonClientId = "Client-Id — обязательное поле: по нему Ozon находит ваш кабинет.";
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
    : { integrations: { ozonClientId, ozonApiKey }, errors };
}
