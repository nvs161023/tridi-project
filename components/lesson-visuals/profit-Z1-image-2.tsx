import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const PRICE = 450;
const MARGIN = 274;
const COSTS = [
  { label: "материал", value: 90, fill: "#475569" },
  { label: "комиссия", value: 45, fill: "#64748b" },
  { label: "налог", value: 18, fill: "#7c8ba1" },
  { label: "упаковка", value: 10, fill: "#94a3b8" },
  { label: "электричество", value: 4, fill: "#cbd5e1" },
  { label: "брак", value: 9, fill: "#e2e8f0" },
];

const TOTAL = COSTS.reduce((sum, cost) => sum + cost.value, 0);
const X0 = 20;
const BAR_WIDTH = 280;
const SCALE = BAR_WIDTH / PRICE;

/**
 * Кадр блока 20 урока Z1 «Что продавать: ниши и маржа».
 *
 * Макет из описания `Z1_price_floor.png`: пол в цене — себестоимость кашпо.
 * Состав расходов и сумма 176 ₽ — блок 18, маржа 274 ₽ при цене 450 ₽ — там же.
 */
export function ProfitZ1Image2({ title, animated }: VisualProps) {
  let cursor = X0;
  const segments = COSTS.map((cost) => {
    const width = cost.value * SCALE;
    const segment = { ...cost, x: cursor, width };
    cursor += width;
    return segment;
  });
  const floorX = X0 + TOTAL * SCALE;
  const marginX = floorX;

  return (
    <VisualWrapper
      title={title}
      ariaLabel="Пол в цене кашпо за 450 рублей. Себестоимость 176 рублей: материал 90, комиссия 45, налог 18, упаковка 10, электричество 4, брак 9. Ниже линии пола работа идёт в убыток. Выше пола остаётся маржа 274 рубля"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          пол в цене: кашпо за 450 ₽
        </text>

        <text x={floorX} y="27" fontSize="10" fontWeight="700" fill="#fcd34d" textAnchor="middle">
          пол 176 ₽
        </text>
        <path d={`M${floorX} 32 V74`} stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="3 2" />

        {segments.map((segment) => (
          <rect
            key={segment.label}
            x={segment.x}
            y="40"
            width={segment.width}
            height="26"
            fill={segment.fill}
            stroke="#0f172a"
            strokeWidth="0.8"
          />
        ))}
        <rect
          x={marginX}
          y="40"
          width={MARGIN * SCALE}
          height="26"
          fill="#10b981"
          fillOpacity="0.85"
          stroke="#34d399"
          strokeWidth="0.8"
        />
        <text x={marginX + (MARGIN * SCALE) / 2} y="57" fontSize="10" fontWeight="700" fill="#ecfdf5" textAnchor="middle">
          маржа 274 ₽
        </text>

        <text x={X0} y="78" fontSize="10" fill="#94a3b8">
          0
        </text>
        <text x={X0 + BAR_WIDTH} y="78" fontSize="10" fill="#94a3b8" textAnchor="end">
          450 ₽
        </text>

        <rect x="12" y="84" width="296" height="48" rx="6" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
        {COSTS.map((cost, i) => {
          const column = i < 3 ? 0 : 1;
          const row = i % 3;
          const x = column === 0 ? 20 : 164;
          const y = 98 + row * 14;
          return (
            <g key={cost.label}>
              <rect x={x} y={y - 8} width="5" height="5" rx="1" fill={cost.fill} />
              <text x={x + 9} y={y} fontSize="10" fill="#cbd5e1">
                {cost.label} {cost.value} ₽
              </text>
            </g>
          );
        })}

        <text x="16" y="144" fontSize="10" fontWeight="700" fill="#fcd34d">
          итого 176 ₽ — пол
        </text>
        <text x="304" y="144" fontSize="10" fontWeight="700" fill="#6ee7b7" textAnchor="end">
          маржа 274 ₽
        </text>

        <rect x="12" y="150" width="296" height="22" rx="5" fill="#f87171" fillOpacity="0.1" stroke="#f87171" strokeOpacity="0.35" />
        <text x="22" y="164" fontSize="10" fill="#fecaca">
          ниже пола — убыток: работа не окупает расходы
        </text>
      </svg>
    </VisualWrapper>
  );
}
