import { BufferGeometry, Float32BufferAttribute } from "three";

import {
  normalizeCoasterParams,
  type CoasterParams,
  type CoasterPattern,
  type CoasterShape,
} from "@/lib/constructor/params";
import {
  addRingPrism,
  addSolidPrism,
  circlePolygon,
  offsetPoints,
  type Point2,
} from "@/lib/constructor/prism-mesh";

/**
 * Геометрия подставки под кружку.
 *
 * Подставка — плита с рельефом на лице и необязательным бортиком по краю.
 * Бортик поднимается на COASTER_RIM_RISE_MM: конденсат с кружки стекает вниз и
 * остаётся на подставке, а не на столе. Рельеф выступает над лицом всего на
 * COASTER_PATTERN_RISE_MM — кружка стоит на нём без качания, зато рисунок видно
 * и на ощупь.
 *
 * Плита и бортик — отдельные замкнутые тела, которые пересекаются: плита входит
 * в бортик на половину его толщины и начинается выше стола, поэтому совпадающих
 * плоскостей нет. Рельеф утоплен в лицо на COASTER_PATTERN_SINK_MM и тоже
 * остаётся замкнутым. Слайсер объединяет тела при печати.
 *
 * Деталь построена Z-вверх; предпросмотр поворачивает меш, как корпус коробки.
 */

/** Толщина бортика по радиусу, мм. */
const COASTER_RIM_WALL_MM = 3;

/** Насколько бортик выступает над лицом подставки, мм. */
const COASTER_RIM_RISE_MM = 2.5;

/** Насколько плита приподнята над столом, мм. */
const COASTER_JOIN_MM = 0.6;

/** Высота рельефа над лицом, мм: меньше миллиметра, чтобы кружка не качалась. */
const COASTER_PATTERN_RISE_MM = 0.4;

/** Глубина, на которую рельеф уходит в плиту, мм: запас на слияние тел. */
const COASTER_PATTERN_SINK_MM = 0.4;

/** Отступ рельефа от края плиты, мм. */
const COASTER_PATTERN_MARGIN_MM = 2.2;

/** Число сторон круглой подставки и точечного рельефа, шт. */
const COASTER_ROUND_SIDES = 64;
const COASTER_DOT_SIDES = 16;

/** Число сторон сечения по форме: квадрат и шестигранник точные. */
const COASTER_SIDES: Record<CoasterShape, number> = {
  round: COASTER_ROUND_SIDES,
  square: 4,
  hex: 6,
};

/**
 * Кольца рельефа в долях от доступного радиуса.
 *
 * Доли, а не миллиметры: на маленькой подставке кольца сжимаются вместе с ней и
 * не сливаются в сплошной круг.
 */
const COASTER_RING_BANDS = [
  { outer: 1, inner: 0.84 },
  { outer: 0.64, inner: 0.48 },
];

/** Точки точечного рельефа: кольца в долях радиуса и число точек в каждом. */
const COASTER_DOT_RINGS = [
  { radius: 0.74, count: 12 },
  { radius: 0.4, count: 6 },
];

/**
 * Сечение подставки в плане.
 *
 * `acrossFlats` — габарит «под ключ». Радиус описанной окружности многоугольника
 * больше половины габарита, у круга совпадает с ним. Квадрат повёрнут на 45°:
 * его грани смотрят по осям, и габарит по X и Y одинаковый.
 */
function sectionPolygon(shape: CoasterShape, acrossFlats: number): Point2[] {
  const sides = COASTER_SIDES[shape];
  const apothem = acrossFlats / 2;
  const radius =
    shape === "round" ? apothem : apothem / Math.cos(Math.PI / sides);
  const start = shape === "square" ? Math.PI / 4 : 0;

  return circlePolygon(radius, sides, start);
}

/**
 * Рельеф на лице подставки.
 *
 * Кольца повторяют форму подставки — у квадратной это квадраты, — а точки
 * остаются цилиндрами. Контуры колец строятся одним и тем же сечением, поэтому у
 * наружного и внутреннего контура совпадает число вершин и кольцо выходит
 * замкнутым. Радиус точки слегка растёт с размером подставки, чтобы рисунок не
 * выглядел одинаково мелким на большой и на маленькой.
 */
function addCoasterPattern(
  positions: number[],
  shape: CoasterShape,
  pattern: CoasterPattern,
  apothem: number,
  z0: number,
  z1: number,
): void {
  if (pattern === "rings") {
    for (const band of COASTER_RING_BANDS) {
      addRingPrism(
        positions,
        sectionPolygon(shape, apothem * band.outer * 2),
        sectionPolygon(shape, apothem * band.inner * 2),
        z0,
        z1,
      );
    }

    return;
  }

  if (pattern !== "dots") {
    return;
  }

  const dotRadius = Math.max(1.2, Math.min(2.2, apothem * 0.06));
  const dot = circlePolygon(dotRadius, COASTER_DOT_SIDES);

  // Центральная точка есть всегда: она закрывает середину, где кольца расходятся.
  addSolidPrism(positions, dot, z0, z1);

  for (const ring of COASTER_DOT_RINGS) {
    for (let index = 0; index < ring.count; index += 1) {
      const angle = (Math.PI * 2 * index) / ring.count;

      addSolidPrism(
        positions,
        offsetPoints(
          dot,
          apothem * ring.radius * Math.cos(angle),
          apothem * ring.radius * Math.sin(angle),
        ),
        z0,
        z1,
      );
    }
  }
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
  const positions: number[] = [];
  const apothem = normalized.coasterSize / 2;
  const thickness = normalized.coasterThickness;
  const rim = normalized.coasterRim;

  // Плита входит в бортик на половину его толщины — так тела сливаются без щели.
  const plateApothem = rim ? apothem - COASTER_RIM_WALL_MM / 2 : apothem;

  // Без бортика плита лежит на столе целиком. С бортиком она приподнята на
  // COASTER_JOIN_MM: снизу остаётся выемка, зато нет совпадающих плоскостей.
  addSolidPrism(
    positions,
    sectionPolygon(normalized.coasterShape, plateApothem * 2),
    rim ? COASTER_JOIN_MM : 0,
    thickness,
  );

  if (rim) {
    addRingPrism(
      positions,
      sectionPolygon(normalized.coasterShape, normalized.coasterSize),
      sectionPolygon(
        normalized.coasterShape,
        (apothem - COASTER_RIM_WALL_MM) * 2,
      ),
      0,
      thickness + COASTER_RIM_RISE_MM,
    );
  }

  addCoasterPattern(
    positions,
    normalized.coasterShape,
    normalized.coasterPattern,
    plateApothem - COASTER_PATTERN_MARGIN_MM,
    thickness - COASTER_PATTERN_SINK_MM,
    thickness + COASTER_PATTERN_RISE_MM,
  );

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  return geometry;
}
