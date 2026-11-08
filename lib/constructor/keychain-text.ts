import { ShapeGeometry } from "three";
import type { BufferGeometry } from "three";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import type { Font } from "three/examples/jsm/loaders/FontLoader.js";

/**
 * Надпись на брелоке: подбор кегля, выдавливание и поиск свободной полосы.
 *
 * Модуль появился, когда имена понадобились пресетам: раньше
 * `createKeychainGeometry` возвращал геометрию пресета целиком и до шага текста
 * не доходил, поэтому надпись работала только у своего SVG-контура. Подбор кегля
 * и выдавливание вынесены сюда, чтобы обе ветки шли одним путём.
 *
 * Свободную полосу ищем по готовой сетке, а не по формулам силуэта. У каждого
 * пресета своё лицо: у кирпича сетка шипов, у шестерни ступица, у билета щели
 * перфорации, у сердца выемка между долями. Растеризация крышки в карту 0.4 мм
 * даёт точный ответ «здесь на уровне лица есть пластик», и одна функция
 * обслуживает все восемь силуэтов: новый пресет получает надпись без правок.
 *
 * Сторон две. Лицо — там, где верхняя крышка (Z = толщина), оборот — низ (Z = 0).
 * Если на лице полосы под буквы нет (у кирпича шипы занимают всё поле), надпись
 * уходит на оборот и зеркалится по Y: перевёрнутая вокруг оси X деталь читается
 * прямо. Отверстие под кольцо и щели сквозные, поэтому карта блокирует их на
 * обеих сторонах — буквы не могут наехать на кольцо ни там, ни там.
 */

/** Насколько буквы выступают над гранью, мм. */
export const KEYCHAIN_TEXT_RELIEF_MM = 0.8;

/**
 * Насколько буквы входят в основу, мм.
 *
 * Нижняя грань буквы лежит внутри тела: оболочки пересекаются объёмом, а не
 * касаются плоскостями, иначе слайсер увидел бы надпись отдельной деталью.
 */
export const KEYCHAIN_TEXT_EMBED_MM = 0.35;

/** Скругление кромок букв, мм: крупнее на мелком кегле съедало бы перемычки. */
const TEXT_BEVEL_MM = 0.1;

/** Два сегмента дают читаемую фаску буквы, не раздувая сетку. */
const TEXT_BEVEL_SEGMENTS = 2;

/** Сегменты контуров букв: 8 достаточно для рельефа в доли миллиметра. */
const TEXT_CURVE_SEGMENTS = 8;

/** Ячейка карты лица, мм: точность против скорости пересборки на слайдере. */
const BAND_CELL_MM = 0.4;

/** Отступ букв от кромки, отверстия и чужого рельефа, мм. */
const BAND_MARGIN_MM = 1.2;

/** Минимальная ширина полосы, мм: уже — имя не читается. */
const BAND_MIN_WIDTH_MM = 6;

/** Минимальная высота полосы, мм: это высота строки, а не кегль. */
const BAND_MIN_HEIGHT_MM = 2.5;

/** Допуск по Z при сравнении плоскостей, мм. */
const PLANE_TOLERANCE_MM = 1e-3;

/** Сторона брелока, на которой стоит надпись. */
export type KeychainTextSide = "front" | "back";

/** Свободная полоса на грани: прямоугольник, в который влезает строка. */
export type KeychainFaceBand = {
  /** Центр полосы по X, мм: у пресетов он на оси симметрии. */
  centerX: number;
  /** Центр полосы по Y, мм. */
  centerY: number;
  /** Высота полосы, мм. */
  height: number;
  /** Ширина полосы, мм. */
  width: number;
};

/** Габариты строки кеглем 1, мм: по ним выбирается итоговый размер. */
export type KeychainTextMetrics = {
  height: number;
  width: number;
};

/**
 * Круг, который надпись обязана обойти.
 *
 * Так задаётся полость кармана NFC: снаружи лицо целое, но над полостью остаётся
 * крышка 0.5 мм, и внедрение букв на 0.35 мм прорезало бы её почти насквозь.
 */
export type KeychainTextKeepOut = {
  centerX: number;
  centerY: number;
  radius: number;
};


