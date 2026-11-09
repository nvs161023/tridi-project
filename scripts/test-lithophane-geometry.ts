/**
 * Тест геометрии литофана: пропорции кадра, бортик с фаской, сетка и бюджет.
 *
 * Главная ошибка, которую здесь закреплено исправление: кадр 3:2 попадал на
 * панель 120 × 80 растянутым на 59 %. Фотография вырезалась центральным
 * квадратом ещё на canvas, а геометрия размазывала этот квадрат по плите с
 * другим отношением сторон. Теперь в состоянии лежит прямоугольная сетка
 * (400 пикселей по длинной стороне), а вписывает её в панель геометрия по
 * правилу cover: лишнее срезается поровну с краёв, пиксель остаётся квадратным.
 *
 * Второе правило — бортик. Фото кончается за 2 мм до кромки, и эти 2 мм
 * печатаются на максимальной толщине: край не просвечивает и не крошится. В
 * рельеф бортик переходит фаской 1 мм, поэтому сопло не встречает вертикальную
 * стенку и над фото нет ступеньки в 2 мм.
 *
 * Третье правило — сетка. Шаг вершины больше не фиксирован числом вершин:
 * `lithophaneMeshSize` считает его по габаритам плиты из 0.3 мм (примерно две
 * ширины сопла), поэтому панель 200 мм получает вдвое больше вершин, чем
 * 120 мм, а не более грубый рельеф. Миллион треугольников — предел: деталь
 * крупнее отклоняется до сборки, а не превращается в файл на 60 МБ.
 *
 * Что проверяется:
 *   1. кадр не растягивается: чёрный круг в центре кадра 3:2 и 1:1 остаётся
 *      круглым на панелях 120 × 80 и 200 × 150 (допуск — 2 %), габарит рельефа
 *      равен плите, NaN нет, шаг вершины не больше 0.3 мм;
 *   2. бортик 2 мм идёт на максимальной толщине, фаска 1 мм сужается к фото, а
 *      дальше толщина равна серому кадру — ровная, без ступенек;
 *   3. оболочки замкнуты: у рельефа, рамки и сборки каждое ребро встречается
 *      дважды, а габарит рамки и сборки равен панели;
 *   4. сетка: 401 × 268 вершин и 217 602 треугольника на панели 120 × 80,
 *      668 × 501 и 674 002 на панели 200 × 150, плита 210 мм ещё проходит по
 *      бюджету, а 215 мм — уже нет;
 *   5. слайдеры толщин задают размах: при 0.8…3.5 мм белый кадр печатается на
 *      0.8 мм, чёрный — на 3.5 мм, а по умолчанию минимум 0.8 и максимум 3.0;
 *   6. подставка — один профиль без стыков: у ножки и у основания оболочка
 *      замкнута, габарит совпадает с профилем, а в углу «база — стойка» есть
 *      скругление из нескольких граней, а не острый стык;
 *   7. группы материалов: рельеф и крепление — одна сетка с двумя группами,
 *      группы покрывают все индексы, а сборка с основанием глубже и выше
 *      сборки без крепления.
 *
 * Запуск: `npm run check:lithophane`.
 *
 * Выход: 0 — все проверки прошли, 1 — есть расхождения.
 */
import type { BufferGeometry } from "three";

import {
  LITHOPHANE_BORDER_CHAMFER_MM,
  LITHOPHANE_BORDER_MM,
  LITHOPHANE_DETAIL_GROUP,
  LITHOPHANE_FIT_GAP_MM,
  LITHOPHANE_FRAME_WIDTH_MM,
  LITHOPHANE_RELIEF_GROUP,
  LITHOPHANE_STAND_SHAPES,
  createLithophaneFrameGeometry,
  createLithophaneGeometry,
  createLithophaneReliefGeometry,
  createLithophaneStandGeometry,
  lithophanePlateSize,
} from "../lib/constructor/lithophane-geometry";
import {
  LITHOPHANE_VERTEX_STEP_MM,
  lithophaneMeshSize,
  normalizeLithophaneParams,
  type LithophaneBrightnessGrid,
  type LithophaneParams,
} from "../lib/constructor/params";

/** Допуск габарита и толщины, мм. */
const TOLERANCE_MM = 0.01;

