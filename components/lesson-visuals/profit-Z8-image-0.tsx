import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const STEPS = [
  { n: "1", label: "критерии", color: "#06b6d4" },
  { n: "2", label: "расчёт", color: "#3b82f6" },
  { n: "3", label: "партия", color: "#8b5cf6" },
  { n: "4", label: "каналы", color: "#f59e0b" },
  { n: "5", label: "продажа", color: "#10b981" },
  { n: "6", label: "метрики", color: "#ec4899" },
  { n: "7", label: "масштаб", color: "#f97316" },
];

/**
 * Кадр блока 5 урока Z8 «Финальный проект: свой продукт».
 *
 * `Z8_product_criteria.png`: весь проект из семи шагов — критерии, расчёт,
 * тестовая партия, каналы, первая продажа, метрики недели и масштаб.
 * Подпись внизу: семь уроков складываются в один продукт, а чек-лист
 * состоит из восьми пунктов.
 */
export function ProfitZ8Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Проект целиком из семи шагов: критерии выбора продукта, расчёт партии, тестовая партия, каналы продаж, первая продажа, метрики недели и масштабирование. Семь уроков складываются в один продукт, чек-лист состоит из восьми пунктов"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="11" fontWeight="700" fill="#e2e8f0">
          проект целиком
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          7 шагов: от критериев до масштаба
        </text>
        <rect x="266" y="5" width="44" height="14" rx="7" fill="#06b6d4" fillOpacity="0.15" stroke="#06b6d4" strokeOpacity="0.5" />
        <text x="288" y="15" fontSize="10" fontWeight="700" fill="#22d3ee" textAnchor="middle">
          7 шагов
        </text>

        {STEPS.slice(0, 4).map((step, index) => {
          const x = 10 + index * 72;
          return (
            <g key={step.n}>
              <rect x={x} y="40" width="72" height="34" rx="5" fill="#0f172a" stroke="#334155" />
              <rect x={x} y="40" width="72" height="3" rx="1.5" fill={step.color} />
              <circle cx={x + 12} cy="58" r="6" fill={step.color} fillOpacity="0.2" stroke={step.color} strokeOpacity="0.7" />
              <text x={x + 12} y="62" fontSize="10" fontWeight="700" fill={step.color} textAnchor="middle">
                {step.n}
              </text>
              <text x={x + 23} y="62" fontSize="10" fontWeight="700" fill="#e2e8f0">
                {step.label}
              </text>
              {index < 3 && <line x1={x + 72} y1="57" x2={x + 80} y2="57" stroke="#64748b" />}
            </g>
          );
        })}

        <path d="M298 76 V84 H57 V92" fill="none" stroke="#475569" strokeWidth="1.5" />
        <path d="M53 89 L57 95 L61 89 Z" fill="#64748b" />

        {STEPS.slice(4).map((step, index) => {
          const x = 10 + index * 103;
          return (
            <g key={step.n}>
              <rect x={x} y="96" width="94" height="34" rx="5" fill="#0f172a" stroke="#334155" />
              <rect x={x} y="96" width="94" height="3" rx="1.5" fill={step.color} />
              <circle cx={x + 15} cy="114" r="6" fill={step.color} fillOpacity="0.2" stroke={step.color} strokeOpacity="0.7" />
              <text x={x + 15} y="118" fontSize="10" fontWeight="700" fill={step.color} textAnchor="middle">
                {step.n}
              </text>
              <text x={x + 27} y="118" fontSize="10" fontWeight="700" fill="#e2e8f0">
                {step.label}
              </text>
              {index < 2 && <line x1={x + 94} y1="113" x2={x + 103} y2="113" stroke="#64748b" />}
            </g>
          );
        })}

        <rect x="10" y="138" width="300" height="34" rx="5" fill="#0f172a" stroke="#334155" />
        <text x="18" y="153" fontSize="10" fontWeight="700" fill="#cbd5e1">
          7 уроков → 1 продукт · 8 пунктов чек-листа
        </text>
        <text x="18" y="167" fontSize="10" fill="#94a3b8">
          критерии → расчёт → партия → продажа → масштаб
        </text>
      </svg>
    </VisualWrapper>
  );
}
