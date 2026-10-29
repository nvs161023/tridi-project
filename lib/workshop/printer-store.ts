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
  PRINTER_BASE_COLUMNS,
  PRINTER_COLUMNS,
  isPrinterId,
  normalizeDiscoveredPrinterRow,
  normalizePrinterRow,
  type DiscoveredPrinter,
  type PrinterActiveJobs,
  type WorkshopPrinter,
} from "@/lib/workshop/printers";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type WorkshopPrintersSnapshot = {
  printers: WorkshopPrinter[];
  /** Названия заказов, которые печатаются сейчас: `printer_id` → title. */
  activeJobs: PrinterActiveJobs;
  /** В базе нет таблицы workshop_printers — миграция не применена. */
  isMissingTable: boolean;
};

/**
 * Строка задания с вложенным заказом: связь названа явно, чтобы PostgREST не
 * гадал. Вложенность бывает и объектом, и массивом из одной записи — тип
 * Supabase-клиента без сгенерированной схемы описывает её массивом.
 */
type ActiveJobRow = {
  printer_id: string | null;
  order: { title: string | null } | { title: string | null }[] | null;
};

/**
 * Заказы, которые печатаются прямо сейчас.
 *
 * Название заказа лежит не в принтере: его даёт связь
 * `workshop_print_jobs` → `workshop_orders` по `order_id`. Имя ограничения
 * указано явно — у задания несколько внешних ключей, и без подсказки PostgREST
 * однажды ответит PGRST201 «ambiguous embedding».
 *
 * Без миграции `workshop_farm_and_shop.sql` таблицы заданий нет: карточки
 * показываются без строки заказа, а ворнинг в лог не пишется — это ожидаемое
 * состояние, а не сбой.
 */
export async function getActivePrinterJobs(
  supabase: Supabase,
  userId: string,
): Promise<PrinterActiveJobs> {
  const { data, error } = await supabase
    .from("workshop_print_jobs")
    .select(
      "printer_id, order:workshop_orders!workshop_print_jobs_order_id_fkey(title)",
    )
    .eq("user_id", userId)
    .eq("status", "printing");

  if (error) {
    if (!isMissingTableSchema(error.code, error.message)) {
      console.warn(
        "Текущие задания принтеров не прочитаны:",
        error.code,
        error.message,
      );
    }

    return {};
  }

  const jobs: PrinterActiveJobs = {};

  for (const row of (data ?? []) as unknown as ActiveJobRow[]) {
    const order = Array.isArray(row.order) ? row.order[0] : row.order;
    const title = order?.title?.trim();

    if (isPrinterId(row.printer_id) && title) {
      jobs[row.printer_id] = title;
    }
  }

  return jobs;
}

/** PostgREST/PostgreSQL: выбранной колонки ещё нет в базе. */
function isMissingColumnSchema(error: { code?: string | null }): boolean {
  return error.code === "42703" || error.code === "PGRST204";
}

/**
 * Принтеры пользователя: сначала добавленные раньше, чтобы список не прыгал.
 *
 * Живые колонки (status, progress, remaining_time, last_seen_at) появляются
 * миграцией `supabase/workshop_farm_and_shop.sql`. Пока её не применили, запрос
 * с ними падает на 42703/PGRST204 — тогда парк перечитывается базовым набором
 * колонок, а карточки показывают обслуживание без метки состояния. Так же
 * поступает `getWorkshopOrder()` с колонкой client_id.
 */
export async function getWorkshopPrinters(
  supabase: Supabase,
  userId: string,
): Promise<WorkshopPrintersSnapshot> {
  // Два независимых запроса: список парка и названия заказов в печати.
  // Параллельно, потому что карточке нужны оба, а ждать их по очереди незачем.
  const [livePrinters, activeJobs] = await Promise.all([
    supabase
      .from("workshop_printers")
      .select(PRINTER_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    getActivePrinterJobs(supabase, userId),
  ]);

  // Тип ответа намеренно свободный: наборы колонок у двух запросов разные, а
  // разбирает строки всё равно normalizePrinterRow.
  let printersResult: {
    data: unknown;
    error: { code?: string | null; message?: string | null } | null;
  } = livePrinters;

  if (printersResult.error && isMissingColumnSchema(printersResult.error)) {
    printersResult = await supabase
      .from("workshop_printers")
      .select(PRINTER_BASE_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
  }

  const { data, error } = printersResult;

  if (error) {
    console.warn("Принтеры мастерской не прочитаны:", error.code, error.message);

    return {
      printers: [],
      activeJobs: {},
      isMissingTable: isMissingTableSchema(error.code, error.message),
    };
  }

  const rows = (data ?? []) as Partial<Record<string, unknown>>[];

  return {
    printers: rows
      .map(normalizePrinterRow)
      .filter((printer): printer is WorkshopPrinter => printer !== null),
    activeJobs,
    isMissingTable: false,
  };
}

export type DiscoveredPrintersSnapshot = {
  printers: DiscoveredPrinter[];
  /** В базе нет таблицы workshop_discovered_printers — миграция не применена. */
  isMissingTable: boolean;
};

/**
 * Принтеры, которые агент нашёл в сети и которые ждут подтверждения мастера.
 *
 * Статус фильтруется в запросе: индекс `(user_id, status)` из
 * `supabase/workshop_farm_and_shop.sql` создан ровно под эту пару. Порядок —
 * `created_at asc`, то есть порядок, в котором агент присылал находки: мастер
 * видит ферму в том же порядке, в каком её обошёл сканер.
 *
 * Без миграции возвращается пустой список с признаком `isMissingTable`: вкладка
 * не падает, а мастер подключения честно говорит, что таблицы нет. Прочие
 * ошибки чтения тоже не пробрасываются — находки есть, а списка нет, и это
 * состояние лучше показать пустым окном, чем красной страницей.
 */
export async function getDiscoveredPrinters(
  supabase: Supabase,
  userId: string,
): Promise<DiscoveredPrintersSnapshot> {
  const { data, error } = await supabase
    .from("workshop_discovered_printers")
    .select("ip_address, protocol_type, status, created_at")
    .eq("user_id", userId)
    .eq("status", "discovered")
    .order("created_at", { ascending: true });

  if (error) {
    if (!isMissingTableSchema(error.code, error.message)) {
      console.warn(
        "Найденные принтеры не прочитаны:",
        error.code,
        error.message,
      );
    }

    return {
      printers: [],
      isMissingTable: isMissingTableSchema(error.code, error.message),
    };
  }

  const rows = (data ?? []) as Partial<Record<string, unknown>>[];

  return {
    printers: rows
      .map(normalizeDiscoveredPrinterRow)
      .filter((printer): printer is DiscoveredPrinter => printer !== null),
    isMissingTable: false,
  };
}
