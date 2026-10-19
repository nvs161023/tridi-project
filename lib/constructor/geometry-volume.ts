import type { BufferGeometry } from "three";

/**
 * Объём замкнутой сетки по формуле ориентированного объёма, мм³.
 *
 * Сумма dot(a, b × c) / 6 по треугольникам даёт объём тела при наружной
 * ориентации. Для предпросмотра важен модуль: у вазы обход уже развёрнут, а
 * у составного брелока основа и буквы — отдельные замкнутые оболочки. Их
 * объёмы складываются, поэтому небольшая общая часть имени считается дважды.
 *
 * Функция работает и с индексированной сеткой, и с неиндексированной:
 * ExtrudeGeometry и TextGeometry выдают второй вариант.
 */
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
