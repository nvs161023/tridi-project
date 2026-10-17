import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 17 урока IN3 «Рёбра жёсткости и усиление деталей».
 *
 * Макет из описания кадра `IN3_rib_profile.png`: ребро с толщиной 0,8–1,2 мм,
 * высотой 5–15 мм, уклоном стенки 45° и радиусом в корне 1–2 мм. Справа —
 * сравнение острого угла и галтели; внизу правило h : t = 8–10.
 */
export function EngineerIN3Image3({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Профиль ребра. Ребро толщиной 0,8–1,2 мм и высотой 5–15 мм стоит на стенке. Стенка ребра наклонена под 45 градусов и печатается без поддержек, в корне радиус 1–2 мм. Справа острый угол против скруглённого. Правило: высота к толщине 8–10"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <marker
            id="in3-profile-dim"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="#93c5fd" />
          </marker>
          <pattern id="in3-profile-fixed" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#64748b" strokeWidth="1.5" />
          </pattern>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          профиль ребра: уклон и радиус
        </text>

        {/* Стенка и ребро в разрезе. */}
        <rect x="30" y="108" width="170" height="9" rx="2" fill="#334155" stroke="#64748b" />
        <rect x="30" y="117" width="170" height="6" fill="url(#in3-profile-fixed)" stroke="#64748b" />
        <path
          d="M 100 108 L 100 62 Q 100 56 106 56 Q 112 56 112 62 L 112 108 Z"
          fill="#3b82f6"
          fillOpacity="0.55"
          stroke="#93c5fd"
        />
        <path d="M 100 102 Q 100 108 94 108" fill="none" stroke="#60a5fa" strokeWidth="2" />
        <path d="M 112 102 Q 112 108 118 108" fill="none" stroke="#60a5fa" strokeWidth="2" />

        <line x1="100" y1="48" x2="112" y2="48" stroke="#93c5fd" markerStart="url(#in3-profile-dim)" markerEnd="url(#in3-profile-dim)" />
        <text x="106" y="43" fontSize="10" fill="#93c5fd" textAnchor="middle">
          t
        </text>
        <text x="116" y="43" fontSize="10" fill="#cbd5e1">
          0,8–1,2 мм
        </text>

        <line x1="130" y1="56" x2="130" y2="108" stroke="#93c5fd" markerStart="url(#in3-profile-dim)" markerEnd="url(#in3-profile-dim)" />
        <text x="136" y="78" fontSize="10" fill="#93c5fd">
          h
        </text>
        <text x="136" y="92" fontSize="10" fill="#cbd5e1">
          5–15 мм
        </text>

        <path d="M 72 100 L 96 106" fill="none" stroke="#60a5fa" strokeWidth="1" />
        <text x="48" y="98" fontSize="10" fill="#93c5fd">
          R 1–2
        </text>

        {/* Уклон стенки 45°: без поддержек. */}
        <rect x="210" y="30" width="98" height="82" rx="7" fill="#0f172a" fillOpacity="0.45" stroke="#334155" />
        <text x="259" y="42" fontSize="10" fill="#94a3b8" textAnchor="middle">
          стенка ребра
        </text>
        <polygon points="252,58 266,58 290,96 228,96" fill="#3b82f6" fillOpacity="0.4" stroke="#60a5fa" />
        <line x1="252" y1="58" x2="228" y2="96" stroke="#f59e0b" strokeDasharray="3 2" />
        <text x="291" y="76" fontSize="10" fontWeight="700" fill="#fcd34d">
          45°
        </text>
        <text x="259" y="108" fontSize="10" fill="#94a3b8" textAnchor="middle">
          без поддержек
        </text>

        {/* Острый угол против галтели. */}
        <path d="M 224 132 L 224 160 L 252 160" fill="none" stroke="#f87171" strokeWidth="4" />
        <text x="224" y="172" fontSize="10" fill="#f87171">
          нож
        </text>
        <path d="M 270 132 L 270 154 Q 270 160 276 160 L 296 160" fill="none" stroke="#10b981" strokeWidth="4" />
        <text x="270" y="172" fontSize="10" fill="#10b981">
          радиус
        </text>

        <text x="12" y="140" fontSize="10" fill="#cbd5e1">
          t 0,8–1,2 мм · h 5–15 мм
        </text>
        <text x="12" y="156" fontSize="11" fontWeight="700" fill="#93c5fd">
          h : t = 8–10
        </text>
        <text x="12" y="172" fontSize="10" fill="#94a3b8">
          R 1–2 мм · 45°
        </text>
      </svg>
    </VisualWrapper>
  );
}
