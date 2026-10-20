import { LatheGeometry } from "three";
import type { BufferGeometry, Vector2 } from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import {
  CONSTRUCTOR_LIMITS,
  DEFAULT_VASE_PARAMS,
  isVasePattern,
  isVaseShape,
  type VaseParams,
  type VasePattern,
  type VaseShape,
} from "@/lib/constructor/params";
import {
  DETAIL_PATTERN_SCALE,
  honeycombWave,
  scalesWave,
} from "@/lib/constructor/pattern-waves";

/**
 * Превращает осевой профиль в замкнутую геометрию вазы.
 *
 * LatheGeometry вращает профиль вокруг оси Y и создаёт вершины на каждом
 * радиальном сегменте. На оси вращения и на шве окружности (φ = 0 и φ = 2π)
 * появляются совпадающие вершины и треугольники нулевой площади. Для
 * предпросмотра они безвредны, но STL и слайсеры любят чистую сетку, поэтому
 * здесь пять шагов: многоугольное сечение для square и octagon, смещение
 * вершин узором, сварка по координатам, удаление вырожденных треугольников и
 * пересчёт нормалей по итоговому обходу.
 */

/** 128 сегментов: при диаметре 200 мм хорда около 4.9 мм, силуэт гладкий. */
export const LATHE_SEGMENTS = 128;

/** Допуск сварки: координаты ближе 0.0001 мм считаем одной вершиной. */
const WELD_TOLERANCE_MM = 1e-4;

/**
 * Минимальный радиус после многоугольного сжатия, мм.
 *
 * Формула многоугольника не даёт отрицательного радиуса, но страховка нужна:
 * при экстремально толстой стенке внутренняя поверхность не должна сложиться
 * через ось. Толщина на печатных размерах остаётся точной.
 */
const MIN_SHAPED_RADIUS_MM = 0.2;

/**
 * Какую долю минимального радиуса может занимать амплитуда узора.
 *
 * Если сместить стенку внутрь сильнее радиуса, кольцо вывернется через ось.
 * Ограничение общее для всех вершин, поэтому внешняя и внутренняя стенки
 * получают одинаковое смещение и толщина остаётся прежней.
 */
const MAX_PATTERN_RADIUS_SHARE = 0.45;

/** Параметры формы и рельефа, которые нужны геометрии вазы. */
export type VaseGeometryParams = Partial<
  Pick<VaseParams, "shape" | "pattern" | "patternIntensity" | "patternFrequency">
>;

