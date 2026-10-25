"use server";

import { revalidatePath } from "next/cache";

import type {
  OrderActionState,
  OrderFormState,
} from "@/app/actions/orders-state";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";
import { createClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";
import {
  FILAMENT_COLUMNS,
  formatGrams,
  normalizeFilamentRow,
  type WorkshopFilament,
} from "@/lib/workshop/filaments";
import {
  ORDER_STATUS_META,
  formatOrderHours,
  isOrderId,
  isOrderStatus,
  planFilamentUsage,
  planPrinterUsage,
  readOrderForm,
  type FilamentUsagePlan,
  type OrderStatus,
} from "@/lib/workshop/orders";
import {
  createFilamentUsagePayload,
  createOrderPayload,
  createPrinterUsagePayload,
} from "@/lib/workshop/payload";
import {
  PRINTER_COLUMNS,
  formatPrinterHours,
  normalizePrinterRow,
  printerMaintenanceLevel,
  type WorkshopPrinter,
} from "@/lib/workshop/printers";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const SESSION_EXPIRED =
  "Сессия истекла. Войдите снова, чтобы изменить заказы.";
const PRO_REQUIRED =
  "Мастерская входит в пакет «Всё включено». Оформите доступ, чтобы вести заказы.";
const MIGRATION_MISSING =
  "Заказы пока не сохраняются: в базе нет таблиц workshop_orders/workshop_printers. Примените миграцию supabase/workshop_printers_orders.sql.";
const INSERT_FAILED = "Не удалось создать заказ. Попробуйте ещё раз.";
const PRINTER_UPDATE_FAILED =
  "Не удалось обновить наработку принтера — заказ не создан. Попробуйте ещё раз.";
const FILAMENT_UPDATE_FAILED =
  "Не удалось списать пластик — заказ не создан, наработка принтера возвращена. Попробуйте ещё раз.";
const LOAD_FAILED = "Не удалось прочитать данные. Попробуйте ещё раз.";
const PRINTER_NOT_FOUND =
  "Принтер не найден — возможно, его удалили. Обновите страницу.";
const FILAMENT_NOT_FOUND =
  "Катушка не найдена — возможно, её удалили. Обновите страницу.";
const PRODUCT_NOT_FOUND =
  "Товар не найден — возможно, его удалили. Обновите страницу.";
const ORDER_NOT_FOUND =
  "Заказ не найден — возможно, его уже удалили. Обновите страницу.";
const INVALID_ID = "Заказ не найден — обновите страницу.";
const INVALID_STATUS = "Неизвестный статус заказа — обновите страницу.";
const STATUS_FAILED = "Не удалось сменить статус. Попробуйте ещё раз.";

/**
 * Создание заказа с расходом ресурсов.
 *
 * Порядок: разбор формы → сессия → подписка → чтение принтера и катушки →
 * проверка остатка → вставка заказа → update наработки → update остатка.
 *
 * Почему вставка раньше update: у заказа нет ссылки на обновлённые строки, а
 * компенсировать неудачный update проще, если заказ уже существует — его можно
 * удалить. Если не удалось обновить наработку, заказ удаляется; если не удалось
 * списать пластик, наработка возвращается к прежним числам и заказ тоже
 * удаляется. Так в базе не остаётся заказа, который «как бы» израсходовал
 * ресурс, но не сделал этого.
 *
 * Остаток и наработку считают чистые функции planFilamentUsage и
 * planPrinterUsage — те же, что проверяют тесты. Суммы берутся из актуальной
 * строки базы, а не из формы: пока окно было открыто, катушку могли изменить в
 * другой вкладке.
 */
export async function createOrder(
  _prevState: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  const { draft, errors } = readOrderForm(formData);

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

  let printer: WorkshopPrinter | null = null;

  if (draft.printerId) {
    const { data, error } = await supabase
      .from("workshop_printers")
      .select(PRINTER_COLUMNS)
      .eq("id", draft.printerId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.warn("Принтер не прочитан:", error.code, error.message);

      return {
        error: isMissingTableSchema(error.code, error.message)
          ? MIGRATION_MISSING
          : LOAD_FAILED,
      };
    }

    printer = normalizePrinterRow(data);

    if (!printer) {
      return { fieldErrors: { printerId: PRINTER_NOT_FOUND } };
    }
  }

  let filament: WorkshopFilament | null = null;

  if (draft.filamentId) {
    const { data, error } = await supabase
      .from("workshop_filaments")
      .select(FILAMENT_COLUMNS)
      .eq("id", draft.filamentId)
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

    filament = normalizeFilamentRow(data);

    if (!filament) {
      return { fieldErrors: { filamentId: FILAMENT_NOT_FOUND } };
    }
  }

  if (draft.productId) {
    const { data, error } = await supabase
      .from("workshop_products")
      .select("id")
      .eq("id", draft.productId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.warn("Товар не прочитан:", error.code, error.message);

      return {
        error: isMissingTableSchema(error.code, error.message)
          ? MIGRATION_MISSING
          : LOAD_FAILED,
      };
    }

    if (!data) {
      return { fieldErrors: { productId: PRODUCT_NOT_FOUND } };
    }
  }

  // Нехватку пластика проверяем до вставки: заказ без материала не нужен.
  let filamentPlan: FilamentUsagePlan | null = null;

  if (filament) {
    filamentPlan = planFilamentUsage(filament, draft.materialWeightG);

    if (!filamentPlan.ok) {
      return { fieldErrors: { materialWeightG: filamentPlan.error } };
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("workshop_orders")
    .insert(createOrderPayload(user.id, draft))
    .select("id")
    .maybeSingle();

  if (insertError) {
    console.warn("Заказ не создан:", insertError.code, insertError.message);

    return {
      error: isMissingTableSchema(insertError.code, insertError.message)
        ? MIGRATION_MISSING
        : INSERT_FAILED,
    };
  }

  const orderId = (inserted as { id?: unknown } | null)?.id;

  if (!isOrderId(orderId)) {
    console.warn("Заказ создан без id: откатывать нечего");
    return { error: INSERT_FAILED };
  }

  const printerPlan =
    printer && draft.printTimeHours > 0
      ? planPrinterUsage(printer, draft.printTimeHours)
      : null;
  let isPrinterUpdated = false;

  if (printer && printerPlan) {
    const { error } = await supabase
      .from("workshop_printers")
      .update(createPrinterUsagePayload(printerPlan))
      .eq("id", printer.id)
      .eq("user_id", user.id);

    if (error) {
      console.warn("Наработка не обновлена:", error.code, error.message);
      await deleteOrder(supabase, orderId, user.id);

      return { error: PRINTER_UPDATE_FAILED };
    }

    isPrinterUpdated = true;
  }

  if (
    filament &&
    filamentPlan?.ok &&
    draft.materialWeightG > 0 &&
    filamentPlan.remainingWeightG !== filament.remainingWeightG
  ) {
    const { error } = await supabase
      .from("workshop_filaments")
      .update(createFilamentUsagePayload(filamentPlan.remainingWeightG))
      .eq("id", filament.id)
      .eq("user_id", user.id);

    if (error) {
      console.warn("Пластик не списан:", error.code, error.message);

      // Возвращаем наработку: заказ всё равно будет удалён, и принтер не должен
      // остаться с часами, за которые никто не заплатил.
      if (isPrinterUpdated && printer) {
        const { error: restoreError } = await supabase
          .from("workshop_printers")
          .update(createPrinterUsagePayload(printer))
          .eq("id", printer.id)
          .eq("user_id", user.id);

        if (restoreError) {
          console.warn(
            "Наработка не восстановлена:",
            restoreError.code,
            restoreError.message,
          );
        }
      }

      await deleteOrder(supabase, orderId, user.id);

      return { error: FILAMENT_UPDATE_FAILED };
    }
  }

  revalidatePath("/dashboard/workshop");

  return {
    success: true,
    message: buildCreatedMessage({
      title: draft.title,
      printer,
      printerPlan,
      filament,
      filamentPlan,
      materialWeightG: draft.materialWeightG,
      printTimeHours: draft.printTimeHours,
    }),
  };
}

/**
 * Смена статуса заказа на выбранный.
 *
 * Kanban разрешает перетащить карточку в любую колонку, в том числе назад:
 * поэтому целевой статус приходит аргументом, а не вычисляется как «следующий».
 * Перед записью он проверяется тем же `isOrderStatus`, что и строка базы:
 * произвольную строку в check-колонку отправить нельзя.
 *
 * Заголовок и текущий статус читаются из базы: пока доска была открыта, заказ
 * могли изменить в другой вкладке. Ответ строится по фактическому статусу, а не
 * по тому, который интерфейс показывал до перетаскивания.
 */
export async function updateOrderStatus(
  orderId: string,
  nextStatus: OrderStatus,
): Promise<OrderActionState> {
  if (!isOrderId(orderId)) {
    return { ok: false, error: INVALID_ID };
  }

  if (!isOrderStatus(nextStatus)) {
    return { ok: false, error: INVALID_STATUS };
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
    .from("workshop_orders")
    .select("title, status")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.warn("Заказ не прочитан:", error.code, error.message);

    return {
      ok: false,
      error: isMissingTableSchema(error.code, error.message)
        ? MIGRATION_MISSING
        : LOAD_FAILED,
    };
  }

  if (!data) {
    return { ok: false, error: ORDER_NOT_FOUND };
  }

  const row = data as { title?: unknown; status?: unknown };
  const current = isOrderStatus(row.status) ? row.status : "new";
  const title =
    typeof row.title === "string" && row.title.trim()
      ? row.title.trim()
      : "Без названия";

  if (current === nextStatus) {
    return {
      ok: true,
      message: `«${title}» уже в статусе «${ORDER_STATUS_META[current].label}».`,
    };
  }

  const { error: updateError } = await supabase
    .from("workshop_orders")
    .update({ status: nextStatus })
    .eq("id", orderId)
    .eq("user_id", user.id);

  if (updateError) {
    console.warn("Статус не изменён:", updateError.code, updateError.message);

    return {
      ok: false,
      error: isMissingTableSchema(updateError.code, updateError.message)
        ? MIGRATION_MISSING
        : STATUS_FAILED,
    };
  }

  revalidatePath("/dashboard/workshop");

  return {
    ok: true,
    message: `«${title}»: ${ORDER_STATUS_META[current].label} → ${ORDER_STATUS_META[nextStatus].label}.`,
  };
}

/** Удаление заказа после неудачного update: база не должна хранить фантом. */
async function deleteOrder(
  supabase: Supabase,
  orderId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("workshop_orders")
    .delete()
    .eq("id", orderId)
    .eq("user_id", userId);

  if (error) {
    console.warn("Заказ не удалён после ошибки:", error.code, error.message);
  }
}

/** Сообщение на вкладке после создания заказа: что списано и что выросло. */
function buildCreatedMessage({
  title,
  printer,
  printerPlan,
  filament,
  filamentPlan,
  materialWeightG,
  printTimeHours,
}: {
  title: string;
  printer: WorkshopPrinter | null;
  printerPlan: ReturnType<typeof planPrinterUsage> | null;
  filament: WorkshopFilament | null;
  filamentPlan: FilamentUsagePlan | null;
  materialWeightG: number;
  printTimeHours: number;
}): string {
  const parts = [`Заказ «${title}» создан.`];

  if (filament && filamentPlan?.ok && materialWeightG > 0) {
    parts.push(
      `Пластик: списано ${formatGrams(materialWeightG)}, осталось ${formatGrams(filamentPlan.remainingWeightG)}.`,
    );
  }

  if (!printer || !printerPlan) {
    return parts.join(" ");
  }

  parts.push(
    `Наработка «${printer.name}»: ${formatPrinterHours(printerPlan.totalHours)} (время заказа ${formatOrderHours(printTimeHours)}).`,
  );

  const nozzle = printerMaintenanceLevel(
    printerPlan.nozzleHours,
    printer.nozzleInterval,
  );

  if (nozzle === "overdue") {
    parts.push(
      `Сопло ${formatPrinterHours(printerPlan.nozzleHours)} при интервале ${formatPrinterHours(printer.nozzleInterval)} — пора менять.`,
    );
  } else if (nozzle === "due") {
    parts.push(
      `Сопло ${formatPrinterHours(printerPlan.nozzleHours)} из ${formatPrinterHours(printer.nozzleInterval)} — скоро замена.`,
    );
  }

  const lubrication = printerMaintenanceLevel(
    printerPlan.lubricationHours,
    printer.lubricationInterval,
  );

  if (lubrication === "overdue") {
    parts.push(
      `Смазка ${formatPrinterHours(printerPlan.lubricationHours)} при интервале ${formatPrinterHours(printer.lubricationInterval)} — пора смазывать.`,
    );
  } else if (lubrication === "due") {
    parts.push(
      `Смазка ${formatPrinterHours(printerPlan.lubricationHours)} из ${formatPrinterHours(printer.lubricationInterval)} — скоро смазка.`,
    );
  }

  const zScrew = printerMaintenanceLevel(
    printerPlan.zScrewHours,
    printer.zScrewInterval,
  );

  if (zScrew === "overdue") {
    parts.push(
      `Винт Z ${formatPrinterHours(printerPlan.zScrewHours)} при интервале ${formatPrinterHours(printer.zScrewInterval)} — пора смазывать.`,
    );
  } else if (zScrew === "due") {
    parts.push(
      `Винт Z ${formatPrinterHours(printerPlan.zScrewHours)} из ${formatPrinterHours(printer.zScrewInterval)} — скоро смазка.`,
    );
  }

  return parts.join(" ");
}

