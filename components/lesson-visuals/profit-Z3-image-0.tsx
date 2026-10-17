import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const TOP = [
  { n: 1, label: "сообщение", x: 14, color: "#3b82f6" },
  { n: 2, label: "вопросы", x: 89, color: "#3b82f6" },
  { n: 3, label: "бриф", x: 164, color: "#3b82f6" },
  { n: 4, label: "ТЗ", x: 239, color: "#3b82f6" },
];

const BOTTOM = [
  { n: 8, label: "отзыв", x: 14, color: "#10b981" },
  { n: 7, label: "сдача", x: 89, color: "#f59e0b" },
  { n: 6, label: "печать", x: 164, color: "#f59e0b" },
  { n: 5, label: "предоплата", x: 239, color: "#3b82f6" },
];

/**
 * Кадр блока 5 урока Z3 «Клиенты: бриф, ТЗ, споры».
 *
 * Макет из описания `Z3_order_path.png`: восемь шагов от первого сообщения
 * до отзыва. Верхний ряд идёт слева направо, нижний — справа налево, поэтому
 * маршрут читается как буква U. Цвета показывают этапы: синий — до печати,
 * янтарный — печать и сдача, зелёный — отзыв. Отдельных чисел, кроме
 * нумерации шагов, в кадре нет: в уроке их нет.
 */
export function ProfitZ3Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Путь заказа из восьми шагов: сообщение, вопросы, бриф, техническое задание, предоплата, печать, сдача и отзыв. Первые пять шагов идут до печати, затем печать и сдача, последний шаг — отзыв"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#e2e8f0">
          путь заказа: от сообщения до отзыва
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          восемь шагов · сначала бриф, потом работа
        </text>

        {[...TOP, ...BOTTOM].map((step) => (
          <g key={step.n}>
            <rect x={step.x} y={step.n <= 4 ? 38 : 94} width="66" height="40" rx="5" fill="#0f172a" stroke="#334155" />
            <rect x={step.x} y={step.n <= 4 ? 38 : 94} width="66" height="3" rx="1.5" fill={step.color} />
            <circle cx={step.x + 12} cy={(step.n <= 4 ? 38 : 94) + 14} r="6" fill={step.color} fillOpacity="0.18" stroke={step.color} />
            <text x={step.x + 12} y={(step.n <= 4 ? 38 : 94) + 17.5} fontSize="10" fontWeight="700" fill={step.color} textAnchor="middle">
              {step.n}
            </text>
            <text x={step.x + 33} y={(step.n <= 4 ? 38 : 94) + 34} fontSize="10" fill="#e2e8f0" textAnchor="middle">
              {step.label}
            </text>
          </g>
        ))}

        <path d="M82 54 L87 58 L82 62" fill="none" stroke="#64748b" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M157 54 L162 58 L157 62" fill="none" stroke="#64748b" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M232 54 L237 58 L232 62" fill="none" stroke="#64748b" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />

        <path d="M272 79 V88" stroke="#64748b" strokeWidth="1.3" />
        <path d="M272 94 L268 87 L276 87 Z" fill="#64748b" />

        <path d="M89 110 L84 114 L89 118" fill="none" stroke="#64748b" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M164 110 L159 114 L164 118" fill="none" stroke="#64748b" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M239 110 L234 114 L239 118" fill="none" stroke="#64748b" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />

        <text x="160" y="146" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          1–5 — до печати · 6–7 — работа · 8 — после
        </text>
        <text x="160" y="161" fontSize="10" fill="#94a3b8" textAnchor="middle">
          отзыв просят в момент получения
        </text>
      </svg>
    </VisualWrapper>
  );
}
