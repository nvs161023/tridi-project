/**
 * Правило доступа к готовому STL: владелец или опубликованная модель.
 *
 * Функция не делает запросов и используется роутом скачивания. Отдельный
 * модуль нужен, чтобы проверку можно было покрыть тестом без Supabase и чтобы
 * «чужой taskId» и «чужая модель» решались одним и тем же правилом.
 */
export type GenerationAccess = {
  /** Владелец строки `generations`. */
  userId: string;
  /** Флаг публикации: `true` открывает скачивание остальным вошедшим. */
  isPublic: boolean;
};

/** Может ли пользователь скачать файл этой генерации. */
export function canAccessGeneration(
  currentUserId: string,
  generation: GenerationAccess,
): boolean {
  return generation.userId === currentUserId || generation.isPublic;
}
