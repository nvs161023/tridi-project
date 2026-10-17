import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Пять шагов смены пластика: шаг 26, поле 40…144. */
const STEP_Y = [40, 66, 92, 118, 144];
const AXIS_X = 22;

type Step = { name: string; detail: string; color: string };

/** Блок 24: пауза, отвод, замена катушки, продувка и продолжение. */
const STEPS: Step[] = [
  { name: "Пауза", detail: "движение стоит", color: "#f59e0b" },
  { name: "Отвод сопла", detail: "нить −40 мм", color: "#60a5fa" },
  { name: "Замена катушки", detail: "ждёт кнопки", color: "#a78bfa" },
  { name: "Продувка", detail: "+30 мм", color: "#10b981" },
  { name: "Продолжение", detail: "слой 120", color: "#fcd34d" },
];

/**
 * Кадр блока 25 урока C11 «M600: что происходит по шагам».
 *
 * Макет из описания кадра `C11_m600_flow.png`: пять шагов сверху вниз на одной
 * оси. Блок 24 объясняет, что M600 останавливает печать, отводит сопло, ждёт
 * новую катушку, продувает сопло и продолжает с того же слоя.
 */
export function ConfidentC11Diagram1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="M600 по шагам: пауза останавливает движение, сопло отводится и откатывает нить на 40 мм, принтер ждёт замены катушки, затем продувает сопло и продолжает печать с того же слоя. Пять шагов идут по порядку сверху вниз, команду ставят между слоями"
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
          пять шагов смены пластика
        </text>

        <line
          x1={AXIS_X}
          y1={STEP_Y[0]}
          x2={AXIS_X}
          y2={STEP_Y[STEP_Y.length - 1]}
          stroke="#334155"
        />

        {STEPS.map((step, index) => {
          const y = STEP_Y[index];
          return (
            <g key={step.name}>
              <circle
                cx={AXIS_X}
                cy={y}
                r="7"
                fill="#0f172a"
                stroke={step.color}
                strokeOpacity="0.8"
              />
              <text
                x={AXIS_X}
                y={y + 3.5}
                fontSize="10"
                fontWeight="700"
                fill={step.color}
                textAnchor="middle"
              >
                {index + 1}
              </text>
              <text x="38" y={y + 4} fontSize="10" fontWeight="700" fill="#e2e8f0">
                {step.name}
              </text>
              <text x="304" y={y + 4} fontSize="10" fill="#94a3b8" textAnchor="end">
                {step.detail}
              </text>
            </g>
          );
        })}

        <text x="12" y="170" fontSize="10" fill="#64748b">
          M600 ставят между слоями — не внутри слоя
        </text>
      </svg>
    </VisualWrapper>
  );
}
