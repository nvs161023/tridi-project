/**
 * Тест геометрии литофана: пропорции кадра, бортик с фаской, сетка и бюджет.
 *
 * Главная ошибка, которую здесь закреплено исправление: кадр 3:2 попадал на
 * панель 120 × 80 растянутым на 59 %. Фотография вырезалась центральным
 * квадратом ещё на canvas, а геометрия размазывала этот квадрат по плите с
 * другим отношением сторон. Теперь в состоянии лежит прямоугольная сетка
 * (400 пикселей по длинной стороне), а вписывает её в панель геометрия по
 * правилу contain: кадр виден целиком, пиксель остаётся квадратным, а поля по
 * краям печатаются на минимальной толщине.
 *
 * Второе правило — умный выбор без ручного режима. Снимок вписывается целиком,
 * логотип с прозрачным фоном обрезается по краю знака и получает контраст
 * 0.6…3.5 мм: `lithophane-image.ts` решает это по доле прозрачного и пропорциям.
 *
 * Третье правило — бортик. Фото кончается за 2 мм до кромки, и эти 2 мм
 * печатаются на максимальной толщине: край не просвечивает и не крошится. В
 * рельеф бортик переходит фаской 1 мм, поэтому сопло не встречает вертикальную
 * стенку и над фото нет ступеньки в 2 мм.
 *
 * Четвёртое правило — сетка. Шаг вершины больше не фиксирован числом вершин:
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
 *      сборки без крепления;
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
 *  13. открытая арка: середина проёма свободна для света (луч из-за подставки
 *      проходит на 6…33 мм над столом), ножки стоят по краям базы, в базе есть
 *      канал 10 × 2 мм под ленту и канавка под провод, а панель опускается в паз
 *      3.5 мм — сборка на 3.42 мм ниже, чем со сплошной подставкой;
 *  14. USB-лампа: круглая стойка Ø30.7 на 26 мм с каналом Ø14.2 мм — штекер
 *      Type-A проходит чашу насквозь и стоит на верхе базы (6 мм), под каналом
 *      пластик замкнут; чаша поднимается от канала к кромке, дно ниже кромки на
 *      6 мм, стойка не наезжает на панель и не выходит за базу, канала под ленту
 *      в базе нет, а выше базы нет граней, смотрящих вниз круче 45° — печать без
 *      поддержек;
 *  15. патрон E27: круглое гнездо Ø40 × 15 мм (тело вращения, а не призма) с
 *      дном на 3 мм выше базы, база глубже на 10 мм под стакан и абажур, прорезь
 *      18° в стенке пропускает провод, абажур Ø54 на 33 мм закрыт сзади и открыт
 *      в сторону панели вырезом 120°, его кромка не наезжает на панель и не
 *      выходит за базу, нависаний выше базы нет;
 *  16. подвес: закрытый световой короб за рамкой — тыл в 15 мм от рамки, открыт
 *      только в её окно, канал под ленту 10 × 2 мм с полом на 8.5 мм, окно под
 *      провод 6 × 5 мм на уровне пола канала, две петли по 10 мм с выступом
 *      12 мм и карманом под шляпку шурупа, короб вписан в контур рамки.
 *
 * Запуск: `npm run check:lithophane`.
 *
 * Выход: 0 — все проверки прошли, 1 — есть расхождения.
 */
import type { BufferGeometry } from "three";

import { Mesh, Raycaster, Vector3 } from "three";

