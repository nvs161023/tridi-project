import {
  BufferGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Path,
  Shape,
} from "three";

import {
  DEFAULT_PLANTER_PART,
  PLANTER_SELF_WATERING_INNER_FLOOR_MM,
  PLANTER_SELF_WATERING_TRAY_HEIGHT_MM,
  PLANTER_SIGHT_TUBE_HEIGHT_MM,
  PLANTER_TRAY_EXTRA_MM,
  PLANTER_TRAY_FLOOR_MM,
  PLANTER_TRAY_GAP_MM,
  PLANTER_TRAY_HEIGHT_MM,
  PLANTER_WICK_HOLE_RADIUS_MM,
  normalizePlanterParams,
  planterFootprint,
  planterLayout,
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
 * Геометрия кашпо с дренажом, поддоном и автополивом.
 *
 * Горшок стоит на столе плоским дном: отверстия проходят сквозь плиту насквозь
 * и открываются в поддон, когда горшок ставят внутрь. Поддон — отдельная чаша с
 * плоским дном; его внешний габарит считается от ширины горшка по самой широкой
 * части, а не от апофемы.
 *
 * Общий STL сначала пробует боковую раскладку с зазором `PLANTER_TRAY_GAP_MM`.
 * Если пара шире 220 мм, горшок ставится на поддон: сверху остаётся только
 * габарит поддона, а детали не пересекаются. У автополива горшок стоит на
 * верхних упорах поддона, поэтому его внутреннее дно оказывается выше уровня
 * воды, а фитиль свисает в резервуар.
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

/** Толщина верхнего упора, на который опирается горшок, мм. */
const PLANTER_TRAY_LEDGE_MM = 4;

/** Сколько упоров держат горшок в поддоне: у шестигранника по одному на грань. */
const PLANTER_HEX_LEDGES = 6;

/** Радиальный заход упора под дно горшка, мм. */
const PLANTER_TRAY_LEDGE_OVERLAP_MM = 6;

/** Полуширина упора по касательной, мм. */
const PLANTER_TRAY_LEDGE_HALF_WIDTH_MM = 10;

/** Стойки под центром дна: поддерживают горшок при печати общего STL. */
const PLANTER_TRAY_POST_COUNT = 4;

/** Радиус стойки поддона, мм. */
const PLANTER_TRAY_POST_RADIUS_MM = 2.4;

/** Насколько стойки отодвинуты от центра, доля апофемы горшка. */
const PLANTER_TRAY_POST_RADIUS_RATIO = 0.55;

/** Внешний радиус смотровой трубки, мм. */
export const PLANTER_SIGHT_TUBE_OUTER_RADIUS_MM = 2.4;

/** Внутренний радиус смотровой трубки: вода видна сверху, мм. */
export const PLANTER_SIGHT_TUBE_INNER_RADIUS_MM = 1.2;

/** Насколько трубка входит в стенку поддона, мм. */
const PLANTER_SIGHT_TUBE_OVERLAP_MM = 1.2;

/** Зазор под нижним торцом трубки: вода заходит в канал, мм. */
export const PLANTER_SIGHT_TUBE_INLET_GAP_MM = 1;

/** Число сторон смотровой трубки. */
const PLANTER_SIGHT_TUBE_SIDES = 20;

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
 * Радиус внутренней стенки в заданном направлении.
 *
 * У многоугольника расстояние до грани меняется от апофемы до радиуса вершины.
 * Для трубки важно поставить её точно между горшком и стенкой поддона на любой
 * форме: формула повторяет контур, а не приближает его кругом.
 */
function sectionInnerRadiusAt(
  shape: PlanterShape,
  width: number,
  wall: number,
  angle: number,
): number {
  if (shape === "round") {
    return width / 2 - wall;
  }

  const sides = PLANTER_SIDES[shape];
  const step = (Math.PI * 2) / sides;
  const firstFaceNormal = sectionStartAngle(shape) + Math.PI / sides;
  const shifted =
    (((angle - firstFaceNormal) % step) + step) % step;
  const deltaFromFace = Math.min(shifted, step - shifted);

  return (sectionApothem(shape, width) - wall) / Math.cos(deltaFromFace);
}

/**
 * Плита дна: контур с необязательными круглыми отверстиями.
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
  holeRadius = PLANTER_DRAIN_HOLE_RADIUS_MM,
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

    hole.absarc(x, y, holeRadius, 0, Math.PI * 2, false);
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

/** Сдвигает по Z только треугольники, добавленные с индекса `start`. */
function shiftZ(positions: number[], start: number, dz: number): void {
  for (let index = start + 2; index < positions.length; index += 3) {
    positions[index] += dz;
  }
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

  if (normalized.planterSelfWatering) {
    return [];
  }

  const plateApothem =
    sectionApothem(normalized.planterShape, normalized.planterSize) -
    normalized.planterWall / 2;

  return drainHoleCenters(plateApothem);
}

/**
 * Центр фитильного отверстия автополива.
 *
 * Одно отверстие Ø 5 мм по центру внутреннего дна: фитиль проходит сквозь
 * десятимиллиметровую плиту и свисает в резервуар поддона.
 */
export function planterWickHoleCenters(
  params: Partial<PlanterParams>,
): Point2[] {
  return normalizePlanterParams(params).planterSelfWatering ? [[0, 0]] : [];
}

/**
 * Горшок в общий массив треугольников.
 *
 * Без дренажа это цельная чаша: дно и стенка — одно тело. С дренажом стенка
 * остаётся кольцом, а плита дна с отверстиями лежит на столе и заходит в стенку
 * на половину толщины. У автополива плита толще: её верх на высоте 10 мм
 * становится внутренним дном, а единственное отверстие — фитильное. Оно
 * сквозное, поэтому вода не заперта в плите.
 */
function appendPlanterPot(
  positions: number[],
  params: PlanterParams,
  offsetX: number,
  offsetZ: number,
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
    const start = positions.length;

    addCupPrism(positions, outline, inner, params.planterWall, params.planterHeight);
    shiftZ(positions, start, offsetZ);
    return;
  }

  addRingPrism(
    positions,
    outline,
    inner,
    offsetZ,
    offsetZ + params.planterHeight,
  );

  const plateApothem = outerApothem - params.planterWall / 2;
  const plate = offsetPoints(sectionByApothem(shape, plateApothem), offsetX);

  if (params.planterSelfWatering) {
    const wick = offsetPoints([[0, 0]], offsetX);

    // Верх плиты на +10 мм — внутреннее дно; ниже остаётся тело для фитиля.
    addFloorPlate(
      positions,
      plate,
      wick,
      offsetZ,
      PLANTER_SELF_WATERING_INNER_FLOOR_MM,
      PLANTER_WICK_HOLE_RADIUS_MM,
    );
    return;
  }

  const holes = offsetPoints(drainHoleCenters(plateApothem), offsetX);

  // Дно стоит на Z = 0: первый слой лежит на столе, моста над полостью нет.
  addFloorPlate(positions, plate, holes, offsetZ, params.planterWall);
}

