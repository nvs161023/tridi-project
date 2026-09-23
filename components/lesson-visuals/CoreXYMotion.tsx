/**
 * CoreXYMotion — два мотора тянут ремни крест-накрест, голова ездит по X и Y.
 * Блоки: «Как двигается CoreXY», кинематика.
 */
export function CoreXYMotion({ animated = true }: { animated?: boolean }) {
  return (
    <div className="aspect-[16/9] w-full max-w-[600px] overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50">
      {animated && (
        <style>{`@keyframes cx-path{0%{transform:translate(0,0)}25%{transform:translate(120px,0)}50%{transform:translate(120px,60px)}75%{transform:translate(0,60px)}100%{transform:translate(0,0)}}.cx-path{animation:cx-path 4s ease-in-out infinite}`}</style>
      )}
      <svg
        viewBox="0 0 320 180"
        className="h-full w-full"
        role="img"
        aria-label="Схема CoreXY: два мотора и ремни крест-накрест"
      >
        <rect x="40" y="30" width="240" height="110" fill="none" stroke="#475569" />
        <rect x="48" y="36" width="24" height="18" rx="2" fill="#334155" stroke="#64748b" />
        <rect x="248" y="36" width="24" height="18" rx="2" fill="#334155" stroke="#64748b" />
        <text x="44" y="68" fontSize="9" fill="#cbd5e1">
          Мотор A
        </text>
        <text x="228" y="68" fontSize="9" fill="#cbd5e1">
          Мотор B
        </text>
        <path d="M60 44 L264 136" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="5 4" />
        <path d="M260 44 L56 136" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="5 4" />
        <g transform="translate(100 60)">
          <g
            className={animated ? "cx-path" : undefined}
            transform={animated ? undefined : "translate(60 30)"}
          >
            <rect x="-6" y="-6" width="12" height="12" rx="2" fill="#3b82f6" />
            <polygon points="-2,6 2,6 1,12 -1,12" fill="#93c5fd" />
            <text x="10" y="4" fontSize="9" fill="#93c5fd">
              голова
            </text>
          </g>
        </g>
        <text x="40" y="160" fontSize="9" fill="#fcd34d">
          ремни крест-накрест
        </text>
        <text x="40" y="24" fontSize="10" fill="#cbd5e1">
          Оба мотора вместе — по X, в разные стороны — по Y
        </text>
        <text x="150" y="160" fontSize="9" fill="#94a3b8">
          лёгкая голова — высокая скорость
        </text>
      </svg>
    </div>
  );
}
