import { BufferGeometry, Float32BufferAttribute } from "three";

import {
  normalizeBoxParams,
  type BoxParams,
} from "@/lib/constructor/params";

/**
 * Геометрия коробки-органайзера и отдельной крышки.
 *
 * Корпус — один замкнутый лоток: наружные стенки, дно и внутренняя полость
 * описаны общим набором вершин, поэтому между дном и стенками нет щелей.
 * Перегородки — отдельные замкнутые бруски, которые входят в дно и наружные
 * стенки на BOX_JOIN_MM: слайсер объединяет пересекающиеся оболочки при
 * печати, а каждая из них сама по себе watertight.
 *
 * Крышка лежит рядом с корпусом в том же STL. Плита стоит на столе, бортик
 * растёт вверх — так обе детали печатаются без поддержек. Перед установкой
 * крышку переворачивают: бортик опускается снаружи корпуса и не даёт ей
 * скользить, даже если внутри стоят перегородки.
 */

/** Зазор между корпусом и бортиком крышки на сторону, мм. */
export const BOX_LID_CLEARANCE_MM = 0.3;

/** Расстояние между корпусом и крышкой на столе, мм. */
export const BOX_LID_GAP_MM = 10;

/** Минимальная толщина дна и плиты крышки, мм. */
const BOX_MIN_SHEET_MM = 1.2;

/** Высота бортика крышки, мм. */
const BOX_LID_RIM_HEIGHT_MM = 6;

/** Насколько перегородки и бортик входят в соседнюю оболочку, мм. */
const BOX_JOIN_MM = 0.4;

type Point3 = readonly [number, number, number];

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
 * Используется для перегородок и бортика: все шесть граней смотрят наружу,
 * поэтому брусок можно безопасно пересекать с корпусом.
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

/**
 * Один замкнутый лоток: дно, наружные стенки, кромка и внутренняя полость.
 *
 * Четырнадцать граней делят общие вершины, поэтому сетка замкнута по рёбрам.
 * Дно занимает всю наружную площадь и входит в стенки: отдельная плита
 * оставляла бы совпадающие боковые грани, на которых слайсеры спорят о
 * внутренней и наружной стороне.
 */
function addOpenTray(
  positions: number[],
  left: number,
  right: number,
  bottom: number,
  top: number,
  floor: number,
  height: number,
  wall: number,
): void {
  const innerLeft = left + wall;
  const innerRight = right - wall;
  const innerBottom = bottom + wall;
  const innerTop = top - wall;

  const a: Point3 = [left, bottom, 0];
  const b: Point3 = [right, bottom, 0];
  const c: Point3 = [right, top, 0];
  const d: Point3 = [left, top, 0];
  const aTop: Point3 = [left, bottom, height];
  const bTop: Point3 = [right, bottom, height];
  const cTop: Point3 = [right, top, height];
  const dTop: Point3 = [left, top, height];
  const aFloor: Point3 = [innerLeft, innerBottom, floor];
  const bFloor: Point3 = [innerRight, innerBottom, floor];
  const cFloor: Point3 = [innerRight, innerTop, floor];
  const dFloor: Point3 = [innerLeft, innerTop, floor];
  const aInner: Point3 = [innerLeft, innerBottom, height];
  const bInner: Point3 = [innerRight, innerBottom, height];
  const cInner: Point3 = [innerRight, innerTop, height];
  const dInner: Point3 = [innerLeft, innerTop, height];

  addOrientedQuad(positions, a, b, c, d, [0, 0, -1]);
  addOrientedQuad(positions, a, b, bTop, aTop, [0, -1, 0]);
  addOrientedQuad(positions, b, c, cTop, bTop, [1, 0, 0]);
  addOrientedQuad(positions, c, d, dTop, cTop, [0, 1, 0]);
  addOrientedQuad(positions, d, a, aTop, dTop, [-1, 0, 0]);

  addOrientedQuad(positions, aTop, bTop, bInner, aInner, [0, 0, 1]);
  addOrientedQuad(positions, bTop, cTop, cInner, bInner, [0, 0, 1]);
  addOrientedQuad(positions, cTop, dTop, dInner, cInner, [0, 0, 1]);
  addOrientedQuad(positions, dTop, aTop, aInner, dInner, [0, 0, 1]);

  addOrientedQuad(positions, aFloor, bFloor, bInner, aInner, [0, 1, 0]);
  addOrientedQuad(positions, bFloor, cFloor, cInner, bInner, [-1, 0, 0]);
  addOrientedQuad(positions, cFloor, dFloor, dInner, cInner, [0, -1, 0]);
  addOrientedQuad(positions, dFloor, aFloor, aInner, dInner, [1, 0, 0]);

  addOrientedQuad(positions, aFloor, bFloor, cFloor, dFloor, [0, 0, 1]);
}

/**
 * Перегородки по сетке с ячейками разного размера.
 *
 * Массивы `cellsX` и `cellsY` задают пропорции, а не абсолютные миллиметры:
 * из внутреннего размера вычитаются все перегородки, остаток делится между
 * ячейками по их весам. Поэтому сумма массива может не совпадать с корпусом,
 * а толщина перегородок всегда равна `boxWall` — она не масштабируется.
 *
 * Бруски входят в дно и наружные стенки на BOX_JOIN_MM и пересекаются друг с
 * другом в узлах: после объединения не остаётся щелей, а каждая оболочка
 * замкнута отдельно.
 */
