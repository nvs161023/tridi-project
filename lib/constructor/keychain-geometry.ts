import { ExtrudeGeometry, Path, Shape } from "three";
import type { BufferGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import {
  attachKeychainDecorations,
  type KeychainBuildReport,
  type KeychainDecorationFit,
  type KeychainDecorationSkip,
  type KeychainFontMap,
} from "@/lib/constructor/keychain-decorations";
import { KEYCHAIN_FALLBACK_SVG } from "@/lib/constructor/keychain-fallback-shape";
import {
  buildKeychainPresetGeometry,
  nfcLayout,
  type KeychainPresetGeometryParams,
} from "@/lib/constructor/keychain-preset-geometry";
import type { KeychainTextKeepOut } from "@/lib/constructor/keychain-text";
import {
  keychainFontUrl,
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
 * Отчёт сборки и его строки живут в конвейере декораций: там их пишут, там они и
 * описаны. Реэкспорт оставлен, потому что панель и сцена импортируют отчёт отсюда
 * вместе с самой сборкой.
 */
export type {
  KeychainBuildReport,
  KeychainDecorationFit,
  KeychainDecorationSkip,
  KeychainFontMap,
};

/**
 * Геометрия брелока: пластина пресета, ушко под кольцо, NFC-карман и декорации.
 *
 * Основа лежит в плоскости XY, толщина идёт по Z от 0 до thickness. Такой
 * файл уже стоит на столе слайсера: нижняя грань на Z = 0, рельеф выступает
 * вверх. В предпросмотре группа поворачивается на -90° вокруг X, чтобы брелок
 * лежал на виртуальном столе; для оборота она доворачивается до +90°.
 *
 * Форму задаёт только пресет: набор есть в `keychain-presets.ts`, сетку каждого
 * строит `keychain-preset-geometry.ts`. Разбор SVG остался ради запасного жетона
 * (lib/constructor/svg-outline.ts): на сервере нет DOMParser, а SVGLoader из
 * three.js падает уже на импорте, поэтому один парсер работает и в браузере, и в
 * API. Контур жетона масштабируется с сохранением пропорций в габарит ширины,
 * нижняя точка встаёт на bottom, а сверху остаётся место под ушко.
 *
 * Ушко — отдельная замкнутая оболочка: круг радиусом 4.4 мм с отверстием
 * 4 мм, который перекрывает верх силуэта на 1 мм. Поэтому кольцо проходит
 * сквозь пластик при любой форме, даже если верхушка узкая (звезда, молния).
 *
 * Рельефы не вырезаются, а пересекаются с основой: буквы и логотип входят в тело
 * на `KEYCHAIN_TEXT_EMBED_MM` и выступают над пластиком на свою толщину из панели.
 * Утопленного рельефа нет: без CSG материал можно только добавить. Каждая
 * оболочка замкнута отдельно, слайсер объединяет их при печати. Место для
 * рельефов ищет общий конвейер (`keychain-decorations.ts`): карта грани 0.4 мм,
 * полоса, ручное смещение, обход уже поставленных декораций — один код на все
 * пресеты и обе стороны пластины.
 */

/**
 * Публичный путь шрифта надписи по умолчанию.
 *
 * Оставлен ради вывески: `sign-geometry.ts` берёт этот же файл для `sans-bold`.
 * У брелока шрифт выбирается декорацией, и путь считает `keychainFontUrl`.
 */
export const KEYCHAIN_FONT_URL = keychainFontUrl("sans-bold");

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
 * Страховочный жетон для габаритов.
 *
 * Форму брелока задаёт пресет (`buildKeychainPresetGeometry`), и в обычной сборке
 * сюда управление не доходит. Ветка осталась страховкой: если реестр пресетов
 * окажется пустым, брелок всё равно получит пластик, а не пустую сцену.
 */
function createOutline(params: KeychainParams, bevel: number): KeychainOutline {
  const contours = parseSvgOutline(KEYCHAIN_FALLBACK_SVG);

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
 * Собирает брелок в одну сетку.
 *
 * `fonts` — загруженные шрифты по ключам декораций. Неполный набор допустим для
 * предпросмотра, пока JSON ещё грузится: сцена показывает силуэт без букв, а после
 * загрузки пересобирает его. Серверный экспорт передаёт все нужные шрифты.
 *
 * `report` — необязательный приёмник итогов: панель по нему узнаёт, на какую
 * сторону встала каждая декорация, во сколько раз ужалась картинка и что не
 * поместилось. Так отчёт не требует второй сборки модели: геометрия уже построена,
 * остаётся записать числа.
 *
 * mergeGeometries копирует данные в новую сетку; исходные оболочки освобождаются
 * сразу, чтобы слайдер не оставлял мусор в памяти.
 */
export function createKeychainGeometry(
  params: Partial<KeychainParams>,
  fonts: KeychainFontMap | null = null,
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
  // поэтому к готовой сетке добавляются только декорации — тем же конвейером, что
  // и у страховочного жетона. Карта грани строится по любой сетке.
  const body = preset
    ? preset
    : createBaseGeometry(
        normalized,
        createOutline(normalized, edgeBevel(normalized.thickness)),
      );
  const built = attachKeychainDecorations(
    body,
    normalized,
    preset ? presetTextKeepOut(normalized, presetParams) : [],
    fonts,
    report,
  );

  // Габарит и сфера нужны камере и расчёту веса всегда, даже когда в модели нет
  // ни одного рельефа: без них кадр строится по пустому bbox.
  built.computeBoundingBox();
  built.computeBoundingSphere();

  return built;
}
