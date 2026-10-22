/**
 * Общие заготовки мешей для параметрических деталей.
 *
 * Конструктор обходится без булевых операций: каждая деталь — отдельная
 * замкнутая оболочка, а пересекающиеся тела объединяет слайсер при печати. Здесь
 * собраны кирпичики, из которых строятся кашпо, подставка под кружку и стойка
 * для украшений: сечения, призмы, кольца и цилиндры.
 *
 * Все функции дописывают треугольники в общий массив позиций без индексов:
 * `BufferGeometry` из такого массива сразу watertight, потому что каждая грань
 * описана явно. Обход вершин везде против часовой стрелки, если смотреть
 * снаружи: при обратном обходе нормаль смотрит внутрь, объём детали выходит
 * отрицательным, а STL выворачивается наизнанку.
 */

/** Точка на плоскости стола. */
export type Point2 = readonly [number, number];

/** Точка в пространстве. */
export type Point3 = readonly [number, number, number];

/**
 * Правильный многоугольник — сечение круглой детали в плане.
 *
 * Первая вершина стоит на угле `startAngle`, дальше углы растут: обход идёт
 * против часовой стрелки, если смотреть сверху, — именно его ждут призмы.
 */
export function circlePolygon(
  radius: number,
  sides: number,
  startAngle = 0,
): Point2[] {
  const points: Point2[] = [];

  for (let index = 0; index < sides; index += 1) {
    const angle = startAngle + (Math.PI * 2 * index) / sides;

    points.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }

  return points;
}

/**
 * Сечение детали «под ключ».
 *
 * `acrossFlats` — расстояние между параллельными гранями: у круга это диаметр,
 * у квадрата и шестигранника — габарит. Радиус описанной окружности больше
 * половины габарита, поэтому многоугольник получается ровно того же размера,
 * что и подписанный слайдер.
 */
export function polygonAcrossFlats(
  acrossFlats: number,
  sides: number,
  startAngle = 0,
): Point2[] {
  const apothem = Math.max(acrossFlats, 0) / 2;
  const radius = sides > 2 ? apothem / Math.cos(Math.PI / sides) : apothem;

  return circlePolygon(radius, sides, startAngle);
}

/** Сдвигает контур на плоскости: детали стоят рядом или сдвинуты от центра. */
export function offsetPoints(
  points: readonly Point2[],
  dx: number,
  dy = 0,
): Point2[] {
  return points.map(([x, y]) => [x + dx, y + dy] as Point2);
}

/**
 * Прямоугольник со скруглёнными углами — контур плиты в плане.
 *
 * Обход начинается с нижнего правого скругления и идёт против часовой стрелки,
 * как у остальных контуров: так его ждут призмы и `ExtrudeGeometry`. Радиус
 * скругления зажимается половиной меньшей стороны, поэтому узкая плита всё равно
 * получает корректный контур.
 */
export function roundedRectanglePolygon(
  width: number,
  height: number,
  corner: number,
  segments = 6,
): Point2[] {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const radius = Math.max(Math.min(corner, halfWidth, halfHeight), 0);
  const points: Point2[] = [];
  const corners: readonly (readonly [number, number, number])[] = [
    [halfWidth - radius, -halfHeight + radius, -Math.PI / 2],
    [halfWidth - radius, halfHeight - radius, 0],
    [-halfWidth + radius, halfHeight - radius, Math.PI / 2],
    [-halfWidth + radius, -halfHeight + radius, Math.PI],
  ];

  for (const [centerX, centerY, startAngle] of corners) {
    for (let index = 0; index <= segments; index += 1) {
      const angle = startAngle + (Math.PI / 2) * (index / segments);

      points.push([
        centerX + radius * Math.cos(angle),
        centerY + radius * Math.sin(angle),
      ]);
    }
  }

  return points;
}

