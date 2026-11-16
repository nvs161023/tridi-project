/**
 * Типы Server Actions истории генераций.
 *
 * Живут отдельно от самих действий: клиентская карточка импортирует только их,
 * а не серверный модуль с `"use server"`.
 */
import type { GenerationCategory } from "@/lib/generator/categories";

export type UpdateGenerationVisibilityInput = {
  id: string;
  isPublic: boolean;
};

export type UpdateGenerationVisibilityResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Смена категории модели из «Моих моделей».
 *
 * Идентификатор и категория приходят из браузера, поэтому проверяются оба:
 * `id` — как UUID, `category` — по списку `GENERATION_CATEGORIES`.
 */
export type UpdateGenerationCategoryInput = {
  id: string;
  category: GenerationCategory;
};

/** Ответ тот же, что у публикации: карточка показывает одну строку ошибки. */
export type UpdateGenerationCategoryResult = UpdateGenerationVisibilityResult;
