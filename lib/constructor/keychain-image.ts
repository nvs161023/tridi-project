import { ExtrudeGeometry } from "three";
import type { BufferGeometry } from "three";

/**
 * Префикс и предел длины `imageData` живут в `params.ts`: там же нормализация
 * проверяет поле, и одна константа на всех не даст панели сохранить маску,
 * которую геометрия потом не узнает.
 */
import {
  isKeychainImageData,
  KEYCHAIN_IMAGE_MAX_LENGTH,
  KEYCHAIN_IMAGE_PREFIX,
} from "@/lib/constructor/params";
import {
  buildFaceMask,
  findWidestBand,
  keychainRotatedSize,
  rectFits,
  KEYCHAIN_TEXT_EMBED_MM,
  type FaceMask,
  type KeychainTextKeepOut,
  type KeychainTextSide,
} from "@/lib/constructor/keychain-text";
import {
  binarizeByLuminance,
  checkRasterLimits,
  contourArea,
  contoursToSvgPath,
  hasTransparency,
  simplifyContour,
  traceCoverageContours,
  type RasterLimitCode,
} from "@/lib/constructor/raster-to-contours";
import { buildShapes, groupContours } from "@/lib/constructor/shape-utils";
import {
  parseSvgOutline,
  type OutlinePoint,
} from "@/lib/constructor/svg-outline";

/**
 * Картинка на брелоке: маска из PNG/JPG, её место на грани и рельеф.
 *
 * Панель переводит загруженный файл в маску и хранит её в `params.imageData` как
 * SVG в base64. Почему SVG, а не PNG: сервер и предпросмотр собирают геометрию
 * одним кодом, а разбор SVG в проекте уже есть (`svg-outline.ts`) и работает без
 * DOM. Своего декодера PNG на сервере нет, а тянуть бинарный растр через
 * `params_json` незачем — контуры маски занимают единицы килобайт.
 *
 * Маска живёт в двух видах: контуры идут в выдавливание, растровая маска по тому
 * же габариту — в проверку места. Так рельеф и проверка всегда говорят об одной
 * картинке: точка печатается там, где маска считает её тёмной.
 *
 * Место ищется по карте грани 0.4 мм — той же, что у надписи. Отверстие под
 * кольцо, кромка силуэта, полость кармана NFC и буквы блокируют ячейки, поэтому
 * картинка не выходит за брелок и не наезжает на имя. Запрошенный масштаб — не
 * приказ: если места мало, картинка ужимается шагом сетки, и отчёт об этом
 * уходит в интерфейс.
 */

/** Растр загрузки: картинка уменьшается до этого квадрата перед обводкой. */
export const KEYCHAIN_IMAGE_GRID = 96;

/** Разрешение маски проверки: та же сотня пикселей по большей стороне. */
const MASK_PIXELS = 96;

/**
 * Зазор между рельефами на одной грани, мм.
 *
 * Экспортируется: зазор ставит общий конвейер декораций
 * (`keychain-geometry.ts`), когда вычитает уже placed рельеф из карты грани.
 * Вплотную рельефы слиплись бы в одно пятно при печати.
 */
export const KEYCHAIN_DECORATION_GAP_MM = 0.8;

/** Минимальная полоса под картинку, мм: мельче логотип не читается. */
const IMAGE_MIN_BAND_MM = 4;

/** Ниже этой доли запрошенного масштаба картинка уже не логотип, а точка. */
const IMAGE_MIN_SCALE_SHARE = 0.25;

/** Шаг подгонки масштаба: 5% от базового размера за попытку. */
const IMAGE_SCALE_STEP = 0.05;

/** Сколько разобранных картинок держим в памяти: слайдер зовёт сборку часто. */
const BUILD_CACHE_LIMIT = 4;

/** Почему из файла не вышло маски. */
export type KeychainImageError = "empty" | RasterLimitCode;

