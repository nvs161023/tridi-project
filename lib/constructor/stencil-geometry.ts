import {
  BufferGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Path,
  Shape,
} from "three";

import {
  normalizeStencilParams,
  type StencilParams,
  type StencilPattern,
} from "@/lib/constructor/params";
import {
  roundedRectanglePolygon,
  type Point2,
} from "@/lib/constructor/prism-mesh";

/**
 * Геометрия трафарета.
 *
 * Плита со скруглёнными углами и сквозными прорезями узора. Узор — это набор
 * отверстий в сплошной плите: перемычки между ними держат трафарет целым, а по
 * краю остаётся рамка, за которую его снимают с поверхности. Все прорези
 * сквозные, поэтому плита печатается плашмя на столе: поддержки и заполнение не
 * нужны, а толщину слайдер задаёт от 0.8 до 3 мм.
 *
 * Шаг узора считается от габарита плиты: на большом трафарете прорези не
 * превращаются в сито, на маленьком — не сливаются в одну дырку. Плита построена
 * в плоскости XY, толщина идёт по Z, как у остальных деталей конструктора.
 */

/** Рамка по краю плиты, мм: за неё трафарет держат и снимают. */
const STENCIL_FRAME_MM = 5;

/** Радиус скругления углов плиты, мм. */
const STENCIL_CORNER_MM = 5;

/** Ширина полосы и перемычки между полосами, мм. */
const STENCIL_STRIPE_MM = 8;
const STENCIL_STRIPE_GAP_MM = 6;

/** Радиус точки и шаг сетки точек, мм. */
const STENCIL_DOT_RADIUS_MM = 4.2;
const STENCIL_DOT_PITCH_MM = 17;

/** Радиус соты и запас на перемычку между соседними сотами. */
const STENCIL_HEX_RADIUS_MM = 6;
const STENCIL_HEX_SPACING = 1.35;

/**
 * Сетка центров узора со сдвигом через ряд.
 *
 * Сетка центрируется по плите: ряды отстоят друг от друга на `pitchY`, а
 * нечётные сдвинуты на половину шага — так точки и соты ложатся плотнее, но
 * перемычки остаются одинаковыми. Число рядов и столбцов считается от
 * свободного места за вычетом радиуса элемента и половины шага сдвига,
 * поэтому узор не задевает рамку ни при каком размере.
 */
function staggeredGrid(
  width: number,
  height: number,
  pitchX: number,
  pitchY: number,
  radius: number,
): Point2[] {
  const usableWidth = Math.max(width - 2 * radius, 0);
  const usableHeight = Math.max(height - 2 * radius, 0);
  // Столбцы считаются с запасом на сдвиг нечётного ряда: он уходит вправо на
  // половину шага, поэтому крайняя точка не должна выйти за рамку.
  const columns = Math.max(
    1,
    Math.floor((usableWidth - pitchX / 2) / pitchX) + 1,
  );
  const rows = Math.max(1, Math.floor(usableHeight / pitchY) + 1);
  const columnSpan = (columns - 1) * pitchX;
  const rowSpan = (rows - 1) * pitchY;
  const centers: Point2[] = [];

  for (let row = 0; row < rows; row += 1) {
    const y = -rowSpan / 2 + row * pitchY;
    // Нечётный ряд сдвинут вправо на половину шага, но не выходит за рамку.
    const shifted =
      row % 2 === 1 ? -columnSpan / 2 + pitchX / 2 : -columnSpan / 2;

    for (let column = 0; column < columns; column += 1) {
      centers.push([shifted + column * pitchX, y]);
    }
  }

  return centers;
}

/** Отверстие-многоугольник в плите. */
function addPolygonHole(shape: Shape, points: readonly Point2[]): void {
  const hole = new Path();

  points.forEach(([x, y], index) => {
    if (index === 0) {
      hole.moveTo(x, y);
    } else {
      hole.lineTo(x, y);
    }
  });
  hole.closePath();
  shape.holes.push(hole);
}

