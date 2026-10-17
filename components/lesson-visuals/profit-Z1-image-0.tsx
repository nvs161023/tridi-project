import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const LEFT = [
  { name: "Кашпо и вазы", color: "#f59e0b" },
  { name: "Брелоки", color: "#10b981" },
  { name: "Органайзеры для стола", color: "#475569" },
  { name: "Подставки", color: "#475569" },
  { name: "Ёлочные игрушки", color: "#3b82f6" },
  { name: "Держатели для дома", color: "#475569" },
];

const RIGHT = [
  { name: "Кухонные мелочи", color: "#475569" },
  { name: "Хранение", color: "#475569" },
  { name: "Сувениры с местным мотивом", color: "#475569" },
  { name: "Настольные мелочи", color: "#475569" },
  { name: "Подарочные наборы", color: "#475569" },
  { name: "Аксессуары для животных", color: "#475569" },
];

const LEGEND = [
  { label: "к праздникам", color: "#f59e0b" },
  { label: "повторные заказы", color: "#10b981" },
  { label: "сезон", color: "#3b82f6" },
];

/**
 * Кадр блока 9 урока Z1 «Что продавать: ниши и маржа».
 *
 * Макет из описания `Z1_products_grid.png`: двенадцать товаров из списка
 * «Ниши, которые работают дома» (блок 7). Метки — только слова урока:
 * кашпо покупают к праздникам, у брелоков много повторных заказов, ёлочные
 * игрушки — сезонная ниша. Выдуманного деления на «часто/редко» в кадре нет.
 */
export function ProfitZ1Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Двенадцать товаров, которые работают дома: кашпо и вазы, брелоки, органайзеры для стола, подставки, ёлочные игрушки, держатели для дома, кухонные мелочи, хранение, сувениры с местным мотивом, настольные мелочи, подарочные наборы, аксессуары для животных. Кашпо покупают к праздникам, брелоки дают повторные заказы, ёлочные игрушки — сезонная ниша"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#e2e8f0">
          12 товаров, которые работают дома
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          что берут к празднику, повторно и по сезону
        </text>

        {[LEFT, RIGHT].flatMap((column, columnIndex) => {
          const x = columnIndex === 0 ? 16 : 167;
          const textX = x + 7;
          return column.map((item, itemIndex) => {
            const y = 46 + itemIndex * 19;
            return (
              <g key={item.name}>
                <circle cx={x} cy={y - 3.5} r="2.2" fill={item.color} />
                <text x={textX} y={y} fontSize="10" fill="#e2e8f0">
                  {item.name}
                </text>
              </g>
            );
          });
        })}

        <path d="M12 150 H308" stroke="#334155" strokeWidth="0.8" />
        {LEGEND.map((entry, i) => {
          const x = [16, 99, 196][i];
          return (
            <g key={entry.label}>
              <circle cx={x} cy={160} r="2.2" fill={entry.color} />
              <text x={x + 7} y={163.5} fontSize="10" fill="#94a3b8">
                {entry.label}
              </text>
            </g>
          );
        })}
      </svg>
    </VisualWrapper>
  );
}