/** Минимум полей BufferAttribute, которые нужны для чтения радиуса. */
type PositionAttribute = {
  readonly count: number;
  getX(index: number): number;
  getZ(index: number): number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Минимальный радиус профиля без вершин на оси вращения. */
function findMinRadius(position: PositionAttribute): number {
  let minimum = Number.POSITIVE_INFINITY;

  for (let index = 0; index < position.count; index += 1) {
    const radius = Math.hypot(position.getX(index), position.getZ(index));

    if (radius > WELD_TOLERANCE_MM) {
      minimum = Math.min(minimum, radius);
    }
  }

  return Number.isFinite(minimum) ? minimum : 0;
}

/** Максимальный радиус сетки: масштаб ячеек узора по высоте. */
function findMaxRadius(position: PositionAttribute): number {
  let maximum = 0;

  for (let index = 0; index < position.count; index += 1) {
    maximum = Math.max(
      maximum,
      Math.hypot(position.getX(index), position.getZ(index)),
    );
  }

  return maximum;
}

/**
 * Сколько сторон у многоугольного сечения.
 *
 * Возвращается null для тел вращения: у classic, cone, cylinder, hourglass,
 * teardrop и double_bulb сечение остаётся круглым.
 */
function polygonSides(shape: VaseShape): number | null {
  switch (shape) {
    case "square":
      return 4;
    case "octagon":
      return 8;
    default:
      return null;
  }
}

/**
 * Множитель радиуса для многоугольного сечения.
 *
 * В полярных координатах правильный многоугольник с центром в оси задаётся
 * расстоянием до ближайшей грани: r(φ) = a / cos(δ), где a — радиус вписанной
 * окружности, δ — угол до нормали грани. Формула непрерывна, поэтому
 * LatheGeometry с её 128 сегментами даёт плоские грани и острые углы без
 * отдельной триангуляции. Множитель нормирован так, что в углах он равен
 * единице: габарит не выходит за diameter, а грань квадрата получается
 * diameter / √2.
 *
 * Множитель зависит только от угла, поэтому все точки одного луча сжимаются
 * одинаково и сечение остаётся звездообразным: кольца не пересекаются, сетка
 * не рвётся.
 */
function createPolygonFactor(
  shape: VaseShape,
): ((angle: number) => number) | null {
  const sides = polygonSides(shape);

  if (sides === null) {
    return null;
  }

  const sector = (Math.PI * 2) / sides;
  const halfSector = sector / 2;
  const flatRadiusShare = Math.cos(halfSector);

  return (angle) => {
    const wrapped = ((angle % sector) + sector) % sector;
    const distance = Math.min(wrapped, sector - wrapped);

    return flatRadiusShare / Math.cos(distance);
  };
}

/** Точка профиля в координатах «радиус — высота». */
type HeightRadius = {
  height: number;
  radius: number;
};

/** Внешняя и внутренняя стенка профиля, отсортированные по высоте. */
type ProfileRadii = {
  outer: HeightRadius[];
  inner: HeightRadius[];
};

/**
 * Раскладывает осевой профиль на внешнюю и внутреннюю стенки.
 *
 * Профиль начинается на оси, идёт по внешней стенке вверх, затем по кромке
 * переходит на внутреннюю стенку и спускается к дну полости. Верхняя точка
 * внешней стенки — самая дальняя от оси точка кромки: у кольца кромки тот же
 * y, а внутренний радиус меньше. Всё, что идёт после неё до оси, — внутренняя
 * поверхность.
 */
function buildProfileRadii(profile: Vector2[]): ProfileRadii {
  let maxHeight = 0;

  for (const point of profile) {
    maxHeight = Math.max(maxHeight, point.y);
  }

  let outerTop = 1;
  let outerTopRadius = -1;

  for (let index = 1; index < profile.length; index += 1) {
    const point = profile[index];

    if (Math.abs(point.y - maxHeight) > WELD_TOLERANCE_MM) {
      continue;
    }

    if (point.x > outerTopRadius) {
      outerTopRadius = point.x;
      outerTop = index;
    }
  }

  const outer: HeightRadius[] = [];

  for (let index = 1; index <= outerTop; index += 1) {
    outer.push({ height: profile[index].y, radius: profile[index].x });
  }

  const inner: HeightRadius[] = [];

  for (let index = outerTop + 1; index < profile.length; index += 1) {
    const point = profile[index];

    // Первая точка с нулевым радиусом — ось на дне полости. Дальше идут
    // только служебные точки замыкания контура.
    if (point.x <= WELD_TOLERANCE_MM) {
      break;
    }

    inner.push({ height: point.y, radius: point.x });
  }

  outer.sort((first, second) => first.height - second.height);
  inner.sort((first, second) => first.height - second.height);

  return { outer, inner };
}

/** Радиус стенки на заданной высоте: линейная интерполяция по профилю. */
function radiusAtHeight(samples: HeightRadius[], height: number): number {
  if (samples.length === 0) {
    return Number.NaN;
  }

  if (height <= samples[0].height) {
    return samples[0].radius;
  }

  const last = samples[samples.length - 1];

  if (height >= last.height) {
    return last.radius;
  }

  let low = 0;
  let high = samples.length - 1;

  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);

    if (samples[middle].height <= height) {
      low = middle;
    } else {
      high = middle;
    }
  }

  const lower = samples[low];
  const upper = samples[high];
  const span = upper.height - lower.height;

  if (span <= WELD_TOLERANCE_MM) {
    return upper.radius;
  }

  const share = (height - lower.height) / span;

  return lower.radius + (upper.radius - lower.radius) * share;
}

