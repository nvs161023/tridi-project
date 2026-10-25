/**
 * Чтение склада пластика для страницы `/dashboard/workshop`.
 *
 * Миграцию `supabase/workshop_filaments.sql` применяют вручную, поэтому таблицы
 * может не быть в живой базе. Как и с настройками, это не повод падать: склад
 * показывается пустым и с предупреждением, а калькулятор продолжает работать.
 */
import type { createClient } from "@/lib/supabase/server";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import {
  FILAMENT_COLUMNS,
  FILAMENT_ORDER_LIMITS,
  isFilamentId,
  normalizeFilamentRow,
  type WorkshopFilament,
} from "@/lib/workshop/filaments";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type WorkshopFilamentsSnapshot = {
  filaments: WorkshopFilament[];
  /** В базе нет таблицы workshop_filaments — миграция не применена. */
  isMissingTable: boolean;
};

/** Катушки пользователя: сначала добавленные раньше, чтобы список не прыгал. */
export async function getWorkshopFilaments(
  supabase: Supabase,
  userId: string,
): Promise<WorkshopFilamentsSnapshot> {
  const { data, error } = await supabase
    .from("workshop_filaments")
    .select(FILAMENT_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("Склад мастерской не прочитан:", error.code, error.message);

    return {
      filaments: [],
      isMissingTable: isMissingTableSchema(error.code, error.message),
    };
  }

  const rows = (data ?? []) as Partial<Record<string, unknown>>[];

  return {
    filaments: rows
      .map(normalizeFilamentRow)
      .filter((filament): filament is WorkshopFilament => filament !== null),
    isMissingTable: false,
  };
}

/**
 * Катушки по списку id для печатной спецификации на закупку.
 *
 * `user_id` в запросе обязателен: даже если в адресе окажется id чужой
 * катушки, её название и цена не попадут в документ. Мусорные id отсекаются
 * до PostgREST, повторы и лишние позиции — до запроса.
 */
export async function getWorkshopFilamentsByIds(
  supabase: Supabase,
  userId: string,
  filamentIds: readonly string[],
): Promise<WorkshopFilamentsSnapshot> {
  const ids = [...new Set(filamentIds.filter(isFilamentId))].slice(
    0,
    FILAMENT_ORDER_LIMITS.maxItems,
  );

  if (ids.length === 0) {
    return { filaments: [], isMissingTable: false };
  }

  const { data, error } = await supabase
    .from("workshop_filaments")
    .select(FILAMENT_COLUMNS)
    .eq("user_id", userId)
    .in("id", ids);

  if (error) {
    console.warn("Катушки мастерской не прочитаны:", error.code, error.message);

    return {
      filaments: [],
      isMissingTable: isMissingTableSchema(error.code, error.message),
    };
  }

  const rows = (data ?? []) as Partial<Record<string, unknown>>[];

  return {
    filaments: rows
      .map(normalizeFilamentRow)
      .filter((filament): filament is WorkshopFilament => filament !== null),
    isMissingTable: false,
  };
}
