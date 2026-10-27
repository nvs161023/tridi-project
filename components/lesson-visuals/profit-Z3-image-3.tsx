import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const STEPS = [
  {
    percent: "50 %",
    amount: "первый заказ",
    label: "новый клиент",
    x: 12,
    y: 58,
    height: 76,
    color: "#10b981",
    textY: 76,
  },
  {
    percent: "30–50 %",
    amount: "риск и сумма",
    label: "обычный заказ",
    x: 112,
    y: 78,
    height: 56,
    color: "#f59e0b",
    textY: 96,
  },
  {
    percent: "30 %",
    amount: "",
    label: "партия",
    x: 212,
    y: 90,
    height: 44,
    color: "#3b82f6",
    textY: 108,
  },
];

/**
 * Кадр блока 17 урока Z3 «Клиенты: бриф, ТЗ, споры».
 *
 * Макет из описания `Z3_prepay_ladder.png`: доля предоплаты зависит от суммы
 * и риска. В уроке: обычный заказ — 30–50 %, новый клиент — 50 %, партия — 30 %,
 * срочный заказ вне очереди — 50 %. Ступени падают вместе с долей: 50, 30–50 и 30 %.
 */
export function ProfitZ3Image3({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Лестница предоплаты: новый клиент — пятьдесят процентов, обычный заказ — от тридцати до пятидесяти процентов, партия — тридцать процентов. Срочный заказ вне очереди — тоже пятьдесят процентов"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#e2e8f0">
          лестница предоплаты
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          доля зависит от суммы и риска
        </text>

        <text x="12" y="44" fontSize="10" fill="#fcd34d">
          срочно вне очереди — 50 %
        </text>
        <text x="308" y="44" fontSize="10" fill="#94a3b8" textAnchor="end">
          риск растёт →
        </text>

        {STEPS.map((step) => (
          <g key={step.percent}>
            <rect x={step.x} y={step.y} width="88" height={step.height} rx="6" fill="#0f172a" fillOpacity="0.7" stroke="#334155" />
            <rect x={step.x} y={step.y} width="88" height="4" rx="2" fill={step.color} />
            <text x={step.x + 44} y={step.textY} fontSize="18" fontWeight="700" fill={step.color} textAnchor="middle">
              {step.percent}
            </text>
            <text x={step.x + 44} y={step.textY + 16} fontSize="10" fill="#e2e8f0" textAnchor="middle">
              {step.label}
            </text>
            {step.amount ? (
              <text x={step.x + 44} y={step.textY + 31} fontSize="10" fill="#cbd5e1" textAnchor="middle">
                {step.amount}
              </text>
            ) : null}
          </g>
        ))}

        <path d="M12 134 H300" stroke="#334155" strokeWidth="0.8" />
        <text x="160" y="148" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          предоплата покрывает расходники
        </text>
        <text x="160" y="162" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          остаток — при получении
        </text>
      </svg>
    </VisualWrapper>
  );
}
