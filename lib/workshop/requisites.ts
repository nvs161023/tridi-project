/**
 * Реквизиты компании Мастерской: тип организации, название, ИНН, ОГРН,
 * юридический адрес, банк и контакты.
 *
 * Правило одно на три места: страница показывает сохранённые значения, Server
 * Action проверяет форму теми же правилами, а `supabase/workshop_requisites.sql`
 * повторяет длины и форматы в check-ограничениях. Если правила разъедутся,
 * форма сохранит значение, которое база отклонит, и пользователь увидит
 * непонятную ошибку.
 *
 * Модуль чистый — без Supabase и `next/cache`: его импортирует и серверная
 * страница, и клиентская вкладка «Реквизиты».
 */

/** Типы организаций в порядке показа в выпадающем списке. */
export const COMPANY_TYPES = [
  { value: "self_employed", label: "Самозанятый" },
  { value: "ip", label: "ИП" },
  { value: "llc", label: "ООО" },
] as const;

export type WorkshopCompanyType = (typeof COMPANY_TYPES)[number]["value"];

/** Реквизиты в том виде, в каком с ними работает интерфейс. */
export type WorkshopRequisites = {
  companyType: WorkshopCompanyType;
  /** Название компании или ФИО — обязательное поле формы. */
  companyName: string;
  inn: string | null;
  ogrn: string | null;
  legalAddress: string | null;
  /** Банковские реквизиты для накладных: счёт, банк, БИК, корр. счёт. */
  bankDetails: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
};

/**
 * Значения для строки без реквизитов. Тип по умолчанию — самый частый у
 * мастерских; название пустое, потому что придумывать его за пользователя
 * нельзя, а форма требует заполнить поле.
 */
export const WORKSHOP_REQUISITES_DEFAULTS: WorkshopRequisites = {
  companyType: "self_employed",
  companyName: "",
  inn: null,
  ogrn: null,
  legalAddress: null,
  bankDetails: null,
  contactPhone: null,
  contactEmail: null,
};

/** Имена полей формы: по ним же отдаются ошибки. */
export const REQUISITES_FORM_NAMES = [
  "companyType",
  "companyName",
  "inn",
  "ogrn",
  "legalAddress",
  "bankDetails",
  "contactPhone",
  "contactEmail",
] as const;

export type WorkshopRequisitesField = (typeof REQUISITES_FORM_NAMES)[number];

/** Ошибки полей формы: подсказка стоит рядом с нужным полем. */
export type WorkshopRequisitesErrors = Partial<
  Record<WorkshopRequisitesField, string>
>;

/** Колонки, которые читает lib/workshop/store.ts. */
export const WORKSHOP_REQUISITES_COLUMNS =
  "company_type, company_name, inn, ogrn, legal_address, bank_details, contact_phone, contact_email";

/** Пределы полей — как у `maxLength` в форме и check-ограничениях базы. */
export const REQUISITES_TEXT_LIMITS = {
  companyName: 200,
  inn: 12,
  ogrn: 15,
  legalAddress: 400,
  bankDetails: 600,
  contactPhone: 40,
  contactEmail: 160,
} as const;

/** ИНН: 10 цифр у организации, 12 — у ИП и самозанятого. */
const INN_PATTERN = /^\d{10}(?:\d{2})?$/u;

/** ОГРН: 13 цифр у организации, 15 — у ОГРНИП. */
const OGRN_PATTERN = /^\d{13}(?:\d{2})?$/u;

