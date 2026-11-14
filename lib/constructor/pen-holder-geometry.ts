import { BufferGeometry, Float32BufferAttribute } from "three";

import {
  normalizePenHolderParams,
  type PenHolderParams,
  type PenShape,
} from "@/lib/constructor/params";
import {
  addCupPrism,
  addFanCap,
  addPrismSides,
  circlePolygon,
  type Point2,
} from "@/lib/constructor/prism-mesh";

/**
 * Геометрия органайзера для ручек.
 *
 * Деталь собирается из трёх частей: плита дна, кольцо-стена и перегородки.
 * Между стенкой и дном остаётся открытая полость, перегородки делят её на
 * отделения. Булевых операций в проекте нет: каждая часть — замкнутое тело, а
 * оболочки соприкасаются по плоскости дна. Поэтому объём сетки — это объём
 * детали, а не сумма пересекающихся оболочек.
 *
 * Габарит по X у всех форм равен `penSize`: круг строится радиусом `penSize/2`,
 * квадрат — с поворотом на 45°, а шестигранник — по описанной окружности.
 * У правильного шестигранника ширина по X и глубина по Y не могут быть равны:
 * при ширине 80 глубина честно получается `80 · √3 / 2 = 69.28` мм.
 *
 * Перегородки вырезаются из внутренней полости по X и повторяют её контур по Y,
 * поэтому не протыкают стенку и занимают всю доступную ширину отделения. Верх
 * перегородки на миллиметр ниже кромки — по краю остаётся ровный борт.
 *
 * Деталь построена Z-вверх, как кашпо и коробка: предпросмотр поворачивает меш.
 */

/** Толщина дна, мм: держит вес ручек и не прогибается. */
const PEN_FLOOR_MM = 3;

/** Отступ верха перегородки от кромки, мм: борт остаётся ровным. */
const PEN_DIVIDER_TOP_MARGIN_MM = 1;

/** Число сторон круглого сечения: 64 отрезка дают гладкую стенку. */
const PEN_ROUND_SIDES = 64;

/** Число сторон сечения по форме: квадрат и шестигранник точные. */
const PEN_SIDES: Record<PenShape, number> = {
  round: PEN_ROUND_SIDES,
  square: 4,
  hex: 6,
};

/** Квадрат повёрнут на 45°, чтобы грани смотрели по осям, как у кашпо. */
const PEN_START_ANGLE: Record<PenShape, number> = {
  round: 0,
  square: Math.PI / 4,
  hex: 0,
};

/**
 * Внешний и внутренний контуры стаканчика.
 *
 * Радиус считается от габарита по X, а не от апофемы: так круг и шестигранник
 * получают ровно `penSize` по X. Внутренний радиус уменьшен на стенку по
 * нормали: у квадрата и шестигранника это `wall / cos(π / N)`, у круга — `wall`.
 */
function penContours(
  shape: PenShape,
  size: number,
  wall: number,
): { outer: Point2[]; inner: Point2[] } {
  const sides = PEN_SIDES[shape];
  const startAngle = PEN_START_ANGLE[shape];
  const outerRadius =
    shape === "square" ? size / (2 * Math.cos(Math.PI / 4)) : size / 2;
  const innerRadius =
    shape === "square"
      ? outerRadius - wall / Math.cos(Math.PI / 4)
      : shape === "hex"
        ? outerRadius - wall / Math.cos(Math.PI / 6)
        : outerRadius - wall;

  return {
    outer: circlePolygon(outerRadius, sides, startAngle),
    inner: circlePolygon(innerRadius, sides, startAngle),
  };
}

/**
 * Контуры органайзера по параметрам.
 *
 * Экспорт нужен тестам: по нему проверяется, что перегородки лежат внутри
 * полости, а габарит по X совпадает с `penSize`.
 */
export function penHolderContours(
  params: Partial<PenHolderParams>,
): { outer: Point2[]; inner: Point2[] } {
  const normalized = normalizePenHolderParams(params);

  return penContours(
    normalized.penShape,
    normalized.penSize,
    normalized.penWall,
  );
}

/** Обрезка выпуклого контура вертикальной прямой. */
function clipAtX(
  points: readonly Point2[],
  x: number,
  keepRight: boolean,
): Point2[] {
  const clipped: Point2[] = [];

  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index + points.length - 1) % points.length];
    const current = points[index];
    const previousInside = keepRight
      ? previous[0] >= x
      : previous[0] <= x;
    const currentInside = keepRight ? current[0] >= x : current[0] <= x;

    if (previousInside !== currentInside) {
      const dx = current[0] - previous[0];
      const t = dx === 0 ? 0 : (x - previous[0]) / dx;

      clipped.push([x, previous[1] + (current[1] - previous[1]) * t]);
    }

    if (currentInside) {
      clipped.push([current[0], current[1]]);
    }
  }

  return clipped;
}

