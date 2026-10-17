import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const STEPS = [
  { n: "1", label: "партия", height: 20, color: "#06b6d4" },
  { n: "2", label: "повторный", height: 30, color: "#3b82f6" },
  { n: "3", label: "помощник", height: 40, color: "#8b5cf6" },
  { n: "4", label: "витрина", height: 50, color: "#f59e0b" },
  { n: "5", label: "техника", height: 60, color: "#10b981" },
];

/**
 * Кадр блока 31 урока Z8 «Финальный проект: свой продукт».
 *
 * `Z8_scale_ladder.png`: пять ступеней масштаба — размер партии, повторный
 * заказ, помощник, витрина и оборудование. Каждый шаг примерно вдвое и только
 * после того, как цифры журнала подтвердили предыдущий.
 */
export function ProfitZ8Image6({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Лестница масштаба из пяти ступеней: размер партии, повторный заказ, помощник, витрина и оборудование. Каждый шаг примерно вдвое — пять, десять, двадцать штук — и только после того, как цифры журнала подтвердили предыдущий. Сначала спрос, потом вложения. Если часы растут быстрее прибыли — стоп. Если спрос упал — ступень ниже"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="11" fontWeight="700" fill="#e2e8f0">
          лестница масштаба
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          пять ступеней · каждая — после цифр журнала
        </text>
        <rect x="246" y="5" width="64" height="14" rx="7" fill="#10b981" fillOpacity="0.15" stroke="#10b981" strokeOpacity="0.5" />
        <text x="278" y="15" fontSize="10" fontWeight="700" fill="#34d399" textAnchor="middle">
          5 ступеней
        </text>

        {STEPS.map((step, index) => {
          const x = 10 + index * 60;
          const top = 110 - step.height;
          const center = x + 30;
          return (
            <g key={step.n}>
              <text x={center} y={top - 5} fontSize="10" fontWeight="700" fill="#cbd5e1" textAnchor="middle">
                {step.label}
              </text>
              <rect x={x} y={top} width="60" height={step.height} fill={step.color} fillOpacity="0.18" stroke={step.color} strokeOpacity="0.65" />
              <text x={center} y={top + 13} fontSize="10" fontWeight="700" fill={step.color} textAnchor="middle">
                {step.n}
              </text>
            </g>
          );
        })}

        <rect x="10" y="116" width="300" height="60" rx="5" fill="#0f172a" stroke="#334155" />
        <text x="18" y="130" fontSize="10" fontWeight="700" fill="#cbd5e1">
          сначала спрос, потом вложения
        </text>
        <text x="18" y="143" fontSize="10" fill="#94a3b8">
          шаг примерно вдвое: 5 → 10 → 20 штук
        </text>
        <text x="18" y="156" fontSize="10" fill="#f87171">
          часы растут быстрее прибыли → стоп
        </text>
        <text x="18" y="169" fontSize="10" fill="#94a3b8">
          спрос упал → ступень ниже, снова тест
        </text>
      </svg>
    </VisualWrapper>
  );
}
