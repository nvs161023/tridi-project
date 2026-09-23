/**
 * FilamentDrying — катушка в герметичном контейнере, влага испаряется и её
 * забирает силикагель. Блоки: «Сушка пластика».
 */
export function FilamentDrying({ animated = true }: { animated?: boolean }) {
  return (
    <div className="aspect-[16/9] w-full max-w-[600px] overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50">
      {animated && (
        <style>{`@keyframes fd-vap{0%{opacity:0;transform:translateY(10px)}30%{opacity:.9}100%{opacity:0;transform:translateY(-16px)}}.fd-vap{animation:fd-vap 3s ease-out infinite}`}</style>
      )}
      <svg
        viewBox="0 0 320 180"
        className="h-full w-full"
        role="img"
        aria-label="Сушка филамента: катушка и силикагель в герметичном контейнере"
      >
        <rect x="56" y="44" width="208" height="104" rx="8" fill="#0f172a" stroke="#475569" />
        <text x="56" y="36" fontSize="10" fill="#cbd5e1">
          Герметичный контейнер
        </text>
        <circle cx="120" cy="94" r="30" fill="#1e293b" stroke="#3b82f6" strokeWidth="2" />
        <circle cx="120" cy="94" r="9" fill="#334155" stroke="#64748b" />
        <text x="96" y="98" fontSize="8" fill="#cbd5e1">
          катушка
        </text>
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            d={`M${172 + i * 22} 108 q7 -9 0 -18 t0 -18`}
            fill="none"
            stroke="#93c5fd"
            strokeWidth="1.4"
            className={animated ? "fd-vap" : undefined}
            style={{ animationDelay: `${i * 0.4}s` }}
          />
        ))}
        <text x="168" y="72" fontSize="9" fill="#93c5fd">
          испарение влаги
        </text>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <circle key={i} cx={150 + i * 18} cy="136" r="4" fill="#f59e0b" />
        ))}
        <text x="150" y="128" fontSize="8" fill="#fcd34d">
          силикагель
        </text>
        <text x="56" y="166" fontSize="8" fill="#94a3b8">
          влага уходит из пластика в силикагель — печать снова ровная
        </text>
      </svg>
    </div>
  );
}
