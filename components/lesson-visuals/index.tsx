import type { ComponentType } from "react";

import { Basic01Building } from "./basic-01-building";
import { Basic01Device } from "./basic-01-device";
import { Basic02Plastics } from "./basic-02-plastics";
import { Basic03SlicerUi } from "./basic-03-slicer-ui";
import { Basic03Slicing } from "./basic-03-slicing";
import { Basic04Temperatures } from "./basic-04-temperatures";
import { Basic04ThreeTemps } from "./basic-04-three-temps";
import { Basic05FirstLayer } from "./basic-05-first-layer";
import { Basic05SlowLayer } from "./basic-05-slow-layer";
import { Basic06Flow } from "./basic-06-flow";
import { Basic06Retraction } from "./basic-06-retraction";
import { Basic07Infill } from "./basic-07-infill";
import { Basic07Maxflow } from "./basic-07-maxflow";
import { Basic07Speed } from "./basic-07-speed";
import { Basic08CalibMenu } from "./basic-08-calib-menu";
import { Basic08OrcaItems } from "./basic-08-orca-items";
import { Basic09Defects } from "./basic-09-defects";
import { Basic10Postprocess } from "./basic-10-postprocess";
import { Basic10Sites } from "./basic-10-sites";
import { Basic11SlaPost } from "./basic-11-sla-post";
import { Basic11SlaProcess } from "./basic-11-sla-process";
import { Basic11SlaScheme } from "./basic-11-sla-scheme";
import { Basic12Journey } from "./basic-12-journey";
import type { VisualProps } from "./_Wrapper";

/**
 * Визуализации блоков image/animation: один блок — один компонент — один файл.
 *
 * Повторов между уроками быть не должно: каждый блок получает собственную
 * картинку, даже если процессы похожи. Поэтому здесь нет подбора «по ключевым
 * словам» — визуализация привязана к конкретному блоку урока (курс + номер
 * урока + номер блока в уроке) и лежит в отдельном файле.
 *
 * Этап 1 — базовый курс, уроки 1–6; этап 2 — уроки 7–12 (итого 23 из 23 блоков
 * image/animation базового курса). Для блоков без своей визуализации возвращается
 * null, и в карточке показывается заглушка: лучше заглушка, чем одинаковая картинка
 * в двух уроках. Новая визуализация = новый файл + одна строка в VISUALS.
 */
export type { VisualProps } from "./_Wrapper";

export type VisualComponent = ComponentType<VisualProps>;

/** Адрес блока: курс, номер урока, тип блока и порядковый номер среди блоков этого типа. */
export type VisualBlockRef = {
  course?: "basic" | "pro";
  lessonId?: number;
  type: string;
  typeOrdinal: number;
};

const VISUALS: Record<string, VisualComponent> = {
  "basic-1-image-0": Basic01Device,
  "basic-1-animation-0": Basic01Building,
  "basic-2-image-0": Basic02Plastics,
  "basic-3-image-0": Basic03SlicerUi,
  "basic-3-animation-0": Basic03Slicing,
  "basic-4-image-0": Basic04Temperatures,
  "basic-4-animation-0": Basic04ThreeTemps,
  "basic-5-image-0": Basic05FirstLayer,
  "basic-5-animation-0": Basic05SlowLayer,
  "basic-6-image-0": Basic06Flow,
  "basic-6-animation-0": Basic06Retraction,
  "basic-7-image-0": Basic07Speed,
  "basic-7-animation-0": Basic07Maxflow,
  "basic-7-image-1": Basic07Infill,
  "basic-8-image-0": Basic08CalibMenu,
  "basic-8-image-1": Basic08OrcaItems,
  "basic-9-image-0": Basic09Defects,
  "basic-10-image-0": Basic10Postprocess,
  "basic-10-image-1": Basic10Sites,
  "basic-11-image-0": Basic11SlaScheme,
  "basic-11-animation-0": Basic11SlaProcess,
  "basic-11-image-1": Basic11SlaPost,
  "basic-12-image-0": Basic12Journey,
};

/** Визуализация конкретного блока или null, если она ещё не нарисована. */
export function getVisualComponent(ref: VisualBlockRef): VisualComponent | null {
  const key = `${ref.course ?? ""}-${ref.lessonId ?? ""}-${ref.type}-${ref.typeOrdinal}`;
  return VISUALS[key] ?? null;
}
