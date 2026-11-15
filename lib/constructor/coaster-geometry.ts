import { BufferGeometry, Float32BufferAttribute } from "three";

import { PLA_DENSITY_G_PER_CM3 } from "@/lib/constructor/geometry-volume";
import {
  normalizeCoasterParams,
  type CoasterParams,
  type CoasterPattern,
  type CoasterShape,
} from "@/lib/constructor/params";
import {
  addFanCap,
  addPrismSides,
  type Point2,
  type Point3,
} from "@/lib/constructor/prism-mesh";

/**
 * Геометрия подставки под кружку.
 *
 * Подставка — одно замкнутое тело, а не набор пересекающихся оболочек. Низ
 * лежит ровно на Z = 0, поэтому деталь не качается на столе и первый слой
 * целиком опирается на стол. Верхний наружный край срезан фаской 1.5 × 1.5 мм
 * под 45°: она убирает заусенцы и не создаёт нависаний. Необязательный бортик
 * продолжает наружную стенку и собирает конденсат с кружки.
 *
 * Узор — углубление в лице, а не отдельная деталь. Волны и соты задают высоту
 * верхней поверхности синусоидой от радиуса или расстоянием до центров
 * гексагональной сетки. Край узора отступает от фаски, поэтому кромка остаётся
 * ровной. Объём такой сетки равен аналитическому объёму: двойного учёта
 * пересечений больше нет.
 *
 * Деталь построена Z-вверх; предпросмотр поворачивает меш, как корпус коробки.
 */

/** Толщина бортика по радиусу, мм. */
export const COASTER_RIM_WALL_MM = 3;

/** Насколько бортик выступает над лицом подставки, мм. */
export const COASTER_RIM_RISE_MM = 2.5;

/** Глубина узора на лице, мм. */
export const COASTER_PATTERN_DEPTH_MM = 0.8;

/** Отступ узора от фаски, мм: кромка остаётся ровной. */
export const COASTER_PATTERN_MARGIN_MM = 2.2;

/** Катет фаски по X/Y и Z, мм: скос идёт ровно под 45°. */
export const COASTER_BEVEL_MM = 1.5;

/** Длина радиальной волны, мм. */
export const COASTER_WAVE_LENGTH_MM = 5;

/** Радиус описанной окружности одной соты, мм. */
export const COASTER_HONEYCOMB_RADIUS_MM = 4.4;

/** Число точек контура: делится на 4 и 6, поэтому квадрат и гекс точные. */
const COASTER_CONTOUR_POINTS = 96;

/** Число кольцевых сечений верхней поверхности: хватает на волны и соты. */
const COASTER_SURFACE_RINGS = 48;

/** Число сторон исходного многоугольника формы, шт. */
const COASTER_SIDES: Record<CoasterShape, number> = {
  round: COASTER_CONTOUR_POINTS,
  square: 4,
  hex: 6,
};

/** Сетка, построенная вместе с аналитическим объёмом верхней поверхности. */
type CoasterMesh = {
  positions: number[];
  volumeMm3: number;
};

/**
 * Сечение подставки в плане.
 *
 * `acrossFlats` — габарит «под ключ»: расстояние между параллельными гранями.
 * Контур всегда состоит из `COASTER_CONTOUR_POINTS` точек, даже у квадрата и
 * гекса: лишние вершины лежат на сторонах и позволяют верхней поверхности с
 * узором стыковаться с фаской без T-образных щелей. Квадрат повёрнут на 45°,
 * поэтому его грани смотрят по осям.
 */
