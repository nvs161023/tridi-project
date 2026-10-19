import { LatheGeometry } from "three";
import type { BufferGeometry, Vector2 } from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import {
  CONSTRUCTOR_LIMITS,
  DEFAULT_VASE_PARAMS,
  isVasePattern,
  type VaseParams,
  type VasePattern,
} from "@/lib/constructor/params";

/**
 * Превращает осевой профиль в замкнутую геометрию вазы.
 *
 * LatheGeometry вращает профиль вокруг оси Y и создаёт вершины на каждом
 * радиальном сегменте. На оси вращения и на шве окружности (φ = 0 и φ = 2π)
 * появляются совпадающие вершины и треугольники нулевой площади. Для
 * предпросмотра они безвредны, но STL и слайсеры любят чистую сетку, поэтому
 * здесь четыре шага: смещение вершин узором, сварка по координатам, удаление
 * вырожденных треугольников и пересчёт нормалей по итоговому обходу.
 */

/** 128 сегментов: при диаметре 200 мм хорда около 4.9 мм, силуэт гладкий. */
export const LATHE_SEGMENTS = 128;

/** Допуск сварки: координаты ближе 0.0001 мм считаем одной вершиной. */
const WELD_TOLERANCE_MM = 1e-4;

/**
 * Какую долю минимального радиуса может занимать амплитуда узора.
 *
 * Если сместить стенку внутрь сильнее радиуса, кольцо вывернется через ось.
 * Ограничение общее для всех вершин, поэтому внешняя и внутренняя стенки
 * получают одинаковое смещение и толщина остаётся прежней.
 */
const MAX_PATTERN_RADIUS_SHARE = 0.45;

/** Настройки рельефа, которые нужны геометрии. */
export type VasePatternParams = Pick<
  VaseParams,
  "pattern" | "patternIntensity" | "patternFrequency"
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

/** Значение узора в диапазоне [-1, 1] для угла и высоты вершины. */
function patternWave(
  pattern: VasePattern,
  angle: number,
  height: number,
  frequency: number,
): number {
  switch (pattern) {
    case "spiral":
      return Math.sin(angle * frequency + height * 0.1);
    case "ribs":
      return Math.sin(angle * frequency);
    case "waves":
      return Math.sin(height * frequency);
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
  params: Partial<VasePatternParams>,
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
    const offset = patternWave(pattern, angle, y, frequency) * safeIntensity;
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
 * Порядок важен: сначала LatheGeometry, затем смещение вершин узором, сварка
 * и очистка, проверка знака объёма (при необходимости разворачиваем индексы),
 * и только потом computeVertexNormals — он считает нормали по итоговому обходу
 * треугольников уже с рельефом. Благодаря этому внешние стенки смотрят наружу,
 * а внутренние — в полость.
 */
export function createVaseGeometry(
  profile: Vector2[],
  pattern: Partial<VasePatternParams> = {},
): BufferGeometry {
  if (profile.length < 3) {
    throw new Error("Профиль вазы должен содержать минимум три точки");
  }

  const lathe = new LatheGeometry(profile, LATHE_SEGMENTS);
  applyPattern(lathe, pattern);

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
