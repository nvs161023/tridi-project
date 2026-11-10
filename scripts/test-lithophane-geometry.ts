/**
 * Тест геометрии литофана: рельеф, рамка и круглая панель на четыре фото.
 *
 * Основные правила, которые закреплены здесь:
 *   • кадр вписывается в плиту по правилу contain, а не растягивается;
 *   • бортик 2 мм печатается на максимальной толщине, к фото он сужается фаской;
 *   • у каждой детали замкнутая оболочка, а шаг сетки не больше 0.3 мм;
 *   • плоская и круглая панели собираются по одной системе координат: тыл рамки
 *     лежит в плоскости Z = 0, лицо смотрит в +Z;
 *   • креплений нет: `lithoMount` знает только `none`, поэтому за панелью ничего
 *     не торчит и рамка печатается плоской;
 *   • у круглой панели четыре сектора по 90°, между ними канавка 1.5 × 0.5 мм,
 *     а на оси — плоский диск Ø4 мм.
 *
 * Что проверяется:
 *   1. кадр не растягивается: чёрный круг в центре кадра 3:2 и 1:1 остаётся
 *      круглым на панелях 120 × 80 и 200 × 150 (допуск — 2 %), габарит рельефа
 *      равен плите, NaN нет, шаг вершины не больше 0.3 мм;
 *   2. бортик 2 мм идёт на максимальной толщине, фаска 1 мм сужается к фото, а
 *      дальше толщина равна серому кадру — ровная, без ступенек;
 *   3. оболочки замкнуты: у рельефа, рамки и сборки каждое ребро встречается
 *      дважды, а габарит рамки и сборки равен панели;
 *   4. сетка: число вершин и треугольников на панели 120 × 80 и 200 × 150,
 *      плита 210 мм ещё проходит по бюджету, а 215 мм — уже нет;
 *   5. слайдеры толщин задают размах: при 0.8…3.5 мм белый кадр печатается на
 *      0.8 мм, чёрный — на 3.5 мм, а по умолчанию минимум 0.8 и максимум 3.0;
 *   6. группы материалов: рельеф и рамка — одна сетка с двумя группами, группы
 *      покрывают все индексы, а детали «рельеф» и «рамка» красятся одной;
 *   7. за панелью ничего нет: тыл рамки в плоскости Z = 0, сборка не глубже
 *      рамки, над панелью пластика нет, а без рамки печатается только плита;
 *   8. uv идут по плите: по ним карта свечения ложится на рельеф без сдвига;
 *   9. углы рамки скруглены: наружные дугой 6 мм, окно — дугой 2 мм, а плита
 *      входит в окно с зазором 0.2 мм по всему периметру, включая углы;
 *  10. яркость вершины усредняется по площади шага сетки: пиксельные ступеньки
 *      растягиваются в склон, а штрихи в два-три пикселя держат полный контраст;
 *  11. фото вписано целиком: кадр 4:3 в панели 120 × 80 остаётся круглым, а
 *      поля по бокам печатаются на минимальной толщине 0.8 мм;
 *  12. умный выбор кадра: снимок без прозрачности — фото, знак с прозрачным
 *      фоном — логотип с контрастом 0.6…3.5 мм, поля карты свечения белые, а
 *      минимальная толщина слайдера опущена до 0.6 мм;
 *  13. крепления: в списке только `none`, деталь `mount` не принимается, а
 *      старые `led_box` и `socket_rail` нормализуются в `none`, а не падают;
 *  14. круглая панель: диаметр плиты, замкнутость, бюджет треугольников и своё
 *      фото у каждого из четырёх секторов;
 *  15. секторы: канавка 1.5 × 0.5 мм на границе, плоский диск Ø4 мм в центре с
 *      одной толщиной и полная толщина кадра в середине сектора;
 *  16. uv секторов и карта четырёх кадров: каждый сектор лежит в своём квадранте,
 *      а пустой слот повторяет первый кадр;
 *  17. вес собранной панели в пределах разумного у обеих форм.
 *
 * Запуск: `npm run check:lithophane`.
 *
 * Выход: 0 — все проверки прошли, 1 — есть расхождения.
 */
import type { BufferGeometry } from "three";

import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";

import {
  LITHOPHANE_BORDER_CHAMFER_MM,
  LITHOPHANE_BORDER_MM,
  LITHOPHANE_DETAIL_GROUP,
  LITHOPHANE_FIT_GAP_MM,
  LITHOPHANE_FRAME_CORNER_RADIUS_MM,
  LITHOPHANE_FRAME_OPENING_RADIUS_MM,
  LITHOPHANE_FRAME_WIDTH_MM,
  LITHOPHANE_RELIEF_GROUP,
  LITHOPHANE_SECTOR_GROOVE,
  createLithophaneFrameGeometry,
  createLithophaneGeometry,
  createLithophaneReliefGeometry,
  lithophanePlateSize,
} from "../lib/constructor/lithophane-geometry";
import {
  LITHOPHANE_LOGO_MAX_THICKNESS_MM,
  LITHOPHANE_LOGO_MIN_THICKNESS_MM,
  lithophaneAlphaStats,
  lithophaneContainRect,
  lithophaneGlowPixels,
  lithophaneImageKind,
  lithophaneTrimBounds,
} from "../lib/constructor/lithophane-image";
import { createLithophaneSectorMapData } from "../lib/constructor/lithophane-sectors";
import {
  CONSTRUCTOR_LIMITS,
  LITHOPHANE_MOUNTS,
  LITHOPHANE_MOUNT_LABELS,
  LITHOPHANE_PARTS,
  LITHOPHANE_SIDE_IMAGE_SLOTS,
  LITHOPHANE_VERTEX_STEP_MM,
  isLithophaneMount,
  isLithophanePart,
  lithophaneMeshSize,
  normalizeLithophaneParams,
  type LithophaneBrightnessGrid,
  type LithophaneParams,
} from "../lib/constructor/params";
import {
  calculateGeometryVolumeMm3,
  calculateGeometryWeightGrams,
} from "../lib/constructor/geometry-volume";


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

