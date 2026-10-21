import {
  BufferGeometry,
  Float32BufferAttribute,
  Uint32BufferAttribute,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import {
  LAMP_MOUNT_DIAMETERS_MM,
  LAMP_SOCKET_CLEARANCE_MM,
  normalizeLampParams,
  type LampBaseShape,
  type LampParams,
  type LampPart,
  type VasePattern,
} from "@/lib/constructor/params";
import {
  DETAIL_PATTERN_SCALE,
  honeycombWave,
  scalesWave,
} from "@/lib/constructor/pattern-waves";

/**
 * Геометрия абажура: замкнутая оболочка с отверстием под патрон.
 *
 * Профиль строится вручную, а не LatheGeometry, потому что в верхнем поясе
 * нужен прямоугольный канал под провод. LatheGeometry не умеет локальные
 * вырезы, а булевых операций в проекте нет. Поэтому поверхность собирается
 * сеткой «строка профиля × угол»: четыре квада вырезаются и заменяются
 * стенками тоннеля. Стенки используют уже существующие вершины, так что
 * каждая пара треугольников сходится по рёбрам и сетка остаётся замкнутой.
 *
 * Профиль обходится по часовой стрелке в плоскости (r, y): наружная стенка
 * снизу вверх, верхнее кольцо, цилиндрическое гнездо патрона вниз, плечо,
 * внутренняя стенка вниз и нижнее кольцо. Такой обход даёт наружные нормали
 * у всех квадов без отдельных проверок.
 *
 * Отверстие под патрон шире резьбы на LAMP_SOCKET_CLEARANCE_MM с каждой
 * стороны: после усадки PLA патрон входит плотно, но не проваливается. Узор
 * смещает наружную и внутреннюю стенку на одну и ту же величину, поэтому
 * толщина стенки не меняется, а у кромки патрона и у стола амплитуда плавно
 * сходит на нет — гнездо остаётся круглым.
 */

/** Сегментов по окружности: 128 дают ровное гнездо под патрон. */
export const LAMP_SEGMENTS = 128;

/** Строк профиля на плавную часть абажура. */
const BELL_ROWS = 44;

/** Глубина гнезда под патрон от верхней кромки, мм. */
const COLLAR_DEPTH_MM = 18;

/** Высота гладкого пояса у патрона, мм: здесь узор уже погашен. */
const COLLAR_BAND_MM = 22;

/** Сколько миллиметров материала остаётся над каналом под провод. */
const SLOT_TOP_INSET_MM = 3;

/** Высота канала под провод, мм. */
const SLOT_HEIGHT_MM = 7;

/** Ширина канала по углу: 10 сегментов — около 28°. */
const SLOT_SEGMENTS = 10;

/** Минимальный зазор между гнездом и внутренней стенкой, мм. */
const INNER_GAP_MM = 1.5;

/** За сколько миллиметров до гладкого пояса узор полностью исчезает. */
const PATTERN_FADE_MM = 18;

/** У самого стола узор тоже гаснет, чтобы диаметр совпал со слайдером. */
const BASE_FADE_MM = 4;

/** Амплитуда узора абажура: отдельного слайдера у светильника нет. */
const PATTERN_INTENSITY_MM = 1.2;

/** Частота узора абажура: 10 гребней по окружности. */
const PATTERN_FREQUENCY = 10;

/** Период горизонтальных волн, мм. */
const PATTERN_WAVE_PERIOD_MM = 28;

/** Сегментов у основания: 2.5° даёт ровные углы квадрата и шестиугольника. */
export const LAMP_BASE_SEGMENTS = 144;

/**
 * Толщина верхней крышки закрытого плафона, мм.
 *
 * 2.4 мм держат форму крышки над гнездом патрона и не просвечивают: стенка
 * абажура такой же толщины, и крышка не выглядит тоньше остальных деталей.
 */
export const LAMP_CAP_THICKNESS_MM = 2.4;

/** Насколько основание выступает за абажур по радиусу, мм. */
const BASE_MARGIN_MM = 1.2;

/** Толщина боковой стенки основания, мм. */
const BASE_WALL_MM = 2.4;

/** Толщина дна основания, мм: в нём сверлится канал под провод. */
const BASE_BOTTOM_MM = 2.4;

/** Толщина верхней плиты основания, мм: держит патрон и вес абажура. */
const BASE_TOP_MM = 4;

/** Высота посадочного кольца над плитой, мм. */
const BASE_SEAT_HEIGHT_MM = 4;

/** Ширина посадочного кольца, мм. */
const BASE_SEAT_WIDTH_MM = 2.4;

/** Радиальный зазор между кольцом и внутренней стенкой абажура, мм. */
const BASE_SEAT_CLEARANCE_MM = 0.3;

/** Минимальная ширина кольца вокруг гнезда патрона, мм. */
const BASE_NECK_MM = 1.2;

/** Радиус канала под провод в дне основания, мм: кабель 3×0.75 входит. */
const BASE_CABLE_RADIUS_MM = 4;

/** Сколько сторон у формы основания: 0 — круг. */
const BASE_SHAPE_SIDES = {
  round: 0,
  square: 4,
  hexagon: 6,
} as const satisfies Record<LampBaseShape, number>;

type ProfileRow = {
  radius: number;
  height: number;
};

/** Профиль и индексы строк, между которыми вырезается канал. */
type LampProfile = {
  rows: ProfileRow[];
  /** Вырезан ли в верхнем поясе канал под провод. */
  hasSlot: boolean;
  outerSlotBottomRow: number;
  outerSlotTopRow: number;
  boreSlotBottomRow: number;
  boreSlotTopRow: number;
};

/** Плавная ступенька 0…1: без неё узор обрывался бы у кромки патрона. */
function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge1 <= edge0) {
    return value >= edge1 ? 1 : 0;
  }

  const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);

  return t * t * (3 - 2 * t);
}

