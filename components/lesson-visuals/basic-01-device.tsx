import { VisualWrapper, type VisualProps } from "./_Wrapper";

/**
 * basic 1 · image «Устройство принтера» (Модуль 1: Знакомство).
 *
 * Из описания блока: подписаны сопло (hotend, 200–240 °C), стол (platform, на нём
 * растёт модель), катушка с пластиком, экструдер (протягивает нить), рама и ремни
 * (двигают сопло) — все шесть элементов нарисованы и подписаны, вид сбоку.
 */
export function Basic01Device({ title, animated = true }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Вид принтера сбоку: сопло, стол, катушка, экструдер, рама и ремни"
      animated={animated}
    >
      {animated && (
        <style>{`@keyframes b1d-fil{to{stroke-dashoffset:-20}}@keyframes b1d-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(2px)}}@keyframes b1d-layer{0%,100%{opacity:1}50%{opacity:.5}}.b1d-fil{animation:b1d-fil 1.6s linear infinite}.b1d-bob{animation:b1d-bob 3s ease-in-out infinite}.b1d-layer{animation:b1d-layer 2.4s ease-in-out infinite}`}</style>
      )}
      <svg viewBox="0 0 320 180" className="h-full w-full">
        <rect x="40" y="22" width="240" height="128" fill="none" stroke="#475569" strokeWidth="2" />
        <line x1="68" y1="30" x2="68" y2="144" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="5 4" />
        <line x1="252" y1="30" x2="252" y2="144" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="5 4" />

        <circle cx="76" cy="62" r="24" fill="#1e293b" stroke="#3b82f6" strokeWidth="2" />
        <circle cx="76" cy="62" r="7" fill="#334155" stroke="#64748b" />
        <path
          d="M100 58 C 118 54 128 54 138 56"
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeDasharray="6 6"
          className={animated ? "b1d-fil" : undefined}
        />

        <g className={animated ? "b1d-bob" : undefined}>
          <rect x="138" y="48" width="44" height="22" rx="3" fill="#334155" stroke="#64748b" />
          <polygon points="150,70 170,70 165,94 155,94" fill="#64748b" />
        </g>

        <rect x="60" y="104" width="202" height="7" rx="2" fill="#334155" stroke="#64748b" />
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x={196 + i}
            y={98 - i * 6}
            width={48 - i * 2}
            height="6"
            rx="1"
            fill="#1d4ed8"
            stroke="#3b82f6"
            className={i === 2 && animated ? "b1d-layer" : undefined}
          />
        ))}

        <text x="6" y="20" fontSize="8" fill="#cbd5e1">
          катушка с пластиком
        </text>
        <line x1="60" y1="24" x2="70" y2="40" stroke="#475569" />
        <text x="110" y="40" fontSize="8" fill="#cbd5e1">
          экструдер — протягивает нить
        </text>
        <text x="146" y="80" fontSize="8" fill="#cbd5e1" textAnchor="end">
          сопло (hotend)
        </text>
        <text x="146" y="93" fontSize="9" fill="#f59e0b" textAnchor="end">
          200–240 °C
        </text>
        <text x="196" y="80" fontSize="7" fill="#94a3b8">
          модель
        </text>
        <text x="66" y="126" fontSize="8" fill="#cbd5e1">
          стол (platform) — на нём растёт модель
        </text>
        <text x="46" y="144" fontSize="8" fill="#cbd5e1">
          рама
        </text>
        <text x="60" y="112" fontSize="8" fill="#cbd5e1" textAnchor="end">
          ремни
        </text>
        <line x1="62" y1="109" x2="66" y2="109" stroke="#475569" />
      </svg>
    </VisualWrapper>
  );
}