/**
 * Кадр 4:3 с чёрной полосой по периметру и белой серединой.
 *
 * Полоса у самой кромки кадра — эталон обрезки: правило cover срезало её вместе
 * с краем кадра, а contain обязан оставить на месте. На фото она печатается
 * максимальной толщиной, и по ней видно, что кадр дошёл целиком.
 */
function edgeFrame(
  width = 400,
  height = 300,
  edge = 10,
): LithophaneBrightnessGrid {
  const brightness = new Array<number>(width * height);

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const onEdge =
        row < edge ||
        row >= height - edge ||
        column < edge ||
        column >= width - edge;

      brightness[row * width + column] = onEdge ? 0 : 255;
    }
  }

  return { brightness, width, height };
}

/** Ровный серый кадр: толщина фото одна и та же во всех вершинах. */
function flatFrame(
  value = 128,
  width = 400,
  height = 267,
): LithophaneBrightnessGrid {
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
 * Сколько рёбер встречается нечётное число раз: ненулевое значение — дыра.
 *
 * Ключ — округлённые координаты, а не индексы: деталь склеена из коробок и колец,
 * и у каждой грани свои вершины.
 *
 * Чётное число означает, что поверхность на этом ребре сходится: две грани у
 * обычного стыка, четыре — у перекрытия двух коробок внутри одной детали.
 * Нечётное — грань без пары, то есть настоящая дыра или Т-стык, который надо
 * перекрыть объёмом.
 */
function openEdges(geometry: BufferGeometry): number {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const edges = new Map<string, number>();
  const corners = [0, 0, 0];
  // -0.0000 и 0.0000 — одна и та же координата: тело вращения на полный оборот
  // даёт на шве sin(2π) = −2e−16, и без приведения шов выглядел бы дырой.
  const format = (value: number): string => {
    const fixed = value.toFixed(4);

    return fixed === "-0.0000" ? "0.0000" : fixed;
  };
  const vertexKey = (vertex: number): string =>
    `${format(position.getX(vertex))}:${format(position.getY(vertex))}:${format(
      position.getZ(vertex),
    )}`;
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
    if (count % 2 === 1) {
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
 * Толщина лица в точке (x, y), мм: по ближайшей вершине рельефа.
 *
 * Нужна для полей кадра: там толщина постоянная и равна минимуму, а `faceSpread`
 * и `darkSpot` дают только максимумы и габариты. Тыл отсеивается по Z: у него та
 * же X/Y, но лежит на нуле.
 */
function faceThicknessAt(
  geometry: BufferGeometry,
  x: number,
  y: number,
): number {
  const position = geometry.getAttribute("position");
  let best = Number.POSITIVE_INFINITY;
  let thickness = 0;

  for (let index = 0; index < position.count; index += 1) {
    const z = position.getZ(index);

    if (z < 0.2) {
      continue;
    }

    const dx = position.getX(index) - x;
    const dy = position.getY(index) - y;
    const distance = dx * dx + dy * dy;

    if (distance < best) {
      best = distance;
      thickness = z;
    }
  }

  return thickness;
}

/**
 * Насколько далеко точка вышла за скруглённый прямоугольник, мм.
 *
 * Отрицательное значение — насколько точка внутри контура. Считается по
 * расстоянию до ближайшей стороны или до дуги угла: так проверяется и зазор по
 * кромкам, и зазор в скруглённых углах, где прямоугольная плита упиралась бы в
 * накладку.
 */
function outsideRoundedRect(
  x: number,
  y: number,
  halfWidth: number,
  halfHeight: number,
  radius: number,
): number {
  const flatWidth = halfWidth - radius;
  const flatHeight = halfHeight - radius;
  const beyondX = Math.abs(x) - flatWidth;
  const beyondY = Math.abs(y) - flatHeight;

  if (beyondX <= 0 || beyondY <= 0) {
    return Math.max(Math.abs(x) - halfWidth, Math.abs(y) - halfHeight);
  }

  return Math.sqrt(beyondX * beyondX + beyondY * beyondY) - radius;
}

/** Кадр-шахматка: пиксель через пиксель — самая частая ступенька рельефа. */
function chessFrame(width: number, height: number): LithophaneBrightnessGrid {
  const brightness = new Array<number>(width * height);

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      brightness[row * width + column] = (row + column) % 2 === 0 ? 0 : 255;
    }
  }

  return { brightness, width, height };
}

/** Кадр со штрихами: чёрные полосы шириной `stroke` пикселей через 12. */
function stripeFrame(
  width: number,
  height: number,
  stroke: number,
): LithophaneBrightnessGrid {
  const brightness = new Array<number>(width * height);

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      brightness[row * width + column] = column % 12 < stroke ? 0 : 255;
    }
  }

  return { brightness, width, height };
}

/**
 * Размах толщины лица, мм.
 *
 * Считается только по лицу и только в середине кадра: бортик и тыл дают свои
 * значения и занизили бы контраст фото.
 */
