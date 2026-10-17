import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 4 урока IN4 «Симуляция в CAD (Stress Analysis)».
 *
 * Макет из описания `IN4_idea.png`: деталь разбита на элементы, в нагруженном
 * углу элемент краснеет. Справа — увеличение одного элемента с градиентом
 * напряжения. Числа из блока 3: элементов тысячи, для миллиона нужен компьютер.
 */
export function EngineerIN4Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Идея метода конечных элементов. Слева L-деталь с треугольной сеткой, закреплением на левой стойке и силой сверху; красная зона у внутреннего угла показывает самый нагруженный элемент. Справа увеличенный элемент-кубик с градиентом напряжения и стрелками силы. Внизу: тысячи элементов, для миллиона нужен компьютер"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <pattern id="in4-0-mesh" width="7" height="7" patternUnits="userSpaceOnUse">
            <path d="M0 0 L7 7 M7 0 L0 7" stroke="#94a3b8" strokeWidth="0.4" strokeOpacity="0.5" />
          </pattern>
          <linearGradient id="in4-0-element" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#38bdf8" />
            <stop offset="0.5" stopColor="#fbbf24" />
            <stop offset="1" stopColor="#ef4444" />
          </linearGradient>
          <radialGradient id="in4-0-hot">
            <stop offset="0" stopColor="#ef4444" stopOpacity="0.9" />
            <stop offset="0.55" stopColor="#fb923c" stopOpacity="0.65" />
            <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
          </radialGradient>
          <marker
            id="in4-0-arrow"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="#f59e0b" />
          </marker>
          <clipPath id="in4-0-part">
            <polygon points="56,48 70,48 70,112 178,112 178,128 56,128" />
          </clipPath>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          МКЭ: деталь из тысяч кубиков
        </text>

        {/* Деталь с сеткой */}
        <rect x="12" y="23" width="186" height="113" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />
        <text x="22" y="38" fontSize="10" fontWeight="700" fill="#cbd5e1">
          деталь и сетка
        </text>
        <polygon points="56,48 70,48 70,112 178,112 178,128 56,128" fill="#334155" stroke="#64748b" />
        <polygon
          points="56,48 70,48 70,112 178,112 178,128 56,128"
          fill="url(#in4-0-mesh)"
          clipPath="url(#in4-0-part)"
        />
        <circle cx="71" cy="111" r="23" fill="url(#in4-0-hot)" clipPath="url(#in4-0-part)" />
        <circle cx="70" cy="111" r="4" fill="#ef4444" fillOpacity="0.9" stroke="#fecaca" strokeWidth="0.8" />

        {/* Закрепление и нагрузка */}
        <line x1="56" y1="48" x2="56" y2="128" stroke="#94a3b8" />
        {Array.from({ length: 9 }, (_, i) => (
          <line
            key={`in4-0-fixed-${i}`}
            x1="56"
            y1={50 + i * 9}
            x2="48"
            y2={44 + i * 9}
            stroke="#94a3b8"
            strokeWidth="0.9"
            strokeOpacity="0.8"
          />
        ))}
        <text transform="rotate(-90 31 92)" x="31" y="92" fontSize="10" fill="#94a3b8" textAnchor="middle">
          закрепление
        </text>
        <line x1="160" y1="80" x2="160" y2="110" stroke="#f59e0b" strokeWidth="1.4" markerEnd="url(#in4-0-arrow)" />
        <text x="132" y="76" fontSize="10" fill="#f59e0b">
          нагрузка
        </text>

        <text x="92" y="68" fontSize="10" fill="#cbd5e1">
          сетка
        </text>
        <line x1="92" y1="72" x2="106" y2="84" stroke="#64748b" strokeWidth="0.8" />
        <text x="92" y="99" fontSize="10" fontWeight="700" fill="#f87171">
          максимум
        </text>
        <line x1="90" y1="103" x2="75" y2="110" stroke="#f87171" strokeWidth="0.8" />

        {/* Увеличенный элемент */}
        <rect x="208" y="23" width="100" height="113" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />
        <text x="218" y="38" fontSize="10" fontWeight="700" fill="#cbd5e1">
          один элемент
        </text>
        <polygon points="232,62 254,52 282,62 282,88 260,99 232,88" fill="#1e293b" stroke="#64748b" />
        <polygon points="232,62 260,72 260,99 232,88" fill="url(#in4-0-element)" fillOpacity="0.85" stroke="#93c5fd" />
        <polygon points="260,72 282,62 282,88 260,99" fill="#475569" fillOpacity="0.8" stroke="#64748b" />
        <polygon points="232,62 254,52 282,62 260,72" fill="#64748b" fillOpacity="0.6" stroke="#64748b" />
        <line x1="220" y1="75" x2="231" y2="75" stroke="#f59e0b" markerEnd="url(#in4-0-arrow)" />
        <line x1="244" y1="46" x2="244" y2="55" stroke="#f59e0b" markerEnd="url(#in4-0-arrow)" />
        <text x="266" y="83" fontSize="10" fontWeight="700" fill="#fecaca" textAnchor="middle">
          σ
        </text>
        <text x="218" y="118" fontSize="10" fill="#cbd5e1">
          сила делится
        </text>

        <text x="12" y="162" fontSize="10" fill="#94a3b8">
          тысячи элементов · миллион — компьютер
        </text>
      </svg>
    </VisualWrapper>
  );
}
