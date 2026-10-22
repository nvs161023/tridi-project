import {
  BufferGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Path,
  Shape,
} from "three";

import {
  normalizeCupClipParams,
  type CupClipParams,
} from "@/lib/constructor/params";
import type { Point2 } from "@/lib/constructor/prism-mesh";

/**
 * Геометрия клипсы для кружки.
 *
 * Профиль — буква «П»: мостик ложится на борт, короткая ножка уходит внутрь
 * кружки, длинная свисает снаружи. Стенка борта проходит между ножками, поэтому
 * зазор строится по слайдеру толщины борта. На конце наружной ножки стоит
 * треугольное отверстие под нитку: она входит в него и зажимается в узкой части,
 * так что пакетик висит у стенки и не тонет.
 *
 * Деталь построена в позе печати: профиль «П» лежит в плоскости XY, а ширина
 * клипсы идёт по Z. В таком положении каждый слой повторяет один и тот же
 * профиль, и деталь печатается без поддержек и без единого нависания. На кружке
 * клипса поворачивается на 90°, и ножки смотрят вниз.
 */

/** Зазор между ножками сверх толщины борта, мм: клипса садится и снимается без усилия. */
const CLIP_CLEARANCE_MM = 0.6;

/** Толщина ножек в долях ширины клипсы и её границы, мм. */
const CLIP_LEG_RATIO = 0.25;
const CLIP_LEG_MIN_MM = 3;
const CLIP_LEG_MAX_MM = 5;

/** Длина короткой ножки в долях наружной и её границы, мм. */
const CLIP_INNER_RATIO = 0.45;
const CLIP_INNER_MIN_MM = 8;
const CLIP_INNER_MAX_MM = 18;

/** Ширина основания треугольной прорези в долях толщины ножки. */
const CLIP_NOTCH_RATIO = 0.45;

/** Длина прорези в долях длины ножки и её предел в долях толщины, мм. */
const CLIP_NOTCH_LENGTH_RATIO = 0.3;
const CLIP_NOTCH_LENGTH_LIMIT = 1.8;

/** Отступ прорези от конца ножки в долях её толщины. */
const CLIP_NOTCH_INSET_RATIO = 0.6;

/**
 * Контур профиля «П» против часовой стрелки.
 *
 * Обход начинается от конца наружной ножки, идёт по её внешней стороне, через
 * мостик, вниз по короткой ножке и обратно к зазору. Внутри зазора контур не
 * замыкается: именно эта щель надевается на борт кружки.
 */
function clipOutline(
  gap: number,
  legThickness: number,
  length: number,
  innerLength: number,
): Point2[] {
  const outerX = gap / 2 + legThickness;
  const innerX = -gap / 2 - legThickness;
  const top = length + legThickness;

  return [
    [outerX, 0],
    [outerX, top],
    [innerX, top],
    [innerX, length - innerLength],
    [-gap / 2, length - innerLength],
    [-gap / 2, length],
    [gap / 2, length],
    [gap / 2, 0],
  ];
}

/** Треугольная прорезь под нитку на конце наружной ножки. */
function addThreadNotch(
  shape: Shape,
  gap: number,
  legThickness: number,
  length: number,
): void {
  const centerX = gap / 2 + legThickness / 2;
  const halfBase = (legThickness * CLIP_NOTCH_RATIO) / 2;
  const inset = legThickness * CLIP_NOTCH_INSET_RATIO;
  const height = Math.min(
    length * CLIP_NOTCH_LENGTH_RATIO,
    legThickness * CLIP_NOTCH_LENGTH_LIMIT,
  );
  const notch = new Path();

  notch.moveTo(centerX - halfBase, inset);
  notch.lineTo(centerX + halfBase, inset);
  notch.lineTo(centerX, inset + height);
  notch.closePath();
  shape.holes.push(notch);
}

/**
 * Геометрия клипсы для набора параметров.
 *
 * Недостающие поля берутся из значений по умолчанию, поэтому предпросмотр
 * может вызвать функцию с любым набором параметров.
 */
export function createCupClipGeometry(
  params: Partial<CupClipParams>,
): BufferGeometry {
  const normalized = normalizeCupClipParams(params);
  const width = normalized.cupClipWidth;
  const length = normalized.cupClipLength;
  const legThickness = Math.min(
    Math.max(width * CLIP_LEG_RATIO, CLIP_LEG_MIN_MM),
    CLIP_LEG_MAX_MM,
  );
  const innerLength = Math.min(
    Math.max(length * CLIP_INNER_RATIO, CLIP_INNER_MIN_MM),
    CLIP_INNER_MAX_MM,
    length - legThickness,
  );
  const gap = normalized.cupRim + CLIP_CLEARANCE_MM;
  const shape = new Shape();

  clipOutline(gap, legThickness, length, innerLength).forEach(([x, y], index) => {
    if (index === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  });
  shape.closePath();

  if (normalized.cupClipHook) {
    addThreadNotch(shape, gap, legThickness, length);
  }

  // Ширина клипсы — высота печати: каждый слой повторяет профиль «П».
  const clip = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 8,
    depth: width,
    steps: 1,
  });
  const source = clip.getAttribute("position");
  const positions: number[] = [];

  for (let index = 0; index < source.count; index += 1) {
    positions.push(source.getX(index), source.getY(index), source.getZ(index));
  }

  clip.dispose();

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();

  return geometry;
}
