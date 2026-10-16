import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Шесть шагов сборки: ряды по 25 начиная с 20, чип и текст слева. */
const STEP_Y = [20, 45, 70, 95, 120, 145];
const CHIP_X = 30;
const TEXT_X = 46;

type Step = { title: string; note: string; color: string };

/** Шаги сборки бокса — блок 13: шесть шагов, порядок зафиксирован там же. */
const STEPS: Step[] = [
  {
    title: "Корпус и размеры",
    note: "запас 5–10 см вокруг, стенка прозрачная",
    color: "#64748b",
  },
  {
    title: "Вентилятор и поток",
    note: "100–125 мм, от 150 м³/ч, через уплотнитель",
    color: "#cbd5e1",
  },
  {
    title: "Предфильтр и HEPA",
    note: "грубый первым, за ним HEPA H13 в рамке",
    color: "#3b82f6",
  },
  {
    title: "Уголь после HEPA",
    note: "вентилятор последним: внутри разрежение",
    color: "#f59e0b",
  },
  {
    title: "Герметизация стыков",
    note: "уплотнитель: крышка, гофра и рама фильтра",
    color: "#f87171",
  },
  {
    title: "Проверка и запись",
    note: "фон, печать и +15 минут; дата на корпусе",
    color: "#10b981",
  },
];

/**
 * Кадр блока 13 урока C2 «Собрать фильтр-бокс самому».
 *
 * Шесть шагов сборки из шагов самого блока: корпус с запасом 5–10 см, прозрачной
 * стенкой и материалом под 60 °C, канальный вентилятор 100–125 мм с паспортным
 * потоком от 150 м³/ч на уплотнителе, грубый предфильтр первым и HEPA H13 в рамке,
 * угольная кассета после HEPA с вентилятором в конце потока (внутри остаётся
 * разрежение), герметизация крышки, гофры и рамы, проверка счётчиком с записью
 * даты установки фильтров на корпусе. Кадр `C2_airflow.png` стоит у этого блока, а
 * «воздух идёт в одну сторону» — описание соседнего кадра `C2_box_diy.png`
 * (блок 14).
 */
export function ConfidentC2Steps0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Собрать фильтр-бокс самому: шесть шагов. Первый — корпус и размеры: контейнер с запасом 5–10 см вокруг принтера и прозрачной стенкой. Второй — вентилятор и поток: канальный 100–125 мм с потоком от 150 кубометров в час, крепление через уплотнитель. Третий — предфильтр и HEPA: грубый предфильтр первым, за ним HEPA H13 в рамке. Четвёртый — уголь после HEPA, вентилятор последним, внутри остаётся разрежение. Пятый — герметизация стыков: крышка, гофра и рама фильтра. Шестой — проверка и запись: фон, печать и пятнадцать минут после остановки, дата на корпусе. Поток идёт в одну сторону"
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
          Собрать фильтр-бокс самому
        </text>
        <text x="308" y="15" fontSize="10" fill="#64748b" textAnchor="end">
          поток в одну сторону
        </text>

        <rect
          x="12"
          y="18"
          width="296"
          height="156"
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        <line x1={CHIP_X} y1="33" x2={CHIP_X} y2="157" stroke="#475569" strokeOpacity="0.7" />

        {STEPS.map((step, index) => {
          const y = STEP_Y[index];
          return (
            <g key={step.title}>
              <circle
                cx={CHIP_X}
                cy={y + 12}
                r="9"
                fill={step.color}
                fillOpacity="0.18"
                stroke={step.color}
                strokeOpacity="0.7"
              />
              <text
                x={CHIP_X}
                y={y + 16}
                fontSize="10"
                fill={step.color}
                textAnchor="middle"
              >
                {index + 1}
              </text>
              <text x={TEXT_X} y={y + 9} fontSize="12" fontWeight="700" fill={step.color}>
                {step.title}
              </text>
              <text x={TEXT_X} y={y + 20} fontSize="10" fill="#94a3b8">
                {step.note}
              </text>
            </g>
          );
        })}
      </svg>
    </VisualWrapper>
  );
}