/** Email без пробелов: одна «собака» и точка в домене. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;

/** Телефон: цифры, пробелы, скобки, дефис и плюс — как в «+7 (999) 123-45-67». */
const PHONE_PATTERN = /^[+\d(][\d\s()-]*$/u;

/** Сколько цифр должно остаться в телефоне после чистки. */
const PHONE_MIN_DIGITS = 5;

/** Пробелы внутри ИНН и ОГРН не считаются содержимым: «7707 083 993» → цифры. */
const DIGIT_SPACES = /[\s\u00a0]/g;

/** Известен ли тип организации: чужая строка из FormData не пройдёт. */
export function isWorkshopCompanyType(
  value: unknown,
): value is WorkshopCompanyType {
  return COMPANY_TYPES.some((type) => type.value === value);
}

/** Подпись типа для интерфейса: «ИП», «ООО», «Самозанятый». */
export function workshopCompanyTypeLabel(type: WorkshopCompanyType): string {
  return (
    COMPANY_TYPES.find((item) => item.value === type)?.label ?? "Самозанятый"
  );
}

/** Текст из формы: пробелы по краям не считаются содержимым. */
function formText(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

/** Строка из базы: пустой текст — это «не заполнено», а не пустая строка. */
function rowText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  return text ? text : null;
}

/** Пришли ли данные вкладки «Реквизиты»: форма калькулятора их не содержит. */
export function hasWorkshopRequisitesFormFields(formData: FormData): boolean {
  return REQUISITES_FORM_NAMES.some((name) => formData.has(name));
}

/**
 * Строка `workshop_settings` → реквизиты для интерфейса.
 *
 * Незнакомый тип организации заменяется значением по умолчанию, пустые тексты
 * становятся null. Отсутствующая строка — реквизиты по умолчанию: форма
 * откроется пустой, а страница не упадёт.
 */
export function normalizeWorkshopRequisites(
  row: Partial<Record<string, unknown>> | null | undefined,
): WorkshopRequisites {
  if (!row) {
    return { ...WORKSHOP_REQUISITES_DEFAULTS };
  }

  return {
    companyType: isWorkshopCompanyType(row.company_type)
      ? row.company_type
      : WORKSHOP_REQUISITES_DEFAULTS.companyType,
    // В базе company_name not null, но пустая строка означает «ещё не
    // заполнено» — форма покажет пустое поле, а не пробел.
    companyName: rowText(row.company_name) ?? "",
    inn: rowText(row.inn),
    ogrn: rowText(row.ogrn),
    legalAddress: rowText(row.legal_address),
    bankDetails: rowText(row.bank_details),
    contactPhone: rowText(row.contact_phone),
    contactEmail: rowText(row.contact_email),
  };
}
type OptionalTextOptions = {
  label: string;
  maxLength: number;
  pattern?: RegExp;
  patternError?: string;
  /** Дополнительная проверка значения после проверки формата. */
  validate?: (value: string) => string | null;
  /** Что сохраняем: по умолчанию — текст без пробелов по краям. */
  normalize?: (text: string) => string;
};

/**
 * Необязательное текстовое поле.
 *
 * Пустое поле — это null, а не ошибка. Слишком длинный или битый текст
 * возвращает null и ошибку: частично сохранённые реквизиты хуже, чем честная
 * подсказка, какое поле исправить.
 */
function readOptionalText(
  formData: FormData,
  name: WorkshopRequisitesField,
  errors: WorkshopRequisitesErrors,
  options: OptionalTextOptions,
): string | null {
  const text = formText(formData, name);

  if (!text) {
    return null;
  }

  const value = options.normalize ? options.normalize(text) : text;

  if (value.length > options.maxLength) {
    errors[name] = `${options.label}: не больше ${options.maxLength} символов.`;
    return null;
  }

  if (options.pattern && !options.pattern.test(value)) {
    errors[name] = options.patternError ?? `${options.label}: проверьте формат.`;
    return null;
  }

  const invalid = options.validate?.(value) ?? null;

  if (invalid) {
    errors[name] = invalid;
    return null;
  }

  return value;
}

/** Обязательное текстовое поле: пустое или слишком длинное — ошибка. */
function readRequiredText(
  formData: FormData,
  name: WorkshopRequisitesField,
  errors: WorkshopRequisitesErrors,
  options: { label: string; maxLength: number },
): string {
  const text = formText(formData, name);

  if (!text) {
    errors[name] = `${options.label} — обязательное поле.`;
    return "";
  }

  if (text.length > options.maxLength) {
    errors[name] = `${options.label}: не больше ${options.maxLength} символов.`;
  }

  return text;
}

/** «7707 083 993» → «7707083993»: пробелы в ИНН и ОГРН не значимы. */
function despaceDigits(text: string): string {
  return text.replace(DIGIT_SPACES, "");
}



/**
 * Форма → реквизиты для записи.
 *
 * Возвращает либо полный набор полей, либо null и ошибки по полям. Тип
 * организации и название обязательны — без них непонятно, от чьего имени
 * выставлен документ.
 */
export function readWorkshopRequisitesForm(formData: FormData): {
  requisites: WorkshopRequisites | null;
  errors: WorkshopRequisitesErrors;
} {
  const errors: WorkshopRequisitesErrors = {};

  const companyType = formText(formData, "companyType");
  const requisites: WorkshopRequisites = {
    ...WORKSHOP_REQUISITES_DEFAULTS,
    companyType: isWorkshopCompanyType(companyType)
      ? companyType
      : WORKSHOP_REQUISITES_DEFAULTS.companyType,
  };

  if (!isWorkshopCompanyType(companyType)) {
    errors.companyType = "Выберите тип организации.";
  }

  requisites.companyName = readRequiredText(formData, "companyName", errors, {
    label: "Название компании или ФИО",
    maxLength: REQUISITES_TEXT_LIMITS.companyName,
  });

  requisites.inn = readOptionalText(formData, "inn", errors, {
    label: "ИНН",
    maxLength: REQUISITES_TEXT_LIMITS.inn,
    pattern: INN_PATTERN,
    patternError: "ИНН — 10 цифр у ООО и 12 цифр у ИП и самозанятого.",
    normalize: despaceDigits,
  });

  requisites.ogrn = readOptionalText(formData, "ogrn", errors, {
    label: "ОГРН/ОГРНИП",
    maxLength: REQUISITES_TEXT_LIMITS.ogrn,
    pattern: OGRN_PATTERN,
    patternError: "ОГРН — 13 цифр у ООО и 15 цифр у ОГРНИП.",
    normalize: despaceDigits,
  });

  requisites.legalAddress = readOptionalText(
    formData,
    "legalAddress",
    errors,
    {
      label: "Юридический адрес",
      maxLength: REQUISITES_TEXT_LIMITS.legalAddress,
    },
  );

  requisites.bankDetails = readOptionalText(formData, "bankDetails", errors, {
    label: "Банковские реквизиты",
    maxLength: REQUISITES_TEXT_LIMITS.bankDetails,
  });

  requisites.contactPhone = readOptionalText(formData, "contactPhone", errors, {
    label: "Телефон",
    maxLength: REQUISITES_TEXT_LIMITS.contactPhone,
    pattern: PHONE_PATTERN,
    patternError: "Телефон: цифры, пробелы, скобки, дефис и плюс.",
    validate: (value) =>
      value.replace(/\D/g, "").length >= PHONE_MIN_DIGITS
        ? null
        : "Телефон: не меньше 5 цифр.",
  });

  requisites.contactEmail = readOptionalText(formData, "contactEmail", errors, {
    label: "Email",
    maxLength: REQUISITES_TEXT_LIMITS.contactEmail,
    pattern: EMAIL_PATTERN,
    patternError: "Email: проверьте адрес — например, name@example.ru.",
  });

  return Object.keys(errors).length > 0
    ? { requisites: null, errors }
    : { requisites, errors };
}

