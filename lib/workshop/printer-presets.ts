/**
 * Справочник принтеров Мастерской: модели, которые чаще всего стоят в домашних
 * мастерских, и базовые интервалы ТО из документации производителей.
 *
 * Часы — это наработка, после которой пора обслуживать узел:
 *   nozzleHours      — замена сопла и проверка экструдера;
 *   lubricationHours — смазка направляющих, 0 — смазывать нечего.
 * Ноль у Bambu Lab не забытое число: карбоновые стержни смазка портит, их
 * протирают спиртом, поэтому регламент смазки для X1 и P1S не задаётся.
 *
 * Список — подсказка при добавлении принтера, а не жёсткий регламент: износ
 * зависит от пластика, загрузки и помещения, поэтому интервалы в форме можно
 * поправить. `note` показываем рядом с выбранной моделью — человек видит, откуда
 * взялись числа и что именно нельзя делать.
 */
export type PrinterPreset = {
  brand: string;
  model: string;
  /** Наработка до обслуживания сопла и экструдера, ч. */
  nozzleHours: number;
  /** Наработка до смазки направляющих, ч; 0 — смазка не требуется. */
  lubricationHours: number;
  /** Особенность обслуживания этой модели — короткая подсказка под полем. */
  note: string;
};

export const PRINTER_PRESETS: readonly PrinterPreset[] = [
  {
    brand: "Bambu Lab",
    model: "X1 / X1C",
    nozzleHours: 400,
    lubricationHours: 0,
    note: "Карбоновые стержни X не смазывать, только чистить спиртом. Винт Z — каждые 3 мес.",
  },
  {
    brand: "Bambu Lab",
    model: "P1S",
    nozzleHours: 400,
    lubricationHours: 0,
    note: "Аналогично X1: карбоновые стержни без смазки.",
  },
  {
    brand: "Bambu Lab",
    model: "A1 / A1 mini",
    nozzleHours: 400,
    lubricationHours: 200,
    note: "Смазка рельса Y — ежемесячно.",
  },
  {
    brand: "Prusa",
    model: "MK3S+",
    nozzleHours: 500,
    lubricationHours: 500,
    note: "Смазка гладких стержней X/Y/Z каждые 500 ч.",
  },
  {
    brand: "Prusa",
    model: "MK4",
    nozzleHours: 500,
    lubricationHours: 500,
    note: "Проверки каждые 200 ч по мануалу.",
  },
  {
    brand: "Creality",
    model: "Ender-3 V3 / K1",
    nozzleHours: 500,
    lubricationHours: 500,
    note: "Официально: замена сопла каждые 500 ч. Авто-калибровка каждые 300 ч.",
  },
  {
    brand: "Anycubic",
    model: "Kobra (серия)",
    nozzleHours: 400,
    lubricationHours: 300,
    note: "Проверка ремней каждые 1–2 мес.",
  },
  {
    brand: "Elegoo",
    model: "Neptune 4 (серия)",
    nozzleHours: 400,
    lubricationHours: 300,
    note: "Официальных жёстких интервалов мало, ориентир — по износу.",
  },
  {
    brand: "Sovol",
    model: "SV06",
    nozzleHours: 400,
    lubricationHours: 300,
    note: "Регулярная чистка и смазка.",
  },
];
