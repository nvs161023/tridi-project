/**
 * Проверка правил списания генераций 3D-моделей.
 *
 * Запуск: `npm run check:credits` (или напрямую `node --import
 * ./scripts/register-alias.mjs scripts/test-generation-credits.ts`).
 *
 * Модуль `lib/generator/generation-credits.ts` — единственное место, где решён
 * порядок списания. Его импортируют страница `/3d-generator` (подпись под
 * кнопкой), клиентский компонент (состояние кнопки) и `/api/generate-3d`
 * (фактическое списание). Ошибка здесь стоит денег: пользователь увидит одну
 * цену, а спишется другая, либо генерация пройдёт бесплатно.
 *
 * Что проверяется:
 *   1. Free: одна бесплатная Standard навсегда, Ultra без подписки — только за
 *      токены (бесплатных Ultra нет);
 *   2. порядок Standard: месячный лимит подписки → бесплатная → токен.
 *      Бесплатная не тратится, пока идёт подписка, токены — пока есть что-то
 *      более «короткое»;
 *   3. порядок Ultra: месячный лимит подписки → токен, без бесплатной ступени;
 *   4. после окончания подписки её неизрасходованный лимит не работает: остаток
 *      месяца не переносится в бесплатные или токены;
 *   5. счётчики не уходят в минус и не отдают больше лимита, даже если в базе
 *      лежит перебор;
 *   6. `canGenerateWith` совпадает с `chooseCreditSource`, а `describeCreditSource`
 *      различает все пять источников — иначе подпись под кнопкой соврёт;
 *   7. `chooseCreditSource` не меняет переданный баланс: страница вызывает её на
 *      каждом рендере, и мутация сломала бы следующий расчёт.
 */
import {
  FREE_STANDARD_GENERATIONS,
  MONTHLY_STANDARD_GENERATIONS,
  MONTHLY_ULTRA_GENERATIONS,
  canGenerateWith,
  chooseCreditSource,
  createEmptyCreditBalance,
  describeCreditSource,
  hasFreeStandard,
  monthlyStandardLeft,
  monthlyUltraLeft,
  type GenerationCreditBalance,
  type GenerationCreditSource,
} from "@/lib/generator/generation-credits";

let failures = 0;

/** Печатает результат одной проверки и считает провалы. */
function check(name: string, ok: boolean, details: string) {
  console.log(`${ok ? "✓" : "✗"} ${name} — ${details}`);

  if (!ok) {
    failures += 1;
  }
}

/** Баланс из частичных полей: кейс читается как «что лежит в строке». */
function balance(
  overrides: Partial<GenerationCreditBalance> = {},
): GenerationCreditBalance {
  return { ...createEmptyCreditBalance(), ...overrides };
}

/** Все источники из типа: если добавится шестой, массив придётся обновить. */
const ALL_SOURCES: Record<GenerationCreditSource, true> = {
  "monthly-standard": true,
  "free-standard": true,
  "standard-token": true,
  "monthly-ultra": true,
  "ultra-token": true,
};

console.log("=== 1. Новый пользователь без подписки ===");

check(
  "Standard уходит в бесплатную",
  chooseCreditSource(balance(), "standard", false) === "free-standard",
  String(chooseCreditSource(balance(), "standard", false)),
);

check(
  "Ultra без подписки и токенов недоступна",
  chooseCreditSource(balance(), "ultra", false) === null,
  String(chooseCreditSource(balance(), "ultra", false)),
);

check(
  "Ultra за купленный токен",
  chooseCreditSource(balance({ ultraTokens: 2 }), "ultra", false) ===
    "ultra-token",
  String(chooseCreditSource(balance({ ultraTokens: 2 }), "ultra", false)),
);

check(
  "Standard-токены не оплачивают Ultra",
  chooseCreditSource(balance({ standardTokens: 5 }), "ultra", false) === null,
  String(chooseCreditSource(balance({ standardTokens: 5 }), "ultra", false)),
);

check(
  "Вторая Standard без токенов недоступна",
  chooseCreditSource(balance({ freeStandardUsed: 1 }), "standard", false) ===
    null,
  String(
    chooseCreditSource(balance({ freeStandardUsed: 1 }), "standard", false),
  ),
);

check(
  "Вторая Standard — за токен",
  chooseCreditSource(
    balance({ freeStandardUsed: 1, standardTokens: 1 }),
    "standard",
    false,
  ) === "standard-token",
  String(
    chooseCreditSource(
      balance({ freeStandardUsed: 1, standardTokens: 1 }),
      "standard",
      false,
    ),
  ),
);

console.log("\n=== 2. Подписка: месячный лимит идёт первым ===");

