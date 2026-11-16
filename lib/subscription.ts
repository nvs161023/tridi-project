/**
 * Доступ к платным материалам: курсы, инструменты Pro и подписка.
 *
 * После оплаты Robokassa вебхук записывает покупку:
 *   - confident / engineer / profit — один уровень навсегда;
 *   - pro — исторический пакет «Всё включено»: три уровня навсегда. Продажи
 *     остановлены (R2), новые покупки невозможны. Инструменты он больше не
 *     открывает: только явный грант в legacy_pro_users у тех, кто купил раньше;
 *   - pro-subscription — подписка Pro на 30 дней: инструменты платформы и
 *     месячные лимиты генераций, без доступа к урокам.
 *
 * Курсы и инструменты разделены намеренно: покупка confident / engineer /
 * profit открывает только уроки своего уровня, но не Конструктор, Профили,
 * Мастерскую и генератор. `hasCourseAccess` отвечает за уроки,
 * `hasActiveSubscription` — только за инструменты.
 *
 * Подписка дополнительно проверяется по таблице subscriptions: она уже
 * настроена в живой базе и хранит статус (active / trial), конец пробного
 * периода trial_ends_at и срок оплаты expires_at. Срок оплаты ставит вебхук
 * Robokassa и продлевает автопродление. Это нужно, потому что схема purchases
 * применяется вручную и на момент подключения библиотеки профилей её в базе ещё
 * не было: без второй проверки оплаченная подписка не открывала бы ни профили,
 * ни конструктор.
 *
 * Пожизненный доступ живёт в отдельной таблице legacy_pro_users: строка там —
 * явный грант, а не случайный `active` с пустым expires_at. Пока миграция не
 * применена, включается fallback на старую покупку `pro` с expires_at = null,
 * чтобы уже оплатившие не потеряли доступ в день выката.
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

/** Строка legacy_pro_users: сам факт строки и есть пожизненный грант. */
type LegacyProRow = {
  user_id: string;
};

/**
 * Результат чтения legacy_pro_users.
 *
 * `tableAvailable = false` означает, что миграцию ещё не применили. Только в
 * этом случае разрешён fallback на старую покупку `pro`: без него выкат кода
 * раньше SQL закрыл бы инструменты всем действующим покупателям.
 */
