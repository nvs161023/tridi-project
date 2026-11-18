/* eslint-disable @typescript-eslint/no-explicit-any -- фейковый Supabase-клиент повторяет цепочки запросов. */
/**
 * Проверка разделения курсов и инструментов (R2).
 *
 * Запуск: `npm run check:billing` (или напрямую `node --import
 * ./scripts/register-alias.mjs scripts/test-billing-access.ts`).
 *
 * Что закрывает тест:
 *   1. пакет `pro` снова продаётся, а сумма берётся из каталога;
 *   2. покупка курса `confident` открывает уроки, но не инструменты Pro —
 *      `hasActiveSubscription` = false, значит Конструктор, Профили и
 *      генератор отвечают 403;
 *   3. новая покупка `pro` без строки legacy_pro_users инструментов не открывает;
 *   4. купленный до 17 ноября 2026 `pro` с legacy-грантом остаётся пожизненным;
 *   5. `pro-subscription` и действующий entitlement в `subscriptions`
 *      открывают инструменты, просроченный — нет;
 *   6. пакеты токенов дают только кредиты, а не доступ к инструментам.
 *
 * Сеть и Supabase не нужны: проверяются чистые правила доступа на фейковом
 * клиенте с теми же цепочками `from().select().eq()/in()`, что у Supabase.
 */
import coursesData from "@/data/courses.json";
import {
  PAYMENT_PLANS,
  getPaymentAmount,
  isPaymentCourseId,
} from "@/lib/payments";
import {
  getActiveSubscription,
  hasActiveSubscription,
  hasCourseAccess,
} from "@/lib/subscription";

type Row = Record<string, unknown>;

/** Ошибка таблицы: повторяет форму PostgREST/Supabase. */
type TableError = { code: string; message: string };

/** Строки таблицы или ошибка её чтения. */
type TableResult = Row[] | { error: TableError };

type FakeData = Record<string, TableResult>;

type SubscriptionClient = Parameters<typeof hasActiveSubscription>[0];

function createFakeSupabase(data: FakeData): SubscriptionClient {
  type Filter =
    | { column: string; kind: "eq"; value: unknown }
    | { column: string; kind: "in"; values: unknown[] };

  function read(
    table: string,
    filters: Filter[],
  ): { data: Row[] | null; error: TableError | null } {
    const result = data[table];

    if (result && !Array.isArray(result) && "error" in result) {
      return { data: null, error: result.error };
    }

    const rows = Array.isArray(result) ? result : [];

    // `eq`/`in` важны для теста: без фильтра фейк вернул бы чужой курс.
    return {
      data: rows.filter((row) =>
        filters.every((filter) =>
          filter.kind === "eq"
            ? row[filter.column] === filter.value
            : filter.values.includes(row[filter.column]),
        ),
      ),
      error: null,
    };
  }

  return {
    from(table: string) {
      const filters: Filter[] = [];

      const query: any = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          filters.push({ column, kind: "eq", value });
          return query;
        },
        in: (column: string, values: unknown[]) => {
          filters.push({ column, kind: "in", values });
          return query;
        },
        limit: () => query,
        maybeSingle: () => {
          const result = read(table, filters);

          if (result.error) {
            return Promise.resolve(result);
          }

          return Promise.resolve({
            data: result.data?.[0] ?? null,
            error: null,
          });
        },
        then: (onfulfilled: any, onrejected: any) =>
          Promise.resolve(read(table, filters)).then(onfulfilled, onrejected),
      };

      return query;
    },
  } as unknown as SubscriptionClient;
}

let failures = 0;

/** Печатает результат одной проверки и считает провалы. */
function check(name: string, ok: boolean, details: string) {
  console.log(`${ok ? "✓" : "✗"} ${name} — ${details}`);

  if (!ok) {
    failures += 1;
  }
}

const USER_ID = "11111111-1111-4111-8111-111111111111";
const NOW = Date.now();
const FUTURE = new Date(NOW + 7 * 24 * 60 * 60 * 1000).toISOString();
const PAST = new Date(NOW - 24 * 60 * 60 * 1000).toISOString();

