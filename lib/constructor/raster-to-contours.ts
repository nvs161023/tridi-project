/**
 * Растровые маски: пиксели → маска → замкнутые контуры → путь SVG.
 *
 * Брелок и heat-transfer переводят PNG в SVG по-разному (полосы `<rect>`
 * против одной `<path>`), но общая часть у них одна: бинаризация `ImageData`,
 * трассировка границ и упрощение по Дугласу—Пекеру. Модуль чистый — ни
 * `document`, ни `canvas`, ни `Image`, — поэтому его можно вызвать из
 * node-скрипта и проверить числами.
 *
 * Координаты контуров — в пикселях растра, ось Y вниз. Перевод в миллиметры,
 * переворот Y и фильтры «мелких деталей» живут в геометрии конкретной модели:
 * у брелока и принта разные поля и допуски.
 */

import type { Point2 } from "@/lib/constructor/prism-mesh";

/** Порог «пиксель прозрачный»: полупрозрачный край сглаживания не в счёт. */
const TRANSPARENT_ALPHA = 250;

/** Доля прозрачных пикселей, с которой фон считается прозрачным. */
const TRANSPARENCY_SHARE = 0.05;

/** Порог непрозрачности маски: ниже — пиксель не печатается. */
const OPAQUE_ALPHA = 128;

/** Яркость, ниже которой пиксель считается тёмным: белый фон не силуэт. */
const DARK_LUMINANCE = 200;

/** Совпадение координат, ниже которого точки считаются одной вершиной. */
const SAME_POINT_EPSILON = 1e-6;

/** Упрощение контура: 0.75 px убирает ступеньки растра, но держит углы. */
export const RASTER_RDP_EPSILON_PX = 0.75;

/** Предел числа контуров: больше — картинка распалась на шум. */
export const RASTER_MAX_CONTOURS = 200;

/** Предел суммы точек после упрощения: защита STL от микрокривых. */
export const RASTER_MAX_POINTS_TOTAL = 20000;

/**
 * Есть ли у картинки прозрачный фон.
 *
 * Считаем долю пикселей с `alpha < 250`: у PNG-логотипа фон обычно прозрачный,
 * а у фото и JPG — нет, и тогда силуэт надо искать по яркости.
 */
