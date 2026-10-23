"use server";

import { revalidatePath } from "next/cache";

import type {
  FeedbackInput,
  FeedbackResult,
  LoadProjectResult,
  SaveProjectInput,
  SaveProjectResult,
} from "@/app/actions/projects-state";
import {
  isModelType,
  normalizeConstructorParams,
  type ConstructorParams,
} from "@/lib/constructor/params";
import { getSavedProject } from "@/lib/constructor/project-store";
import {
  FEEDBACK_RATING_MAX,
  FEEDBACK_RATING_MIN,
  FEEDBACK_TEXT_MAX,
  SAVED_PROJECT_TITLE_MAX,
  SAVED_PROJECT_TITLE_MIN,
  isMissingTableSchema,
  isProjectId,
  normalizeProjectTitle,
} from "@/lib/constructor/projects";
import { createClient } from "@/lib/supabase/server";

const PROJECTS_UNAVAILABLE =
  "Сохранение проектов временно недоступно. Попробуйте позже.";
const FEEDBACK_UNAVAILABLE =
  "Обратная связь временно недоступна — попробуйте позже.";
const SESSION_EXPIRED = "Сессия истекла. Войдите в аккаунт заново.";

/**
 * Параметры модели из браузера.
 *
 * Клиент присылает объект ConstructorParams, но доверять ему нельзя: подмена
 * запроса в DevTools не должна записать в базу строку вместо числа.
 * normalizeConstructorParams зажимает размеры в границы слайдеров и заменяет
 * незнакомые варианты дефолтами — то же правило, что в панели и API STL.
 */
function readParams(value: unknown): ConstructorParams {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return normalizeConstructorParams({});
  }

  return normalizeConstructorParams(value as Partial<ConstructorParams>);
}

/** Значение model до нормализации: по нему отклоняем чужой тип модели. */
function readModel(value: unknown): unknown {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as { model?: unknown }).model
    : undefined;
}

/**
 * Сохраняет текущие настройки модели под названием пользователя.
 *
 * Идентификатор пользователя берём из сессии, а не из запроса: иначе проект
 * можно было бы записать в чужой аккаунт. Права всё равно повторно проверяет
 * RLS — политика insert требует user_id = auth.uid().
 */
export async function saveConstructorProject(
  input: SaveProjectInput,
): Promise<SaveProjectResult> {
  const title = normalizeProjectTitle(input?.title);

  if (title.length < SAVED_PROJECT_TITLE_MIN) {
    return { ok: false, error: "Введите название проекта." };
  }

  if (title.length > SAVED_PROJECT_TITLE_MAX) {
    return {
      ok: false,
      error: `Название длиннее ${SAVED_PROJECT_TITLE_MAX} символов. Сократите его.`,
    };
  }

  const model = readModel(input?.params);

  if (model !== undefined && !isModelType(model)) {
    return {
      ok: false,
      error: "Неизвестная модель. Обновите страницу и попробуйте снова.",
    };
  }

  const params = readParams(input?.params);

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: SESSION_EXPIRED };
  }

  const { data, error } = await supabase
    .from("saved_projects")
    .insert({
      user_id: user.id,
      title,
      // Колонка нужна списку в кабинете: без неё пришлось бы читать весь JSONB.
      model_type: params.model,
      params_json: params,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.warn(
      "Проект не сохранён:",
      error?.code ?? "нет ответа",
      error?.message ?? "пустая строка",
    );

    if (isMissingTableSchema(error?.code, error?.message)) {
      return { ok: false, error: PROJECTS_UNAVAILABLE };
    }

    if (error?.code === "42501") {
      return { ok: false, error: SESSION_EXPIRED };
    }

    if (error?.code === "23514") {
      return {
        ok: false,
        error: "Название проекта не подошло. Измените его и попробуйте снова.",
      };
    }

    return {
      ok: false,
      error: "Не удалось сохранить проект. Попробуйте ещё раз.",
    };
  }

  // Список проектов в кабинете собирается на сервере — обновляем его кэш,
  // чтобы новый проект был виден сразу после возврата из конструктора.
  revalidatePath("/dashboard");

  return { ok: true, id: String(data.id) };
}

/**
 * Отдаёт сохранённый проект конструктору по идентификатору из адреса.
 *
 * Идентификатор проверяется как UUID до запроса: строка в `?project=` приходит
 * от кого угодно. Фильтр по user_id не даёт открыть чужой проект даже зная id,
 * а RLS повторяет то же условие в базе.
 */
export async function loadConstructorProject(
  projectId: string,
): Promise<LoadProjectResult> {
  if (!isProjectId(projectId)) {
    return { ok: false, error: "Проект не найден." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: SESSION_EXPIRED };
  }

  const project = await getSavedProject(supabase, user.id, projectId);

  if (!project) {
    return { ok: false, error: "Проект не найден или недоступен." };
  }

  return { ok: true, project };
}

/**
 * Сохраняет оценку конструктора после скачивания STL.
 *
 * Окно открывается по счётчику в браузере, поэтому сервер проверяет только
 * форму записи: оценка 1–5 целым числом, известная модель, комментарий в
 * пределах лимита. Пустой комментарий пишется как NULL — это не ошибка.
 */
export async function submitConstructorFeedback(
  input: FeedbackInput,
): Promise<FeedbackResult> {
  const rating = Number(input?.rating);

  if (
    !Number.isInteger(rating) ||
    rating < FEEDBACK_RATING_MIN ||
    rating > FEEDBACK_RATING_MAX
  ) {
    return {
      ok: false,
      error: `Поставьте оценку от ${FEEDBACK_RATING_MIN} до ${FEEDBACK_RATING_MAX} звёзд.`,
    };
  }

  const modelType = typeof input?.modelType === "string" ? input.modelType : "";

  if (!isModelType(modelType)) {
    return {
      ok: false,
      error: "Неизвестная модель. Обновите страницу и попробуйте снова.",
    };
  }

  const feedbackText =
    typeof input?.feedbackText === "string"
      ? input.feedbackText.replace(/\r\n/g, "\n").trim()
      : "";

  if (feedbackText.length > FEEDBACK_TEXT_MAX) {
    return {
      ok: false,
      error: `Комментарий длиннее ${FEEDBACK_TEXT_MAX} символов. Сократите его.`,
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: SESSION_EXPIRED };
  }

  const { error } = await supabase.from("constructor_feedback").insert({
    user_id: user.id,
    model_type: modelType,
    rating,
    feedback_text: feedbackText || null,
  });

  if (error) {
    console.warn("Обратная связь не сохранена:", error.code, error.message);

    if (isMissingTableSchema(error.code, error.message)) {
      return { ok: false, error: FEEDBACK_UNAVAILABLE };
    }

    return {
      ok: false,
      error: "Не удалось отправить оценку. Попробуйте ещё раз.",
    };
  }

  return { ok: true };
}
