/**
 * Калькулятор себестоимости Мастерской.
 *
 * Формулы живут в одном месте, чтобы вкладка «Калькулятор» и будущие заказы
 * считали одинаково:
 *   материал      = вес / 1000 × цена за килограмм;
 *   электричество = мощность / 1000 × часы × цена кВт·ч;
 *   амортизация   = часы × амортизация за час;
 *   работа        = часы × стоимость часа;
 *   себестоимость = сумма четырёх строк;
 *   рекомендуемая цена = себестоимость × 2.5 (наценка 150 %).
 *
 * Округление до копеек делается на каждом шаге, а не только в конце: иначе
 * сумма строк в интерфейсе не совпадёт с итогом на копейку и пользователь
 * решит, что калькулятор ошибается.
 */
import {
  formatWorkshopLimit,
  parseWorkshopNumber,
  type WorkshopSettings,
} from "@/lib/workshop/settings";

/** Во сколько раз рекомендованная цена больше себестоимости. */
export const WORKSHOP_MARKUP = 2.5;
/** Наценка в процентах — для подписи под ценой. */
export const WORKSHOP_MARKUP_PERCENT = Math.round((WORKSHOP_MARKUP - 1) * 100);
/** Цена пластика по умолчанию: типичная катушка PLA 1 кг. */
export const DEFAULT_PLASTIC_PRICE_PER_KG = 1500;

/** Что вводит пользователь. Считается от веса, времени печати и цены пластика. */
export type CalculatorInput = {
  weightGrams: number;
  printHours: number;
  plasticPricePerKg: number;
};

export type CalculatorFieldKey = keyof CalculatorInput;

/** Поле ввода калькулятора: подпись, единица, пределы и шаг. */
export type CalculatorField = {
  key: CalculatorFieldKey;
  label: string;
  unit: string;
  placeholder: string;
  step: string;
  min: number;
  max: number;
};

/**
 * Поля расчёта. Верхние пределы щедрые, но конечные: защищают от опечатки
 * («1200000 г») и от деления на ноль в дальнейших этапах.
 */
export const CALCULATOR_FIELDS: readonly CalculatorField[] = [
  {
    key: "weightGrams",
    label: "Вес модели",
    unit: "г",
    placeholder: "120",
    step: "0.1",
    min: 0.1,
    max: 100000,
  },
  {
    key: "printHours",
    label: "Время печати",
    unit: "ч",
    placeholder: "1.5",
    step: "0.01",
    min: 0.01,
    max: 8760,
  },
  {
    key: "plasticPricePerKg",
    label: "Цена пластика за 1 кг",
    unit: "₽",
    placeholder: String(DEFAULT_PLASTIC_PRICE_PER_KG),
    step: "1",
    min: 0,
    max: 100000,
  },
];

/** Разбивка себестоимости: четыре строки, итог, цена и прибыль. */
export type CalculatorBreakdown = {
  material: number;
  electricity: number;
  depreciation: number;
  labor: number;
  costPrice: number;
  recommendedPrice: number;
  profit: number;
};

const moneyFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Деньги для интерфейса: «1 234,56 ₽». */
export function formatMoney(value: number): string {
  return moneyFormatter.format(value);
}

/** Копейки — предел точности: база хранит numeric(10, 2). */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Себестоимость заказа и рекомендованная цена.
 *
 * Настройки приходят из формы или из базы (уже нормализованные), входные числа
 * — из readCalculatorInput, поэтому здесь нет проверок: функция остаётся чистой
 * и её легко переиспользовать в заказах.
 */
export function calculateWorkshopCost(
  settings: WorkshopSettings,
  input: CalculatorInput,
): CalculatorBreakdown {
  const material = roundMoney(
    (input.weightGrams / 1000) * input.plasticPricePerKg,
  );
  const electricity = roundMoney(
    (settings.printerPowerW / 1000) *
      input.printHours *
      settings.electricityCostKwh,
  );
  const depreciation = roundMoney(
    input.printHours * settings.depreciationCostHour,
  );
  const labor = roundMoney(input.printHours * settings.laborCostHour);
  const costPrice = roundMoney(
    material + electricity + depreciation + labor,
  );
  const recommendedPrice = roundMoney(costPrice * WORKSHOP_MARKUP);
  const profit = roundMoney(recommendedPrice - costPrice);

  return {
    material,
    electricity,
    depreciation,
    labor,
    costPrice,
    recommendedPrice,
    profit,
  };
}

/**
 * Значения формы калькулятора → числа.
 *
 * Ошибки возвращаются по полям: пользователь видит, что именно исправить.
 * Если ошибок нет, input заполнен полностью — частичного расчёта не бывает.
 */
export function readCalculatorInput(
  values: Record<CalculatorFieldKey, string>,
): {
  input: CalculatorInput | null;
  errors: Partial<Record<CalculatorFieldKey, string>>;
} {
  const errors: Partial<Record<CalculatorFieldKey, string>> = {};
  const input: CalculatorInput = {
    weightGrams: 0,
    printHours: 0,
    plasticPricePerKg: 0,
  };

  for (const field of CALCULATOR_FIELDS) {
    const parsed = parseWorkshopNumber(values[field.key]);

    if (parsed === null) {
      errors[field.key] = "Введите число.";
      continue;
    }

    if (parsed < field.min || parsed > field.max) {
      errors[field.key] = `Допустимо от ${formatWorkshopLimit(field.min)} до ${formatWorkshopLimit(field.max)}.`;
      continue;
    }

    input[field.key] = parsed;
  }

  return Object.keys(errors).length > 0
    ? { input: null, errors }
    : { input, errors };
}