/**
 * Боковые грани призмы.
 *
 * Контур обходится против часовой стрелки, если смотреть сверху, поэтому
 * нормаль каждого треугольника смотрит вправо от обхода — из материала наружу.
 * Второй треугольник пары закрывает квадрат грани без щелей между ними.
 */
export function addPrismSides(
  positions: number[],
  points: readonly Point2[],
  z0: number,
  z1: number,
): void {
  const count = points.length;

  for (let index = 0; index < count; index += 1) {
    const [x0, y0] = points[index];
    const [x1, y1] = points[(index + 1) % count];

    positions.push(
      x0,
      y0,
      z0,
      x1,
      y1,
      z0,
      x1,
      y1,
      z1,
      x0,
      y0,
      z0,
      x1,
      y1,
      z1,
      x0,
      y0,
      z1,
    );
  }
}

/**
 * Крышка призмы веером от центра.
 *
 * Сечение выпуклое, поэтому веер не даёт пересекающихся треугольников и не
 * требует триангуляции. Верхняя крышка смотрит в +Z, нижняя — в −Z.
 */
export function addFanCap(
  positions: number[],
  points: readonly Point2[],
  z: number,
  top: boolean,
): void {
  const count = points.length;
  let cx = 0;
  let cy = 0;

  for (const [x, y] of points) {
    cx += x;
    cy += y;
  }

  cx /= count;
  cy /= count;

  for (let index = 0; index < count; index += 1) {
    const [x0, y0] = points[index];
    const [x1, y1] = points[(index + 1) % count];

    if (top) {
      positions.push(cx, cy, z, x0, y0, z, x1, y1, z);
    } else {
      positions.push(cx, cy, z, x1, y1, z, x0, y0, z);
    }
  }
}

/** Замкнутая призма по выпуклому контуру: стенки и две крышки. */
export function addSolidPrism(
  positions: number[],
  points: readonly Point2[],
  z0: number,
  z1: number,
): void {
  addPrismSides(positions, points, z0, z1);
  addFanCap(positions, points, z0, false);
  addFanCap(positions, points, z1, true);
}

/**
 * Внутренние стенки кольца.
 *
 * Обход обратный наружному: у сплошного кольца нормаль обязана смотреть в
 * отверстие, иначе внутренняя стенка окажется вывернутой и объём не сойдётся.
 */