export function hasTransparency(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): boolean {
  const total = Math.min(width * height, Math.floor(pixels.length / 4));

  if (total <= 0) {
    return false;
  }

  const limit = total * TRANSPARENCY_SHARE;
  let transparent = 0;

  for (let index = 0; index < total; index += 1) {
    if (pixels[index * 4 + 3] < TRANSPARENT_ALPHA) {
      transparent += 1;

      if (transparent > limit) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Маска по яркости: тёмный непрозрачный пиксель — силуэт.
 *
 * Правило унаследовано от контура брелока: прозрачное и светлое отбрасывается,
 * поэтому белый фон фотографии не превращается в силуэт.
 */
export function binarizeByLuminance(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = DARK_LUMINANCE,
): Uint8Array {
  const total = width * height;
  const mask = new Uint8Array(total);

  for (let index = 0; index < total; index += 1) {
    const offset = index * 4;

    if (pixels[offset + 3] < OPAQUE_ALPHA) {
      continue;
    }

    const luminance =
      0.299 * pixels[offset] +
      0.587 * pixels[offset + 1] +
      0.114 * pixels[offset + 2];

    mask[index] = luminance < threshold ? 1 : 0;
  }

  return mask;
}

/**
 * Поле покрытия по альфе: 1 — пиксель целиком пластик, 0 — целиком ткань.
 *
 * В отличие от `binarizeByAlpha`, полупрозрачные края не отбрасываются: доля
 * альфы и есть доля пластика в пикселе. Так граница проходит через середину
 * перехода, а не по ступеньке растра.
 */
export function coverageByAlpha(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): Float32Array {
  const total = width * height;
  const field = new Float32Array(total);

  for (let index = 0; index < total; index += 1) {
    field[index] = pixels[index * 4 + 3] / 255;
  }

  return field;
}

/** Перцентиль по гистограмме канала: значение, ниже которого `share` массы. */
function percentile(histogram: Uint32Array, share: number): number {
  let total = 0;

  for (const count of histogram) {
    total += count;
  }

  if (total === 0) {
    return 0;
  }

  const limit = total * share;
  let seen = 0;

  for (let value = 0; value < histogram.length; value += 1) {
    seen += histogram[value];

    if (seen >= limit) {
      return value;
    }
  }

  return histogram.length - 1;
}

/**
 * Поле покрытия для картинки без прозрачности: 0 — цвет фона, 1 — цвет пластика.
 *
 * Фон оценивается по рамке кадра: у логотипа это всегда поля вокруг рисунка.
 * «Цвет пластика» — не фиксированный порог яркости, а самый далёкий от фона
 * оттенок: расстояние в RGB растёт линейно на сглаженном крае, поэтому граница
 * покрытия 0.5 проходит точно посередине перехода. Прежний порог яркости 200
 * срабатывал на 78 % перехода, из-за чего край уезжал внутрь и получался рваным.
 *
 * Если рамка пёстрая (фотография, скриншот с фоном), берётся медианный цвет
 * рамки: он всё равно ближе к фону, чем к рисунку.
 */
export function coverageByColor(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): Float32Array {
  const total = width * height;
  const field = new Float32Array(total);

  if (total <= 0) {
    return field;
  }

  const band = Math.max(1, Math.round(Math.min(width, height) / 64));
  let red = 0;
  let green = 0;
  let blue = 0;
  let samples = 0;

  const collect = (x: number, y: number): void => {
    const offset = (y * width + x) * 4;

    if (pixels[offset + 3] < OPAQUE_ALPHA) {
      return;
    }

    red += pixels[offset];
    green += pixels[offset + 1];
    blue += pixels[offset + 2];
    samples += 1;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x < band || y < band || x >= width - band || y >= height - band) {
        collect(x, y);
      }
    }
  }

  if (samples === 0) {
    return field;
  }

  const background = [red / samples, green / samples, blue / samples];
  const histogram = new Uint32Array(256);
  const distances = new Float32Array(total);

  for (let index = 0; index < total; index += 1) {
    const offset = index * 4;

    if (pixels[offset + 3] < OPAQUE_ALPHA) {
      continue;
    }

    const dx = pixels[offset] - background[0];
    const dy = pixels[offset + 1] - background[1];
    const dz = pixels[offset + 2] - background[2];
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    distances[index] = distance;
    histogram[Math.min(255, Math.round(distance))] += 1;
  }

  // Девяносто пятый перцентиль — цвет самого плотного пластика. Ноль означает,
  // что рисунок совпадает с фоном: трассировать нечего.
  const ink = percentile(histogram, 0.95);

  if (ink <= 2) {
    return field;
  }

  // Шум сжатия у самого фона не должен давать покрытие: восемь процентов от
  // контраста отсекает артефакты WebP и остаются на границе рисунка.
  const noise = ink * 0.08;

  for (let index = 0; index < total; index += 1) {
    const coverage = (distances[index] - noise) / (ink - noise);
    field[index] = coverage <= 0 ? 0 : coverage >= 1 ? 1 : coverage;
  }

  return field;
}

/**
 * Поле покрытия по яркости: 1 — чёрный пиксель, 0 — белый.
 *
 * Для картинок без прозрачности: у фото и JPG фон светлый, а рисунок тёмный,
 * поэтому доля краски в пикселе — это `1 − яркость`. Полутон не отбрасывается:
 * градиент логотипа не превращается в рваное пятно, а порог детализации режет
 * уже готовое поле. Прозрачные пиксели покрытия не дают вовсе.
 */
export function coverageByLuminance(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): Float32Array {
  const total = width * height;
  const field = new Float32Array(total);

  for (let index = 0; index < total; index += 1) {
    const offset = index * 4;

    if (pixels[offset + 3] < OPAQUE_ALPHA) {
      continue;
    }

    const luminance =
      0.299 * pixels[offset] +
      0.587 * pixels[offset + 1] +
      0.114 * pixels[offset + 2];

    field[index] = 1 - luminance / 255;
  }

  return field;
}

/**
 * Квантует поле покрытия в `levels` ступеней с дизерингом Флойда — Стейнберга.
 *
 * Зачем дизеринг: маска картинки на брелоке хранится четырьмя битами на ячейку —
 * это шестнадцать ступеней, а полутонов в фотографии двести пятьдесят шесть.
 * Ошибка округления не выбрасывается, а распределяется на соседей по змейке
 * (7/16 вперёд, 3/16, 5/16 и 1/16 в следующую строку). Поэтому на градиенте
 * вместо ступенек остаётся равномерная крупа, и порог детализации вырезает
 * плотность точек, а не полосы.
 *
 * `dither: false` — для маски по альфе: сглаженный край логотипа должен остаться
 * гладким, крупа на нём была бы грязью.
 *
 * Возвращает ячейки 0…`levels − 1`: их же пишет в параметры панель и читает
 * геометрия.
 */
export function quantizeCoverage(
  field: Float32Array,
  width: number,
  height: number,
  levels = 16,
  dither = true,
): Uint8Array {
  const steps = Math.max(1, Math.round(levels) - 1);
  const total = width * height;
  const work = new Float32Array(total);
  const cells = new Uint8Array(total);

  for (let index = 0; index < total; index += 1) {
    const value = field[index];
    work[index] = value < 0 ? 0 : value > 1 ? 1 : value;
  }

  for (let row = 0; row < height; row += 1) {
    // Змейка: без неё ошибка уезжает вправо-вниз и на градиенте видны диагональные полосы.
    const forward = row % 2 === 0;

    for (let step = 0; step < width; step += 1) {
      const column = forward ? step : width - 1 - step;
      const index = row * width + column;
      const value = work[index];
      const quantized = Math.round(value * steps);

      cells[index] = quantized;

      if (!dither) {
        continue;
      }

      const error = value - quantized / steps;
      const sign = forward ? 1 : -1;
      const diffuse = (dx: number, dy: number, share: number): void => {
        const x = column + dx * sign;
        const y = row + dy;

        if (x < 0 || x >= width || y >= height) {
          return;
        }

        work[y * width + x] += error * share;
      };

      diffuse(1, 0, 7 / 16);
      diffuse(-1, 1, 3 / 16);
      diffuse(0, 1, 5 / 16);
      diffuse(1, 1, 1 / 16);
    }
  }

  return cells;
}

/**
 * Значение поля в узле решётки: за границей растра всегда фон.
 *
 * Узлы идут по углам пикселей: у растра `width × height` узлов
 * `(width + 1) × (height + 1)`, и ячейка `(x, y)` соединяет четыре соседних.
 */
function fieldAt(
  field: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  if (x < 0 || y < 0 || x > width || y > height) {
    return 0;
  }

  if (x === width || y === height) {
    return 0;
  }

  return field[y * width + x];
}

/** Идентификатор горизонтального ребра: чётный, чтобы не спорить с вертикальным. */
function horizontalEdge(x: number, y: number, width: number): number {
  return (y * width + x) * 2;
}

/** Идентификатор вертикального ребра: нечётный. */
function verticalEdge(x: number, y: number, width: number): number {
  return (y * width + x) * 2 + 1;
}

/**
 * Отрезки изолинии по коду ячейки: пары «ребро входа, ребро выхода».
 *
 * Углы: 1 — левый верхний, 2 — правый верхний, 4 — правый нижний, 8 — левый
 * нижний. Рёбра: 0 — верхнее, 1 — правое, 2 — нижнее, 3 — левое. Направление
 * выбрано так, чтобы у общего ребра двух ячеек выход одной совпадал со входом
 * другой: только тогда отрезки складываются в замкнутый контур.
 */
const CASE_SEGMENTS: readonly (readonly (readonly [number, number])[])[] = [
  [],
  [[3, 0]],
  [[0, 1]],
  [[3, 1]],
  [[1, 2]],
  [],
  [[0, 2]],
  [[3, 2]],
  [[2, 3]],
  [[2, 0]],
  [],
  [[2, 1]],
  [[1, 3]],
  [[1, 0]],
  [[0, 3]],
  [],
];

/**
 * Обводит изолинию поля покрытия: контуры проходят между пикселями.
 *
 * Это marching squares, а не обход границы маски: пересечение ребра ячейки
 * ищется линейной интерполяцией, поэтому контур получает дробные координаты.
 * Граница круга выходит гладкой ломаной, а не лестницей из целых пикселей, и
 * после упрощения даёт ровный край на печати. Седловые ячейки (5 и 10)
 * разрешаются по среднему значению четырёх углов: так тонкие штрихи не
 * распадаются на шахматку.
 *
 * Все сегменты ориентированы одинаково — пластик остаётся слева по ходу
 * обхода. Для седловой ячейки это значит, что «раздельный» вариант обводит
 * пластиковые углы, а «слитный» (среднее ≥ порога) обходит фоновые карманы
 * навстречу: направления там зеркальные, и писать их как у одиночных кодов
 * нельзя. Ошибка здесь не видна на глаз, но ломает граф: соседняя ячейка
 * считает общее ребро входом дважды, `next` перезаписывается, цепочка
 * обрывается и контур целиком выбрасывается — на логотипе так пропадала
 * строка мелкого текста.
 *
 * Порог 0.5 — середина перехода «фон → пластик», поэтому сдвига края нет.
 */
export function traceCoverageContours(
  field: Float32Array,
  width: number,
  height: number,
  threshold = 0.5,
): Point2[][] {
  if (width < 2 || height < 2) {
    return [];
  }

  const edgeCount = (width + 1) * (height + 1) * 2;
  const next = new Int32Array(edgeCount).fill(-1);
  const pointX = new Float32Array(edgeCount);
  const pointY = new Float32Array(edgeCount);

  /** Точка пересечения на ребре: интерполяция по его концам. */
  const cross = (
    id: number,
    ax: number,
    ay: number,
    av: number,
    bx: number,
    by: number,
    bv: number,
  ): void => {
    const denominator = bv - av;
    const raw = denominator === 0 ? 0.5 : (threshold - av) / denominator;
    const t = raw < 0 ? 0 : raw > 1 ? 1 : raw;

    pointX[id] = ax + (bx - ax) * t;
    pointY[id] = ay + (by - ay) * t;
  };

  const link = (from: number, to: number): void => {
    next[from] = to;
  };

  // Последняя строка и столбец узлов лежат на краю кадра: ячеек за ними нет,
  // поэтому цикл до `width - 1`. Сама граница кадра контуром не считается.
  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const topLeft = fieldAt(field, width, height, x, y);
      const topRight = fieldAt(field, width, height, x + 1, y);
      const bottomRight = fieldAt(field, width, height, x + 1, y + 1);
      const bottomLeft = fieldAt(field, width, height, x, y + 1);
      let code = 0;

      if (topLeft >= threshold) {
        code |= 1;
      }

      if (topRight >= threshold) {
        code |= 2;
      }

      if (bottomRight >= threshold) {
        code |= 4;
      }

      if (bottomLeft >= threshold) {
        code |= 8;
      }

      if (code === 0 || code === 15) {
        continue;
      }

      const top = horizontalEdge(x, y, width);
      const right = verticalEdge(x + 1, y, width);
      const bottom = horizontalEdge(x, y + 1, width);
      const left = verticalEdge(x, y, width);
      const edges = [top, right, bottom, left];
      // Узел — центр пикселя: растр занимает [0; width], а пиксель — [x; x + 1],
      // поэтому центр сдвинут на полпикселя. Без этого сдвига контур уезжает на
      // 0.5 px влево-вверх и тонкие штрихи теряют край.
      const leftX = x + 0.5;
      const topY = y + 0.5;
      const rightX = x + 1.5;
      const bottomY = y + 1.5;

      cross(top, leftX, topY, topLeft, rightX, topY, topRight);
      cross(right, rightX, topY, topRight, rightX, bottomY, bottomRight);
      cross(bottom, leftX, bottomY, bottomLeft, rightX, bottomY, bottomRight);
      cross(left, leftX, topY, topLeft, leftX, bottomY, bottomLeft);

      if (code === 5 || code === 10) {
        const center = (topLeft + topRight + bottomRight + bottomLeft) / 4;
        const solid = center >= threshold;
        // «Раздельно» — обход пластиковых углов, направления как у кодов 1 и 4
        // (5) или 2 и 8 (10). «Слитно» — обход фоновых карманов навстречу, чтобы
        // пластик остался слева: те же рёбра, обратное направление.
        const segments: readonly (readonly [number, number])[] =
          code === 5
            ? solid
              ? [[1, 0], [3, 2]]
              : [[3, 0], [1, 2]]
            : solid
              ? [[0, 3], [2, 1]]
              : [[0, 1], [2, 3]];

        for (const [from, to] of segments) {
          link(edges[from], edges[to]);
        }

        continue;
      }

      for (const [from, to] of CASE_SEGMENTS[code]) {
        link(edges[from], edges[to]);
      }
    }
  }

  const used = new Uint8Array(edgeCount);
  const contours: Point2[][] = [];

  for (let start = 0; start < edgeCount; start += 1) {
    if (next[start] < 0 || used[start] === 1) {
      continue;
    }

    const points: Point2[] = [];
    let current = start;
    let guard = edgeCount;

    while (guard > 0 && used[current] === 0 && next[current] >= 0) {
      used[current] = 1;
      points.push([pointX[current], pointY[current]]);
      current = next[current];
      guard -= 1;
    }

    if (current === start && points.length >= 3) {
      points.push([points[0][0], points[0][1]]);
      contours.push(points);
    }
  }

  return contours;
}