function faceSpread(
  geometry: BufferGeometry,
  plateWidth: number,
  plateHeight: number,
): { min: number; max: number } {
  const position = geometry.getAttribute("position");
  const margin = 8;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);

    if (
      Math.abs(x) > plateWidth / 2 - margin ||
      y < margin ||
      y > plateHeight - margin ||
      z < 0.5
    ) {
      continue;
    }

    min = Math.min(min, z);
    max = Math.max(max, z);
  }

  return { min, max };
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
console.log("\n1. Кадр не растягивается: contain вместо центрального квадрата");

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
  /*
    Кадр берётся ровно по пропорциям панели: раздел проверяет бортик, а не
    вписывание. Иначе поля по краям (contain) стояли бы на минимальной толщине
    и «толщина фото» в профиле мерила бы их, а не серый кадр.
  */
  const frame = flatFrame(128, 400, Math.round((400 * height) / width));
  const geometry = createLithophaneReliefGeometry(
    reliefParams(width, height, frame),
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

{
  /*
    Максимум толщины расширен до 5 мм: перепад с минимумом 0.8 доходит до
    4.2 мм, и буквы логотипа печатаются заметно глубже. Проверяется, что 4.5 мм
    не зажимаются слайдером, а выше 5 мм значение возвращается к пределу.
  */
  const params: Partial<LithophaneParams> = {
    ...reliefParams(120, 80, flatFrame(0)),
    lithophaneMinThickness: 0.8,
    lithophaneMaxThickness: 4.5,
  };
  const plate = lithophanePlateSize(params);
  const geometry = createLithophaneReliefGeometry(params);
  const dark = faceThickness(geometry, plate.width, plate.height);
  const normalized = normalizeLithophaneParams(params);
  const clamped = normalizeLithophaneParams({
    ...params,
    lithophaneMaxThickness: 5.4,
  });

  console.log(
    `  тёмный кадр при 0.8…4.5 мм: перепад ${(
      dark - normalized.lithophaneMinThickness
    ).toFixed(2)} мм`,
  );

  check("максимум 4.5 мм не зажимается", normalized.lithophaneMaxThickness, 4.5);
  checkRange(
    "тёмный кадр доходит до 4.5 мм",
    [dark - 4.5],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );
  check("максимум выше 5 мм зажимается", clamped.lithophaneMaxThickness, 5);

  geometry.dispose();
}


console.log("\n6. Группы материалов и сборка");
{
  const all = createLithophaneGeometry(panelParams(), "all");
  const groups = all.groups.map((group) => group.materialIndex);
  const covered = all.groups.reduce((sum, group) => sum + group.count, 0);

  check("в сборке две группы материалов", groups.join(","), "0,1");
  check(
    "группы покрывают все индексы",
    covered,
    all.getIndex()?.count ?? 0,
  );
  check("первая группа — рельеф", all.groups[0]?.materialIndex, LITHOPHANE_RELIEF_GROUP);
  check(
    "вторая группа — рамка",
    all.groups[1]?.materialIndex,
    LITHOPHANE_DETAIL_GROUP,
  );

  const relief = createLithophaneGeometry(panelParams(), "relief");
  const frame = createLithophaneGeometry(panelParams(), "frame");

  check("деталь «рельеф» — одна группа", relief.groups.length, 1);
  check("деталь «рамка» — одна группа", frame.groups.length, 1);

  for (const geometry of [all, relief, frame]) {
    geometry.dispose();
  }
}

console.log("\n7. За панелью ничего не торчит: рамка плоская");
{
  const frame = createLithophaneFrameGeometry(panelParams());
  const assembled = createLithophaneGeometry(panelParams(), "all");

  frame.computeBoundingBox();
  assembled.computeBoundingBox();

  checkRange("тыл рамки в плоскости Z = 0", [frame.boundingBox?.min.z ?? 99], -0.01, 0.01);
  checkRange(
    "глубина рамки — только накладка",
    [boxSize(frame).z],
    LITHOPHANE_FIT_GAP_MM,
    5,
  );
  checkRange(
    "сборка не глубже рамки",
    [boxSize(assembled).z - boxSize(frame).z],
    -0.01,
    0.01,
  );
  check(
    "за панелью нет деталей",
    (assembled.boundingBox?.min.z ?? 99) >= -0.01,
    true,
  );
  check("рамка без крепления замкнута", openEdges(frame), 0);
  check(
    "над панелью ничего не торчит",
    hits(assembled, [0, 84, -20], [0, 0, 1]),
    false,
  );

  const frameless = createLithophaneGeometry(
    reliefParams(120, 80, flatFrame(), false),
    "all",
  );

  check("без рамки сборка красится одной группой", frameless.groups.length, 1);
  checkRange("без рамки ширина плиты", [boxSize(frameless).x], 119.9, 120.1);
  checkRange("без рамки высота плиты", [boxSize(frameless).y], 79.9, 80.1);
  frameless.dispose();

  frame.dispose();
  assembled.dispose();
}

console.log("\n8. uv рельефа: карта свечения ложится на плиту");

{
  /*
    uv идут по плите, а не по кадру: карта свечения строится под пропорции
    плиты (кадр по центру, поля белые), поэтому подсветка совпадает с рельефом
    и на полях светит так же, как светится тонкий пластик. Кадр 4 : 1 в плите
    40 × 40 — предельный случай: без полей в текстуре свечение уехало бы в
    центр. Панель ниже 40 мм нормализация поднимает до минимума.
  */
  const params = reliefParams(40, 40, circleFrame(400, 100));
  const relief = createLithophaneGeometry(params, "relief");
  const assembled = createLithophaneGeometry({ ...params, lithoFrame: true });
  const uv = relief.getAttribute("uv");
  const positions = relief.getAttribute("position");
  const assembledUv = assembled.getAttribute("uv");
  const values = Array.from((uv?.array ?? []) as Float32Array);
  const assembledValues = Array.from(
    (assembledUv?.array ?? []) as Float32Array,
  );
  let minU = Number.POSITIVE_INFINITY;
  let maxU = Number.NEGATIVE_INFINITY;
  let minV = Number.POSITIVE_INFINITY;
  let maxV = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < values.length; index += 2) {
    minU = Math.min(minU, values[index]);
    maxU = Math.max(maxU, values[index]);
    minV = Math.min(minV, values[index + 1]);
    maxV = Math.max(maxV, values[index + 1]);
  }

  check("uv рельефа есть", uv !== null, true);
  check("uv рельефа: пара на вершину", uv?.count ?? 0, positions.count);
  check("uv рельефа: без NaN", values.every(Number.isFinite), true);
  checkRange("uv рельефа: левый край плиты", [minU], -1e-3, 1e-3);
  checkRange("uv рельефа: правый край плиты", [maxU - 1], -1e-3, 1e-3);
  checkRange("uv рельефа: низ кадра", [minV], -1e-3, 1e-3);
  checkRange("uv рельефа: верх кадра", [maxV - 1], -1e-3, 1e-3);
  check(
    "сборка: uv пара на вершину",
    assembledUv?.count ?? 0,
    assembled.getAttribute("position").count,
  );
  check("сборка: uv без NaN", assembledValues.every(Number.isFinite), true);

  relief.dispose();
  assembled.dispose();
}