/** Отверстие-окружность в плите. */
function addCircleHole(
  shape: Shape,
  x: number,
  y: number,
  radius: number,
): void {
  const hole = new Path();

  hole.absarc(x, y, radius, 0, Math.PI * 2, false);
  shape.holes.push(hole);
}

/** Шестигранник «соты»: вершина смотрит вверх, поэтому ряды ложатся в шахматку. */
function hexagonPoints(
  centerX: number,
  centerY: number,
  radius: number,
): Point2[] {
  const points: Point2[] = [];

  for (let index = 0; index < 6; index += 1) {
    const angle = Math.PI / 2 + (Math.PI / 3) * index;

    points.push([
      centerX + radius * Math.cos(angle),
      centerY + radius * Math.sin(angle),
    ]);
  }

  return points;
}

/** Полосы: длинные прорези во всю высоту узорного поля. */
function addStripes(shape: Shape, width: number, height: number): void {
  const pitch = STENCIL_STRIPE_MM + STENCIL_STRIPE_GAP_MM;
  const count = Math.max(
    1,
    Math.floor((width + STENCIL_STRIPE_GAP_MM) / pitch),
  );
  const span = count * STENCIL_STRIPE_MM + (count - 1) * STENCIL_STRIPE_GAP_MM;
  const startX = -span / 2;

  for (let index = 0; index < count; index += 1) {
    const left = startX + index * pitch;

    addPolygonHole(shape, [
      [left, -height / 2],
      [left + STENCIL_STRIPE_MM, -height / 2],
      [left + STENCIL_STRIPE_MM, height / 2],
      [left, height / 2],
    ]);
  }
}

/** Точки: круглые прорези в шахматном порядке. */
function addDots(shape: Shape, width: number, height: number): void {
  const centers = staggeredGrid(
    width,
    height,
    STENCIL_DOT_PITCH_MM,
    STENCIL_DOT_PITCH_MM * 0.9,
    STENCIL_DOT_RADIUS_MM,
  );

  for (const [x, y] of centers) {
    addCircleHole(shape, x, y, STENCIL_DOT_RADIUS_MM);
  }
}

/** Соты: шестигранные прорези со сдвигом через ряд. */
function addHexes(shape: Shape, width: number, height: number): void {
  const centers = staggeredGrid(
    width,
    height,
    Math.sqrt(3) * STENCIL_HEX_RADIUS_MM * STENCIL_HEX_SPACING,
    1.5 * STENCIL_HEX_RADIUS_MM * STENCIL_HEX_SPACING,
    STENCIL_HEX_RADIUS_MM,
  );

  for (const [x, y] of centers) {
    addPolygonHole(shape, hexagonPoints(x, y, STENCIL_HEX_RADIUS_MM));
  }
}

/**
 * Геометрия трафарета для набора параметров.
 *
 * Недостающие поля берутся из значений по умолчанию, поэтому предпросмотр
 * может вызвать функцию с любым набором параметров.
 */
export function createStencilGeometry(
  params: Partial<StencilParams>,
): BufferGeometry {
  const normalized = normalizeStencilParams(params);
  const width = normalized.stencilWidth;
  const height = normalized.stencilHeight;
  const patternWidth = Math.max(width - 2 * STENCIL_FRAME_MM, 0);
  const patternHeight = Math.max(height - 2 * STENCIL_FRAME_MM, 0);
  const shape = new Shape();

  roundedRectanglePolygon(width, height, STENCIL_CORNER_MM).forEach(
    ([x, y], index) => {
      if (index === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    },
  );
  shape.closePath();

  const patterns: Record<StencilPattern, () => void> = {
    stripes: () => addStripes(shape, patternWidth, patternHeight),
    dots: () => addDots(shape, patternWidth, patternHeight),
    hexes: () => addHexes(shape, patternWidth, patternHeight),
  };

  patterns[normalized.stencilPattern]();

  const plate = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 8,
    depth: normalized.stencilThickness,
    steps: 1,
  });
  const source = plate.getAttribute("position");
  const positions: number[] = [];

  for (let index = 0; index < source.count; index += 1) {
    positions.push(source.getX(index), source.getY(index), source.getZ(index));
  }

  plate.dispose();

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();

  return geometry;
}