/**
 * Ширина и высота строки кеглем 1.
 *
 * `TextGeometry` выдавливает глифы, но размер нужен до этого: `ShapeGeometry`
 * отдаёт габарит контуров без лишней геометрии, после замера временная сетка
 * освобождается.
 */
export function measureKeychainText(
  text: string,
  font: Font,
): KeychainTextMetrics | null {
  const shapes = font.generateShapes(text, 1);

  if (shapes.length === 0) {
    return null;
  }

  const probe = new ShapeGeometry(shapes);

  probe.computeBoundingBox();

  const box = probe.boundingBox;

  probe.dispose();

  if (!box) {
    return null;
  }

  const width = box.max.x - box.min.x;
  const height = box.max.y - box.min.y;

  if (width <= 0 || height <= 0) {
    return null;
  }

  return { height, width };
}

/**
 * Толщина рельефа при заданной толщине брелока, мм.
 *
 * Рельеф не съедает основу: под буквами всегда остаётся 0.4 мм пластика, иначе
 * на тонкой основе имя превратилось бы в сквозную дырку. При толщине от 1.2 мм
 * ограничение не работает вовсе — 0.8 мм меньше обоих пределов.
 */
export function keychainTextReliefMm(thickness: number): number {
  return Math.min(KEYCHAIN_TEXT_RELIEF_MM, Math.max(thickness - 0.4, 0.3));
}

/**
 * Выдавленная строка, поставленная на грань.
 *
 * Кегль приходит готовым: его выбирает вызывающий по свободной полосе. На лице
 * буквы растут вверх от `thickness − внедрение`, на обороте — вниз от
 * `внедрение`. Оборотная строка повёрнута на 180° вокруг X: поворот
 * собственный, поэтому обход треугольников остаётся правильным, а буквы
 * читаются после переворота детали.
 */
export function createKeychainTextGeometry(options: {
  centerX: number;
  centerY: number;
  font: Font;
  side: KeychainTextSide;
  size: number;
  text: string;
  thickness: number;
}): BufferGeometry | null {
  const text = options.text.trim();

  if (!text) {
    return null;
  }

  const relief = keychainTextReliefMm(options.thickness);
  // Мелкое имя при десятке символов на узком брелоке: фаска 0.1 мм съедала бы
  // тонкие перемычки букв, поэтому она ужимается вместе с кеглем.
  const bevel = Math.min(TEXT_BEVEL_MM, options.size * 0.03);
  const geometry = new TextGeometry(text, {
    bevelEnabled: true,
    bevelSegments: TEXT_BEVEL_SEGMENTS,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: TEXT_CURVE_SEGMENTS,
    depth: Math.max(relief - bevel * 2, 0.1),
    font: options.font,
    size: options.size,
  });

  if (options.side === "back") {
    geometry.rotateX(Math.PI);
  }

  geometry.computeBoundingBox();

  const box = geometry.boundingBox;

  if (!box) {
    geometry.dispose();

    return null;
  }

  // Центр по габариту, а не по началу координат шрифта: у глифов разный
  // вынос, и без этого строка уезжала бы вбок.
  const geometryCenterX = (box.min.x + box.max.x) / 2;
  const geometryCenterY = (box.min.y + box.max.y) / 2;
  // Лицо: нижняя грань буквы встаёт на `thickness − внедрение`.
  // Оборот: верхняя грань буквы встаёт на `внедрение`, буква уходит вниз.
  const translateZ =
    options.side === "front"
      ? options.thickness - KEYCHAIN_TEXT_EMBED_MM + bevel
      : KEYCHAIN_TEXT_EMBED_MM - bevel;

  geometry.translate(
    options.centerX - geometryCenterX,
    options.centerY - geometryCenterY,
    translateZ,
  );

  return geometry;
}

/** Карта грани: начало сетки и её размеры в ячейках. */
type FaceGrid = {
  /** Сторона ячейки, мм. */
  cell: number;
  /** Столбцов по X. */
  columns: number;
  /** Левый край сетки, мм. */
  minX: number;
  /** Нижний край сетки, мм. */
  minY: number;
  /** Строк по Y. */
  rows: number;
};

/**
 * Закрашивает ячейки, чьи центры попали внутрь треугольника.
 *
 * Тест барицентрический: у треугольника с площадью `s` все три векторных
 * произведения точки и рёбер имеют знак `s`. Точки обходятся по габариту
 * треугольника, поэтому стоимость пропорциональна его площади, а не всей сетке.
 */
