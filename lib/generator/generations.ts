/**
 * История генераций 3D-моделей: общие правила.
 *
 * Модуль импортируют и клиентская карточка, и Server Actions, и страницы, и
 * роут скачивания. Обращения к Supabase здесь нет: только константы, типы и
 * разбор того, что вернула база, — поэтому одни и те же подписи и проверки
 * работают в браузере и на сервере.
 */
import { type GenerationCategory } from "@/lib/generator/categories";
import type { GeneratorService } from "@/lib/generator/photo-generator";

/** Таблица истории — она же в supabase/generations.sql. */
export const GENERATIONS_TABLE = "generations";

/** Закрытый бакет, в котором живёт STL истории. */
export const GENERATED_MODELS_BUCKET = "generated-models";

/** Сколько последних моделей показывают «Мои модели» и галерея. */
export const GENERATIONS_LIMIT = 24;

/**
 * Сколько живёт подписанная ссылка на STL для предпросмотра.
 *
 * Час — с запасом на открытую вкладку: ссылка нужна вьюверу один раз при
 * загрузке модели, а не для скачивания (его отдаёт отдельный роут).
 */
export const GENERATION_PREVIEW_TTL_SECONDS = 60 * 60;

/** Подписи сетей в карточках: значения колонки service. */
export const GENERATION_SERVICE_LABELS: Record<GeneratorService, string> = {
  tripo: "Tripo3D",
  meshy: "Meshy",
};

/** Модель в списке: без пути к файлу и без подписанной ссылки. */
export type GenerationSummary = {
  id: string;
  /** Сеть, которая считала задачу. */
  service: GeneratorService;
  /** Категория модели: выбирается в генераторе, меняется в «Моих моделях». */
  category: GenerationCategory;
  /** Показывать в галерее: переключает владелец. */
  isPublic: boolean;
  /** Готовая подпись даты: её считает сервер, чтобы не было расхождения. */
  createdAtLabel: string;
};

/** Карточка с превью: `null` — файл есть, но подписать ссылку не удалось. */
export type GenerationCardData = GenerationSummary & {
  previewUrl: string | null;
};

/** Строка, у которой уже есть файл: её можно скачать и показать. */
export type StoredGeneration = GenerationSummary & {
  /** Путь объекта в бакете `generated-models`. */
  stlPath: string;
};

/** UUID из адреса и базы: только он уходит в фильтр запроса. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Проверяет идентификатор генерации.
 *
 * Строку из адреса пишет кто угодно, поэтому до запроса она должна быть UUID:
 * PostgREST на произвольный текст ответил бы 22P02, а мы хотим просто
 * «модель не найдена».
 */
export function isGenerationId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** Известная сеть из базы или `null`: незнакомое значение список не ломает. */
export function parseGenerationService(
  value: unknown,
): GeneratorService | null {
  return value === "tripo" || value === "meshy" ? value : null;
}

/** Подпись сети в карточке; незнакомая строка читается как «3D-модель». */
export function generationServiceLabel(service: string): string {
  const known = parseGenerationService(service);

  return known ? GENERATION_SERVICE_LABELS[known] : "3D-модель";
}

/** Дата генерации в карточке: «16 ноября 2026 г., 14:05». */
export function formatGenerationDate(createdAt: string): string {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "Дата неизвестна";
  }

  // Время показываем в UTC, чтобы подпись не зависела от часового пояса
  // сервера: страницы собираются на каждый запрос, а карточка клиентская.
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Ссылка на скачивание STL.
 *
 * Ведёт не в бакет, а в наш роут: он проверяет сессию и право на модель, а
 * затем отдаёт файл через service_role. Прямая ссылка на приватный бакет
 * выдала бы файл любому или никому.
 */
export function generationStlHref(id: string): string {
  return `/api/generations/${encodeURIComponent(id)}/stl`;
}