function sectionPolygon(shape: CoasterShape, acrossFlats: number): Point2[] {
  const apothem = Math.max(acrossFlats, 0) / 2;
  const sides = COASTER_SIDES[shape];
  const step = (Math.PI * 2) / sides;
  const start = shape === "square" ? Math.PI / 4 : 0;
  const points: Point2[] = [];

  for (let index = 0; index < COASTER_CONTOUR_POINTS; index += 1) {
    const angle = (Math.PI * 2 * index) / COASTER_CONTOUR_POINTS;
    let radius = apothem;

    if (shape !== "round") {
      let nearestNormal = 0;
      let nearestDelta = Number.POSITIVE_INFINITY;

      // Нормаль каждой стороны стоит посередине между соседними вершинами.
      for (let side = 0; side < sides; side += 1) {
        const normal = start + (side + 0.5) * step;
        const delta = Math.atan2(
          Math.sin(angle - normal),
          Math.cos(angle - normal),
        );

        if (Math.abs(delta) < Math.abs(nearestDelta)) {
          nearestNormal = normal;
          nearestDelta = delta;
        }
      }

      // Луч из центра до стороны: apothem / cos(угла до нормали).
      radius = apothem / Math.cos(angle - nearestNormal);
    }

    points.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }

  return points;
}

/** Ограничивает значение отрезком. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Плавный переход от 0 к 1 на отрезке [edge0, edge1]. */
function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) {
    return value < edge0 ? 0 : 1;
  }

  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);

  return t * t * (3 - 2 * t);
}

/**
 * Глубина радиальной волны в точке.
 *
 * Фаза растёт от центра к краям, а `(1 - cos) / 2` даёт ровно 0 на гребне и
 * COASTER_PATTERN_DEPTH_MM во впадине. Центр — гребень, поэтому кружка стоит
 * устойчиво, а волны расходятся кольцами.
 */
function waveReliefMm(radius: number): number {
  const phase = (radius / COASTER_WAVE_LENGTH_MM) * Math.PI * 2;

  return COASTER_PATTERN_DEPTH_MM * (0.5 - 0.5 * Math.cos(phase));
}

/**
 * Глубина соты в точке.
 *
 * Центры гексов стоят рядами с шагом `√3·R` по X и `1.5·R` по Y; нечётные ряды
 * сдвинуты на полшага. Для ближайшего центра считается гексагональное
 * расстояние `q`: 0 в центре, 1 на стенке. Внутри q ≤ 0.55 дно плоское на всю
 * глубину, дальше стенка плавно поднимается к общему гребню соседних сот.
 */
function honeycombReliefMm(x: number, y: number): number {
  const radius = COASTER_HONEYCOMB_RADIUS_MM;
  const columnStep = Math.sqrt(3) * radius;
  const rowStep = 1.5 * radius;
  const row = Math.round(y / rowStep);
  let nearestQ = Number.POSITIVE_INFINITY;

  // Соседние ряды и колонки покрывают точку даже на стыке трёх сот.
  for (let rowOffset = -2; rowOffset <= 2; rowOffset += 1) {
    const cellRow = row + rowOffset;
    const rowShift = (Math.abs(cellRow) % 2) * (columnStep / 2);
    const column = Math.round((x - rowShift) / columnStep);

    for (let columnOffset = -2; columnOffset <= 2; columnOffset += 1) {
      const dx = x - ((column + columnOffset) * columnStep + rowShift);
      const dy = y - cellRow * rowStep;
      const q =
        Math.max(
          Math.abs(dx),
          Math.abs(dx / 2 + (Math.sqrt(3) / 2) * dy),
          Math.abs(dx / 2 - (Math.sqrt(3) / 2) * dy),
        ) /
        ((Math.sqrt(3) / 2) * radius);

      nearestQ = Math.min(nearestQ, q);
    }
  }

  return COASTER_PATTERN_DEPTH_MM * (1 - smoothstep(0.55, 1, nearestQ));
}

/** Высота лица в точке: плоская кромка или углубление выбранного узора. */
function faceHeightMm(
  pattern: CoasterPattern,
  x: number,
  y: number,
  radiusFraction: number,
  patternFraction: number,
  faceApothem: number,
  faceZ: number,
): number {
  if (
    pattern === "smooth" ||
    patternFraction <= 0 ||
    radiusFraction >= patternFraction - 1e-9
  ) {
    return faceZ;
  }

  const relief =
    pattern === "waves"
      ? waveReliefMm(radiusFraction * faceApothem)
      : honeycombReliefMm(x, y);

  return faceZ - relief;
}

