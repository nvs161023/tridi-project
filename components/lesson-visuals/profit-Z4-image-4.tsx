import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const CELLS = [
  ...Array.from({ length: 13 }, () => "#10b981"),
  ...Array.from({ length: 2 }, () => "#f87171"),
  ...Array.from({ length: 5 }, () => "#f59e0b"),
];

const STATS = [
  { value: "2 детали", label: "10 % брака", color: "#f87171", x: 12, width: 88 },
  { value: "740 ₽", label: "материал и часы", color: "#f59e0b", x: 108, width: 88 },
  { value: "5 ч", label: "перепечатка", color: "#3b82f6", x: 204, width: 104 },
];

/**
 * Кадр блока 24 урока Z4 «Серия: повторяемость, QC, допуски».
 *
 * Макет из описания `Z4_defect_map.png`: годные детали до дефекта, граница
 * брака и зона проверки после. В полосе 20 клеток: 13 годных, 2 бракованных
 * и 5 спорных — распределение иллюстративное, числа в подписях точные.
 * Стоимость из блока 29: 10 % от 20 деталей — это 2 детали, 740 ₽ и 5 часов.
 */
export function ProfitZ4Image4({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Карта партии из 20 деталей: годные детали до дефекта, граница брака из двух деталей и зона проверки после. Последняя годная — первая бракованная. Две детали — это 10 процентов брака, 740 рублей и 5 часов перепечатки"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#e2e8f0">
          карта брака в партии
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          20 деталей · 10 % = 2 детали
        </text>

        {CELLS.map((color, index) => (
          <rect
            key={index}
            x={12 + index * 14.4}
            y="48"
            width="12"
            height="18"
            rx="2"
            fill={color}
            fillOpacity="0.55"
            stroke={color}
            strokeWidth="0.8"
          />
        ))}
        <path d="M199 40 V72" stroke="#f87171" strokeWidth="1" strokeDasharray="2 2" />
        <text x="203" y="42" fontSize="10" fill="#fca5a5">
          граница
        </text>

        <text x="100" y="82" fontSize="10" fill="#6ee7b7" textAnchor="middle">
          годные
        </text>
        <text x="199" y="82" fontSize="10" fill="#fca5a5" textAnchor="middle">
          брак
        </text>
        <text x="263" y="82" fontSize="10" fill="#fcd34d" textAnchor="middle">
          проверить
        </text>
        <text x="160" y="96" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          последняя годная → первая бракованная
        </text>

        {STATS.map((stat) => (
          <g key={stat.label}>
            <rect x={stat.x} y="104" width={stat.width} height="42" rx="6" fill="#0f172a" stroke="#334155" />
            <rect x={stat.x} y="104" width={stat.width} height="3" rx="1.5" fill={stat.color} />
            <text x={stat.x + stat.width / 2} y="122" fontSize="13" fontWeight="700" fill={stat.color} textAnchor="middle">
              {stat.value}
            </text>
            <text x={stat.x + stat.width / 2} y="137" fontSize="10" fill="#94a3b8" textAnchor="middle">
              {stat.label}
            </text>
          </g>
        ))}

        <text x="160" y="159" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          перепечатать недостающие и проверить заново
        </text>
        <text x="160" y="173" fontSize="10" fill="#94a3b8" textAnchor="middle">
          сначала останови печать, потом ищи границу
        </text>
      </svg>
    </VisualWrapper>
  );
}
