"use server";

import { revalidatePath } from "next/cache";

import type {
  OrderActionState,
  OrderEditState,
  OrderFormState,
  OrderPrintStatus,
} from "@/app/actions/orders-state";
import {
  isPrintableFile,
  printerMismatchMessage,
} from "@/lib/3d/print-compatibility";
import {
  cancelPrintJob,
  createPrintJob,
  getOrderActivePrintJob,
  getOrderLastPrintFailure,
  getOrderWithItems,
} from "@/lib/db/workshop-farm";
import type { WorkshopFarmFailureReason } from "@/lib/db/workshop-types";
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
  ORDER_ITEM_COLUMNS,
  ORDER_STATUS_META,
  ORDER_TEXT_LIMITS,
  formatOrderHours,
  isOrderFlowStatus,
  isOrderId,
  isOrderStatus,
  normalizeOrderComment,
  normalizeOrderItemSummary,
  planFilamentUsage,
  planPrinterUsage,
  readOrderCommentText,
  readOrderEditForm,
  readOrderForm,
  readOrderItemQuantity,
  readOrderItemSku,
  type FilamentUsagePlan,
  type OrderComment,
  type OrderFlowStatus,
  type OrderItemSummary,
} from "@/lib/workshop/orders";
import { getOrderComments, getOrderItems } from "@/lib/workshop/order-store";
import {
  createFilamentUsagePayload,
  createOrderPayload,
  createOrderUpdatePayload,
  createPrinterUsagePayload,
} from "@/lib/workshop/payload";
import {
  PRINTER_COLUMNS,
  formatPrinterHours,
  isPrinterId,
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
const UPDATE_FAILED =
  "Не удалось сохранить изменения. Попробуйте ещё раз.";
const COMMENT_MIGRATION_MISSING =
  "Комментарии пока не сохраняются: в базе нет таблицы workshop_order_comments. Примените миграцию supabase/workshop_order_comments.sql.";
const COMMENT_ADD_FAILED =
  "Не удалось отправить комментарий. Попробуйте ещё раз.";
const PRINT_QUEUE_MIGRATION_MISSING =
  "Очередь печати пока не работает: в базе нет таблиц workshop_order_items/workshop_print_jobs. Примените миграцию supabase/workshop_farm_and_shop.sql.";
const PRINT_PRINTER_REQUIRED =
  "Выберите принтер для печати: задание без принтера агент фермы не запустит.";
const PRINT_NO_GCODE_ITEM = "В заказе нет товаров с G-кодом.";
const PRINT_STL_UNSLICED =
  "У товара файл STL: это модель, а не задание печати. Нарежьте её в слайсере и загрузите .gcode или .3mf.";
const PRINT_TARGET_NOT_FOUND =
  "Позиция заказа или принтер не найдены — возможно, их удалили. Обновите страницу.";
const PRINT_QUEUE_FAILED =
  "Не удалось поставить задание в очередь. Попробуйте ещё раз.";
/** Текст успеха: его показывает всплывающее уведомление в карточке. */
const PRINT_QUEUE_ADDED = "Задание добавлено в очередь.";
const PRINT_PRINTER_CLEARED = "Принтер снят с заказа.";
/** Отмена: задание стояло в очереди и закрыто сразу. */
const PRINT_CANCEL_DONE = "Задание снято с очереди.";
/** Отмена: печать уже идёт, агент остановит принтер на следующем опросе. */
const PRINT_CANCEL_REQUESTED =
  "Просьба об отмене отправлена: агент остановит печать на следующем опросе.";
const PRINT_CANCEL_FAILED =
  "Не удалось отменить печать. Попробуйте ещё раз.";
const PRINT_CANCEL_NOTHING =
  "Активного задания нет — отменять нечего. Обновите страницу.";
const PRINT_CANCEL_MIGRATION_MISSING =
  "Отмена печати пока не работает: примените миграцию supabase/workshop_print_queue_hardening.sql.";
const ORDER_ITEM_PRODUCT_REQUIRED =
  "Выберите товар из каталога — без него позицию не добавить.";
const ORDER_ITEM_ADD_FAILED =
  "Не удалось добавить позицию. Попробуйте ещё раз.";
const ORDER_ITEM_MIGRATION_MISSING =
  "Позиции заказа пока не сохраняются: в базе нет таблицы workshop_order_items. Примените миграцию supabase/workshop_farm_and_shop.sql.";

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
  nextStatus: OrderFlowStatus,
): Promise<OrderActionState> {
  if (!isOrderId(orderId)) {
    return { ok: false, error: INVALID_ID };
  }

  if (!isOrderFlowStatus(nextStatus)) {
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

  if (current === "unmapped") {
    return {
      ok: false,
      error:
        "Заказ ждёт маппинга: свяжите SKU с товаром на странице «Маркетплейсы», и он вернётся в работу.",
    };
  }

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

/** PostgREST/PostgreSQL: в `workshop_orders` нет колонки `client_id`. */
function isMissingClientIdColumn(error: {
  code?: string | null;
  message?: string | null;
}): boolean {
  return (
    (error.code === "42703" || error.code === "PGRST204") &&
    /client_id/i.test(error.message ?? "")
  );
}

/**
 * Правка заказа из карточки.
 *
 * Порядок проверок как у остальных действий: UUID → разбор формы → сессия →
 * подписка → чтение заказа по `id` и `user_id`. Чтение нужно по трём причинам:
 * чужой заказ не обновится даже при известном id, пустой ответ значит «заказ
 * уже удалили в другой вкладке», а наличие колонки `client_id` (миграция
 * `supabase/workshop_orders_client_id.sql` применяется вручную) решает, можно ли
 * записать ссылку на клиента.
 *
 * Меняются только поля карточки: название, клиент, стоимость, вес, время, срок
 * и заметки. `status`, `printer_id` и `filament_id` остаются прежними. Наработка
 * принтера и остаток катушки не пересчитываются: заказ списал ресурс при
 * создании, и правка не должна списывать его второй раз.
 *
 * Имя клиента — снимок из `workshop_clients`: форма могла прислать чужой uuid,
 * поэтому ссылка проверяется по `user_id`, а имя берётся из базы. Ручной ввод
 * оставляет `client_id` пустым — ссылка снимается, если колонка есть.
 */
export async function updateOrder(
  orderId: string,
  formData: FormData,
): Promise<OrderEditState> {
  if (!isOrderId(orderId)) {
    return { ok: false, error: INVALID_ID };
  }

  const { draft, errors } = readOrderEditForm(formData);

  if (!draft) {
    return { ok: false, fieldErrors: errors };
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

  const withClient = await supabase
    .from("workshop_orders")
    .select("client_id")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();

  let current = (withClient.data ?? null) as Partial<
    Record<string, unknown>
  > | null;
  let readError = withClient.error;
  let hasClientColumn = readError === null;

  // Колонки client_id может не быть: повторяем чтение без неё, чтобы правка
  // названия и чисел работала и до применения миграции.
  if (readError && isMissingClientIdColumn(readError)) {
    const legacy = await supabase
      .from("workshop_orders")
      .select("title")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .maybeSingle();

    current = (legacy.data ?? null) as Partial<Record<string, unknown>> | null;
    readError = legacy.error;
    hasClientColumn = false;
  }

  if (readError) {
    console.warn("Заказ не прочитан:", readError.code, readError.message);

    return {
      ok: false,
      error: isMissingTableSchema(readError.code, readError.message)
        ? MIGRATION_MISSING
        : LOAD_FAILED,
    };
  }

  if (!current) {
    return { ok: false, error: ORDER_NOT_FOUND };
  }

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
        ok: false,
        error: isMissingTableSchema(error.code, error.message)
          ? CLIENT_MIGRATION_MISSING
          : LOAD_FAILED,
      };
    }

    const client = normalizeClientRow(
      (data ?? null) as Partial<Record<string, unknown>> | null,
    );

    if (!client) {
      return { ok: false, fieldErrors: { clientId: CLIENT_NOT_FOUND } };
    }

    if (client.name.length > ORDER_TEXT_LIMITS.clientName) {
      return {
        ok: false,
        fieldErrors: {
          clientName: `Не больше ${ORDER_TEXT_LIMITS.clientName} символов.`,
        },
      };
    }

    clientName = client.name;
  }

  const { data: updated, error: updateError } = await supabase
    .from("workshop_orders")
    .update(
      createOrderUpdatePayload(draft, clientName, {
        withClientLink: hasClientColumn,
      }),
    )
    .eq("id", orderId)
    .eq("user_id", user.id)
    .select("title")
    .maybeSingle();

  if (updateError) {
    console.warn("Заказ не обновлён:", updateError.code, updateError.message);

    // Выбранного клиента записать некуда: колонку добавляет отдельная миграция.
    // Без неё понятнее инструкция, чем общее «не удалось сохранить».
    if (draft.clientId && isMissingClientIdColumn(updateError)) {
      return { ok: false, error: ORDER_CLIENT_LINK_MIGRATION_MISSING };
    }

    return {
      ok: false,
      error: isMissingTableSchema(updateError.code, updateError.message)
        ? MIGRATION_MISSING
        : UPDATE_FAILED,
    };
  }

  // Пустая строка значит, что заказ удалили между чтением и записью: update не
  // затронул строку, и «успех» был бы ложным.
  if (!updated) {
    return { ok: false, error: ORDER_NOT_FOUND };
  }

  revalidatePath("/dashboard/workshop");

  return {
    ok: true,
    message: `Заказ «${draft.title}» обновлён.`,
  };
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
 * Готовность заказа к очереди печати для карточки.
 *
 * Доска Kanban не читает позиции заказов: `WorkshopOrder` знает только принтер и
 * деньги. Поэтому карточка спрашивает минимум для блока «3D-печать» — есть ли у
 * заказа товар с G-code и стоит ли он уже в очереди. Ошибка чтения и отсутствие
 * сессии дают null: кнопка остаётся доступной, а окончательную проверку делает
 * `queueOrderForPrint` и объясняет причину.
 *
 * Активное задание читается тем же вызовом: карточка — центр управления
 * заказом, и вместо повторной кнопки «В очередь на печать» она показывает
 * «В очереди» или «Печатается на …». Пока задание живо, очередь не трогают.
 */
export async function loadOrderPrintStatus(
  orderId: string,
): Promise<OrderPrintStatus | null> {
  if (!isOrderId(orderId)) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [order, activeJob, lastFailure] = await Promise.all([
    getOrderWithItems(orderId, { supabase, userId: user.id }),
    getOrderActivePrintJob(orderId, { supabase, userId: user.id }),
    getOrderLastPrintFailure(orderId, { supabase, userId: user.id }),
  ]);

  if (!order.ok) {
    console.warn(
      "Позиции заказа для печати не прочитаны:",
      order.reason,
      order.error,
    );

    return null;
  }

  // Очередь без таблицы печати — не ошибка карточки: до миграции активного
  // задания просто нет, а кнопка «В очередь на печать» объяснит причину сама.
  if (!activeJob.ok && activeJob.reason !== "migration_missing") {
    console.warn(
      "Активное задание печати не прочитано:",
      activeJob.reason,
      activeJob.error,
    );
  }

  // История отказов не должна ломать карточку: нет миграции или сбой чтения —
  // просто нечего показать, кнопка очереди остаётся на месте.
  if (!lastFailure.ok && lastFailure.reason !== "migration_missing") {
    console.warn(
      "Последний отказ печати не прочитан:",
      lastFailure.reason,
      lastFailure.error,
    );
  }

  return {
    itemCount: order.data.items.length,
    gcodeItemCount: order.data.items.filter((item) =>
      isPrintableFile(item.product?.gcodeUrl ?? null),
    ).length,
    activeJob: activeJob.ok ? activeJob.data : null,
    lastFailure: lastFailure.ok ? lastFailure.data : null,
  };
}

/** Что нужно для сверки разметки 3MF: модель из файла и модель принтера. */
type SlicedPrinterCheck = {
  slicedForPrinter: string;
  printerBrand: string;
  printerModel: string;
};

/**
 * Разметка 3MF у товара и модель выбранного принтера.
 *
 * null — сравнивать нечего: у позиции нет товара, товар без файла, файл без
 * разметки (STL или G-code) или база ещё не знает колонку
 * `sliced_for_printer` (миграцию не применяли заново). Сбой чтения тоже даёт
 * null: проверка не должна мешать печати сильнее, чем помогает, — наличие
 * файла и принтера всё равно проверит `createPrintJob`.
 */
async function readSlicedPrinterCheck(
  supabase: Supabase,
  options: { userId: string; productId: string | null; printerId: string },
): Promise<SlicedPrinterCheck | null> {
  if (!options.productId) {
    return null;
  }

  const [productResult, printerResult] = await Promise.all([
    supabase
      .from("workshop_products")
      .select("sliced_for_printer")
      .eq("id", options.productId)
      .eq("user_id", options.userId)
      .maybeSingle(),
    supabase
      .from("workshop_printers")
      .select("brand, model")
      .eq("id", options.printerId)
      .eq("user_id", options.userId)
      .maybeSingle(),
  ]);

  if (productResult.error) {
    console.warn(
      "Разметка принтера у товара не прочитана:",
      productResult.error.code,
      productResult.error.message,
    );

    return null;
  }

  const productRow = productResult.data as Partial<
    Record<string, unknown>
  > | null;
  const slicedForPrinter =
    typeof productRow?.sliced_for_printer === "string"
      ? productRow.sliced_for_printer.trim()
      : "";

  if (!slicedForPrinter) {
    return null;
  }

  const printerRow = printerResult.data as Partial<
    Record<string, unknown>
  > | null;
  const printerModel =
    typeof printerRow?.model === "string" ? printerRow.model.trim() : "";

  // Без модели принтера сравнивать не с чем: в парке могли остаться строки,
  // добавленные до появления обязательных полей.
  if (!printerModel) {
    return null;
  }

  const printerBrand =
    typeof printerRow?.brand === "string" ? printerRow.brand.trim() : "";

  return { slicedForPrinter, printerBrand, printerModel };
}

/**
 * Причина отказа `createPrintJob` в текст для карточки.
 *
 * null — отдельной подсказки нет, вызывающий покажет общий текст «не удалось
 * поставить задание в очередь». Отображение живёт здесь, а не в каждом вызове,
 * потому что заказ ставит в очередь несколько позиций и все они объясняют отказ
 * одинаково.
 */
function printQueueErrorFor(reason: WorkshopFarmFailureReason): string | null {
  if (reason === "migration_missing") {
    return PRINT_QUEUE_MIGRATION_MISSING;
  }

  if (reason === "missing_gcode") {
    return PRINT_NO_GCODE_ITEM;
  }

  if (reason === "unauthorized") {
    return SESSION_EXPIRED;
  }

  if (reason === "not_found") {
    return PRINT_TARGET_NOT_FOUND;
  }

  if (reason === "ownership_mismatch") {
    return ORDER_NOT_FOUND;
  }

  return null;
}

/**
 * «1 задание», «2 задания», «5 заданий».
 *
 * Число заданий в сообщении карточки склоняется: «добавлено 3 задание» читается
 * как ошибка интерфейса. Правило русское: 11…14 всегда «заданий», дальше смотрим
 * последнюю цифру.
 */
function printJobsCountLabel(count: number): string {
  const mod100 = count % 100;

  if (mod100 >= 11 && mod100 <= 14) {
    return `${count} заданий`;
  }

  const mod10 = count % 10;

  if (mod10 === 1) {
    return `${count} задание`;
  }

  if (mod10 >= 2 && mod10 <= 4) {
    return `${count} задания`;
  }

  return `${count} заданий`;
}

/**
 * Поставить заказ в очередь 3D-печати.
 *
 * Печатаются модели, а не строки заказа, поэтому в очередь уходит каждая позиция,
 * у товара которой есть файл печати: заказ из трёх изделий становится тремя
 * заданиями. Раньше бралась только первая подходящая позиция, и вторая с третьей
 * были недостижимы из интерфейса. Принтер обязателен — задание без принтера агент
 * не знает, на какой машине печатать, поэтому карточка сначала просит его
 * выбрать. Выбранный принтер получают все задания заказа: агент фермы печатает их
 * по очереди на одной машине, а распределение по парку — следующий шаг.
 *
 * Перед созданием задания сверяется разметка 3MF: файл, нарезанный под
 * FlashForge, нельзя отправить на Bambu A1. Проверка идёт по каждой позиции
 * отдельно, и несовпадение отсекает только свою позицию — один чужой профиль не
 * должен задерживать весь заказ. Если не подходит ни одна позиция с файлом,
 * отказываем и объясняем причину. Карточка уже гасит кнопку в этом случае, но
 * браузер мог устареть, а база должна отказать сама, а не полагаться на
 * интерфейс.
 *
 * Принтер приходит из карточки (`printerId`) и перекрывает значение заказа:
 * мастер мог выбрать принтер только что, а сохранение ещё не доехало до
 * страницы. Если выбор не передан, берётся принтер, записанный в заказе.
 *
 * Саму вставку делает `createPrintJob` (`lib/db/workshop-farm.ts`): он держит
 * инварианты — владелец, наличие G-code, принтер этой мастерской и «одно
 * активное задание на позицию». Повторный клик поэтому не создаёт дубль, а
 * возвращает уже стоящее в очереди задание, а заказ переезжает в «Печать» —
 * иначе Канбан показывал бы очередь в колонке «Новые».
 */
export async function queueOrderForPrint(
  orderId: string,
  printerId: string | null = null,
): Promise<OrderActionState> {
  if (!isOrderId(orderId)) {
    return { ok: false, error: INVALID_ID };
  }

  if (printerId !== null && !isPrinterId(printerId)) {
    return { ok: false, error: PRINTER_NOT_FOUND };
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

  const order = await getOrderWithItems(orderId, {
    supabase,
    userId: user.id,
  });

  if (!order.ok) {
    console.warn(
      "Заказ для очереди печати не прочитан:",
      order.reason,
      order.error,
    );

    if (order.reason === "migration_missing") {
      return { ok: false, error: PRINT_QUEUE_MIGRATION_MISSING };
    }

    if (order.reason === "not_found") {
      return { ok: false, error: ORDER_NOT_FOUND };
    }

    return { ok: false, error: LOAD_FAILED };
  }

  const targetPrinterId = printerId ?? order.data.printerId;

  if (!targetPrinterId) {
    return { ok: false, error: PRINT_PRINTER_REQUIRED };
  }

  // В очередь берём все позиции с настоящим файлом печати: STL — это модель для
  // слайсера, агенту фермы её отправлять некуда. Если файлы есть, но все STL,
  // говорим об этом прямо, а не «нет товаров с G-кодом».
  const printableItems = order.data.items.filter((entry) =>
    isPrintableFile(entry.product?.gcodeUrl ?? null),
  );

  if (printableItems.length === 0) {
    const hasStlOnly = order.data.items.some((entry) =>
      Boolean(entry.product?.gcodeUrl),
    );

    return {
      ok: false,
      error: hasStlOnly ? PRINT_STL_UNSLICED : PRINT_NO_GCODE_ITEM,
    };
  }

  // 3MF помнит, под какой принтер его нарезали. Файл от другого слайсера
  // печатать на этой машине нельзя, поэтому такая позиция в очередь не идёт, а
  // остальные — идут: одна неверно нарезанная модель не должна задерживать весь
  // заказ. Чтение разметки независимо по позициям, поэтому запросы идут
  // параллельно.
  const slicedChecks = await Promise.all(
    printableItems.map((entry) =>
      readSlicedPrinterCheck(supabase, {
        userId: user.id,
        productId: entry.productId,
        printerId: targetPrinterId,
      }),
    ),
  );

  const mismatches: string[] = [];
  const queueItems: typeof printableItems = [];

  printableItems.forEach((entry, index) => {
    const slicedCheck = slicedChecks[index];
    const mismatch = slicedCheck
      ? printerMismatchMessage(slicedCheck.slicedForPrinter, {
          brand: slicedCheck.printerBrand,
          model: slicedCheck.printerModel,
        })
      : null;

    if (mismatch) {
      mismatches.push(mismatch);
      return;
    }

    queueItems.push(entry);
  });

  // Ни одной подходящей позиции — задание в очереди висело бы заведомо
  // невыполнимым, поэтому отказываем до вставки и объясняем причину.
  if (queueItems.length === 0) {
    return { ok: false, error: mismatches[0] ?? PRINT_QUEUE_FAILED };
  }

  // Задания создаются по одному: `createPrintJob` идемпотентен по позиции (уже
  // стоящее в очереди задание возвращается как есть), а последовательные вызовы
  // держат журнал и порядок `queued_at` читаемыми. Позиции независимы, поэтому
  // отказ одной не отменяет остальные.
  const queued: string[] = [];
  const failures: string[] = [];

  for (const entry of queueItems) {
    const job = await createPrintJob(
      { orderId, orderItemId: entry.id, printerId: targetPrinterId },
      { supabase, userId: user.id },
    );

    if (job.ok) {
      queued.push(job.data.id);
      continue;
    }

    console.warn("Задание печати не создано:", job.reason, job.error);
    failures.push(printQueueErrorFor(job.reason) ?? PRINT_QUEUE_FAILED);
  }

  if (queued.length === 0) {
    return { ok: false, error: failures[0] ?? PRINT_QUEUE_FAILED };
  }

  revalidatePath("/dashboard/workshop");

  // Сообщение собирается из итогов: мастер должен видеть, что в очередь встал
  // весь заказ, и что именно осталось за бортом — позиции без файла печати, 3MF
  // под другой принтер или отказ базы. Числа идут с двоеточием, чтобы не
  // склонять слово «позиция» в каждой форме.
  const notes: string[] = [];
  const noFileCount = order.data.items.length - printableItems.length;

  if (noFileCount > 0) {
    notes.push(`без файла печати: ${noFileCount}`);
  }

  if (mismatches.length > 0) {
    notes.push(`нарезаны под другой принтер: ${mismatches.length}`);
  }

  if (failures.length > 0) {
    // Точка в конце текста отказа не нужна: сообщение продолжается
    // перечислением, и «в очередь..» с двумя точками выглядело бы опечаткой.
    const reason = failures[0].replace(/\.$/, "");

    notes.push(`не поставлены в очередь: ${failures.length} — ${reason}`);
  }

  const baseMessage =
    queued.length === 1
      ? PRINT_QUEUE_ADDED
      : `В очередь добавлено ${printJobsCountLabel(queued.length)}.`;

  return {
    ok: true,
    message:
      notes.length > 0
        ? `${baseMessage} Не вошли позиции — ${notes.join("; ")}.`
        : baseMessage,
  };
}

/**
 * Отменить печать заказа.
 *
 * Отменяется активное задание, а не заказ: печать останавливается, заказ
 * остаётся на доске. Что именно произойдёт, решает база
 * (`workshop_cancel_print_job`): задание из очереди закрывается сразу, идущее
 * получает `cancel_requested`, и агент гасит принтер на следующем опросе. Поэтому
 * текст успеха зависит от ответа: обещать «остановлено» для идущей печати было
 * бы неправдой — между кликом и опросом агента проходит несколько секунд.
 *
 * Задание ищем на сервере, а не берём из браузера: карточка могла открыться до
 * постановки в очередь, а клиентский id задания — лишний повод поверить вводу.
 * Чужое задание RPC всё равно не тронет: она сверяет `auth.uid()`.
 */
export async function cancelOrderPrint(
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

  const activeJob = await getOrderActivePrintJob(orderId, {
    supabase,
    userId: user.id,
  });

  if (!activeJob.ok) {
    console.warn(
      "Активное задание для отмены не прочитано:",
      activeJob.reason,
      activeJob.error,
    );

    if (activeJob.reason === "migration_missing") {
      return { ok: false, error: PRINT_QUEUE_MIGRATION_MISSING };
    }

    if (activeJob.reason === "unauthorized") {
      return { ok: false, error: SESSION_EXPIRED };
    }

    return { ok: false, error: LOAD_FAILED };
  }

  if (!activeJob.data) {
    // Карточка могла устареть: агент уже закрыл задание. Это не отказ базы, но и
    // «отменено» писать нельзя — печати уже нет.
    return { ok: false, error: PRINT_CANCEL_NOTHING };
  }

  if (activeJob.data.cancelRequested) {
    // Повторный клик или вторая вкладка: просьба уже в базе. Второй вызов RPC
    // поднял бы флаг ещё раз и записал второе событие в журнал.
    return { ok: true, message: PRINT_CANCEL_REQUESTED };
  }

  const result = await cancelPrintJob(activeJob.data.id, {
    supabase,
    userId: user.id,
  });

  if (!result.ok) {
    console.warn("Отмена печати не удалась:", result.reason, result.error);

    if (result.reason === "migration_missing") {
      return { ok: false, error: PRINT_CANCEL_MIGRATION_MISSING };
    }

    if (result.reason === "unauthorized") {
      return { ok: false, error: SESSION_EXPIRED };
    }

    if (result.reason === "not_found") {
      return { ok: false, error: PRINT_CANCEL_NOTHING };
    }

    return { ok: false, error: PRINT_CANCEL_FAILED };
  }

  revalidatePath("/dashboard/workshop");

  return {
    ok: true,
    message:
      result.data === "cancelled" ? PRINT_CANCEL_DONE : PRINT_CANCEL_REQUESTED,
  };
}

/**
 * Назначить принтер заказу или снять его.
 *
 * Принтер — часть заказа, а не формы создания: мастер решает, на какой машине
 * печатать, глядя на очередь и загрузку парка. Отдельное действие позволяет
 * менять выбор прямо в карточке, не открывая редактирование названия и даты, и
 * не задевает уже созданное задание печати: оно закреплено за своим принтером.
 *
 * `null` очищает поле — заказ остаётся без принтера, и кнопка «В очередь на
 * печать» снова попросит выбрать машину.
 */
export async function updateOrderPrinter(
  orderId: string,
  printerId: string | null,
): Promise<OrderActionState> {
  if (!isOrderId(orderId)) {
    return { ok: false, error: INVALID_ID };
  }

  if (printerId !== null && !isPrinterId(printerId)) {
    return { ok: false, error: PRINTER_NOT_FOUND };
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

  let printerName: string | null = null;

  if (printerId) {
    const { data, error } = await supabase
      .from("workshop_printers")
      .select(PRINTER_COLUMNS)
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

    const printer = normalizePrinterRow(
      (data ?? null) as Partial<Record<string, unknown>> | null,
    );

    // Чужой или удалённый принтер: RLS вернёт пустую строку, и записать её в
    // заказ значило бы сломать очередь — задание потом не найдёт владельца.
    if (!printer) {
      return { ok: false, error: PRINTER_NOT_FOUND };
    }

    printerName = printer.name;
  }

  const { data: updated, error: updateError } = await supabase
    .from("workshop_orders")
    .update({ printer_id: printerId })
    .eq("id", orderId)
    .eq("user_id", user.id)
    .select("title")
    .maybeSingle();

  if (updateError) {
    console.warn("Принтер заказа не обновлён:", updateError.code, updateError.message);

    return {
      ok: false,
      error: isMissingTableSchema(updateError.code, updateError.message)
        ? MIGRATION_MISSING
        : UPDATE_FAILED,
    };
  }

  // Пустая строка — заказ удалили между чтением и записью.
  if (!updated) {
    return { ok: false, error: ORDER_NOT_FOUND };
  }

  revalidatePath("/dashboard/workshop");

  return {
    ok: true,
    message: printerName
      ? `Принтер «${printerName}» назначен заказу.`
      : PRINT_PRINTER_CLEARED,
  };
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

/** Ответ карточки на добавление позиции. */
type AddOrderItemResult =
  | { ok: true; item: OrderItemSummary; message: string }
  | { ok: false; error: string };

/**
 * Позиции заказа для открытой карточки.
 *
 * Тонкая граница Server Action над `getOrderItems`: клиентский компонент не
 * может импортировать модуль чтения — тот тянет серверный клиент Supabase и
 * cookies. Пустой список при ошибке не мешает открыть карточку: детали заказа
 * остаются видны, а добавление позиции покажет причину.
 */
export async function loadOrderItems(
  orderId: string,
): Promise<OrderItemSummary[]> {
  return getOrderItems(orderId);
}

/**
 * Ручное добавление позиции в заказ.
 *
 * Порядок проверок как у остальных действий: id → количество → сессия →
 * подписка → заказ → товар → вставка. Товар обязан принадлежать этому же
 * пользователю: RLS отсекает чужие строки, но id приходит из браузера, поэтому
 * `user_id` повторяется в самом запросе и условие видно в коде.
 *
 * `sku` — снимок артикула товара: если товар удалят, позиция останется с
 * артикулом и количеством, а `product_id` обнулится по `on delete set null`.
 *
 * Стоимость заказа (`total_cost`) не пересчитывается: это ручное поле, куда
 * мастер включает работу, а не только товары. Карточка показывает сумму
 * позиций отдельной строкой и введённую стоимость не трогает.
 *
 * `revalidatePath` нужен печатным формам и `router.refresh()` на доске:
 * спецификация и накладная читают позиции с сервера.
 */
export async function addOrderItem(
  orderId: string,
  productId: string,
  quantity: number,
): Promise<AddOrderItemResult> {
  if (!isOrderId(orderId)) {
    return { ok: false, error: INVALID_ID };
  }

  if (!isOrderId(productId)) {
    return { ok: false, error: ORDER_ITEM_PRODUCT_REQUIRED };
  }

  const { quantity: amount, error: quantityError } =
    readOrderItemQuantity(quantity);

  if (quantityError) {
    return { ok: false, error: quantityError };
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

  // Позиция не должна ссылаться на чужой заказ: RLS позиций проверяет только
  // user_id, поэтому принадлежность заказа проверяется здесь.
  const { data: order, error: orderError } = await supabase
    .from("workshop_orders")
    .select("id")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (orderError) {
    console.warn(
      "Заказ для позиции не прочитан:",
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

  const { data: product, error: productError } = await supabase
    .from("workshop_products")
    .select("id, sku, title")
    .eq("id", productId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (productError) {
    console.warn(
      "Товар для позиции не прочитан:",
      productError.code,
      productError.message,
    );

    return { ok: false, error: LOAD_FAILED };
  }

  const productRow = product as { sku?: unknown; title?: unknown } | null;

  if (!productRow) {
    return { ok: false, error: PRODUCT_NOT_FOUND };
  }

  const { data, error } = await supabase
    .from("workshop_order_items")
    .insert({
      user_id: user.id,
      order_id: orderId,
      product_id: productId,
      sku: readOrderItemSku(productRow.sku),
      quantity: amount,
    })
    .select(ORDER_ITEM_COLUMNS)
    .single();

  if (error) {
    console.warn("Позиция не добавлена:", error.code, error.message);

    return {
      ok: false,
      error: isMissingTableSchema(error.code, error.message)
        ? ORDER_ITEM_MIGRATION_MISSING
        : ORDER_ITEM_ADD_FAILED,
    };
  }

  const item = normalizeOrderItemSummary(
    data as Partial<Record<string, unknown>>,
  );

  if (!item) {
    return { ok: false, error: ORDER_ITEM_ADD_FAILED };
  }

  revalidatePath("/dashboard/workshop");

  const title =
    typeof productRow.title === "string" && productRow.title.trim()
      ? productRow.title.trim()
      : "Позиция";

  return {
    ok: true,
    item,
    message: `«${title}» × ${amount} добавлена в заказ.`,
  };
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