/**
 * Текст отказа для панели.
 *
 * Коды ошибок общие с растеризацией своего контура, поэтому объяснение живёт
 * рядом с переводом картинки в маску: панель не повторяет формулировки и не
 * расходится с ними, когда пределы растра поменяются.
 */
export function keychainImageErrorText(error: KeychainImageError): string {
  if (error === "empty") {
    return "На картинке не нашлось рисунка. Нужен логотип на прозрачном или светлом фоне: рельефом становится тёмное и непрозрачное.";
  }

  if (error === "too_many_contours") {
    return "Слишком много отдельных пятен. Загрузите логотип с крупным силуэтом без мелкой крошки.";
  }

  return "Слишком подробная картинка. Упростите логотип: мелкие штрихи на брелоке всё равно сольются.";
}

/**
 * Маска, готовая к постановке.
 *
 * `contours` центрированы в нуле и приведены к единичному габариту: большая
 * сторона картинки равна 1, поэтому размер в миллиметрах — это просто `size`.
 */
export type KeychainImageBuild = {
  contours: OutlinePoint[][];
  /** Габарит маски в единичных координатах: границы нужны маске проверки. */
  frame: { height: number; minX: number; minY: number; width: number };
  /** Растр маски по габариту: по нему проверяется пересечение с препятствиями. */
  mask: { bits: Uint8Array; height: number; width: number };
  /** Сторона пикселя маски в единичных координатах. */
  pixel: number;
};

/** Результат постановки: центр, размер и во что превратился запрос. */
export type KeychainImagePlacement = {
  centerX: number;
  centerY: number;
  /** Большая сторона картинки, мм. */
  size: number;
  /** Запрошенный масштаб из панели. */
  requested: number;
  /** Фактический масштаб: меньше запрошенного, если пришлось ужиматься. */
  actual: number;
  side: KeychainTextSide;
};

/**
 * Что получилось из картинки в модели: по этим числам панель предупреждает.
 *
 * `side = null` значит, что картинка на брелок не встала: места нет ни на лице,
 * ни на обороте. `actual < requested` — картинка ужалась ради букв или кромки.
 */
export type KeychainImageFit = {
  requested: number;
  actual: number;
  side: KeychainTextSide | null;
  /** Большая сторона вставшей картинки, мм: 0, если она не встала. */
  size: number;
};

/** Декодированные маски по строке `imageData`: сборка идёт на каждый параметр. */
const buildCache = new Map<string, KeychainImageBuild | null>();

/**
 * Маска файла: рельеф — тёмные пиксели, а у картинки с прозрачным фоном —
 * непрозрачные.
 *
 * Правило выбора простое. У PNG-логотипа фон прозрачный, и яркость там не значит
 * ничего: силуэт задаёт альфа. У фото и JPG прозрачности нет, поэтому рельеф
 * ищется по яркости — тёмное считается рисунком, светлое фоном.
 */
