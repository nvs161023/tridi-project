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
  addSlopedCupPrism,
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
 * квадрат — с поворотом на 45°, шестигранник — по описанной окружности, а
 * скруглённый квадрат — по суперэллипсу `|x/a|^4 + |y/a|^4 = 1`.
 * У правильного шестигранника ширина по X и глубина по Y не могут быть равны:
 * при ширине 80 глубина честно получается `80 · √3 / 2 = 69.28` мм.
 *
 * Перегородки вырезаются из внутренней полости по X и повторяют её контур по Y,
 * поэтому не протыкают стенку и занимают всю доступную ширину отделения. Верх
 * перегородки на миллиметр ниже кромки — по краю остаётся ровный борт.
 *
 * Верхняя кромка может быть наклонена: `penRimSlope` задаёт перепад высоты в
 * миллиметрах, передняя сторона опускается, задняя остаётся на `penHeight`.
 * Верх стенок и перегородок считается одной линейной функцией от Y, поэтому
 * срез получается гладкой плоскостью без ступеньки.
 *
 * Деталь построена Z-вверх, как кашпо и коробка: предпросмотр поворачивает меш.
 */

/** Толщина дна, мм: держит вес ручек и не прогибается. */
const PEN_FLOOR_MM = 3;

/** Отступ верха перегородки от кромки, мм: борт остаётся ровным. */
const PEN_DIVIDER_TOP_MARGIN_MM = 1;

/** Число сторон круглого сечения: 64 отрезка дают гладкую стенку. */
const PEN_ROUND_SIDES = 64;

/** Показатель суперэллипса: четыре даёт классический скруглённый квадрат. */
export const PEN_SQUIRCLE_EXPONENT = 4;

/** Число сторон сечения по форме: квадрат и шестигранник точные. */
const PEN_SIDES: Record<PenShape, number> = {
  round: PEN_ROUND_SIDES,
  square: 4,
  hex: 6,
  squircle: PEN_ROUND_SIDES,
};

/** Квадрат повёрнут на 45°, чтобы грани смотрели по осям, как у кашпо. */
const PEN_START_ANGLE: Record<PenShape, number> = {
  round: 0,
  square: Math.PI / 4,
  hex: 0,
  squircle: 0,
};

/**
 * Точки суперэллипса `|x/a|^n + |y/b|^n = 1`.
 *
 * Параметризация `x = a · sign(cos t) · |cos t|^(2/n)` и такая же для Y
 * попадает ровно в крайние точки при `t = 0` и `t = π/2`. Поэтому bbox
 * скруглённого квадрата равен `size × size`, а не чуть меньше, как у
 * описанного многоугольника. Обход идёт против часовой стрелки.
 */
export function superellipsePoints(
  size: number,
  sides = PEN_ROUND_SIDES,
  exponent = PEN_SQUIRCLE_EXPONENT,
): Point2[] {
  const half = size / 2;
  const power = 2 / exponent;
  const points: Point2[] = [];

  for (let index = 0; index < sides; index += 1) {
    const angle = (Math.PI * 2 * index) / sides;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    points.push([
      half * Math.sign(cos) * Math.abs(cos) ** power,
      half * Math.sign(sin) * Math.abs(sin) ** power,
    ]);
  }

  return points;
}

/**
 * Смещает выпуклый контур внутрь по нормали на `distance`.
 *
 * Для суперэллипса нельзя просто уменьшить полуоси: на диагонали нормаль
 * наклонена, и стенка получилась бы тоньше. Нормаль берётся по соседним
 * точкам, поэтому внутренний контур сохраняет ту же параметризацию и толщину
 * по нормали.
 */
function offsetInward(
  points: readonly Point2[],
  distance: number,
): Point2[] {
  const count = points.length;
  const offset: Point2[] = [];

  for (let index = 0; index < count; index += 1) {
    const previous = points[(index + count - 1) % count];
    const next = points[(index + 1) % count];
    const tangentX = next[0] - previous[0];
    const tangentY = next[1] - previous[1];
    const length = Math.hypot(tangentX, tangentY);
    const [x, y] = points[index];

    // Для обхода против часовой стрелки внешняя нормаль — (ty, -tx),
    // значит внутренняя — (-ty, tx).
    offset.push([
      x - (tangentY / length) * distance,
      y + (tangentX / length) * distance,
    ]);
  }

  return offset;
}

/**
 * Внешний и внутренний контуры стаканчика.
 *
 * Радиус считается от габарита по X, а не от апофемы: так круг и шестигранник
 * получают ровно `penSize` по X. Внутренний радиус уменьшен на стенку по
 * нормали: у квадрата и шестигранника это `wall / cos(π / N)`, у круга — `wall`.
 * У скруглённого квадрата внутренний контур смещён по нормали к каждой точке
 * суперэллипса: на диагонали нормаль не совпадает с осью.
 */