/** Убирает повторяющиеся вершины на стыках обрезки. */
function withoutDuplicatePoints(points: readonly Point2[]): Point2[] {
  const cleaned: Point2[] = [];

  for (const point of points) {
    const previous = cleaned[cleaned.length - 1];

    if (
      previous &&
      Math.hypot(point[0] - previous[0], point[1] - previous[1]) <= 1e-9
    ) {
      continue;
    }

    cleaned.push(point);
  }

  const first = cleaned[0];
  const last = cleaned[cleaned.length - 1];

  if (
    first &&
    last &&
    cleaned.length > 1 &&
    Math.hypot(first[0] - last[0], first[1] - last[1]) <= 1e-9
  ) {
    cleaned.pop();
  }

  return cleaned;
}

/** Площадь многоугольника: нужна, чтобы не строить пустую перегородку. */
function polygonArea(points: readonly Point2[]): number {
  let doubled = 0;

  for (let index = 0; index < points.length; index += 1) {
    const [x0, y0] = points[index];
    const [x1, y1] = points[(index + 1) % points.length];

    doubled += x0 * y1 - x1 * y0;
  }

  return Math.abs(doubled) / 2;
}

/** Ширина контура по X: от неё раскладываются центры перегородок. */
function contourWidth(points: readonly Point2[]): number {
  let min = Infinity;
  let max = -Infinity;

  for (const [x] of points) {
    min = Math.min(min, x);
    max = Math.max(max, x);
  }

  return max - min;
}

/**
 * Перегородка как пересечение полости с вертикальной полосой.
 *
 * Полоса задаёт толщину `wall`; верхняя и нижняя границы берутся из внутреннего
 * контура. Поэтому плита не выходит за стенку, даже если хорда на левом и правом
 * краях отличается, и не требует запаса на слияние.
 */
function dividerContour(
  inner: readonly Point2[],
  centerX: number,
  wall: number,
): Point2[] {
  const left = centerX - wall / 2;
  const right = centerX + wall / 2;
  const clipped = withoutDuplicatePoints(
    clipAtX(clipAtX(inner, left, true), right, false),
  );

  return polygonArea(clipped) > 1e-9 ? clipped : [];
}


/**
 * Перегородка с нижней крышкой «от вершины».
 *
 * Обычная веерная крышка идёт от центра и у круга делит с дном лучи
 * «центр — верхняя точка». Эти рёбра совпадают, и проверка замкнутости видит
 * ложные открытые рёбра. Веер от первой вершины даёт ту же плоскость, но без
 * совпадающих лучей; верхняя крышка остаётся обычной.
 */
function addDividerPrism(
  positions: number[],
  points: readonly Point2[],
  z0: number,
  z1: number,
): void {
  addPrismSides(positions, points, z0, z1);
  addFanCap(positions, points, z1, true);

  const [apexX, apexY] = points[0];

  for (let index = 1; index < points.length - 1; index += 1) {
    const [bx, by] = points[index + 1];
    const [cx, cy] = points[index];

    positions.push(apexX, apexY, z0, bx, by, z0, cx, cy, z0);
  }
}


/**
 * Геометрия органайзера для набора параметров.
 *
 * Функция принимает частичные параметры: недостающие поля берутся из значений
 * по умолчанию, поэтому предпросмотр может вызвать её с любым набором.
 */
export function createPenHolderGeometry(
  params: Partial<PenHolderParams>,
): BufferGeometry {
  const normalized = normalizePenHolderParams(params);
  const positions: number[] = [];
  const wall = normalized.penWall;
  const height = normalized.penHeight;
  const { outer, inner } = penContours(
    normalized.penShape,
    normalized.penSize,
    wall,
  );

  // Дно и стенка — одна замкнутая чаша: на стыке нет совпадающих торцов,
  // поэтому объём сетки остаётся объёмом детали и не считает пересечение дважды.
  addCupPrism(positions, outer, inner, PEN_FLOOR_MM, height);

  const interiorWidth = contourWidth(inner);
  const sections = Math.max(1, Math.round(normalized.penSections));
  const dividerTop = height - PEN_DIVIDER_TOP_MARGIN_MM;

  for (let section = 1; section < sections; section += 1) {
    const centerX = -interiorWidth / 2 + (interiorWidth * section) / sections;
    const divider = dividerContour(inner, centerX, wall);

    if (divider.length < 3) {
      continue;
    }

    addDividerPrism(positions, divider, PEN_FLOOR_MM, dividerTop);
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  return geometry;
}
