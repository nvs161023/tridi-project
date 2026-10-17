import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const STEPS = [
  { number: "1", label: "счёт — реквизиты", color: "#3b82f6" },
  { number: "2", label: "изготовление — партия", color: "#06b6d4" },
  { number: "3", label: "накладная / УПД ×2", color: "#f59e0b" },
  { number: "4", label: "акт — подпись, штамп", color: "#8b5cf6" },
  { number: "5", label: "оплата — 5–30 дней", color: "#10b981" },
];

const PAPERS = [
  "накладная / УПД ×2",
  "счёт с реквизитами",
  "акт выполненных работ",
  "чек самозанятого",
  "доверенность получателя",
  "подпись и штамп",
];

/**
 * Кадр блока 29 урока Z6 «Упаковка, логистика, отправка».
 *
 * Макет из описания `Z6_docs_flow.png`: путь от счёта до оплаты —
 * счёт с реквизитами, изготовление партии, накладная или УПД в двух
 * экземплярах, акт с подписью и штампом, оплата за 5–30 дней. В пакет
 * документов входят накладная, счёт, акт, чек самозанятого, доверенность
 * получателя, подпись и штамп. Без подписи нет оплаты, напоминания —
 * на 10-й и 30-й день.
 */
export function ProfitZ6Image5({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Путь документа: счёт с реквизитами, изготовление партии, накладная или УПД в двух экземплярах, акт с подписью и штампом, оплата за 5–30 дней. В пакет входят накладная или УПД, счёт с реквизитами, акт выполненных работ, чек самозанятого, доверенность получателя, подпись и штамп. Без подписи нет оплаты, напоминания на 10-й и 30-й день"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="10" y="15" fontSize="11" fontWeight="700" fill="#e2e8f0">
          документы и оплата
        </text>
        <text x="10" y="29" fontSize="10" fill="#94a3b8">
          от счёта до денег — пять шагов
        </text>

        <rect x="10" y="34" width="150" height="114" rx="6" fill="#0f172a" stroke="#334155" />
        <line x1="22" y1="46" x2="22" y2="130" stroke="#334155" />
        {STEPS.map((step, index) => {
          const y = 46 + index * 21;
          return (
            <g key={step.number}>
              <circle cx="22" cy={y} r="7" fill={step.color} fillOpacity="0.16" stroke={step.color} />
              <text x="22" y={y + 3.5} fontSize="10" fontWeight="700" fill={step.color} textAnchor="middle">
                {step.number}
              </text>
              <text x="34" y={y + 3.5} fontSize="10" fill="#cbd5e1">
                {step.label}
              </text>
            </g>
          );
        })}

        <rect x="164" y="34" width="146" height="114" rx="6" fill="#0f172a" stroke="#334155" />
        <text x="174" y="46" fontSize="10" fontWeight="700" fill="#94a3b8">
          что взять
        </text>
        {PAPERS.map((paper, index) => {
          const y = 62 + index * 14;
          return (
            <g key={paper}>
              <rect x="174" y={y - 7} width="7" height="7" rx="1.5" fill="#10b981" fillOpacity="0.12" stroke="#10b981" strokeOpacity="0.65" />
              <path d={`M175.5 ${y - 3.5} L177 ${y - 1.8} L179.7 ${y - 5.2}`} fill="none" stroke="#6ee7b7" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
              <text x="186" y={y} fontSize="10" fill="#cbd5e1">
                {paper}
              </text>
            </g>
          );
        })}

        <rect x="10" y="154" width="300" height="18" rx="5" fill="#0f172a" stroke="#334155" />
        <text x="18" y="166" fontSize="10" fontWeight="700" fill="#fca5a5">
          без подписи — нет оплаты
        </text>
        <text x="302" y="166" fontSize="10" fill="#fcd34d" textAnchor="end">
          напоминание: 10 и 30 день
        </text>
      </svg>
    </VisualWrapper>
  );
}