/**
 * Множитель амплитуды узора по высоте.
 *
 * В гладком поясе под патрон и у нижней кромки — ноль: гнездо и диаметр
 * остаются точными. Между ними узор включается плавно.
 */
function patternFade(heightMm: number, y: number): number {
  const collarStart = heightMm - COLLAR_BAND_MM;
  const top = 1 - smoothstep(collarStart - PATTERN_FADE_MM, collarStart, y);
  const bottom = smoothstep(0, BASE_FADE_MM, y);

  return top * bottom;
}

/**
 * Смещение стенки узором в диапазоне −1…1.
 *
 * Соты и чешуйки считаются по дуге окружности, поэтому высота делится на
 * опорный радиус абажура: иначе ячейки вытянулись бы по высоте. Частота этих
 * двух узоров умножается на DETAIL_PATTERN_SCALE — при десяти гребнях ячейки
 * были бы крупнее самого абажура.
 */
function patternWave(
  pattern: VasePattern,
  angle: number,
  y: number,
  referenceRadius: number,
): number {
  const phaseFrequency =
    pattern === "honeycomb" || pattern === "scales"
      ? PATTERN_FREQUENCY * DETAIL_PATTERN_SCALE
      : PATTERN_FREQUENCY;
  const circumferencePhase = angle * phaseFrequency;
  const verticalPhase =
    (y / Math.max(referenceRadius, 1)) * phaseFrequency;

  switch (pattern) {
    case "spiral":
      return Math.sin(angle * PATTERN_FREQUENCY + y * 0.09);
    case "ribs":
      return Math.cos(angle * PATTERN_FREQUENCY);
    case "waves":
      return Math.sin((y / PATTERN_WAVE_PERIOD_MM) * Math.PI * 2);
    case "honeycomb":
      return honeycombWave(circumferencePhase, verticalPhase);
    case "scales":
      return scalesWave(circumferencePhase, verticalPhase);
    case "smooth":
      return 0;
  }
}


/**
 * Профиль абажура и координаты канала.
 *
 * Наружный радиус плавно сужается от нижней кромки к гладкому поясу: так
 * абажур отбрасывает свет вниз, а не в стороны. У открытого плафона верхнее
 * кольцо переходит в цилиндрическое гнездо патрона, под ним — плечо и
 * внутренняя стенка. У закрытого верх запечатан плоской крышкой
 * LAMP_CAP_THICKNESS_MM: профиль уходит к оси вращения, спускается по ней на
 * толщину крышки и возвращается к внутренней стенке, поэтому свет не бьёт в
 * потолок, а канал под провод не вырезается.
 */