/**
 * Превращает круглое сечение в квадратное или восьмигранное.
 *
 * Для внешней стенки достаточно умножить радиус на множитель многоугольника.
 * Внутреннюю стенку нельзя просто масштабировать: на гранях множитель меньше
 * единицы, и стенка стала бы тоньше почти на 29%. Поэтому внутренняя точка
 * сдвигается на ту же величину, что и внешняя на своём луче: из нового внешнего
 * радиуса вычитается прежняя толщина. Тогда на любой высоте и под любым углом
 * стенка остаётся ровно такой, какой её задал слайдер.
 *
 * Точки на оси остаются на месте — иначе дно и кольцо кромки потеряли бы
 * герметичность. Горизонтальные поверхности (дно, дно полости, кромка) состоят
 * из тех же колец профиля, поэтому сшиваются с новыми стенками без разрывов.
 */
function applyShape(
  lathe: LatheGeometry,
  profile: Vector2[],
  params: VaseGeometryParams,
): void {
  if (!isVaseShape(params.shape)) {
    return;
  }

  const factorAt = createPolygonFactor(params.shape);

  if (!factorAt) {
    return;
  }

  const { outer, inner } = buildProfileRadii(profile);

  if (outer.length === 0 || inner.length === 0) {
    return;
  }

  const position = lathe.getAttribute("position");

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const radius = Math.hypot(x, z);

    if (radius <= WELD_TOLERANCE_MM) {
      continue;
    }

    const factor = factorAt(Math.atan2(z, x));
    const outerRadius = radiusAtHeight(outer, y);
    const innerRadius = radiusAtHeight(inner, y);

    if (!Number.isFinite(outerRadius) || !Number.isFinite(innerRadius)) {
      continue;
    }

    const isOuterWall = radius >= (outerRadius + innerRadius) / 2;
    const nextRadius = isOuterWall
      ? radius * factor
      : Math.max(
          radius * factor -
            (1 - factor) * Math.max(outerRadius - innerRadius, 0),
          MIN_SHAPED_RADIUS_MM,
        );
    const scale = nextRadius / radius;

    position.setX(index, x * scale);
    position.setZ(index, z * scale);
  }

  position.needsUpdate = true;
}

/**
 * Значение узора в диапазоне [-1, 1] для угла и высоты вершины.
 *
 * Соты и чешуйки считаются в безразмерных координатах: по окружности фаза
 * равна angle × frequency, а по высоте — height × frequency / referenceRadius.
 * Для этих двух узоров частота ещё умножается на DETAIL_PATTERN_SCALE: ячейки
 * должны быть мельче рёбер. Опорный радиус переводит миллиметры высоты в те же
 * единицы, что и дуга окружности, поэтому ячейки остаются правильными при
 * любом диаметре. Без divisor соты на высокой вазе вытянулись бы по вертикали.
 */
function patternWave(
  pattern: VasePattern,
  angle: number,
  height: number,
  frequency: number,
  referenceRadius: number,
): number {
  const phaseFrequency =
    pattern === "honeycomb" || pattern === "scales"
      ? frequency * DETAIL_PATTERN_SCALE
      : frequency;
  const circumferencePhase = angle * phaseFrequency;
  const verticalPhase =
    (height * phaseFrequency) / Math.max(referenceRadius, 1);

  switch (pattern) {
    case "spiral":
      return Math.sin(circumferencePhase + height * 0.1);
    case "ribs":
      return Math.sin(circumferencePhase);
    case "waves":
      return Math.sin(height * frequency);
    case "honeycomb":
      return honeycombWave(circumferencePhase, verticalPhase);
    case "scales":
      return scalesWave(circumferencePhase, verticalPhase);
    default:
      return 0;
  }
}

