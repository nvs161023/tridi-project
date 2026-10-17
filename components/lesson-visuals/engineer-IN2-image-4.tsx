import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 21 урока IN2 «Нагрузки и прочность детали».
 *
 * Макет из описания кадра `IN2_bending.png`: консоль и её опасное сечение у
 * основания. Числа — из блока 22: сила 50 Н, плечо 100 мм, момент 5 000 Н·мм,
 * сечение 20 × 8 мм даёт σ ≈ 23 МПа, высота 12 мм — около 10 МПа.
 */
export function EngineerIN2Image4({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Изгиб консоли: максимум напряжения у основания, где момент самый большой. Сила 50 ньютонов на плече 100 миллиметров даёт момент 5 000 ньютон-миллиметров. Сечение 20 на 8 мм даёт напряжение около 23 МПа — это больше допустимых 15 МПа, деталь не проходит. Сечение 20 на 12 мм даёт около 10 МПа — проходит"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <marker
            id="in2-bend-load"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="#f59e0b" />
          </marker>
          <linearGradient id="in2-bend-stress" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#f87171" stopOpacity="0.55" />
            <stop offset="0.55" stopColor="#f87171" stopOpacity="0.12" />
            <stop offset="1" stopColor="#f87171" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          консоль: ломается основание
        </text>

        <rect x="14" y="46" width="10" height="58" fill="#475569" />
        <text x="34" y="54" fontSize="10" fill="#f87171">
          максимум
        </text>

        <rect x="24" y="62" width="226" height="20" fill="#334155" stroke="#64748b" />
        <rect x="24" y="62" width="226" height="20" fill="url(#in2-bend-stress)" />
        <line
          x1="26"
          y1="72"
          x2="248"
          y2="72"
          stroke="#cbd5e1"
          strokeOpacity="0.5"
          strokeDasharray="3 2"
        />

        <line x1="240" y1="36" x2="240" y2="60" stroke="#f59e0b" markerEnd="url(#in2-bend-load)" />
        <text x="246" y="33" fontSize="10" fill="#f59e0b">
          50 Н
        </text>

        <line x1="24" y1="92" x2="250" y2="92" stroke="#94a3b8" />
        <line x1="24" y1="89" x2="24" y2="95" stroke="#94a3b8" />
        <line x1="250" y1="89" x2="250" y2="95" stroke="#94a3b8" />
        <text x="137" y="104" fontSize="10" fill="#94a3b8" textAnchor="middle">
          100 мм
        </text>

        <rect
          x="12"
          y="116"
          width="296"
          height="54"
          rx="8"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#334155"
        />
        <text x="20" y="132" fontSize="10" fill="#f87171">
          20 × 8 мм · W ≈ 213 мм³ · σ ≈ 23 МПа
        </text>
        <text x="300" y="132" fontSize="10" fill="#f87171" textAnchor="end">
          не проходит
        </text>
        <text x="20" y="147" fontSize="10" fill="#10b981">
          20 × 12 мм · σ ≈ 10 МПа
        </text>
        <text x="300" y="147" fontSize="10" fill="#10b981" textAnchor="end">
          проходит
        </text>
        <text x="20" y="163" fontSize="10" fill="#94a3b8">
          момент у основания 5 000 Н·мм
        </text>
        <text x="300" y="163" fontSize="10" fill="#94a3b8" textAnchor="end">
          предел 15 МПа
        </text>
      </svg>
    </VisualWrapper>
  );
}
