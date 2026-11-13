import { BufferGeometry, Float32BufferAttribute } from "three";

import {
  CONSTRUCTOR_LIMITS,
  normalizeJewelryStandParams,
  type JewelryStandParams,
} from "@/lib/constructor/params";
import {
  createJewelryLeafGeometry,
  jewelryLeafHeightMm,
} from "@/lib/constructor/jewelry-leaf-geometry";
import {
  createJewelryDeerGeometry,
  jewelryDeerPlan,
} from "@/lib/constructor/jewelry-deer-geometry";
import {
  addCylinder,
  addSolidPrism,
  circlePolygon,
} from "@/lib/constructor/prism-mesh";

/**
 * Геометрия подставки для украшений: диспетчер премиум-коллекции.
 *
 * `jewelryPreset` выбирает форму: лист-лоток собирает `jewelry-leaf-geometry.ts`,
 * бюст оленя — `jewelry-deer-geometry.ts`, а древо пока строится прежней
 * стойкой. Ветка-наследник оставляет сцену непустой, пока пресет выбран, но ещё
 * не реализован.
 *
 * Классическая стойка собирается из четырёх частей: диск-основание,
 * вертикальная стойка, перекладина под кольца и два рожка для цепочек. Набор
 * задаёт `jewelryConfig`: `rings` оставляет только перекладину, `necklace` —
 * только рожки, `combo` — обе части.
 *
 * Перекладина идёт по оси X, рожки — по оси Y: держатели стоят в
 * перпендикулярных плоскостях, поэтому цепочка свисает с рожка мимо колец, как
 * бы узко ни было основание. Рожок — наклон до 45° и вертикальный штырь на
 * конце: торец штыря лежит ровно на высоте стойки, поэтому габарит по Z
 * совпадает с ползунком, а петля находит седло в углу между наклоном и штырём.
 *
 * Все части пересекаются: стойка начинается внутри основания, перекладина
 * проходит сквозь стойку, рожки растут из её верхней части. Каждая часть при
 * этом замкнута, поэтому деталь печатается одним телом без поддержек — наклон
 * рожков не круче 45°, и принтер кладёт их без опор.
 *
 * Деталь построена Z-вверх; предпросмотр поворачивает меш, как корпус коробки.
 */

/** Высота диска-основания, мм: низкий центр тяжести против опрокидывания. */
export const JEWELRY_BASE_HEIGHT_MM = 8;

/** Насколько стойка уходит внутрь основания, мм: запас на слияние тел. */
const JEWELRY_JOIN_MM = 1;

/** Радиус стойки, мм: держит вес нескольких колец и не гнётся. */
export const JEWELRY_POST_RADIUS_MM = 5.5;

/** Радиус перекладины под кольца, мм: глубина по Y равна её диаметру, 8.4 мм. */
export const JEWELRY_BAR_RADIUS_MM = 4.2;

/** Радиус рожка для цепочки, мм: петля ложится на рожок, а не мимо него. */
export const JEWELRY_HORN_RADIUS_MM = 3.4;

/** Длина перекладины в долях диаметра основания. */
const JEWELRY_BAR_LENGTH_RATIO = 0.8;

/** Высота перекладины в долях общей высоты стойки. */
export const JEWELRY_BAR_HEIGHT_RATIO = 0.62;

/** Вынос рожка от оси в долях диаметра основания. */
const JEWELRY_HORN_LENGTH_RATIO = 0.34;

/** Подъём рожка в долях высоты стойки. */
const JEWELRY_HORN_RISE_RATIO = 0.16;

/** Минимальный подъём рожка, мм: на низкой стойке наклон иначе слишком крутой. */
const JEWELRY_HORN_MIN_RISE_MM = 16;

/**
 * Вертикальный штырь на конце рожка, мм.
 *
 * Штырь забирает верх рожка: его торец лежит ровно на высоте стойки, поэтому
 * габарит по Z совпадает с ползунком. Наклонная часть остаётся ниже штыря даже
 * с учётом скоса торца: рожок не круче 45°, значит торец встаёт не выше 2.4 мм
 * над осью, а штырь — на все 4 мм.
 */
const JEWELRY_HORN_TIP_STUB_MM = 4;

/**
 * Радиус штыря, мм: на 0.1 мм толще рожка.
 *
 * Ровно тот же радиус срастил бы торец рожка и низ штыря вершина-в-вершину: на
 * общем ребре сошлись бы четыре треугольника, и сетка перестала бы быть
 * манифолдной. Лишняя десятая миллиметра расводит вершины и заодно даёт петле
 * микроскопический бортик.
 */
export const JEWELRY_HORN_STUB_RADIUS_MM = JEWELRY_HORN_RADIUS_MM + 0.1;

/** Насколько штырь уходит внутрь рожка, мм: запас на слияние тел. */
const JEWELRY_HORN_STUB_JOIN_MM = 0.5;

/**
 * Доля высоты, ниже которой основание считается узким, мм/мм.
 *
 * Порог взят из расчёта опрокидывания: 160/50 даёт 8.4°, 160/80 — 19.4°,
 * 160/90 — 24°. Ниже 0.55·H стойка с подвеской валится от лёгкого толчка.
 */
