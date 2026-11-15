import { BufferGeometry, Float32BufferAttribute } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

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
 * гексагональной сетки. Дно сот плоское, а к гребню стенка поднимается по
 * квадрату: край получается резким, без размытого перехода. Край узора
 * отступает от фаски, поэтому кромка остаётся ровной. Объём такой сетки равен
 * аналитическому объёму: двойного учёта пересечений больше нет.
 *
 * Деталь построена Z-вверх; предпросмотр поворачивает меш, как корпус коробки.
 */

/** Толщина бортика по радиусу, мм. */
export const COASTER_RIM_WALL_MM = 3;

/** Насколько бортик выступает над лицом подставки, мм. */
export const COASTER_RIM_RISE_MM = 2.5;

/** Глубина узора на лице, мм. */
export const COASTER_PATTERN_DEPTH_MM = 1.2;

/** Отступ узора от фаски, мм: кромка остаётся ровной. */
export const COASTER_PATTERN_MARGIN_MM = 2;

/** Катет фаски по X/Y и Z, мм: скос идёт ровно под 45°. */
export const COASTER_BEVEL_MM = 1.5;

/** Длина радиальной волны, мм. */
export const COASTER_WAVE_LENGTH_MM = 5;

/** Радиус описанной окружности одной соты, мм. */
export const COASTER_HONEYCOMB_RADIUS_MM = 4.4;

/**
 * Число точек контура: делится на 4 и 6, поэтому квадрат и гекс точные.
 * 288 точек дают шаг около 1 мм по кромке Ø90: стенки сот читаются гранями,
 * а не сливаются в мыло.
 */
const COASTER_CONTOUR_POINTS = 288;

/**
 * Число кольцевых сечений верхней поверхности. Вместе с плотным контуром
 * подставка Ø100 выходит примерно на 60 тысяч треугольников: шаг по радиусу
 * около 0.45 мм, поэтому плоское дно и линейная стенка соты получают несколько
 * рядов вершин и не срезаются грубой сеткой.
 */
const COASTER_SURFACE_RINGS = 100;

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
 * расстояние `q`: 0 в центре, 1 на стенке. Внутри q ≤ 0.635 дно плоское на всю
 * глубину 1.2 мм. Дальше высота растёт линейно до кромки, без smoothstep. На
 * сетке STL Ø100 самая крутая грань стенки выходит 49.7°, то есть в заданном
 * диапазоне 45–50°, а дно остаётся плоским.
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

  // Линейная стенка от плоского дна до гребня: резкая граница дна и грань
  // около 50° вместо плавного скругления, которое делало вощину похожей на волны.
  const wall = clamp((nearestQ - 0.635) / 0.365, 0, 1);

  return COASTER_PATTERN_DEPTH_MM * (1 - wall);
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
    // Впадины волн попадают в сетку точно: глубина 1.2 мм не срезается
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

/** Толщина основания держателя, мм. */
export const COASTER_HOLDER_BASE_THICKNESS_MM = 3;

/** Толщина задней стенки, мм. */
export const COASTER_HOLDER_WALL_THICKNESS_MM = 3;

/** Высота задней стенки от стола, мм. */
export const COASTER_HOLDER_WALL_HEIGHT_MM = 60;

/** Глубина продольного паза, мм: равна толщине основания. */
export const COASTER_HOLDER_GROOVE_DEPTH_MM = 3;

/** Толщина разделителей между подставками, мм. */
export const COASTER_HOLDER_DIVIDER_THICKNESS_MM = 2;

/** Высота разделителей над основанием, мм. */
export const COASTER_HOLDER_DIVIDER_HEIGHT_MM = 15;

/** Посадочный зазор с каждой стороны подставки, мм. */
export const COASTER_HOLDER_SLOT_CLEARANCE_MM = 0.5;

/** Поле основания за крайними разделителями, мм. */
export const COASTER_HOLDER_BASE_MARGIN_MM = 3;

/**
 * Отступ переднего торца перегородки от переднего края основания, мм.
 *
 * Перегородки доходят только до этой границы: передняя часть круглой подставки
 * выступает вперёд и не касается рёбер. Задняя стенка и основание остаются
 * целыми, поэтому жёсткость держателя не меняется.
 */
export const COASTER_HOLDER_DIVIDER_FRONT_CLEARANCE_MM = 15;

/** Запас глубины основания к диаметру подставки, мм. */
export const COASTER_HOLDER_DEPTH_MARGIN_MM = 10;

/**
 * Габариты и посадочные размеры вертикального держателя.
 *
 * Основание лежит в XY, высота идёт по Z. Подставки стоят плоскостями YZ и
 * выстраиваются по X: ширина растёт от числа гнёзд, а глубина равна диаметру
 * подставки плюс 10 мм. Задняя стенка стоит сзади по Y и даёт упор на высоту
 * 60 мм; продольный паз идёт по X через все гнёзда и делится перегородками.
 */
