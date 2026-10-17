import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const LANES = [
  {
    label: "Заказ",
    color: "#3b82f6",
    textColor: "#93c5fd",
    line1: "одна деталь под задачу",
    line2: "повторять нечего",
  },
  {
    label: "Готовые детали",
    color: "#10b981",
    textColor: "#6ee7b7",
    line1: "свой товар, магазин",
    line2: "склад и остатки",
  },
  {
    label: "Тираж",
    color: "#f59e0b",
    textColor: "#fcd34d",
    line1: "десятками штук",
    line2: "100 деталей совпадают",
  },
  {
    label: "Файлы",
    color: "#94a3b8",
    textColor: "#cbd5e1",
    line1: "без пластика",
    line2: "конкурентов много",
  },
];

/**
 * Кадр блока 5 урока Z1 «Что продавать: ниши и маржа».
 *
 * Макет из описания `Z1_niche_map.png`: четыре полосы — заказ, готовые детали,
 * тираж и файлы. Содержание полос — блок 3, правило «один способ на первый
 * месяц» — там же.
 */
export function ProfitZ1Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Карта заработка: четыре способа. Печать на заказ — одна деталь под задачу, повторять нечего. Готовые детали — свой товар, магазин, склад и остатки. Тираж — десятками штук, сто деталей должны совпасть. Файлы — без пластика, конкурентов много. На первый месяц выбирают один способ: один путь быстрее пяти"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          карта заработка: четыре способа
        </text>

        {LANES.map((lane, i) => {
          const y = 26 + i * 31;
          return (
            <g key={lane.label}>
              <rect x="12" y={y} width="296" height="28" rx="6" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
              <rect x="12" y={y} width="3" height="28" fill={lane.color} />
              <text x="22" y={y + 12} fontSize="11" fontWeight="700" fill={lane.textColor}>
                {lane.label}
              </text>
              <text x="118" y={y + 11} fontSize="10" fill="#e2e8f0">
                {lane.line1}
              </text>
              <text x="118" y={y + 23} fontSize="10" fill="#94a3b8">
                {lane.line2}
              </text>
            </g>
          );
        })}

        <rect x="12" y="152" width="296" height="18" rx="5" fill="#f59e0b" fillOpacity="0.08" stroke="#f59e0b" strokeOpacity="0.3" />
        <text x="22" y="164" fontSize="10" fill="#e2e8f0">
          1 способ на первый месяц · один путь быстрее пяти
        </text>
      </svg>
    </VisualWrapper>
  );
}
