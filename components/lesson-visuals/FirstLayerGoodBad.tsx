/**
 * FirstLayerGoodBad — два квадрата первого слоя: слева сопло слишком высоко
 * (между линиями щели), справа сопло на месте — линии плотно сплющены.
 */
export function FirstLayerGoodBad({ animated = true }: { animated?: boolean }) {
  return (
    <div className="aspect-[16/9] w-full max-w-[600px] overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50">
      {animated && (
        <style>{`@keyframes fl-bob{0%,100%{transform:translateY(-5px)}50%{transform:translateY(0)}}.fl-bob{animation:fl-bob 2.6s ease-in-out infinite}`}</style>
      )}
      <svg
        viewBox="0 0 320 180"
        className="h-full w-full"
        role="img"
        aria-label="Первый слой: сопло слишком высоко и сопло на месте"
      >
        <g className={animated ? "fl-bob" : undefined}>
          <polygon points="85,58 73,58 79,78 91,78" fill="#64748b" />
          <rect x="72" y="44" width="26" height="14" rx="2" fill="#334155" stroke="#475569" />
        </g>
        <path d="M78 80 L78 98" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 2" />
        <text x="84" y="92" fontSize="8" fill="#fcd34d">
          зазор — сопло высоко
        </text>
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x="34" y={100 + i * 9} width="92" height="3" rx="1.5" fill="#f59e0b" />
        ))}
        {[1, 2, 3].map((i) => (
          <text key={i} x="130" y={105 + i * 9} fontSize="7" fill="#94a3b8">
            щель
          </text>
        ))}
        <text x="34" y="150" fontSize="10" fill="#f59e0b">
          Слишком высоко
        </text>
        <text x="34" y="164" fontSize="8" fill="#94a3b8">
          линии врозь, между ними щели
        </text>

        <line x1="160" y1="34" x2="160" y2="150" stroke="#334155" strokeWidth="1" />
        <polygon points="235,74 223,74 229,92 241,92" fill="#64748b" />
        <rect x="222" y="60" width="26" height="14" rx="2" fill="#334155" stroke="#475569" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x="184" y={96 + i * 5} width="92" height="4" rx="2" fill="#3b82f6" />
        ))}
        <text x="184" y="150" fontSize="10" fill="#3b82f6">
          Идеально
        </text>
        <text x="184" y="164" fontSize="8" fill="#94a3b8">
          линии плотно и слегка сплющены
        </text>
      </svg>
    </div>
  );
}
