import { ExtrudeGeometry } from "three";
import type { BufferGeometry } from "three";
import type { Font } from "three/examples/jsm/loaders/FontLoader.js";
import type { Vector2 } from "three";

import type { KeychainTextAlign } from "@/lib/constructor/params";
import {
  buildShapes,
  type ContourGroup,
} from "@/lib/constructor/shape-utils";
import type { OutlinePoint } from "@/lib/constructor/svg-outline";

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

/** Строка раскладки: контуры и габарит одной строки до выравнивания. */
type KeychainTextRow = {
  groups: ContourGroup[];
  height: number;
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
};

/**
 * Строки надписи.
 *
 * `content` хранит переводы строк как есть, поэтому одна функция делит его на ровно
 * те строки, которые увидят и панель, и геометрия.
 */
export function splitKeychainTextLines(content: string): string[] {
  return content.split("\n").map((line) => line.trim());
}

/** Блок надписи: контуры всех строк в координатах блока и его габарит. */
export type KeychainTextBlock = {
  /** Контуры букв: внешний контур и отверстия, как их понимает Earcut. */
  groups: ContourGroup[];
  /** Высота блока, мм: от верха первой строки до низа последней. */
  height: number;
  /** Ширина блока, мм: по самой длинной строке. */
  width: number;
};

/** Точки пути шрифта в контур без повторов и замыкающей точки.
 *
 * `Shape.getPoints()` возвращает замкнутый обход: последняя точка равна первой.
 * Для выдавливания это безвредно, а вот отверстие плиты с нулевым отрезком ломает
 * триангуляцию крышки — в плите с окном буквы «А» оставалось 14 незамкнутых рёбер.
 * Поэтому повторяющиеся подряд точки и замыкающая отбрасываются здесь, один раз,
 * чтобы обе ветки рельефа получали чистый контур.
 */
function pathOutline(points: Vector2[]): OutlinePoint[] {
  const outline: OutlinePoint[] = [];

  for (const point of points) {
    const last = outline[outline.length - 1];

    if (
      last &&
      Math.abs(last[0] - point.x) < 1e-6 &&
      Math.abs(last[1] - point.y) < 1e-6
    ) {
      continue;
    }

    outline.push([point.x, point.y]);
  }

  const first = outline[0];
  const last = outline[outline.length - 1];

  if (
    outline.length > 1 &&
    first &&
    last &&
    Math.abs(first[0] - last[0]) < 1e-6 &&
    Math.abs(first[1] - last[1]) < 1e-6
  ) {
    outline.pop();
  }

  return outline;
}

/**
 * Раскладка строк в один блок.
 *
 * Каждая строка генерируется шрифтом отдельно (`generateShapes`), поэтому
 * межстрочный интервал — это шаг `lineHeight · size`, а не вынос глифа: на любом
 * кегле строки стоят на одном расстоянии. Выравнивание сдвигает строку внутри
 * блока: при `center` короткая вторая строка встаёт по центру первой, при `right`
 * — по её правому краю. Пустая строка шага не занимает: перевод строки только
 * разделяет строки, а не создаёт пустые.
 *
 * Контуры переводятся в точки сразу: по ним строятся и выдавливание
 * (`buildShapes`), и плита углублённого рельефа — раскладка у обоих видов одна.
 */
