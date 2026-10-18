/**
 * Доступ к платным материалам: покупки в purchases и подписка Pro.
 *
 * После оплаты Robokassa вебхук записывает покупку:
 *   - confident / engineer / profit — один уровень навсегда;
 *   - pro — пакет трёх уровней навсегда;
 *   - pro-subscription — подписка Pro на 30 дней.
 *
 * Подписка Pro дополнительно проверяется по таблице subscriptions: она уже
 * настроена в живой базе и хранит статус (active / trial) и trial_ends_at.
 * Это нужно, потому что схема purchases применяется вручную и на момент
 * подключения библиотеки профилей её в базе ещё не было: без второй проверки
 * оплаченная подписка не открывала бы ни профили, ни Pro-курс.
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

/** Из subscriptions читаем статус и конец пробного периода. */
type SubscriptionRow = {
  status: string | null;
  trial_ends_at: string | null;
};

/**
 * Покупки, которые открывают конкретный уровень:
 * свой курс, пакет «Все 3 уровня» или действующая подписка Pro.
 */
const LEVEL_ACCESS: Record<PaidCourseId, readonly string[]> = {
  confident: ["confident", "pro", "pro-subscription"],
  engineer: ["engineer", "pro", "pro-subscription"],
  profit: ["profit", "pro", "pro-subscription"],
};

/** Срок покупки не истёк; null означает «навсегда». */
function isPurchaseActive(purchase: PurchaseRow): boolean {
  if (purchase.expires_at === null) {
    return true;
  }

  const expiresAt = new Date(purchase.expires_at);

  return !Number.isNaN(expiresAt.getTime()) && expiresAt > new Date();
}

/**
 * Подписка действует, если статус active или пробный период ещё не закончился.
 * Остальные статусы (inactive, canceled, past_due) доступа не дают.
 */
function isSubscriptionActive(subscription: SubscriptionRow): boolean {
  if (subscription.status === "active") {
    return true;
  }

  if (subscription.status !== "trial" || !subscription.trial_ends_at) {
    return false;
  }

  const trialEndsAt = new Date(subscription.trial_ends_at);

  return !Number.isNaN(trialEndsAt.getTime()) && trialEndsAt > new Date();
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

/**
 * Есть ли доступ к платному уровню.
 *
 * Пакет `pro` и подписка `pro-subscription` открывают все три уровня. Запись
 * подписки проверяется по expires_at: после 30 дней доступ закрывается сам.
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
 * Доступ к продвинутому курсу (109 уроков).
 *
 * Он входит только в подписку Pro: пакет `pro` — это три уровня, а не
 * продвинутый курс. Поэтому здесь проверяется только `pro-subscription`.
 */
export async function hasProCourseAccess(
  supabase: Supabase,
  userId: string,
): Promise<boolean> {
  return hasAnyPurchase(supabase, userId, ["pro-subscription"]);
}

/**
 * Действующая подписка Pro для инструментов (профили, конструктор).
 *
 * Проверяет два источника:
 *   1. purchases — запись `pro-subscription` со сроком в expires_at;
 *   2. subscriptions — статус active или неистёкший trial.
 *
 * Вторая проверка нужна, пока схема purchases не применена в живой базе:
 * без неё оплаченная подписка не открывала бы профили.
 */
export async function hasActiveSubscription(
  supabase: Supabase,
  userId: string,
): Promise<boolean> {
  if (await hasAnyPurchase(supabase, userId, ["pro-subscription"])) {
    return true;
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, trial_ends_at")
    .eq("user_id", userId);

  if (error) {
    // Таблицы subscriptions может не быть в старой базе — тогда доступа нет.
    console.warn("Не удалось проверить подписку:", error.message);
    return false;
  }

  return ((data as SubscriptionRow[] | null) ?? []).some(isSubscriptionActive);
}
