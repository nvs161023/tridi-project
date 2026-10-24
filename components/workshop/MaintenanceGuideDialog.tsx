"use client";

import { useMemo } from "react";

import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";

/**
 * Окно «Инструкция по ТО».
 *
 * Текст приходит простым markdown из `lib/workshop/maintenance-guides.ts`, и
 * здесь он разбирается в React-элементы: заголовки `##`, пункты `-` и **жирный**
 * текст. Сторонняя библиотека и `dangerouslySetInnerHTML` не нужны — в тексте
 * только наши строки, но лишний HTML-канал всё равно ни к чему.
 *
 * Окно открывается поверх окна добавления принтера (`z-[60]`), Escape и клик по
 * фону закрывают только его: родитель в это время не реагирует на Escape.
 */

type MaintenanceGuideDialogProps = {
  /** Модель: «Bambu Lab X1C». */
  title: string;
  /** Markdown-инструкция из MAINTENANCE_GUIDES. */
  guide: string;
  onClose: () => void;
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

export function MaintenanceGuideDialog({
  title,
  guide,
  onClose,
}: MaintenanceGuideDialogProps) {
  const blocks = useMemo(() => parseGuide(guide), [guide]);

  useDialogDismiss(onClose);

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/85 p-4 backdrop-blur-sm sm:items-center"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="maintenance-guide-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black/60 sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-blue-400 uppercase">
              Инструкция по ТО
            </p>
            <h2
              id="maintenance-guide-title"
              className="mt-3 text-2xl font-extrabold tracking-tight text-white"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            aria-label="Закрыть инструкцию по ТО"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-lg text-slate-300 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        <div className="mt-6 space-y-5">
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
                      className="flex gap-2.5 text-sm leading-relaxed text-slate-300"
                    >
                      <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                      <span>{renderInline(item)}</span>
                    </li>
                  ))}
                </ul>
              );
            }

            return (
              <p
                key={index}
                className="text-sm leading-relaxed text-slate-300"
              >
                {renderInline(block.text)}
              </p>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          Понятно
        </button>
      </div>
    </div>
  );
}
