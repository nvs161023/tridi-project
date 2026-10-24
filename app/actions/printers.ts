"use server";

import { revalidatePath } from "next/cache";

import type {
  PrinterActionState,
  PrinterFormState,
} from "@/app/actions/printers-state";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import { createClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";
import {
  isPrinterId,
  readPrinterForm,
} from "@/lib/workshop/printers";
import { createPrinterPayload } from "@/lib/workshop/payload";

const SESSION_EXPIRED =
  "Сессия истекла. Войдите снова, чтобы изменить принтеры.";
const PRO_REQUIRED =
  "Мастерская входит в пакет «Всё включено». Оформите доступ, чтобы вести принтеры.";
const MIGRATION_MISSING =
  "Принтеры пока не сохраняются: в базе нет таблицы workshop_printers. Примените миграцию supabase/workshop_printers_orders.sql.";
const ADD_FAILED = "Не удалось добавить принтер. Попробуйте ещё раз.";
const RESET_FAILED = "Не удалось сбросить счётчик. Попробуйте ещё раз.";
const LOAD_FAILED = "Не удалось прочитать принтер. Попробуйте ещё раз.";
const INVALID_ID = "Принтер не найден — обновите страницу.";
const NOT_FOUND = "Принтер не найден — возможно, его уже удалили. Обновите страницу.";

/** Сегодняшняя дата в формате колонки date. */
function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Добавление принтера.
 *
 * Порядок проверок тот же, что у склада: разбор формы → сессия → подписка →
 * запись. Server Action — публичный endpoint, поэтому подписка проверяется и
 * здесь, а не только на странице. RLS дополнительно сверяет auth.uid().
 */
export async function addPrinter(
  _prevState: PrinterFormState,
  formData: FormData,
): Promise<PrinterFormState> {
  const { draft, errors } = readPrinterForm(formData);

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
    .from("workshop_printers")
    .insert(createPrinterPayload(user.id, draft));

  if (error) {
    console.warn("Принтер не добавлен:", error.code, error.message);

    return {
      error: isMissingTableSchema(error.code, error.message)
        ? MIGRATION_MISSING
        : ADD_FAILED,
    };
  }

  revalidatePath("/dashboard/workshop");

  return {
    success: true,
    message: `Принтер «${draft.name}» добавлен: ${draft.brand} ${draft.model}.`,
  };
}

/**
 * «Заменить сопло»: сбрасывает наработку сопла и отмечает обслуживание
 * сегодняшним днём. Общая наработка и счётчик смазки не меняются.
 */
export async function resetPrinterNozzle(
  printerId: string,
): Promise<PrinterActionState> {
  return resetPrinterCounter(printerId, "nozzle");
}

/**
 * «Смазать оси»: сбрасывает наработку смазки и отмечает обслуживание.
 * Для моделей с интервалом 0 кнопки в карточке нет, но действие остаётся:
 * почистить направляющие всё равно можно.
 */
export async function resetPrinterLubrication(
  printerId: string,
): Promise<PrinterActionState> {
  return resetPrinterCounter(printerId, "lubrication");
}

/** Общий путь сброса: проверки, чтение имени, update и ответ для вкладки. */
async function resetPrinterCounter(
  printerId: string,
  counter: "nozzle" | "lubrication",
): Promise<PrinterActionState> {
  if (!isPrinterId(printerId)) {
    return { ok: false, error: INVALID_ID };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: SESSION_EXPIRED };
  }

  if (!(await hasActiveSubscription(supabase, user.id))) {
    return { ok: false, error: PRO_REQUIRED };
  }

  const { data, error } = await supabase
    .from("workshop_printers")
    .select("name")
    .eq("id", printerId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.warn("Принтер не прочитан:", error.code, error.message);

    return {
      ok: false,
      error: isMissingTableSchema(error.code, error.message)
        ? MIGRATION_MISSING
        : LOAD_FAILED,
    };
  }

  if (!data) {
    return { ok: false, error: NOT_FOUND };
  }

  const name =
    typeof (data as { name?: unknown }).name === "string"
      ? (data as { name: string }).name
      : "принтер";
  const date = todayIsoDate();

  const { error: updateError } = await supabase
    .from("workshop_printers")
    .update(
      counter === "nozzle"
        ? { nozzle_hours: 0, last_maintenance_date: date }
        : { lubrication_hours: 0, last_maintenance_date: date },
    )
    .eq("id", printerId)
    .eq("user_id", user.id);

  if (updateError) {
    console.warn("Счётчик не сброшен:", updateError.code, updateError.message);

    return {
      ok: false,
      error: isMissingTableSchema(updateError.code, updateError.message)
        ? MIGRATION_MISSING
        : RESET_FAILED,
    };
  }

  revalidatePath("/dashboard/workshop");

  return {
    ok: true,
    message:
      counter === "nozzle"
        ? `Сопло заменено: «${name}», счётчик сопла снова 0 ч.`
        : `Оси смазаны: «${name}», счётчик смазки снова 0 ч.`,
  };
}
