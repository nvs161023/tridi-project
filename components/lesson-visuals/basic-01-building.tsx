import { VisualWrapper, type VisualProps } from "./_Wrapper";

/**
 * basic 1 · animation «Как принтер строит модель» (Модуль 1: Знакомство).
 *
 * Из описания блока: сопло движется по столу и оставляет полоску пластика; слой
 * за слоем модель растёт вверх; внутри не сплошной пластик, а решётка; каждый
 * слой ложится на предыдущий — принтер не печатает в воздухе.
 */
const LAYERS = [110, 120, 130, 140];

export function Basic01Building({ title, animated = true }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Сопло печатает верхний слой: модель растёт вверх, внутри слоя решётка"
      animated={animated}
    >
      {animated && (
        <style>{`@keyframes b1b-noz{0%{transform:translateX(0)}70%{transform:translateX(116px)}100%{transform:translateX(116px)}}@keyframes b1b-line{0%{transform:scaleX(0)}70%{transform:scaleX(1)}100%{transform:scaleX(1)}}@keyframes b1b-tick{0%{opacity:0}20%{opacity:1}92%{opacity:1}100%{opacity:0}}@keyframes b1b-prev{0%,20%{opacity:0}55%,85%{opacity:.25}100%{opacity:0}}.b1b-noz{animation:b1b-noz 3.6s ease-in-out infinite}.b1b-line{animation:b1b-line 3.6s ease-in-out infinite;transform-box:fill-box;transform-origin:left center}.b1b-tick{animation:b1b-tick 3.6s linear infinite}.b1b-prev{animation:b1b-prev 3.6s ease-in-out infinite}`}</style>
      )}
      <svg viewBox="0 0 320 180" className="h-full w-full">
        <text x="14" y="24" fontSize="8.5" fill="#cbd5e1">
          слой за слоем — модель растёт вверх
        </text>
        <line x1="64" y1="142" x2="64" y2="46" stroke="#3b82f6" />
        <path d="M60 52 L64 44 L68 52" fill="none" stroke="#3b82f6" />
        <line x1="14" y1="150" x2="306" y2="150" stroke="#475569" strokeWidth="2" />
        <text x="14" y="166" fontSize="8" fill="#94a3b8">
          Стол
        </text>

        {LAYERS.map((y, i) => (
          <g key={y}>
            <rect x="100" y={y} width="116" height="10" fill="#1e293b" stroke="#475569" />
            {[0, 1, 2, 3, 4, 5].map((k) => (
              <rect key={k} x={112 + k * 16} y={y + 3} width="2" height="4" fill="#3b82f6" />
            ))}
            {i === 0 && (
              <rect
                x="100"
                y={y}
                width="116"
                height="10"
                fill="#3b82f6"
                className={animated ? "b1b-prev" : undefined}
              />
            )}
          </g>
        ))}

        <rect
          x="100"
          y="100"
          width="116"
          height="10"
          fill="#1d4ed8"
          className={animated ? "b1b-line" : undefined}
        />
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <rect
            key={k}
            x={112 + k * 16}
            y="103"
            width="2"
            height="4"
            fill="#bfdbfe"
            className={animated ? "b1b-tick" : undefined}
            style={{ animationDelay: `${0.4 * k}s` }}
          />
        ))}

        <g transform="translate(100 0)">
          <g
            className={animated ? "b1b-noz" : undefined}
            transform={animated ? undefined : "translate(58 0)"}
          >
            <polygon points="-8,100 8,100 5,84 -5,84" fill="#64748b" />
            <rect x="-8" y="68" width="16" height="16" rx="2" fill="#334155" stroke="#475569" />
            <text x="14" y="80" fontSize="8" fill="#cbd5e1">
              сопло
            </text>
          </g>
        </g>

        <text x="228" y="96" fontSize="8" fill="#93c5fd">
          полоска пластика
        </text>
        <line x1="226" y1="93" x2="212" y2="104" stroke="#475569" />
        <path d="M220 106 L234 122" stroke="#475569" strokeDasharray="3 2" />
        <text x="222" y="134" fontSize="7.5" fill="#94a3b8">
          каждый слой
        </text>
        <text x="222" y="145" fontSize="7.5" fill="#94a3b8">
          ложится на
        </text>
        <text x="222" y="156" fontSize="7.5" fill="#94a3b8">
          предыдущий
        </text>
        <text x="14" y="172" fontSize="8" fill="#cbd5e1">
          внутри — решётка, а не сплошной пластик
        </text>
      </svg>
    </VisualWrapper>
  );
}
