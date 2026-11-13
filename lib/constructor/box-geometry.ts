import {
  BufferGeometry,
  Float32BufferAttribute,
  ShapeUtils,
  Vector2,
} from "three";

import {
  normalizeBoxParams,
  type BoxParams,
} from "@/lib/constructor/params";

/**
 * Геометрия коробки-органайзера и отдельной крышки.
 *
 * Корпус — один замкнутый лоток со скруглёнными наружными углами: наружная
 * стенка, дно и внутренняя полость описаны общим набором вершин, поэтому
 * между дном и стенками нет щелей. Перегородки — отдельные замкнутые бруски,
 * которые входят в дно и стенки на BOX_JOIN_MM: слайсер объединяет
 * пересекающиеся оболочки при печати, а каждая из них сама по себе watertight.
 *
 * Крышка лежит рядом с корпусом в том же STL. Плита стоит на столе, юбка
 * растёт вверх — так обе детали печатаются без поддержек. Перед установкой
 * крышку переворачивают: плоская глухая сторона становится верхом, а юбка
 * опускается внутрь коробки. Зазор 0.2 мм на сторону даёт плотную посадку,
 * но позволяет снять крышку руками.
 */

/** Зазор между юбкой крышки и внутренней стенкой коробки на сторону, мм. */
export const BOX_LID_CLEARANCE_MM = 0.2;

/** Насколько крышка нависает над коробкой с каждой стороны, мм.
 *  Суммарный габарит крышки — габарит коробки + 2 мм. */
export const BOX_LID_OVERHANG_MM = 1;

/** Расстояние между корпусом и крышкой на столе, мм. */
export const BOX_LID_GAP_MM = 10;

/** Толщина дна коробки, мм. */
export const BOX_FLOOR_THICKNESS_MM = 2;

/** Толщина перегородки, мм. */
export const BOX_DIVIDER_THICKNESS_MM = 1.2;

/** Зазор от верха перегородки до кромки коробки, мм. */
export const BOX_DIVIDER_TOP_GAP_MM = 2;

/** Толщина плоской плиты крышки, мм. */
export const BOX_LID_PLATE_THICKNESS_MM = 2;

/** Толщина внутренней юбки крышки, мм. */
export const BOX_LID_SKIRT_THICKNESS_MM = 1.2;

/**
 * Высота юбки крышки, мм.
 *
 * Перегородки заканчиваются на 2 мм ниже кромки. Юбка 1.6 мм оставляет между
 * своим низом и верхом перегородок 0.4 мм, поэтому крышка садится на корпус,
 * не упираясь в разделители.
 */
export const BOX_LID_SKIRT_HEIGHT_MM = 1.6;

/** Насколько перегородки и юбка входят в соседнюю оболочку, мм. */
const BOX_JOIN_MM = 0.4;

/** Отступ от наружного контура, чтобы брусок не выглянул за скругление. */
const BOX_EDGE_MARGIN_MM = 0.4;

/** Сколько отрезков рисует одна четверть скругления. */
const BOX_CORNER_SEGMENTS = 6;

/** Допуск сравнения координат, мм. */
const EPSILON = 1e-9;

type Point2 = readonly [number, number];
type Point3 = readonly [number, number, number];

/**
 * Добавляет треугольник с нужной лицевой стороной.
 *
 * Треугольники из Earcut приходят без гарантированного обхода: для дна и
 * потолка он зависит от порядка контура. Проверка по нормали разворачивает
 * каждый треугольник отдельно, не полагаясь на догадки о знаке площади.
 */
function addOrientedTriangle(
  positions: number[],
  a: Point3,
  b: Point3,
  c: Point3,
  normal: Point3,
): void {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const flipped = nx * normal[0] + ny * normal[1] + nz * normal[2] < 0;

  if (flipped) {
    positions.push(...a, ...c, ...b);
  } else {
    positions.push(...a, ...b, ...c);
  }
}

/**
 * Добавляет выпуклый четырёхугольник двумя треугольниками.
 *
 * Обход вершин задаётся по периметру, а `normal` говорит, куда должна смотреть
 * лицевая сторона. Если векторное произведение смотрит в другую сторону,
 * порядок разворачивается целиком — иначе один из треугольников лёг бы с
 * нормалью внутрь и объём перестал бы сходиться.
 */
