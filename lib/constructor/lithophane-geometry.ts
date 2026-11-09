import {
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  ShapeUtils,
  Vector2,
} from "three";
import {
  mergeGeometries,
  mergeVertices,
} from "three/examples/jsm/utils/BufferGeometryUtils.js";

import {
  LITHOPHANE_MESH_TOO_LARGE_MESSAGE,
  lithophaneHasStand,
  lithophaneMeshSize,
  normalizeLithophaneParams,
  type LithophaneMount,
  type LithophaneParams,
  type LithophanePart,
} from "@/lib/constructor/params";

/**
 * Геометрия литофана: рельеф, рамка с пазом и два съёмных крепления.
 *
 * Всё стоит в плоскости XY нижней кромкой на Y = 0, лицо смотрит в +Z; у
 * подставки база лежит на столе. Рельеф — heightfield по габаритам плиты: шаг
 * вершины считается из стандарта 0.3 мм (`lithophaneMeshSize`), поэтому на
 * панели 120 мм сетка 360 × 227, а на панели 200 мм — 626 × 460. Толщина каждой
 * вершины берётся из яркости фотографии билинейной выборкой из прямоугольной
 * сетки (400 × 267 для кадра 3:2), которую браузер уже сжал из кадра. Чёрный
 * пиксель даёт максимальную толщину, белый — минимальную, поэтому свет проходит
 * через тонкие участки сильнее.
 *
 * Кадр вписывается в панель по правилу cover: пропорции сохраняются, лишнее
 * обрезается поровну с краёв, поля не появляются. Раньше браузер вырезал из
 * фотографии центральный квадрат, а геометрия растягивала его на панель
 * 120 × 80 — лицо выходило шире на 59 %.
 *
 * После выборки яркость проходит через лёгкий unsharp и контраст: без них
 * билинейное сглаживание размывало тонкие штрихи логотипа до «каши».
 *
 * Деталей три, и каждая — отдельный замкнутый объект:
 *   `relief` — плита с плоским тылом и рельефом на лице;
 *   `frame`  — рамка с задней полкой (плита садится на неё с зазором 0.2 мм) и
 *              передней накладкой, которая прижимает её край;
 *   `stand`  — подставка: база, передняя губа и задняя стойка под наклоном 12°
 *              со скруглением в тыльном углу. Профиль один, поэтому шва, по
 *              которому деталь отламывается, нет; варианты — простая ножка и
 *              массивное основание.
 *
 * Крепление `hook` — две петли на тыльной стороне верхней планки рамки: литофан
 * висит на шурупах почти вплотную к стене. Вычитания тел (CSG) нет: деталь
 * собирается из пересекающихся замкнутых кусков и `mergeGeometries`, как
 * вывеска и подставка. Нахлёст объединяемых кусков — BODY_OVERLAP_MM: слайсер
 * видит один объект, а каждая оболочка остаётся watertight.
 */

/** Ширина бортика рамки по периметру, мм. */
export const LITHOPHANE_FRAME_WIDTH_MM = 6;

/**
 * Ширина бортика плиты по периметру, мм.
 *
 * 2 мм — стандарт литофанов из референсов: полоса максимальной толщины по краю
 * не просвечивает, не крошится при обращении и держит рельеф у самой кромки.
 * Бортик есть и при включённой рамке: фото заканчивается до рамки, а не
 * наезжает на накладку. Плита в окне уже панели на 8.4 мм с каждой стороны,
 * поэтому 0.2 мм бортика прячется под накладкой, а остальные 1.8 мм видны как
 * узкая полка вокруг кадра.
 */
export const LITHOPHANE_BORDER_MM = 2;

/**
 * Ширина фаски бортика, мм.
 *
 * Бортик заканчивается не вертикальной стенкой, а скосом: толщина плавно
 * переходит от максимальной к толщине фото. Раньше на границе был обрыв 2.2 мм
 * на одном шаге вершины (0.3 мм) — на печати это уступ в 11 слоёв, у которого
 * собираются сопли. Фаска растягивает тот же перепад на 1 мм: 0.66 мм на шаг.
 */
export const LITHOPHANE_BORDER_CHAMFER_MM = 1;

/** Зазор посадки плиты в паз на сторону, мм. */
export const LITHOPHANE_FIT_GAP_MM = 0.2;


/** Высота задней полки рамки: на неё опирается плита, мм. */
export const LITHOPHANE_FRAME_SEAT_MM = 1.6;

/** Ширина передней накладки поверх края плиты, мм. */
export const LITHOPHANE_FRAME_LIP_MM = 2.4;

/** Насколько передняя рамка выступает над самым толстым пикселем, мм. */
export const LITHOPHANE_FRAME_RIM_MM = 0.4;

/** Наклон литофана на подставке, градусы. */
export const LITHOPHANE_STAND_TILT_DEG = 12;

/** Петля подвеса: наружная ширина и выступ от тыльной плоскости, мм. */
export const LITHOPHANE_HOOK_WIDTH_MM = 8;
export const LITHOPHANE_HOOK_DEPTH_MM = 9;

/**
 * Группы материалов в собранной сетке литофана.
 *
 * Группа — диапазон индексов, а не отдельный меш: сборка остаётся одной сеткой,
 * и вес, габарит и STL считаются как раньше. Предпросмотр красит рельеф
 * плоскостями (`flatShading`): по граням читается высота пикселя. Рамка и
 * подставка идут вторым материалом со сглаженными нормалями — они должны
 * выглядеть литыми и матовыми.
 */
export const LITHOPHANE_RELIEF_GROUP = 0;
export const LITHOPHANE_DETAIL_GROUP = 1;

/** Нахлёст двух объединяемых оболочек, мм: без него слайсер видит два тела. */
const BODY_OVERLAP_MM = 0.2;

type Point3 = readonly [number, number, number];

/** Индекс вершины в массиве positions. */
function vertexIndex(positions: number[]): number {
  return positions.length / 3;
}

/**
 * Добавляет выпуклый четырёхугольник двумя треугольниками.
 *
 * Порядок вершин задаётся по периметру, а expectedNormal говорит, куда должна
 * смотреть лицевая сторона. Если векторное произведение направлено в другую
 * сторону, обход разворачивается целиком — иначе нормали части граней
 * смотрели бы внутрь и объём перестал бы сходиться.
 */
