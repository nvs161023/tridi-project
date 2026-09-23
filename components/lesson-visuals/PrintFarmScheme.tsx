/**
 * PrintFarmScheme — 10 мини-принтеров, Raspberry Pi с OctoPrint, общий
 * мониторинг, камера и датчики дыма, всё в одной сети.
 */
const PRINTERS = Array.from({ length: 10 }, (_, i) => ({
  x: 14 + (i % 5) * 28,
  y: 46 + Math.floor(i / 5) * 26,
}));

export function PrintFarmScheme({ animated = true }: { animated?: boolean }) {
  return (
    <div className="aspect-[16/9] w-full max-w-[600px] overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50">
      {animated && (
        <style>{`@keyframes pf-flow{0%{stroke-dashoffset:16}100%{stroke-dashoffset:0}}@keyframes pf-pulse{0%,100%{opacity:.55}50%{opacity:1}}.pf-flow{animation:pf-flow 1.6s linear infinite}.pf-pulse{animation:pf-pulse 2s ease-in-out infinite}`}</style>
      )}
      <svg
        viewBox="0 0 320 180"
        className="h-full w-full"
        role="img"
        aria-label="Схема печатной фермы: 10 принтеров и общий мониторинг"
      >
        <text x="14" y="18" fontSize="10" fill="#cbd5e1">
          Печатная ферма
        </text>
        <text x="14" y="38" fontSize="9" fill="#93c5fd">
          10 принтеров
        </text>
        {PRINTERS.map((p, i) => (
          <g key={i} className={animated ? "pf-pulse" : undefined} style={{ animationDelay: `${i * 0.15}s` }}>
            <rect x={p.x} y={p.y} width="22" height="16" rx="2" fill="#1d4ed8" opacity="0.5" stroke="#3b82f6" />
            <polygon points={`${p.x + 11},${p.y + 8} ${p.x + 6},${p.y + 8} ${p.x + 9},${p.y + 14} ${p.x + 13},${p.y + 14}`} fill="#93c5fd" />
          </g>
        ))}
        <text x="14" y="104" fontSize="8" fill="#94a3b8">
          камера · датчики дыма · всё в одной сети
        </text>
        <rect x="168" y="48" width="84" height="34" rx="4" fill="#1e293b" stroke="#475569" />
        <text x="176" y="64" fontSize="9" fill="#cbd5e1">
          Raspberry Pi
        </text>
        <text x="176" y="76" fontSize="8" fill="#94a3b8">
          OctoPrint
        </text>
        {[
          { y1: 58, y2: 60 },
          { y1: 80, y2: 70 },
        ].map((a) => (
          <line
            key={a.y1}
            x1="152"
            y1={a.y1}
            x2="168"
            y2={a.y2}
            stroke="#f59e0b"
            strokeWidth="1.2"
            strokeDasharray="4 4"
            className={animated ? "pf-flow" : undefined}
          />
        ))}
        <line
          x1="212"
          y1="48"
          x2="252"
          y2="42"
          stroke="#3b82f6"
          strokeWidth="1.4"
          strokeDasharray="5 4"
          className={animated ? "pf-flow" : undefined}
        />
        <circle cx="266" cy="44" r="9" fill="#1e293b" stroke="#475569" />
        <circle cx="282" cy="38" r="11" fill="#1e293b" stroke="#475569" />
        <circle cx="298" cy="44" r="9" fill="#1e293b" stroke="#475569" />
        <rect x="258" y="40" width="48" height="14" rx="7" fill="#1e293b" />
        <text x="262" y="51" fontSize="8" fill="#93c5fd">
          мониторинг
        </text>
        <line x1="14" y1="122" x2="306" y2="122" stroke="#475569" strokeWidth="1" opacity="0.5" />
        <text x="14" y="142" fontSize="8" fill="#94a3b8">
          Raspberry Pi с OctoPrint собирает статистику всех принтеров
        </text>
        <text x="14" y="158" fontSize="8" fill="#94a3b8">
          оператор видит очередь и состояние каждой машины
        </text>
      </svg>
    </div>
  );
}
