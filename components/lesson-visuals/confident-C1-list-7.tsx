import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Пять строк СИЗ: 12…308, 20…168, шаг 30, высота строки 28. */
const ROW_Y = [20, 50, 80, 110, 140];
const ROW_H = 28;
const CHIP_X = 20;
const CHIP_SIZE = 18;
const TEXT_X = 46;

type KitItem = { name: string; note: string; color: string; icon: number };

/** Набор СИЗ — блок 28; назначение — блоки 28 и 18. */
const KIT: KitItem[] = [
  {
    name: "Респиратор FFP2 с клапаном",
    note: "ABS, композиты, шлифовка, разбор камеры",
    color: "#3b82f6",
    icon: 0,
  },
  {
    name: "Закрытые очки",
    note: "промывка смолы, шлифовка, просеивание порошка",
    color: "#3b82f6",
    icon: 1,
  },
  {
    name: "Нитриловые перчатки",
    note: "смола, растворители, порошок; латекс — нет",
    color: "#10b981",
    icon: 2,
  },
  {
    name: "Халат или фартук",
    note: "смола и пыль остаются на работе, а не дома",
    color: "#f59e0b",
    icon: 3,
  },
  {
    name: "Закрытый контейнер",
    note: "перчатки, угольные вставки, салфетки со смолой",
    color: "#f59e0b",
    icon: 4,
  },
];

/** Простые значки 12 на 12: маска, очки, перчатка, фартук, контейнер. */
const ICONS: { d: string[]; circles: [number, number, number][] }[] = [
  { d: ["M1 3 H11 V6 A5 5 0 0 1 1 6 Z", "M1 5 H-1", "M11 5 H13"], circles: [] },
  { d: ["M4 6 H8"], circles: [[3.2, 6, 2.6], [8.8, 6, 2.6]] },
  {
    d: [
      "M3.4 4 V2.6",
      "M6 4 V1.4",
      "M8.6 4 V2.6",
      "M2 6 C2 4.4 3.2 4 4.2 4 H8.4 C9.6 4 10 5 10 6 V9 A2 2 0 0 1 8 11 H4 A2 2 0 0 1 2 9 Z",
    ],
    circles: [],
  },
  { d: ["M4 1 H8 V3 H9.4 L11 11 H1 L2.6 3 H4 Z", "M1.6 7 H10.4"], circles: [] },
  { d: ["M1 4.6 H11 V11 H1 Z", "M0.4 2.2 H11.6 V4.6 H0.4 Z", "M4.6 7 H7.4"], circles: [] },
];

/**
 * Кадр блока 28 урока C1 «СИЗ: что держать рядом».
 *
 * Пять предметов, которые стоят рядом с принтером: респиратор FFP2 с клапаном для
 * ABS, композитов, шлифовки и разбора камеры, закрытые очки для промывки смолы,
 * шлифовки и просеивания порошка, нитриловые перчатки для смолы, растворителей и
 * порошка (латексные для смолы не подходят), рабочий халат или фартук и закрытый
 * контейнер для отработанного.
 */
export function ConfidentC1List7({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="СИЗ: что держать рядом. Пять предметов. Респиратор FFP2 с клапаном — для ABS, композитов, шлифовки и разбора камеры. Закрытые очки — для промывки смолы, шлифовки и просеивания порошка. Нитриловые перчатки — для смолы, растворителей и порошка, латексные для смолы не подходят. Халат или фартук — чтобы смола и пыль оставались на работе. Закрытый контейнер — для перчаток, угольных вставок и салфеток со смолой"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect
          x="0.5"
          y="0.5"
          width="319"
          height="179"
          rx="12"
          fill="#1e293b"
          fillOpacity="0.5"
          stroke="#475569"
        />

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          СИЗ: что держать рядом с принтером
        </text>

        {KIT.map((item, index) => {
          const y = ROW_Y[index];
          const icon = ICONS[item.icon];
          return (
            <g key={item.name}>
              <rect
                x="12"
                y={y}
                width="296"
                height={ROW_H}
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <rect
                x={CHIP_X}
                y={y + 5}
                width={CHIP_SIZE}
                height={CHIP_SIZE}
                rx="4"
                fill={item.color}
                fillOpacity="0.18"
                stroke={item.color}
                strokeOpacity="0.7"
              />
              <g transform={`translate(23 ${y + 7})`}>
                {icon.circles.map(([cx, cy, r]) => (
                  <circle
                    key={`c-${cx}`}
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="none"
                    stroke={item.color}
                    strokeWidth="1"
                  />
                ))}
                {icon.d.map((d) => (
                  <path
                    key={d}
                    d={d}
                    fill="none"
                    stroke={item.color}
                    strokeWidth="1"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                ))}
              </g>
              <text x={TEXT_X} y={y + 13} fontSize="12" fontWeight="700" fill={item.color}>
                {item.name}
              </text>
              <text x={TEXT_X} y={y + 24} fontSize="10" fill="#94a3b8">
                {item.note}
              </text>
            </g>
          );
        })}
      </svg>
    </VisualWrapper>
  );
}