function addOrientedQuad(
  indices: number[],
  positions: number[],
  a: number,
  b: number,
  c: number,
  d: number,
  normal: Point3,
): void {
  const ax = positions[a * 3];
  const ay = positions[a * 3 + 1];
  const az = positions[a * 3 + 2];
  const ux = positions[b * 3] - ax;
  const uy = positions[b * 3 + 1] - ay;
  const uz = positions[b * 3 + 2] - az;
  const vx = positions[c * 3] - ax;
  const vy = positions[c * 3 + 1] - ay;
  const vz = positions[c * 3 + 2] - az;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const flipped = nx * normal[0] + ny * normal[1] + nz * normal[2] < 0;
  const second = flipped ? d : b;
  const fourth = flipped ? b : d;

  indices.push(a, second, c, a, c, fourth);
}

/** Добавляет треугольник с нужной наружной нормалью. */
function addOrientedTriangle(
  indices: number[],
  positions: number[],
  a: number,
  b: number,
  c: number,
  normal: Point3,
): void {
  const ax = positions[a * 3];
  const ay = positions[a * 3 + 1];
  const az = positions[a * 3 + 2];
  const ux = positions[b * 3] - ax;
  const uy = positions[b * 3 + 1] - ay;
  const uz = positions[b * 3 + 2] - az;
  const vx = positions[c * 3] - ax;
  const vy = positions[c * 3 + 1] - ay;
  const vz = positions[c * 3 + 2] - az;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;

  if (nx * normal[0] + ny * normal[1] + nz * normal[2] < 0) {
    indices.push(a, c, b);
  } else {
    indices.push(a, b, c);
  }
}

/**
 * Добавляет четырёхугольник четырьмя новыми вершинами.
 *
 * На построении грани остаются плоскими: у каждой свой набор вершин и своя
 * нормаль, поэтому силуэт и объём считаются точно. Сглаживание делается один раз
 * на готовую деталь (`smoothGeometryNormals`) — тогда нормаль учитывает всю
 * поверхность, а не только соседнюю грань.
 */
function addQuadFace(
  indices: number[],
  positions: number[],
  points: readonly [Point3, Point3, Point3, Point3],
  normal: Point3,
): void {
  const first = vertexIndex(positions);

  for (const point of points) {
    positions.push(point[0], point[1], point[2]);
  }

  addOrientedQuad(
    indices,
    positions,
    first,
    first + 1,
    first + 2,
    first + 3,
    normal,
  );
}