function keychainImageMask(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array | null {
  if (width < 2 || height < 2) {
    return null;
  }

  if (hasTransparency(pixels, width, height)) {
    const total = width * height;
    const mask = new Uint8Array(total);

    for (let index = 0; index < total; index += 1) {
      mask[index] = pixels[index * 4 + 3] >= 128 ? 1 : 0;
    }

    return mask;
  }

  return binarizeByLuminance(pixels, width, height);
}

/** Сколько пикселей маски закрашено: пустая маска — не картинка. */
function maskInk(mask: Uint8Array): number {
  let ink = 0;

  for (const value of mask) {
    ink += value;
  }

  return ink;
}

/**
 * Переводит пиксели файла в `imageData`.
 *
 * Шаги те же, что у своего контура брелока: бинаризация, обводка изолинии
 * marching squares и упрощение Дугласа—Пекера. Поэтому край маски после печати
 * получается ровным, а не лестницей из пикселей. Пустая маска и слишком
 * подробный рисунок возвращают код ошибки: панель покажет его вместо превью.
 */
export function keychainImageFromPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): { imageData: string } | { error: KeychainImageError } {
  const mask = keychainImageMask(pixels, width, height);

  if (!mask || maskInk(mask) === 0) {
    return { error: "empty" };
  }

  const field = new Float32Array(mask.length);

  for (let index = 0; index < mask.length; index += 1) {
    field[index] = mask[index];
  }

  const traced = traceCoverageContours(field, width, height);
  const limit = checkRasterLimits(traced);

  if (limit) {
    return { error: limit };
  }

  const contours = traced
    .map((contour) => simplifyContour(contour))
    .filter((contour) => contour.length >= 3 && Math.abs(contourArea(contour)) > 0);

  if (contours.length === 0) {
    return { error: "empty" };
  }

  const path = contoursToSvgPath(contours);
  const markup =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">` +
    `<path d="${path}" fill="#ffffff"/></svg>`;
  const imageData = `${KEYCHAIN_IMAGE_PREFIX}${btoa(markup)}`;

  // Контуры уже прошли пределы растра, но base64 добавляет треть объёма:
  // слишком подробный логотип упрётся в лимит `params_json`.
  return imageData.length > KEYCHAIN_IMAGE_MAX_LENGTH
    ? { error: "too_many_points" }
    : { imageData };
}

/**
 * Разметка SVG из `imageData`.
 *
 * `atob` есть и в браузере, и в Node, поэтому разбор у панели и у роута общий.
 * Исключение из `atob` — испорченная строка: возвращаем `null`, а не роняем
 * сборку модели.
 */
export function decodeKeychainImageMarkup(
  imageData: string | null | undefined,
): string | null {
  if (!isKeychainImageData(imageData)) {
    return null;
  }

  try {
    const markup = atob(imageData.slice(KEYCHAIN_IMAGE_PREFIX.length));

    return markup.includes("<svg") ? markup : null;
  } catch {
    return null;
  }
}

