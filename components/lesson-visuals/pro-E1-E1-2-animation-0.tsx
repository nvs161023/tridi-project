import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Три пластика из content урока со своей усадкой и своей высотой подъёма углов:
 * подъём нарисован крупно, а честные цифры стоят подписями — иначе 0,3 % в
 * кадре не увидеть.
 */
type Plastic = {
  x: number;
  name: string;
  shrink: string;
  effect: string;
  accent: string;
  lift: number;
};

const plastics: Plastic[] = [
  { x: 60, name: "PLA", shrink: "0,3 %", effect: "углы ровно", accent: "#22c55e", lift: 3 },
  { x: 160, name: "ABS", shrink: "0,8 %", effect: "края вверх", accent: "#f97316", lift: 6 },
  { x: 260, name: "PA", shrink: "1,5 %", effect: "углы вверх", accent: "#a78bfa", lift: 9 },
];

/**
 * Усадка при охлаждении — процесс из content урока: горячий пластик расширен и
 * лежит ровно, при остывании сжимается, и углы пластины поднимаются тем сильнее,
 * чем больше усадка у материала.
 *
 * От «PEI при нагреве» из модуля B отличается предметом: там герой — пластина
 * стола, которая расширяется, с температурами и пунктирным номиналом; здесь
 * герой — сама деталь на столе, а мера — процент усадки материала.
 *
 * Анимация 5 с, по кругу: деталь остывает, углы поднимаются, затем всё
 * возвращается. При prefers-reduced-motion показано остывшее состояние.
 *
 * Классы с префиксом v-pe12a: <style> внутри SVG действует на всю страницу.
 */
export function ProE1E12Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация: три пластины на столе остывают и сжимаются — у PLA с усадкой 0,3 % углы остаются ровно, у ABS с 0,8 % края приподнимаются, у PA с 1,5 % углы уходят вверх сильнее всего"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-pe12a-warp-l { animation: v-pe12a-warp 5s ease-in-out infinite; transform-box: fill-box; transform-origin: bottom right; }
          .v-pe12a-warp-r { animation: v-pe12a-warp 5s ease-in-out infinite; transform-box: fill-box; transform-origin: bottom left; }
          .v-pe12a-heat { animation: v-pe12a-glow 5s ease-in-out infinite; }
          @keyframes v-pe12a-warp {
            0%, 38% { transform: scaleY(0.1); }
            58%, 88% { transform: scaleY(1); }
            100% { transform: scaleY(0.1); }
          }
          @keyframes v-pe12a-glow {
            0%, 38% { opacity: 0.32; }
            58%, 88% { opacity: 0.06; }
            100% { opacity: 0.32; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-pe12a-warp-l, .v-pe12a-warp-r, .v-pe12a-heat { animation: none; }
            .v-pe12a-warp-l, .v-pe12a-warp-r { transform: scaleY(1); }
            .v-pe12a-heat { opacity: 0.06; }
          }
        `}</style>

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

        <text x="14" y="20" fontSize="10" fill="#94a3b8">
          чем больше усадка — тем сильнее отклеивается
        </text>

        {/* Стол, на котором стоят все три детали */}
        <line x1="14" y1="116" x2="306" y2="116" stroke="#475569" />

        {plastics.map((plastic) => {
          const { x, lift } = plastic;

          return (
            <g key={plastic.name}>
              {/* Деталь: середина и два края, которые поднимаются при остывании */}
              <rect
                x={x - 18}
                y="104"
                width="36"
                height="12"
                rx="1"
                fill="#334155"
                stroke={plastic.accent}
              />
              <polygon
                className="v-pe12a-warp-l"
                points={`${x - 18},116 ${x - 18},104 ${x - 32},${104 - lift} ${x - 32},${116 - lift}`}
                fill="#334155"
                stroke={plastic.accent}
              />
              <polygon
                className="v-pe12a-warp-r"
                points={`${x + 18},116 ${x + 18},104 ${x + 32},${104 - lift} ${x + 32},${116 - lift}`}
                fill="#334155"
                stroke={plastic.accent}
              />
              <rect
                className="v-pe12a-heat"
                x={x - 32}
                y="104"
                width="64"
                height="12"
                fill="#fbbf24"
              />
              <line
                x1={x - 14}
                y1="108"
                x2={x + 14}
                y2="108"
                stroke={plastic.accent}
                strokeWidth="0.7"
                strokeOpacity="0.55"
              />
              <line
                x1={x - 14}
                y1="112"
                x2={x + 14}
                y2="112"
                stroke={plastic.accent}
                strokeWidth="0.7"
                strokeOpacity="0.55"
              />

              <text
                x={x}
                y="132"
                fontSize="10"
                fontWeight="bold"
                fill={plastic.accent}
                textAnchor="middle"
              >
                {plastic.name}
              </text>
              <text x={x} y="148" fontSize="10" fill="#e2e8f0" textAnchor="middle">
                {plastic.shrink}
              </text>
              <text x={x} y="164" fontSize="10" fill="#94a3b8" textAnchor="middle">
                {plastic.effect}
              </text>
            </g>
          );
        })}
      </svg>
    </VisualWrapper>
  );
}
