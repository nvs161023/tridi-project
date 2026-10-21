/**
 * Доступ к платным материалам: покупки в purchases и подписка Pro.
 *
 * После оплаты Robokassa вебхук записывает покупку:
 *   - confident / engineer / profit — один уровень навсегда;
 *   - pro — пакет трёх уровней навсегда (он же открывает инструменты Pro);
 *   - pro-subscription — подписка Pro на 30 дней: только Конструктор и
 *     библиотека Профилей, без доступа к урокам.
 *
 * Подписка Pro дополнительно проверяется по таблице subscriptions: она уже
 * настроена в живой базе и хранит статус (active / trial), конец пробного
 * периода trial_ends_at и срок оплаты expires_at. Срок оплаты ставит вебхук
 * Robokassa и продлевает автопродление. Это нужно, потому что схема purchases
 * применяется вручную и на момент подключения библиотеки профилей её в базе ещё
 * не было: без второй проверки оплаченная подписка не открывала бы ни профили,
 * ни конструктор.
 *
 * Любая ошибка (строки нет, таблицы нет, сеть отвалилась) означает «доступа
 * нет»: сбой проверки не должен открывать платный контент.
 */
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Платные уровни, у которых есть отдельная разовая покупка. */
export const PAID_COURSE_IDS = ["confident", "engineer", "profit"] as const;

export type PaidCourseId = (typeof PAID_COURSE_IDS)[number];

/** Все ключи, которые встречаются в purchases.course_id. */
export type AccessCourseId = PaidCourseId | "pro" | "pro-subscription";

/** Из purchases читаем только то, что нужно для решения о доступе. */
type PurchaseRow = {
  course_id: string;
  expires_at: string | null;
};

/** Из subscriptions читаем статус, конец пробного периода и срок оплаты. */
type SubscriptionRow = {
  status: string | null;
  trial_ends_at: string | null;
  /** Срок оплаченной подписки Pro; null — колонки нет в старой базе. */
  expires_at: string | null;
};

/**
 * Покупки, которые открывают конкретный уровень: свой курс или пакет
 * «Все 3 уровня». Подписка Pro (pro-subscription) сюда не входит: она даёт
 * доступ только к инструментам, но не к урокам.
 */
const LEVEL_ACCESS: Record<PaidCourseId, readonly string[]> = {
  confident: ["confident", "pro"],
  engineer: ["engineer", "pro"],
  profit: ["profit", "pro"],
};

/** Дата в будущем: срок покупки или пробного периода ещё не истёк. */
function isFutureDate(value: string): boolean {
  const date = new Date(value);

  return !Number.isNaN(date.getTime()) && date > new Date();
}

/** Срок покупки не истёк; null означает «навсегда». */
function isPurchaseActive(purchase: PurchaseRow): boolean {
  return purchase.expires_at === null || isFutureDate(purchase.expires_at);
}

/**
 * Покупка открывает инструменты Pro.
 *
 * Пакет `pro` — разовый платёж, поэтому инструменты он открывает только при
 * expires_at = null. У `pro-subscription` срок обязателен: после 30 дней
 * доступ закрывается сам.
 */
function isToolsPurchaseActive(purchase: PurchaseRow): boolean {
  if (purchase.course_id === "pro") {
    return purchase.expires_at === null;
  }

  return (
    purchase.course_id === "pro-subscription" && isPurchaseActive(purchase)
  );
}

/**
 * Подписка действует, если статус active или пробный период ещё не закончился.
 * Остальные статусы (inactive, canceled, past_due) доступа не дают.
 *
 * `expires_at` — срок оплаты из вебхука Robokassa: его ставит первый платёж и
 * продлевает автопродление. Если колонки ещё нет в базе, поле остаётся null, и
 * для active действует прежнее правило «доступ есть».
 */
function isSubscriptionActive(subscription: SubscriptionRow): boolean {
  if (subscription.status === "active") {
    return (
      subscription.expires_at === null || isFutureDate(subscription.expires_at)
    );
  }

  if (subscription.status !== "trial") {
    return false;
  }

  return (
    (subscription.trial_ends_at !== null &&
      isFutureDate(subscription.trial_ends_at)) ||
    (subscription.expires_at !== null && isFutureDate(subscription.expires_at))
  );
}

