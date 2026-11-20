/**
 * Сводные цифры и цены сайта: единственный источник для витрин.
 *
 * Модуль ничего не хранит: он считает значения из первичных данных
 * (`data/*.json`, `lib/course-levels.ts`, `lib/profiles.ts`, `lib/defects.ts`,
 * `lib/constructor/model-types.ts`, `lib/payments.ts`,
 * `lib/generation-plans.ts`). Страницы читают готовые строки отсюда, поэтому
 * смена цены или добавленный урок не требует правок в JSX.
 *
 * Модуль серверный: `lib/course-levels.ts` подтягивает `data/lessons.json`,
 * поэтому импортировать его из файлов с `"use client"` нельзя — числа в
 * клиентские компоненты передаются пропсами. Это проверяет `npm run check:stats`.
 */
import { FREE_CONSTRUCTOR_DOWNLOADS_PER_MONTH } from "@/lib/constructor/limits";
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
  FILE_FORMS,
  LESSON_FORMS,
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

/** Формы склонения счётчиков: 10 моделей, 223 профиля, 6 дефектов. */
export {
  MODEL_FORMS,
  PROFILE_FORMS,
  DEFECT_FORMS,
  TOOL_FORMS,
};

/** «6 дефектов» — число вместе со словом в правильной форме. */
export function withCount(
  count: number,
  forms: [string, string, string],
): string {
  return `${count} ${pluralize(count, forms)}`;
}

/** Цена в рублях с разделителями разрядов: 500 → «500», 1 486 → «1 486». */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat("ru-RU").format(price);
}

/** Цена с валютой: 2 990 → «2 990 ₽». */
export function formatRub(price: number): string {
  return `${formatPrice(price)} ₽`;
}

/**
 * Сколько инструментов в Центре инструментов.
 *
 * Четыре карточки каталога плюс Мастерская, у которой своя карточка с подпиской.
 * Число живёт здесь, чтобы `app/tools/page.tsx` не считал его своей копией.
 */
export const TOOL_COUNT = 5;

/** Сколько файлов к урокам лежит в платных уровнях. */
const PAID_ARTIFACTS = PAID_LEVELS.reduce(
  (sum, level) => sum + level.artifacts.length,
  0,
);

/** Сводные счётчики для витрин. */
export const SITE_STATS = {
  models: MODEL_TYPES.length,
  profiles: profileCount,
  defects: defects.length,
  /** Профили, проверенные реальной печатью (поле `testedAt`). */
  profilesTested: profileTestedCount,
  /** Профили, проверенные импортом в слайсер (поле `importedAt`). */
  profilesImported: profileImportedCount,
  lessonsAll: TOTAL_LESSONS,
  lessonsPaid: PAID_LESSONS,
  modulesPaid: PAID_LEVELS.reduce((sum, level) => sum + level.modules, 0),
  visualsAll: TOTAL_VISUALS,
  visualsPaid: PAID_VISUALS,
  testsPaid: PAID_TESTS,
  questionsAll: TOTAL_QUESTIONS,
  artifactsPaid: PAID_ARTIFACTS,
  tools: TOOL_COUNT,
  freeConstructorDownloads: FREE_CONSTRUCTOR_DOWNLOADS_PER_MONTH,
} as const;

/** Цена пакета и сумма трёх уровней по отдельности. */
const BUNDLE_PRICE = getPaymentAmount("pro");
const BUNDLE_SEPARATE = PAID_LEVELS.reduce(
  (sum, level) => sum + level.price,
  0,
);

/**
 * Цены сайта: те же числа, что уходят в Robokassa.
 *
 * `bundleSaving` считается здесь, а не на страницах: раньше `/subscription` и
 * карточка пакета выводили выгоду двумя независимыми расчётами.
 */
export const PRICES = {
  subscription: getPaymentAmount(SUBSCRIPTION_PLAN.courseId),
  bundle: BUNDLE_PRICE,
  bundleSeparate: BUNDLE_SEPARATE,
  bundleSaving: Math.max(BUNDLE_SEPARATE - BUNDLE_PRICE, 0),
  levels: {
    confident: getPaymentAmount("confident"),
    engineer: getPaymentAmount("engineer"),
    profit: getPaymentAmount("profit"),
  },
  tokenPacks: {
    standard: {
      price: TOKEN_PACKS.standard.price,
      quantity: TOKEN_PACKS.standard.quantity,
    },
    ultra: {
      price: TOKEN_PACKS.ultra.price,
      quantity: TOKEN_PACKS.ultra.quantity,
    },
  },
  generatorLimits: {
    freeStandard: SUBSCRIPTION_PLAN.freeStandardGenerations,
    standardPerMonth: SUBSCRIPTION_PLAN.standardPerMonth,
    ultraPerMonth: SUBSCRIPTION_PLAN.ultraPerMonth,
  },
} as const;

/** Готовые подписи для витрин: число уже согласовано со словом. */
export const STATS_LABELS = {
  models: withCount(SITE_STATS.models, MODEL_FORMS),
  profiles: withCount(SITE_STATS.profiles, PROFILE_FORMS),
  defects: withCount(SITE_STATS.defects, DEFECT_FORMS),
  tools: withCount(SITE_STATS.tools, TOOL_FORMS),
  lessonsPaid: withCount(SITE_STATS.lessonsPaid, LESSON_FORMS),
  artifactsPaid: withCount(SITE_STATS.artifactsPaid, FILE_FORMS),
  bundle: formatRub(PRICES.bundle),
  bundleSeparate: formatRub(PRICES.bundleSeparate),
  bundleSaving: `Выгода ${formatRub(PRICES.bundleSaving)}`,
  bundleSummary: `${formatRub(PRICES.bundle)} вместо ${formatRub(
    PRICES.bundleSeparate,
  )}`,
  subscription: formatRub(PRICES.subscription),
  profilesTested: `Проверено на печати: ${SITE_STATS.profilesTested}`,
  profilesImported: `Импортировано: ${SITE_STATS.profilesImported}`,
} as const;
