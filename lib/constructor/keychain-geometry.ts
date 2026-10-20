import { ExtrudeGeometry, Path, Shape, ShapeGeometry } from "three";
import type { BufferGeometry } from "three";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import type { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { KEYCHAIN_SILHOUETTES } from "@/lib/constructor/keychain-shapes";
import {
  normalizeKeychainParams,
  type KeychainParams,
} from "@/lib/constructor/params";
import {
  isPointInsideOutline,
  outlineArea,
  parseSvgOutline,
  type OutlinePoint,
} from "@/lib/constructor/svg-outline";

/**
 * Геометрия брелока: SVG-силуэт, ушко под кольцо, NFC-карман и имя.
 *
 * Основа лежит в плоскости XY, толщина идёт по Z от 0 до thickness. Такой
 * файл уже стоит на столе слайсера: нижняя грань на Z = 0, рельеф имени
 * выступает вверх. В предпросмотре группа поворачивается на -90° вокруг X,
 * чтобы брелок лежал на виртуальном столе.
 *
 * SVG разбирается без DOM (lib/constructor/svg-outline.ts): на сервере нет
 * DOMParser, а SVGLoader из three.js падает уже на импорте. Контур
 * масштабируется с сохранением пропорций в габарит ширины, нижняя точка
 * встаёт на bottom, а сверху остаётся место под ушко.
 *
 * Ушко — отдельная замкнутая оболочка: круг радиусом 4.4 мм с отверстием
 * 4 мм, который перекрывает верх силуэта на 1 мм. Поэтому кольцо проходит
 * сквозь пластик при любой форме, даже если верхушка узкая (звезда, молния).
 *
 * Имя не вырезается, а пересекается с основой: буквы уходят внутрь на
 * TEXT_EMBED_MM и выступают на TEXT_RELIEF_MM. Каждая оболочка замкнута
 * отдельно, слайсер объединяет их при печати.
 */

/** Публичный путь шрифта: его грузит браузер и читает серверный роут. */
export const KEYCHAIN_FONT_URL = "/fonts/cyrillic.typeface.json";

/** Диаметр отверстия под кольцо, мм. */
export const KEYCHAIN_HOLE_DIAMETER_MM = 4;

/** Радиус отверстия: он же половина ширины ушка. */
const HOLE_RADIUS_MM = KEYCHAIN_HOLE_DIAMETER_MM / 2;

/** Радиус ушка: 2 мм отверстия плюс 2.4 мм пластика по краю. */
const EYELET_TAB_RADIUS_MM = 4.4;

/** Насколько центр ушка выше верхней точки силуэта, мм. */
const EYELET_INSET_MM = 3.4;

/** Сколько высоты сверху оставляем под ушко, мм. */
const EYELET_RESERVE_MM = 8;

/** Размер NFC-метки, мм: стандартный квадратный стикер 25 × 25. */
const NFC_CAVITY_MM = 25;

/** Глубина кармана под метку, мм. */
const NFC_DEPTH_MM = 1;

/** Минимальная толщина пластика над карманом, мм. */
const NFC_TOP_MM = 0.4;

/** Перекрытие заднего и переднего слоёв вокруг кармана, мм. */
const NFC_JOIN_MM = 0.05;

/** Минимальная сторона кармана: меньше 10 мм метка не помещается. */
const NFC_MIN_CAVITY_MM = 10;

/** Скругление кромок: не больше 0.3 мм, иначе тонкая основа теряет лицо. */
const EDGE_BEVEL_MM = 0.3;

/** Доля толщины, которую может занять фаска сверху и снизу. */
const EDGE_BEVEL_SHARE = 0.12;

/** Число сегментов фаски: на 0.3 мм трёх хватает. */
const EDGE_BEVEL_SEGMENTS = 3;

/** Сегменты скруглённых контуров и отверстия. */
const CURVE_SEGMENTS = 24;

/** Отступ текста от боковых кромок, мм. */
const TEXT_EDGE_MARGIN_MM = 3;

/** Зазор между нижней точкой ушка и верхом текста, мм. */
const TEXT_HOLE_GAP_MM = 1.5;

/** Насколько имя выступает над лицом брелока, мм. */
const TEXT_RELIEF_MM = 0.8;

/** Скругление кромок букв, мм. */
const TEXT_BEVEL_MM = 0.1;

/** Насколько буквы уходят внутрь основы для прочного соединения, мм. */
const TEXT_EMBED_MM = 0.35;

/** Сегменты контуров букв: 8 достаточно для мелкого рельефа. */
const TEXT_CURVE_SEGMENTS = 8;

/** Сегменты фаски букв. */
const TEXT_BEVEL_SEGMENTS = 2;

/** Внешний контур силуэта и отверстия внутри него. */
type ContourGroup = {
  outer: OutlinePoint[];
  holes: OutlinePoint[][];
};

/** Разобранный силуэт в миллиметрах с готовым положением ушка. */
type KeychainOutline = {
  groups: ContourGroup[];
  contours: OutlinePoint[][];
  eyeletY: number;
};

/** Квадратный карман под NFC-метку, вписанный в силуэт. */
type NfcCavity = {
  half: number;
  centerX: number;
  centerY: number;
};

/** Фаска кромок: доля толщины, но не больше 0.3 мм. */
function edgeBevel(thickness: number): number {
  return Math.min(EDGE_BEVEL_MM, thickness * EDGE_BEVEL_SHARE);
}

/**
 * Переносит контуры SVG в миллиметры: ось Y переворачивается, пропорции
 * сохраняются, ширина и высота вписываются в свободное место.
 *
 * Сверху резервируется EYELET_RESERVE_MM под ушко — так габарит брелока
 * остаётся равным длине из слайдера, хотя отверстие находится выше силуэта.
 */
function transformContours(
  contours: readonly (readonly OutlinePoint[])[],
  params: KeychainParams,
  bevel: number,
): OutlinePoint[][] {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const contour of contours) {
    for (const [x, y] of contour) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  const spanX = maxX - minX;
  const spanY = maxY - minY;

  if (
    !Number.isFinite(spanX) ||
    !Number.isFinite(spanY) ||
    spanX <= 0 ||
    spanY <= 0
  ) {
    return [];
  }

  // Запас 4 × фаски: у острых вершин (звезда, молния) смещение кромки идёт
  // по нормали и выступает дальше bevelSize, поэтому 2 × фаски мало.
  const availableWidth = params.width - bevel * 4;
  const availableHeight = params.length - EYELET_RESERVE_MM - bevel * 4;
  const scale = Math.min(availableWidth / spanX, availableHeight / spanY);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const bottom = -params.length / 2 + bevel;
  const offsetY = bottom + (spanY * scale) / 2;

  return contours.map((contour) =>
    contour.map(
      ([x, y]) =>
        [
          (x - centerX) * scale,
          offsetY - (y - centerY) * scale,
        ] as const,
    ),
  );
}

/** Центр контура: средняя точка, по ней определяется вложенность. */
function contourCenter(points: readonly OutlinePoint[]): OutlinePoint {
  let x = 0;
  let y = 0;

  for (const point of points) {
    x += point[0];
    y += point[1];
  }

  return [x / points.length, y / points.length];
}

/**
 * Делит контуры на внешние и отверстия по правилу чётности.
 *
 * Вложенность считается по центру контура: контур внутри другого — отверстие,
 * отверстие внутри отверстия снова становится телом. Каждое отверстие
 * привязывается к ближайшему внешнему контуру с наименьшей площадью, поэтому
 * глаз рыбы или окно ракеты не «прилипают» к чужому силуэту.
 */
function groupContours(contours: readonly OutlinePoint[][]): ContourGroup[] {
  const centers = contours.map(contourCenter);
  const areas = contours.map((contour) => Math.abs(outlineArea(contour)));
  // Вложенность считается по вершине контура, а не по центру: у кольца центр
  // внешнего прямоугольника лежит внутри отверстия, и по центру внешний
  // контур ошибочно стал бы дырой. Контейнер обязан быть больше по площади,
  // поэтому концентрические окружности не путают направления вложенности.
  const depths = contours.map((contour, index) =>
    contours.reduce((depth, other, otherIndex) => {
      if (otherIndex === index || areas[otherIndex] <= areas[index]) {
        return depth;
      }

      return isPointInsideOutline(contour[0], [other]) ? depth + 1 : depth;
    }, 0),
  );
  const groups: ContourGroup[] = [];

  contours.forEach((contour, index) => {
    if (depths[index] % 2 === 0) {
      groups.push({ outer: [...contour], holes: [] });
    }
  });

  contours.forEach((contour, index) => {
    if (depths[index] % 2 === 0) {
      return;
    }

    let target: ContourGroup | null = null;
    let targetArea = Infinity;

    for (const group of groups) {
      if (!isPointInsideOutline(centers[index], [group.outer])) {
        continue;
      }

      const area = Math.abs(outlineArea(group.outer));

      if (area < targetArea) {
        target = group;
        targetArea = area;
      }
    }

    target?.holes.push([...contour]);
  });

  return groups;
}


/** Shape из набора точек: обход замыкается через closePath. */
function createShape(points: readonly OutlinePoint[]): Shape {
  const shape = new Shape();
  const [first, ...rest] = points;

  shape.moveTo(first[0], first[1]);

  for (const point of rest) {
    shape.lineTo(point[0], point[1]);
  }

  shape.closePath();

  return shape;
}

/** Path отверстия из набора точек. */
function createHolePath(points: readonly OutlinePoint[]): Path {
  const path = new Path();
  const [first, ...rest] = points;

  path.moveTo(first[0], first[1]);

  for (const point of rest) {
    path.lineTo(point[0], point[1]);
  }

  path.closePath();

  return path;
}

/** Прямоугольный карман как отверстие заднего слоя. */
function createCavityPath(cavity: NfcCavity): Path {
  const path = new Path();

  path.moveTo(cavity.centerX - cavity.half, cavity.centerY - cavity.half);
  path.lineTo(cavity.centerX + cavity.half, cavity.centerY - cavity.half);
  path.lineTo(cavity.centerX + cavity.half, cavity.centerY + cavity.half);
  path.lineTo(cavity.centerX - cavity.half, cavity.centerY + cavity.half);
  path.closePath();

  return path;
}

/** Собирает THREE.Shape из групп контуров, при необходимости с карманом. */
function buildShapes(
  groups: readonly ContourGroup[],
  cavity: NfcCavity | null,
): Shape[] {
  return groups.map((group) => {
    const shape = createShape(group.outer);

    for (const hole of group.holes) {
      shape.holes.push(createHolePath(hole));
    }

    if (
      cavity &&
      isPointInsideOutline([cavity.centerX, cavity.centerY], [group.outer])
    ) {
      shape.holes.push(createCavityPath(cavity));
    }

    return shape;
  });
}

/** Точка внутри квадрата кармана с запасом на погрешность. */
function pointInCavity(
  point: OutlinePoint,
  centerX: number,
  centerY: number,
  half: number,
): boolean {
  return (
    Math.abs(point[0] - centerX) <= half + 1e-6 &&
    Math.abs(point[1] - centerY) <= half + 1e-6
  );
}

/** Пересечение двух отрезков, включая касание. */
function segmentsIntersect(
  a: OutlinePoint,
  b: OutlinePoint,
  c: OutlinePoint,
  d: OutlinePoint,
): boolean {
  const cross = (
    p: OutlinePoint,
    q: OutlinePoint,
    r: OutlinePoint,
  ): number => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);

  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

/**
 * Проверка, что карман не пересекает ни внешнюю кромку, ни отверстия.
 *
 * Углов и середин сторон мало: логотип с круглым вырезом посередине может
 * пропустить квадрат между проверяемыми точками, и тогда два отверстия
 * пересекутся — ExtrudeGeometry даст незамкнутые рёбра. Поэтому ребра
 * внешнего контура проверяются на пересечение с рамкой кармана, а контуры
 * отверстий — на попадание внутрь неё.
 */
function cavityFits(
  groups: readonly ContourGroup[],
  centerX: number,
  centerY: number,
  half: number,
): boolean {
  const corners: OutlinePoint[] = [
    [centerX - half, centerY - half],
    [centerX + half, centerY - half],
    [centerX + half, centerY + half],
    [centerX - half, centerY + half],
  ];

  for (const group of groups) {
    for (let index = 0; index < group.outer.length; index += 1) {
      const a = group.outer[index];
      const b = group.outer[(index + 1) % group.outer.length];

      if (
        pointInCavity(a, centerX, centerY, half) ||
        pointInCavity(b, centerX, centerY, half)
      ) {
        return false;
      }

      for (let edge = 0; edge < 4; edge += 1) {
        if (
          segmentsIntersect(a, b, corners[edge], corners[(edge + 1) % 4])
        ) {
          return false;
        }
      }
    }

    for (const hole of group.holes) {
      if (hole.some((point) => pointInCavity(point, centerX, centerY, half))) {
        return false;
      }

      if (
        corners.some((corner) => isPointInsideOutline(corner, [hole]))
      ) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Вписывает квадрат NFC-метки в силуэт.
 *
 * Квадрат проверяется по углам, серединам сторон и центру, затем — по
 * пересечению с кромками и отверстиями. Если 25 мм не помещаются, сторона
 * уменьшается шагом 0.25 мм; карман меньше 10 мм не имеет смысла, поэтому
 * тогда он не вырезается вовсе. Фаска расширяет материал в отверстие, поэтому
 * запас 2 × bevel возвращает карману номинальные 25 мм на поверхности.
 */
function findCavity(
  groups: readonly ContourGroup[],
  bevel: number,
): NfcCavity | null {
  const contours = groups.flatMap((group) => [group.outer, ...group.holes]);
  const points = groups.flatMap((group) => group.outer);
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

  // Сначала пробуем центр силуэта, а если там мешает отверстие логотипа —
  // сдвигаем карман по сетке. Для звезды и молнии 25 мм не помещаются нигде:
  // карман уменьшается, а если и 10 мм не влезает, NFC-углубление не режется.
  const offsetX = (maxX - minX) / 8;
  const offsetY = (maxY - minY) / 8;
  const candidates: OutlinePoint[] = [[(minX + maxX) / 2, (minY + maxY) / 2]];

  for (let row = -3; row <= 3; row += 1) {
    for (let column = -3; column <= 3; column += 1) {
      candidates.push([
        (minX + maxX) / 2 + column * offsetX,
        (minY + maxY) / 2 + row * offsetY,
      ]);
    }
  }

  for (
    let half = NFC_CAVITY_MM / 2 + bevel;
    half >= NFC_MIN_CAVITY_MM / 2;
    half -= 0.25
  ) {
    for (const [centerX, centerY] of candidates) {
      const samples: OutlinePoint[] = [
        [centerX - half, centerY - half],
        [centerX + half, centerY - half],
        [centerX + half, centerY + half],
        [centerX - half, centerY + half],
        [centerX, centerY - half],
        [centerX + half, centerY],
        [centerX, centerY + half],
        [centerX - half, centerY],
        [centerX, centerY],
      ];

      if (
        samples.every((point) => isPointInsideOutline(point, contours)) &&
        cavityFits(groups, centerX, centerY, half)
      ) {
        return { half, centerX, centerY };
      }
    }
  }

  return null;
}

/**
 * Высота центра ушка.
 *
 * Верхняя точка берётся около оси X: у кошки и собаки самые высокие точки —
 * кончики ушей по краям, но ушко должно стоять над головой, а не на ухе.
 * Ушко перекрывает силуэт на 1 мм и не выходит за длину из слайдера.
 */
function findEyeletY(groups: readonly ContourGroup[], length: number): number {
  let topCenter = -Infinity;
  let top = -Infinity;

  for (const group of groups) {
    const points = group.outer;

    for (let index = 0; index < points.length; index += 1) {
      const [x1, y1] = points[index];
      const [x2, y2] = points[(index + 1) % points.length];

      top = Math.max(top, y1);

      if (Math.abs(x1) <= 2.5) {
        topCenter = Math.max(topCenter, y1);
      }

      // Прямые участки парсер не дробит: верхняя грань жетона — одна линия
      // от угла до угла, и вершин около оси X у неё нет. Пересечение ребра с
      // осью даёт настоящую высоту силуэта в центре.
      if ((x1 <= 0 && x2 >= 0) || (x2 <= 0 && x1 >= 0)) {
        const ratio = Math.abs(x1 - x2) < 1e-9 ? 0 : (0 - x1) / (x2 - x1);
        topCenter = Math.max(topCenter, y1 + (y2 - y1) * ratio);
      }
    }
  }

  const base = Number.isFinite(topCenter) ? topCenter : top + 2;
  const maximum = length / 2 - EYELET_TAB_RADIUS_MM - 0.1;

  return Math.min(base + EYELET_INSET_MM, maximum);
}

/** Разбирает выбранный силуэт и ставит его в габариты брелока. */
function createOutline(params: KeychainParams, bevel: number): KeychainOutline {
  const custom =
    params.keychainShape === "custom" && params.customSvgData.trim()
      ? params.customSvgData
      : null;
  const builtin =
    params.keychainShape === "custom"
      ? KEYCHAIN_SILHOUETTES.dog_tag
      : KEYCHAIN_SILHOUETTES[params.keychainShape];
  const svg = custom ?? builtin;

  let contours = parseSvgOutline(svg);

  if (contours.length === 0) {
    contours = parseSvgOutline(KEYCHAIN_SILHOUETTES.dog_tag);
  }

  if (contours.length === 0) {
    throw new Error("Не удалось разобрать силуэт брелока");
  }

  const transformed = transformContours(contours, params, bevel);
  const groups = groupContours(transformed);

  if (groups.length === 0) {
    throw new Error("У силуэта брелока нет замкнутого контура");
  }

  return {
    groups,
    contours: transformed,
    eyeletY: findEyeletY(groups, params.length),
  };
}


/**
 * Выдавливает Shape на заданный слой по Z.
 *
 * Полная высота ExtrudeGeometry равна depth + 2 × bevel, поэтому depth
 * уменьшается на фаски, а сдвиг на bevel ставит нижнюю грань ровно на startZ.
 * Так задний и передний слои NFC-кармана стыкуются без щели.
 */
function extrudeShape(
  shape: Shape,
  startZ: number,
  height: number,
  bevel: number,
): BufferGeometry {
  const depth = Math.max(height - bevel * 2, 0.05);
  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: EDGE_BEVEL_SEGMENTS,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: CURVE_SEGMENTS,
    depth,
    steps: 1,
  });

  geometry.translate(0, 0, startZ + bevel);

  return geometry;
}

/**
 * Ушко: круг с отверстием под кольцо.
 *
 * Центр стоит выше верхней точки силуэта, а нижняя четверть круга перекрывает
 * силуэт на 1 мм — отдельная оболочка приваривается к основе при печати.
 */
function createEyeletTab(centerY: number): Shape {
  const shape = new Shape();

  shape.absarc(0, centerY, EYELET_TAB_RADIUS_MM, 0, Math.PI * 2, false);
  shape.closePath();

  const hole = new Path();
  hole.absarc(0, centerY, HOLE_RADIUS_MM, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  return shape;
}

/**
 * Основа целиком: силуэт (при NFC — два слоя с карманом) и ушко.
 *
 * Без NFC силуэт выдавливается на полную толщину одной оболочкой. С карманом
 * задний слой идёт от 0 до recess + join и содержит квадратное отверстие,
 * передний — от recess до thickness. Карман открыт снизу, а над ним остаётся
 * ровно NFC_TOP_MM пластика; перекрытие 0.05 мм не даёт слоям разойтись.
 */
function createBaseGeometry(
  params: KeychainParams,
  outline: KeychainOutline,
): BufferGeometry {
  const bevel = edgeBevel(params.thickness);
  const cavity = params.nfcEnabled ? findCavity(outline.groups, bevel) : null;
  const recess = Math.min(NFC_DEPTH_MM, params.thickness - NFC_TOP_MM);
  const parts: BufferGeometry[] = [];

  if (cavity && recess > 0.2) {
    const backHeight = Math.min(recess + NFC_JOIN_MM, params.thickness);
    const frontHeight = params.thickness - recess;

    for (const shape of buildShapes(outline.groups, cavity)) {
      parts.push(extrudeShape(shape, 0, backHeight, bevel));
    }

    for (const shape of buildShapes(outline.groups, null)) {
      parts.push(extrudeShape(shape, recess, frontHeight, bevel));
    }
  } else {
    for (const shape of buildShapes(outline.groups, null)) {
      parts.push(extrudeShape(shape, 0, params.thickness, bevel));
    }
  }

  parts.push(extrudeShape(createEyeletTab(outline.eyeletY), 0, params.thickness, bevel));

  const merged = mergeGeometries(parts);

  for (const part of parts) {
    part.dispose();
  }

  if (!merged) {
    throw new Error("Не удалось объединить силуэт брелока и ушко");
  }

  return merged;
}


/**
 * Габариты текста при размере 1.
 *
 * TextGeometry строит контуры по глифам, но чтобы выбрать итоговый кегль,
 * нужны ширина и высота до выдавливания. ShapeGeometry даёт их без лишней
 * геометрии; после замера временная сетка освобождается.
 */
function measureText(
  text: string,
  font: Font,
): { width: number; height: number } | null {
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

  return { width, height };
}

/**
 * Ширина силуэта в полосе текста.
 *
 * У звезды и молнии на уровне середины контур узкий, поэтому имя не должно
 * вылезать за пластик. Берём горизонтальный размах внешних контуров между
 * нижней кромкой текста и ушком: кегль и центр подбираются по нему.
 */
function measureTextBand(
  groups: readonly ContourGroup[],
  bottom: number,
  top: number,
): { center: number; width: number } | null {
  let minX = Infinity;
  let maxX = -Infinity;

  for (const group of groups) {
    for (const [x, y] of group.outer) {
      if (y < bottom || y > top) {
        continue;
      }

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || maxX <= minX) {
    return null;
  }

  return { center: (minX + maxX) / 2, width: maxX - minX };
}

/**
 * Выдавленное имя на лицевой стороне.
 *
 * Кегль выбирается по меньшему из двух ограничений: ширина силуэта в полосе
 * текста минус отступы и свободная высота между нижней кромкой и ушком.
 * Длинное имя становится мельче, короткое не упирается в кольцо. Центр
 * текста — середина полосы под ушком, а не всей заготовки.
 *
 * Возвращает null, если строка пустая или не помещается в 2 мм ширины.
 */
function createTextGeometry(
  params: KeychainParams,
  font: Font,
  outline: KeychainOutline,
): BufferGeometry | null {
  const text = params.text.trim();

  if (!text) {
    return null;
  }

  const measured = measureText(text, font);

  if (!measured) {
    return null;
  }

  const halfLength = params.length / 2;
  const holeBottom = outline.eyeletY - HOLE_RADIUS_MM;
  const textTop = holeBottom - TEXT_HOLE_GAP_MM;
  const textBottom = -halfLength + TEXT_EDGE_MARGIN_MM;
  const band = measureTextBand(outline.groups, textBottom, textTop);
  const availableWidth = band
    ? band.width - TEXT_EDGE_MARGIN_MM * 2
    : params.width - TEXT_EDGE_MARGIN_MM * 2;
  const availableHeight = Math.max(textTop - textBottom, 1);

  if (availableWidth < 2) {
    return null;
  }

  const size = Math.min(
    availableWidth / measured.width,
    availableHeight / measured.height,
  );

  if (!Number.isFinite(size) || size <= 0) {
    return null;
  }

  const textCenterY = (textTop + textBottom) / 2;
  const textCenterX = band ? band.center : 0;

  // Имя не должно висеть над вырезом логотипа: если центр полосы попал в
  // отверстие, буквы не с чем соединить. Лучше показать чистый силуэт, чем
  // отдельные плавающие оболочки в STL.
  if (!isPointInsideOutline([textCenterX, textCenterY], outline.contours)) {
    return null;
  }

  // Мелкое имя при 10 символах на узком брелоке: фаска 0.1 мм съедала бы
  // тонкие перемычки букв. Уменьшаем её вместе с кеглем, но не больше 0.1.
  const bevel = Math.min(TEXT_BEVEL_MM, size * 0.03);
  const geometry = new TextGeometry(text, {
    bevelEnabled: true,
    bevelSegments: TEXT_BEVEL_SEGMENTS,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: TEXT_CURVE_SEGMENTS,
    depth: Math.max(TEXT_RELIEF_MM - bevel * 2, 0.1),
    font,
    size,
  });

  geometry.computeBoundingBox();

  const box = geometry.boundingBox;

  if (!box) {
    geometry.dispose();
    return null;
  }

  const geometryCenterY = (box.min.y + box.max.y) / 2;
  const geometryCenterX = (box.min.x + box.max.x) / 2;
  // Нижняя грань текста после translateZ оказывается на
  // thickness - TEXT_EMBED_MM, верхняя — на thickness + TEXT_RELIEF_MM -
  // TEXT_EMBED_MM. Буквы входят в основу и не отрываются от неё.
  const translateZ = params.thickness - TEXT_EMBED_MM + bevel;

  geometry.translate(
    textCenterX - geometryCenterX,
    textCenterY - geometryCenterY,
    translateZ,
  );

  return geometry;
}


/**
 * Собирает брелок в одну сетку.
 *
 * font = null допустим для предпросмотра, пока JSON шрифта ещё грузится:
 * сцена показывает силуэт без имени, а после загрузки пересобирает его.
 * Серверный экспорт передаёт шрифт всегда.
 *
 * mergeGeometries копирует данные в новую сетку; исходные оболочки
 * освобождаются сразу, чтобы слайдер не оставлял мусор в памяти.
 */
export function createKeychainGeometry(
  params: Partial<KeychainParams>,
  font: Font | null = null,
): BufferGeometry {
  const normalized = normalizeKeychainParams(params);
  const outline = createOutline(normalized, edgeBevel(normalized.thickness));
  const base = createBaseGeometry(normalized, outline);

  if (!font) {
    base.computeBoundingBox();
    base.computeBoundingSphere();

    return base;
  }

  const text = createTextGeometry(normalized, font, outline);

  if (!text) {
    base.computeBoundingBox();
    base.computeBoundingSphere();

    return base;
  }

  const merged = mergeGeometries([base, text]);

  base.dispose();
  text.dispose();

  if (!merged) {
    throw new Error("Не удалось объединить основу брелока и текст");
  }

  merged.computeBoundingBox();
  merged.computeBoundingSphere();

  return merged;
}