export type CoasterHolderDimensions = {
  /** Ширина основания по X, мм. */
  width: number;
  /** Глубина основания по Y, мм. */
  depth: number;
  /** Общая высота держателя по Z, мм. */
  height: number;
  /** Число гнёзд. */
  count: number;
  /**
   * Толщина подставки по оси паза, мм: плита вместе с бортиком.
   *
   * Бортик поднимается над лицом на 2.5 мм, поэтому именно эта величина, а не
   * `coasterThickness`, определяет ширину паза.
   */
  coasterStackThickness: number;
  /** Ширина гнезда между перегородками, мм. */
  slotWidth: number;
  /** Шаг перегородок: стенка и гнездо, мм. */
  dividerPitch: number;
  /** Зазор подставки с каждой стороны, мм. */
  slotClearance: number;
  /** Ширина паза по Y, мм. */
  grooveWidth: number;
  /** Глубина паза, мм. */
  grooveDepth: number;
  /** Толщина разделителя, мм. */
  dividerThickness: number;
  /** Высота разделителя над основанием, мм. */
  dividerHeight: number;
  /** Толщина основания, мм. */
  baseThickness: number;
  /** Толщина задней стенки, мм. */
  wallThickness: number;
  /** Высота задней стенки, мм. */
  wallHeight: number;
  /** Координата Y переднего торца перегородок, мм. */
  dividerFrontY: number;
  /** Координаты центров гнёзд по X, мм: по ним ставятся подставки в превью. */
  slotCenters: readonly number[];
};

/** Размеры держателя по параметрам подставки. */
export function coasterHolderDimensionsMm(
  params: Partial<CoasterParams>,
): CoasterHolderDimensions {
  const normalized = normalizeCoasterParams(params);
  const count = normalized.coasterCount;
  const coasterStackThickness =
    normalized.coasterThickness +
    (normalized.coasterRim ? COASTER_RIM_RISE_MM : 0);
  const slotWidth =
    coasterStackThickness + COASTER_HOLDER_SLOT_CLEARANCE_MM * 2;
  // В паз входит вся плита вместе с бортиком: при толщине 5 мм и бортике
  // 2.5 мм посадочная толщина равна 7.5 мм, а паз — 8.5 мм. Если считать
  // только `coasterThickness`, бортик врезается в боковые перегородки.
  const grooveWidth = slotWidth;
  const dividerPitch = slotWidth + COASTER_HOLDER_DIVIDER_THICKNESS_MM;
  const width =
    COASTER_HOLDER_BASE_MARGIN_MM * 2 +
    (count + 1) * COASTER_HOLDER_DIVIDER_THICKNESS_MM +
    count * slotWidth;
  const depth = normalized.coasterSize + COASTER_HOLDER_DEPTH_MARGIN_MM;
  const height = Math.max(
    COASTER_HOLDER_WALL_HEIGHT_MM,
    COASTER_HOLDER_BASE_THICKNESS_MM + COASTER_HOLDER_DIVIDER_HEIGHT_MM,
  );
  const firstDivider = -width / 2 + COASTER_HOLDER_BASE_MARGIN_MM;
  const dividerFrontY =
    depth / 2 - COASTER_HOLDER_DIVIDER_FRONT_CLEARANCE_MM;
  const slotCenters = Array.from(
    { length: count },
    (_, index) =>
      firstDivider +
      COASTER_HOLDER_DIVIDER_THICKNESS_MM +
      slotWidth / 2 +
      index * dividerPitch,
  );

  return {
    width,
    depth,
    height,
    count,
    coasterStackThickness,
    slotWidth,
    dividerPitch,
    slotClearance: COASTER_HOLDER_SLOT_CLEARANCE_MM,
    grooveWidth,
    grooveDepth: COASTER_HOLDER_GROOVE_DEPTH_MM,
    dividerThickness: COASTER_HOLDER_DIVIDER_THICKNESS_MM,
    dividerHeight: COASTER_HOLDER_DIVIDER_HEIGHT_MM,
    baseThickness: COASTER_HOLDER_BASE_THICKNESS_MM,
    wallThickness: COASTER_HOLDER_WALL_THICKNESS_MM,
    wallHeight: COASTER_HOLDER_WALL_HEIGHT_MM,
    dividerFrontY,
    slotCenters,
  };
}

/**
 * Положение центра плиты в гнезде держателя, мм.
 *
 * X отсчитывается от центра гнезда: на него сдвигается толщина подставки с
 * бортиком, чтобы зазоры до перегородок были одинаковыми. Z — высота центра
 * плиты над столом; низ стоит ровно на основании.
 */
