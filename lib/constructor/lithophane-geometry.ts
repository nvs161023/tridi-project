import { BufferGeometry, Float32BufferAttribute } from "three";

import {
  LITHOPHANE_RESOLUTION,
  normalizeLithophaneParams,
  type LithophaneParams,
} from "@/lib/constructor/params";

/**
 * Геометрия литофана: панель с рельефом фотографии и рамкой по периметру.
 *
 * Панель стоит в плоскости XY нижней кромкой на Y = 0, лицо смотрит в +Z,
 * толщина растёт от 0 до `lithophaneMaxThickness`. Верхняя поверхность —
 * heightfield 150 × 150:
 * каждая вершина получает толщину по яркости своего пикселя. Чёрный пиксель
 * даёт максимальную толщину, белый — минимальную, поэтому свет проходит через
 * тонкие участки сильнее.
 *
 * Сетка замкнута по рёбрам: верхняя поверхность, боковины и плоский тыл делят
 * общие вершины. Тыл треугольной веерной развёрткой от центра соединяется со
 * всеми точками нижнего контура, поэтому не нужны десятки тысяч лишних
 * треугольников, а STL остаётся watertight. Рамка — не отдельная деталь:
 * внешняя полоса шириной LITHOPHANE_FRAME_WIDTH_MM поднимается до
 * максимальной толщины и становится частью той же оболочки. Так слайсеру не
 * приходится объединять совпадающие грани.
 */

/** Ширина рамки по периметру, мм. */
export const LITHOPHANE_FRAME_WIDTH_MM = 6;

type Point3 = readonly [number, number, number];

/** Индекс вершины в массиве positions. */
function vertexIndex(positions: number[]): number {
  return positions.length / 3;
}

/**
 * Добавляет выпуклый четырёхугольник двумя треугольниками.
 *
 * Порядок вершин задаётся по периметру, а expectedNormal говорит, куда должна
 * смотреть лицевая сторона. Если векторное произведение направлено в другую
 * сторону, обход разворачивается целиком — иначе нормали части граней
 * смотрели бы внутрь и объём перестал бы сходиться.
 */
function addOrientedQuad(
  indices: number[],
  positions: number[],
  a: number,
  b: number,
  c: number,
  d: number,
  normal: Point3,
): void {
  const ax = positions[a * 3];
  const ay = positions[a * 3 + 1];
  const az = positions[a * 3 + 2];
  const ux = positions[b * 3] - ax;
  const uy = positions[b * 3 + 1] - ay;
  const uz = positions[b * 3 + 2] - az;
  const vx = positions[c * 3] - ax;
  const vy = positions[c * 3 + 1] - ay;
  const vz = positions[c * 3 + 2] - az;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const flipped = nx * normal[0] + ny * normal[1] + nz * normal[2] < 0;
  const second = flipped ? d : b;
  const fourth = flipped ? b : d;

  indices.push(a, second, c, a, c, fourth);
}

/** Добавляет треугольник с нужной наружной нормалью. */
function addOrientedTriangle(
  indices: number[],
  positions: number[],
  a: number,
  b: number,
  c: number,
  normal: Point3,
): void {
  const ax = positions[a * 3];
  const ay = positions[a * 3 + 1];
  const az = positions[a * 3 + 2];
  const ux = positions[b * 3] - ax;
  const uy = positions[b * 3 + 1] - ay;
  const uz = positions[b * 3 + 2] - az;
  const vx = positions[c * 3] - ax;
  const vy = positions[c * 3 + 1] - ay;
  const vz = positions[c * 3 + 2] - az;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;

  if (nx * normal[0] + ny * normal[1] + nz * normal[2] < 0) {
    indices.push(a, c, b);
  } else {
    indices.push(a, b, c);
  }
}

/**
 * Контур верхней поверхности против часовой стрелки со стороны +Z.
 *
 * Обход начинается в левом нижнем углу: нижняя кромка слева направо, правая
 * снизу вверх, верхняя справа налево, левая сверху вниз. Для такого контура
 * внешняя нормаль ребра равна (dy, -dx, 0).
 */
