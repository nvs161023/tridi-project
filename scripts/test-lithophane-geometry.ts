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
 *  17. круглый плафон: панели рождаются сразу на цилиндре, ширина панели равна
 *      дуге её сектора плюс перехлёст на стыке, тыл лежит на радиусе, лицо
 *      доходит до наружного диаметра, камера внутри пустая (луч из оси встречает
 *      только две стенки одной панели), а число групп материалов равно числу
 *      панелей; две панели дают то же кольцо из двух широких полуокружностей;
 *  18. калейдоскоп: четыре панели без рамок на полом цоколе под тонкой крышкой с
 *      окнами — призма 123.6 мм, вся деталь весит около 110 г вместо 381 г,
 *      отверстие Ø40 держит кольцо в центре дна, окна в крышке дают тягу, а на
 *      каждой грани может быть свой кадр (пустой слот повторяет предыдущий);
 *  19. свет: где стоят лампы и как ложится свет — обратные квадраты, канал под
 *      ленту, скобы, гнездо E27, лист-рассеиватель и карта света; у круглого
 *      плафона расчёта нет: лампу в него ставят отдельно;
 *  20. монорельс: узкая шина 14 × 5 мм лежит на столе, нахлёстом входит в тыл
 *      рамки и уходит назад на 100 мм с продольным пазом 6 × 2 мм — полки паза
 *      поднимаются до верха шины, а дно канала лежит на 3 мм; держатель патрона —
 *      плоское кольцо Ø50 × 5 мм с осью на 31 мм, сквозным отверстием под резьбу
 *      (Ø14.6 или Ø28.6), зенковкой 1 мм под фланец патрона с лица и шестигранным
 *      гнездом 2 мм под штатную гайку с тыла; снизу полоз 18 мм с пазом под шину,
 *      сверху гнутый козырёк 30 × 2 мм с вылетом 20 мм и провисом носа 5 мм;
 *      оболочка замкнута, кольцо в сборе весит около 14.3 г у E14 и 11.0 г у E27,
 *      а круглый плафон и калейдоскоп от монорельса не меняются.
 *
 * Запуск: `npm run check:lithophane`.
 *
 * Выход: 0 — все проверки прошли, 1 — есть расхождения.
 */
import type { BufferGeometry } from "three";

import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";

import {
  BODY_OVERLAP_MM,
  LITHOPHANE_ARCH_STAND,
  LITHOPHANE_ARCH_STRIP,
  LITHOPHANE_BORDER_CHAMFER_MM,
  LITHOPHANE_BORDER_MM,
  LITHOPHANE_CARRIAGE,
  LITHOPHANE_DETAIL_GROUP,
  LITHOPHANE_FIT_GAP_MM,
  LITHOPHANE_FRAME_CORNER_RADIUS_MM,
  LITHOPHANE_FRAME_OPENING_RADIUS_MM,
  LITHOPHANE_FRAME_WIDTH_MM,
  LITHOPHANE_KALEIDOSCOPE,
  LITHOPHANE_LAMP_CLAMP,
  LITHOPHANE_RAIL,
  LITHOPHANE_RELIEF_GROUP,
  LITHOPHANE_ROUND,
  LITHOPHANE_STAND_SHAPES,
  LITHOPHANE_STAND_TILT_DEG,
  LITHOPHANE_WALL_BOX,
  clampPostWidth,
  createLithophaneCarriageGeometry,
  createLithophaneFrameGeometry,
  createLithophaneGeometry,
  createLithophaneReliefGeometry,
  createLithophaneStandGeometry,
  lithophaneCarriageMetrics,
  lithophaneClampBulb,
  lithophanePlateSize,
  lithophaneRailMetrics,
  type LithophaneClampKind,
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
  LITHOPHANE_RAIL_SOCKETS,
  LITHOPHANE_RAIL_SOCKET_SIZES,
  LITHOPHANE_VERTEX_STEP_MM,
  lithophaneFaceBrightness,
  lithophaneHasRail,
  lithophaneMeshOptions,
  lithophaneMeshSize,
  lithophanePanelCount,
  lithophaneShapeHasBase,
  normalizeLithophaneParams,
  type LithophaneBrightnessGrid,
  type LithophaneParams,
} from "../lib/constructor/params";
import { calculateGeometryWeightGrams } from "../lib/constructor/geometry-volume";
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
 * Края стойки-седла по глубине, мм: задний и передний Z её низа.
 *
 * Стойка стоит под скобой, а в держателе арки их две: луч снаружи упёрся бы в
 * чужую. Поэтому края ищутся по вершинам в окне своей стойки — у самого низа, за
 * штангой и над ней, где проходят только стенки седла. За габарит стойки по Z
 * ничего не выходит, так что самые дальние вершины окна и есть её торцы.
 */
function postDepthEdges(
  geometry: BufferGeometry,
  light: LithophaneClampKind,
  axisZ: number,
): { rear: number; front: number } {
  const clamp = LITHOPHANE_LAMP_CLAMP;
  const half = clampPostWidth(light) / 2;
  const position = geometry.getAttribute("position");
  let rear = Number.POSITIVE_INFINITY;
  let front = Number.NEGATIVE_INFINITY;

  for (let id = 0; id < position.count; id += 1) {
    const x = Math.abs(position.getX(id));
    const y = position.getY(id);
    const z = position.getZ(id);

    if (x < clamp.beamWidth / 2 + 1 || x > half + 0.5) {
      continue;
    }

    if (y > clamp.beamHeight || Math.abs(z - axisZ) > clamp.postDepth / 2) {
      continue;
    }

    rear = Math.min(rear, z);
    front = Math.max(front, z);
  }

  return {
    rear: Number.isFinite(rear) ? rear : Number.NaN,
    front: Number.isFinite(front) ? front : Number.NaN,
  };
}

/**
 * Замеры открытой скобы, мм.
 *
 * Скоба — тело вращения с вырезанным сверху сектором, её ось горизонтальна и
 * смотрит в панель; `axisY` и `axisZ` задают ось так же, как при постройке тела.
 * Лучи разведены так, чтобы отделить гнездо от стенки: изнутри гнезда луч
 * упирается в его стенку, снаружи — в наружную, а сверху он входит в проём и
 * останавливается на дне гнезда. Если бы проёма не было, луч сверху остановился
 * бы на внешней стенке скобы.
 *
 * Заднюю и переднюю кромки стойки луч не поймает: они утоплены в седло и в тело
 * базы, — их ищет `postDepthEdges` по вершинам.
 */