export function coasterPlacementInHolderMm(
  dimensions: CoasterHolderDimensions,
  coasterSize: number,
): { centerOffsetX: number; centerZ: number } {
  return {
    centerOffsetX: dimensions.coasterStackThickness / 2,
    centerZ: dimensions.baseThickness + coasterSize / 2,
  };
}

/**
 * Сетка высот держателя.
 *
 * Держатель — ступенчатое тело: основание, стенка и перегородки имеют разную
 * высоту, а паз прорезан до стола. Строим его как набор прямоугольных ячеек по
 * X/Y и выпускаем наружу только те грани, у которых соседа нет: внутренние
 * грани не попадают в STL, поэтому тело остаётся замкнутым без двойного объёма.
 */
type CoasterHolderGrid = {
  dims: CoasterHolderDimensions;
  xs: number[];
  ys: number[];
  /** Высота ячейки по строкам Y и столбцам X; 0 — пустота паза. */
  heights: number[][];
  volumeMm3: number;
};

function sortedUnique(values: readonly number[]): number[] {
  return [...new Set(values.map((value) => Number(value.toFixed(6))))].sort(
    (a, b) => a - b,
  );
}

function buildCoasterHolderGrid(
  dims: CoasterHolderDimensions,
): CoasterHolderGrid {
  const left = -dims.width / 2;
  const bottom = -dims.depth / 2;
  const xs: number[] = [left, left + dims.width];
  const dividerBands: [number, number][] = [];

  for (let index = 0; index <= dims.count; index += 1) {
    const start =
      left +
      COASTER_HOLDER_BASE_MARGIN_MM +
      index * dims.dividerPitch;
    const end = start + dims.dividerThickness;

    dividerBands.push([start, end]);
    xs.push(start, end);
  }

  const ys = sortedUnique([
    bottom,
    bottom + dims.wallThickness,
    -dims.grooveWidth / 2,
    dims.grooveWidth / 2,
    dims.dividerFrontY,
    bottom + dims.depth,
  ]);
  const columns = sortedUnique(xs);
  const heights: number[][] = [];
  let volumeMm3 = 0;

  for (let row = 0; row < ys.length - 1; row += 1) {
    const y0 = ys[row];
    const y1 = ys[row + 1];
    const yMid = (y0 + y1) / 2;
    const rowHeights: number[] = [];

    for (let column = 0; column < columns.length - 1; column += 1) {
      const x0 = columns[column];
      const x1 = columns[column + 1];
      const xMid = (x0 + x1) / 2;
      const inWall = yMid < bottom + dims.wallThickness;
      const inDivider =
        yMid <= dims.dividerFrontY &&
        dividerBands.some(
          ([start, end]) => xMid >= start && xMid <= end,
        );
      const inGroove =
        yMid > -dims.grooveWidth / 2 && yMid < dims.grooveWidth / 2;
      const height = inWall
        ? dims.wallHeight
        : inDivider
          ? dims.baseThickness + dims.dividerHeight
          : inGroove
            ? 0
            : dims.baseThickness;

      rowHeights.push(height);
      volumeMm3 += (x1 - x0) * (y1 - y0) * height;
    }

    heights.push(rowHeights);
  }

  return { dims, xs: columns, ys, heights, volumeMm3 };
}


function addHolderTop(
  positions: number[],
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z: number,
): void {
  positions.push(
    x0, y0, z, x1, y0, z, x1, y1, z,
    x0, y0, z, x1, y1, z, x0, y1, z,
  );
}

function addHolderBottom(
  positions: number[],
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z: number,
): void {
  positions.push(
    x0, y0, z, x0, y1, z, x1, y1, z,
    x0, y0, z, x1, y1, z, x1, y0, z,
  );
}

function addHolderWall(
  positions: number[],
  side: "left" | "right" | "back" | "front",
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
): void {
  if (side === "right") {
    positions.push(
      x1, y0, z0, x1, y1, z0, x1, y1, z1,
      x1, y0, z0, x1, y1, z1, x1, y0, z1,
    );
  } else if (side === "left") {
    positions.push(
      x0, y1, z0, x0, y0, z0, x0, y0, z1,
      x0, y1, z0, x0, y0, z1, x0, y1, z1,
    );
  } else if (side === "front") {
    positions.push(
      x1, y1, z0, x0, y1, z0, x0, y1, z1,
      x1, y1, z0, x0, y1, z1, x1, y1, z1,
    );
  } else {
    positions.push(
      x0, y0, z0, x1, y0, z0, x1, y0, z1,
      x0, y0, z0, x1, y0, z1, x0, y0, z1,
    );
  }
}



