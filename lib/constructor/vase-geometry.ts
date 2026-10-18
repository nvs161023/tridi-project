import { LatheGeometry } from "three";
import type { BufferGeometry, Vector2 } from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Превращает осевой профиль в замкнутую геометрию вазы.
 *
 * LatheGeometry вращает профиль вокруг оси Y и создаёт вершины на каждом
 * радиальном сегменте. На оси вращения и на шве окружности (φ = 0 и φ = 2π)
 * появляются совпадающие вершины и треугольники нулевой площади. Для
 * предпросмотра они безвредны, но STL и слайсеры любят чистую сетку, поэтому
 * здесь три шага: сварка по координатам, удаление вырожденных треугольников и
 * пересчёт нормалей по итоговому обходу.
 */

/** 128 сегментов: при диаметре 200 мм хорда около 4.9 мм, силуэт гладкий. */
export const LATHE_SEGMENTS = 128;

/** Допуск сварки: координаты ближе 0.0001 мм считаем одной вершиной. */
const WELD_TOLERANCE_MM = 1e-4;

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
 * Объём материала по готовой сетке, мм³.
 *
 * abs() нужен на случай, если обход ещё не развёрнут: для интерфейса важен
 * модуль. В createVaseGeometry ориентация уже проверена, поэтому значение
 * совпадает с расчётом по профилю.
 */
export function calculateGeometryVolumeMm3(geometry: BufferGeometry): number {
  return Math.abs(signedVolumeTimesSix(geometry)) / 6;
}

/**
 * Строит сетку вазы из профиля.
 *
 * Порядок важен: сначала сварка и очистка, затем проверка знака объёма (при
 * необходимости разворачиваем индексы), и только потом computeVertexNormals —
 * он считает нормали по итоговому обходу треугольников. Благодаря этому
 * внешние стенки смотрят наружу, а внутренние — в полость.
 */
export function createVaseGeometry(profile: Vector2[]): BufferGeometry {
  if (profile.length < 3) {
    throw new Error("Профиль вазы должен содержать минимум три точки");
  }

  const lathe = new LatheGeometry(profile, LATHE_SEGMENTS);
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
