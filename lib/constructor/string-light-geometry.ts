import { BufferGeometry, Float32BufferAttribute } from "three";

import {
  normalizeStringLightParams,
  type StringLightParams,
} from "@/lib/constructor/params";

/**
 * Геометрия плафонов для LED-гирлянды.
 *
 * Плафон — усечённый конус со стенкой: снизу широкий раструб, сверху отверстие
 * под цоколь. Наружная и внутренняя поверхности наклонены, поэтому стенка
 * получается постоянной толщины по нормали, а не по горизонтали. Верхний торец
 * — кольцо вокруг отверстия: за него плафон и держится на патроне, крепёж не
 * нужен.
 *
 * Несколько плафонов строятся в одном файле в ряд: гирлянду собирают партиями,
 * и печатать по одному невыгодно. Между плафонами остаётся зазор, чтобы сопло
 * не переезжало через уже напечатанную деталь.
 *
 * Деталь построена Z-вверх, как кашпо и коробка; предпросмотр поворачивает меш.
 * Раструбом вниз деталь печатается без поддержек: стенка наклонена внутрь,
 * нависание заметно меньше 45°.
 */

/** Число сторон сечения плафона: 96 отрезков дают ровный конус. */
const LIGHT_SIDES = 96;

/** Зазор между плафонами в общем файле, мм: сопло проходит между деталями. */
const LIGHT_GAP_MM = 6;

/**
 * Замкнутая коническая оболочка: наружная и внутренняя стенки и два торца.
 *
 * Радиусы задаются отдельно для низа и верха, поэтому стенка наклонена.
 * Обход наружной стенки — против часовой стрелки сверху, как у призмы; у
 * внутренней обход обратный, иначе нормали смотрят в материал и STL
 * выворачивается. Торцы — плоские кольца: нижнее смотрит вниз, верхнее вверх.
 */
function addConicalShell(
  positions: number[],
  bottomOuter: number,
  bottomInner: number,
  topOuter: number,
  topInner: number,
  height: number,
  dx: number,
): void {
  const outerBottom: number[][] = [];
  const outerTop: number[][] = [];
  const innerBottom: number[][] = [];
  const innerTop: number[][] = [];

  for (let index = 0; index < LIGHT_SIDES; index += 1) {
    const angle = (Math.PI * 2 * index) / LIGHT_SIDES;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    outerBottom.push([dx + bottomOuter * cos, bottomOuter * sin]);
    outerTop.push([dx + topOuter * cos, topOuter * sin]);
    innerBottom.push([dx + bottomInner * cos, bottomInner * sin]);
    innerTop.push([dx + topInner * cos, topInner * sin]);
  }

  for (let index = 0; index < LIGHT_SIDES; index += 1) {
    const next = (index + 1) % LIGHT_SIDES;
    const [ob0x, ob0y] = outerBottom[index];
    const [ob1x, ob1y] = outerBottom[next];
    const [ot0x, ot0y] = outerTop[index];
    const [ot1x, ot1y] = outerTop[next];
    const [ib0x, ib0y] = innerBottom[index];
    const [ib1x, ib1y] = innerBottom[next];
    const [it0x, it0y] = innerTop[index];
    const [it1x, it1y] = innerTop[next];

    positions.push(
      // Наружная стенка: нормали наружу от оси.
      ob0x,
      ob0y,
      0,
      ob1x,
      ob1y,
      0,
      ot1x,
      ot1y,
      height,
      ob0x,
      ob0y,
      0,
      ot1x,
      ot1y,
      height,
      ot0x,
      ot0y,
      height,
      // Внутренняя стенка: обход обратный, нормали в отверстие.
      ib0x,
      ib0y,
      0,
      it0x,
      it0y,
      height,
      it1x,
      it1y,
      height,
      ib0x,
      ib0y,
      0,
      it1x,
      it1y,
      height,
      ib1x,
      ib1y,
      0,
      // Нижний торец — на стол, верхний — под цоколь.
      ob0x,
      ob0y,
      0,
      ib0x,
      ib0y,
      0,
      ib1x,
      ib1y,
      0,
      ob0x,
      ob0y,
      0,
      ib1x,
      ib1y,
      0,
      ob1x,
      ob1y,
      0,
      ot0x,
      ot0y,
      height,
      ot1x,
      ot1y,
      height,
      it1x,
      it1y,
      height,
      ot0x,
      ot0y,
      height,
      it1x,
      it1y,
      height,
      it0x,
      it0y,
      height,
    );
  }
}

/**
 * Геометрия плафонов для набора параметров.
 *
 * Функция принимает частичные параметры: недостающие поля берутся из значений
 * по умолчанию, поэтому предпросмотр может вызвать её с любым набором.
 */
export function createStringLightGeometry(
  params: Partial<StringLightParams>,
): BufferGeometry {
  const normalized = normalizeStringLightParams(params);
  const positions: number[] = [];
  const radius = normalized.lightDiameter / 2;
  const wall = normalized.lightWall;
  const socketRadius = normalized.lightSocket / 2;
  const count = Math.max(1, Math.round(normalized.lightCount));
  const totalWidth =
    normalized.lightDiameter * count + LIGHT_GAP_MM * (count - 1);

  for (let index = 0; index < count; index += 1) {
    const centerX =
      -totalWidth / 2 +
      normalized.lightDiameter / 2 +
      index * (normalized.lightDiameter + LIGHT_GAP_MM);

    addConicalShell(
      positions,
      radius,
      radius - wall,
      socketRadius + wall,
      socketRadius,
      normalized.lightHeight,
      centerX,
    );
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  return geometry;
}