/** Строка subscriptions из базы, где колонки expires_at ещё нет. */
type LegacySubscriptionRow = Omit<SubscriptionRow, "expires_at">;

/** Колонку expires_at добавляет supabase/subscriptions_recurring.sql. */
function isMissingExpiresAtColumn(error: { code?: string }): boolean {
  return error.code === "42703" || error.code === "PGRST204";
}

/**
 * Подписки пользователя с откатом на старую схему.
 *
 * Если колонки `expires_at` в базе нет, запрос с ней отвечает ошибкой 42703.
 * Без отката проверка доступа падала бы целиком, и действующий trial перестал
 * бы открывать Конструктор и Профили. Поэтому повторяем запрос без колонки:
 * срок оплаты тогда просто неизвестен, а доступ решается по статусу.
 */
async function readSubscriptions(
  supabase: Supabase,
  userId: string,
): Promise<{ rows: SubscriptionRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, trial_ends_at, expires_at")
    .eq("user_id", userId);

  if (!error) {
    return { rows: (data as SubscriptionRow[] | null) ?? [], error: null };
  }

  if (!isMissingExpiresAtColumn(error)) {
    return { rows: [], error: error.message };
  }

  const legacy = await supabase
    .from("subscriptions")
    .select("status, trial_ends_at")
    .eq("user_id", userId);

  if (legacy.error) {
    return { rows: [], error: legacy.error.message };
  }

  return {
    rows: ((legacy.data as LegacySubscriptionRow[] | null) ?? []).map((row) => ({
      ...row,
      expires_at: null,
    })),
    error: null,
  };
}

/** Самая поздняя дата из списка: при нескольких покупках показываем последнюю. */
function latestDate(values: readonly string[]): string | null {
  let latest: string | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const value of values) {
    const time = new Date(value).getTime();

    if (!Number.isNaN(time) && time > latestTime) {
      latest = value;
      latestTime = time;
    }
  }

  return latest;
}

async function hasAnyPurchase(
  supabase: Supabase,
  userId: string,
  courseIds: readonly string[],
): Promise<boolean> {
  const { data, error } = await supabase
    .from("purchases")
    .select("course_id, expires_at")
    .eq("user_id", userId)
    .in("course_id", [...courseIds]);

  if (error) {
    console.warn("Не удалось проверить покупки:", error.message);
    return false;
  }

  return ((data as PurchaseRow[] | null) ?? []).some(isPurchaseActive);
}

/** Состояние доступа Pro: есть ли доступ, до какой даты и откуда он взялся. */
export type ActiveSubscription = {
  active: boolean;
  /**
   * Дата окончания доступа (expires_at покупки, subscriptions.expires_at или
   * trial_ends_at подписки). null — доступ бессрочный либо дата не задана:
   * подписка active может жить без trial_ends_at.
   */
  expiresAt: string | null;
  /**
   * Источник доступа: разовый пакет `pro` или подписка. Кабинет показывает
   * разные формулировки: «Пакет активен навсегда» и «Подписка активна до …».
   */
  source: "bundle" | "subscription" | null;
};

/**
 * Действующий доступ Pro с датой окончания.
 *
 * Проверяет те же источники, что и hasActiveSubscription(), но ещё возвращает
 * срок и источник для кабинета: «Пакет «Всё включено» активен навсегда» или
 * «Pro-подписка активна до …». Пакет `pro` учитывается только при
 * expires_at = null — это разовая бессрочная покупка. Если подписок несколько,
 * показываем самую позднюю дату; бессрочная запись важнее любой даты.
 */