function collectBoundaryIndices(n: number): number[] {
  const boundary: number[] = [];

  for (let column = 0; column < n; column += 1) {
    boundary.push((n - 1) * n + column);
  }

  for (let row = n - 2; row >= 0; row -= 1) {
    boundary.push(row * n + n - 1);
  }

  for (let column = n - 2; column >= 0; column -= 1) {
    boundary.push(column);
  }

  for (let row = 1; row <= n - 2; row += 1) {
    boundary.push(row * n);
  }

  return boundary;
}

/**
 * Собирает панель литофана в одну замкнутую сетку.
 *
 * `Partial<LithophaneParams>` допустим и на клиенте: normalizeLithophaneParams
 * дополнит недостающие поля значениями по умолчанию. Если массив яркости
 * повреждён, нормализация подставит демонстрационный рельеф — предпросмотр
 * останется рабочим.
 */
export function createLithophaneGeometry(
  params: Partial<LithophaneParams>,
): BufferGeometry {
  const normalized = normalizeLithophaneParams(params);
  const width = normalized.lithophaneWidth;
  const height = normalized.lithophaneHeight;
  const minThickness = normalized.lithophaneMinThickness;
  const maxThickness = normalized.lithophaneMaxThickness;
  const brightness = normalized.lithophaneBrightness;
  const n = LITHOPHANE_RESOLUTION;
  const step = 1 / (n - 1);
  const frameWidth = Math.min(
    LITHOPHANE_FRAME_WIDTH_MM,
    width / 4,
    height / 4,
  );
  const innerHalfWidth = width / 2 - frameWidth;
  const thicknessRange = maxThickness - minThickness;
  const positions: number[] = [];
  const indices: number[] = [];

  // Верхняя поверхность: одна вершина на пиксель, яркость 0 — самый толстый
  // пластик, 255 — самый тонкий. Внешняя полоса сразу становится рамкой.
  for (let row = 0; row < n; row += 1) {
    const y = height - row * height * step;

    for (let column = 0; column < n; column += 1) {
      const x = -width / 2 + column * width * step;
      const inFrame =
        Math.abs(x) >= innerHalfWidth ||
        y <= frameWidth ||
        y >= height - frameWidth;
      const thickness = inFrame
        ? maxThickness
        : maxThickness -
          thicknessRange * (brightness[row * n + column] / 255);

      positions.push(x, y, thickness);
    }
  }

  for (let row = 0; row < n - 1; row += 1) {
    for (let column = 0; column < n - 1; column += 1) {
      const a = row * n + column;
      const b = a + 1;
      const c = a + n + 1;
      const d = a + n;

      // a — левый верхний угол ячейки, c — правый нижний. Такой обход даёт
      // нормаль +Z, то есть лицо смотрит на камеру и на слайсер сверху.
      indices.push(a, d, c, a, c, b);
    }
  }

  const boundary = collectBoundaryIndices(n);
  const bottomBoundary: number[] = [];

  // Нижний контур повторяет верхний по X/Y и лежит на Z = 0. Отдельные
  // вершины нужны, чтобы плоский тыл не делил нормали с рельефом.
  for (const topIndex of boundary) {
    bottomBoundary.push(vertexIndex(positions));
    positions.push(
      positions[topIndex * 3],
      positions[topIndex * 3 + 1],
      0,
    );
  }

  const centerIndex = vertexIndex(positions);
  positions.push(0, height / 2, 0);

  const boundaryCount = boundary.length;

  for (let edge = 0; edge < boundaryCount; edge += 1) {
    const next = (edge + 1) % boundaryCount;
    const topA = boundary[edge];
    const topB = boundary[next];
    const bottomA = bottomBoundary[edge];
    const bottomB = bottomBoundary[next];
    const dx = positions[topB * 3] - positions[topA * 3];
    const dy = positions[topB * 3 + 1] - positions[topA * 3 + 1];

    addOrientedQuad(
      indices,
      positions,
      topA,
      topB,
      bottomB,
      bottomA,
      [dy, -dx, 0],
    );
    addOrientedTriangle(
      indices,
      positions,
      centerIndex,
      bottomA,
      bottomB,
      [0, 0, -1],
    );
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}