export type RasterRect = { x: number; y: number; w: number };

/**
 * Склеивает подряд идущие пиксели маски в полосы по строке.
 *
 * Брелок рисует силуэт горизонтальными `<rect height="1">`: полоса — это run
 * единиц в одной строке растра. Порядок — сверху вниз и слева направо, поэтому
 * строка SVG не зависит от того, как полосы собирались раньше.
 */
export function runsToRects(
  mask: Uint8Array,
  width: number,
  height: number,
): RasterRect[] {
  const rects: RasterRect[] = [];

  for (let y = 0; y < height; y += 1) {
    let runStart = -1;

    for (let x = 0; x <= width; x += 1) {
      const inked = x < width && mask[y * width + x] === 1;

      if (inked && runStart < 0) {
        runStart = x;
      } else if (!inked && runStart >= 0) {
        rects.push({ x: runStart, y, w: x - runStart });
        runStart = -1;
      }
    }
  }

  return rects;
}

/** Код превышения пределов растра: текст ошибки собирает вызывающий слой. */
export type RasterLimitCode = "too_many_contours" | "too_many_points";

/**
 * Проверяет пределы растра до сборки SVG.
 *
 * `null` — можно строить путь. Пределы проверяются до сериализации: строка
 * из тысяч подпутей уже не влезет в лимит `params_json`.
 */
