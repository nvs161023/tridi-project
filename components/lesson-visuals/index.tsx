import type { ComponentType } from "react";

import { Basic1Animation0 } from "./basic-1-animation-0";
import { Basic1Image0 } from "./basic-1-image-0";
import { Basic10Image0 } from "./basic-10-image-0";
import { Basic11Image0 } from "./basic-11-image-0";
import { Basic11Image1 } from "./basic-11-image-1";
import { Basic12Image0 } from "./basic-12-image-0";
import { Basic12Image1 } from "./basic-12-image-1";
import { Basic13Image0 } from "./basic-13-image-0";
import { Basic13Image1 } from "./basic-13-image-1";
import { Basic14Image0 } from "./basic-14-image-0";
import { Basic15Image0 } from "./basic-15-image-0";
import { Basic15Image1 } from "./basic-15-image-1";
import { Basic2Image0 } from "./basic-2-image-0";
import { Basic3Animation0 } from "./basic-3-animation-0";
import { Basic3Image0 } from "./basic-3-image-0";
import { Basic4Animation0 } from "./basic-4-animation-0";
import { Basic4Image0 } from "./basic-4-image-0";
import { Basic5Animation0 } from "./basic-5-animation-0";
import { Basic5Image0 } from "./basic-5-image-0";
import { Basic6Animation0 } from "./basic-6-animation-0";
import { Basic6Image0 } from "./basic-6-image-0";
import { Basic7Animation0 } from "./basic-7-animation-0";
import { Basic7Image0 } from "./basic-7-image-0";
import { Basic7Image1 } from "./basic-7-image-1";
import { Basic8Image0 } from "./basic-8-image-0";
import { Basic9Image0 } from "./basic-9-image-0";
import { Basic9Image1 } from "./basic-9-image-1";
import { ProAA1Animation0 } from "./pro-A-A1-animation-0";
import { ProAA1Image0 } from "./pro-A-A1-image-0";
import { ProAA2Animation0 } from "./pro-A-A2-animation-0";
import { ProAA2Image0 } from "./pro-A-A2-image-0";
import { ProAA2Image1 } from "./pro-A-A2-image-1";
import { ProABezABez1Animation0 } from "./pro-A-без-A-без1-animation-0";
import { ProABezABez1Image0 } from "./pro-A-без-A-без1-image-0";
import { ProABezABez2Image0 } from "./pro-A-без-A-без2-image-0";
import type { VisualProps } from "./_Wrapper";

/**
 * Визуализации блоков image/animation/screenshot/diagram: один блок — один
 * компонент — один файл.
 *
 * Повторов между уроками быть не должно: каждый блок получает собственную
 * картинку, даже если процессы похожи. Поэтому здесь нет подбора «по ключевым
 * словам» — визуализация привязана к конкретному блоку урока (курс + номер
 * урока + номер блока в уроке) и лежит в отдельном файле.
 *
 * Базовый курс заполнен целиком: модули 1–6, уроки 1–15 — 27 визуализаций, у
 * каждого блока image/animation своя картинка. В продвинутом курсе начат пилот:
 * модули A «Основы и история» и A-без «Безопасность база» — 8 визуализаций.
 * Остальные блоки продвинутого курса пока без картинки: для них возвращается
 * null, и в карточке показывается заглушка с иконкой типа блока — лучше
 * заглушка, чем чужая картинка.
 * Новая визуализация = новый файл + одна строка в BASE_VISUALS или PRO_VISUALS.
 */
export type { VisualProps } from "./_Wrapper";

export type VisualComponent = ComponentType<VisualProps>;

/**
 * Адрес блока: курс, урок, тип блока и порядковый номер среди блоков этого типа.
 *
 * Базовый курс адресуется номером урока (basic-1-image-0), продвинутый — кодами
 * модуля и урока (pro-A-A1-image-0): в продвинутом курсе номера уроков строковые
 * — A1, C1-1, T14.
 */
export type VisualBlockRef = {
  course?: "basic" | "pro";
  /** Код модуля — нужен только продвинутому курсу. */
  moduleId?: string;
  /** Номер урока базового курса или код урока продвинутого (A1, C1-1). */
  lessonId?: number | string;
  type: string;
  typeOrdinal: number;
};

