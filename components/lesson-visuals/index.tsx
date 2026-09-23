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
import type { VisualProps } from "./_Wrapper";

/**
 * Визуализации блоков image/animation: один блок — один компонент — один файл.
 *
 * Повторов между уроками быть не должно: каждый блок получает собственную
 * картинку, даже если процессы похожи. Поэтому здесь нет подбора «по ключевым
 * словам» — визуализация привязана к конкретному блоку урока (курс + номер
 * урока + номер блока в уроке) и лежит в отдельном файле.
 *
 * Этап 1 — базовый курс, уроки 1–6 (10 визуализаций). Для блоков без своей
 * визуализации возвращается null, и в карточке показывается заглушка: лучше
 * заглушка, чем одинаковая картинка в двух уроках. Новая визуализация = новый
 * файл + одна строка в VISUALS.
 */
export type { VisualProps } from "./_Wrapper";

export type VisualComponent = ComponentType<VisualProps>;

/** Адрес блока: курс, номер урока и номер блока внутри урока. */
export type VisualBlockRef = {
  course?: "basic" | "pro";
  lessonId?: number;
  blockIndex: number;
};

const VISUALS: Record<string, VisualComponent> = {
  "basic:1:2": Basic01Device,
  "basic:1:3": Basic01Building,
  "basic:2:1": Basic02Plastics,
  "basic:3:1": Basic03SlicerUi,
  "basic:3:3": Basic03Slicing,
  "basic:4:2": Basic04Temperatures,
  "basic:4:3": Basic04ThreeTemps,
  "basic:5:2": Basic05FirstLayer,
  "basic:5:3": Basic05SlowLayer,
  "basic:6:2": Basic06Flow,
};

/** Визуализация конкретного блока или null, если она ещё не нарисована. */
export function getVisualComponent(ref: VisualBlockRef): VisualComponent | null {
  const key = `${ref.course ?? ""}:${ref.lessonId ?? ""}:${ref.blockIndex}`;
  return VISUALS[key] ?? null;
}