export function keychainTextBlock(options: {
  align: KeychainTextAlign;
  font: Font;
  lineHeight: number;
  size: number;
  text: string;
}): KeychainTextBlock {
  const step = options.size * options.lineHeight;
  const rows: KeychainTextRow[] = [];

  for (const line of splitKeychainTextLines(options.text)) {
    if (!line) {
      continue;
    }

    const groups: ContourGroup[] = options.font
      .generateShapes(line, options.size)
      .map((shape) => ({
        holes: shape.holes.map((hole) =>
          pathOutline(hole.getPoints(TEXT_CURVE_SEGMENTS)),
        ),
        outer: pathOutline(shape.getPoints(TEXT_CURVE_SEGMENTS)),
      }));

    if (groups.length === 0) {
      continue;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const group of groups) {
      for (const [x, y] of group.outer) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }

    rows.push({ groups, height: maxY - minY, maxX, maxY, minX, minY });
  }

  const width = rows.reduce(
    (widest, row) => Math.max(widest, row.maxX - row.minX),
    0,
  );

  if (rows.length === 0 || width <= 0) {
    return { groups: [], height: 0, width: 0 };
  }

  const groups: ContourGroup[] = [];
  let height = 0;

  rows.forEach((row, index) => {
    const lineWidth = row.maxX - row.minX;
    const shiftX =
      options.align === "left"
        ? -row.minX
        : options.align === "right"
          ? width - lineWidth - row.minX
          : (width - lineWidth) / 2 - row.minX;
    const shiftY = -index * step;
    const move = ([x, y]: OutlinePoint): OutlinePoint => [
      x + shiftX,
      y + shiftY,
    ];

    for (const group of row.groups) {
      groups.push({
        holes: group.holes.map((hole) => hole.map(move)),
        outer: group.outer.map(move),
      });
    }

    height = Math.max(height, (rows.length - index - 1) * step + row.height);
  });

  return { groups, height, width };
}

/**
 * Габарит блока кеглем 1, мм.
 *
 * По этим числам выбирается кегль: они линейны по размеру, поэтому
 * `size = min(полоса / габарит)` даёт блок, вписанный в свободную полосу. `null` —
 * в надписи нет ни одной буквы.
 */
export function measureKeychainTextBlock(options: {
  align: KeychainTextAlign;
  font: Font;
  lineHeight: number;
  text: string;
}): KeychainTextMetrics | null {
  const block = keychainTextBlock({ ...options, size: 1 });

  return block.width > 0 && block.height > 0
    ? { height: block.height, width: block.width }
    : null;
}

/**
 * Габарит прямоугольника после поворота, мм.
 *
 * Это AABB по четырём углам: сложная геометрия пересечений не нужна, потому что
 * проверка постановки всё равно идёт по прямоугольнику. Для 45° габарит растёт в
 * `√2` раз, для 90° стороны меняются местами.
 */
export function keychainRotatedSize(
  size: KeychainTextMetrics,
  rotationDeg: number,
): KeychainTextMetrics {
  const radians = (rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));

  return {
    height: size.height * cos + size.width * sin,
    width: size.width * cos + size.height * sin,
  };
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
/**
 * Выдавленный блок надписи, поставленный на грань.
 *
 * Кегль и центр приходят готовыми: кегль выбирает вызывающий по свободной полосе,
 * центр — `placeKeychainText` с учётом ручного смещения. `depth` — высота букв над
 * пластиком из панели; внутрь тела буква по-прежнему входит на
 * `KEYCHAIN_TEXT_EMBED_MM`.
 *
 * Строки собираются в один блок: раскладка считает габарит, блок центрируется в
 * нуле и поворачивается на `rotation` вокруг своего центра, поэтому 45° не уводит
 * имя вбок. На лице буквы растут вверх от `thickness − внедрение`, на обороте —
 * вниз от `внедрение`; оборотная строка повёрнута на 180° вокруг X и читается
 * после переворота детали (её собственный поворот при этом зеркалится: 45° на
 * обороте выглядят с лица как −45°).
 */
