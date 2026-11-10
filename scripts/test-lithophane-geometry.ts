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
 *      12 мм и карманом под шляпку шурупа, короб вписан в контур рамки;
 *  17. форма панели: вершины изогнутой панели и полуцилиндра рождаются сразу в
 *      цилиндрических координатах (готовую сетку никто не гнёт), поэтому вершины
 *      лица общие, нормали гладкие и муара от фасеток нет; заворот равен длине
 *      дуги, объём совпадает с плоской плитой (раньше веер тыла уходил внутрь
 *      цилиндра и «толстил» панель — на дуге на 40 %, на полуцилиндре втрое), а
 *      бюджет сетки считает нарезку тыла отдельным слагаемым;
 *  18. базы изогнутых форм: у дуги — брусок с пазом, каналом под ленту и щелью
 *      под рассеиватель 2.4 × 6 мм (канал открыт вверх, за каналом и перед
 *      панелью пластик), у полуцилиндра — плоский диск с круговым пазом,
 *      выборкой снизу и сквозным отверстием Ø40 по оси: лампа светит прямо внутрь
 *      панели, а не в её торец;
 *  19. калейдоскоп: четыре панели без рамок на полом цоколе под тонкой крышкой с
 *      окнами — призма 123.6 мм, вся деталь весит около 110 г вместо 381 г,
 *      отверстие Ø40 держит кольцо в центре дна, окна в крышке дают тягу, а на
 *      каждой грани может быть свой кадр (пустой слот повторяет предыдущий).
 *
 * Запуск: `npm run check:lithophane`.
 *
 * Выход: 0 — все проверки прошли, 1 — есть расхождения.
 */
import type { BufferGeometry } from "three";

import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";

import {
  LITHOPHANE_ARCH_STAND,
  LITHOPHANE_ARCH_STRIP,
  LITHOPHANE_BENT_BASE,
  LITHOPHANE_BENT_BASE_FLOOR_MM,
  LITHOPHANE_BORDER_CHAMFER_MM,
  LITHOPHANE_BORDER_MM,
  LITHOPHANE_CYLINDER_FLOOR_MM,
  LITHOPHANE_DETAIL_GROUP,
  LITHOPHANE_FIT_GAP_MM,
  LITHOPHANE_FRAME_CORNER_RADIUS_MM,
  LITHOPHANE_FRAME_OPENING_RADIUS_MM,
  LITHOPHANE_FRAME_WIDTH_MM,
  LITHOPHANE_KALEIDOSCOPE,
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
  LITHOPHANE_KALEIDOSCOPE_PANEL_STEP_MM,
  LITHOPHANE_VERTEX_STEP_MM,
  lithophaneFaceBrightness,
  lithophaneMeshOptions,
  lithophaneMeshSize,
  lithophaneShapeHasBase,
  lithophaneShapeHasMounts,
  normalizeLithophaneParams,
  type LithophaneBrightnessGrid,
  type LithophaneParams,
  type LithophaneShape,
} from "../lib/constructor/params";
import {
  calculateGeometryVolumeMm3,
  calculateGeometryWeightGrams,
} from "../lib/constructor/geometry-volume";
import {
  LITHO_LIGHT_MODEL,
  LITHO_LIGHT_SEATS,
  lithophaneHeatColor,
  lithophaneHeatMesh,
  lithophaneLightMetrics,
  lithophaneLightPlan,
  type LithoLightEmitter,
  type LithoLightFace,
  type LithoLightPlan,
} from "../lib/constructor/litho-light-calc";

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
 * Луч идёт вдоль Z: у открытой арки он проходит между ножками, у сплошной стойки
 * упирается в пластик. Так проверяется то, ради чего арку и сделали, — свет от
 * лампы за литофаном доходит до низа кадра. `startZ` сдвигает начало луча: у базы
 * с клином сзади луч приходится пускать уже перед клином.
 */
