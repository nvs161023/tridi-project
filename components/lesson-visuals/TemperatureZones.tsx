/**
 * TemperatureZones — три сопла с разной температурой: 180 °C (густой пластик,
 * щели), 210 °C (ровная лента), 240 °C (растекается и тянет нити).
 */
export function TemperatureZones({ animated = true }: { animated?: boolean }) {
  return (
    <div className="aspect-[16/9] w-full max-w-[600px] overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50">
      {animated && (
        <style>{`@keyframes tz-bead{0%,100%{opacity:.35}50%{opacity:1}}@keyframes tz-flow{0%{stroke-dashoffset:0}100%{stroke-dashoffset:-24}}@keyframes tz-spread{0%{transform:scaleX(.6)}100%{transform:scaleX(1.25)}}.tz-bead{animation:tz-bead 2.4s ease-in-out infinite}.tz-flow{animation:tz-flow 2s linear infinite}.tz-spread{animation:tz-spread 3s ease-in-out infinite alternate;transform-box:fill-box;transform-origin:center}`}</style>
      )}
      <svg
        viewBox="0 0 320 180"
        className="h-full w-full"
        role="img"
        aria-label="Три сопла при 180, 210 и 240 градусах"
      >
        {[
          { x: 55, t: "180 °C", c: "#f59e0b" },
          { x: 160, t: "210 °C", c: "#3b82f6" },
          { x: 265, t: "240 °C", c: "#ef4444" },
        ].map((z) => (
          <g key={z.t}>
            <text x={z.x} y="34" fontSize="11" fill={z.c} textAnchor="middle">
              {z.t}
            </text>
            <polygon
              points={`${z.x - 12},58 ${z.x + 12},58 ${z.x + 4},80 ${z.x - 4},80`}
              fill="#64748b"
            />
            <rect
              x={z.x - 13}
              y="44"
              width="26"
              height="14"
              rx="2"
              fill="#334155"
              stroke="#475569"
            />
          </g>
        ))}
        {[30, 42, 54, 66, 78].map((dx) => (
          <circle
            key={dx}
            cx={dx}
            cy="88"
            r="3"
            fill="#f59e0b"
            className={animated ? "tz-bead" : undefined}
          />
        ))}
        <line
          x1="124"
          y1="88"
          x2="196"
          y2="88"
          stroke="#3b82f6"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="6 6"
          className={animated ? "tz-flow" : undefined}
        />
        <ellipse
          cx="265"
          cy="90"
          rx="26"
          ry="8"
          fill="#ef4444"
          className={animated ? "tz-spread" : undefined}
        />
        <path
          d="M265 98 q6 16 -2 30"
          stroke="#ef4444"
          strokeWidth="1.5"
          fill="none"
          strokeDasharray="4 4"
        />
        <text x="30" y="124" fontSize="9" fill="#fcd34d">
          густой, слои с щелями
        </text>
        <text x="124" y="124" fontSize="9" fill="#93c5fd">
          ровная лента, слои склеены
        </text>
        <text x="218" y="124" fontSize="9" fill="#fca5a5">
          растекается, тянет нити
        </text>
        <line x1="20" y1="140" x2="300" y2="140" stroke="#475569" strokeWidth="2" />
        <text x="20" y="158" fontSize="9" fill="#94a3b8">
          Стол
        </text>
      </svg>
    </div>
  );
}
