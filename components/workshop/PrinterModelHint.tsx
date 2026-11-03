"use client";

import { isPrinterBrandModelPair } from "@/lib/workshop/printer-presets";

/**
 * Подсказка под полем «Модель» в формах принтера.
 *
 * Список моделей в подсказке — только модели выбранного бренда
 * (`printerModelOptions`), поэтому мастер должен видеть, почему список пуст и
 * почему вписанная модель не подходит: иначе он решит, что справочник сломан, и
 * впишет первую модель из головы.
 *
 * Тон `warn` — пара «бренд — модель» спорная: «FlashForge» и «K1C» рядом значат,
 * что проверка совместимости 3MF сверит файл с чужим профилем слайсера.
 *
 * `fallback` — обычная подсказка на случай, когда спорить не о чем: она
 * объясняет, что произойдёт при выборе модели из справочника. Компонент общий
 * для трёх окон — добавления принтера, карточки принтера и мастера подключения
 * фермы, — поэтому тексты и цвета здесь одни и те же.
 */

type PrinterModelHintProps = {
  /** Бренд, выбранный в форме: от него зависит и список, и проверка. */
  brand: string;
  /** Модель, вписанная в форму. */
  model: string;
  /** Модели выбранного бренда — ровно то, что попадает в `<datalist>`. */
  options: readonly string[];
  /** Подсказка, когда пара в порядке. */
  fallback?: string;
};

/**
 * Текст подсказки: сначала пустой список моделей бренда, потом чужая модель.
 *
 * Порядок важен. У бренда, которого нет в справочнике, список пуст всегда, и
 * совет «выберите из списка» там был бы издевательством.
 */
function modelHintMessage(
  brand: string,
  model: string,
  options: readonly string[],
  fallback?: string,
): { tone: "muted" | "warn"; text: string } | null {
  if (options.length === 0) {
    return {
      tone: "muted",
      text: brand
        ? `Моделей бренда «${brand}» в справочнике нет — впишите название так же, как в слайсере.`
        : "Сначала выберите бренд: у каждого бренда свой список моделей.",
    };
  }

  if (!isPrinterBrandModelPair(brand, model)) {
    return {
      tone: "warn",
      text: `«${model}» выпускает другой бренд: выберите модель из списка «${brand}».`,
    };
  }

  return fallback ? { tone: "muted", text: fallback } : null;
}

export function PrinterModelHint({
  brand,
  model,
  options,
  fallback,
}: PrinterModelHintProps) {
  const message = modelHintMessage(
    brand.trim(),
    model.trim(),
    options,
    fallback,
  );

  if (!message) {
    return null;
  }

  return (
    <p
      className={`mt-1.5 text-xs leading-relaxed ${
        message.tone === "warn" ? "text-amber-300" : "text-zinc-500"
      }`}
    >
      {message.text}
    </p>
  );
}
