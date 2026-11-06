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

/** Ниже этой величины фаска неотличима от нуля и только плодит вершины. */
const MIN_BEVEL_MM = 1e-4;

/**
 * Доля меньшей стороны сечения, которую разрешено снимать фаской.
 *
 * Фаска сдвигает контур внутрь на свою величину. На узкой детали большой срез
 * вывернул бы контур наизнанку, поэтому запас держится на десяти процентах: у
 * плиты 20 × 3 мм фаска не превысит 0.3 мм, и стенка остаётся прямой.
 */
const MAX_BEVEL_SHARE = 0.1;

/** Кольцо профиля фаски: контур на высоте `z`, сжатый на `inset`. */
type BevelRing = {
  readonly points: Point2[];
  readonly z: number;
};

/** Габарит сечения в плане — по нему считается предельная фаска. */
function polygonAcrossFlatsSize(points: readonly Point2[]): number {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  if (!Number.isFinite(minX)) {
    return 0;
  }

  return Math.min(maxX - minX, maxY - minY);
}

/**
 * Сдвиг контура внутрь на `distance`.
 *
 * Контур обходится против часовой стрелки, поэтому внутренняя нормаль ребра —
 * поворот касательной на 90° влево, то есть `(−dy, dx)`. Вершина встаёт на
 * пересечение двух смещённых прямых: сумма нормалей соседних рёбер, делённая на
 * `1 + n₁·n₂`. На прямом участке это обычный перпендикулярный сдвиг, на
 * выпуклом углу — по биссектрисе, ровно на `distance` от обеих стенок.
 */
export function insetPolygon(
  points: readonly Point2[],
  distance: number,
): Point2[] {
  const count = points.length;

  if (count < 3 || distance === 0) {
    return points.map(([x, y]) => [x, y] as Point2);
  }

  const normals: Point2[] = [];

  for (let index = 0; index < count; index += 1) {
    const [x0, y0] = points[index];
    const [x1, y1] = points[(index + 1) % count];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const length = Math.hypot(dx, dy);

    normals.push(length < 1e-9 ? [0, 0] : [-dy / length, dx / length]);
  }

  const result: Point2[] = [];

  for (let index = 0; index < count; index += 1) {
    const [previousX, previousY] = normals[(index - 1 + count) % count];
    const [currentX, currentY] = normals[index];
    const [x, y] = points[index];
    const dot = previousX * currentX + previousY * currentY;

    if (1 + dot < 1e-6) {
      // Ребро нулевой длины или разворот на 180°: сдвигаем по одной нормали.
      result.push([x + distance * currentX, y + distance * currentY]);

      continue;
    }

    const scale = distance / (1 + dot);

    result.push([
      x + scale * (previousX + currentX),
      y + scale * (previousY + currentY),
    ]);
  }

  return result;
}

/**
 * Сжатие контура фаски: ноль — стенка, `bevelSize` — торец.
 *
 * Пределы зажаты размером детали и половиной высоты. На тонкой плите 20 × 20 ×
 * 0.5 мм фаска не превысит 0.25 мм, иначе верхняя и нижняя фаски схлопнулись бы
 * в ноль. Ноль после зажима означает обычную призму без среза.
 */
function clampBevel(
  points: readonly Point2[],
  z0: number,
  z1: number,
  bevelSize: number,
): number {
  const limit = Math.min(
    MAX_BEVEL_SHARE * polygonAcrossFlatsSize(points),
    (z1 - z0) / 2,
  );

  if (!Number.isFinite(bevelSize) || limit <= 0) {
    return 0;
  }

  return Math.min(Math.max(bevelSize, 0), limit);
}

/**
 * Кольца профиля фаски снизу вверх.
 *
 * Кромка описана четвертью окружности радиуса `bevelSize`: у торца контур сжат
 * на всю фаску, к прямой стенке выходит на ноль. Один сегмент даёт прямой срез
 * под 45°, больше — скругление из хорд. Кольца считаются один раз и лежат в
 * общем кэше: соседние полосы берут одни и те же точки, поэтому шов между ними
 * сходится без щелей и без «ступенек».
 */
function bevelRings(
  points: readonly Point2[],
  z0: number,
  z1: number,
  bevel: number,
  segments: number,
): BevelRing[] {
  const steps = Math.max(1, Math.round(segments));
  const contours = new Map<number, Point2[]>();
  const contour = (offset: number): Point2[] => {
    const key = Math.round(offset * 1e6);
    const cached = contours.get(key);

    if (cached) {
      return cached;
    }

    const created = insetPolygon(points, offset);

    contours.set(key, created);

    return created;
  };
  const offsets: number[] = [];

  for (let step = 0; step <= steps; step += 1) {
    const ratio = step / steps;
    const rest = 1 - ratio;

    offsets.push(bevel * (1 - Math.sqrt(Math.max(1 - rest * rest, 0))));
  }

  const rings: BevelRing[] = [];
  let previousZ = Number.NaN;
  let previousOffset = Number.NaN;
  const push = (offset: number, z: number): void => {
    // Совпадение с предыдущим кольцом бывает на детали, где фаски сходятся:
    // полоса нулевой высоты дала бы вырожденные треугольники.
    if (
      Math.abs(previousZ - z) < 1e-9 &&
      Math.abs(previousOffset - offset) < 1e-9
    ) {
      return;
    }

    rings.push({ points: contour(offset), z });

    previousZ = z;
    previousOffset = offset;
  };

  for (let step = 0; step <= steps; step += 1) {
    push(offsets[step], z0 + (bevel * step) / steps);
  }

  for (let step = steps; step >= 0; step -= 1) {
    push(offsets[step], z1 - (bevel * step) / steps);
  }

  return rings;
}

