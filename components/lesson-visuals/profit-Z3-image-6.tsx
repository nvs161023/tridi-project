import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const NODES = [
  { label: "заказ", x: 28, y: 42, color: "#3b82f6" },
  { label: "отзыв", x: 212, y: 42, color: "#10b981" },
  { label: "повтор", x: 212, y: 102, color: "#f59e0b" },
  { label: "рекомендация", x: 28, y: 102, color: "#a78bfa" },
];

/**
 * Кадр блока 32 урока Z3 «Клиенты: бриф, ТЗ, споры».
 *
 * Макет из описания `Z3_repeat_loop.png`: замкнутый цикл заказ → отзыв →
 * повтор → рекомендация. Сроки и бонусы из блоков 28–31: отзыв в момент
 * получения, повтор через неделю, напоминание раз в 2–3 месяца, минус 10 %
 * постоянным, пятая деталь в подарок, пятнадцать процентов за приведённого
 * друга.
 */
export function ProfitZ3Image6({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Клиент возвращается: цикл заказ, отзыв, повтор и рекомендация. Отзыв просят в момент получения, повтор — через неделю, напоминание — раз в два-три месяца. Постоянным скидка десять процентов, пятая деталь в подарок, за приведённого друга — пятнадцать процентов"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <marker id="z3-6-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0 0 L6 3 L0 6 Z" fill="#64748b" />
          </marker>
        </defs>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#e2e8f0">
          клиент возвращается
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          цикл: заказ → отзыв → повтор → рекомендация
        </text>

        <text x="160" y="82" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          клиент
        </text>
        <text x="160" y="96" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          возвращается
        </text>

        {NODES.map((node) => (
          <g key={node.label}>
            <rect x={node.x} y={node.y} width="80" height="24" rx="6" fill="#0f172a" stroke="#334155" />
            <rect x={node.x} y={node.y} width="3" height="24" rx="1.5" fill={node.color} />
            <text x={node.x + 41.5} y={node.y + 16} fontSize="10" fill="#e2e8f0" textAnchor="middle">
              {node.label}
            </text>
          </g>
        ))}

        <path d="M110 54 H206" stroke="#64748b" strokeWidth="1.2" markerEnd="url(#z3-6-arrow)" />
        <path d="M252 68 V96" stroke="#64748b" strokeWidth="1.2" markerEnd="url(#z3-6-arrow)" />
        <path d="M210 114 H114" stroke="#64748b" strokeWidth="1.2" markerEnd="url(#z3-6-arrow)" />
        <path d="M68 100 V72" stroke="#64748b" strokeWidth="1.2" markerEnd="url(#z3-6-arrow)" />

        <text x="160" y="143" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          отзыв — в момент получения · повтор — через неделю
        </text>
        <text x="160" y="157" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          напоминание — раз в 2–3 месяца · −10 % постоянным
        </text>
        <text x="160" y="171" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          5-я деталь в подарок · привёл друга — 15 %
        </text>
      </svg>
    </VisualWrapper>
  );
}