function createLampProfile(params: LampParams): LampProfile {
  const height = params.lampHeight;
  const radius = params.lampDiameter / 2;
  const wall = params.lampWall;
  const socketRadius =
    LAMP_MOUNT_DIAMETERS_MM[params.lampMount] / 2 +
    LAMP_SOCKET_CLEARANCE_MM;

  // Верхний радиус должен оставить материал вокруг гнезда, но не сделать
  // абажур почти цилиндрическим. Для узкого корпуса с E27 предел 0.85 R
  // важнее желаемого пояса — иначе гнездо выйдет за габарит.
  const topRadius = Math.min(
    Math.max(socketRadius + Math.max(6, wall * 1.8), socketRadius + 2.5),
    Math.min(radius * 0.85, radius),
  );

  const bellTop = height - COLLAR_BAND_MM;
  const bellRows: ProfileRow[] = [];

  for (let index = 0; index < BELL_ROWS; index += 1) {
    const t = index / (BELL_ROWS - 1);
    // Косинус даёт колокол: вертикальная стенка у стола и плоское плечо у
    // патрона. Показатель 1.35 делает силуэт чуть полнее снизу.
    const share = Math.cos((t * Math.PI) / 2) ** 1.35;

    bellRows.push({
      height: t * bellTop,
      radius: topRadius + (radius - topRadius) * share,
    });
  }

  const rows: ProfileRow[] = [...bellRows];

  // Закрытый плафон: крышка наглухо перекрывает верхнее отверстие. Внутренний
  // радиус крышки равен стенке абажура, поэтому толщина по кромке та же, что у
  // стенки, а в центре — LAMP_CAP_THICKNESS_MM.
  if (params.lampType === "closed") {
    const innerTopRadius = Math.max(topRadius - wall, 0.6);

    rows.push({ height, radius: topRadius });
    rows.push({ height, radius: 0 });
    rows.push({ height: height - LAMP_CAP_THICKNESS_MM, radius: 0 });
    rows.push({
      height: height - LAMP_CAP_THICKNESS_MM,
      radius: innerTopRadius,
    });

    for (let index = BELL_ROWS - 1; index >= 0; index -= 1) {
      const outer = bellRows[index];

      rows.push({
        height: outer.height,
        radius: Math.max(outer.radius - wall, 0.6),
      });
    }

    return {
      rows,
      hasSlot: false,
      outerSlotBottomRow: -1,
      outerSlotTopRow: -1,
      boreSlotBottomRow: -1,
      boreSlotTopRow: -1,
    };
  }

  const outerSlotBottomRow = rows.length;
  rows.push({
    height: height - SLOT_TOP_INSET_MM - SLOT_HEIGHT_MM,
    radius: topRadius,
  });
  const outerSlotTopRow = rows.length;
  rows.push({ height: height - SLOT_TOP_INSET_MM, radius: topRadius });
  rows.push({ height, radius: topRadius });

  rows.push({ height, radius: socketRadius });

  const boreSlotTopRow = rows.length;
  rows.push({ height: height - SLOT_TOP_INSET_MM, radius: socketRadius });
  const boreSlotBottomRow = rows.length;
  rows.push({
    height: height - SLOT_TOP_INSET_MM - SLOT_HEIGHT_MM,
    radius: socketRadius,
  });
  rows.push({ height: height - COLLAR_DEPTH_MM, radius: socketRadius });

  const shoulderRadius = Math.max(
    topRadius - wall,
    socketRadius + INNER_GAP_MM,
  );
  rows.push({ height: height - COLLAR_DEPTH_MM, radius: shoulderRadius });

  for (let index = BELL_ROWS - 1; index >= 0; index -= 1) {
    const outer = bellRows[index];
    rows.push({
      height: outer.height,
      radius: Math.max(outer.radius - wall, socketRadius + INNER_GAP_MM),
    });
  }

  return {
    rows,
    hasSlot: true,
    outerSlotBottomRow,
    outerSlotTopRow,
    boreSlotBottomRow,
    boreSlotTopRow,
  };
}

