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

/** Направления обхода границы: восток, юг, запад, север (ось Y вниз). */
const STEPS: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/** Очередь попыток при обходе: направо, прямо, налево, назад. */
const TURNS: readonly number[] = [1, 0, 3, 2];

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

/** Маска по прозрачности: 1 — пиксель непрозрачный и печатается. */
export function binarizeByAlpha(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = OPAQUE_ALPHA,
): Uint8Array {
  const total = width * height;
  const mask = new Uint8Array(total);

  for (let index = 0; index < total; index += 1) {
    mask[index] = pixels[index * 4 + 3] >= threshold ? 1 : 0;
  }

  return mask;
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

/** Значение маски: за границей растра всегда фон. */
function maskAt(
  mask: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return 0;
  }

  return mask[y * width + x];
}

/**
 * Граничное ребро решётки, направленное так, что объект лежит справа.
 *
 * Ребро идёт из угла `(x, y)` в соседний угол по направлению `step`. Пиксели
 * по сторонам ребра ищутся на полпикселя вправо и влево от его середины:
 * нормаль вправо в экранных координатах — это `(−dy, dx)`.
 */
function isBorderEdge(
  mask: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  step: number,
): boolean {
  const [dx, dy] = STEPS[step];
  const middleX = x + dx / 2;
  const middleY = y + dy / 2;

  if (
    maskAt(
      mask,
      width,
      height,
      Math.floor(middleX - dy / 2),
      Math.floor(middleY + dx / 2),
    ) !== 1
  ) {
    return false;
  }

  return (
    maskAt(
      mask,
      width,
      height,
      Math.floor(middleX + dy / 2),
      Math.floor(middleY - dx / 2),
    ) === 0
  );
}

/** Ключ направленного ребра решётки: по нему видно, что контур уже собран. */
function edgeKey(x: number, y: number, step: number, width: number): number {
  return (y * (width + 1) + x) * 4 + step;
}

/**
 * Обходит один контур по правилу правой руки: сначала поворот направо.
 *
 * Старт — вершина решётки и направление первого ребра. Возвращает замкнутый
 * контур (первая точка равна последней) либо `null`, если граница не сходится:
 * тогда контур отбрасывается, чтобы не отдавать в триангуляцию обрывок.
 */
function followBorder(
  mask: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  startStep: number,
  visited: Set<number>,
): Point2[] | null {
  const points: Point2[] = [];
  const maxSteps = (width + 1) * (height + 1) * 4;
  let x = startX;
  let y = startY;
  let step = startStep;

  for (let guard = 0; guard < maxSteps; guard += 1) {
    const key = edgeKey(x, y, step, width);

    if (visited.has(key)) {
      return null;
    }

    visited.add(key);
    points.push([x, y]);

    x += STEPS[step][0];
    y += STEPS[step][1];

    if (x === startX && y === startY) {
      points.push([startX, startY]);
      return points;
    }

    let next = -1;

    for (const turn of TURNS) {
      const candidate = (step + turn) % 4;

      if (isBorderEdge(mask, width, height, x, y, candidate)) {
        next = candidate;
        break;
      }
    }

    if (next < 0) {
      return null;
    }

    step = next;
  }

  return null;
}

/**
 * Обходит маску и возвращает все контуры: внешние и отверстия.
 *
 * Внешний контур начинается с верхней кромки объекта, отверстие — с верхней
 * кромки прозрачной области внутри объекта. Обход идёт по углам пикселей, а не
 * по их центрам, поэтому контур квадрата — это ровно его пиксельные границы.
 * Каждый контур замкнут: первая точка повторяет последнюю.
 */
export function traceMaskContours(
  mask: Uint8Array,
  width: number,
  height: number,
): Point2[][] {
  const contours: Point2[][] = [];
  const visited = new Set<number>();

  const start = (x: number, y: number, step: number): void => {
    if (visited.has(edgeKey(x, y, step, width))) {
      return;
    }

    const contour = followBorder(mask, width, height, x, y, step, visited);

    if (contour && contour.length >= 4) {
      contours.push(contour);
    }
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (
        mask[y * width + x] !== 1 ||
        maskAt(mask, width, height, x, y - 1) === 1
      ) {
        continue;
      }

      start(x, y, 0);
    }
  }

  for (let y = 1; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x] !== 0 || mask[(y - 1) * width + x] !== 1) {
        continue;
      }

      start(x + 1, y, 2);
    }
  }

  return contours;
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
