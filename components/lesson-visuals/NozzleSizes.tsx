/**
 * NozzleSizes — четыре сопла 0,2 / 0,4 / 0,6 / 0,8 мм и ширина линии, которую
 * даёт каждое. Блоки: «Сопла» (латунное, стальное, рубиновое).
 */
const NOZZLES = [
  { x: 52, d: "0,2 мм", w: 1.5 },
  { x: 122, d: "0,4 мм", w: 3 },
  { x: 192, d: "0,6 мм", w: 4.5 },
  { x: 262, d: "0,8 мм", w: 6 },
];

export function NozzleSizes({ animated = true }: { animated?: boolean }) {
  return (
    <div className="aspect-[16/9] w-full max-w-[600px] overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50">
      {animated && (
        <style>{`@keyframes ns-drop{0%{opacity:0;transform:scale(.6)}40%{opacity:1;transform:scale(1)}85%{opacity:1}100%{opacity:0;transform:scale(1)}}.ns-drop{animation:ns-drop 2.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center}`}</style>
      )}
      <svg
        viewBox="0 0 320 180"
        className="h-full w-full"
        role="img"
        aria-label="Сопла 0,2, 0,4, 0,6 и 0,8 мм и ширина линии"
      >
        <text x="20" y="26" fontSize="10" fill="#cbd5e1">
          Диаметр сопла → ширина линии
        </text>
        {NOZZLES.map((n, i) => (
          <g key={n.d}>
            <polygon
              points={`${n.x - 14},54 ${n.x + 14},54 ${n.x + n.w},84 ${n.x - n.w},84`}
              fill="#64748b"
            />
            <rect x={n.x - 15} y="40" width="30" height="14" rx="2" fill="#334155" stroke="#475569" />
            <circle
              cx={n.x}
              cy="96"
              r={n.w + 1}
              fill="#3b82f6"
              className={animated ? "ns-drop" : undefined}
              style={{ animationDelay: `${i * 0.2}s` }}
            />
            <line
              x1={n.x - 26}
              y1="120"
              x2={n.x + 26}
              y2="120"
              stroke="#3b82f6"
              strokeWidth={n.w}
              strokeLinecap="round"
            />
            <text x={n.x} y="146" fontSize="10" fill="#93c5fd" textAnchor="middle">
              {n.d}
            </text>
          </g>
        ))}
        <line x1="20" y1="120" x2="300" y2="120" stroke="#475569" strokeWidth="1" opacity="0.4" />
        <text x="20" y="168" fontSize="8" fill="#94a3b8">
          Латунное сопло — для PLA и PETG, стальное — для абразивов, рубиновое — долгое
        </text>
      </svg>
    </div>
  );
}