type LegacyProGrant = {
  granted: boolean;
  tableAvailable: boolean;
  error: string | null;
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
 * Покупка подписки открывает инструменты Pro.
 *
 * Срок обязателен: после 30 дней доступ закрывается сам. Пакет `pro` здесь
 * больше не участвует — его инструменты даёт только legacy_pro_users.
 */
function isSubscriptionPurchaseActive(purchase: PurchaseRow): boolean {
  return (
    purchase.course_id === "pro-subscription" && isPurchaseActive(purchase)
  );
}

/**
 * Старая покупка пакета `pro` с бессрочным доступом.
 *
 * Используется только как fallback, пока таблицы legacy_pro_users нет в базе.
 * После миграции пожизненный доступ подтверждает явная строка гранта.
 */
function isLifetimeBundlePurchase(purchase: PurchaseRow): boolean {
  return purchase.course_id === "pro" && purchase.expires_at === null;
}

/**
 * Статусы, которыми подписка закрывается навсегда.
 *
 * Возврат (`lib/refund.ts`) ставит `cancelled`; старые версии SQL писали
 * `canceled`. Оба варианта, а также истёкшие и отозванные статусы доступа не
 * дают. Набор явный, чтобы новое значение статуса по ошибке не открыло Pro.
 */
const REVOKED_SUBSCRIPTION_STATUSES = new Set([
  "cancelled",
  "canceled",
  "inactive",
  "past_due",
  "expired",
  "revoked",
  "refunded",
]);

/**
 * Подписка действует, только если статус active или trial и срок в будущем.
 *
 * `expires_at` — срок оплаты из вебхука Robokassa: его ставит первый платёж и
 * продлевает автопродление. Дата в прошлом закрывает доступ даже при статусе
 * active: вебхук мог не успеть обновить статус, а возврат ставит `cancelled` и
 * `expires_at` = момент возврата. Если колонки ещё нет в базе, поле остаётся
 * null, и для active действует прежнее правило «доступ есть».
 */
function isSubscriptionActive(subscription: SubscriptionRow): boolean {
  const status = (subscription.status ?? "").trim().toLowerCase();

  if (REVOKED_SUBSCRIPTION_STATUSES.has(status)) {
    return false;
  }

  if (status === "active") {
    return (
      subscription.expires_at === null || isFutureDate(subscription.expires_at)
    );
  }

  if (status !== "trial") {
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
 * Таблицы legacy_pro_users ещё нет: supabase/legacy_pro.sql не применён.
 *
 * Это единственная ошибка, при которой разрешён fallback на старую покупку
 * `pro`. Остальные ошибки (RLS, сеть) доступ не открывают.
 */
function isMissingLegacyProTable(error: { code?: string }): boolean {
  return error.code === "42P01" || error.code === "PGRST205";
}

/**
 * Читает явный пожизненный грант Pro.
 *
 * Строка в legacy_pro_users важнее покупки: после возврата `lib/refund.ts`
 * удаляет её, поэтому повторный доступ не восстановится даже при старом
 * `purchases.expires_at`.
 */
async function readLegacyProGrant(
  supabase: Supabase,
  userId: string,
): Promise<LegacyProGrant> {
  const { data, error } = await supabase
    .from("legacy_pro_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!error) {
    return {
      granted: (data as LegacyProRow | null) !== null,
      tableAvailable: true,
      error: null,
    };
  }

  if (isMissingLegacyProTable(error)) {
    return { granted: false, tableAvailable: false, error: null };
  }

  console.warn("Не удалось проверить пожизненный доступ Pro:", error.message);

  return { granted: false, tableAvailable: true, error: error.message };
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

/** Из promo_codes читаем только курс: остальное для доступа не важно. */
type PromoRow = {
  course_id: string;
};

/**
 * Доступ по промокоду (партии для Ozon).
 *
 * Активация на /activate ставит в promo_codes used_at и used_by, но не создаёт
 * покупку: это подарок, а не платёж, и нулевые суммы в purchases исказили бы
 * отчёт о выручке. Поэтому доступ проверяется отдельной веткой.
 *
 * Запрос идёт обычным клиентом с cookies: RLS-политика promo_codes_select_own
 * отдаёт только строки с used_by = auth.uid(), чужие активации не видны.
 *
 * Ошибка (таблицы ещё нет, миграцию не применили, сеть отвалилась) означает
 * «доступа нет» — как и у покупок.
 */
async function hasPromoAccess(
  supabase: Supabase,
  userId: string,
  courseIds: readonly string[],
): Promise<boolean> {
  const { data, error } = await supabase
    .from("promo_codes")
    .select("course_id")
    .eq("used_by", userId)
    .in("course_id", [...courseIds])
    .limit(1);

  if (error) {
    return false;
  }

  return ((data as PromoRow[] | null) ?? []).length > 0;
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
   * Источник доступа: пожизненный legacy-грант пакета `pro` или подписка.
   * Кабинет показывает разные формулировки: «Пакет «Всё включено» активен
   * навсегда» и «Доступ к инструментам открыт до …».
   */
  source: "bundle" | "subscription" | null;
};

/**
 * Действующий доступ Pro с датой окончания.
 *
 * Источники инструментов:
 *   1. legacy_pro_users — пожизненный грант для купивших пакет `pro` раньше;
 *   2. purchases `pro-subscription` с будущим expires_at;
 *   3. subscriptions active/trial с действующим сроком — та же подписка и
 *      явные ручные гранты.
 *
 * Покупка курса (`confident`, `engineer`, `profit`) и покупка `pro` без строки
 * legacy_pro_users инструментов не открывают. Пока таблицы legacy_pro_users нет
 * в базе, действует fallback: бессрочная покупка `pro` считается грантом.
 *
 * Если подписок несколько, показываем самую позднюю дату; бессрочный грант
 * важнее любой даты.
 */
export async function getActiveSubscription(
  supabase: Supabase,
  userId: string,
): Promise<ActiveSubscription> {
  const [legacyGrant, purchasesResult, subscriptionsResult] =
    await Promise.all([
      readLegacyProGrant(supabase, userId),
      supabase
        .from("purchases")
        .select("course_id, expires_at")
        .eq("user_id", userId)
        .in("course_id", ["pro", "pro-subscription"]),
      readSubscriptions(supabase, userId),
    ]);

  if (legacyGrant.granted) {
    return { active: true, expiresAt: null, source: "bundle" };
  }

  if (purchasesResult.error) {
    console.warn(
      "Не удалось проверить подписку в purchases:",
      purchasesResult.error.message,
    );
  } else {
    const rows = (purchasesResult.data as PurchaseRow[] | null) ?? [];

    // Выкат раньше SQL: явного гранта ещё нет, поэтому сохраняем старую
    // бессрочную покупку `pro`. После применения legacy_pro.sql ветка не
    // выполняется и новые покупки `pro` инструментов не открывают.
    if (
      !legacyGrant.tableAvailable &&
      rows.some(isLifetimeBundlePurchase)
    ) {
      return { active: true, expiresAt: null, source: "bundle" };
    }

    const purchases = rows.filter(isSubscriptionPurchaseActive);

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
 * Можно ли писать прогресс по курсу.
 *
 * Бесплатный курс открыт всем авторизованным. Платный — только при доступе:
 * покупке или активированном промокоде. Проверка вынесена отдельной функцией,
 * чтобы server actions не повторяли правило и его можно было проверить тестом.
 */
export function canWriteCourseProgress(
  courseType: string,
  hasAccess: boolean,
): boolean {
  return courseType === "basic" || hasAccess;
}

/**
 * Есть ли доступ к платному уровню.
 *
 * Источники:
 *   1. purchases — отдельная покупка уровня или пакет `pro`;
 *   2. promo_codes — активированный промокод этого уровня.
 *
 * Пакет `pro` открывает все три уровня. Подписка `pro-subscription` — нет:
 * она относится только к инструментам. Срок покупки проверяется по expires_at:
 * null означает «навсегда». Промокод действует бессрочно и только на свой курс:
 * партии выпускаются отдельно для confident, engineer и profit.
 *
 * Промо-проверка идёт второй и только если покупки нет: у большинства учеников
 * доступ уже есть, и лишний запрос к promo_codes им не нужен.
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

  if (await hasAnyPurchase(supabase, userId, acceptedIds)) {
    return true;
  }

  // Промокоды выпускаются только на три уровня. Пакет и подписка Pro
  // открываются оплатой, поэтому проверять promo_codes для них не нужно.
  if (courseId === "pro" || courseId === "pro-subscription") {
    return false;
  }

  return hasPromoAccess(supabase, userId, acceptedIds);
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
 * Действующий доступ Pro для инструментов (профили, конструктор, генератор).
 *
 * Проверяет три источника:
 *   1. legacy_pro_users — пожизненный грант купивших `pro` до остановки продаж;
 *   2. purchases — запись `pro-subscription` со сроком в expires_at;
 *   3. subscriptions — статус active или неистёкший trial.
 *
 * Покупка курса и покупка `pro` без legacy-гранта сюда не входят: уроки и
 * инструменты разделены. Пока legacy_pro_users нет в базе, fallback сохраняет
 * старую бессрочную покупку `pro`, чтобы выкат не отобрал уже оплаченное.
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