function stampTriangle(
  target: Uint8Array,
  grid: FaceGrid,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): void {
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);

  if (Math.abs(area) < 1e-9) {
    return;
  }

  const sign = area > 0 ? 1 : -1;
  const firstColumn = cellIndex(
    Math.min(ax, bx, cx) - grid.cell,
    grid.minX,
    grid.cell,
    grid.columns,
  );
  const lastColumn = cellIndex(
    Math.max(ax, bx, cx) + grid.cell,
    grid.minX,
    grid.cell,
    grid.columns,
  );
  const firstRow = cellIndex(
    Math.min(ay, by, cy) - grid.cell,
    grid.minY,
    grid.cell,
    grid.rows,
  );
  const lastRow = cellIndex(
    Math.max(ay, by, cy) + grid.cell,
    grid.minY,
    grid.cell,
    grid.rows,
  );

  for (let row = firstRow; row <= lastRow; row += 1) {
    const y = grid.minY + (row + 0.5) * grid.cell;

    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const x = grid.minX + (column + 0.5) * grid.cell;
      const first = sign * ((bx - ax) * (y - ay) - (by - ay) * (x - ax));
      const second = sign * ((cx - bx) * (y - by) - (cy - by) * (x - bx));
      const third = sign * ((ax - cx) * (y - cy) - (ay - cy) * (x - cx));

      if (first >= 0 && second >= 0 && third >= 0) {
        target[row * grid.columns + column] = 1;
      }
    }
  }
}

/** Индекс столбца или строки по координате, мм. */
function cellIndex(
  value: number,
  origin: number,
  cell: number,
  limit: number,
): number {
  const index = Math.floor((value - origin) / cell);

  return Math.min(Math.max(index, 0), limit - 1);
}

/**
 * Круг выреза, который надо обойти, в ячейках карты.
 *
 * Радиус сразу с отступом: буква не должна подходить к полости кармана ближе
 * `BAND_MARGIN_MM`, как и к кромке силуэта.
 */
function stampKeepOut(
  target: Uint8Array,
  grid: FaceGrid,
  keepOut: KeychainTextKeepOut,
): void {
  const radius = keepOut.radius + BAND_MARGIN_MM;
  const firstColumn = cellIndex(
    keepOut.centerX - radius,
    grid.minX,
    grid.cell,
    grid.columns,
  );
  const lastColumn = cellIndex(
    keepOut.centerX + radius,
    grid.minX,
    grid.cell,
    grid.columns,
  );
  const firstRow = cellIndex(
    keepOut.centerY - radius,
    grid.minY,
    grid.cell,
    grid.rows,
  );
  const lastRow = cellIndex(
    keepOut.centerY + radius,
    grid.minY,
    grid.cell,
    grid.rows,
  );

  for (let row = firstRow; row <= lastRow; row += 1) {
    const y = grid.minY + (row + 0.5) * grid.cell;

    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const x = grid.minX + (column + 0.5) * grid.cell;

      if (Math.hypot(x - keepOut.centerX, y - keepOut.centerY) <= radius) {
        target[row * grid.columns + column] = 1;
      }
    }
  }
}


/**
 * Расширяет занятые ячейки на `radius` во все стороны.
 *
 * Два прохода — по строкам и по столбцам — дают квадратное расширение без
 * обхода окрестности каждой ячейки: это тот же отступ от кромки, но в восемь раз
 * дешевле. После него свободная ячейка гарантированно лежит не ближе
 * `radius × cell` от любого препятствия.
 */
function dilate(mask: Uint8Array, grid: FaceGrid, radius: number): void {
  const { columns, rows } = grid;
  const horizontal = new Uint8Array(mask.length);

  for (let row = 0; row < rows; row += 1) {
    const offset = row * columns;

    for (let column = 0; column < columns; column += 1) {
      const from = Math.max(0, column - radius);
      const to = Math.min(columns - 1, column + radius);
      let busy = 0;

      for (let probe = from; probe <= to; probe += 1) {
        if (mask[offset + probe]) {
          busy = 1;
          break;
        }
      }

      horizontal[offset + column] = busy;
    }
  }

  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      const from = Math.max(0, row - radius);
      const to = Math.min(rows - 1, row + radius);
      let busy = 0;

      for (let probe = from; probe <= to; probe += 1) {
        if (horizontal[probe * columns + column]) {
          busy = 1;
          break;
        }
      }

      mask[row * columns + column] = busy;
    }
  }
}