/** Собирает замкнутую оболочку из накопленных вершин и индексов. */
function finalizeGeometry(
  positions: number[],
  indices: number[],
): BufferGeometry {
  const geometry = new BufferGeometry();

  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

/**
 * Контур верхней поверхности против часовой стрелки со стороны +Z.
 *
 * Обход начинается в левом нижнем углу: нижняя кромка слева направо, правая
 * снизу вверх, верхняя справа налево, левая сверху вниз. Для такого контура
 * внешняя нормаль ребра равна (dy, -dx, 0).
 */
function collectBoundaryIndices(columns: number, rows: number): number[] {
  const boundary: number[] = [];
  const bottomRow = (rows - 1) * columns;

  for (let column = 0; column < columns; column += 1) {
    boundary.push(bottomRow + column);
  }

  for (let row = rows - 2; row >= 0; row -= 1) {
    boundary.push(row * columns + columns - 1);
  }

  for (let column = columns - 2; column >= 0; column -= 1) {
    boundary.push(column);
  }

  for (let row = 1; row <= rows - 2; row += 1) {
    boundary.push(row * columns);
  }

  return boundary;
}

/**
 * Габариты посадки плиты в рамку, мм.
 *
 * Считаются в одном месте: плита строится по ним, рамка вырезает по ним окно, а
 * сборка ставит плиту на полку. Иначе после смены ширины бортика плита и окно
 * разошлись бы на десятые доли миллиметра и деталь не собралась бы.
 */
type FrameMetrics = {
  /** Габарит собранной рамки — те же числа, что на слайдерах. */
  width: number;
  height: number;
  /** Ширина бортика: 6 мм, но не больше четверти панели. */
  frameWidth: number;
  /** Ширина передней накладки поверх края плиты. */
  lip: number;
  /** Окно рамки: сюда входит плита. */
  openingWidth: number;
  openingHeight: number;
  /** Размер плиты: окно минус зазор посадки с двух сторон. */
  plateWidth: number;
  plateHeight: number;
  /** Плоскость тыла плиты: верх полки минус нахлёст для объединения. */
  plateBack: number;
  /** Лицевая плоскость рамки: плита плюс выступ накладки. */
  frontZ: number;
};

function lithophaneFrameMetrics(normalized: LithophaneParams): FrameMetrics {
  const width = normalized.lithophaneWidth;
  const height = normalized.lithophaneHeight;
  const frameWidth = Math.min(
    LITHOPHANE_FRAME_WIDTH_MM,
    width / 4,
    height / 4,
  );
  const openingWidth = width - 2 * frameWidth;
  const openingHeight = height - 2 * frameWidth;
  const lip = Math.min(
    LITHOPHANE_FRAME_LIP_MM,
    openingWidth / 5,
    openingHeight / 5,
  );
  const plateBack = LITHOPHANE_FRAME_SEAT_MM - BODY_OVERLAP_MM;

  return {
    width,
    height,
    frameWidth,
    lip,
    openingWidth,
    openingHeight,
    plateWidth: openingWidth - 2 * LITHOPHANE_FIT_GAP_MM,
    plateHeight: openingHeight - 2 * LITHOPHANE_FIT_GAP_MM,
    plateBack,
    frontZ:
      plateBack + normalized.lithophaneMaxThickness + LITHOPHANE_FRAME_RIM_MM,
  };
}

/**
 * Билинейная выборка яркости в точке 0…1 по обеим осям.
 *
 * Сетка прямоугольная: 400 × 267 для кадра 3:2, 150 × 100 для предпросмотра.
 * Оси нормируются отдельно, поэтому пиксель остаётся квадратным и кадр не
 * растягивается. Без выборки переходы читались бы ступенями.
 */
function sampleBrightness(
  brightness: number[],
  width: number,
  height: number,
  u: number,
  v: number,
): number {
  const lastX = width - 1;
  const lastY = height - 1;
  const x = Math.min(Math.max(u, 0), 1) * lastX;
  const y = Math.min(Math.max(v, 0), 1) * lastY;
  const x0 = Math.min(Math.floor(x), lastX - 1);
  const y0 = Math.min(Math.floor(y), lastY - 1);
  const tx = x - x0;
  const ty = y - y0;
  const topRow = y0 * width;
  const bottomRow = topRow + width;
  const topLeft = brightness[topRow + x0];
  const bottomLeft = brightness[bottomRow + x0];
  const top = topLeft + (brightness[topRow + x0 + 1] - topLeft) * tx;
  const bottom =
    bottomLeft + (brightness[bottomRow + x0 + 1] - bottomLeft) * tx;

  return top + (bottom - top) * ty;
}

/**
 * Насколько усиливается резкость: разница с средним четырёх соседей.
 *
 * Билинейная выборка — это фильтр низких частот: штрих логотипа в один пиксель
 * теряет амплитуду, и на печати буквы сливаются. unsharp возвращает краю
 * контраст, а второй коэффициент расширяет диапазон вокруг середины, чтобы
 * тёмные линии уверенно доходили до максимальной толщины. Значения ниже 0 и
 * выше 255 обрезаются: толщина не может выйти за границы слайдеров.
 */
const LITHOPHANE_SHARPNESS = 0.5;
const LITHOPHANE_CONTRAST = 1.15;

function sharpenBrightness(
  brightness: number[],
  width: number,
  height: number,
  u: number,
  v: number,
): number {
  const center = sampleBrightness(brightness, width, height, u, v);

  if (width < 3 && height < 3) {
    return center;
  }

  // Шаг в один пиксель источника: соседи берутся по осям, поэтому фильтр
  // остаётся разделимым и стоит четыре выборки вместо девяти. Оси сетки
  // прямоугольные, поэтому шаг по X и по Y разный.
  const stepU = width > 1 ? 1 / (width - 1) : 0;
  const stepV = height > 1 ? 1 / (height - 1) : 0;
  const neighbors =
    (sampleBrightness(brightness, width, height, u - stepU, v) +
      sampleBrightness(brightness, width, height, u + stepU, v) +
      sampleBrightness(brightness, width, height, u, v - stepV) +
      sampleBrightness(brightness, width, height, u, v + stepV)) /
    4;
  const sharpened = center + (center - neighbors) * LITHOPHANE_SHARPNESS;
  const contrasted = 127.5 + (sharpened - 127.5) * LITHOPHANE_CONTRAST;

  return Math.min(255, Math.max(0, contrasted));
}

/**
 * Замкнутая плита рельефа: heightfield по габаритам плиты, боковины и тыл.
 *
 * Сетка считается из габаритов (`lithophaneMeshSize`): шаг вершины 0.3 мм, а на
 * большой панели вершин просто становится больше. Если бюджет треугольников
 * превышен, функция бросает ошибку с текстом для панели и API: лучше отказ, чем
 * зависший браузер и 45 МБ STL.
 *
 * `borderWidth` — плоская полоса максимальной толщины по периметру. Переход от
 * бортика к фото идёт фаской `LITHOPHANE_BORDER_CHAMFER_MM`, поэтому на печати
 * нет уступа в 2.2 мм на одном шаге вершины.
 *
 * Кадр вписан в плиту по правилу cover: пропорции сохранены, лишнее обрезано
 * поровну с краёв, полей нет.
 */
function createReliefBody(
  normalized: LithophaneParams,
  plateWidth: number,
  plateHeight: number,
  borderWidth: number,
): BufferGeometry {
  const minThickness = normalized.lithophaneMinThickness;
  const maxThickness = normalized.lithophaneMaxThickness;
  const brightness = normalized.lithophaneBrightness;
  const brightnessWidth = normalized.lithophaneBrightnessWidth;
  const brightnessHeight = normalized.lithophaneBrightnessHeight;
  const mesh = lithophaneMeshSize(plateWidth, plateHeight);

  if (mesh === null) {
    throw new Error(LITHOPHANE_MESH_TOO_LARGE_MESSAGE);
  }

  const { columns, rows } = mesh;
  const halfWidth = plateWidth / 2;
  const thicknessRange = maxThickness - minThickness;
  const chamferWidth =
    borderWidth > 0 ? Math.min(LITHOPHANE_BORDER_CHAMFER_MM, borderWidth) : 0;
  const borderFlat = borderWidth - chamferWidth;
  const positions: number[] = [];
  const indices: number[] = [];

  // cover: кадр заполняет плиту целиком, лишнее обрезается поровну с краёв.
  // Кадр шире плиты — режем слева и справа, выше — сверху и снизу, поэтому
  // пиксель остаётся квадратным и лицо не растягивается.
  const sourceAspect = brightnessWidth / brightnessHeight;
  const plateAspect = plateWidth / plateHeight;
  let sourceLeft = 0;
  let sourceRight = 1;
  let sourceTop = 0;
  let sourceBottom = 1;

  if (sourceAspect > plateAspect) {
    const keep = plateAspect / sourceAspect;
    sourceLeft = (1 - keep) / 2;
    sourceRight = 1 - sourceLeft;
  } else if (sourceAspect < plateAspect) {
    const keep = sourceAspect / plateAspect;
    sourceTop = (1 - keep) / 2;
    sourceBottom = 1 - sourceTop;
  }

  const sourceWidth = sourceRight - sourceLeft;
  const sourceHeight = sourceBottom - sourceTop;

  // Лицо рельефа: одна вершина на узел сетки. Строка 0 — верхний край, как у
  // массива яркости; яркость 0 — самый толстый пластик, 255 — самый тонкий.
  for (let row = 0; row < rows; row += 1) {
    const v = rows > 1 ? row / (rows - 1) : 0;
    const y = plateHeight - v * plateHeight;
    const fromTop = v * plateHeight;
    const fromBottom = plateHeight - fromTop;
    const sourceV = sourceTop + v * sourceHeight;

    for (let column = 0; column < columns; column += 1) {
      const u = columns > 1 ? column / (columns - 1) : 0;
      const x = -halfWidth + u * plateWidth;
      const fromLeft = u * plateWidth;
      const fromRight = plateWidth - fromLeft;
      const photoThickness =
        maxThickness -
        thicknessRange *
          (sharpenBrightness(
            brightness,
            brightnessWidth,
            brightnessHeight,
            sourceLeft + u * sourceWidth,
            sourceV,
          ) /
            255);
      const edgeDistance = Math.min(fromLeft, fromRight, fromTop, fromBottom);
      let thickness = photoThickness;

      if (chamferWidth > 0 && edgeDistance < borderWidth) {
        thickness =
          edgeDistance <= borderFlat
            ? maxThickness
            : maxThickness +
              (photoThickness - maxThickness) *
                ((edgeDistance - borderFlat) / chamferWidth);
      }

      positions.push(x, y, thickness);
    }
  }

  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const a = row * columns + column;
      const b = a + 1;
      const c = a + columns + 1;
      const d = a + columns;

      // a — левый верхний угол ячейки, c — правый нижний. Такой обход даёт
      // нормаль +Z, то есть лицо смотрит на камеру и на слайсер сверху.
      indices.push(a, d, c, a, c, b);
    }
  }

  const boundary = collectBoundaryIndices(columns, rows);
  const bottomBoundary: number[] = [];

  // Тыл повторяет контур лица по X/Y и лежит на Z = 0. Отдельные вершины
  // нужны, чтобы плоская задняя стенка не делила нормали с рельефом.
  for (const topIndex of boundary) {
    bottomBoundary.push(vertexIndex(positions));
    positions.push(
      positions[topIndex * 3],
      positions[topIndex * 3 + 1],
      0,
    );
  }

  const centerIndex = vertexIndex(positions);
  positions.push(0, plateHeight / 2, 0);

  const boundaryCount = boundary.length;

  for (let edge = 0; edge < boundaryCount; edge += 1) {
    const next = (edge + 1) % boundaryCount;
    const topA = boundary[edge];
    const topB = boundary[next];
    const bottomA = bottomBoundary[edge];
    const bottomB = bottomBoundary[next];
    const dx = positions[topB * 3] - positions[topA * 3];
    const dy = positions[topB * 3 + 1] - positions[topA * 3 + 1];

    addOrientedQuad(
      indices,
      positions,
      topA,
      topB,
      bottomB,
      bottomA,
      [dy, -dx, 0],
    );
    addOrientedTriangle(
      indices,
      positions,
      centerIndex,
      bottomA,
      bottomB,
      [0, 0, -1],
    );
  }

  return finalizeGeometry(positions, indices);
}

