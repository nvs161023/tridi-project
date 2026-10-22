import {
  BufferGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Path,
  Shape,
} from "three";

import {
  normalizePlanterParams,
  type PlanterParams,
  type PlanterShape,
} from "@/lib/constructor/params";
import {
  addRingPrism,
  circlePolygon,
  offsetPoints,
  type Point2,
} from "@/lib/constructor/prism-mesh";

/**
 * Геометрия кашпо с дренажом и поддоном.
 *
 * Горшок стоит на столе кромкой стенки, а дно приподнято на PLANTER_JOIN_MM:
 * вода выходит через отверстия вниз и не задерживается под грунтом. Рядом в том
 * же STL печатается поддон — он шире горшка на PLANTER_TRAY_EXTRA_MM, поэтому
 * конденсат и лишняя вода остаются в нём.
 *
 * Стенка горшка — замкнутое кольцо-призма, дно — замкнутая плита с отверстиями.
 * Дно входит в стенку на половину её толщины, а по высоте начинается выше стола:
 * у деталей нет совпадающих плоскостей, и каждая оболочка сама по себе
 * watertight. Булевых операций в проекте нет — слайсер объединяет
 * пересекающиеся тела при печати, как у коробки и клипс.
 *
 * Деталь построена Z-вверх, как её ждёт слайсер. Предпросмотр поворачивает меш
 * так же, как корпус коробки.
 */

/** Зазор между горшком и поддоном на столе, мм. */
const PLANTER_TRAY_GAP_MM = 12;

/** Насколько поддон шире горшка по габариту, мм. */
const PLANTER_TRAY_EXTRA_MM = 16;

/** Высота борта поддона, мм. */
const PLANTER_TRAY_HEIGHT_MM = 14;

/** Толщина стенки поддона, мм. */
const PLANTER_TRAY_WALL_MM = 2.4;

/** Толщина дна поддона, мм. */
const PLANTER_TRAY_FLOOR_MM = 2;

/** Радиус дренажного отверстия, мм: Ø 5 мм пропускает воду и держит грунт. */
const PLANTER_HOLE_RADIUS_MM = 2.5;

/** Сколько отверстий в кольце вокруг центрального, шт. */
const PLANTER_HOLE_RING_COUNT = 6;

/** Запас от края дна до отверстия, мм. */
const PLANTER_HOLE_MARGIN_MM = 1.5;

/** Насколько дно приподнято над столом, мм. */
const PLANTER_JOIN_MM = 0.6;

/** Число сторон круглого сечения: 64 отрезка дают гладкую стенку. */
const PLANTER_ROUND_SIDES = 64;

/** Число сторон сечения по форме: квадрат и шестигранник точные. */
const PLANTER_SIDES: Record<PlanterShape, number> = {
  round: PLANTER_ROUND_SIDES,
  square: 4,
  hex: 6,
};

/**
 * Сечение детали в плане.
 *
 * `acrossFlats` — габарит «под ключ»: расстояние между параллельными гранями.
 * Поэтому радиус описанной окружности многоугольника больше половины габарита, а
 * у круга совпадает с ним. Квадрат повёрнут на 45°: его грани смотрят по осям, и
 * габарит по X и Y одинаковый.
 */
function sectionPolygon(shape: PlanterShape, acrossFlats: number): Point2[] {
  const sides = PLANTER_SIDES[shape];
  const apothem = acrossFlats / 2;
  const radius =
    shape === "round" ? apothem : apothem / Math.cos(Math.PI / sides);
  const start = shape === "square" ? Math.PI / 4 : 0;

  return circlePolygon(radius, sides, start);
}

/**
 * Плита дна: контур с необязательными дренажными отверстиями.
 *
 * Контур и отверстия вырезает `ExtrudeGeometry`: наружная граница — контур
 * горшка, отверстия — окружности, поэтому дно остаётся одной замкнутой деталью.
 * Экструзия начинается от `z0`, а не от нуля: дно приподнято над столом, и его
 * нижняя плоскость не совпадает с нижней плоскостью стенки.
 */
function addFloorPlate(
  positions: number[],
  outline: readonly Point2[],
  holes: readonly Point2[],
  z0: number,
  thickness: number,
): void {
  const shape = new Shape();

  outline.forEach(([x, y], index) => {
    if (index === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  });
  shape.closePath();

  for (const [x, y] of holes) {
    const hole = new Path();

    hole.absarc(x, y, PLANTER_HOLE_RADIUS_MM, 0, Math.PI * 2, false);
    shape.holes.push(hole);
  }

  const plate = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 16,
    depth: thickness,
    steps: 1,
  });
  const position = plate.getAttribute("position");

  for (let index = 0; index < position.count; index += 1) {
    positions.push(
      position.getX(index),
      position.getY(index),
      position.getZ(index) + z0,
    );
  }

  plate.dispose();
}

