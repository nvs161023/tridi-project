import { VisualWrapper, type VisualProps } from "./_Wrapper";

/**
 * basic 3 · animation «Как слайсер нарезает модель» (Модуль 1: Знакомство).
 *
 * Из описания блока: 3D-модель разбивается на горизонтальные слои, как хлеб;
 * каждый слой превращается в траекторию сопла; это G-код — набор команд для принтера.
 */
const CUTS = [74, 86, 98, 110, 122, 134];

export function Basic03Slicing({ title, animated = true }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Модель разбивается на горизонтальные слои, один слой превращается в траекторию сопла — G-код"
      animated={animated}
    >
      {animated && (
        <style>{`@keyframes b3s-cut{0%{opacity:0}14%{opacity:1}88%{opacity:1}100%{opacity:0}}@keyframes b3s-hl{0%,34%{opacity:0}52%,82%{opacity:.45}100%{opacity:0}}@keyframes b3s-dash{0%{stroke-dashoffset:0}100%{stroke-dashoffset:-22}}@keyframes b3s-noz{0%{transform:translate(0,0)}25%{transform:translate(88px,0)}50%{transform:translate(88px,50px)}75%{transform:translate(0,50px)}100%{transform:translate(0,0)}}.b3s-cut{animation:b3s-cut 3.2s linear infinite}.b3s-hl{animation:b3s-hl 3.2s ease-in-out infinite}.b3s-dash{animation:b3s-dash 1.2s linear infinite}.b3s-noz{animation:b3s-noz 3.2s ease-in-out infinite}`}</style>
      )}
      <svg viewBox="0 0 320 180" className="h-full w-full">
        <polygon points="26,64 40,50 128,50 114,64" fill="#2563eb" stroke="#3b82f6" />
        <polygon points="114,64 128,50 128,126 114,140" fill="#1e40af" stroke="#3b82f6" />
        <rect x="26" y="64" width="88" height="76" fill="#1d4ed8" stroke="#3b82f6" />
        {CUTS.map((y, i) => (
          <line
            key={y}
            x1="26"
            y1={y}
            x2="114"
            y2={y}
            stroke="#bfdbfe"
            strokeWidth="1"
            strokeDasharray="4 3"
            className={animated ? "b3s-cut" : undefined}
            style={{ animationDelay: `${i * 0.11}s` }}
          />
        ))}
        <rect
          x="26"
          y="98"
          width="88"
          height="12"
          fill="#f59e0b"
          className={animated ? "b3s-hl" : undefined}
          opacity={animated ? undefined : 0.45}
        />
        <path d="M118 104 L164 104 M158 100 L164 104 L158 108" fill="none" stroke="#f59e0b" strokeWidth="1.2" />

        <rect x="170" y="54" width="142" height="98" rx="4" fill="#0b1220" stroke="#475569" />
        <text x="186" y="68" fontSize="7.5" fill="#93c5fd">
          траектория сопла
        </text>
        <path
          d="M196 82 H276 Q286 82 286 92 V120 Q286 130 276 130 H196 Q186 130 186 120 V92 Q186 82 196 82"
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeDasharray="6 5"
          className={animated ? "b3s-dash" : undefined}
        />
        <g transform="translate(190 86)">
          <g
            className={animated ? "b3s-noz" : undefined}
            transform={animated ? undefined : "translate(40 24)"}
          >
            <polygon points="0,0 -4,-10 4,-10" fill="#f59e0b" />
            <rect x="-5" y="-20" width="10" height="10" rx="1" fill="#334155" stroke="#475569" />
          </g>
        </g>
        <text x="186" y="145" fontSize="9" fill="#f8fafc">
          G-код
        </text>
        <text x="214" y="145" fontSize="7" fill="#94a3b8">
          — набор команд для принтера
        </text>
        <text x="26" y="166" fontSize="7" fill="#94a3b8">
          модель → горизонтальные слои → траектория сопла
        </text>
        <line x1="26" y1="146" x2="150" y2="146" stroke="#475569" />
      </svg>
    </VisualWrapper>
  );
}
