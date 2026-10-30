"use server";

import { revalidatePath } from "next/cache";

import type {
  AutoScheduleState,
  OrderActionState,
  OrderEditState,
  OrderFormState,
  OrderPrintStatus,
} from "@/app/actions/orders-state";
import {
  isPrintableFile,
  isSlicedForPrinter,
  printerMismatchMessage,
} from "@/lib/3d/print-compatibility";
import {
  cancelPrintJob,
  countActivePrintJobs,
  countActivePrintJobsForItem,
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
const ORDER_HAS_ACTIVE_JOBS =
  "Нельзя удалить заказ, пока по нему есть активные или ожидающие задания печати. Сначала отмените печать.";
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
const ORDER_ITEM_NOT_FOUND =
  "Позиция не найдена — возможно, её удалили. Обновите страницу.";
const ORDER_ITEM_LOCKED =
  "Позиция уже в очереди печати: сначала отмените задание, потом меняйте количество или удаляйте её.";
const ORDER_ITEM_DELETE_FAILED =
  "Не удалось удалить позицию. Попробуйте ещё раз.";
const ORDER_ITEM_QUANTITY_FAILED =
  "Не удалось изменить количество. Попробуйте ещё раз.";
/** Верхняя граница плана пластика — как у check в `workshop_orders`. */
const ORDER_PLASTIC_LIMIT = 100_000;
/** Автораспределение ответило «нечего делать»: это норма, а не ошибка. */
const AUTO_SCHEDULE_EMPTY = "Нет свободных принтеров или подходящих заказов.";
const AUTO_SCHEDULE_FAILED =
  "Не удалось распределить заказы. Попробуйте ещё раз.";

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
 * Порядок проверок как у остальных действий: id → сессия → подписка → активные
 * задания печати → удаление с фильтром по `user_id`. Чужой заказ не удалится
 * даже при известном id: политика RLS `workshop_orders_delete_own` проверяет
 * владельца, а фильтр повторяет условие в самом запросе. Комментарии уходят
 * каскадом (`on delete cascade` в `supabase/workshop_order_comments.sql`),
 * отдельный delete для них не нужен.
 *
 * Заказ с заданием в очереди или в печати не удаляется: задание ссылается на
 * заказ через `order_id`, и строка унесла бы его с собой — агент остался бы с
 * печатью, которой нет в базе, а пластик и наработка принтера уже списаны.
 * Мастер получает понятный отказ и сначала отменяет печать. Закрытые задания
 * (done/failed/cancelled) — история, она удалению не мешает.
 *
 * Пластик, списанный при создании заказа, возвращается на катушку: план
 * `material_weight_g` — резерв, а удалённый заказ печатать уже не будут. Возврат
 * идёт после успешного `delete` (иначе отказ базы вернул бы пластик дважды — при
 * повторном клике) и только пока резерв не освобождён: после первого `done` его
 * вернул `writeOffFilamentFact`, и второй возврат поднял бы склад сверх катушки.
 * Наработка принтера остаётся как есть: часы уже израсходованы или списаны
 * планом, и удаление заказа их не «отматывает».
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

  // Защита от удаления заказа с живой печатью. Ошибку чтения очереди считаем
  // отказом: удаление необратимо, и «не знаю, есть ли задание» — не повод
  // рисковать. Отсутствие таблицы заданий (миграция не применена) приходит сюда
  // нулём из `countActivePrintJobs`, поэтому удаление в такой базе работает.
  const activeJobs = await countActivePrintJobs(
    { orderId },
    { supabase, userId: user.id },
  );

  if (!activeJobs.ok) {
    console.warn(
      "Перед удалением заказа очередь не прочитана:",
      activeJobs.reason,
      activeJobs.error,
    );

    return { ok: false, error: DELETE_FAILED };
  }

  if (activeJobs.data > 0) {
    return { ok: false, error: ORDER_HAS_ACTIVE_JOBS };
  }

  // Резерв читаем до удаления: `material_weight_g` и `filament_id` живут в самой
  // строке заказа, после `delete` их уже не найти.
  const reserve = await readOrderPlasticReserve(supabase, user.id, orderId);

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

  // Удаление уже состоялось: сбой возврата не отменяет его — склад можно
  // поправить вручную, а «заказ не удалён» было бы неправдой.
  const refund = reserve.isPlanReleased
    ? EMPTY_PLASTIC_REFUND
    : await refundPlasticToFilament(
        supabase,
        user.id,
        reserve.filamentId,
        reserve.planG,
      );

  revalidatePath("/dashboard/workshop");

  const note = plasticRefundNote(refund);

  return {
    ok: true,
    message: note
      ? `Заказ «${title}» удалён. ${note}`
      : `Заказ «${title}» удалён.`,
  };
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
 * «1 заказ», «2 заказа», «5 заказов».
 *
 * Слово склоняется в сообщении автораспределения: «распределено 3 заказ» читается
 * как опечатка. Правило то же, что у заданий: 11…14 всегда «заказов», дальше
 * смотрим последнюю цифру.
 */
function ordersCountLabel(count: number): string {
  const mod100 = count % 100;

  if (mod100 >= 11 && mod100 <= 14) {
    return `${count} заказов`;
  }

  const mod10 = count % 10;

  if (mod10 === 1) {
    return `${count} заказ`;
  }

  if (mod10 >= 2 && mod10 <= 4) {
    return `${count} заказа`;
  }

  return `${count} заказов`;
}

/** Текст из строки ответа PostgREST: null, число и объект дают пустую строку. */
function readRowText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Строки ответа PostgREST: не массив — пустой список, а не падение. */
function readRows(value: unknown): Array<Partial<Record<string, unknown>>> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (row): row is Partial<Record<string, unknown>> =>
      typeof row === "object" && row !== null && !Array.isArray(row),
  );
}