/**
 * Плоскость грани: самая большая крышка со своей стороны.
 *
 * Крышки выдавливания лежат на постоянном Z, поэтому каждая плоскость — набор
 * треугольников с одинаковой высотой. Берём ту, что набрала большую площадь: у
 * кирпича это верх тела, а не площадки шипов, у шестерни — тело, а не вершина
 * ступицы. Так лицо находится без знания конкретного пресета.
 */
function facePlane(
  planes: Map<number, number>,
  side: KeychainTextSide,
  middleZ: number,
): number | null {
  let faceKey: number | null = null;
  let faceArea = 0;

  for (const [key, area] of planes) {
    const z = key / 1000;
    const onSide = side === "front" ? z >= middleZ : z <= middleZ;

    if (!onSide || area <= faceArea) {
      continue;
    }

    faceArea = area;
    faceKey = key;
  }

  return faceKey;
}


/**
 * Ищет полосу на грани, куда влезает строка.
 *
 * Полоса — прямоугольник вокруг оси симметрии: у всех пресетов она проходит
 * через X = 0, а строка стоит по центру. Из карты берутся только те строки
 * ячеек, где ось свободна, поэтому отверстие под кольцо и щели перфорации делят
 * поле сами собой, без отдельной проверки: строка просто не может пересечь
 * сквозную дырку и остаться в одной непрерывной полосе.
 *
 * Возвращается лучшая по площади полоса, у которой ширина не меньше
 * `minWidth`, а высота — не меньше `minHeight`. `null` — места под буквы нет.
 */
