import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const FIRST = [
  { n: "1", label: "запрос", color: "#06b6d4" },
  { n: "2", label: "предложение", color: "#3b82f6" },
  { n: "3", label: "оплата", color: "#8b5cf6" },
  { n: "4", label: "сборка", color: "#f59e0b" },
];

const SECOND = [
  { n: "5", label: "отправка", color: "#10b981" },
  { n: "6", label: "чек", color: "#ec4899" },
  { n: "7", label: "отзыв", color: "#f97316" },
];

/**
 * Кадр блока 24 урока Z8 «Финальный проект: свой продукт».
 *
 * `Z8_order_path.png`: семь шагов заказа — запрос, предложение, оплата, сборка,
 * отправка, чек и отзыв. Половина сделки решается на первом шаге: ответ через
 * сутки теряет заказ. Если клиент пропал — одно напоминание через два дня и не
 * больше трёх сообщений. После десяти заказов процесс становится ровным.
 */
export function ProfitZ8Image4({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Путь заказа из семи шагов: запрос, предложение, оплата, сборка, отправка, чек и отзыв. Половина сделки решается на первом шаге, а ответ через сутки теряет заказ. Если клиент пропал — одно напоминание через два дня, не больше трёх сообщений. После десяти заказов процесс становится ровным"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="11" fontWeight="700" fill="#e2e8f0">
          путь заказа
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          от запроса до отзыва · каждый шаг можно улучшить
        </text>
        <rect x="266" y="5" width="44" height="14" rx="7" fill="#22d3ee" fillOpacity="0.15" stroke="#22d3ee" strokeOpacity="0.5" />
        <text x="288" y="15" fontSize="10" fontWeight="700" fill="#22d3ee" textAnchor="middle">
          7 шагов
        </text>

        {FIRST.map((step, index) => {
          const x = 10 + index * 76;
          return (
            <g key={step.n}>
              <rect x={x} y="38" width="70" height="40" rx="5" fill="#0f172a" stroke="#334155" />
              <rect x={x} y="38" width="70" height="3" rx="1.5" fill={step.color} />
              <circle cx={x + 35} cy="52" r="6" fill={step.color} fillOpacity="0.2" stroke={step.color} strokeOpacity="0.7" />
              <text x={x + 35} y="56" fontSize="10" fontWeight="700" fill={step.color} textAnchor="middle">
                {step.n}
              </text>
              <text x={x + 35} y="70" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
                {step.label}
              </text>
              {index < 3 && (
                <path d={`M${x + 71} 58 h4`} stroke="#64748b" strokeWidth="1.5" />
              )}
            </g>
          );
        })}

        <path d="M291 80 V84 H59 V91" fill="none" stroke="#475569" strokeWidth="1.5" />
        <path d="M55 87 L59 93 L63 87 Z" fill="#64748b" />

        {SECOND.map((step, index) => {
          const x = 10 + index * 103;
          return (
            <g key={step.n}>
              <rect x={x} y="93" width="94" height="34" rx="5" fill="#0f172a" stroke="#334155" />
              <rect x={x} y="93" width="94" height="3" rx="1.5" fill={step.color} />
              <circle cx={x + 16} cy="110" r="6" fill={step.color} fillOpacity="0.2" stroke={step.color} strokeOpacity="0.7" />
              <text x={x + 16} y="114" fontSize="10" fontWeight="700" fill={step.color} textAnchor="middle">
                {step.n}
              </text>
              <text x={x + 28} y="114" fontSize="10" fontWeight="700" fill="#e2e8f0">
                {step.label}
              </text>
              {index < 2 && (
                <path d={`M${x + 95} 110 h4`} stroke="#64748b" strokeWidth="1.5" />
              )}
            </g>
          );
        })}

        <rect x="10" y="133" width="300" height="16" rx="4" fill="#f87171" fillOpacity="0.12" stroke="#f87171" strokeOpacity="0.5" />
        <text x="18" y="144" fontSize="10" fontWeight="700" fill="#fca5a5">
          ответ через сутки → половина сделки потеряна
        </text>

        <rect x="10" y="153" width="300" height="19" rx="4" fill="#0f172a" stroke="#334155" />
        <text x="18" y="166" fontSize="10" fill="#cbd5e1">
          напомнить 1 раз через 2 дня · не больше 3 сообщений
        </text>
      </svg>
    </VisualWrapper>
  );
}
