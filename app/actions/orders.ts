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
  CLIENT_COLUMNS,
  normalizeClientRow,
} from "@/lib/workshop/clients";
import {
  FILAMENT_COLUMNS,
  formatGrams,
  normalizeFilamentRow,
  type WorkshopFilament,
} from "@/lib/workshop/filaments";
import {
  ORDER_COMMENT_COLUMNS,
  ORDER_STATUS_META,
  ORDER_TEXT_LIMITS,
  formatOrderHours,
  isOrderId,
  isOrderStatus,
  normalizeOrderComment,
  planFilamentUsage,
  planPrinterUsage,
  readOrderCommentText,
  readOrderForm,
  type FilamentUsagePlan,
  type OrderComment,
  type OrderStatus,
} from "@/lib/workshop/orders";
import { getOrderComments } from "@/lib/workshop/order-store";
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
const CLIENT_NOT_FOUND =
  "Клиент не найден — возможно, его удалили. Обновите страницу.";
const CLIENT_MIGRATION_MISSING =
  "База клиентов пока не сохраняется: в базе нет таблицы workshop_clients. Примените миграцию supabase/workshop_clients.sql.";
const ORDER_CLIENT_LINK_MIGRATION_MISSING =
  "Не удалось сохранить клиента в заказе: в workshop_orders нет колонки client_id. Примените миграцию supabase/workshop_orders_client_id.sql.";
const ORDER_NOT_FOUND =
  "Заказ не найден — возможно, его уже удалили. Обновите страницу.";
const INVALID_ID = "Заказ не найден — обновите страницу.";
const INVALID_STATUS = "Неизвестный статус заказа — обновите страницу.";
const STATUS_FAILED = "Не удалось сменить статус. Попробуйте ещё раз.";
const DELETE_FAILED = "Не удалось удалить заказ. Попробуйте ещё раз.";
const COMMENT_MIGRATION_MISSING =
  "Комментарии пока не сохраняются: в базе нет таблицы workshop_order_comments. Примените миграцию supabase/workshop_order_comments.sql.";