/** Допуск отношения сторон круга: два процента — примерно один шаг вершины. */
const ASPECT_TOLERANCE = 0.02;

/** Шаг вершины в Float32 прибавляет к 0.3 мм пару микрон. */
const STEP_TOLERANCE_MM = 1e-4;

/** Сколько проверок упало: из этого складывается код выхода. */
let failures = 0;

function check(name: string, actual: unknown, expected: unknown): void {
  const isEqual = JSON.stringify(actual) === JSON.stringify(expected);

  if (isEqual) {
    console.log(`  ok   ${name}`);
    return;
  }

  failures += 1;
  console.log(`  FAIL ${name}`);
  console.log(`       ожидалось: ${JSON.stringify(expected)}`);
  console.log(`       получено:  ${JSON.stringify(actual)}`);
}

/** Проверка с допуском: все замеры лежат в `[min, max]`. */
function checkRange(
  name: string,
  values: number[],
  min: number,
  max: number,
): void {
  if (values.length === 0) {
    failures += 1;
    console.log(`  FAIL ${name}`);
    console.log("       нет замеров");
    return;
  }

  // Без spread: замеров бывает сотни тысяч, и Math.min(...values) переполняет
  // стек вызовов.
  let actualMin = Number.POSITIVE_INFINITY;
  let actualMax = Number.NEGATIVE_INFINITY;

  for (const value of values) {
    actualMin = Math.min(actualMin, value);
    actualMax = Math.max(actualMax, value);
  }

  if (actualMin >= min && actualMax <= max) {
    console.log(
      `  ok   ${name} — ${actualMin.toFixed(3)}…${actualMax.toFixed(3)}`,
    );
    return;
  }

  failures += 1;
  console.log(`  FAIL ${name}`);
  console.log(
    `       ожидалось: ${min.toFixed(3)}…${max.toFixed(3)}, ` +
      `получено: ${actualMin.toFixed(3)}…${actualMax.toFixed(3)}`,
  );
}

/**
 * Кадр с чёрным кругом по центру: диаметр — половина ширины кадра.
 *
 * Круг — эталон пропорций: если геометрия растягивает кадр, круг на рельефе
 * становится овалом, и отношение его габаритов по X и Y уходит от единицы.
 */
function circleFrame(width = 400, height = 267): LithophaneBrightnessGrid {
  const brightness = new Array<number>(width * height).fill(255);
  const centerX = (width - 1) / 2;
  const centerY = (height - 1) / 2;
  const radius = width / 4;

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const dx = column - centerX;
      const dy = row - centerY;

      brightness[row * width + column] =
        dx * dx + dy * dy <= radius * radius ? 0 : 255;
    }
  }

  return { brightness, width, height };
}

/** Ровный серый кадр: толщина фото одна и та же во всех вершинах. */
function flatFrame(value = 128): LithophaneBrightnessGrid {
  const width = 400;
  const height = 267;

  return {
    brightness: new Array<number>(width * height).fill(value),
    width,
    height,
  };
}

/** Параметры рельефа: панель, флаг рамки и сетка яркости из кадра. */
function reliefParams(
  width: number,
  height: number,
  frame: LithophaneBrightnessGrid,
  lithoFrame = false,
): Partial<LithophaneParams> {
  return {
    lithophaneWidth: width,
    lithophaneHeight: height,
    lithoFrame,
    lithophaneBrightness: frame.brightness,
    lithophaneBrightnessWidth: frame.width,
    lithophaneBrightnessHeight: frame.height,
  };
}

/**
 * Сколько рёбер встречается не дважды: ненулевое значение — дыра в сетке.
 *
 * Ключ — округлённые координаты, а не индексы: рамка литофана не индексирована
 * (у каждой грани свои вершины), и по индексам её оболочка выглядела бы рваной.
 */