/**
 * Габариты плиты рельефа, мм.
 *
 * С рамкой плита меньше панели на два бортика и на два зазора посадки; без
 * рамки панель и есть плита. API зовёт эту функцию до сборки: по ней видно,
 * влезает ли сетка в бюджет треугольников.
 */
export function lithophanePlateSize(params: Partial<LithophaneParams>): {
  width: number;
  height: number;
} {
  const normalized = normalizeLithophaneParams(params);

  if (!normalized.lithoFrame) {
    return {
      width: normalized.lithophaneWidth,
      height: normalized.lithophaneHeight,
    };
  }

  const metrics = lithophaneFrameMetrics(normalized);

  return { width: metrics.plateWidth, height: metrics.plateHeight };
}

/**
 * Плита рельефа отдельной деталью.
 *
 * `Partial<LithophaneParams>` допустим и на клиенте: normalizeLithophaneParams
 * дополнит недостающие поля значениями по умолчанию. Если массив яркости
 * повреждён, нормализация подставит демонстрационный рельеф — предпросмотр
 * останется рабочим.
 */
export function createLithophaneReliefGeometry(
  params: Partial<LithophaneParams>,
): BufferGeometry {
  const normalized = normalizeLithophaneParams(params);
  const plate = lithophanePlateSize(normalized);

  return createReliefBody(
    normalized,
    plate.width,
    plate.height,
    LITHOPHANE_BORDER_MM,
  );
}

/**
 * Замкнутый параллелепипед по двум углам.
 *
 * Подставка и петли — набор коробок: так каждая деталь состоит из нескольких
 * замкнутых оболочек, которые объединяются с нахлёстом. Все шесть граней
 * получают свои вершины, поэтому рёбра остаются острыми.
 */
function createBoxBody(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  addQuadFace(
    indices,
    positions,
    [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y1, z0],
      [x0, y1, z0],
    ],
    [0, 0, -1],
  );
  addQuadFace(
    indices,
    positions,
    [
      [x0, y0, z1],
      [x1, y0, z1],
      [x1, y1, z1],
      [x0, y1, z1],
    ],
    [0, 0, 1],
  );
  addQuadFace(
    indices,
    positions,
    [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y0, z1],
      [x0, y0, z1],
    ],
    [0, -1, 0],
  );
  addQuadFace(
    indices,
    positions,
    [
      [x0, y1, z0],
      [x1, y1, z0],
      [x1, y1, z1],
      [x0, y1, z1],
    ],
    [0, 1, 0],
  );
  addQuadFace(
    indices,
    positions,
    [
      [x0, y0, z0],
      [x0, y1, z0],
      [x0, y1, z1],
      [x0, y0, z1],
    ],
    [-1, 0, 0],
  );
  addQuadFace(
    indices,
    positions,
    [
      [x1, y0, z0],
      [x1, y1, z0],
      [x1, y1, z1],
      [x1, y0, z1],
    ],
    [1, 0, 0],
  );

  return finalizeGeometry(positions, indices);
}

/** Прямоугольное кольцо, выдавленное по Z: полка рамки и бортик петли. */
type RectRingOptions = {
  centerX: number;
  centerY: number;
  outerWidth: number;
  outerHeight: number;
  innerWidth: number;
  innerHeight: number;
  z0: number;
  z1: number;
};

