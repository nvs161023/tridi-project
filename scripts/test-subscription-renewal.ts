/**
 * Проверка атомарного продления подписки Pro (R15).
 *
 * Запуск: `npm run check:subscription` (нужен флаг Node для подмены модуля
 * `lib/supabase/admin`, поэтому скрипт не использует реальную базу).
 *
 * Что закрывает тест:
 *   1. два параллельных вебхука Robokassa с разными InvId добавляют по 30 дней
 *      и дают 60 дней, а не 30;
 *   2. второй запрос ждёт транзакцию первого (в тесте — очередь RPC), поэтому
 *      расчёт идёт от `max(now(), expires_at)`, а не от одного и того же `now`;
 *   3. повторный InvId возвращает сохранённый срок и второй месяц не добавляет.
 *
 * Сеть, Supabase и `.env.local` не нужны: service_role подменяется фейковым
 * клиентом, а подпись Robokassa строится тем же кодом, что в приложении.
 */
import { mock } from "node:test";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  SUBSCRIPTION_PERIOD_DAYS,
  buildResultSignature,
  getPaymentAmount,
} from "@/lib/payments";

const PERIOD_MS = SUBSCRIPTION_PERIOD_DAYS * 24 * 60 * 60 * 1000;
const USER_ID = "11111111-1111-4111-8111-111111111111";
const PASSWORD = "test-password-2";
const COURSE_ID = "pro-subscription";

let failures = 0;

/** Печатает результат одной проверки и считает провалы. */
function check(name: string, ok: boolean, details: string): void {
  console.log(`${ok ? "✓" : "✗"} ${name} — ${details}`);

  if (!ok) {
    failures += 1;
  }
}

/** Ошибка Supabase в том же виде, что возвращает PostgREST. */
type RpcError = { code?: string; message: string };

/** Ответ RPC: срок подписки или ошибка. */
type RpcResult = { data: string | null; error: RpcError | null };

/** Покупка в фейковой базе: срок нужен для проверки идемпотентности. */
const purchases = new Map<number, string>();

/** Срок подписки в фейковой базе — аналог subscriptions.expires_at. */
let currentExpiresAt = 0;

/**
 * Очередь транзакций: второй вызов RPC ждёт первый, как `for update` в базе.
 * Без неё оба вебхука прочитали бы один срок и вернули одинаковые 30 дней.
 */
let transactionQueue: Promise<void> = Promise.resolve();

/**
 * Фейковая SQL-функция `apply_pro_subscription_purchase`.
 *
 * Формула повторяет миграцию: новый срок = max(now, current_expires_at) + 30
 * дней. Задержка внутри критической секции гарантирует, что тест проверяет
 * именно сериализацию, а не случайное выполнение по очереди.
 */
async function applyPurchase(args: {
  p_inv_id: number;
  p_user_id: string;
  p_course_id: string;
  p_amount: number;
  p_period_days: number;
}): Promise<RpcResult> {
  let release = () => {};

  const previous = transactionQueue;
  transactionQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;

  try {
    if (args.p_user_id !== USER_ID || args.p_course_id !== COURSE_ID) {
      return { data: null, error: { message: "unexpected purchase" } };
    }

    const existing = purchases.get(args.p_inv_id);

    if (existing) {
      return { data: existing, error: null };
    }

    await new Promise((resolve) => setTimeout(resolve, 25));

    const base = Math.max(Date.now(), currentExpiresAt);
    const next = base + args.p_period_days * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(next).toISOString();

    purchases.set(args.p_inv_id, expiresAt);
    currentExpiresAt = next;

    return { data: expiresAt, error: null };
  } finally {
    release();
  }
}

/**
 * Подмена `createAdminClient`: вебхук не должен ходить в настоящий Supabase.
 * `from` намеренно отсутствует — подписка обязана идти только через RPC.
 */