/**
 * Геометрия вертикального держателя для набора подставок.
 *
 * Деталь отдельная: её сетка не пересекается с подставками и печатается своим
 * файлом. Основание 3 мм, задняя стенка 60 мм, перегородки 2 × 15 мм и
 * продольный паз по толщине подставки вместе с бортиком. Передние торцы
 * перегородок отступают от переднего края на 15 мм: круг выступает вперёд и не
 * упирается в рёбра. Высота ячеек ступенчатая, все стенки вертикальные,
 * поэтому нависаний больше 45° нет и поддержки не нужны.
 */
export function createCoasterHolderGeometry(
  params: Partial<CoasterParams>,
): BufferGeometry {
  const grid = buildCoasterHolderGrid(coasterHolderDimensionsMm(params));
  const layers = sortedUnique([
    0,
    grid.dims.baseThickness,
    grid.dims.baseThickness + grid.dims.dividerHeight,
    grid.dims.height,
  ]);
  const positions: number[] = [];
  const heightAt = (column: number, row: number): number =>
    grid.heights[row]?.[column] ?? 0;

  for (let row = 0; row < grid.ys.length - 1; row += 1) {
    for (let column = 0; column < grid.xs.length - 1; column += 1) {
      const x0 = grid.xs[column];
      const x1 = grid.xs[column + 1];
      const y0 = grid.ys[row];
      const y1 = grid.ys[row + 1];
      const height = heightAt(column, row);

      if (height <= 0) {
        continue;
      }

      addHolderTop(positions, x0, x1, y0, y1, height);
      addHolderBottom(positions, x0, x1, y0, y1, 0);

      for (let layer = 0; layer < layers.length - 1; layer += 1) {
        const z0 = layers[layer];
        const z1 = layers[layer + 1];

        if (height <= z0) {
          break;
        }

        if (heightAt(column + 1, row) <= z0) {
          addHolderWall(positions, "right", x0, x1, y0, y1, z0, z1);
        }

        if (heightAt(column - 1, row) <= z0) {
          addHolderWall(positions, "left", x0, x1, y0, y1, z0, z1);
        }

        if (heightAt(column, row + 1) <= z0) {
          addHolderWall(positions, "front", x0, x1, y0, y1, z0, z1);
        }

        if (heightAt(column, row - 1) <= z0) {
          addHolderWall(positions, "back", x0, x1, y0, y1, z0, z1);
        }
      }
    }
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  return geometry;
}

/** Аналитический объём держателя в мм³: сумма объёмов ступенчатых ячеек. */
export function coasterHolderAnalyticVolumeMm3(
  params: Partial<CoasterParams>,
): number {
  return buildCoasterHolderGrid(
    coasterHolderDimensionsMm(params),
  ).volumeMm3;
}

/** Вес держателя в граммах при заданной плотности пластика. */
export function coasterHolderAnalyticWeightGrams(
  params: Partial<CoasterParams>,
  densityGramsPerCm3: number = PLA_DENSITY_G_PER_CM3,
): number {
  return (
    (coasterHolderAnalyticVolumeMm3(params) / 1000) * densityGramsPerCm3
  );
}

/**
 * Смещение держателя в общем STL набора, мм.
 *
 * В превью подставки стоят в гнёздах, но печатать такую сборку нельзя: стойка
 * спечётся с плитами. В общем файле держатель уезжает на 150 мм по X, а
 * подставка остаётся в начале координат. Даже у самого широкого держателя
 * (8 гнёзд, толщина 10 мм с бортиком) левый край оказывается на X = 84 мм,
 * поэтому зазор до подставки Ø140 остаётся не меньше 14 мм.
 */
export const COASTER_SET_HOLDER_OFFSET_MM = 150;

/**
 * Общий STL набора: одна подставка и держатель, разнесённые по X.
 *
 * Детали лежат на одном столе, но не касаются друг друга. Функция возвращает
 * одну сетку из двух замкнутых оболочек — так же, как собранный литофан, — и
 * сдвигает только держатель. Подставка остаётся в начале координат, чтобы её
 * габарит и точка опоры совпадали с отдельным файлом.
 */
export function createCoasterSetGeometry(
  params: Partial<CoasterParams>,
): BufferGeometry {
  const coasterGeometry = createCoasterGeometry(params);
  const holderGeometry = createCoasterHolderGeometry(params);

  holderGeometry.translate(COASTER_SET_HOLDER_OFFSET_MM, 0, 0);

  const merged = mergeGeometries([coasterGeometry, holderGeometry], false);

  coasterGeometry.dispose();
  holderGeometry.dispose();

  if (!merged) {
    throw new Error("Не удалось собрать общий STL набора подставок.");
  }

  merged.computeBoundingBox();

  return merged;
}