console.log("\n9. Скруглённые углы рамки и посадка плиты");

{
  const params: Partial<LithophaneParams> = {
    lithophaneWidth: 120,
    lithophaneHeight: 80,
    lithoFrame: true,
    lithoMount: "none",
  };
  const frame = createLithophaneFrameGeometry(params);
  const relief = createLithophaneReliefGeometry(params);
  const framePosition = frame.getAttribute("position");
  const reliefPosition = relief.getAttribute("position");
  const radius = LITHOPHANE_FRAME_CORNER_RADIUS_MM;
  // Рамка стоит на Y = 0, поэтому центр дуги правого нижнего угла — на радиусе
  // от нижней кромки и на радиусе левее правой.
  const outerCorner = { x: 120 / 2 - radius, y: radius };
  const openingHalfWidth = 120 / 2 - LITHOPHANE_FRAME_WIDTH_MM;
  const openingHalfHeight = 80 / 2 - LITHOPHANE_FRAME_WIDTH_MM;
  // Центр дуги окна: окно накладки — на `frameWidth` внутрь панели.
  const openingCorner = {
    x: openingHalfWidth - LITHOPHANE_FRAME_OPENING_RADIUS_MM,
    y: 80 / 2 - openingHalfHeight + LITHOPHANE_FRAME_OPENING_RADIUS_MM,
  };
  const arc = new Set<string>();
  const openingArc = new Set<string>();
  let closestToCorner = Number.POSITIVE_INFINITY;

  for (let index = 0; index < framePosition.count; index += 1) {
    const x = framePosition.getX(index);
    const y = framePosition.getY(index);
    const toOuterCorner = Math.hypot(x - 60, y);
    const fromOuterArc = Math.hypot(x - outerCorner.x, y - outerCorner.y);
    const fromOpeningArc = Math.hypot(
      x - openingCorner.x,
      y - openingCorner.y,
    );

    closestToCorner = Math.min(closestToCorner, toOuterCorner);

    if (
      x > outerCorner.x + 0.01 &&
      y < outerCorner.y - 0.01 &&
      Math.abs(fromOuterArc - radius) < 0.01
    ) {
      arc.add(`${x.toFixed(3)}:${y.toFixed(3)}`);
    }

    if (
      x > openingCorner.x + 0.01 &&
      y < openingCorner.y - 0.01 &&
      Math.abs(fromOpeningArc - LITHOPHANE_FRAME_OPENING_RADIUS_MM) < 0.01
    ) {
      openingArc.add(`${x.toFixed(3)}:${y.toFixed(3)}`);
    }
  }

  // Прямоугольная плита в скруглённом окне упиралась бы углами в накладку:
  // проверяется худший выход за контур окна, а плита в сборке сдвинута на
  // бортик рамки и зазор посадки.
  let worstOutside = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < reliefPosition.count; index += 1) {
    worstOutside = Math.max(
      worstOutside,
      outsideRoundedRect(
        reliefPosition.getX(index),
        reliefPosition.getY(index) + LITHOPHANE_FRAME_WIDTH_MM +
          LITHOPHANE_FIT_GAP_MM - 80 / 2,
        openingHalfWidth,
        openingHalfHeight,
        LITHOPHANE_FRAME_OPENING_RADIUS_MM,
      ),
    );
  }

  console.log(
    `  дуга наружного угла: ${arc.size} точек, окна: ${openingArc.size}, ` +
      `ближайшая вершина к углу ${closestToCorner.toFixed(3)} мм, ` +
      `плита в окне с зазором ${(-worstOutside).toFixed(3)} мм`,
  );

  check(
    `наружный угол скруглён дугой ${radius} мм`,
    arc.size >= 6,
    true,
  );
  check(
    "окно накладки скруглено дугой 2 мм",
    openingArc.size >= 6,
    true,
  );
  checkRange(
    "острого угла нет: дуга отступает от вершины",
    [closestToCorner - radius * (Math.SQRT2 - 1)],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );
  checkRange(
    "плита входит в скруглённое окно с зазором посадки",
    [-worstOutside - LITHOPHANE_FIT_GAP_MM],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );

  frame.dispose();
  relief.dispose();
}

console.log("\n10. Сглаживание: пиксельная ступенька растягивается в склон");

