/**
 * Правила списания генераций 3D-моделей.
 *
 * Модуль чистый: здесь нет обращений к базе и `service_role`, поэтому его
 * импортируют и сервер, и клиентский компонент генератора. Одна функция
 * `chooseCreditSource` решает, что спишется за генерацию, и страница
 * `/3d-generator` показывает тот же ответ, что потом применит
 * `/api/generate-3d`. Дублировать порядок в разметке нельзя: подпись под
 * кнопкой разошлась бы со списанием.
 *
 * Модель:
 *   • зарегистрированный Free — 1 бесплатная генерация Standard навсегда;
 *   • подписка — 3 Standard и 1 Ultra в месяц (месяц календарный);
 *   • купленные пакеты — токены Standard и Ultra без срока и ограничений.
 *
 * Приоритет для Standard: месячный лимит подписки → бесплатная → токен.
 * Для Ultra: месячный лимит подписки → токен (бесплатных Ultra нет).
 */
import type { GeneratorQuality } from "@/lib/generator/photo-generator";

/** Сколько бесплатных Standard-генераций получает зарегистрированный. */
export const FREE_STANDARD_GENERATIONS = 1;

/** Месячный лимит Standard для действующей подписки. */
export const MONTHLY_STANDARD_GENERATIONS = 3;

/** Месячный лимит Ultra для действующей подписки. */
export const MONTHLY_ULTRA_GENERATIONS = 1;

/**
 * Что именно оплачивает генерация.
 *
 * Ключи приходят из базы, поэтому их не переименовываем: возврат после отказа
 * сети ищет счётчик по тому же значению, которое вернуло списание.
 */
export type GenerationCreditSource =
  | "monthly-standard"
  | "free-standard"
  | "standard-token"
  | "monthly-ultra"
  | "ultra-token";

/** Остатки и израсходованные лимиты одной строки `user_credits`. */
export type GenerationCreditBalance = {
  /** Сколько бесплатных Standard уже потрачено (лимит — 1). */
  freeStandardUsed: number;
  /** Сколько Standard списано в текущем месяце по подписке (лимит — 3). */
  monthlyStandardUsed: number;
  /** Сколько Ultra списано в текущем месяце по подписке (лимит — 1). */
  monthlyUltraUsed: number;
  /** Купленные токены Standard. */
  standardTokens: number;
  /** Купленные токены Ultra. */
  ultraTokens: number;
};

/** Пустой баланс: новый пользователь без подписки и покупок. */
export function createEmptyCreditBalance(): GenerationCreditBalance {
  return {
    freeStandardUsed: 0,
    monthlyStandardUsed: 0,
    monthlyUltraUsed: 0,
    standardTokens: 0,
    ultraTokens: 0,
  };
}

/** Сколько Standard-генераций подписки осталось в этом месяце. */
export function monthlyStandardLeft(
  balance: GenerationCreditBalance,
): number {
  return Math.max(
    MONTHLY_STANDARD_GENERATIONS - balance.monthlyStandardUsed,
    0,
  );
}

/** Сколько Ultra-генераций подписки осталось в этом месяце. */
export function monthlyUltraLeft(balance: GenerationCreditBalance): number {
  return Math.max(MONTHLY_ULTRA_GENERATIONS - balance.monthlyUltraUsed, 0);
}

/** Доступна ли ещё бесплатная Standard-генерация. */
export function hasFreeStandard(balance: GenerationCreditBalance): boolean {
  return balance.freeStandardUsed < FREE_STANDARD_GENERATIONS;
}

/**
 * Что спишется за генерацию выбранного качества.
 *
 * `null` — генерация не оплачена: для Ultra бесплатных нет, а подписка
 * закончилась или её месячный лимит уже исчерпан.
 *
 * Порядок строго из бизнес-модели: сначала месячный лимит подписки (он
 * сгорает 1-го числа), потом бесплатная (она не сгорает), последними — токены.
 * Токены не тратятся, пока есть более «короткий» ресурс.
 */
export function chooseCreditSource(
  balance: GenerationCreditBalance,
  quality: GeneratorQuality,
  hasSubscription: boolean,
): GenerationCreditSource | null {
  if (quality === "ultra") {
    if (
      hasSubscription &&
      balance.monthlyUltraUsed < MONTHLY_ULTRA_GENERATIONS
    ) {
      return "monthly-ultra";
    }

    return balance.ultraTokens > 0 ? "ultra-token" : null;
  }

  if (
    hasSubscription &&
    balance.monthlyStandardUsed < MONTHLY_STANDARD_GENERATIONS
  ) {
    return "monthly-standard";
  }

  if (hasFreeStandard(balance)) {
    return "free-standard";
  }

  return balance.standardTokens > 0 ? "standard-token" : null;
}

/** Хватает ли баланса на генерацию выбранного качества. */
export function canGenerateWith(
  balance: GenerationCreditBalance,
  quality: GeneratorQuality,
  hasSubscription: boolean,
): boolean {
  return chooseCreditSource(balance, quality, hasSubscription) !== null;
}

/** Подпись для интерфейса: чем именно будет оплачена генерация. */
export function describeCreditSource(
  source: GenerationCreditSource,
): string {
  switch (source) {
    case "monthly-standard":
      return "месячный лимит подписки (Standard)";
    case "free-standard":
      return "бесплатная генерация Standard";
    case "standard-token":
      return "токен Standard";
    case "monthly-ultra":
      return "месячный лимит подписки (Ultra)";
    case "ultra-token":
      return "токен Ultra";
  }
}
