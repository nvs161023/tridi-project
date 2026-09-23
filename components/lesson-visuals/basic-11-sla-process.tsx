import { VisualWrapper, type VisualProps } from "./_Wrapper";

/**
 * basic 11 · animation «Как работает SLA» (Модуль 4: Знакомство со SLA).
 *
 * Из описания блока: ванна с фотополимером, свет проходит через слой и смола твердеет,
 * платформа поднимается, новый слой смолы — снова свет. После — промывка и UV-засветка.
 */
const LAYERS = [94, 88, 82];

export function Basic11SlaProcess({ title, animated = true }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Цикл SLA: свет проходит через слой, смола твердеет, платформа поднимается, затем промывка и UV-засветка"
      animated={animated}
    >
      {animated && (
        <style>{`@keyframes b11p-light{0%,6%{opacity:0}12%,24%{opacity:1}30%,100%{opacity:0}}@keyframes b11p-layer{0%{opacity:0}16%{opacity:1}100%{opacity:1}}@keyframes b11p-plat{0%,16%{transform:translateY(0)}30%,50%{transform:translateY(-6px)}64%,84%{transform:translateY(-12px)}100%{transform:translateY(-12px)}}.b11p-light{animation:b11p-light 4.5s linear infinite}.b11p-layer{animation:b11p-layer 4.5s linear infinite}.b11p-plat{animation:b11p-plat 4.5s ease-in-out infinite}`}</style>
      )}
      <svg viewBox="0 0 320 180" className="h-full w-full">
        <path d="M30 100 V140 H186 V100" fill="none" stroke="#64748b" strokeWidth="3" />
        <rect x="32" y="100" width="152" height="38" fill="#1d4ed8" opacity="0.22" />
        <line x1="32" y1="100" x2="184" y2="100" stroke="#3b82f6" opacity="0.7" />

        <g
          className={animated ? "b11p-plat" : undefined}
          transform={animated ? undefined : "translate(0 -12)"}
        >
          <rect x="86" y="8" width="8" height="28" fill="#475569" />
          <rect x="56" y="34" width="68" height="8" rx="2" fill="#334155" stroke="#64748b" />
        </g>
        {LAYERS.map((y, i) => (
          <rect
            key={y}
            x="74"
            y={y}
            width="32"
            height="6"
            fill="#3b82f6"
            className={animated ? "b11p-layer" : undefined}
            style={{ animationDelay: `${i * 1.5}s` }}
          />
        ))}

        <rect x="76" y="148" width="64" height="12" rx="2" fill="#334155" stroke="#f59e0b" />
        {[88, 102, 116, 130].map((x) => (
          <line
            key={x}
            x1={x}
            y1="146"
            x2={x}
            y2="140"
            stroke="#f59e0b"
            strokeWidth="1.5"
            strokeDasharray="3 2"
            className={animated ? "b11p-light" : undefined}
            style={{ animationDelay: `${(x - 88) * 0.5}s` }}
          />
        ))}
        <text x="30" y="170" fontSize="7.5" fill="#fcd34d">
          источник света
        </text>
        <text x="30" y="86" fontSize="7.5" fill="#93c5fd">
          ванна с фотополимером
        </text>
        <text x="58" y="30" fontSize="7" fill="#cbd5e1">
          платформа
        </text>

        <text x="196" y="52" fontSize="7.5" fill="#e2e8f0">
          1 свет проходит через слой
        </text>
        <text x="196" y="70" fontSize="7.5" fill="#e2e8f0">
          2 смола твердеет
        </text>
        <text x="196" y="88" fontSize="7.5" fill="#e2e8f0">
          3 платформа поднимается,
        </text>
        <text x="196" y="100" fontSize="7.5" fill="#e2e8f0">
          новый слой смолы — снова свет
        </text>

        <rect x="196" y="116" width="52" height="32" rx="3" fill="#0f172a" stroke="#475569" />
        <path d="M207 130 q6 -9 12 0 q-6 8 -12 0 Z" fill="#93c5fd" />
        <text x="222" y="142" fontSize="6" fill="#93c5fd" textAnchor="middle">
          промывка
        </text>
        <rect x="258" y="116" width="52" height="32" rx="3" fill="#0f172a" stroke="#f59e0b" />
        <circle cx="272" cy="130" r="6" fill="#f59e0b" />
        <path d="M272 122 v-4 M266 126 l-4 -3 M278 126 l4 -3" stroke="#f59e0b" />
        <text x="285" y="142" fontSize="6" fill="#fcd34d" textAnchor="middle">
          UV-засветка
        </text>
        <text x="196" y="164" fontSize="6.5" fill="#64748b">
          цикл повторяется 3 раза — по слою за проход
        </text>
        <text x="196" y="176" fontSize="6.5" fill="#94a3b8">
          после печати: промывка изопропилом и UV-засветка
        </text>
      </svg>
    </VisualWrapper>
  );
}