/**
 * Центры дренажных отверстий.
 *
 * Центральное отверстие есть всегда, кольцо из шести — только если дно
 * достаточно велико: центр каждого отверстия обязан отстоять от края дна на
 * радиус плюс запас, иначе отверстие вышло бы за контур и триангуляция дна
 * развалилась бы. Радиус кольца считается от апофемы: точка на таком расстоянии
 * лежит внутри любой из трёх форм при любом угле.
 */
function drainHoleCenters(plateApothem: number): Point2[] {
  const centers: Point2[] = [[0, 0]];
  const freeApothem =
    plateApothem - PLANTER_HOLE_RADIUS_MM - PLANTER_HOLE_MARGIN_MM;

  if (freeApothem < PLANTER_HOLE_RADIUS_MM * 2.4) {
    return centers;
  }

  // Кольцо держится в середине дна: отверстия остаются под полостью, а не под стенкой.
  const ringRadius = Math.min(freeApothem, plateApothem * 0.52);

  for (let index = 0; index < PLANTER_HOLE_RING_COUNT; index += 1) {
    const angle =
      (Math.PI * 2 * index) / PLANTER_HOLE_RING_COUNT +
      Math.PI / PLANTER_HOLE_RING_COUNT;

    centers.push([ringRadius * Math.cos(angle), ringRadius * Math.sin(angle)]);
  }

  return centers;
}

/**
 * Геометрия кашпо и поддона для набора параметров.
 *
 * Функция принимает частичные параметры: недостающие поля берутся из значений
 * по умолчанию, поэтому предпросмотр может вызвать её с любым набором.
 */
export function createPlanterGeometry(
  params: Partial<PlanterParams>,
): BufferGeometry {
  const normalized = normalizePlanterParams(params);
  const positions: number[] = [];
  const wall = normalized.planterWall;
  const outerApothem = normalized.planterSize / 2;
  const innerApothem = outerApothem - wall;
  const plateApothem = outerApothem - wall / 2;

  const traySize = normalized.planterSize + PLANTER_TRAY_EXTRA_MM;
  const trayInnerApothem = traySize / 2 - PLANTER_TRAY_WALL_MM;

  // Горшок и поддон стоят рядом: пара центрируется по общему габариту.
  const potOffsetX = normalized.planterDrainage
    ? -(traySize + PLANTER_TRAY_GAP_MM) / 2
    : 0;
  const trayOffsetX =
    potOffsetX + (normalized.planterSize + PLANTER_TRAY_GAP_MM + traySize) / 2;

  const potOutline = offsetPoints(
    sectionPolygon(normalized.planterShape, normalized.planterSize),
    potOffsetX,
  );
  const potInner = offsetPoints(
    sectionPolygon(normalized.planterShape, innerApothem * 2),
    potOffsetX,
  );

  addRingPrism(positions, potOutline, potInner, 0, normalized.planterHeight);

  const potFloor = offsetPoints(
    sectionPolygon(normalized.planterShape, plateApothem * 2),
    potOffsetX,
  );
  const holes = normalized.planterDrainage
    ? offsetPoints(drainHoleCenters(plateApothem), potOffsetX)
    : [];

  // Дно той же толщины, что стенка, но выше стола: снизу остаётся выемка.
  addFloorPlate(positions, potFloor, holes, PLANTER_JOIN_MM, wall);

  if (normalized.planterDrainage) {
    const trayOutline = offsetPoints(
      sectionPolygon(normalized.planterShape, traySize),
      trayOffsetX,
    );
    const trayInner = offsetPoints(
      sectionPolygon(normalized.planterShape, trayInnerApothem * 2),
      trayOffsetX,
    );
    const trayFloor = offsetPoints(
      sectionPolygon(
        normalized.planterShape,
        (trayInnerApothem + PLANTER_TRAY_WALL_MM / 2) * 2,
      ),
      trayOffsetX,
    );

    addRingPrism(
      positions,
      trayOutline,
      trayInner,
      0,
      PLANTER_TRAY_HEIGHT_MM,
    );
    addFloorPlate(
      positions,
      trayFloor,
      [],
      PLANTER_JOIN_MM,
      PLANTER_TRAY_FLOOR_MM,
    );
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  return geometry;
}
