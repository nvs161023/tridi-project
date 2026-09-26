import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Три положения сопла: слишком высоко, норма и слишком низко.
 *
 * tipTop — верх треугольника сопла, tipY — его кончик: чем ниже кончик, тем сильнее
 * сопло прижимает пластик к столу.
 */
const panels = [
  {
    x: 14,
    title: "высоко — щели",
    note: "круглые, с зазором",
    tipTop: 62,
    tipY: 76,
    tone: "#f87171",
  },
  {
    x: 114,
    title: "норма — плотно",
    note: "слегка сплющены",
    tipTop: 72,
    tipY: 86,
    tone: "#34d399",
  },
  {
    x: 214,
    title: "низко — прозрачно",
    note: "низ расплылся",
    tipTop: 78,
    tipY: 92,
    tone: "#fbbf24",
  },
];

/**
 * Хороший и плохой первый слой — три разреза рядом.
 *
 * Ровно по content урока: «Хороший: линии плотно, слегка сплющены. Плохой: щели
 * (высоко) или прозрачный (низко)». Слева сопло высоко — линии круглые и не
 * касаются; в середине норма — плоские и плотно; справа сопло прижато — пластик
 * расплылся и просвечивает. Внизу — подсказка из шагов урока: Z-offset по 0,05 мм.
 *
 * От анимации первого слоя того же урока это отличается масштабом: здесь три
 * разреза в ряд на общем плане, а там одна линия крупным планом.
 */
export function Basic5Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Разрезы первого слоя: сопло высоко — круглые линии с щелями, норма — линии плотно и слегка сплющены, сопло низко — пластик расплылся и просвечивает"
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

        {panels.map((panel, index) => (
          <g key={panel.title}>
            {/* Сопло: чем ниже кончик, тем сильнее прижим */}
            <rect
              x={panel.x + 41}
              y={panel.tipTop - 20}
              width="6"
              height="20"
              fill="#475569"
            />
            <polygon
              points={`${panel.x + 38},${panel.tipTop} ${panel.x + 50},${panel.tipTop} ${panel.x + 44},${panel.tipY}`}
              fill="#94a3b8"
            />

            {/* Стол */}
            <rect
              x={panel.x + 4}
              y="98"
              width="84"
              height="8"
              rx="2"
              fill="#1e3a5f"
              stroke="#3b82f6"
            />

            {/* Первый слой в разрезе */}
            {index === 0
              ? [14, 46, 78].map((offset) => (
                  <circle
                    key={offset}
                    cx={panel.x + offset}
                    cy="95"
                    r="5"
                    fill={panel.tone}
                  />
                ))
              : null}
            {index === 1
              ? [6, 33, 60].map((offset) => (
                  <rect
                    key={offset}
                    x={panel.x + offset}
                    y="92"
                    width="26"
                    height="8"
                    rx="4"
                    fill={panel.tone}
                  />
                ))
              : null}
            {index === 2
              ? [4, 32, 60].map((offset) => (
                  <rect
                    key={offset}
                    x={panel.x + offset}
                    y="94"
                    width="30"
                    height="6"
                    rx="3"
                    fill={panel.tone}
                    fillOpacity="0.45"
                  />
                ))
              : null}

            <text x={panel.x} y="124" fontSize="10" fill="#e2e8f0">
              {panel.title}
            </text>
            <text x={panel.x} y="140" fontSize="10" fill="#94a3b8">
              {panel.note}
            </text>
          </g>
        ))}

        <text x="14" y="164" fontSize="10" fill="#94a3b8">
          Правят Z-offset по 0,05 мм
        </text>
      </svg>
    </VisualWrapper>
  );
}
