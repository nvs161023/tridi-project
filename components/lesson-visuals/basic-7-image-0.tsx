import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Две скорости и угол детали: медленно путь идёт по углу, быстро его срезает.
 *
 * cx — центр панели. У медленной панели путь повторяет угол (ломаная), у быстрой
 * угол срезан дугой, а пунктиром показано, где материал должен был лечь.
 */
const panels = [
  {
    cx: 83,
    speed: "40 мм/с",
    tone: "#22d3ee",
    title: "гладко, угол острый",
    note: "внешние стенки — медленно",
    rounded: false,
  },
  {
    cx: 237,
    speed: "80 мм/с",
    tone: "#fb7185",
    title: "углы закруглены",
    note: "острые углы — медленно",
    rounded: true,
  },
];

/**
 * Скорость: быстро и медленно — как выглядит угол детали при 40 и 80 мм/с.
 *
 * Ровно по content урока: «80 мм/с — углы закруглены. 40 мм/с — гладко». Вид сверху:
 * стенка детали и путь сопла вдоль неё. На 40 мм/с путь повторяет угол, на 80 —
 * срезает его дугой, и угол получается закруглённым. Внизу — что замедлять из списка
 * урока (первый слой, стенки, углы, мосты).
 *
 * От разрезов первого слоя (урок 5) отличается и объектом, и палитрой: там стол и
 * капли пластика, здесь план детали и путь сопла по углу.
 */
export function Basic7Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Скорость печати и угол детали: на 40 мм/с сопло проходит угол остро и гладко, на 80 мм/с угол срезается дугой и закругляется"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
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

        {panels.map((panel) => (
          <g key={panel.speed}>
            <rect
              x={panel.cx - 34}
              y="24"
              width="68"
              height="16"
              rx="8"
              fill="#1e3a5f"
            />
            <text
              x={panel.cx}
              y="35"
              fontSize="10"
              fill={panel.tone}
              textAnchor="middle"
            >
              {panel.speed}
            </text>

            {/* Стенка детали и её основание */}
            <line
              x1={panel.cx - 40}
              y1="46"
              x2={panel.cx - 40}
              y2="104"
              stroke="#475569"
              strokeWidth="1.5"
            />
            <line
              x1={panel.cx - 40}
              y1="104"
              x2={panel.cx + 40}
              y2="104"
              stroke="#475569"
              strokeWidth="1.5"
            />

            {/* Путь сопла: ломаная с острым углом или дуга со срезанным углом */}
            {panel.rounded ? (
              <path
                d={`M ${panel.cx - 34} 50 L ${panel.cx - 34} 92 Q ${panel.cx - 34} 104 ${panel.cx - 22} 104 L ${panel.cx + 36} 104`}
                fill="none"
                stroke={panel.tone}
                strokeWidth="2.5"
              />
            ) : (
              <polyline
                points={`${panel.cx - 34},50 ${panel.cx - 34},104 ${panel.cx + 36},104`}
                fill="none"
                stroke={panel.tone}
                strokeWidth="2.5"
              />
            )}

            {/* Где должен был лечь материал: срезанный угол */}
            {panel.rounded ? (
              <line
                x1={panel.cx - 34}
                y1="104"
                x2={panel.cx - 20}
                y2="104"
                stroke="#cbd5e1"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
            ) : null}

            <text x={panel.cx - 69} y="124" fontSize="10" fill="#e2e8f0">
              {panel.title}
            </text>
            <text x={panel.cx - 69} y="140" fontSize="10" fill="#94a3b8">
              {panel.note}
            </text>
          </g>
        ))}

        <text x="14" y="164" fontSize="10" fill="#94a3b8">
          Замедляй первый слой, стенки, углы и мосты
        </text>
      </svg>
    </VisualWrapper>
  );
}
