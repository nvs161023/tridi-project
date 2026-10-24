"use server";

import { revalidatePath } from "next/cache";

import type {
  ConsumeFilamentFormState,
  FilamentFormState,
} from "@/app/actions/filaments-state";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import { createClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";
import {
  formatGrams,
  readConsumeFilamentForm,
  readFilamentForm,
} from "@/lib/workshop/filaments";
import { createFilamentPayload } from "@/lib/workshop/payload";
import { parseWorkshopNumber } from "@/lib/workshop/settings";

const SESSION_EXPIRED =
  "Сессия истекла. Войдите снова, чтобы изменить склад.";
const PRO_REQUIRED =
  "Мастерская входит в пакет «Всё включено». Оформите доступ, чтобы вести склад.";
const MIGRATION_MISSING =
  "Склад пока не сохраняется: в базе нет таблицы workshop_filaments. Примените миграцию supabase/workshop_filaments.sql.";
const ADD_FAILED = "Не удалось добавить катушку. Попробуйте ещё раз.";
const CONSUME_FAILED = "Не удалось списать пластик. Попробуйте ещё раз.";
const LOAD_FAILED = "Не удалось прочитать катушку. Попробуйте ещё раз.";
const NOT_FOUND = "Катушка не найдена — возможно, её уже удалили. Обновите страницу.";

/**
 * Добавление катушки на склад.
 *
 * Порядок проверок повторяет сохранение настроек: разбор формы → сессия →
 * подписка → запись. Подписка проверяется и здесь: Server Action — публичный
 * endpoint, и её можно вызвать запросом в обход интерфейса. RLS дополнительно
 * сверяет auth.uid(), поэтому записать катушку другому человеку нельзя даже
 * подделав user_id.
 */
export async function addFilament(
  _prevState: FilamentFormState,
  formData: FormData,
): Promise<FilamentFormState> {
  const { draft, errors } = readFilamentForm(formData);

  if (!draft) {
    return { fieldErrors: errors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: SESSION_EXPIRED };
  }

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return { error: PRO_REQUIRED };
  }

  const { error } = await supabase
    .from("workshop_filaments")
    .insert(createFilamentPayload(user.id, draft));

  if (error) {
    console.warn("Катушка не добавлена:", error.code, error.message);

    return {
      error: isMissingTableSchema(error.code, error.message)
        ? MIGRATION_MISSING
        : ADD_FAILED,
    };
  }

  // Список рисуется на сервере: без этого следующий переход покажет старый склад.
  revalidatePath("/dashboard/workshop");

  return {
    success: true,
    message: `Катушка ${draft.brand} ${draft.type} добавлена.`,
  };
}

/**
 * Списание пластика.
 *
 * Остаток пересчитывается на сервере по актуальной строке, а не по числу из
 * формы: пока окно было открыто, катушку могли изменить в другой вкладке.
 * Списать больше, чем осталось, нельзя — иначе остаток ушёл бы в минус и склад
 * перестал бы сходиться.
 */
export async function consumeFilament(
  _prevState: ConsumeFilamentFormState,
  formData: FormData,
): Promise<ConsumeFilamentFormState> {
  const { filamentId, grams, errors } = readConsumeFilamentForm(formData);

  if (errors.filamentId) {
    return { error: errors.filamentId };
  }

  if (errors.grams || grams === null || filamentId === null) {
    return { fieldError: errors.grams ?? "Введите число граммов." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: SESSION_EXPIRED };
  }

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return { error: PRO_REQUIRED };
  }

  const { data, error } = await supabase
    .from("workshop_filaments")
    .select("brand, type, color, remaining_weight_g")
    .eq("id", filamentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.warn("Катушка не прочитана:", error.code, error.message);

    return {
      error: isMissingTableSchema(error.code, error.message)
        ? MIGRATION_MISSING
        : LOAD_FAILED,
    };
  }

  if (!data) {
    return { error: NOT_FOUND };
  }

  const row = data as { remaining_weight_g?: unknown };
  const remaining = parseWorkshopNumber(row.remaining_weight_g) ?? 0;

  if (remaining <= 0) {
    return { error: "В катушке не осталось пластика — пора купить новую." };
  }

  if (grams > remaining) {
    return {
      error: `В катушке осталось ${formatGrams(remaining)} — столько списать нельзя.`,
    };
  }

  const nextRemaining = remaining - grams;

  const { error: updateError } = await supabase
    .from("workshop_filaments")
    .update({ remaining_weight_g: nextRemaining })
    .eq("id", filamentId)
    .eq("user_id", user.id);

  if (updateError) {
    console.warn("Пластик не списан:", updateError.code, updateError.message);

    return {
      error: isMissingTableSchema(updateError.code, updateError.message)
        ? MIGRATION_MISSING
        : CONSUME_FAILED,
    };
  }

  revalidatePath("/dashboard/workshop");

  return {
    success: true,
    message: `Списали ${formatGrams(grams)}. Осталось ${formatGrams(nextRemaining)}.`,
  };
}
