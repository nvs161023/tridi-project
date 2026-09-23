import { VisualWrapper, type VisualProps } from "./_Wrapper";

/**
 * basic 5 · animation «Почему первый слой печатают медленно» (Модуль 2).
 *
 * Из описания блока: сопло ведёт первый слой на 20–25 мм/с вместо 50–60 мм/с;
 * поток 105%, сопло на 5 °C горячее, слой 0,25 мм вместо 0,2. Медленный слой
 * ложится плотно и сплющивается, быстрый срывается и тянет соседние линии.
 */
const SLOW = [0, 1, 2, 3, 4, 5, 6, 7];
const FAST = [0, 1, 2, 3, 4, 5];

export function Basic05SlowLayer({ title, animated = true }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Медленный первый слой 20–25 мм/с против быстрого 50–60 мм/с: у быстрого зазоры и сорванная линия"
      animated={animated}
    >
      {animated && (
        <style>{`@keyframes b5s-noz{0%{transform:translateX(0)}60%{transform:translateX(128px)}100%{transform:translateX(128px)}}@keyframes b5f-noz{0%{transform:translateX(0)}30%{transform:translateX(128px)}100%{transform:translateX(128px)}}@keyframes b5-seg{0%{opacity:0}12%{opacity:1}92%{opacity:1}100%{opacity:0}}@keyframes b5-drag{0%,100%{transform:translate(0,0)}50%{transform:translate(-2px,-4px)}}.b5s-noz{animation:b5s-noz 3.2s ease-in-out infinite}.b5f-noz{animation:b5f-noz 3.2s ease-in-out infinite}.b5-seg{animation:b5-seg 3.2s linear infinite}.b5-drag{animation:b5-drag 1.6s ease-in-out infinite}`}</style>
      )}
      <svg viewBox="0 0 320 180" className="h-full w-full">
        <text x="16" y="14" fontSize="7.5" fill="#cbd5e1">
          Первый слой: поток 105% · слой 0,25 мм вместо 0,2 · сопло на 5 °C горячее
        </text>

        <line x1="16" y1="82" x2="160" y2="82" stroke="#475569" strokeWidth="2" />
        {SLOW.map((i) => (
          <rect
            key={i}
            x={24 + i * 16}
            y="72"
            width="16"
            height="7"
            rx="3.5"
            fill="#3b82f6"
            className={animated ? "b5-seg" : undefined}
            style={{ animationDelay: `${i * 0.3}s` }}
          />
        ))}
        <g transform="translate(24 0)">
          <g className={animated ? "b5s-noz" : undefined} transform={animated ? undefined : "translate(128 0)"}>
            <rect x="-8" y="44" width="16" height="16" rx="2" fill="#334155" stroke="#475569" />
            <polygon points="-8,60 8,60 5,72 -5,72" fill="#64748b" />
          </g>
        </g>

        <line x1="16" y1="162" x2="160" y2="162" stroke="#475569" strokeWidth="2" />
        {FAST.map((i) => (
          <rect
            key={i}
            x={24 + i * 22}
            y="152"
            width="14"
            height="7"
            rx="3.5"
            fill="#ef4444"
            className={i === 3 ? (animated ? "b5-drag" : undefined) : animated ? "b5-seg" : undefined}
            style={{ animationDelay: `${i * 0.12}s` }}
          />
        ))}
        <g transform="translate(24 0)">
          <g className={animated ? "b5f-noz" : undefined} transform={animated ? undefined : "translate(128 0)"}>
            <rect x="-8" y="124" width="16" height="16" rx="2" fill="#334155" stroke="#475569" />
            <polygon points="-8,140 8,140 5,152 -5,152" fill="#64748b" />
          </g>
        </g>

        <line x1="170" y1="30" x2="170" y2="168" stroke="#334155" />
        <text x="180" y="80" fontSize="10" fill="#3b82f6" fontWeight="bold">
          20–25 мм/с
        </text>
        <text x="180" y="94" fontSize="7.5" fill="#94a3b8">
          медленно: ложится
        </text>
        <text x="180" y="104" fontSize="7.5" fill="#94a3b8">
          плотно, сплющивается
        </text>
        <text x="180" y="156" fontSize="10" fill="#ef4444" fontWeight="bold">
          50–60 мм/с
        </text>
        <text x="180" y="170" fontSize="7.5" fill="#94a3b8">
          быстро: срывается,
        </text>
      </svg>
    </VisualWrapper>
  );
}
