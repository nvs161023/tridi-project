/**
 * Кредиты и лимиты генераций 3D-моделей.
 *
 * Счётчики живут в таблице `user_credits`: одна строка на пользователя, SQL —
 * `supabase/user_credits.sql`. Правила списания (что дешевле потратить) — в
 * чистом модуле `lib/generator/generation-credits.ts`: его же импортирует
 * страница `/3d-generator`, поэтому подпись под кнопкой не расходится с тем,
 * что спишет сервер.
 *
 * Лимит списывается до платного запроса, а возвращается, если провайдер
 * отказал: две параллельные генерации не проходят по одному балансу, а 502 не
 * стоит пользователю денег. Каждое изменение идёт с условием на прочитанное
 * значение счётчика (CAS): если параллельная генерация успела его поменять,
 * строка не обновится и попытка повторяется.
 *
 * Месячные лимиты сбрасывает `resetMonthlyLimitsIfNeeded` при чтении баланса
 * и перед списанием: отдельного планировщика нет, а `last_monthly_reset`
 * хранит месяц последнего сброса. Сброс тоже условный — он срабатывает только
 * у строки со старым `last_monthly_reset`, поэтому не обнуляет счётчик,
 * который только что изменила параллельная генерация.
 *
 * Читаем и пишем служебным клиентом (`service_role`): RLS-политик на запись у
 * таблицы нет, а списание идёт уже после ответа Gen API, когда сессия
 * пользователя роуту не нужна. Ключ не попадает в клиентский код.
 *
 * Функции возвращают `null`/`false`, если счётчик прочитать нельзя (миграция
 * не применена, сеть отвалилась). Это не «0 кредитов»: «нет кредитов» — ответ
 * 402 с предложением купить пакет, «счётчик недоступен» — 503. Подменять одно
 * другим нельзя, иначе человек пойдёт покупать пакет из-за сбоя базы.
 */
import {
  chooseCreditSource,
  createEmptyCreditBalance,
  type GenerationCreditBalance,
  type GenerationCreditSource,
} from "@/lib/generator/generation-credits";
import type { GeneratorQuality } from "@/lib/generator/photo-generator";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";

/** Таблица счётчиков; см. `supabase/user_credits.sql`. */
const CREDITS_TABLE = "user_credits";

/** Сколько раз пробуем списать, если счётчик меняется параллельно. */
const DEDUCT_ATTEMPTS = 3;

/** Клиент `service_role` — база для запросов модуля. */
type AdminClient = ReturnType<typeof createAdminClient>;

/** Строка счётчика в том виде, в каком её отдаёт PostgREST. */
type CreditsRow = {
  free_standard_used: number | null;
  monthly_standard_used: number | null;
  monthly_ultra_used: number | null;
  last_monthly_reset: string | null;
  standard_tokens: number | null;
  ultra_tokens: number | null;
};

/** Прочитанный баланс и дата последнего месячного сброса. */
type BalanceSnapshot = {
  balance: GenerationCreditBalance;
  lastMonthlyReset: string | null;
};

/** Что именно спишется или вернётся за генерацию. */
export type DeductGenerationResult =
  | { ok: true; source: GenerationCreditSource }
  | { ok: false; reason: "empty" | "unavailable" };

