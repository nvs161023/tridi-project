import { ExtrudeGeometry, Path, Shape } from "three";
import type { BufferGeometry } from "three";
import type { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { KEYCHAIN_FALLBACK_SVG } from "@/lib/constructor/keychain-fallback-shape";
import {
  createKeychainImageGeometry,
  keychainImageBuild,
  placeKeychainImage,
  type KeychainImageFit,
} from "@/lib/constructor/keychain-image";
import {
  buildKeychainPresetGeometry,
  nfcLayout,
  type KeychainPresetGeometryParams,
} from "@/lib/constructor/keychain-preset-geometry";
import {
  createKeychainTextGeometry,
  measureKeychainText,
  placeKeychainText,
  type KeychainTextKeepOut,
  type KeychainTextMetrics,
  type KeychainTextSide,
} from "@/lib/constructor/keychain-text";
import {
  keychainQrCardSpec,
  normalizeKeychainParams,
  type KeychainParams,
} from "@/lib/constructor/params";
import {
  buildShapes,
  groupContours,
  type ContourGroup,
} from "@/lib/constructor/shape-utils";
import {
  isPointInsideOutline,
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
 * Имя не вырезается, а пересекается с основой: буквы входят в тело на
 * `KEYCHAIN_TEXT_EMBED_MM` и выступают над пластиком на `textDepth` из панели
 * (`lib/constructor/keychain-text.ts`). Каждая оболочка замкнута отдельно,
 * слайсер объединяет их при печати. Тот же модуль ставит надпись и на пресеты:
 * свободную полосу он ищет по готовой сетке, поэтому шипы кирпича, ступица
 * шестерни и отверстие под кольцо обходятся без знания формул силуэта, а ручное
 * смещение обрезается по той же сетке.
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

/** Сторона квадратной NFC-метки, мм: стандартный стикер 25 × 25. */
export const KEYCHAIN_NFC_TAG_MM = 25;

/** Зазор вокруг метки на сторону, при котором она садится без подгонки, мм. */
export const KEYCHAIN_NFC_CLEARANCE_MM = 0.2;

/** Глубина кармана под метку, мм. */
const NFC_DEPTH_MM = 1;

/**
 * Минимальная толщина переднего слоя над карманом, мм.
 *
 * Это не «крышка кармана»: пластик над углублением равен
 * `толщина − глубина`, и при штатной толщине 3 мм его 1.95 мм (потолок кармана
 * на 1.05 мм, лицо на 3 мм). Константа ограничивает глубину только на тонкой
 * основе: `recess = min(NFC_DEPTH_MM, thickness − NFC_TOP_MM)`.
 */
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

/**
 * Насколько оборот предпочтительнее лица при равном кегле.
 *
 * Лицо — главная сторона, поэтому на оборот имя уходит только тогда, когда там
 * строка заметно крупнее: у кирпича шипы не оставляют на лице места вовсе, у
 * шестерни мешает ступица. При близких полосах выигрывает лицо.
 */
const TEXT_FRONT_PREFERENCE = 0.9;

/**
 * Шаг ручного смещения имени у своего контура, мм.
 *
 * У пресета смещение обрезается по сетке грани, а у контура карты нет: место
 * проверяется по точкам прямоугольника, и шаг грубее сетки. Полмиллиметра всё
 * равно мельче того, что видно на трёхсантиметровом имени.
 */
const TEXT_OFFSET_STEP_MM = 0.5;


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

/** Слои NFC-кармана при заданной толщине основы, мм. */
export type KeychainNfcLayers = {
  /** Глубина кармана: потолок углубления, мм. */
  depth: number;
  /** Верх заднего слоя вместе с перекрытием: на этом слое ставится пауза, мм. */
  pauseZ: number;
  /** Толщина переднего слоя, мм. */
  frontHeight: number;
  /** Пластик над карманом: от потолка углубления до лица, мм. */
  topMm: number;
};

/**
 * Слои NFC-кармана — единственный источник правды для геометрии и подсказок.
 *
 * Карман открыт снизу: задний слой с квадратным отверстием печатается от 0 до
 * `pauseZ`, передний — от `depth` до `thickness`. Пауза возможна только на
 * верхе заднего слоя: выше начинается сплошной передний слой, и метку уже
 * некуда вложить. Поэтому `pauseZ` считается от глубины кармана, а не от
 * толщины минус `NFC_TOP_MM`: последняя формула давала 2.6 мм при толщине 3 мм,
 * то есть на 1.55 мм выше потолка кармана.
 */
export function keychainNfcLayers(thickness: number): KeychainNfcLayers {
  const depth = Math.max(0, Math.min(NFC_DEPTH_MM, thickness - NFC_TOP_MM));
  const pauseZ = Math.min(depth + NFC_JOIN_MM, thickness);

  return {
    depth,
    pauseZ,
    frontHeight: thickness - depth,
    topMm: Math.max(0, thickness - pauseZ),
  };
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

/**
 * Карман как отверстие силуэта: колбэк для `buildShapes` из shape-utils.
 *
 * Карман вырезается только в том внешнем контуре, внутри которого стоит его
 * центр: у составного силуэта (имя отдельными буквами) иначе появилась бы дыра
 * в чужой оболочке.
 */
function cavityHoles(
  cavity: NfcCavity,
): (outer: readonly OutlinePoint[]) => Path[] {
  return (outer: readonly OutlinePoint[]): Path[] =>
    isPointInsideOutline([cavity.centerX, cavity.centerY], [outer])
      ? [createCavityPath(cavity)]
      : [];
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
    let half = KEYCHAIN_NFC_TAG_MM / 2 + bevel;
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

/**
 * Разбирает контур брелока и ставит его в габариты.
 *
 * Форму даёт `customSvgData` — загруженный SVG или обводка картинки. Пока файл
 * не разобрался (или параметры пришли без него), берётся запасной жетон: пустой
 * предпросмотр выглядел бы поломкой, а такой файл всё равно не скачивается —
 * API требует непустой контур для `custom`. Пресет сюда не попадает: у него своя
 * геометрия, и `createKeychainGeometry` возвращает её раньше.
 */
function createOutline(params: KeychainParams, bevel: number): KeychainOutline {
  const custom =
    params.keychainShape === "custom" && params.customSvgData.trim()
      ? params.customSvgData
      : null;

  let contours = parseSvgOutline(custom ?? KEYCHAIN_FALLBACK_SVG);

  if (contours.length === 0 && custom) {
    contours = parseSvgOutline(KEYCHAIN_FALLBACK_SVG);
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

/** Замер NFC-кармана для интерфейса: что вырежется и куда ставить паузу. */
export type KeychainNfcFit = {
  /** Сторона квадрата кармана в свету, мм; 0 — карман не вырезается. */
  cavityMm: number;
  /** Зазор вокруг метки на сторону, мм; отрицательный — метка не влезает. */
  clearanceMm: number;
  /** Метка 25 × 25 мм садится в карман целиком. */
  fits: boolean;
  /** Слой паузы M600: верх заднего слоя, мм. */
  pauseZ: number;
  /** Пластик над карманом, мм. */
  topMm: number;
};

/**
 * Меряет карман теми же функциями, что и геометрия.
 *
 * Панель показывает предупреждение, только если карман действительно меньше
 * метки или не вырезается вовсе: у узкого своего контура под квадрат 25 мм места
 * может не быть, и раньше такой брелок молча уходил в печать. Возвращает null,
 * если контур не разобрался — тогда ошибку показывает загрузка контура, а не
 * NFC-плашка.
 */
export function measureKeychainNfc(
  params: Partial<KeychainParams>,
): KeychainNfcFit | null {
  const normalized = normalizeKeychainParams(params);
  const bevel = edgeBevel(normalized.thickness);
  const layers = keychainNfcLayers(normalized.thickness);
  let groups: KeychainOutline["groups"];

  // У пресета кармана под метку нет: мерить силуэт, подставленный вместо него,
  // значило бы показать размеры кармана, которого не будет в модели.
  if (normalized.keychainPreset) {
    return null;
  }

  try {
    groups = createOutline(normalized, bevel).groups;
  } catch {
    return null;
  }

  const cavity = findCavity(groups, bevel);
  // Фаска поджимает отверстие у лица и у стола, поэтому в свету остаётся
  // квадрат без двух фасок — именно его видит метка.
  const cavityMm = cavity ? Math.max(0, 2 * (cavity.half - bevel)) : 0;
  const clearanceMm = (cavityMm - KEYCHAIN_NFC_TAG_MM) / 2;

  return {
    cavityMm,
    clearanceMm,
    fits: cavityMm > 0 && clearanceMm >= 0,
    pauseZ: layers.pauseZ,
    topMm: layers.topMm,
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
 * задний слой идёт от 0 до pauseZ и содержит квадратное отверстие, передний — от
 * depth до thickness. Карман открыт снизу, поэтому метку вкладывают в паузу на
 * верхе заднего слоя; пластик над карманом — это передний слой целиком
 * (`thickness − depth`, при толщине 3 мм — 2 мм), а не отдельная крышка
 * 0.4 мм. Перекрытие 0.05 мм не даёт слоям разойтись.
 */
function createBaseGeometry(
  params: KeychainParams,
  outline: KeychainOutline,
): BufferGeometry {
  const bevel = edgeBevel(params.thickness);
  const cavity = params.nfcEnabled ? findCavity(outline.groups, bevel) : null;
  const layers = keychainNfcLayers(params.thickness);
  const recess = layers.depth;
  const parts: BufferGeometry[] = [];

  if (cavity && recess > 0.2) {
    const backHeight = layers.pauseZ;
    const frontHeight = layers.frontHeight;

    for (const shape of buildShapes(outline.groups, cavityHoles(cavity))) {
      parts.push(extrudeShape(shape, 0, backHeight, bevel));
    }

    for (const shape of buildShapes(outline.groups)) {
      parts.push(extrudeShape(shape, recess, frontHeight, bevel));
    }
  } else {
    for (const shape of buildShapes(outline.groups)) {
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
 * Ручное смещение двигает готовую строку, пока прямоугольник букв остаётся в
 * силуэте: у контура карты грани нет, поэтому место проверяется по точкам
 * прямоугольника. Возвращает null, если строка пустая или не помещается в 2 мм
 * ширины.
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

  const measured = measureKeychainText(text, font);

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

  const textWidth = measured.width * size;
  const textHeight = measured.height * size;
  // Строка стоит в силуэте, пока в нём лежат её центр и четыре угла: контур
  // сужается книзу, и смещение вбок могло бы увести буквы за пластик.
  const fitsInside = (centerX: number, centerY: number): boolean => {
    const halfWidth = textWidth / 2;
    const halfHeight = textHeight / 2;
    const probes: [number, number][] = [
      [centerX, centerY],
      [centerX - halfWidth, centerY - halfHeight],
      [centerX + halfWidth, centerY - halfHeight],
      [centerX - halfWidth, centerY + halfHeight],
      [centerX + halfWidth, centerY + halfHeight],
    ];

    return probes.every((point) =>
      isPointInsideOutline(point, outline.contours),
    );
  };
  const offsetX = clampOutlineOffset(
    params.textOffsetX,
    (availableWidth - textWidth) / 2,
    (offset) => fitsInside(textCenterX + offset, textCenterY),
  );
  const offsetY = clampOutlineOffset(
    params.textOffsetY,
    (availableHeight - textHeight) / 2,
    (offset) => fitsInside(textCenterX + offsetX, textCenterY + offset),
  );

  // Мелкое имя при 10 символах на узком брелоке: фаска и толщина рельефа
  // подстраиваются под кегль и толщину основы в `keychain-text.ts`.
  return createKeychainTextGeometry({
    centerX: textCenterX + offsetX,
    centerY: textCenterY + offsetY,
    depth: params.textDepth,
    font,
    side: "front",
    size,
    text,
    thickness: params.thickness,
  });
}

/**
 * Смещение буквы, обрезанное границей силуэта.
 *
 * Просьба исполняется, пока прямоугольник строки остаётся в контуре. Как только
 * угол выходит за пластик, смещение отступает к нулю: буквы не должны висеть над
 * вырезом логотипа или за кромкой.
 */
function clampOutlineOffset(
  desired: number,
  limit: number,
  fits: (offset: number) => boolean,
): number {
  const reach = Math.min(Math.abs(desired), Math.max(limit, 0));
  const sign = desired < 0 ? -1 : 1;
  let steps = Math.floor(reach / TEXT_OFFSET_STEP_MM);

  while (steps > 0) {
    if (fits(sign * steps * TEXT_OFFSET_STEP_MM)) {
      return sign * steps * TEXT_OFFSET_STEP_MM;
    }

    steps -= 1;
  }

  return 0;
}


/**
 * Круги, которые надпись на пресете обязана обойти.
 *
 * Карман под NFC-метку снаружи не виден, но над полостью остаётся крышка
 * 0.5 мм: внедрение букв на 0.35 мм прорезало бы её почти насквозь. Поэтому
 * полость попадает в карту грани как вырез, а не как «вроде бы далеко».
 */
function presetTextKeepOut(
  params: KeychainParams,
  presetParams: KeychainPresetGeometryParams,
): KeychainTextKeepOut[] {
  if (!params.keychainPreset || !params.nfcEnabled) {
    return [];
  }

  const nfc = nfcLayout(params.keychainPreset, presetParams);

  if (!nfc.enabled || nfc.pocketY === null) {
    return [];
  }

  return [
    {
      // Полость всегда по центру ширины: `pocketY` двигает её только по Y.
      centerX: 0,
      centerY: nfc.pocketY,
      radius: Math.max(nfc.radiusMm, nfc.lipRadiusMm),
    },
  ];
}

/**
 * Постановка строки на одну сторону, мм: null — строка туда не влезает.
 *
 * Кегль и центр считает общий помощник: он же обрезает ручное смещение по карте
 * грани, поэтому буквы не уезжают с детали.
 */
function fitPresetText(
  body: BufferGeometry,
  params: KeychainParams,
  keepOut: readonly KeychainTextKeepOut[],
  measured: KeychainTextMetrics,
  side: KeychainTextSide,
): {
  centerX: number;
  centerY: number;
  side: KeychainTextSide;
  size: number;
} | null {
  const placement = placeKeychainText(body, {
    keepOut,
    metrics: measured,
    offsetX: params.textOffsetX,
    offsetY: params.textOffsetY,
    side,
  });

  return placement ? { ...placement, side } : null;
}

/**
 * Имя на пресете: лицо или оборот.
 *
 * Лицо — сторона по умолчанию, но у кирпича его занимают шипы, а у шестерни
 * ступица, поэтому там выгоднее оборот. Сравниваются кегли: оборот выигрывает
 * только тогда, когда строка на нём крупнее хотя бы на `TEXT_FRONT_PREFERENCE`.
 *
 * Сторона возвращается вместе с сеткой: картинка обходит буквы только на своей
 * стороне, и без этого числа она штамповала бы чужой рельеф в собственную маску.
 */
function createPresetTextGeometry(
  body: BufferGeometry,
  params: KeychainParams,
  keepOut: readonly KeychainTextKeepOut[],
  font: Font,
): { geometry: BufferGeometry; side: KeychainTextSide } | null {
  const text = params.text.trim();

  if (!text) {
    return null;
  }

  const measured = measureKeychainText(text, font);

  if (!measured) {
    return null;
  }

  const front = fitPresetText(body, params, keepOut, measured, "front");
  const back = fitPresetText(body, params, keepOut, measured, "back");
  const chosen =
    front && back
      ? front.size >= back.size * TEXT_FRONT_PREFERENCE
        ? front
        : back
      : (front ?? back);

  if (!chosen) {
    return null;
  }

  const geometry = createKeychainTextGeometry({
    centerX: chosen.centerX,
    centerY: chosen.centerY,
    depth: params.textDepth,
    font,
    side: chosen.side,
    size: chosen.size,
    text,
    thickness: params.thickness,
  });

  return geometry ? { geometry, side: chosen.side } : null;
}

/**
 * Что получилось из картинки при сборке: по этим числам панель предупреждает.
 *
 * Отчёт заполняется только если картинка есть в параметрах. `image = null` —
 * картинки нет вовсе; `image.side = null` — она не встала ни на одну сторону.
 */
export type KeychainBuildReport = {
  image: KeychainImageFit | null;
};

/**
 * Приклеивает оболочку к телу и освобождает обе исходные сетки.
 *
 * `mergeGeometries` копирует данные: без `dispose` слайдер оставлял бы в памяти
 * по паре буферов на каждое движение. Габарит и сфера пересчитываются всегда —
 * по ним камера строит кадр, а роут считает вес детали.
 */
function mergeInto(
  body: BufferGeometry,
  part: BufferGeometry,
  error: string,
): BufferGeometry {
  const merged = mergeGeometries([body, part]);

  body.dispose();
  part.dispose();

  if (!merged) {
    throw new Error(error);
  }

  merged.computeBoundingBox();
  merged.computeBoundingSphere();

  return merged;
}

/**
 * Ставит картинку на брелок и приклеивает её рельеф.
 *
 * Сторона выбирается так же, как у имени: сначала лицо. Если на лице места нет
 * (буквы и отверстие заняли всю полосу), картинка пробует оборот — там она
 * обычно встаёт целиком. Запрошенный масштаб остаётся просьбой: подгонка шагом
 * 5% ужимает логотип, пока он не обойдёт все препятствия, и отчёт говорит, во
 * сколько раз он ужался.
 *
 * `null` в отчёте — картинки нет; `side: null` — не встала никуда. Модель в этом
 * случае печатается без логотипа: пустой брелок честнее отдельной плавающей
 * оболочки, которую слайсер не соединит с телом.
 */
function attachKeychainImage(
  body: BufferGeometry,
  params: KeychainParams,
  keepOut: readonly KeychainTextKeepOut[],
  text: { geometry: BufferGeometry; side: KeychainTextSide } | null,
  report: KeychainBuildReport | undefined,
): BufferGeometry {
  // У визитки лицо занято кодом: логотип накрыл бы модули, а запас хода у
  // картинки всего один — уменьшение сдвинуло бы её под код, но не спасло бы
  // сканируемость. Поэтому рельефов у визитки нет вовсе: ни имени, ни картинки.
  if (params.keychainPreset === "qr-card") {
    if (report) {
      report.image = null;
    }

    return body;
  }

  const build = keychainImageBuild(params.imageData);

  if (!build) {
    if (report) {
      report.image = null;
    }

    return body;
  }

  const options = {
    build,
    keepOut,
    offsetX: params.imageOffsetX,
    offsetY: params.imageOffsetY,
    scale: params.imageScale,
    text,
  };
  const placement =
    placeKeychainImage(body, { ...options, side: "front" }) ??
    placeKeychainImage(body, { ...options, side: "back" });

  if (!placement) {
    if (report) {
      report.image = {
        actual: 0,
        requested: params.imageScale,
        side: null,
        size: 0,
      };
    }

    return body;
  }

  const geometry = createKeychainImageGeometry({
    build,
    centerX: placement.centerX,
    centerY: placement.centerY,
    depth: params.imageDepth,
    side: placement.side,
    size: placement.size,
    thickness: params.thickness,
  });

  if (report) {
    report.image = geometry
      ? {
          actual: placement.actual,
          requested: placement.requested,
          side: placement.side,
          size: placement.size,
        }
      : { actual: 0, requested: params.imageScale, side: null, size: 0 };
  }

  if (!geometry) {
    return body;
  }

  return mergeInto(body, geometry, "Не удалось объединить брелок и картинку");
}

/**
 * Приклеивает к геометрии пресета картинку и имя.
 *
 * Сначала картинка: буквы ещё живут отдельной сеткой, и она обходит их через
 * маску грани с зазором `IMAGE_TEXT_GAP_MM`. Если поставить имя первым, маска
 * увидела бы его только как чужой рельеф — без запаса, вплотную.
 *
 * Буквы идут отдельной оболочкой, как у своего контура: слайсер объединяет её с
 * телом при печати.
 *
 * Визитка пропускается: у неё своё имя (`qrName`), и оно стоит под кодом.
 */
function attachPresetDetails(
  body: BufferGeometry,
  params: KeychainParams,
  keepOut: readonly KeychainTextKeepOut[],
  font: Font | null,
  report: KeychainBuildReport | undefined,
): BufferGeometry {
  const text =
    font && params.showText && params.keychainPreset !== "qr-card"
      ? createPresetTextGeometry(body, params, keepOut, font)
      : null;
  const withImage = attachKeychainImage(body, params, keepOut, text, report);

  return text
    ? mergeInto(
        withImage,
        text.geometry,
        "Не удалось объединить геометрию пресета и текст",
      )
    : withImage;
}



/**
 * Свой контур с именем и картинкой: разметка силуэта и обе оболочки.
 *
 * Имя у своего контура стоит на лице — сторону выбирает разметка, а не карта
 * грани. Картинка идёт первой: буквы ещё отдельная сетка, и логотип обходит их с
 * зазором, а не вплотную.
 */
function attachOwnTextAndImage(
  params: KeychainParams,
  font: Font | null,
  report: KeychainBuildReport | undefined,
): BufferGeometry {
  const outline = createOutline(params, edgeBevel(params.thickness));
  const base = createBaseGeometry(params, outline);
  const text =
    font && params.showText ? createTextGeometry(params, font, outline) : null;
  const withImage = attachKeychainImage(
    base,
    params,
    [],
    text ? { geometry: text, side: "front" } : null,
    report,
  );

  return text
    ? mergeInto(withImage, text, "Не удалось объединить основу брелока и текст")
    : withImage;
}

/**
 * Собирает брелок в одну сетку.
 *
 * font = null допустим для предпросмотра, пока JSON шрифта ещё грузится:
 * сцена показывает силуэт без имени, а после загрузки пересобирает его.
 * Серверный экспорт передаёт шрифт всегда.
 *
 * `report` — необязательный приёмник итогов: панель по нему узнаёт, во сколько
 * раз ужалась картинка и на какую сторону она встала. Так отчёт не требует
 * второй сборки модели: геометрия уже построена, остаётся записать числа.
 *
 * mergeGeometries копирует данные в новую сетку; исходные оболочки
 * освобождаются сразу, чтобы слайдер не оставлял мусор в памяти.
 */
export function createKeychainGeometry(
  params: Partial<KeychainParams>,
  font: Font | null = null,
  report?: KeychainBuildReport,
): BufferGeometry {
  const normalized = normalizeKeychainParams(params);
  const presetParams: KeychainPresetGeometryParams = {
    width: normalized.width,
    height: normalized.length,
    thickness: normalized.thickness,
    // Визитке мало трёх чисел: её раскладку задаёт содержимое кода.
    qr:
      normalized.keychainPreset === "qr-card"
        ? keychainQrCardSpec(normalized)
        : null,
    // Карман под метку есть только у трёх пресетов; у остальных нормализация
    // уже обнулила флаг.
    nfcEnabled: normalized.nfcEnabled,
    // Позиция отверстия: набор проверила нормализация по реестру пресета,
    // здесь остаётся передать её геометрии.
    holePlacement: normalized.holePlacement,
  };
  const preset = normalized.keychainPreset
    ? buildKeychainPresetGeometry(normalized.keychainPreset, presetParams)
    : null;

  // Пресет строится из своих чисел: ушко и карман под метку у него собственные,
  // поэтому к готовой сетке добавляются только имя и картинка — тем же способом,
  // что и к своему контуру, но полосу под буквы ищет общий помощник.
  const built = preset
    ? attachPresetDetails(
        preset,
        normalized,
        presetTextKeepOut(normalized, presetParams),
        font,
        report,
      )
    : attachOwnTextAndImage(normalized, font, report);

  // Габарит и сфера нужны камере и расчёту веса всегда, даже когда в модели нет
  // ни имени, ни картинки: без них кадр строится по пустому bbox.
  built.computeBoundingBox();
  built.computeBoundingSphere();

  return built;
}
