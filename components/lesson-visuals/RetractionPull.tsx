/**
 * RetractionPull — четыре фазы цикла длиной 4 с: печать, втягивание пластика,
 * переезд порожняком, печать на новом месте.
 */
export function RetractionPull({ animated = true }: { animated?: boolean }) {
  return (
    <div className="aspect-[16/9] w-full max-w-[600px] overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50">
      {animated && (
        <style>{`@keyframes rp-x{0%{transform:translateX(0)}25%{transform:translateX(52px)}55%{transform:translateX(52px)}75%{transform:translateX(132px)}100%{transform:translateX(192px)}}@keyframes rp-a{0%{transform:scaleX(0);opacity:1}25%{transform:scaleX(1)}92%{opacity:1}100%{opacity:0}}@keyframes rp-b{0%{transform:scaleX(0);opacity:1}75%{transform:scaleX(1)}92%{opacity:1}100%{opacity:0}}@keyframes rp-t{0%,28%{opacity:0}40%{opacity:1}66%{opacity:1}76%,100%{opacity:0}}@keyframes rp-in{0%,22%{opacity:0;transform:translateY(6px)}34%{opacity:1;transform:translateY(0)}52%{opacity:1}62%,100%{opacity:0}}.rp-x{animation:rp-x 4s ease-in-out infinite}.rp-a{animation:rp-a 4s linear infinite;transform-box:fill-box;transform-origin:left center}.rp-b{animation:rp-b 4s linear infinite;transform-box:fill-box;transform-origin:left center}.rp-t{animation:rp-t 4s linear infinite}.rp-in{animation:rp-in 4s ease-in-out infinite}`}</style>
      )}
      <svg
        viewBox="0 0 320 180"
        className="h-full w-full"
        role="img"
        aria-label="Цикл ретракта: печать, втягивание, переезд, печать"
      >
        <line x1="20" y1="130" x2="300" y2="130" stroke="#475569" strokeWidth="2" />
        <rect x="44" y="122" width="52" height="6" rx="3" fill="#3b82f6"
          className={animated ? "rp-a" : undefined} />
        <rect x="160" y="122" width="60" height="6" rx="3" fill="#3b82f6"
          className={animated ? "rp-b" : undefined} />
        <line x1="96" y1="125" x2="160" y2="125" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3"
          className={animated ? "rp-t" : undefined} />
        <text x="100" y="118" fontSize="8" fill="#94a3b8">
          переезд без пластика
        </text>
        <text x="168" y="118" fontSize="8" fill="#94a3b8">
          не капает — нет паутинок
        </text>
        <g transform="translate(36 0)">
          <g className={animated ? "rp-x" : undefined} transform={animated ? undefined : "translate(192 0)"}>
            <polygon points="13,122 0,96 26,96" fill="#64748b" />
            <rect x="4" y="80" width="18" height="16" rx="2" fill="#334155" stroke="#475569" />
            <rect x="9" y="58" width="8" height="22" fill="#1d4ed8" />
            <g className={animated ? "rp-in" : undefined}>
              <path d="M13 74 L13 62 M9 66 L13 61 L17 66" stroke="#f59e0b" strokeWidth="1.6" fill="none" />
              <text x="20" y="72" fontSize="8" fill="#fcd34d">
                пластик втянут
              </text>
            </g>
          </g>
        </g>
        <text x="22" y="30" fontSize="10" fill="#cbd5e1">
          Ретракт: цикл 4 секунды
        </text>
        <text x="26" y="152" fontSize="8" fill="#94a3b8">1 печать</text>
        <text x="98" y="152" fontSize="8" fill="#94a3b8">2 втягивание</text>
        <text x="190" y="152" fontSize="8" fill="#94a3b8">3 переезд</text>
        <text x="256" y="152" fontSize="8" fill="#94a3b8">4 печать</text>
      </svg>
    </div>
  );
}