/** Счётчик из базы: отрицательные и нечисловые значения считаем нулём. */
function toCount(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

/** Начало текущего календарного месяца в UTC. */
function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Пишет ошибку в лог, но молчит про неприменённую миграцию.
 *
 * Страницы и роуты сами решают, что отвечать: `schema-errors` уже знает, как
 * отличить «таблицы ещё нет» от настоящего сбоя.
 */
function logError(action: string, error: { code?: string; message: string }) {
  if (isMissingTableSchema(error.code ?? "", error.message)) {
    return;
  }

  console.error(`[credits] ${action}:`, error.message);
}

/**
 * Читает строку счётчика.
 *
 * `null` — счётчик недоступен (нет таблицы, сеть отвалилась). Отсутствие
 * строки — не ошибка: у нового пользователя все счётчики нулевые, а строка
 * появится при первом списании.
 */
async function readBalance(
  admin: AdminClient,
  userId: string,
): Promise<BalanceSnapshot | null> {
  const { data, error } = await admin
    .from(CREDITS_TABLE)
    .select(
      "free_standard_used, monthly_standard_used, monthly_ultra_used, last_monthly_reset, standard_tokens, ultra_tokens",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    logError("Не удалось прочитать баланс", error);

    return null;
  }

  const row = data as CreditsRow | null;

  if (!row) {
    return { balance: createEmptyCreditBalance(), lastMonthlyReset: null };
  }

  return {
    balance: {
      freeStandardUsed: toCount(row.free_standard_used),
      monthlyStandardUsed: toCount(row.monthly_standard_used),
      monthlyUltraUsed: toCount(row.monthly_ultra_used),
      standardTokens: toCount(row.standard_tokens),
      ultraTokens: toCount(row.ultra_tokens),
    },
    lastMonthlyReset: row.last_monthly_reset,
  };
}

/**
 * Сбрасывает месячные лимиты, если с прошлого сброса начался новый месяц.
 *
 * Обновление условное: `last_monthly_reset` должен быть старее начала
 * текущего месяца. Так повторный вызов и параллельный запрос ничего не
 * обнуляют, а счётчики нового месяца не теряются.
 */
async function resetMonthlyLimitsIfNeeded(
  admin: AdminClient,
  userId: string,
  snapshot: BalanceSnapshot,
): Promise<BalanceSnapshot> {
  const start = monthStart();
  const lastReset = snapshot.lastMonthlyReset
    ? Date.parse(snapshot.lastMonthlyReset)
    : Number.NaN;

  if (Number.isFinite(lastReset) && lastReset >= start.getTime()) {
    return snapshot;
  }

  const now = new Date().toISOString();
  const resetQuery = admin
    .from(CREDITS_TABLE)
    .update({
      monthly_standard_used: 0,
      monthly_ultra_used: 0,
      last_monthly_reset: now,
    })
    .eq("user_id", userId);

  const { error } = snapshot.lastMonthlyReset
    ? await resetQuery.lt("last_monthly_reset", start.toISOString())
    : await resetQuery.is("last_monthly_reset", null);

  if (error) {
    logError("Не удалось сбросить месячные лимиты", error);

    return snapshot;
  }

  return {
    balance: {
      ...snapshot.balance,
      monthlyStandardUsed: 0,
      monthlyUltraUsed: 0,
    },
    lastMonthlyReset: now,
  };
}

/**
 * Создаёт строку счётчика, если её ещё нет.
 *
 * `ignoreDuplicates` превращает вставку в `ON CONFLICT DO NOTHING`: гонка двух
 * первых генераций не перезапишет уже израсходованные лимиты.
 */
async function ensureCreditsRow(
  admin: AdminClient,
  userId: string,
): Promise<boolean> {
  const { error } = await admin
    .from(CREDITS_TABLE)
    .upsert(
      { user_id: userId },
      { onConflict: "user_id", ignoreDuplicates: true },
    );

  if (error) {
    logError("Не удалось создать строку баланса", error);

    return false;
  }

  return true;
}

/** Изменение одного счётчика с условием на прочитанное значение. */
type CounterChange = {
  /** Колонка, которую проверяем перед записью (CAS). */
  guardColumn: string;
  /** Прочитанное значение этой колонки. */
  guardValue: number;
  /** Новые значения счётчиков. */
  patch: Record<string, number>;
};

/**
 * Собирает изменение счётчика для списания или возврата.
 *
 * Для израсходованных лимитов списание прибавляет единицу, возврат —
 * убавляет (не ниже нуля). Для токенов наоборот: списание убавляет, возврат
 * прибавляет. Условие всегда ставится на текущее значение — так параллельная
 * генерация не потеряется.
 */
function buildCounterChange(
  balance: GenerationCreditBalance,
  source: GenerationCreditSource,
  direction: "deduct" | "refund",
): CounterChange {
  const used = (value: number) =>
    direction === "deduct" ? value + 1 : Math.max(value - 1, 0);
  const tokens = (value: number) =>
    direction === "deduct" ? Math.max(value - 1, 0) : value + 1;

  switch (source) {
    case "monthly-standard":
      return {
        guardColumn: "monthly_standard_used",
        guardValue: balance.monthlyStandardUsed,
        patch: { monthly_standard_used: used(balance.monthlyStandardUsed) },
      };
    case "free-standard":
      return {
        guardColumn: "free_standard_used",
        guardValue: balance.freeStandardUsed,
        patch: { free_standard_used: used(balance.freeStandardUsed) },
      };
    case "standard-token":
      return {
        guardColumn: "standard_tokens",
        guardValue: balance.standardTokens,
        patch: { standard_tokens: tokens(balance.standardTokens) },
      };
    case "monthly-ultra":
      return {
        guardColumn: "monthly_ultra_used",
        guardValue: balance.monthlyUltraUsed,
        patch: { monthly_ultra_used: used(balance.monthlyUltraUsed) },
      };
    case "ultra-token":
      return {
        guardColumn: "ultra_tokens",
        guardValue: balance.ultraTokens,
        patch: { ultra_tokens: tokens(balance.ultraTokens) },
      };
    default:
      throw new Error(`Неизвестный источник списания: ${String(source)}`);
  }
}

/**
 * Сколько счётчиков и лимитов осталось у пользователя.
 *
 * Месячные лимиты сбрасываются здесь же, поэтому страница показывает
 * актуальные числа первого числа без отдельного планировщика. `null` —
 * баланс недоступен, а не «всё потрачено».
 */
export async function getUserCredits(
  userId: string,
): Promise<GenerationCreditBalance | null> {
  try {
    const admin = createAdminClient();
    const snapshot = await readBalance(admin, userId);

    if (!snapshot) {
      return null;
    }

    return (await resetMonthlyLimitsIfNeeded(admin, userId, snapshot)).balance;
  } catch (error) {
    console.error(
      "[credits] Не удалось прочитать баланс:",
      error instanceof Error ? error.message : error,
    );

    return null;
  }
}

/**
 * Списывает генерацию по приоритету бизнес-модели.
 *
 * `hasSubscription` проверяет вызывающий роут: модуль не ходит в
 * `subscriptions`, чтобы не дублировать правила доступа.
 *
 * `empty` — платить нечем (402), `unavailable` — счётчик не читается (503).
 * Разные ответы важны: из-за сбоя базы человек не должен покупать пакет.
 */
export async function deductGenerationCredit(
  userId: string,
  quality: GeneratorQuality,
  hasSubscription: boolean,
): Promise<DeductGenerationResult> {
  try {
    const admin = createAdminClient();

    if (!(await ensureCreditsRow(admin, userId))) {
      return { ok: false, reason: "unavailable" };
    }

    for (let attempt = 1; attempt <= DEDUCT_ATTEMPTS; attempt += 1) {
      const snapshot = await readBalance(admin, userId);

      if (!snapshot) {
        return { ok: false, reason: "unavailable" };
      }

      const current = await resetMonthlyLimitsIfNeeded(admin, userId, snapshot);
      const source = chooseCreditSource(
        current.balance,
        quality,
        hasSubscription,
      );

      if (!source) {
        return { ok: false, reason: "empty" };
      }

      const change = buildCounterChange(current.balance, source, "deduct");
      const { data, error } = await admin
        .from(CREDITS_TABLE)
        .update({
          ...change.patch,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq(change.guardColumn, change.guardValue)
        .select("user_id");

      if (error) {
        logError("Не удалось списать генерацию", error);

        return { ok: false, reason: "unavailable" };
      }

      if (Array.isArray(data) && data.length > 0) {
        return { ok: true, source };
      }

      // Счётчик изменился между чтением и записью — читаем заново.
    }

    console.error(
      "[credits] Не удалось списать генерацию: счётчик менялся слишком часто.",
    );

    return { ok: false, reason: "unavailable" };
  } catch (error) {
    console.error(
      "[credits] Не удалось списать генерацию:",
      error instanceof Error ? error.message : error,
    );

    return { ok: false, reason: "unavailable" };
  }
}

/**
 * Возвращает списанное, если провайдер не создал задачу.
 *
 * Источник приходит из результата списания: вернуть нужно ровно тот счётчик,
 * который уменьшился, — иначе подписка получила бы лишнюю месячную генерацию,
 * а токены остались бы потраченными.
 *
 * Возвращает `false`, если строку не удалось обновить; вызывающий код только
 * пишет в лог — исходная ошибка важнее.
 */
export async function refundGenerationCredit(
  userId: string,
  source: GenerationCreditSource,
): Promise<boolean> {
  try {
    const admin = createAdminClient();

    for (let attempt = 1; attempt <= DEDUCT_ATTEMPTS; attempt += 1) {
      const snapshot = await readBalance(admin, userId);

      if (!snapshot) {
        return false;
      }

      const change = buildCounterChange(snapshot.balance, source, "refund");
      const { data, error } = await admin
        .from(CREDITS_TABLE)
        .update({
          ...change.patch,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq(change.guardColumn, change.guardValue)
        .select("user_id");

      if (error) {
        logError("Не удалось вернуть генерацию", error);

        return false;
      }

      if (Array.isArray(data) && data.length > 0) {
        return true;
      }

      // Счётчик изменился между чтением и записью — читаем заново.
    }

    console.error(
      "[credits] Не удалось вернуть генерацию: счётчик менялся слишком часто.",
    );

    return false;
  } catch (error) {
    console.error(
      "[credits] Не удалось вернуть генерацию:",
      error instanceof Error ? error.message : error,
    );

    return false;
  }
}