import {
  LITHOPHANE_ARCH_STAND,
  LITHOPHANE_BORDER_CHAMFER_MM,
  LITHOPHANE_BORDER_MM,
  LITHOPHANE_DETAIL_GROUP,
  LITHOPHANE_FIT_GAP_MM,
  LITHOPHANE_FRAME_CORNER_RADIUS_MM,
  LITHOPHANE_FRAME_OPENING_RADIUS_MM,
  LITHOPHANE_FRAME_WIDTH_MM,
  LITHOPHANE_RELIEF_GROUP,
  LITHOPHANE_SOCKET_LIGHT,
  LITHOPHANE_STAND_SHAPES,
  LITHOPHANE_STAND_TILT_DEG,
  LITHOPHANE_USB_LIGHT,
  LITHOPHANE_WALL_BOX,
  createLithophaneFrameGeometry,
  createLithophaneGeometry,
  createLithophaneReliefGeometry,
  createLithophaneStandGeometry,
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
import {
  CONSTRUCTOR_LIMITS,
  LITHOPHANE_VERTEX_STEP_MM,
  lithophaneMeshSize,
  lithophaneShapeHasMounts,
  normalizeLithophaneParams,
  type LithophaneBrightnessGrid,
  type LithophaneParams,
  type LithophaneShape,
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

/**
 * Перекрыт ли пластик на высоте `y` по центру детали.
 *
 * Луч идёт из-за подставки вперёд вдоль Z: у открытой арки он проходит между
 * ножками, у сплошной стойки упирается в пластик. Так проверяется то, ради чего
 * арку и сделали, — свет от лампы за литофаном доходит до низа кадра.
 */
function blockedAt(geometry: BufferGeometry, x: number, y: number): boolean {
  const mesh = new Mesh(geometry);
  const ray = new Raycaster(
    new Vector3(x, y, -200),
    new Vector3(0, 0, 1),
    0,
    300,
  );

  return ray.intersectObject(mesh, false).length > 0;
}
/**
 * Первое попадание луча в деталь.
 *
 * `origin` и `direction` — точка и вектор направления в миллиметрах. Паз под
 * штекер и гнездо под патрон проверяются именно так: по координате попадания
 * видно, на какой стенке луч остановился, а `null` значит, что луч прошёл насквозь
 * — гнездо открыто.
 */
function firstHit(
  geometry: BufferGeometry,
  origin: readonly [number, number, number],
  direction: readonly [number, number, number],
): Vector3 | null {
  const mesh = new Mesh(geometry);
  const ray = new Raycaster(
    new Vector3(...origin),
    new Vector3(...direction).normalize(),
    0,
    400,
  );
  const [hit] = ray.intersectObject(mesh, false);

  return hit ? hit.point.clone() : null;
}

/**
 * Непрерывные участки отсортированных замеров со шагом сканирования.
 *
 * Замеры собираются циклом по сетке точек, поэтому разрыв между соседними
 * значениями — это граница окна или кармана. Каждый участок отдаётся с началом,
 * концом, шириной и серединой: по ширине видно размер окна, а по середине — где
 * оно стоит.
 */
function contiguousRuns(
  values: number[],
  step: number,
): { from: number; to: number; width: number; center: number }[] {
  const runs: { from: number; to: number; width: number; center: number }[] = [];
  let from = Number.NaN;
  let previous = Number.NaN;

  const close = () => {
    runs.push({
      from,
      to: previous,
      width: previous - from + step,
      center: (from + previous) / 2,
    });
  };

  for (const value of values) {
    if (!Number.isNaN(from) && value - previous > step * 1.5) {
      close();
      from = value;
    } else if (Number.isNaN(from)) {
      from = value;
    }

    previous = value;
  }

  if (!Number.isNaN(from)) {
    close();
  }

  return runs;
}

/**
 * Сколько граней выше `fromY` смотрят вниз круче 45°.
 * Это проверка печати без поддержек: вертикальная стенка (нормаль
 * горизонтальная) и наклон до 45° печатаются сами, а поверхность, которая
 * смотрит вниз круче, провисает. Считаются только треугольники целиком выше
 * `fromY` — низ базы и её паз лежат на столе и поддержек не требуют.
 */
function downwardFaces(geometry: BufferGeometry, fromY: number): number {
  const index = geometry.getIndex();
  const position = geometry.getAttribute("position");
  const triangles = (index?.count ?? position.count) / 3;
  let count = 0;

  for (let triangle = 0; triangle < triangles; triangle += 1) {
    const corners = [0, 1, 2].map((corner) => {
      const id = index ? index.getX(triangle * 3 + corner) : triangle * 3 + corner;

      return new Vector3(
        position.getX(id),
        position.getY(id),
        position.getZ(id),
      );
    });

    if (Math.min(...corners.map((corner) => corner.y)) <= fromY) {
      continue;
    }

    const normal = new Vector3()
      .subVectors(corners[1], corners[0])
      .cross(new Vector3().subVectors(corners[2], corners[0]));

    if (normal.lengthSq() === 0) {
      continue;
    }

    // cos 45° — граница между нависанием и наклонной стенкой.
    if (normal.normalize().y < -Math.SQRT1_2) {
      count += 1;
    }
  }

  return count;
}

/**
 * Профиль изгиба: расстояние вершин от оси и угол заворота, градусы.
 *
 * Ось изгиба лежит на тыле детали (Z = −R), поэтому у плоской детали вершины
 * стоят на разных расстояниях от неё, а у изогнутой — на R + толщина: это и есть
 * признак цилиндра. Угол считается от плоскости симметрии, поэтому у
 * полуцилиндра он доходит до ±90°, а размах говорит, на сколько градусов
 * завернулась панель.
 */
function bendProfile(
  geometry: BufferGeometry,
  radius: number,
): { minRadius: number; maxRadius: number; minAngle: number; maxAngle: number } {
  const position = geometry.getAttribute("position");
  let minRadius = Number.POSITIVE_INFINITY;
  let maxRadius = Number.NEGATIVE_INFINITY;
  let minAngle = Number.POSITIVE_INFINITY;
  let maxAngle = Number.NEGATIVE_INFINITY;

  for (let vertex = 0; vertex < position.count; vertex += 1) {
    const x = position.getX(vertex);
    const z = position.getZ(vertex);

    minRadius = Math.min(minRadius, Math.hypot(x, z + radius));
    maxRadius = Math.max(maxRadius, Math.hypot(x, z + radius));
    minAngle = Math.min(
      minAngle,
      (Math.atan2(x, z + radius) * 180) / Math.PI,
    );
    maxAngle = Math.max(
      maxAngle,
      (Math.atan2(x, z + radius) * 180) / Math.PI,
    );
  }

  return { minRadius, maxRadius, minAngle, maxAngle };
}


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

console.log("\n13. Открытая арка: проём под свет и канал под ленту");

{
  /*
    Владелец заметил тёмное пятно на просвет: сплошная стойка во всю ширину
    закрывала нижние 30 мм панели. Открытая арка держит панель двумя ножками по
    краям базы, а рамка опускается в паз 3.5 мм. Раздел проверяет именно это:
    середина проёма свободна для света, ножки стоят по краям, а в базе есть
    канал 10 × 2 мм под ленту и канавка под провод.
  */
  const params: Partial<LithophaneParams> = {
    lithophaneWidth: 120,
    lithophaneHeight: 80,
    lithoFrame: true,
    lithoMount: "arch",
  };
  const shape = LITHOPHANE_ARCH_STAND;
  const tilt = (LITHOPHANE_STAND_TILT_DEG * Math.PI) / 180;
  const stand = createLithophaneStandGeometry(params);
  const size = boxSize(stand);
  const expectedWidth = Math.min(
    params.lithophaneWidth as number,
    Math.max(
      shape.minWidth,
      (params.lithophaneWidth as number) * shape.widthFactor,
    ),
  );
  // Габарит рамки по Z — глубина паза: рамка входит в него с зазором по сторонам.
  const frameDepth = boxSize(createLithophaneFrameGeometry(params)).z;
  const seatFloor = shape.baseTop - shape.seatDepth * Math.cos(tilt);
  const channelFloor = shape.baseTop - shape.channelDepth;
  const position = stand.getAttribute("position");
  let channelMin = Number.POSITIVE_INFINITY;
  let channelMax = Number.NEGATIVE_INFINITY;
  let wireMin = Number.POSITIVE_INFINITY;
  let wireMax = Number.NEGATIVE_INFINITY;
  let seatMin = Number.POSITIVE_INFINITY;
  let seatMax = Number.NEGATIVE_INFINITY;
  let aboveMiddle = 0;

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);

    // Канал ленты ближе к панели, канавка провода — у тыльной кромки: их делит
    // середина базы по Z, других выборок на этой глубине нет.
    if (Math.abs(y - channelFloor) < TOLERANCE_MM) {
      if (z > shape.back / 2) {
        channelMin = Math.min(channelMin, z);
        channelMax = Math.max(channelMax, z);
      } else {
        wireMin = Math.min(wireMin, z);
        wireMax = Math.max(wireMax, z);
      }
    }

    if (Math.abs(y - seatFloor) < TOLERANCE_MM) {
      seatMin = Math.min(seatMin, z);
      seatMax = Math.max(seatMax, z);
    }

    if (y > shape.baseTop + 0.5 && Math.abs(x) < 20) {
      aboveMiddle += 1;
    }
  }

  /*
    Панель в сборке опускается в паз на `seatDepth` вдоль своей плоскости:
    верх сборки с аркой ниже верха сборки со сплошной подставкой ровно на
    seatDepth · cos 12°, то есть на 3.42 мм.
  */
  const archHeight = boxSize(createLithophaneGeometry(params)).y;
  const solidHeight = boxSize(
    createLithophaneGeometry({ ...params, lithoMount: "stand" }),
  ).y;
  const solidStand = createLithophaneStandGeometry({
    ...params,
    lithoMount: "stand",
  });
  const legX = expectedWidth / 2 - shape.legWidth / 2;

  console.log(
    `  подставка ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ` +
      `${size.z.toFixed(2)} мм, канал ` +
      `${(channelMax - channelMin).toFixed(2)} × ${shape.channelDepth} мм`,
  );
  console.log(
    `  паз: дно на ${seatFloor.toFixed(2)} мм, ширина ` +
      `${(seatMax - seatMin).toFixed(2)} мм; канавка провода ` +
      `${(wireMax - wireMin).toFixed(2)} мм`,
  );
  console.log(
    `  сборка с аркой: ${archHeight.toFixed(2)} мм против ` +
      `${solidHeight.toFixed(2)} мм у сплошной — панель утоплена на ` +
      `${(solidHeight - archHeight).toFixed(2)} мм`,
  );

  check("арка: подставка замкнута", openEdges(stand), 0);
  check("арка: NaN 0", nanVertices(stand), 0);
  checkRange(
    "арка: ширина базы",
    [size.x - expectedWidth],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );
  checkRange(
    "арка: высота ножек",
    [size.y - shape.legTop],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );
  checkRange(
    "арка: глубина базы",
    [size.z - (shape.front - shape.back)],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );
  check("арка: над базой материала в середине нет", aboveMiddle, 0);
  checkRange(
    "арка: канал под ленту 8–10 мм",
    [channelMax - channelMin],
    shape.channelWidth - TOLERANCE_MM,
    shape.channelWidth + TOLERANCE_MM,
  );
  check(
    "арка: канал вмещает ленту 8 мм",
    channelMax - channelMin >= 8,
    true,
  );
  check(
    "арка: лента укладывается между ножками",
    expectedWidth - 2 * shape.legWidth >= 20,
    true,
  );
  checkRange(
    "арка: канавка под провод 1–2 мм глубиной",
    [shape.wireDepth],
    1,
    2,
  );
  checkRange(
    "арка: канавка провода в базе",
    [wireMax - wireMin],
    shape.wireWidth - TOLERANCE_MM,
    shape.wireWidth + TOLERANCE_MM,
  );
  checkRange(
    "арка: паз глубже 3 мм",
    [shape.seatDepth],
    3,
    4,
  );
  checkRange(
    "арка: дно паза ниже верха базы на глубину паза",
    [shape.baseTop - seatFloor - shape.seatDepth * Math.cos(tilt)],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );
  checkRange(
    "арка: паз по глубине рамки с зазором 0.2 мм",
    [seatMax - seatMin],
    frameDepth + 2 * LITHOPHANE_FIT_GAP_MM - TOLERANCE_MM,
    frameDepth + 2 * LITHOPHANE_FIT_GAP_MM + TOLERANCE_MM,
  );
  checkRange(
    "арка: панель опущена в паз на 3.42 мм",
    [solidHeight - archHeight - shape.seatDepth * Math.cos(tilt)],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );

  for (const y of [shape.baseTop + 1, 12, 20, 28, shape.legTop - 1]) {
    check(
      `арка: свет проходит в середине на ${y} мм`,
      blockedAt(stand, 0, y),
      false,
    );
  }

  check(
    "арка: ножка по краю базы перекрывает",
    blockedAt(stand, legX, 20),
    true,
  );
  for (const y of [shape.baseTop + 1, 20]) {
    check(
      `сплошная ножка: середина перекрыта на ${y} мм`,
      blockedAt(solidStand, 0, y),
      true,
    );
  }

  stand.dispose();
  solidStand.dispose();
}

