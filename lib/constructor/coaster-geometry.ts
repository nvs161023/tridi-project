import { BufferGeometry, Float32BufferAttribute } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { PLA_DENSITY_G_PER_CM3 } from "@/lib/constructor/geometry-volume";
import {
  normalizeCoasterParams,
  type CoasterHolderStyle,
  type CoasterParams,
  type CoasterPattern,
  type CoasterShape,
} from "@/lib/constructor/params";
import { applyCreasedNormals } from "@/lib/constructor/mesh-normals";
import {
  addFanCap,
  addPrismSides,
  addSolidPrism,
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
 * smoothstep: наклон нулевой у обеих границ, поэтому гладкие нормали не дают
 * тёмных рваных полос на стыках ячеек. Край узора отступает от фаски, поэтому
 * кромка остаётся ровной. Объём такой сетки равен аналитическому объёму:
 * двойного учёта пересечений больше нет.
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

/** Площадь выпуклого многоугольника в XY, мм². */
function polygonAreaMm2(points: readonly Point2[]): number {
  let doubleArea = 0;

  for (let index = 0; index < points.length; index += 1) {
    const [x0, y0] = points[index];
    const [x1, y1] = points[(index + 1) % points.length];

    doubleArea += x0 * y1 - x1 * y0;
  }

  return Math.abs(doubleArea) / 2;
}

/** Радиус описанной окружности сечения подставки, мм. */
function sectionOuterRadius(shape: CoasterShape, acrossFlats: number): number {
  return sectionPolygon(shape, acrossFlats).reduce(
    (radius, [x, y]) => Math.max(radius, Math.hypot(x, y)),
    0,
  );
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
 * расстояние `q`: 0 в центре, 1 на стенке. Внутри q ≤ 0.6 дно плоское на всю
 * глубину 1.2 мм. Дальше до q = 0.9 высота поднимается по `smoothstep`: у дна и
 * у гребня наклон нулевой, поэтому граница ячейки не даёт резкой чёрной полосы
 * при гладких нормалях.
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

  // Плоское дно до q = 0.6, затем S-образный подъём до гребня на q = 0.9.
  // smoothstep держит нулевой наклон на обеих границах: стенка не начинается
  // ступенькой и не встречает гребень острым ребром.
  const wall = clamp((nearestQ - 0.6) / 0.3, 0, 1);
  const smoothWall = wall * wall * (3 - 2 * wall);

  return COASTER_PATTERN_DEPTH_MM * (1 - smoothWall);
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
  const normalized = normalizeCoasterParams(params);
  const mesh = buildCoasterMesh(normalized);
  const geometry = new BufferGeometry();

  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(mesh.positions, 3),
  );
  geometry.computeVertexNormals();

  // У сот плоское дно переходит в стенку по smoothstep. Порог 60° сглаживает
  // нормали внутри плавного перехода и оставляет острыми рёбра плиты и фаски,
  // поэтому в предпросмотре и слайсере нет чёрных рваных полос на границах ячеек.
  if (normalized.coasterPattern === "honeycomb") {
    applyCreasedNormals(geometry, 60);
  }

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

/** Толщина круглого основания накопителя, мм. */
export const COASTER_ACCUMULATOR_BASE_THICKNESS_MM = 4;

/** Номинальный диаметр стойки накопителя, мм. */
export const COASTER_ACCUMULATOR_POST_DIAMETER_MM = 6;

/** Число стоек накопителя: треножник под 120°. */
export const COASTER_ACCUMULATOR_POST_COUNT = 3;

/** Отступ центра стойки от края подставки, мм. */
export const COASTER_ACCUMULATOR_POST_RING_CLEARANCE_MM = 2;

/** Запас основания за описанной окружностью подставки, мм. */
export const COASTER_ACCUMULATOR_BASE_MARGIN_MM = 5;

/** Вертикальный зазор между подставками в стопке, мм. */
export const COASTER_ACCUMULATOR_STACK_CLEARANCE_MM = 1.5;

/** Свободная высота над верхней подставкой, мм. */
export const COASTER_ACCUMULATOR_TOP_HEADROOM_MM = 10;

/**
 * Зазор от стойки до края стопки, мм.
 *
 * Стойка номинально стоит на радиусе «радиус подставки + 2», поэтому полный
 * цилиндр Ø6 заходил бы в круг на 1 мм. Внутреннюю сторону стойки срезаем
 * плоской лыской: центр остаётся на месте, наружная дуга касается края
 * основания, а до подставки сохраняется этот зазор.
 */
export const COASTER_ACCUMULATOR_POST_GAP_MM = 0.5;

/**
 * Габариты и посадочные размеры вертикального держателя.
 *
 * Основание лежит в XY, высота идёт по Z. У горизонтальной стойки подставки
 * стоят плоскостями YZ и выстраиваются по X, а у накопителя лежат стопкой по Z
 * между тремя стойками. Поля стоек и стопки заполнены только для накопителя;
 * `slotCenters` пуст, когда стиль вертикальный.
 */
export type CoasterHolderDimensions = {
  /** Стиль держателя, выбранный в панели. */
  style: CoasterHolderStyle;
  /** Ширина основания по X, мм. */
  width: number;
  /** Глубина основания по Y, мм. */
  depth: number;
  /** Общая высота держателя по Z, мм. */
  height: number;
  /** Число подставок в наборе. */
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
  /** Центры стоек накопителя в XY, мм; у горизонтальной стойки пусто. */
  postCenters: readonly Point2[];
  /** Радиус описанной окружности подставки, мм; 0 у горизонтальной стойки. */
  coasterOuterRadius: number;
  /** Номинальный диаметр стойки, мм; 0 у горизонтальной стойки. */
  postDiameter: number;
  /** Радиус установки центров стоек, мм; 0 у горизонтальной стойки. */
  postRingRadius: number;
  /** Высота стойки над основанием, мм; 0 у горизонтальной стойки. */
  postHeight: number;
  /** Шаг подставок в стопке, мм; 0 у горизонтальной стойки. */
  stackPitch: number;
  /** Низ каждой подставки стопки по Z, мм; у горизонтальной стойки пусто. */
  stackBottomZs: readonly number[];
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

  if (normalized.coasterHolderStyle === "vertical") {
    const outerRadius = sectionOuterRadius(
      normalized.coasterShape,
      normalized.coasterSize,
    );
    const baseDiameter =
      (outerRadius + COASTER_ACCUMULATOR_BASE_MARGIN_MM) * 2;
    const postRingRadius =
      outerRadius + COASTER_ACCUMULATOR_POST_RING_CLEARANCE_MM;
    const stackPitch =
      coasterStackThickness + COASTER_ACCUMULATOR_STACK_CLEARANCE_MM;
    const postHeight =
      count * stackPitch + COASTER_ACCUMULATOR_TOP_HEADROOM_MM;
    const baseThickness = COASTER_ACCUMULATOR_BASE_THICKNESS_MM;
    const postCenters = Array.from(
      { length: COASTER_ACCUMULATOR_POST_COUNT },
      (_, index): Point2 => {
        const angle =
          Math.PI / 2 +
          (index * Math.PI * 2) / COASTER_ACCUMULATOR_POST_COUNT;

        return [
          postRingRadius * Math.cos(angle),
          postRingRadius * Math.sin(angle),
        ];
      },
    );
    const stackBottomZs = Array.from(
      { length: count },
      (_, index) => baseThickness + index * stackPitch,
    );

    return {
      style: "vertical",
      width: baseDiameter,
      depth: baseDiameter,
      height: baseThickness + postHeight,
      count,
      coasterStackThickness,
      slotWidth: 0,
      dividerPitch: 0,
      slotClearance: 0,
      grooveWidth: 0,
      grooveDepth: 0,
      dividerThickness: 0,
      dividerHeight: 0,
      baseThickness,
      wallThickness: 0,
      wallHeight: 0,
      dividerFrontY: 0,
      slotCenters: [],
      postCenters,
      coasterOuterRadius: outerRadius,
      postDiameter: COASTER_ACCUMULATOR_POST_DIAMETER_MM,
      postRingRadius,
      postHeight,
      stackPitch,
      stackBottomZs,
    };
  }

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
    style: "horizontal",
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
    postCenters: [],
    coasterOuterRadius: 0,
    postDiameter: 0,
    postRingRadius: 0,
    postHeight: 0,
    stackPitch: 0,
    stackBottomZs: [],
  };
}

