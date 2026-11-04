"use client";

import {
  isUnknownPrinterModel,
  UNLISTED_PRINTER_MODEL,
} from "@/lib/workshop/printers";

/**
 * Подсказка под полем «Модель» в формах принтера.
 *
 * Модель выбирают только из справочника (`printerModelOptions`): список в поле —
 * модели выбранного бренда, а вписать своё название нельзя. Мастер должен видеть,
 * почему список пуст и что будет, если модель не выбрана: иначе он решит, что
 * справочник сломан.
 *
 * Тон `warn` — модель не указана: проверка совместимости 3MF сверять файл не с
 * чем, и мастер узнает об этом при загрузке товара. Произвольного профиля здесь
 * не бывает вовсе: сервер отклоняет всё, чего нет в списке бренда.
 *
 * `fallback` — обычная подсказка на случай, когда спорить не о чем: она
 * объясняет, что интервалы ТО подставятся по справочнику. Компонент общий для
 * трёх окон — добавления принтера, карточки принтера и мастера подключения
 * фермы, — поэтому тексты и цвета здесь одни и те же.
 */

type PrinterModelHintProps = {
  /** Бренд, выбранный в форме: от него зависит список моделей. */
  brand: string;
  /** Модель, выбранная в форме. */
  model: string;
  /** Модели выбранного бренда — ровно то, что попадает в `<select>`. */
  options: readonly string[];
  /** Подсказка, когда модель выбрана из списка. */
  fallback?: string;
};

/**
 * Текст подсказки: сначала пустой список моделей бренда, потом «не указана».
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
        ? `Моделей бренда «${brand}» в справочнике нет: выберите «${UNLISTED_PRINTER_MODEL}» — произвольные профили мы не принимаем.`
        : "Сначала выберите бренд: у каждого бренда свой список моделей.",
    };
  }

  if (isUnknownPrinterModel(model)) {
    return {
      tone: "warn",
      text: `Модель не выбрана: проверка совместимости 3MF по профилю слайсера не сработает. Выберите модель из списка «${brand}» или оставьте «${UNLISTED_PRINTER_MODEL}».`,
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
        message.tone === "warn" ? "text-amber-300" : "text-zinc-400"
      }`}
    >
      {message.text}
    </p>
  );
}
