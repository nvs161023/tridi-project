import type { BufferGeometry } from "three";

/**
 * Расход пластика по готовой сетке: объём и вес в граммах.
 *
 * Объём считается по формуле ориентированного объёма: сумма dot(a, b × c) / 6
 * по треугольникам даёт объём тела при наружной ориентации. Для предпросмотра
 * важен модуль: у вазы обход уже развёрнут, а у составного брелока основа и
 * буквы — отдельные замкнутые оболочки. Их объёмы складываются, поэтому
 * небольшая общая часть имени считается дважды.
 *
 * Вес переводит кубические миллиметры в кубические сантиметры и умножает на
 * плотность материала. По умолчанию взята плотность PLA — 1.24 г/см³, самый
 * частый материал конструктора. Это оценка по сплошному объёму: заполнение,
 * периметры и усадка в неё не входят, поэтому слайсер покажет немного меньше.
 *
 * Функции работают и с индексированной сеткой, и с неиндексированной:
 * ExtrudeGeometry и TextGeometry выдают второй вариант.
 */

/** Плотность PLA, г/см³: среднее значение для расчёта веса модели. */
export const PLA_DENSITY_G_PER_CM3 = 1.24;

/** Объём замкнутой сетки в мм³. */
export function calculateGeometryVolumeMm3(geometry: BufferGeometry): number {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();

  if (!position) {
    return 0;
  }

  const triangleCount = index ? index.count : position.count;
  let total = 0;

  for (let offset = 0; offset + 2 < triangleCount; offset += 3) {
    const a = index ? index.getX(offset) : offset;
    const b = index ? index.getX(offset + 1) : offset + 1;
    const c = index ? index.getX(offset + 2) : offset + 2;

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

  return Math.abs(total) / 6;
}

/**
 * Вес пластика для готовой сетки, граммы.
 *
 * Объём в мм³ переводится в см³ делением на 1000 и умножается на плотность:
 * 1 см³ PLA весит 1.24 г. Плотность можно передать явно, если модель печатают
 * другим материалом (PETG — 1.27, ABS — 1.04), но по умолчанию считается PLA.
 */
export function calculateGeometryWeightGrams(
  geometry: BufferGeometry,
  densityGramsPerCm3: number = PLA_DENSITY_G_PER_CM3,
): number {
  const volumeCm3 = calculateGeometryVolumeMm3(geometry) / 1000;

  return volumeCm3 * densityGramsPerCm3;
}