function blockedAt(
  geometry: BufferGeometry,
  x: number,
  y: number,
  startZ = -200,
): boolean {
  const mesh = new Mesh(geometry);
  const ray = new Raycaster(
    new Vector3(x, y, startZ),
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

console.log("\n13. Открытая арка: проём под свет, канал в скате и паз под акрил");

{
  /*
    Владелец заметил тёмное пятно на просвет: сплошная стойка во всю ширину
    закрывала нижние 30 мм панели. Открытая арка держит панель двумя ножками по
    краям базы, а рамка опускается в паз 3.5 мм. Потом светотехнический расчёт
    показал вторую беду: канал ленты стоял в 8 мм от панели, и центр кадра
    пересвечивался. Канал переехал в скат задней стенки-клина, база стала глубже, а
    в верхней плоскости появился паз под лист матового акрила.

    Раздел проверяет то, что видно только на числах: середина проёма свободна для
    света, канал 10 × 3 мм вырезан в скате (дно на 3 мм ниже поверхности), паз под
    рассеиватель — щель глубиной 6 мм, а лента уходит за панель на 59 мм.
  */
  const params: Partial<LithophaneParams> = {
    lithophaneWidth: 120,
    lithophaneHeight: 80,
    lithoFrame: true,
    lithoMount: "arch",
  };
  const shape = LITHOPHANE_ARCH_STAND;
  const tilt = (LITHOPHANE_STAND_TILT_DEG * Math.PI) / 180;
  const ledge = (shape.ledgeDeg * Math.PI) / 180;
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
  // Нормаль ската и направление вдоль него в плоскости ZY.
  const axis = { y: Math.cos(ledge), z: Math.sin(ledge) };
  const along = { y: -Math.sin(ledge), z: Math.cos(ledge) };
  const strip = LITHOPHANE_ARCH_STRIP;
  // Луч идёт по нормали ската: в канале он упирается в дно, рядом — в поверхность.
  const probe = (offset: number) =>
    firstHit(
      stand,
      [
        0,
        strip.y + along.y * offset + axis.y * 12,
        strip.z + along.z * offset + axis.z * 12,
      ],
      [0, -axis.y, -axis.z],
    );
  const channelHit = probe(0);
  const ledgeHit = probe(15);
  const diffuserHit = firstHit(stand, [0, 40, shape.diffuserZ], [0, -1, 0]);
  const beforeSlot = firstHit(stand, [0, 40, shape.diffuserZ - 4], [0, -1, 0]);
  const position = stand.getAttribute("position");
  let seatMin = Number.POSITIVE_INFINITY;
  let seatMax = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < position.count; index += 1) {
    const y = position.getY(index);
    const z = position.getZ(index);

    if (Math.abs(y - seatFloor) < TOLERANCE_MM) {
      seatMin = Math.min(seatMin, z);
      seatMax = Math.max(seatMax, z);
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
  /*
    Низ ската: от верхней кромки клина вниз-вперёд до плоскости базы. Луч проверки
    проёма начинается сразу за этой точкой — иначе он упёрся бы в клин.
  */
  const ledgeFootZ =
    shape.back + ((shape.leanTop - shape.baseTop) / Math.sin(ledge)) * along.z;

  console.log(
    `  подставка ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ` +
      `${size.z.toFixed(2)} мм, лента на ${strip.y.toFixed(2)} / ` +
      `${strip.z.toFixed(2)} мм, дно канала ` +
      `${(channelHit?.y ?? Number.NaN).toFixed(2)} мм`,
  );
  console.log(
    `  паз: дно на ${seatFloor.toFixed(2)} мм, ширина ` +
      `${(seatMax - seatMin).toFixed(2)} мм; паз рассеивателя до ` +
      `${(diffuserHit?.y ?? Number.NaN).toFixed(2)} мм`,
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
    "арка: глубина базы 74 мм",
    [size.z - (shape.front - shape.back)],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );
  checkRange(
    "арка: дно канала лежит на месте ленты",
    [
      (channelHit
        ? channelHit.y * axis.y + channelHit.z * axis.z
        : Number.NaN) -
        (strip.y * axis.y + strip.z * axis.z),
    ],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );
  checkRange(
    "арка: вне канала поверхность выше дна на глубину канала",
    [
      (ledgeHit ? ledgeHit.y * axis.y + ledgeHit.z * axis.z : Number.NaN) -
        (channelHit
          ? channelHit.y * axis.y + channelHit.z * axis.z
          : Number.NaN),
    ],
    shape.channelDepth - TOLERANCE_MM,
    shape.channelDepth + TOLERANCE_MM,
  );
  check(
    "арка: канал вмещает ленту 8–10 мм",
    shape.channelWidth >= 8 && shape.channelWidth <= 10,
    true,
  );
  checkRange(
    "арка: паз рассеивателя глубиной 6 мм",
    [(beforeSlot?.y ?? Number.NaN) - (diffuserHit?.y ?? Number.NaN)],
    shape.diffuserDepth - TOLERANCE_MM,
    shape.diffuserDepth + TOLERANCE_MM,
  );
  check(
    "арка: паз рассеивателя вмещает лист 2 мм",
    shape.diffuserWidth >= 2 && shape.diffuserWidth <= 3,
    true,
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
    "арка: панель поднята на разницу высот баз минус посадка в паз",
    [
      solidHeight -
        archHeight +
        (shape.baseTop - LITHOPHANE_STAND_SHAPES.leg.baseTop) -
        shape.seatDepth * Math.cos(tilt),
    ],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );

  for (const y of [shape.baseTop + 1, 12, 20, 28, shape.legTop - 1]) {
    check(
      `арка: свет проходит в середине на ${y} мм`,
      blockedAt(stand, 0, y, ledgeFootZ + 2),
      false,
    );
  }

  check(
    "арка: ножка по краю базы перекрывает",
    blockedAt(stand, legX, 20, ledgeFootZ + 2),
    true,
  );
  for (const y of [shape.baseTop + 1, 20]) {
    check(
      `сплошная ножка: середина перекрыта на ${y} мм`,
      blockedAt(solidStand, 0, y, ledgeFootZ + 2),
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
  // Луч изнутри гнезда назад: через прорезь он проходит стенку стакана и
  // останавливается уже на тыльной стенке базы, а без прорези упёрся бы в неё же —
  // на наружном радиусе.
  const wireSlot = firstHit(stand, [0, probeY, light.centerZ], [0, 0, -1]);
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
    (wireSlot?.z ?? Number.NaN) < light.centerZ - light.outerDiameter / 2,
    true,
  );
  check(
    "патрон: база глубже под гнездо",
    light.centerZ - light.outerDiameter / 2 >= shape.back + 1,
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
    light.centerZ - light.shadeRimRadius >= shape.back + 1,
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

/**
 * Сколько треугольников приходится в среднем на вершину лица, штук.
 *
 * Гладкие нормали возможны только тогда, когда вершины лица общие: у регулярной
 * сетки каждая внутренняя вершина принадлежит шести треугольникам. Если грани
 * разложены на собственные вершины (плоское затенение), среднее падает до двух —
 * именно так лицо и превращалось в муар на цилиндре.
 *
 * Считаются вершины на радиусе не меньше `fromRadius`: у изогнутой плиты это
 * лицо, у плоской — его аналог по толщине.
 */
function faceVertexReuse(
  geometry: BufferGeometry,
  radius: number | null,
  fromRadius: number,
): number {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const triangles = (index?.count ?? position.count) / 3;
  const used = new Map<number, number>();

  for (let triangle = 0; triangle < triangles; triangle += 1) {
    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = index
        ? index.getX(triangle * 3 + corner)
        : triangle * 3 + corner;
      const radial =
        radius === null
          ? position.getZ(vertex)
          : Math.hypot(
              position.getX(vertex),
              position.getZ(vertex) + radius,
            );

      if (radial >= fromRadius) {
        used.set(vertex, (used.get(vertex) ?? 0) + 1);
      }
    }
  }

  let total = 0;

  for (const count of used.values()) {
    total += count;
  }

  return used.size > 0 ? total / used.size : 0;
}

/**
 * Толщина панели вдоль нормали грани призмы.
 *
 * Луч идёт снаружи к оси через середину грани: первые два попадания — лицо и тыл
 * плиты, поэтому расстояние между ними и есть толщина рельефа в этой точке.
 * `side` — номер грани: 0 смотрит в +Z, остальные повёрнуты на 90° вокруг Y.
 */
function prismFaceThickness(
  geometry: BufferGeometry,
  side: number,
  y: number,
): number {
  const angle = (side * Math.PI) / 2;
  const outX = Math.sin(angle);
  const outZ = Math.cos(angle);
  // Луч сдвинут от осей симметрии грани: ровно по середине он шёл бы по линии
  // сетки рельефа и попадал в одну и ту же грань несколько раз.
  const shift = 0.13;
  // Материал двусторонний: тыл плиты смотрит внутрь камеры, и с односторонним
  // материалом луч его не увидел бы.
  const mesh = new Mesh(
    geometry,
    new MeshBasicMaterial({ side: DoubleSide }),
  );
  const ray = new Raycaster(
    new Vector3(
      outX * 200 + outZ * shift,
      y,
      outZ * 200 - outX * shift,
    ),
    new Vector3(-outX, 0, -outZ),
    0,
    400,
  );
  const hits = ray.intersectObject(mesh, false);

  return hits.length >= 2 ? hits[1].distance - hits[0].distance : Number.NaN;
}


console.log("\n17. Форма панели: вершины рождаются сразу на цилиндре");

{
  /*
    Изогнутая панель и полуцилиндр считаются в цилиндрических координатах:
    развёртка (x, y, z) отображается в x' = (R + z)·sin(x / R) и
    z' = (R + z)·cos(x / R) − R. Готовую сетку больше никто не гнёт, поэтому
    фасетки лица не деформируются, а нормали по общим вершинам остаются гладкими.

    Раздел проверяет то, что видно только на числах:
      — плита лежит на цилиндре нужного радиуса, заворот равен длине дуги;
      — лицо гладкое: у ровного кадра нормали смотрят по радиусу, а не по
        фасеткам 0.3 мм (именно это давало муар на предпросмотре);
      — объём совпадает с плоской плитой. Раньше тыл собирался веером от центра,
        и на полуцилиндре его лучи уходили внутрь на 12 мм: панель «толстела»
        втрое, а на дуге — на 40 %;
      — число треугольников укладывается в бюджет сетки, который теперь считает
        нарезку тыла отдельным слагаемым.
  */
  const width = 120;
  const height = 80;
  const radius = CONSTRUCTOR_LIMITS.lithoCurveRadius.defaultValue;
  const maxThickness = CONSTRUCTOR_LIMITS.lithophaneMaxThickness.defaultValue;
  const minThickness = CONSTRUCTOR_LIMITS.lithophaneMinThickness.defaultValue;
  const even = flatFrame(255);
  const curved: Partial<LithophaneParams> = {
    lithophaneWidth: width,
    lithophaneHeight: height,
    lithoShape: "curved",
    lithophaneBrightness: even.brightness,
    lithophaneBrightnessWidth: even.width,
    lithophaneBrightnessHeight: even.height,
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
  const relief = createLithophaneReliefGeometry(curved);
  const frame = createLithophaneFrameGeometry(curved);
  const reliefBend = bendProfile(relief, radius);
  const frameBend = bendProfile(frame, radius);
  const flatRelief = createLithophaneReliefGeometry({
    ...curved,
    lithoShape: "flat",
  });
  const flatVolume = calculateGeometryVolumeMm3(flatRelief);
  const curvedVolume = calculateGeometryVolumeMm3(relief);
  const cylinderRelief = createLithophaneReliefGeometry({
    ...curved,
    lithoShape: "cylinder",
  });
  const cylinderVolume = calculateGeometryVolumeMm3(cylinderRelief);
  const mesh = lithophaneMeshSize(
    plate.width,
    plate.height,
    lithophaneMeshOptions("curved"),
  );

  relief.computeBoundingBox();
  const reliefBack = -(relief.boundingBox?.min.z ?? Number.NaN);
  // Общие вершины лица — условие гладких нормалей: у регулярной сетки на
  // внутреннюю вершину приходится шесть треугольников, у плоского затенения —
  // два, и именно тогда фасетки 0.3 мм складывались в муар.
  const faceReuse = faceVertexReuse(relief, radius, radius + minThickness - 0.01);

  console.log(
    `  дуга R${radius}: плита уходит назад на ${reliefBack.toFixed(3)} мм ` +
      `(по дуге ${sagArc.toFixed(3)}, по проекции ${sagProjection.toFixed(3)}), ` +
      `заворот ${frameBend.minAngle.toFixed(2)}…${frameBend.maxAngle.toFixed(2)}°`,
  );
  console.log(
    `  объём: плоская ${(flatVolume / 1000).toFixed(3)} см³, дуга ` +
      `${(curvedVolume / 1000).toFixed(3)}, полуцилиндр ` +
      `${(cylinderVolume / 1000).toFixed(3)}; общих вершин лица — ` +
      `${faceReuse.toFixed(2)} треугольника на вершину`,
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
  // Рамка рождается на цилиндре тем же отображением, но её контур шире окна:
  // угол считается по половине габарита панели, лицо отстоит на frontZ.
  checkRange(
    "дуга: рамка идёт по тому же цилиндру",
    [
      frameBend.minRadius - radius,
      frameBend.maxRadius - radius - frontZ,
      frameBend.maxAngle - (halfWidth / radius) * (180 / Math.PI),
    ],
    -0.05,
    0.05,
  );
  // Главная проверка от муара: у ровного кадра лицо — идеальный цилиндр, и
  // вершины у него общие, поэтому нормали считаются по сетке, а не по фасеткам.
  checkRange(
    "дуга: вершины лица общие — фасеток не видно",
    [faceReuse],
    5,
    6.2,
  );
  // Объём не должен зависеть от формы: изгиб меняет его на доли процента.
  checkRange(
    "дуга: объём совпадает с плоской плитой",
    [curvedVolume / flatVolume - 1, cylinderVolume / flatVolume - 1],
    -0.01,
    0.05,
  );
  check(
    "дуга: плита укладывается в бюджет сетки",
    triangleCount(relief) <= (mesh?.triangles ?? 0),
    true,
  );
  check(
    "дуга: бюджет сетки считает нарезку тыла",
    mesh !== null && lithophaneMeshOptions("curved").fanStep > 0,
    true,
  );
  check(
    "дуга: оболочки замкнуты",
    openEdges(relief) + openEdges(frame) + openEdges(flatRelief),
    0,
  );
  check(
    "дуга: NaN 0",
    nanVertices(relief) + nanVertices(frame) + nanVertices(cylinderRelief),
    0,
  );
  // Тыл изогнутой плиты режется на полосы вдоль лучей, поэтому треугольников у
  // неё больше, чем у плоской, но не вдвое: веер не дробится на 0.3 мм.
  check(
    "дуга: нарезка тыла не больше половины лица",
    triangleCount(relief) <= triangleCount(flatRelief) * 1.5,
    true,
  );

  const assembly = createLithophaneGeometry({ ...curved, lithoMount: "arch" });
  const assemblySize = boxSize(assembly);

  console.log(
    `  сборка дуги: ${assemblySize.x.toFixed(2)} × ${assemblySize.y.toFixed(2)} × ` +
      `${assemblySize.z.toFixed(2)} мм, вес ` +
      `${calculateGeometryWeightGrams(assembly).toFixed(1)} г`,
  );

  checkRange(
    "дуга: сборка стоит на столе и поднимает панель на дно паза",
    [
      assembly.boundingBox?.min.y ?? Number.NaN,
      assemblySize.y - (height + LITHOPHANE_BENT_BASE_FLOOR_MM),
    ],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );
  check("дуга: сборка замкнута", openEdges(assembly), 0);

  relief.dispose();
  frame.dispose();
  flatRelief.dispose();
  cylinderRelief.dispose();
  assembly.dispose();
}


console.log(
  "\n18. Базы изогнутых форм: брусок по дуге и чаша, источник по выбору",
);

{
  /*
    У изогнутой панели база — брусок, заметённый по её дуге: паз под нижнюю
    кромку и выборка под источник. Лента лежит в канале, вынесенном на 26 мм
    назад: у самой панели она давала пересвет по центру и тёмные края. Под
    USB-лампу и патрон E27 канала нет — за пазом поднимается полка, на которой
    стоят стойка или стакан.

    У полуцилиндра — чаша: круговой паз на кромке, а в дне либо кольцевая канавка
    под ленту, либо площадка Ø44 под стойку и стакан, либо гладкое дно.

    Проверяется разрез, которого не видно на предпросмотре: дно паза, глубина
    канала, щели под рассеиватель и канавки, высота полки, пластик за выборкой,
    замкнутость и вес.
  */
  const base = LITHOPHANE_BENT_BASE;
  const width = 120;
  const height = 80;
  const plate = { lithophaneWidth: width, lithophaneHeight: height };
  const bar = createLithophaneGeometry(
    normalizeLithophaneParams({ ...plate, lithoShape: "curved" }),
    "stand",
  );
  const railUsb = createLithophaneGeometry(
    normalizeLithophaneParams({
      ...plate,
      lithoShape: "curved",
      lithoLightSource: "usb_bulb",
    }),
    "stand",
  );
  const railSocket = createLithophaneGeometry(
    normalizeLithophaneParams({
      ...plate,
      lithoShape: "curved",
      lithoLightSource: "socket",
    }),
    "stand",
  );
  const ring = createLithophaneGeometry(
    normalizeLithophaneParams({ ...plate, lithoShape: "cylinder" }),
    "stand",
  );
  const bowlUsb = createLithophaneGeometry(
    normalizeLithophaneParams({
      ...plate,
      lithoShape: "cylinder",
      lithoLightSource: "usb_bulb",
    }),
    "stand",
  );
  const bowlSocket = createLithophaneGeometry(
    normalizeLithophaneParams({
      ...plate,
      lithoShape: "cylinder",
      lithoLightSource: "socket",
    }),
    "stand",
  );
  const frontZ = boxSize(
    createLithophaneFrameGeometry({
      lithophaneWidth: width,
      lithophaneHeight: height,
    }),
  ).z;
  const cylinderRadius = width / Math.PI;
  const discRadius = cylinderRadius + frontZ + base.discRim;
  // Канал ленты стоит за тылом панели: зазор посадки, отступ и середина канала.
  const channelCenter =
    -(LITHOPHANE_FIT_GAP_MM + base.channelGap + base.channelWidth / 2);
  // За каналом остаётся внутренняя стенка: её середина — проверка материала.
  const behindChannel =
    channelCenter - base.channelWidth / 2 - base.innerRun / 2;
  // Кольцевая канавка ленты в дне чаши: от середины кольца до оси чаши.
  const ringOuter =
    cylinderRadius - LITHOPHANE_FIT_GAP_MM - base.bowlWall - base.ringInset;
  const ringCenter = ringOuter - base.channelWidth / 2;
  const barSize = boxSize(bar);
  const ringSize = boxSize(ring);
  const seatHit = firstHit(bar, [0, base.top + 30, 0], [0, -1, 0]);
  const channelHit = firstHit(
    bar,
    [0, base.top + 30, channelCenter],
    [0, -1, 0],
  );
  const behindHit = firstHit(bar, [0, base.top + 30, behindChannel], [0, -1, 0]);
  const outerHit = firstHit(
    bar,
    [0, base.top + 30, frontZ + LITHOPHANE_FIT_GAP_MM + base.outerWall / 2],
    [0, -1, 0],
  );
  /*
    Паз под рассеиватель: луч в его середину падает в дно, а рядом — верх бруска.
    На базе под лампу паза нет: на том же месте луч останавливается выше верха
    бруска — там пластик полки и упора.
  */
  const sheetHit = firstHit(bar, [0, base.top + 30, base.diffuserU], [0, -1, 0]);
  const beforeSheet = firstHit(
    bar,
    [0, base.top + 30, base.diffuserU + base.diffuserWidth],
    [0, -1, 0],
  );
  const rampSheet = firstHit(
    railUsb,
    [0, base.top + 30, base.diffuserU],
    [0, -1, 0],
  );
  const grooveHit = firstHit(ring, [0, base.bowlHeight + 30, 2], [0, -1, 0]);
  const bowlHit = firstHit(
    ring,
    [0, base.bowlHeight + 30, -cylinderRadius + 15],
    [0, -1, 0],
  );
  // Кольцевая канавка: луч идёт мимо панели в дно канавки.
  const ringHit = firstHit(
    ring,
    [0, base.bowlHeight + 30, -cylinderRadius + ringCenter],
    [0, -1, 0],
  );
  // Полка бруска: луч падает в её тыльную часть, мимо стойки лампы.
  const railHit = firstHit(
    railUsb,
    [0, base.railTop + 40, base.railBack + 4],
    [0, -1, 0],
  );
  // Площадка в чаше: луч идёт в кольцо площадки мимо подошвы стойки.
  const perchHit = firstHit(
    bowlUsb,
    [0, base.perchTop + 40, -cylinderRadius + base.pedestalRadius - 3],
    [0, -1, 0],
  );
  // Стакан патрона: луч в стенку кромки и луч в дно гнезда.
  const socketRimHit = firstHit(
    bowlSocket,
    [0, base.perchTop + 40, -cylinderRadius + LITHOPHANE_SOCKET_LIGHT.outerDiameter / 2 - 1],
    [0, -1, 0],
  );
  const socketCavityHit = firstHit(
    bowlSocket,
    [0, base.perchTop + 40, -cylinderRadius + 12],
    [0, -1, 0],
  );

  console.log(
    `  брусок дуги: ${barSize.x.toFixed(2)} × ${barSize.y.toFixed(2)} × ` +
      `${barSize.z.toFixed(2)} мм, вес ` +
      `${calculateGeometryWeightGrams(bar).toFixed(1)} г; рельс с USB: ` +
      `${boxSize(railUsb).z.toFixed(2)} мм по глубине; чаша с лентой: Ø` +
      `${ringSize.x.toFixed(2)} × ${ringSize.y.toFixed(2)} мм, вес ` +
      `${calculateGeometryWeightGrams(ring).toFixed(1)} г; чаша с патроном: ` +
      `${boxSize(bowlSocket).y.toFixed(2)} мм, вес ` +
      `${calculateGeometryWeightGrams(bowlSocket).toFixed(1)} г`,
  );

  // Сменные крепления остаются только у плоской панели: у изогнутых своя база.
  check(
    "базы: сменные крепления только у плоской формы",
    [
      lithophaneShapeHasMounts("flat"),
      lithophaneShapeHasMounts("curved"),
      lithophaneShapeHasMounts("cylinder"),
      lithophaneShapeHasMounts("kaleidoscope"),
    ],
    [true, false, false, false],
  );
  checkRange(
    "брусок: высота базы",
    [barSize.y],
    base.top - TOLERANCE_MM,
    base.top + TOLERANCE_MM,
  );
  checkRange(
    "брусок: дно паза на высоте стенки под ним",
    [seatHit?.y ?? Number.NaN],
    LITHOPHANE_BENT_BASE_FLOOR_MM - TOLERANCE_MM,
    LITHOPHANE_BENT_BASE_FLOOR_MM + TOLERANCE_MM,
  );
  checkRange(
    "брусок: канал под ленту глубиной 2 мм",
    [channelHit?.y ?? Number.NaN],
    base.top - base.channelDepth - TOLERANCE_MM,
    base.top - base.channelDepth + TOLERANCE_MM,
  );
  checkRange(
    "брусок: за каналом и перед панелью есть пластик",
    [behindHit?.y ?? Number.NaN, outerHit?.y ?? Number.NaN],
    base.top - TOLERANCE_MM,
    base.top + TOLERANCE_MM,
  );
  checkRange(
    "брусок: паз рассеивателя глубиной 6 мм",
    [(beforeSheet?.y ?? Number.NaN) - (sheetHit?.y ?? Number.NaN)],
    base.diffuserDepth - TOLERANCE_MM,
    base.diffuserDepth + TOLERANCE_MM,
  );
  check(
    "брусок: паз рассеивателя держит лист 2 мм",
    [
      base.diffuserWidth > 2,
      sheetHit !== null,
      base.diffuserDepth > base.diffuserWidth,
    ],
    [true, true, true],
  );
  check(
    "брусок: паз рассеивателя стоит между каналом и панелью",
    [
      base.diffuserU - base.diffuserWidth / 2 >
        channelCenter + base.channelWidth / 2,
      base.diffuserU + base.diffuserWidth / 2 < -LITHOPHANE_FIT_GAP_MM,
    ],
    [true, true],
  );
  check(
    "брусок: под лампу паза нет — на его месте пластик",
    [
      rampSheet !== null,
      (rampSheet?.y ?? Number.NaN) > base.top - base.diffuserDepth + 1,
    ],
    [true, true],
  );
  check(
    "брусок: оболочка замкнута",
    openEdges(bar) + nanVertices(bar),
    0,
  );
  checkRange(
    "брусок: канал отодвинут от панели на 26 мм",
    [
      Math.abs(channelCenter) -
        LITHOPHANE_FIT_GAP_MM -
        base.channelWidth / 2,
    ],
    Math.abs(base.channelGap) - TOLERANCE_MM,
    Math.abs(base.channelGap) + TOLERANCE_MM,
  );
  checkRange(
    "чаша: наружный радиус — панель, стенка и кромка",
    [ringSize.x / 2 - discRadius, ringSize.y - base.bowlHeight],
    -0.02,
    0.02,
  );
  checkRange(
    "чаша: круговой паз опускает панель на кромку чаши",
    [grooveHit?.y ?? Number.NaN],
    LITHOPHANE_CYLINDER_FLOOR_MM - TOLERANCE_MM,
    LITHOPHANE_CYLINDER_FLOOR_MM + TOLERANCE_MM,
  );
  checkRange(
    "чаша: дно полости ниже паза",
    [bowlHit?.y ?? Number.NaN],
    base.bowlFloor - TOLERANCE_MM,
    base.bowlFloor + TOLERANCE_MM,
  );
  checkRange(
    "чаша: кольцевая канавка под ленту глубиной 2 мм",
    [ringHit?.y ?? Number.NaN],
    base.bowlFloor - base.channelDepth - TOLERANCE_MM,
    base.bowlFloor - base.channelDepth + TOLERANCE_MM,
  );
  check(
    "чаша: оболочка замкнута и стоит на столе",
    [
      openEdges(ring) + nanVertices(ring),
      ring.boundingBox?.min.y ?? Number.NaN,
    ],
    [0, 0],
  );

  // Источник выбирается: под лампу база получает полку, а не канал.
  checkRange(
    "рельс: полка под лампу на 16 мм",
    [railHit?.y ?? Number.NaN],
    base.railTop - TOLERANCE_MM,
    base.railTop + TOLERANCE_MM,
  );
  checkRange(
    "рельс: полка доходит до тыльной кромки",
    [boxSize(railUsb).z, boxSize(railSocket).z],
    Math.abs(base.railBack) + TOLERANCE_MM,
    Math.abs(base.railBack) + 20,
  );
  checkRange(
    "рельс: стакан патрона поднимает лампу над полкой",
    [boxSize(railSocket).y],
    base.railTop + 20,
    base.railTop + 40,
  );
  checkRange(
    "чаша: площадка под лампу на 43 мм",
    [perchHit?.y ?? Number.NaN],
    base.perchTop - TOLERANCE_MM,
    base.perchTop + TOLERANCE_MM,
  );
  checkRange(
    "чаша: гнездо стакана глубиной 15 мм",
    [
      (socketRimHit?.y ?? Number.NaN) - (socketCavityHit?.y ?? Number.NaN),
    ],
    LITHOPHANE_SOCKET_LIGHT.cavityDepth - TOLERANCE_MM,
    LITHOPHANE_SOCKET_LIGHT.cavityDepth + TOLERANCE_MM,
  );
  check(
    "базы с лампой: оболочки замкнуты",
    [
      openEdges(railUsb) + nanVertices(railUsb),
      openEdges(railSocket) + nanVertices(railSocket),
      openEdges(bowlUsb) + nanVertices(bowlUsb),
      openEdges(bowlSocket) + nanVertices(bowlSocket),
    ],
    [0, 0, 0, 0],
  );

  bar.dispose();
  railUsb.dispose();
  railSocket.dispose();
  ring.dispose();
  bowlUsb.dispose();
  bowlSocket.dispose();
}


console.log("\n19. Калейдоскоп: четыре панели без рамок, полый цоколь и крышка");

{
  /*
    Калейдоскоп — светильник из четырёх панелей под 90°. Съёмной рамки у них нет:
    край плиты входит в паз цоколя и в паз тонкой крышки, поэтому призма — это
    квадрат со стороной ширины панели, а световая камера ограничена тылами плит.

    Полый цоколь — главное, чего не хватало: прежняя призма весила 381 г, потому
    что её пол, рельсы и крышка были сплошными. Теперь цоколь — четыре тонких
    рельса, кольцо Ø40 под свечу и четыре спицы, а в крышке четыре окна: свет
    выходит, свеча не гаснет. На панели 120 × 80 вся деталь весит около 110 г.

    Раздел проверяет вес, габариты, сквозное отверстие под свечу, окна в крышке и
    то, ради чего панели стали отдельными: у каждой грани может быть свой кадр, а
    пустой слот повторяет предыдущую грань.
  */
  const k = LITHOPHANE_KALEIDOSCOPE;
  const width = 120;
  const height = 80;
  const params = normalizeLithophaneParams({
    lithophaneWidth: width,
    lithophaneHeight: height,
    lithoShape: "kaleidoscope",
  });
  const maxThickness = params.lithophaneMaxThickness;
  const minThickness = params.lithophaneMinThickness;
  const outer = width / 2 + LITHOPHANE_FIT_GAP_MM + k.wall;
  const lidBottom = k.floor + height - k.seatDepth;
  const lidTop = lidBottom + k.lidThickness;

  const prism = createLithophaneGeometry(params);
  const basePart = createLithophaneGeometry(params, "stand");
  const panels = createLithophaneGeometry(params, "relief");
  const prismSize = boxSize(prism);
  const baseSize = boxSize(basePart);
  const weight = calculateGeometryWeightGrams(prism);
  const panelsWeight = calculateGeometryWeightGrams(panels);
  const baseWeight = calculateGeometryWeightGrams(basePart);
  const plateMesh = lithophaneMeshSize(
    width,
    height,
    lithophaneMeshOptions("kaleidoscope"),
  );
  // Середина кромки пьедестала: между гнездом и наружной стенкой.
  const candleRingAt = (k.pedestalCavity + k.pedestalOuter) / 2;
  const pedestalFloor = k.pedestalTop - k.pedestalDepth;

  console.log(
    `  призма ${prismSize.x.toFixed(2)} × ${prismSize.y.toFixed(2)} × ` +
      `${prismSize.z.toFixed(2)} мм, цоколь ${baseSize.x.toFixed(2)} × ` +
      `${baseSize.y.toFixed(2)} мм, вес ${weight.toFixed(1)} г ` +
      `(панели ${panelsWeight.toFixed(1)}, цоколь ${baseWeight.toFixed(1)}, ` +
      `крышка ${(weight - panelsWeight - baseWeight).toFixed(1)})`,
  );

  check(
    "калейдоскоп: база есть у всех форм, кроме плоской",
    [
      lithophaneShapeHasBase("flat"),
      lithophaneShapeHasBase("curved"),
      lithophaneShapeHasBase("cylinder"),
      lithophaneShapeHasBase("kaleidoscope"),
    ],
    [false, true, true, true],
  );
  checkRange(
    "калейдоскоп: квадратная призма по наружной стенке цоколя",
    [prismSize.x - 2 * outer, prismSize.z - 2 * outer],
    -0.02,
    0.02,
  );
  checkRange(
    "калейдоскоп: высота — панель на дне паза плюс крышка",
    [prismSize.y, lidTop],
    lidTop - TOLERANCE_MM,
    lidTop + TOLERANCE_MM,
  );
  checkRange(
    "калейдоскоп: цоколь на столе, высота — пьедестал под свечу",
    [
      basePart.boundingBox?.min.y ?? Number.NaN,
      baseSize.y - k.pedestalTop,
      baseSize.x - 2 * outer,
    ],
    -STEP_TOLERANCE_MM,
    TOLERANCE_MM,
  );
  // Вес — требование владельца: полая призма с пьедесталом укладывается в 140 г.
  checkRange("калейдоскоп: вес полой призмы", [weight], 60, 140);
  checkRange(
    "калейдоскоп: крышка тонкая — 2.5 мм",
    [lidTop - lidBottom],
    k.lidThickness - TOLERANCE_MM,
    k.lidThickness + TOLERANCE_MM,
  );
  check(
    "калейдоскоп: сборка, цоколь и панели замкнуты",
    [
      openEdges(prism) + nanVertices(prism),
      openEdges(basePart) + nanVertices(basePart),
      openEdges(panels) + nanVertices(panels),
    ],
    [0, 0, 0],
  );

  /*
    Свеча стоит в гнезде пьедестала: снизу труба открыта, а дно гнезда упирается в
    пластик. Раньше свеча стояла на столе в кольце, и источник оказывался у самого
    низа кадра.
  */
  checkRange(
    "калейдоскоп: дно гнезда пьедестала под свечу",
    [
      firstHit(basePart, [0, -30, 0], [0, 1, 0])?.y ?? Number.NaN,
      firstHit(basePart, [0, k.pedestalTop + 30, 0], [0, -1, 0])?.y ??
        Number.NaN,
    ],
    pedestalFloor - TOLERANCE_MM,
    pedestalFloor + TOLERANCE_MM,
  );
  checkRange(
    "калейдоскоп: кромка пьедестала на высоте гнезда",
    [firstHit(basePart, [candleRingAt, 30, 0], [0, -1, 0])?.y ?? Number.NaN],
    k.pedestalTop - TOLERANCE_MM,
    k.pedestalTop + TOLERANCE_MM,
  );
  // Окна в крышке: между обвязкой и колпаком свет и горячий воздух уходят вверх.
  check(
    "калейдоскоп: окна в крышке открыты",
    firstHit(prism, [30, lidTop + 30, 30], [0, -1, 0]),
    null,
  );
  // Бюджет сетки: четыре копии рельефа с шагом 0.5 мм, число треугольников
  // совпадает с бюджетом — у плоских панелей тыл остаётся одним веером.
  check(
    "калейдоскоп: четыре копии рельефа с шагом 0.5 мм",
    [lithophaneMeshOptions("kaleidoscope"), lithophaneMeshOptions("flat")],
    [
      {
        step: LITHOPHANE_KALEIDOSCOPE_PANEL_STEP_MM,
        copies: LITHOPHANE_KALEIDOSCOPE.sides,
        fanStep: 0,
      },
      {
        step: LITHOPHANE_VERTEX_STEP_MM,
        copies: 1,
        fanStep: 0,
      },
    ],
  );
  check(
    "калейдоскоп: треугольники совпадают с бюджетом сетки",
    triangleCount(panels),
    (plateMesh?.triangles ?? 0) * LITHOPHANE_KALEIDOSCOPE.sides,
  );
  /*
    Группы материалов: по одной на грань и одна на крепление. Предпросмотр
    красит грани разными кадрами — без групп на всех светился бы первый.
  */
  check(
    "калейдоскоп: у каждой грани своя группа материалов",
    [
      prism.groups.map((group) => group.materialIndex),
      panels.groups.map((group) => group.materialIndex),
    ],
    [
      [0, 1, 2, 3, LITHOPHANE_KALEIDOSCOPE.sides],
      [0, 1, 2, 3],
    ],
  );

  // Один кадр повторяется на всех гранях — так калейдоскоп работает по умолчанию.
  const black = flatFrame(0, 40, 40);
  const white = flatFrame(255, 40, 40);
  const single = normalizeLithophaneParams({
    lithophaneWidth: width,
    lithophaneHeight: height,
    lithoShape: "kaleidoscope",
    lithophaneBrightness: black.brightness,
    lithophaneBrightnessWidth: black.width,
    lithophaneBrightnessHeight: black.height,
  });
  const singlePrism = createLithophaneGeometry(single);
  // Луч идёт чуть выше середины панели: ровно по середине он попадал бы в линию
  // сетки и считал одну и ту же грань семь раз.
  const probeY = height / 2 + 0.13;
  const singleFaces = [0, 1, 2, 3].map((side) =>
    prismFaceThickness(singlePrism, side, probeY),
  );

  console.log(
    `  один кадр на всех гранях: толщины ` +
      singleFaces.map((value) => value.toFixed(2)).join(" / ") +
      ` мм (максимум ${maxThickness})`,
  );

  checkRange(
    "калейдоскоп: один кадр повторяется на всех гранях",
    singleFaces,
    maxThickness - 0.05,
    maxThickness + 0.05,
  );

  // Четыре разных кадра: тёмная грань 2 и два пустых слота — они повторяют её
  // же, а первая грань остаётся светлой.
  const mixed = normalizeLithophaneParams({
    lithophaneWidth: width,
    lithophaneHeight: height,
    lithoShape: "kaleidoscope",
    lithophaneBrightness: white.brightness,
    lithophaneBrightnessWidth: white.width,
    lithophaneBrightnessHeight: white.height,
    lithophaneSideBrightness: [
      {
        brightness: black.brightness,
        width: black.width,
        height: black.height,
      },
      null,
      null,
    ],
  });
  const mixedPrism = createLithophaneGeometry(mixed);
  const mixedFaces = [0, 1, 2, 3].map((side) =>
    prismFaceThickness(mixedPrism, side, probeY),
  );
  const faces = lithophaneFaceBrightness(mixed);

  console.log(
    `  свой кадр на грани: толщины ` +
      mixedFaces.map((value) => value.toFixed(2)).join(" / ") +
      ` мм, кадров в наборе ${faces.length}`,
  );

  checkRange(
    "калейдоскоп: светлая грань осталась тонкой",
    [mixedFaces[0]],
    minThickness - 0.05,
    minThickness + 0.05,
  );
  checkRange(
    "калейдоскоп: тёмный кадр у грани 2, пустые слоты повторяют её",
    [mixedFaces[1], mixedFaces[2], mixedFaces[3]],
    maxThickness - 0.05,
    maxThickness + 0.05,
  );
  check(
    "калейдоскоп: кадров всегда четыре",
    [faces.length, lithophaneFaceBrightness(params).length],
    [4, 4],
  );

  prism.dispose();
  basePart.dispose();
  panels.dispose();
  singlePrism.dispose();
  mixedPrism.dispose();
}

console.log("\n20. Свет: где стоят лампы и как ложится свет");

{
  /*
    Светотехника — то, что раньше проверялось только печатью: ляжет ли подсветка
    пятном. Считается карта освещённости панели, и проверяем мы её свойства, а не
    абсолютные люксы: закон обратных квадратов на синтетической грани, линию
    ленты по каналу, места ламп из геометрии креплений и порядок «лента хуже
    лампы». Заодно проверяется, у каких сборок источника нет вовсе.
  */
  const syntheticFace: LithoLightFace = {
    origin: [0, 0, 0],
    right: [1, 0, 0],
    up: [0, 1, 0],
    normal: [0, 0, 1],
    width: 100,
    height: 100,
    bend: null,
  };
  // Лампа на 100 мм позади центра панели, светит на панель: 1 кд / (0.1 м)² = 100 лк.
  const lamp: LithoLightEmitter = {
    position: [0, 50, -100],
    axis: [0, 1, 0],
    lobe: 0,
    intensity: 1,
  };
  const spot = lithophaneLightMetrics([syntheticFace], [lamp], 1, 1);
  // Та же лампа с диаграммой ленты: косинус к вертикали, вниз не светит вовсе.
  const beam = lithophaneLightMetrics(
    [syntheticFace],
    [{ ...lamp, lobe: 1 }],
    1,
    2,
  );

  const plate = lithophanePlateSize(normalizeLithophaneParams({}));
  const strip = lithophaneLightPlan({
    lithoMount: "arch",
    lithoLightSource: "strip",
  });
  const bulb = lithophaneLightPlan({
    lithoMount: "arch",
    lithoLightSource: "usb_bulb",
  });
  const socket = lithophaneLightPlan({
    lithoMount: "arch",
    lithoLightSource: "socket",
  });
  const prism = lithophaneLightPlan({ lithoShape: "kaleidoscope" });
  const curvedStrip = lithophaneLightPlan({ lithoShape: "curved" });
  const ringStrip = lithophaneLightPlan({ lithoShape: "cylinder" });
  const railBulb = lithophaneLightPlan({
    lithoShape: "curved",
    lithoLightSource: "usb_bulb",
  });
  const railSocket = lithophaneLightPlan({
    lithoShape: "curved",
    lithoLightSource: "socket",
  });
  const bowlBulb = lithophaneLightPlan({
    lithoShape: "cylinder",
    lithoLightSource: "usb_bulb",
  });
  const bowlSocket = lithophaneLightPlan({
    lithoShape: "cylinder",
    lithoLightSource: "socket",
  });
  const stripSpots = strip?.emitters.map((item) => item.position) ?? [];
  const stripX = stripSpots.map((point) => point[0]);

  console.log(
    `  верх/низ: лента ${(strip?.topShare ?? 0).toFixed(2)}, ` +
      `USB ${(bulb?.topShare ?? 0).toFixed(2)}, ` +
      `E27 ${(socket?.topShare ?? 0).toFixed(2)}; ` +
      `до панели: лента ${(strip?.actualDistance ?? 0).toFixed(1)} мм, ` +
      `E27 ${(socket?.actualDistance ?? 0).toFixed(1)} мм`,
  );

  checkRange("свет: закон обратных квадратов", [spot.average], 99.9, 100.1);
  check(
    "свет: лента вниз не светит",
    [beam.floor, beam.peak > 31 && beam.peak < 33],
    [0, true],
  );

  check(
    "свет: без рамки источника нет",
    lithophaneLightPlan({ lithoFrame: false }),
    null,
  );
  check(
    "свет: у сплошной ножки источника нет",
    lithophaneLightPlan({ lithoMount: "stand" }),
    null,
  );
  check(
    "свет: у массивного основания источника нет",
    lithophaneLightPlan({ lithoMount: "base" }),
    null,
  );
  check(
    "свет: «без подсветки» — плана нет",
    lithophaneLightPlan({ lithoMount: "arch", lithoLightSource: "none" }),
    null,
  );
  check(
    "свет: у подвеса лента в коробе",
    lithophaneLightPlan({ lithoMount: "hook" })?.kind,
    "strip",
  );

  check(
    "свет: лента разложена на точки по каналу",
    [strip?.kind, strip?.emitters.length, strip?.emitters[0].lobe],
    ["strip", LITHO_LIGHT_MODEL.stripEmitters, 1],
  );
  check(
    "свет: точки ленты лежат в одну линию",
    [
      new Set(stripSpots.map((point) => point[1].toFixed(3))).size,
      new Set(stripSpots.map((point) => point[2].toFixed(3))).size,
    ],
    [1, 1],
  );
  checkRange(
    "свет: лента идёт по ширине базы",
    [Math.max(...stripX) - Math.min(...stripX)],
    Math.min(
      normalizeLithophaneParams({}).lithophaneWidth,
      Math.max(
        LITHOPHANE_ARCH_STAND.minWidth,
        normalizeLithophaneParams({}).lithophaneWidth *
          LITHOPHANE_ARCH_STAND.widthFactor,
      ),
    ) - TOLERANCE_MM,
    Math.min(
      normalizeLithophaneParams({}).lithophaneWidth,
      Math.max(
        LITHOPHANE_ARCH_STAND.minWidth,
        normalizeLithophaneParams({}).lithophaneWidth *
          LITHOPHANE_ARCH_STAND.widthFactor,
      ),
    ) + TOLERANCE_MM,
  );
  checkRange(
    "свет: лента отодвинута от панели на 50–60 мм",
    [strip?.actualDistance ?? Number.NaN],
    50,
    60,
  );
  check(
    "свет: лента светит вверх и вперёд",
    [
      strip!.emitters[0].axis[1] > 0,
      strip!.emitters[0].axis[2] > 0,
      strip!.emitters[0].position[2] < -40,
    ],
    [true, true, true],
  );
  check(
    "свет: лампа в гнезде — одна точка в центре",
    [
      socket?.kind,
      socket?.emitters.length,
      socket?.emitters[0].position.map((value) => Math.round(value)),
    ],
    ["socket", 1, [0, LITHO_LIGHT_SEATS.socketY, LITHOPHANE_SOCKET_LIGHT.centerZ]],
  );
  check(
    "свет: колба USB стоит в чаше стойки",
    [bulb?.emitters[0].position[1], bulb?.emitters[0].position[2]],
    [LITHO_LIGHT_SEATS.usbBulbY, LITHOPHANE_USB_LIGHT.centerZ],
  );

  /*
    Наклонный канал ставит ленту выше низа панели и в 54 мм от неё, поэтому по
    высоте она ровнее колбы: у той свет уходит вниз, а верх остаётся в тени. Патрон
    E27 стоит выше колбы, поэтому его верх получает больше света — порядок «чем
    выше источник, тем ровнее» проверяется на лампе и колбе.
  */
  check(
    "свет: наклонный канал ровнее колбы в чаше",
    [strip!.topShare > bulb!.topShare, bulb!.topShare < socket!.topShare],
    [true, true],
  );
  check(
    "свет: лента в канале без пересвета",
    [
      strip!.peakRatio < LITHO_LIGHT_MODEL.overexposure,
      strip!.warnings.every((item) => item.id !== "too_close"),
    ],
    [true, true],
  );
  check(
    "свет: у гнезда E27 расстояния не хватает",
    [
      socket?.warnings.map((item) => item.id).includes("too_close"),
      socket!.actualDistance < socket!.recommendedDistance,
    ],
    [true, true],
  );

  check(
    "свет: призма — четыре грани и свеча в центре",
    [prism?.kind, prism?.faces.length, prism?.maps.length],
    ["candle", 4, 4],
  );
  checkRange(
    "свет: свеча на оси светит всем граням одинаково",
    [prism?.faceSpread ?? Number.NaN],
    0,
    0.05,
  );
  check(
    "свет: свеча поднята пьедесталом к середине кадра",
    [
      prism?.kind,
      prism?.emitters[0].position.map((value) => Math.round(value)),
    ],
    ["candle", [0, Math.round(LITHO_LIGHT_SEATS.candleY), 0]],
  );
  /*
    Источник у изогнутых форм теперь выбирается. Лента в чаше уложена кольцом по
    всему полуцилиндру, а лампа и патрон стоят на полке базы: их центр считается
    от полки, поэтому у дуги и в чаше он разный.
  */
  const bowlRadius = -(bowlBulb?.faces[0].bend?.radius ?? 0);
  const ringSpots = ringStrip?.emitters.map((item) => item.position) ?? [];
  const ringRadius = ringSpots.map((point) =>
    Math.hypot(point[0], point[2] - bowlRadius),
  );
  const shelf = LITHOPHANE_BENT_BASE;

  check(
    "свет: в чаше лента уложена кольцом по всему полуцилиндру",
    [
      ringStrip?.kind,
      ringSpots.length,
      Math.max(...ringRadius) - Math.min(...ringRadius) < 0.01,
      new Set(ringSpots.map((point) => point[1].toFixed(3))).size,
    ],
    ["strip", LITHO_LIGHT_MODEL.stripEmitters, true, 1],
  );
  check(
    "свет: в чаше лампа и патрон стоят на площадке по оси",
    [
      bowlBulb?.kind,
      bowlBulb?.emitters[0].position.map((value) => Math.round(value)),
      bowlSocket?.kind,
      bowlSocket?.emitters[0].position.map((value) => Math.round(value)),
    ],
    [
      "usb_bulb",
      [0, Math.round(shelf.perchTop + LITHO_LIGHT_SEATS.usbBulbAbove), Math.round(bowlRadius)],
      "socket",
      [0, Math.round(shelf.perchTop + LITHO_LIGHT_SEATS.socketAbove), Math.round(bowlRadius)],
    ],
  );
  check(
    "свет: на рельсе дуги лампа и патрон стоят на полке",
    [
      railBulb?.kind,
      railBulb?.emitters[0].position.map((value) => Math.round(value)),
      railSocket?.kind,
      railSocket?.emitters[0].position.map((value) => Math.round(value)),
    ],
    [
      "usb_bulb",
      [
        0,
        Math.round(shelf.railTop + LITHO_LIGHT_SEATS.usbBulbAbove),
        LITHOPHANE_USB_LIGHT.centerZ,
      ],
      "socket",
      [
        0,
        Math.round(shelf.railTop + LITHO_LIGHT_SEATS.socketAbove),
        LITHOPHANE_SOCKET_LIGHT.centerZ,
      ],
    ],
  );
  check(
    "свет: «без подсветки» у изогнутой панели плана нет",
    lithophaneLightPlan({ lithoShape: "curved", lithoLightSource: "none" }),
    null,
  );
  check(
    "свет: лента в рельсе дуги отодвинута от панели",
    [
      curvedStrip?.kind,
      curvedStrip!.actualDistance > 25,
    ],
    ["strip", true],
  );
  check(
    "свет: лампа в чаше светит ровнее ленты в дне",
    [bowlBulb!.topShare > ringStrip!.topShare, bowlSocket!.topShare > ringStrip!.topShare],
    [true, true],
  );
  check(
    "свет: в чаше полуцилиндра верх не темнее низа вдвое",
    bowlBulb!.topShare > 0.5,
    true,
  );
  checkRange(
    "свет: карта на грань нужного размера",
    [strip?.maps[0].length ?? Number.NaN],
    LITHO_LIGHT_MODEL.columns * LITHO_LIGHT_MODEL.rows,
    LITHO_LIGHT_MODEL.columns * LITHO_LIGHT_MODEL.rows,
  );

  /*
    Рассеиватель: лист в пазу базы. Он не добавляет свет, а перераспределяет уже
    дошедший, поэтому проверяется не абсолют, а разница с той же сборкой без листа:
    пик падает, рабочая зона растёт, средняя держится. Панель 180 × 155 — та, с
    которой расчёт сам советует лист.
  */
  const wide = { lithophaneWidth: 180, lithophaneHeight: 155 };
  const wideStrip = lithophaneLightPlan({
    lithoMount: "arch",
    lithoLightSource: "strip",
    ...wide,
  })!;
  const wideSheet = lithophaneLightPlan({
    lithoMount: "arch",
    lithoLightSource: "strip",
    lithoDiffuser: true,
    ...wide,
  })!;
  const wideCurve = lithophaneLightPlan({
    lithoShape: "curved",
    lithoLightSource: "strip",
    ...wide,
  })!;
  const wideCurveSheet = lithophaneLightPlan({
    lithoShape: "curved",
    lithoLightSource: "strip",
    lithoDiffuser: true,
    ...wide,
  })!;
  // Лист просят у лампы, патрона и в чаше: там паза нет, и план его не выдумывает.
  const wideBulbSheet = lithophaneLightPlan({
    lithoMount: "arch",
    lithoLightSource: "usb_bulb",
    lithoDiffuser: true,
    ...wide,
  })!;
  const ringSheet = lithophaneLightPlan({
    lithoShape: "cylinder",
    lithoLightSource: "strip",
    lithoDiffuser: true,
    ...wide,
  })!;
  /** Доля узлов карты в рабочей зоне: от 0.6 до 1.6 средней. */
  const greenShare = (plan: LithoLightPlan): number => {
    const map = plan.maps[0] ?? [];
    const green = map.filter(
      (lux) => lux >= plan.average * 0.6 && lux <= plan.average * 1.6,
    ).length;

    return map.length > 0 ? green / map.length : 0;
  };

  check(
    "свет: на широкой панели расчёт советует лист",
    [
      wideStrip.warnings.some((item) => item.id === "diffuser"),
      wideSheet.warnings.some((item) => item.id === "diffuser"),
      strip!.warnings.some((item) => item.id === "diffuser"),
    ],
    [true, false, false],
  );
  check(
    "свет: лист размывает пятно — пик падает, рабочая зона растёт",
    [
      wideSheet.peakRatio < wideStrip.peakRatio - 0.1,
      greenShare(wideSheet) > greenShare(wideStrip) + 0.05,
      wideCurveSheet.peakRatio < wideCurve.peakRatio - 0.1,
      greenShare(wideCurveSheet) > greenShare(wideCurve) + 0.05,
    ],
    [true, true, true, true],
  );
  check(
    "свет: лист не добавляет свет — средняя падает на пропускание",
    [
      wideSheet.average < wideStrip.average,
      wideSheet.average > wideStrip.average * 0.8,
      wideSheet.maps.every((map) => map.every(Number.isFinite)),
    ],
    [true, true, true],
  );
  checkRange(
    "свет: лист стоит в пазу базы, между лентой и панелью",
    [wideSheet.diffuser?.gap ?? Number.NaN],
    10,
    wideStrip.actualDistance - 10,
  );
  check(
    "свет: в бруске дуги лист ближе к панели, чем в базе арки",
    [
      (wideCurveSheet.diffuser?.gap ?? Number.NaN) <
        (wideSheet.diffuser?.gap ?? 0),
    ],
    [true],
  );
  checkRange(
    "свет: низ листа — дно паза, верх — на высоте листа",
    [
      (wideSheet.diffuser?.top ?? Number.NaN) -
        (wideSheet.diffuser?.bottom ?? Number.NaN),
    ],
    LITHO_LIGHT_MODEL.diffuserSheetHeight,
    LITHO_LIGHT_MODEL.diffuserSheetHeight,
  );
  check(
    "свет: паз под лист есть только у ленты в плоской и изогнутой базе",
    [
      wideSheet.diffuserSupported,
      wideCurveSheet.diffuserSupported,
      wideBulbSheet.diffuserSupported,
      wideBulbSheet.diffuser,
      ringSheet.diffuserSupported,
      ringSheet.diffuser,
    ],
    [true, true, false, null, false, null],
  );

  // Палитра карты: синий — провал, зелёный — рабочая зона, красный — пересвет.
  const [darkRed, , darkBlue] = lithophaneHeatColor(0.1);
  const [midRed, midGreen] = lithophaneHeatColor(1);
  const [hotRed, , hotBlue] = lithophaneHeatColor(5);
  check(
    "свет: палитра карты читается как термометр",
    [darkBlue > darkRed, midGreen > midRed, hotRed > hotBlue],
    [true, true, true],
  );

  /*
    Сетка карты: сцена только заворачивает эти буферы в three, поэтому проверяем
    то, что видно глазом, — карта лежит на грани размером с панель, вынесена вперёд
    рельефа, индексы полные, а низ панели у ленты теплее верха. Сдвиг берём тот же,
    что в предпросмотре: максимальная толщина плюс зазор.
  */
  const heatLift = normalizeLithophaneParams({}).lithophaneMaxThickness + 0.6;
  const layer = lithophaneHeatMesh(
    strip!.faces[0],
    strip!.maps[0],
    LITHO_LIGHT_MODEL.columns,
    LITHO_LIGHT_MODEL.rows,
    strip!.average,
    heatLift,
  );
  const corners = layer.positions.length / 3;
  const vertices = Array.from({ length: corners }, (_, index) => index);
  const face = strip!.faces[0];
  /*
    Панель арки стоит под наклоном 12°, поэтому мерить габарит по мировому `y`
    нельзя: карта лежит в плоскости грани. Проекции на `right` и `up` дают ширину и
    высоту плиты независимо от наклона.
  */
  const project = (index: number, axis: readonly number[]) =>
    axis[0] * (layer.positions[index * 3] - face.origin[0]) +
    axis[1] * (layer.positions[index * 3 + 1] - face.origin[1]) +
    axis[2] * (layer.positions[index * 3 + 2] - face.origin[2]);
  const xspan = vertices.map((index) => project(index, face.right));
  const yspan = vertices.map((index) => project(index, face.up));
  // Тыл плиты — плоскость грани; карта должна стоять на `heatLift` впереди неё.
  const plane = (index: number) => project(index, face.normal);

  check(
    "свет: сетка карты без дыр и NaN",
    [
      corners,
      layer.positions.every(Number.isFinite),
      layer.indices.length / 6,
      layer.pixels.length / 4,
      Math.max(...layer.indices) < corners,
    ],
    [
      LITHO_LIGHT_MODEL.columns * LITHO_LIGHT_MODEL.rows,
      true,
      (LITHO_LIGHT_MODEL.columns - 1) * (LITHO_LIGHT_MODEL.rows - 1),
      LITHO_LIGHT_MODEL.columns * LITHO_LIGHT_MODEL.rows,
      true,
    ],
  );
  checkRange(
    "свет: карта кроет панель по ширине",
    [Math.max(...xspan) - Math.min(...xspan)],
    plate.width - TOLERANCE_MM,
    plate.width + TOLERANCE_MM,
  );
  checkRange(
    "свет: карта кроет панель по высоте",
    [Math.max(...yspan) - Math.min(...yspan)],
    plate.height - TOLERANCE_MM,
    plate.height + TOLERANCE_MM,
  );
  checkRange(
    "свет: карта стоит впереди тыла на толщину плиты",
    [plane(0), plane(corners - 1)],
    heatLift - TOLERANCE_MM,
    heatLift + TOLERANCE_MM,
  );

  /*
    Строка 0 карты — низ панели. У ленты в наклонном канале ось смотрит вверх и
    вперёд, поэтому верх получает больше света: красного там больше, и карта не
    вырождается в однотонное пятно.
  */
  const topIndex = (LITHO_LIGHT_MODEL.rows - 1) * LITHO_LIGHT_MODEL.columns * 4;
  check(
    "свет: у наклонного канала верх карты теплее низа",
    [
      layer.pixels[topIndex] > layer.pixels[0],
      layer.pixels[topIndex] !== layer.pixels[0],
    ],
    [true, true],
  );
}


console.log("");

if (failures > 0) {
  console.log(`Провалено проверок: ${failures}`);
  process.exitCode = 1;
} else {
  console.log("Все проверки прошли.");
}