console.log("\n14. USB-лампа: стойка с чашей и каналом под штекер");

{
  /*
    Владелец предложил питать литофан обычной USB mini LED лампой: штекер Type-A
    12 × 4.5 мм и пластиковая колба Ø20–28 мм. Раздел проверяет крепление под
    неё: канал под штекер, чашу под колбу, силуэт стойки и печать без поддержек.
    Стойка — тело вращения, а не призма с пропилом: оболочка цельная, а штекер
    вставляют сверху через чашу, и он стоит на базе.
  */
  const params: Partial<LithophaneParams> = {
    lithophaneWidth: 120,
    lithophaneHeight: 80,
    lithoFrame: true,
    lithoMount: "arch",
    lithoLightSource: "usb_bulb",
  };
  const shape = LITHOPHANE_ARCH_STAND;
  const usb = LITHOPHANE_USB_LIGHT;
  const tilt = (LITHOPHANE_STAND_TILT_DEG * Math.PI) / 180;
  const stand = createLithophaneStandGeometry(params);
  const size = boxSize(stand);
  const centerZ = usb.centerZ;
  // Канал под штекер: луч поперёк стойки и луч сверху, который проходит чашу с
  // каналом насквозь и останавливается на верхе базы.
  const channel = firstHit(stand, [0, 10, centerZ], [1, 0, 0]);
  const channelFloor = firstHit(stand, [0, 60, centerZ], [0, -1, 0]);
  // Чаша в стороне от канала: чем дальше от оси, тем выше её дно.
  const offsets = [0, 8, 11, 14];
  const bowlProfile = offsets.map((offset) => {
    const hit = firstHit(stand, [-offset, 60, centerZ], [0, -1, 0]);

    return hit ? hit.y : Number.NaN;
  });
  // Наружная стенка стойки: луч сбоку на 5 мм выше пояса. Изнутри он упёрся бы
  // в чашу, поэтому начинается он между стойкой и ножкой.
  const podEdge = firstHit(stand, [30, usb.waistY + 5, centerZ], [-1, 0, 0]);
  const edgeHalf =
    usb.waistRadius +
    ((usb.rimRadius - usb.waistRadius) * 5) / (usb.rimY - usb.waistY);
  // За пазом рамки канала под ленту быть не должно: база под лампу гладкая.
  const plainBase = firstHit(stand, [0, 60, -3], [0, -1, 0]);
  // Под каналом база замкнута: штекер стоит на ней, а не уходит в стол.
  const underChannel = firstHit(stand, [0, -5, centerZ], [0, 1, 0]);
  const panelAboveRim = -(usb.rimY - shape.baseTop) * Math.tan(tilt);
  const position = stand.getAttribute("position");
  let podTop = 0;

  for (let index = 0; index < position.count; index += 1) {
    // Ножки стоят по краям базы, поэтому в середине остаётся только стойка.
    if (Math.abs(position.getX(index)) < usb.rimRadius) {
      podTop = Math.max(podTop, position.getY(index));
    }
  }

  console.log(
    `  подставка ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ` +
      `${size.z.toFixed(2)} мм, канал Ø` +
      `${((channel?.x ?? Number.NaN) * 2).toFixed(2)} мм до ` +
      `${(channelFloor?.y ?? Number.NaN).toFixed(2)} мм`,
  );
  console.log(
    `  стойка Ø${((podEdge?.x ?? Number.NaN) * 2).toFixed(2)} мм до ` +
      `${podTop.toFixed(2)} мм, чаша ` +
      `${bowlProfile.map((value) => value.toFixed(2)).join(", ")}`,
  );

  check("usb: подставка замкнута", openEdges(stand), 0);
  check("usb: NaN 0", nanVertices(stand), 0);
  checkRange(
    "usb: канал под штекер Ø14.2 мм",
    [(channel?.x ?? Number.NaN) * 2],
    usb.channelRadius * 2 - TOLERANCE_MM,
    usb.channelRadius * 2 + TOLERANCE_MM,
  );
  checkRange(
    "usb: канал проходит сквозь чашу",
    [bowlProfile[0] - shape.baseTop],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );
  checkRange(
    "usb: штекер стоит на базе, а не на столе",
    [channelFloor?.y ?? Number.NaN],
    shape.baseTop - TOLERANCE_MM,
    shape.baseTop + TOLERANCE_MM,
  );
  checkRange(
    "usb: под каналом база замкнута",
    [underChannel?.y ?? Number.NaN],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );
  check(
    "usb: чаша поднимается от канала к кромке",
    bowlProfile[1] < bowlProfile[2] &&
      bowlProfile[2] < bowlProfile[3] &&
      bowlProfile[3] <= usb.rimY,
    true,
  );
  // Луч на 8 мм от оси попадает не в самую глубокую точку чаши, а на 0.6 мм
  // выше: глубина 6 мм — это дно у канала, поэтому допуск снизу свободный.
  checkRange(
    "usb: дно чаши ниже кромки на 6 мм",
    [usb.rimY - bowlProfile[1]],
    5,
    usb.bowlDepth + 0.1,
  );
  checkRange(
    "usb: наружная стенка стойки — конус от пояса к кромке",
    [(podEdge?.x ?? Number.NaN) - edgeHalf],
    -0.2,
    0.2,
  );
  checkRange(
    "usb: стойка не выше кромки",
    [podTop - usb.rimY],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );
  checkRange(
    "usb: канала под ленту в базе нет",
    [plainBase?.y ?? Number.NaN],
    shape.baseTop - TOLERANCE_MM,
    shape.baseTop + TOLERANCE_MM,
  );
  check(
    "usb: стойка стоит за панелью с зазором",
    centerZ + usb.rimRadius < panelAboveRim - 1,
    true,
  );
  check(
    "usb: стойка не выходит за базу",
    centerZ - usb.rimRadius > shape.back + 1,
    true,
  );
  check(
    "usb: печать без поддержек",
    downwardFaces(stand, shape.baseTop + 0.5),
    0,
  );

  stand.dispose();
}

