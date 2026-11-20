/**
 * Проверка калькулятора себестоимости Мастерской.
 *
 * Запуск: `npm run check:calculator` (или напрямую `node --import
 * ./scripts/register-alias.mjs scripts/test-workshop-calculator.ts`).
 *
 * Главное правило, которое здесь закреплено: работа мастера считается по его
 * минутам, а не по часам печати. Раньше `labor = printHours × ставка`, и деталь
 * на 6 часов печати при 15 минутах работы стоила как 6 часов труда.
 *
 * Что проверяется:
 *   1. материал, электричество и амортизация считаются по формулам;
 *   2. `printingCost` равен сумме электричества и амортизации;
 *   3. работа зависит от `laborMinutes` и не меняется при изменении
 *      `printHours` — это и есть исправленный баг;
 *   4. себестоимость равна материалу + печати + работе;
 *   5. наценка 0 % даёт цену, равную себестоимости, 150 % — ×2,5;
 *   6. округление до копеек на каждом шаге;
 *   7. валидация полей: пусто, минус, верхняя граница и ноль минут.
 */
import {
  CALCULATOR_FIELDS,
  DEFAULT_MARKUP_PERCENT,
  calculateWorkshopCost,
  markupFactor,
  readCalculatorInput,
  type CalculatorFieldKey,
  type CalculatorInput,
} from "@/lib/workshop/calculator";
import { WORKSHOP_SETTINGS_DEFAULTS } from "@/lib/workshop/settings";

let failures = 0;

/** Сравнивает два числа и печатает расхождение. */
function check(name: string, actual: number, expected: number): void {
  if (Math.abs(actual - expected) > 0.0001) {
    console.error(`✗ ${name}: получено ${actual}, ожидалось ${expected}`);
    failures += 1;
  } else {
    console.log(`✓ ${name}`);
  }
}

/** Проверяет булево условие: для форм и разбора ошибок. */
function checkTrue(name: string, condition: boolean): void {
  if (condition) {
    console.log(`✓ ${name}`);
  } else {
    console.error(`✗ ${name}`);
    failures += 1;
  }
}

const settings = WORKSHOP_SETTINGS_DEFAULTS;

/** Базовый вход: 1 кг пластика, 2 часа печати, 15 минут мастера. */
const baseInput: CalculatorInput = {
  weightGrams: 1000,
  printHours: 2,
  plasticPricePerKg: 1500,
  laborMinutes: 15,
};

// 1. Строки себестоимости.
const base = calculateWorkshopCost(settings, baseInput, 0);

check("материал: 1 кг × 1 500 ₽", base.material, 1500);
check("электричество: 150 Вт × 2 ч × 5,5 ₽", base.electricity, 1.65);
check("амортизация: 2 ч × 10 ₽", base.depreciation, 20);
check("печать = электричество + амортизация", base.printingCost, 21.65);
check("работа: 15 мин × 300 ₽/ч", base.labor, 75);
check("себестоимость: материал + печать + работа", base.costPrice, 1596.65);

// 2. Наценка.
const zeroMarkup = calculateWorkshopCost(settings, baseInput, 0);
check("наценка 0 %: цена равна себестоимости", zeroMarkup.recommendedPrice, 1596.65);
check("наценка 0 %: прибыль ноль", zeroMarkup.profit, 0);

const defaultMarkup = calculateWorkshopCost(
  settings,
  baseInput,
  DEFAULT_MARKUP_PERCENT,
);
check(
  "наценка 150 %: коэффициент 2,5",
  markupFactor(DEFAULT_MARKUP_PERCENT),
  2.5,
);
check(
  "наценка 150 %: цена × 2,5",
  defaultMarkup.recommendedPrice,
  3991.63,
);
check("наценка 150 %: прибыль", defaultMarkup.profit, 2394.98);

// 3. Главное правило: труд не зависит от времени печати.
const longPrint = calculateWorkshopCost(
  settings,
  { ...baseInput, printHours: 6 },
  0,
);
check("6 часов печати: работа та же", longPrint.labor, base.labor);
check("6 часов печати: печать дороже", longPrint.printingCost, 64.95);
check("6 часов печати: себестоимость", longPrint.costPrice, 1639.95);

const noLabor = calculateWorkshopCost(
  settings,
  { ...baseInput, printHours: 6, laborMinutes: 0 },
  0,
);
check("0 минут мастера: работы нет", noLabor.labor, 0);
check(
  "0 минут мастера: часы печати работу не добавляют",
  noLabor.costPrice,
  noLabor.material + noLabor.printingCost,
);

// 4. Округление до копеек.
const rounded = calculateWorkshopCost(
  settings,
  {
    weightGrams: 333,
    printHours: 0.01,
    plasticPricePerKg: 1499,
    laborMinutes: 0,
  },
  0,
);
check("округление материала", rounded.material, 499.17);
check("округление электричества", rounded.electricity, 0.01);
check("округление амортизации", rounded.depreciation, 0.1);
check("округление печати", rounded.printingCost, 0.11);

// 5. Валидация полей.
const fieldKeys = CALCULATOR_FIELDS.map((field) => field.key);
checkTrue(
  "поле времени мастера есть в форме",
  fieldKeys.includes("laborMinutes"),
);
checkTrue(
  "поле времени мастера в минутах",
  CALCULATOR_FIELDS.find((field) => field.key === "laborMinutes")?.unit === "мин",
);

const emptyValues = Object.fromEntries(
  fieldKeys.map((key) => [key, ""]),
) as Record<CalculatorFieldKey, string>;

const empty = readCalculatorInput(emptyValues);
checkTrue("пустая форма: расчёта нет", empty.input === null);
check(
  "пустая форма: ошибка в каждом поле",
  Object.keys(empty.errors).length,
  fieldKeys.length,
);

const filled = readCalculatorInput({
  weightGrams: "120",
  printHours: "1.5",
  plasticPricePerKg: "1500",
  laborMinutes: "15",
});
checkTrue("заполненная форма: расчёт есть", filled.input !== null);
checkTrue(
  "заполненная форма: минуты мастера прочитаны",
  filled.input?.laborMinutes === 15,
);

const negative = readCalculatorInput({
  weightGrams: "120",
  printHours: "1.5",
  plasticPricePerKg: "1500",
  laborMinutes: "-1",
});
checkTrue(
  "минус в минутах мастера: ошибка поля",
  Boolean(negative.errors.laborMinutes),
);

const tooLong = readCalculatorInput({
  weightGrams: "120",
  printHours: "1.5",
  plasticPricePerKg: "1500",
  laborMinutes: "10081",
});
checkTrue(
  "больше недели: ошибка поля",
  Boolean(tooLong.errors.laborMinutes),
);

const zeroMinutes = readCalculatorInput({
  weightGrams: "120",
  printHours: "1.5",
  plasticPricePerKg: "1500",
  laborMinutes: "0",
});
checkTrue(
  "ноль минут допустим",
  zeroMinutes.input !== null && zeroMinutes.input.laborMinutes === 0,
);

console.log("");

if (failures > 0) {
  console.log(`Провалено проверок: ${failures}`);
  process.exitCode = 1;
} else {
  console.log("Все проверки прошли.");
}
