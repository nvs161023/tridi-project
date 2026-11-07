/**
 * Импорт логотипа heat-transfer: растр → контуры → SVG с одной `<path>`.
 *
 * Панель отдаёт сюда пиксели canvas, а не файл: `document` и `canvas` остаются
 * в `ParameterPanel.tsx`, поэтому модуль проверяется node-скриптом. Отличие от
 * брелока — в выходе и пороге: брелок рисует полосы `<rect>` по тёмному
 * силуэту, принт строит замкнутые контуры по прозрачности (альфа — это и есть
 * маска печати), а на яркость переходит только когда прозрачности в файле нет.
 *
 * Пропорции исходника сохраняются: рабочая сетка сжимает длинную сторону до
 * `HEAT_TRANSFER_GRID_MAX_PX`, но не обрезает кадр до квадрата. Масштаб в
 * миллиметры и переворот Y — в геометрии модели, не здесь.
 */

import type { Point2 } from "@/lib/constructor/prism-mesh";
import {
  checkRasterLimits,
  contourArea,
  contoursToSvgPath,
  coverageByAlpha,
  coverageByColor,
  hasTransparency,
  simplifyContour,
  strokeWidthHistogram,
  strokeWidthPercentile,
  thinStrokeShare,
  traceCoverageContours,
  type RasterLimitCode,
  type StrokeHistogram,
} from "@/lib/constructor/raster-to-contours";

/**
 * Тип гистограммы штрихов реэкспортируется ради панели: ей нужен только он,
 * и импортировать его отсюда короче, чем тянуть имя растрового модуля.
 */
export type { StrokeHistogram };

/** Лимит файла: больше — `FileReader` и canvas подвешивают слабый ноутбук. */
export const HEAT_TRANSFER_MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Стороны исходника. Мельче 128 px контур рассыпается в пятно. */
export const HEAT_TRANSFER_MIN_SIDE_PX = 128;

/** Крупнее 4096 px `getImageData` съедает 64 МБ на мобильном браузере. */
export const HEAT_TRANSFER_MAX_SIDE_PX = 4096;

/**
 * Рабочая сетка: длинная сторона сжимается до неё, мельче — не растягивается.
 *
 * 2048 px — не «на всякий случай»: на фикстуре с мелким текстом IoU вырос
 * 0.9900 → 0.9957, а подписи 21 px высотой перестают рассыпаться на рваные
 * пятна. Пиксель рабочей сетки при 200 мм принта равен 0.098 мм — вдвое мельче
 * сопла, поэтому край ложится ровно, а не «по клеточкам». `getImageData` на
 * 2048 × 683 (логотип 3:1) — это 5.6 МБ RGBA, мобильный браузер тянет.
 */
export const HEAT_TRANSFER_GRID_MAX_PX = 2048;

/**
 * Нижняя граница рабочей сетки: мелкий исходник растягивается до неё.
 *
 * Пикселей в файле от этого не прибавится, зато сглаженные переходы дают
 * субпиксельной трассировке точки опоры: контур выходит ровным, а не лестницей
 * по целым пикселям. Растяжение выше 4× (128 px → 512) размыло бы форму.
 */
export const HEAT_TRANSFER_GRID_MIN_PX = 512;

/**
 * Упрощение контура принта, px: втрое мельче, чем у брелока.
 *
 * Трассировка даёт дробные точки, и допуск 0.75 px срезал бы как раз те
 * полпикселя, которые делают край гладким. Предел точек всё равно удержит
 * разметку в разумных размерах.
 */
export const HEAT_TRANSFER_RDP_EPSILON_PX = 0.35;

/** Сколько раз удваивать допуск упрощения, пока разметка не влезет в пределы. */
const HEAT_TRANSFER_RDP_ATTEMPTS = 5;

/** Площадь контура, ниже которой это шум растра, а не деталь, px². */
const HEAT_TRANSFER_MIN_CONTOUR_AREA_PX = 1;

/**
 * Рекомендуемая длинная сторона: при 200 мм принта пиксель равен шагу сопла
 * 0.4 мм, мельче рисовать смысла нет.
 */
export const HEAT_TRANSFER_RECOMMENDED_SIDE_PX = 512;

/** Подсказка для мелкого исходника: печатать можно, но контур будет грубым. */
export const HEAT_TRANSFER_LOW_RESOLUTION_HINT =
  "Картинка мелкая: контур будет грубым. Лучше загрузить логотип от 512 px по длинной стороне.";