function openEdges(geometry: BufferGeometry): number {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const edges = new Map<string, number>();
  const corners = [0, 0, 0];
  const vertexKey = (vertex: number): string =>
    `${position.getX(vertex).toFixed(4)}:${position
      .getY(vertex)
      .toFixed(4)}:${position.getZ(vertex).toFixed(4)}`;
  const triangles = (index?.count ?? position.count) / 3;

  for (let triangle = 0; triangle < triangles; triangle += 1) {
    for (let corner = 0; corner < 3; corner += 1) {
      corners[corner] = index
        ? index.getX(triangle * 3 + corner)
        : triangle * 3 + corner;
    }

    for (let corner = 0; corner < 3; corner += 1) {
      const from = vertexKey(corners[corner]);
      const to = vertexKey(corners[(corner + 1) % 3]);
      const key = from < to ? `${from}|${to}` : `${to}|${from}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }

  let open = 0;

  for (const count of edges.values()) {
    if (count !== 2) {
      open += 1;
    }
  }

  return open;
}

function nanVertices(geometry: BufferGeometry): number {
  const position = geometry.getAttribute("position");
  let count = 0;

  for (let index = 0; index < position.count; index += 1) {
    if (
      !Number.isFinite(position.getX(index)) ||
      !Number.isFinite(position.getY(index)) ||
      !Number.isFinite(position.getZ(index))
    ) {
      count += 1;
    }
  }

  return count;
}

/** Габарит готовой сетки, мм. */
function boxSize(geometry: BufferGeometry): { x: number; y: number; z: number } {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;

  return {
    x: (box?.max.x ?? 0) - (box?.min.x ?? 0),
    y: (box?.max.y ?? 0) - (box?.min.y ?? 0),
    z: (box?.max.z ?? 0) - (box?.min.z ?? 0),
  };
}

/** Число треугольников в индексированной сетке. */
function triangleCount(geometry: BufferGeometry): number {
  return (geometry.getIndex()?.count ?? 0) / 3;
}


/**
 * Шаг сетки лица: расстояние между соседними вершинами первого ряда.
 *
 * Ряды идут сверху вниз с постоянным Y, поэтому граница первого ряда — первая
 * вершина с другим Y; она и даёт шаг по вертикали.
 */
function stepOf(geometry: BufferGeometry): {
  columns: number;
  stepX: number;
  stepY: number;
} {
  const position = geometry.getAttribute("position");
  const y0 = position.getY(0);
  let columns = 0;

  while (
    columns < position.count &&
    Math.abs(position.getY(columns) - y0) < 1e-6
  ) {
    columns += 1;
  }

  return {
    columns,
    stepX: position.getX(1) - position.getX(0),
    stepY: Math.abs(position.getY(columns) - y0),
  };
}

/** Число рядов лица: Y убывает от верхней кромки, пока не кончится лицо. */
function faceRows(geometry: BufferGeometry, columns: number): number {
  const position = geometry.getAttribute("position");
  let rows = 1;
  let previous = position.getY(0);

  while (rows * columns < position.count) {
    const y = position.getY(rows * columns);

    if (!(y < previous - 1e-9)) {
      break;
    }

    previous = y;
    rows += 1;
  }

  return rows;
}

/**
 * Профиль толщины по центральной колонке: как бортик переходит в фото.
 *
 * Лицо построено сверху вниз, поэтому обход идёт от нижнего ряда вверх: он и
 * есть кромка, от которой отсчитываются бортик и фаска. Расстояние до кромки —
 * это Y вершины, потому что плита стоит на нуле.
 */
function borderProfile(
  geometry: BufferGeometry,
): { fromBottom: number; thickness: number }[] {
  const position = geometry.getAttribute("position");
  const { columns } = stepOf(geometry);
  const rows = faceRows(geometry, columns);
  const middle = Math.floor(columns / 2);
  const profile: { fromBottom: number; thickness: number }[] = [];

  for (let i = (rows - 1) * columns + middle; i >= middle; i -= columns) {
    profile.push({
      fromBottom: position.getY(i),
      thickness: position.getZ(i),
    });

    if (profile.length > 16) {
      break;
    }
  }

  return profile;
}

/**
 * Габариты тёмного пятна лица, мм.
 *
 * Кромка плиты тоже максимальной толщины — это бортик, — поэтому вершины ближе
 * `margin` мм к краю в измерение не попадают: иначе пятном считалась бы вся
 * плита и пропорции ничего не проверяли.
 */
function darkSpot(
  geometry: BufferGeometry,
  plateWidth: number,
  plateHeight: number,
  margin = 4,
): { width: number; height: number; ratio: number } {
  const position = geometry.getAttribute("position");
  const halfWidth = plateWidth / 2;
  let maxZ = 0;

  for (let index = 0; index < position.count; index += 1) {
    maxZ = Math.max(maxZ, position.getZ(index));
  }

  const limit = maxZ - 0.05;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);

    if (
      position.getZ(index) < limit ||
      Math.abs(x) > halfWidth - margin ||
      y < margin ||
      y > plateHeight - margin
    ) {
      continue;
    }

    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  return {
    width: maxX - minX,
    height: maxY - minY,
    ratio: (maxX - minX) / (maxY - minY),
  };
}

/**
 * Толщина лица в середине кадра, мм.
 *
 * Кромка плиты печатается на максимальной толщине (бортик), а в фото переходит
 * фаской, поэтому вершины ближе `margin` мм к краю не учитываются: иначе
 * толщиной лица считался бы бортик и размах слайдеров было бы не проверить.
 */
function faceThickness(
  geometry: BufferGeometry,
  plateWidth: number,
  plateHeight: number,
  margin = 8,
): number {
  const position = geometry.getAttribute("position");
  const halfWidth = plateWidth / 2;
  let thickness = 0;

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);

    if (
      Math.abs(x) > halfWidth - margin ||
      y < margin ||
      y > plateHeight - margin
    ) {
      continue;
    }

    thickness = Math.max(thickness, position.getZ(index));
  }

  return thickness;
}

/**
 * Сколько точек профиля попало в прямоугольник `y ∈ (yMin; yMax], z < zMax`.
 *
 * У подставки выше базы и позади стойки других вершин нет: там проходит дуга
 * скругления, по точке на каждый отрезок. Острый стык в этом углу дал бы одну
 * точку на пересечении плоскостей, поэтому счёт и есть проверка скругления.
 * Точки сравниваются по координатам: на скруглении вершины общие, но их ещё раз
 * копирует торец детали.
 */
function profilePoints(
  geometry: BufferGeometry,
  yMin: number,
  yMax: number,
  zMax: number,
): number {
  const position = geometry.getAttribute("position");
  const points = new Set<string>();

  for (let index = 0; index < position.count; index += 1) {
    const y = position.getY(index);
    const z = position.getZ(index);

    if (y <= yMin || y > yMax || z >= zMax) {
      continue;
    }

    points.add(`${y.toFixed(3)}:${z.toFixed(3)}`);
  }

  return points.size;
}


console.log("\n1. Кадр не растягивается: cover вместо центрального квадрата");

for (const testCase of [
  { width: 120, height: 80, frame: circleFrame(), note: "кадр 3:2" },
  { width: 200, height: 150, frame: circleFrame(), note: "кадр 3:2" },
  { width: 120, height: 80, frame: circleFrame(400, 400), note: "кадр 1:1" },
]) {
  const { width, height, frame, note } = testCase;
  const params = reliefParams(width, height, frame);
  const plate = lithophanePlateSize(params);
  const mesh = lithophaneMeshSize(plate.width, plate.height);
  const geometry = createLithophaneReliefGeometry(params);
  const size = boxSize(geometry);
  const step = stepOf(geometry);
  const spot = darkSpot(geometry, plate.width, plate.height);
  const triangles = triangleCount(geometry);

  console.log(
    `  ${width} × ${height}, ${note}: плита ` +
      `${plate.width.toFixed(2)} × ${plate.height.toFixed(2)} мм, ` +
      `сетка ${mesh?.columns} × ${mesh?.rows}, шаг ` +
      `${step.stepX.toFixed(4)} × ${step.stepY.toFixed(4)} мм, ` +
      `${triangles.toLocaleString("ru-RU")} треугольников`,
  );
  console.log(
    `       круг в кадре: ${spot.width.toFixed(2)} × ` +
      `${spot.height.toFixed(2)} мм, отношение ${spot.ratio.toFixed(4)}`,
  );

  check(`${note} ${width}×${height}: NaN 0`, nanVertices(geometry), 0);
  checkRange(
    `${note} ${width}×${height}: круг остался круглым`,
    [spot.ratio],
    1 - ASPECT_TOLERANCE,
    1 + ASPECT_TOLERANCE,
  );
  checkRange(
    `${note} ${width}×${height}: габарит равен плите`,
    [size.x - plate.width, size.y - plate.height],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );
  checkRange(
    `${note} ${width}×${height}: шаг вершины не больше ${LITHOPHANE_VERTEX_STEP_MM} мм`,
    [step.stepX, step.stepY],
    0,
    LITHOPHANE_VERTEX_STEP_MM + STEP_TOLERANCE_MM,
  );
  check(
    `${note} ${width}×${height}: треугольников как в бюджете сетки`,
    triangles,
    mesh?.triangles,
  );

  geometry.dispose();
}

console.log("\n2. Бортик 2 мм с фаской 1 мм перед фото");

for (const [width, height] of [
  [120, 80],
  [200, 150],
] as const) {
  const geometry = createLithophaneReliefGeometry(
    reliefParams(width, height, flatFrame()),
  );
  const step = stepOf(geometry);
  const profile = borderProfile(geometry);
  const normalized = normalizeLithophaneParams({
    lithophaneWidth: width,
    lithophaneHeight: height,
    lithoFrame: false,
  });
  const maxThickness = normalized.lithophaneMaxThickness;
  // Серый 128 из кадра даёт ровно такую толщину: бортик обязан к ней прийти и
  // дальше не меняться, иначе на печати будет ступенька.
  const photoThickness =
    maxThickness -
    (maxThickness - normalized.lithophaneMinThickness) * (128 / 255);
  const borderVertices = profile.filter(
    (point) => point.fromBottom <= LITHOPHANE_BORDER_MM - LITHOPHANE_BORDER_CHAMFER_MM,
  );
  const ramp = profile.filter(
    (point) =>
      point.fromBottom >= LITHOPHANE_BORDER_MM - LITHOPHANE_BORDER_CHAMFER_MM &&
      point.fromBottom < LITHOPHANE_BORDER_MM,
  );
  // Первые два ряда после фаски ещё попадают в её полосу, поэтому фото
  // меряется с отступом в два шага сетки.
  const photoVertices = profile.filter(
    (point) => point.fromBottom >= LITHOPHANE_BORDER_MM + 2 * step.stepY,
  );

  console.log(
    `  ${width} × ${height}: ` +
      profile
        .map(
          (point) =>
            `${point.fromBottom.toFixed(2)}→${point.thickness.toFixed(3)}`,
        )
        .join(", "),
  );

  check(
    `${width}×${height}: у кромки есть вершины бортика`,
    borderVertices.length > 0,
    true,
  );
  checkRange(
    `${width}×${height}: бортик на максимальной толщине`,
    borderVertices.map((point) => point.thickness - maxThickness),
    -TOLERANCE_MM / 10,
    TOLERANCE_MM / 10,
  );
  check(
    `${width}×${height}: фаска сужается от бортика к фото`,
    ramp.length >= 2 && ramp[0].thickness > ramp[ramp.length - 1].thickness,
    true,
  );
  check(
    `${width}×${height}: фото начинается сразу за фаской`,
    photoVertices.length > 0,
    true,
  );
  checkRange(
    `${width}×${height}: толщина фото равна серому кадру`,
    photoVertices.map((point) => point.thickness - photoThickness),
    -2 * TOLERANCE_MM,
    2 * TOLERANCE_MM,
  );

  geometry.dispose();
}


console.log("\n3. Замкнутость: рельеф, рамка и сборка");

{
  // Замыкание проверяется на маленькой панели: дырка в сетке не зависит от
  // габарита, а ребра большого рельефа считались бы секунды.
  const small = reliefParams(40, 30, circleFrame());
  const relief = createLithophaneReliefGeometry(small);

  check("рельеф 40 × 30: открытых рёбер 0", openEdges(relief), 0);
  check("рельеф 40 × 30: NaN 0", nanVertices(relief), 0);
  relief.dispose();

  const assembled = createLithophaneGeometry({
    ...small,
    lithoFrame: true,
    lithoMount: "none",
  });

  check("сборка 40 × 30 с рамкой: открытых рёбер 0", openEdges(assembled), 0);
  assembled.dispose();
}

for (const [width, height] of [
  [120, 80],
  [200, 150],
] as const) {
  const framePiece = createLithophaneFrameGeometry({
    lithophaneWidth: width,
    lithophaneHeight: height,
    lithoFrame: true,
  });
  const frameSize = boxSize(framePiece);
  const framedPlate = lithophanePlateSize({
    lithophaneWidth: width,
    lithophaneHeight: height,
    lithoFrame: true,
  });

  console.log(
    `  ${width} × ${height}: рамка ` +
      `${frameSize.x.toFixed(2)} × ${frameSize.y.toFixed(2)} × ` +
      `${frameSize.z.toFixed(2)} мм, плита в окне ` +
      `${framedPlate.width.toFixed(2)} × ${framedPlate.height.toFixed(2)} мм`,
  );

  check(`${width}×${height}: рамка замкнута`, openEdges(framePiece), 0);
  checkRange(
    `${width}×${height}: габарит рамки равен панели`,
    [frameSize.x - width, frameSize.y - height],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );
  // Плита уменьшается на бортик рамки и зазор посадки с каждой стороны: бортик
  // рельефа и фаска должны целиком уйти под накладку, иначе на печати видна
  // полоса фото под рамкой.
  checkRange(
    `${width}×${height}: плита меньше панели на бортик рамки и зазор`,
    [width - framedPlate.width, height - framedPlate.height],
    2 * (LITHOPHANE_FRAME_WIDTH_MM + LITHOPHANE_FIT_GAP_MM) - TOLERANCE_MM,
    2 * (LITHOPHANE_FRAME_WIDTH_MM + LITHOPHANE_FIT_GAP_MM) + TOLERANCE_MM,
  );

  framePiece.dispose();
}

console.log("\n4. Сетка по габаритам и бюджет треугольников");

for (const [width, height, columns, rows, triangles] of [
  [120, 80, 401, 268, 217_602],
  [200, 150, 668, 501, 674_002],
] as const) {
  const mesh = lithophaneMeshSize(width, height);

  console.log(
    `  ${width} × ${height}: ${mesh?.columns} × ${mesh?.rows} вершин, шаг ` +
      `${mesh?.stepX.toFixed(4)} × ${mesh?.stepY.toFixed(4)} мм, ` +
      `${mesh?.triangles.toLocaleString("ru-RU")} треугольников`,
  );

  check(`${width}×${height}: вершин в ряду`, mesh?.columns, columns);
  check(`${width}×${height}: рядов`, mesh?.rows, rows);
  check(`${width}×${height}: треугольников`, mesh?.triangles, triangles);
  checkRange(
    `${width}×${height}: шаг сетки не больше ${LITHOPHANE_VERTEX_STEP_MM} мм`,
    [mesh?.stepX ?? 0, mesh?.stepY ?? 0],
    0,
    LITHOPHANE_VERTEX_STEP_MM + STEP_TOLERANCE_MM,
  );
}

check("плита 210 × 210 в бюджете", lithophaneMeshSize(210, 210) !== null, true);
check("плита 215 × 215 сверх бюджета", lithophaneMeshSize(215, 215), null);

console.log("\n5. Слайдеры толщин: белое на минимуме, чёрное на максимуме");

{
  const defaults = normalizeLithophaneParams({});

  check("по умолчанию минимум 0.8 мм", defaults.lithophaneMinThickness, 0.8);
  check("по умолчанию максимум 3.0 мм", defaults.lithophaneMaxThickness, 3);
}

for (const [brightness, expected] of [
  [255, 0.8],
  [0, 3.5],
  [128, 2.15],
] as const) {
  const params: Partial<LithophaneParams> = {
    ...reliefParams(120, 80, flatFrame(brightness)),
    lithophaneMinThickness: 0.8,
    lithophaneMaxThickness: 3.5,
  };
  const plate = lithophanePlateSize(params);
  const geometry = createLithophaneReliefGeometry(params);
  const thickness = faceThickness(geometry, plate.width, plate.height);

  console.log(
    `  кадр ${brightness}/255: толщина лица ` + `${thickness.toFixed(3)} мм`,
  );

  checkRange(
    `кадр ${brightness}: толщина лица ${expected} мм`,
    [thickness - expected],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );

  geometry.dispose();
}

console.log("\n6. Подставка: один профиль со скруглением вместо склейки");

for (const mount of ["stand", "base"] as const) {
  const shape =
    mount === "base"
      ? LITHOPHANE_STAND_SHAPES.massive
      : LITHOPHANE_STAND_SHAPES.leg;
  const params: Partial<LithophaneParams> = {
    lithophaneWidth: 120,
    lithophaneHeight: 80,
    lithoFrame: true,
    lithoMount: mount,
  };
  const stand = createLithophaneStandGeometry(params);
  const size = boxSize(stand);
  const expectedWidth = Math.min(
    params.lithophaneWidth as number,
    Math.max(shape.minWidth, (params.lithophaneWidth as number) * shape.widthFactor),
  );
  // Дуга скругления идёт от базы до касания со стойкой: выше базы и позади
  // губы на профиле больше ничего нет.
  const arc = profilePoints(
    stand,
    shape.baseTop + 0.05,
    shape.baseTop + shape.filletRadius + 1,
    -2,
  );

  console.log(
    `  ${mount}: ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ` +
      `${size.z.toFixed(2)} мм, скругление ${shape.filletRadius} мм ` +
      `из ${arc} точек`,
  );

  check(`${mount}: подставка замкнута`, openEdges(stand), 0);
  check(`${mount}: NaN 0`, nanVertices(stand), 0);
  checkRange(
    `${mount}: ширина базы`,
    [size.x - expectedWidth],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );
  checkRange(
    `${mount}: глубина базы`,
    [size.z - (shape.front - shape.back)],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );
  checkRange(
    `${mount}: высота стойки`,
    [size.y - shape.strutTop],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );
  check(
    `${mount}: скругление дугой, а не острым стыком`,
    arc >= 6,
    true,
  );

  stand.dispose();
}

console.log("\n7. Группы материалов и сборка с основанием");

{
  // Сборка проверяется на маленькой панели: группы и замыкание не зависят от
  // габарита, а рельеф 120 × 80 считался бы секунды.
  const small = reliefParams(40, 30, circleFrame());
  const mounted = createLithophaneGeometry({
    ...small,
    lithoFrame: true,
    lithoMount: "base",
  });
  const bare = createLithophaneGeometry({
    ...small,
    lithoFrame: true,
    lithoMount: "none",
  });
  const reliefPart = createLithophaneGeometry(small, "relief");
  const framePart = createLithophaneGeometry(
    { ...small, lithoFrame: true },
    "frame",
  );
  const indexCount = mounted.getIndex()?.count ?? 0;
  const covered = mounted.groups.reduce((sum, group) => sum + group.count, 0);

  check("сборка с основанием: открытых рёбер 0", openEdges(mounted), 0);
  check("сборка с основанием: групп материалов 2", mounted.groups.length, 2);
  check(
    "сборка: рельеф красится группой рельефа",
    mounted.groups[0]?.materialIndex,
    LITHOPHANE_RELIEF_GROUP,
  );
  check(
    "сборка: крепление красится группой деталей",
    mounted.groups[1]?.materialIndex,
    LITHOPHANE_DETAIL_GROUP,
  );
  check("сборка: группы покрывают все индексы", covered, indexCount);
  check(
    "сборка: рельеф идёт первым",
    mounted.groups[0]?.start,
    0,
  );

  const mountedSize = boxSize(mounted);
  const bareSize = boxSize(bare);

  check("основание поднимает сборку", mountedSize.y > bareSize.y, true);
  check("основание углубляет сборку", mountedSize.z > bareSize.z, true);

  check(
    "деталь «рельеф»: одна группа рельефа",
    reliefPart.groups.map((group) => group.materialIndex),
    [LITHOPHANE_RELIEF_GROUP],
  );
  check(
    "деталь «рамка»: одна группа деталей",
    framePart.groups.map((group) => group.materialIndex),
    [LITHOPHANE_DETAIL_GROUP],
  );
  check(
    "деталь «рамка»: группа покрывает все индексы",
    framePart.groups[0]?.count,
    framePart.getIndex()?.count ?? 0,
  );

  mounted.dispose();
  bare.dispose();
  reliefPart.dispose();
  framePart.dispose();
}

console.log("");

if (failures > 0) {
  console.log(`Провалено проверок: ${failures}`);
  process.exitCode = 1;
} else {
  console.log("Все проверки прошли.");
}