export const JEWELRY_STABILITY_BASE_RATIO = 0.55;

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
/**
 * Габарит модели для подписи и предпросмотра.
 *
 * У листа длина и ширина заданы ползунками, а высоту задаёт крючок: сама плита
 * ниже. У оленя габарит в плане — это база и размах рогов, высота — рога. У
 * классической стойки габарит в плане равен диаметру основания, а высота —
 * ползунку.
 */
export type JewelryStandMetrics = {
  readonly widthMm: number;
  readonly depthMm: number;
  readonly heightMm: number;
};

/** Габарит подставки по её параметрам, без сборки меша. */
export function jewelryStandMetrics(
  params: Partial<JewelryStandParams>,
): JewelryStandMetrics {
  const normalized = normalizeJewelryStandParams(params);

  if (normalized.jewelryPreset === "leaf_tray") {
    return {
      widthMm: normalized.jewelryLeafLength,
      depthMm: normalized.jewelryLeafWidth,
      heightMm: jewelryLeafHeightMm(normalized),
    };
  }

  if (normalized.jewelryPreset === "deer_bust") {
    const plan = jewelryDeerPlan(normalized);

    return {
      widthMm: Math.max(plan.baseLengthMm, plan.antlerOuterXMm * 2),
      depthMm: plan.baseWidthMm,
      heightMm: plan.heightMm,
    };
  }

  return {
    widthMm: normalized.jewelryBase,
    depthMm: normalized.jewelryBase,
    heightMm: normalized.jewelryHeight,
  };
}

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

  if (normalized.jewelryPreset === "leaf_tray") {
    return createJewelryLeafGeometry(normalized);
  }

  if (normalized.jewelryPreset === "deer_bust") {
    return createJewelryDeerGeometry(normalized);
  }

  return createJewelryPostStandGeometry(normalized);
}

/**
 * Классическая стойка на диск-основании.
 *
 * Это прежняя модель, которая остаётся веткой для ещё не собранного древа. Когда
 * у `braided_tree` появится свой генератор, вызовы этой функции уйдут из
 * диспетчера.
 */
function createJewelryPostStandGeometry(
  normalized: JewelryStandParams,
): BufferGeometry {
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
    // Рожки стоят в плоскости Y: цепочка свисает по Y, а перекладина колец идёт
    // по X, поэтому петля проходит мимо колец даже на узком основании.
    // Кончик выходит за стойку минимум на два своих диаметра, иначе цепочка
    // упирается в стойку и рожок бесполезен на маленьком основании.
    const tipY = Math.max(
      normalized.jewelryBase * JEWELRY_HORN_LENGTH_RATIO,
      JEWELRY_POST_RADIUS_MM + JEWELRY_HORN_RADIUS_MM * 2,
    );
    const rootY = JEWELRY_POST_RADIUS_MM - JEWELRY_HORN_RADIUS_MM / 2;
    const rise = Math.max(
      JEWELRY_HORN_MIN_RISE_MM,
      height * JEWELRY_HORN_RISE_RATIO,
    );
    // Вынос не больше подъёма: наклон рожка к вертикали остаётся в пределах 45°,
    // поэтому принтер кладёт его без поддержек даже на большом основании.
    const run = Math.min(tipY - rootY, rise);
    // Штырь забирает верх рожка: его торец лежит ровно на высоте стойки.
    const stubZ = height - JEWELRY_HORN_TIP_STUB_MM;
    const rootZ = stubZ - rise;

    for (const side of [-1, 1]) {
      addCylinder(
        positions,
        [0, side * rootY, rootZ],
        [0, side * (rootY + run), stubZ],
        JEWELRY_HORN_RADIUS_MM,
        JEWELRY_HORN_SIDES,
      );
      // Вертикальный штырь — седло для петли и стопор для края цепочки. Внутрь
      // рожка он уходит на полмиллиметра, чтобы тела слились без зазора.
      addCylinder(
        positions,
        [0, side * (rootY + run), stubZ - JEWELRY_HORN_STUB_JOIN_MM],
        [0, side * (rootY + run), height],
        JEWELRY_HORN_STUB_RADIUS_MM,
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

/**
 * Порог устойчивости: диаметр основания, ниже которого стойка опрокидывается.
 *
 * Произведение округляется до шести знаков: `160 × 0.55` в двоичной дроби даёт
 * 88.00000000000001, и без округления ползунок на 90 мм считался бы узким.
 */
function jewelryStableThresholdMm(heightMm: number): number {
  return Number((heightMm * JEWELRY_STABILITY_BASE_RATIO).toFixed(6));
}

/** Основание уже порога: высокая стойка валится от лёгкого толчка. */
export function jewelryBaseIsNarrow(heightMm: number, baseMm: number): boolean {
  return baseMm < jewelryStableThresholdMm(heightMm);
}

/**
 * Диаметр основания, при котором высокая стойка стоит уверенно.
 *
 * Порог — `JEWELRY_STABILITY_BASE_RATIO` от высоты, округлённый вверх до шага
 * ползунка: панель советует ровно то значение, которое можно выставить, а не
 * «примерно 88 мм». Границы ползунка соблюдаются с обеих сторон.
 */
export function jewelryStableBaseMm(heightMm: number): number {
  const limits = CONSTRUCTOR_LIMITS.jewelryBase;
  const wanted =
    Math.ceil(jewelryStableThresholdMm(heightMm) / limits.step) * limits.step;

  return Math.min(limits.max, Math.max(limits.min, wanted));
}