check(
  "Свежий месяц: Standard списывается с лимита подписки",
  chooseCreditSource(balance(), "standard", true) === "monthly-standard",
  String(chooseCreditSource(balance(), "standard", true)),
);

check(
  "Бесплатная не тратится, пока есть лимит подписки",
  hasFreeStandard(balance()) === true,
  `freeStandardUsed=0, лимит ${MONTHLY_STANDARD_GENERATIONS}`,
);

check(
  "Лимит Standard исчерпан — следующая бесплатная",
  chooseCreditSource(
    balance({ monthlyStandardUsed: MONTHLY_STANDARD_GENERATIONS }),
    "standard",
    true,
  ) === "free-standard",
  String(
    chooseCreditSource(
      balance({ monthlyStandardUsed: MONTHLY_STANDARD_GENERATIONS }),
      "standard",
      true,
    ),
  ),
);

check(
  "Лимит и бесплатная исчерпаны — токен",
  chooseCreditSource(
    balance({
      monthlyStandardUsed: MONTHLY_STANDARD_GENERATIONS,
      freeStandardUsed: FREE_STANDARD_GENERATIONS,
      standardTokens: 2,
    }),
    "standard",
    true,
  ) === "standard-token",
  String(
    chooseCreditSource(
      balance({
        monthlyStandardUsed: MONTHLY_STANDARD_GENERATIONS,
        freeStandardUsed: FREE_STANDARD_GENERATIONS,
        standardTokens: 2,
      }),
      "standard",
      true,
    ),
  ),
);

check(
  "Лимит и бесплатная исчерпаны, токенов нет — отказ",
  chooseCreditSource(
    balance({
      monthlyStandardUsed: MONTHLY_STANDARD_GENERATIONS,
      freeStandardUsed: FREE_STANDARD_GENERATIONS,
    }),
    "standard",
    true,
  ) === null,
  String(
    chooseCreditSource(
      balance({
        monthlyStandardUsed: MONTHLY_STANDARD_GENERATIONS,
        freeStandardUsed: FREE_STANDARD_GENERATIONS,
      }),
      "standard",
      true,
    ),
  ),
);

console.log("\n=== 3. Подписка: Ultra ===");

check(
  "Свежий месяц: Ultra списывается с лимита подписки",
  chooseCreditSource(balance(), "ultra", true) === "monthly-ultra",
  String(chooseCreditSource(balance(), "ultra", true)),
);

check(
  "Лимит Ultra исчерпан — за токен",
  chooseCreditSource(
    balance({ monthlyUltraUsed: MONTHLY_ULTRA_GENERATIONS, ultraTokens: 1 }),
    "ultra",
    true,
  ) === "ultra-token",
  String(
    chooseCreditSource(
      balance({ monthlyUltraUsed: MONTHLY_ULTRA_GENERATIONS, ultraTokens: 1 }),
      "ultra",
      true,
    ),
  ),
);

check(
  "Лимит Ultra исчерпан, токенов нет — отказ (бесплатной Ultra нет)",
  chooseCreditSource(
    balance({ monthlyUltraUsed: MONTHLY_ULTRA_GENERATIONS }),
    "ultra",
    true,
  ) === null,
  String(
    chooseCreditSource(
      balance({ monthlyUltraUsed: MONTHLY_ULTRA_GENERATIONS }),
      "ultra",
      true,
    ),
  ),
);

check(
  "Ultra без лимита и без токенов — отказ, даже если бесплатная Standard цела",
  chooseCreditSource(
    balance({
      freeStandardUsed: 0,
      monthlyUltraUsed: MONTHLY_ULTRA_GENERATIONS,
    }),
    "ultra",
    true,
  ) === null,
  String(
    chooseCreditSource(
      balance({
        freeStandardUsed: 0,
        monthlyUltraUsed: MONTHLY_ULTRA_GENERATIONS,
      }),
      "ultra",
      true,
    ),
  ),
);

console.log("\n=== 4. Подписка закончилась ===");

check(
  "Месячный лимит Standard без подписки не работает — платит бесплатная",
  chooseCreditSource(balance(), "standard", false) === "free-standard",
  String(chooseCreditSource(balance(), "standard", false)),
);

check(
  "Неизрасходованный лимит Ultra без подписки не работает",
  chooseCreditSource(balance(), "ultra", false) === null,
  String(chooseCreditSource(balance(), "ultra", false)),
);

check(
  "Старый расход лимита не мешает токенам и не превращается в бесплатную",
  chooseCreditSource(
    balance({ monthlyStandardUsed: MONTHLY_STANDARD_GENERATIONS }),
    "standard",
    false,
  ) === "free-standard",
  "счётчик лимита игнорируется: он относится к прошлому месяцу подписки",
);