/**
 * Замкнутое прямоугольное кольцо: наружные и внутренние стенки плюс две
 * плоские полосы по торцам.
 *
 * Кольцо — основа рамки: задняя полка держит плиту, передняя накладка её
 * прижимает. Обе собираются из одного кода, отличаются только размерами окна и
 * высотой по Z.
 */
function createRectRingBody(options: RectRingOptions): BufferGeometry {
  const {
    centerX,
    centerY,
    outerWidth,
    outerHeight,
    innerWidth,
    innerHeight,
    z0,
    z1,
  } = options;
  const outerLeft = centerX - outerWidth / 2;
  const outerRight = centerX + outerWidth / 2;
  const outerBottom = centerY - outerHeight / 2;
  const outerTop = centerY + outerHeight / 2;
  const innerLeft = centerX - innerWidth / 2;
  const innerRight = centerX + innerWidth / 2;
  const innerBottom = centerY - innerHeight / 2;
  const innerTop = centerY + innerHeight / 2;
  const positions: number[] = [];
  const indices: number[] = [];

  for (const z of [z0, z1]) {
    const normal: Point3 = z === z0 ? [0, 0, -1] : [0, 0, 1];

    // Четыре трапеции торца: наружный край шире внутреннего.
    addQuadFace(
      indices,
      positions,
      [
        [outerLeft, outerBottom, z],
        [outerRight, outerBottom, z],
        [innerRight, innerBottom, z],
        [innerLeft, innerBottom, z],
      ],
      normal,
    );
    addQuadFace(
      indices,
      positions,
      [
        [outerRight, outerBottom, z],
        [outerRight, outerTop, z],
        [innerRight, innerTop, z],
        [innerRight, innerBottom, z],
      ],
      normal,
    );
    addQuadFace(
      indices,
      positions,
      [
        [outerRight, outerTop, z],
        [outerLeft, outerTop, z],
        [innerLeft, innerTop, z],
        [innerRight, innerTop, z],
      ],
      normal,
    );
    addQuadFace(
      indices,
      positions,
      [
        [outerLeft, outerTop, z],
        [outerLeft, outerBottom, z],
        [innerLeft, innerBottom, z],
        [innerLeft, innerTop, z],
      ],
      normal,
    );
  }

  // Наружные стенки смотрят наружу.
  addQuadFace(
    indices,
    positions,
    [
      [outerLeft, outerBottom, z0],
      [outerRight, outerBottom, z0],
      [outerRight, outerBottom, z1],
      [outerLeft, outerBottom, z1],
    ],
    [0, -1, 0],
  );
  addQuadFace(
    indices,
    positions,
    [
      [outerRight, outerBottom, z0],
      [outerRight, outerTop, z0],
      [outerRight, outerTop, z1],
      [outerRight, outerBottom, z1],
    ],
    [1, 0, 0],
  );
  addQuadFace(
    indices,
    positions,
    [
      [outerRight, outerTop, z0],
      [outerLeft, outerTop, z0],
      [outerLeft, outerTop, z1],
      [outerRight, outerTop, z1],
    ],
    [0, 1, 0],
  );
  addQuadFace(
    indices,
    positions,
    [
      [outerLeft, outerTop, z0],
      [outerLeft, outerBottom, z0],
      [outerLeft, outerBottom, z1],
      [outerLeft, outerTop, z1],
    ],
    [-1, 0, 0],
  );

  // Внутренние стенки смотрят в окно: иначе нормали завернулись бы внутрь
  // пластика и объём кольца посчитался бы с другим знаком.
  addQuadFace(
    indices,
    positions,
    [
      [innerLeft, innerBottom, z0],
      [innerRight, innerBottom, z0],
      [innerRight, innerBottom, z1],
      [innerLeft, innerBottom, z1],
    ],
    [0, 1, 0],
  );
  addQuadFace(
    indices,
    positions,
    [
      [innerRight, innerBottom, z0],
      [innerRight, innerTop, z0],
      [innerRight, innerTop, z1],
      [innerRight, innerBottom, z1],
    ],
    [-1, 0, 0],
  );
  addQuadFace(
    indices,
    positions,
    [
      [innerRight, innerTop, z0],
      [innerLeft, innerTop, z0],
      [innerLeft, innerTop, z1],
      [innerRight, innerTop, z1],
    ],
    [0, -1, 0],
  );
  addQuadFace(
    indices,
    positions,
    [
      [innerLeft, innerTop, z0],
      [innerLeft, innerBottom, z0],
      [innerLeft, innerBottom, z1],
      [innerLeft, innerTop, z1],
    ],
    [1, 0, 0],
  );

  return finalizeGeometry(positions, indices);
}


/**
 * Рамка литофана отдельной деталью.
 *
 * Задняя полка поднимается до `LITHOPHANE_FRAME_SEAT_MM`, и её внутренний край
 * заходит под плиту на ширину накладки: плита ложится на полку и не проваливается
 * в окно. Передняя накладка начинается чуть ниже верха полки (нахлёст для
 * объединения) и поднимается над самым толстым пикселем на 0.4 мм — рельеф не
 * выступает за лицевую плоскость, и литофан можно ставить лицом вниз.
 *
 * При креплении `hook` на тыльной стороне верхней планки появляются две петли.
 * Каждая — полка с бортиком сзади: шуруп вворачивается в стену, литофан
 * опускается на него, шляпка остаётся в кармане между рамкой и бортиком.
 */