console.log("\n15. Патрон E27: гнездо Ø40 × 15 мм, прорезь под провод и абажур");

{
  /*
    Патрон E27 — Ø40 мм: гнездо глубиной 15 мм прячет половину патрона, вторая
    половина остаётся над базой под лампу. Гнездо круглое, поэтому это тело
    вращения, а не призма: оболочка стакана собирается поворотом профиля, а
    прорезь под провод — просто пропущенный сектор. Абажур — второй сектор того
    же вращения: конус вокруг стакана с вырезом в сторону панели.
  */
  const params: Partial<LithophaneParams> = {
    lithophaneWidth: 120,
    lithophaneHeight: 80,
    lithoFrame: true,
    lithoMount: "arch",
    lithoLightSource: "socket",
  };
  const shape = LITHOPHANE_ARCH_STAND;
  const light = LITHOPHANE_SOCKET_LIGHT;
  const tilt = (LITHOPHANE_STAND_TILT_DEG * Math.PI) / 180;
  const stand = createLithophaneStandGeometry(params);
  const size = boxSize(stand);
  const floor = shape.baseTop + light.floorAboveBase;
  const rim = floor + light.cavityDepth;
  const probeY = floor + light.cavityDepth / 2;
  const left = firstHit(stand, [0, probeY, light.centerZ], [-1, 0, 0]);
  const right = firstHit(stand, [0, probeY, light.centerZ], [1, 0, 0]);
  const bottom = firstHit(stand, [0, 80, light.centerZ], [0, -1, 0]);
  // Луч из-за тыльной кромки: через прорезь он проходит в гнездо и останавливается
  // на передней стенке, а без прорези упёрся бы в наружную.
  const wireSlot = firstHit(stand, [0, probeY, -200], [0, 0, 1]);
  const panelAtRim = -(rim - shape.baseTop) * Math.tan(tilt);
  // Абажур: кромка Ø54 на 33 мм, вырез 120° в сторону панели.
  const shadeY = light.shadeRimY - 0.5;
  const shadeEdge = firstHit(stand, [-200, shadeY, light.centerZ], [1, 0, 0]);
  const shadeBack = firstHit(stand, [0, shadeY, light.centerZ], [0, 0, -1]);
  const shadeGap = firstHit(stand, [0, shadeY, 200], [0, 0, -1]);
  const panelAtShade = -(light.shadeRimY - shape.baseTop) * Math.tan(tilt);

  console.log(
    `  подставка ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ` +
      `${size.z.toFixed(2)} мм, гнездо ` +
      `${((right?.x ?? Number.NaN) - (left?.x ?? Number.NaN)).toFixed(2)} × ` +
      `${(rim - (bottom?.y ?? Number.NaN)).toFixed(2)} мм`,
  );
  console.log(
    `  дно гнезда на ${floor.toFixed(2)} мм, кромка на ${rim.toFixed(2)} мм, ` +
      `прорезь ${light.wireSlotDeg}°: провод проходит на ` +
      `${(wireSlot?.z ?? Number.NaN).toFixed(2)} мм`,
  );
  console.log(
    `  абажур Ø${(-(shadeEdge?.x ?? Number.NaN) * 2).toFixed(2)} мм на ` +
      `${light.shadeRimY} мм, сзади закрыт на ` +
      `${(light.centerZ - (shadeBack?.z ?? Number.NaN)).toFixed(2)} мм, ` +
      `из-за панели виден на ${(shadeGap?.z ?? Number.NaN).toFixed(2)} мм`,
  );

  check("патрон: подставка замкнута", openEdges(stand), 0);
  check("патрон: NaN 0", nanVertices(stand), 0);
  checkRange(
    "патрон: гнездо Ø40 мм",
    [(right?.x ?? Number.NaN) - (left?.x ?? Number.NaN)],
    light.cavityDiameter - 0.05,
    light.cavityDiameter + 0.05,
  );
  checkRange(
    "патрон: глубина гнезда 15 мм",
    [rim - (bottom?.y ?? Number.NaN)],
    light.cavityDepth - TOLERANCE_MM,
    light.cavityDepth + TOLERANCE_MM,
  );
  checkRange(
    "патрон: дно гнезда выше верха базы",
    [(bottom?.y ?? Number.NaN) - shape.baseTop],
    light.floorAboveBase - TOLERANCE_MM,
    light.floorAboveBase + TOLERANCE_MM,
  );
  check(
    "патрон: прорезь под провод проходит через стенку",
    (wireSlot?.z ?? Number.NaN) > light.centerZ,
    true,
  );
  check(
    "патрон: база глубже под гнездо",
    light.centerZ - light.outerDiameter / 2 >= shape.socketBack + 1,
    true,
  );
  check(
    "патрон: стакан не наезжает на панель",
    light.centerZ + light.outerDiameter / 2 < panelAtRim - 1,
    true,
  );
  checkRange(
    "патрон: абажур Ø54 по кромке",
    [-(shadeEdge?.x ?? Number.NaN) * 2],
    (light.shadeRimRadius - 0.5) * 2,
    light.shadeRimRadius * 2,
  );
  check(
    "патрон: абажур выше стакана",
    light.shadeRimY > rim,
    true,
  );
  checkRange(
    "патрон: абажур закрыт сзади на радиус кромки",
    [light.centerZ - (shadeBack?.z ?? Number.NaN)],
    light.shadeRimRadius - light.shadeWidth - 1,
    light.shadeRimRadius + 1,
  );
  // Луч из-за панели проходит вырез и останавливается только на тылу абажура.
  check(
    "патрон: абажур открыт в сторону панели",
    (shadeGap?.z ?? Number.NaN) < light.centerZ - 10,
    true,
  );
  check(
    "патрон: кромка абажура не наезжает на панель",
    light.centerZ + light.shadeRimRadius * Math.cos(Math.PI / 3) <
      panelAtShade - 1,
    true,
  );
  check(
    "патрон: абажур в габарите базы",
    light.centerZ - light.shadeRimRadius >= shape.socketBack + 1,
    true,
  );
  check(
    "патрон: печать без поддержек",
    downwardFaces(stand, shape.baseTop + 0.5),
    0,
  );

  stand.dispose();
}

