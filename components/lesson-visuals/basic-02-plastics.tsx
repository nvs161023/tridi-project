import { VisualWrapper, type VisualProps } from "./_Wrapper";

/**
 * basic 2 · image «Пять пластиков: зачем каждый» (Модуль 1: Знакомство).
 *
 * Из описания блока: PLA — сопло 200–210 °C, стол 60 °C, игрушки и декор, боится
 * горячей воды; PETG — 230–240 °C, стол 80 °C, функциональные детали; ABS —
 * 240–250 °C, стол 100 °C, только в закрытой камере; TPU — гибкий, 15–25 мм/с;
 * ASA — для улицы, не боится солнца. Внизу — таблица про стол/камеру и вентиляцию.
 */
const CARDS = [
  {
    x: 8,
    name: "PLA",
    rows: [
      { label: "сопло", value: "200–210 °C", tone: "#f59e0b" },
      { label: "стол", value: "60 °C", tone: "#3b82f6" },
    ],
    notes: ["игрушки", "и декор", "боится", "горячей воды"],
  },
  {
    x: 68,
    name: "PETG",
    rows: [
      { label: "сопло", value: "230–240 °C", tone: "#f59e0b" },
      { label: "стол", value: "80 °C", tone: "#3b82f6" },
    ],
    notes: ["функцио-", "нальные", "детали"],
  },
  {
    x: 128,
    name: "ABS",
    rows: [
      { label: "сопло", value: "240–250 °C", tone: "#f59e0b" },
      { label: "стол", value: "100 °C", tone: "#3b82f6" },
    ],
    notes: ["только в", "закрытой", "камере"],
    chamber: true,
  },
  {
    x: 188,
    name: "TPU",
    rows: [
      { label: "сопло", value: "—", tone: "#64748b" },
      { label: "скорость", value: "15–25 мм/с", tone: "#f59e0b" },
    ],
    notes: ["гибкий"],
  },
  {
    x: 248,
    name: "ASA",
    rows: [
      { label: "сопло", value: "—", tone: "#64748b" },
      { label: "стол", value: "—", tone: "#64748b" },
    ],
    notes: ["для улицы,", "не боится", "солнца"],
  },
];

export function Basic02Plastics({ title, animated = true }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Пять карточек пластиков: PLA, PETG, ABS, TPU, ASA с температурами и назначением"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="h-full w-full">
        {CARDS.map((card) => (
          <g key={card.name}>
            <rect
              x={card.x}
              y="10"
              width="58"
              height="146"
              rx="5"
              fill="#0f172a"
              stroke="#475569"
            />
            <rect x={card.x} y="10" width="58" height="16" rx="5" fill="#1e293b" />
            <text
              x={card.x + 29}
              y="22"
              fontSize="10"
              fill="#e2e8f0"
              textAnchor="middle"
              fontWeight="bold"
            >
              {card.name}
            </text>
            {card.rows.map((row, i) => (
              <g key={row.label}>
                <text x={card.x + 6} y={42 + i * 26} fontSize="6.5" fill="#94a3b8">
                  {row.label}
                </text>
                <text x={card.x + 6} y={53 + i * 26} fontSize="8.5" fill={row.tone}>
                  {row.value}
                </text>
              </g>
            ))}
            {card.notes.map((note, i) => (
              <text key={note} x={card.x + 6} y={92 + i * 10} fontSize="6.5" fill="#cbd5e1">
                {note}
              </text>
            ))}
            {card.chamber && (
              <g>
                <rect
                  x={card.x + 32}
                  y="108"
                  width="22"
                  height="20"
                  rx="2"
                  fill="none"
                  stroke="#f59e0b"
                />
                <line
                  x1={card.x + 38}
                  y1="108"
                  x2={card.x + 38}
                  y2="128"
                  stroke="#f59e0b"
                  strokeDasharray="3 2"
                />
                <text x={card.x + 6} y="140" fontSize="6" fill="#fcd34d">
                  камера
                </text>
              </g>
            )}
          </g>
        ))}
        <text x="8" y="172" fontSize="6.5" fill="#64748b">
          Внизу таблица: открытый стол или камера, нужна ли вентиляция
        </text>
      </svg>
    </VisualWrapper>
  );
}
