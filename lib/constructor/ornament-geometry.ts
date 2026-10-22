import { BufferGeometry, Float32BufferAttribute } from "three";

import {
  normalizeOrnamentParams,
  type OrnamentParams,
  type OrnamentShape,
} from "@/lib/constructor/params";
import {
  addCylinder,
  addPrismSides,
  circlePolygon,
  type Point2,
  type Point3,
} from "@/lib/constructor/prism-mesh";

/**
 * Геометрия ёлочной игрушки.
 *
 * Тело — поверхность вращения по силуэту: наружная стенка идёт по контрольным
 * точкам формы, внутренняя повторяет её с отступом на толщину стенки. Снизу
 * остаётся широкий открытый край, сверху — короткая шейка с отверстием: деталь
 * печатается краем вниз, без заполнения внутри и без поддержек, потому что
 * стенка наклонена внутрь меньше 45°.
 *
 * Кольцо под ленту — набор коротких цилиндров в вертикальной плоскости. Они
 * входят друг в друга и в шейку на десятые доли миллиметра, поэтому слайсер
 * печатает кольцо одной деталью: булевых операций в конструкторе нет.
 *
 * Деталь построена Z-вверх, как кашпо и коробка; предпросмотр поворачивает меш.
 */

/** Число сторон сечения: 64 отрезка дают ровный силуэт без граней. */
const ORNAMENT_SIDES = 64;

/** Сколько слоёв строится по высоте силуэта: больше — плавнее переход радиусов. */
const ORNAMENT_LAYERS = 40;

/** Сколько сегментов у кольца под ленту, шт. */
const ORNAMENT_LOOP_SEGMENTS = 16;

/** Минимальный радиус полости, мм: тоньше отверстие не пропечатается. */
const ORNAMENT_MIN_CAVITY_MM = 1;

/** Доля высоты под шейку: в ней стоит кольцо и держится лента. */
const ORNAMENT_NECK_RATIO = 0.1;

/** Границы высоты шейки, мм. */
const ORNAMENT_NECK_MIN_MM = 5;
const ORNAMENT_NECK_MAX_MM = 10;

/** Насколько кольцо входит в шейку, мм: без нахлёста деталь распалась бы. */
const ORNAMENT_LOOP_SINK_MM = 2.5;

/**
 * Контрольные точки силуэта: пара «доля высоты, доля радиуса».
 *
 * Радиус задан в долях половины габарита, поэтому одна и та же форма
 * масштабируется слайдером диаметра. У шара и капли самая широкая часть лежит
 * посередине, у колокола — внизу: так он и печатается, раструбом на столе.
 */
const ORNAMENT_PROFILES: Record<
  OrnamentShape,
  readonly (readonly [number, number])[]
> = {
  ball: [
    [0, 0.5],
    [0.1, 0.66],
    [0.25, 0.85],
    [0.4, 0.97],
    [0.52, 1],
    [0.64, 0.98],
    [0.76, 0.88],
    [0.86, 0.72],
    [0.94, 0.52],
    [1, 0.3],
  ],
  drop: [
    [0, 0.46],
    [0.1, 0.68],
    [0.24, 0.88],
    [0.38, 0.99],
    [0.5, 1],
    [0.62, 0.96],
    [0.74, 0.86],
    [0.84, 0.7],
    [0.93, 0.48],
    [1, 0.26],
  ],
  bell: [
    [0, 1],
    [0.08, 0.96],
    [0.2, 0.89],
    [0.36, 0.81],
    [0.52, 0.74],
    [0.68, 0.67],
    [0.82, 0.59],
    [0.92, 0.49],
    [1, 0.34],
  ],
};

/** Кубическая интерполяция Кэтмулла — Рома: у силуэта нет изломов на точках. */
function catmullRom(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
): number {
  const t2 = t * t;
  const t3 = t2 * t;

  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

/**
 * Радиус силуэта в долях половины габарита.
 *
 * Отрезок ищется по доле высоты, поэтому контрольные точки можно расставлять
 * неравномерно. Значение за границами не выходит: крайние точки зажимаются.
 */
function profileRadius(shape: OrnamentShape, t: number): number {
  const points = ORNAMENT_PROFILES[shape];
  const last = points.length - 1;

  if (t <= points[0][0]) {
    return points[0][1];
  }

  if (t >= points[last][0]) {
    return points[last][1];
  }

  let index = 0;

  while (index < last - 1 && t > points[index + 1][0]) {
    index += 1;
  }

  const p0 = points[Math.max(index - 1, 0)][1];
  const p1 = points[index][1];
  const p2 = points[index + 1][1];
  const p3 = points[Math.min(index + 2, last)][1];
  const span = Math.max(points[index + 1][0] - points[index][0], 1e-6);
  const k = Math.min(Math.max((t - points[index][0]) / span, 0), 1);

  return Math.max(catmullRom(p0, p1, p2, p3, k), 0);
}


/**
 * Плоское кольцо-торец между наружным и внутренним контуром.
 *
 * Обходы обоих контуров одинаковые, поэтому порядок вершин задаётся явно:
 * верхний торец смотрит в +Z, нижний — в −Z. Иначе кольцо оказалось бы
 * вывернутым внутрь материала, и оболочка перестала бы быть замкнутой.
 */
function addRingFace(
  positions: number[],
  outer: readonly Point2[],
  inner: readonly Point2[],
  z: number,
  top: boolean,
): void {
  const count = outer.length;

  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    const [ox0, oy0] = outer[index];
    const [ox1, oy1] = outer[next];
    const [ix0, iy0] = inner[index];
    const [ix1, iy1] = inner[next];

    if (top) {
      positions.push(
        ox0,
        oy0,
        z,
        ox1,
        oy1,
        z,
        ix1,
        iy1,
        z,
        ox0,
        oy0,
        z,
        ix1,
        iy1,
        z,
        ix0,
        iy0,
        z,
      );
    } else {
      positions.push(
        ox0,
        oy0,
        z,
        ix1,
        iy1,
        z,
        ox1,
        oy1,
        z,
        ox0,
        oy0,
        z,
        ix0,
        iy0,
        z,
        ix1,
        iy1,
        z,
      );
    }
  }
}

