/**
 * Тарифы генераций 3D-моделей: подписка и пакеты токенов.
 *
 * Цены пакетов лежат в `data/generation-plans.json` — один источник для
 * витрины `/pricing`, кнопок Robokassa и чека 54-ФЗ. Цена подписки остаётся в
 * `data/courses.json` (`pro.subscriptionPrice`): она продаётся тем же товаром
 * `pro-subscription`, что и раньше, и второй копии цены быть не должно.
 *
 * Лимиты подписки импортируются из правил списания: витрина обещает ровно
 * столько генераций, сколько спишет `/api/generate-3d`.
 */
import plansData from "@/data/generation-plans.json";

import {
  FREE_STANDARD_GENERATIONS,
  MONTHLY_STANDARD_GENERATIONS,
  MONTHLY_ULTRA_GENERATIONS,
} from "@/lib/generator/generation-credits";

/** Подписка Pro: инструменты и месячные лимиты генераций. */
export const SUBSCRIPTION_PLAN = {
  /** Ключ товара в Robokassa (`Shp_course`). */
  courseId: "pro-subscription",
  title: "Подписка Pro",
  /** Сколько Standard-генераций доступно каждый месяц. */
  standardPerMonth: MONTHLY_STANDARD_GENERATIONS,
  /** Сколько Ultra-генераций доступно каждый месяц. */
  ultraPerMonth: MONTHLY_ULTRA_GENERATIONS,
  /** Бесплатная Standard-генерация, которая остаётся и без подписки. */
  freeStandardGenerations: FREE_STANDARD_GENERATIONS,
} as const;

/**
 * Пакеты токенов: разовая покупка, срок не истекает.
 *
 * `kind` — вид токена: Standard списывается за обычную генерацию, Ultra — за
 * ультра. `receiptTitle` уходит в чек, поэтому там есть количество.
 */
export const TOKEN_PACKS = {
  standard: {
    courseId: "standard-pack",
    kind: "standard",
    title: "Пакет Standard",
    price: plansData.standardPack.price,
    quantity: plansData.standardPack.quantity,
    receiptTitle: `Пакет Standard: ${plansData.standardPack.quantity} генераций`,
  },
  ultra: {
    courseId: "ultra-pack",
    kind: "ultra",
    title: "Пакет Ultra",
    price: plansData.ultraPack.price,
    quantity: plansData.ultraPack.quantity,
    receiptTitle: `Пакет Ultra: ${plansData.ultraPack.quantity} генераций`,
  },
} as const;

/** Один пакет токенов из каталога. */
export type TokenPack = (typeof TOKEN_PACKS)[keyof typeof TOKEN_PACKS];

/** Все пакеты в порядке витрины: сначала Standard, потом Ultra. */
export const TOKEN_PACK_LIST: readonly TokenPack[] = [
  TOKEN_PACKS.standard,
  TOKEN_PACKS.ultra,
];

/**
 * Пакет по ключу товара Robokassa.
 *
 * `null` — это не пакет токенов (курс или подписка), и вебхук обрабатывает
 * платёж по старым правилам.
 */
export function getTokenPack(courseId: string): TokenPack | null {
  return (
    TOKEN_PACK_LIST.find((pack) => pack.courseId === courseId) ?? null
  );
}
