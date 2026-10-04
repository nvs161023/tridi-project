/**
 * Доступ к платным уровням: одна проверка подписки на все платные курсы.
 *
 * Платный контент один — уровни «Уверенный» и «Инженер» вместе с конструктором
 * открывает одна действующая подписка. Правило должно быть ровно в одном месте:
 * если каждый уровень начнёт проверять подписку по-своему, доступ рано или поздно
 * разойдётся между страницами (например, «Уверенный» пустит без подписки, а
 * «Инженер» — нет).
 *
 * Любая ошибка (строки нет, таблицы нет, сеть отвалилась) означает «доступа нет»:
 * сбой проверки не должен открывать платный контент.
 */
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Из таблицы subscriptions читаем только то, что нужно для решения о доступе. */
type SubscriptionRow = {
  status: string | null;
  trial_ends_at: string | null;
};

/**
 * Есть ли у пользователя доступ к платным уровням.
 *
 * Доступ даёт либо активная подписка (status = "active"), либо незакончившийся
 * пробный период (status = "trial" и trial_ends_at в будущем).
 */
export async function hasActiveSubscription(
  supabase: Supabase,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, trial_ends_at")
    .eq("user_id", userId)
    .maybeSingle<SubscriptionRow>();

  if (error) {
    console.warn("Не удалось проверить подписку:", error.message);
    return false;
  }

  if (!data) {
    return false;
  }

  if (data.status === "active") {
    return true;
  }

  return (
    data.status === "trial" &&
    data.trial_ends_at !== null &&
    new Date(data.trial_ends_at) > new Date()
  );
}