function clampProbe(
  geometry: BufferGeometry,
  light: LithophaneClampKind,
  axisY: number,
  axisZ: number,
): {
  axisY: number;
  axisZ: number;
  boreRadius: number;
  outerRadius: number;
  cradle: number;
  postRear: number;
  postFront: number;
} {
  const inside = firstHit(geometry, [0, axisY, axisZ], [-1, 0, 0]);
  const outside = firstHit(geometry, [40, axisY, axisZ], [-1, 0, 0]);
  const above = firstHit(geometry, [0, 200, axisZ], [0, -1, 0]);
  const depth = postDepthEdges(geometry, light, axisZ);

  return {
    axisY,
    axisZ,
    boreRadius: -(inside?.x ?? Number.NaN),
    outerRadius: outside?.x ?? Number.NaN,
    cradle: above?.y ?? Number.NaN,
    postRear: depth.rear,
    postFront: depth.front,
  };
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
 * Сколько граней выше `fromY` смотрят вниз круче 45° и висят в воздухе.
 *
 * Это проверка печати без поддержек: вертикальная стенка (нормаль
 * горизонтальная) и наклон до 45° печатаются сами, а поверхность, которая
 * смотрит вниз круче, провисает. Считаются только треугольники целиком выше
 * `fromY` — низ базы и её паз лежат на столе и поддержек не требуют.
 *
 * Деталь собрана из перекрывающихся тел, а не из булевой суммы: низ скобы утоплен
 * в стойку, и в сетке остались грани, которые смотрят вниз, но лежат внутри
 * сплошного пластика. Поэтому из-под каждой нависающей грани пускается луч вниз:
 * если он во что-то попал раньше стола, грань печатается на этом теле, а не в
 * воздухе. У настоящего нависания под ним пусто до самого стола.
 *
 * Грань считается опёртой при любом попадании, с какой бы стороны она ни смотрела:
 * гнездо скобы входит в седло на нахлёст, и луч из утопленной грани выходит через
 * дно того же тела — обратной стороной. Для стола важна не ориентация грани, а
 * есть ли под ней пластик (тот же приём в `.fonttmp/overhang.ts`).
 */
function downwardFaces(geometry: BufferGeometry, fromY: number): number {
  const mesh = new Mesh(
    geometry,
    new MeshBasicMaterial({ side: DoubleSide }),
  );
  const index = geometry.getIndex();
  const position = geometry.getAttribute("position");
  const triangles = (index?.count ?? position.count) / 3;
  const corners = [0, 1, 2].map(() => new Vector3());
  let count = 0;

  for (let triangle = 0; triangle < triangles; triangle += 1) {
    for (let corner = 0; corner < 3; corner += 1) {
      const id = index ? index.getX(triangle * 3 + corner) : triangle * 3 + corner;

      corners[corner].set(
        position.getX(id),
        position.getY(id),
        position.getZ(id),
      );
    }

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
    if (normal.normalize().y > -Math.SQRT1_2) {
      continue;
    }

    const origin = new Vector3()
      .addVectors(corners[0], corners[1])
      .add(corners[2])
      .divideScalar(3)
      .addScaledVector(normal, -0.05);
    // Луч идёт от грани до стола: попадание в тело ниже — это опора.
    const under = new Raycaster(origin, new Vector3(0, -1, 0), 0, origin.y);

    if (under.intersectObject(mesh, false).length === 0) {
      count += 1;
    }
  }

  return count;
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

console.log(
  "\n14. USB-лампа: открытая скоба с двумя гнёздами вместо стойки с чашей",
);

{
  /*
    Владелец попросил убрать громоздкую стойку с чашей и каналом под штекер:
    вместо неё за панелью стоит открытая скоба, в которую ножка USB-лампы входит с
    натягом 0.2 мм. Гнездо проходит насквозь, сверху вырезан сектор 150°, поэтому
    стенки скобы пружинят, а деталь печатается без поддержек. Гнёзд в держателе
    два: ближнее повторяет компактный референс, дальнее отодвигает лампу — так
    свет ложится ровно.

    Проверяется не только диаметр гнезда, но и то, что скоба стоит на стойке:
    полоса касания кольца — единственная её опора, и если она выходит за стойку,
    печать начинает её в воздухе.
  */
  const params: Partial<LithophaneParams> = {
    lithophaneWidth: 120,
    lithophaneHeight: 80,
    lithoFrame: true,
    lithoMount: "arch",
    lithoLightSource: "usb_bulb",
    lithoLightSeat: "near",
  };
  const shape = LITHOPHANE_ARCH_STAND;
  const clamp = LITHOPHANE_LAMP_CLAMP;
  const boreRadius = clamp.usbBore / 2;
  const outerRadius = boreRadius + clamp.wall;
  // Дуга скобы собрана из отрезков: хорда короче радиуса на 0.09 %, у патрона это
  // 0.04 мм. Отсюда допуск замеров — гнездо проверяется только сверху.
  const facetToleranceMm = 0.1;
  const near = createLithophaneStandGeometry(params);
  const far = createLithophaneStandGeometry({
    ...params,
    lithoLightSeat: "far",
  });
  const bare = createLithophaneStandGeometry({
    ...params,
    lithoLightSource: "none",
  });
  const nearClamp = clampProbe(
    near,
    "usb_bulb",
    clamp.axisY,
    -clamp.usbAxis.near,
  );
  const farClamp = clampProbe(far, "usb_bulb", clamp.axisY, -clamp.usbAxis.far);
  const nearBulb = lithophaneClampBulb("usb_bulb", "near");
  const farBulb = lithophaneClampBulb("usb_bulb", "far");
  const tilt = (LITHOPHANE_STAND_TILT_DEG * Math.PI) / 180;
  // Колба USB-лампы — Ø20–28 мм, берём большую: зазор до панели в худшем случае.
  const bulbRadius = 14;
  const planeAtBulb = (y: number) => -(y - shape.baseTop) * Math.tan(tilt);
  const size = boxSize(far);
  const beam = firstHit(
    far,
    [0, 200, -(clamp.usbAxis.near + clamp.usbAxis.far) / 2],
    [0, -1, 0],
  );
  const beamRear = firstHit(far, [0, clamp.beamHeight / 2, -400], [0, 0, 1]);
  const holderWeight =
    calculateGeometryWeightGrams(far) - calculateGeometryWeightGrams(bare);

  check(
    "usb: скоба замкнута, вершин без координат нет",
    [openEdges(near) + openEdges(far), nanVertices(near) + nanVertices(far)],
    [0, 0],
  );
  checkRange(
    "usb: гнездо Ø13.4 мм в обоих гнёздах",
    [nearClamp.boreRadius * 2, farClamp.boreRadius * 2],
    clamp.usbBore - facetToleranceMm,
    clamp.usbBore,
  );
  checkRange(
    "usb: стенка скобы 2 мм",
    [
      nearClamp.outerRadius - nearClamp.boreRadius,
      farClamp.outerRadius - farClamp.boreRadius,
    ],
    clamp.wall - facetToleranceMm,
    clamp.wall + facetToleranceMm,
  );
  checkRange(
    "usb: скоба лежит дном гнезда на стойке",
    [nearClamp.cradle, farClamp.cradle],
    clamp.axisY - boreRadius - facetToleranceMm,
    clamp.axisY - boreRadius,
  );
  check(
    "usb: два гнезда — ближнее и дальнее",
    [nearClamp.axisZ, farClamp.axisZ],
    [-clamp.usbAxis.near, -clamp.usbAxis.far],
  );
  checkRange(
    "usb: дальнее гнездо отодвигает лампу",
    [clamp.usbAxis.far - clamp.usbAxis.near],
    40,
    70,
  );
  checkRange(
    "usb: стойка стоит по центру скобы",
    [
      nearClamp.postRear - (nearClamp.axisZ - clamp.postDepth / 2),
      nearClamp.postFront - (nearClamp.axisZ + clamp.postDepth / 2),
      farClamp.postRear - (farClamp.axisZ - clamp.postDepth / 2),
      farClamp.postFront - (farClamp.axisZ + clamp.postDepth / 2),
    ],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );
  // Полоса касания кольца — тангенс: 2·√((r + стенка)² − r²) по X и длина скобы
  // по Z. Она должна целиком стоять на стойке.
  check(
    "usb: плоская полоса скобы целиком стоит на стойке",
    [
      2 * Math.sqrt(outerRadius ** 2 - boreRadius ** 2) <= clampPostWidth("usb_bulb"),
      clamp.length <= clamp.postDepth,
    ],
    [true, true],
  );
  checkRange(
    "usb: штанга на столе держит оба гнезда",
    [beam?.y ?? Number.NaN],
    clamp.beamHeight - TOLERANCE_MM,
    clamp.beamHeight + TOLERANCE_MM,
  );
  checkRange(
    "usb: штанга доходит за дальнее гнездо",
    [-(beamRear?.z ?? Number.NaN)],
    clamp.usbAxis.far + clamp.length / 2,
    clamp.usbAxis.far + clamp.length / 2 + 8,
  );
  check(
    "usb: лампа висит на вылете из гнезда и смотрит в панель",
    [nearBulb[1], nearBulb[2] - nearClamp.axisZ],
    [clamp.axisY, clamp.usbBulbReach],
  );
  check(
    "usb: колба не задевает наклонную панель",
    [
      nearBulb[2] + bulbRadius < planeAtBulb(nearBulb[1]) - 1,
      farBulb[2] + bulbRadius < planeAtBulb(farBulb[1]) - 1,
    ],
    [true, true],
  );
  checkRange(
    "usb: держатель с двумя скобами по весу",
    [holderWeight],
    30,
    65,
  );
  checkRange("usb: деталь компактная по глубине", [size.z], 120, 150);
  check(
    "usb: печать без поддержек",
    downwardFaces(far, shape.baseTop + 0.5),
    0,
  );

  console.log(
    `  вес держателя ${holderWeight.toFixed(1)} г, габарит ` +
      `${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} мм`,
  );

  near.dispose();
  far.dispose();
  bare.dispose();
}

console.log(
  "\n15. Патрон E27: скоба Ø40 под натяг, два гнезда и зазор под колбу",
);

{
  /*
    Патрон E27 — Ø40 мм, поэтому скоба вокруг него крупная, но всё равно открытая:
    кольцо с проёмом 150° сверху, стенка 2 мм, гнездо проходит насквозь. Колба A60
    выходит из гнезда на 30 мм вперёд, поэтому ближнее гнездо держит патрон почти у
    панели — как на референсе, — а дальнее отодвигает его на 120 мм: с такого
    расстояния пик освещённости падает с ×6 до ×1.4, и карта света зеленеет.

    Проверяется и то, что колба не задевает литофан: панель наклонена на 12°, её
    плоскость на высоте гнезда уходит назад, и зазор считается до плоскости, а не
    до координаты Z.
  */
  const params: Partial<LithophaneParams> = {
    lithophaneWidth: 120,
    lithophaneHeight: 80,
    lithoFrame: true,
    lithoMount: "arch",
    lithoLightSource: "socket",
    lithoLightSeat: "near",
  };
  const shape = LITHOPHANE_ARCH_STAND;
  const clamp = LITHOPHANE_LAMP_CLAMP;
  const boreRadius = clamp.socketBore / 2;
  const outerRadius = boreRadius + clamp.wall;
  const facetToleranceMm = 0.1;
  const near = createLithophaneStandGeometry(params);
  const far = createLithophaneStandGeometry({
    ...params,
    lithoLightSeat: "far",
  });
  const bare = createLithophaneStandGeometry({
    ...params,
    lithoLightSource: "none",
  });
  const nearClamp = clampProbe(
    near,
    "socket",
    clamp.axisY,
    -clamp.socketAxis.near,
  );
  const farClamp = clampProbe(
    far,
    "socket",
    clamp.axisY,
    -clamp.socketAxis.far,
  );
  const nearBulb = lithophaneClampBulb("socket", "near");
  const farBulb = lithophaneClampBulb("socket", "far");
  const tilt = (LITHOPHANE_STAND_TILT_DEG * Math.PI) / 180;
  const bulbRadius = clamp.socketBulbDiameter / 2;
  const planeAtBulb = (y: number) => -(y - shape.baseTop) * Math.tan(tilt);
  const size = boxSize(far);
  const holderWeight =
    calculateGeometryWeightGrams(far) - calculateGeometryWeightGrams(bare);

  check(
    "патрон: скоба замкнута, вершин без координат нет",
    [openEdges(near) + openEdges(far), nanVertices(near) + nanVertices(far)],
    [0, 0],
  );
  checkRange(
    "патрон: гнездо Ø39.8 мм — натяг 0.2 мм",
    [nearClamp.boreRadius * 2, farClamp.boreRadius * 2],
    clamp.socketBore - facetToleranceMm,
    clamp.socketBore,
  );
  checkRange(
    "патрон: стенка скобы 2 мм",
    [
      nearClamp.outerRadius - nearClamp.boreRadius,
      farClamp.outerRadius - farClamp.boreRadius,
    ],
    clamp.wall - facetToleranceMm,
    clamp.wall + facetToleranceMm,
  );
  checkRange(
    "патрон: скоба лежит дном гнезда на стойке",
    [nearClamp.cradle, farClamp.cradle],
    clamp.axisY - boreRadius - facetToleranceMm,
    clamp.axisY - boreRadius,
  );
  check(
    "патрон: два гнезда — ближнее и дальнее",
    [nearClamp.axisZ, farClamp.axisZ],
    [-clamp.socketAxis.near, -clamp.socketAxis.far],
  );
  checkRange(
    "патрон: дальнее гнездо ставит лампу в 90–120 мм от панели",
    [clamp.socketAxis.far],
    90,
    120,
  );
  checkRange(
    "патрон: стойка стоит по центру скобы",
    [
      nearClamp.postRear - (nearClamp.axisZ - clamp.postDepth / 2),
      nearClamp.postFront - (nearClamp.axisZ + clamp.postDepth / 2),
      farClamp.postRear - (farClamp.axisZ - clamp.postDepth / 2),
      farClamp.postFront - (farClamp.axisZ + clamp.postDepth / 2),
    ],
    -TOLERANCE_MM,
    TOLERANCE_MM,
  );
  check(
    "патрон: плоская полоса скобы целиком стоит на стойке",
    [
      2 * Math.sqrt(outerRadius ** 2 - boreRadius ** 2) <= clampPostWidth("socket"),
      clamp.length <= clamp.postDepth,
    ],
    [true, true],
  );
  check(
    "патрон: лампа висит на вылете из гнезда и смотрит в панель",
    [nearBulb[1], nearBulb[2] - nearClamp.axisZ],
    [clamp.axisY, clamp.socketBulbReach],
  );
  check(
    "патрон: колба не задевает наклонную панель",
    [
      nearBulb[2] + bulbRadius < planeAtBulb(nearBulb[1]) - 1,
      farBulb[2] + bulbRadius < planeAtBulb(farBulb[1]) - 1,
    ],
    [true, true],
  );
  // Седло патрона шире, чем у USB-лампы: кольцо Ø43.8 нависает на 32 мм, и
  // стойка повторяет эту дугу целиком, поэтому деталь тяжелее.
  checkRange(
    "патрон: держатель с двумя скобами по весу",
    [holderWeight],
    30,
    75,
  );
  checkRange("патрон: деталь компактная по глубине", [size.z], 130, 160);
  check(
    "патрон: печать без поддержек",
    downwardFaces(far, shape.baseTop + 0.5),
    0,
  );

  console.log(
    `  вес держателя ${holderWeight.toFixed(1)} г, габарит ` +
      `${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} мм`,
  );

  near.dispose();
  far.dispose();
  bare.dispose();
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

console.log("\n17. Круглый плафон: кольцо изогнутых панелей без базы");

{
  /*
    Круглый плафон — полый цилиндр, стенки которого собраны из двух-четырёх
    изогнутых панелей. Панель рождается сразу на цилиндре радиуса «диаметр / 2 −
    максимальная толщина»: бортик печатается на максимальной толщине и доходит
    ровно до заданного диаметра, а лицо фото остаётся чуть глубже. Ширина панели
    равна дуге её сектора плюс перехлёст на стыке, поэтому кольцо замкнуто без
    совпадающих плоскостей.

    Проверяется то, чего не видно на предпросмотре: панели стоят на цилиндре (тыл
    на радиусе, лицо — на наружном диаметре), камера внутри пустая, оболочки
    замкнуты, габарит равен диаметру, а число групп материалов совпадает с числом
    панелей — у каждой панели свой кадр.
  */
  const diameter = 120;
  const height = 80;
  const maxThickness = 3;
  const panels = 4;
  const params = normalizeLithophaneParams({
    lithophaneWidth: diameter,
    lithophaneHeight: height,
    lithophaneMaxThickness: maxThickness,
    lithoShape: "round",
    lithophanePanels: panels,
  });
  const radius = diameter / 2 - maxThickness;
  const plate = lithophanePlateSize(params);
  const geometry = createLithophaneGeometry(params);
  const size = boxSize(geometry);
  const mesh = lithophaneMeshSize(
    plate.width,
    plate.height,
    lithophaneMeshOptions("round", panels),
  );
  const position = geometry.getAttribute("position");
  let minRadial = Number.POSITIVE_INFINITY;
  let maxRadial = Number.NEGATIVE_INFINITY;

  for (let vertex = 0; vertex < position.count; vertex += 1) {
    const radial = Math.hypot(position.getX(vertex), position.getZ(vertex));

    minRadial = Math.min(minRadial, radial);
    maxRadial = Math.max(maxRadial, radial);
  }

  // Луч из пустой камеры наружу: на пути две стенки одной панели — тыл и лицо.
  // Высота выбрана между рядами сетки: луч через центр веера попал бы в вершину,
  // где сходятся десятки треугольников.
  const object = new Mesh(
    geometry,
    new MeshBasicMaterial({ side: DoubleSide }),
  );
  const across = new Raycaster(
    new Vector3(0, height * 0.37, 0),
    new Vector3(1, 0, 0),
    0,
    diameter * 2,
  ).intersectObject(object, false);
  const half = createLithophaneGeometry(
    normalizeLithophaneParams({ ...params, lithophanePanels: 2 }),
  );
  const halfSize = boxSize(half);
  const weight = calculateGeometryWeightGrams(geometry);

  console.log(
    `  плафон Ø${diameter} × ${height}: панель ${plate.width.toFixed(2)} × ${plate.height.toFixed(2)} мм, ` +
      `кольцо ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} мм, ` +
      `вес ${weight.toFixed(1)} г`,
  );

  check(
    "плафон: плита — дуга сектора с перехлёстом",
    [
      Math.abs(
        plate.width -
          ((2 * Math.PI * radius) / panels + LITHOPHANE_ROUND.seamOverlapMm),
      ) < 1e-6,
      plate.height,
    ],
    [true, height],
  );
  check(
    "плафон: бюджет делит сетку на панели",
    [
      lithophaneMeshOptions("round", 3).copies,
      lithophaneMeshOptions("round", 3).fanStep > 0,
      mesh !== null,
    ],
    [3, true, true],
  );
  check(
    "плафон: число панелей из параметров",
    [
      lithophanePanelCount({ lithoShape: "round", lithophanePanels: 3 }),
      lithophanePanelCount({ lithoShape: "kaleidoscope", lithophanePanels: 3 }),
    ],
    [3, 4],
  );
  checkRange(
    "плафон: габарит равен наружному диаметру",
    [size.x, size.z],
    diameter - 0.05,
    diameter + 0.05,
  );
  checkRange(
    "плафон: высота панелей",
    [size.y],
    height - TOLERANCE_MM,
    height + TOLERANCE_MM,
  );
  checkRange(
    "плафон: тыл панели лежит на радиусе",
    [minRadial],
    radius - TOLERANCE_MM,
    radius + TOLERANCE_MM,
  );
  checkRange(
    "плафон: лицо доходит до наружного радиуса",
    [maxRadial],
    diameter / 2 - TOLERANCE_MM,
    diameter / 2 + TOLERANCE_MM,
  );
  check(
    "плафон: оболочки панелей замкнуты",
    [openEdges(geometry), nanVertices(geometry)],
    [0, 0],
  );
  check(
    "плафон: у каждой панели своя группа материалов",
    [geometry.groups.length, panels],
    [panels, 4],
  );
  check(
    "плафон: камера пустая — луч из оси встречает только две стенки",
    [
      across.length,
      Math.abs((across[0]?.distance ?? 0) - radius) < 0.05,
      (across[1]?.distance ?? 0) > radius + 0.5,
    ],
    [2, true, true],
  );
  check(
    "плафон: две панели тоже дают замкнутое кольцо",
    [half.groups.length, openEdges(half), nanVertices(half)],
    [2, 0, 0],
  );
  checkRange(
    "плафон: кольцо из двух панелей того же диаметра",
    [halfSize.x, halfSize.z],
    diameter - 0.05,
    diameter + 0.05,
  );
  check(
    "плафон: деталь «рамка» не нужна — отдаются панели",
    createLithophaneGeometry(params, "frame").groups.length,
    panels,
  );
  checkRange("плафон: вес кольца из четырёх панелей", [weight], 30, 120);
}


console.log("\n18. Калейдоскоп: четыре панели без рамок, полый цоколь и крышка");

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
    "калейдоскоп: база есть только у призмы",
    [
      lithophaneShapeHasBase("flat"),
      lithophaneShapeHasBase("round"),
      lithophaneShapeHasBase("kaleidoscope"),
    ],
    [false, false, true],
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

console.log("\n19. Свет: где стоят лампы и как ложится свет");

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
  const roundPlan = lithophaneLightPlan({
    lithoShape: "round",
    lithoLightSource: "strip",
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
  /*
    Скоба держит лампу в одном из двух гнёзд, и по умолчанию выбрано дальнее:
    в ближнем E27 светит с 78 мм и пересвечивает центр, а с 120 мм пик падает до
    ×1.4 и карта зеленеет. Поэтому план по умолчанию — это дальнее гнездо, а
    ближнее проверяется отдельно: оно обязано остаться «слишком близко».
  */
  const farSocket = lithophaneClampBulb("socket", "far");
  const farBulb = lithophaneClampBulb("usb_bulb", "far");
  const nearSocket = lithophaneLightPlan({
    lithoMount: "arch",
    lithoLightSource: "socket",
    lithoLightSeat: "near",
  });
  const nearBulb = lithophaneLightPlan({
    lithoMount: "arch",
    lithoLightSource: "usb_bulb",
    lithoLightSeat: "near",
  });

  check(
    "свет: лампа в скобе — одна точка в дальнем гнезде",
    [
      socket?.kind,
      socket?.emitters.length,
      socket?.emitters[0].position.map((value) => Math.round(value)),
    ],
    ["socket", 1, farSocket.map((value) => Math.round(value))],
  );
  check(
    "свет: колба USB стоит в дальнем гнезде скобы",
    [bulb?.emitters[0].position[1], bulb?.emitters[0].position[2]],
    [farBulb[1], farBulb[2]],
  );
  check(
    "свет: в ближнем гнезде лампа стоит ближе к панели",
    [
      nearSocket!.emitters[0].position[2] > farSocket[2],
      nearBulb!.emitters[0].position[2] > farBulb[2],
    ],
    [true, true],
  );

  /*
    Наклонный канал ставит ленту выше низа панели и в 54 мм от неё: по высоте она
    ровнее колбы, а ровность здесь — близость к единице, а не «верх светлее низа».
    У лампы в скобе источник стоит на середине панели, и наклонный тыл ловит её
    свет снизу: верх выходит светлее низа, то есть от единицы она уходит дальше —
    и у ножки USB-лампы, и у патрона E27.
  */
  check(
    "свет: наклонный канал ровнее лампы в скобе",
    [
      Math.abs(Math.log(strip!.topShare)) < Math.abs(Math.log(bulb!.topShare)),
      Math.abs(Math.log(strip!.topShare)) < Math.abs(Math.log(socket!.topShare)),
    ],
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
    "свет: дальнее гнездо E27 светит ровнее ближнего и без пересвета",
    [
      socket!.peakRatio < nearSocket!.peakRatio,
      socket!.peakRatio < LITHO_LIGHT_MODEL.overexposure,
    ],
    [true, true],
  );
  /*
    Ближнее гнездо стоит ближе рекомендованного, и пятно это подтверждает: пик
    ярче средней больше порога пересвета. Паз под лист напечатан, поэтому расчёт не
    пугает пятном, а советует лист — и не дублирует совет предупреждением
    `too_close`.
  */
  check(
    "свет: в ближнем гнезде лампа ближе рекомендованного — расчёт советует лист",
    [
      nearSocket!.actualDistance < nearSocket!.recommendedDistance,
      nearSocket?.warnings.some((item) => item.id === "diffuser"),
      nearBulb?.warnings.some((item) => item.id === "diffuser"),
      nearSocket?.warnings.every((item) => item.id !== "too_close"),
    ],
    [true, true, true, true],
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
    У круглого плафона расчёта нет: это абажур без своей базы, лампу в него
    ставят отдельно. Форм `curved` и `cylinder` в конструкторе больше нет.
  */
  check("свет: у круглого плафона источника в сборке нет", roundPlan, null);
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
  // Паз под лист напечатан только в базе арки: лист кроится по панели и
  // закрывает весь путь света.
  const wideBulbSheet = lithophaneLightPlan({
    lithoMount: "arch",
    lithoLightSource: "usb_bulb",
    lithoDiffuser: true,
    ...wide,
  })!;
  // У призмы калейдоскопа паза нет: свет горит в камере за четырьмя плитами.
  const prismSheet = lithophaneLightPlan({
    lithoShape: "kaleidoscope",
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
    ],
    [true, true],
  );
  /*
    Лист не добавляет свет, а перераспределяет его: средняя падает не только на
    пропускание матового акрила (0.85), но и на то, что часть рассеянного уходит за
    кромки панели — при веере 70° и зазоре 12 мм это ещё около 7 %. Нижняя граница
    0.75 и есть эти два множителя вместе.
  */
  check(
    "свет: лист не добавляет свет — средняя падает на пропускание",
    [
      wideSheet.average < wideStrip.average,
      wideSheet.average > wideStrip.average * 0.75,
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
    "свет: лист стоит в базе на одном расстоянии от панели",
    [(wideSheet.diffuser?.gap ?? 0) > 10],
    [true],
  );
  checkRange(
    "свет: низ листа — дно паза, верх — на высоту панели",
    [
      (wideSheet.diffuser?.top ?? Number.NaN) -
        (wideSheet.diffuser?.bottom ?? Number.NaN),
    ],
    wide.lithophaneHeight,
    wide.lithophaneHeight,
  );
  check(
    "свет: паз под лист есть у арки, у призмы света в камере нет",
    [
      wideSheet.diffuserSupported,
      wideBulbSheet.diffuserSupported,
      (wideBulbSheet.diffuser?.gap ?? 0) > 0,
      prismSheet.diffuserSupported,
      prismSheet.diffuser,
    ],
    [true, true, true, false, null],
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

console.log(
  `\n20. Монорельс: шина ${LITHOPHANE_RAIL.width} × 5 на столе, плоское кольцо Ø${2 * LITHOPHANE_CARRIAGE.ringRadius} × ${LITHOPHANE_CARRIAGE.ringDepth} и козырёк`,
);

{
  /*
    Рельс — узкая шина 14 × 5 мм по центру нижней кромки тыла плоской рамки: она
    лежит на столе (Y = 0) и нахлёстом входит в тыл нижней полки рамки, поэтому
    растёт из рамки одной деталью. Назад шина уходит на 100 мм и несёт продольный
    паз 6 × 2 мм: полки паза поднимаются до верха 5 мм, а между ними остаётся
    канал с дном на 3 мм, открытый сверху и с торцов.

    Проверяется то, чего не видно на предпросмотре: верх шины, дно канала, ширина
    паза и шины, выступ назад и то, что рельс печатается вместе с рамкой. Луч
    идёт сверху вниз: замер говорит, на какой высоте начинается пластик, а NaN —
    что под точкой его нет.
  */
  const width = 120;
  const height = 80;
  const rail = LITHOPHANE_RAIL;
  const railParams: Partial<LithophaneParams> = {
    lithophaneWidth: width,
    lithophaneHeight: height,
    lithoFrame: true,
    lithoMount: "rail",
  };
  const metrics = lithophaneRailMetrics();
  const slotHalf = rail.slotWidth / 2;
  // Проба полки — между стенкой паза и кромкой шины.
  const shelfProbe = (metrics.half + slotHalf) / 2;
  const frame = createLithophaneFrameGeometry(railParams);
  const plainFrame = createLithophaneFrameGeometry({
    ...railParams,
    lithoMount: "none",
  });
  const frameSize = boxSize(frame);
  const plainSize = boxSize(plainFrame);
  const frameBack = frame.boundingBox?.min.z ?? 0;
  const plainBack = plainFrame.boundingBox?.min.z ?? 0;
  const frameObject = new Mesh(
    frame,
    new MeshBasicMaterial({ side: DoubleSide }),
  );
  // Первое попадание луча сверху вниз: NaN — под точкой пластика нет.
  const frameHitY = (x: number, z: number): number => {
    const hits = new Raycaster(
      new Vector3(x, height + 20, z),
      new Vector3(0, -1, 0),
      0,
      200,
    ).intersectObject(frameObject, false);

    return hits.length === 0 ? Number.NaN : hits[0].point.y;
  };

  checkRange(
    `рельс: шина ${rail.width} мм шириной, верх на ${rail.thickness} мм`,
    [frameHitY(shelfProbe, -20), frameHitY(-shelfProbe, -20)],
    rail.thickness - TOLERANCE_MM,
    rail.thickness + TOLERANCE_MM,
  );
  check(
    "рельс: за кромкой шины пластика нет",
    Number.isNaN(frameHitY(metrics.half + 0.1, -20)),
    true,
  );
  checkRange(
    "рельс: дно канала на 3 мм",
    [frameHitY(0, -20), frameHitY(slotHalf - 0.1, -20)],
    metrics.floor - TOLERANCE_MM,
    metrics.floor + TOLERANCE_MM,
  );
  checkRange(
    "рельс: паз 6 мм шириной, полки до верха шины",
    [frameHitY(slotHalf + 0.1, -20)],
    rail.thickness - TOLERANCE_MM,
    rail.thickness + TOLERANCE_MM,
  );
  checkRange(
    "рельс: канал открыт с торца, дно доходит до тыла шины",
    [frameHitY(0, -rail.depth + 0.1)],
    metrics.floor - TOLERANCE_MM,
    metrics.floor + TOLERANCE_MM,
  );
  check(
    "рельс: за тылом шины пластика нет",
    Number.isNaN(frameHitY(0, -rail.depth - 0.1)),
    true,
  );
  checkRange(
    "рельс: шина доходит до тыла рамки",
    [frameHitY(shelfProbe, -0.1)],
    rail.thickness - TOLERANCE_MM,
    rail.thickness + TOLERANCE_MM,
  );
  check(
    "рельс: габарит панели не меняется",
    [frameSize.x, frameSize.y],
    [plainSize.x, plainSize.y],
  );
  checkRange(
    `рельс: шина уходит назад на ${rail.depth} мм`,
    [plainBack - frameBack],
    rail.depth - TOLERANCE_MM,
    rail.depth + TOLERANCE_MM,
  );
  check(
    "рельс: печатается вместе с рамкой одной деталью",
    frame.getAttribute("position").count >
      plainFrame.getAttribute("position").count,
    true,
  );

  frame.dispose();
  plainFrame.dispose();
}

{
  /*
    Держатель патрона — вторая печатная деталь: плоское кольцо Ø50 × 5 мм,
    полоз с пазом под шину и тонкий гнутый козырёк. Кольцо лежит плоскостью XY:
    лицо уходит от панели на lithoRailDistance, ось патрона проходит через центр
    на высоте 31 мм, поэтому верх кольца — 56 мм, а низ — 6 мм над столом.

    Патрон стандартный, с наружной резьбой и штатной гайкой: отверстие кольца
    равно резьбе (Ø14.6 у E14 и Ø28.6 у E27). С лица утоплена круглая зенковка
    под фланец патрона, с тыла — плоская площадка с шестигранным гнездом под
    гайку, чтобы она не проворачивалась; между дном зенковки и гнездом остаётся
    2 мм мяса. Никакого барабана и полости у детали нет.

    Снизу кольца — полоз 18 мм шириной с продольным пазом 14.4 × 5.2 мм: паз
    открыт снизу и с торцов, поэтому кольцо надевается на шину 14 × 5 сверху и
    едет по рельсу, а не по столу. Козырёк — пластина 2 мм поверх макушки
    кольца: выступает к панели на 20 мм и опускается к носу на 5 мм.

    Проверяются оба патрона: наружный Ø50 и толщина 5, сквозное отверстие под
    резьбу, зенковка под фланец, шестигранное гнездо под гайку и мясо между ними,
    полоз с пазом на столе, козырёк без окон с провисом носа, свободный коридор
    перед кольцом, вес деталей и замкнутость оболочки.
  */
  const rail = LITHOPHANE_RAIL;
  const carriage = LITHOPHANE_CARRIAGE;
  const railParams: Partial<LithophaneParams> = {
    lithophaneWidth: 120,
    lithophaneHeight: 80,
    lithoFrame: true,
    lithoMount: "rail",
  };
  const base = lithophaneCarriageMetrics(normalizeLithophaneParams(railParams));
  const skidHalf = base.skidWidth / 2;

  check(
    `кольцо: наружный Ø${2 * base.ringRadius} и толщина ${base.ringDepth} мм`,
    [2 * base.ringRadius, base.plateFront - base.plateBack],
    [2 * carriage.ringRadius, carriage.ringDepth],
  );
  check(
    `кольцо: ось патрона на ${carriage.axisY} мм, верх ${base.ringTop} и низ ${base.ringBottom}`,
    [base.socketY, base.ringTop, base.ringBottom],
    [
      carriage.axisY,
      carriage.axisY + carriage.ringRadius,
      carriage.axisY - carriage.ringRadius,
    ],
  );
  check(
    `кольцо: внутреннее отверстие равно резьбе Ø${base.thread}`,
    [2 * base.boreRadius],
    [LITHOPHANE_RAIL_SOCKET_SIZES.e14.thread],
  );
  check(
    `кольцо: зенковка Ø${2 * base.flangeRadius} шире отверстия на ${(base.flangeRadius - base.boreRadius).toFixed(1)} мм`,
    [
      base.flangeRadius > base.boreRadius,
      base.flangeDepth,
      base.plateFront - base.flangeDepth - (base.plateBack + base.nutDepth),
    ],
    [true, carriage.flangeDepth, 2],
  );
  check(
    `кольцо: шестигранное гнездо ${base.nut} мм под ключ на ${base.nutDepth} мм`,
    [base.nut, base.nutDepth, base.nutFlats],
    [
      LITHOPHANE_RAIL_SOCKET_SIZES.e14.nut,
      carriage.nutDepth,
      LITHOPHANE_RAIL_SOCKET_SIZES.e14.nut + 2 * carriage.nutClearance,
    ],
  );
  check(
    `полоз: паз ${base.skidPocketWidth} × ${base.skidPocketDepth} шире шины ${rail.width} × ${rail.thickness}`,
    [
      base.skidPocketWidth > rail.width,
      base.skidPocketDepth > rail.thickness,
      base.railGap,
    ],
    [true, true, carriage.railGap],
  );
  check(
    `полоз: верх ${base.skidTop} мм входит в кольцо с низом ${base.ringBottom} мм`,
    [base.skidTop > base.ringBottom, base.skidWidth],
    [true, carriage.skidWidth],
  );

  /*
    На обоих концах диапазона lithoRailDistance полоз остаётся на шине, а козырёк
    не доходит до панели: кольцо не соскакивает с рельса и не задевает рельеф.
    Заодно проверяется коридор перед кольцом: его глубина равна расстоянию до
    панели, и ни полоз, ни навес в него не заходят.
  */
  for (const distance of [
    CONSTRUCTOR_LIMITS.lithoRailDistance.min,
    CONSTRUCTOR_LIMITS.lithoRailDistance.max,
  ]) {
    const params: Partial<LithophaneParams> = {
      ...railParams,
      lithoRailDistance: distance,
    };
    const shifted = lithophaneCarriageMetrics(normalizeLithophaneParams(params));
    // Тыл полоза и его длина: на дальнем положении полоз короче остатка шины.
    const skidBack = shifted.plateFront - shifted.skidLength;
    const geometry = createLithophaneCarriageGeometry(params);
    const object = new Mesh(
      geometry,
      new MeshBasicMaterial({ side: DoubleSide }),
    );
    // Первое попадание луча спереди: NaN — перед лицом кольца пластика нет.
    const frontProbe = (x: number, y: number): number => {
      const hits = new Raycaster(
        new Vector3(x, y, distance + 40),
        new Vector3(0, 0, -1),
        0,
        distance + 100,
      ).intersectObject(object, false);

      return hits.length === 0 ? Number.NaN : hits[0].point.z;
    };
    const corridor: number[] = [];

    for (const x of [-12, 0, 12]) {
      // Высоты ниже носа навеса (visorBottom − провис): коридор патрона.
      for (const y of [4, 8, shifted.socketY - 10, shifted.socketY]) {
        corridor.push(frontProbe(x, y));
      }
    }

    check(
      `кольцо на ${distance} мм: полоз ${shifted.skidLength} мм не свисает с шины`,
      skidBack >= -rail.depth - TOLERANCE_MM,
      true,
    );
    check(
      `кольцо на ${distance} мм: козырёк не доходит до панели, зазор ${-shifted.visorFront} мм`,
      shifted.visorFront <= -carriage.panelClearance,
      true,
    );
    check(
      `кольцо на ${distance} мм: перед гнездом свободно ${-shifted.plateFront} мм`,
      corridor.every(
        (z) => Number.isNaN(z) || z <= shifted.plateFront + TOLERANCE_MM,
      ),
      true,
    );

    geometry.dispose();
  }
  for (const socketId of LITHOPHANE_RAIL_SOCKETS) {
    const socket = LITHOPHANE_RAIL_SOCKET_SIZES[socketId];
    const params: Partial<LithophaneParams> = {
      ...railParams,
      lithoRailSocket: socketId,
    };
    const metrics = lithophaneCarriageMetrics(
      normalizeLithophaneParams(params),
    );
    const geometry = createLithophaneCarriageGeometry(params);
    // Верх и низ детали: по ним видно, что кольцо стоит на полозе, а не висит.
    const size = boxSize(geometry);
    const bottom = geometry.boundingBox?.min.y ?? 0;
    const object = new Mesh(
      geometry,
      new MeshBasicMaterial({ side: DoubleSide }),
    );
    // Луч из-за кольца: `true` — пластика на пути нет, отверстие сквозное.
    const through = (x: number, y: number): boolean =>
      new Raycaster(
        new Vector3(x, y, -60),
        new Vector3(0, 0, 1),
        0,
        200,
      ).intersectObject(object, false).length === 0;
    // Первое попадание луча вдоль Z из точки `from`: NaN — луч прошёл мимо.
    const hitZ = (
      x: number,
      y: number,
      from: number,
      direction: 1 | -1,
    ): number => {
      const hits = new Raycaster(
        new Vector3(x, y, from),
        new Vector3(0, 0, direction),
        0,
        200,
      ).intersectObject(object, false);

      return hits.length === 0 ? Number.NaN : hits[0].point.z;
    };
    // Первое попадание луча вдоль Y: NaN — пластика нет.
    const hitY = (
      x: number,
      y: number,
      z: number,
      direction: 1 | -1,
    ): number => {
      const hits = new Raycaster(
        new Vector3(x, y, z),
        new Vector3(0, direction, 0),
        0,
        200,
      ).intersectObject(object, false);

      return hits.length === 0 ? Number.NaN : hits[0].point.y;
    };
    /*
      Отверстие патрона меряется изнутри кольца: луч выходит из оси в стенку и
      находит её на радиусе резьбы. Плоскость пробы — середина слоя с отверстием
      между зенковкой и гнездом, где снаружи ещё мясо кольца.
    */
    const hitX = (sign: 1 | -1, z: number): number => {
      const hits = new Raycaster(
        new Vector3(0, metrics.socketY, z),
        new Vector3(sign, 0, 0),
        0,
        2 * metrics.ringRadius,
      ).intersectObject(object, false);

      return hits.length === 0 ? Number.NaN : hits[0].point.x * sign;
    };
    const boreZ = metrics.plateFront - metrics.flangeDepth - 1;
    // Проба кольца — в мясе между гнездом и наружной дугой.
    const rimX = metrics.ringRadius - 1.5;


    check(
      `кольцо ${socketId}: Ø${(2 * metrics.ringRadius).toFixed(2)} снаружи`,
      [
        !through(metrics.ringRadius - 0.3, metrics.socketY),
        !through(-metrics.ringRadius + 0.3, metrics.socketY),
        through(metrics.ringRadius + 0.3, metrics.socketY),
        through(-metrics.ringRadius - 0.3, metrics.socketY),
      ],
      [true, true, true, true],
    );
    checkRange(
      `кольцо ${socketId}: габарит по X ${size.x.toFixed(2)} мм`,
      [size.x],
      2 * metrics.ringRadius - TOLERANCE_MM,
      2 * metrics.ringRadius + TOLERANCE_MM,
    );
    checkRange(
      `кольцо ${socketId}: полоз на столе`,
      [bottom],
      -TOLERANCE_MM,
      TOLERANCE_MM,
    );
    checkRange(
      `кольцо ${socketId}: верх ${size.y.toFixed(2)} мм — козырёк над кольцом`,
      [size.y],
      metrics.ringTop +
        metrics.visorThickness -
        BODY_OVERLAP_MM -
        TOLERANCE_MM,
      metrics.ringTop +
        metrics.visorThickness -
        BODY_OVERLAP_MM +
        TOLERANCE_MM,
    );
    checkRange(
      `кольцо ${socketId}: лицо в ${-metrics.plateFront} мм от панели`,
      [hitZ(rimX, metrics.socketY, 60, -1)],
      metrics.plateFront - TOLERANCE_MM,
      metrics.plateFront + TOLERANCE_MM,
    );
    checkRange(
      `кольцо ${socketId}: тыл на ${metrics.ringDepth} мм позади лица`,
      [hitZ(rimX, metrics.socketY, metrics.plateBack - 30, 1)],
      metrics.plateBack - TOLERANCE_MM,
      metrics.plateBack + TOLERANCE_MM,
    );
    checkRange(
      `кольцо ${socketId}: отверстие патрона Ø${socket.thread}`,
      // 24-гранник вписан в окружность резьбы: стенка ближе вершины на доли мм.
      [hitX(1, boreZ) * 2, hitX(-1, boreZ) * 2],
      socket.thread - 0.25,
      socket.thread + TOLERANCE_MM,
    );
    check(
      `кольцо ${socketId}: отверстие патрона сквозное`,
      through(0, metrics.socketY),
      true,
    );
    checkRange(
      `кольцо ${socketId}: ось на ${metrics.socketY} мм от стола`,
      [hitY(0, metrics.socketY, boreZ, 1) - socket.thread / 2],
      metrics.socketY - TOLERANCE_MM,
      metrics.socketY + TOLERANCE_MM,
    );

    checkRange(
      `кольцо ${socketId}: зенковка под фланец Ø${(2 * metrics.flangeRadius).toFixed(1)} мм`,
      [
        hitX(1, metrics.plateFront - 0.5) * 2,
        hitX(-1, metrics.plateFront - 0.5) * 2,
      ],
      2 * metrics.flangeRadius - 0.25,
      2 * metrics.flangeRadius + TOLERANCE_MM,
    );
    checkRange(
      `кольцо ${socketId}: зенковка утоплена на ${metrics.flangeDepth} мм`,
      [
        hitZ(
          (metrics.boreRadius + metrics.flangeRadius) / 2,
          metrics.socketY,
          60,
          -1,
        ),
      ],
      metrics.plateFront - metrics.flangeDepth - TOLERANCE_MM,
      metrics.plateFront - metrics.flangeDepth + TOLERANCE_MM,
    );
    checkRange(
      `кольцо ${socketId}: гнездо под гайку ${metrics.nut} мм утоплено на ${metrics.nutDepth} мм`,
      [
        hitZ(
          metrics.nutFlats / 2 - 1.5,
          metrics.socketY,
          metrics.plateBack - 30,
          1,
        ),
      ],
      metrics.plateBack + metrics.nutDepth - TOLERANCE_MM,
      metrics.plateBack + metrics.nutDepth + TOLERANCE_MM,
    );
    checkRange(
      `кольцо ${socketId}: гнездо ${metrics.nutFlats.toFixed(1)} мм под ключ`,
      [hitY(0, metrics.socketY, metrics.plateBack + 1, 1) - metrics.socketY],
      metrics.nutFlats / 2 - TOLERANCE_MM,
      metrics.nutFlats / 2 + TOLERANCE_MM,
    );
    checkRange(
      `кольцо ${socketId}: гнездо ${(2 * metrics.nutRadius).toFixed(1)} мм по вершинам`,
      [
        hitX(1, metrics.plateBack + 1) * 2,
        hitX(-1, metrics.plateBack + 1) * 2,
      ],
      2 * metrics.nutRadius - 0.25,
      2 * metrics.nutRadius + TOLERANCE_MM,
    );
    checkRange(
      `кольцо ${socketId}: мясо между зенковкой и гнездом 2 мм`,
      [
        metrics.plateFront -
          metrics.flangeDepth -
          (metrics.plateBack + metrics.nutDepth),
      ],
      2 - TOLERANCE_MM,
      2 + TOLERANCE_MM,
    );

    /*
      Полоз: две губки 18 мм общей шириной и мост над пазом. Паз шире шины на
      зазор с каждой стороны и открыт снизу — кольцо надевается на рельс сверху;
      губки стоят на столе, а мост над пазом держит кольцо.
    */
    checkRange(
      `кольцо ${socketId}: губка полоза до стола`,
      [hitY(skidHalf - 0.1, -20, metrics.plateFront - 12, 1)],
      -TOLERANCE_MM,
      TOLERANCE_MM,
    );
    checkRange(
      `кольцо ${socketId}: мост над пазом на ${metrics.skidPocketDepth.toFixed(1)} мм`,
      [hitY(0, -20, metrics.plateFront - 12, 1)],
      metrics.skidPocketDepth - TOLERANCE_MM,
      metrics.skidPocketDepth + TOLERANCE_MM,
    );
    check(
      `кольцо ${socketId}: паз открыт снизу и с торцов — шина проходит насквозь`,
      through(0, rail.thickness / 2),
      true,
    );
    check(
      `кольцо ${socketId}: за губкой полоза пластика нет`,
      Number.isNaN(hitY(skidHalf + 0.1, -20, metrics.plateFront - 12, 1)),
      true,
    );
    check(
      `кольцо ${socketId}: полоз ${metrics.skidWidth} мм шириной`,
      [
        !through(skidHalf - 0.1, 1),
        !through(-skidHalf + 0.1, 1),
        through(skidHalf + 0.1, 1),
        through(-skidHalf - 0.1, 1),
      ],
      [true, true, true, true],
    );
    checkRange(
      `кольцо ${socketId}: полоз не выходит вперёд лица`,
      [hitZ(skidHalf - 0.1, 1, 60, -1)],
      metrics.plateFront - BODY_OVERLAP_MM - TOLERANCE_MM,
      metrics.plateFront + TOLERANCE_MM,
    );
    checkRange(
      `кольцо ${socketId}: полоз ${metrics.skidLength} мм длиной`,
      [hitZ(skidHalf - 0.1, 1, metrics.plateBack - 40, 1)],
      metrics.plateFront - metrics.skidLength - TOLERANCE_MM,
      metrics.plateFront - metrics.skidLength + TOLERANCE_MM,
    );
    checkRange(
      `кольцо ${socketId}: паз ${metrics.skidPocketWidth} мм — шире шины на ${rail.clearance} мм на сторону`,
      [metrics.skidPocketWidth - rail.width],
      2 * rail.clearance - 0.01,
      2 * rail.clearance + 0.01,
    );
    checkRange(
      `кольцо ${socketId}: паз ${metrics.skidPocketDepth} мм — глубже верха шины на ${rail.clearance} мм`,
      [metrics.skidPocketDepth - rail.thickness],
      rail.clearance - 0.01,
      rail.clearance + 0.01,
    );

    /*
      Козырёк — гнутая пластина на макушке кольца: лежит на нём с нахлёстом,
      над резьбой идёт ровно, а к носу опускается на `visorDrop`. Окон в нём нет:
      луч снизу находит сплошную дугу в любой точке пролёта. Снизу и с боков
      патрон открыт, поэтому лампа вкручивается рукой.
    */
    const visorUnder = hitY(0, 0, metrics.plateFront + 5, 1);
    const visorOver = hitY(0, 60, metrics.plateFront + 5, -1);
    const noseTop = hitY(0, 60, metrics.visorFront - TOLERANCE_MM, -1);

    check(
      `кольцо ${socketId}: навес поднят выше резьбы на ${(visorUnder - metrics.socketY - socket.thread / 2).toFixed(1)} мм`,
      [visorUnder > metrics.socketY + socket.thread / 2],
      [true],
    );
    checkRange(
      `кольцо ${socketId}: навес лежит на кольце с нахлёстом`,
      [hitY(0, 60, metrics.plateFront - 1, -1)],
      metrics.ringTop +
        metrics.visorThickness -
        BODY_OVERLAP_MM -
        TOLERANCE_MM,
      metrics.ringTop +
        metrics.visorThickness -
        BODY_OVERLAP_MM +
        TOLERANCE_MM,
    );
    checkRange(
      `кольцо ${socketId}: навес ${metrics.visorThickness} мм толщиной`,
      [visorOver - visorUnder],
      metrics.visorThickness - TOLERANCE_MM,
      metrics.visorThickness + TOLERANCE_MM,
    );
    checkRange(
      `кольцо ${socketId}: нос навеса опущен на ${metrics.visorDrop} мм`,
      [noseTop],
      metrics.ringTop +
        metrics.visorThickness -
        BODY_OVERLAP_MM -
        metrics.visorDrop -
        TOLERANCE_MM,
      metrics.ringTop +
        metrics.visorThickness -
        BODY_OVERLAP_MM -
        metrics.visorDrop +
        TOLERANCE_MM,
    );
    checkRange(
      `кольцо ${socketId}: навес выступает к панели на ${metrics.visorFront - metrics.plateFront} мм`,
      // Луч идёт по середине носа: там дуга сплошная, без скругления в плане.
      [hitZ(0, noseTop - 1, 60, -1)],
      metrics.visorFront - TOLERANCE_MM,
      metrics.visorFront + TOLERANCE_MM,
    );
    check(
      `кольцо ${socketId}: навес сплошной — окон нет`,
      [
        !Number.isNaN(hitY(-12, 0, metrics.plateFront + 5, 1)),
        !Number.isNaN(hitY(12, 0, metrics.plateFront + 5, 1)),
      ],
      [true, true],
    );
    check(
      `кольцо ${socketId}: навес открыт с боков — лампа вкручивается`,
      [
        Number.isNaN(
          hitY(metrics.visorWidth / 2 + 1, 60, metrics.plateFront + 5, -1),
        ),
        Number.isNaN(
          hitY(-metrics.visorWidth / 2 - 1, 60, metrics.plateFront + 5, -1),
        ),
      ],
      [true, true],
    );
    check(
      `кольцо ${socketId}: оболочка замкнута, NaN нет`,
      [openEdges(geometry), nanVertices(geometry)],
      [0, 0],
    );
    /*
      Вес деталей: кольцо должно оставаться лёгким (до 20 г), а рамка с рельсом
      и кольцом вместе — до 45 г. Числа считаются по сплошному объёму сетки, как
      и подпись веса в интерфейсе.
    */
    const frame = createLithophaneGeometry(params, "frame");
    const carriageWeight = calculateGeometryWeightGrams(geometry);
    const assemblyWeight = carriageWeight + calculateGeometryWeightGrams(frame);

    checkRange(
      `кольцо ${socketId}: вес детали ${carriageWeight.toFixed(1)} г`,
      [carriageWeight],
      0,
      20,
    );
    checkRange(
      `кольцо ${socketId}: вес сборки с рамкой ${assemblyWeight.toFixed(1)} г`,
      [assemblyWeight],
      0,
      45,
    );

    frame.dispose();
    geometry.dispose();
  }


  /*
    Крепление читается только у плоской формы и только вместе с рамкой: у куба и
    круглого плафона панели собираются своим кодом, и монорельс туда не попадает.
    Отдельной деталью `carriage` отдаётся ровно та же сетка, что и из функции
    кольца, — по ней же считается вес и STL.
  */
  check(
    "рельс: только плоская панель с рамкой",
    [
      lithophaneHasRail("rail", "flat", true),
      lithophaneHasRail("rail", "round", true),
      lithophaneHasRail("rail", "kaleidoscope", true),
      lithophaneHasRail("rail", "flat", false),
      lithophaneHasRail("stand", "flat", true),
    ],
    [true, false, false, false, false],
  );

  for (const shape of ["round", "kaleidoscope"] as const) {
    const base: Partial<LithophaneParams> = { ...railParams, lithoShape: shape };
    const plain = createLithophaneGeometry({ ...base, lithoMount: "none" });
    const mounted = createLithophaneGeometry(base);

    check(
      `${shape}: монорельс не меняет деталь`,
      [boxSize(mounted), mounted.getAttribute("position").count],
      [boxSize(plain), plain.getAttribute("position").count],
    );

    plain.dispose();
    mounted.dispose();
  }

  const carriagePart = createLithophaneGeometry(
    { ...railParams, lithoRailSocket: "e27" },
    "carriage",
  );
  const carriageBody = createLithophaneCarriageGeometry({
    ...railParams,
    lithoRailSocket: "e27",
  });

  check(
    "кольцо: деталь `carriage` — та же сетка, что из функции кольца",
    [boxSize(carriagePart), carriagePart.getAttribute("position").count],
    [boxSize(carriageBody), carriageBody.getAttribute("position").count],
  );

  carriagePart.dispose();
  carriageBody.dispose();
}


console.log("");

if (failures > 0) {
  console.log(`Провалено проверок: ${failures}`);
  process.exitCode = 1;
} else {
  console.log("Все проверки прошли.");
}