export function createLithophaneFrameGeometry(
  params: Partial<LithophaneParams>,
): BufferGeometry {
  const normalized = normalizeLithophaneParams(params);
  const metrics = lithophaneFrameMetrics(normalized);
  const { width, height, frameWidth, lip, frontZ } = metrics;
  const bodies: BufferGeometry[] = [
    createRectRingBody({
      centerX: 0,
      centerY: height / 2,
      outerWidth: width,
      outerHeight: height,
      innerWidth: width - 2 * (frameWidth + lip),
      innerHeight: height - 2 * (frameWidth + lip),
      z0: 0,
      z1: LITHOPHANE_FRAME_SEAT_MM,
    }),
    createRectRingBody({
      centerX: 0,
      centerY: height / 2,
      outerWidth: width,
      outerHeight: height,
      innerWidth: width - 2 * frameWidth,
      innerHeight: height - 2 * frameWidth,
      z0: LITHOPHANE_FRAME_SEAT_MM - 2 * BODY_OVERLAP_MM,
      z1: frontZ,
    }),
  ];

  if (normalized.lithoMount === "hook") {
    // Петли стоят на верхней планке: её ширина — бортик плюс накладка. Полка
    // петли занимает нижние 4 мм планки, бортик поднимается от неё к верхнему
    // краю, поэтому с лица крепление не видно.
    const band = frameWidth + lip;
    const bracketHalf = Math.min(LITHOPHANE_HOOK_WIDTH_MM / 2, band / 2);
    const bracketCenter = width / 2 - band / 2;
    const shelfTop = height - band + Math.min(4, band / 2);

    for (const centerX of [-bracketCenter, bracketCenter]) {
      bodies.push(
        createBoxBody(
          centerX - bracketHalf,
          centerX + bracketHalf,
          height - band,
          shelfTop,
          -LITHOPHANE_HOOK_DEPTH_MM,
          BODY_OVERLAP_MM,
        ),
      );
      bodies.push(
        createBoxBody(
          centerX - bracketHalf,
          centerX + bracketHalf,
          shelfTop - 1,
          height - 1,
          -LITHOPHANE_HOOK_DEPTH_MM,
          -LITHOPHANE_HOOK_DEPTH_MM + 1.5,
        ),
      );
    }
  }

  // Рамка собирается из двух колец и петель, но печатается одной деталью:
  // сварка вершин и пересчёт нормалей делают её поверхность гладкой — на
  // предпросмотре она читается литой и матовой, а не набором плоскостей.
  return smoothGeometryNormals(mergeBodies(bodies, "рамки"));
}

/**
 * Объединяет оболочки детали в одну сетку и освобождает исходные.
 *
 * `mergeGeometries` копирует данные в новую сетку; без dispose каждая правка
 * слайдера оставляла бы в памяти старые буферы.
 */
function mergeBodies(
  bodies: BufferGeometry[],
  name: string,
): BufferGeometry {
  const merged = mergeGeometries(bodies);

  for (const body of bodies) {
    body.dispose();
  }

  if (!merged) {
    throw new Error(`Не удалось объединить детали литофана: ${name}`);
  }

  merged.computeBoundingBox();
  merged.computeBoundingSphere();

  return merged;
}

/**
 * Сглаживает нормали детали.
 *
 * Вершины свариваются по координатам, и нормали считаются заново: рамка
 * перестаёт выглядеть набором плоскостей — свет ложится градиентом, поверхность
 * читается литой и матовой. Рельеф так не сглаживается: там нормаль вершины
 * задаёт высоту пикселя и должна считаться по сетке рельефа.
 *
 * Сварка не меняет топологию: совпадающие вершины и раньше лежали в одних и тех
 * же точках, поэтому каждая оболочка остаётся замкнутой, а число треугольников
 * не меняется.
 */
function smoothGeometryNormals(geometry: BufferGeometry): BufferGeometry {
  geometry.deleteAttribute("normal");

  const welded = mergeVertices(geometry, 1e-4);

  geometry.dispose();
  welded.computeVertexNormals();
  welded.computeBoundingBox();
  welded.computeBoundingSphere();

  return welded;
}

/** Деталь без второй половины: вся сетка красится материалом своей группы. */
function markPartGroup(
  geometry: BufferGeometry,
  material: number,
): BufferGeometry {
  geometry.clearGroups();
  geometry.addGroup(0, geometry.getIndex()?.count ?? 0, material);

  return geometry;
}

/** Две группы собранной сетки: рельеф с начала индексов, крепление — до конца. */
function assignMaterialGroups(
  geometry: BufferGeometry,
  reliefIndices: number,
): BufferGeometry {
  const total = geometry.getIndex()?.count ?? 0;

  geometry.clearGroups();
  geometry.addGroup(0, reliefIndices, LITHOPHANE_RELIEF_GROUP);

  if (total > reliefIndices) {
    geometry.addGroup(
      reliefIndices,
      total - reliefIndices,
      LITHOPHANE_DETAIL_GROUP,
    );
  }

  return geometry;
}


/**
 * Профиль подставки в плоскости YZ: высота над столом и глубина.
 *
 * `smooth` — точка лежит на скруглении: соседние рёбра делят её вершины, и свет
 * ложится градиентом. На острых углах вершины раздельные, грань остаётся резкой.
 */
type StandProfilePoint = {
  y: number;
  z: number;
  smooth?: boolean;
};

/** Размеры профиля подставки: различают простую ножку и массивное основание. */
type StandShape = {
  /** Ширина базы: доля ширины панели и минимум в миллиметрах. */
  widthFactor: number;
  minWidth: number;
  /** Тыльная и передняя кромки базы по Z, мм. */
  back: number;
  front: number;
  /** Верх базы: на нём стоит рамка, мм. */
  baseTop: number;
  /** Толщина и высота наклонной стойки, мм. */
  strutThickness: number;
  strutTop: number;
  /** Радиус скругления в углу «база — стойка», мм. */
  filletRadius: number;
  /** Передняя губа: толщина и высота над базой, мм. */
  lipThickness: number;
  lipHeight: number;
};

/**
 * Два типа подставки.
 *
 * Ножка: база 66 % ширины панели (не уже 58 мм) уходит назад на 38 мм — этого
 * хватает панели 120 × 80. Массивное основание: база 92 % ширины и 52 мм назад,
 * сама база 9 мм вместо 6, стойка 8 мм вместо 4 и скругление 7 мм вместо 4.
 * Панель 200 × 150 весит около 120 г, её центр тяжести на наклоне 12° вынесен
 * вперёд — узкая ножка опрокидывалась бы, а толстая стойка со скруглением не
 * отламывается от базы при снятии со стола.
 *
 * Числа наружу нужны тесту: он сверяет габарит готовой детали с профилем, из
 * которого она построена, а не с зашитыми в тест миллиметрами.
 */
