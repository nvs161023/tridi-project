import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Пять ступеней: панель 12…308, полосы 20…146, шаг 26, высота полосы 22. */
const ROW_Y = [20, 46, 72, 98, 124];
const BAR_H = 22;
const BAR_X = 12;
const TAG_X = 194;

type Step = { name: string; bar: number; tag: string; color: string };

/** Порядок выбросов — блок 4 и итог блока 30, пометки — блок 5. */
const STEPS: Step[] = [
  { name: "PC", bar: 136, tag: "органики больше всего", color: "#f87171" },
  { name: "PA и композиты", bar: 116, tag: "высокая температура", color: "#f59e0b" },
  { name: "ABS и ASA", bar: 96, tag: "частиц в разы больше", color: "#f59e0b" },
  { name: "PETG", bar: 76, tag: "запах заметнее", color: "#3b82f6" },
  { name: "PLA", bar: 56, tag: "минимум выбросов", color: "#10b981" },
];

const LEAD = "вне шкалы — смолы, порошки, металлы: отдельная зона";

/**
 * Кадр блока 4 урока C1 «Пирамида выбросов».
 *
 * Пять ступеней снизу вверх: PLA, PETG, ABS с ASA, PA и композиты, PC. Ширина
 * полосы — оценка выбросов, а не измеренная величина: в тексте урока сравнивают
 * материалы словами. Порядок взят из блока 4 («PLA внизу, PA и PC наверху, выше
 * PETG и ABS с ASA») и повторён в итоге блока 30 («PLA, PETG, ABS и ASA, дальше
 * PA с композитами и PC»). Пометки справа — из блока 5: PLA даёт минимум и по
 * частицам, и по VOC, у PETG запах заметнее, ABS и ASA дают частиц в разы
 * больше, PA печатают при высокой температуре, у PC температуры самые высокие.
 * Смолы, порошки и металлы стоят вне этой шкалы (блоки 4 и 9).
 */
export function ConfidentC1Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Пирамида выбросов: пять ступеней снизу вверх — PLA, PETG, ABS и ASA, PA и композиты, PC. Ширина полосы растёт вместе с выбросами. PLA даёт минимум и по частицам, и по VOC, у PETG запах заметнее, ABS и ASA дают частиц в разы больше, PA печатают при высокой температуре, у PC температура самая высокая и органики больше всего. Вне шкалы стоят смолы, порошки и металлы: для них техника — в отдельной зоне"
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
          Пирамида выбросов: от PLA к PC
        </text>

        {/* Пять ступеней: чем выше полоса, тем больше выбросов */}
        {STEPS.map((step, index) => (
          <g key={step.name}>
            <rect
              x={BAR_X}
              y={ROW_Y[index]}
              width={step.bar}
              height={BAR_H}
              rx="4"
              fill={step.color}
              fillOpacity="0.22"
              stroke={step.color}
              strokeOpacity="0.75"
            />
            <text
              x={BAR_X + 8}
              y={ROW_Y[index] + 15}
              fontSize="12"
              fontWeight="700"
              fill={step.color}
            >
              {step.name}
            </text>
            <text x={TAG_X} y={ROW_Y[index] + 15} fontSize="10" fill="#94a3b8">
              {step.tag}
            </text>
          </g>
        ))}

        {/* Вне шкалы: у смол, порошков и металлов свой путь защиты */}
        <rect
          x="12"
          y="152"
          width="296"
          height="20"
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        <text x="22" y="165" fontSize="10" fontWeight="700" fill="#e2e8f0">
          {LEAD}
        </text>
      </svg>
    </VisualWrapper>
  );
}
