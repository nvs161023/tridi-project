/**
 * SpeedComparison — два кубика: 80 мм/с печатается неровно (углы закруглены,
 * слои расслоены), 40 мм/с — гладко и с чёткими углами.
 */
export function SpeedComparison({ animated = true }: { animated?: boolean }) {
  return (
    <div className="aspect-[16/9] w-full max-w-[600px] overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50">
      {animated && (
        <style>{`@keyframes sp-jit{0%,100%{transform:translate(0,0)}25%{transform:translate(1.5px,-1px)}50%{transform:translate(-1px,1px)}75%{transform:translate(1px,0)}}.sp-jit{animation:sp-jit 1.6s linear infinite}`}</style>
      )}
      <svg
        viewBox="0 0 320 180"
        className="h-full w-full"
        role="img"
        aria-label="Сравнение печати на 80 и 40 мм/с"
      >
        <g className={animated ? "sp-jit" : undefined}>
          <path
            d="M36 120 L36 60 q1 -4 5 -4 L102 54 q5 0 6 5 L112 118 q1 4 -4 5 L41 125 q-5 1 -5 -5 Z"
            fill="#7f1d1d"
            opacity="0.75"
            stroke="#ef4444"
          />
          {[68, 80, 92, 104].map((y) => (
            <path
              key={y}
              d={`M38 ${y} q12 -3 26 1 t26 -1 t26 2`}
              fill="none"
              stroke="#fca5a5"
              strokeWidth="1"
            />
          ))}
        </g>
        <text x="36" y="144" fontSize="11" fill="#ef4444">
          80 мм/с
        </text>
        <text x="36" y="158" fontSize="8" fill="#94a3b8">
          углы закруглены, слои расслоены
        </text>

        <line x1="160" y1="30" x2="160" y2="150" stroke="#334155" strokeWidth="1" />
        <rect x="190" y="56" width="76" height="68" rx="2" fill="#1d4ed8" stroke="#3b82f6" />
        {[70, 82, 94, 106].map((y) => (
          <line key={y} x1="190" y1={y} x2="266" y2={y} stroke="#93c5fd" strokeWidth="1" />
        ))}
        <text x="190" y="144" fontSize="11" fill="#3b82f6">
          40 мм/с
        </text>
        <text x="180" y="158" fontSize="8" fill="#94a3b8">
          поверхность гладкая, углы чёткие
        </text>
        <text x="20" y="24" fontSize="10" fill="#cbd5e1">
          Одна и та же деталь на разной скорости
        </text>
      </svg>
    </div>
  );
}