/** Подсказка, когда прозрачности нет и силуэт пришлось искать по цвету фона. */
export const HEAT_TRANSFER_NO_TRANSPARENCY_HINT =
  "Фон не прозрачный: силуэт построен по контрасту с фоном. Белые и светлые части логотипа останутся пустыми.";

/** Что известно о файле до чтения пикселей. */
export type HeatTransferSource = {
  fileName: string;
  /** MIME из `File.type`; у drag-and-drop может быть пустым. */
  mimeType: string;
  bytes: number;
  /** Стороны исходника в пикселях, не рабочей сетки. */
  width: number;
  height: number;
};

/** Почему файл не годится: текст собирает `heatTransferSourceError`. */
export type HeatTransferSourceCode =
  | "file_too_large"
  | "unsupported_type"
  | "image_too_small"
  | "image_too_large";

/** Почему из растра не вышел контур: текст собирает `heatTransferImportError`. */
export type HeatTransferImportCode = RasterLimitCode | "empty_mask";

/** Предупреждение успешного импорта: контур есть, но качество под вопросом. */
export type HeatTransferWarning = "no_transparency";

/** Результат импорта: либо SVG-строка, либо код причины. */
export type HeatTransferImport =
  | {
      ok: true;
      svg: string;
      warning: HeatTransferWarning | null;
      contourCount: number;
      pointCount: number;
      /**
       * Распределение толщины штрихов в пикселях рабочей сетки. Панель делит его
       * на ширину детали и говорит, при каком размере штрихи перестанут быть
       * тоньше сопла: качество печати зависит от миллиметров, а не от пикселей.
       */
      strokes: StrokeHistogram;
    }
  | { ok: false; code: HeatTransferImportCode };

/** Форматы, у которых есть альфа-канал. JPG отклоняется: он хранит только шум. */
const RASTER_MIME_TYPES: readonly string[] = ["image/png", "image/webp"];

/** Расширение проверяем тоже: drag-and-drop из проводника часто без MIME. */
const RASTER_FILE_NAME = /\.(png|webp)$/i;

/**
 * Размер рабочей сетки для трассировки.
 *
 * Длинная сторона сжимается до `HEAT_TRANSFER_GRID_MAX_PX`, короткая считается
 * по пропорции — в отличие от брелока кадр не обрезается до квадрата, иначе
 * логотип 3:1 пришёл бы квадратом. Мелкий исходник не растягивается: пикселей
 * больше не станет, только размоется край.
 */
export function heatTransferGridSize(
  width: number,
  height: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);

  if (!Number.isFinite(longest) || longest <= 0) {
    return { width: 1, height: 1 };
  }

  const target = Math.min(
    HEAT_TRANSFER_GRID_MAX_PX,
    Math.max(HEAT_TRANSFER_GRID_MIN_PX, longest),
  );
  const scale = target / longest;

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Проверяет файл и размеры исходника до чтения пикселей.
 *
 * `null` — можно рисовать в canvas. Проверки дешёвые и стоят первыми: читать
 * 6 МБ PNG ради сообщения «файл большой» незачем. Мелкий исходник (128–511 px)
 * не отклоняется: контур будет грубее, поэтому панель показывает
 * `HEAT_TRANSFER_LOW_RESOLUTION_HINT`.
 */
export function checkHeatTransferSource(
  source: HeatTransferSource,
): HeatTransferSourceCode | null {
  const supported =
    RASTER_MIME_TYPES.includes(source.mimeType.toLowerCase()) ||
    RASTER_FILE_NAME.test(source.fileName);

  if (!supported) {
    return "unsupported_type";
  }

  if (source.bytes > HEAT_TRANSFER_MAX_FILE_BYTES) {
    return "file_too_large";
  }

  const longest = Math.max(source.width, source.height);

  if (longest < HEAT_TRANSFER_MIN_SIDE_PX) {
    return "image_too_small";
  }

  if (longest > HEAT_TRANSFER_MAX_SIDE_PX) {
    return "image_too_large";
  }

  return null;
}

