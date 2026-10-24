/**
 * Разбор G-code: время печати и вес пластика из комментариев слайсера.
 *
 * Файл читается в браузере (`file.text()`), поэтому модуль не тянет ни базу, ни
 * серверные зависимости — его можно импортировать в клиентский компонент.
 *
 * Слайсеры пишут оценки по-разному, и единого стандарта нет:
 *   PrusaSlicer  `; estimated printing time (normal mode) = 1h 6m 12s`,
 *                `; filament used [g] = 12.34`, `; filament used [mm] = 4970.20`;
 *   Orca/Bambu   `; total estimated time: 1h 6m 12s`;
 *   Cura         `;TIME:3721`, `;Filament used: 3.45m`.
 * Поэтому время и вес ищутся набором шаблонов от точных к общим, а значение
 * разбирается отдельно: строка «1h 6m 12s», «00:30:00» и «3721» — это одно и то
 * же время в разных единицах.
 *
 * Единицы, о которых нужно помнить:
 *   - время без единиц измерения считается секундами (`;TIME:` и
 *     `;TIME_PRINTING:` у Cura и PrusaSlicer — секунды);
 *   - вес без единиц измерения считается граммами (`; filament used [g]`);
 *   - длина в метрах или миллиметрах переводится в граммы по PLA 1,75 мм:
 *     площадь сечения π × (1,75 / 2)² ≈ 2,41 мм², при плотности 1,24 г/см³ это
 *     ≈ 2,98 г на метр. Для PETG и ABS погрешность в пределах 10 %, но лучше
 *     показать прикидку, чем ничего: пользователь всё равно проверит остаток.
 */

/** Оценка, которую забирает калькулятор Мастерской. */
export type GcodeEstimate = {
  /** Время печати в часах с точностью до сотых; null — в файле не нашли. */
  timeHours: number | null;
  /** Вес пластика в граммах с точностью до десятых; null — не нашли. */
  weightGrams: number | null;
};

/**
 * Сколько граммов в метре прутка PLA 1,75 мм.
 * π × (1,75 / 2)² × 1000 мм × 1,24 г/см³ ≈ 2,98 г.
 */
export const GCODE_GRAMS_PER_METER = 2.98;

/** Шаблоны времени: от точных комментариев слайсеров к общим. */
const TIME_PATTERNS: readonly RegExp[] = [
  /^;\s*TIME_PRINTING:\s*(.+)$/im,
  /^;\s*estimated printing time[^\n=]*=\s*(.+)$/im,
  /^;\s*total estimated time:\s*(.+)$/im,
  /^;\s*model printing time:\s*(.+)$/im,
  /^;\s*TIME:\s*(.+)$/im,
];

/** Шаблоны веса: граммы в приоритете, длина — как резервный вариант. */
const WEIGHT_PATTERNS: readonly { pattern: RegExp; unit: "g" | "mm" }[] = [
  {
    pattern: /^;\s*total filament used \[g\]\s*=\s*(.+)$/im,
    unit: "g",
  },
  {
    pattern: /^;\s*filament used \[g\]\s*=\s*(.+)$/im,
    unit: "g",
  },
  {
    pattern: /^;Filament used:\s*(.+)$/im,
    unit: "g",
  },
  {
    pattern: /^;\s*total filament used \[mm\]\s*=\s*(.+)$/im,
    unit: "mm",
  },
  {
    pattern: /^;\s*filament used \[mm\]\s*=\s*(.+)$/im,
    unit: "mm",
  },
];

/**
 * Время из комментария слайсера, в часах.
 *
 * Понимает «1h 6m 12s», «1 ч 6 мин», «1d 2h», «00:30:00» (ч:м:с), «45:00»
 * (м:с) и просто число — его слайсеры пишут в секундах. Русские сокращения
 * встречаются в переводах слайсеров, поэтому учитываются наравне с латинскими.
 */
export function parseGcodeTime(raw: string): number | null {
  const text = raw.trim().toLowerCase();

  if (!text) {
    return null;
  }

  const seconds =
    readColonTime(text) ?? readUnitTime(text) ?? readPlainSeconds(text);

  if (seconds === null || seconds <= 0) {
    return null;
  }

  const hours = Math.round((seconds / 3600) * 100) / 100;

  return hours > 0 ? hours : null;
}

/**
 * Вес из комментария слайсера, в граммах.
 *
 * Значение может быть списком по экструдерам («12.34, 0.66») — такие числа
 * складываются. Единица ищется в самом значении («12.3g», «3.45m»); если её
 * там нет, берётся подсказка из комментария: у `; filament used [mm]` единица
 * стоит в подписи, а число приходит голым.
 */