/**
 * Кольцо под ленту в вертикальной плоскости.
 *
 * Кольцо собрано из коротких цилиндров: каждый следующий перекрывает соседа,
 * а нижний сегмент входит в шейку. Отдельные замкнутые тела слайсер объединяет
 * сам, поэтому булевы операции не нужны. Плоскость кольца — XZ: после поворота
 * меша лента проходит слева направо, как на настоящей игрушке.
 */
function addLoop(
  positions: number[],
  bottomZ: number,
  radius: number,
  wire: number,
): void {
  const ring: Point3[] = [];

  for (let index = 0; index < ORNAMENT_LOOP_SEGMENTS; index += 1) {
    const angle = (Math.PI * 2 * index) / ORNAMENT_LOOP_SEGMENTS;

    ring.push([
      radius * Math.cos(angle),
      0,
      bottomZ + radius + radius * Math.sin(angle),
    ]);
  }

  // Нахлёст 0.4 мм: торцы соседних цилиндров не должны встречаться встык,
  // иначе на стыке остаётся щель тоньше слоя печати.
  const overlap = 0.4;

  for (let index = 0; index < ORNAMENT_LOOP_SEGMENTS; index += 1) {
    const start = ring[index];
    const end = ring[(index + 1) % ORNAMENT_LOOP_SEGMENTS];
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const dz = end[2] - start[2];
    const length = Math.max(Math.hypot(dx, dy, dz), 1e-6);
    const k = overlap / length;
    const from: Point3 = [
      start[0] - dx * k,
      start[1] - dy * k,
      start[2] - dz * k,
    ];
    const to: Point3 = [end[0] + dx * k, end[1] + dy * k, end[2] + dz * k];

    addCylinder(positions, from, to, wire, 12);
  }
}

/**
 * Геометрия игрушки для набора параметров.
 *
 * Функция принимает частичные параметры: недостающие поля берутся из значений
 * по умолчанию, поэтому предпросмотр может вызвать её с любым набором.
 */
export function createOrnamentGeometry(
  params: Partial<OrnamentParams>,
): BufferGeometry {
  const normalized = normalizeOrnamentParams(params);
  const positions: number[] = [];
  const radius = normalized.ornamentDiameter / 2;
  const wall = normalized.ornamentWall;
  const height = normalized.ornamentHeight;
  const neckHeight = Math.min(
    Math.max(height * ORNAMENT_NECK_RATIO, ORNAMENT_NECK_MIN_MM),
    ORNAMENT_NECK_MAX_MM,
  );
  const bodyHeight = Math.max(height - neckHeight, height * 0.5);

  /**
   * Слои силуэта от открытого края до шейки.
   *
   * Радиус не может быть меньше стенки плюс минимальная полость: иначе
   * внутренняя поверхность вывернулась бы, и полость игрушки исчезла.
   */
  const layers: { z: number; outer: number }[] = [];

  for (let index = 0; index <= ORNAMENT_LAYERS; index += 1) {
    const t = index / ORNAMENT_LAYERS;

    layers.push({
      z: t * bodyHeight,
      outer: Math.max(
        profileRadius(normalized.ornamentShape, t) * radius,
        wall + ORNAMENT_MIN_CAVITY_MM,
      ),
    });
  }

  const neckRadius = layers[layers.length - 1].outer;

  layers.push({ z: (bodyHeight + height) / 2, outer: neckRadius });
  layers.push({ z: height, outer: neckRadius });

  const rings = layers.map(({ z, outer }) => ({
    z,
    outer: circlePolygon(outer, ORNAMENT_SIDES),
    inner: circlePolygon(
      Math.max(outer - wall, ORNAMENT_MIN_CAVITY_MM),
      ORNAMENT_SIDES,
    ),
  }));

  for (let index = 0; index < rings.length - 1; index += 1) {
    const lower = rings[index];
    const upper = rings[index + 1];

    addPrismSides(positions, lower.outer, lower.z, upper.z);
    // Внутренняя стенка обходится в обратную сторону: нормали смотрят в полость.
    addPrismSides(positions, [...lower.inner].reverse(), lower.z, upper.z);
  }

  addRingFace(positions, rings[0].outer, rings[0].inner, rings[0].z, false);
  addRingFace(
    positions,
    rings[rings.length - 1].outer,
    rings[rings.length - 1].inner,
    height,
    true,
  );

  if (normalized.ornamentLoop) {
    addLoop(
      positions,
      height - ORNAMENT_LOOP_SINK_MM,
      Math.min(Math.max(neckRadius * 0.9, 4), 10),
      Math.min(Math.max(wall * 0.9, 1.2), 2.4),
    );
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();

  return geometry;
}