export function checkRasterLimits(
  contours: readonly (readonly Point2[])[],
): RasterLimitCode | null {
  if (contours.length > RASTER_MAX_CONTOURS) {
    return "too_many_contours";
  }

  let total = 0;

  for (const contour of contours) {
    total += contour.length;

    if (total > RASTER_MAX_POINTS_TOTAL) {
      return "too_many_points";
    }
  }

  return null;
}

/** Совпадают ли две вершины: по этой проверке контур считается замкнутым. */
function isSamePoint(first: Point2, second: Point2): boolean {
  return (
    Math.abs(first[0] - second[0]) < SAME_POINT_EPSILON &&
    Math.abs(first[1] - second[1]) < SAME_POINT_EPSILON
  );
}

/** Квадрат расстояния от точки до отрезка. */
function squaredDistanceToSegment(
  point: Point2,
  from: Point2,
  to: Point2,
): number {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const lengthSquared = dx * dx + dy * dy;
  const offsetX = point[0] - from[0];
  const offsetY = point[1] - from[1];

  if (lengthSquared === 0) {
    return offsetX * offsetX + offsetY * offsetY;
  }

  const ratio = Math.min(
    1,
    Math.max(0, (offsetX * dx + offsetY * dy) / lengthSquared),
  );
  const nearestX = from[0] + ratio * dx;
  const nearestY = from[1] + ratio * dy;
  const distanceX = point[0] - nearestX;
  const distanceY = point[1] - nearestY;

  return distanceX * distanceX + distanceY * distanceY;
}

