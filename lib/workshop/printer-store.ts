/**
 * Чтение принтеров для страницы `/dashboard/workshop`.
 *
 * Миграцию `supabase/workshop_printers_orders.sql` применяют вручную, поэтому
 * таблицы может не быть в живой базе. Как и со складом, это не повод падать:
 * вкладка «Принтеры» показывается пустой и с предупреждением, а остальные
 * разделы Мастерской продолжают работать.
 */
import type { createClient } from "@/lib/supabase/server";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import {
  PRINTER_COLUMNS,
  normalizePrinterRow,
  type WorkshopPrinter,
} from "@/lib/workshop/printers";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type WorkshopPrintersSnapshot = {
  printers: WorkshopPrinter[];
  /** В базе нет таблицы workshop_printers — миграция не применена. */
  isMissingTable: boolean;
};

/** Принтеры пользователя: сначала добавленные раньше, чтобы список не прыгал. */
export async function getWorkshopPrinters(
  supabase: Supabase,
  userId: string,
): Promise<WorkshopPrintersSnapshot> {
  const { data, error } = await supabase
    .from("workshop_printers")
    .select(PRINTER_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("Принтеры мастерской не прочитаны:", error.code, error.message);

    return {
      printers: [],
      isMissingTable: isMissingTableSchema(error.code, error.message),
    };
  }

  const rows = (data ?? []) as Partial<Record<string, unknown>>[];

  return {
    printers: rows
      .map(normalizePrinterRow)
      .filter((printer): printer is WorkshopPrinter => printer !== null),
    isMissingTable: false,
  };
}