/**
 * Полоса стенки между двумя кольцами одного контура.
 *
 * Обход тот же, что у `addPrismSides`: нижнее кольцо первым, контур против
 * часовой стрелки. Поэтому нормали смотрят из материала наружу и на наклонной
 * фаске, и на прямой стенке. Второй треугольник пары закрывает квадрат грани.
 */
function addWallBetween(
  positions: number[],
  lower: BevelRing,
  upper: BevelRing,
): void {
  const count = lower.points.length;

  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    const [lx0, ly0] = lower.points[index];
    const [lx1, ly1] = lower.points[next];
    const [ux0, uy0] = upper.points[index];
    const [ux1, uy1] = upper.points[next];

    positions.push(
      lx0,
      ly0,
      lower.z,
      lx1,
      ly1,
      lower.z,
      ux1,
      uy1,
      upper.z,
      lx0,
      ly0,
      lower.z,
      ux1,
      uy1,
      upper.z,
      ux0,
      uy0,
      upper.z,
    );
  }
}

/**
 * Замкнутая призма с фаской по внешнему контуру.
 *
 * Фаска снимает материал у верхней и нижней кромки: у торца контур сжат внутрь
 * на `bevelSize`, к прямой стенке выходит на ноль. Один сегмент даёт срез под
 * 45°, большее число — скруглённую кромку из хорд. Внутренние рёбра
 * треугольников не участвуют: оболочка строится готовыми гранями, поэтому
 * watertight не зависит от `bevelSegments`.
 *
 * `bevelSize` зажимается десятью процентами меньшей стороны сечения и половиной
 * высоты: на узкой или тонкой детали большой срез вывернул бы контур наизнанку.
 * Ноль после зажима означает обычную призму — результат совпадает с
 * `addSolidPrism`. Сечение должно быть выпуклым, как и там: торцы остаются
 * веером от центра.
 */
export function addRoundedPrism(
  positions: number[],
  points: readonly Point2[],
  z0: number,
  z1: number,
  bevelSize: number,
  bevelSegments = 1,
): void {
  const bevel = clampBevel(points, z0, z1, bevelSize);

  if (bevel < MIN_BEVEL_MM) {
    addSolidPrism(positions, points, z0, z1);

    return;
  }

  const rings = bevelRings(points, z0, z1, bevel, bevelSegments);
  const last = rings.length - 1;

  addFanCap(positions, rings[0].points, z0, false);

  for (let index = 0; index < last; index += 1) {
    addWallBetween(positions, rings[index], rings[index + 1]);
  }

  addFanCap(positions, rings[last].points, z1, true);
}

/**
 * Кольцо-призма с фаской по внешнему контуру.
 *
 * Внутреннее отверстие остаётся без фаски: его стенка вертикальна от `z0` до
 * `z1`, потому что срез вокруг отверстия ломал бы посадку вала или язычка.
 * Торцы — узкие полосы между отверстием и сжатым наружным контуром, поэтому
 * число вершин у контуров обязано совпадать, как у `addRingPrism`.
 */
export function addRoundedRingPrism(
  positions: number[],
  outer: readonly Point2[],
  inner: readonly Point2[],
  z0: number,
  z1: number,
  bevelSize: number,
  bevelSegments = 1,
): void {
  const bevel = clampBevel(outer, z0, z1, bevelSize);

  if (bevel < MIN_BEVEL_MM) {
    addRingPrism(positions, outer, inner, z0, z1);

    return;
  }

  const rings = bevelRings(outer, z0, z1, bevel, bevelSegments);
  const last = rings.length - 1;
  const count = inner.length;
  const top = rings[last].points;
  const bottom = rings[0].points;

  addRingInnerSides(positions, inner, z0, z1);

  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    const [tx0, ty0] = top[index];
    const [tx1, ty1] = top[next];
    const [bx0, by0] = bottom[index];
    const [bx1, by1] = bottom[next];
    const [ix0, iy0] = inner[index];
    const [ix1, iy1] = inner[next];

    // Верхний торец смотрит в +Z, нижний — в −Z.
    positions.push(
      tx0,
      ty0,
      z1,
      tx1,
      ty1,
      z1,
      ix1,
      iy1,
      z1,
      tx0,
      ty0,
      z1,
      ix1,
      iy1,
      z1,
      ix0,
      iy0,
      z1,
      bx0,
      by0,
      z0,
      ix0,
      iy0,
      z0,
      ix1,
      iy1,
      z0,
      bx0,
      by0,
      z0,
      ix1,
      iy1,
      z0,
      bx1,
      by1,
      z0,
    );
  }

  for (let index = 0; index < last; index += 1) {
    addWallBetween(positions, rings[index], rings[index + 1]);
  }
}

