/**
 * Типы ответов Server Actions конструктора.
 *
 * Отдельный модуль без "use server": клиентские окна импортируют только типы,
 * а сами действия лежат в projects.ts. Так окно сохранения не тянет в бандл
 * серверный код Supabase.
 */
import type { ConstructorParams } from "@/lib/constructor/params";
import type { SavedProject } from "@/lib/constructor/projects";

/** Итог сохранения: id возвращаем, чтобы ссылку можно было открыть сразу. */
export type SaveProjectResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/** Итог загрузки: параметры уже нормализованы для состояния конструктора. */
export type LoadProjectResult =
  | { ok: true; project: SavedProject }
  | { ok: false; error: string };

/** Итог отправки оценки. */
export type FeedbackResult = { ok: true } | { ok: false; error: string };

/** Что приходит из окна «Название проекта». */
export type SaveProjectInput = {
  title: string;
  params: ConstructorParams;
};

/** Что приходит из окна обратной связи после скачивания. */
export type FeedbackInput = {
  modelType: string;
  rating: number;
  feedbackText: string;
};
