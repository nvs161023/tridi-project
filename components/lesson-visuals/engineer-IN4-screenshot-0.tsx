import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр-скриншот блока 20 урока IN4 «Симуляция в CAD (Stress Analysis)».
 *
 * Макет из описания `IN4_fusion_ui.png`: окно Fusion 360, вкладка Simulation
 * со случаем Static Stress. В дереве — материал, закрепление, нагрузка,
 * сетка и результат; справа размер элемента 1 мм и запас 2,5.
 */
export function EngineerIN4Screenshot0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Окно Fusion 360, вкладка Simulation. В дереве расчёта материал, закрепление, нагрузка, сетка и Static Stress. На детали сетка и красная зона напряжений. Справа размер элемента около 1 мм, запас 2,5 и занижение предела прочности в 2–3 раза"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <pattern id="in4-5-mesh" width="6" height="6" patternUnits="userSpaceOnUse">
            <path d="M0 0 L6 6 M6 0 L0 6" stroke="#cbd5e1" strokeWidth="0.3" strokeOpacity="0.65" />
          </pattern>
          <linearGradient id="in4-5-base" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1d4ed8" />
            <stop offset="0.7" stopColor="#0ea5e9" />
            <stop offset="1" stopColor="#22c55e" />
          </linearGradient>
          <radialGradient id="in4-5-hot">
            <stop offset="0" stopColor="#ef4444" />
            <stop offset="0.4" stopColor="#f97316" />
            <stop offset="1" stopColor="#facc15" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="in4-5-legend" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#1d4ed8" />
            <stop offset="0.45" stopColor="#22d3ee" />
            <stop offset="0.72" stopColor="#facc15" />
            <stop offset="1" stopColor="#ef4444" />
          </linearGradient>
          <marker
            id="in4-5-arrow"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="#f59e0b" />
          </marker>
          <clipPath id="in4-5-part">
            <polygon points="112,48 134,48 134,98 204,98 204,118 112,118" />
          </clipPath>
        </defs>

        <rect x="4" y="4" width="312" height="172" rx="8" fill="#0b1220" stroke="#475569" />
        <line x1="4" y1="23" x2="316" y2="23" stroke="#334155" />
        <circle cx="14" cy="13.5" r="2.2" fill="#ef4444" />
        <circle cx="22" cy="13.5" r="2.2" fill="#f59e0b" />
        <circle cx="30" cy="13.5" r="2.2" fill="#10b981" />
        <text x="40" y="17" fontSize="10" fontWeight="700" fill="#e2e8f0">
          Fusion 360
        </text>
        <rect x="238" y="7" width="70" height="14" rx="4" fill="#1d4ed8" fillOpacity="0.25" stroke="#3b82f6" />
        <text x="273" y="17" fontSize="10" fill="#93c5fd" textAnchor="middle">
          Simulation
        </text>

        {/* Дерево расчёта */}
        <rect x="8" y="27" width="80" height="145" rx="4" fill="#0f172a" stroke="#1e293b" />
        {["Материал", "Закрепление", "Нагрузка", "Сетка"].map((label, i) => (
          <g key={label}>
            <rect x="14" y={34 + i * 17} width="5" height="5" rx="1" fill="#38bdf8" fillOpacity="0.75" />
            <text x="24" y={40 + i * 17} fontSize="10" fill="#cbd5e1">
              {label}
            </text>
          </g>
        ))}
        <text x="24" y="118" fontSize="10" fontWeight="700" fill="#6ee7b7">
          Static Stress
        </text>

        {/* Вид с сеткой и картой */}
        <rect x="92" y="27" width="132" height="145" rx="4" fill="#0f172a" stroke="#1e293b" />
        <g clipPath="url(#in4-5-part)">
          <polygon points="112,48 134,48 134,98 204,98 204,118 112,118" fill="url(#in4-5-base)" />
          <circle cx="136" cy="98" r="34" fill="url(#in4-5-hot)" />
          <rect x="112" y="48" width="92" height="70" fill="url(#in4-5-mesh)" />
        </g>
        <line x1="112" y1="48" x2="112" y2="118" stroke="#94a3b8" />
        {Array.from({ length: 8 }, (_, i) => (
          <line
            key={`in4-5-fixed-${i}`}
            x1="112"
            y1={50 + i * 9}
            x2="105"
            y2={45 + i * 9}
            stroke="#94a3b8"
            strokeWidth="0.8"
          />
        ))}
        <line x1="190" y1="76" x2="190" y2="96" stroke="#f59e0b" strokeWidth="1.2" markerEnd="url(#in4-5-arrow)" />
        <rect x="100" y="130" width="104" height="6" rx="2" fill="url(#in4-5-legend)" stroke="#475569" strokeWidth="0.5" />
        <text x="100" y="147" fontSize="10" fill="#94a3b8">
          0
        </text>
        <text x="172" y="147" fontSize="10" fill="#f87171">
          20 МПа
        </text>
        <text x="100" y="163" fontSize="10" fill="#cbd5e1">
          элемент ≈ 1 мм
        </text>

        {/* Настройки */}
        <rect x="228" y="27" width="88" height="145" rx="4" fill="#0f172a" stroke="#1e293b" />
        <text x="236" y="40" fontSize="10" fill="#94a3b8">
          элемент
        </text>
        <rect x="236" y="46" width="70" height="16" rx="3" fill="#020617" stroke="#475569" />
        <text x="242" y="57" fontSize="10" fill="#e2e8f0">
          1 мм
        </text>
        <line x1="236" y1="70" x2="306" y2="70" stroke="#334155" />
        <text x="236" y="86" fontSize="10" fill="#94a3b8">
          запас
        </text>
        <text x="236" y="106" fontSize="14" fontWeight="700" fill="#6ee7b7">
          2,5
        </text>
        <text x="236" y="124" fontSize="10" fill="#f59e0b">
          предел −2–3×
        </text>
      </svg>
    </VisualWrapper>
  );
}
