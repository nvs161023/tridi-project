/**
 * Каталог профилей печати.
 *
 * Метаданные лежат в data/profiles.json, а сами файлы — в папке profiles/.
 * Страница /profiles и API-роут скачивания читают каталог отсюда, поэтому
 * список карточек и список разрешённых файлов всегда совпадают.
 *
 * Скачивание идёт только по id: путь из адреса никогда не попадает в
 * файловую систему напрямую (см. app/api/profiles/download/route.ts).
 */
import profilesData from "@/data/profiles.json";

export type ProfileFormat = "JSON" | "INI";

/** Один профиль: описание для карточки и путь к файлу внутри profiles/. */
export type PrintProfile = {
  /** Стабильный идентификатор для ссылки на скачивание. */
  id: string;
  title: string;
  description: string;
  /** Принтер или производитель материала. */
  device: string;
  /** В каком слайсере открывается файл. */
  slicer: string;
  format: ProfileFormat;
  /** Базовый профиль, который должен быть установлен в слайсере. */
  requires: string;
  /** Путь относительно корня profiles/. */
  file: string;
};

export type ProfileCategory = {
  id: string;
  title: string;
  description: string;
  profiles: PrintProfile[];
};

type ProfilesCatalog = {
  /** Дата сверки профилей с источниками (ISO). */
  updated: string;
  categories: ProfileCategory[];
};

const catalog = profilesData as ProfilesCatalog;

/** Категории в порядке показа на странице. */
export const profileCategories: ProfileCategory[] = catalog.categories;

/** Все профили одним списком — для поиска по id и счётчиков. */
export const allProfiles: PrintProfile[] = profileCategories.flatMap(
  (category) => category.profiles,
);

/** Сколько всего файлов в библиотеке. */
export const profileCount = allProfiles.length;

/** Дата обновления каталога в ISO-формате. */
export const profilesUpdatedAt = catalog.updated;

/** Профиль по id или null, если такого нет. */
export function findProfileById(id: string): PrintProfile | null {
  return allProfiles.find((profile) => profile.id === id) ?? null;
}

/** Расширение файла: JSON для Orca/Bambu, INI для PrusaSlicer. */
export function profileExtension(profile: PrintProfile): "json" | "ini" {
  return profile.format === "INI" ? "ini" : "json";
}

/** MIME-тип файла профиля. */
export function profileContentType(profile: PrintProfile): string {
  return profile.format === "INI"
    ? "text/plain; charset=utf-8"
    : "application/json; charset=utf-8";
}
