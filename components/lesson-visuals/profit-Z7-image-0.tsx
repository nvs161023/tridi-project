import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const STATUSES = [
  {
    title: "самозанятый",
    color: "#06b6d4",
    lines: ["4 % — люди", "6 % — фирмы", "лимит 2,4 млн ₽", "без наёмных", "вычет 10 000 ₽"],
  },
  {
    title: "ИП",
    color: "#3b82f6",
    lines: ["6 % с дохода", "15 % с разницы", "лимит 300 млн ₽", "взносы + 1 %", "декларация / год"],
  },
  {
    title: "ООО",
    color: "#8b5cf6",
    lines: ["20 % с прибыли", "30 % с зарплат", "партнёры, B2B", "тендеры", "бухгалтерия"],
  },
];

/**
 * Кадр блока 5 урока Z7 «Юр. оформление, налоги, лицензии».
 *
 * Макет из описания `Z7_three_statuses.png`: три статуса, налог, лимит,
 * наёмные и тип клиента. Числа: самозанятость — 4 % с физлиц и 6 % с фирм,
 * лимит 2,4 млн ₽/год, вычет 10 000 ₽; ИП — 6 % с дохода или 15 % с разницы,
 * лимит 300 млн ₽/год и 1 % взносов свыше 300 тыс. ₽; ООО — 20 % с прибыли
 * и около 30 % страховых взносов с зарплат. Лимит ООО в уроке не назван.
 */
export function ProfitZ7Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Три статуса для мастера. Самозанятый: налог 4 процента с физлиц и 6 с фирм, лимит 2,4 миллиона рублей в год, без наёмных, вычет 10 тысяч рублей. ИП: 6 процентов с дохода или 15 с разницы, лимит 300 миллионов рублей в год, взносы плюс 1 процент свыше 300 тысяч, декларация раз в год. ООО: 20 процентов с прибыли, около 30 процентов страховых взносов с зарплат, партнёры, тендеры и B2B, постоянная бухгалтерия. Один и небольшие продажи — самозанятость, рост — ИП, партнёры и тендеры — ООО"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="11" fontWeight="700" fill="#e2e8f0">
          три статуса
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          налог · лимит · наёмные · клиенты
        </text>

        {STATUSES.map((status, index) => {
          const x = 10 + index * 102;
          return (
            <g key={status.title}>
              <rect x={x} y="34" width="96" height="94" rx="5" fill="#0f172a" stroke="#334155" />
              <rect x={x} y="34" width="96" height="3" rx="1.5" fill={status.color} />
              <text x={x + 48} y="46" fontSize="10" fontWeight="700" fill={status.color} textAnchor="middle">
                {status.title}
              </text>
              <line x1={x + 8} y1="50" x2={x + 88} y2="50" stroke="#334155" />
              {status.lines.map((line, lineIndex) => (
                <text key={line} x={x + 8} y={62 + lineIndex * 14} fontSize="10" fill="#cbd5e1">
                  {line}
                </text>
              ))}
            </g>
          );
        })}

        <rect x="10" y="132" width="300" height="44" rx="6" fill="#0f172a" stroke="#334155" />
        <text x="18" y="148" fontSize="10" fontWeight="700" fill="#e2e8f0">
          один и небольшие продажи → самозанятость
        </text>
        <text x="18" y="164" fontSize="10" fill="#cbd5e1">
          рост → ИП · партнёры, тендеры → ООО
        </text>
      </svg>
    </VisualWrapper>
  );
}