/** Клиент с покупками, подписками и legacy-грантом (по умолчанию — пустым). */
function client({
  purchases = [],
  subscriptions = [],
  legacy = [],
}: {
  purchases?: Row[];
  subscriptions?: Row[];
  legacy?: Row[] | { error: TableError };
}): SubscriptionClient {
  const own = (rows: Row[]) =>
    rows.map((row) => ({ user_id: USER_ID, ...row }));

  return createFakeSupabase({
    purchases: own(purchases),
    subscriptions: own(subscriptions),
    legacy_pro_users: Array.isArray(legacy) ? own(legacy) : legacy,
  });
}

console.log("=== 1. Пакет pro продаётся, сумма берётся из каталога ===");

check(
  "pro входит в продаваемые товары",
  Object.prototype.hasOwnProperty.call(PAYMENT_PLANS, "pro"),
  `ключи: ${Object.keys(PAYMENT_PLANS).join(", ")}`,
);

check(
  "Ссылку на оплату pro создать можно",
  isPaymentCourseId("pro") === true,
  `isPaymentCourseId(pro)=${isPaymentCourseId("pro")}`,
);

check(
  "Сумма pro совпадает с каталогом",
  getPaymentAmount("pro") === coursesData.pro.price,
  `${coursesData.pro.price} ₽`,
);

check(
  "Подписка pro-subscription остаётся в продаже",
  isPaymentCourseId("pro-subscription") === true &&
    getPaymentAmount("pro-subscription") === coursesData.pro.subscriptionPrice,
  `${coursesData.pro.subscriptionPrice} ₽`,
);

check(
  "Пакеты токенов продаются",
  isPaymentCourseId("standard-pack") === true &&
    isPaymentCourseId("ultra-pack") === true,
  "standard-pack, ultra-pack",
);

check(
  "Неизвестный товар отклоняется",
  isPaymentCourseId("lifetime-everything") === false,
  "lifetime-everything",
);

console.log("\n=== 2. Курс confident: уроки открыты, инструменты — нет ===");

const confidentOnly = client({
  purchases: [{ course_id: "confident", expires_at: null }],
});
const confidentTools = await hasActiveSubscription(confidentOnly, USER_ID);
const confidentCourse = await hasCourseAccess(
  confidentOnly,
  USER_ID,
  "confident",
);
const confidentEngineer = await hasCourseAccess(
  confidentOnly,
  USER_ID,
  "engineer",
);

check(
  "confident не даёт доступ к инструментам (API вернёт 403)",
  confidentTools === false,
  `hasActiveSubscription=${confidentTools}`,
);

check(
  "confident открывает свой курс",
  confidentCourse === true,
  `hasCourseAccess(confident)=${confidentCourse}`,
);

check(
  "confident не открывает чужой курс",
  confidentEngineer === false,
  `hasCourseAccess(engineer)=${confidentEngineer}`,
);

console.log("\n=== 3. Покупка pro без legacy-гранта ===");

const proWithoutGrant = client({
  purchases: [
    {
      course_id: "pro",
      expires_at: null,
      created_at: "2026-11-17T12:00:00Z",
    },
  ],
  legacy: [],
});
const proTools = await hasActiveSubscription(proWithoutGrant, USER_ID);
const proCourse = await hasCourseAccess(proWithoutGrant, USER_ID, "confident");

check(
  "pro без legacy_pro_users не открывает инструменты",
  proTools === false,
  `hasActiveSubscription=${proTools}`,
);

check(
  "pro без legacy_pro_users оставляет три курса",
  proCourse === true,
  `hasCourseAccess(confident)=${proCourse}`,
);

console.log("\n=== 4. Пожизненный legacy-грант для старых покупателей ===");

const legacyClient = client({
  purchases: [
    {
      course_id: "pro",
      expires_at: null,
      created_at: "2026-11-16T12:00:00Z",
    },
  ],
  legacy: [{ user_id: USER_ID }],
});
const legacyAccess = await getActiveSubscription(legacyClient, USER_ID);

check(
  "legacy-грант открывает инструменты",
  legacyAccess.active === true,
  `active=${legacyAccess.active}`,
);

