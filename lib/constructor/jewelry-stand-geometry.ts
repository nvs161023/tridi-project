import { BufferGeometry } from "three";

import {
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
  createJewelryTreeGeometry,
  jewelryTreePlan,
} from "@/lib/constructor/jewelry-tree-geometry";

/**
 * Геометрия подставки для украшений: диспетчер премиум-коллекции.
 *
 * `jewelryPreset` выбирает форму: лист-лоток собирает
 * `jewelry-leaf-geometry.ts`, бюст оленя — `jewelry-deer-geometry.ts`, плетёное
 * древо — `jewelry-tree-geometry.ts`. Других веток нет: классическая стойка со
 * штангой и рожками удалена вместе со своими размерами и набором держателей,
 * поэтому каждый пресет сразу получает собственный генератор.
 *
 * Детали построены Z-вверх; предпросмотр поворачивает меш, как корпус коробки.
 */

/** Габарит модели для подписи и предпросмотра. */
export type JewelryStandMetrics = {
  readonly widthMm: number;
  readonly depthMm: number;
  readonly heightMm: number;
};

/**
 * Габарит подставки по её параметрам, без сборки меша.
 *
 * У листа длину и ширину задают ползунки, а высоту — крючок: сама плита ниже.
 * У оленя габарит в плане — база и размах рогов, высота — рога. У древа в плане
 * диаметр чаши-лотка, высота — верхушка ствола.
 */
export function jewelryStandMetrics(
  params: Partial<JewelryStandParams>,
): JewelryStandMetrics {
  const normalized = normalizeJewelryStandParams(params);

  switch (normalized.jewelryPreset) {
    case "leaf_tray":
      return {
        widthMm: normalized.jewelryLeafLength,
        depthMm: normalized.jewelryLeafWidth,
        heightMm: jewelryLeafHeightMm(normalized),
      };

    case "deer_bust": {
      const plan = jewelryDeerPlan(normalized);

      return {
        widthMm: Math.max(plan.baseLengthMm, plan.antlerOuterXMm * 2),
        depthMm: plan.baseWidthMm,
        heightMm: plan.heightMm,
      };
    }

    case "braided_tree": {
      const plan = jewelryTreePlan(normalized);

      // Ветви и бусины остаются над базой, поэтому габарит в плане равен её
      // диаметру. Удвоенный вынос — страховка на случай правки вылета ветвей.
      return {
        widthMm: Math.max(normalized.treeBaseDiameter, plan.reachMm * 2),
        depthMm: Math.max(normalized.treeBaseDiameter, plan.reachMm * 2),
        heightMm: plan.heightMm,
      };
    }
  }
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

  switch (normalized.jewelryPreset) {
    case "leaf_tray":
      return createJewelryLeafGeometry(normalized);

    case "deer_bust":
      return createJewelryDeerGeometry(normalized);

    case "braided_tree":
      return createJewelryTreeGeometry(normalized);
  }
}