{
  const frame = flatFrame();
  const params = reliefParams(120, 80, frame);
  const plate = lithophanePlateSize(params);
  const normalized = normalizeLithophaneParams(params);
  const range =
    normalized.lithophaneMaxThickness - normalized.lithophaneMinThickness;

  for (const [note, source, minRatio, maxRatio] of [
    // Шахматка — предельный случай: ступенька в один пиксель. Выборка по
    // площади обязана её усреднить, иначе на буквах видна лесенка.
    ["шахматка 1 px", chessFrame(400, 267), 0, 0.65],
    // Штрихи логотипа в два-три пикселя — это буквы: контраст должен остаться.
    ["штрих 2 px", stripeFrame(400, 267, 2), 0.9, 1],
    ["штрих 3 px", stripeFrame(400, 267, 3), 0.9, 1],
  ] as const) {
    const geometry = createLithophaneReliefGeometry(
      reliefParams(120, 80, source),
    );
    const spread = faceSpread(geometry, plate.width, plate.height);
    const ratio = (spread.max - spread.min) / range;

    console.log(
      `  ${note}: толщина ${spread.min.toFixed(3)}…${spread.max.toFixed(
        3,
      )} мм, доля размаха ${ratio.toFixed(2)}`,
    );

    checkRange(
      `${note}: сглаживание ${minRatio === 0 ? "гасит" : "сохраняет"} размах`,
      [ratio],
      minRatio,
      maxRatio,
    );

    geometry.dispose();
  }
}

console.log("\n11. Фото вписано целиком: поля по краям на минимальной толщине");

for (const [width, height, note] of [
  [120, 80, "панель 3:2"],
  [120, 120, "квадратная панель"],
] as const) {
  /*
    Кадр 4:3 с чёрной полосой по периметру. Полоса у верхней и нижней кромки
    кадра — главный признак обрезки: прежнее правило cover срезало её вместе с
    краем, а contain обязан оставить на месте. Поля по краям печатаются на
    минимуме и на просвет светлые.
  */
  const frame = edgeFrame(400, 300);
  const params = reliefParams(width, height, frame);
  const plate = lithophanePlateSize(params);
  const normalized = normalizeLithophaneParams(params);
  const geometry = createLithophaneReliefGeometry(params);
  const fit = lithophaneContainRect(
    frame.width,
    frame.height,
    plate.width,
    plate.height,
  );
  const horizontalFields = fit.left > 0;
  const fieldThickness = horizontalFields
    ? faceThicknessAt(
        geometry,
        -plate.width / 2 + (fit.left * plate.width) / 2,
        plate.height / 2,
      )
    : faceThicknessAt(
        geometry,
        0,
        plate.height - (fit.top * plate.height) / 2,
      );
  // Точка в миллиметре от кромки кадра: там чёрная полоса кадра, то есть
  // максимальная толщина. Для полей сверху и снизу отступ больше — полоса
  // кадра занимает 2 мм своей высоты, и мерить надо внутри неё.
  const inset = horizontalFields ? 1 : 1.5;
  const topEdge = faceThicknessAt(
    geometry,
    0,
    plate.height * (1 - fit.top) - inset,
  );
  const bottomEdge = faceThicknessAt(
    geometry,
    0,
    plate.height * fit.top + inset,
  );

  console.log(
    `  ${note}: кадр ${(fit.width * plate.width).toFixed(2)} × ` +
      `${(fit.height * plate.height).toFixed(2)} мм, поле ` +
      `${(horizontalFields ? fit.left * plate.width : fit.top * plate.height).toFixed(2)} мм ` +
      `(толщина ${fieldThickness.toFixed(3)} мм), кромки кадра ` +
      `${bottomEdge.toFixed(2)}…${topEdge.toFixed(2)} мм`,
  );

  check(
    `${note}: поля только по одной оси`,
    horizontalFields ? fit.height === 1 : fit.width === 1,
    true,
  );
  checkRange(
    `${note}: поле по краю на минимальной толщине`,
    [fieldThickness - normalized.lithophaneMinThickness],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );
  checkRange(
    `${note}: нижняя кромка кадра не срезана`,
    [bottomEdge - normalized.lithophaneMaxThickness],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );
  checkRange(
    `${note}: верхняя кромка кадра не срезана`,
    [topEdge - normalized.lithophaneMaxThickness],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );

  geometry.dispose();
}

console.log("\n12. Умный выбор кадра: фото, логотип и контраст");

{
  check(
    "снимок без прозрачности — фото",
    lithophaneImageKind(0, 4000, 3000),
    "photo",
  );
  check(
    "снимок 16:9 с прозрачными уголками — фото",
    lithophaneImageKind(0.06, 1920, 1080),
    "photo",
  );
  check(
    "знак 1:1 с прозрачным фоном — логотип",
    lithophaneImageKind(0.55, 1024, 1024),
    "logo",
  );
  check(
    "знак 4:3, прозрачного больше четверти — логотип",
    lithophaneImageKind(0.4, 800, 600),
    "logo",
  );

  const fit = lithophaneContainRect(400, 300, 120, 80);
  const square = lithophaneContainRect(400, 300, 120, 120);

  checkRange("contain 4:3 в панели 3:2: ширина кадра", [fit.width], 0.888, 0.89);
  checkRange(
    "contain 4:3 в панели 3:2: поля по 5.6 % с каждой стороны",
    [fit.left],
    0.055,
    0.056,
  );
  check("contain в квадрате: по ширине кадр целиком", square.width, 1);
  checkRange(
    "contain в квадрате: поле сверху и снизу по четверти",
    [1 - square.height],
    0.249,
    0.251,
  );

  // Логотип 100 × 100: прозрачный фон и знак 60 × 40 в центре.
  const logoWidth = 100;
  const logoHeight = 100;
  const pixels = new Uint8Array(logoWidth * logoHeight * 4);

  for (let row = 0; row < logoHeight; row += 1) {
    for (let column = 0; column < logoWidth; column += 1) {
      const inside = column >= 20 && column < 80 && row >= 30 && row < 70;
      const offset = (row * logoWidth + column) * 4;

      pixels[offset + 3] = inside ? 255 : 0;
    }
  }

  const stats = lithophaneAlphaStats(pixels, logoWidth, logoHeight);

  console.log(
    `  логотип ${logoWidth} × ${logoHeight}: прозрачного ` +
      `${(stats.transparentShare * 100).toFixed(1)} %, габарит краски ` +
      `${JSON.stringify(stats.bounds)}`,
  );

  checkRange("логотип: доля прозрачного фона", [stats.transparentShare], 0.75, 0.77);
  check("логотип: габарит краски по альфе", stats.bounds, {
    left: 20,
    top: 30,
    right: 79,
    bottom: 69,
  });
  check(
    "логотип: обрезка с запасом в пиксель",
    stats.bounds
      ? lithophaneTrimBounds(stats.bounds, logoWidth, logoHeight)
      : null,
    { left: 19, top: 29, right: 80, bottom: 70 },
  );
}

