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
 *
 * Смещение строки — просьба, а не приказ: `placeKeychainText` двигает надпись по
 * той же карте и обрезает смещение шагами сетки, как только прямоугольник строки
 * упирается в кромку, отверстие или чужой рельеф. Буквы останавливаются на
 * границе свободного места, а не уезжают с детали. Толщина рельефа приходит из
 * параметров (`textDepth`) и меняет только выступающую часть: внедрение в тело
 * остаётся прежним.
 */

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
 * Толщина выдавливания буквы, мм: рельеф над пластиком плюс внедрение в тело.
 *
 * Слайдер задаёт только то, что видно и щупается — высоту букв над основой.
 * Внедрение остаётся неизменным при любой толщине: оболочки букв и тела
 * пересекаются объёмом, и слайсер печатает их одной деталью. Поэтому рельеф
 * 0.2 мм даёт 0.55 мм выдавливания, а 1 мм — 1.35 мм.
 */
export function keychainTextReliefMm(depth: number): number {
  return Math.max(depth, 0.1) + KEYCHAIN_TEXT_EMBED_MM;
}

/**
 * Выдавленная строка, поставленная на грань.
 *
 * Кегль и центр приходят готовыми: кегль выбирает вызывающий по свободной
 * полосе, центр — `placeKeychainText` с учётом ручного смещения. `depth` — это
 * высота букв над пластиком из панели; внутрь тела буква по-прежнему входит на
 * `KEYCHAIN_TEXT_EMBED_MM`. На лице буквы растут вверх от `thickness − внедрение`,
 * на обороте — вниз от `внедрение`. Оборотная строка повёрнута на 180° вокруг X:
 * поворот собственный, поэтому обход треугольников остаётся правильным, а буквы
 * читаются после переворота детали.
 */
