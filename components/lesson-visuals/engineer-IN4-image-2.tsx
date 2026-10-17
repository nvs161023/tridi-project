import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 12 урока IN4 «Симуляция в CAD (Stress Analysis)».
 *
 * Макет из описания `IN4_loads.png`: три карточки с единицами силы, давления
 * и момента, бытовые примеры из блока 11 (литр и ведро) и перевод массы
 * в силу тяжести по правилу «кг × 10».
 */
export function EngineerIN4Image2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Типы нагрузок в CAD. Сила измеряется в ньютонах: литр около 10 ньютонов, ведро около 100. Давление — в мегапаскалях, момент — в ньютон-метрах. Масса переводится в вес умножением на 10: один килограмм около 10 ньютонов"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <marker
            id="in4-2-arrow"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="#f59e0b" />
          </marker>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          нагрузки: единицы и примеры
        </text>

        {/* Сила */}
        <rect x="12" y="23" width="96" height="64" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />
        <text x="20" y="38" fontSize="10" fontWeight="700" fill="#cbd5e1">
          сила
        </text>
        <text x="88" y="54" fontSize="12" fontWeight="700" fill="#f59e0b" textAnchor="end">
          Н
        </text>
        <line x1="68" y1="48" x2="68" y2="59" stroke="#f59e0b" markerEnd="url(#in4-2-arrow)" />
        <text x="20" y="65" fontSize="10" fill="#e2e8f0">
          1 л ≈ 10 Н
        </text>
        <text x="20" y="79" fontSize="10" fill="#94a3b8">
          ведро ≈ 100 Н
        </text>

        {/* Давление */}
        <rect x="112" y="23" width="96" height="64" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />
        <text x="120" y="38" fontSize="10" fontWeight="700" fill="#cbd5e1">
          давление
        </text>
        <text x="188" y="54" fontSize="12" fontWeight="700" fill="#38bdf8" textAnchor="end">
          МПа
        </text>
        <path d="M136 46 L136 58 L150 58" fill="none" stroke="#38bdf8" strokeWidth="1.2" />
        {Array.from({ length: 4 }, (_, i) => (
          <line
            key={`in4-2-pressure-${i}`}
            x1="139"
            y1={46 + i * 4}
            x2="147"
            y2={46 + i * 4}
            stroke="#38bdf8"
            strokeWidth="0.8"
          />
        ))}
        <text x="120" y="74" fontSize="10" fill="#94a3b8">
          жидкость и газ
        </text>

        {/* Момент */}
        <rect x="212" y="23" width="96" height="64" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />
        <text x="220" y="38" fontSize="10" fontWeight="700" fill="#cbd5e1">
          момент
        </text>
        <text x="288" y="54" fontSize="12" fontWeight="700" fill="#a78bfa" textAnchor="end">
          Н·м
        </text>
        <path d="M250 58 A 12 12 0 1 1 264 48" fill="none" stroke="#a78bfa" strokeWidth="1.2" markerEnd="url(#in4-2-arrow)" />
        <text x="220" y="74" fontSize="10" fill="#94a3b8">
          рычаг и вал
        </text>

        {/* Масса → сила тяжести */}
        <rect x="12" y="95" width="296" height="49" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />
        <text x="22" y="115" fontSize="12" fontWeight="700" fill="#fcd34d">
          кг × 10 = Н
        </text>
        <rect x="248" y="103" width="26" height="24" rx="3" fill="#334155" stroke="#64748b" />
        <text x="261" y="119" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          1 кг
        </text>
        <line x1="261" y1="128" x2="261" y2="138" stroke="#f59e0b" markerEnd="url(#in4-2-arrow)" />
        <text x="270" y="139" fontSize="10" fill="#f59e0b">
          10 Н
        </text>

        <text x="12" y="163" fontSize="10" fill="#94a3b8">
          сила, давление, момент — ставятся по-своему
        </text>
      </svg>
    </VisualWrapper>
  );
}