const COMMENT_ADD_FAILED =
  "Не удалось отправить комментарий. Попробуйте ещё раз.";

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

  // Ссылку на клиента проверяем по базе: форма могла прислать чужой uuid.
  // Имя берём из workshop_clients, а не из формы, — это снимок для заказа.
  let clientName = draft.clientName;

  if (draft.clientId) {
    const { data, error } = await supabase
      .from("workshop_clients")
      .select(CLIENT_COLUMNS)
      .eq("id", draft.clientId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.warn("Клиент не прочитан:", error.code, error.message);

      return {
        error: isMissingTableSchema(error.code, error.message)
          ? CLIENT_MIGRATION_MISSING
          : LOAD_FAILED,
      };
    }

    const client = normalizeClientRow(
      (data ?? null) as Partial<Record<string, unknown>> | null,
    );

    if (!client) {
      return { fieldErrors: { clientId: CLIENT_NOT_FOUND } };
    }

    if (client.name.length > ORDER_TEXT_LIMITS.clientName) {
      return {
        fieldErrors: {
          clientName: `Не больше ${ORDER_TEXT_LIMITS.clientName} символов.`,
        },
      };
    }

    clientName = client.name;
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
    .insert(createOrderPayload(user.id, { ...draft, clientName }))
    .select("id")
    .maybeSingle();

  if (insertError) {
    console.warn("Заказ не создан:", insertError.code, insertError.message);

    // Колонку client_id добавляет отдельная миграция: без неё заказ с
    // выбранным клиентом не сохранится, и общая ошибка ничего не объяснит.
    if (
      draft.clientId &&
      (insertError.code === "42703" || insertError.code === "PGRST204") &&
      /client_id/i.test(insertError.message)
    ) {
      return { error: ORDER_CLIENT_LINK_MIGRATION_MISSING };
    }

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
      await deleteOrderRow(supabase, orderId, user.id);

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

      await deleteOrderRow(supabase, orderId, user.id);

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

/**
 * Удаление заказа.
 *
 * Порядок проверок как у остальных действий: id → сессия → подписка → удаление
 * с фильтром по `user_id`. Чужой заказ не удалится даже при известном id:
 * политика RLS `workshop_orders_delete_own` проверяет владельца, а фильтр
 * повторяет условие в самом запросе. Комментарии уходят каскадом
 * (`on delete cascade` в `supabase/workshop_order_comments.sql`), отдельный
 * delete для них не нужен.
 *
 * `select("title")` возвращает удалённую строку: пустой ответ означает, что
 * заказ уже удалили в другой вкладке, — тогда показываем понятное сообщение, а
 * не «успех». Заголовок нужен только для сообщения об успехе.
 */
export async function deleteOrder(
  orderId: string,
): Promise<OrderActionState> {
  if (!isOrderId(orderId)) {
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
    .from("workshop_orders")
    .delete()
    .eq("id", orderId)
    .eq("user_id", user.id)
    .select("title")
    .maybeSingle();

  if (error) {
    console.warn("Заказ не удалён:", error.code, error.message);

    return {
      ok: false,
      error: isMissingTableSchema(error.code, error.message)
        ? MIGRATION_MISSING
        : DELETE_FAILED,
    };
  }

  if (!data) {
    return { ok: false, error: ORDER_NOT_FOUND };
  }

  const row = data as { title?: unknown };
  const title =
    typeof row.title === "string" && row.title.trim()
      ? row.title.trim()
      : "Без названия";

  revalidatePath("/dashboard/workshop");

  return { ok: true, message: `Заказ «${title}» удалён.` };
}

/** Ответ окна карточки: либо сохранённый комментарий, либо текст ошибки. */
type CommentActionResult =
  | { ok: true; comment: OrderComment }
  | { ok: false; error: string };

/**
 * Комментарии для открытой карточки заказа.
 *
 * Клиентское окно не может вызвать `getOrderComments` напрямую: модуль чтения
 * тянет серверный клиент Supabase и cookies. Эта обёртка — граница Server
 * Action. Пустой список при ошибке не мешает открыть карточку: детали заказа
 * остаются видны, а отправка комментария покажет понятную причину.
 */
export async function loadOrderComments(
  orderId: string,
): Promise<OrderComment[]> {
  return getOrderComments(orderId);
}

/**
 * Новый комментарий к заказу.
 *
 * Порядок проверок как у остальных действий: id → текст → сессия → подписка →
 * вставка. Возвращаем сохранённую строку: id и дату назначает база, поэтому
 * окно показывает ровно то, что записано, без повторного запроса.
 *
 * `revalidatePath` здесь не нужен: комментарии видны только в карточке, а
 * открытая лента обновляется локально. Доска заказов от них не меняется.
 */
export async function addOrderComment(
  orderId: string,
  text: string,
): Promise<CommentActionResult> {
  if (!isOrderId(orderId)) {
    return { ok: false, error: INVALID_ID };
  }

  const { text: body, error: textError } = readOrderCommentText(text);

  if (textError) {
    return { ok: false, error: textError };
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

  // Заказ должен принадлежать этому же пользователю: чужой uuid в order_id
  // RLS не отсекает — политика проверяет только user_id комментария.
  const { data: order, error: orderError } = await supabase
    .from("workshop_orders")
    .select("id")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (orderError) {
    console.warn(
      "Заказ для комментария не прочитан:",
      orderError.code,
      orderError.message,
    );

    return {
      ok: false,
      error: isMissingTableSchema(orderError.code, orderError.message)
        ? MIGRATION_MISSING
        : LOAD_FAILED,
    };
  }

  if (!order) {
    return { ok: false, error: ORDER_NOT_FOUND };
  }

  const { data, error } = await supabase
    .from("workshop_order_comments")
    .insert({ order_id: orderId, user_id: user.id, text: body })
    .select(ORDER_COMMENT_COLUMNS)
    .single();

  if (error) {
    console.warn("Комментарий не добавлен:", error.code, error.message);

    return {
      ok: false,
      error: isMissingTableSchema(error.code, error.message)
        ? COMMENT_MIGRATION_MISSING
        : COMMENT_ADD_FAILED,
    };
  }

  const comment = normalizeOrderComment(
    data as Partial<Record<string, unknown>>,
  );

  return comment
    ? { ok: true, comment }
    : { ok: false, error: COMMENT_ADD_FAILED };
}

/** Удаление заказа после неудачного update: база не должна хранить фантом. */
async function deleteOrderRow(
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