/** RDP по ломаной: концы закреплены, остальные точки — по расстоянию. */
function simplifyOpenPath(
  points: readonly Point2[],
  epsilonSquared: number,
): Point2[] {
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack: [number, number][] = [[0, points.length - 1]];

  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number];
    let farthest = -1;
    let farthestDistance = 0;

    for (let index = first + 1; index < last; index += 1) {
      const distance = squaredDistanceToSegment(
        points[index],
        points[first],
        points[last],
      );

      if (distance > farthestDistance) {
        farthestDistance = distance;
        farthest = index;
      }
    }

    if (farthest >= 0 && farthestDistance > epsilonSquared) {
      keep[farthest] = 1;
      stack.push([first, farthest], [farthest, last]);
    }
  }

  return points.filter((_, index) => keep[index] === 1);
}

/** RDP замкнутого контура: старт и самая далёкая от него вершина делят кольцо. */
function simplifyClosedPath(
  points: readonly Point2[],
  epsilonSquared: number,
): Point2[] {
  const start = points[0];
  let farthest = 1;
  let farthestDistance = -1;

  for (let index = 1; index < points.length; index += 1) {
    const dx = points[index][0] - start[0];
    const dy = points[index][1] - start[1];
    const distance = dx * dx + dy * dy;

    if (distance > farthestDistance) {
      farthestDistance = distance;
      farthest = index;
    }
  }

  const head = simplifyOpenPath(points.slice(0, farthest + 1), epsilonSquared);
  const tail = simplifyOpenPath(
    [...points.slice(farthest), points[0]],
    epsilonSquared,
  );

  return [...head, ...tail.slice(1, -1)];
}