/** Индекс вершины сетки: строка профиля и угол. */
function vertexIndex(row: number, segment: number): number {
  const wrapped =
    ((segment % LAMP_SEGMENTS) + LAMP_SEGMENTS) % LAMP_SEGMENTS;

  return row * LAMP_SEGMENTS + wrapped;
}

/**
 * Добавляет квад с нужным направлением нормали.
 *
 * Порядок вершин у стенок тоннеля зависит от того, с какой стороны смотрит
 * камера, и выводить его вручную слишком легко ошибиться. Считаем нормаль по
 * диагоналям и при необходимости разворачиваем обход.
 */
function addOrientedQuad(
  indices: number[],
  positions: Float32Array,
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  normalX: number,
  normalY: number,
  normalZ: number,
): void {
  const ax = positions[p2 * 3] - positions[p0 * 3];
  const ay = positions[p2 * 3 + 1] - positions[p0 * 3 + 1];
  const az = positions[p2 * 3 + 2] - positions[p0 * 3 + 2];
  const bx = positions[p3 * 3] - positions[p1 * 3];
  const by = positions[p3 * 3 + 1] - positions[p1 * 3 + 1];
  const bz = positions[p3 * 3 + 2] - positions[p1 * 3 + 2];
  const nx = ay * bz - az * by;
  const ny = az * bx - ax * bz;
  const nz = ax * by - ay * bx;

  if (nx * normalX + ny * normalY + nz * normalZ >= 0) {
    indices.push(p0, p1, p2, p0, p2, p3);
  } else {
    indices.push(p0, p2, p1, p0, p3, p2);
  }
}


/**
 * Собирает абажур в одну индексированную сетку.
 *
 * Верхняя и нижняя кромки замкнуты кольцами, гнездо патрона — сквозным
 * цилиндром с плечом. Канал под провод вырезан в верхнем поясе: снаружи и
 * изнутри удалены квады, а между отверстиями вставлены четыре стенки. Сама
 * оболочка — кольцо (род 1), канал добавляет ещё одну ручку, поэтому у готовой
 * поверхности род 2: она замкнута, без краёв и самопересечений.
 */