export const LITHOPHANE_STAND_SHAPES = {
  leg: {
    widthFactor: 0.66,
    minWidth: 58,
    back: -38,
    front: 12,
    baseTop: 6,
    strutThickness: 4,
    strutTop: 30,
    filletRadius: 4,
    lipThickness: 2.5,
    lipHeight: 4,
  },
  massive: {
    widthFactor: 0.92,
    minWidth: 76,
    back: -52,
    front: 16,
    baseTop: 9,
    strutThickness: 8,
    strutTop: 34,
    filletRadius: 7,
    lipThickness: 3,
    lipHeight: 5,
  },
} as const satisfies Record<"leg" | "massive", StandShape>;

/** Сколько отрезков у скругления: восемь шагов по 13° дают гладкую дугу. */
const STAND_FILLET_SEGMENTS = 8;

/**
 * Размеры профиля подставки для выбранного крепления.
 *
 * Подставка печатается только при `stand` и `base`. Для остальных креплений
 * возвращается профиль ножки: сборке нужна высота её базы, даже когда сама
 * деталь в файл не попадает.
 */
function standShape(mount: LithophaneMount): StandShape {
  return mount === "base"
    ? LITHOPHANE_STAND_SHAPES.massive
    : LITHOPHANE_STAND_SHAPES.leg;
}

/**
 * Профиль подставки: замкнутый контур в плоскости YZ.
 *
 * Спереди — губа, сзади — наклонная стойка под 12°, в углу между базой и
 * тыльной плоскостью стойки — скругление. Стойка и скругление считаются от
 * одной линии: лицевая плоскость стойки проходит через (Y = baseTop,
 * Z = BODY_OVERLAP_MM), поэтому тыл рамки входит в неё на 0.2 мм, и в собранном
 * файле детали держатся друг за друга.
 *
 * Скругление стоит в тыльном углу, а не в лицевом: лицевой угол — это паз, куда
 * опускается рамка, и материал там мешал бы посадке. Центр дуги выше базы на
 * радиус и на радиус же отодвинут от плоскости стойки, поэтому дуга касается
 * базы и стойки без изломов: напряжение от изгиба панели уходит в тело базы, а
 * не в тонкое ребро.
 */
function createStandProfile(
  shape: StandShape,
  lipBack: number,
): StandProfilePoint[] {
  const tilt = (LITHOPHANE_STAND_TILT_DEG * Math.PI) / 180;
  const slope = Math.tan(tilt);
  const cos = Math.cos(tilt);
  const baseTop = shape.baseTop;
  const frontAt = (y: number) => BODY_OVERLAP_MM - (y - baseTop) * slope;
  const backAt = (y: number) => frontAt(y) - shape.strutThickness / cos;
  const radius = shape.filletRadius;
  const centerY = baseTop + radius;
  const centerZ = backAt(centerY) - radius / cos;
  // Дуга в параметрическом виде: угол отсчитывается от направления на базу (π)
  // к направлению на стойку (π/2 − наклон). Касание стойки приходится на точку,
  // сдвинутую от центра на радиус по нормали её плоскости.
  const startAngle = Math.PI;
  const endAngle = Math.PI / 2 - tilt;
  const profile: StandProfilePoint[] = [
    { y: 0, z: shape.front },
    { y: 0, z: shape.back },
    { y: baseTop, z: shape.back },
    { y: baseTop, z: centerZ, smooth: true },
  ];

  for (let step = 1; step <= STAND_FILLET_SEGMENTS; step += 1) {
    const angle =
      startAngle + ((endAngle - startAngle) * step) / STAND_FILLET_SEGMENTS;

    profile.push({
      y: centerY + radius * Math.cos(angle),
      z: centerZ + radius * Math.sin(angle),
      smooth: true,
    });
  }

  profile.push(
    { y: shape.strutTop, z: backAt(shape.strutTop) },
    { y: shape.strutTop, z: frontAt(shape.strutTop) },
    { y: baseTop, z: frontAt(baseTop) },
    { y: baseTop, z: lipBack },
    { y: baseTop + shape.lipHeight, z: lipBack },
    { y: baseTop + shape.lipHeight, z: lipBack + shape.lipThickness },
    { y: baseTop, z: lipBack + shape.lipThickness },
    { y: baseTop, z: shape.front },
  );

  return profile;
}

/**
 * Замкнутая призма: профиль в плоскости YZ, выдавленный по X от x0 до x1.
 *
 * Торцы разбивает `ShapeUtils.triangulateShape`: профиль подставки невыпуклый
 * (губа и стойка), веер из одной вершины на нём не работает. Боковины собираются
 * из колец по две вершины; кольцо точки со `smooth` общее с соседним ребром,
 * поэтому скругление считается гладким ещё до финальной сварки нормалей.
 */
function createProfilePrismBody(
  profile: readonly StandProfilePoint[],
  x0: number,
  x1: number,
): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  // Обход профиля влияет только на нормали: площадь приводит его к одному виду,
  // чтобы наружное направление ребра считалось по одной формуле.
  const samples = ShapeUtils.isClockWise(
    profile.map((point) => new Vector2(point.z, point.y)),
  )
    ? [...profile].reverse()
    : profile;
  const outline = samples.map((point) => new Vector2(point.z, point.y));
  const triangles = ShapeUtils.triangulateShape(outline, []);

  for (const [x, normal] of [
    [x0, [-1, 0, 0]],
    [x1, [1, 0, 0]],
  ] as const) {
    for (const triangle of triangles) {
      const first = vertexIndex(positions);

      for (const corner of triangle) {
        positions.push(x, samples[corner].y, samples[corner].z);
      }

      addOrientedTriangle(
        indices,
        positions,
        first,
        first + 1,
        first + 2,
        normal,
      );
    }
  }

  const rings: (readonly [number, number] | null)[] = samples.map(() => null);
  const ringAt = (index: number): readonly [number, number] => {
    const cached = rings[index];

    if (cached) {
      return cached;
    }

    const first = vertexIndex(positions);

    positions.push(
      x0,
      samples[index].y,
      samples[index].z,
      x1,
      samples[index].y,
      samples[index].z,
    );

    const ring: readonly [number, number] = [first, first + 1];

    if (samples[index].smooth) {
      rings[index] = ring;
    }

    return ring;
  };

  for (let index = 0; index < samples.length; index += 1) {
    const next = (index + 1) % samples.length;
    const from = samples[index];
    const to = samples[next];
    const start = ringAt(index);
    const end = ringAt(next);

    addOrientedQuad(
      indices,
      positions,
      start[0],
      end[0],
      end[1],
      start[1],
      [0, from.z - to.z, to.y - from.y],
    );
  }

  return finalizeGeometry(positions, indices);
}

