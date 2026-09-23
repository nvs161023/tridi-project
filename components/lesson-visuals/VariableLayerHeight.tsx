/**
 * VariableLayerHeight — модель с переменной высотой слоя: 0,28 мм на ровных
 * участках (быстро) и 0,12 мм на деталях (точно).
 */
export function VariableLayerHeight({ animated = true }: { animated?: boolean }) {
  return (
    <div className="aspect-[16/9] w-full max-w-[600px] overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50">
      {animated && (
        <style>{`@keyframes vl-in{0%{opacity:0}12%{opacity:1}84%{opacity:1}100%{opacity:0}}.vl-in{animation:vl-in 3.4s linear infinite;animation-fill-mode:forwards}`}</style>
      )}
      <svg
        viewBox="0 0 320 180"
        className="h-full w-full"
        role="img"
        aria-label="Модель с высотой слоя 0,28 и 0,12 мм"
      >
        <text x="20" y="22" fontSize="10" fill="#cbd5e1">
          Высота слоя меняется по высоте модели
        </text>
        <path d="M150 40 L196 138 L104 138 Z" fill="#1e293b" stroke="#475569" />
        {Array.from({ length: 8 }, (_, i) => {
          const y = 48 + i * 6;
          const half = 12 + ((y - 40) / 98) * 34;
          return (
            <line
              key={`thin-${y}`}
              x1={150 - half}
              y1={y}
              x2={150 + half}
              y2={y}
              stroke="#3b82f6"
              strokeWidth="1.2"
              className={animated ? "vl-in" : undefined}
              style={{ animationDelay: `${i * 0.12}s` }}
            />
          );
        })}
        {Array.from({ length: 5 }, (_, i) => {
          const y = 100 + i * 8;
          const half = 12 + ((y - 40) / 98) * 34;
          return (
            <line
              key={`thick-${y}`}
              x1={150 - half}
              y1={y}
              x2={150 + half}
              y2={y}
              stroke="#93c5fd"
              strokeWidth="5"
              className={animated ? "vl-in" : undefined}
              style={{ animationDelay: `${0.9 + i * 0.12}s` }}
            />
          );
        })}
        <line x1="20" y1="140" x2="300" y2="140" stroke="#475569" strokeWidth="2" />
        <text x="210" y="62" fontSize="9" fill="#93c5fd">
          0,12 мм — детали, точно
        </text>
        <path d="M206 64 L186 64" stroke="#3b82f6" strokeWidth="0.8" />
        <text x="210" y="120" fontSize="9" fill="#93c5fd">
          0,28 мм — ровные участки
        </text>
        <path d="M206 122 L190 118" stroke="#3b82f6" strokeWidth="0.8" />
        <text x="20" y="160" fontSize="8" fill="#94a3b8">
          Толстый слой печатается быстрее, тонкий — точнее: время печати сокращается на 30%
        </text>
      </svg>
    </div>
  );
}