/**
 * Смещает вершины LatheGeometry по математическому узору.
 *
 * Функция работает до сварки: шов окружности и ось ещё продублированы, но
 * смещение зависит только от угла и высоты, поэтому совпадающие вершины
 * остаются совпадающими и после mergeVertices. Внешняя и внутренняя стенки на
 * одной высоте получают одинаковый сдвиг радиуса — толщина стенки сохраняется.
 * Вершины на оси не двигаются, иначе дно и кромка отошли бы от центра.
 *
 * Топология не меняется: вершины только переставляются, число треугольников
 * остаётся прежним. Нормали считаются позже, после сварки и очистки.
 */
function applyPattern(
  lathe: LatheGeometry,
  params: VaseGeometryParams,
): void {
  const pattern = isVasePattern(params.pattern)
    ? params.pattern
    : DEFAULT_VASE_PARAMS.pattern;

  if (pattern === "smooth") {
    return;
  }

  const intensity = clamp(
    params.patternIntensity ?? DEFAULT_VASE_PARAMS.patternIntensity,
    CONSTRUCTOR_LIMITS.patternIntensity.min,
    CONSTRUCTOR_LIMITS.patternIntensity.max,
  );
  const frequency = clamp(
    Math.round(
      params.patternFrequency ?? DEFAULT_VASE_PARAMS.patternFrequency,
    ),
    CONSTRUCTOR_LIMITS.patternFrequency.min,
    CONSTRUCTOR_LIMITS.patternFrequency.max,
  );

  if (intensity <= 0) {
    return;
  }

  const position = lathe.getAttribute("position");
  const minRadius = findMinRadius(position);
  const referenceRadius =
    pattern === "honeycomb" || pattern === "scales"
      ? findMaxRadius(position)
      : 1;
  const safeIntensity = Math.min(
    intensity,
    minRadius * MAX_PATTERN_RADIUS_SHARE,
  );

  if (safeIntensity <= 0) {
    return;
  }

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const radius = Math.hypot(x, z);

    // Точки на оси вращения должны остаться в центре: иначе дно и горловина
    // потеряют герметичность, а сварка склеит смещённые копии в стороне.
    if (radius <= WELD_TOLERANCE_MM) {
      continue;
    }

    const angle = Math.atan2(z, x);
    const offset =
      patternWave(pattern, angle, y, frequency, referenceRadius) *
      safeIntensity;
    const scale = (radius + offset) / radius;

    position.setX(index, x * scale);
    position.setZ(index, z * scale);
  }

  position.needsUpdate = true;
}

/**
 * Порог площади вырожденного треугольника. Сравниваем квадрат длины
 * векторного произведения сторон: он равен (2 × площадь)², поэтому 1e-10
 * соответствует площади порядка 5 × 10⁻⁶ мм² — это шум float32.
 */
const MIN_CROSS_LENGTH_SQ = 1e-10;

/**
 * Сварка вершин и удаление треугольников с нулевой площадью.
 *
 * mergeVertices сравнивает все атрибуты вершины. Если оставить normal и uv,
 * вершины на шве окружности и на кромке не совпадут из-за разных UV и
 * нормалей, и сварка ничего не сделает. Поэтому удаляем их до сварки, а
 * нормали считаем заново после очистки.
 */