/** Положение открытой смотровой трубки в системе отдельного поддона. */
export type PlanterSightTube = {
  centerX: number;
  centerY: number;
  outerRadius: number;
  innerRadius: number;
  z0: number;
  z1: number;
};

/**
 * Смотровая трубка автополива сбоку горшка.
 *
 * Трубка стоит в зазоре между горшком и внутренней стенкой поддона. Её низ
 * открыт на дне резервуара, верх — выше кромки: вода поднимается в трубке и
 * уровень виден сверху. Стенка горшка при этом остаётся целой, а трубка входит
 * в стенку поддона только наружным слоем, поэтому резервуар не течёт.
 */
export function planterSightTube(
  params: Partial<PlanterParams>,
  offsetX = 0,
): PlanterSightTube | null {
  const normalized = normalizePlanterParams(params);

  if (!normalized.planterSelfWatering) {
    return null;
  }

  const shape = normalized.planterShape;
  const trayWidth = normalized.planterSize + PLANTER_TRAY_EXTRA_MM;
  const angle = shape === "hex" ? 0 : Math.PI / 4;
  const innerBoundary = sectionInnerRadiusAt(
    shape,
    trayWidth,
    PLANTER_TRAY_WALL_MM,
    angle,
  );
  const centerRadius = innerBoundary - PLANTER_SIGHT_TUBE_OVERLAP_MM;

  return {
    centerX: centerRadius * Math.cos(angle) + offsetX,
    centerY: centerRadius * Math.sin(angle),
    outerRadius: PLANTER_SIGHT_TUBE_OUTER_RADIUS_MM,
    innerRadius: PLANTER_SIGHT_TUBE_INNER_RADIUS_MM,
    z0: PLANTER_TRAY_FLOOR_MM + PLANTER_SIGHT_TUBE_INLET_GAP_MM,
    z1: PLANTER_SIGHT_TUBE_HEIGHT_MM,
  };
}

/**
 * Трубка индикатора — кольцевая призма с открытым сквозным каналом.
 *
 * `addRingPrism` закрывает только торцы стенки, а центральное отверстие
 * остаётся сквозным: вода входит снизу и поднимается к открытому верху. При
 * этом сама трубка — замкнутое тело, поэтому STL остаётся водонепроницаемым.
 */
function addSightTube(
  positions: number[],
  tube: PlanterSightTube,
): void {
  addRingPrism(
    positions,
    offsetPoints(
      circlePolygon(tube.outerRadius, PLANTER_SIGHT_TUBE_SIDES),
      tube.centerX,
      tube.centerY,
    ),
    offsetPoints(
      circlePolygon(tube.innerRadius, PLANTER_SIGHT_TUBE_SIDES),
      tube.centerX,
      tube.centerY,
    ),
    tube.z0,
    tube.z1,
  );
}