console.log("\n16. Подвес: световой короб, окно под провод и петли");

{
  /*
    Крепление `hook` — не две бобышки на полке рамки, а закрытый световой короб за
    ней: канал под ленту на уровне нижней кромки кадра, окно под провод в тыльной
    стенке и две петли на ней же. Раздел проверяет, что короб открыт только в окно
    рамки, лента ложится в канал, провод проходит окно, а петли стоят парой с
    карманом под шляпку шурупа. Стенки короба стоят на тыльной полке рамки, поэтому
    ни одна его часть не выходит за контур рамки.
  */
  const width = 120;
  const height = 80;
  const params: Partial<LithophaneParams> = {
    lithophaneWidth: width,
    lithophaneHeight: height,
    lithoFrame: true,
    lithoMount: "hook",
  };
  const box = LITHOPHANE_WALL_BOX;
  const frame = createLithophaneFrameGeometry(params);
  const size = boxSize(frame);
  const halfWidth = width / 2 - box.inset;
  const innerHalf = halfWidth - box.wall;
  const backZ = -box.depth;
  const railBack = backZ + box.wall + box.channelWidth;
  const sillTop = box.channelFloor;
  const top = height - box.inset;
  const hookHalf = Math.min(box.hookWidth / 2, innerHalf / 2);
  const hookCenter = halfWidth - box.wall - box.hookInset - hookHalf;
  // Тыл короба и окно рамки: снаружи луч упирается в тыльную стенку, а изнутри
  // короба на его пути нет ничего — свет уходит в кадр.
  const backWall = firstHit(frame, [0, top / 2, -300], [0, 0, 1]);
  const windowFront = firstHit(
    frame,
    [0, top / 2, backZ + box.wall + 1],
    [0, 0, 1],
  );
  // Окно под провод: сканирование тыльной стенки построчно и по столбцам. За
  // стенкой луча быть не должно: он либо прошёл в короб и остановился на бортике
  // канала, либо ушёл в окно рамки насквозь.
  const wireRows: number[] = [];

  for (let y = box.inset; y <= top; y += 0.05) {
    const hit = firstHit(frame, [0, y, -300], [0, 0, 1]);

    if (!hit || hit.z > backZ + 0.5) {
      wireRows.push(y);
    }
  }

  const wireColumns: number[] = [];
  const wireProbeY = sillTop + box.wireHeight - 0.5;

  for (let x = -2 * box.wireWidth; x <= 2 * box.wireWidth; x += 0.05) {
    const hit = firstHit(frame, [x, wireProbeY, -300], [0, 0, 1]);

    if (!hit || hit.z > backZ + 0.5) {
      wireColumns.push(x);
    }
  }

  // Канал под ленту: пол на подоконнике, спереди бортик. Луч сверху попадает то
  // на пол канала, то на бортик — по этим двум высотам видно и ширину, и глубину.
  const floorZ: number[] = [];
  const railZ: number[] = [];

  for (let z = -box.depth - 6; z <= 2; z += 0.05) {
    const hit = firstHit(frame, [0, top - 4, z], [0, -1, 0]);

    if (!hit) {
      continue;
    }

    if (Math.abs(hit.y - sillTop) < 0.05) {
      floorZ.push(z);
    } else if (Math.abs(hit.y - (sillTop + box.channelDepth)) < 0.05) {
      railZ.push(z);
    }
  }

  // Петли: полка с бортиком на тыльной стенке. Скан поперёк короба даёт пару
  // выступов, скан по высоте — низ полки, а карман меряется от тыльной стенки.
  const hookXs: number[] = [];

  for (let x = -halfWidth; x <= halfWidth; x += 0.05) {
    const hit = firstHit(frame, [x, top - 1, -300], [0, 0, 1]);

    if (hit && hit.z < backZ - 1) {
      hookXs.push(x);
    }
  }

  const shelfYs: number[] = [];

  for (let y = top - 20; y <= top; y += 0.05) {
    const hit = firstHit(frame, [hookCenter, y, -300], [0, 0, 1]);

    if (hit && hit.z < backZ - 1) {
      shelfYs.push(y);
    }
  }

  const hooks = contiguousRuns(hookXs, 0.05);
  const [shelf] = contiguousRuns(shelfYs, 0.05);
  const lip = firstHit(frame, [hookCenter, top - 1, -300], [0, 0, 1]);
  const pocket = firstHit(frame, [hookCenter, top - 1, backZ - 1], [0, 0, -1]);
  const outline = firstHit(frame, [halfWidth + 1, top / 2, -300], [0, 0, 1]);
  const [wire] = contiguousRuns(wireRows, 0.05);
  const [wireSpan] = contiguousRuns(wireColumns, 0.05);
  const [channel] = contiguousRuns(floorZ, 0.05);
  const [rail] = contiguousRuns(railZ, 0.05);
  const channelFloorY = firstHit(
    frame,
    [0, top - 4, (railBack + backZ + box.wall) / 2],
    [0, -1, 0],
  );
  const railTopY = firstHit(frame, [0, top - 4, (railBack + 1) / 2], [0, -1, 0]);
  // Ширина канала: от тыльной стенки до бортика. Луч идёт по каналу назад мимо
  // окна под провод и упирается во внутреннюю плоскость стенки.
  const channelBack = firstHit(frame, [20, sillTop + 1, railBack - 1], [0, 0, -1]);
  const channelSpan = (rail?.from ?? Number.NaN) - (channelBack?.z ?? Number.NaN);

  console.log(
    `  рамка ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ` +
      `${size.z.toFixed(2)} мм: короб ${box.depth} мм, петли ` +
      `${box.hookReach} мм`,
  );
  console.log(
    `  окно провода ${(wireSpan?.width ?? Number.NaN).toFixed(2)} × ` +
      `${(wire?.width ?? Number.NaN).toFixed(2)} мм от ` +
      `${(wire?.from ?? Number.NaN).toFixed(2)} мм, канал ` +
      `${channelSpan.toFixed(2)} мм, пол от ` +
      `${(channel?.from ?? Number.NaN).toFixed(2)} мм`,
  );
  console.log(
    `  петли ${hooks.map((run) => run.width.toFixed(2)).join(" + ")} мм с ` +
      `центрами ${hooks.map((run) => run.center.toFixed(2)).join(", ")}, ` +
      `полка от ${(shelf?.from ?? Number.NaN).toFixed(2)} мм`,
  );

  check("подвес: рамка с коробом замкнута", openEdges(frame), 0);
  check("подвес: NaN 0", nanVertices(frame), 0);
  checkRange(
    "подвес: тыл короба в 15 мм от рамки",
    [-(backWall?.z ?? Number.NaN)],
    box.depth - TOLERANCE_MM,
    box.depth + TOLERANCE_MM,
  );
  check("подвес: короб открыт в окно рамки", windowFront, null);
  checkRange(
    "подвес: окно под провод 6 мм по ширине",
    [wireSpan?.width ?? Number.NaN],
    box.wireWidth - 0.15,
    box.wireWidth + 0.15,
  );
  // Высота окна считается по строкам до самого верха короба: лишний шаг
  // сканирования добавляет к ней 0.05 мм.
  checkRange(
    "подвес: окно под провод 5 мм по высоте",
    [wire?.width ?? Number.NaN],
    box.wireHeight - 0.15,
    box.wireHeight + 0.15,
  );
  checkRange(
    "подвес: окно под провод на уровне пола канала",
    [(wire?.from ?? Number.NaN) - box.channelFloor],
    -0.1,
    0.1,
  );
  // Внутренняя плоскость тыльной стенки заходит на нахлёст 0.2 мм: канал, в
  // который ложится лента, получается на этот нахлёст уже проектных 10 мм.
  checkRange(
    "подвес: канал под ленту 10 мм",
    [channelSpan],
    box.channelWidth - 0.25,
    box.channelWidth + 0.05,
  );
  checkRange(
    "подвес: пол канала на 8.5 мм над столом",
    [channelFloorY?.y ?? Number.NaN],
    box.channelFloor - TOLERANCE_MM,
    box.channelFloor + TOLERANCE_MM,
  );
  checkRange(
    "подвес: бортик канала выше пола на 2 мм",
    [(railTopY?.y ?? Number.NaN) - (channelFloorY?.y ?? Number.NaN)],
    box.channelDepth - TOLERANCE_MM,
    box.channelDepth + TOLERANCE_MM,
  );
  check(
    "подвес: бортик стоит перед лентой",
    (rail?.from ?? Number.NaN) > (channel?.to ?? Number.NaN),
    true,
  );
  check("подвес: петли стоят парой", hooks.length, 2);
  checkRange(
    "подвес: петля 10 мм",
    hooks.map((run) => run.width),
    box.hookWidth - 0.15,
    box.hookWidth + 0.15,
  );
  checkRange(
    "подвес: петли по краям короба",
    hooks.map((run) => Math.abs(run.center)),
    hookCenter - 0.15,
    hookCenter + 0.15,
  );
  checkRange(
    "подвес: петля выступает на 12 мм",
    [backZ - (lip?.z ?? Number.NaN)],
    box.hookReach - 0.1,
    box.hookReach + 0.1,
  );
  check(
    "подвес: карман под шляпку шурупа не уже 8 мм",
    backZ - (pocket?.z ?? Number.NaN) >= 8,
    true,
  );
  checkRange(
    "подвес: полка петли на 3 мм ниже верха короба",
    [top - ((shelf?.from ?? Number.NaN) + box.hookShelf)],
    2.9,
    3.1,
  );
  checkRange(
    "подвес: короб вписан в контур рамки",
    [size.x - width, size.y - height],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );
  checkRange(
    "подвес: стенки короба не выходят за рамку",
    [outline?.z ?? Number.NaN],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );

  frame.dispose();
}

