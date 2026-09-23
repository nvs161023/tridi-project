/**
 * HotendCrossSection — разрез хотэнда: радиатор, heatbreak, нагревательный
 * блок, сопло. Синяя зона охлаждения, красная зона плавления, стрелки пластика.
 */
export function HotendCrossSection({ animated = true }: { animated?: boolean }) {
  return (
    <div className="aspect-[16/9] w-full max-w-[600px] overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50">
      {animated && (
        <style>{`@keyframes hx-flow{0%{stroke-dashoffset:0}100%{stroke-dashoffset:-28}}@keyframes hx-glow{0%,100%{opacity:.45}50%{opacity:.85}}.hx-flow{animation:hx-flow 1.8s linear infinite}.hx-glow{animation:hx-glow 2.4s ease-in-out infinite}`}</style>
      )}
      <svg
        viewBox="0 0 320 180"
        className="h-full w-full"
        role="img"
        aria-label="Разрез хотэнда: радиатор, heatbreak, нагреватель, сопло"
      >
        <rect x="112" y="18" width="96" height="52" rx="4" fill="#1d4ed8" opacity="0.25" stroke="#3b82f6" strokeDasharray="4 3" />
        <text x="214" y="30" fontSize="9" fill="#93c5fd">
          зона охлаждения
        </text>
        {[26, 38, 50, 62].map((y) => (
          <rect key={y} x="128" y={y} width="64" height="6" rx="1" fill="#64748b" />
        ))}
        <rect x="152" y="70" width="16" height="22" fill="#94a3b8" />
        <text x="8" y="62" fontSize="9" fill="#cbd5e1">
          радиатор
        </text>
        <text x="8" y="80" fontSize="9" fill="#cbd5e1">
          heatbreak
        </text>
        <path d="M60 58 L126 50 M60 76 L150 78" stroke="#475569" strokeWidth="0.8" />
        <rect x="124" y="92" width="72" height="24" rx="3" fill="#475569" stroke="#64748b" />
        <rect x="124" y="90" width="72" height="28" fill="#ef4444" opacity="0.5" className={animated ? "hx-glow" : undefined} />
        <path d="M144 116 L176 116 L168 136 L152 136 Z" fill="#64748b" />
        <text x="8" y="108" fontSize="9" fill="#cbd5e1">
          нагреватель
        </text>
        <path d="M62 104 L122 104" stroke="#475569" strokeWidth="0.8" />
        <text x="200" y="110" fontSize="9" fill="#fca5a5">
          зона плавления
        </text>
        <line x1="160" y1="16" x2="160" y2="130" stroke="#3b82f6" strokeWidth="3" strokeDasharray="7 7" className={animated ? "hx-flow" : undefined} />
        <text x="8" y="20" fontSize="9" fill="#93c5fd">
          холодный пластик входит
        </text>
        <path d="M96 26 L152 26 M146 22 L152 26 L146 30" stroke="#3b82f6" strokeWidth="1.2" fill="none" />
        <path d="M160 136 L160 158 M155 152 L160 158 L165 152" stroke="#ef4444" strokeWidth="1.4" fill="none" />
        <text x="168" y="146" fontSize="9" fill="#fca5a5">
          горячий пластик выходит
        </text>
        <text x="8" y="172" fontSize="8" fill="#94a3b8">
          выше heatbreak пластик остаётся твёрдым, плавится только у сопла
        </text>
      </svg>
    </div>
  );
}