export async function getActiveSubscription(
  supabase: Supabase,
  userId: string,
): Promise<ActiveSubscription> {
  const [purchasesResult, subscriptionsResult] = await Promise.all([
    supabase
      .from("purchases")
      .select("course_id, expires_at")
      .eq("user_id", userId)
      .in("course_id", ["pro", "pro-subscription"]),
    readSubscriptions(supabase, userId),
  ]);

  if (purchasesResult.error) {
    console.warn(
      "Не удалось проверить подписку в purchases:",
      purchasesResult.error.message,
    );
  } else {
    const purchases = (
      (purchasesResult.data as PurchaseRow[] | null) ?? []
    ).filter(isToolsPurchaseActive);

    if (purchases.some((purchase) => purchase.course_id === "pro")) {
      return { active: true, expiresAt: null, source: "bundle" };
    }

    if (purchases.length > 0) {
      return {
        active: true,
        expiresAt: latestDate(
          purchases
            .map((purchase) => purchase.expires_at)
            .filter((value): value is string => value !== null),
        ),
        source: "subscription",
      };
    }
  }

  if (subscriptionsResult.error !== null) {
    // Таблицы subscriptions может не быть в старой базе — тогда доступа нет.
    console.warn("Не удалось проверить подписку:", subscriptionsResult.error);
    return { active: false, expiresAt: null, source: null };
  }

  const subscriptions = subscriptionsResult.rows.filter(isSubscriptionActive);

  if (subscriptions.length === 0) {
    return { active: false, expiresAt: null, source: null };
  }

  // Доступ к инструментам даёт и пробный период, и оплаченный срок из
  // вебхука Robokassa — показываем ту дату, которая наступит позже.
  const expiresDates = subscriptions.flatMap((subscription) => [
    subscription.trial_ends_at,
    subscription.expires_at,
  ]);

  return {
    active: true,
    expiresAt: latestDate(
      expiresDates.filter(
        (value): value is string => value !== null && isFutureDate(value),
      ),
    ),
    source: "subscription",
  };
}

/**
 * Есть ли доступ к платному уровню.
 *
 * Пакет `pro` открывает все три уровня. Подписка `pro-subscription` — нет:
 * она относится только к инструментам. Срок покупки проверяется по expires_at:
 * null означает «навсегда».
 */
export async function hasCourseAccess(
  supabase: Supabase,
  userId: string,
  courseId: AccessCourseId,
): Promise<boolean> {
  const acceptedIds =
    courseId === "pro" || courseId === "pro-subscription"
      ? [courseId]
      : LEVEL_ACCESS[courseId];

  return hasAnyPurchase(supabase, userId, acceptedIds);
}

/**
 * Куплен ли конкретный платный уровень — имя для кабинета.
 *
 * Правила те же, что у hasCourseAccess(): отдельная покупка уровня или пакет
 * `pro`. Обёртка нужна, чтобы карточки кабинета читались как «куплен / не
 * куплен», а логика доступа оставалась в одном месте.
 */
export async function hasPurchasedCourse(
  supabase: Supabase,
  userId: string,
  courseId: PaidCourseId,
): Promise<boolean> {
  return hasCourseAccess(supabase, userId, courseId);
}

/** Состояние трёх платных уровней — для витрины и карточек тарифов. */
export type PurchasedCourses = Record<PaidCourseId, boolean>;

/**
 * Проверяет все три платных уровня одним вызовом.
 *
 * Запросы идут параллельно, а правила доступа остаются в hasPurchasedCourse:
 * пакет `pro` открывает каждый уровень, отдельная покупка — только свой.
 * Витрина использует результат, чтобы вместо «Купить» показать «Продолжить
 * обучение» и плашку «Доступ открыт».
 */
export async function getPurchasedCourses(
  supabase: Supabase,
  userId: string,
): Promise<PurchasedCourses> {
  const [confident, engineer, profit] = await Promise.all([
    hasPurchasedCourse(supabase, userId, "confident"),
    hasPurchasedCourse(supabase, userId, "engineer"),
    hasPurchasedCourse(supabase, userId, "profit"),
  ]);

  return { confident, engineer, profit };
}

/**
 * Действующий доступ Pro для инструментов (профили, конструктор).
 *
 * Проверяет три источника:
 *   1. purchases — бессрочная запись `pro` (пакет трёх уровней);
 *   2. purchases — запись `pro-subscription` со сроком в expires_at;
 *   3. subscriptions — статус active или неистёкший trial.
 *
 * Вторая и третья проверки нужны, пока схема purchases не применена в живой
 * базе: без них оплаченная подписка не открывала бы профили.
 *
 * Дата окончания не нужна — только факт доступа. Если нужна и дата, используйте
 * getActiveSubscription(): это та же проверка с подробностями.
 */
export async function hasActiveSubscription(
  supabase: Supabase,
  userId: string,
): Promise<boolean> {
  return (await getActiveSubscription(supabase, userId)).active;
}