/**
 * Сечение стойки накопителя в мировых координатах.
 *
 * Полный круг Ø6 срезан плоскостью со стороны стопки. Центр стойки остаётся на
 * радиусе «радиус подставки + 2», наружная дуга доходит ровно до края основания,
 * а лыска оставляет до подставки зазор `COASTER_ACCUMULATOR_POST_GAP_MM`.
 * Сечение выпуклое, поэтому его можно выдавить той же призмой, что и основание.
 */
function accumulatorPostPolygon(
  dims: CoasterHolderDimensions,
  center: Point2,
): Point2[] {
  const [cx, cy] = center;
  const radius = dims.postDiameter / 2;
  const flatDistance =
    dims.postRingRadius -
    dims.coasterOuterRadius -
    COASTER_ACCUMULATOR_POST_GAP_MM;
  const halfChord = Math.sqrt(
    Math.max(0, radius * radius - flatDistance * flatDistance),
  );
  const start = Math.atan2(-halfChord, -flatDistance);
  const end = Math.atan2(halfChord, -flatDistance);
  const sweep = end - start;
  const steps = Math.max(12, Math.ceil((sweep / (Math.PI * 2)) * 96));
  const angle = Math.atan2(cy, cx);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const points: Point2[] = [];

  for (let index = 0; index <= steps; index += 1) {
    const localAngle = start + (sweep * index) / steps;
    const localX = radius * Math.cos(localAngle);
    const localY = radius * Math.sin(localAngle);

    // local X — наружу от центра основания, local Y — по касательной.
    points.push([
      cx + localX * cos - localY * sin,
      cy + localX * sin + localY * cos,
    ]);
  }

  return points;
}

