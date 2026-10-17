import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 8 урока IN3 «Рёбра жёсткости и усиление деталей».
 *
 * Макет из описания кадра `IN3_rib_height.png`: две равные по массе стойки.
 * Высота выросла вдвое — жёсткость в 8 раз, толщина вдвое — только в 2 раза;
 * отсюда правило h : t ≤ 10 и «1 мм держит до 10 мм» из блока 7.
 */
export function EngineerIN3Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Высота против толщины при равной массе. Слева высокое тонкое ребро, справа низкое толстое. Высота больше в два раза даёт жёсткость в восемь раз, толщина в два раза — только в два. Правило: высота к толщине не больше десяти, один миллиметр держит до десяти"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <marker
            id="in3-height-dim"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="#93c5fd" />
          </marker>
          <pattern id="in3-height-fixed" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#64748b" strokeWidth="1.5" />
          </pattern>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          равная масса — разная жёсткость
        </text>

        {/* Высокое тонкое ребро. */}
        <rect x="12" y="22" width="146" height="86" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />
        <text x="85" y="35" fontSize="10" fontWeight="700" fill="#10b981" textAnchor="middle">
          высокое и тонкое
        </text>
        <rect x="52" y="90" width="66" height="7" fill="url(#in3-height-fixed)" stroke="#64748b" />
        <rect x="78" y="50" width="6" height="40" rx="2" fill="#3b82f6" fillOpacity="0.8" stroke="#93c5fd" />
        <line x1="94" y1="50" x2="94" y2="90" stroke="#93c5fd" markerStart="url(#in3-height-dim)" markerEnd="url(#in3-height-dim)" />
        <text x="99" y="74" fontSize="10" fill="#93c5fd">
          h
        </text>
        <text x="85" y="106" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          t = 1 мм
        </text>

        {/* Низкое толстое ребро: та же масса. */}
        <rect x="162" y="22" width="146" height="86" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />
        <text x="235" y="35" fontSize="10" fontWeight="700" fill="#f59e0b" textAnchor="middle">
          низкое и толстое
        </text>
        <rect x="202" y="90" width="66" height="7" fill="url(#in3-height-fixed)" stroke="#64748b" />
        <rect x="222" y="70" width="16" height="20" rx="2" fill="#3b82f6" fillOpacity="0.8" stroke="#93c5fd" />
        <text x="244" y="66" fontSize="10" fill="#93c5fd">
          t
        </text>
        <text x="235" y="106" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          та же масса
        </text>

        <line x1="12" y1="114" x2="308" y2="114" stroke="#334155" />

        <text x="12" y="132" fontSize="11" fontWeight="700" fill="#34d399">
          высота ×2 → жёсткость ×8
        </text>
        <text x="12" y="148" fontSize="11" fontWeight="700" fill="#fbbf24">
          толщина ×2 → жёсткость ×2
        </text>
        <text x="12" y="164" fontSize="10" fill="#94a3b8">
          масса ×2 · высота выгоднее вчетверо
        </text>

        <text x="220" y="132" fontSize="12" fontWeight="700" fill="#93c5fd">
          h : t ≤ 10
        </text>
        <text x="220" y="148" fontSize="10" fill="#cbd5e1">
          1 мм → 10 мм
        </text>
      </svg>
    </VisualWrapper>
  );
}
