import type { ComponentType } from "react";

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
 * Оба раздела пока пусты: и базовый курс (15 уроков), и продвинутый (26 модулей)
 * заменены новым содержимым, а визуализации под них рисуются на Этапе 2. Для
 * блока без своей визуализации возвращается null, и в карточке показывается
 * заглушка с иконкой типа блока: лучше заглушка, чем чужая картинка в уроке.
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
 * Пока раздел пуст: базовый курс заменён новым содержимым (15 уроков, 6 модулей),
 * а визуализации под него рисуются на Этапе 2. До этого каждый блок
 * image/animation рисуется в карточке заглушкой с иконкой своего типа. Новая
 * визуализация = новый файл (components/lesson-visuals/basic-1-image-0.tsx) плюс
 * одна строка здесь.
 */
const BASE_VISUALS: Record<string, VisualComponent> = {
  // Этап 2: сюда добавляются basic-ключи.
};

/**
 * Визуализации продвинутого курса — Этап 2.
 *
 * Ключ: `pro-{модуль}-{урок}-{тип}-{номер}`, например `pro-A-A1-image-0` или
 * `pro-B-B1-animation-0`. Номер — порядковый номер блока этого типа внутри урока,
 * как и в базовом курсе.
 *
 * Пока раздел пуст: каждый блок image/animation/screenshot/diagram рисуется в
 * карточке заглушкой с иконкой своего типа. Новая визуализация = новый файл
 * (components/lesson-visuals/pro-A-A1-image-0.tsx) плюс одна строка здесь.
 */
const PRO_VISUALS: Record<string, VisualComponent> = {
  // Этап 2: сюда добавляются pro-ключи.
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
