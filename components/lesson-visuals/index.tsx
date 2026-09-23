import type { ComponentType } from "react";

import { BeltPulley } from "./BeltPulley";
import { CoreXYMotion } from "./CoreXYMotion";
import { DirectVsBowden } from "./DirectVsBowden";
import { FilamentDrying } from "./FilamentDrying";
import { FirstLayerGoodBad } from "./FirstLayerGoodBad";
import { HotendCrossSection } from "./HotendCrossSection";
import { InfillPatterns } from "./InfillPatterns";
import { IroningDemo } from "./IroningDemo";
import { LayerStack } from "./LayerStack";
import { MaterialShrinkage } from "./MaterialShrinkage";
import { NozzleLayering } from "./NozzleLayering";
import { NozzleSizes } from "./NozzleSizes";
import { PrintFarmScheme } from "./PrintFarmScheme";
import { ProgressiveDefects } from "./ProgressiveDefects";
import { RetractionPull } from "./RetractionPull";
import { SlicerComparison } from "./SlicerComparison";
import { SpeedComparison } from "./SpeedComparison";
import { StringingDemo } from "./StringingDemo";
import { SupportTree } from "./SupportTree";
import { TemperatureZones } from "./TemperatureZones";
import { VariableLayerHeight } from "./VariableLayerHeight";
import { WarpingDemo } from "./WarpingDemo";

/**
 * SVG-визуализации для блоков image/animation.
 *
 * Компоненты не зависят от данных урока: подписи и цифры внутри SVG взяты из
 * описаний блоков, одинаковых для базового и продвинутого курса. `animated`
 * включает CSS-анимации (блок type="animation"); при false остаётся статичный
 * кадр (блок type="image").
 */
export type VisualProps = { animated?: boolean };

export type VisualComponent = ComponentType<VisualProps>;

export type VisualBlock = { title?: string; content?: string };

/**
 * Правила подбора визуализации: первое совпавшее выигрывает, поэтому порядок
 * важен — узкие темы идут раньше общих. `any` — обязательное совпадение,
 * `all` — дополнительное условие для составных правил.
 */
const RULES: { any: RegExp; all?: RegExp; component: VisualComponent }[] = [
  { any: /хотэнд|heatbreak|термобарьер/, component: HotendCrossSection },
  { any: /corexy|крест-накрест|кинематика/, component: CoreXYMotion },
  { any: /шкив|ремень gt2|20 зубьев/, component: BeltPulley },
  { any: /усадк/, component: MaterialShrinkage },
  { any: /сушк|влажност|силикагел|просуш/, component: FilamentDrying },
  { any: /сопл/, all: /0,2|0,4|0,6|0,8/, component: NozzleSizes },
  { any: /direct|bowden/, component: DirectVsBowden },
  { any: /cura|orca/, all: /сравнени/, component: SlicerComparison },
  { any: /переменная высота|variable layer|модификатор/, component: VariableLayerHeight },
  { any: /ironing|проглаживани|разглажива/, component: IroningDemo },
  { any: /дефект/, all: /сетка|карта|20|3×3/, component: ProgressiveDefects },
  { any: /ферм|octofarm/, component: PrintFarmScheme },
  { any: /температур/, all: /зоны|сопла|180|210|240/, component: TemperatureZones },
  { any: /ретракт|втягива/, component: RetractionPull },
  { any: /заполнени|infill|gyroid/, component: InfillPatterns },
  { any: /древовидн|поддержк/, component: SupportTree },
  { any: /первый слой/, component: FirstLayerGoodBad },
  { any: /warping|отклеива/, component: WarpingDemo },
  { any: /паутинк|стринг|stringing/, component: StringingDemo },
  { any: /скорост/, all: /мм\/с|сравнени/, component: SpeedComparison },
  { any: /сопло/, all: /едет|движет|стол|полоск/, component: NozzleLayering },
  { any: /слои|слой за слоем|растёт/, component: LayerStack },
];

/**
 * Возвращает визуализацию для блока image/animation или null, если подходящего
 * шаблона нет — тогда в карточке остаётся заглушка.
 */
export function getVisualComponent(block: VisualBlock): VisualComponent | null {
  const text = `${block.title ?? ""} ${block.content ?? ""}`.toLowerCase();

  for (const rule of RULES) {
    if (rule.any.test(text) && (!rule.all || rule.all.test(text))) {
      return rule.component;
    }
  }

  return null;
}
