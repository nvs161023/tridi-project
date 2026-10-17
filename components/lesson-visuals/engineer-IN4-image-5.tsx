import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 26 урока IN4 «Симуляция в CAD (Stress Analysis)».
 *
 * Макет из описания `IN4_cycle.png`: замкнутый цикл «расчёт → правка формы →
 * повтор», три-четыре круга до нормы. Внизу пороги запаса из блока 22:
 * меньше 2 — переделывать, 2,5 — норма, больше 4 — убирать пластик.
 */
export function EngineerIN4Image5({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Цикл усиления детали. Расчёт, правка формы и повторный расчёт: три-четыре круга до нормы, менять по одному параметру за раз. Запас меньше двух — переделывай форму, 2,5 — норма, больше четырёх — убирай лишний пластик"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <marker
            id="in4-6-arrow"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="#94a3b8" />
          </marker>
          <marker
            id="in4-6-loop"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="#38bdf8" />
          </marker>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          цикл усиления: 3–4 круга
        </text>

        {/* Три шага цикла */}
        <rect x="22" y="33" width="70" height="26" rx="6" fill="#0f172a" stroke="#f59e0b" />
        <text x="57" y="50" fontSize="10" fontWeight="700" fill="#fcd34d" textAnchor="middle">
          расчёт
        </text>
        <rect x="116" y="33" width="88" height="26" rx="6" fill="#0f172a" stroke="#3b82f6" />
        <text x="160" y="50" fontSize="10" fontWeight="700" fill="#93c5fd" textAnchor="middle">
          правка формы
        </text>
        <rect x="228" y="33" width="70" height="26" rx="6" fill="#0f172a" stroke="#10b981" />
        <text x="263" y="50" fontSize="10" fontWeight="700" fill="#6ee7b7" textAnchor="middle">
          повтор
        </text>
        <line x1="94" y1="46" x2="112" y2="46" stroke="#94a3b8" markerEnd="url(#in4-6-arrow)" />
        <line x1="208" y1="46" x2="224" y2="46" stroke="#94a3b8" markerEnd="url(#in4-6-arrow)" />

        <path
          d="M263 59 L263 68 Q263 74 257 74 L63 74 Q57 74 57 68 L57 59"
          fill="none"
          stroke="#38bdf8"
          strokeWidth="1.2"
          strokeDasharray="3 2"
          markerEnd="url(#in4-6-loop)"
        />
        <text x="160" y="88" fontSize="12" fontWeight="700" fill="#38bdf8" textAnchor="middle">
          3–4 круга
        </text>
        <text x="160" y="101" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          1 параметр за раз
        </text>

        {/* Пороги запаса */}
        <rect x="12" y="112" width="94" height="52" rx="7" fill="#0f172a" fillOpacity="0.35" stroke="#7f1d1d" />
        <text x="59" y="132" fontSize="15" fontWeight="700" fill="#f87171" textAnchor="middle">
          &lt;2
        </text>
        <text x="59" y="150" fontSize="10" fill="#fca5a5" textAnchor="middle">
          переделывай
        </text>

        <rect x="113" y="112" width="94" height="52" rx="7" fill="#0f172a" fillOpacity="0.35" stroke="#065f46" />
        <text x="160" y="132" fontSize="15" fontWeight="700" fill="#6ee7b7" textAnchor="middle">
          2,5
        </text>
        <text x="160" y="150" fontSize="10" fill="#a7f3d0" textAnchor="middle">
          норма
        </text>

        <rect x="214" y="112" width="94" height="52" rx="7" fill="#0f172a" fillOpacity="0.35" stroke="#92400e" />
        <text x="261" y="132" fontSize="15" fontWeight="700" fill="#fbbf24" textAnchor="middle">
          &gt;4
        </text>
        <text x="261" y="150" fontSize="10" fill="#fcd34d" textAnchor="middle">
          убирай пластик
        </text>

        <text x="12" y="174" fontSize="10" fill="#94a3b8">
          сравнивай запас после каждого круга
        </text>
      </svg>
    </VisualWrapper>
  );
}
