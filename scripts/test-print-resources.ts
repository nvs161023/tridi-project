/**
 * Тест ресурсов печати: правило «задание зависло» (C7) и списание пластика по
 * факту (C6).
 *
 * Что проверяется без базы и без сети:
 *   1. порог просрочки считается от `started_at` и равен оценке слайсера плюс
 *      10 %, а без оценки — суткам; задание в будущем и без меток не снимается;
 *   2. план мастера возвращается на катушку ровно при первом завершённом
 *      задании заказа, поэтому факт не ложится сверху плана;
 *   3. остаток катушки зажимается в `0…total_weight_g` и остаётся целым;
 *   4. без катушки, без веса и при ошибке чтения функция не пишет в базу и
 *      объясняет причину.
 *
 * Клиент Supabase подменён заглушкой: она отдаёт заранее заданные ответы по
 * очереди и записывает `update`, поэтому арифметика проверяется без живой базы.
 *
 * Запуск:
 *   node --import ./scripts/register-alias.mjs scripts/test-print-resources.ts
 *
 * Выход: 0 — все проверки прошли, 1 — есть расхождения.
 */
import { writeOffFilamentFact } from "../lib/db/workshop-filament-facts";
import {
  overduePrintMs,
  readStuckPrintJob,
} from "../lib/workshop/stuck-print-jobs";

/** Сколько проверок упало: из этого складывается код выхода. */
let failures = 0;

function check(name: string, actual: unknown, expected: unknown): void {
  const isEqual = JSON.stringify(actual) === JSON.stringify(expected);

  if (isEqual) {
    console.log(`  ok   ${name}`);
    return;
  }

  failures += 1;
  console.log(`  FAIL ${name}`);
  console.log(`       ожидалось: ${JSON.stringify(expected)}`);
  console.log(`       получено:  ${JSON.stringify(actual)}`);
}

type StubResponse = {
  data?: unknown;
  error?: { code?: string; message?: string } | null;
  count?: number | null;
};

type StubClient = {
  client: Parameters<typeof writeOffFilamentFact>[0]["supabase"];
  updates: Array<{ table: string; payload: Record<string, unknown> }>;
};

/**
 * Заглушка клиента Supabase.
 *
 * Очередь ответов повторяет порядок запросов в `writeOffFilamentFact()`: заказ →
 * катушка → счётчик завершённых заданий → запись остатка. Любой метод цепочки
 * возвращает саму цепочку, поэтому `.select().eq().eq().maybeSingle()` и
 * `await .update().eq().eq()` работают как с настоящим клиентом.
 */
function createStubClient(responses: StubResponse[]): StubClient {
  const queue = [...responses];
  const updates: Array<{ table: string; payload: Record<string, unknown> }> = [];

  const settle = (): StubResponse =>
    queue.shift() ?? { data: null, error: null };

  function chain(
    table: string,
    action: "select" | "update",
    payload: Record<string, unknown> | null,
  ): Record<string, unknown> {
    const node: Record<string, unknown> = {};

    const record = () => {
      if (action === "update" && payload !== null) {
        updates.push({ table, payload });
      }

      return settle();
    };

    for (const method of ["select", "eq", "neq", "in", "order", "limit"]) {
      node[method] = () => node;
    }

    node.maybeSingle = () => Promise.resolve(record());
    node.then = (
      resolve: (value: StubResponse) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(record()).then(resolve, reject);

    return node;
  }

  return {
    client: {
      from: (table: string) => ({
        select: () => chain(table, "select", null),
        update: (payload: Record<string, unknown>) =>
          chain(table, "update", payload),
      }),
    } as unknown as Parameters<typeof writeOffFilamentFact>[0]["supabase"],
    updates,
  };
}

// ── 1. Правило «задание зависло» (C7) ───────────────────────────────────────

const NOW = Date.parse("2026-10-30T12:00:00.000Z");

/** Момент `hours` часов назад от NOW, ISO. */
function hoursAgo(hours: number): string {
  return new Date(NOW - hours * 60 * 60 * 1000).toISOString();
}

const JOB_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const ORDER_ID = "22222222-2222-4222-8222-222222222222";
const FILAMENT_ID = "44444444-4444-4444-8444-444444444444";

function jobRow(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: JOB_ID,
    user_id: USER_ID,
    order_id: ORDER_ID,
    printer_id: null,
    started_at: hoursAgo(2),
    estimated_seconds: 7500,
    ...overrides,
  };
}