{
  /*
    Карта свечения: кадр 2 : 1 в плите 3 : 1. Кадр вписан, значит поля остаются
    по бокам, и текстура шире сетки ровно на них. Поля белые: их толщина
    минимальна, и на просвет они светятся — иначе на панели была бы тёмная
    рамка, которой в пластике нет.
  */
  const glow = lithophaneGlowPixels(
    { brightness: new Array<number>(4 * 2).fill(0), width: 4, height: 2 },
    120,
    40,
  );
  const leftEdge = Array.from(glow.pixels.slice(0, 4));
  const rightEdge = Array.from(
    glow.pixels.slice((glow.width - 1) * 4, glow.width * 4),
  );

  console.log(
    `  карта свечения: ${glow.width} × ${glow.height} пикселей, ` +
      `поле слева ${leftEdge.join(",")}`,
  );

  check("карта свечения: шире сетки на поля", glow.width, 6);
  check("карта свечения: высота сетки", glow.height, 2);
  check("карта свечения: поле белое", leftEdge, [255, 255, 255, 255]);
  check("карта свечения: правое поле белое", rightEdge, [255, 255, 255, 255]);
  check(
    "карта свечения: кадр тёмный по центру",
    Array.from(glow.pixels.slice(4, 8)),
    [0, 0, 0, 255],
  );
}

{
  /*
    Контраст логотипа: знак 3.5 мм на фоне 0.6 мм. С прежними 0.8…3.0 знак
    сливался с прозрачным фоном на просвет — владелец показывал скриншот, где
    буквы тонули в светлом фоне.
  */
  const logoParams: Partial<LithophaneParams> = {
    ...reliefParams(120, 80, flatFrame(0)),
    lithophaneMinThickness: LITHOPHANE_LOGO_MIN_THICKNESS_MM,
    lithophaneMaxThickness: LITHOPHANE_LOGO_MAX_THICKNESS_MM,
  };
  const lightParams: Partial<LithophaneParams> = {
    ...reliefParams(120, 80, flatFrame(255)),
    lithophaneMinThickness: LITHOPHANE_LOGO_MIN_THICKNESS_MM,
    lithophaneMaxThickness: LITHOPHANE_LOGO_MAX_THICKNESS_MM,
  };
  const logoGeometry = createLithophaneReliefGeometry(logoParams);
  const lightGeometry = createLithophaneReliefGeometry(lightParams);
  const plate = lithophanePlateSize(logoParams);
  const sign = faceThickness(logoGeometry, plate.width, plate.height);
  const backdrop = faceThickness(lightGeometry, plate.width, plate.height);

  console.log(
    `  логотип ${LITHOPHANE_LOGO_MIN_THICKNESS_MM}…` +
      `${LITHOPHANE_LOGO_MAX_THICKNESS_MM} мм: фон ${backdrop.toFixed(3)} мм, ` +
      `знак ${sign.toFixed(3)} мм`,
  );

  checkRange(
    "логотип: знак на 3.5 мм",
    [sign - LITHOPHANE_LOGO_MAX_THICKNESS_MM],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );
  checkRange(
    "логотип: прозрачный фон на 0.6 мм",
    [backdrop - LITHOPHANE_LOGO_MIN_THICKNESS_MM],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );
  check(
    "слайдер минимума опущен до толщины логотипа",
    CONSTRUCTOR_LIMITS.lithophaneMinThickness.min,
    LITHOPHANE_LOGO_MIN_THICKNESS_MM,
  );
  check(
    "слайдер максимума вмещает толщину логотипа",
    CONSTRUCTOR_LIMITS.lithophaneMaxThickness.max >=
      LITHOPHANE_LOGO_MAX_THICKNESS_MM,
    true,
  );
  check(
    "нормализация принимает минимум логотипа",
    normalizeLithophaneParams({ lithophaneMinThickness: 0.6 })
      .lithophaneMinThickness,
    0.6,
  );

  logoGeometry.dispose();
  lightGeometry.dispose();
}

/**
 * Пересекает ли луч геометрию детали.
 *
 * Луч нужен там, где ответ «есть ли пластик в этой точке» проще проверить
 * трассировкой, чем разбором вершин: окно под провод, отверстие площадки,
 * козырёк. Материал двусторонний, чтобы попадание считалось с любой стороны.
 */
function hits(
  geometry: BufferGeometry,
  origin: [number, number, number],
  direction: [number, number, number],
): boolean {
  const material = new MeshBasicMaterial({ side: DoubleSide });
  const mesh = new Mesh(geometry, material);
  const raycaster = new Raycaster(
    new Vector3(...origin),
    new Vector3(...direction).normalize(),
    0,
    2000,
  );
  const found = raycaster.intersectObject(mesh).length > 0;

  material.dispose();

  return found;
}