function addRingInnerSides(
  positions: number[],
  points: readonly Point2[],
  z0: number,
  z1: number,
): void {
  const count = points.length;

  for (let index = 0; index < count; index += 1) {
    const [x0, y0] = points[index];
    const [x1, y1] = points[(index + 1) % count];

    positions.push(
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

/**
 * Замкнутое кольцо-призма: наружная стенка, внутренняя и два торца.
 *
 * Так строятся стенка кашпо, борт поддона и рельеф подставки под кружку. Внутри
 * остаётся открытая полость, но сама оболочка замкнута: кольцо — тело с одним
 * сквозным отверстием. У наружного и внутреннего контура обязано совпадать
 * число вершин, иначе торец распадётся на треугольники с разрывами.
 */
export function addRingPrism(
  positions: number[],
  outer: readonly Point2[],
  inner: readonly Point2[],
  z0: number,
  z1: number,
): void {
  const count = outer.length;

  addPrismSides(positions, outer, z0, z1);
  addRingInnerSides(positions, inner, z0, z1);

  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    const [ox0, oy0] = outer[index];
    const [ox1, oy1] = outer[next];
    const [ix0, iy0] = inner[index];
    const [ix1, iy1] = inner[next];

    // Верхний торец смотрит в +Z, нижний — в −Z.
    positions.push(
      ox0,
      oy0,
      z1,
      ox1,
      oy1,
      z1,
      ix1,
      iy1,
      z1,
      ox0,
      oy0,
      z1,
      ix1,
      iy1,
      z1,
      ix0,
      iy0,
      z1,
      ox0,
      oy0,
      z0,
      ix0,
      iy0,
      z0,
      ix1,
      iy1,
      z0,
      ox0,
      oy0,
      z0,
      ix1,
      iy1,
      z0,
      ox1,
      oy1,
      z0,
    );
  }
}

/**
 * Замкнутая призма по выпуклому сечению в плоскости YZ, растянутая по X.
 *
 * Так строятся штырь настенного крючка и ножки клипсы для кружки: профиль
 * детали задан парой `[y, z]`, а ширина идёт по X. Сечение можно описывать в
 * любом порядке — направление нормалей проверяется по центроиду тела, поэтому
 * зеркальный или перевёрнутый профиль тоже даёт наружные грани.
 */
export function addPrismAlongX(
  positions: number[],
  section: readonly Point2[],
  x0: number,
  x1: number,
): void {
  const count = section.length;
  let centerY = 0;
  let centerZ = 0;

  for (const [y, z] of section) {
    centerY += y;
    centerZ += z;
  }

  centerY /= count;
  centerZ /= count;

  const center: Point3 = [(x0 + x1) / 2, centerY, centerZ];

  /** Дописывает треугольник, разворачивая обход от центроида наружу. */
  const pushTriangle = (a: Point3, b: Point3, c: Point3): void => {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const fx = (a[0] + b[0] + c[0]) / 3 - center[0];
    const fy = (a[1] + b[1] + c[1]) / 3 - center[1];
    const fz = (a[2] + b[2] + c[2]) / 3 - center[2];
    const outward = nx * fx + ny * fy + nz * fz >= 0;
    const second = outward ? b : c;
    const third = outward ? c : b;

    positions.push(
      a[0],
      a[1],
      a[2],
      second[0],
      second[1],
      second[2],
      third[0],
      third[1],
      third[2],
    );
  };

  const start = section.map(([y, z]) => [x0, y, z] as Point3);
  const end = section.map(([y, z]) => [x1, y, z] as Point3);

  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;

    pushTriangle(start[index], start[next], end[next]);
    pushTriangle(start[index], end[next], end[index]);
  }

  // Торцы — веер от центроида сечения: контур выпуклый, поэтому веер корректен.
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;

    pushTriangle([x0, centerY, centerZ], start[index], start[next]);
    pushTriangle([x1, centerY, centerZ], end[index], end[next]);
  }
}

/**
 * Замкнутый цилиндр между двумя точками.
 *
 * Стойка, перекладина под кольца и рожки для цепочек наклонены, поэтому ось
 * задаётся парой точек, а не поворотом меша: так вершины считаются сразу в
 * мировых координатах и пересечения деталей видны без матриц. Боковая
 * поверхность строится в базисе (right, up, axis); он правый, поэтому обход
 * кольца против часовой стрелки даёт наружные нормали.
 */
