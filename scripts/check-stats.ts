/**
 * Проверка сводных цифр сайта (SSOT).
 *
 * Запуск: `npm run check:stats` (или напрямую `node --import
 * ./scripts/register-alias.mjs scripts/check-stats.ts`).
 *
 * Что закрывает проверка:
 *   1. агрегаты `SITE_STATS` совпадают с первичными модулями;
 *   2. цены `PRICES` совпадают с `PAYMENT_PLANS` и дают ожидаемую выгоду;
 *   3. формы склонения работают на граничных числах;
 *   4. на витринах нет захардкоженных чисел и старого названия пакета;
 *   5. клиентские компоненты не тянут серверный `lib/stats`;
 *   6. ссылки `/artifacts/...` из курсов ведут на существующие файлы,
 *      а в `public/artifacts` нет файлов-сирот.
 *
 * Сеть и Supabase не нужны: читаются только данные репозитория.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { MODEL_TYPES } from "@/lib/constructor/model-types";
import {
  PAID_LEVELS,
  PAID_LESSONS,
  PAID_TESTS,
  PAID_VISUALS,
  TOTAL_LESSONS,
  TOTAL_QUESTIONS,
  TOTAL_VISUALS,
} from "@/lib/course-levels";
import {
  DEFECT_FORMS,
  MODEL_FORMS,
  PROFILE_FORMS,
  TOOL_FORMS,
  pluralize,
} from "@/lib/course-stats";
import { defects } from "@/lib/defects";
import { SUBSCRIPTION_PLAN, TOKEN_PACKS } from "@/lib/generation-plans";
import { getPaymentAmount } from "@/lib/payments";
import {
  profileCount,
  profileImportedCount,
  profileTestedCount,
} from "@/lib/profiles";
import {
  PRICES,
  SITE_STATS,
  STATS_LABELS,
  TOOL_COUNT,
  formatRub,
} from "@/lib/stats";

const ROOT = process.cwd();
const failures: string[] = [];
const warnings: string[] = [];

/** Фиксирует ошибку с понятным путём: где смотреть и что ждали. */
function fail(name: string, detail: string): void {
  failures.push(`${name}: ${detail}`);
}

/** Проверяет равенство и пишет, какие значения разошлись. */
function expectEqual(name: string, actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    fail(name, `получено ${String(actual)}, ожидалось ${String(expected)}`);
  }
}

/** Все файлы с нужным расширением внутри каталога. */
function walk(dir: string, extension: RegExp): string[] {
  const result: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      result.push(...walk(full, extension));
    } else if (extension.test(entry.name)) {
      result.push(full);
    }
  }

  return result;
}

