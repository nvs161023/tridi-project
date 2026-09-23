/**
 * DirectVsBowden — две схемы подачи пластика: Direct (мотор над соплом) и
 * Bowden (мотор на раме, трубка 40–60 см).
 */
export function DirectVsBowden({ animated = true }: { animated?: boolean }) {
  return (
    <div className="aspect-[16/9] w-full max-w-[600px] overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50">
      {animated && (
        <style>{`@keyframes db-flow{0%{stroke-dashoffset:20}100%{stroke-dashoffset:0}}.db-flow{animation:db-flow 1.6s linear infinite}.db-flow-slow{animation:db-flow 3.2s linear infinite}`}</style>
      )}
      <svg
        viewBox="0 0 320 180"
        className="h-full w-full"
        role="img"
        aria-label="Схемы подачи пластика Direct и Bowden"
      >
        <text x="20" y="24" fontSize="10" fill="#cbd5e1">
          Direct
        </text>
        <rect x="88" y="40" width="30" height="18" rx="2" fill="#334155" stroke="#64748b" />
        <text x="76" y="36" fontSize="8" fill="#94a3b8">
          мотор-экструдер
        </text>
        <rect x="86" y="76" width="34" height="18" rx="2" fill="#334155" stroke="#64748b" />
        <polygon points="103,94 91,94 98,116 108,116" fill="#64748b" />
        <line x1="103" y1="58" x2="103" y2="106" stroke="#3b82f6" strokeWidth="3" strokeDasharray="5 5" className={animated ? "db-flow" : undefined} />
        <line x1="20" y1="120" x2="140" y2="120" stroke="#475569" strokeWidth="2" />
        <text x="20" y="142" fontSize="9" fill="#93c5fd">
          мотор над соплом
        </text>
        <text x="20" y="156" fontSize="8" fill="#94a3b8">
          короткий путь пластика
        </text>

        <line x1="160" y1="28" x2="160" y2="150" stroke="#334155" strokeWidth="1" />

        <text x="176" y="24" fontSize="10" fill="#cbd5e1">
          Bowden
        </text>
        <rect x="176" y="40" width="30" height="18" rx="2" fill="#334155" stroke="#64748b" />
        <text x="164" y="36" fontSize="8" fill="#94a3b8">
          мотор на раме
        </text>
        <path d="M191 58 C 191 86 220 88 244 96" fill="none" stroke="#475569" strokeWidth="8" />
        <path d="M191 58 C 191 86 220 88 244 96" fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="5 5" className={animated ? "db-flow-slow" : undefined} />
        <text x="196" y="76" fontSize="8" fill="#93c5fd">
          трубка 40–60 см
        </text>
        <rect x="236" y="96" width="22" height="16" rx="2" fill="#334155" stroke="#64748b" />
        <polygon points="247,112 239,112 244,130 250,130" fill="#64748b" />
        <line x1="170" y1="134" x2="306" y2="134" stroke="#475569" strokeWidth="2" />
        <text x="176" y="152" fontSize="9" fill="#93c5fd">
          мотор на раме, длинный путь
        </text>
        <text x="176" y="166" fontSize="8" fill="#94a3b8">
          голова легче — печать быстрее
        </text>
      </svg>
    </div>
  );
}
