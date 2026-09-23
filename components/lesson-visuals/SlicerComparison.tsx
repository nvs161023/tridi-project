/**
 * SlicerComparison — одна деталь в двух слайсерах: Cura ставит линейные
 * поддержки по всей модели, Orca — древовидные только под нависания.
 */
export function SlicerComparison({ animated = true }: { animated?: boolean }) {
  return (
    <div className="aspect-[16/9] w-full max-w-[600px] overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50">
      {animated && (
        <style>{`@keyframes sc-in{0%{opacity:0;transform:translateY(8px)}20%{opacity:1;transform:translateY(0)}82%{opacity:1}100%{opacity:0}}.sc-in{animation:sc-in 3.2s ease-out infinite}`}</style>
      )}
      <svg
        viewBox="0 0 320 180"
        className="h-full w-full"
        role="img"
        aria-label="Сравнение поддержек в Cura и Orca Slicer"
      >
        <text x="14" y="20" fontSize="10" fill="#cbd5e1">
          Одна деталь — два слайсера
        </text>
        {[
          { x: 14, title: "Cura" },
          { x: 166, title: "OrcaSlicer" },
        ].map((w) => (
          <g key={w.title}>
            <rect x={w.x} y="28" width="140" height="120" rx="6" fill="#0f172a" stroke="#475569" />
            <rect x={w.x} y="28" width="140" height="16" rx="6" fill="#1e293b" />
            <text x={w.x + 8} y="40" fontSize="9" fill="#cbd5e1">
              {w.title}
            </text>
            <rect x={w.x + 46} y="58" width="24" height="14" fill="#94a3b8" />
            <rect x={w.x + 32} y="72" width="52" height="8" fill="#94a3b8" />
            <line x1={w.x + 8} y1="134" x2={w.x + 132} y2="134" stroke="#475569" strokeWidth="2" />
          </g>
        ))}
        {[36, 46, 56, 66, 76, 86].map((dx, i) => (
          <line
            key={dx}
            x1={30 + dx}
            y1="80"
            x2={30 + dx}
            y2="134"
            stroke="#f59e0b"
            strokeWidth="1.4"
            className={animated ? "sc-in" : undefined}
            style={{ animationDelay: `${i * 0.12}s` }}
          />
        ))}
        <path d="M212 80 C 212 104 232 110 238 132" fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 3" />
        <path d="M240 80 C 240 104 240 110 238 132" fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 3" />
        <text x="14" y="166" fontSize="9" fill="#fcd34d">
          Линейные — по всей модели
        </text>
        <text x="166" y="166" fontSize="9" fill="#93c5fd">
          Древовидные — под нависания
        </text>
      </svg>
    </div>
  );
}
