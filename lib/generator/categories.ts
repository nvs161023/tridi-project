/**
 * Категории 3D-моделей по фото: один список на генератор, галерею и «Мои модели».
 *
 * Модуль не обращается к Supabase и не импортирует серверный код: его читают
 * клиентский генератор, клиентская карточка, серверные страницы и роут
 * генерации. Поэтому значения категорий, их подписи и разбор того, что пришло
 * из базы или из адреса, живут в одном месте.
 *
 * Значения совпадают с ограничением `generations_category_check`
 * (supabase/generations_category.sql): добавить категорию — значит поправить
 * список здесь и ограничение в базе.
 */

/** Имя параметра в адресе галереи: `/gallery?category=toy`. */
export const GALLERY_CATEGORY_PARAM = "category";

/** Категория, которую получает модель, если пользователь ничего не выбрал. */
export const DEFAULT_GENERATION_CATEGORY: GenerationCategory = "other";

export type GenerationCategory =
  | "toy"
  | "figure"
  | "decor"
  | "functional"
  | "other";

/** Описание категории: подписи для селекта, фильтра и бейджа на карточке. */
export type GenerationCategoryInfo = {
  value: GenerationCategory;
  /** Название в селекте генератора и «Моих моделях». */
  label: string;
  /** Уточнение для селекта: «люди, животные»; null — уточнять нечего. */
  hint: string | null;
  /** Короткая подпись фильтра и бейджа: у `functional` — «Детали». */
  shortLabel: string;
};

/** «Другое» — значение по умолчанию; описано один раз для списка и запасного пути. */
const OTHER_CATEGORY: GenerationCategoryInfo = {
  value: "other",
  label: "Другое",
  hint: null,
  shortLabel: "Другое",
};

/**
 * Порядок — как в задаче и в фильтре галереи: от игрушек к «Другому».
 * «Другое» стоит последним: это значение по умолчанию, а не первый выбор.
 */
export const GENERATION_CATEGORIES: readonly GenerationCategoryInfo[] = [
  {
    value: "toy",
    label: "Игрушки",
    hint: null,
    shortLabel: "Игрушки",
  },
  {
    value: "figure",
    label: "Фигурки",
    hint: "люди, животные",
    shortLabel: "Фигурки",
  },
  {
    value: "decor",
    label: "Декор",
    hint: "вазы, статуэтки",
    shortLabel: "Декор",
  },
  {
    value: "functional",
    label: "Функциональные детали",
    hint: "крепления, запчасти",
    shortLabel: "Детали",
  },
  OTHER_CATEGORY,
];

/** Проверка значения: строка из адреса, тела запроса или базы. */
export function isGenerationCategory(
  value: unknown,
): value is GenerationCategory {
  return (
    typeof value === "string" &&
    GENERATION_CATEGORIES.some((category) => category.value === value)
  );
}

/**
 * Категория из незнакомого значения или `null`.
 *
 * `null` значит «значение не наше»: вызывающий код сам решает, ответить 400 на
 * неизвестное поле или подставить категорию по умолчанию (например, когда
 * колонку в базе ещё не добавили).
 */
export function parseGenerationCategory(
  value: unknown,
): GenerationCategory | null {
  return isGenerationCategory(value) ? value : null;
}

/** Описание категории по значению; неизвестное значение читается как «Другое». */
export function generationCategoryInfo(
  value: GenerationCategory | string | null | undefined,
): GenerationCategoryInfo {
  const known = parseGenerationCategory(value) ?? DEFAULT_GENERATION_CATEGORY;

  return (
    GENERATION_CATEGORIES.find((category) => category.value === known) ??
    OTHER_CATEGORY
  );
}

/** Полное название категории: селект и текст пустого состояния. */
export function generationCategoryLabel(value: string | null | undefined): string {
  return generationCategoryInfo(value).label;
}

/** Короткая подпись для бейджа на карточке и кнопки фильтра. */
export function generationCategoryShortLabel(
  value: string | null | undefined,
): string {
  return generationCategoryInfo(value).shortLabel;
}
