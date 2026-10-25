/**
 * База клиентов Мастерской: чтение `workshop_clients` и добавление контакта.
 *
 * Миграцию `supabase/workshop_clients.sql` применяют вручную, поэтому таблицы
 * может не быть в живой базе. Как и у каталога товаров, это не повод падать:
 * страница получает пустой список, а действие — понятное сообщение о миграции.
 *
 * `addClient` помечен `"use server"` прямо в функции: файл лежит в `lib`, но
 * вызывается из браузера как Server Action через тонкую обёртку
 * `app/actions/clients.ts` — Next разрешает клиенту только модуль с директивой
 * наверху. `getWorkshopClients` — обычная серверная функция для страницы.
 */
import { revalidatePath } from "next/cache";

import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import { createClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";

/** Клиент в том виде, в каком с ним работает интерфейс. */
export type WorkshopClient = {
  id: string;
  /** ФИО или название компании; единственное обязательное поле. */
  name: string;
  phone: string | null;
  email: string | null;
  /** Адрес доставки. */
  address: string | null;
  /** Заметки: скидка, особенности заказа, удобное время. */
  notes: string | null;
  createdAt: string | null;
};

/** Поля формы «Добавить клиента» — по ним же отдаются ошибки. */
export type ClientField = "name" | "phone" | "email" | "address" | "notes";

export type ClientFieldErrors = Partial<Record<ClientField, string>>;

/** Ответ Server Action: либо ошибки, либо успех с готовым сообщением. */
export type AddClientResult = {
  error?: string;
  fieldErrors?: ClientFieldErrors;
  success?: boolean;
  message?: string;
};

/** Колонки, которые читает getWorkshopClients. */
export const CLIENT_COLUMNS =
  "id, name, phone, email, address, notes, created_at";

/** Пределы текстовых полей — как у `maxLength` в форме. */
export const CLIENT_TEXT_LIMITS = {
  name: 160,
  phone: 40,
  email: 160,
  address: 300,
  notes: 2000,
} as const;

/** Сколько цифр должно остаться в телефоне после чистки. */
const PHONE_MIN_DIGITS = 5;

/** Телефон: цифры, пробелы, скобки, дефис и плюс — как в «+7 (999) 123-45-67». */
const PHONE_PATTERN = /^[+\d(][\d\s()-]*$/u;

/** Email без пробелов: одна «собака» и точка в домене. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SESSION_EXPIRED =
  "Сессия истекла. Войдите снова, чтобы добавить клиента.";
const PRO_REQUIRED =
  "Мастерская входит в пакет «Всё включено». Оформите доступ, чтобы вести базу клиентов.";
const MIGRATION_MISSING =
  "База клиентов пока не сохраняется: в базе нет таблицы workshop_clients. Примените миграцию supabase/workshop_clients.sql.";
const ADD_FAILED =
  "Не удалось добавить клиента. Попробуйте ещё раз.";

/** Проверенный ввод формы. Пустые необязательные поля — null. */
type ClientDraft = {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};

/** Текст из формы: пробелы по краям не считаются содержимым. */
function readFormText(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

/**
 * Текст формы с проверкой длины.
 *
 * `requiredMessage` задан только у обязательного поля: пустое необязательное
 * поле превращается в null, а не в ошибку.
 */
function readTextValue(
  formData: FormData,
  name: string,
  limit: number,
  errors: ClientFieldErrors,
  field: ClientField,
  requiredMessage: string | null = null,
): string | null {
  const text = readFormText(formData, name);

  if (!text) {
    if (requiredMessage) {
      errors[field] = requiredMessage;
    }

    return null;
  }

  if (text.length > limit) {
    errors[field] = `Не больше ${limit} символов.`;

    return null;
  }

  return text;
}

/**
 * Форма «Добавить клиента» → проверенные значения.
 *
 * Имя обязательно, остальное — нет. Телефон и email проверяются только когда
 * заполнены: формат ловит опечатки, но не заставляет заполнять оба поля.
 */
function readClientForm(formData: FormData): {
  draft: ClientDraft | null;
  errors: ClientFieldErrors;
} {
  const errors: ClientFieldErrors = {};
  const name = readTextValue(
    formData,
    "name",
    CLIENT_TEXT_LIMITS.name,
    errors,
    "name",
    "Введите имя или название клиента.",
  );
  const phone = readTextValue(
    formData,
    "phone",
    CLIENT_TEXT_LIMITS.phone,
    errors,
    "phone",
  );
  const email = readTextValue(
    formData,
    "email",
    CLIENT_TEXT_LIMITS.email,
    errors,
    "email",
  );
  const address = readTextValue(
    formData,
    "address",
    CLIENT_TEXT_LIMITS.address,
    errors,
    "address",
  );
  const notes = readTextValue(
    formData,
    "notes",
    CLIENT_TEXT_LIMITS.notes,
    errors,
    "notes",
  );

  if (phone) {
    const digits = phone.replace(/\D/g, "");

    if (!PHONE_PATTERN.test(phone)) {
      errors.phone =
        "Телефон: цифры, пробелы, скобки, дефис и плюс.";
    } else if (digits.length < PHONE_MIN_DIGITS) {
      errors.phone = "В телефоне мало цифр.";
    }
  }

  if (email && !EMAIL_PATTERN.test(email)) {
    errors.email = "Проверьте email: нужен адрес вида name@example.com.";
  }

  if (Object.keys(errors).length > 0 || !name) {
    return { draft: null, errors };
  }

  return {
    draft: { name, phone, email, address, notes },
    errors,
  };
}

/** Текст из строки базы: пробелы убираем, пустое значение — null. */
function readStoredText(value: unknown, limit: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim().slice(0, limit);

  return text || null;
}

/**
 * Строка `workshop_clients` → клиент для интерфейса.
 *
 * Строка без корректного id или имени отбрасывается: такого клиента нельзя ни
 * показать, ни подставить в заказ. Остальные поля нормализуются, чтобы пустые
 * строки из базы стали null и таблица рисовала прочерк.
 */
export function normalizeClientRow(
  row: Partial<Record<string, unknown>> | null | undefined,
): WorkshopClient | null {
  if (
    !row ||
    typeof row.id !== "string" ||
    !UUID_PATTERN.test(row.id)
  ) {
    return null;
  }

  const name = readStoredText(row.name, CLIENT_TEXT_LIMITS.name);

  if (!name) {
    return null;
  }

  return {
    id: row.id,
    name,
    phone: readStoredText(row.phone, CLIENT_TEXT_LIMITS.phone),
    email: readStoredText(row.email, CLIENT_TEXT_LIMITS.email),
    address: readStoredText(row.address, CLIENT_TEXT_LIMITS.address),
    notes: readStoredText(row.notes, CLIENT_TEXT_LIMITS.notes),
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
  };
}

/**
 * Клиенты текущего пользователя: новые сверху.
 *
 * Любая ошибка — в том числе неприменённая миграция или истёкшая сессия —
 * означает пустой список: вкладка должна открыться, а не упасть с 500.
 * Ошибку пишем в консоль сервера, пользователю её покажет само действие.
 */
export async function getWorkshopClients(): Promise<WorkshopClient[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("workshop_clients")
    .select(CLIENT_COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Клиенты мастерской не прочитаны:", error.code, error.message);

    return [];
  }

  const rows = (data ?? []) as Partial<Record<string, unknown>>[];

  return rows
    .map(normalizeClientRow)
    .filter((client): client is WorkshopClient => client !== null);
}

/**
 * Добавление клиента в базу.
 *
 * Порядок проверок тот же, что у товаров: разбор формы → сессия → подписка →
 * запись. Server Action — публичный endpoint, поэтому подписка проверяется
 * здесь, а не только на странице. RLS дополнительно сверяет `auth.uid()`, так
 * что записать клиента другому мастеру нельзя даже подделав `user_id`.
 */
export async function addClient(
  formData: FormData,
): Promise<AddClientResult> {
  "use server";

  const { draft, errors } = readClientForm(formData);

  if (!draft) {
    return { fieldErrors: errors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: SESSION_EXPIRED, fieldErrors: errors };
  }

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return { error: PRO_REQUIRED, fieldErrors: errors };
  }

  const { error } = await supabase.from("workshop_clients").insert({
    user_id: user.id,
    name: draft.name,
    phone: draft.phone,
    email: draft.email,
    address: draft.address,
    notes: draft.notes,
  });

  if (error) {
    console.warn("Клиент не добавлен:", error.code, error.message);

    return {
      error: isMissingTableSchema(error.code, error.message)
        ? MIGRATION_MISSING
        : ADD_FAILED,
    };
  }

  // Таблица рисуется на сервере: без этого новый клиент появится только после
  // ручной перезагрузки страницы.
  revalidatePath("/dashboard/workshop");

  return {
    success: true,
    message: `Клиент «${draft.name}» добавлен.`,
  };
}