export function findKeychainFaceBand(
  geometry: BufferGeometry,
  options: {
    keepOut?: readonly KeychainTextKeepOut[];
    minHeight?: number;
    minWidth?: number;
    side: KeychainTextSide;
  },
): KeychainFaceBand | null {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const cornerCount = index ? index.count : position.count;
  const vertexAt = (corner: number): number =>
    index ? index.getX(corner) : corner;
  const xs = [0, 0, 0];
  const ys = [0, 0, 0];
  const zs = [0, 0, 0];
  const readTriangle = (corner: number): void => {
    for (let point = 0; point < 3; point += 1) {
      const vertex = vertexAt(corner + point);

      xs[point] = position.getX(vertex);
      ys[point] = position.getY(vertex);
      zs[point] = position.getZ(vertex);
    }
  };

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const planes = new Map<number, number>();

  for (let corner = 0; corner + 2 < cornerCount; corner += 3) {
    readTriangle(corner);

    for (let point = 0; point < 3; point += 1) {
      minX = Math.min(minX, xs[point]);
      maxX = Math.max(maxX, xs[point]);
      minY = Math.min(minY, ys[point]);
      maxY = Math.max(maxY, ys[point]);
      minZ = Math.min(minZ, zs[point]);
      maxZ = Math.max(maxZ, zs[point]);
    }

    const planeKey = flatPlaneKey(zs);

    if (planeKey !== null) {
      const area =
        Math.abs(
          (xs[1] - xs[0]) * (ys[2] - ys[0]) - (ys[1] - ys[0]) * (xs[2] - xs[0]),
        ) / 2;

      planes.set(planeKey, (planes.get(planeKey) ?? 0) + area);
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return null;
  }

  const faceKey = facePlane(planes, options.side, (minZ + maxZ) / 2);

  if (faceKey === null) {
    return null;
  }

  const faceZ = faceKey * PLANE_TOLERANCE_MM;
  const grid: FaceGrid = {
    cell: BAND_CELL_MM,
    columns: Math.max(Math.ceil((maxX - minX) / BAND_CELL_MM), 1),
    minX,
    minY,
    rows: Math.max(Math.ceil((maxY - minY) / BAND_CELL_MM), 1),
  };
  const total = grid.columns * grid.rows;
  const solid = new Uint8Array(total);
  const blocked = new Uint8Array(total);

  for (let corner = 0; corner + 2 < cornerCount; corner += 3) {
    readTriangle(corner);

    if (flatPlaneKey(zs) === faceKey) {
      stampTriangle(solid, grid, xs[0], ys[0], xs[1], ys[1], xs[2], ys[2]);

      continue;
    }

    const raised =
      options.side === "front"
        ? Math.max(zs[0], zs[1], zs[2]) > faceZ + PLANE_TOLERANCE_MM
        : Math.min(zs[0], zs[1], zs[2]) < faceZ - PLANE_TOLERANCE_MM;

    if (raised) {
      stampTriangle(blocked, grid, xs[0], ys[0], xs[1], ys[1], xs[2], ys[2]);
    }
  }

  for (const keepOut of options.keepOut ?? []) {
    stampKeepOut(blocked, grid, keepOut);
  }

  for (let cell = 0; cell < total; cell += 1) {
    if (!solid[cell] || blocked[cell]) {
      blocked[cell] = 1;
    }
  }

  dilate(blocked, grid, Math.max(1, Math.round(BAND_MARGIN_MM / grid.cell)));

  return widestBand(blocked, grid, {
    minHeight: options.minHeight ?? BAND_MIN_HEIGHT_MM,
    minWidth: options.minWidth ?? BAND_MIN_WIDTH_MM,
  });
}


/** Ключ плоскости, если все три точки треугольника лежат на одном Z. */
function flatPlaneKey(zs: readonly number[]): number | null {
  const flat =
    Math.abs(zs[0] - zs[1]) < PLANE_TOLERANCE_MM &&
    Math.abs(zs[1] - zs[2]) < PLANE_TOLERANCE_MM;

  return flat ? Math.round(zs[0] / PLANE_TOLERANCE_MM) : null;
}

/**
 * Лучшая полоса по свободной карте грани.
 *
 * Для каждой нижней строки полоса тянется вверх, пока середина оси свободна:
 * ширина полосы — это минимум по её строкам, поэтому площадь считается сразу, а
 * перебор упирается в `minWidth`. Половина ячейки вычитается из ширины: края
 * карты округлены до ячейки, и без поправки буква подходила бы к кромке на
 * половину её размера ближе задуманного.
 */
function widestBand(
  blocked: Uint8Array,
  grid: FaceGrid,
  limits: { minHeight: number; minWidth: number },
): KeychainFaceBand | null {
  const { cell, columns, minX, minY, rows } = grid;
  const centerColumn = cellIndex(0, minX, cell, columns);
  const leftEdge = new Float64Array(rows).fill(Number.NaN);
  const rightEdge = new Float64Array(rows).fill(Number.NaN);

  for (let row = 0; row < rows; row += 1) {
    const offset = row * columns;

    if (blocked[offset + centerColumn]) {
      continue;
    }

    let left = centerColumn;
    let right = centerColumn;

    while (left > 0 && !blocked[offset + left - 1]) {
      left -= 1;
    }

    while (right < columns - 1 && !blocked[offset + right + 1]) {
      right += 1;
    }

    leftEdge[row] = minX + left * cell;
    rightEdge[row] = minX + (right + 1) * cell;
  }

  let best: { bottom: number; half: number; score: number; top: number } | null =
    null;

  for (let bottom = 0; bottom < rows; bottom += 1) {
    if (Number.isNaN(leftEdge[bottom])) {
      continue;
    }

    let half = Infinity;

    for (let top = bottom; top < rows; top += 1) {
      if (Number.isNaN(leftEdge[top])) {
        break;
      }

      half = Math.min(
        half,
        Math.min(-leftEdge[top], rightEdge[top]) - cell / 2,
      );

      if (half * 2 < limits.minWidth) {
        break;
      }

      const height = (top - bottom + 1) * cell;

      if (height < limits.minHeight) {
        continue;
      }

      const score = half * 2 * height;

      if (best === null || score > best.score) {
        best = { bottom, half, score, top };
      }
    }
  }

  if (best === null) {
    return null;
  }

  return {
    centerX: 0,
    centerY: minY + ((best.bottom + best.top + 1) / 2) * cell,
    height: (best.top - best.bottom + 1) * cell,
    width: best.half * 2,
  };
}

