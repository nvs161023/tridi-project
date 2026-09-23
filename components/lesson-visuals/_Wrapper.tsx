import type { ReactNode } from "react";

/**
 * Общая обёртка для всех визуализаций уроков.
 *
 * Каждый блок image/animation получает собственный компонент (один блок — один
 * компонент — один файл), а общими остаются только рамка, подпись и размеры
 * области: 16/9 во всю ширину карточки, но не шире 600 px.
 */
export interface VisualWrapperProps {
  title: string;
  ariaLabel: string;
  animated?: boolean;
  children: ReactNode;
}

/** Пропсы, которые получает каждая уникальная визуализация урока. */
export type VisualProps = { title: string; animated?: boolean };

export function VisualWrapper({ title, ariaLabel, animated, children }: VisualWrapperProps) {
  return (
    <div className="my-4 rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 sm:p-6">
      <p className="mb-3 text-sm text-slate-300">{title}</p>
      <div
        role="img"
        aria-label={ariaLabel}
        className="mx-auto aspect-[16/9] w-full max-w-[600px]"
        data-animated={animated}
      >
        {children}
      </div>
    </div>
  );
}