/** Растеризует контуры в маску по габариту: чётность пересечений по строке. */
function rasterizeContours(
  contours: readonly (readonly OutlinePoint[])[],
  frame: { height: number; minX: number; minY: number; width: number },
  pixel: number,
): { bits: Uint8Array; height: number; width: number } {
  const width = Math.max(1, Math.ceil(frame.width / pixel));
  const height = Math.max(1, Math.ceil(frame.height / pixel));
  const bits = new Uint8Array(width * height);
  const crossings: number[] = [];

  for (let row = 0; row < height; row += 1) {
    const y = frame.minY + (row + 0.5) * pixel;

    crossings.length = 0;

    for (const contour of contours) {
      for (let index = 0; index < contour.length; index += 1) {
        const [x1, y1] = contour[index];
        const [x2, y2] = contour[(index + 1) % contour.length];

        // Ребро пересекает горизонталь, только если его концы по разные стороны.
        if (y1 <= y === y2 <= y) {
          continue;
        }

        crossings.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
    }

    crossings.sort((left, right) => left - right);

    for (let pair = 0; pair + 1 < crossings.length; pair += 2) {
      const from = Math.max(
        0,
        Math.ceil((crossings[pair] - frame.minX) / pixel - 0.5),
      );
      const to = Math.min(
        width - 1,
        Math.floor((crossings[pair + 1] - frame.minX) / pixel - 0.5),
      );

      for (let column = from; column <= to; column += 1) {
        bits[row * width + column] = 1;
      }
    }
  }

  return { bits, height, width };
}

/** Разбирает `imageData` в контуры единичного габарита и маску проверки. */
function createBuild(imageData: string): KeychainImageBuild | null {
  const markup = decodeKeychainImageMarkup(imageData);
  const parsed = markup ? parseSvgOutline(markup) : [];

  if (parsed.length === 0) {
    return null;
  }

  // Ось Y в SVG растёт вниз, а на грани брелока — вверх: знак меняется сразу,
  // иначе логотип печатался бы перевёрнутым.
  const flipped = parsed.map((contour) =>
    contour.map(([x, y]) => [x, -y] as OutlinePoint),
  );
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const contour of flipped) {
    for (const [x, y] of contour) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const span = Math.max(spanX, spanY);

  if (!Number.isFinite(span) || span <= 0) {
    return null;
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const contours = flipped.map((contour) =>
    contour.map(
      ([x, y]) => [(x - centerX) / span, (y - centerY) / span] as OutlinePoint,
    ),
  );
  const width = spanX / span;
  const height = spanY / span;
  const frame = {
    height,
    minX: -width / 2,
    minY: -height / 2,
    width,
  };
  const pixel = Math.max(width, height) / MASK_PIXELS;

  return { contours, frame, mask: rasterizeContours(contours, frame, pixel), pixel };
}

/**
 * Готовая маска из `params.imageData`.
 *
 * `null` — картинки нет или строка испорчена. Разбор кешируется: геометрия
 * пересобирается на каждое движение слайдера, а маска от параметров не зависит.
 */
export function keychainImageBuild(
  imageData: string | null | undefined,
): KeychainImageBuild | null {
  if (!imageData) {
    return null;
  }

  if (!buildCache.has(imageData)) {
    if (buildCache.size >= BUILD_CACHE_LIMIT) {
      const oldest = buildCache.keys().next().value;

      if (oldest !== undefined) {
        buildCache.delete(oldest);
      }
    }

    buildCache.set(imageData, createBuild(imageData));
  }

  return buildCache.get(imageData) ?? null;
}


/**
 * Попадает ли точка грани на закрашенную часть картинки.
 *
 * Точка переводится в единичные координаты картинки и дальше в пиксели маски.
 * Проверяется квадрат размером с ячейку карты, а не одна точка: тонкий штрих
 * логотипа уже 0.4 мм, и проверка по центру могла бы проскочить мимо него.
 */
function imageCovered(
  build: KeychainImageBuild,
  localX: number,
  localY: number,
  halfCell: number,
): boolean {
  const { frame, mask, pixel } = build;
  const fromColumn = Math.max(
    0,
    Math.floor((localX - halfCell - frame.minX) / pixel),
  );
  const toColumn = Math.min(
    mask.width - 1,
    Math.floor((localX + halfCell - frame.minX) / pixel),
  );
  const fromRow = Math.max(
    0,
    Math.floor((localY - halfCell - frame.minY) / pixel),
  );
  const toRow = Math.min(
    mask.height - 1,
    Math.floor((localY + halfCell - frame.minY) / pixel),
  );

  for (let row = fromRow; row <= toRow; row += 1) {
    for (let column = fromColumn; column <= toColumn; column += 1) {
      if (mask.bits[row * mask.width + column]) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Стоит ли картинка на свободных ячейках грани.
 *
 * Проверяются только занятые ячейки карты: под ними либо кромка, либо отверстие
 * под кольцо, либо карман NFC, либо буквы. Пустые ячейки внутри габарита
 * картинки — её собственные просветы, печати они не мешают.
 */
function imageFits(
  mask: FaceMask,
  build: KeychainImageBuild,
  centerX: number,
  centerY: number,
  size: number,
): boolean {
  const { blocked, grid } = mask;
  const halfWidth = (build.frame.width * size) / 2;
  const halfHeight = (build.frame.height * size) / 2;
  const left = centerX - halfWidth;
  const right = centerX + halfWidth;
  const bottom = centerY - halfHeight;
  const top = centerY + halfHeight;

  if (
    left < grid.minX ||
    bottom < grid.minY ||
    right > grid.minX + grid.columns * grid.cell ||
    top > grid.minY + grid.rows * grid.cell
  ) {
    return false;
  }

  const firstColumn = Math.max(
    0,
    Math.ceil((left - grid.minX) / grid.cell - 0.5),
  );
  const lastColumn = Math.min(
    grid.columns - 1,
    Math.floor((right - grid.minX) / grid.cell - 0.5),
  );
  const firstRow = Math.max(
    0,
    Math.ceil((bottom - grid.minY) / grid.cell - 0.5),
  );
  const lastRow = Math.min(
    grid.rows - 1,
    Math.floor((top - grid.minY) / grid.cell - 0.5),
  );
  const halfCell = grid.cell / 2 / size;

  for (let row = firstRow; row <= lastRow; row += 1) {
    const localY = (grid.minY + (row + 0.5) * grid.cell - centerY) / size;

    for (let column = firstColumn; column <= lastColumn; column += 1) {
      if (!blocked[row * grid.columns + column]) {
        continue;
      }

      const localX =
        (grid.minX + (column + 0.5) * grid.cell - centerX) / size;

      if (imageCovered(build, localX, localY, halfCell)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Смещение картинки по одной оси, обрезанное свободной картой.
 *
 * Как у надписи: просьба исполняется, пока картинка целиком лежит на пластике,
 * иначе смещение отступает назад шагами сетки. Соседняя ось берётся уже
 * обрезанной, поэтому итог всегда стоит на свободных ячейках. Проверку `fits`
 * передаёт вызывающий: у повёрнутой картинки она считает по AABB рамки, у
 * прямой — по пикселям маски.
 */
function clampImageOffset(
  mask: FaceMask,
  fits: (centerX: number, centerY: number) => boolean,
  base: { centerX: number; centerY: number },
  desired: number,
  axis: "x" | "y",
): number {
  const steps = Math.round(Math.abs(desired) / mask.grid.cell);
  const sign = desired < 0 ? -1 : 1;
  let accepted = 0;

  for (let step = 1; step <= steps; step += 1) {
    const value = sign * step * mask.grid.cell;

    if (
      !fits(
        axis === "x" ? base.centerX + value : base.centerX,
        axis === "y" ? base.centerY + value : base.centerY,
      )
    ) {
      break;
    }

    accepted = value;
  }

  return accepted;
}

/**
 * Ставит картинку на грань: центр, размер и фактический масштаб.
 *
 * Сначала по карте ищется свободная полоса, как для надписи. Базовый размер
 * вписывает картинку в эту полосу при масштабе 1. Если запрошенный масштаб
 * больше, картинка может не влезть: тогда она ужимается шагом 5% и встаёт по
 * центру полосы. Ручное смещение обрезается по той же карте, что у букв.
 *
 * Поворот (`rotation`) меняет только габарит проверки: AABB повёрнутого
 * прямоугольника шире исходного, поэтому 45° логотип встаёт мельче — но встаёт
 * целиком, а не углом за кромкой. При нулевом повороте проверка идёт по пикселям
 * маски, как раньше: прямой логотип может стоять над просветом внутри буквы.
 *
 * `mask` передаёт вызывающий, когда рельефов несколько: каждая поставленная
 * декорация уже вычтена из карты и стала препятствием с зазором.
 *
 * `null` — места нет совсем: полоса уже минимума или даже уменьшенная картинка
 * упирается в кромку. Панель в этом случае предлагает уменьшить масштаб.
 */
export function placeKeychainImage(
  body: BufferGeometry,
  options: {
    build: KeychainImageBuild;
    keepOut?: readonly KeychainTextKeepOut[];
    mask?: FaceMask;
    offsetX?: number;
    offsetY?: number;
    rotation?: number;
    scale: number;
    side: KeychainTextSide;
  },
): KeychainImagePlacement | null {
  const mask =
    options.mask ?? buildFaceMask(body, options.side, options.keepOut);

  if (!mask) {
    return null;
  }

  const rotation = options.rotation ?? 0;
  const rotated = keychainRotatedSize(
    { height: options.build.frame.height, width: options.build.frame.width },
    rotation,
  );
  // Прямая картинка проверяется по пикселям маски, повёрнутая — по AABB рамки:
  // считать повёрнутую маску дороже, чем проверить прямоугольник с тем же запасом.
  const fits = (centerX: number, centerY: number, size: number): boolean =>
    rotation === 0
      ? imageFits(mask, options.build, centerX, centerY, size)
      : rectFits(
          mask.blocked,
          mask.grid,
          centerX,
          centerY,
          rotated.width * size,
          rotated.height * size,
        );

  const band = findWidestBand(mask.blocked, mask.grid, {
    minHeight: IMAGE_MIN_BAND_MM,
    minWidth: IMAGE_MIN_BAND_MM,
  });

  if (!band) {
    return null;
  }

  const base = Math.min(
    band.width / rotated.width,
    band.height / rotated.height,
  );

  if (!Number.isFinite(base) || base <= 0) {
    return null;
  }

  const requested = options.scale;
  const floor = base * IMAGE_MIN_SCALE_SHARE;
  let size = base * requested;

  while (
    size >= floor &&
    !fits(band.centerX, band.centerY, size)
  ) {
    size -= base * IMAGE_SCALE_STEP;
  }

  if (size < floor) {
    return null;
  }

  const centerX =
    band.centerX +
    clampImageOffset(
      mask,
      (x, y) => fits(x, y, size),
      { centerX: band.centerX, centerY: band.centerY },
      options.offsetX ?? 0,
      "x",
    );
  const centerY =
    band.centerY +
    clampImageOffset(
      mask,
      (x, y) => fits(x, y, size),
      { centerX, centerY: band.centerY },
      options.offsetY ?? 0,
      "y",
    );

  return {
    actual: size / base,
    centerX,
    centerY,
    requested,
    side: options.side,
    size,
  };
}

/**
 * Толщина рельефа картинки, мм.
 *
 * Как у имени: `imageDepth` — выступ над пластиком, а 0.35 мм картинка входит в
 * тело. Оболочки пересекаются объёмом, и слайсер печатает логотип частью
 * брелока, а не отдельной деталью.
 */
export function keychainImageReliefMm(depth: number): number {
  return Math.max(depth, 0.1) + KEYCHAIN_TEXT_EMBED_MM;
}

/**
 * Выдавливает маску картинки и ставит её на выбранную сторону.
 *
 * Фаски нет намеренно: логотип приходит маской с тонкими штрихами, и скругление
 * кромки съедало бы перемычки. Заодно толщина рельефа остаётся ровно
 * `imageDepth + 0.35` — без добавки на скругление.
 */
export function createKeychainImageGeometry(options: {
  build: KeychainImageBuild;
  centerX: number;
  centerY: number;
  depth: number;
  rotation: number;
  side: KeychainTextSide;
  size: number;
  thickness: number;
}): BufferGeometry | null {
  const scaled = options.build.contours.map((contour) =>
    contour.map(
      ([x, y]) => [x * options.size, y * options.size] as OutlinePoint,
    ),
  );
  const groups = groupContours(scaled);

  if (groups.length === 0) {
    return null;
  }

  const geometry = new ExtrudeGeometry(buildShapes(groups), {
    bevelEnabled: false,
    curveSegments: 2,
    depth: keychainImageReliefMm(options.depth),
  });

  geometry.computeBoundingBox();

  const box = geometry.boundingBox;

  if (!box) {
    geometry.dispose();

    return null;
  }

  // Центр по габариту: у маски он уже в нуле, но выдавливание округляет
  // контуры до долей миллиметра, и поправка держит картинку на месте.
  geometry.translate(
    -(box.min.x + box.max.x) / 2,
    -(box.min.y + box.max.y) / 2,
    0,
  );
  geometry.rotateZ((options.rotation * Math.PI) / 180);

  if (options.side === "back") {
    geometry.rotateX(Math.PI);
  }

  const translateZ =
    options.side === "front"
      ? options.thickness - KEYCHAIN_TEXT_EMBED_MM
      : KEYCHAIN_TEXT_EMBED_MM;

  geometry.translate(options.centerX, options.centerY, translateZ);

  return geometry;
}

