import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Четыре панели по 68 px, шаг 74: 12, 86, 160, 234. */
const PANEL_X = [12, 86, 160, 234];
const PANEL_W = 68;
const BASE_Y = 90;
/** Длина наклонной стенки и радиус дуги угла. */
const LEG = 40;
const ARC_R = 16;

type Angle = { deg: number; status: string; color: string };

/** Углы из кадра `C10_overhang_angles.png` и порог 45° из блока 19. */
const ANGLES: Angle[] = [
  { deg: 30, status: "сам", color: "#10b981" },
  { deg: 45, status: "сам", color: "#10b981" },
  { deg: 60, status: "обдув", color: "#f59e0b" },
  { deg: 80, status: "поддержка", color: "#f87171" },
];

/**
 * Кадр блока 20 урока C10 «Углы нависания: 30, 45, 60, 80».
 *
 * Макет из описания кадра `C10_overhang_angles.png`: одна наклонная стенка на
 * плитку, угол отсчитывается от вертикали. До 45° каждый новый слой наполовину
 * лежит на предыдущем и деталь печатается сама. После 45° нужны обдув и снижение
 * скорости, а поддержка — последний вариант, как сказано в блоке 19.
 */
export function ConfidentC10Diagram1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Углы нависания 30, 45, 60 и 80 градусов от вертикали. При 30 и 45 градусах стенка ложится сама: каждый слой наполовину лежит на предыдущем. При 60 градусах нужен обдув и снижение скорости, при 80 — поддержка. До 45 градусов деталь печатается без поддержек, после 45 опоры становится мало, а поддержка остаётся последним вариантом"
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
          углы нависания: где нужна поддержка
        </text>

        {PANEL_X.map((px, index) => {
          const angle = ANGLES[index];
          const rad = (angle.deg * Math.PI) / 180;
          const dx = LEG * Math.sin(rad);
          const dy = LEG * Math.cos(rad);
          const x0 = px + 10;
          const topY = BASE_Y - dy;
          const band = `${x0},${BASE_Y} ${x0 + dx},${topY} ${x0 + dx + 7},${topY} ${
            x0 + 7
          },${BASE_Y}`;
          const arcEnd = `${(x0 + ARC_R * Math.sin(rad)).toFixed(1)},${(
            BASE_Y -
            ARC_R * Math.cos(rad)
          ).toFixed(1)}`;
          return (
            <g key={angle.deg}>
              <rect
                x={px}
                y="36"
                width={PANEL_W}
                height="64"
                rx="5"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#334155"
              />
              <line
                x1={x0}
                y1={BASE_Y}
                x2={x0}
                y2={BASE_Y - 32}
                stroke="#475569"
                strokeDasharray="2 2"
              />
              <polygon points={band} fill="#475569" stroke="#64748b" />
              <path
                d={`M${x0} ${BASE_Y - ARC_R} A${ARC_R} ${ARC_R} 0 0 1 ${arcEnd}`}
                fill="none"
                stroke={angle.color}
                strokeOpacity="0.9"
              />
              <line x1={px + 6} y1={BASE_Y} x2={px + PANEL_W - 6} y2={BASE_Y} stroke="#334155" />
              <text
                x={px + PANEL_W / 2}
                y="112"
                fontSize="10"
                fontWeight="700"
                fill="#e2e8f0"
                textAnchor="middle"
              >
                {angle.deg}°
              </text>
              <text
                x={px + PANEL_W / 2}
                y="126"
                fontSize="10"
                fill={angle.color}
                textAnchor="middle"
              >
                {angle.status}
              </text>
            </g>
          );
        })}

        <text x="12" y="142" fontSize="10" fontWeight="700" fill="#e2e8f0">
          До 45° деталь печатается сама
        </text>
        <text x="12" y="158" fontSize="10" fill="#94a3b8">
          После 45° помогают обдув, скорость и поддержки
        </text>
        <text x="12" y="172" fontSize="10" fill="#94a3b8">
          Поддержка — последний вариант, а не первый
        </text>
      </svg>
    </VisualWrapper>
  );
}
