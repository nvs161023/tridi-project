"use server";

import { revalidatePath } from "next/cache";

import type {
  UpdateGenerationCategoryInput,
  UpdateGenerationCategoryResult,
  UpdateGenerationVisibilityInput,
  UpdateGenerationVisibilityResult,
} from "@/app/actions/generations-state";
import { isGenerationCategory } from "@/lib/generator/categories";
import {
  GENERATIONS_TABLE,
  isGenerationId,
} from "@/lib/generator/generations";
import {
  isMissingColumnSchema,
  isMissingTableSchema,
} from "@/lib/supabase/schema-errors";
import { createClient } from "@/lib/supabase/server";

const GENERATIONS_UNAVAILABLE =
  "История генераций временно недоступна. Попробуйте позже.";
const CATEGORY_UNAVAILABLE =
  "Смена категории пока недоступна: поле ещё не добавлено в базу.";
const SESSION_EXPIRED = "Сессия истекла. Войдите в аккаунт заново.";
const MODEL_NOT_FOUND = "Модель не найдена или недоступна.";

/**
 * Публикует модель в галерее или снова скрывает её.
 *
 * Идентификатор приходит из браузера, поэтому сначала проверяется как UUID, а
 * фильтр по `user_id` не даёт переключить чужую модель даже зная id. RLS
 * повторяет то же условие в базе, а `.select("id")` показывает, нашлась ли
 * строка: PostgREST на update без строк отвечает успешно.
 */
export async function setGenerationVisibility(
  input: UpdateGenerationVisibilityInput,
): Promise<UpdateGenerationVisibilityResult> {
  if (!isGenerationId(input?.id) || typeof input?.isPublic !== "boolean") {
    return { ok: false, error: MODEL_NOT_FOUND };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: SESSION_EXPIRED };
  }

  const { data, error } = await supabase
    .from(GENERATIONS_TABLE)
    .update({ is_public: input.isPublic })
    .eq("id", input.id)
    .eq("user_id", user.id)
    // Пока модель не готова, публиковать нечего: в галерее нет превью и файла.
    .not("stl_url", "is", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn(
      "Публикация модели не изменена:",
      error.code ?? "нет ответа",
      error.message,
    );

    if (isMissingTableSchema(error.code, error.message)) {
      return { ok: false, error: GENERATIONS_UNAVAILABLE };
    }

    if (error.code === "42501") {
      return { ok: false, error: SESSION_EXPIRED };
    }

    return {
      ok: false,
      error: "Не удалось изменить публикацию. Попробуйте ещё раз.",
    };
  }

  if (!data) {
    return { ok: false, error: MODEL_NOT_FOUND };
  }

  // Обе страницы собираются на сервере: после переключения их кэш устарел.
  revalidatePath("/my-models");
  revalidatePath("/gallery");

  return { ok: true };
}

/**
 * Меняет категорию уже сгенерированной модели.
 *
 * Нужно на случай ошибки при выборе в генераторе: модель могла уехать не в ту
 * вкладку галереи. Проверки те же, что у публикации — UUID, значение из списка,
 * сессия и `user_id` в фильтре, чтобы чужую модель нельзя было переписать,
 * зная только её id.
 */
export async function setGenerationCategory(
  input: UpdateGenerationCategoryInput,
): Promise<UpdateGenerationCategoryResult> {
  if (!isGenerationId(input?.id) || !isGenerationCategory(input?.category)) {
    return { ok: false, error: MODEL_NOT_FOUND };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: SESSION_EXPIRED };
  }

  const { data, error } = await supabase
    .from(GENERATIONS_TABLE)
    .update({ category: input.category })
    .eq("id", input.id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn(
      "Категория модели не изменена:",
      error.code ?? "нет ответа",
      error.message,
    );

    // Колонку добавляют вручную: пока её нет, честнее сказать об этом, чем
    // молча вернуть флажок на прежнее значение.
    if (isMissingColumnSchema(error.code, error.message, "category")) {
      return { ok: false, error: CATEGORY_UNAVAILABLE };
    }

    if (isMissingTableSchema(error.code, error.message)) {
      return { ok: false, error: GENERATIONS_UNAVAILABLE };
    }

    if (error.code === "42501") {
      return { ok: false, error: SESSION_EXPIRED };
    }

    return {
      ok: false,
      error: "Не удалось сохранить категорию. Попробуйте ещё раз.",
    };
  }

  if (!data) {
    return { ok: false, error: MODEL_NOT_FOUND };
  }

  // Категория — фильтр галереи и подпись карточки на обеих страницах.
  revalidatePath("/my-models");
  revalidatePath("/gallery");

  return { ok: true };
}