/**
 * Строит печатную разметку из пикселей рабочей сетки.
 *
 * Источник формы выбирается по содержимому: есть прозрачность — покрытие берётся
 * по альфе (`coverageByAlpha`), потому что дизайнер именно это нарисовал как
 * пластик. Если прозрачности нет (скриншот, WebP с белым фоном), покрытие
 * считается по расстоянию до цвета фона (`coverageByColor`), а не по порогу
 * яркости: только так середина сглаженного края попадает ровно на границу, без
 * сдвига внутрь и рваной кромки.
 *
 * Контур обводит `traceCoverageContours` — изолиния покрытия с линейной
 * интерполяцией. Край получается гладким, а не лестницей по пикселям растра.
 *
 * Упрощение адаптивное: сначала точное (`HEAT_TRANSFER_RDP_EPSILON_PX`), но
 * если точек больше предела `params_json`, допуск удваивается. Отказать в
 * импорте из-за плотной разметки хуже, чем отдать чуть более грубый, но
 * печатаемый контур. Совсем без площади контуры отбрасываются: треугольник из
 * трёх коллинеарных точек триангуляция всё равно выбросит.
 */
export function rasterToHeatTransferSvg(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): HeatTransferImport {
  if (width <= 0 || height <= 0) {
    return { ok: false, code: "empty_mask" };
  }

  const transparent = hasTransparency(pixels, width, height);
  const field = transparent
    ? coverageByAlpha(pixels, width, height)
    : coverageByColor(pixels, width, height);
  const traced = traceCoverageContours(field, width, height);

  if (traced.length === 0) {
    return { ok: false, code: "empty_mask" };
  }

  let epsilon = HEAT_TRANSFER_RDP_EPSILON_PX;
  let contours: Point2[][] = [];

  for (let attempt = 0; attempt < HEAT_TRANSFER_RDP_ATTEMPTS; attempt += 1) {
    contours = [];

    for (const contour of traced) {
      const simplified = simplifyContour(contour, epsilon);

      if (
        simplified.length >= 3 &&
        Math.abs(contourArea(simplified)) >=
          HEAT_TRANSFER_MIN_CONTOUR_AREA_PX
      ) {
        contours.push(simplified);
      }
    }

    if (contours.length === 0) {
      break;
    }

    const limit = checkRasterLimits(contours);

    if (limit === null) {
      break;
    }

    // Грубый допуск убирает точки, но не островки: если деталей больше предела,
    // упрощение не поможет и пользователю нужен ответ, а не пустая разметка.
    if (limit === "too_many_contours") {
      return { ok: false, code: limit };
    }

    epsilon *= 2;
  }

  if (contours.length === 0) {
    return { ok: false, code: "empty_mask" };
  }

  const limit = checkRasterLimits(contours);

  if (limit) {
    return { ok: false, code: limit };
  }

  const pathData = contoursToSvgPath(contours);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">` +
    `<path d="${pathData}"/></svg>`;
  const pointCount = contours.reduce(
    (total, contour) => total + contour.length,
    0,
  );

  return {
    ok: true,
    svg,
    warning: transparent ? null : "no_transparency",
    contourCount: contours.length,
    pointCount,
    strokes: strokeWidthHistogram(field, width, height),
  };
}

/** Тексты отказа по файлу: одна причина — одно действие. */
const SOURCE_ERRORS: Record<HeatTransferSourceCode, string> = {
  file_too_large:
    "Файл больше 5 МБ. Сохраните логотип в PNG 512–1024 px по длинной стороне: этого хватает.",
  unsupported_type:
    "Нужен PNG или WebP с прозрачным фоном. JPG не хранит прозрачность и даёт серую бахрому по краю.",
  image_too_small:
    "Картинка меньше 128 px по длинной стороне: контур рассыплется в пятно. Возьмите логотип от 512 px.",
  image_too_large:
    "Картинка больше 4096 px по длинной стороне. Уменьшите её до 1024 px: крупнее печатать всё равно нечем.",
};

/** Текст отказа по файлу для панели. */
export function heatTransferSourceError(code: HeatTransferSourceCode): string {
  return SOURCE_ERRORS[code];
}

/** Тексты отказа по растру: подсказывают, что делать с картинкой. */
const IMPORT_ERRORS: Record<HeatTransferImportCode, string> = {
  empty_mask:
    "На картинке нет контура: похоже, вся область прозрачная. Проверьте фон логотипа.",
  too_many_contours:
    "Слишком много отдельных деталей. Упростите логотип или возьмите файл с крупным силуэтом.",
  too_many_points:
    "Слишком сложный логотип: после упрощения осталось больше 20000 точек.",
};

