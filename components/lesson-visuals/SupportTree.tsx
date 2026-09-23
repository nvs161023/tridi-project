/**
 * SupportTree — нависающая балка и растущие вниз ветки поддержек, которые
 * сходятся в одну ножку. Блоки: «Виды поддержек», «Древовидные поддержки».
 */
export function SupportTree({ animated = true }: { animated?: boolean }) {
  return (
    <div className="aspect-[16/9] w-full max-w-[600px] overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50">
      {animated && (
        <style>{`@keyframes st-grow{0%{stroke-dashoffset:150}45%{stroke-dashoffset:0}90%{stroke-dashoffset:0}100%{stroke-dashoffset:150}}.st-grow{animation:st-grow 3.4s ease-in-out infinite}`}</style>
      )}
      <svg
        viewBox="0 0 320 180"
        className="h-full w-full"
        role="img"
        aria-label="Древовидные поддержки растут вниз от нависающей балки"
      >
        <rect x="70" y="40" width="180" height="12" rx="2" fill="#1d4ed8" stroke="#3b82f6" />
        <text x="70" y="32" fontSize="9" fill="#93c5fd">
          Нависающая балка
        </text>
        <path
          d="M100 52 C 100 96 144 100 160 138"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2.5"
          strokeDasharray="150"
          className={animated ? "st-grow" : undefined}
        />
        <path
          d="M220 52 C 220 96 176 100 160 138"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2.5"
          strokeDasharray="150"
          className={animated ? "st-grow" : undefined}
          style={{ animationDelay: "0.35s" }}
        />
        <path d="M160 96 L160 138" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
        <line x1="20" y1="140" x2="300" y2="140" stroke="#475569" strokeWidth="2" />
        <text x="20" y="156" fontSize="9" fill="#94a3b8">
          Стол
        </text>
        <text x="150" y="86" fontSize="9" fill="#fcd34d">
          ветки сходятся в ножку
        </text>
        <text x="150" y="102" fontSize="9" fill="#fcd34d">
          экономия пластика 50%
        </text>
      </svg>
    </div>
  );
}