mock.module(pathToFileURL(path.resolve("lib/supabase/admin.ts")).href, {
  namedExports: {
    createAdminClient: () => ({
      rpc: async (name: string, args: Record<string, unknown>) => {
        if (name !== "apply_pro_subscription_purchase") {
          return {
            data: null,
            error: { message: `unexpected rpc: ${name}` },
          };
        }

        return applyPurchase(
          args as {
            p_inv_id: number;
            p_user_id: string;
            p_course_id: string;
            p_amount: number;
            p_period_days: number;
          },
        );
      },
    }),
  },
});

process.env.ROBOKASSA_PASSWORD2 = PASSWORD;
process.env.ROBOKASSA_IS_TEST = "true";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";

const { POST } = await import("../app/api/payments/robokassa/result/route");

const amount = getPaymentAmount(COURSE_ID);
const outSum = String(amount);
const shp = { course: COURSE_ID, user: USER_ID };

/** Подписанный POST вебхука — так его присылает Robokassa. */
function webhook(invId: number): Promise<Response> {
  const params = new URLSearchParams({
    OutSum: outSum,
    InvId: String(invId),
    SignatureValue: buildResultSignature(outSum, String(invId), shp, PASSWORD),
    Shp_course: COURSE_ID,
    Shp_user: USER_ID,
  });

  return POST(
    new Request("http://localhost/api/payments/robokassa/result", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    }) as never,
  );
}

console.log("=== 1. Два параллельных вебхука с разными InvId ===");

const firstInvId = Date.now();
const secondInvId = firstInvId + 1;
const startedAt = Date.now();

const [firstResponse, secondResponse] = await Promise.all([
  webhook(firstInvId),
  webhook(secondInvId),
]);
const finishedAt = Date.now();

const firstBody = await firstResponse.text();
const secondBody = await secondResponse.text();

check(
  "Оба вебхука приняты Robokassa",
  firstResponse.status === 200 &&
    secondResponse.status === 200 &&
    firstBody === `OK${firstInvId}` &&
    secondBody === `OK${secondInvId}`,
  `${firstResponse.status}/${firstBody}, ${secondResponse.status}/${secondBody}`,
);

const firstExpires = purchases.get(firstInvId);
const secondExpires = purchases.get(secondInvId);

check(
  "Обе покупки записаны",
  Boolean(firstExpires && secondExpires) && purchases.size === 2,
  `purchases=${purchases.size}`,
);

const firstTime = firstExpires ? Date.parse(firstExpires) : Number.NaN;
const secondTime = secondExpires ? Date.parse(secondExpires) : Number.NaN;
const distance = secondTime - firstTime;
const finalTime = currentExpiresAt;

check(
  "Второй InvId добавляет ещё ровно 30 дней",
  Math.abs(distance - PERIOD_MS) < 1000,
  `${(distance / 86_400_000).toFixed(4)} дней`,
);

check(
  "Итоговый срок — 60 дней от старта, а не 30",
  finalTime >= startedAt + 2 * PERIOD_MS - 1000 &&
    finalTime <= finishedAt + 2 * PERIOD_MS + 1000,
  `${((finalTime - startedAt) / 86_400_000).toFixed(4)} дней`,
);

console.log("\n=== 2. Повторный InvId не продлевает подписку второй раз ===");

const beforeRepeat = currentExpiresAt;
const repeatResponse = await webhook(firstInvId);
const repeatBody = await repeatResponse.text();

check(
  "Повтор отвечает OK",
  repeatResponse.status === 200 && repeatBody === `OK${firstInvId}`,
  `${repeatResponse.status}/${repeatBody}`,
);

check(
  "Срок после повтора не изменился",
  currentExpiresAt === beforeRepeat,
  `${((currentExpiresAt - beforeRepeat) / 86_400_000).toFixed(4)} дней`,
);

console.log(
  failures === 0
    ? "\nИтог: все проверки пройдены."
    : `\nИтог: провалов ${failures}.`,
);
process.exit(failures === 0 ? 0 : 1);
