import { VisualWrapper, type VisualProps } from "./_Wrapper";

/**
 * basic 5 · image «Хороший и плохой первый слой» (Модуль 2: Настройка печати).
 *
 * Из описания блока: слева хороший — линии плотно, без щелей, слегка сплющены;
 * справа плохой — щели (сопло высоко) или прозрачный пластик (сопло низко).
 * Стол показан сверху, поэтому в зазорах между линиями видно его поверхность.
 */
const GOOD = [60, 70, 80, 90, 100, 110];
const BAD = [56, 72, 88, 104, 120, 136];

export function Basic05FirstLayer({ title, animated = true }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Первый слой сверху: слева линии плотно и сплющены, справа между линиями видны щели"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="h-full w-full">
        <rect x="16" y="44" width="134" height="86" rx="3" fill="#101c33" stroke="#475569" />
        {GOOD.map((y) => (
          <g key={y}>
            <rect x="24" y={y} width="118" height="9" rx="4" fill="#3b82f6" />
            <line x1="24" y1={y + 1.5} x2="142" y2={y + 1.5} stroke="#bfdbfe" />
          </g>
        ))}
        <rect x="16" y="126" width="134" height="8" rx="2" fill="#334155" stroke="#64748b" />

        <rect x="170" y="44" width="134" height="86" rx="3" fill="#101c33" stroke="#475569" />
        {BAD.map((y) => (
          <rect key={y} x="178" y={y} width="118" height="7" rx="3.5" fill="#3b82f6" />
        ))}
        <text x="252" y="120" fontSize="7" fill="#fca5a5">
          виден стол
        </text>
        <path d="M250 118 L232 78" stroke="#f59e0b" strokeDasharray="3 2" />
        <text x="196" y="42" fontSize="7" fill="#fcd34d">
          сопло было высоко
        </text>
        <rect x="170" y="126" width="134" height="8" rx="2" fill="#334155" stroke="#64748b" />

        <text x="16" y="152" fontSize="12" fill="#3b82f6" fontWeight="bold">
          Хорошо
        </text>
        <text x="16" y="164" fontSize="7.5" fill="#94a3b8">
          линии плотно, без щелей, слегка сплющены
        </text>
        <text x="170" y="152" fontSize="12" fill="#ef4444" fontWeight="bold">
          Плохо
        </text>
        <text x="170" y="164" fontSize="7.5" fill="#94a3b8">
          щели — сопло высоко
        </text>
        <text x="170" y="174" fontSize="7" fill="#64748b">
          или прозрачный пластик — сопло низко
        </text>
      </svg>
    </VisualWrapper>
  );
}
