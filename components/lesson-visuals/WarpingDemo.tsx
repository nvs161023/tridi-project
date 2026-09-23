/**
 * WarpingDemo — кубик остывает, углы анимированно отклеиваются от стола.
 * Блоки: усадка и отклеивание ABS.
 */
export function WarpingDemo({ animated = true }: { animated?: boolean }) {
  return (
    <div className="aspect-[16/9] w-full max-w-[600px] overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50">
      {animated && (
        <style>{`@keyframes wp-left{0%,12%{transform:rotate(0)}42%,72%{transform:rotate(-18deg)}100%{transform:rotate(0)}}@keyframes wp-right{0%,12%{transform:rotate(0)}42%,72%{transform:rotate(18deg)}100%{transform:rotate(0)}}.wp-left{animation:wp-left 3s ease-in-out infinite;transform-box:fill-box;transform-origin:0% 100%}.wp-right{animation:wp-right 3s ease-in-out infinite;transform-box:fill-box;transform-origin:100% 100%}`}</style>
      )}
      <svg
        viewBox="0 0 320 180"
        className="h-full w-full"
        role="img"
        aria-label="Углы кубика отклеиваются от стола при усадке"
      >
        <line x1="20" y1="140" x2="300" y2="140" stroke="#475569" strokeWidth="2" />
        <text x="20" y="156" fontSize="9" fill="#94a3b8">
          Стол
        </text>
        <rect x="80" y="60" width="160" height="70" rx="2" fill="#1d4ed8" opacity="0.55" stroke="#3b82f6" />
        <polygon points="80,60 118,40 278,40 240,60" fill="#2563eb" opacity="0.7" stroke="#3b82f6" />
        <text x="152" y="102" fontSize="10" fill="#e2e8f0">
          Кубик остывает
        </text>
        <g className={animated ? "wp-left" : undefined} transform={animated ? undefined : "rotate(-18 80 130)"}>
          <polygon points="80,130 108,130 80,104" fill="#ef4444" opacity="0.9" />
        </g>
        <g className={animated ? "wp-right" : undefined} transform={animated ? undefined : "rotate(18 240 130)"}>
          <polygon points="240,130 212,130 240,104" fill="#ef4444" opacity="0.9" />
        </g>
        <path d="M60 132 L60 118 M52 126 L60 116 L68 126" stroke="#ef4444" strokeWidth="1.5" fill="none" />
        <path d="M260 132 L260 118 M252 126 L260 116 L268 126" stroke="#ef4444" strokeWidth="1.5" fill="none" />
        <text x="26" y="86" fontSize="9" fill="#fca5a5">
          углы
        </text>
        <text x="26" y="98" fontSize="9" fill="#fca5a5">
          отклеиваются
        </text>
        <text x="196" y="86" fontSize="9" fill="#fca5a5">
          усадка тянет
        </text>
        <text x="196" y="98" fontSize="9" fill="#fca5a5">
          края вверх
        </text>
      </svg>
    </div>
  );
}
