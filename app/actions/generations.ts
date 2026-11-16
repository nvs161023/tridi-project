"use server";

import { revalidatePath } from "next/cache";

import type {
  UpdateGenerationVisibilityInput,
  UpdateGenerationVisibilityResult,
} from "@/app/actions/generations-state";
import {
  GENERATIONS_TABLE,
  isGenerationId,
} from "@/lib/generator/generations";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import { createClient } from "@/lib/supabase/server";

const GENERATIONS_UNAVAILABLE =
  "История генераций временно недоступна. Попробуйте позже.";
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