function penContours(
  shape: PenShape,
  size: number,
  wall: number,
): { outer: Point2[]; inner: Point2[] } {
  if (shape === "squircle") {
    const outer = superellipsePoints(size);

    return { outer, inner: offsetInward(outer, wall) };
  }

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

/** Глубина контура по Y: у гекса она меньше ширины. */
function contourDepth(points: readonly Point2[]): number {
  let min = Infinity;
  let max = -Infinity;

  for (const [, y] of points) {
    min = Math.min(min, y);
    max = Math.max(max, y);
  }

  return max - min;
}

/**
 * Высота кромки в точке Y.
 *
 * Задняя кромка (`y = +halfDepth`) остаётся на `height`, передняя
 * (`y = -halfDepth`) опускается на `drop`. Между ними высота меняется
 * линейно, поэтому срез — одна плоскость, а не набор ступенек.
 */
function rimHeightAt(
  height: number,
  drop: number,
  halfDepth: number,
  y: number,
): number {
  if (drop <= 0 || halfDepth <= 0) {
    return height;
  }

  const normalized = Math.max(-1, Math.min(1, y / halfDepth));

  return height - (drop * (1 - normalized)) / 2;
}

/**
 * Высота наклонной кромки по параметрам: экспорт для тестов и предпросмотра.
 *
 * Для шестигранника используется его фактическая глубина, а не `penSize`:
 * иначе задняя кромка не поднялась бы до полной высоты и bbox по Z уменьшился.
 */
export function penRimHeightAt(
  params: Partial<PenHolderParams>,
  y: number,
): number {
  const normalized = normalizePenHolderParams(params);

  if (normalized.penRimSlope <= 0) {
    return normalized.penHeight;
  }

  const { outer } = penContours(
    normalized.penShape,
    normalized.penSize,
    normalized.penWall,
  );

  return rimHeightAt(
    normalized.penHeight,
    normalized.penRimSlope,
    contourDepth(outer) / 2,
    y,
  );
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
 * Перегородка с наклонным верхом.
 *
 * Верхняя плоскость повторяет кромку с отступом, поэтому перегородка не
 * выступает над стенкой ни спереди, ни сзади. Крышка строится веером от первой
 * вершины: все её точки лежат на одной наклонной плоскости. Нижняя крышка тоже
 * идёт от вершины, чтобы не делить лучи с дном.
 */
function addSlopedDividerPrism(
  positions: number[],
  points: readonly Point2[],
  z0: number,
  topAt: (x: number, y: number) => number,
): void {
  const count = points.length;
  const topZ = points.map(([x, y]) => topAt(x, y));

  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    const [x0, y0] = points[index];
    const [x1, y1] = points[next];

    positions.push(
      x0,
      y0,
      z0,
      x1,
      y1,
      z0,
      x1,
      y1,
      topZ[next],
      x0,
      y0,
      z0,
      x1,
      y1,
      topZ[next],
      x0,
      y0,
      topZ[index],
    );
  }

  const [apexX, apexY] = points[0];
  const apexTopZ = topZ[0];

  // Верхняя крышка: обход против часовой стрелки, если смотреть сверху.
  for (let index = 1; index < count - 1; index += 1) {
    const [bx, by] = points[index];
    const [cx, cy] = points[index + 1];

    positions.push(
      apexX,
      apexY,
      apexTopZ,
      bx,
      by,
      topZ[index],
      cx,
      cy,
      topZ[index + 1],
    );
  }

  // Нижняя крышка: обратный обход даёт нормаль в −Z.
  for (let index = 1; index < count - 1; index += 1) {
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
  const halfDepth = contourDepth(outer) / 2;
  const rimAt = (_x: number, y: number): number =>
    rimHeightAt(height, normalized.penRimSlope, halfDepth, y);

  // Дно и стенка — одна замкнутая чаша: на стыке нет совпадающих торцов,
  // поэтому объём сетки остаётся объёмом детали и не считает пересечение дважды.
  // При наклоне верх каждой стенки считается по `rimAt`; при нуле остаётся
  // прежняя горизонтальная чаша с тем же числом вершин.
  if (normalized.penRimSlope > 0) {
    addSlopedCupPrism(positions, outer, inner, PEN_FLOOR_MM, rimAt);
  } else {
    addCupPrism(positions, outer, inner, PEN_FLOOR_MM, height);
  }

  const interiorWidth = contourWidth(inner);
  const sections = Math.max(1, Math.round(normalized.penSections));
  const dividerTop = height - PEN_DIVIDER_TOP_MARGIN_MM;
  const dividerTopAt = (_x: number, y: number): number =>
    rimAt(0, y) - PEN_DIVIDER_TOP_MARGIN_MM;

  for (let section = 1; section < sections; section += 1) {
    const centerX = -interiorWidth / 2 + (interiorWidth * section) / sections;
    const divider = dividerContour(inner, centerX, wall);

    if (divider.length < 3) {
      continue;
    }

    if (normalized.penRimSlope > 0) {
      addSlopedDividerPrism(positions, divider, PEN_FLOOR_MM, dividerTopAt);
    } else {
      addDividerPrism(positions, divider, PEN_FLOOR_MM, dividerTop);
    }
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  return geometry;
}
