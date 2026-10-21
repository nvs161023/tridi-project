import { BufferGeometry, Float32BufferAttribute, Matrix4 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import {
  LITHOPHANE_MESH_RESOLUTION,
  LITHOPHANE_RESOLUTION,
  normalizeLithophaneParams,
  type LithophaneParams,
  type LithophanePart,
} from "@/lib/constructor/params";

/**
 * Геометрия литофана: рельеф, рамка с пазом и два съёмных крепления.
 *
 * Всё стоит в плоскости XY нижней кромкой на Y = 0, лицо смотрит в +Z; у
 * подставки база лежит на столе. Рельеф — heightfield 400 × 400: толщина каждой
 * вершины берётся из яркости фотографии билинейной выборкой из 150 × 150.
 * Чёрный пиксель даёт максимальную толщину, белый — минимальную, поэтому свет
 * проходит через тонкие участки сильнее.
 *
 * Деталей три, и каждая — отдельный замкнутый объект:
 *   `relief` — плита с плоским тылом и рельефом на лице;
 *   `frame`  — рамка с задней полкой (плита садится на неё с зазором 0.2 мм) и
 *              передней накладкой, которая прижимает её край;
 *   `stand`  — подставка: база, передняя губа и задняя стенка под наклоном 12°.
 *
 * Крепление `hook` — две петли на тыльной стороне верхней планки рамки: литофан
 * висит на шурупах почти вплотную к стене. Вычитания тел (CSG) нет: деталь
 * собирается из пересекающихся замкнутых кусков и `mergeGeometries`, как
 * вывеска и светильник. Нахлёст объединяемых кусков — BODY_OVERLAP_MM: слайсер
 * видит один объект, а каждая оболочка остаётся watertight.
 */

/** Ширина бортика рамки по периметру, мм. */
export const LITHOPHANE_FRAME_WIDTH_MM = 6;

/** Зазор посадки плиты в паз на сторону, мм. */
export const LITHOPHANE_FIT_GAP_MM = 0.2;

/** Высота задней полки рамки: на неё опирается плита, мм. */
export const LITHOPHANE_FRAME_SEAT_MM = 1.6;

/** Ширина передней накладки поверх края плиты, мм. */
export const LITHOPHANE_FRAME_LIP_MM = 2.4;

/** Насколько передняя рамка выступает над самым толстым пикселем, мм. */
export const LITHOPHANE_FRAME_RIM_MM = 0.4;

/** Наклон литофана на подставке, градусы. */
export const LITHOPHANE_STAND_TILT_DEG = 12;

/** Петля подвеса: наружная ширина и выступ от тыльной плоскости, мм. */
export const LITHOPHANE_HOOK_WIDTH_MM = 8;
export const LITHOPHANE_HOOK_DEPTH_MM = 9;

/** Нахлёст двух объединяемых оболочек, мм: без него слайсер видит два тела. */
const BODY_OVERLAP_MM = 0.2;

/** Верх базы подставки: на нём стоит рамка, мм. */
const STAND_BASE_TOP_MM = 6;

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
 * Добавляет четырёхугольник четырьмя новыми вершинами.
 *
 * Вершины не переиспользуются: у рамки и подставки острые рёбра, и общие вершины
 * размазали бы нормали между гранями — деталь выглядела бы оплавленной.
 */
function addQuadFace(
  indices: number[],
  positions: number[],
  points: readonly [Point3, Point3, Point3, Point3],
  normal: Point3,
): void {
  const first = vertexIndex(positions);

  for (const point of points) {
    positions.push(point[0], point[1], point[2]);
  }

  addOrientedQuad(
    indices,
    positions,
    first,
    first + 1,
    first + 2,
    first + 3,
    normal,
  );
}

/** Собирает замкнутую оболочку из накопленных вершин и индексов. */
function finalizeGeometry(
  positions: number[],
  indices: number[],
): BufferGeometry {
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
 * Габариты посадки плиты в рамку, мм.
 *
 * Считаются в одном месте: плита строится по ним, рамка вырезает по ним окно, а
 * сборка ставит плиту на полку. Иначе после смены ширины бортика плита и окно
 * разошлись бы на десятые доли миллиметра и деталь не собралась бы.
 */
type FrameMetrics = {
  /** Габарит собранной рамки — те же числа, что на слайдерах. */
  width: number;
  height: number;
  /** Ширина бортика: 6 мм, но не больше четверти панели. */
  frameWidth: number;
  /** Ширина передней накладки поверх края плиты. */
  lip: number;
  /** Окно рамки: сюда входит плита. */
  openingWidth: number;
  openingHeight: number;
  /** Размер плиты: окно минус зазор посадки с двух сторон. */
  plateWidth: number;
  plateHeight: number;
  /** Плоскость тыла плиты: верх полки минус нахлёст для объединения. */
  plateBack: number;
  /** Лицевая плоскость рамки: плита плюс выступ накладки. */
  frontZ: number;
};

function lithophaneFrameMetrics(normalized: LithophaneParams): FrameMetrics {
  const width = normalized.lithophaneWidth;
  const height = normalized.lithophaneHeight;
  const frameWidth = Math.min(
    LITHOPHANE_FRAME_WIDTH_MM,
    width / 4,
    height / 4,
  );
  const openingWidth = width - 2 * frameWidth;
  const openingHeight = height - 2 * frameWidth;
  const lip = Math.min(
    LITHOPHANE_FRAME_LIP_MM,
    openingWidth / 5,
    openingHeight / 5,
  );
  const plateBack = LITHOPHANE_FRAME_SEAT_MM - BODY_OVERLAP_MM;

  return {
    width,
    height,
    frameWidth,
    lip,
    openingWidth,
    openingHeight,
    plateWidth: openingWidth - 2 * LITHOPHANE_FIT_GAP_MM,
    plateHeight: openingHeight - 2 * LITHOPHANE_FIT_GAP_MM,
    plateBack,
    frontZ:
      plateBack + normalized.lithophaneMaxThickness + LITHOPHANE_FRAME_RIM_MM,
  };
}

/**
 * Билинейная выборка яркости в точке 0…1 по обеим осям.
 *
 * Картинка приходит 150 × 150, а сетка рельефа — 400 × 400, поэтому вершина
 * почти никогда не попадает в центр пикселя. Без выборки ступеньки были бы
 * шириной 0.8 мм на панели 120 мм и читались бы как полосы.
 */
function sampleBrightness(
  brightness: number[],
  u: number,
  v: number,
): number {
  const last = LITHOPHANE_RESOLUTION - 1;
  const x = Math.min(Math.max(u, 0), 1) * last;
  const y = Math.min(Math.max(v, 0), 1) * last;
  const x0 = Math.min(Math.floor(x), last - 1);
  const y0 = Math.min(Math.floor(y), last - 1);
  const tx = x - x0;
  const ty = y - y0;
  const topRow = y0 * LITHOPHANE_RESOLUTION;
  const bottomRow = topRow + LITHOPHANE_RESOLUTION;
  const topLeft = brightness[topRow + x0];
  const bottomLeft = brightness[bottomRow + x0];
  const top = topLeft + (brightness[topRow + x0 + 1] - topLeft) * tx;
  const bottom =
    bottomLeft + (brightness[bottomRow + x0 + 1] - bottomLeft) * tx;

  return top + (bottom - top) * ty;
}

/**
 * Замкнутая плита рельефа: heightfield, боковины и плоский тыл.
 *
 * `borderWidth > 0` оставляет по периметру плоскую полосу максимальной толщины:
 * так панель без рамки не просвечивает по краю и не крошится. `borderWidth = 0`
 * отдаёт фотографии всю площадь — у плиты в рамке край прикрыт накладкой.
 */
function createReliefBody(
  normalized: LithophaneParams,
  plateWidth: number,
  plateHeight: number,
  borderWidth: number,
): BufferGeometry {
  const minThickness = normalized.lithophaneMinThickness;
  const maxThickness = normalized.lithophaneMaxThickness;
  const brightness = normalized.lithophaneBrightness;
  const halfWidth = plateWidth / 2;
  const thicknessRange = maxThickness - minThickness;
  const n = LITHOPHANE_MESH_RESOLUTION;
  const step = 1 / (n - 1);
  const positions: number[] = [];
  const indices: number[] = [];

  // Лицо рельефа: одна вершина на узел сетки. Строка 0 — верхний край, как у
  // массива яркости; яркость 0 — самый толстый пластик, 255 — самый тонкий.
  for (let row = 0; row < n; row += 1) {
    const v = row * step;
    const y = plateHeight - v * plateHeight;
    const fromTop = v * plateHeight;
    const fromBottom = (1 - v) * plateHeight;

    for (let column = 0; column < n; column += 1) {
      const u = column * step;
      const x = -halfWidth + u * plateWidth;
      const inBorder =
        borderWidth > 0 &&
        (u * plateWidth <= borderWidth ||
          (1 - u) * plateWidth <= borderWidth ||
          fromTop <= borderWidth ||
          fromBottom <= borderWidth);
      const thickness = inBorder
        ? maxThickness
        : maxThickness -
          thicknessRange * (sampleBrightness(brightness, u, v) / 255);

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

  // Тыл повторяет контур лица по X/Y и лежит на Z = 0. Отдельные вершины
  // нужны, чтобы плоская задняя стенка не делила нормали с рельефом.
  for (const topIndex of boundary) {
    bottomBoundary.push(vertexIndex(positions));
    positions.push(
      positions[topIndex * 3],
      positions[topIndex * 3 + 1],
      0,
    );
  }

  const centerIndex = vertexIndex(positions);
  positions.push(0, plateHeight / 2, 0);

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

  return finalizeGeometry(positions, indices);
}

/**
 * Плита рельефа отдельной деталью.
 *
 * `Partial<LithophaneParams>` допустим и на клиенте: normalizeLithophaneParams
 * дополнит недостающие поля значениями по умолчанию. Если массив яркости
 * повреждён, нормализация подставит демонстрационный рельеф — предпросмотр
 * останется рабочим.
 */
export function createLithophaneReliefGeometry(
  params: Partial<LithophaneParams>,
): BufferGeometry {
  const normalized = normalizeLithophaneParams(params);
  const metrics = lithophaneFrameMetrics(normalized);

  return normalized.lithoFrame
    ? createReliefBody(normalized, metrics.plateWidth, metrics.plateHeight, 0)
    : createReliefBody(
        normalized,
        normalized.lithophaneWidth,
        normalized.lithophaneHeight,
        metrics.frameWidth,
      );
}

/**
 * Замкнутый параллелепипед по двум углам.
 *
 * Подставка и петли — набор коробок: так каждая деталь состоит из нескольких
 * замкнутых оболочек, которые объединяются с нахлёстом. Все шесть граней
 * получают свои вершины, поэтому рёбра остаются острыми.
 */
function createBoxBody(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  addQuadFace(
    indices,
    positions,
    [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y1, z0],
      [x0, y1, z0],
    ],
    [0, 0, -1],
  );
  addQuadFace(
    indices,
    positions,
    [
      [x0, y0, z1],
      [x1, y0, z1],
      [x1, y1, z1],
      [x0, y1, z1],
    ],
    [0, 0, 1],
  );
  addQuadFace(
    indices,
    positions,
    [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y0, z1],
      [x0, y0, z1],
    ],
    [0, -1, 0],
  );
  addQuadFace(
    indices,
    positions,
    [
      [x0, y1, z0],
      [x1, y1, z0],
      [x1, y1, z1],
      [x0, y1, z1],
    ],
    [0, 1, 0],
  );
  addQuadFace(
    indices,
    positions,
    [
      [x0, y0, z0],
      [x0, y1, z0],
      [x0, y1, z1],
      [x0, y0, z1],
    ],
    [-1, 0, 0],
  );
  addQuadFace(
    indices,
    positions,
    [
      [x1, y0, z0],
      [x1, y1, z0],
      [x1, y1, z1],
      [x1, y0, z1],
    ],
    [1, 0, 0],
  );

  return finalizeGeometry(positions, indices);
}

/** Прямоугольное кольцо, выдавленное по Z: полка рамки и бортик петли. */
type RectRingOptions = {
  centerX: number;
  centerY: number;
  outerWidth: number;
  outerHeight: number;
  innerWidth: number;
  innerHeight: number;
  z0: number;
  z1: number;
};

/**
 * Замкнутое прямоугольное кольцо: наружные и внутренние стенки плюс две
 * плоские полосы по торцам.
 *
 * Кольцо — основа рамки: задняя полка держит плиту, передняя накладка её
 * прижимает. Обе собираются из одного кода, отличаются только размерами окна и
 * высотой по Z.
 */
function createRectRingBody(options: RectRingOptions): BufferGeometry {
  const {
    centerX,
    centerY,
    outerWidth,
    outerHeight,
    innerWidth,
    innerHeight,
    z0,
    z1,
  } = options;
  const outerLeft = centerX - outerWidth / 2;
  const outerRight = centerX + outerWidth / 2;
  const outerBottom = centerY - outerHeight / 2;
  const outerTop = centerY + outerHeight / 2;
  const innerLeft = centerX - innerWidth / 2;
  const innerRight = centerX + innerWidth / 2;
  const innerBottom = centerY - innerHeight / 2;
  const innerTop = centerY + innerHeight / 2;
  const positions: number[] = [];
  const indices: number[] = [];

  for (const z of [z0, z1]) {
    const normal: Point3 = z === z0 ? [0, 0, -1] : [0, 0, 1];

    // Четыре трапеции торца: наружный край шире внутреннего.
    addQuadFace(
      indices,
      positions,
      [
        [outerLeft, outerBottom, z],
        [outerRight, outerBottom, z],
        [innerRight, innerBottom, z],
        [innerLeft, innerBottom, z],
      ],
      normal,
    );
    addQuadFace(
      indices,
      positions,
      [
        [outerRight, outerBottom, z],
        [outerRight, outerTop, z],
        [innerRight, innerTop, z],
        [innerRight, innerBottom, z],
      ],
      normal,
    );
    addQuadFace(
      indices,
      positions,
      [
        [outerRight, outerTop, z],
        [outerLeft, outerTop, z],
        [innerLeft, innerTop, z],
        [innerRight, innerTop, z],
      ],
      normal,
    );
    addQuadFace(
      indices,
      positions,
      [
        [outerLeft, outerTop, z],
        [outerLeft, outerBottom, z],
        [innerLeft, innerBottom, z],
        [innerLeft, innerTop, z],
      ],
      normal,
    );
  }

  // Наружные стенки смотрят наружу.
  addQuadFace(
    indices,
    positions,
    [
      [outerLeft, outerBottom, z0],
      [outerRight, outerBottom, z0],
      [outerRight, outerBottom, z1],
      [outerLeft, outerBottom, z1],
    ],
    [0, -1, 0],
  );
  addQuadFace(
    indices,
    positions,
    [
      [outerRight, outerBottom, z0],
      [outerRight, outerTop, z0],
      [outerRight, outerTop, z1],
      [outerRight, outerBottom, z1],
    ],
    [1, 0, 0],
  );
  addQuadFace(
    indices,
    positions,
    [
      [outerRight, outerTop, z0],
      [outerLeft, outerTop, z0],
      [outerLeft, outerTop, z1],
      [outerRight, outerTop, z1],
    ],
    [0, 1, 0],
  );
  addQuadFace(
    indices,
    positions,
    [
      [outerLeft, outerTop, z0],
      [outerLeft, outerBottom, z0],
      [outerLeft, outerBottom, z1],
      [outerLeft, outerTop, z1],
    ],
    [-1, 0, 0],
  );

  // Внутренние стенки смотрят в окно: иначе нормали завернулись бы внутрь
  // пластика и объём кольца посчитался бы с другим знаком.
  addQuadFace(
    indices,
    positions,
    [
      [innerLeft, innerBottom, z0],
      [innerRight, innerBottom, z0],
      [innerRight, innerBottom, z1],
      [innerLeft, innerBottom, z1],
    ],
    [0, 1, 0],
  );
  addQuadFace(
    indices,
    positions,
    [
      [innerRight, innerBottom, z0],
      [innerRight, innerTop, z0],
      [innerRight, innerTop, z1],
      [innerRight, innerBottom, z1],
    ],
    [-1, 0, 0],
  );
  addQuadFace(
    indices,
    positions,
    [
      [innerRight, innerTop, z0],
      [innerLeft, innerTop, z0],
      [innerLeft, innerTop, z1],
      [innerRight, innerTop, z1],
    ],
    [0, -1, 0],
  );
  addQuadFace(
    indices,
    positions,
    [
      [innerLeft, innerTop, z0],
      [innerLeft, innerBottom, z0],
      [innerLeft, innerBottom, z1],
      [innerLeft, innerTop, z1],
    ],
    [1, 0, 0],
  );

  return finalizeGeometry(positions, indices);
}


/**
 * Рамка литофана отдельной деталью.
 *
 * Задняя полка поднимается до `LITHOPHANE_FRAME_SEAT_MM`, и её внутренний край
 * заходит под плиту на ширину накладки: плита ложится на полку и не проваливается
 * в окно. Передняя накладка начинается чуть ниже верха полки (нахлёст для
 * объединения) и поднимается над самым толстым пикселем на 0.4 мм — рельеф не
 * выступает за лицевую плоскость, и литофан можно ставить лицом вниз.
 *
 * При креплении `hook` на тыльной стороне верхней планки появляются две петли.
 * Каждая — полка с бортиком сзади: шуруп вворачивается в стену, литофан
 * опускается на него, шляпка остаётся в кармане между рамкой и бортиком.
 */
export function createLithophaneFrameGeometry(
  params: Partial<LithophaneParams>,
): BufferGeometry {
  const normalized = normalizeLithophaneParams(params);
  const metrics = lithophaneFrameMetrics(normalized);
  const { width, height, frameWidth, lip, frontZ } = metrics;
  const bodies: BufferGeometry[] = [
    createRectRingBody({
      centerX: 0,
      centerY: height / 2,
      outerWidth: width,
      outerHeight: height,
      innerWidth: width - 2 * (frameWidth + lip),
      innerHeight: height - 2 * (frameWidth + lip),
      z0: 0,
      z1: LITHOPHANE_FRAME_SEAT_MM,
    }),
    createRectRingBody({
      centerX: 0,
      centerY: height / 2,
      outerWidth: width,
      outerHeight: height,
      innerWidth: width - 2 * frameWidth,
      innerHeight: height - 2 * frameWidth,
      z0: LITHOPHANE_FRAME_SEAT_MM - 2 * BODY_OVERLAP_MM,
      z1: frontZ,
    }),
  ];

  if (normalized.lithoMount === "hook") {
    // Петли стоят на верхней планке: её ширина — бортик плюс накладка. Полка
    // петли занимает нижние 4 мм планки, бортик поднимается от неё к верхнему
    // краю, поэтому с лица крепление не видно.
    const band = frameWidth + lip;
    const bracketHalf = Math.min(LITHOPHANE_HOOK_WIDTH_MM / 2, band / 2);
    const bracketCenter = width / 2 - band / 2;
    const shelfTop = height - band + Math.min(4, band / 2);

    for (const centerX of [-bracketCenter, bracketCenter]) {
      bodies.push(
        createBoxBody(
          centerX - bracketHalf,
          centerX + bracketHalf,
          height - band,
          shelfTop,
          -LITHOPHANE_HOOK_DEPTH_MM,
          BODY_OVERLAP_MM,
        ),
      );
      bodies.push(
        createBoxBody(
          centerX - bracketHalf,
          centerX + bracketHalf,
          shelfTop - 1,
          height - 1,
          -LITHOPHANE_HOOK_DEPTH_MM,
          -LITHOPHANE_HOOK_DEPTH_MM + 1.5,
        ),
      );
    }
  }

  return mergeBodies(bodies, "рамки");
}

/**
 * Объединяет оболочки детали в одну сетку и освобождает исходные.
 *
 * `mergeGeometries` копирует данные в новую сетку; без dispose каждая правка
 * слайдера оставляла бы в памяти старые буферы.
 */
function mergeBodies(
  bodies: BufferGeometry[],
  name: string,
): BufferGeometry {
  const merged = mergeGeometries(bodies);

  for (const body of bodies) {
    body.dispose();
  }

  if (!merged) {
    throw new Error(`Не удалось объединить детали литофана: ${name}`);
  }

  merged.computeBoundingBox();
  merged.computeBoundingSphere();

  return merged;
}


/**
 * Подставка отдельной деталью.
 *
 * База 6 мм держит литофан на столе: спереди её край выходит за рамку, сзади
 * уходит на 32 мм — центр тяжести наклонённой панели остаётся над опорой.
 * Передняя губа не даёт рамке съехать вперёд, задняя стенка наклонена на 12°
 * и повторяет наклон панели: рамка опирается на неё всей плоскостью, а не
 * ребром. Панель опускается в паз сверху — клей не нужен.
 *
 * Координаты те же, что у собранного литофана: стол — Y = 0, тыльная плоскость
 * рамки проходит через (Y = 6, Z = 0). Стенка стоит на 0.2 мм впереди неё: в
 * сборке она входит в тыл рамки, и слайсер видит один объект. Поэтому панель,
 * вставленная в напечатанную подставку, сдвинута вперёд на те же 0.2 мм, а
 * зазор до губы остаётся прежним.
 */
export function createLithophaneStandGeometry(
  params: Partial<LithophaneParams>,
): BufferGeometry {
  const normalized = normalizeLithophaneParams(params);
  const metrics = lithophaneFrameMetrics(normalized);
  const width = normalized.lithophaneWidth;
  const standWidth = Math.min(width, Math.max(50, width * 0.6));
  const halfWidth = standWidth / 2;
  const tilt = (LITHOPHANE_STAND_TILT_DEG * Math.PI) / 180;
  const lipThickness = 2.5;
  // Задняя стенка заходит в тыл рамки на BODY_OVERLAP_MM: иначе в собранном
  // файле два тела только касались бы плоскостями и слайсер видел бы два
  // объекта. Панель от нахлёста сдвигается вперёд, поэтому губа отодвигается
  // на ту же величину и зазор посадки остаётся LITHOPHANE_FIT_GAP_MM.
  const lipBack =
    metrics.frontZ * Math.cos(tilt) + LITHOPHANE_FIT_GAP_MM + BODY_OVERLAP_MM;

  const base = createBoxBody(
    -halfWidth,
    halfWidth,
    0,
    STAND_BASE_TOP_MM,
    -32,
    10,
  );
  const lip = createBoxBody(
    -halfWidth,
    halfWidth,
    STAND_BASE_TOP_MM - 2,
    STAND_BASE_TOP_MM + 4,
    lipBack,
    lipBack + lipThickness,
  );
  const wall = createBoxBody(-halfWidth, halfWidth, 4, 30, -4, 0);

  // Стенка наклонена назад вокруг нижней кромки и сдвинута так, чтобы её лицевая
  // плоскость прошла через (Y = 6, Z = BODY_OVERLAP_MM): в неё на 0.2 мм входит
  // тыл рамки. Низ стенки уходит внутрь базы, наружу торчит только рабочая часть.
  wall.applyMatrix4(new Matrix4().makeRotationX(-tilt));
  wall.translate(
    0,
    0,
    STAND_BASE_TOP_MM * Math.tan(tilt) + BODY_OVERLAP_MM,
  );

  return mergeBodies([base, lip, wall], "подставки");
}

/**
 * Собирает литофан по детали: рельеф, рамка, подставка или всё сразу.
 *
 * `all` — собранный вид для предпросмотра и печати одним файлом: плита вставлена
 * в рамку, а с подставкой вся сборка наклонена на 12° и стоит в пазе; задняя
 * стенка подставки входит в тыл рамки, поэтому детали держатся друг за друга.
 * Без рамки крепления нет (его паз вырезан в рамке), поэтому `all` возвращает
 * плиту.
 * Если деталь недоступна — например, `frame` при выключенной рамке, — функция
 * отдаёт рельеф: предпросмотр не должен падать из-за состояния формы. API такие
 * запросы отклоняет до построения.
 */
export function createLithophaneGeometry(
  params: Partial<LithophaneParams>,
  part: LithophanePart = "all",
): BufferGeometry {
  const normalized = normalizeLithophaneParams(params);

  if (part === "relief" || !normalized.lithoFrame) {
    return createLithophaneReliefGeometry(normalized);
  }

  if (part === "frame") {
    return createLithophaneFrameGeometry(normalized);
  }

  if (part === "stand") {
    return createLithophaneStandGeometry(normalized);
  }

  const metrics = lithophaneFrameMetrics(normalized);
  const relief = createLithophaneReliefGeometry(normalized);
  const frame = createLithophaneFrameGeometry(normalized);
  const bodies = [relief, frame];

  // Плита входит в окно с зазором и ложится на заднюю полку: по X она уже окна
  // на зазор с каждой стороны, по Y — на зазор сверху и снизу.
  relief.translate(
    0,
    metrics.frameWidth + LITHOPHANE_FIT_GAP_MM,
    metrics.plateBack,
  );

  if (normalized.lithoMount === "stand") {
    const tilt = new Matrix4().makeRotationX(
      -(LITHOPHANE_STAND_TILT_DEG * Math.PI) / 180,
    );

    for (const body of bodies) {
      // Наклон вокруг ребра (Y = 0, Z = 0), затем перенос на верх базы: так
      // тыл рамки ложится на наклонную стенку подставки.
      body.applyMatrix4(tilt);
      body.translate(0, STAND_BASE_TOP_MM, 0);
    }

    bodies.push(createLithophaneStandGeometry(normalized));
  }

  return mergeBodies(bodies, "литофана");
}

