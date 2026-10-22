import { BufferGeometry, Float32BufferAttribute } from "three";

import {
  normalizeJewelryStandParams,
  type JewelryStandParams,
} from "@/lib/constructor/params";
import {
  addCylinder,
  addSolidPrism,
  circlePolygon,
} from "@/lib/constructor/prism-mesh";

/**
 * Геометрия подставки для украшений.
 *
 * Стойка собирается из четырёх частей: диск-основание, вертикальная стойка,
 * перекладина под кольца и два рожка для цепочек. Набор задаёт `jewelryConfig`:
 * `rings` оставляет только перекладину, `necklace` — только рожки, `combo` —
 * обе части.
 *
 * Все части пересекаются: стойка начинается внутри основания, перекладина
 * проходит сквозь стойку, рожки растут из её верхней части. Каждая часть при
 * этом замкнута, поэтому деталь печатается одним телом без поддержек — наклон
 * рожков не круче 45°, и принтер кладёт их без опор.
 *
 * Деталь построена Z-вверх; предпросмотр поворачивает меш, как корпус коробки.
 */

/** Высота диска-основания, мм: низкий центр тяжести против опрокидывания. */
const JEWELRY_BASE_HEIGHT_MM = 8;

/** Насколько стойка уходит внутрь основания, мм: запас на слияние тел. */
const JEWELRY_JOIN_MM = 1;

/** Радиус стойки, мм: держит вес нескольких колец и не гнётся. */
const JEWELRY_POST_RADIUS_MM = 5.5;

/** Радиус перекладины под кольца, мм. */
const JEWELRY_BAR_RADIUS_MM = 4.2;

/** Радиус рожка для цепочки, мм: 6.8 мм в диаметре — цепочка не соскакивает. */
const JEWELRY_HORN_RADIUS_MM = 3.4;

/** Длина перекладины в долях диаметра основания. */
const JEWELRY_BAR_LENGTH_RATIO = 0.8;

/** Высота перекладины в долях общей высоты стойки. */
const JEWELRY_BAR_HEIGHT_RATIO = 0.62;

/** Вынос рожка от оси в долях диаметра основания. */
const JEWELRY_HORN_LENGTH_RATIO = 0.34;

/** Подъём рожка в долях высоты стойки. */
const JEWELRY_HORN_RISE_RATIO = 0.16;

/** Минимальный подъём рожка, мм: на низкой стойке наклон иначе слишком крутой. */
const JEWELRY_HORN_MIN_RISE_MM = 16;

/** Отступ кончика рожка от верха стойки, мм: торцы не лежат в одной плоскости. */
const JEWELRY_HORN_TOP_MARGIN_MM = 1;

/** Число сторон круглых частей, шт.: 48 сегментов хватает для гладкой стойки. */
const JEWELRY_BASE_SIDES = 64;
const JEWELRY_POST_SIDES = 48;
const JEWELRY_BAR_SIDES = 28;
const JEWELRY_HORN_SIDES = 24;

/**
 * Геометрия подставки для украшений для набора параметров.
 *
 * Функция принимает частичные параметры: недостающие поля берутся из значений
 * по умолчанию, поэтому предпросмотр может вызвать её с любым набором.
 */
export function createJewelryStandGeometry(
  params: Partial<JewelryStandParams>,
): BufferGeometry {
  const normalized = normalizeJewelryStandParams(params);
  const positions: number[] = [];
  const height = normalized.jewelryHeight;
  const baseRadius = normalized.jewelryBase / 2;
  const withRings = normalized.jewelryConfig !== "necklace";
  const withNecklace = normalized.jewelryConfig !== "rings";

  addSolidPrism(
    positions,
    circlePolygon(baseRadius, JEWELRY_BASE_SIDES),
    0,
    JEWELRY_BASE_HEIGHT_MM,
  );

  // Стойка начинается внутри основания: миллиметр пересечения склеивает тела.
  addCylinder(
    positions,
    [0, 0, JEWELRY_BASE_HEIGHT_MM - JEWELRY_JOIN_MM],
    [0, 0, height],
    JEWELRY_POST_RADIUS_MM,
    JEWELRY_POST_SIDES,
  );

  if (withRings) {
    const halfBar = (normalized.jewelryBase * JEWELRY_BAR_LENGTH_RATIO) / 2;
    const barZ = height * JEWELRY_BAR_HEIGHT_RATIO;

    addCylinder(
      positions,
      [-halfBar, 0, barZ],
      [halfBar, 0, barZ],
      JEWELRY_BAR_RADIUS_MM,
      JEWELRY_BAR_SIDES,
    );
  }

  if (withNecklace) {
    // Кончик выходит за стойку минимум на два своих диаметра, иначе цепочка
    // упирается в стойку и рожок бесполезен на маленьком основании.
    const tipX = Math.max(
      normalized.jewelryBase * JEWELRY_HORN_LENGTH_RATIO,
      JEWELRY_POST_RADIUS_MM + JEWELRY_HORN_RADIUS_MM * 2,
    );
    const rootX = JEWELRY_POST_RADIUS_MM - JEWELRY_HORN_RADIUS_MM / 2;
    const rise = Math.max(
      JEWELRY_HORN_MIN_RISE_MM,
      height * JEWELRY_HORN_RISE_RATIO,
    );
    // Вынос не больше подъёма: наклон рожка к вертикали остаётся в пределах 45°,
    // поэтому принтер кладёт его без поддержек даже на большом основании.
    const run = Math.min(tipX - rootX, rise);
    const tipZ = height - JEWELRY_HORN_TOP_MARGIN_MM;
    const rootZ = tipZ - rise;

    for (const side of [-1, 1]) {
      addCylinder(
        positions,
        [side * rootX, 0, rootZ],
        [side * (rootX + run), 0, tipZ],
        JEWELRY_HORN_RADIUS_MM,
        JEWELRY_HORN_SIDES,
      );
    }
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  return geometry;
}