/** Текст отказа по растру для панели. */
export function heatTransferImportError(code: HeatTransferImportCode): string {
  return IMPORT_ERRORS[code];
}

/**
 * Порог сопла, мм: тоньше пластик не встанет даже на идеальной сетке.
 *
 * То же число, что `HEAT_TRANSFER_MIN_PART_MM` в геометрии, но здесь оно
 * переведено в «сколько миллиметров должно быть у штриха на картинке».
 */
export const HEAT_TRANSFER_NOZZLE_MM = 0.4;

/**
 * Доля длины линий, с которой тонкие штрихи уже заметно портят печать, и
 * одновременно перцентиль для «тонких мест»: одна константа, чтобы подсказка и
 * совет по ширине не расходились.
 *
 * Два процента ловили иголки на кончиках букв и сглаженные засечки: в тестовом
 * логотипе это 1.25 px штрихи, из-за которых совет «увеличьте до 330 мм»
 * выходил при любой ширине. Пять процентов — это уже реальные тонкие линии и
 * подписи, а не артефакты сглаживания.
 */
const HEAT_TRANSFER_THIN_SHARE = 0.05;

/** Что можно сказать о печати логотипа по распределению штрихов. */
export type HeatTransferLegibility = {
  /** Толщина нижних 5 % скелета: тонкие места рисунка, мм. */
  thinMm: number;
  /** Доля длины линий тоньше сопла при текущей ширине. */
  thinShare: number;
  /** Ширина детали, при которой тонкие места дотянут до сопла, мм. */
  minWidthMm: number;
};

/**
 * Оценка печатной читаемости при заданной ширине детали.
 *
 * Пиксели рабочей сетки сами по себе ничего не значат: тот же логотип на 80 мм
 * получает штрихи вдвое тоньше, чем на 160 мм. Поэтому панель пересчитывает
 * гистограмму `rasterToHeatTransferSvg` в миллиметры при текущем значении
 * `heatTransferWidth` и честно говорит, влезает ли рисунок в сопло.
 *
 * Берутся «нижние 5 % длины линий», а не минимум: одна пылинка в пиксель не
 * должна давать совет увеличить деталь втрое, а тонкая подпись — должна.
 * Порог подсказки — тот же 5 %: если тоньше сопла меньше пяти процентов линий,
 * печать читается, и предупреждать не о чем.
 */
export function heatTransferLegibility(
  strokes: StrokeHistogram,
  gridWidth: number,
  widthMm: number,
): HeatTransferLegibility | null {
  if (gridWidth <= 0 || widthMm <= 0 || strokes.total === 0) {
    return null;
  }

  const mmPerPx = widthMm / gridWidth;
  const thinPx = strokeWidthPercentile(strokes, HEAT_TRANSFER_THIN_SHARE);
  const thinMm = thinPx * mmPerPx;
  const minWidthMm =
    thinPx > 0
      ? Math.ceil((HEAT_TRANSFER_NOZZLE_MM * gridWidth) / thinPx / 5) * 5
      : widthMm;

  return {
    thinMm,
    thinShare: thinStrokeShare(strokes, HEAT_TRANSFER_NOZZLE_MM / mmPerPx),
    minWidthMm: Math.max(widthMm, minWidthMm),
  };
}

/**
 * Подсказка про мелкие штрихи: `null`, если рисунок печатается как есть.
 *
 * Текст собирается здесь, а не в панели: числа и порог сопла живут в одном
 * модуле с импортом, и проверяются node-скриптом без браузера.
 */
export function heatTransferStrokeHint(
  legibility: HeatTransferLegibility | null,
): string | null {
  // Сравнение по миллиметрам, а не по доле: подсказка не должна говорить
  // «штрихи 0.45 мм тоньше сопла 0.4 мм» из-за округления бакетов.
  if (!legibility || legibility.thinMm >= HEAT_TRANSFER_NOZZLE_MM) {
    return null;
  }

  return (
    `Мелкие штрихи ${legibility.thinMm.toFixed(2)} мм — тоньше сопла ` +
    `${HEAT_TRANSFER_NOZZLE_MM} мм: подписи и линии заплывут. ` +
    `Увеличьте деталь до ${legibility.minWidthMm} мм по ширине.`
  );
}