/** Круглая база накопителя в XY, мм. */
function accumulatorBasePolygon(
  dims: CoasterHolderDimensions,
): Point2[] {
  return sectionPolygon("round", dims.width);
}

/** Аналитический объём накопителя: база и стойки без двойного учёта. */
function accumulatorVolumeMm3(dims: CoasterHolderDimensions): number {
  const baseArea = polygonAreaMm2(accumulatorBasePolygon(dims));
  const postArea = polygonAreaMm2(
    accumulatorPostPolygon(dims, dims.postCenters[0] ?? [0, 0]),
  );

  return (
    baseArea * dims.baseThickness +
    postArea * dims.postHeight * dims.postCenters.length
  );
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
 * Накопитель: круглая база и три стойки, между которыми лежит стопка.
 *
 * Стойки стоят на верхней плоскости основания: их торцы совпадают с базой, а
 * слайсер сливает тела на первом слое. Внутренние лыски стоек повторяют край
 * стопки с зазором 0.5 мм, поэтому подставки проходят между стойками и не
 * режутся ими.
 */
function createCoasterAccumulatorGeometry(
  dims: CoasterHolderDimensions,
): BufferGeometry {
  const positions: number[] = [];
  const baseBottom = 0;
  const baseTop = dims.baseThickness;

  addSolidPrism(
    positions,
    accumulatorBasePolygon(dims),
    baseBottom,
    baseTop,
  );

  for (const center of dims.postCenters) {
    addSolidPrism(
      positions,
      accumulatorPostPolygon(dims, center),
      baseTop,
      baseTop + dims.postHeight,
    );
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  return geometry;
}

/**
 * Геометрия вертикального держателя для набора подставок.
 *
 * Деталь отдельная: её сетка не пересекается с подставками и печатается своим
 * файлом. У горизонтальной стойки основание 3 мм, задняя стенка 60 мм,
 * перегородки 2 × 15 мм и продольный паз по толщине подставки вместе с
 * бортиком. Передние торцы перегородок отступают от переднего края на 15 мм:
 * круг выступает вперёд и не упирается в рёбра. У накопителя база 4 мм и три
 * стойки Ø6 под 120°. В обоих стилях все стенки вертикальные, поэтому
 * нависаний больше 45° нет и поддержки не нужны.
 */
export function createCoasterHolderGeometry(
  params: Partial<CoasterParams>,
): BufferGeometry {
  const dims = coasterHolderDimensionsMm(params);

  if (dims.style === "vertical") {
    return createCoasterAccumulatorGeometry(dims);
  }

  const grid = buildCoasterHolderGrid(dims);
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

/**
 * Аналитический объём держателя в мм³.
 *
 * У горизонтальной стойки это сумма ступенчатых ячеек, у накопителя — база
 * плюс три стойки. Стойки опираются на базу, но не входят в неё, поэтому
 * двойного учёта пересечения нет.
 */
export function coasterHolderAnalyticVolumeMm3(
  params: Partial<CoasterParams>,
): number {
  const dims = coasterHolderDimensionsMm(params);

  return dims.style === "vertical"
    ? accumulatorVolumeMm3(dims)
    : buildCoasterHolderGrid(dims).volumeMm3;
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

/** Минимальный зазор между подставкой и держателем в общем STL, мм. */
export const COASTER_SET_PART_GAP_MM = 15;

/** Стандартное поле печати, под которое рассчитана раскладка набора, мм. */
export const COASTER_SET_BED_MM = 220;

/** Максимальная высота печати для раскладки набора, мм. */
export const COASTER_SET_BED_HEIGHT_MM = 250;

/**
 * Смещение центра держателя в общем STL набора, мм.
 *
 * Это предпочтительная раскладка «подставка и держатель рядом по X»: смещение
 * считается от габарита подставки и ширины держателя, поэтому между деталями
 * остаётся не меньше `COASTER_SET_PART_GAP_MM`. На дефолтном наборе 6 × Ø90
 * получается 105 мм. Если такая раскладка не влезает в поле 220 мм, общий STL
 * автоматически выбирает резервную: держатель за подставкой, по диагонали для
 * накопителя или на боку.
 */
export function coasterSetHolderOffsetMm(
  params: Partial<CoasterParams>,
): number {
  const normalized = normalizeCoasterParams(params);
  const holderWidth = coasterHolderDimensionsMm(normalized).width;
  const coasterWidth = normalized.coasterSize;

  return (
    Math.max(coasterWidth, (coasterWidth + holderWidth) / 2) +
    COASTER_SET_PART_GAP_MM
  );
}

/** Габарит ограничивающего бокса. */
function boxSize(box: {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}): { width: number; depth: number; height: number } {
  return {
    width: box.max.x - box.min.x,
    depth: box.max.y - box.min.y,
    height: box.max.z - box.min.z,
  };
}

/**
 * Радиус описанной вокруг детали окружности в XY, мм.
 *
 * Детали набора стоят в начале координат, поэтому максимальный радиус вершины
 * точнее ограничивающего бокса: у круга он равен радиусу, а не половине
 * диагонали квадрата. По нему раскладка по диагонали разводит круглый
 * накопитель и подставку на безопасное расстояние.
 */
function radialExtentMm(geometry: BufferGeometry): number {
  const position = geometry.getAttribute("position");
  let radius = 0;

  for (let index = 0; index < position.count; index += 1) {
    radius = Math.max(
      radius,
      Math.hypot(position.getX(index), position.getY(index)),
    );
  }

  return radius;
}

/**
 * Общий STL набора: одна подставка и держатель, разнесённые по столу.
 *
 * Детали лежат на одном столе, но не касаются друг друга. Сначала держатель
 * ставится справа по X на `coasterSetHolderOffsetMm`. Если суммарный габарит
 * выходит за 220 мм, он переносится за подставку по Y. Круглый накопитель, у
 * которого широкое основание не оставляет места ни справа, ни сзади, ставится
 * по диагонали: детали расходятся на 15 мм, а общий бокс остаётся в поле. Для
 * остальных наборов, которые не влезают и так, держатель поворачивается на бок,
 * а при необходимости поворачивается и подставка. Во всех вариантах между
 * деталями остаётся 15 мм, низ обеих оболочек лежит на Z = 0, а общий бокс не
 * выходит за 220 × 220 × 250 мм.
 */
export function createCoasterSetGeometry(
  params: Partial<CoasterParams>,
): BufferGeometry {
  const coasterGeometry = createCoasterGeometry(params);
  const holderGeometry = createCoasterHolderGeometry(params);

  coasterGeometry.computeBoundingBox();
  holderGeometry.computeBoundingBox();

  const coasterBox = coasterGeometry.boundingBox;
  const holderBox = holderGeometry.boundingBox;

  if (!coasterBox || !holderBox) {
    coasterGeometry.dispose();
    holderGeometry.dispose();
    throw new Error("Не удалось измерить детали набора подставок.");
  }

  const coaster = boxSize(coasterBox);
  const holder = boxSize(holderBox);
  const holderStyle = coasterHolderDimensionsMm(params).style;
  const bed = COASTER_SET_BED_MM;
  const bedHeight = COASTER_SET_BED_HEIGHT_MM;
  const gap = COASTER_SET_PART_GAP_MM;
  const preferredOffset = coasterSetHolderOffsetMm(params);
  const sideWidth =
    Math.max(
      coasterBox.max.x,
      preferredOffset + holderBox.max.x,
    ) - Math.min(coasterBox.min.x, preferredOffset + holderBox.min.x);
  const sideDepth = Math.max(coaster.depth, holder.depth);
  const sideHeight = Math.max(coaster.height, holder.height);
  const sideFits =
    sideWidth <= bed + 1e-9 &&
    sideDepth <= bed + 1e-9 &&
    sideHeight <= bedHeight + 1e-9;
  const behindFits =
    Math.max(coaster.width, holder.width) <= bed + 1e-9 &&
    coaster.depth + gap + holder.depth <= bed + 1e-9 &&
    sideHeight <= bedHeight + 1e-9;
  const holderOnSideFits =
    Math.max(coaster.width, holder.width) <= bed + 1e-9 &&
    coaster.depth + gap + holder.height <= bed + 1e-9 &&
    Math.max(coaster.height, holder.depth) <= bedHeight + 1e-9;
  const bothOnSideFits =
    Math.max(coaster.depth, holder.width) <= bed + 1e-9 &&
    coaster.width + gap + holder.height <= bed + 1e-9 &&
    Math.max(coaster.height, holder.depth) <= bedHeight + 1e-9;

  // Накопитель не поворачиваем на бок: его стойки должны печататься снизу
  // вверх. Вместо этого разводим круглые детали по диагонали. Радиусы
  // описанных окружностей гарантируют зазор при любом повороте деталей вокруг
  // оси Z, а сдвиг на 45° оставляет широкое основание в поле 220 мм.
  const diagonalShift =
    (radialExtentMm(coasterGeometry) +
      radialExtentMm(holderGeometry) +
      gap) /
    Math.SQRT2;
  const diagonalMinX = Math.min(
    coasterBox.min.x,
    diagonalShift + holderBox.min.x,
  );
  const diagonalMaxX = Math.max(
    coasterBox.max.x,
    diagonalShift + holderBox.max.x,
  );
  const diagonalMinY = Math.min(
    coasterBox.min.y,
    diagonalShift + holderBox.min.y,
  );
  const diagonalMaxY = Math.max(
    coasterBox.max.y,
    diagonalShift + holderBox.max.y,
  );
  const diagonalFits =
    holderStyle === "vertical" &&
    diagonalMaxX - diagonalMinX <= bed + 1e-9 &&
    diagonalMaxY - diagonalMinY <= bed + 1e-9 &&
    sideHeight <= bedHeight + 1e-9;

  if (sideFits) {
    holderGeometry.translate(
      preferredOffset - (holderBox.min.x + holderBox.max.x) / 2,
      0,
      0,
    );
  } else if (behindFits) {
    holderGeometry.translate(
      -(holderBox.min.x + holderBox.max.x) / 2,
      coasterBox.max.y + gap - holderBox.min.y,
      0,
    );
  } else if (diagonalFits) {
    holderGeometry.translate(
      diagonalShift - (holderBox.min.x + holderBox.max.x) / 2,
      diagonalShift - (holderBox.min.y + holderBox.max.y) / 2,
      0,
    );
  } else {
    if (!bothOnSideFits && !holderOnSideFits) {
      coasterGeometry.dispose();
      holderGeometry.dispose();
      throw new Error(
        "Набор подставок не помещается на поле 220 × 220 × 250 мм.",
      );
    }

    if (bothOnSideFits && !holderOnSideFits) {
      coasterGeometry.rotateZ(Math.PI / 2);
      coasterGeometry.computeBoundingBox();
    }

    holderGeometry.rotateX(Math.PI / 2);
    holderGeometry.computeBoundingBox();

    const rotatedHolderBox = holderGeometry.boundingBox;

    if (!rotatedHolderBox) {
      coasterGeometry.dispose();
      holderGeometry.dispose();
      throw new Error("Не удалось измерить повёрнутый держатель набора.");
    }

    coasterGeometry.computeBoundingBox();

    const finalCoasterBox = coasterGeometry.boundingBox;

    if (!finalCoasterBox) {
      coasterGeometry.dispose();
      holderGeometry.dispose();
      throw new Error("Не удалось измерить повёрнутую подставку набора.");
    }

    holderGeometry.translate(
      -(rotatedHolderBox.min.x + rotatedHolderBox.max.x) / 2,
      finalCoasterBox.max.y + gap - rotatedHolderBox.min.y,
      -rotatedHolderBox.min.z,
    );
  }

  const merged = mergeGeometries([coasterGeometry, holderGeometry], false);

  coasterGeometry.dispose();
  holderGeometry.dispose();

  if (!merged) {
    throw new Error("Не удалось собрать общий STL набора подставок.");
  }

  merged.computeBoundingBox();

  return merged;
}