console.log("Правило просрочки (C7):");

/**
 * Просрочка в миллисекундах, округлённая до целого: множитель 1.1 в двоичной
 * дроби даёт хвост `749999.9999999991` вместо `750000`.
 */
function overdueMs(
  row: Record<string, unknown>,
  now = NOW,
): number | null {
  const job = readStuckPrintJob(row);

  if (!job) {
    return null;
  }

  const ms = overduePrintMs(job, now);

  return ms === null ? null : Math.round(ms);
}

check(
  "оценка 2 ч 5 мин, идёт 2 ч — не зависло",
  overdueMs(jobRow({})),
  null,
);
check(
  "оценка 2 ч 5 мин, идёт 2,5 ч — просрочка 12,5 мин",
  overdueMs(jobRow({ started_at: hoursAgo(2.5) })),
  750_000,
);
check(
  "оценки нет, идёт 23 ч — не зависло",
  overdueMs(jobRow({ estimated_seconds: null })),
  null,
);
check(
  "оценки нет, идёт 25 ч — просрочка 1 ч",
  overdueMs(jobRow({ estimated_seconds: null, started_at: hoursAgo(25) })),
  3_600_000,
);
check(
  "оценка строкой из базы",
  readStuckPrintJob(jobRow({ estimated_seconds: "600" }))!.estimatedSeconds,
  600,
);
check(
  "нет started_at — считаем от updated_at",
  overdueMs(
    jobRow({
      started_at: null,
      estimated_seconds: null,
      updated_at: hoursAgo(30),
    }),
  ),
  6 * 60 * 60 * 1000,
);
check(
  "старт в будущем — просрочки нет",
  overdueMs(jobRow({ started_at: hoursAgo(-3) })),
  null,
);
check(
  "строка без id не берётся",
  readStuckPrintJob({ user_id: USER_ID }),
  null,
);
check(
  "принтер и заказ читаются из строки",
  (() => {
    const job = readStuckPrintJob(
      jobRow({ printer_id: "55555555-5555-4555-8555-555555555555" }),
    );

    return [job?.orderId, job?.printerId];
  })(),
  [ORDER_ID, "55555555-5555-4555-8555-555555555555"],
);

// ── 2. Списание пластика по факту (C6) ──────────────────────────────────────

/**
 * Проверки списания — в отдельной функции, а не на верхнем уровне модуля:
 * `writeOffFilamentFact()` асинхронная, а Node без `"type": "module"` в
 * package.json разбирает `.ts` как CommonJS и верхнеуровневый `await` не берёт.
 */
