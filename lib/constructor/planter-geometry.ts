import {
  BufferGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Path,
  Shape,
} from "three";

import {
  DEFAULT_PLANTER_PART,
  PLANTER_TRAY_EXTRA_MM,
  PLANTER_TRAY_GAP_MM,
  PLANTER_TRAY_HEIGHT_MM,
  normalizePlanterParams,
  type PlanterParams,
  type PlanterPart,
  type PlanterShape,
} from "@/lib/constructor/params";
import {
  addCupPrism,
  addRingPrism,
  circlePolygon,
  offsetPoints,
  type Point2,
} from "@/lib/constructor/prism-mesh";

/**
 * Геометрия кашпо с дренажом и поддоном.
 *
 * Горшок стоит на столе плоским дном: отверстия проходят сквозь плиту насквозь
 * и открываются в поддон, когда горшок ставят внутрь. Поддон — отдельная чаша с
 * плоским дном; его внешний габарит считается от ширины горшка по самой широкой
 * части, а не от апофемы. Рядом в общем STL детали лежат с зазором
 * `PLANTER_TRAY_GAP_MM`, чтобы принтер не спаял их.
 *
 * Стенка горшка — замкнутое кольцо-призма, дно — замкнутая плита с отверстиями.
 * Дно входит в стенку на половину её толщины, поэтому у деталей нет совпадающих
 * плоскостей и каждая оболочка сама по себе watertight. Булевых операций в
 * проекте нет — слайсер объединяет пересекающиеся тела при печати, как у
 * коробки-органайзера.
 *
 * Деталь построена Z-вверх, как её ждёт слайсер. Предпросмотр поворачивает меш
 * так же, как корпус коробки.
 */

/** Толщина стенки поддона, мм. */
const PLANTER_TRAY_WALL_MM = 2.4;

/** Толщина дна поддона, мм. */
const PLANTER_TRAY_FLOOR_MM = 2;

/** Радиус дренажного отверстия, мм: Ø 5 мм пропускает воду и держит грунт. */
export const PLANTER_DRAIN_HOLE_RADIUS_MM = 2.5;

/** Сколько отверстий в кольце вокруг центрального, шт. */
const PLANTER_HOLE_RING_COUNT = 6;

/** Запас от края дна до отверстия, мм. */
const PLANTER_HOLE_MARGIN_MM = 1.5;

/** Число сторон круглого сечения: 64 отрезка дают гладкую стенку. */
const PLANTER_ROUND_SIDES = 64;

/** Число сторон сечения по форме: квадрат и шестигранник точные. */
const PLANTER_SIDES: Record<PlanterShape, number> = {
  round: PLANTER_ROUND_SIDES,
  square: 4,
  hex: 6,
};

/** Угол первой вершины: квадрат повёрнут гранями по осям. */
function sectionStartAngle(shape: PlanterShape): number {
  return shape === "square" ? Math.PI / 4 : 0;
}

/**
 * Радиус описанной окружности для заданной ширины сечения.
 *
 * Ширина — расстояние между крайними точками по X, то есть габарит по самой
 * широкой части. У шестигранника это расстояние от угла до угла: при запросе
 * 120 мм готовый bbox тоже ровно 120 мм, а не 138.6 мм, как при габарите «под
 * ключ». Круг и квадрат от этого пересчёта не меняются.
 */
function sectionRadiusForWidth(shape: PlanterShape, width: number): number {
  const sides = PLANTER_SIDES[shape];
  const unit = circlePolygon(1, sides, sectionStartAngle(shape));
  const halfWidth = Math.max(...unit.map(([x]) => Math.abs(x)));

  return width / (2 * halfWidth);
}

/** Апофема сечения: расстояние от центра до грани. */
function sectionApothem(shape: PlanterShape, width: number): number {
  return (
    sectionRadiusForWidth(shape, width) * Math.cos(Math.PI / PLANTER_SIDES[shape])
  );
}

/** Сечение по ширине: вершины стоят на окружности нужного радиуса. */
function sectionPolygon(shape: PlanterShape, width: number): Point2[] {
  return circlePolygon(
    sectionRadiusForWidth(shape, width),
    PLANTER_SIDES[shape],
    sectionStartAngle(shape),
  );
}

/**
 * Сечение по апофеме — для внутренней стенки и плиты дна.
 *
 * Уменьшение апофемы на толщину стенки сдвигает каждую грань внутрь ровно на
 * эту толщину. Поэтому стенка получается одинаковой на круге, квадрате и
 * шестиграннике, а не тоньше на углах.
 */
function sectionByApothem(shape: PlanterShape, apothem: number): Point2[] {
  const sides = PLANTER_SIDES[shape];

  return circlePolygon(
    apothem / Math.cos(Math.PI / sides),
    sides,
    sectionStartAngle(shape),
  );
}


/**
 * Плита дна: контур с необязательными дренажными отверстиями.
 *
 * Контур и отверстия вырезает `ExtrudeGeometry`: наружная граница — контур
 * горшка, отверстия — окружности, поэтому дно остаётся одной замкнутой деталью.
 * Плита ставится на `z0 = 0`: её нижняя плоскость лежит на столе, а не висит
 * мостом над полостью. Вода проходит через отверстия вниз, в поддон.
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

    hole.absarc(x, y, PLANTER_DRAIN_HOLE_RADIUS_MM, 0, Math.PI * 2, false);
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
    plateApothem -
    PLANTER_DRAIN_HOLE_RADIUS_MM -
    PLANTER_HOLE_MARGIN_MM;

  if (freeApothem < PLANTER_DRAIN_HOLE_RADIUS_MM * 2.4) {
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
 * Центры дренажных отверстий для набора параметров.
 *
 * Возвращает координаты в системе отдельного горшка без смещения раскладки:
 * тест и превью могут проверить, что луч из каждого отверстия проходит сквозь
 * дно. Диаметр отверстий — `PLANTER_DRAIN_HOLE_RADIUS_MM * 2`.
 */