/**
 * Встроенная связь PostgREST.
 *
 * To-one приходит объектом, но при неожиданной схеме может прийти массивом —
 * тогда берём первый элемент, чтобы разбор не падал.
 */
function readEmbeddedRow(
  value: unknown,
): Partial<Record<string, unknown>> | null {
  if (Array.isArray(value)) {
    return readRows(value)[0] ?? null;
  }

  return typeof value === "object" && value !== null
    ? (value as Partial<Record<string, unknown>>)
    : null;
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
 * возвращает уже стоящее в очереди задание. Статус заказа при постановке в
 * очередь не меняется: заказ остаётся в «Новых», а в «В печати» его переводит
 * старт задания на станке — иначе вся очередь выглядела бы печатающейся.
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

/** Позиция заказа, пригодная для автораспределения. */
type AutoScheduleItem = {
  id: string;
  orderId: string;
  /** Товар нужен для разметки 3MF: она хранится на товаре, а не на позиции. */
  productId: string;
};

/** Свободный принтер, которому можно отдать заказ. */
type AutoSchedulePrinter = {
  id: string;
  name: string;
  brand: string;
  model: string;
};

/**
 * Отказ чтения на любом шаге автораспределения.
 *
 * Неприменённая миграция — не поломка приложения, поэтому у неё свой текст
 * (`supabase/workshop_farm_and_shop.sql` создаёт и принтеры, и очередь). Всё
 * остальное — общее «не удалось прочитать данные».
 */
function scheduleReadError(
  error: { code?: string | null; message?: string | null },
  migrationMessage: string,
): AutoScheduleState {
  return {
    ok: false,
    error: isMissingTableSchema(error.code, error.message)
      ? migrationMessage
      : LOAD_FAILED,
  };
}

/**
 * Автопланировщик: свободные принтеры получают подходящие новые заказы.
 *
 * Зачем кнопка. Раньше заказ вставал в очередь только через карточку и только на
 * выбранный вручную принтер: при ферме из десяти станков мастер десять раз
 * повторял «открой заказ → выбери принтер → в очередь». Здесь этот цикл делает
 * сервер: он знает состояние парка, разметку 3MF и занятость позиций, а браузер
 * — нет.
 *
 * Порядок:
 *   1. сессия и подписка — как у остальных действий с заказами;
 *   2. свободный парк (`status = 'idle'` и без активного задания) по алфавиту,
 *      чтобы распределение было воспроизводимым, а не случайным;
 *   3. новые заказы, старые первыми: очередь печати — FIFO, и первый заказ
 *      мастер ждёт раньше остальных;
 *   4. позиции этих заказов одним запросом вместе с файлом печати товара;
 *   5. разметка 3MF отдельным запросом: колонки `sliced_for_printer` может не
 *      быть, если миграцию не применяли заново, и падать из-за этого нельзя;
 *   6. активные задания (`queued`/`printing`), чтобы не считать уже стоящее в
 *      очереди своей работой;
 *   7. подбор: один принтер — один заказ.
 *
 * Совместимость. Если 3MF нарезан под конкретный принтер, позиция уходит только
 * на него (`isSlicedForPrinter` — та же проверка, что в карточке заказа и в
 * `queueOrderForPrint`, иначе кнопки спорили бы друг с другом). Файл без
 * разметки (STL, G-code, 3MF без метаданных) подходит любой машине. Заказ, у
 * которого подходящих позиций нет, ждёт следующего принтера.
 *
 * Принтер в базе остаётся `idle`. Записать «занят» нельзя: check
 * `workshop_printers_status_check` знает только idle/printing/paused/error/
 * offline, да и пишет `status` агент фермы — он вернул бы `idle` на следующем
 * же опросе. Поэтому занятость считается по очереди: принтер с заданием в
 * `queued`/`printing` в подбор не попадает. От двойного выбора в одном проходе
 * защищает ещё и сам цикл — каждый принтер проходится ровно один раз.
 *
 * Задания создаёт `createPrintJob` — он же проверяет владельца, наличие G-code,
 * принадлежность принтера и «одно активное задание на позицию». Поэтому
 * автораспределение ничего не дублирует, а его отказы разбираются по одной
 * позиции: одна неподходящая не отменяет остальные.
 */
export async function autoScheduleOrders(): Promise<AutoScheduleState> {
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

  const printersResult = await supabase
    .from("workshop_printers")
    .select("id, name, brand, model")
    .eq("user_id", user.id)
    .eq("status", "idle")
    .order("name", { ascending: true });

  if (printersResult.error) {
    console.warn(
      "Свободные принтеры не прочитаны:",
      printersResult.error.code,
      printersResult.error.message,
    );

    return scheduleReadError(printersResult.error, MIGRATION_MISSING);
  }

  const idlePrinters: AutoSchedulePrinter[] = readRows(printersResult.data)
    .map((row) => ({
      id: readRowText(row.id),
      name: readRowText(row.name) || "Принтер",
      brand: readRowText(row.brand),
      model: readRowText(row.model),
    }))
    .filter((printer) => printer.id !== "");

  // Принтер с активным заданием не свободен, даже если агент ещё не начал печать
  // и `status` равен idle: задание на нём уже есть, и новый заказ встал бы за
  // первым. Это же закрывает и повторный клик — вторая волна не выдаст тому же
  // принтеру ещё один заказ. Записать в базу `status = 'queued'` нельзя: check
  // `workshop_printers_status_check` знает только idle/printing/paused/error/
  // offline, а сам статус пишет агент фермы.
  const busyPrintersResult = await supabase
    .from("workshop_print_jobs")
    .select("printer_id")
    .eq("user_id", user.id)
    .in("status", ["queued", "printing"])
    .not("printer_id", "is", null);

  if (busyPrintersResult.error) {
    console.warn(
      "Занятые принтеры не прочитаны:",
      busyPrintersResult.error.code,
      busyPrintersResult.error.message,
    );

    return scheduleReadError(
      busyPrintersResult.error,
      PRINT_QUEUE_MIGRATION_MISSING,
    );
  }

  const busyPrinterIds = new Set(
    readRows(busyPrintersResult.data)
      .map((row) => readRowText(row.printer_id))
      .filter((id) => id !== ""),
  );

  const printers = idlePrinters.filter(
    (printer) => !busyPrinterIds.has(printer.id),
  );

  if (printers.length === 0) {
    return { ok: true, orders: 0, jobs: 0, message: AUTO_SCHEDULE_EMPTY };
  }

  const ordersResult = await supabase
    .from("workshop_orders")
    .select("id, title, created_at")
    .eq("user_id", user.id)
    .eq("status", "new")
    .order("created_at", { ascending: true });

  if (ordersResult.error) {
    console.warn(
      "Новые заказы не прочитаны:",
      ordersResult.error.code,
      ordersResult.error.message,
    );

    return scheduleReadError(ordersResult.error, MIGRATION_MISSING);
  }

  const orders = readRows(ordersResult.data)
    .map((row) => ({
      id: readRowText(row.id),
      title: readRowText(row.title) || "Заказ",
    }))
    .filter((order) => order.id !== "");

  if (orders.length === 0) {
    return { ok: true, orders: 0, jobs: 0, message: AUTO_SCHEDULE_EMPTY };
  }

  const orderIds = orders.map((order) => order.id);

  // Позиции всех новых заказов одним запросом: по запросу на заказ ферма из
  // полусотни строк читалась бы секундами, а кнопка ждёт ответа синхронно.
  const itemsResult = await supabase
    .from("workshop_order_items")
    .select(
      "id, order_id, product:workshop_products!workshop_order_items_product_id_fkey(id, gcode_url)",
    )
    .eq("user_id", user.id)
    .in("order_id", orderIds)
    .order("created_at", { ascending: true });

  if (itemsResult.error) {
    console.warn(
      "Позиции новых заказов не прочитаны:",
      itemsResult.error.code,
      itemsResult.error.message,
    );

    return scheduleReadError(itemsResult.error, PRINT_QUEUE_MIGRATION_MISSING);
  }

  const items: AutoScheduleItem[] = [];

  for (const row of readRows(itemsResult.data)) {
    const id = readRowText(row.id);
    const orderId = readRowText(row.order_id);
    const product = readEmbeddedRow(row.product);
    const gcodeUrl = readRowText(product?.gcode_url);

    // STL — модель для слайсера: агенту фермы её отправлять некуда, а задание
    // без файла печати `createPrintJob` всё равно отклонит.
    if (!id || !orderId || !isPrintableFile(gcodeUrl)) {
      continue;
    }

    items.push({ id, orderId, productId: readRowText(product?.id) });
  }

  if (items.length === 0) {
    return { ok: true, orders: 0, jobs: 0, message: AUTO_SCHEDULE_EMPTY };
  }

  // Разметка 3MF живёт на товаре, поэтому читается один раз на все позиции.
  // Ошибку чтения не считаем отказом: без миграции колонки нет ни у кого, и
  // подбор идёт по наличию файла — так же поступает `readSlicedPrinterCheck`.
  const productIds = [...new Set(items.map((item) => item.productId))].filter(
    (productId) => productId !== "",
  );
  const slicedByProduct = new Map<string, string>();

  if (productIds.length > 0) {
    const slicedResult = await supabase
      .from("workshop_products")
      .select("id, sliced_for_printer")
      .eq("user_id", user.id)
      .in("id", productIds);

    if (slicedResult.error) {
      console.warn(
        "Разметка принтера у товаров не прочитана:",
        slicedResult.error.code,
        slicedResult.error.message,
      );
    } else {
      for (const row of readRows(slicedResult.data)) {
        const productId = readRowText(row.id);
        const slicedForPrinter = readRowText(row.sliced_for_printer);

        if (productId && slicedForPrinter) {
          slicedByProduct.set(productId, slicedForPrinter);
        }
      }
    }
  }

  // Что уже в очереди. `createPrintJob` идемпотентен и вернул бы существующее
  // задание, но тогда повторный клик отчитался бы «распределено 3 заказа», где
  // не произошло ничего. Отдельное чтение нужно именно ради честных чисел.
  const activeJobsResult = await supabase
    .from("workshop_print_jobs")
    .select("order_item_id")
    .eq("user_id", user.id)
    .in("order_id", orderIds)
    .in("status", ["queued", "printing"]);

  if (activeJobsResult.error) {
    console.warn(
      "Очередь печати не прочитана:",
      activeJobsResult.error.code,
      activeJobsResult.error.message,
    );

    return scheduleReadError(
      activeJobsResult.error,
      PRINT_QUEUE_MIGRATION_MISSING,
    );
  }

  const queuedItemIds = new Set(
    readRows(activeJobsResult.data)
      .map((row) => readRowText(row.order_item_id))
      .filter((id) => id !== ""),
  );

  const itemsByOrder = new Map<string, AutoScheduleItem[]>();

  for (const item of items) {
    const bucket = itemsByOrder.get(item.orderId);

    if (bucket) {
      bucket.push(item);
      continue;
    }

    itemsByOrder.set(item.orderId, [item]);
  }

  /** Позиция подходит принтеру: не в очереди и нарезана под него (или без метки). */
  function fitsPrinter(
    item: AutoScheduleItem,
    printer: AutoSchedulePrinter,
  ): boolean {
    if (queuedItemIds.has(item.id)) {
      return false;
    }

    return isSlicedForPrinter(slicedByProduct.get(item.productId) ?? "", {
      brand: printer.brand,
      model: printer.model,
    });
  }

  const assignedOrders = new Set<string>();
  const createdJobIds = new Set<string>();
  /** Отказы базы при создании заданий: при них «нечего распределять» — неправда. */
  let failedAttempts = 0;

  // Цикл по принтерам, а не по заказам: агент фермы печатает позиции одного
  // заказа по очереди на одной машине, поэтому заказ получает один принтер, а
  // следующий свободный берёт следующий заказ.
  for (const printer of printers) {
    const target = orders.find(
      (order) =>
        !assignedOrders.has(order.id) &&
        (itemsByOrder.get(order.id) ?? []).some((item) =>
          fitsPrinter(item, printer),
        ),
    );

    if (!target) {
      continue;
    }

    let created = 0;

    for (const item of itemsByOrder.get(target.id) ?? []) {
      if (!fitsPrinter(item, printer)) {
        continue;
      }

      const job = await createPrintJob(
        { orderId: target.id, orderItemId: item.id, printerId: printer.id },
        { supabase, userId: user.id },
      );

      if (job.ok) {
        createdJobIds.add(job.data.id);
        created += 1;
        continue;
      }

      console.warn(
        `Задание не создано (${printer.name}, заказ «${target.title}»):`,
        job.reason,
        job.error,
      );
      failedAttempts += 1;
    }

    // Принтер без единого задания остаётся свободным для следующего заказа:
    // записывать его занятым в этом проходе было бы неправдой.
    if (created > 0) {
      assignedOrders.add(target.id);
    }
  }

  if (assignedOrders.size === 0) {
    // База отклонила все задания — это сбой записи, а не «нечего распределять»:
    // мастер должен повторить клик, а не искать свободный принтер.
    if (failedAttempts > 0) {
      return { ok: false, error: AUTO_SCHEDULE_FAILED };
    }

    return { ok: true, orders: 0, jobs: 0, message: AUTO_SCHEDULE_EMPTY };
  }

  // Доска показывает состояние заданий из серверного рендера: без revalidate
  // мастер увидел бы сообщение об успехе и те же карточки без очереди.
  revalidatePath("/dashboard/workshop");

  return {
    ok: true,
    orders: assignedOrders.size,
    jobs: createdJobIds.size,
    message: `Успешно распределено ${ordersCountLabel(assignedOrders.size)} — ${printJobsCountLabel(createdJobIds.size)} в очереди.`,
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
 *
 * Пластик возвращается только у задания из очереди: `queued` печать не начинало,
 * и резерв заказа (`material_weight_g`) цел. Возврат идёт вместе с обнулением
 * плана — иначе повторная постановка в очередь оставила бы резерв двойным:
 * первое `done` вернуло бы план ещё раз через `writeOffFilamentFact`. У идущей
 * печати пластик уже тратится, возвращать нечего, а факт придёт от агента.
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

  // Отмена состоялась. Возврат пластика — после неё: пока задание было живым,
  // резерв принадлежал ему.
  const refund =
    activeJob.data.status === "queued"
      ? await refundQueuedOrderPlastic(supabase, user.id, orderId)
      : null;

  revalidatePath("/dashboard/workshop");

  const base =
    result.data === "cancelled" ? PRINT_CANCEL_DONE : PRINT_CANCEL_REQUESTED;
  const note = refund ? plasticRefundNote(refund) : null;
  const planNote =
    refund?.planReset === true
      ? "План пластика заказа обнулён: при следующей печати спишется факт из G-кода."
      : null;

  return {
    ok: true,
    message: [base, note, planNote].filter(Boolean).join(" "),
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

/** Возврат пластика, которого не было: склад не трогали. */
const EMPTY_PLASTIC_REFUND = { refundedG: 0, remainingWeightG: null } as const;

/** Резерв пластика заказа: план, катушка и признак «план уже вернули». */
type OrderPlasticReserve = {
  /** План мастера `material_weight_g`, граммы. */
  planG: number;
  /** Катушка заказа; null — пластик не привязан, возвращать некуда. */
  filamentId: string | null;
  /**
   * По заказу есть завершённое задание: план вернул `writeOffFilamentFact`.
   * Второй возврат поднял бы склад сверх катушки.
   */
  isPlanReleased: boolean;
};

/**
 * Резерв пластика заказа для возврата.
 *
 * Чтение намеренно не роняет вызывающее действие: удаление заказа и отмена печати
 * уже состоялись, и «не смог прочитать план» — не повод показывать отказ.
 * Ошибки уходят в лог, а резерв считается пустым.
 */
async function readOrderPlasticReserve(
  supabase: Supabase,
  userId: string,
  orderId: string,
): Promise<OrderPlasticReserve> {
  const empty: OrderPlasticReserve = {
    planG: 0,
    filamentId: null,
    isPlanReleased: false,
  };

  const { data, error } = await supabase
    .from("workshop_orders")
    .select("material_weight_g, filament_id")
    .eq("id", orderId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("План заказа не прочитан:", error.code, error.message);
    return empty;
  }

  const row = (data ?? null) as Partial<Record<string, unknown>> | null;
  const planG = Math.max(Math.round(Number(row?.material_weight_g) || 0), 0);
  const filamentId = isOrderId(row?.filament_id) ? row.filament_id : null;

  // План без катушки всё равно нужен правке позиции: он делится между штуками,
  // даже когда возвращать некуда. Возврат в таком случае просто пустой.
  if (planG === 0 || !filamentId) {
    return { planG, filamentId, isPlanReleased: false };
  }

  const { count, error: doneError } = await supabase
    .from("workshop_print_jobs")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .eq("user_id", userId)
    .eq("status", "done");

  if (doneError) {
    // Отсутствие таблицы заданий — ноль завершённых: печати в такой базе нет.
    if (!isMissingTableSchema(doneError.code, doneError.message)) {
      console.warn(
        "Завершённые задания не прочитаны:",
        doneError.code,
        doneError.message,
      );
      return empty;
    }
  }

  return { planG, filamentId, isPlanReleased: (count ?? 0) > 0 };
}

/** Хвост сообщения о возврате: «Пластик: возвращено 20 г, на катушке 780 г.» */
function plasticRefundNote(refund: {
  refundedG: number;
  remainingWeightG: number | null;
}): string | null {
  if (refund.refundedG <= 0) {
    return null;
  }

  return refund.remainingWeightG === null
    ? `Пластик: возвращено ${formatGrams(refund.refundedG)}.`
    : `Пластик: возвращено ${formatGrams(refund.refundedG)}, на катушке ${formatGrams(refund.remainingWeightG)}.`;
}

/** Итог возврата пластика: сколько вернули и сколько осталось на катушке. */
type FilamentRefund = { refundedG: number; remainingWeightG: number | null };

/**
 * Сколько пластика плана заказа приходится на `units` штук.
 *
 * Позиция не хранит вес: в `workshop_order_items` есть только количество, а план
 * (`material_weight_g`) — у заказа. Долю считаем пропорционально количеству:
 * план × штуки / все штуки заказа. Это единственная оценка без новых колонок, и
 * при удалении всех позиций она возвращает ровно план. Отрицательные `units`
 * работают как вычитание — так же считается правка количества.
 */
function plasticForUnits(
  materialWeightG: number,
  units: number,
  orderQuantity: number,
): number {
  if (materialWeightG <= 0 || units === 0 || orderQuantity <= 0) {
    return 0;
  }

  return Math.round((materialWeightG * units) / orderQuantity);
}

/**
 * Возврат пластика на катушку.
 *
 * Остаток зажимается весом катушки, как в `writeOffFilamentFact`: колонка —
 * `integer` с check `<= total_weight_g`, и писать «больше, чем было» нельзя.
 * Сбой чтения или записи не роняет вызывающее действие — возврат это учёт, а
 * удаление позиции и отмена печати остаются намерением мастера.
 */
async function refundPlasticToFilament(
  supabase: Supabase,
  userId: string,
  filamentId: string | null,
  grams: number,
): Promise<FilamentRefund> {
  const refunded = Math.max(Math.round(grams), 0);

  if (!filamentId || refunded === 0) {
    return EMPTY_PLASTIC_REFUND;
  }

  const { data, error } = await supabase
    .from("workshop_filaments")
    .select("total_weight_g, remaining_weight_g")
    .eq("id", filamentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Катушка для возврата не прочитана:", error.code, error.message);
    return EMPTY_PLASTIC_REFUND;
  }

  const row = (data ?? null) as Partial<Record<string, unknown>> | null;
  const remaining = Number(row?.remaining_weight_g);

  if (!row || !Number.isFinite(remaining)) {
    return EMPTY_PLASTIC_REFUND;
  }

  const total = Number(row.total_weight_g);
  const next = Math.min(
    remaining + refunded,
    Number.isFinite(total) ? total : Number.MAX_SAFE_INTEGER,
  );

  if (next === remaining) {
    return { refundedG: 0, remainingWeightG: remaining };
  }

  const { error: updateError } = await supabase
    .from("workshop_filaments")
    .update(createFilamentUsagePayload(next))
    .eq("id", filamentId)
    .eq("user_id", userId);

  if (updateError) {
    console.warn("Пластик не возвращён:", updateError.code, updateError.message);
    return { refundedG: 0, remainingWeightG: remaining };
  }

  return { refundedG: refunded, remainingWeightG: next };
}

/** Запись плана пластика заказа: значение зажимается границами колонки. */
async function writeOrderPlasticPlan(
  supabase: Supabase,
  userId: string,
  orderId: string,
  materialWeightG: number,
): Promise<boolean> {
  const next = Math.min(
    Math.max(Math.round(materialWeightG), 0),
    ORDER_PLASTIC_LIMIT,
  );

  const { error } = await supabase
    .from("workshop_orders")
    .update({ material_weight_g: next })
    .eq("id", orderId)
    .eq("user_id", userId);

  if (error) {
    console.warn("План пластика не записан:", error.code, error.message);
    return false;
  }

  return true;
}

/** Списание добавки пластика: отказ вместо отрицательного остатка. */
type FilamentCharge =
  | { ok: true; chargedG: number; remainingWeightG: number | null }
  | { ok: false; error: string };

/**
 * Списать пластик за добавленные штуки позиции.
 *
 * Правило то же, что у `createOrder`: больше, чем есть на катушке, не списываем —
 * иначе склад перестал бы сходиться. Проверка стоит до записи количества, чтобы
 * отказ не оставлял позицию с большим числом штук и старым резервом.
 */
async function chargePlasticFromFilament(
  supabase: Supabase,
  userId: string,
  filamentId: string | null,
  grams: number,
): Promise<FilamentCharge> {
  const charge = Math.max(Math.round(grams), 0);

  if (!filamentId || charge === 0) {
    return { ok: true, chargedG: 0, remainingWeightG: null };
  }

  const { data, error } = await supabase
    .from("workshop_filaments")
    .select("brand, type, color, remaining_weight_g")
    .eq("id", filamentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Катушка не прочитана:", error.code, error.message);
    return { ok: false, error: LOAD_FAILED };
  }

  const row = (data ?? null) as Partial<Record<string, unknown>> | null;
  const remaining = Number(row?.remaining_weight_g);

  if (!row || !Number.isFinite(remaining)) {
    return { ok: false, error: LOAD_FAILED };
  }

  if (charge > remaining) {
    const label = [row.brand, row.type, row.color]
      .filter(
        (value): value is string =>
          typeof value === "string" && value.trim() !== "",
      )
      .join(" ");

    return {
      ok: false,
      error: `В катушке${label ? ` «${label}»` : ""} осталось ${formatGrams(remaining)}, а для добавки нужно ${formatGrams(charge)}. Уменьшите количество.`,
    };
  }

  const next = remaining - charge;
  const { error: updateError } = await supabase
    .from("workshop_filaments")
    .update(createFilamentUsagePayload(next))
    .eq("id", filamentId)
    .eq("user_id", userId);

  if (updateError) {
    console.warn("Пластик не списан:", updateError.code, updateError.message);
    return { ok: false, error: ORDER_ITEM_QUANTITY_FAILED };
  }

  return { ok: true, chargedG: charge, remainingWeightG: next };
}

/**
 * Возврат пластика после отмены, которая ещё не началась.
 *
 * Задание в статусе `queued` печать не начинало: пластик, списанный при создании
 * заказа, цел, и резерв возвращается на катушку. План заказа при этом обнуляется —
 * иначе повторная постановка в очередь оставила бы резерв двойным: первое `done`
 * вернуло бы план ещё раз через `writeOffFilamentFact`, и склад вырос бы сверх
 * катушки. При следующей печати спишется факт из G-кода, а не план.
 */
async function refundQueuedOrderPlastic(
  supabase: Supabase,
  userId: string,
  orderId: string,
): Promise<FilamentRefund & { planReset: boolean }> {
  const reserve = await readOrderPlasticReserve(supabase, userId, orderId);

  if (reserve.planG === 0 || reserve.isPlanReleased) {
    return { ...EMPTY_PLASTIC_REFUND, planReset: false };
  }

  const refund = await refundPlasticToFilament(
    supabase,
    userId,
    reserve.filamentId,
    reserve.planG,
  );

  // Возвращать было некуда (катушку удалили или остаток уже полный): план
  // оставляем, иначе резерв потерялся бы без следа на складе.
  if (refund.refundedG === 0) {
    return { ...refund, planReset: false };
  }

  const planReset = await writeOrderPlasticPlan(supabase, userId, orderId, 0);

  return { ...refund, planReset };
}

/** Позиция с заказом и резервом: всё, что нужно правке и удалению позиции. */
type OrderItemContext = {
  orderId: string;
  quantity: number;
  /** Сумма количеств всех позиций — знаменатель доли пластика. */
  orderQuantity: number;
  /** План пластика заказа, граммы. */
  materialWeightG: number;
  filamentId: string | null;
  /** План уже вернул `writeOffFilamentFact`: на катушку его не возвращаем. */
  isPlanReleased: boolean;
};

/**
 * Позиция вместе с заказом и очередью — общая проверка правки и удаления.
 *
 * Проверок пять: позиция принадлежит пользователю, по ней нет активного задания,
 * заказ существует, сумма количеств известна для доли пластика, а резерв заказа
 * не освобождён. Отказ возвращает готовый текст для карточки, чтобы обе операции
 * говорили одно и то же.
 *
 * `orderQuantity` считается до изменения: план делится по штукам, которые были в
 * заказе, иначе доля удаляемой позиции «съехала» бы к нулю уже после удаления.
 * Ошибка чтения заданий — отказ, а не «наверное, свободна»: правка необратима,
 * и печать поверх уменьшенного количества — это испорченная работа.
 */
async function readOrderItemContext(
  supabase: Supabase,
  userId: string,
  orderItemId: string,
): Promise<{ ok: true; data: OrderItemContext } | { ok: false; error: string }> {
  const { data: itemData, error: itemError } = await supabase
    .from("workshop_order_items")
    .select("id, order_id, quantity")
    .eq("id", orderItemId)
    .eq("user_id", userId)
    .maybeSingle();

  if (itemError) {
    console.warn("Позиция не прочитана:", itemError.code, itemError.message);

    return {
      ok: false,
      error: isMissingTableSchema(itemError.code, itemError.message)
        ? ORDER_ITEM_MIGRATION_MISSING
        : LOAD_FAILED,
    };
  }

  const itemRow = (itemData ?? null) as Partial<Record<string, unknown>> | null;
  const orderId = readRowText(itemRow?.order_id);

  if (!itemRow || !isOrderId(orderId)) {
    return { ok: false, error: ORDER_ITEM_NOT_FOUND };
  }

  const activeJobs = await countActivePrintJobsForItem(orderItemId, {
    supabase,
    userId,
  });

  if (!activeJobs.ok) {
    console.warn(
      "Задание позиции не прочитано:",
      activeJobs.reason,
      activeJobs.error,
    );

    return {
      ok: false,
      error:
        activeJobs.reason === "migration_missing"
          ? PRINT_QUEUE_MIGRATION_MISSING
          : LOAD_FAILED,
    };
  }

  if (activeJobs.data > 0) {
    return { ok: false, error: ORDER_ITEM_LOCKED };
  }

  const { data: orderData, error: orderError } = await supabase
    .from("workshop_orders")
    .select("material_weight_g, filament_id")
    .eq("id", orderId)
    .eq("user_id", userId)
    .maybeSingle();

  if (orderError) {
    console.warn(
      "Заказ позиции не прочитан:",
      orderError.code,
      orderError.message,
    );

    return { ok: false, error: LOAD_FAILED };
  }

  if (!orderData) {
    return { ok: false, error: ORDER_NOT_FOUND };
  }

  const { data: quantityRows, error: quantityError } = await supabase
    .from("workshop_order_items")
    .select("quantity")
    .eq("order_id", orderId)
    .eq("user_id", userId);

  if (quantityError) {
    console.warn(
      "Позиции заказа не прочитаны:",
      quantityError.code,
      quantityError.message,
    );

    return { ok: false, error: LOAD_FAILED };
  }

  const orderQuantity = readRows(quantityRows).reduce(
    (sum, row) => sum + readOrderItemQuantity(row.quantity).quantity,
    0,
  );
  const reserve = await readOrderPlasticReserve(supabase, userId, orderId);

  return {
    ok: true,
    data: {
      orderId,
      quantity: readOrderItemQuantity(itemRow.quantity).quantity,
      orderQuantity,
      materialWeightG: reserve.planG,
      filamentId: reserve.filamentId,
      isPlanReleased: reserve.isPlanReleased,
    },
  };
}

/**
 * Удаление позиции заказа.
 *
 * Порядок: UUID → сессия → подписка → позиция с заказом и очередью → удаление →
 * возврат пластика. Позицию с активным заданием удалять нельзя: задание
 * ссылается на `order_item_id`, и строка унесла бы его с собой — агент остался бы
 * с печатью без позиции в базе. Сначала мастер отменяет печать.
 *
 * Пластик: позиция не хранит вес, поэтому её доля считается от плана заказа
 * (`plasticForUnits`). Резерв заказа уменьшается на эту же долю, а катушка
 * получает её обратно — но только пока резерв не освобождён: после первого `done`
 * план вернул `writeOffFilamentFact`, и второй возврат сделал бы склад больше,
 * чем он есть. Сбой возврата не отменяет удаление: позиция — намерение мастера,
 * а остаток катушки правится на складе вручную.
 */
export async function deleteOrderItem(
  orderItemId: string,
): Promise<OrderActionState> {
  if (!isOrderId(orderItemId)) {
    return { ok: false, error: ORDER_ITEM_NOT_FOUND };
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

  const context = await readOrderItemContext(supabase, user.id, orderItemId);

  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  const share = plasticForUnits(
    context.data.materialWeightG,
    context.data.quantity,
    context.data.orderQuantity,
  );

  const { data, error } = await supabase
    .from("workshop_order_items")
    .delete()
    .eq("id", orderItemId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn("Позиция не удалена:", error.code, error.message);

    return {
      ok: false,
      error: isMissingTableSchema(error.code, error.message)
        ? ORDER_ITEM_MIGRATION_MISSING
        : ORDER_ITEM_DELETE_FAILED,
    };
  }

  if (!data) {
    return { ok: false, error: ORDER_ITEM_NOT_FOUND };
  }

  if (share > 0) {
    await writeOrderPlasticPlan(
      supabase,
      user.id,
      context.data.orderId,
      context.data.materialWeightG - share,
    );
  }

  const refund = context.data.isPlanReleased
    ? EMPTY_PLASTIC_REFUND
    : await refundPlasticToFilament(
        supabase,
        user.id,
        context.data.filamentId,
        share,
      );

  revalidatePath("/dashboard/workshop");

  const note = plasticRefundNote(refund);

  return {
    ok: true,
    message: note ? `Позиция удалена. ${note}` : "Позиция удалена.",
  };
}

/**
 * Изменение количества в позиции заказа.
 *
 * Проверки те же, что у удаления: UUID → количество → сессия → подписка →
 * позиция без активного задания. Количество проверяет `readOrderItemQuantity` —
 * тот же разбор, что у базы (`1…10 000`, целое), поэтому дробь и ноль
 * отклоняются до запроса.
 *
 * Пластик двигается вместе с количеством: добавка списывается с катушки (и
 * отклоняется, если её не хватает — как в `createOrder`), убавка возвращается.
 * Доля считается от плана заказа по штукам (`plasticForUnits`), а сам план
 * сдвигается на ту же величину: иначе следующий возврат по заказу считался бы от
 * старого числа штук. После первого `done` план уже вернул
 * `writeOffFilamentFact`, поэтому катушке он не возвращается повторно.
 */
export async function updateOrderItemQuantity(
  orderItemId: string,
  quantity: number,
): Promise<OrderActionState> {
  if (!isOrderId(orderItemId)) {
    return { ok: false, error: ORDER_ITEM_NOT_FOUND };
  }

  const { quantity: nextQuantity, error: quantityError } =
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

  const context = await readOrderItemContext(supabase, user.id, orderItemId);

  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  if (context.data.quantity === nextQuantity) {
    return { ok: true, message: `Количество уже ${nextQuantity}.` };
  }

  const deltaGrams = plasticForUnits(
    context.data.materialWeightG,
    nextQuantity - context.data.quantity,
    context.data.orderQuantity,
  );

  // Добавка проверяется до записи: списать больше, чем осталось на катушке,
  // нельзя — склад перестал бы сходиться, а отказ должен оставить позицию с
  // прежним количеством и прежним резервом.
  let charge: FilamentCharge = {
    ok: true,
    chargedG: 0,
    remainingWeightG: null,
  };

  if (deltaGrams > 0) {
    charge = await chargePlasticFromFilament(
      supabase,
      user.id,
      context.data.filamentId,
      deltaGrams,
    );

    if (!charge.ok) {
      return { ok: false, error: charge.error };
    }
  }

  const { data, error } = await supabase
    .from("workshop_order_items")
    .update({ quantity: nextQuantity })
    .eq("id", orderItemId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn("Количество не изменено:", error.code, error.message);

    // Пластик за добавку уже списан, а количество осталось прежним — возвращаем.
    if (charge.ok && charge.chargedG > 0) {
      await refundPlasticToFilament(
        supabase,
        user.id,
        context.data.filamentId,
        charge.chargedG,
      );
    }

    return {
      ok: false,
      error: isMissingTableSchema(error.code, error.message)
        ? ORDER_ITEM_MIGRATION_MISSING
        : ORDER_ITEM_QUANTITY_FAILED,
    };
  }

  if (!data) {
    // Позицию удалили в другой вкладке уже после проверки: добавка списана
    // впустую — возвращаем её на катушку.
    if (charge.ok && charge.chargedG > 0) {
      await refundPlasticToFilament(
        supabase,
        user.id,
        context.data.filamentId,
        charge.chargedG,
      );
    }

    return { ok: false, error: ORDER_ITEM_NOT_FOUND };
  }

  if (deltaGrams !== 0) {
    await writeOrderPlasticPlan(
      supabase,
      user.id,
      context.data.orderId,
      context.data.materialWeightG + deltaGrams,
    );
  }

  let refund: FilamentRefund = EMPTY_PLASTIC_REFUND;

  if (deltaGrams < 0 && !context.data.isPlanReleased) {
    refund = await refundPlasticToFilament(
      supabase,
      user.id,
      context.data.filamentId,
      -deltaGrams,
    );
  }

  revalidatePath("/dashboard/workshop");

  const parts = [`Количество: ${context.data.quantity} → ${nextQuantity}.`];

  if (charge.ok && charge.chargedG > 0) {
    parts.push(
      charge.remainingWeightG === null
        ? `Пластик: списано ${formatGrams(charge.chargedG)}.`
        : `Пластик: списано ${formatGrams(charge.chargedG)}, на катушке ${formatGrams(charge.remainingWeightG)}.`,
    );
  }

  const note = plasticRefundNote(refund);

  if (note) {
    parts.push(note);
  }

  return { ok: true, message: parts.join(" ") };
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

