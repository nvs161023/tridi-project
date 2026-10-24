/**
 * Справочник принтеров Мастерской: модели, которые чаще всего стоят в домашних
 * мастерских, и базовые интервалы ТО из документации производителей.
 *
 * Часы — это наработка, после которой пора обслуживать узел:
 *   nozzleHours      — замена сопла и проверка экструдера;
 *   lubricationHours — смазка направляющих и рельсов, 0 — смазывать нечего;
 *   zScrewHours      — смазка винта (винтов) Z.
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
  /** Наработка до смазки винта Z, ч. */
  zScrewHours: number;
  /** Особенность обслуживания этой модели — короткая подсказка под полем. */
  note: string;
};

export const PRINTER_PRESETS: readonly PrinterPreset[] = [
  {
    brand: "Bambu Lab",
    model: "X1",
    nozzleHours: 400,
    lubricationHours: 0,
    zScrewHours: 720,
    note: "Карбоновые стержни X не смазывать, только чистить спиртом. Винт Z — каждые 720 ч.",
  },
  {
    brand: "Bambu Lab",
    model: "X1C",
    nozzleHours: 400,
    lubricationHours: 0,
    zScrewHours: 720,
    note: "Закрытая камера: стержни X чистить спиртом, без смазки. Винт Z — каждые 720 ч.",
  },
  {
    brand: "Bambu Lab",
    model: "P1S",
    nozzleHours: 400,
    lubricationHours: 0,
    zScrewHours: 720,
    note: "Аналогично X1: карбоновые стержни без смазки, винт Z — каждые 720 ч.",
  },
  {
    brand: "Bambu Lab",
    model: "A1",
    nozzleHours: 400,
    lubricationHours: 720,
    zScrewHours: 720,
    note: "Смазка рельса Y и винта Z — каждые 720 ч; стержни X чистить по мере пыли.",
  },
  {
    brand: "Bambu Lab",
    model: "A1 mini",
    nozzleHours: 400,
    lubricationHours: 720,
    zScrewHours: 720,
    note: "Компактная кинематика: рельс Y и винт Z смазывать каждые 720 ч.",
  },
  {
    brand: "Prusa",
    model: "MK4",
    nozzleHours: 500,
    lubricationHours: 500,
    zScrewHours: 500,
    note: "Смазка стержней X/Y и винта Z каждые 500 ч; ремни проверять чаще.",
  },
  {
    brand: "Prusa",
    model: "MK3S+",
    nozzleHours: 500,
    lubricationHours: 500,
    zScrewHours: 500,
    note: "Смазка гладких стержней X/Y/Z каждые 500 ч; следить за люфтом подшипников.",
  },
  {
    brand: "Creality",
    model: "Ender-3 V3",
    nozzleHours: 500,
    lubricationHours: 720,
    zScrewHours: 720,
    note: "Сопло 500 ч, смазка осей и винта Z — 720 ч; калибровать после вмешательства.",
  },
  {
    brand: "Creality",
    model: "K1",
    nozzleHours: 500,
    lubricationHours: 720,
    zScrewHours: 720,
    note: "Сопло 500 ч, смазка рельсов и винта Z — 720 ч; проверять натяжение ремней.",
  },
  {
    brand: "Creality",
    model: "K1 Max",
    nozzleHours: 500,
    lubricationHours: 720,
    zScrewHours: 720,
    note: "Большой портал: рельсы и винт Z смазывать каждые 720 ч, ремни — чаще.",
  },
  {
    brand: "Creality",
    model: "K1C",
    nozzleHours: 500,
    lubricationHours: 720,
    zScrewHours: 720,
    note: "Усиленный экструдер: сопло 500 ч, рельсы и винт Z — 720 ч.",
  },
  {
    brand: "Anycubic",
    model: "Kobra (серия)",
    nozzleHours: 400,
    lubricationHours: 500,
    zScrewHours: 720,
    note: "Сопло 400 ч, смазка осей 500 ч, винт Z 720 ч; ремни — раз в 1–2 месяца.",
  },
  {
    brand: "Elegoo",
    model: "Neptune 4 (серия)",
    nozzleHours: 400,
    lubricationHours: 500,
    zScrewHours: 720,
    note: "Официальных жёстких интервалов мало: ориентир по износу, винт Z — 720 ч.",
  },
  {
    brand: "Sovol",
    model: "SV06",
    nozzleHours: 400,
    lubricationHours: 500,
    zScrewHours: 720,
    note: "Смазка направляющих 500 ч, винт Z 720 ч; проверять люфт роликов.",
  },
  {
    brand: "Sovol",
    model: "SV07",
    nozzleHours: 400,
    lubricationHours: 500,
    zScrewHours: 720,
    note: "Рельсы и винт Z — по регламенту 500/720 ч; следить за натяжением ремней.",
  },
  {
    brand: "Artillery",
    model: "Sidewinder",
    nozzleHours: 500,
    lubricationHours: 500,
    zScrewHours: 720,
    note: "Смазка направляющих 500 ч, винт Z 720 ч; проверять эксцентрики каретки.",
  },
  {
    brand: "Voron",
    model: "2.4",
    nozzleHours: 1000,
    lubricationHours: 1000,
    zScrewHours: 1000,
    note: "Смазка рельсов и винтов Z каждые 1000 ч; ремни проверять заметно чаще.",
  },
  {
    brand: "Voron",
    model: "Trident",
    nozzleHours: 1000,
    lubricationHours: 1000,
    zScrewHours: 1000,
    note: "Три винта Z: смазка рельсов и винтов каждые 1000 ч, ремни — чаще.",
  },
];