/**
 * Средняя толщина рельефа в кольце сектора, мм.
 *
 * Угол считается от +Y по часовой стрелке — так же, как секторы режут круглую
 * панель. В выборку попадают вершины лица в кольце 0.6…0.9 радиуса: бортик и
 * центр диска в замер не входят.
 */
function sectorThickness(
  geometry: BufferGeometry,
  centerY: number,
  radius: number,
  fromDeg: number,
  toDeg: number,
): number {
  const position = geometry.getAttribute("position");
  let sum = 0;
  let count = 0;

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index) - centerY;
    const z = position.getZ(index);
    const distance = Math.hypot(x, y);

    if (z <= 0 || distance < radius * 0.6 || distance > radius * 0.9) {
      continue;
    }

    let angle = (Math.atan2(x, y) * 180) / Math.PI;

    if (angle < 0) {
      angle += 360;
    }

    if (angle >= fromDeg && angle < toDeg) {
      sum += z;
      count += 1;
    }
  }

  return count > 0 ? sum / count : 0;
}

/** Параметры собранной панели: 120 × 80, серый кадр и рамка. */
function panelParams(
  extra: Partial<LithophaneParams> = {},
): Partial<LithophaneParams> {
  return { ...reliefParams(120, 80, flatFrame(), true), ...extra };
}

console.log("\n13. Крепления: остался только пункт «Без подставки»");
{
  check("в списке креплений только none", LITHOPHANE_MOUNTS.join(","), "none");
  check("подпись крепления", LITHOPHANE_MOUNT_LABELS.none, "Без подставки");
  check("деталей литофана три", LITHOPHANE_PARTS.join(","), "relief,frame,all");
  check("деталь «крепление» больше не принимается", isLithophanePart("mount"), false);
  check("старое крепление не проходит проверку", isLithophaneMount("led_box"), false);
  check("старый монорельс из проекта не проходит", isLithophaneMount("socket_rail"), false);

  const legacy = {
    lithoMount: "socket_rail",
  } as unknown as Partial<LithophaneParams>;

  check(
    "старый проект открывается без крепления",
    normalizeLithophaneParams(legacy).lithoMount,
    "none",
  );
  check(
    "без рамки крепления тоже нет",
    normalizeLithophaneParams({ lithoFrame: false }).lithoMount,
    "none",
  );

  const roundPlate = lithophanePlateSize({
    lithoShape: "round",
    lithophaneWidth: 100,
    lithophaneHeight: 60,
    lithoFrame: true,
  });

  check("у круга плита квадратна по габариту", roundPlate.width, roundPlate.height);
}

console.log("\n14. Круглая панель: полярная сетка и четыре сектора");
{
  const params: Partial<LithophaneParams> = {
    lithoShape: "round",
    lithophaneWidth: 120,
    lithoFrame: true,
  };
  const plate = lithophanePlateSize(params);
  const relief = createLithophaneReliefGeometry(params);
  const size = boxSize(relief);

  checkRange(
    "диаметр плиты по X и Y совпадает",
    [size.x, size.y],
    plate.width - 0.2,
    plate.width + 0.2,
  );
  checkRange("толщина круга в границах слайдеров", [size.z], 1, 5);
  check("круглый рельеф замкнут", openEdges(relief), 0);
  check("в круглом рельефе нет NaN", nanVertices(relief), 0);
  checkRange(
    "треугольников у круга меньше миллиона",
    [triangleCount(relief)],
    1000,
    1_000_000,
  );

  const frames = [255, 200, 128, 40].map((value) => flatFrame(value, 400, 400));
  const four = createLithophaneReliefGeometry({
    ...params,
    lithophaneBrightness: frames[0].brightness,
    lithophaneBrightnessWidth: 400,
    lithophaneBrightnessHeight: 400,
    lithophaneSideBrightness: [frames[1], frames[2], frames[3]],
  });
  const radius = plate.width / 2;
  const centerY = radius;
  const thicknesses = [0, 1, 2, 3].map((sector) =>
    sectorThickness(four, centerY, radius, sector * 90 + 10, sector * 90 + 80),
  );

  check(
    "у каждого сектора свой кадр",
    thicknesses.every(
      (value, index) => index === 0 || thicknesses[index - 1] < value,
    ),
    true,
  );
  checkRange("самый светлый сектор на минимуме", [thicknesses[0]], 0.5, 1.2);
  checkRange("самый тёмный сектор у максимума", [thicknesses[3]], 2.4, 3.2);
  four.dispose();
  relief.dispose();
}