/** Верхний упор: прямоугольная пластина от стенки поддона под дно горшка. */
function addTrayLedge(
  positions: number[],
  potApothem: number,
  trayApothem: number,
  angle: number,
  z0: number,
  z1: number,
  offsetX: number,
): void {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const tx = -uy;
  const ty = ux;
  const innerRadius = Math.max(0, potApothem - PLANTER_TRAY_LEDGE_OVERLAP_MM);
  const outerRadius = trayApothem - 0.25;
  const halfWidth = Math.min(
    PLANTER_TRAY_LEDGE_HALF_WIDTH_MM,
    Math.max(4, potApothem * 0.16),
  );

  const point = (radius: number, tangent: number): Point2 => [
    radius * ux + tangent * tx + offsetX,
    radius * uy + tangent * ty,
  ];
  const outline: Point2[] = [
    point(innerRadius, -halfWidth),
    point(outerRadius, -halfWidth),
    point(outerRadius, halfWidth),
    point(innerRadius, halfWidth),
  ];

  addFloorPlate(positions, outline, [], z0, z1 - z0);
}

/**
 * Поддон в общий массив треугольников.
 *
 * Обычный поддон — цельная чаша с плоским дном. У автополива он глубже, сверху
 * появляются упоры под горшок и стойки под центром дна, а сбоку — открытая
 * смотровая трубка. Упоры и стойки входят в чашу, поэтому резервуар остаётся
 * водонепроницаемым: вода может выйти только через открытый верх трубки.
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
  const trayHeight = params.planterSelfWatering
    ? PLANTER_SELF_WATERING_TRAY_HEIGHT_MM
    : PLANTER_TRAY_HEIGHT_MM;

  addCupPrism(
    positions,
    outline,
    inner,
    PLANTER_TRAY_FLOOR_MM,
    trayHeight,
  );

  const potApothem = sectionApothem(shape, params.planterSize);
  const ledgeCount = shape === "hex" ? PLANTER_HEX_LEDGES : 4;
  const ledgeStep = (Math.PI * 2) / ledgeCount;
  const firstLedge = shape === "hex" ? Math.PI / 6 : 0;

  for (let index = 0; index < ledgeCount; index += 1) {
    addTrayLedge(
      positions,
      potApothem,
      trayApothem,
      firstLedge + ledgeStep * index,
      trayHeight - PLANTER_TRAY_LEDGE_MM,
      trayHeight,
      offsetX,
    );
  }

  // Стойки держат центр дна при печати общего файла и не мешают фитилю.
  const postRadius = potApothem * PLANTER_TRAY_POST_RADIUS_RATIO;

  for (let index = 0; index < PLANTER_TRAY_POST_COUNT; index += 1) {
    const angle =
      Math.PI / PLANTER_TRAY_POST_COUNT +
      (Math.PI * 2 * index) / PLANTER_TRAY_POST_COUNT;
    const post = offsetPoints(
      circlePolygon(PLANTER_TRAY_POST_RADIUS_MM, 16),
      Math.cos(angle) * postRadius + offsetX,
      Math.sin(angle) * postRadius,
    );

    addFloorPlate(
      positions,
      post,
      [],
      PLANTER_TRAY_FLOOR_MM,
      trayHeight - PLANTER_TRAY_FLOOR_MM,
    );
  }

  if (!params.planterSelfWatering) {
    return;
  }

  const tube = planterSightTube(params, offsetX);

  if (tube) {
    addSightTube(positions, tube);
  }
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

  appendPlanterPot(positions, normalized, 0, 0);

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
 * выбирает экспорт: `pot` и `tray` центрируют одну деталь, `all` раскладывает
 * пару по `planterLayout`: рядом с зазором 12 мм или горшком на поддоне. Во
 * втором случае по X/Y остаётся габарит поддона, а детали соприкасаются только
 * опорными плоскостями — объёмного пересечения нет.
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
  const layout = planterLayout(normalized);

  if (layout === "separate") {
    // Такой набор API не выдаёт; предпросмотр остаётся хотя бы с горшком.
    return createPlanterPotGeometry(normalized);
  }

  if (layout === "side") {
    const trayWidth = normalized.planterSize + PLANTER_TRAY_EXTRA_MM;
    const potOffsetX = -(trayWidth + PLANTER_TRAY_GAP_MM) / 2;
    const trayOffsetX = (normalized.planterSize + PLANTER_TRAY_GAP_MM) / 2;

    appendPlanterPot(positions, normalized, potOffsetX, 0);
    appendPlanterTray(positions, normalized, trayOffsetX);

    return planterGeometry(positions);
  }

  const footprint = planterFootprint(normalized);

  appendPlanterTray(positions, normalized, 0);
  appendPlanterPot(positions, normalized, 0, footprint.potBottomZ);

  return planterGeometry(positions);
}