export function addCylinder(
  positions: number[],
  start: Point3,
  end: Point3,
  radius: number,
  sides: number,
): void {
  const [sx, sy, sz] = start;
  const [ex, ey, ez] = end;
  const dx = ex - sx;
  const dy = ey - sy;
  const dz = ez - sz;
  const length = Math.hypot(dx, dy, dz);
  const ax = dx / length;
  const ay = dy / length;
  const az = dz / length;

  // Опорный вектор не должен быть параллелен оси: иначе векторное произведение нулевое.
  const helperX = Math.abs(ax) < 0.9 ? 1 : 0;
  const helperY = Math.abs(ax) < 0.9 ? 0 : 1;

  // right = axis × helper, up = axis × right: вместе с осью это правый базис.
  const crossX = -az * helperY;
  const crossY = az * helperX;
  const crossZ = ax * helperY - ay * helperX;
  const crossLength = Math.hypot(crossX, crossY, crossZ);
  const rx = crossX / crossLength;
  const ry = crossY / crossLength;
  const rz = crossZ / crossLength;
  const ux = ay * rz - az * ry;
  const uy = az * rx - ax * rz;
  const uz = ax * ry - ay * rx;

  const startRing: Point3[] = [];
  const endRing: Point3[] = [];

  for (let index = 0; index < sides; index += 1) {
    const angle = (Math.PI * 2 * index) / sides;
    const offsetX = rx * Math.cos(angle) * radius + ux * Math.sin(angle) * radius;
    const offsetY = ry * Math.cos(angle) * radius + uy * Math.sin(angle) * radius;
    const offsetZ = rz * Math.cos(angle) * radius + uz * Math.sin(angle) * radius;

    startRing.push([sx + offsetX, sy + offsetY, sz + offsetZ]);
    endRing.push([ex + offsetX, ey + offsetY, ez + offsetZ]);
  }

  for (let index = 0; index < sides; index += 1) {
    const next = (index + 1) % sides;
    const [sx0, sy0, sz0] = startRing[index];
    const [sx1, sy1, sz1] = startRing[next];
    const [ex0, ey0, ez0] = endRing[index];
    const [ex1, ey1, ez1] = endRing[next];

    positions.push(
      sx0,
      sy0,
      sz0,
      sx1,
      sy1,
      sz1,
      ex1,
      ey1,
      ez1,
      sx0,
      sy0,
      sz0,
      ex1,
      ey1,
      ez1,
      ex0,
      ey0,
      ez0,
      // Торцы смотрят наружу вдоль оси: у начала в −axis, у конца в +axis.
      sx,
      sy,
      sz,
      sx1,
      sy1,
      sz1,
      sx0,
      sy0,
      sz0,
      ex,
      ey,
      ez,
      ex0,
      ey0,
      ez0,
      ex1,
      ey1,
      ez1,
    );
  }
}

/**
 * Прямоугольный блок, повёрнутый вокруг вертикальной оси.
 *
 * Пады с буквами, язычки кодовых колец, перегородки и полки шкатулки стоят под
 * углами, кратными шагу кольца, поэтому контур задаётся поворотом, а не
 * отдельной матрицей. Порядок вершин тот же, что у прямоугольника: обход против
 * часовой стрелки, значит нормали смотрят из материала наружу.
 */
export function addRotatedBox(
  positions: number[],
  centerX: number,
  centerY: number,
  angle: number,
  halfWidth: number,
  halfDepth: number,
  z0: number,
  z1: number,
): void {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const local: readonly Point2[] = [
    [-halfWidth, -halfDepth],
    [halfWidth, -halfDepth],
    [halfWidth, halfDepth],
    [-halfWidth, halfDepth],
  ];
  const corners = local.map(
    ([x, y]) =>
      [centerX + x * cos - y * sin, centerY + x * sin + y * cos] as Point2,
  );

  addSolidPrism(positions, corners, z0, z1);
}

/**
 * Дуга-стенка: кольцевой сектор между двумя радиусами.
 *
 * Юбка крышки шкатулки, язычки лабиринта и опорные полки строятся короткими
 * дугами. Сектор выпуклый, пока угол ступеньки меньше 180°, поэтому каждая
 * ступенька — обычная призма, а соседние стыкуются по общей грани без щелей.
 * `segments` задаёт гладкость: 1 даёт гранёный сектор, 10 — почти окружность.
 */
export function addArcWall(
  positions: number[],
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
  z0: number,
  z1: number,
  segments = 8,
): void {
  const steps = Math.max(1, Math.round(segments));
  const step = (endAngle - startAngle) / steps;

  for (let index = 0; index < steps; index += 1) {
    const a0 = startAngle + step * index;
    const a1 = a0 + step;
    const corners: Point2[] = [
      [centerX + innerRadius * Math.cos(a0), centerY + innerRadius * Math.sin(a0)],
      [centerX + outerRadius * Math.cos(a0), centerY + outerRadius * Math.sin(a0)],
      [centerX + outerRadius * Math.cos(a1), centerY + outerRadius * Math.sin(a1)],
      [centerX + innerRadius * Math.cos(a1), centerY + innerRadius * Math.sin(a1)],
    ];

    addSolidPrism(positions, corners, z0, z1);
  }
}

