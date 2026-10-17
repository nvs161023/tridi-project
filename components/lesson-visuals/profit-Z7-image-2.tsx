import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const STEPS = [
  { number: "1", title: "статус", line1: "самозанятый,", line2: "ИП или ООО", color: "#06b6d4" },
  { number: "2", title: "заявление", line1: "приложение,", line2: "банк, налоговая", color: "#3b82f6" },
  { number: "3", title: "коды", line1: "коды + УСН", line2: "в один заход", color: "#8b5cf6" },
  { number: "4", title: "счёт и касса", line1: "счёт заводам,", line2: "касса людям", color: "#f59e0b" },
  { number: "5", title: "чеки", line1: "«Мой налог»", line2: "или касса + ОФД", color: "#10b981" },
  { number: "6", title: "сроки", line1: "12, 28, апрель", line2: "взносы — год", color: "#f472b6" },
];

/**
 * Кадр блока 17 урока Z7 «Юр. оформление, налоги, лицензии».
 *
 * Макет из описания `Z7_registration.png`: статус, коды, счёт, касса, чеки и
 * первый платёж. В блоке 16 заголовок говорит «шесть шагов», а в массиве семь
 * пунктов: кадр считает шесть шагов оформления, а седьмой пункт «продать первую
 * деталь» выносит отдельным итогом. Сроки: самозанятость 10–15 минут, ИП
 * 3 дня–неделя, ООО от недели.
 */
export function ProfitZ7Image2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Шесть шагов оформления: выбрать статус — самозанятость, ИП или ООО; подать заявление через приложение, банк или налоговую; выбрать коды деятельности и УСН сразу; открыть счёт для заводов и кассу для продаж людям; настроить чеки в приложении «Мой налог» или на кассе с оператором; внести сроки в календарь — 12 и 28 число, декларация в апреле, взносы за год. После оформления — продать первую деталь и сразу сложить чек в папку. Самозанятость 10–15 минут, ИП 3 дня–неделя, ООО от недели"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="11" fontWeight="700" fill="#e2e8f0">
          оформление: от заявления до чека
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          шесть шагов
        </text>

        {STEPS.map((step, index) => {
          const x = 10 + (index % 3) * 102;
          const y = 34 + Math.floor(index / 3) * 52;
          return (
            <g key={step.number}>
              <rect x={x} y={y} width="96" height="48" rx="5" fill="#0f172a" stroke="#334155" />
              <circle cx={x + 12} cy={y + 13} r="7" fill={step.color} fillOpacity="0.16" stroke={step.color} />
              <text x={x + 12} y={y + 16.5} fontSize="10" fontWeight="700" fill={step.color} textAnchor="middle">
                {step.number}
              </text>
              <text x={x + 24} y={y + 16.5} fontSize="10" fontWeight="700" fill="#e2e8f0">
                {step.title}
              </text>
              <text x={x + 7} y={y + 31} fontSize="10" fill="#cbd5e1">
                {step.line1}
              </text>
              <text x={x + 7} y={y + 45} fontSize="10" fill="#94a3b8">
                {step.line2}
              </text>
            </g>
          );
        })}

        <rect x="10" y="138" width="300" height="38" rx="6" fill="#0f172a" stroke="#334155" />
        <text x="18" y="153" fontSize="10" fontWeight="700" fill="#e2e8f0">
          после — первая деталь: чек сразу в папку
        </text>
        <text x="18" y="169" fontSize="10" fill="#94a3b8">
          10–15 мин · ИП 3 дня–неделя · ООО от недели
        </text>
      </svg>
    </VisualWrapper>
  );
}
