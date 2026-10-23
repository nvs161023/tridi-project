/**
 * Сохранённые проекты Конструктора 3D: общие правила.
 *
 * Модуль импортируют и клиентские окна конструктора, и Server Actions, и
 * кабинет. Здесь нет обращения к Supabase: только ограничения, типы и разбор
 * того, что вернула база, — поэтому один и тот же код проверяет форму в
 * браузере и на сервере.
 */
import {
  DEFAULT_CONSTRUCTOR_PARAMS,
  MODEL_TYPE_LABELS,
  normalizeConstructorParams,
  type ConstructorParams,
  type ModelType,
} from "@/lib/constructor/params";

/** Длина названия проекта: одна колонка ввода и одна проверка на двоих. */
export const SAVED_PROJECT_TITLE_MIN = 1;
export const SAVED_PROJECT_TITLE_MAX = 60;

/** Сколько последних проектов показываем в кабинете. */
export const SAVED_PROJECTS_LIMIT = 12;

/** Ограничения оценки обратной связи — те же, что в CHECK таблицы. */
export const FEEDBACK_RATING_MIN = 1;
export const FEEDBACK_RATING_MAX = 5;
export const FEEDBACK_TEXT_MAX = 1000;

/** Проект в списке кабинета: без параметров, чтобы не читать весь JSONB. */
export type SavedProjectSummary = {
  id: string;
  /** Название, придуманное пользователем. */
  title: string;
  /** Сырое значение колонки: подпись подбирает savedProjectModelLabel. */
  modelType: string;
  /** ISO-строка created_at. */
  createdAt: string;
};

/** Проект целиком: то, что конструктор применяет к своему состоянию. */
export type SavedProject = SavedProjectSummary & {
  params: ConstructorParams;
};

/** Сообщение о загрузке проекта в шапке конструктора. */
export type SavedProjectNotice = {
  tone: "success" | "error";
  message: string;
};

/** UUID из адреса и базы: только он уходит в фильтр запроса. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Проверяет идентификатор проекта.
 *
 * Строку из `?project=` пишет кто угодно, поэтому до запроса она должна быть
 * UUID: PostgREST на произвольный текст ответил бы 22P02, а мы хотим просто
 * «проект не найден».
 */
export function isProjectId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** Подпись модели из базы; незнакомое значение не ломает список в кабинете. */
export function savedProjectModelLabel(modelType: string): string {
  return modelType in MODEL_TYPE_LABELS
    ? MODEL_TYPE_LABELS[modelType as ModelType]
    : "3D-модель";
}

/** Дата создания проекта в кабинете: «23 октября 2026 г.». */
export function formatSavedProjectDate(createdAt: string): string {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "Дата неизвестна";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Название без двойных пробелов: подпись в списке и в базе совпадают. */
export function normalizeProjectTitle(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/**
 * Название по умолчанию для окна сохранения.
 *
 * Считается в обработчике клика, а не при отрисовке: дата на сервере и в
 * браузере может отличаться на день, и тогда разметка разошлась бы при
 * гидратации.
 */
export function suggestProjectTitle(
  model: ModelType,
  now = new Date(),
): string {
  const date = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  }).format(now);

  return `${MODEL_TYPE_LABELS[model]} — ${date}`;
}

/**
 * Приводит params_json из базы к состоянию конструктора.
 *
 * В JSONB может лежать что угодно: проект сохраняли прошлой версией панели или
 * строку правили руками. normalizeConstructorParams зажимает числа в границы
 * слайдеров и подставляет дефолты, поэтому в предпросмотр не попадут мусорные
 * размеры. Незнакомая модель превращается в вазу.
 */
export function normalizeSavedProjectParams(value: unknown): ConstructorParams {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return DEFAULT_CONSTRUCTOR_PARAMS;
  }

  return normalizeConstructorParams(value as Partial<ConstructorParams>);
}

/**
 * Миграции применяют вручную, поэтому таблицы может ещё не быть.
 *
 * PostgREST отвечает 42P01 (relation does not exist), PGRST205 (таблица не
 * найдена в схеме) или PGRST204 (колонки нет). Эти ошибки не должны выглядеть
 * как поломка страницы: конструктор продолжает работать, а сохранение или
 * оценка честно сообщают, что пока недоступны. Проверка общая для
 * saved_projects и constructor_feedback.
 */
export function isMissingTableSchema(
  code: string | null | undefined,
  message: string | null | undefined,
): boolean {
  if (code === "42P01" || code === "PGRST204" || code === "PGRST205") {
    return true;
  }

  const text = (message ?? "").toLowerCase();

  return (
    text.includes("does not exist") ||
    text.includes("could not find the table") ||
    text.includes("schema cache")
  );
}