/**
 * Упрощает контур алгоритмом Дугласа—Пекера.
 *
 * Замкнутый контур (первая точка равна последней) режется по самой далёкой от
 * старта вершине: обычный RDP с совпадающими концами вырождается в отрезок
 * нулевой длины. Если после упрощения осталось меньше трёх точек — контур
 * вырожден (линия или точка), отдаём пустой массив.
 */
export function simplifyContour(
  points: readonly Point2[],
  epsilon = RASTER_RDP_EPSILON_PX,
): Point2[] {
  if (points.length < 3) {
    return [];
  }

  const closed = isSamePoint(points[0], points[points.length - 1]);
  const open = closed ? points.slice(0, -1) : [...points];

  if (open.length < 3) {
    return [];
  }

  const epsilonSquared = epsilon * epsilon;
  const simplified = closed
    ? simplifyClosedPath(open, epsilonSquared)
    : simplifyOpenPath(open, epsilonSquared);

  return simplified.length >= 3 ? simplified : [];
}

/**
 * Знаковая площадь контура по формуле шнурка.
 *
 * Своя реализация, а не `outlineArea` из `svg-outline.ts`: растровый модуль
 * импортирует клиент, и тянуть в бандл разбор SVG ради двенадцати строк
 * незачем. Знак показывает направление обхода — у отверстия он другой, поэтому
 * фильтр «нулевая площадь» сравнивает модуль.
 */