console.log("\n17. Форма панели: дуга по радиусу и полуцилиндр 180°");

{
  /*
    Третья форма литофана — изогнутая панель. Плоская плита гнётся по дуге
    вокруг вертикальной оси: сечение поворачивается на угол x / R, поэтому
    ширина панели на поверхности не меняется, а прогиб повторяет зависимость
    z = R − √(R² − x²) с точностью до второго порядка.
    Раздел проверяет то, чего не видно на глаз: все вершины лежат на цилиндре
    радиуса R (иначе «дуга» — это наклонная плоскость), угол заворота совпадает
    с длиной дуги, оболочки остаются замкнутыми, сборка не тянет за собой
    подставку, а полуцилиндр заворачивается ровно на 180°: его радиус —
    ширина панели, делённая на π.
  */
  const width = 120;
  const height = 80;
  const radius = CONSTRUCTOR_LIMITS.lithoCurveRadius.defaultValue;
  const maxThickness =
    CONSTRUCTOR_LIMITS.lithophaneMaxThickness.defaultValue;
  const curved: Partial<LithophaneParams> = {
    lithophaneWidth: width,
    lithophaneHeight: height,
    lithoShape: "curved",
  };
  const plate = lithophanePlateSize(curved);
  const halfPlate = plate.width / 2;
  const halfWidth = width / 2;
  // Передняя плоскость рамки: у плоской рамки это её габарит по Z. У изогнутой
  // габарит по Z — это ещё и прогиб, поэтому толщину берём у плоской.
  const frontZ = boxSize(
    createLithophaneFrameGeometry({
      lithophaneWidth: width,
      lithophaneHeight: height,
    }),
  ).z;
  const sagArc = radius * (1 - Math.cos(halfPlate / radius));
  const sagProjection =
    radius - Math.sqrt(radius * radius - halfPlate * halfPlate);
  // Прогиб кромки рамки: её контур шире окна, поэтому дуга глубже плиточной.
  const sagFrameArc = radius * (1 - Math.cos(halfWidth / radius));
  const sagFrameProjection =
    radius - Math.sqrt(radius * radius - halfWidth * halfWidth);
  const relief = createLithophaneReliefGeometry(curved);
  const frame = createLithophaneFrameGeometry(curved);
  const reliefBend = bendProfile(relief, radius);
  const frameBend = bendProfile(frame, radius);
  const assembly = createLithophaneGeometry({ ...curved, lithoMount: "arch" });

  relief.computeBoundingBox();
  const reliefBack = -(relief.boundingBox?.min.z ?? Number.NaN);

  console.log(
    `  дуга R${radius}: плита уходит назад на ${reliefBack.toFixed(3)} мм ` +
      `(по дуге ${sagArc.toFixed(3)}, по проекции ${sagProjection.toFixed(3)}), ` +
      `заворот ${frameBend.minAngle.toFixed(2)}…${frameBend.maxAngle.toFixed(2)}°`,
  );

  check(
    "дуга: по умолчанию радиус 250 мм",
    normalizeLithophaneParams({ lithoShape: "curved" }).lithoCurveRadius,
    radius,
  );
  check(
    "дуга: радиус встаёт на шаг слайдера",
    normalizeLithophaneParams({ lithoCurveRadius: 137 }).lithoCurveRadius,
    140,
  );
  check(
    "дуга: незнакомая форма превращается в плоскую",
    normalizeLithophaneParams({
      lithoShape: "spiral" as unknown as LithophaneShape,
    }).lithoShape,
    "flat",
  );
  // Вершины плиты лежат на цилиндре: от оси Z = −R расстояние равно R, а лицо
  // рельефа отстоит от тыла не дальше максимальной толщины.
  checkRange(
    "дуга: плита лежит на цилиндре радиуса R",
    [reliefBend.minRadius - radius, reliefBend.maxRadius - radius - maxThickness],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );
  checkRange(
    "дуга: прогиб по z = R − √(R² − x²)",
    [reliefBack],
    sagArc - TOLERANCE_MM,
    sagProjection + TOLERANCE_MM,
  );
  checkRange(
    "дуга: угол заворота равен длине дуги",
    [
      reliefBend.maxAngle - (halfPlate / radius) * (180 / Math.PI),
      reliefBend.minAngle + (halfPlate / radius) * (180 / Math.PI),
    ],
    -0.05,
    0.05,
  );
  // Рамка гнётся тем же радиусом, но её контур шире окна: угол считается по
  // половине габарита панели, а передняя плоскость отстоит на frontZ.
  checkRange(
    "дуга: рамка гнётся вместе с плитой",
    [
      frameBend.minRadius - radius,
      frameBend.maxRadius - radius - frontZ,
      frameBend.maxAngle - (halfWidth / radius) * (180 / Math.PI),
    ],
    -0.05,
    0.05,
  );
  check("дуга: оболочки замкнуты", openEdges(relief) + openEdges(frame), 0);
  check("дуга: NaN 0", nanVertices(relief) + nanVertices(frame), 0);

  const assemblySize = boxSize(assembly);
  const expectedWidth = 2 * (radius + frontZ) * Math.sin(halfWidth / radius);

  checkRange(
    "дуга: габарит сборки по X и высота панели",
    [assemblySize.x - expectedWidth, assemblySize.y - height],
    -0.02,
    0.02,
  );
  checkRange(
    "дуга: глубина сборки — дуга плюс передняя плоскость",
    [assemblySize.z],
    frontZ + sagFrameArc - TOLERANCE_MM,
    frontZ + sagFrameProjection + TOLERANCE_MM,
  );
  check("дуга: сборка замкнута", openEdges(assembly), 0);

  relief.dispose();
  frame.dispose();
  assembly.dispose();
}