function weldAndClean(lathe: LatheGeometry): BufferGeometry {
  lathe.deleteAttribute("normal");
  lathe.deleteAttribute("uv");

  const geometry = mergeVertices(lathe, WELD_TOLERANCE_MM);
  lathe.dispose();

  const index = geometry.getIndex();
  const position = geometry.getAttribute("position");

  if (!index || !position) {
    throw new Error("LatheGeometry: после сварки нет индекса или позиций");
  }

  const source = index.array;
  const kept: number[] = [];

  for (let offset = 0; offset < source.length; offset += 3) {
    const a = source[offset];
    const b = source[offset + 1];
    const c = source[offset + 2];

    // На оси вращения все кольцевые копии точки слились в одну вершину:
    // у таких треугольников два индекса совпадают.
    if (a === b || b === c || c === a) {
      continue;
    }

    const ax = position.getX(a);
    const ay = position.getY(a);
    const az = position.getZ(a);
    const bx = position.getX(b);
    const by = position.getY(b);
    const bz = position.getZ(b);
    const cx = position.getX(c);
    const cy = position.getY(c);
    const cz = position.getZ(c);

    const abx = bx - ax;
    const aby = by - ay;
    const abz = bz - az;
    const acx = cx - ax;
    const acy = cy - ay;
    const acz = cz - az;

    const crossX = aby * acz - abz * acy;
    const crossY = abz * acx - abx * acz;
    const crossZ = abx * acy - aby * acx;

    if (
      crossX * crossX + crossY * crossY + crossZ * crossZ <=
      MIN_CROSS_LENGTH_SQ
    ) {
      continue;
    }

    kept.push(a, b, c);
  }

  if (kept.length === 0) {
    throw new Error("LatheGeometry: после очистки не осталось треугольников");
  }

  geometry.setIndex(kept);

  return geometry;
}

/**
 * Утроенный объём замкнутой сетки со знаком.
 *
 * Сумма dot(a, b × c) / 6 по треугольникам даёт объём тела при наружной
 * ориентации. Отрицательное значение означает, что обход всех треугольников
 * направлен внутрь — тогда его нужно развернуть.
 */
function signedVolumeTimesSix(geometry: BufferGeometry): number {
  const index = geometry.getIndex();
  const position = geometry.getAttribute("position");

  if (!index || !position) {
    return 0;
  }

  let total = 0;

  for (let offset = 0; offset < index.count; offset += 3) {
    const a = index.getX(offset);
    const b = index.getX(offset + 1);
    const c = index.getX(offset + 2);

    const ax = position.getX(a);
    const ay = position.getY(a);
    const az = position.getZ(a);
    const bx = position.getX(b);
    const by = position.getY(b);
    const bz = position.getZ(b);
    const cx = position.getX(c);
    const cy = position.getY(c);
    const cz = position.getZ(c);

    total +=
      ax * (by * cz - bz * cy) -
      ay * (bx * cz - bz * cx) +
      az * (bx * cy - by * cx);
  }

  return total;
}

/**
 * Строит сетку вазы из профиля.
 *
 * Порядок важен: сначала LatheGeometry, затем многоугольное сечение (оно
 * опирается на исходный профиль, чтобы знать толщину стенки), смещение вершин
 * узором, сварка и очистка, проверка знака объёма (при необходимости
 * разворачиваем индексы), и только потом computeVertexNormals — он считает
 * нормали по итоговому обходу треугольников уже с рельефом. Благодаря этому
 * внешние стенки смотрят наружу, а внутренние — в полость.
 */
export function createVaseGeometry(
  profile: Vector2[],
  params: VaseGeometryParams = {},
): BufferGeometry {
  if (profile.length < 3) {
    throw new Error("Профиль вазы должен содержать минимум три точки");
  }

  const lathe = new LatheGeometry(profile, LATHE_SEGMENTS);
  applyShape(lathe, profile, params);
  applyPattern(lathe, params);

  const geometry = weldAndClean(lathe);

  if (signedVolumeTimesSix(geometry) < 0) {
    const index = geometry.getIndex();

    if (index) {
      const indices = index.array as Uint16Array | Uint32Array;

      for (let offset = 0; offset < indices.length; offset += 3) {
        const second = indices[offset + 1];

        indices[offset + 1] = indices[offset + 2];
        indices[offset + 2] = second;
      }

      index.needsUpdate = true;
    }
  }

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}