export function createKeychainTextGeometry(options: {
  centerX: number;
  centerY: number;
  depth: number;
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

  const relief = keychainTextReliefMm(options.depth);
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
export type FaceGrid = {
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
 * Карта грани: сетка ячеек и признак «занято».
 *
 * Занятая ячейка — это место, куда буква не встанет: вне пластика, чужой
 * рельеф, кромка силуэта, сквозное отверстие или полость кармана. Запас до всех
 * препятствий уже вложен в карту, поэтому проверка постановки сводится к «все
 * ячейки под строкой свободны».
 */
export type FaceMask = {
  blocked: Uint8Array;
  grid: FaceGrid;
};

/**
 * Растеризует грань брелока в карту занятых ячеек.
 *
 * Плоскость грани — самая большая крышка со своей стороны. Треугольники этой
 * плоскости закрашивают пластик, а всё, что выше на лице или ниже на обороте,
 * считается чужим рельефом: шипы кирпича, ступица шестерни, борт билета. Вырезы
 * кармана NFC добавляются отдельно, а расширение на `BAND_MARGIN_MM` даёт
 * свободной ячейке запас до кромки и до сквозных дырок.
 */
export function buildFaceMask(
  geometry: BufferGeometry,
  side: KeychainTextSide,
  keepOut: readonly KeychainTextKeepOut[] | undefined,
): FaceMask | null {
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

  const faceKey = facePlane(planes, side, (minZ + maxZ) / 2);

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
      side === "front"
        ? Math.max(zs[0], zs[1], zs[2]) > faceZ + PLANE_TOLERANCE_MM
        : Math.min(zs[0], zs[1], zs[2]) < faceZ - PLANE_TOLERANCE_MM;

    if (raised) {
      stampTriangle(blocked, grid, xs[0], ys[0], xs[1], ys[1], xs[2], ys[2]);
    }
  }

  // Полость кармана NFC закрыта крышкой, но буква входит в тело на 0.35 мм и
  // прорезала бы её почти насквозь, поэтому круг выреза блокируется как дырка.
  for (const circle of keepOut ?? []) {
    stampKeepOut(blocked, grid, circle);
  }

  for (let cell = 0; cell < total; cell += 1) {
    if (!solid[cell] || blocked[cell]) {
      blocked[cell] = 1;
    }
  }

  dilate(blocked, grid, Math.max(1, Math.round(BAND_MARGIN_MM / grid.cell)));

  return { blocked, grid };
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
  const mask = buildFaceMask(geometry, options.side, options.keepOut);

  return mask
    ? findWidestBand(mask.blocked, mask.grid, {
        minHeight: options.minHeight ?? BAND_MIN_HEIGHT_MM,
        minWidth: options.minWidth ?? BAND_MIN_WIDTH_MM,
      })
    : null;
}

/** Готовая постановка строки: центр и кегль, с которыми буквы идут в модель. */
export type KeychainTextPlacement = {
  centerX: number;
  centerY: number;
  /** Кегль строки, мм. */
  size: number;
};

/**
 * Ставит строку на грань с учётом ручного смещения.
 *
 * Кегль по-прежнему выбирается по самой широкой полосе: смещение двигает готовую
 * строку, а не растягивает её. Дальше каждая ось обрезается свободной картой —
 * сначала X, потом Y, — поэтому буквы не выходят за грань, не наезжают на
 * отверстие под кольцо и не попадают на чужой рельеф. `null` — на этой стороне
 * места под буквы нет.
 */
export function placeKeychainText(
  geometry: BufferGeometry,
  options: {
    keepOut?: readonly KeychainTextKeepOut[];
    metrics: KeychainTextMetrics;
    offsetX?: number;
    offsetY?: number;
    side: KeychainTextSide;
  },
): KeychainTextPlacement | null {
  const mask = buildFaceMask(geometry, options.side, options.keepOut);

  if (!mask) {
    return null;
  }

  const band = findWidestBand(mask.blocked, mask.grid, {
    minHeight: BAND_MIN_HEIGHT_MM,
    minWidth: BAND_MIN_WIDTH_MM,
  });

  if (!band) {
    return null;
  }

  const size = Math.min(
    band.width / options.metrics.width,
    band.height / options.metrics.height,
  );

  if (!Number.isFinite(size) || size <= 0) {
    return null;
  }

  const span = {
    height: options.metrics.height * size,
    width: options.metrics.width * size,
  };
  const centerX = clampTextOffset(
    mask,
    { centerX: band.centerX, centerY: band.centerY },
    span,
    options.offsetX ?? 0,
    "x",
  );
  const centerY = clampTextOffset(
    mask,
    { centerX, centerY: band.centerY },
    span,
    options.offsetY ?? 0,
    "y",
  );

  return { centerX, centerY, size };
}

/**
 * Смещение строки по одной оси, обрезанное свободной картой.
 *
 * Просьба пользователя исполняется, пока прямоугольник строки стоит на пластике
 * целиком. Кончилось место — смещение отступает к центру полосы шагами сетки:
 * буквы останавливаются на границе свободного поля, а не уезжают с детали.
 * Соседняя ось берётся уже обрезанной, поэтому итог всегда лежит на свободных
 * ячейках.
 */
function clampTextOffset(
  mask: FaceMask,
  base: { centerX: number; centerY: number },
  span: { height: number; width: number },
  offset: number,
  axis: "x" | "y",
): number {
  const from = axis === "x" ? base.centerX : base.centerY;

  if (!Number.isFinite(offset) || offset === 0) {
    return from;
  }

  const { cell, columns, minX, minY, rows } = mask.grid;
  // Центр строки не подходит к кромке сетки ближе половины её габарита: за
  // сеткой детали уже нет.
  const lowCenter =
    axis === "x" ? minX + span.width / 2 : minY + span.height / 2;
  const highCenter =
    axis === "x"
      ? minX + columns * cell - span.width / 2
      : minY + rows * cell - span.height / 2;
  const reach = Math.min(
    Math.abs(offset),
    Math.max(Math.min(highCenter - from, from - lowCenter), 0),
  );
  const sign = offset < 0 ? -1 : 1;
  let steps = Math.floor(reach / cell);

  while (steps > 0) {
    const candidate = from + sign * steps * cell;

    if (
      rectFits(
        mask.blocked,
        mask.grid,
        axis === "x" ? candidate : base.centerX,
        axis === "x" ? base.centerY : candidate,
        span.width,
        span.height,
      )
    ) {
      return candidate;
    }

    steps -= 1;
  }

  return from;
}

/**
 * Стоит ли прямоугольник строки целиком на свободных ячейках.
 *
 * Карта уже несёт запас `BAND_MARGIN_MM`, поэтому «свободно» значит «не ближе
 * запаса к кромке, отверстию и чужому рельефу». Выход за сетку — тоже отказ: за
 * ней детали нет, и буквы висели бы в воздухе.
 */
function rectFits(
  blocked: Uint8Array,
  grid: FaceGrid,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
): boolean {
  const left = centerX - width / 2;
  const right = centerX + width / 2;
  const bottom = centerY - height / 2;
  const top = centerY + height / 2;

  if (
    left < grid.minX ||
    bottom < grid.minY ||
    right > grid.minX + grid.columns * grid.cell ||
    top > grid.minY + grid.rows * grid.cell
  ) {
    return false;
  }

  const rows = cellSpan(bottom, top, grid.minY, grid.cell, grid.rows);
  const columns = cellSpan(left, right, grid.minX, grid.cell, grid.columns);

  for (let row = rows.first; row <= rows.last; row += 1) {
    for (let column = columns.first; column <= columns.last; column += 1) {
      if (blocked[row * grid.columns + column]) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Ячейки, в чьи центры попал промежуток.
 *
 * Карта закрашивалась по центрам ячеек, поэтому и проверка идёт по ним. Иначе
 * прямоугольник, равный полосе по высоте, задевал бы крайнюю строку, которая в
 * полосу уже не входит, и смещение не двигало бы буквы вовсе.
 */
function cellSpan(
  low: number,
  high: number,
  origin: number,
  cell: number,
  limit: number,
): { first: number; last: number } {
  const first = Math.max(0, Math.ceil((low - origin) / cell - 0.5));
  const last = Math.min(limit - 1, Math.floor((high - origin) / cell - 0.5));

  if (first > last) {
    const middle = Math.min(
      limit - 1,
      Math.max(0, Math.round(((low + high) / 2 - origin) / cell - 0.5)),
    );

    return { first: middle, last: middle };
  }

  return { first, last };
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
export function findWidestBand(
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
/**
 * Закрашивает в карте грани проекцию готовой оболочки.
 *
 * Нужно картинке: надпись приходит отдельной сеткой, а карта грани построена по
 * телу без неё, поэтому буквы сами становятся препятствием для логотипа. Зазор
 * `gapMm` расширяет закраску после штампа — рельефы не должны слипаться на
 * печати, иначе картинка срастается с буквами в одно пятно.
 *
 * Треугольники берутся в проекции XY: поперёк толщины рельеф стоит на своём
 * месте, а высота при поиске пятна не важна.
 */
export function stampFaceObstacle(
  target: Uint8Array,
  grid: FaceGrid,
  geometry: BufferGeometry,
  gapMm: number,
): void {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const cornerCount = index ? index.count : position.count;
  const vertexAt = (corner: number): number =>
    index ? index.getX(corner) : corner;

  for (let corner = 0; corner + 2 < cornerCount; corner += 3) {
    const [first, second, third] = [0, 1, 2].map((point) =>
      vertexAt(corner + point),
    );

    stampTriangle(
      target,
      grid,
      position.getX(first),
      position.getY(first),
      position.getX(second),
      position.getY(second),
      position.getX(third),
      position.getY(third),
    );
  }

  dilate(target, grid, Math.max(1, Math.round(gapMm / grid.cell)));
}