function buildShadeGeometry(normalized: LampParams): BufferGeometry {
  const profile = createLampProfile(normalized);
  const { rows } = profile;
  const angularStep = (Math.PI * 2) / LAMP_SEGMENTS;
  const positions = new Float32Array(rows.length * LAMP_SEGMENTS * 3);

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const fade = patternFade(normalized.lampHeight, row.height);

    for (let segment = 0; segment < LAMP_SEGMENTS; segment += 1) {
      const angle = segment * angularStep;
      // Смещение одинаково для наружной и внутренней стенки на этой высоте,
      // поэтому толщина стенки сохраняется. В гладком поясе fade = 0.
      const offset =
        fade === 0
          ? 0
          : patternWave(
              normalized.lampPattern,
              angle,
              row.height,
              normalized.lampDiameter / 2,
            ) *
            fade *
            PATTERN_INTENSITY_MM;
      const radius = Math.max(row.radius + offset, 0);
      const offset3 = (rowIndex * LAMP_SEGMENTS + segment) * 3;

      positions[offset3] = Math.cos(angle) * radius;
      positions[offset3 + 1] = row.height;
      positions[offset3 + 2] = Math.sin(angle) * radius;
    }
  }

  const indices: number[] = [];
  const hasSlot = profile.hasSlot;
  const slotStart = LAMP_SEGMENTS / 2 - SLOT_SEGMENTS / 2;
  const slotEnd = slotStart + SLOT_SEGMENTS;
  const outerSlotEdge = profile.outerSlotBottomRow;
  const boreSlotEdge = profile.boreSlotTopRow;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const nextRow = (rowIndex + 1) % rows.length;
    const isSlotEdge =
      hasSlot && (rowIndex === outerSlotEdge || rowIndex === boreSlotEdge);
    const rowRadius = rows[rowIndex].radius;
    const nextRadius = rows[nextRow].radius;

    // Два ряда на оси вращения дают только вырожденные треугольники: у
    // закрытого плафона это вертикальная стенка крышки нулевой площади.
    if (rowRadius === 0 && nextRadius === 0) {
      continue;
    }

    for (let segment = 0; segment < LAMP_SEGMENTS; segment += 1) {
      if (isSlotEdge && segment >= slotStart && segment < slotEnd) {
        continue;
      }

      const a = vertexIndex(rowIndex, segment);
      const b = vertexIndex(rowIndex, segment + 1);
      const c = vertexIndex(nextRow, segment + 1);
      const d = vertexIndex(nextRow, segment);

      // Обход профиля задаёт наружную нормаль: (a, c, b) и (a, d, c).
      if (nextRadius === 0) {
        // Крышка закрытого плафона сходится на ось: остаётся один
        // треугольник веера, второй вырождается в точку.
        indices.push(a, c, b);
      } else if (rowRadius === 0) {
        // Обратный веер: от оси к нижнему кольцу крышки.
        indices.push(a, d, c);
      } else {
        indices.push(a, c, b, a, d, c);
      }
    }
  }

  // Стенки тоннеля: потолок канала смотрит вниз, пол — вверх, боковины —
  // внутрь канала. Вершины уже есть в сетке, новые не нужны. У закрытого
  // плафона канала нет: его верх запечатан крышкой.
  if (hasSlot) {
    for (let segment = slotStart; segment < slotEnd; segment += 1) {
      addOrientedQuad(
        indices,
        positions,
        vertexIndex(profile.outerSlotTopRow, segment),
        vertexIndex(profile.outerSlotTopRow, segment + 1),
        vertexIndex(profile.boreSlotTopRow, segment + 1),
        vertexIndex(profile.boreSlotTopRow, segment),
        0,
        -1,
        0,
      );
      addOrientedQuad(
        indices,
        positions,
        vertexIndex(profile.outerSlotBottomRow, segment),
        vertexIndex(profile.outerSlotBottomRow, segment + 1),
        vertexIndex(profile.boreSlotBottomRow, segment + 1),
        vertexIndex(profile.boreSlotBottomRow, segment),
        0,
        1,
        0,
      );
    }

    const startAngle = slotStart * angularStep;
    const endAngle = slotEnd * angularStep;

    addOrientedQuad(
      indices,
      positions,
      vertexIndex(profile.outerSlotBottomRow, slotStart),
      vertexIndex(profile.outerSlotTopRow, slotStart),
      vertexIndex(profile.boreSlotTopRow, slotStart),
      vertexIndex(profile.boreSlotBottomRow, slotStart),
      -Math.sin(startAngle),
      0,
      Math.cos(startAngle),
    );
    addOrientedQuad(
      indices,
      positions,
      vertexIndex(profile.outerSlotBottomRow, slotEnd),
      vertexIndex(profile.outerSlotTopRow, slotEnd),
      vertexIndex(profile.boreSlotTopRow, slotEnd),
      vertexIndex(profile.boreSlotBottomRow, slotEnd),
      Math.sin(endAngle),
      0,
      -Math.cos(endAngle),
    );
  }

  return finalizeGeometry(positions, indices);
}

/**
 * Доводит сетку вращения до готовой геометрии.
 *
 * Ориентация профиля проверена, но ошибка в стенке тоннеля или в основании
 * развернула бы часть граней. Отрицательный объём — признак общей инверсии:
 * меняем обход у всех треугольников сразу.
 */