/**
 * Визуализации базового курса — Этап 2.
 *
 * Ключ: `basic-{номер урока}-{тип блока}-{номер}`, например `basic-1-image-0` или
 * `basic-5-animation-0`. Номер — порядковый номер блока этого типа внутри урока.
 *
 * Заполнены все уроки 1–15: модуль 1 «Знакомство» (1–3), модуль 2 «Настройка
 * печати» (4–7), модуль 3 «Практика» (8–9), модуль 4 «Проблемы и решения» (10–11),
 * модуль 5 «Быстрые победы» (12–13) и модуль 6 «Финал» (14–15) — 27 из 27. Дальше
 * рисуется продвинутый курс: новая визуализация = новый файл
 * (components/lesson-visuals/pro-A-A1-image-0.tsx) плюс одна строка здесь.
 */
const BASE_VISUALS: Record<string, VisualComponent> = {
  "basic-1-image-0": Basic1Image0,
  "basic-1-animation-0": Basic1Animation0,
  "basic-2-image-0": Basic2Image0,
  "basic-3-image-0": Basic3Image0,
  "basic-3-animation-0": Basic3Animation0,
  "basic-4-image-0": Basic4Image0,
  "basic-4-animation-0": Basic4Animation0,
  "basic-5-image-0": Basic5Image0,
  "basic-5-animation-0": Basic5Animation0,
  "basic-6-image-0": Basic6Image0,
  "basic-6-animation-0": Basic6Animation0,
  "basic-7-image-0": Basic7Image0,
  "basic-7-animation-0": Basic7Animation0,
  "basic-7-image-1": Basic7Image1,
  "basic-8-image-0": Basic8Image0,
  "basic-9-image-0": Basic9Image0,
  "basic-9-image-1": Basic9Image1,
  "basic-10-image-0": Basic10Image0,
  "basic-11-image-0": Basic11Image0,
  "basic-11-image-1": Basic11Image1,
  "basic-12-image-0": Basic12Image0,
  "basic-12-image-1": Basic12Image1,
  "basic-13-image-0": Basic13Image0,
  "basic-13-image-1": Basic13Image1,
  "basic-14-image-0": Basic14Image0,
  "basic-15-image-0": Basic15Image0,
  "basic-15-image-1": Basic15Image1,
};

/**
 * Визуализации продвинутого курса — Этап 2.
 *
 * Ключ: `pro-{модуль}-{урок}-{тип}-{номер}`, например `pro-A-A1-image-0` или
 * `pro-A-без-A-без1-image-0`. Номер — порядковый номер блока этого типа внутри
 * урока, как и в базовом курсе. Коды модулей берутся из данных как есть, поэтому
 * в них бывает кириллица («A-без», «C-пож»), а в именах файлов — тоже.
 *
 * Заполнены два пилотных модуля: A (уроки A1, A2) и A-без (уроки A-без1, A-без2)
 * — 8 визуализаций. Остальные блоки продвинутого курса рисуются заглушкой с
 * иконкой своего типа. Новая визуализация = новый файл
 * (components/lesson-visuals/pro-B-B1-image-0.tsx) плюс одна строка здесь.
 */
const PRO_VISUALS: Record<string, VisualComponent> = {
  // Модуль A «Основы и история»: история FDM и кинематика.
  "pro-A-A1-image-0": ProAA1Image0,
  "pro-A-A1-animation-0": ProAA1Animation0,
  "pro-A-A2-image-0": ProAA2Image0,
  "pro-A-A2-animation-0": ProAA2Animation0,
  "pro-A-A2-image-1": ProAA2Image1,
  // Модуль A-без «Безопасность база»: выбросы и вентиляция.
  "pro-A-без-A-без1-image-0": ProABezABez1Image0,
  "pro-A-без-A-без1-animation-0": ProABezABez1Animation0,
  "pro-A-без-A-без2-image-0": ProABezABez2Image0,
};

/** Ключ визуализации — адрес блока одной строкой. */
function visualKey(ref: VisualBlockRef): string {
  if (ref.course === "pro") {
    return `pro-${ref.moduleId ?? ""}-${ref.lessonId ?? ""}-${ref.type}-${ref.typeOrdinal}`;
  }

  return `basic-${ref.lessonId ?? ""}-${ref.type}-${ref.typeOrdinal}`;
}

/** Визуализация конкретного блока или null, если она ещё не нарисована. */
export function getVisualComponent(ref: VisualBlockRef): VisualComponent | null {
  // Продвинутый курс смотрит только в свой раздел, базовый — только в свой:
  // так ключи двух курсов не могут случайно совпасть.
  const registry = ref.course === "pro" ? PRO_VISUALS : BASE_VISUALS;

  return registry[visualKey(ref)] ?? null;
}