export function planterDrainHoleCenters(
  params: Partial<PlanterParams>,
): Point2[] {
  const normalized = normalizePlanterParams(params);
  const plateApothem =
    sectionApothem(normalized.planterShape, normalized.planterSize) -
    normalized.planterWall / 2;

  return drainHoleCenters(plateApothem);
}

/**
 * Горшок в общий массив треугольников.
 *
 * Без дренажа это цельная чаша: дно и стенка — одно тело. С дренажом стенка
 * остаётся кольцом, а плита дна с отверстиями лежит на столе и заходит в стенку
 * на половину толщины. Сквозные отверстия ничем не перекрыты: вода уходит вниз.
 */
function appendPlanterPot(
  positions: number[],
  params: PlanterParams,
  offsetX: number,
): void {
  const shape = params.planterShape;
  const outerApothem = sectionApothem(shape, params.planterSize);
  const outline = offsetPoints(
    sectionPolygon(shape, params.planterSize),
    offsetX,
  );
  const inner = offsetPoints(
    sectionByApothem(shape, outerApothem - params.planterWall),
    offsetX,
  );

  if (!params.planterDrainage) {
    addCupPrism(positions, outline, inner, params.planterWall, params.planterHeight);
    return;
  }

  addRingPrism(positions, outline, inner, 0, params.planterHeight);

  const plateApothem = outerApothem - params.planterWall / 2;
  const plate = offsetPoints(sectionByApothem(shape, plateApothem), offsetX);
  const holes = offsetPoints(drainHoleCenters(plateApothem), offsetX);

  // Дно стоит на Z = 0: первый слой лежит на столе, моста над полостью нет.
  addFloorPlate(positions, plate, holes, 0, params.planterWall);
}

/**
 * Поддон в общий массив треугольников.
 *
 * Это цельная чаша с плоским дном: внешняя стенка от стола, внутренняя — от
 * плоскости дна. Внешний габарит считается от ширины горшка, поэтому поддон
 * всегда шире его и не пересекается с ним.
 */
function appendPlanterTray(
  positions: number[],
  params: PlanterParams,
  offsetX: number,
): void {
  const shape = params.planterShape;
  const trayWidth = params.planterSize + PLANTER_TRAY_EXTRA_MM;
  const trayApothem = sectionApothem(shape, trayWidth);
  const outline = offsetPoints(sectionPolygon(shape, trayWidth), offsetX);
  const inner = offsetPoints(
    sectionByApothem(shape, trayApothem - PLANTER_TRAY_WALL_MM),
    offsetX,
  );

  addCupPrism(
    positions,
    outline,
    inner,
    PLANTER_TRAY_FLOOR_MM,
    PLANTER_TRAY_HEIGHT_MM,
  );
}

/** Собирает готовую геометрию из массива позиций без индексов. */
function planterGeometry(positions: number[]): BufferGeometry {
  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  return geometry;
}

/**
 * Только горшок, по центру начала координат.
 *
 * Отдельный файл печатается дном вниз. Если дренаж включён, отверстия сквозные,
 * но поддона в этом файле нет — его скачивают отдельно.
 */
export function createPlanterPotGeometry(
  params: Partial<PlanterParams>,
): BufferGeometry {
  const normalized = normalizePlanterParams(params);
  const positions: number[] = [];

  appendPlanterPot(positions, normalized, 0);

  return planterGeometry(positions);
}

/**
 * Только поддон, по центру начала координат.
 *
 * Поддон существует как отдельная деталь независимо от флага дренажа: API сам
 * отклоняет `tray` без дренажа, а функция остаётся чистой геометрией.
 */
export function createPlanterTrayGeometry(
  params: Partial<PlanterParams>,
): BufferGeometry {
  const normalized = normalizePlanterParams(params);
  const positions: number[] = [];

  appendPlanterTray(positions, normalized, 0);

  return planterGeometry(positions);
}

/**
 * Геометрия кашпо и поддона для набора параметров.
 *
 * Функция принимает частичные параметры: недостающие поля берутся из значений
 * по умолчанию, поэтому предпросмотр может вызвать её с любым набором. `part`
 * выбирает экспорт: `pot` и `tray` центрируют одну деталь, `all` ставит горшок
 * и поддон рядом с зазором `PLANTER_TRAY_GAP_MM`. Пара центрируется по общему
 * габариту, поэтому её bbox симметричен относительно X = 0.
 */
export function createPlanterGeometry(
  params: Partial<PlanterParams>,
  part: PlanterPart = DEFAULT_PLANTER_PART,
): BufferGeometry {
  if (part === "pot") {
    return createPlanterPotGeometry(params);
  }

  if (part === "tray") {
    return createPlanterTrayGeometry(params);
  }

  const normalized = normalizePlanterParams(params);

  if (!normalized.planterDrainage) {
    return createPlanterPotGeometry(normalized);
  }

  const positions: number[] = [];
  const trayWidth = normalized.planterSize + PLANTER_TRAY_EXTRA_MM;
  const potOffsetX = -(trayWidth + PLANTER_TRAY_GAP_MM) / 2;
  const trayOffsetX = (normalized.planterSize + PLANTER_TRAY_GAP_MM) / 2;

  appendPlanterPot(positions, normalized, potOffsetX);
  appendPlanterTray(positions, normalized, trayOffsetX);

  return planterGeometry(positions);
}