/**
 * Верхний треугольник с обходом против часовой стрелки.
 *
 * Объём считается интегралом высоты по площади: у тела с низом на Z = 0 и
 * вертикальными стенками вклад даёт только верх. Поэтому та же триангуляция,
 * что попала в сетку, даёт аналитический объём без двойного учёта.
 */
function addTopTriangle(
  mesh: CoasterMesh,
  a: Point3,
  b: Point3,
  c: Point3,
): void {
  mesh.positions.push(...a, ...b, ...c);

  const doubleArea =
    (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);

  mesh.volumeMm3 +=
    (Math.abs(doubleArea) / 2) * ((a[2] + b[2] + c[2]) / 3);
}

/** Верхний четырёхугольник, разбитый на два треугольника. */
function addTopQuad(
  mesh: CoasterMesh,
  a: Point3,
  b: Point3,
  c: Point3,
  d: Point3,
): void {
  addTopTriangle(mesh, a, b, c);
  addTopTriangle(mesh, a, c, d);
}

/** Кольцо между двумя контурами: внутренний обход идёт первым. */
function addTopRing(
  mesh: CoasterMesh,
  inner: readonly Point3[],
  outer: readonly Point3[],
): void {
  const count = inner.length;

  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;

    addTopQuad(mesh, inner[index], outer[index], outer[next], inner[next]);
  }
}

/** Веер от центра к первому кольцу верхней поверхности. */
function addTopFan(
  mesh: CoasterMesh,
  center: Point3,
  ring: readonly Point3[],
): void {
  for (let index = 0; index < ring.length; index += 1) {
    addTopTriangle(mesh, center, ring[index], ring[(index + 1) % ring.length]);
  }
}

/**
 * Вертикальная внутренняя стенка бортика.
 *
 * Материал лежит снаружи, поэтому нормаль смотрит к центру подставки. Объём
 * такая стенка не добавляет: её вклад в интеграл высоты нулевой.
 */
function addInnerWall(
  mesh: CoasterMesh,
  ring: readonly Point2[],
  z0: number,
  z1: number,
): void {
  const count = ring.length;

  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    const [x0, y0] = ring[index];
    const [x1, y1] = ring[next];

    mesh.positions.push(
      x0,
      y0,
      z0,
      x0,
      y0,
      z1,
      x1,
      y1,
      z1,
      x0,
      y0,
      z0,
      x1,
      y1,
      z1,
      x1,
      y1,
      z0,
    );
  }
}

/** Кольцевые сечения верхней поверхности: равномерные плюс край узора. */
function surfaceFractions(
  pattern: CoasterPattern,
  patternFraction: number,
  patternApothem: number,
  faceApothem: number,
): number[] {
  const fractions: number[] = [];

  for (let index = 1; index <= COASTER_SURFACE_RINGS; index += 1) {
    fractions.push(index / COASTER_SURFACE_RINGS);
  }

  if (patternFraction > 0 && patternFraction < 1) {
    fractions.push(patternFraction);
  }

  if (pattern === "waves" && faceApothem > 0) {
    // Впадины волн попадают в сетку точно: глубина 0.8 мм не срезается
    // ближайшим равномерным кольцом.
    for (
      let radius = COASTER_WAVE_LENGTH_MM / 2;
      radius < patternApothem;
      radius += COASTER_WAVE_LENGTH_MM
    ) {
      fractions.push(radius / faceApothem);
    }
  }

  return [...new Set(fractions)].sort((a, b) => a - b);
}

/**
 * Собирает единое тело подставки и аналитический объём его верха.
 *
 * Снизу — плоская крышка на Z = 0, снаружи — вертикальная стенка до фаски,
 * сверху — либо кольцо бортика, либо сразу лицо. Все контуры имеют одинаковое
 * число точек, поэтому соседние поверхности делят рёбра и сетка замкнута.
 */
