import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 14 урока IN4 «Симуляция в CAD (Stress Analysis)».
 *
 * Макет из описания `IN4_simplify.png`: слева деталь с фаской 0,3 мм, резьбой
 * и надписями, которые не влияют на прочность; справа галтель R3 и отверстия
 * под болты, которые трогать нельзя.
 */
export function EngineerIN4Image3({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Упрощение модели. Слева убираем фаску 0,3 мм, резьбу и надписи: они не влияют на прочность. Справа оставляем галтель R3 и отверстия под болты: галтель снимает пик напряжений"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <marker
            id="in4-3-arrow"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="#94a3b8" />
          </marker>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          упрощение: что убрать и что оставить
        </text>

        {/* Убрать */}
        <rect x="12" y="23" width="145" height="113" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />
        <text x="22" y="38" fontSize="10" fontWeight="700" fill="#f87171">
          убрать
        </text>
        <polygon points="28,52 104,52 116,64 116,104 28,104" fill="#334155" stroke="#64748b" />
        <line x1="104" y1="52" x2="116" y2="64" stroke="#f87171" strokeWidth="1.4" />
        {Array.from({ length: 3 }, (_, i) => (
          <path
            key={`in4-3-thread-${i}`}
            d={`M34 ${88 + i * 4} q 5 -3 10 0 q 5 3 10 0`}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="0.9"
          />
        ))}
        <line x1="74" y1="60" x2="94" y2="60" stroke="#94a3b8" strokeWidth="0.8" />
        <line x1="74" y1="64" x2="87" y2="64" stroke="#94a3b8" strokeWidth="0.8" />
        <text x="72" y="116" fontSize="10" fill="#f87171">
          фаска 0,3 мм
        </text>
        <text x="22" y="131" fontSize="10" fill="#cbd5e1">
          резьба · текст
        </text>
        <line x1="44" y1="119" x2="44" y2="98" stroke="#64748b" strokeWidth="0.8" markerEnd="url(#in4-3-arrow)" />
        <text x="96" y="131" fontSize="10" fill="#94a3b8">
          не влияет
        </text>

        {/* Оставить */}
        <rect x="165" y="23" width="143" height="113" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />
        <text x="175" y="38" fontSize="10" fontWeight="700" fill="#10b981">
          оставить
        </text>
        <path
          d="M176 52 L212 52 L212 84 Q212 92 220 92 L266 92 L266 104 L176 104 Z"
          fill="#334155"
          stroke="#64748b"
        />
        <path d="M212 84 Q212 92 220 92" fill="none" stroke="#10b981" strokeWidth="1.8" />
        <circle cx="194" cy="72" r="5" fill="#0f172a" stroke="#94a3b8" />
        <circle cx="244" cy="98" r="4.5" fill="#0f172a" stroke="#94a3b8" />
        <text x="216" y="116" fontSize="10" fill="#6ee7b7">
          галтель R3
        </text>
        <text x="176" y="131" fontSize="10" fill="#cbd5e1">
          отверстия
        </text>
        <line x1="244" y1="118" x2="244" y2="103" stroke="#64748b" strokeWidth="0.8" markerEnd="url(#in4-3-arrow)" />
        <text x="238" y="131" fontSize="10" fill="#94a3b8">
          снимает пик
        </text>

        <text x="12" y="160" fontSize="10" fill="#cbd5e1">
          резьбу и мелочь убираем · галтели оставляем
        </text>
      </svg>
    </VisualWrapper>
  );
}