/**
 * Подставка отдельной деталью: простая ножка или массивное основание.
 *
 * База держит литофан на столе: спереди её край выходит за рамку, сзади уходит
 * на 38–52 мм — центр тяжести наклонённой панели остаётся над опорой. Передняя
 * губа не даёт рамке съехать вперёд, задняя стойка наклонена на 12° и повторяет
 * наклон панели: рамка опирается на неё всей плоскостью, а не ребром. Стойка,
 * база и губа — один профиль, выдавленный по ширине детали: между ними нет
 * стыков, поэтому нет и шва, по которому деталь отламывается. Панель
 * опускается в паз сверху — клей не нужен.
 *
 * Координаты те же, что у собранного литофана: стол — Y = 0, тыльная плоскость
 * рамки проходит через (Y = baseTop, Z = 0). Стойка стоит на 0.2 мм впереди неё:
 * в сборке она входит в тыл рамки, и слайсер видит один объект. Поэтому панель,
 * вставленная в напечатанную подставку, сдвинута вперёд на те же 0.2 мм, а
 * зазор до губы остаётся прежним.
 */
export function createLithophaneStandGeometry(
  params: Partial<LithophaneParams>,
): BufferGeometry {
  const normalized = normalizeLithophaneParams(params);
  const metrics = lithophaneFrameMetrics(normalized);
  const shape = standShape(normalized.lithoMount);
  const width = normalized.lithophaneWidth;
  const standWidth = Math.min(
    width,
    Math.max(shape.minWidth, width * shape.widthFactor),
  );
  const tilt = (LITHOPHANE_STAND_TILT_DEG * Math.PI) / 180;
  // Стойка заходит в тыл рамки на BODY_OVERLAP_MM: иначе в собранном файле два
  // тела только касались бы плоскостями и слайсер видел бы два объекта. Панель
  // от нахлёста сдвигается вперёд, поэтому губа отодвигается на ту же величину и
  // зазор посадки остаётся LITHOPHANE_FIT_GAP_MM.
  const lipBack =
    metrics.frontZ * Math.cos(tilt) + LITHOPHANE_FIT_GAP_MM + BODY_OVERLAP_MM;

  return smoothGeometryNormals(
    createProfilePrismBody(
      createStandProfile(shape, lipBack),
      -standWidth / 2,
      standWidth / 2,
    ),
  );
}

/**
 * Собирает литофан по детали: рельеф, рамка, подставка или всё сразу.
 *
 * `all` — собранный вид для предпросмотра и печати одним файлом: плита вставлена
 * в рамку, а с подставкой вся сборка наклонена на 12° и стоит в пазе; задняя
 * стойка подставки входит в тыл рамки, поэтому детали держатся друг за друга.
 * Без рамки крепления нет (его паз вырезан в рамке), поэтому `all` возвращает
 * плиту.
 * Если деталь недоступна — например, `frame` при выключенной рамке, — функция
 * отдаёт рельеф: предпросмотр не должен падать из-за состояния формы. API такие
 * запросы отклоняет до построения.
 *
 * На собранную сетку вешаются группы материалов: рельеф и крепление красятся
 * по-разному (см. `LITHOPHANE_RELIEF_GROUP`), но остаются одной сеткой, поэтому
 * вес, габарит и STL считаются как раньше.
 */
export function createLithophaneGeometry(
  params: Partial<LithophaneParams>,
  part: LithophanePart = "all",
): BufferGeometry {
  const normalized = normalizeLithophaneParams(params);

  if (part === "relief" || !normalized.lithoFrame) {
    return markPartGroup(
      createLithophaneReliefGeometry(normalized),
      LITHOPHANE_RELIEF_GROUP,
    );
  }

  if (part === "frame") {
    return markPartGroup(
      createLithophaneFrameGeometry(normalized),
      LITHOPHANE_DETAIL_GROUP,
    );
  }

  if (part === "stand") {
    return markPartGroup(
      createLithophaneStandGeometry(normalized),
      LITHOPHANE_DETAIL_GROUP,
    );
  }

  const metrics = lithophaneFrameMetrics(normalized);
  const relief = createLithophaneReliefGeometry(normalized);
  // Порядок слияния задаёт диапазоны индексов: рельеф идёт первым, поэтому его
  // группа занимает начало сетки.
  const reliefIndices = relief.getIndex()?.count ?? 0;
  const frame = createLithophaneFrameGeometry(normalized);
  const bodies = [relief, frame];

  // Плита входит в окно с зазором и ложится на заднюю полку: по X она уже окна
  // на зазор с каждой стороны, по Y — на зазор сверху и снизу.
  relief.translate(
    0,
    metrics.frameWidth + LITHOPHANE_FIT_GAP_MM,
    metrics.plateBack,
  );

  if (lithophaneHasStand(normalized.lithoMount)) {
    const tilt = new Matrix4().makeRotationX(
      -(LITHOPHANE_STAND_TILT_DEG * Math.PI) / 180,
    );
    const baseTop = standShape(normalized.lithoMount).baseTop;

    for (const body of bodies) {
      // Наклон вокруг ребра (Y = 0, Z = 0), затем перенос на верх базы: так
      // тыл рамки ложится на наклонную стойку подставки.
      body.applyMatrix4(tilt);
      body.translate(0, baseTop, 0);
    }

    bodies.push(createLithophaneStandGeometry(normalized));
  }

  return assignMaterialGroups(mergeBodies(bodies, "литофана"), reliefIndices);
}

