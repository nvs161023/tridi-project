/**
 * IroningDemo — верхняя поверхность до и после Ironing: слева видны линии
 * слоёв, справа гладкая. Настройки из урока: Flow 10%, 20 мм/с, Spacing 0,1 мм.
 */
export function IroningDemo({ animated = true }: { animated?: boolean }) {
  return (
    <div className="aspect-[16/9] w-full max-w-[600px] overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50">
      {animated && (
        <style>{`@keyframes ir-sweep{0%{transform:translateX(0)}100%{transform:translateX(124px)}}.ir-sweep{animation:ir-sweep 3s ease-in-out infinite}`}</style>
      )}
      <svg
        viewBox="0 0 320 180"
        className="h-full w-full"
        role="img"
        aria-label="Верхняя поверхность без Ironing и после Ironing"
      >
        <text x="20" y="26" fontSize="10" fill="#cbd5e1">
          Верхняя поверхность до и после Ironing
        </text>
        <rect x="24" y="60" width="124" height="34" rx="3" fill="#1d4ed8" stroke="#3b82f6" />
        {[68, 76, 84].map((y) => (
          <line key={y} x1="24" y1={y} x2="148" y2={y} stroke="#bfdbfe" strokeWidth="1" />
        ))}
        <text x="24" y="112" fontSize="9" fill="#fca5a5">
          без Ironing — видны линии
        </text>
        <text x="24" y="126" fontSize="8" fill="#94a3b8">
          шероховатая, заметны дорожки
        </text>

        <rect x="172" y="60" width="124" height="34" rx="3" fill="#1d4ed8" stroke="#3b82f6" />
        <line x1="180" y1="77" x2="288" y2="77" stroke="#e0f2fe" strokeWidth="1.5" opacity="0.6" />
        <rect x="172" y="60" width="124" height="34" rx="3" fill="#93c5fd" opacity="0.25" className={animated ? "ir-sweep" : undefined} />
        <g transform="translate(288 0)" className={animated ? "ir-sweep" : undefined}>
          <polygon points="292,58 284,58 288,48 296,48" fill="#64748b" />
          <rect x="283" y="34" width="26" height="14" rx="2" fill="#334155" stroke="#475569" />
        </g>
        <text x="172" y="112" fontSize="9" fill="#93c5fd">
          с Ironing — гладкая, как стекло
        </text>
        <text x="172" y="126" fontSize="8" fill="#94a3b8">
          сопло проходит без подачи пластика
        </text>
        <text x="24" y="148" fontSize="8" fill="#94a3b8">
          Ironing: Flow 10%, скорость 20 мм/с, Spacing 0,1 мм
        </text>
        <text x="24" y="164" fontSize="8" fill="#94a3b8">
          на наклонных поверхностях Ironing не работает — только шкурка
        </text>
      </svg>
    </div>
  );
}