function addOrientedQuad(
  positions: number[],
  a: Point3,
  b: Point3,
  c: Point3,
  d: Point3,
  normal: Point3,
): void {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const flipped = nx * normal[0] + ny * normal[1] + nz * normal[2] < 0;
  const second = flipped ? d : b;
  const fourth = flipped ? b : d;

  positions.push(
    ...a,
    ...second,
    ...c,
    ...a,
    ...c,
    ...fourth,
  );
}

/**
 * Замкнутый прямоугольный брусок.
 *
 * Все шесть граней смотрят наружу, поэтому брусок можно безопасно пересекать
 * с корпусом: слайсер объединит оболочки, а проверка рёбер увидит замкнутый
 * многогранник. Используется для перегородок.
 */
function addBox(
  positions: number[],
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
): void {
  addOrientedQuad(
    positions,
    [x0, y0, z0],
    [x1, y0, z0],
    [x1, y1, z0],
    [x0, y1, z0],
    [0, 0, -1],
  );
  addOrientedQuad(
    positions,
    [x0, y0, z1],
    [x1, y0, z1],
    [x1, y1, z1],
    [x0, y1, z1],
    [0, 0, 1],
  );
  addOrientedQuad(
    positions,
    [x0, y0, z0],
    [x1, y0, z0],
    [x1, y0, z1],
    [x0, y0, z1],
    [0, -1, 0],
  );
  addOrientedQuad(
    positions,
    [x1, y0, z0],
    [x1, y1, z0],
    [x1, y1, z1],
    [x1, y0, z1],
    [1, 0, 0],
  );
  addOrientedQuad(
    positions,
    [x1, y1, z0],
    [x0, y1, z0],
    [x0, y1, z1],
    [x1, y1, z1],
    [0, 1, 0],
  );
  addOrientedQuad(
    positions,
    [x0, y1, z0],
    [x0, y0, z0],
    [x0, y0, z1],
    [x0, y1, z1],
    [-1, 0, 0],
  );
}

/** Добавляет точку, если она не совпадает с предыдущей. */
function pushContourPoint(points: Point2[], point: Point2): void {
  const last = points[points.length - 1];

  if (
    last &&
    Math.abs(last[0] - point[0]) <= EPSILON &&
    Math.abs(last[1] - point[1]) <= EPSILON
  ) {
    return;
  }

  points.push(point);
}

/**
 * Контур прямоугольника со скруглёнными углами против часовой стрелки.
 *
 * Радиус зажимается по половине меньшей стороны: при радиусе 20 на коробке
 * 40 × 40 скругления встречаются и прямоугольник превращается в круг.
 * Совпадающие концы соседних дуг убираются, иначе на круглом контуре
 * появились бы рёбра нулевой длины.
 */
function roundedRectContour(
  centerX: number,
  centerY: number,
  width: number,
  depth: number,
  radius: number,
): Point2[] {
  const halfWidth = Math.max(width, 0) / 2;
  const halfDepth = Math.max(depth, 0) / 2;
  const r = Math.max(0, Math.min(radius, halfWidth, halfDepth));

  if (r <= EPSILON) {
    return [
      [centerX - halfWidth, centerY - halfDepth],
      [centerX + halfWidth, centerY - halfDepth],
      [centerX + halfWidth, centerY + halfDepth],
      [centerX - halfWidth, centerY + halfDepth],
    ];
  }

  const corners = [
    {
      x: halfWidth - r,
      y: -halfDepth + r,
      start: -Math.PI / 2,
      end: 0,
    },
    {
      x: halfWidth - r,
      y: halfDepth - r,
      start: 0,
      end: Math.PI / 2,
    },
    {
      x: -halfWidth + r,
      y: halfDepth - r,
      start: Math.PI / 2,
      end: Math.PI,
    },
    {
      x: -halfWidth + r,
      y: -halfDepth + r,
      start: Math.PI,
      end: Math.PI * 1.5,
    },
  ];
  const points: Point2[] = [];

  for (const corner of corners) {
    for (let step = 0; step <= BOX_CORNER_SEGMENTS; step += 1) {
      const angle =
        corner.start +
        ((corner.end - corner.start) * step) / BOX_CORNER_SEGMENTS;

      pushContourPoint(points, [
        centerX + corner.x + r * Math.cos(angle),
        centerY + corner.y + r * Math.sin(angle),
      ]);
    }
  }

  if (
    points.length > 2 &&
    Math.abs(points[0][0] - points[points.length - 1][0]) <= EPSILON &&
    Math.abs(points[0][1] - points[points.length - 1][1]) <= EPSILON
  ) {
    points.pop();
  }

  return points;
}

