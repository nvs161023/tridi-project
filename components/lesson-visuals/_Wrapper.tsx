import {
  Fragment,
  cloneElement,
  isValidElement,
  type ReactNode,
} from "react";

/**
 * Общая обёртка для всех визуализаций уроков.
 *
 * Каждый блок image/animation получает собственный компонент (один блок — один
 * компонент — один файл), а общими остаются только рамка, подпись и размеры
 * области: 16/9 во всю ширину карточки, но не шире 600 px.
 *
 * Здесь же снимается самая массовая ошибка кадров — дубль подписи. Обёртка уже
 * печатает `block.title` строкой над кадром, а в 31 % файлов та же строка
 * нарисована ещё раз первым `<text>` внутри SVG. Правило спецификации кадра:
 * первая строка — данные, подпись — одна и сверху. Поэтому перед отрисовкой из
 * дерева вырезается первый `<text>`, текст которого совпадает с подписью
 * (сравнение без регистра, «ё» и знаков препинания), — координаты кадра и 75
 * файлов с дублем при этом менять не нужно.
 */
export interface VisualWrapperProps {
  title: string;
  ariaLabel: string;
  animated?: boolean;
  children: ReactNode;
}

type NodeProps = { children?: ReactNode };
type DedupeState = { done: boolean };

/** Подпись блока и текст кадра сравниваются в одной нормальной форме. */
function normalizeCaption(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9%]+/gi, " ")
    .trim();
}

/** Текст элемента целиком: строки, числа и вложенные `<tspan>`. */
function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map((child) => textOf(child)).join("");
  }
  if (isValidElement<NodeProps>(node)) {
    return textOf(node.props.children);
  }
  return "";
}

/**
 * Заменяет на `null` первый `<text>`, дословно повторяющий подпись блока.
 * Остальное дерево возвращается без изменений: элементы SVG стоят на своих
 * координатах, и удаление строки ничего не сдвигает.
 */
function withoutDuplicateCaption(
  node: ReactNode,
  caption: string,
  state: DedupeState,
): ReactNode {
  if (state.done || !caption) {
    return node;
  }

  if (Array.isArray(node)) {
    return node.map((child, index) => (
      <Fragment key={index}>
        {withoutDuplicateCaption(child, caption, state)}
      </Fragment>
    ));
  }

  if (!isValidElement<NodeProps>(node)) {
    return node;
  }

  if (node.type === "text" && normalizeCaption(textOf(node.props.children)) === caption) {
    state.done = true;
    return null;
  }

  if (node.props.children === undefined) {
    return node;
  }

  const next = withoutDuplicateCaption(node.props.children, caption, state);

  return cloneElement(node, undefined, next);
}

/** Пропсы, которые получает каждая уникальная визуализация урока. */
export type VisualProps = { title: string; animated?: boolean };

export function VisualWrapper({ title, ariaLabel, animated, children }: VisualWrapperProps) {
  return (
    <div className="my-6 rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 sm:p-6 md:my-8">
      <p className="mb-3 text-sm text-slate-300">{title}</p>
      <div
        role="img"
        aria-label={ariaLabel}
        className="mx-auto aspect-[16/9] w-full max-w-[600px]"
        data-animated={animated}
      >
        {withoutDuplicateCaption(children, normalizeCaption(title), { done: false })}
      </div>
    </div>
  );
}
