"use client";

import { useMemo } from "react";

/**
 * Markdown-инструкция по ТО в виде React-элементов.
 *
 * Текст приходит простым markdown из `lib/workshop/maintenance-guides.ts`:
 * заголовки `##`, пункты `-` и **жирный** текст. Сторонняя библиотека и
 * `dangerouslySetInnerHTML` не нужны — в тексте только наши строки, но лишний
 * HTML-канал всё равно ни к чему.
 *
 * Компонент общий для двух окон: `MaintenanceGuideDialog` показывает инструкцию
 * целиком (кнопка в форме добавления принтера), а `PrinterDetailsDialog` — на
 * вкладке «Обслуживание». Поэтому здесь только содержимое: рамку, заголовок и
 * кнопку «Понятно» рисует родитель.
 */

type MaintenanceGuideTextProps = {
  /** Markdown-инструкция из MAINTENANCE_GUIDES. */
  guide: string;
};

type GuideBlock =
  | { kind: "heading"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "paragraph"; text: string };

/** Разбор простого markdown: заголовки, списки и абзацы. */
function parseGuide(markdown: string): GuideBlock[] {
  const blocks: GuideBlock[] = [];
  let items: string[] = [];

  function flushList() {
    if (items.length > 0) {
      blocks.push({ kind: "list", items });
      items = [];
    }
  }

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();

    if (!line) {
      flushList();
      continue;
    }

    if (line.startsWith("## ")) {
      flushList();
      blocks.push({ kind: "heading", text: line.slice(3).trim() });
      continue;
    }

    if (line.startsWith("- ")) {
      items.push(line.slice(2).trim());
      continue;
    }

    flushList();
    blocks.push({ kind: "paragraph", text: line });
  }

  flushList();

  return blocks;
}

/** **Жирный** внутри строки — без HTML. */
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index} className="font-semibold text-white">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

export function MaintenanceGuideText({ guide }: MaintenanceGuideTextProps) {
  const blocks = useMemo(() => parseGuide(guide), [guide]);

  return (
    <>
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          return (
            <h3
              key={index}
              className="text-sm font-bold tracking-wide text-blue-200 uppercase"
            >
              {block.text}
            </h3>
          );
        }

        if (block.kind === "list") {
          return (
            <ul key={index} className="space-y-2">
              {block.items.map((item, itemIndex) => (
                <li
                  key={itemIndex}
                  className="flex gap-2.5 text-sm leading-relaxed text-zinc-400"
                >
                  <span
                    aria-hidden
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400"
                  />
                  <span>{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={index} className="text-sm leading-relaxed text-zinc-400">
            {renderInline(block.text)}
          </p>
        );
      })}
    </>
  );
}