function buildCoasterMesh(normalized: CoasterParams): CoasterMesh {
  const mesh: CoasterMesh = { positions: [], volumeMm3: 0 };
  const shape = normalized.coasterShape;
  const apothem = normalized.coasterSize / 2;
  const thickness = normalized.coasterThickness;
  const rim = normalized.coasterRim;
  const topZ = thickness + (rim ? COASTER_RIM_RISE_MM : 0);
  const bevel = Math.min(COASTER_BEVEL_MM, apothem * 0.45);
  const shoulderZ = topZ - bevel;
  const outer = sectionPolygon(shape, apothem * 2);
  const insetApothem = apothem - bevel;
  const inset = sectionPolygon(shape, insetApothem * 2);

  // Наружная стенка и плоский низ: обе поверхности начинаются на Z = 0.
  addPrismSides(mesh.positions, outer, 0, shoulderZ);
  addFanCap(mesh.positions, outer, 0, false);

  // Фаска 45°: тот же катет по радиусу и высоте, кромка без заусенцев.
  const outerShoulder: Point3[] = outer.map(([x, y]) => [x, y, shoulderZ]);
  const insetTop: Point3[] = inset.map(([x, y]) => [x, y, topZ]);

  addTopRing(mesh, insetTop, outerShoulder);

  let faceBoundary = inset;
  let faceApothem = insetApothem;

  if (rim) {
    const innerApothem = Math.max(
      0,
      Math.min(insetApothem, apothem - COASTER_RIM_WALL_MM),
    );
    const inner = sectionPolygon(shape, innerApothem * 2);
    const innerTop: Point3[] = inner.map(([x, y]) => [x, y, topZ]);

    addTopRing(mesh, innerTop, insetTop);
    addInnerWall(mesh, inner, thickness, topZ);

    faceBoundary = inner;
    faceApothem = innerApothem;
  }

  const patternApothem = Math.max(0, faceApothem - COASTER_PATTERN_MARGIN_MM);
  const patternFraction =
    faceApothem > 0 ? clamp(patternApothem / faceApothem, 0, 1) : 0;
  const fractions = surfaceFractions(
    normalized.coasterPattern,
    patternFraction,
    patternApothem,
    faceApothem,
  );
  const center: Point3 = [
    0,
    0,
    faceHeightMm(
      normalized.coasterPattern,
      0,
      0,
      0,
      patternFraction,
      faceApothem,
      thickness,
    ),
  ];
  let previous: Point3[] = [];

  for (const [index, fraction] of fractions.entries()) {
    const ring: Point3[] = faceBoundary.map(([x, y]) => {
      const px = x * fraction;
      const py = y * fraction;

      return [
        px,
        py,
        faceHeightMm(
          normalized.coasterPattern,
          px,
          py,
          fraction,
          patternFraction,
          faceApothem,
          thickness,
        ),
      ];
    });

    if (index === 0) {
      addTopFan(mesh, center, ring);
    } else {
      addTopRing(mesh, previous, ring);
    }

    previous = ring;
  }

  return mesh;
}

/**
 * Аналитический объём подставки в мм³.
 *
 * Низ лежит на Z = 0, стенки вертикальные, поэтому объём равен интегралу высоты
 * верхней поверхности по площади. Триангуляция верхней поверхности входит в
 * сетку без изменений, и объём меша совпадает с этим значением: пересекающихся
 * оболочек, которые считались бы дважды, больше нет.
 */
export function coasterAnalyticVolumeMm3(
  params: Partial<CoasterParams>,
): number {
  return buildCoasterMesh(normalizeCoasterParams(params)).volumeMm3;
}

/** Аналитический вес подставки в граммах при заданной плотности. */
export function coasterAnalyticWeightGrams(
  params: Partial<CoasterParams>,
  densityGramsPerCm3: number = PLA_DENSITY_G_PER_CM3,
): number {
  return (coasterAnalyticVolumeMm3(params) / 1000) * densityGramsPerCm3;
}

/**
 * Геометрия подставки под кружку для набора параметров.
 *
 * Функция принимает частичные параметры: недостающие поля берутся из значений
 * по умолчанию, поэтому предпросмотр может вызвать её с любым набором.
 */
export function createCoasterGeometry(
  params: Partial<CoasterParams>,
): BufferGeometry {
  const mesh = buildCoasterMesh(normalizeCoasterParams(params));
  const geometry = new BufferGeometry();

  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(mesh.positions, 3),
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  return geometry;
}