export function parseGcodeWeight(
  raw: string,
  fallbackUnit: string = "g",
): number | null {
  const text = raw.trim();

  if (!text) {
    return null;
  }

  const numbers = text.match(/\d+(?:[.,]\d+)?/g);

  if (!numbers || numbers.length === 0) {
    return null;
  }

  const sum = numbers.reduce(
    (total, value) => total + Number(value.replace(",", ".")),
    0,
  );

  if (!Number.isFinite(sum) || sum <= 0) {
    return null;
  }

  // Единица — первое слово в значении: «12.3g», «3.45m». Список по экструдерам
  // пишется как «3.45m, 0.00m», и склейка всех букв дала бы «mm» — неверный
  // перевод в граммы. Голое число берёт единицу из подписи комментария.
  const unitMatch = text.match(/[a-zа-яё]+/i);
  const unit = (unitMatch ? unitMatch[0] : fallbackUnit).toLowerCase();
  const grams = convertToGrams(sum, unit);

  if (grams === null || grams <= 0) {
    return null;
  }

  return Math.round(grams * 10) / 10;
}

/**
 * Оценка по содержимому файла.
 *
 * Файл целиком не разбирается построчно: каждый шаблон ищет первое совпадение
 * по всему тексту, поэтому 50-мегабайтный G-code обрабатывается так же быстро,
 * как маленький. Отсутствующие значения остаются null — калькулятор заполнит
 * только то, что нашлось.
 */
export function parseGcode(fileContent: string): GcodeEstimate {
  const timeRaw = findFirstComment(fileContent, TIME_PATTERNS);
  const weightMatch = findFirstWeight(fileContent);

  return {
    timeHours: timeRaw === null ? null : parseGcodeTime(timeRaw),
    weightGrams:
      weightMatch === null
        ? null
        : parseGcodeWeight(weightMatch.value, weightMatch.unit),
  };
}

/** Первое совпадение по шаблонам веса вместе с единицей из подписи. */
function findFirstWeight(
  content: string,
): { value: string; unit: "g" | "mm" } | null {
  for (const { pattern, unit } of WEIGHT_PATTERNS) {
    const match = content.match(pattern);

    if (match) {
      const value = match[1].trim();

      if (value) {
        return { value, unit };
      }
    }
  }

  return null;
}

/** Первое совпадение по набору шаблонов: значение без перевода строки. */
function findFirstComment(
  content: string,
  patterns: readonly RegExp[],
): string | null {
  for (const pattern of patterns) {
    const match = content.match(pattern);

    if (match) {
      const value = match[1].trim();

      if (value) {
        return value;
      }
    }
  }

  return null;
}

/** «00:30:00» → 1800 с, «45:00» → 2700 с. */
function readColonTime(text: string): number | null {
  const match = text.match(/(\d+):(\d{1,2})(?::(\d{1,2}))?/);

  if (!match) {
    return null;
  }

  const first = Number(match[1]);
  const second = Number(match[2]);
  const third = match[3] === undefined ? null : Number(match[3]);

  return third === null
    ? first * 60 + second
    : first * 3600 + second * 60 + third;
}

/**
 * «1h 6m 12s» → секунды.
 *
 * Регулярка требует границу после единицы (`(?![a-zа-я])`), иначе «min»
 * разобралось бы как «m» плюс мусор. Дни слайсеры почти не пишут, но
 * поддержать их дешевле, чем потом удивляться «1d 2h» = null.
 */
function readUnitTime(text: string): number | null {
  const pattern =
    /(\d+(?:[.,]\d+)?)\s*(days?|d|hours?|hrs?|h|minutes?|mins?|min|m|seconds?|secs?|sec|s|д|ч|мин|м|сек|с)(?![a-zа-я])/g;

  let total = 0;
  let matched = false;

  for (const match of text.matchAll(pattern)) {
    const value = Number(match[1].replace(",", "."));

    if (!Number.isFinite(value)) {
      continue;
    }

    total += value * unitSeconds(match[2]);
    matched = true;
  }

  return matched ? total : null;
}

/** Голое число в комментарии времени: слайсеры пишут секунды. */
function readPlainSeconds(text: string): number | null {
  const match = text.match(/^(\d+(?:[.,]\d+)?)$/);

  if (!match) {
    return null;
  }

  const value = Number(match[1].replace(",", "."));

  return Number.isFinite(value) ? value : null;
}

/** Сколько секунд в единице измерения сокращения. */
function unitSeconds(unit: string): number {
  if (unit === "d" || unit.startsWith("day") || unit === "д") {
    return 86400;
  }

  if (
    unit === "h" ||
    unit.startsWith("hour") ||
    unit.startsWith("hr") ||
    unit === "ч"
  ) {
    return 3600;
  }

  if (unit === "s" || unit.startsWith("sec") || unit === "с") {
    return 1;
  }

  // Остались минуты: m, min, minute, мин, м.
  return 60;
}

/** Число в единицах слайсера → граммы; неизвестная единица — null. */
function convertToGrams(value: number, unit: string): number | null {
  if (
    unit === "" ||
    unit === "g" ||
    unit === "г" ||
    unit === "gram" ||
    unit === "grams"
  ) {
    return value;
  }

  if (unit === "kg" || unit === "кг") {
    return value * 1000;
  }

  if (unit === "mg" || unit === "мг") {
    return value / 1000;
  }

  if (unit === "m" || unit === "м") {
    return value * GCODE_GRAMS_PER_METER;
  }

  if (unit === "mm" || unit === "мм") {
    return (value * GCODE_GRAMS_PER_METER) / 1000;
  }

  return null;
}
