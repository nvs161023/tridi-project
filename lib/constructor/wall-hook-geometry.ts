import {
  BufferGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Path,
  Shape,
} from "three";

import {
  normalizeWallHookParams,
  type WallHookParams,
} from "@/lib/constructor/params";
import { addPrismAlongX, roundedRectanglePolygon, type Point2 } from "@/lib/constructor/prism-mesh";

/**
 * Геометрия настенного крючка.
 *
 * Плита приклеивается или прикручивается к стене, а штырь выходит из неё вверх
 * под 45°: на него вешают сумку, ключи или полотенце. Штырь — призма по
 * четырёхугольному сечению в плоскости YZ; его основание утоплено в плиту на
 * миллиметр, поэтому оболочки пересекаются, а не касаются друг друга
 * плоскостями, и слайсер печатает деталь одним куском.
 *
 * Деталь построена в позе печати: плита лежит на столе, штырь поднимается под
 * 45°. Такой наклон печатается без поддержек, а на стене деталь поворачивается
 * на 90°, и штырь смотрит из стены вверх.
 */

/** Толщина плиты в долях ширины: крупная плита не должна быть тонкой. */
const HOOK_PLATE_RATIO = 0.08;

/** Границы толщины плиты, мм. */
const HOOK_PLATE_MIN_MM = 3;
const HOOK_PLATE_MAX_MM = 6;

/** Радиус скругления углов плиты, мм. */
const HOOK_CORNER_MM = 6;

/** Ширина штыря в долях ширины плиты и её границы, мм. */
const HOOK_PIN_RATIO = 0.3;
const HOOK_PIN_MIN_MM = 8;
const HOOK_PIN_MAX_MM = 16;

/**
 * Толщина штыря у основания в долях толщины плиты и её границы, мм.
 *
 * Штырь тоньше 5 мм ломается под весом сумки, толще 9 мм уже не входит в
 * кольцо ключей.
 */
const HOOK_PIN_BASE_RATIO = 1.8;
const HOOK_PIN_BASE_MIN_MM = 5;
const HOOK_PIN_BASE_MAX_MM = 9;

/** Насколько основание штыря утоплено в плиту, мм. */
const HOOK_PIN_EMBED_MM = 1;

/** Диаметр отверстия под саморез, мм: под шуруп 4 мм с запасом. */
const HOOK_SCREW_HOLE_MM = 4.6;

/** Отступ отверстий от верхнего и нижнего торца плиты, мм. */
const HOOK_SCREW_EDGE_MM = 14;

/** Сколько отрезков у окружности отверстия под саморез, шт. */
const HOOK_SCREW_SEGMENTS = 16;

/**
 * Плита на стену: скруглённый контур и отверстия под саморезы.
 */
function addPlate(
  positions: number[],
  width: number,
  height: number,
  thickness: number,
  screwHoles: readonly Point2[],
): void {
  const shape = new Shape();

  roundedRectanglePolygon(width, height, HOOK_CORNER_MM).forEach(([x, y], index) => {
    if (index === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  });
  shape.closePath();

  for (const [x, y] of screwHoles) {
    const hole = new Path();

    hole.absarc(x, y, HOOK_SCREW_HOLE_MM / 2, 0, Math.PI * 2, false);
    shape.holes.push(hole);
  }

  const plate = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: HOOK_SCREW_SEGMENTS,
    depth: thickness,
    steps: 1,
  });
  const position = plate.getAttribute("position");

  for (let index = 0; index < position.count; index += 1) {
    positions.push(
      position.getX(index),
      position.getY(index),
      position.getZ(index),
    );
  }

  plate.dispose();
}

/**
 * Штырь крючка: призма по сечению в плоскости YZ.
 *
 * Сечение — параллелограмм: основание лежит внутри плиты, а боковые грани идут
 * вверх под 45°. Вынос штыря из плиты равен `depth`, поэтому на стене крючок
 * выступает ровно на заданную величину и на столько же поднимается вверх.
 */
function addPin(
  positions: number[],
  depth: number,
  pinWidth: number,
  pinBase: number,
  plateThickness: number,
): void {
  const floor = plateThickness - HOOK_PIN_EMBED_MM;

  addPrismAlongX(
    positions,
    [
      [-pinBase / 2, floor],
      [pinBase / 2, floor],
      [pinBase / 2 + depth, floor + depth],
      [-pinBase / 2 + depth, floor + depth],
    ],
    -pinWidth / 2,
    pinWidth / 2,
  );
}

/**
 * Геометрия крючка для набора параметров.
 *
 * Недостающие поля берутся из значений по умолчанию, поэтому предпросмотр
 * может вызвать функцию с любым набором параметров.
 */
export function createWallHookGeometry(
  params: Partial<WallHookParams>,
): BufferGeometry {
  const normalized = normalizeWallHookParams(params);
  const positions: number[] = [];
  const width = normalized.hookWidth;
  const height = normalized.hookHeight;
  const plateThickness = Math.min(
    Math.max(width * HOOK_PLATE_RATIO, HOOK_PLATE_MIN_MM),
    HOOK_PLATE_MAX_MM,
  );
  const pinWidth = Math.min(
    Math.max(width * HOOK_PIN_RATIO, HOOK_PIN_MIN_MM),
    HOOK_PIN_MAX_MM,
  );
  const pinBase = Math.min(
    Math.max(plateThickness * HOOK_PIN_BASE_RATIO, HOOK_PIN_BASE_MIN_MM),
    HOOK_PIN_BASE_MAX_MM,
  );
  const screwHoles: Point2[] = [];

  if (normalized.hookMount === "screw") {
    // Отверстия стоят симметрично и не подходят к торцам ближе 14 мм: у
    // короткой плиты они сдвигаются к центру, но не сливаются друг с другом.
    const offsetY = Math.max(height / 2 - HOOK_SCREW_EDGE_MM, height / 4);

    screwHoles.push([0, offsetY], [0, -offsetY]);
  }

  addPlate(positions, width, height, plateThickness, screwHoles);
  addPin(positions, normalized.hookDepth, pinWidth, pinBase, plateThickness);

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();

  return geometry;
}

