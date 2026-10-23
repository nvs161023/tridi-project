/**
 * Сохранённые проекты Конструктора 3D: чтение из Supabase.
 *
 * Запись и проверка прав живут в Server Actions (`app/actions/projects.ts`):
 * там же повторная авторизация. Здесь только запросы, которые нужны и кабинету,
 * и конструктору.
 */
import type { createClient } from "@/lib/supabase/server";
import {
  SAVED_PROJECTS_LIMIT,
  isProjectId,
  normalizeProjectTitle,
  normalizeSavedProjectParams,
  type SavedProject,
  type SavedProjectSummary,
} from "@/lib/constructor/projects";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Колонки, которые читаем: params_json только для одного проекта. */
type SavedProjectRow = {
  id?: string | null;
  title?: string | null;
  model_type?: string | null;
  params_json?: unknown;
  created_at?: string | null;
};

/**
 * Последние проекты пользователя для блока «Мои 3D-проекты».
 *
 * Ошибку не пробрасываем: кабинет показывает остальные разделы, даже если
 * миграция ещё не применена. В лог уходят только код и текст — они не содержат
 * данных пользователя.
 */
export async function getSavedProjects(
  supabase: Supabase,
  userId: string,
  limit = SAVED_PROJECTS_LIMIT,
): Promise<SavedProjectSummary[]> {
  const { data, error } = await supabase
    .from("saved_projects")
    .select("id, title, model_type, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn(
      "Не удалось прочитать сохранённые проекты:",
      error.code,
      error.message,
    );

    return [];
  }

  return ((data as SavedProjectRow[] | null) ?? []).flatMap((row) => {
    if (!row.id || !row.created_at) {
      return [];
    }

    return [
      {
        id: row.id,
        title: normalizeProjectTitle(row.title) || "Без названия",
        modelType: row.model_type ?? "",
        createdAt: row.created_at,
      },
    ];
  });
}

/**
 * Один проект по идентификатору из адреса.
 *
 * Фильтр по user_id дублирует RLS: чужой id не откроется даже клиентом
 * service role, если он когда-нибудь сюда попадёт. params_json нормализуется —
 * в базу он мог попасть от прошлой версии панели.
 */
export async function getSavedProject(
  supabase: Supabase,
  userId: string,
  projectId: string,
): Promise<SavedProject | null> {
  if (!isProjectId(projectId)) {
    return null;
  }

  const { data, error } = await supabase
    .from("saved_projects")
    .select("id, title, model_type, params_json, created_at")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Проект не прочитан:", error.code, error.message);

    return null;
  }

  if (!data) {
    return null;
  }

  const row = data as SavedProjectRow;

  if (!row.id || !row.created_at) {
    return null;
  }

  return {
    id: row.id,
    title: normalizeProjectTitle(row.title) || "Без названия",
    modelType: row.model_type ?? "",
    createdAt: row.created_at,
    params: normalizeSavedProjectParams(row.params_json),
  };
}
