import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const BATCHES = [
  { batch: "5", check: "все" },
  { batch: "20", check: "3" },
  { batch: "100", check: "10" },
];

const OUTCOMES = [
  { label: "0 брака", detail: "к клиенту", color: "#10b981" },
  { label: "1 брак", detail: "вся партия", color: "#f59e0b" },
  { label: "больше", detail: "перепечатка", color: "#f87171" },
];

/**
 * Кадр блока 17 урока Z4 «Серия: повторяемость, QC, допуски».
 *
 * Макет из описания `Z4_sampling.png`: выборка 10 % и решение по её итогам.
 * Примеры 5 → все, 20 → 3, 100 → 10 и минимум три детали взяты из блока 15.
 * Три исхода из блока 20: ноль брака, один брак и брака больше. Время
 * проверки не выношу: в блоке 23 встречаются и 20, и 15 минут.
 */
export function ProfitZ4Image3({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Выборка десять процентов, но не меньше трёх деталей: из пяти проверяют все, из двадцати три, из ста десять. Если брака нет, партия идёт клиенту. Один брак — проверять всю партию. Если брака больше — перепечатка"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#e2e8f0">
          выборка и решение
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          10 % партии · минимум 3 детали
        </text>

        <rect x="12" y="38" width="138" height="122" rx="7" fill="#0f172a" stroke="#334155" />
        <text x="20" y="47" fontSize="10" fill="#94a3b8">
          выборка
        </text>
        <text x="20" y="78" fontSize="24" fontWeight="700" fill="#60a5fa">
          10 %
        </text>
        <text x="20" y="99" fontSize="10" fill="#e2e8f0">
          минимум 3 детали
        </text>
        <path d="M20 106 H142" stroke="#334155" strokeWidth="0.8" />
        <text x="20" y="116" fontSize="10" fill="#94a3b8">
          партия → проверка
        </text>
        {BATCHES.map((item, index) => (
          <text key={item.batch} x="20" y={130 + index * 14} fontSize="10" fill="#cbd5e1">
            {item.batch} → {item.check}
          </text>
        ))}

        <rect x="158" y="38" width="150" height="122" rx="7" fill="#0f172a" stroke="#334155" />
        {OUTCOMES.map((outcome, index) => {
          const y = 44 + index * 34;
          return (
            <g key={outcome.label}>
              <rect x="166" y={y} width="134" height="30" rx="5" fill={outcome.color} fillOpacity="0.08" stroke={outcome.color} strokeOpacity="0.35" />
              <rect x="166" y={y} width="3" height="30" rx="1.5" fill={outcome.color} />
              <text x="176" y={y + 11} fontSize="10" fontWeight="700" fill={outcome.color}>
                {outcome.label}
              </text>
              <text x="176" y={y + 24} fontSize="10" fill="#e2e8f0">
                {outcome.detail}
              </text>
            </g>
          );
        })}

        <text x="160" y="171" fontSize="10" fill="#94a3b8" textAnchor="middle">
          выборка из разных мест партии
        </text>
      </svg>
    </VisualWrapper>
  );
}
