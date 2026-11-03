/**
 * Правило «задание печати зависло» — чистая арифметика без базы (аудит C7).
 *
 * Зачем отдельный модуль: порог просрочки проверяется тестом
 * `scripts/test-print-resources.ts` без живой базы, а роут
 * `app/api/agent/watchdog/route.ts` остаётся тонким — чтение очереди, запись и
 * отчёт. Правило простое, но ошибиться в нём легко: граница считается от
 * `started_at`, а не от `created_at`, иначе задание, простоявшее в очереди
 * сутки, снималось бы сразу после старта.
 *
 * Порог: расчётное время печати из задания (`estimated_seconds` слайсера) плюс
 * 10 % — печать нередко идёт дольше оценки. Оценки нет — сутки: это уже не
 * «долгая печать», а потерянная.
 *
 * Вторая проверка — для интерфейса, а не для наблюдателя: `isActiveJobStuck()`.
 * Наблюдатель ждёт оценку слайсера, а мастеру нужно закрыть задание, которое
 * висит десять минут: принтер повис, MQTT молчит, и обычная отмена только
 * поднимает флаг, который никто не читает. Порог у доски и карточки заказа
 * один — разное время в двух местах читалось бы как сбой интерфейса.
 */
import { isWorkshopUuid } from "@/lib/db/workshop-types";

/** Причина, которую мастер увидит в карточке заказа (1…500 символов). */
export const STUCK_PRINT_MESSAGE =
  "Превышено расчетное время печати. Возможно, принтер отключился.";

/** Запас к оценке слайсера: 10 % сверху. */
export const ESTIMATE_OVERDUE_RATIO = 1.1;

/** Без оценки слайсера печать считается зависшей через сутки. */
export const NO_ESTIMATE_LIMIT_MS = 24 * 60 * 60 * 1000;

/**
 * Сколько минут задание висит, прежде чем мастеру предлагается закрыть его
 * силой (`isActiveJobStuck`).
 *
 * Десять минут — заметно больше шага опроса агента (несколько секунд), поэтому
 * случайное нажатие «Принудительно отменить» на живой печати исключено, а
 * зависшее задание не держит заказ и принтер часами.
 */
export const ACTIVE_JOB_STUCK_MINUTES = 10;

/**
 * Активное задание заказа в том виде, в каком его видит карточка.
 *
 * `queuedAt` и `startedAt` — метки этапов из миграции hardening: по ним и
 * считается ожидание. `startedAt` главнее — мастер ждёт результат с момента
 * запуска печати, а не с постановки в очередь.
 */
export type ActiveJobTiming = {
  /** id задания: по нему работает «Принудительно отменить». */
  id: string;
  status: "queued" | "printing" | "paused";
  /** Когда задание встало в очередь; null — метки нет (строка до миграции). */
  queuedAt: string | null;
  /** Когда агент начал печать; null — задание ещё не запускалось. */
  startedAt: string | null;
  /** Мастер уже просил отмену, а агент её не выполнил. */
  cancelRequested: boolean;
};

/** Активные задания по заказам: `order_id` → задание. */
export type ActiveOrderJobs = Record<string, ActiveJobTiming>;

/** Метка этапа, от которой считается ожидание: запуск печати важнее очереди. */
function jobAnchor(job: ActiveJobTiming): number | null {
  const anchor = job.startedAt ?? job.queuedAt;

  if (!anchor) {
    return null;
  }

  const time = Date.parse(anchor);

  return Number.isNaN(time) ? null : time;
}

/**
 * Задание висит: печать не двигается дольше `ACTIVE_JOB_STUCK_MINUTES` минут.
 *
 * Запрошенная отмена считается зависанием сама по себе: мастер уже нажал
 * кнопку, а печать не остановилась — ждать ещё десять минут незачем. Без метки
 * этапа (строки, созданные до миграции hardening) время неизвестно, и кнопка не
 * показывается: свежее задание мастер закроет обычной отменой.
 */
export function isActiveJobStuck(
  job: ActiveJobTiming,
  now: number = Date.now(),
): boolean {
  if (job.cancelRequested) {
    return true;
  }

  const anchor = jobAnchor(job);

  return anchor !== null && now - anchor >= ACTIVE_JOB_STUCK_MINUTES * 60_000;
}

/** Задание очереди, приведённое к безопасным типам. */
export type StuckPrintJob = {
  id: string;
  userId: string;
  orderId: string | null;
  printerId: string | null;
  /** От чего считаем просрочку: `started_at`, иначе последнее обновление. */
  startedAt: string | null;
  estimatedSeconds: number | null;
};

type Row = Partial<Record<string, unknown>>;

function readUuid(value: unknown): string | null {
  return typeof value === "string" && isWorkshopUuid(value) ? value : null;
}

function readTimestamp(value: unknown): string | null {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
    ? value
    : null;
}

function readPositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 1) {
    return Math.round(value);
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);

    if (Number.isFinite(parsed) && parsed >= 1) {
      return Math.round(parsed);
    }
  }

  return null;
}

/**
 * Строка `workshop_print_jobs` → задание для проверки; null — строку нельзя
 * трогать (нет id или владельца).
 *
 * `started_at` читается из миграции hardening. Без неё метки старта нет, и
 * точкой отсчёта становится `updated_at` — его двигает триггер на каждой записи.
 */
export function readStuckPrintJob(row: Row): StuckPrintJob | null {
  const id = readUuid(row.id);
  const userId = readUuid(row.user_id);

  if (!id || !userId) {
    return null;
  }

  return {
    id,
    userId,
    orderId: readUuid(row.order_id),
    printerId: readUuid(row.printer_id),
    startedAt:
      readTimestamp(row.started_at) ??
      readTimestamp(row.updated_at) ??
      readTimestamp(row.created_at),
    estimatedSeconds: readPositiveInt(row.estimated_seconds),
  };
}

/**
 * Насколько задание вышло за расчётное время, мс; null — печатается штатно.
 *
 * Дата в будущем (часы сервера разъехались) просрочки не даёт: `now - startedAt`
 * отрицательное, и порог не превышен.
 */
export function overduePrintMs(job: StuckPrintJob, now: number): number | null {
  if (job.startedAt === null) {
    return null;
  }

  const startedAt = Date.parse(job.startedAt);

  if (Number.isNaN(startedAt)) {
    return null;
  }

  const limitMs =
    job.estimatedSeconds === null
      ? NO_ESTIMATE_LIMIT_MS
      : job.estimatedSeconds * 1000 * ESTIMATE_OVERDUE_RATIO;
  const elapsedMs = now - startedAt;

  return elapsedMs > limitMs ? elapsedMs - limitMs : null;
}