function addGridPartitions(
  positions: number[],
  params: BoxParams,
  offsetX: number,
): void {
  const left = offsetX - params.boxLength / 2;
  const right = offsetX + params.boxLength / 2;
  const bottom = -params.boxWidth / 2;
  const top = params.boxWidth / 2;
  const wall = params.boxWall;
  const innerLeft = left + wall;
  const innerRight = right - wall;
  const innerBottom = bottom + wall;
  const innerTop = top - wall;
  const floor = Math.max(wall, BOX_MIN_SHEET_MM);
  const scaleX = cellScale(params.cellsX, innerRight - innerLeft, wall);
  const scaleY = cellScale(params.cellsY, innerTop - innerBottom, wall);
  let cursorX = innerLeft;

  for (let index = 0; index < params.cellsX.length - 1; index += 1) {
    cursorX += params.cellsX[index] * scaleX;

    addBox(
      positions,
      cursorX,
      cursorX + wall,
      innerBottom - BOX_JOIN_MM,
      innerTop + BOX_JOIN_MM,
      floor - BOX_JOIN_MM,
      params.boxHeight,
    );

    cursorX += wall;
  }

  let cursorY = innerBottom;

  for (let index = 0; index < params.cellsY.length - 1; index += 1) {
    cursorY += params.cellsY[index] * scaleY;

    addBox(
      positions,
      innerLeft - BOX_JOIN_MM,
      innerRight + BOX_JOIN_MM,
      cursorY,
      cursorY + wall,
      floor - BOX_JOIN_MM,
      params.boxHeight,
    );

    cursorY += wall;
  }
}

/**
 * Миллиметров на единицу веса ячейки.
 *
 * Перегородки имеют фиксированную толщину, поэтому свободное место — это
 * внутренний размер минус (n − 1) стенок. Если места не осталось, масштаб
 * равен нулю: перегородки сомкнутся, но сетка останется замкнутой.
 */
function cellScale(cells: readonly number[], inner: number, wall: number): number {
  const partitions = Math.max(cells.length - 1, 0) * wall;
  const available = inner - partitions;
  const total = cells.reduce((sum, cell) => sum + Math.max(cell, 0), 0);

  if (available <= 0 || total <= 0) {
    return 0;
  }

  return available / total;
}

/**
 * Крышка: плита на столе и бортик по периметру.
 *
 * Бортик стоит на плите и входит в неё на BOX_JOIN_MM. Внутренний просвет
 * больше корпуса на два зазора, поэтому после переворота крышка надевается
 * снаружи с люфтом 0.3 мм на сторону. Четыре бруска перекрываются в углах —
 * это дешевле, чем вырезать угол, и сохраняет замкнутость каждой оболочки.
 */
function addLid(
  positions: number[],
  offsetX: number,
  outerLength: number,
  outerWidth: number,
  plateThickness: number,
  rimThickness: number,
): void {
  const left = offsetX - outerLength / 2;
  const right = offsetX + outerLength / 2;
  const bottom = -outerWidth / 2;
  const top = outerWidth / 2;
  const rimTop = plateThickness + BOX_LID_RIM_HEIGHT_MM;
  const rimBottom = plateThickness - BOX_JOIN_MM;

  addBox(
    positions,
    left,
    right,
    bottom,
    top,
    0,
    plateThickness,
  );
  addBox(
    positions,
    left,
    right,
    bottom,
    bottom + rimThickness,
    rimBottom,
    rimTop,
  );
  addBox(
    positions,
    left,
    right,
    top - rimThickness,
    top,
    rimBottom,
    rimTop,
  );
  addBox(
    positions,
    left,
    left + rimThickness,
    bottom + rimThickness - BOX_JOIN_MM,
    top - rimThickness + BOX_JOIN_MM,
    rimBottom,
    rimTop,
  );
  addBox(
    positions,
    right - rimThickness,
    right,
    bottom + rimThickness - BOX_JOIN_MM,
    top - rimThickness + BOX_JOIN_MM,
    rimBottom,
    rimTop,
  );
}

/**
 * Собирает корпус и, если включено, крышку в одну неиндексированную сетку.
 *
 * Габариты корпуса совпадают со слайдерами. Когда крышка есть, обе детали
 * сдвинуты по X так, чтобы общий bounding box был симметричен относительно
 * нуля: камера и контактная тень в предпросмотре остаются по центру.
 */
export function createBoxGeometry(params: Partial<BoxParams>): BufferGeometry {
  const normalized = normalizeBoxParams(params);
  const positions: number[] = [];
  const wall = normalized.boxWall;
  const floor = Math.max(wall, BOX_MIN_SHEET_MM);
  const rimThickness = Math.max(wall, BOX_MIN_SHEET_MM);
  const plateThickness = Math.max(wall, BOX_MIN_SHEET_MM);
  const lidInnerLength = normalized.boxLength + BOX_LID_CLEARANCE_MM * 2;
  const lidInnerWidth = normalized.boxWidth + BOX_LID_CLEARANCE_MM * 2;
  const lidOuterLength = lidInnerLength + rimThickness * 2;
  const lidOuterWidth = lidInnerWidth + rimThickness * 2;
  const boxOffsetX = normalized.hasLid
    ? -(BOX_LID_GAP_MM + lidOuterLength) / 2
    : 0;
  const lidOffsetX =
    boxOffsetX +
    normalized.boxLength / 2 +
    BOX_LID_GAP_MM +
    lidOuterLength / 2;

  addOpenTray(
    positions,
    boxOffsetX - normalized.boxLength / 2,
    boxOffsetX + normalized.boxLength / 2,
    -normalized.boxWidth / 2,
    normalized.boxWidth / 2,
    floor,
    normalized.boxHeight,
    wall,
  );
  addGridPartitions(positions, normalized, boxOffsetX);

  if (normalized.hasLid) {
    addLid(
      positions,
      lidOffsetX,
      lidOuterLength,
      lidOuterWidth,
      plateThickness,
      rimThickness,
    );
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

