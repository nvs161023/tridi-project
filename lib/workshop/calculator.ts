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
 *   рекомендуемая цена = себестоимость × (1 + наценка / 100).
 *
 * Наценку мастер вводит сам: по умолчанию 150 % (цена × 2,5), 0 % — продажа по
 * себестоимости. Значение живёт в состоянии вкладки, колонки в
 * `workshop_settings` для него нет, поэтому база не меняется.
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

/** Наценка по умолчанию: 150 % — цена в два с половиной раза больше себестоимости. */
export const DEFAULT_MARKUP_PERCENT = 150;
/** Нижний предел: отрицательная наценка продавала бы дешевле себестоимости. */
export const MARKUP_PERCENT_MIN = 0;
/** Верхний предел: защита от опечатки — «1500 %» дало бы цену × 16. */
export const MARKUP_PERCENT_MAX = 1000;
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

/** Поле «Наценка (%)»: подпись, единица, пределы и шаг — как у полей расчёта. */
export type CalculatorMarkupField = {
  label: string;
  unit: string;
  placeholder: string;
  step: string;
  min: number;
  max: number;
};

/**
 * Наценка живёт отдельно от `CALCULATOR_FIELDS`: она не входит в
 * себестоимость, а только умножает её, поэтому и разбирается своей функцией.
 */
export const MARKUP_FIELD: CalculatorMarkupField = {
  label: "Наценка (%)",
  unit: "%",
  placeholder: String(DEFAULT_MARKUP_PERCENT),
  step: "1",
  min: MARKUP_PERCENT_MIN,
  max: MARKUP_PERCENT_MAX,
};

/** Коэффициент к себестоимости: 150 % → 2,5, 0 % → 1. */
export function markupFactor(percent: number): number {
  return 1 + percent / 100;
}

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
 * Наценка из поля формы → число.
 *
 * Отрицательная наценка запрещена: это продажа ниже себестоимости, и такая
 * опечатка не должна попадать в расчёт. `percent: null` значит «введённое не
 * применяем»: карточка считает по последнему верному значению, а под полем
 * видна ошибка.
 */
export function readMarkupPercent(value: unknown): {
  percent: number | null;
  error: string | null;
} {
  const parsed = parseWorkshopNumber(value);

  if (parsed === null) {
    return { percent: null, error: "Введите наценку числом." };
  }

  const percent = Math.round(parsed * 100) / 100;

  if (percent < MARKUP_PERCENT_MIN) {
    return { percent: null, error: "Наценка не может быть отрицательной." };
  }

  if (percent > MARKUP_PERCENT_MAX) {
    return {
      percent: null,
      error: `Допустимо от ${formatWorkshopLimit(MARKUP_PERCENT_MIN)} до ${formatWorkshopLimit(MARKUP_PERCENT_MAX)} %.`,
    };
  }

  return { percent, error: null };
}

/**
 * Себестоимость заказа и рекомендованная цена.
 *
 * Настройки приходят из формы или из базы (уже нормализованные), входные числа
 * — из readCalculatorInput, поэтому здесь нет проверок: функция остаётся чистой
 * и её легко переиспользовать в заказах. Наценка — процент над себестоимостью:
 * 150 % дают цену × 2,5, 0 % — цену, равную себестоимости.
 */
export function calculateWorkshopCost(
  settings: WorkshopSettings,
  input: CalculatorInput,
  markupPercent: number = DEFAULT_MARKUP_PERCENT,
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
  const recommendedPrice = roundMoney(costPrice * markupFactor(markupPercent));
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