export function createKeychainTextGeometry(options: {
  align: KeychainTextAlign;
  centerX: number;
  centerY: number;
  depth: number;
  font: Font;
  lineHeight: number;
  rotation: number;
  side: KeychainTextSide;
  size: number;
  text: string;
  thickness: number;
}): BufferGeometry | null {
  const block = keychainTextBlock({
    align: options.align,
    font: options.font,
    lineHeight: options.lineHeight,
    size: options.size,
    text: options.text,
  });

  if (block.groups.length === 0) {
    return null;
  }

  const relief = keychainTextReliefMm(options.depth);
  // Мелкое имя при десятке символов на узком брелоке: фаска 0.1 мм съедала бы
  // тонкие перемычки букв, поэтому она ужимается вместе с кеглем.
  const bevel = Math.min(TEXT_BEVEL_MM, options.size * 0.03);
  const geometry = new ExtrudeGeometry(buildShapes(block.groups), {
    bevelEnabled: true,
    bevelSegments: TEXT_BEVEL_SEGMENTS,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: TEXT_CURVE_SEGMENTS,
    depth: Math.max(relief - bevel * 2, 0.1),
  });

  geometry.computeBoundingBox();

  const box = geometry.boundingBox;

  if (!box) {
    geometry.dispose();

    return null;
  }

  // Центр по габариту, а не по началу координат шрифта: у глифов разный вынос, и
  // без этого блок уезжал бы вбок.
  geometry.translate(
    -(box.min.x + box.max.x) / 2,
    -(box.min.y + box.max.y) / 2,
    0,
  );
  geometry.rotateZ((options.rotation * Math.PI) / 180);

  if (options.side === "back") {
    geometry.rotateX(Math.PI);
  }

  // Лицо: нижняя грань буквы встаёт на `thickness − внедрение`.
  // Оборот: верхняя грань буквы встаёт на `внедрение`, буква уходит вниз.
  const translateZ =
    options.side === "front"
      ? options.thickness - KEYCHAIN_TEXT_EMBED_MM + bevel
      : KEYCHAIN_TEXT_EMBED_MM - bevel;

  geometry.translate(options.centerX, options.centerY, translateZ);

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
 * Доля площади самой большой плоскости, при которой плоскость ещё считается гранью.
 *
 * Грань — не обязательно самая большая крышка: у детали с карманом под NFC верхний
 * колпак лежит поверх крышки кармана и вдвое меньше её по сумме треугольников,
 * зато именно он и есть лицо. Порог отсекает мелочь вроде площадок шипов, а среди
 * оставшихся кандидатов гранью считается самая внешняя плоскость.
 */
const FACE_SHARE = 0.4;

/**
 * Плоскость грани: самая внешняя крышка размера грани.
 *
 * Крышки выдавливания лежат на постоянном Z, поэтому каждая плоскость — набор
 * треугольников с одинаковой высотой. Прежнее правило «берём самую большую по
 * площади» ломалось на слоёной геометрии: у Apple Tag с карманом под NFC крышка
 * кармана на 3.0 мм и колпак над ней делят одну плоскость, площадь считается по
 * обоим слоям сразу и перевешивает настоящее лицо на 3.5 мм. Лицом становилась
 * внутренняя плоскость, всё, что выше, попадало в «чужой рельеф», и карта грани
 * блокировалась целиком — рельеф на такую грань не ставился вовсе.
 *
 * Поэтому кандидаты — все плоскости не меньше `FACE_SHARE` от самой крупной, а
 * из них берётся крайняя: сверху для лица, снизу для оборота. Площадки шипов и
 * вершины ступицы не проходят порог, борт билета меньше лица, так что силуэты
 * без слоёв находят грань как раньше.
 */
function facePlane(
  planes: Map<number, number>,
  side: KeychainTextSide,
  middleZ: number,
): number | null {
  let largest = 0;

  for (const [key, area] of planes) {
    const z = key * PLANE_TOLERANCE_MM;
    const onSide = side === "front" ? z >= middleZ : z <= middleZ;

    if (onSide && area > largest) {
      largest = area;
    }
  }

  if (largest <= 0) {
    return null;
  }

  const minArea = largest * FACE_SHARE;
  let faceKey: number | null = null;
  let faceZ = 0;

  for (const [key, area] of planes) {
    const z = key * PLANE_TOLERANCE_MM;
    const onSide = side === "front" ? z >= middleZ : z <= middleZ;

    if (!onSide || area < minArea) {
      continue;
    }

    if (faceKey === null || (side === "front" ? z > faceZ : z < faceZ)) {
      faceKey = key;
      faceZ = z;
    }
  }

  return faceKey;
}


/**
 * Карта грани: сетка ячеек и признак «занято».
 *
 * Занятая ячейка — это место, куда буква не встанет: вне пластика, чужой
 * рельеф, кромка силуэта или сквозное отверстие. Запас до всех препятствий уже
 * вложен в карту, поэтому проверка постановки сводится к «все ячейки под строкой
 * свободны». Внутренняя полость кармана под NFC-метку ячейки не занимает: лицо
 * над ней сплошное.
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
 * считается чужим рельефом: шипы кирпича, ступица шестерни, борт билета.
 * Расширение на `BAND_MARGIN_MM` даёт свободной ячейке запас до кромки и до
 * сквозных дырок.
 *
 * Внутренняя полость кармана под NFC-метку в карту не входит. Карман — это
 * выемка в толще детали: снизу сплошное дно, сверху сплошная крышка, а наружная
 * плоскость лица над ним целая. Рельеф ставится на неё и выступает наружу, ничего
 * не проваливая. Поэтому лицо у брелока с карманом свободно ровно так же, как без
 * него, и логотип не приходится ужимать.
 */
export function buildFaceMask(
  geometry: BufferGeometry,
  side: KeychainTextSide,
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
  // Площадь считается отдельно по направлению обмотки: у слоёной детали соседние
  // слои делят плоскость, и внутренняя крышка снизу колпака суммировалась бы с
  // настоящей гранью, перевешивая её.
  const upPlanes = new Map<number, number>();
  const downPlanes = new Map<number, number>();

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
      const signed =
        (xs[1] - xs[0]) * (ys[2] - ys[0]) - (ys[1] - ys[0]) * (xs[2] - xs[0]);
      const area = Math.abs(signed) / 2;
      const oriented = signed >= 0 ? upPlanes : downPlanes;

      planes.set(planeKey, (planes.get(planeKey) ?? 0) + area);
      oriented.set(planeKey, (oriented.get(planeKey) ?? 0) + area);
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return null;
  }

  const outward = side === "front" ? upPlanes : downPlanes;
  const faceKey = facePlane(
    outward.size > 0 ? outward : planes,
    side,
    (minZ + maxZ) / 2,
  );

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
    minHeight?: number;
    minWidth?: number;
    side: KeychainTextSide;
  },
): KeychainFaceBand | null {
  const mask = buildFaceMask(geometry, options.side);

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
 * Ставит блок надписи на грань с учётом ручного смещения.
 *
 * Кегль по-прежнему выбирается по самой широкой полосе, но теперь по габариту
 * повёрнутого блока: для 45° это AABB прямоугольника, для 90° — те же стороны
 * наоборот. Смещение двигает готовый блок, а не растягивает его. Дальше каждая
 * ось обрезается свободной картой — сначала X, потом Y, — поэтому буквы не
 * выходят за грань, не наезжают на отверстие под кольцо и не попадают на чужой
 * рельеф.
 *
 * `mask` передаёт вызывающий, когда рельефов несколько: карта одной стороны
 * общая, и каждая поставленная декорация вычитается из неё же, становясь
 * препятствием для следующей. Без `mask` карта строится по телу заново — так
 * функция работает для одиночной надписи и в проверках.
 *
 * `null` — на этой стороне места под буквы нет.
 */
export function placeKeychainText(
  geometry: BufferGeometry,
  options: {
    mask?: FaceMask;
    metrics: KeychainTextMetrics;
    offsetX?: number;
    offsetY?: number;
    rotation?: number;
    side: KeychainTextSide;
  },
): KeychainTextPlacement | null {
  const mask = options.mask ?? buildFaceMask(geometry, options.side);

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

  // Кегль выбирается по габариту повёрнутого блока: AABB после поворота шире
  // исходного прямоугольника, и без этой поправки 45° вылезал бы за полосу.
  const rotated = keychainRotatedSize(options.metrics, options.rotation ?? 0);
  const size = Math.min(
    band.width / rotated.width,
    band.height / rotated.height,
  );

  if (!Number.isFinite(size) || size <= 0) {
    return null;
  }

  const span = {
    height: rotated.height * size,
    width: rotated.width * size,
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
 * Стоит ли прямоугольник рельефа целиком на свободных ячейках.
 *
 * Карта уже несёт запас `BAND_MARGIN_MM`, поэтому «свободно» значит «не ближе
 * запаса к кромке, отверстию и чужому рельефу». Выход за сетку — тоже отказ: за
 * ней детали нет, и рельеф висел бы в воздухе.
 *
 * Функция общая с картинкой: повёрнутому логотипу считать AABB по маске дороже,
 * чем проверить его прямоугольник, а запас карты делает проверку честной.
 */
export function rectFits(
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