/** Треугольники замкнутого контура на заданной высоте. */
function addContourCap(
  positions: number[],
  contour: readonly Point2[],
  z: number,
  normal: Point3,
): void {
  const points = contour.map(([x, y]) => new Vector2(x, y));
  const faces = ShapeUtils.triangulateShape(points, []);

  for (const [a, b, c] of faces) {
    addOrientedTriangle(
      positions,
      [contour[a][0], contour[a][1], z],
      [contour[b][0], contour[b][1], z],
      [contour[c][0], contour[c][1], z],
      normal,
    );
  }
}

/** Точка кольца по индексу: сначала наружный контур, затем внутренний. */
function ringPoint(
  outer: readonly Point2[],
  inner: readonly Point2[],
  index: number,
): Point2 {
  return index < outer.length ? outer[index] : inner[index - outer.length];
}

/** Треугольники кольца между наружным и внутренним контуром. */
function addContourRingCap(
  positions: number[],
  outer: readonly Point2[],
  inner: readonly Point2[],
  z: number,
  normal: Point3,
): void {
  const outerPoints = outer.map(([x, y]) => new Vector2(x, y));
  const innerPoints = inner.map(([x, y]) => new Vector2(x, y));
  const faces = ShapeUtils.triangulateShape(outerPoints, [innerPoints]);

  for (const [a, b, c] of faces) {
    const aPoint = ringPoint(outer, inner, a);
    const bPoint = ringPoint(outer, inner, b);
    const cPoint = ringPoint(outer, inner, c);

    addOrientedTriangle(
      positions,
      [aPoint[0], aPoint[1], z],
      [bPoint[0], bPoint[1], z],
      [cPoint[0], cPoint[1], z],
      normal,
    );
  }
}

/**
 * Боковые грани контура между двумя высотами.
 *
 * Внешний обход идёт против часовой стрелки, поэтому для него наружная нормаль
 * равна (dy, −dx). У внутренней стенки полости нормаль смотрит в полость —
 * противоположный вектор.
 */
function addContourSides(
  positions: number[],
  contour: readonly Point2[],
  z0: number,
  z1: number,
  outward: boolean,
): void {
  for (let index = 0; index < contour.length; index += 1) {
    const current = contour[index];
    const next = contour[(index + 1) % contour.length];
    const dx = next[0] - current[0];
    const dy = next[1] - current[1];
    const normal: Point3 = outward ? [dy, -dx, 0] : [-dy, dx, 0];

    addOrientedQuad(
      positions,
      [current[0], current[1], z0],
      [next[0], next[1], z0],
      [next[0], next[1], z1],
      [current[0], current[1], z1],
      normal,
    );
  }
}

/** Замкнутая призма со скруглённым прямоугольным основанием. */
function addRoundedPrism(
  positions: number[],
  contour: readonly Point2[],
  z0: number,
  z1: number,
): void {
  addContourCap(positions, contour, z0, [0, 0, -1]);
  addContourCap(positions, contour, z1, [0, 0, 1]);
  addContourSides(positions, contour, z0, z1, true);
}

/** Замкнутое кольцо со скруглённым прямоугольным сечением. */
function addRoundedRing(
  positions: number[],
  outer: readonly Point2[],
  inner: readonly Point2[],
  z0: number,
  z1: number,
): void {
  addContourRingCap(positions, outer, inner, z0, [0, 0, -1]);
  addContourRingCap(positions, outer, inner, z1, [0, 0, 1]);
  addContourSides(positions, outer, z0, z1, true);
  addContourSides(positions, inner, z0, z1, false);
}

/**
 * Замкнутый лоток: наружные стенки, дно и полость.
 *
 * Наружный контур идёт от стола до кромки, внутренний — от дна до кромки.
 * Верхнее кольцо между ними закрывает торец стенки, а дно и нижняя крышка
 * замыкают оболочку. Это одна оболочка: у дна и стенки нет стыка, который
 * слайсер мог бы посчитать щелью.
 */
function addTray(
  positions: number[],
  outer: readonly Point2[],
  inner: readonly Point2[],
  height: number,
  floor: number,
): void {
  addContourCap(positions, outer, 0, [0, 0, -1]);
  addContourSides(positions, outer, 0, height, true);
  addContourRingCap(positions, outer, inner, height, [0, 0, 1]);
  addContourSides(positions, inner, floor, height, false);
  addContourCap(positions, inner, floor, [0, 0, 1]);
}

