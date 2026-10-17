import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

type Step = {
  n: string;
  question: string;
  first: string;
  second: string;
  color: string;
};

/** Пять шагов выбора материала из блока 24. */
const STEPS: Step[] = [
  {
    n: "1",
    question: "температура",
    first: "салон — PETG · ASA",
    second: "подкапотка — PA · PC · PA-CF",
    color: "#3b82f6",
  },
  {
    n: "2",
    question: "нагрузка",
    first: "сжатие — PA · PC",
    second: "удар — PA · жёсткость — PA-CF",
    color: "#10b981",
  },
  {
    n: "3",
    question: "химия · солнце",
    first: "улица — ASA",
    second: "ABS мутнеет · PETG медленнее",
    color: "#f59e0b",
  },
  {
    n: "4",
    question: "трение",
    first: "POM · PA",
    second: "PLA скрипит и стирается",
    color: "#f87171",
  },
  {
    n: "5",
    question: "печать · крепёж",
    first: "PA · PC — сушка",
    second: "PA-CF — стальное сопло",
    color: "#fcd34d",
  },
];

/**
 * Кадр блока 25 урока IN1 «Инженерные материалы и совместимость».
 *
 * Макет из описания кадра `IN1_choose_material.png`: дерево выбора из пяти
 * шагов блока 24 — от условий к материалу. Слева вопросы по порядку, справа
 * ответы: температура, нагрузка, химия, трение, печатаемость и крепёж.
 */
export function EngineerIN1Image6({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Дерево выбора материала: пять шагов от задачи к пластику. Температура: для салона PETG или ASA, для подкапотного пространства PA, PC или PA-CF. Нагрузка: сжатие держат PA и PC, удар — PA, жёсткость — PA-CF. Химия и солнце: для улицы ASA, ABS мутнеет, PETG медленнее. Трение: POM и PA, PLA скрипит и стирается. Печать и крепёж: PA и PC сушат, под PA-CF нужно стальное сопло. Запас до рабочей температуры 20–30 °C"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          от задачи к материалу
        </text>
        <text x="304" y="15" fontSize="10" fill="#fcd34d" textAnchor="end">
          HDT + 20–30 °C
        </text>

        <line x1="20" y1="33" x2="20" y2="159" stroke="#475569" />

        {STEPS.map((step, index) => {
          const y = 40 + index * 28;
          return (
            <g key={step.n}>
              <circle cx="20" cy={y} r="7" fill="#1e293b" stroke={step.color} />
              <text x="20" y={y + 3.5} fontSize="10" fontWeight="700" fill={step.color} textAnchor="middle">
                {step.n}
              </text>

              <text x="32" y={y + 3} fontSize="10" fontWeight="700" fill="#e2e8f0">
                {step.question}
              </text>
              <text x="304" y={y - 4} fontSize="10" fill="#cbd5e1" textAnchor="end">
                {step.first}
              </text>
              <text x="304" y={y + 9} fontSize="10" fill="#94a3b8" textAnchor="end">
                {step.second}
              </text>
            </g>
          );
        })}
      </svg>
    </VisualWrapper>
  );
}
