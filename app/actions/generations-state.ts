/**
 * Результат переключателя «Показывать в галерее».
 *
 * Тип живёт отдельно от Server Action: клиентская карточка импортирует только
 * его, а не серверный модуль с `"use server"`.
 */
export type UpdateGenerationVisibilityInput = {
  id: string;
  isPublic: boolean;
};

export type UpdateGenerationVisibilityResult =
  | { ok: true }
  | { ok: false; error: string };
