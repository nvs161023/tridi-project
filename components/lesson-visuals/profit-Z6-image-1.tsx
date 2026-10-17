import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const PARTS = [
  { name: "коробка", cost: 15, color: "#06b6d4" },
  { name: "плёнка", cost: 8, color: "#3b82f6" },
  { name: "наполнитель", cost: 8, color: "#8b5cf6" },
  { name: "скотч + маркировка", cost: 3, color: "#f59e0b" },
  { name: "зип-пакет", cost: 6, color: "#10b981" },
];

const BAR_WIDTH = 118;
const MAX_COST = 15;

/**
 * Кадр блока 13 урока Z6 «Упаковка, логистика, отправка».
 *
 * Макет из описания `Z6_packaging_cost.png`: упаковка стоит 40 ₽ и состоит
 * из коробки (15 ₽), плёнки (8 ₽), наполнителя (8 ₽), скотча с маркировкой
 * (3 ₽) и зип-пакета (6 ₽). В цене 750 ₽ это 5 %, в себестоимости 370 ₽ —
 * 40 ₽. Десять отправок съедают 400 ₽, поэтому маржа падает с 300 до 260 ₽.
 */
export function ProfitZ6Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Упаковка стоит 40 рублей: коробка 15, плёнка 8, наполнитель 8, скотч и маркировка 3, зип-пакет 6. В цене 750 рублей это 5 процентов, в себестоимости 370 рублей — 40 рублей. Десять отправок по 40 рублей стоят 400 рублей, маржа падает с 300 до 260 рублей"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="10" y="15" fontSize="11" fontWeight="700" fill="#e2e8f0">
          упаковка в себестоимости
        </text>
        <text x="10" y="29" fontSize="10" fill="#94a3b8">
          сорок рублей — строка, а не мелочь
        </text>

        <rect x="10" y="34" width="92" height="108" rx="6" fill="#0f172a" stroke="#334155" />
        <text x="56" y="64" fontSize="20" fontWeight="700" fill="#fbbf24" textAnchor="middle">
          40 ₽
        </text>
        <text x="56" y="82" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          упаковка
        </text>
        <rect x="22" y="92" width="68" height="7" rx="3.5" fill="#334155" />
        <rect x="22" y="92" width="7.4" height="7" rx="3.5" fill="#f59e0b" />
        <text x="22" y="110" fontSize="10" fill="#94a3b8">
          40 из 370 ₽
        </text>
        <rect x="16" y="118" width="80" height="18" rx="9" fill="#f59e0b" fillOpacity="0.15" stroke="#f59e0b" strokeOpacity="0.55" />
        <text x="56" y="131" fontSize="10" fontWeight="700" fill="#fcd34d" textAnchor="middle">
          5 % от 750 ₽
        </text>

        {PARTS.map((part, index) => {
          const y = 42 + index * 17;
          return (
            <g key={part.name}>
              <text x="110" y={y} fontSize="10" fill="#cbd5e1">
                {part.name}
              </text>
              <text x="306" y={y} fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="end">
                {part.cost} ₽
              </text>
              <rect x="110" y={y + 4} width={BAR_WIDTH} height="3" rx="1.5" fill="#334155" />
              <rect x="110" y={y + 4} width={(part.cost / MAX_COST) * BAR_WIDTH} height="3" rx="1.5" fill={part.color} />
            </g>
          );
        })}

        <line x1="110" y1="124" x2="306" y2="124" stroke="#475569" strokeDasharray="2 3" />
        <text x="110" y="138" fontSize="10" fontWeight="700" fill="#e2e8f0">
          итого
        </text>
        <text x="306" y="138" fontSize="10" fontWeight="700" fill="#fbbf24" textAnchor="end">
          40 ₽
        </text>

        <rect x="10" y="148" width="145" height="30" rx="5" fill="#0f172a" stroke="#334155" />
        <text x="20" y="158" fontSize="10" fill="#cbd5e1">
          10 отправок × 40 ₽
        </text>
        <text x="20" y="172" fontSize="10" fontWeight="700" fill="#e2e8f0">
          = 400 ₽
        </text>

        <rect x="165" y="148" width="145" height="30" rx="5" fill="#0f172a" stroke="#334155" />
        <text x="175" y="158" fontSize="10" fill="#cbd5e1">
          маржа 300 → 260 ₽
        </text>
        <text x="175" y="172" fontSize="10" fill="#94a3b8">
          если платить из кармана
        </text>
      </svg>
    </VisualWrapper>
  );
}