/**
 * Верхняя граница скруглённого прямоугольника при заданном X.
 *
 * Нужна перегородкам: у круглого угла брусок полной глубины выглянул бы
 * наружу. Функция возвращает точный Y дуги, а не bounding box детали.
 */
function roundedRectHalfDepthAtX(
  halfWidth: number,
  halfDepth: number,
  radius: number,
  x: number,
): number {
  const r = Math.max(0, Math.min(radius, halfWidth, halfDepth));

  if (r <= EPSILON) {
    return halfDepth;
  }

  const dx = Math.abs(x) - (halfWidth - r);

  if (dx <= 0) {
    return halfDepth;
  }

  return halfDepth - r + Math.sqrt(Math.max(r * r - dx * dx, 0));
}

/** Правая граница скруглённого прямоугольника при заданном Y. */
function roundedRectHalfWidthAtY(
  halfWidth: number,
  halfDepth: number,
  radius: number,
  y: number,
): number {
  const r = Math.max(0, Math.min(radius, halfWidth, halfDepth));

  if (r <= EPSILON) {
    return halfWidth;
  }

  const dy = Math.abs(y) - (halfDepth - r);

  if (dy <= 0) {
    return halfWidth;
  }

  return halfWidth - r + Math.sqrt(Math.max(r * r - dy * dy, 0));
}

/**
 * Перегородки, монолитные со стенками.
 *
 * Бруски идут от дна на 0.4 мм ниже его верха и входят в стенки на столько же,
 * поэтому после плавления пластика это одно тело. Верх бруска на 2 мм ниже
 * кромки: юбка крышки опускается внутрь на 1.6 мм и не упирается в
 * перегородки. У скруглённых углов длина бруска ограничена наружной дугой —
 * он не выглядывает за корпус.
 */
function addDividers(
  positions: number[],
  params: BoxParams,
  centerX: number,
): void {
  const thickness = BOX_DIVIDER_THICKNESS_MM;
  const halfWidth = params.boxWidth / 2;
  const halfDepth = params.boxDepth / 2;
  const innerHalfWidth = Math.max(halfWidth - params.boxWall, 0);
  const innerHalfDepth = Math.max(halfDepth - params.boxWall, 0);
  const z0 = Math.max(0, BOX_FLOOR_THICKNESS_MM - BOX_JOIN_MM);
  const z1 = params.boxHeight - BOX_DIVIDER_TOP_GAP_MM;

  if (z1 <= z0) {
    return;
  }

  for (let index = 0; index < params.boxDividersX; index += 1) {
    const xCenter =
      centerX -
      innerHalfWidth +
      ((index + 1) * innerHalfWidth * 2) / (params.boxDividersX + 1);
    const x0 = xCenter - thickness / 2;
    const x1 = xCenter + thickness / 2;
    const top = Math.min(
      roundedRectHalfDepthAtX(
        halfWidth,
        halfDepth,
        params.boxCornerRadius,
        x0 - centerX,
      ),
      roundedRectHalfDepthAtX(
        halfWidth,
        halfDepth,
        params.boxCornerRadius,
        x1 - centerX,
      ),
    );
    const yLimit = Math.min(
      innerHalfDepth + BOX_JOIN_MM,
      top - BOX_EDGE_MARGIN_MM,
    );

    if (yLimit > 0) {
      addBox(positions, x0, x1, -yLimit, yLimit, z0, z1);
    }
  }

  for (let index = 0; index < params.boxDividersY; index += 1) {
    const yCenter =
      -innerHalfDepth +
      ((index + 1) * innerHalfDepth * 2) / (params.boxDividersY + 1);
    const y0 = yCenter - thickness / 2;
    const y1 = yCenter + thickness / 2;
    const side = Math.min(
      roundedRectHalfWidthAtY(
        halfWidth,
        halfDepth,
        params.boxCornerRadius,
        y0,
      ),
      roundedRectHalfWidthAtY(
        halfWidth,
        halfDepth,
        params.boxCornerRadius,
        y1,
      ),
    );
    const xLimit = Math.min(
      innerHalfWidth + BOX_JOIN_MM,
      side - BOX_EDGE_MARGIN_MM,
    );

    if (xLimit > 0) {
      addBox(
        positions,
        centerX - xLimit,
        centerX + xLimit,
        y0,
        y1,
        z0,
        z1,
      );
    }
  }
}

