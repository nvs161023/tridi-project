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
  createImportedFilamentDraft,
  formatGrams,
  IMPORTED_FILAMENTS_MAX,
  readConsumeFilamentForm,
  readFilamentForm,
  type FilamentDraft,
  type SaveImportedFilamentsResult,
} from "@/lib/workshop/filaments";
import type { InvoiceItem } from "@/lib/workshop/ocr";
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
const IMPORT_EMPTY = "Нет распознанных материалов для сохранения.";
const IMPORT_TOO_MANY = `За один раз можно сохранить не больше ${IMPORTED_FILAMENTS_MAX} позиций.`;
const IMPORT_FAILED =
  "Не удалось сохранить импортированные катушки. Попробуйте ещё раз.";

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
 * Сохранение распознанных позиций накладной на склад.
 *
 * Массив приходит из браузера, поэтому проверяется заново: имя, количество и
 * единица обязательны, цена необязательна. Каждая строка пишется отдельно —
 * так одна неподходящая позиция не отменяет остальные, а ответ честно говорит,
 * сколько записей создано и сколько не удалось.
 *
 * Подписка проверяется здесь, а не только в окне: Server Action — публичный
 * endpoint. RLS дополнительно сверяет auth.uid(), поэтому записать катушки
 * другому пользователю нельзя даже подделав user_id.
 */
export async function saveImportedFilaments(
  items: InvoiceItem[],
): Promise<SaveImportedFilamentsResult> {
  if (!Array.isArray(items) || items.length === 0) {
    return { saved: 0, failed: 0, error: IMPORT_EMPTY };
  }

  if (items.length > IMPORTED_FILAMENTS_MAX) {
    return {
      saved: 0,
      failed: items.length,
      error: IMPORT_TOO_MANY,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { saved: 0, failed: items.length, error: SESSION_EXPIRED };
  }

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return { saved: 0, failed: items.length, error: PRO_REQUIRED };
  }

  const drafts: FilamentDraft[] = [];
  let failed = 0;

  for (const item of items) {
    const draft = createImportedFilamentDraft(item);

    if (!draft) {
      failed += 1;
      continue;
    }

    drafts.push(draft);
  }

  let saved = 0;

  for (const draft of drafts) {
    const { error } = await supabase
      .from("workshop_filaments")
      .insert(createFilamentPayload(user.id, draft));

    if (!error) {
      saved += 1;
      continue;
    }

    console.warn("Импортированная катушка не добавлена:", error.code, error.message);

    if (isMissingTableSchema(error.code, error.message)) {
      return {
        saved,
        failed: items.length - saved,
        error: MIGRATION_MISSING,
      };
    }

    failed += 1;
  }

  if (saved > 0) {
    revalidatePath("/dashboard/workshop");
  }

  if (saved === 0) {
    return { saved, failed, error: IMPORT_FAILED };
  }

  return { saved, failed };
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
