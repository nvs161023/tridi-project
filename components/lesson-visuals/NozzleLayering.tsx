/**
 * NozzleLayering — сопло едет слева направо по столу и синхронно оставляет
 * полоску пластика. Блоки: «Устройство принтера», «Как принтер строит модель».
 */
export function NozzleLayering({ animated = true }: { animated?: boolean }) {
  return (
    <div className="aspect-[16/9] w-full max-w-[600px] overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50">
      {animated && (
        <style>{`@keyframes nzl-x{0%{transform:translateX(0)}100%{transform:translateX(203px)}}@keyframes nzl-w{0%{transform:scaleX(0)}100%{transform:scaleX(1)}}.nzl-x{animation:nzl-x 3s ease-in-out infinite}.nzl-w{animation:nzl-w 3s ease-in-out infinite}`}</style>
      )}
      <svg
        viewBox="0 0 320 180"
        className="h-full w-full"
        role="img"
        aria-label="Сопло движется по столу и оставляет полоску пластика"
      >
        <line x1="20" y1="140" x2="300" y2="140" stroke="#475569" strokeWidth="2" />
        <text x="20" y="156" fontSize="9" fill="#94a3b8">
          Стол
        </text>
        <rect
          x="40"
          y="132"
          width="230"
          height="6"
          rx="3"
          fill="#3b82f6"
          className={animated ? "nzl-w" : undefined}
          style={{ transformBox: "fill-box", transformOrigin: "left center" }}
        />
        <g transform="translate(27 0)">
          <g
            className={animated ? "nzl-x" : undefined}
            transform={animated ? undefined : "translate(203 0)"}
          >
            <polygon points="13,132 0,104 26,104" fill="#64748b" />
            <rect x="4" y="88" width="18" height="16" rx="2" fill="#334155" stroke="#475569" />
            <rect x="9" y="66" width="8" height="22" fill="#1d4ed8" />
            <text x="34" y="96" fontSize="9" fill="#cbd5e1">
              Сопло
            </text>
          </g>
        </g>
        <text x="196" y="124" fontSize="9" fill="#93c5fd">
          Полоска пластика
        </text>
        <text x="20" y="30" fontSize="10" fill="#cbd5e1">
          Слой ложится на стол
        </text>
      </svg>
    </div>
  );
}
