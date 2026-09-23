/**
 * StringingDemo — две башни, между ними по одной появляются нити-паутинки.
 * Блоки: «Как работает ретракт», паутинки без ретракта.
 */
const STRINGS = [70, 84, 98, 112, 124];

export function StringingDemo({ animated = true }: { animated?: boolean }) {
  return (
    <div className="aspect-[16/9] w-full max-w-[600px] overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50">
      {animated && (
        <style>{`@keyframes sd-web{0%{opacity:0}12%{opacity:1}78%{opacity:1}96%{opacity:0}100%{opacity:0}}.sd-web{animation:sd-web 3s ease-in-out infinite}`}</style>
      )}
      <svg
        viewBox="0 0 320 180"
        className="h-full w-full"
        role="img"
        aria-label="Между двумя башнями появляются нити-паутинки"
      >
        <line x1="20" y1="140" x2="300" y2="140" stroke="#475569" strokeWidth="2" />
        <rect x="70" y="54" width="36" height="86" rx="2" fill="#1d4ed8" stroke="#3b82f6" />
        <rect x="214" y="54" width="36" height="86" rx="2" fill="#1d4ed8" stroke="#3b82f6" />
        <text x="70" y="152" fontSize="9" fill="#94a3b8">
          Башня 1
        </text>
        <text x="214" y="152" fontSize="9" fill="#94a3b8">
          Башня 2
        </text>
        {STRINGS.map((y, i) => (
          <path
            key={y}
            d={`M106 ${y} q54 ${y % 2 ? 10 : 8} 108 0`}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="0.9"
            className={animated ? "sd-web" : undefined}
            style={{ animationDelay: `${i * 0.25}s` }}
          />
        ))}
        <text x="106" y="42" fontSize="10" fill="#fcd34d">
          паутинки между слоями
        </text>
        <text x="20" y="30" fontSize="10" fill="#cbd5e1">
          Без ретракта пластик тянется за соплом
        </text>
        <text x="150" y="170" fontSize="8" fill="#94a3b8">
          с ретрактом нитей нет
        </text>
      </svg>
    </div>
  );
}