console.log("\n18. Крепления и бюджет изогнутых форм");

{
  /*
    У изогнутой панели и полуцилиндра креплений нет: паз подставки, задняя
    стойка и световой короб вырезаны в плоской рамке, а гнуть их вместе с плитой
    нельзя — база встала бы на стол дугой. Выбор человека при этом не
    сбрасывается: вернувшись к плоской форме, он получает то же крепление.
    Проверяется, что сборка с креплением совпадает со сборкой без него, что
    световой короб не появляется на изогнутой рамке и что полосы нарезки не
    выбивают плиту из бюджета треугольников.
  */
  const width = 120;
  const height = 80;
  const radius = CONSTRUCTOR_LIMITS.lithoCurveRadius.defaultValue;
  const cylinderRadius = width / Math.PI;
  const curved: Partial<LithophaneParams> = {
    lithophaneWidth: width,
    lithophaneHeight: height,
    lithoShape: "curved",
  };
  const cylinder: Partial<LithophaneParams> = {
    lithophaneWidth: width,
    lithophaneHeight: height,
    lithoShape: "cylinder",
  };
  const frontZ = boxSize(
    createLithophaneFrameGeometry({
      lithophaneWidth: width,
      lithophaneHeight: height,
    }),
  ).z;
  const flatPlate = createLithophaneReliefGeometry({
    lithophaneWidth: width,
    lithophaneHeight: height,
  });
  const curvedPlate = createLithophaneReliefGeometry(curved);
  const curvedStand = createLithophaneGeometry({ ...curved, lithoMount: "arch" });
  const curvedBare = createLithophaneGeometry({ ...curved, lithoMount: "none" });
  const flatStand = createLithophaneGeometry({
    lithophaneWidth: width,
    lithophaneHeight: height,
    lithoMount: "arch",
  });
  const hookFrame = createLithophaneFrameGeometry({
    ...curved,
    lithoMount: "hook",
  });
  const plainFrame = createLithophaneFrameGeometry({
    ...curved,
    lithoMount: "none",
  });
  const hookSize = boxSize(hookFrame);
  const plainSize = boxSize(plainFrame);

  curvedStand.computeBoundingBox();
  flatStand.computeBoundingBox();

  console.log(
    `  изогнутая плита: ${triangleCount(curvedPlate)} треугольников против ` +
      `${triangleCount(flatPlate)} у плоской, сборка уходит назад на ` +
      `${(curvedStand.boundingBox?.min.z ?? Number.NaN).toFixed(2)} мм`,
  );

  check(
    "крепления: есть только у плоской формы",
    [
      lithophaneShapeHasMounts("flat"),
      lithophaneShapeHasMounts("curved"),
      lithophaneShapeHasMounts("cylinder"),
    ],
    [true, false, false],
  );
  // Нормализация сохраняет выбор: иначе переключение формы туда и обратно
  // стирало бы крепление, которое человек уже настроил.
  check(
    "крепления: выбор переживает смену формы",
    normalizeLithophaneParams({ lithoShape: "curved", lithoMount: "hook" })
      .lithoMount,
    "hook",
  );
  check(
    "крепления: изогнутая сборка не тянет подставку",
    [triangleCount(curvedStand), triangleCount(curvedBare)],
    [triangleCount(curvedBare), triangleCount(curvedBare)],
  );
  checkRange(
    "крепления: у изогнутой сборки нет базы под столом",
    [curvedStand.boundingBox?.min.z ?? Number.NaN],
    -(radius * (1 - Math.cos(width / 2 / radius))) - 0.5,
    0,
  );
  check(
    "крепления: плоская сборка с аркой по-прежнему глубже",
    (flatStand.boundingBox?.min.z ?? 0) < -20,
    true,
  );
  // Короб подвеса гнётся вместе с рамкой, поэтому у изогнутой формы его просто
  // нет: число треугольников и габарит совпадают с рамкой без крепления.
  check(
    "крепления: у изогнутой рамки нет светового короба",
    [triangleCount(hookFrame), openEdges(hookFrame)],
    [triangleCount(plainFrame), 0],
  );
  checkRange(
    "крепления: изогнутая рамка не глубже своей дуги",
    [hookSize.z - plainSize.z],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );

  const cylinderFrame = createLithophaneFrameGeometry(cylinder);
  const cylinderBend = bendProfile(cylinderFrame, cylinderRadius);
  const cylinderAssembly = createLithophaneGeometry({
    ...cylinder,
    lithoMount: "base",
  });
  const cylinderSize = boxSize(cylinderAssembly);
  const cylinderFrameSize = boxSize(cylinderFrame);

  console.log(
    `  полуцилиндр: R = ${cylinderRadius.toFixed(3)} мм, заворот ` +
      `${cylinderBend.minAngle.toFixed(2)}…${cylinderBend.maxAngle.toFixed(2)}°, ` +
      `силуэт ${cylinderSize.x.toFixed(2)} × ${cylinderSize.z.toFixed(2)} мм`,
  );

  // Полуцилиндр: угол ровно 180°, радиус выведен из ширины, тыл на R, лицо на
  // R + frontZ. Силуэт вдвое уже развёртки — это и есть половина окружности.
  checkRange(
    "полуцилиндр: ровно 180° заворота",
    [cylinderBend.minAngle, cylinderBend.maxAngle],
    -90.01,
    90.01,
  );
  checkRange(
    "полуцилиндр: радиус равен ширине панели, делённой на π",
    [cylinderBend.minRadius - cylinderRadius],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );
  checkRange(
    "полуцилиндр: силуэт равен двум радиусам с толщиной",
    [
      cylinderFrameSize.x - 2 * (cylinderRadius + frontZ),
      cylinderFrameSize.z - (cylinderRadius + frontZ),
    ],
    -0.02,
    0.02,
  );
  checkRange(
    "полуцилиндр: сборка стоит на дуге нижней кромки",
    [cylinderSize.y - height, cylinderSize.x - 2 * (cylinderRadius + frontZ)],
    -0.02,
    0.02,
  );
  check(
    "полуцилиндр: сборка замкнута",
    openEdges(cylinderAssembly) + nanVertices(cylinderAssembly),
    0,
  );
  // Нарезка полосами добавляет треугольники: их число задаёт точность дуги, а
  // не бюджет. Предел — полтора лица, иначе изогнутая панель упиралась бы в
  // миллион раньше плоской.
  check(
    "бюджет: полосы не больше половины лица",
    triangleCount(curvedPlate) <= triangleCount(flatPlate) * 1.5,
    true,
  );

  flatPlate.dispose();
  curvedPlate.dispose();
  curvedStand.dispose();
  curvedBare.dispose();
  flatStand.dispose();
  hookFrame.dispose();
  plainFrame.dispose();
  cylinderFrame.dispose();
  cylinderAssembly.dispose();
}

console.log("");

if (failures > 0) {
  console.log(`Провалено проверок: ${failures}`);
  process.exitCode = 1;
} else {
  console.log("Все проверки прошли.");
}