console.log("\n15. Секторы: канавка 1.5 × 0.5 мм и плоский диск Ø4 мм");
{
  const groove = LITHOPHANE_SECTOR_GROOVE;
  const darkFrame = flatFrame(0, 400, 400);
  const params: Partial<LithophaneParams> = {
    lithoShape: "round",
    lithophaneWidth: 120,
    lithoFrame: true,
    lithophaneBrightness: darkFrame.brightness,
    lithophaneBrightnessWidth: darkFrame.width,
    lithophaneBrightnessHeight: darkFrame.height,
  };
  const plate = lithophanePlateSize(params);
  const radius = plate.width / 2;
  const minThickness = CONSTRUCTOR_LIMITS.lithophaneMinThickness.defaultValue;
  const maxThickness = CONSTRUCTOR_LIMITS.lithophaneMaxThickness.defaultValue;
  // Чёрный кадр печатается на максимуме: лицо сектора — это и есть поверхность,
  // от которой считается глубина канавки.
  const surface = maxThickness;
  const hubThickness = minThickness + (maxThickness - minThickness) / 2;
  const relief = createLithophaneReliefGeometry(params);
  const position = relief.getAttribute("position");
  const quarter = Math.PI / 2;
  let hubMin = Number.POSITIVE_INFINITY;
  let hubMax = Number.NEGATIVE_INFINITY;
  let boundaryMin = Number.POSITIVE_INFINITY;
  let sectorMax = Number.NEGATIVE_INFINITY;
  let grooveHalfWidth = 0;

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index) - radius;
    const z = position.getZ(index);
    const distance = Math.hypot(x, y);

    if (z <= 0 || distance > radius - LITHOPHANE_BORDER_MM) {
      continue;
    }

    if (distance <= groove.hubRadius - 0.2) {
      hubMin = Math.min(hubMin, z);
      hubMax = Math.max(hubMax, z);
      continue;
    }

    let angle = Math.atan2(x, y);

    if (angle < 0) {
      angle += Math.PI * 2;
    }

    const wrapped = ((angle % quarter) + quarter) % quarter;
    const toBoundary = Math.min(wrapped, quarter - wrapped);
    const fromBoundary = distance * Math.sin(toBoundary);

    if (distance >= 20 && distance <= 40) {
      if (fromBoundary <= 0.15) {
        boundaryMin = Math.min(boundaryMin, z);
      }

      if (fromBoundary >= 4) {
        sectorMax = Math.max(sectorMax, z);
      }
    }

    if (distance >= 29 && distance <= 31 && z < surface - 0.01) {
      grooveHalfWidth = Math.max(grooveHalfWidth, fromBoundary);
    }
  }

  checkRange(
    "плоский диск в центре: одна толщина",
    [hubMin, hubMax],
    hubThickness - 0.01,
    hubThickness + 0.01,
  );
  checkRange("середина сектора: полная толщина кадра", [sectorMax], surface - 0.01, surface + 0.01);
  checkRange(
    "канавка на границе секторов: 0.5 мм",
    [surface - boundaryMin],
    groove.depth - 0.06,
    groove.depth + 0.01,
  );
  checkRange(
    "ширина канавки: около 1.5 мм",
    [grooveHalfWidth * 2],
    1.1,
    1.9,
  );
  check("рельеф с канавками замкнут", openEdges(relief), 0);
  check("в рельефе с канавками нет NaN", nanVertices(relief), 0);
  relief.dispose();
}

console.log("\n16. uv секторов и карта четырёх кадров");
{
  const white = flatFrame(255, 400, 400);
  const dark = flatFrame(0, 400, 400);
  const params: Partial<LithophaneParams> = {
    lithoShape: "round",
    lithophaneWidth: 120,
    lithoFrame: true,
    lithophaneBrightness: white.brightness,
    lithophaneBrightnessWidth: white.width,
    lithophaneBrightnessHeight: white.height,
    lithophaneSideBrightness: [
      { brightness: dark.brightness, width: 400, height: 400 },
      null,
      null,
    ],
  };
  const plate = lithophanePlateSize(params);
  const radius = plate.width / 2;
  const relief = createLithophaneReliefGeometry(params);
  const position = relief.getAttribute("position");
  const uv = relief.getAttribute("uv");
  const quarter = Math.PI / 2;
  let wrongQuadrant = 0;

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index) - radius;
    const z = position.getZ(index);
    const distance = Math.hypot(x, y);

    if (z <= 0 || distance < radius * 0.3) {
      continue;
    }

    let angle = Math.atan2(x, y);

    if (angle < 0) {
      angle += Math.PI * 2;
    }

    const sector = Math.min(3, Math.floor(angle / quarter));
    const u = uv?.getX(index) ?? 0;
    const v = uv?.getY(index) ?? 0;
    const right = u >= 0.5;
    const top = v < 0.5;

    if (right !== (sector === 0 || sector === 1) || top !== (sector === 0 || sector === 3)) {
      wrongQuadrant += 1;
    }
  }

  check("uv каждого сектора лежит в своём квадранте", wrongQuadrant, 0);

  const map = createLithophaneSectorMapData([white, dark, null, null], 100);
  const pixel = (u: number, v: number): number => {
    const column = Math.floor(u * map.side);
    const row = Math.floor(v * map.side);

    return map.data[(row * map.side + column) * 4];
  };

  check("сторона карты — две стороны кадра", map.side, 100);
  check("сектор 1 в правом верхнем квадранте", pixel(0.75, 0.25), 255);
  check("сектор 2 в правом нижнем квадранте", pixel(0.75, 0.75), 0);
  check("пустой сектор 3 повторяет первый кадр", pixel(0.25, 0.75), 255);
  check("пустой сектор 4 повторяет первый кадр", pixel(0.25, 0.25), 255);
  check(
    "слотов под кадры остальных секторов три",
    LITHOPHANE_SIDE_IMAGE_SLOTS,
    3,
  );
  relief.dispose();
}

console.log("\n17. Вес сборок: плоская панель и круглая");
{
  for (const shape of ["flat", "round"] as const) {
    const all = createLithophaneGeometry(
      panelParams({ lithoShape: shape }),
      "all",
    );
    const volume = calculateGeometryVolumeMm3(all);
    const weight = calculateGeometryWeightGrams(all);

    checkRange(`сборка «${shape}» имеет объём`, [volume], 1000, 1_500_000);
    checkRange(`сборка «${shape}» весит разумно`, [weight], 5, 500);
    console.log(`       вес сборки «${shape}»: ${weight.toFixed(1)} г`);
    all.dispose();
  }
}




console.log("");
if (failures > 0) {
  console.log(`Провалено проверок: ${failures}`);
  process.exit(1);
}

console.log("Все проверки прошли.");