/**
 * Отдельная крышка: плоская плита, нависающая на 1 мм, и внутренняя юбка.
 *
 * В печати плита лежит на столе, а юбка растёт вверх. После переворота
 * плоская глухая сторона становится верхом, а юбка входит в коробку с
 * зазором BOX_LID_CLEARANCE_MM. Наружная плита шире корпуса на 2 мм, поэтому
 * её край ложится на кромку стенки и не проваливается внутрь.
 */
function addLid(
  positions: number[],
  params: BoxParams,
  centerX: number,
): void {
  const lidWidth = params.boxWidth + BOX_LID_OVERHANG_MM * 2;
  const lidDepth = params.boxDepth + BOX_LID_OVERHANG_MM * 2;
  const lidRadius =
    params.boxCornerRadius > 0
      ? params.boxCornerRadius + BOX_LID_OVERHANG_MM
      : 0;
  const plate = roundedRectContour(
    centerX,
    0,
    lidWidth,
    lidDepth,
    lidRadius,
  );
  const skirtOuterWidth =
    params.boxWidth - params.boxWall * 2 - BOX_LID_CLEARANCE_MM * 2;
  const skirtOuterDepth =
    params.boxDepth - params.boxWall * 2 - BOX_LID_CLEARANCE_MM * 2;
  const skirtOuterRadius = Math.max(
    params.boxCornerRadius - params.boxWall - BOX_LID_CLEARANCE_MM,
    0,
  );
  const skirtInnerWidth =
    skirtOuterWidth - BOX_LID_SKIRT_THICKNESS_MM * 2;
  const skirtInnerDepth =
    skirtOuterDepth - BOX_LID_SKIRT_THICKNESS_MM * 2;
  const skirtInnerRadius = Math.max(
    skirtOuterRadius - BOX_LID_SKIRT_THICKNESS_MM,
    0,
  );

  addRoundedPrism(positions, plate, 0, BOX_LID_PLATE_THICKNESS_MM);

  if (skirtInnerWidth <= 0 || skirtInnerDepth <= 0) {
    return;
  }

  const skirtOuter = roundedRectContour(
    centerX,
    0,
    skirtOuterWidth,
    skirtOuterDepth,
    skirtOuterRadius,
  );
  const skirtInner = roundedRectContour(
    centerX,
    0,
    skirtInnerWidth,
    skirtInnerDepth,
    skirtInnerRadius,
  );

  addRoundedRing(
    positions,
    skirtOuter,
    skirtInner,
    BOX_LID_PLATE_THICKNESS_MM - BOX_JOIN_MM,
    BOX_LID_PLATE_THICKNESS_MM + BOX_LID_SKIRT_HEIGHT_MM,
  );
}

/**
 * Собирает корпус, перегородки и крышку в одну сетку для предпросмотра и STL.
 *
 * Габарит коробки — boxWidth × boxDepth × boxHeight. Крышка лежит справа с
 * зазором BOX_LID_GAP_MM и имеет габарит на 2 мм больше корпуса. Если крышка
 * выключена, корпус отцентрован по X и Y; иначе вся композиция отцентрована по
 * X, чтобы камера одинаково кадрировала оба варианта.
 */
export function createBoxGeometry(params: Partial<BoxParams>): BufferGeometry {
  const normalized = normalizeBoxParams(params);
  const positions: number[] = [];
  const lidWidth = normalized.boxWidth + BOX_LID_OVERHANG_MM * 2;
  const bodyCenterX = normalized.hasLid
    ? -(BOX_LID_GAP_MM + lidWidth) / 2
    : 0;
  const lidCenterX =
    bodyCenterX + normalized.boxWidth / 2 + BOX_LID_GAP_MM + lidWidth / 2;
  const innerRadius = Math.max(
    normalized.boxCornerRadius - normalized.boxWall,
    0,
  );
  const outer = roundedRectContour(
    bodyCenterX,
    0,
    normalized.boxWidth,
    normalized.boxDepth,
    normalized.boxCornerRadius,
  );
  const inner = roundedRectContour(
    bodyCenterX,
    0,
    normalized.boxWidth - normalized.boxWall * 2,
    normalized.boxDepth - normalized.boxWall * 2,
    innerRadius,
  );

  addTray(
    positions,
    outer,
    inner,
    normalized.boxHeight,
    BOX_FLOOR_THICKNESS_MM,
  );
  addDividers(positions, normalized, bodyCenterX);

  if (normalized.hasLid) {
    addLid(positions, normalized, lidCenterX);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(positions, 3),
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