async function checkFilamentFacts(): Promise<void> {
  console.log("\nСписание пластика (C6):");

  /** Ответы на запросы: заказ, катушка, счётчик завершённых заданий, запись. */
  function responsesFor(options: {
    remaining: number;
    total?: number;
    plan?: number;
    filamentId?: string | null;
    otherDoneJobs?: number;
    writeError?: { code: string; message: string } | null;
    readError?: { code: string; message: string } | null;
  }): StubResponse[] {
    const filamentId =
      options.filamentId === undefined ? FILAMENT_ID : options.filamentId;

    return [
      options.readError
        ? { data: null, error: options.readError }
        : {
            data: {
              filament_id: filamentId,
              material_weight_g: options.plan ?? 0,
            },
            error: null,
          },
      {
        data: {
          remaining_weight_g: options.remaining,
          total_weight_g: options.total ?? 1000,
        },
        error: null,
      },
      { count: options.otherDoneJobs ?? 0, error: null },
      { data: null, error: options.writeError ?? null },
    ];
  }

  /** Прогон списания с заглушкой: результат функции и записанный остаток. */
  async function charge(options: {
    grams: number | string | null;
    remaining: number;
    total?: number;
    plan?: number;
    filamentId?: string | null;
    otherDoneJobs?: number;
    writeError?: { code: string; message: string } | null;
    readError?: { code: string; message: string } | null;
  }): Promise<{ outcome: unknown; written: unknown }> {
    const stub = createStubClient(responsesFor(options));
    const outcome = await writeOffFilamentFact({
      supabase: stub.client,
      userId: USER_ID,
      orderId: ORDER_ID,
      jobId: JOB_ID,
      grams:
        typeof options.grams === "string"
          ? Number(options.grams)
          : options.grams,
    });

    return {
      outcome,
      written: stub.updates[0]?.payload.remaining_weight_g ?? null,
    };
  }
  check(
    "первое done: план 100 г вернулся, факт 95 г списан",
    await charge({ grams: 95, remaining: 500, plan: 100 }),
    {
      outcome: {
        status: "charged",
        grams: 95,
        planRefundG: 100,
        remainingWeightG: 505,
      },
      written: 505,
    },
  );
  check(
    "второе done: план не возвращается второй раз",
    await charge({ grams: 40, remaining: 505, plan: 100, otherDoneJobs: 1 }),
    {
      outcome: {
        status: "charged",
        grams: 40,
        planRefundG: 0,
        remainingWeightG: 465,
      },
      written: 465,
    },
  );
  check(
    "факт больше остатка — остаток 0, а не минус",
    await charge({ grams: 300, remaining: 50, otherDoneJobs: 1 }),
    {
      outcome: {
        status: "charged",
        grams: 300,
        planRefundG: 0,
        remainingWeightG: 0,
      },
      written: 0,
    },
  );
  check(
    "план не поднимает остаток выше катушки",
    await charge({ grams: 10, remaining: 990, total: 1000, plan: 100 }),
    {
      outcome: {
        status: "charged",
        grams: 10,
        planRefundG: 100,
        remainingWeightG: 1000,
      },
      written: 1000,
    },
  );
  check(
    "дробный факт округляется до грамма",
    await charge({ grams: "42.6", remaining: 500, otherDoneJobs: 1 }),
    {
      outcome: {
        status: "charged",
        grams: 43,
        planRefundG: 0,
        remainingWeightG: 457,
      },
      written: 457,
    },
  );
  check(
    "к заказу не привязана катушка",
    await charge({ grams: 95, remaining: 500, filamentId: null }),
    { outcome: { status: "skipped", reason: "no_filament" }, written: null },
  );
  check(
    "агент не прислал вес",
    await charge({ grams: null, remaining: 500 }),
    { outcome: { status: "skipped", reason: "no_grams" }, written: null },
  );
  check(
    "ошибка чтения заказа не пишет в базу",
    await charge({
      grams: 95,
      remaining: 500,
      readError: { code: "57014", message: "canceling statement" },
    }),
    {
      outcome: {
        status: "failed",
        error: "Заказ не прочитан: 57014 canceling statement",
      },
      written: null,
    },
  );
  check(
    "ошибка записи остатка видна вызывающему",
    await charge({
      grams: 95,
      remaining: 500,
      otherDoneJobs: 1,
      writeError: { code: "23514", message: "check violation" },
    }),
    {
      outcome: {
        status: "failed",
        error: "Остаток катушки не записан: 23514 check violation",
      },
      written: 405,
    },
  );
}

checkFilamentFacts()
  .then(() => {
    if (failures > 0) {
      console.log(`\nПровалено проверок: ${failures}`);
      process.exit(1);
    }

    console.log("\nВсе проверки прошли.");
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });

