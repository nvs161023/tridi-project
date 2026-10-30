/**
 * Факт расхода пластика по завершённой печати (аудит C6).
 *
 * Зачем: `createOrder` списывает с катушки план мастера (`material_weight_g`),
 * а факт знает агент — `filament_grams` из самого G-кода. Пока факт не попадал
 * на склад, остаток катушки расходился с реальностью с первой же напечатанной
 * позиции: план 100 г при факте 95 г оставлял на катушке минус 195 г вместо 95.
 *
 * Как считается:
 *   1. при `done` агент присылает граммы, статусный роут зовёт
 *      `writeOffFilamentFact()`;
 *   2. катушка берётся у заказа (`workshop_orders.filament_id`) — у задания и
 *      принтера своей катушки нет;
 *   3. списывается факт, а план, уже списанный при создании заказа,
 *      возвращается — ровно один раз на заказ: первое завершённое задание
 *      заказа освобождает резерв, дальше склад живёт по факту. Так заказ с
 *      планом 100 г и тремя позициями (40, 45 и 30 г) спишет 115 г: возврат
 *      плана один, списания факта — по каждому заданию.
 *
 * Остаток катушки — integer, поэтому факт округляется до грамма: доли грамма
 * теряются, зато `check (remaining_weight_g >= 0 and remaining_weight_g <=
 * total_weight_g)` не сорвёт запись. Итог всегда зажимается в границы колонки:
 * при расхождении плана и факта в минус склад не уходит.
 *
 * Гонка: два задания одного заказа могут завершиться почти одновременно, и оба
 * увидят «других завершённых нет» — тогда план вернётся дважды. Зажим по
 * `total_weight_g` не даёт остатку превысить катушку, а следующий запуск watchdog
 * и ручная правка склада (U5) это исправят. Ошибки записи не роняют статус
 * печати: факт остаётся в самом задании (`filament_grams`), его можно
 * пересчитать отдельно.
 */
import { isWorkshopUuid } from "@/lib/db/workshop-types";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

type Row = Partial<Record<string, unknown>>;

/** numeric(10, 2) с check «больше нуля и не больше 100 кг». */
const FILAMENT_GRAMS_MAX = 100_000;

/** Остаток катушки — integer: меньше половины грамма списывать нечего. */
const MIN_GRAMS_TO_CHARGE = 0.5;

/** Причина, по которой списывать было нечего. */
export type FilamentFactSkipReason =
  /** Агент не прислал вес или прислал мусор. */
  | "no_grams"
  /** Заказ не найден или он чужой. */
  | "no_order"
  /** К заказу не привязана катушка или её нет на складе. */
  | "no_filament"
  /** Остаток не изменился: факт и план дали тот же грамм. */
  | "no_change";

export type FilamentFactOutcome =
  | { status: "skipped"; reason: FilamentFactSkipReason }
  | {
      status: "charged";
      /** Сколько граммов списано по факту. */
      grams: number;
      /** Сколько граммов плана вернулось на катушку. */
      planRefundG: number;
      /** Остаток катушки после записи. */
      remainingWeightG: number;
    }
  | { status: "failed"; error: string };

type WriteOffInput = {
  supabase: AdminClient;
  userId: string;
  orderId: string;
  /** Задание, которое завершилось: по нему считаем, первое ли это `done`. */
  jobId: string;
  /** Факт расхода из задания, граммы; null — агент вес не прислал. */
  grams: number | null;
};

function describe(error: { code?: string | null; message?: string | null }): string {
  return [error.code, error.message].filter(Boolean).join(" ") || "неизвестная ошибка";
}

/** Целое из колонки: PostgREST отдаёт integer числом, numeric — строкой. */
function readInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }

  return null;
}

/**
 * Списать факт расхода пластика с катушки заказа.
 *
 * Вызывается только для перехода задания в `done`: отмена и отказ — это возврат
 * ресурсов, он остался в C6 как отдельная задача.
 */
export async function writeOffFilamentFact(
  input: WriteOffInput,
): Promise<FilamentFactOutcome> {
  const grams = input.grams;

  if (
    grams === null ||
    !Number.isFinite(grams) ||
    grams < MIN_GRAMS_TO_CHARGE ||
    grams > FILAMENT_GRAMS_MAX
  ) {
    return { status: "skipped", reason: "no_grams" };
  }

  if (!isWorkshopUuid(input.orderId)) {
    return { status: "skipped", reason: "no_order" };
  }

  const orderResult = await input.supabase
    .from("workshop_orders")
    .select("filament_id, material_weight_g")
    .eq("id", input.orderId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (orderResult.error) {
    return {
      status: "failed",
      error: `Заказ не прочитан: ${describe(orderResult.error)}`,
    };
  }

  const order = (orderResult.data ?? null) as Row | null;
  const filamentId = order?.filament_id;

  if (typeof filamentId !== "string" || !isWorkshopUuid(filamentId)) {
    return { status: "skipped", reason: "no_filament" };
  }

  const filamentResult = await input.supabase
    .from("workshop_filaments")
    .select("remaining_weight_g, total_weight_g")
    .eq("id", filamentId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (filamentResult.error) {
    return {
      status: "failed",
      error: `Катушка не прочитана: ${describe(filamentResult.error)}`,
    };
  }

  const filament = (filamentResult.data ?? null) as Row | null;
  const remaining = readInteger(filament?.remaining_weight_g);

  if (remaining === null) {
    return { status: "skipped", reason: "no_filament" };
  }

  const total = readInteger(filament?.total_weight_g);

  // План мастера списан при создании заказа. Возвращаем его на катушку в момент
  // первого завершённого задания заказа: иначе факт лёг бы сверху плана.
  const doneResult = await input.supabase
    .from("workshop_print_jobs")
    .select("id", { count: "exact", head: true })
    .eq("order_id", input.orderId)
    .eq("user_id", input.userId)
    .eq("status", "done")
    .neq("id", input.jobId);

  if (doneResult.error) {
    return {
      status: "failed",
      error: `Задания заказа не прочитаны: ${describe(doneResult.error)}`,
    };
  }

  const planRefundG =
    (doneResult.count ?? 0) === 0
      ? Math.max(readInteger(order?.material_weight_g) ?? 0, 0)
      : 0;
  const charged = Math.round(grams);
  const next = remaining + planRefundG - charged;
  const clamped = Math.min(Math.max(next, 0), total ?? Number.MAX_SAFE_INTEGER);

  if (clamped === remaining) {
    return { status: "skipped", reason: "no_change" };
  }

  const updateResult = await input.supabase
    .from("workshop_filaments")
    .update({ remaining_weight_g: clamped })
    .eq("id", filamentId)
    .eq("user_id", input.userId);

  if (updateResult.error) {
    return {
      status: "failed",
      error: `Остаток катушки не записан: ${describe(updateResult.error)}`,
    };
  }

  return {
    status: "charged",
    grams: charged,
    planRefundG,
    remainingWeightG: clamped,
  };
}
