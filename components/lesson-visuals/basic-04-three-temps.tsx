import { VisualWrapper, type VisualProps } from "./_Wrapper";

/**
 * basic 4 · animation «Что происходит при разной температуре» (Модуль 2).
 *
 * Из описания блока: 180 °C — пластик густой, слои с щелями; 210 °C — ровная
 * лента, слои склеены; 240 °C — жидкий, растекается, тянет нити.
 */
export function Basic04ThreeTemps({ title, animated = true }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Три сопла: при 180 °C пластик с щелями, при 210 °C ровная лента, при 240 °C растекается и тянет нити"
      animated={animated}
    >
      {animated && (
        <style>{`@keyframes t4-gap{0%,100%{opacity:.35}50%{opacity:1}}@keyframes t4-fill{0%{transform:scaleX(0)}60%{transform:scaleX(1)}100%{transform:scaleX(1)}}@keyframes t4-spread{0%{transform:scaleX(.6)}100%{transform:scaleX(1.2)}}@keyframes t4-thin{0%,100%{opacity:.4}50%{opacity:1}}.t4-gap{animation:t4-gap 2.4s ease-in-out infinite}.t4-fill{animation:t4-fill 3s ease-out infinite;transform-box:fill-box;transform-origin:left center}.t4-spread{animation:t4-spread 3s ease-in-out infinite alternate;transform-box:fill-box;transform-origin:center}.t4-thin{animation:t4-thin 2s ease-in-out infinite}`}</style>
      )}
      <svg viewBox="0 0 320 180" className="h-full w-full">
        <text x="16" y="14" fontSize="8" fill="#94a3b8">
          Три сопла — три результата
        </text>
        <text x="60" y="30" fontSize="12" fill="#f59e0b" textAnchor="middle" fontWeight="bold">
          180 °C
        </text>
        <text x="160" y="30" fontSize="12" fill="#3b82f6" textAnchor="middle" fontWeight="bold">
          210 °C
        </text>
        <text x="260" y="30" fontSize="12" fill="#ef4444" textAnchor="middle" fontWeight="bold">
          240 °C
        </text>

        {[60, 160, 260].map((x) => (
          <g key={x}>
            <rect x={x - 13} y="38" width="26" height="12" rx="2" fill="#334155" stroke="#475569" />
            <polygon points={`${x - 7},50 ${x + 7},50 ${x + 4},66 ${x - 4},66`} fill="#64748b" />
          </g>
        ))}

        <line
          x1="30"
          y1="88"
          x2="90"
          y2="88"
          stroke="#f59e0b"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray="9 7"
          className={animated ? "t4-gap" : undefined}
        />
        <line
          x1="130"
          y1="88"
          x2="190"
          y2="88"
          stroke="#3b82f6"
          strokeWidth="5"
          strokeLinecap="round"
          className={animated ? "t4-fill" : undefined}
        />
        <ellipse
          cx="260"
          cy="88"
          rx="26"
          ry="8"
          fill="#ef4444"
          className={animated ? "t4-spread" : undefined}
        />
        <path
          d="M240 84 C 236 74 242 68 246 62"
          fill="none"
          stroke="#ef4444"
          strokeWidth="1.4"
          className={animated ? "t4-thin" : undefined}
        />
        <path
          d="M280 84 C 284 74 278 68 274 62"
          fill="none"
          stroke="#ef4444"
          strokeWidth="1.4"
          className={animated ? "t4-thin" : undefined}
          style={{ animationDelay: "0.4s" }}
        />

        <line x1="16" y1="92" x2="304" y2="92" stroke="#475569" strokeWidth="2" />
        <text x="16" y="106" fontSize="8" fill="#94a3b8">
          Стол
        </text>
        <text x="60" y="122" fontSize="7.5" fill="#fcd34d" textAnchor="middle">
          пластик густой,
        </text>
        <text x="60" y="132" fontSize="7.5" fill="#fcd34d" textAnchor="middle">
          слои с щелями
        </text>
        <text x="160" y="122" fontSize="7.5" fill="#93c5fd" textAnchor="middle">
          ровная лента,
        </text>
        <text x="160" y="132" fontSize="7.5" fill="#93c5fd" textAnchor="middle">
          слои склеены
        </text>
        <text x="260" y="122" fontSize="7.5" fill="#fca5a5" textAnchor="middle">
          жидкий, растекается,
        </text>
        <text x="260" y="132" fontSize="7.5" fill="#fca5a5" textAnchor="middle">
          тянет нити
        </text>
      </svg>
    </VisualWrapper>
  );
}