function finalizeGeometry(
  positions: Float32Array,
  indices: number[],
): BufferGeometry {
  let volume6 = 0;

  for (let offset = 0; offset < indices.length; offset += 3) {
    const a = indices[offset] * 3;
    const b = indices[offset + 1] * 3;
    const c = indices[offset + 2] * 3;
    const ax = positions[a];
    const ay = positions[a + 1];
    const az = positions[a + 2];
    const bx = positions[b];
    const by = positions[b + 1];
    const bz = positions[b + 2];
    const cx = positions[c];
    const cy = positions[c + 1];
    const cz = positions[c + 2];

    volume6 +=
      ax * (by * cz - bz * cy) -
      ay * (bx * cz - bz * cx) +
      az * (bx * cy - by * cx);
  }

  if (volume6 < 0) {
    for (let offset = 0; offset < indices.length; offset += 3) {
      const second = indices[offset + 1];
      indices[offset + 1] = indices[offset + 2];
      indices[offset + 2] = second;
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(new Uint32BufferAttribute(new Uint32Array(indices), 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

/** Строка профиля основания: высота, тип радиуса и радиус для круга. */
type BaseProfileRow = {
  height: number;
  kind: "outer" | "inner" | "circle";
  radius: number;
};

/**
 * Радиус формы основания на заданном угле.
 *
 * Круг задаётся одним радиусом, квадрат и шестиугольник — апофемой (расстоянием
 * до середины грани) и числом сторон: на середине грани радиус равен апофеме, на
 * вершине — апофеме, делённой на косинус половины шага. Плоские грани остаются
 * плоскими, углы — острыми.
 */
function baseShapeRadius(angle: number, sides: number, apothem: number): number {
  if (sides < 3) {
    return apothem;
  }

  const step = (Math.PI * 2) / sides;
  const wrapped = ((angle % step) + step) % step;

  return apothem / Math.cos(wrapped - step / 2);
}

/** Радиус строки профиля основания на заданном угле. */
function baseRowRadius(
  row: BaseProfileRow,
  angle: number,
  sides: number,
  apothem: number,
): number {
  switch (row.kind) {
    case "outer":
      return baseShapeRadius(angle, sides, apothem);
    case "inner":
      return baseShapeRadius(angle, sides, Math.max(apothem - BASE_WALL_MM, 1));
    case "circle":
      return row.radius;
  }
}

/**
 * Профиль основания снизу вверх.
 *
 * Обход: наружная стенка вверх, плита к посадочному кольцу, кольцо вверх, его
 * гребень внутрь, кольцо вниз, плита к гнезду патрона, гнездо вниз до потолка
 * полости, внутренняя стенка вниз, дно к каналу под провод, канал вниз и
 * нижняя плоскость наружу. Один замкнутый контур — одна оболочка.
 *
 * Кольцо подбирается по внутренней стенке абажура: абажур опускается на плиту,
 * а кольцо входит внутрь его нижней кромки и не даёт ему съехать. Если абажур
 * почти равен основанию, кольцо упирается в предел по стенке — тогда зазор до
 * абажура чуть больше, но деталь остаётся прочной.
 */
function createBaseRows(params: LampParams): BaseProfileRow[] {
  const radius = params.lampDiameter / 2;
  const height = params.lampBaseHeight;
  const socketRadius =
    LAMP_MOUNT_DIAMETERS_MM[params.lampMount] / 2 +
    LAMP_SOCKET_CLEARANCE_MM;
  const shadeInner = Math.max(
    radius - params.lampWall,
    socketRadius + INNER_GAP_MM,
  );
  const apothem = radius + BASE_MARGIN_MM;
  const seatOuter = Math.max(
    Math.min(
      shadeInner - BASE_SEAT_CLEARANCE_MM,
      apothem - BASE_WALL_MM - BASE_NECK_MM,
    ),
    socketRadius + BASE_NECK_MM + BASE_SEAT_WIDTH_MM,
  );
  const seatInner = Math.min(
    Math.max(seatOuter - BASE_SEAT_WIDTH_MM, socketRadius + BASE_NECK_MM),
    seatOuter - BASE_NECK_MM,
  );

  return [
    { height: 0, kind: "outer", radius: 0 },
    { height, kind: "outer", radius: 0 },
    { height, kind: "circle", radius: seatOuter },
    { height: height + BASE_SEAT_HEIGHT_MM, kind: "circle", radius: seatOuter },
    { height: height + BASE_SEAT_HEIGHT_MM, kind: "circle", radius: seatInner },
    { height, kind: "circle", radius: seatInner },
    { height, kind: "circle", radius: socketRadius },
    { height: height - BASE_TOP_MM, kind: "circle", radius: socketRadius },
    { height: height - BASE_TOP_MM, kind: "inner", radius: 0 },
    { height: BASE_BOTTOM_MM, kind: "inner", radius: 0 },
    { height: BASE_BOTTOM_MM, kind: "circle", radius: BASE_CABLE_RADIUS_MM },
    { height: 0, kind: "circle", radius: BASE_CABLE_RADIUS_MM },
  ];
}

/** Индекс вершины сетки основания: строка профиля и угол. */
function baseVertexIndex(row: number, segment: number): number {
  const wrapped =
    ((segment % LAMP_BASE_SEGMENTS) + LAMP_BASE_SEGMENTS) % LAMP_BASE_SEGMENTS;

  return row * LAMP_BASE_SEGMENTS + wrapped;
}


/**
 * Собирает основание в индексированную сетку.
 *
 * Форму задаёт число сторон: круг, квадрат или шестиугольник. Профиль один и
 * тот же, меняется только радиус на угле, поэтому основание всегда замкнуто и
 * имеет ту же топологию, что и круглое.
 */
function buildBaseGeometry(normalized: LampParams): BufferGeometry {
  const rows = createBaseRows(normalized);
  const sides = BASE_SHAPE_SIDES[normalized.lampBaseShape];
  const apothem = normalized.lampDiameter / 2 + BASE_MARGIN_MM;
  const angularStep = (Math.PI * 2) / LAMP_BASE_SEGMENTS;
  const positions = new Float32Array(rows.length * LAMP_BASE_SEGMENTS * 3);

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];

    for (let segment = 0; segment < LAMP_BASE_SEGMENTS; segment += 1) {
      const angle = segment * angularStep;
      const radius = baseRowRadius(row, angle, sides, apothem);
      const offset3 = (rowIndex * LAMP_BASE_SEGMENTS + segment) * 3;

      positions[offset3] = Math.cos(angle) * radius;
      positions[offset3 + 1] = row.height;
      positions[offset3 + 2] = Math.sin(angle) * radius;
    }
  }

  const indices: number[] = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const nextRow = (rowIndex + 1) % rows.length;

    for (let segment = 0; segment < LAMP_BASE_SEGMENTS; segment += 1) {
      const a = baseVertexIndex(rowIndex, segment);
      const b = baseVertexIndex(rowIndex, segment + 1);
      const c = baseVertexIndex(nextRow, segment + 1);
      const d = baseVertexIndex(nextRow, segment);

      indices.push(a, c, b, a, d, c);
    }
  }

  return finalizeGeometry(positions, indices);
}

/**
 * Абажур светильника: колокол с гнездом патрона и каналом под провод.
 *
 * Стоит на столе так, как печатается: широкой кромкой вниз.
 */
export function createLampShadeGeometry(
  params: Partial<LampParams>,
): BufferGeometry {
  return buildShadeGeometry(normalizeLampParams(params));
}

/**
 * Основание светильника: полая тумба с гнездом патрона и посадочным кольцом.
 *
 * Канал под провод — сквозное отверстие в дне: кабель выходит снизу, а в
 * полости остаётся место для клеммника и патрона.
 */
export function createLampBaseGeometry(
  params: Partial<LampParams>,
): BufferGeometry {
  return buildBaseGeometry(normalizeLampParams(params));
}

/**
 * Собирает светильник целиком или отдельную деталь.
 *
 * В сборке абажур стоит на верхней плите основания, а посадочное кольцо уходит
 * внутрь его нижней кромки. Детали для печати возвращаются отдельно и стоят на
 * столе: так их и режет слайсер, разворачивать не нужно.
 */
export function createLampGeometry(
  params: Partial<LampParams>,
  part: LampPart = "all",
): BufferGeometry {
  const normalized = normalizeLampParams(params);

  if (part === "base") {
    return buildBaseGeometry(normalized);
  }

  if (part === "shade") {
    return buildShadeGeometry(normalized);
  }

  const base = buildBaseGeometry(normalized);
  const shade = buildShadeGeometry(normalized);
  shade.translate(0, normalized.lampBaseHeight, 0);

  const merged = mergeGeometries([base, shade]);

  base.dispose();
  shade.dispose();

  return merged ?? new BufferGeometry();
}

