/**
 * Кредиты генераций 3D-моделей.
 *
 * Счётчик живёт в таблице `user_credits`: одна строка на пользователя, SQL —
 * `supabase/user_credits.sql`. Кредит списывается только после успешной
 * генерации, поэтому проверка и списание — две разные операции.
 *
 * Читаем и пишем служебным клиентом (service_role): RLS-политик у таблицы нет,
 * а списание идёт уже после ответа Gen API, когда сессия пользователя роуту не
 * нужна. Ключ не попадает в клиентский код: модуль импортируют только роуты.
 *
 * `getUserCredits` возвращает `null`, если счётчик прочитать нельзя (миграция
 * не применена, сеть отвалилась). Это не «0 кредитов»: «нет кредитов» — ответ
 * 403 с предложением купить пакет, «счётчик недоступен» — 503. Подменять одно
 * другим нельзя, иначе человек пойдёт покупать пакет из-за сбоя базы.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";

/** Таблица счётчиков; колонки: `user_id`, `credits`, `updated_at`. */
const CREDITS_TABLE = "user_credits";

/** Сколько раз пробуем списать кредит, если счётчик меняется параллельно. */
const DEDUCT_ATTEMPTS = 3;

/** Строка счётчика в том виде, в каком её отдаёт PostgREST. */
type CreditsRow = { credits: number | null };

/** Сколько кредитов осталось; `null` — счётчик недоступен. */
export async function getUserCredits(userId: string): Promise<number | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from(CREDITS_TABLE)
      .select("credits")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      // Неприменённая миграция — не поломка приложения, но и не нулевой
      // баланс: роут должен ответить 503, а не отправлять в магазин.
      if (!isMissingTableSchema(error.code, error.message)) {
        console.error(
          "[credits] Не удалось прочитать кредиты:",
          error.message,
        );
      }

      return null;
    }

    const row = data as CreditsRow | null;
    const credits = row?.credits;

    // Строки нет — пакет генераций ещё не покупали, кредитов 0.
    return typeof credits === "number" && Number.isFinite(credits) ? credits : 0;
  } catch (error) {
    console.error(
      "[credits] Не удалось прочитать кредиты:",
      error instanceof Error ? error.message : error,
    );

    return null;
  }
}

/**
 * Списывает один кредит.
 *
 * Возвращает `true`, только если счётчик действительно уменьшился. Обновление
 * идёт с условием `credits = прочитанное значение`: если параллельная
 * генерация успела списать кредит, строка не обновится и счётчик читается
 * заново. Отдельной SQL-функции для этого нет — так миграция остаётся одной
 * таблицей, а списание укладывается в три попытки.
 *
 * Ошибка не бросает исключение: кредит списывается после того, как Gen API уже
 * отдал модель, и падать в этот момент нельзя — вызывающий код только пишет в
 * лог.
 */
export async function deductCredit(userId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();

    for (let attempt = 1; attempt <= DEDUCT_ATTEMPTS; attempt += 1) {
      const credits = await getUserCredits(userId);

      if (credits === null || credits <= 0) {
        return false;
      }

      const { data, error } = await admin
        .from(CREDITS_TABLE)
        .update({
          credits: credits - 1,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("credits", credits)
        .select("credits");

      if (error) {
        console.error("[credits] Не удалось списать кредит:", error.message);
        return false;
      }

      if (Array.isArray(data) && data.length > 0) {
        return true;
      }

      // Счётчик изменился между чтением и записью — читаем заново.
    }

    console.error(
      "[credits] Не удалось списать кредит: счётчик менялся слишком часто.",
    );

    return false;
  } catch (error) {
    console.error(
      "[credits] Не удалось списать кредит:",
      error instanceof Error ? error.message : error,
    );

    return false;
  }
}
