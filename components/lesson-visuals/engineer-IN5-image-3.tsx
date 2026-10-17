import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 18 урока IN5 «Кейсы: кронштейн, шестерня, вал, корпус».
 *
 * Макет из описания `IN5_vessel.png`: разрез корпуса под давлением 8–10 бар.
 * Видны два уплотнительных кольца, сплошные стенки и вода. Справа — PETG/PA,
 * 6 периметров, 100 % заполнения и проверка наливом в течение 24 часов.
 */
export function EngineerIN5Image3({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Разрез корпуса под давлением 8–10 бар. В крышке два зелёных уплотнительных кольца, внутри вода и стрелки давления, стенки сплошные. Справа PETG или PA, 6 периметров, 100 процентов заполнения и проверка наливом 24 часа"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <marker
            id="in5-3-arrow"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="4.5"
            markerHeight="4.5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="#f59e0b" />
          </marker>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          корпус: давление 8–10 бар
        </text>

        <rect x="12" y="23" width="188" height="119" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />

        {/* Корпус в разрезе */}
        <rect x="60" y="62" width="80" height="68" rx="8" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.2" />
        <rect x="66" y="68" width="68" height="56" rx="5" fill="#0f172a" stroke="#475569" />
        <path d="M66 104 H134 V118 Q134 124 128 124 H72 Q66 124 66 118 Z" fill="#0ea5e9" fillOpacity="0.22" />
        <path d="M66 104 Q76 100 86 104 T106 104 T126 104 H134" fill="none" stroke="#38bdf8" strokeWidth="0.9" strokeOpacity="0.8" />

        {/* Крышка и два кольца */}
        <rect x="54" y="48" width="92" height="14" rx="4" fill="#334155" stroke="#94a3b8" />
        <rect x="58" y="53" width="84" height="2" rx="1" fill="none" stroke="#34d399" strokeWidth="1.4" />
        <rect x="58" y="58" width="84" height="2" rx="1" fill="none" stroke="#34d399" strokeWidth="1.4" />
        <circle cx="60" cy="55" r="2.2" fill="#0f172a" stroke="#cbd5e1" />
        <circle cx="140" cy="55" r="2.2" fill="#0f172a" stroke="#cbd5e1" />

        {/* Давление */}
        <line x1="84" y1="92" x2="70" y2="92" stroke="#f59e0b" strokeWidth="1" markerEnd="url(#in5-3-arrow)" />
        <line x1="116" y1="92" x2="130" y2="92" stroke="#f59e0b" strokeWidth="1" markerEnd="url(#in5-3-arrow)" />
        <line x1="100" y1="86" x2="100" y2="72" stroke="#f59e0b" strokeWidth="1" markerEnd="url(#in5-3-arrow)" />
        <text x="146" y="96" fontSize="10" fontWeight="700" fill="#fbbf24">
          8–10 бар
        </text>
        <line x1="144" y1="92" x2="136" y2="92" stroke="#fbbf24" strokeWidth="0.7" />

        {/* Пояснения */}
        <text x="146" y="51" fontSize="10" fontWeight="700" fill="#6ee7b7">
          2 кольца
        </text>
        <line x1="144" y1="55" x2="142" y2="57" stroke="#34d399" strokeWidth="0.8" />
        <text x="146" y="128" fontSize="10" fill="#7dd3fc">
          24 ч налив
        </text>
        <line x1="144" y1="124" x2="134" y2="116" stroke="#38bdf8" strokeWidth="0.7" />

        {/* Стенки и среда */}
        <rect x="208" y="23" width="100" height="119" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />
        <text x="218" y="38" fontSize="10" fontWeight="700" fill="#cbd5e1">
          стенки и среда
        </text>
        <text x="218" y="56" fontSize="10" fontWeight="700" fill="#6ee7b7">
          PETG / PA
        </text>
        <text x="218" y="74" fontSize="10" fill="#cbd5e1">
          6 периметров
        </text>
        <text x="218" y="92" fontSize="10" fill="#cbd5e1">
          сплошное 100 %
        </text>
        <text x="218" y="110" fontSize="10" fill="#cbd5e1">
          кольца ×2
        </text>
        <text x="218" y="128" fontSize="10" fill="#cbd5e1">
          налив 24 ч
        </text>

        <text x="12" y="162" fontSize="10" fill="#94a3b8">
          давление держат стенки и два кольца
        </text>
      </svg>
    </VisualWrapper>
  );
}
