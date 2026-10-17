import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const TOTAL = 750;

const COSTS = [
  { label: "материал", value: 65, color: "#3b82f6" },
  { label: "час принтера", value: 48, color: "#f59e0b" },
  { label: "электричество", value: 5, color: "#22d3ee" },
  { label: "брак", value: 12, color: "#f87171" },
  { label: "работа", value: 200, color: "#10b981" },
  { label: "упаковка", value: 40, color: "#a78bfa" },
  { label: "комиссия и налог", value: 143, color: "#94a3b8" },
];

const REMAINDER = { label: "остаток на руки", value: 237, color: "#e2e8f0" };

const BAR = [...COSTS, REMAINDER];

/**
 * Кадр блока 5 урока Z2 «Расчёт стоимости и цены».
 *
 * Макет из описания `Z2_cost_parts.png`: доли статей в цене одной подставки.
 * Числа — блок 25: материал 65, час принтера 48, электричество 5, брак 12,
 * работа 200, упаковка 40, комиссия 113 и налог 30. Семь статей затрат дают
 * себестоимость 370 ₽; комиссия с налогом (143 ₽) вычитаются из цены 750 ₽,
 * остаток — 237 ₽. Ширина полосы показывает долю, проценты не подписаны:
 * в уроке их нет.
 */
export function ProfitZ2Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Себестоимость и цена подставки: 750 рублей. Материал 65, час принтера 48, электричество 5, брак 12, работа 200, упаковка 40, комиссия и налог 143, остаток на руки 237 рублей. Себестоимость 370 рублей, семь статей затрат"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#e2e8f0">
          себестоимость и цена подставки
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          цена 750 ₽ · себестоимость 370 ₽
        </text>
        <text x="308" y="29" fontSize="10" fill="#fcd34d" textAnchor="end">
          7 статей
        </text>

        {BAR.map((part, i) => {
          const before = BAR.slice(0, i).reduce((sum, item) => sum + item.value, 0);
          const x = 12 + (before / TOTAL) * 296;
          const width = (part.value / TOTAL) * 296;
          return (
            <g key={part.label}>
              <rect x={x} y="40" width={width} height="22" fill={part.color} stroke="#0f172a" strokeWidth="0.8" />
              {width >= 20 ? (
                <text x={x + width / 2} y="55" fontSize="10" fill="#0f172a" textAnchor="middle">
                  {part.value}
                </text>
              ) : null}
            </g>
          );
        })}

        {[COSTS.slice(0, 4), COSTS.slice(4)].map((column, columnIndex) => {
          const x = columnIndex === 0 ? 16 : 180;
          return column.map((item, itemIndex) => {
            const y = 92 + itemIndex * 16;
            return (
              <g key={item.label}>
                <circle cx={x + 3} cy={y - 3.5} r="2.3" fill={item.color} />
                <text x={x + 11} y={y} fontSize="10" fill="#e2e8f0">
                  {item.label}
                </text>
                <text x={columnIndex === 0 ? 156 : 304} y={y} fontSize="10" fill="#e2e8f0" textAnchor="end">
                  {item.value} ₽
                </text>
              </g>
            );
          });
        })}

        <circle cx="183" cy="140.5" r="2.3" fill={REMAINDER.color} />
        <text x="191" y="144" fontSize="10" fill="#e2e8f0">
          {REMAINDER.label}
        </text>
        <text x="304" y="144" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="end">
          {REMAINDER.value} ₽
        </text>

        <rect x="12" y="152" width="296" height="18" rx="5" fill="#f59e0b" fillOpacity="0.08" stroke="#f59e0b" strokeOpacity="0.3" />
        <text x="160" y="164" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          работа — самая большая статья: 200 ₽
        </text>
      </svg>
    </VisualWrapper>
  );
}
