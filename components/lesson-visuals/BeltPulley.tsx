/**
 * BeltPulley — ремень GT2, шкив на 20 зубьев и шаговый мотор.
 * Блоки: «Ремень и шкив» (шаг 2 мм, ширина 6 мм, стекловолокно с неопреном).
 */
export function BeltPulley({ animated = true }: { animated?: boolean }) {
  return (
    <div className="aspect-[16/9] w-full max-w-[600px] overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50">
      {animated && (
        <style>{`@keyframes bp-spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}@keyframes bp-teeth{0%{stroke-dashoffset:0}100%{stroke-dashoffset:-16}}.bp-spin{animation:bp-spin 3.5s linear infinite;transform-box:fill-box;transform-origin:center}.bp-teeth{animation:bp-teeth 1.4s linear infinite}`}</style>
      )}
      <svg
        viewBox="0 0 320 180"
        className="h-full w-full"
        role="img"
        aria-label="Ремень GT2, шкив на 20 зубьев и мотор"
      >
        <rect x="30" y="72" width="42" height="38" rx="3" fill="#334155" stroke="#64748b" />
        <text x="26" y="128" fontSize="9" fill="#cbd5e1">
          Мотор
        </text>
        <line x1="52" y1="60" x2="292" y2="60" stroke="#94a3b8" strokeWidth="4" />
        <line x1="52" y1="122" x2="292" y2="122" stroke="#94a3b8" strokeWidth="4" />
        <line
          x1="52"
          y1="60"
          x2="292"
          y2="60"
          stroke="#f59e0b"
          strokeWidth="4"
          strokeDasharray="4 4"
          className={animated ? "bp-teeth" : undefined}
        />
        <line
          x1="52"
          y1="122"
          x2="292"
          y2="122"
          stroke="#f59e0b"
          strokeWidth="4"
          strokeDasharray="4 4"
          className={animated ? "bp-teeth" : undefined}
        />
        <g className={animated ? "bp-spin" : undefined}>
          <circle cx="172" cy="91" r="26" fill="#1e293b" stroke="#3b82f6" strokeWidth="2" />
          {Array.from({ length: 20 }, (_, i) => {
            const a = (i / 20) * Math.PI * 2;
            const x1 = 172 + Math.cos(a) * 26;
            const y1 = 91 + Math.sin(a) * 26;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={172 + Math.cos(a) * 32}
                y2={91 + Math.sin(a) * 32}
                stroke="#3b82f6"
                strokeWidth="1.5"
              />
            );
          })}
          <circle cx="172" cy="91" r="7" fill="#334155" stroke="#64748b" />
        </g>
        <text x="96" y="46" fontSize="9" fill="#fcd34d">
          ремень GT2
        </text>
        <text x="212" y="152" fontSize="9" fill="#93c5fd">
          шкив 20 зубьев
        </text>
        <text x="26" y="164" fontSize="8" fill="#94a3b8">
          шаг 2 мм
        </text>
        <text x="96" y="164" fontSize="8" fill="#94a3b8">
          ширина 6 мм
        </text>
        <text x="180" y="164" fontSize="8" fill="#94a3b8">
          стекловолокно с неопреном
        </text>
      </svg>
    </div>
  );
}
