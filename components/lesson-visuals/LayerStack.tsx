/**
 * LayerStack — шесть горизонтальных слоёв появляются снизу вверх с задержкой
 * 0,3 с и подписями «Слой 1»…«Слой 6». Блоки: рост модели слой за слоем.
 */
const LAYERS = [1, 2, 3, 4, 5, 6];

export function LayerStack({ animated = true }: { animated?: boolean }) {
  return (
    <div className="aspect-[16/9] w-full max-w-[600px] overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50">
      {animated && (
        <style>{`@keyframes ls-up{0%{opacity:0;transform:translateY(14px)}14%{opacity:1;transform:translateY(0)}82%{opacity:1;transform:translateY(0)}94%{opacity:0;transform:translateY(0)}100%{opacity:0}}.ls-up{animation:ls-up 3.6s ease-out infinite}`}</style>
      )}
      <svg
        viewBox="0 0 320 180"
        className="h-full w-full"
        role="img"
        aria-label="Шесть слоёв появляются снизу вверх"
      >
        <line x1="50" y1="140" x2="300" y2="140" stroke="#475569" strokeWidth="2" />
        {LAYERS.map((n) => (
          <g
            key={n}
            className={animated ? "ls-up" : undefined}
            style={{ animationDelay: `${(n - 1) * 0.3}s` }}
          >
            <rect
              x="60"
              y={140 - 13 * n}
              width="170"
              height="12"
              rx="2"
              fill={n % 2 ? "#3b82f6" : "#2563eb"}
              stroke="#1e3a8a"
            />
            <text x="240" y={140 - 13 * n + 9} fontSize="8" fill="#94a3b8">
              Слой {n}
            </text>
          </g>
        ))}
        <text x="14" y="30" fontSize="10" fill="#cbd5e1">
          Модель растёт вверх
        </text>
      </svg>
    </div>
  );
}