export function contourArea(points: readonly Point2[]): number {
  let doubled = 0;

  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[(index + 1) % points.length];
    doubled += x1 * y2 - x2 * y1;
  }

  return doubled / 2;
}

/** Координата для `d`: три знака после точки, без хвостов плавающей арифметики. */
function formatCoordinate(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;

  return Number.isFinite(rounded) ? `${rounded}` : "0";
}

/**
 * Собирает контуры в один путь SVG.
 *
 * Все контуры идут подпутями одной `<path>`: серверный разбор и `groupContours`
 * считают вложенность геометрически, поэтому `fill-rule` не нужен. `Z`
 * замыкает подпуть, повтор первой точки в конце не пишется. Масштаб переводит
 * пиксели в единицы модели — у брелока и принта он свой.
 */
export function contoursToSvgPath(
  contours: readonly (readonly Point2[])[],
  scaleX = 1,
  scaleY = 1,
): string {
  const subpaths: string[] = [];

  for (const contour of contours) {
    const first = contour[0];
    const last = contour[contour.length - 1];
    const points =
      first && last && isSamePoint(first, last)
        ? contour.slice(0, -1)
        : contour;

    if (points.length < 3) {
      continue;
    }

    const commands = points.map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${formatCoordinate(point[0] * scaleX)} ` +
        formatCoordinate(point[1] * scaleY),
    );

    subpaths.push(`${commands.join(" ")} Z`);
  }

  return subpaths.join(" ");
}

/**
 * Шаг гистограммы толщины штриха, px: полпикселя хватает для решений о сопле.
 */
export const RASTER_STROKE_BUCKET_PX = 0.5;

/** Шире этого штрих уже не «тонкий»: 32 px при 0.1 мм/px — это 3.2 мм. */
const RASTER_STROKE_MAX_PX = 32;

/**
 * Распределение толщины штрихов по скелету рисунка.
 *
 * Нужно, чтобы панель могла честно сказать: «штрихи 0.23 мм при ширине 120 мм —
 * тоньше сопла 0.4 мм». Толщина — удвоенное расстояние до ближайшего фона:
 * у полосы в 3 px оно равно 1 px.
 *
 * Считается только по скелету — пикселям, где расстояние до фона локально
 * максимально. По всей площади метрика бессмысленна: у края любого штриха
 * расстояние мало по определению, и доля «тоньше сопла» выходила бы 15 % даже
 * у километровой плашки. Скелет же даёт ровно ширину линий.
 *
 * Гистограмма, а не минимум: единичная пылинка в 1 px не должна пугать
 * пользователя, а тонкая подпись — должна.
 */
export type StrokeHistogram = {
  /** Пикселей скелета в бакете: толщина от `index * bucketPx` до следующей. */
  counts: Uint32Array;
  bucketPx: number;
  total: number;
};

/**
 * Расстояние от каждого пикселя пластика до фона по Чамферу 3-4.
 *
 * Два прохода (вниз-вправо и вверх-влево) с весами 1 и 1.41: погрешность около
 * 4 % против точного евклидова преобразования, зато один линейный проход без
 * очередей и квадратов. Для «толще сопла или нет» этого хватает с запасом.
 */
function backgroundDistance(
  field: Float32Array,
  width: number,
  height: number,
): Float32Array {
  const total = width * height;
  const distance = new Float32Array(total);
  const FAR = 1e6;

  for (let index = 0; index < total; index += 1) {
    distance[index] = field[index] >= 0.5 ? FAR : 0;
  }

  const relax = (target: number, source: number, cost: number): void => {
    const next = distance[source] + cost;

    if (next < distance[target]) {
      distance[target] = next;
    }
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;

      if (distance[index] === 0) {
        continue;
      }

      if (x > 0) {
        relax(index, index - 1, 1);
      }

      if (y > 0) {
        relax(index, index - width, 1);

        if (x > 0) {
          relax(index, index - width - 1, 1.41);
        }

        if (x + 1 < width) {
          relax(index, index - width + 1, 1.41);
        }
      }
    }
  }

  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const index = y * width + x;

      if (distance[index] === 0) {
        continue;
      }

      if (x + 1 < width) {
        relax(index, index + 1, 1);
      }

      if (y + 1 < height) {
        relax(index, index + width, 1);

        if (x + 1 < width) {
          relax(index, index + width + 1, 1.41);
        }

        if (x > 0) {
          relax(index, index + width - 1, 1.41);
        }
      }
    }
  }

  return distance;
}

/**
 * Гистограмма толщины штрихов поля покрытия.
 *
 * На входе — покрытие и его расстояния до фона; в гистограмму попадают только
 * скелетные пиксели (локальный максимум расстояния в окне 3×3). Шаг 0.5 px:
 * при 0.1 мм/px это 0.05 мм, мельче точности печати, поэтому граница «толще
 * сопла» определяется без промаха.
 */
export function strokeWidthHistogram(
  field: Float32Array,
  width: number,
  height: number,
): StrokeHistogram {
  const buckets = Math.ceil(RASTER_STROKE_MAX_PX / RASTER_STROKE_BUCKET_PX) + 1;
  const counts = new Uint32Array(buckets);
  let total = 0;

  if (width <= 0 || height <= 0) {
    return { counts, bucketPx: RASTER_STROKE_BUCKET_PX, total };
  }

  const distance = backgroundDistance(field, width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const own = distance[index];

      if (field[index] < 0.5 || own <= 0) {
        continue;
      }

      let peak = true;

      for (let dy = -1; dy <= 1 && peak; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) {
            continue;
          }

          const nx = x + dx;
          const ny = y + dy;

          if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
            continue;
          }

          if (distance[ny * width + nx] > own) {
            peak = false;
            break;
          }
        }
      }

      if (!peak) {
        continue;
      }

      // −1: расстояние меряется до центра пикселя фона, а граница пластика
      // проходит на полпикселя ближе. Штрих в 3 px иначе оценивался бы в 5.
      const thickness = own * 2 - 1;
      const bucket = Math.min(
        buckets - 1,
        Math.floor(thickness / RASTER_STROKE_BUCKET_PX),
      );

      counts[bucket] += 1;
      total += 1;
    }
  }

  return { counts, bucketPx: RASTER_STROKE_BUCKET_PX, total };
}

/** Доля длины скелета, у которой штрих тоньше `limitPx`. */
export function thinStrokeShare(
  histogram: StrokeHistogram,
  limitPx: number,
): number {
  if (histogram.total === 0) {
    return 0;
  }

  const lastThin = Math.ceil(limitPx / histogram.bucketPx) - 1;
  let thin = 0;

  for (
    let index = 0;
    index < histogram.counts.length && index <= lastThin;
    index += 1
  ) {
    thin += histogram.counts[index];
  }

  return thin / histogram.total;
}

/**
 * Толщина штриха, ниже которой лежит `share` площади пластика.
 *
 * По ней панель считает, до какой ширины детали нужно увеличить логотип:
 * `нужная ширина = порог сопла * ширина кадра / перцентиль`.
 */
export function strokeWidthPercentile(
  histogram: StrokeHistogram,
  share: number,
): number {
  if (histogram.total === 0) {
    return 0;
  }

  const limit = histogram.total * Math.min(1, Math.max(0, share));
  let seen = 0;

  for (let index = 0; index < histogram.counts.length; index += 1) {
    seen += histogram.counts[index];

    if (seen >= limit) {
      // Середина бакета, а не верхняя граница: иначе штрих в 3 px весил бы 3.5
      // и на границе сопла решение переворачивалось бы из-за округления.
      return (index + 0.5) * histogram.bucketPx;
    }
  }

  return histogram.counts.length * histogram.bucketPx;
}
