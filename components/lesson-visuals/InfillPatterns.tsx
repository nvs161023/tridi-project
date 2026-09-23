/**
 * InfillPatterns — четыре квадрата в разрезе: 0 %, 15 % Gyroid, 40 % Cubic,
 * 100 % сплошной. Блоки: «Заполнение: 15, 40 и 100%».
 */
const CELLS = [
  { x: 18, label: "0%" },
  { x: 96, label: "15% Gyroid" },
  { x: 174, label: "40% Cubic" },
  { x: 252, label: "100%" },
];

export function InfillPatterns({ animated = true }: { animated?: boolean }) {
  return (
    <div className="aspect-[16/9] w-full max-w-[600px] overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50">
      {animated && (
        <style>{`@keyframes ip-flow{0%{stroke-dashoffset:0}100%{stroke-dashoffset:-16}}.ip-flow{animation:ip-flow 2.4s linear infinite}`}</style>
      )}
      <svg
        viewBox="0 0 320 180"
        className="h-full w-full"
        role="img"
        aria-label="Четыре кубика в разрезе: пустой, 15% Gyroid, 40% Cubic, 100% сплошной"
      >
        <text x="18" y="22" fontSize="10" fill="#cbd5e1">
          Заполнение в разрезе
        </text>
        {CELLS.map((cell, i) => (
          <g key={cell.label} transform={`translate(${cell.x} 34)`}>
            <rect width="62" height="62" rx="3" fill="#0f172a" stroke="#475569" />
            {i === 0 && (
              <text x="31" y="36" fontSize="8" fill="#64748b" textAnchor="middle">
                пусто
              </text>
            )}
            {i === 1 &&
              [14, 30, 46].map((y) => (
                <path
                  key={y}
                  d={`M6 ${y} q7 -7 14 0 t14 0 t14 0`}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="1.2"
                  strokeDasharray="8 8"
                  className={animated ? "ip-flow" : undefined}
                />
              ))}
            {i === 2 && (
              <>
                {[22, 44].map((x) => (
                  <line key={x} x1={x} y1="8" x2={x} y2="54" stroke="#3b82f6" strokeWidth="1.2" />
                ))}
                {[22, 44].map((y) => (
                  <line key={y} x1="8" y1={y} x2="54" y2={y} stroke="#3b82f6" strokeWidth="1.2" />
                ))}
              </>
            )}
            {i === 3 && (
              <>
                <rect x="4" y="4" width="54" height="54" rx="2" fill="#1d4ed8" />
                {[10, 22, 34, 46].map((x) => (
                  <line key={x} x1={x} y1="4" x2={x} y2="58" stroke="#3b82f6" strokeWidth="1" />
                ))}
              </>
            )}
            <text x="31" y="76" fontSize="9" fill="#cbd5e1" textAnchor="middle">
              {cell.label}
            </text>
          </g>
        ))}
        <text x="18" y="132" fontSize="9" fill="#94a3b8">
          100% не значит прочнее:
        </text>
        <text x="18" y="148" fontSize="9" fill="#94a3b8">
          три стенки держат нагрузку лучше сплошного заполнения
        </text>
      </svg>
    </div>
  );
}