/** Путь для сообщений: относительно корня и с прямыми слэшами. */
function rel(file: string): string {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

// 1. Агрегаты против первичных модулей.
expectEqual("SITE_STATS.models", SITE_STATS.models, MODEL_TYPES.length);
expectEqual("SITE_STATS.profiles", SITE_STATS.profiles, profileCount);
expectEqual("SITE_STATS.defects", SITE_STATS.defects, defects.length);
expectEqual("SITE_STATS.lessonsAll", SITE_STATS.lessonsAll, TOTAL_LESSONS);
expectEqual("SITE_STATS.lessonsPaid", SITE_STATS.lessonsPaid, PAID_LESSONS);
expectEqual("SITE_STATS.visualsAll", SITE_STATS.visualsAll, TOTAL_VISUALS);
expectEqual("SITE_STATS.visualsPaid", SITE_STATS.visualsPaid, PAID_VISUALS);
expectEqual("SITE_STATS.testsPaid", SITE_STATS.testsPaid, PAID_TESTS);
expectEqual("SITE_STATS.questionsAll", SITE_STATS.questionsAll, TOTAL_QUESTIONS);
expectEqual("SITE_STATS.tools", SITE_STATS.tools, TOOL_COUNT);
expectEqual(
  "SITE_STATS.profilesTested",
  SITE_STATS.profilesTested,
  profileTestedCount,
);
expectEqual(
  "SITE_STATS.profilesImported",
  SITE_STATS.profilesImported,
  profileImportedCount,
);

/** Уникальные файлы к урокам по всем платным уровням. */
const artifactsOnDisk = new Set(
  PAID_LEVELS.flatMap((level) => level.artifacts.map((artifact) => artifact.href)),
);
expectEqual(
  "SITE_STATS.artifactsPaid",
  SITE_STATS.artifactsPaid,
  artifactsOnDisk.size,
);

// 2. Цены и выгода.
const levelSum = PAID_LEVELS.reduce((sum, level) => sum + level.price, 0);
expectEqual("PRICES.bundle", PRICES.bundle, getPaymentAmount("pro"));
expectEqual(
  "PRICES.subscription",
  PRICES.subscription,
  getPaymentAmount("pro-subscription"),
);
expectEqual("PRICES.bundleSeparate", PRICES.bundleSeparate, levelSum);
expectEqual(
  "PRICES.bundleSaving",
  PRICES.bundleSaving,
  Math.max(levelSum - PRICES.bundle, 0),
);

for (const level of PAID_LEVELS) {
  expectEqual(
    `PRICES.levels.${level.key}`,
    PRICES.levels[level.key as keyof typeof PRICES.levels],
    getPaymentAmount(level.key as "confident" | "engineer" | "profit"),
  );
}

if (PRICES.bundle >= PRICES.bundleSeparate) {
  fail("PRICES", "пакет должен быть дешевле трёх курсов по отдельности");
}

if (PRICES.bundleSaving <= 0) {
  fail("PRICES.bundleSaving", "выгода пакета должна быть больше нуля");
}

if (PRICES.subscription <= 0) {
  fail("PRICES.subscription", "цена подписки должна быть больше нуля");
}

expectEqual(
  "PRICES.tokenPacks.standard.price",
  PRICES.tokenPacks.standard.price,
  TOKEN_PACKS.standard.price,
);
expectEqual(
  "PRICES.tokenPacks.ultra.price",
  PRICES.tokenPacks.ultra.price,
  TOKEN_PACKS.ultra.price,
);
expectEqual(
  "PRICES.generatorLimits.standardPerMonth",
  PRICES.generatorLimits.standardPerMonth,
  SUBSCRIPTION_PLAN.standardPerMonth,
);
expectEqual(
  "PRICES.generatorLimits.ultraPerMonth",
  PRICES.generatorLimits.ultraPerMonth,
  SUBSCRIPTION_PLAN.ultraPerMonth,
);

// 3. Склонение: 1, 2, 5, 11, 21, 111 — границы правил.
const PLURAL_CASES: {
  forms: readonly [string, string, string];
  count: number;
  expected: string;
}[] = [
  { forms: MODEL_FORMS, count: 1, expected: "модель" },
  { forms: MODEL_FORMS, count: 2, expected: "модели" },
  { forms: MODEL_FORMS, count: 5, expected: "моделей" },
  { forms: MODEL_FORMS, count: 11, expected: "моделей" },
  { forms: MODEL_FORMS, count: 21, expected: "модель" },
  { forms: MODEL_FORMS, count: 111, expected: "моделей" },
  { forms: PROFILE_FORMS, count: 223, expected: "профиля" },
  { forms: DEFECT_FORMS, count: 6, expected: "дефектов" },
  { forms: TOOL_FORMS, count: 5, expected: "инструментов" },
];

for (const testCase of PLURAL_CASES) {
  expectEqual(
    `pluralize(${testCase.count})`,
    pluralize(testCase.count, testCase.forms),
    testCase.expected,
  );
}

/** Подписи не должны содержать пустых значений и «undefined». */
for (const [name, label] of Object.entries(STATS_LABELS)) {
  if (!label || label.includes("undefined") || label.includes("NaN")) {
    fail(`STATS_LABELS.${name}`, `некорректная подпись «${label}»`);
  }
}

if (!STATS_LABELS.bundleSummary.includes(formatRub(PRICES.bundle))) {
  fail("STATS_LABELS.bundleSummary", "строка не содержит цену пакета");
}

// 4. Захардкоженные числа и старое название пакета на витринах.
const HARDCODE_FILES = [
  "app/page.tsx",
  "app/pricing/page.tsx",
  "app/subscription/page.tsx",
  "app/tools/page.tsx",
  "components/landing/ProBundleCard.tsx",
  "app/preview/generator/page.tsx",
  "app/preview/constructor/page.tsx",
];
const COUNT_PATTERN = /\b\d+\s+(модел|профил|дефект|урок|инструмент)/i;
const LEGACY_BUNDLE = "Всё включено";

for (const file of HARDCODE_FILES) {
  const lines = readFileSync(path.join(ROOT, file), "utf8").split(/\r?\n/);

  lines.forEach((line, index) => {
    if (COUNT_PATTERN.test(line)) {
      fail(
        `${file}:${index + 1}`,
        `захардкоженный счётчик «${line.trim()}» — берите STATS_LABELS`,
      );
    }

    if (line.includes(LEGACY_BUNDLE)) {
      fail(
        `${file}:${index + 1}`,
        "старое название пакета — используйте bundleTitle",
      );
    }
  });
}

const coursesJson = readFileSync(
  path.join(ROOT, "data/courses.json"),
  "utf8",
);

if (coursesJson.includes(LEGACY_BUNDLE)) {
  fail("data/courses.json", "старое название пакета — bundleTitle");
}

// 5. Клиентские компоненты не импортируют серверный lib/stats.
const sourceFiles = [
  ...walk(path.join(ROOT, "app"), /\.(ts|tsx)$/),
  ...walk(path.join(ROOT, "components"), /\.(ts|tsx)$/),
  ...walk(path.join(ROOT, "lib"), /\.(ts|tsx)$/),
];

for (const file of sourceFiles) {
  const text = readFileSync(file, "utf8");
  const head = text.split(/\r?\n/).slice(0, 3).join("\n");

  if (!head.includes("use client")) continue;

  if (text.includes("@/lib/stats")) {
    fail(rel(file), "клиентский компонент импортирует серверный lib/stats");
  }
}

// 6. Ссылки на файлы курсов и файлы-сироты.
const ARTIFACT_LINK = /\/artifacts\/[A-Za-z0-9_./-]+/g;
const referenced = new Map<string, string[]>();
const dataDir = path.join(ROOT, "data");

for (const name of readdirSync(dataDir).filter((entry) => entry.endsWith(".json"))) {
  const text = readFileSync(path.join(dataDir, name), "utf8");

  for (const match of text.matchAll(ARTIFACT_LINK)) {
    const href = match[0].replace(/[.,;:]+$/, "");
    const sources = referenced.get(href) ?? [];
    sources.push(name);
    referenced.set(href, sources);
  }
}

for (const [href, sources] of referenced) {
  if (!existsSync(path.join(ROOT, "public", href))) {
    fail("artifacts", `${href} указан в ${sources.join(", ")}, но файла нет`);
  }
}

const artifactsDir = path.join(ROOT, "public", "artifacts");

if (existsSync(artifactsDir)) {
  for (const file of walk(artifactsDir, /\.(md|csv|txt|cfg|ini|stl)$/)) {
    const href = `/artifacts/${path
      .relative(artifactsDir, file)
      .split(path.sep)
      .join("/")}`;

    if (!referenced.has(href)) {
      warnings.push(`${href} не упомянут ни в одном курсе`);
    }
  }

  for (const file of walk(artifactsDir, /\.stl$/)) {
    const bytes = readFileSync(file);
    const size = bytes.byteLength;

    if (size < 1024 || size > 300 * 1024) {
      fail(rel(file), `размер ${size} Б вне диапазона 1–300 КБ`);
      continue;
    }

    // Бинарный STL: 80 байт заголовка, число треугольников (uint32), затем по
    // 50 байт на грань. Если счётчик не сходится с размером, слайсер файл не
    // прочтёт — лучше узнать об этом здесь, а не от покупателя курса.
    const faces = size >= 84 ? bytes.readUInt32LE(80) : 0;

    if (size < 84 || 84 + faces * 50 !== size) {
      fail(
        rel(file),
        `заголовок STL не сходится: ${faces} треугольников при ${size} Б`,
      );
    }
  }
}

// Итог: сначала предупреждения, потом ошибки.
for (const warning of warnings) {
  console.warn(`  ⚠ ${warning}`);
}

if (failures.length > 0) {
  console.error(`\ncheck:stats — ошибок: ${failures.length}`);
  for (const failure of failures) {
    console.error(`  ✗ ${failure}`);
  }
  process.exit(1);
}

console.log(
  `check:stats — ок: ${STATS_LABELS.models}, ${STATS_LABELS.profiles}, ` +
    `${STATS_LABELS.lessonsPaid}, ${STATS_LABELS.artifactsPaid}, ` +
    `пакет ${formatRub(PRICES.bundle)} (${STATS_LABELS.bundleSaving}).`,
);