check(
  "legacy-грант бессрочный и помечен как пакет",
  legacyAccess.expiresAt === null && legacyAccess.source === "bundle",
  `expiresAt=${legacyAccess.expiresAt ?? "null"}, source=${legacyAccess.source ?? "null"}`,
);

console.log("\n=== 5. Подписка Pro и просрочка ===");

const activeSubscription = client({
  purchases: [{ course_id: "pro-subscription", expires_at: FUTURE }],
});
const subscriptionAccess = await getActiveSubscription(
  activeSubscription,
  USER_ID,
);
const subscriptionTools = await hasActiveSubscription(
  activeSubscription,
  USER_ID,
);

check(
  "pro-subscription открывает инструменты (API доступен)",
  subscriptionTools === true,
  `hasActiveSubscription=${subscriptionTools}`,
);

check(
  "У подписки есть срок и источник",
  subscriptionAccess.active === true &&
    subscriptionAccess.expiresAt === FUTURE &&
    subscriptionAccess.source === "subscription",
  `expiresAt=${subscriptionAccess.expiresAt ?? "null"}, source=${subscriptionAccess.source ?? "null"}`,
);

const expiredSubscription = client({
  purchases: [{ course_id: "pro-subscription", expires_at: PAST }],
});
const expiredTools = await hasActiveSubscription(expiredSubscription, USER_ID);

check(
  "Просроченная pro-subscription инструменты не открывает",
  expiredTools === false,
  `hasActiveSubscription=${expiredTools}`,
);

const entitlement = client({
  subscriptions: [
    { status: "active", trial_ends_at: null, expires_at: FUTURE },
  ],
});
const entitlementTools = await hasActiveSubscription(entitlement, USER_ID);

check(
  "Действующий entitlement в subscriptions открывает инструменты",
  entitlementTools === true,
  `hasActiveSubscription=${entitlementTools}`,
);

console.log("\n=== 6. Пакеты токенов — только кредиты ===");

const tokenPackOnly = client({
  purchases: [{ course_id: "standard-pack", expires_at: null }],
});
const tokenTools = await hasActiveSubscription(tokenPackOnly, USER_ID);

check(
  "standard-pack не открывает инструменты",
  tokenTools === false,
  `hasActiveSubscription=${tokenTools}`,
);

console.log("\n=== 7. Выкат раньше SQL: fallback не отбирает оплаченное ===");

const beforeMigration = client({
  purchases: [
    {
      course_id: "pro",
      expires_at: null,
      created_at: "2026-11-16T12:00:00Z",
    },
  ],
  legacy: {
    error: {
      code: "PGRST205",
      message: "Could not find the table 'public.legacy_pro_users'",
    },
  },
});
const fallbackAccess = await getActiveSubscription(beforeMigration, USER_ID);

check(
  "Без таблицы legacy_pro_users старый pro работает",
  fallbackAccess.active === true &&
    fallbackAccess.expiresAt === null &&
    fallbackAccess.source === "bundle",
  `active=${fallbackAccess.active}, source=${fallbackAccess.source ?? "null"}`,
);

const newProBeforeMigration = client({
  purchases: [
    {
      course_id: "pro",
      expires_at: null,
      created_at: "2026-11-17T12:00:00Z",
    },
  ],
  legacy: {
    error: {
      code: "PGRST205",
      message: "Could not find the table 'public.legacy_pro_users'",
    },
  },
});
const newProTools = await hasActiveSubscription(
  newProBeforeMigration,
  USER_ID,
);

check(
  "Новый pro без таблицы legacy_pro_users инструменты не открывает",
  newProTools === false,
  `hasActiveSubscription=${newProTools}`,
);

const refundedPro = client({
  purchases: [
    {
      course_id: "pro",
      expires_at: PAST,
      created_at: "2026-11-16T12:00:00Z",
    },
  ],
  legacy: [],
});
const refundedTools = await hasActiveSubscription(refundedPro, USER_ID);

check(
  "Возвращённый pro без гранта инструменты не открывает",
  refundedTools === false,
  `hasActiveSubscription=${refundedTools}`,
);

console.log(
  failures === 0
    ? "\nИтог: все проверки пройдены."
    : `\nИтог: провалов ${failures}.`,
);
process.exit(failures === 0 ? 0 : 1);
