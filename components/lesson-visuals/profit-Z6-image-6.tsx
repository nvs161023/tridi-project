import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const CLAIM_STEPS = [
  { number: "1", title: "фото", line1: "деталь", line2: "коробка", color: "#3b82f6" },
  { number: "2", title: "заявление", line1: "розыск", line2: "по треку", color: "#06b6d4" },
  { number: "3", title: "30 дней", line1: "срок", line2: "розыска", color: "#f59e0b" },
  { number: "4", title: "акт", line1: "в ПВЗ", line2: "до подписи", color: "#8b5cf6" },
  { number: "5", title: "отправка", line1: "повторная", line2: "посылка", color: "#10b981" },
];

/**
 * Кадр блока 32 урока Z6 «Упаковка, логистика, отправка».
 *
 * Макет из описания `Z6_claim_path.png`: фото повреждений, заявление на
 * розыск по треку, срок розыска 30 дней, акт в пункте выдачи до подписи,
 * повторная отправка. Ценность детали 750 ₽, потери около 1 % — одна
 * посылка на сто, два повреждения подряд означают, что пора менять тару.
 */
export function ProfitZ6Image6({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Путь претензии: сфотографировать деталь и коробку, подать заявление на розыск по треку, ждать до 30 дней, оформить акт в пункте выдачи до подписи, получить повторную отправку. Ценность детали 750 рублей, потери около 1 процента — одна посылка на сто, два повреждения подряд означают, что пора менять тару"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="10" y="15" fontSize="11" fontWeight="700" fill="#e2e8f0">
          если посылка потерялась
        </text>
        <text x="10" y="29" fontSize="10" fill="#94a3b8">
          путь претензии — без паники
        </text>

        <line x1="30" y1="50" x2="290" y2="50" stroke="#475569" strokeWidth="1.5" />
        {CLAIM_STEPS.map((step, index) => {
          const center = 30 + index * 65;
          return (
            <g key={step.number}>
              <circle cx={center} cy="50" r="9.5" fill="#0f172a" stroke={step.color} strokeWidth="1.5" />
              <text x={center} y="53.5" fontSize="10" fontWeight="700" fill={step.color} textAnchor="middle">
                {step.number}
              </text>
              <text x={center} y="75" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
                {step.title}
              </text>
              <text x={center} y="89" fontSize="10" fill="#cbd5e1" textAnchor="middle">
                {step.line1}
              </text>
              <text x={center} y="102" fontSize="10" fill="#94a3b8" textAnchor="middle">
                {step.line2}
              </text>
            </g>
          );
        })}

        <rect x="10" y="114" width="96" height="58" rx="5" fill="#0f172a" stroke="#f59e0b" strokeOpacity="0.55" />
        <text x="58" y="132" fontSize="14" fontWeight="700" fill="#fbbf24" textAnchor="middle">
          750 ₽
        </text>
        <text x="58" y="147" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          ценность
        </text>
        <text x="58" y="161" fontSize="10" fill="#94a3b8" textAnchor="middle">
          полная цена
        </text>

        <rect x="112" y="114" width="96" height="58" rx="5" fill="#0f172a" stroke="#3b82f6" strokeOpacity="0.55" />
        <text x="160" y="132" fontSize="14" fontWeight="700" fill="#60a5fa" textAnchor="middle">
          1 %
        </text>
        <text x="160" y="147" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          потери
        </text>
        <text x="160" y="161" fontSize="10" fill="#94a3b8" textAnchor="middle">
          1 на 100 посылок
        </text>

        <rect x="214" y="114" width="96" height="58" rx="5" fill="#0f172a" stroke="#f472b6" strokeOpacity="0.55" />
        <text x="262" y="132" fontSize="14" fontWeight="700" fill="#f9a8d4" textAnchor="middle">
          2
        </text>
        <text x="262" y="147" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          повреждения
        </text>
        <text x="262" y="161" fontSize="10" fill="#94a3b8" textAnchor="middle">
          меняй тару
        </text>
      </svg>
    </VisualWrapper>
  );
}