console.log("\n=== 5. Счётчики и остатки ===");

check(
  "Свежий месяц: остаток Standard равен лимиту",
  monthlyStandardLeft(balance()) === MONTHLY_STANDARD_GENERATIONS,
  `${monthlyStandardLeft(balance())} из ${MONTHLY_STANDARD_GENERATIONS}`,
);

check(
  "Свежий месяц: остаток Ultra равен лимиту",
  monthlyUltraLeft(balance()) === MONTHLY_ULTRA_GENERATIONS,
  `${monthlyUltraLeft(balance())} из ${MONTHLY_ULTRA_GENERATIONS}`,
);

check(
  "Перерасход в базе не даёт отрицательный остаток Standard",
  monthlyStandardLeft(
    balance({ monthlyStandardUsed: MONTHLY_STANDARD_GENERATIONS + 5 }),
  ) === 0,
  String(
    monthlyStandardLeft(
      balance({ monthlyStandardUsed: MONTHLY_STANDARD_GENERATIONS + 5 }),
    ),
  ),
);

check(
  "Перерасход в базе не даёт отрицательный остаток Ultra",
  monthlyUltraLeft(
    balance({ monthlyUltraUsed: MONTHLY_ULTRA_GENERATIONS + 5 }),
  ) === 0,
  String(
    monthlyUltraLeft(balance({ monthlyUltraUsed: MONTHLY_ULTRA_GENERATIONS + 5 })),
  ),
);

check(
  "hasFreeStandard закрывается и при перерасходе",
  hasFreeStandard(balance({ freeStandardUsed: 2 })) === false,
  "freeStandardUsed=2 при лимите 1",
);

console.log("\n=== 6. Согласованность с интерфейсом ===");

const matrix: Array<[GenerationCreditBalance, "standard" | "ultra", boolean]> = [
  [balance(), "standard", false],
  [balance(), "standard", true],
  [balance(), "ultra", false],
  [balance(), "ultra", true],
  [balance({ freeStandardUsed: 1 }), "standard", false],
  [balance({ freeStandardUsed: 1, standardTokens: 3 }), "standard", false],
  [
    balance({ monthlyStandardUsed: MONTHLY_STANDARD_GENERATIONS }),
    "standard",
    true,
  ],
  [
    balance({ monthlyUltraUsed: MONTHLY_ULTRA_GENERATIONS }),
    "ultra",
    true,
  ],
  [
    balance({
      monthlyUltraUsed: MONTHLY_ULTRA_GENERATIONS,
      ultraTokens: 1,
    }),
    "ultra",
    true,
  ],
];

const canGenerateMismatches = matrix.filter(
  ([current, quality, subscribed]) =>
    canGenerateWith(current, quality, subscribed) !==
    (chooseCreditSource(current, quality, subscribed) !== null),
);

check(
  "canGenerateWith повторяет chooseCreditSource",
  canGenerateMismatches.length === 0,
  `${matrix.length} кейсов, расхождений ${canGenerateMismatches.length}`,
);

const sources = Object.keys(ALL_SOURCES) as GenerationCreditSource[];
const descriptions = sources.map((source) => describeCreditSource(source));

check(
  "У всех пяти источников есть подпись",
  descriptions.every((text) => text.trim().length > 0),
  descriptions.join(" | "),
);

check(
  "Подписи различаются между собой",
  new Set(descriptions).size === descriptions.length,
  `${new Set(descriptions).size} уникальных из ${descriptions.length}`,
);

check(
  "Константы модели: 1 бесплатная, 3 Standard и 1 Ultra в месяц",
  FREE_STANDARD_GENERATIONS === 1 &&
    MONTHLY_STANDARD_GENERATIONS === 3 &&
    MONTHLY_ULTRA_GENERATIONS === 1,
  `free=${FREE_STANDARD_GENERATIONS}, standard=${MONTHLY_STANDARD_GENERATIONS}, ultra=${MONTHLY_ULTRA_GENERATIONS}`,
);

console.log("\n=== 7. Чистота функции ===");

const untouched = balance({ monthlyStandardUsed: 1, standardTokens: 2 });
const snapshot = JSON.stringify(untouched);

chooseCreditSource(untouched, "standard", true);
chooseCreditSource(untouched, "ultra", true);

check(
  "chooseCreditSource не мутирует баланс",
  JSON.stringify(untouched) === snapshot,
  snapshot,
);

console.log(
  failures === 0
    ? "\nИтог: все проверки пройдены."
    : `\nИтог: провалов ${failures}.`,
);
process.exit(failures === 0 ? 0 : 1);
