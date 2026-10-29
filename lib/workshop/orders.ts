/**
 * Заказы Мастерской: модель для интерфейса, статусы, пределы полей и разбор
 * формы.
 *
 * Пределы повторяют `supabase/workshop_printers_orders.sql`: форма не даст
 * ввести число, которое база отклонит. Числа заказа — стоимость, вес и время
 * печати — при создании заказа меняют ещё две таблицы: наработку принтера и
 * остаток катушки. Поэтому арифметика вынесена в чистые функции
 * `planPrinterUsage` и `planFilamentUsage`: их же проверяют тесты, их же
 * использует Server Action.
 *
 * Статусы образуют последовательность new → printing → ready → delivered:
 * по ней строится Kanban и считается «следующий шаг» в `nextOrderStatus`.
 * Server Action `updateOrderStatus` принимает любой допустимый статус, поэтому
 * карточку можно вернуть назад — порядок задаёт раскладку, а не запрет.
 */
import { formatMoney } from "@/lib/workshop/calculator";
import {
  formatGrams,
  isFilamentId,
  type WorkshopFilament,
} from "@/lib/workshop/filaments";
import {
  isIsoDate,
  isPrinterId,
  type WorkshopPrinter,
} from "@/lib/workshop/printers";
import {
  formatWorkshopLimit,
  parseWorkshopNumber,
} from "@/lib/workshop/settings";

/**
 * Статусы, в которых заказ двигается по Kanban: new → printing → ready →
 * delivered. Именно по ним считается «следующий шаг» в `nextOrderStatus`.
 */
export type OrderFlowStatus = "new" | "printing" | "ready" | "delivered";

/**
 * Все статусы строки workshop_orders.
 *
 * `unmapped` — заказ маркетплейса, в котором хотя бы один SKU не связан с
 * товаром каталога. Он приходит из `lib/order-processor.ts`, не показывается
 * колонками Kanban и не может быть переведён дальше, пока связи нет: печатать
 * нечего. Статус добавляет `supabase/workshop_farm_and_shop.sql`.
 */
export type OrderStatus = OrderFlowStatus | "unmapped";

/** Порядок статусов Kanban: по нему считается следующий шаг. */
export const ORDER_STATUS_SEQUENCE: readonly OrderFlowStatus[] = [
  "new",
  "printing",
  "ready",
  "delivered",
];

/** Все допустимые значения workshop_orders.status, включая unmapped. */
export const ORDER_STATUSES: readonly OrderStatus[] = [
  ...ORDER_STATUS_SEQUENCE,
  "unmapped",
];

/** Подпись и цвет бейджа статуса. Классы статические — Tailwind их видит. */
export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; badgeClassName: string }
> = {
  new: {
    label: "Новый",
    badgeClassName: "border-white/20 bg-white/10 text-slate-100",
  },
  printing: {
    label: "В печати",
    badgeClassName: "border-blue-400/40 bg-blue-500/15 text-blue-100",
  },
  ready: {
    label: "Готов",
    badgeClassName: "border-emerald-400/40 bg-emerald-500/15 text-emerald-100",
  },
  delivered: {
    label: "Доставлен",
    badgeClassName: "border-white/10 bg-white/5 text-slate-400",
  },
  unmapped: {
    label: "Без маппинга",
    badgeClassName: "border-amber-400/40 bg-amber-500/15 text-amber-100",
  },
};

/** Следующий статус или null: «Доставлен» дальше не двигается. */
export function nextOrderStatus(
  status: OrderFlowStatus,
): OrderFlowStatus | null {
  const index = ORDER_STATUS_SEQUENCE.indexOf(status);

  return index >= 0 && index < ORDER_STATUS_SEQUENCE.length - 1
    ? ORDER_STATUS_SEQUENCE[index + 1]
    : null;
}

/**
 * Статус, в который можно перетащить карточку.
 *
 * `unmapped` сюда не входит: такой заказ сначала лечат связью SKU на странице
 * маркетплейса, а не сменой статуса вручную.
 */
export function isOrderFlowStatus(value: unknown): value is OrderFlowStatus {
  return (
    typeof value === "string" &&
    (ORDER_STATUS_SEQUENCE as readonly string[]).includes(value)
  );
}

/** Любой статус из строки базы, включая unmapped. */
export function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    typeof value === "string" &&
    (ORDER_STATUSES as readonly string[]).includes(value)
  );
}

/** Источники заказа; строки совпадают с check в SQL-миграции. */
export const ORDER_SOURCES = ["manual", "ozon", "wb", "yandex"] as const;

export type OrderSource = (typeof ORDER_SOURCES)[number];

/** Источник из строки базы: неизвестное значение считается ручным. */
export function isOrderSource(value: unknown): value is OrderSource {
  return (
    typeof value === "string" &&
    (ORDER_SOURCES as readonly string[]).includes(value)
  );
}

/** Заказ в том виде, в каком с ним работает интерфейс. */
export type WorkshopOrder = {
  id: string;
  title: string;
  clientName: string | null;
  /** Ссылка на клиента из базы; null — ручной ввод или старый заказ. */
  clientId: string | null;
  /** Откуда пришёл заказ; старые строки без source — ручные. */
  source: OrderSource;
  status: OrderStatus;
  totalCost: number;
  materialWeightG: number;
  printTimeHours: number;
  printerId: string | null;
  filamentId: string | null;
  notes: string | null;
  /** Срок сдачи в формате ГГГГ-ММ-ДД. */
  deadline: string | null;
  createdAt: string | null;
};

/** Проверенный ввод формы «Создать заказ». Пустые ссылки — null. */
export type OrderDraft = {
  title: string;
  clientName: string;
  /** Выбранный клиент из базы; пустая строка в форме даёт null. */
  clientId: string | null;
  totalCost: number;
  materialWeightG: number;
  printTimeHours: number;
  printerId: string | null;
  filamentId: string | null;
  productId: string | null;
  notes: string;
  deadline: string | null;
};

export type OrderFormErrors = Partial<
  Record<
    | "title"
    | "clientName"
    | "clientId"
    | "totalCost"
    | "materialWeightG"
    | "printTimeHours"
    | "printerId"
    | "filamentId"
    | "productId"
    | "notes"
    | "deadline",
    string
  >
>;

/** Базовые колонки без необязательных `source` и `client_id`. */
export const ORDER_BASE_COLUMNS =
  "id, title, client_name, status, total_cost, material_weight_g, print_time_hours, printer_id, filament_id, notes, deadline, created_at";

/**
 * Колонки, которые читает lib/workshop/order-store.ts.
 *
 * `source` добавляет миграция `supabase/workshop_marketplace_integration.sql`.
 * Пока её не применили, `getWorkshopOrder` и список заказов повторяют запрос
 * с `ORDER_BASE_COLUMNS`: старые строки получают источник `manual`.
 */
export const ORDER_COLUMNS = `${ORDER_BASE_COLUMNS}, source`;

/**
 * Базовые колонки плюс ссылка на клиента, но без `source`.
 *
 * Нужен для базы, где уже применена миграция
 * `supabase/workshop_orders_client_id.sql`, а миграция источника заказов — ещё
 * нет: карточка сохраняет клиента, а `source` временно считается ручным.
 */
export const ORDER_CLIENT_BASE_COLUMNS = `${ORDER_BASE_COLUMNS}, client_id`;

/**
 * Полный набор для чтения: источник заказа и ссылка на клиента.
 *
 * Если в базе нет одной из необязательных колонок, order-store перебирает
 * резервные наборы: без `source`, без `client_id` и совсем базовый.
 */
export const ORDER_CLIENT_COLUMNS = `${ORDER_COLUMNS}, client_id`;

/** Пределы текстовых полей — как у колонок text в миграции. */
export const ORDER_TEXT_LIMITS = {
  title: 80,
  clientName: 60,
  notes: 1000,
} as const;

/** Пределы чисел заказа — те же, что в check-ограничениях SQL. */
export const ORDER_LIMITS = {
  costMax: 1000000,
  weightMax: 100000,
  hoursMax: 100000,
} as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Идентификатор заказа: мусор отсекаем до запроса к PostgREST. */
export function isOrderId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** Стоимость для интерфейса: «1 500 ₽». */
export function formatOrderCost(value: number): string {
  return formatMoney(value);
}

/** Срок сдачи: «24.10.2026» вместо машинного «2026-10-24». */
export function formatOrderDate(value: string | null): string {
  if (!isIsoDate(value)) {
    return "—";
  }

  const [year, month, day] = value.split("-");

  return `${day}.${month}.${year}`;
}

/** Время печати: «2,5 ч». */
export function formatOrderHours(value: number): string {
  const formatter = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 2,
  });

  return `${formatter.format(value)} ч`;
}

/**
 * Форма «Создать заказ» → проверенные значения.
 *
 * Пустой принтер или катушка — законный вариант: заказ можно завести до того,
 * как выбрана техника. А вот мусор вместо uuid отклоняется здесь, иначе
 * PostgREST ответил бы 22P02 уже на вставке.
 */
export function readOrderForm(formData: FormData): {
  draft: OrderDraft | null;
  errors: OrderFormErrors;
} {
  const errors: OrderFormErrors = {};

  const title = readFormText(formData.get("title"));

  if (!title) {
    errors.title = "Введите название заказа.";
  } else if (title.length > ORDER_TEXT_LIMITS.title) {
    errors.title = `Не больше ${ORDER_TEXT_LIMITS.title} символов.`;
  }

  const clientName = readFormText(formData.get("clientName"));

  if (clientName.length > ORDER_TEXT_LIMITS.clientName) {
    errors.clientName = `Не больше ${ORDER_TEXT_LIMITS.clientName} символов.`;
  }

  // client_id — необязательная ссылка на клиента из базы клиентов.
  const client = readOptionalId(
    formData.get("clientId"),
    isOrderId,
    "Клиент не найден — обновите страницу.",
  );

  if (client.error) {
    errors.clientId = client.error;
  }

  const notes = readFormText(formData.get("notes"));

  if (notes.length > ORDER_TEXT_LIMITS.notes) {
    errors.notes = `Не больше ${ORDER_TEXT_LIMITS.notes} символов.`;
  }

  const cost = readNumberField(
    formData.get("totalCost"),
    0,
    ORDER_LIMITS.costMax,
    " ₽",
  );

  if (!cost.ok) {
    errors.totalCost = cost.error;
  }

  const weight = readNumberField(
    formData.get("materialWeightG"),
    0,
    ORDER_LIMITS.weightMax,
    " г",
    true,
  );

  if (!weight.ok) {
    errors.materialWeightG = weight.error;
  }

  const hours = readNumberField(
    formData.get("printTimeHours"),
    0,
    ORDER_LIMITS.hoursMax,
    " ч",
  );

  if (!hours.ok) {
    errors.printTimeHours = hours.error;
  }

  const printer = readOptionalId(
    formData.get("printerId"),
    isPrinterId,
    "Принтер не найден — обновите страницу.",
  );

  if (printer.error) {
    errors.printerId = printer.error;
  }

  const filament = readOptionalId(
    formData.get("filamentId"),
    isFilamentId,
    "Катушка не найдена — обновите страницу.",
  );

  if (filament.error) {
    errors.filamentId = filament.error;
  }

  // product_id — такой же uuid, как id заказа и ссылки на технику.
  const product = readOptionalId(
    formData.get("productId"),
    isOrderId,
    "Товар не найден — обновите страницу.",
  );

  if (product.error) {
    errors.productId = product.error;
  }

  const rawDeadline = readFormText(formData.get("deadline"));
  let deadline: string | null = null;

  if (rawDeadline) {
    if (isIsoDate(rawDeadline)) {
      deadline = rawDeadline;
    } else {
      errors.deadline = "Укажите дату в формате ГГГГ-ММ-ДД.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { draft: null, errors };
  }

  return {
    draft: {
      title,
      clientName,
      clientId: client.id,
      totalCost: cost.ok ? cost.value : 0,
      materialWeightG: weight.ok ? weight.value : 0,
      printTimeHours: hours.ok ? hours.value : 0,
      printerId: printer.id,
      filamentId: filament.id,
      productId: product.id,
      notes,
      deadline,
    },
    errors,
  };
}

/**
 * Проверенный ввод формы «Редактировать заказ».
 *
 * Отличие от `OrderDraft` одно: карточка не меняет статус и технику. Статус
 * двигает Kanban, принтер и катушку выбирают при создании, поэтому правка
 * обновляет только текстовые и числовые поля заказа.
 */
export type OrderEditDraft = Omit<
  OrderDraft,
  "printerId" | "filamentId" | "productId"
>;

/**
 * Форма «Редактировать заказ» → проверенные значения.
 *
 * Разбор общий с созданием (`readOrderForm`): пределы чисел, формат даты и uuid
 * клиента проверяются одинаково. Полей техники в этой форме нет, поэтому в
 * результат они не попадают — правка не может сменить принтер или катушку
 * незаметно для наработки и склада.
 */
export function readOrderEditForm(formData: FormData): {
  draft: OrderEditDraft | null;
  errors: OrderFormErrors;
} {
  const { draft, errors } = readOrderForm(formData);

  if (!draft) {
    return { draft: null, errors };
  }

  return {
    draft: {
      title: draft.title,
      clientName: draft.clientName,
      clientId: draft.clientId,
      totalCost: draft.totalCost,
      materialWeightG: draft.materialWeightG,
      printTimeHours: draft.printTimeHours,
      notes: draft.notes,
      deadline: draft.deadline,
    },
    errors,
  };
}

/**
 * Строка `workshop_orders` → заказ для интерфейса.
 *
 * Незнакомый статус считается «новым», битое число — нулём, ссылка без
 * корректного uuid — отсутствующей. Один странный ряд не должен ломать
 * таблицу заказов.
 */
export function normalizeOrderRow(
  row: Partial<Record<string, unknown>> | null | undefined,
): WorkshopOrder | null {
  if (!row || !isOrderId(row.id)) {
    return null;
  }

  return {
    id: row.id,
    title: readText(row.title, ORDER_TEXT_LIMITS.title) || "Без названия",
    clientName:
      readText(row.client_name, ORDER_TEXT_LIMITS.clientName) || null,
    clientId: isOrderId(row.client_id) ? row.client_id : null,
    source: isOrderSource(row.source) ? row.source : "manual",
    status: isOrderStatus(row.status) ? row.status : "new",
    totalCost:
      readNumberInRange(row.total_cost, 0, ORDER_LIMITS.costMax) ?? 0,
    materialWeightG:
      readNumberInRange(
        row.material_weight_g,
        0,
        ORDER_LIMITS.weightMax,
        true,
      ) ?? 0,
    printTimeHours:
      readNumberInRange(row.print_time_hours, 0, ORDER_LIMITS.hoursMax) ?? 0,
    printerId: isPrinterId(row.printer_id) ? row.printer_id : null,
    filamentId: isFilamentId(row.filament_id) ? row.filament_id : null,
    notes: readText(row.notes, ORDER_TEXT_LIMITS.notes) || null,
    deadline: isIsoDate(row.deadline) ? row.deadline : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
  };
}

/** Комментарий к заказу в том виде, в каком его показывает карточка. */
export type OrderComment = {
  id: string;
  orderId: string;
  text: string;
  createdAt: string | null;
};

/** Колонки, которые читает `getOrderComments` из `order-store.ts`. */
export const ORDER_COMMENT_COLUMNS = "id, order_id, text, created_at";

/** Предел текста комментария — как у check в workshop_order_comments.sql. */
export const ORDER_COMMENT_TEXT_LIMIT = 1000;

/**
 * Текст комментария из формы или Server Action.
 *
 * Проверка одна для браузера и сервера: пустая строка и одни пробелы не
 * считаются комментарием, а длинный текст отклоняется до запроса к базе.
 * Возвращаем обрезанный текст — в ленте не нужны пробелы по краям.
 */
export function readOrderCommentText(value: unknown): {
  text: string;
  error: string | null;
} {
  const text = typeof value === "string" ? value.trim() : "";

  if (!text) {
    return { text: "", error: "Введите комментарий." };
  }

  if (text.length > ORDER_COMMENT_TEXT_LIMIT) {
    return {
      text: "",
      error: `Не больше ${ORDER_COMMENT_TEXT_LIMIT} символов.`,
    };
  }

  return { text, error: null };
}

/**
 * Строка `workshop_order_comments` → комментарий для интерфейса.
 *
 * Битые ряды отбрасываются: без uuid, без текста или с пустым текстом строку
 * нечем показать. Один странный ряд не должен ронять ленту.
 */
export function normalizeOrderComment(
  row: Partial<Record<string, unknown>> | null | undefined,
): OrderComment | null {
  if (!row || !isOrderId(row.id) || !isOrderId(row.order_id)) {
    return null;
  }

  const { text } = readOrderCommentText(row.text);

  if (!text) {
    return null;
  }

  return {
    id: row.id,
    orderId: row.order_id,
    text,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
  };
}

// -----------------------------------------------------------------------------
// Позиции заказа
// -----------------------------------------------------------------------------

/**
 * Колонки позиции для карточки заказа.
 *
 * Товар приходит по внешнему ключу `workshop_order_items_product_id_fkey` из
 * `supabase/workshop_farm_and_shop.sql`: имя связи должно совпадать с базой,
 * иначе PostgREST не найдёт отношение. Карточке нужно только название — цена и
 * габариты товара уже есть в списке `products` на странице.
 */
export const ORDER_ITEM_COLUMNS =
  "id, product_id, sku, quantity, created_at, product:workshop_products!workshop_order_items_product_id_fkey(id, title)";

/** Позиция заказа в карточке: название товара и количество. */
export type OrderItemSummary = {
  id: string;
  /** Товар каталога; null — товар удалили, остались артикул и количество. */
  productId: string | null;
  /** Артикул на момент добавления; null — позиция без артикула. */
  sku: string | null;
  /** Название товара; null — товара уже нет в каталоге. */
  productTitle: string | null;
  quantity: number;
};

/** Предел количества — как у check в `workshop_order_items` (1…10 000). */
export const ORDER_ITEM_QUANTITY_LIMIT = 10_000;

/**
 * Артикул позиции: снимок `workshop_products.sku` на момент добавления.
 *
 * Пустая строка и значение длиннее 128 символов дают null: база принимает
 * только `char_length(btrim(sku)) between 1 and 128`
 * (`workshop_order_items_sku_check`).
 */
export function readOrderItemSku(value: unknown): string | null {
  const sku = typeof value === "string" ? value.trim() : "";

  return sku && sku.length <= 128 ? sku : null;
}

/**
 * Количество из формы или Server Action.
 *
 * Проверка одна для браузера и сервера: база принимает целое от 1 до 10 000
 * (`workshop_order_items_quantity_check`), поэтому пустое и дробное значение
 * отклоняются до запроса. Запятая понимается как десятичный разделитель —
 * `parseWorkshopNumber` тот же, что у остальных числовых полей мастерской.
 */
export function readOrderItemQuantity(value: unknown): {
  quantity: number;
  error: string | null;
} {
  const parsed = parseWorkshopNumber(
    typeof value === "string" ? value.trim() : value,
  );

  if (parsed === null) {
    return { quantity: 0, error: "Укажите количество." };
  }

  if (!Number.isInteger(parsed)) {
    return { quantity: 0, error: "Количество — целое число." };
  }

  if (parsed < 1 || parsed > ORDER_ITEM_QUANTITY_LIMIT) {
    return {
      quantity: 0,
      error: `Количество — от 1 до ${formatWorkshopLimit(ORDER_ITEM_QUANTITY_LIMIT)}.`,
    };
  }

  return { quantity: parsed, error: null };
}

/**
 * Строка `workshop_order_items` → позиция для карточки.
 *
 * Товар приходит объектом (связь «многие к одному»), но PostgREST умеет
 * отдавать и массив — читаем оба вида. Строка без uuid или с количеством вне
 * предела отбрасывается: карточка не должна падать из-за одной битой записи.
 */
export function normalizeOrderItemSummary(
  row: Partial<Record<string, unknown>> | null | undefined,
): OrderItemSummary | null {
  if (!row || !isOrderId(row.id)) {
    return null;
  }

  const { quantity, error } = readOrderItemQuantity(row.quantity);

  if (error) {
    return null;
  }

  const product = (
    Array.isArray(row.product) ? row.product[0] : row.product
  ) as Partial<Record<string, unknown>> | null | undefined;

  return {
    id: row.id,
    productId: isOrderId(row.product_id) ? row.product_id : null,
    sku: readOrderItemSku(row.sku),
    productTitle: product ? readText(product.title, 200) || null : null,
    quantity,
  };
}

/**
 * Новая наработка принтера после заказа.
 *
 * Время печати прибавляется ко всем четырём счётчикам сразу: общий износ,
 * ресурс сопла, ресурс смазки осей и ресурс винта Z. Смазка накапливается даже
 * при интервале 0 — часы всё равно полезны, а карточка показывает «Без смазки»
 * вместо бара. Округление до сотых совпадает с numeric(12, 2) в базе.
 */
export function planPrinterUsage(
  printer: Pick<
    WorkshopPrinter,
    "totalHours" | "nozzleHours" | "lubricationHours" | "zScrewHours"
  >,
  printTimeHours: number,
): {
  totalHours: number;
  nozzleHours: number;
  lubricationHours: number;
  zScrewHours: number;
} {
  const add = (hours: number) =>
    Math.round((hours + Math.max(0, printTimeHours)) * 100) / 100;

  return {
    totalHours: add(printer.totalHours),
    nozzleHours: add(printer.nozzleHours),
    lubricationHours: add(printer.lubricationHours),
    zScrewHours: add(printer.zScrewHours),
  };
}

/**
 * Остаток катушки после заказа.
 *
 * Отказ вместо отрицательного остатка: списать больше, чем есть, нельзя —
 * иначе склад перестал бы сходиться, а долг по пластику нигде не виден.
 * Вес в базе целый, поэтому граммы округляются.
 */
export type FilamentUsagePlan =
  | { ok: true; remainingWeightG: number }
  | { ok: false; error: string };

export function planFilamentUsage(
  filament: Pick<
    WorkshopFilament,
    "brand" | "type" | "color" | "remainingWeightG"
  >,
  weightG: number,
): FilamentUsagePlan {
  const grams = Math.max(0, Math.round(weightG));

  if (grams === 0) {
    return { ok: true, remainingWeightG: filament.remainingWeightG };
  }

  if (grams > filament.remainingWeightG) {
    const label = [filament.brand, filament.type, filament.color]
      .filter(Boolean)
      .join(" ");

    return {
      ok: false,
      error: `В катушке${label ? ` «${label}»` : ""} осталось ${formatGrams(filament.remainingWeightG)}, а для заказа нужно ${formatGrams(grams)}. Выберите другую катушку или уменьшите вес.`,
    };
  }

  return { ok: true, remainingWeightG: filament.remainingWeightG - grams };
}

/** Число из формы: целое или с копейками, в пределах и с единицей в ошибке. */
function readNumberField(
  value: FormDataEntryValue | null,
  min: number,
  max: number,
  unit: string,
  integer = false,
):
  | { ok: true; value: number }
  | { ok: false; error: string } {
  const parsed = parseWorkshopNumber(value);

  if (parsed === null) {
    return { ok: false, error: "Введите число." };
  }

  const rounded = integer ? Math.round(parsed) : Math.round(parsed * 100) / 100;

  if (rounded < min || rounded > max) {
    return {
      ok: false,
      error: `Допустимо от ${formatWorkshopLimit(min)} до ${formatWorkshopLimit(max)}${unit}.`,
    };
  }

  return { ok: true, value: rounded };
}

/** Необязательная ссылка: пустая строка — «не выбрано», иначе uuid. */
function readOptionalId(
  value: FormDataEntryValue | null,
  isValid: (value: unknown) => value is string,
  error: string,
): { id: string | null; error: string | null } {
  const raw = readFormText(value);

  if (!raw) {
    return { id: null, error: null };
  }

  return isValid(raw) ? { id: raw, error: null } : { id: null, error };
}

/** Число из строки базы: только в пределах. */
function readNumberInRange(
  value: unknown,
  min: number,
  max: number,
  integer = false,
): number | null {
  const parsed = parseWorkshopNumber(value);

  if (parsed === null) {
    return null;
  }

  const rounded = integer ? Math.round(parsed) : Math.round(parsed * 100) / 100;

  return rounded < min || rounded > max ? null : rounded;
}

/** Текст из строки базы: обрезаем пробелы и лишнюю длину. */
function readText(value: unknown, limit: number): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

/** Текст из формы: пробелы по краям не считаются содержимым. */
function readFormText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}
