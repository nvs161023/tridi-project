import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const MONEY = [
  { label: "материал", color: "#06b6d4" },
  { label: "работа", color: "#3b82f6" },
  { label: "реклама", color: "#8b5cf6" },
  { label: "налог", color: "#f59e0b" },
];

const RESULT = [
  { label: "себестоимость", color: "#06b6d4" },
  { label: "цена", color: "#3b82f6" },
  { label: "маржа", color: "#10b981" },
  { label: "прибыль", color: "#22c55e" },
];

/**
 * Кадр блока 12 урока Z8 «Финальный проект: свой продукт».
 *
 * `Z8_calc_chain.png`: цепочка расчёта партии. Сначала складываются материал,
 * работа, реклама и налог, потом из суммы выходят себестоимость, цена, маржа
 * и прибыль. Партия на старте — три-пять штук, в расчёт закладывают 5–10 %
 * на брак.
 */
export function ProfitZ8Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Цепочка расчёта партии. Сначала складываются материал, работа, реклама и налог. Затем считаются себестоимость, цена, маржа и прибыль. Тестовая партия — три-пять штук, в расчёт закладывают пять-десять процентов на брак"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="11" fontWeight="700" fill="#e2e8f0">
          цепочка расчёта партии
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          что сложить и что получить
        </text>

        <text x="12" y="46" fontSize="10" fontWeight="700" fill="#94a3b8">
          складываем
        </text>
        {MONEY.map((item, index) => {
          const x = 10 + index * 76;
          return (
            <g key={item.label}>
              <rect x={x} y="52" width="68" height="26" rx="4" fill="#0f172a" stroke={item.color} strokeOpacity="0.55" />
              <rect x={x} y="52" width="68" height="3" rx="1.5" fill={item.color} />
              <text x={x + 34} y="69" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
                {item.label}
              </text>
              {index < 3 && (
                <text x={x + 72} y="69" fontSize="10" fontWeight="700" fill="#64748b" textAnchor="middle">
                  +
                </text>
              )}
            </g>
          );
        })}

        <path d="M160 80 V92" stroke="#64748b" strokeWidth="1.5" />
        <path d="M156 90 L160 96 L164 90 Z" fill="#64748b" />
        <text x="168" y="90" fontSize="10" fill="#94a3b8">
          = сумма затрат
        </text>

        <text x="12" y="108" fontSize="10" fontWeight="700" fill="#94a3b8">
          получаем
        </text>
        {RESULT.map((item, index) => {
          const x = 10 + index * 76;
          return (
            <g key={item.label}>
              <rect x={x} y="114" width="68" height="26" rx="4" fill="#0f172a" stroke={item.color} strokeOpacity="0.55" />
              <rect x={x} y="114" width="68" height="3" rx="1.5" fill={item.color} />
              <text x={x + 34} y="131" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
                {item.label}
              </text>
              {index < 3 && (
                <path d={`M${x + 70} 124 L${x + 74} 127 L${x + 70} 130`} fill="none" stroke="#64748b" strokeWidth="1.5" />
              )}
            </g>
          );
        })}

        <rect x="10" y="148" width="146" height="24" rx="5" fill="#0f172a" stroke="#334155" />
        <text x="18" y="164" fontSize="10" fontWeight="700" fill="#22d3ee">
          партия 3–5 шт
        </text>

        <rect x="164" y="148" width="146" height="24" rx="5" fill="#0f172a" stroke="#334155" />
        <text x="172" y="164" fontSize="10" fontWeight="700" fill="#fbbf24">
          запас на брак 5–10 %
        </text>
      </svg>
    </VisualWrapper>
  );
}
