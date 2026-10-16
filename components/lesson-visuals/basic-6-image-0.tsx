import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Три панели по 96 px и зазор 4 px: 12…108, 112…208, 212…308. */
const PANEL_TOP = 22;
const PANEL_H = 104;
const PANEL_W = 96;
const PANEL_X = [12, 112, 212];
const PANEL_CENTER = [60, 160, 260];

/** Стенка — вид сверху: пять линий с шагом 14 px, 56…102. */
const WALL_TOP = 56;
const WALL_H = 46;
const WALL_PITCH = 14;
const WALL_LINES = [0, 1, 2, 3, 4];

/** Панели-вывода под панелями: 132…152 и 156…176. */
const NOTE_TOP = 132;
const NOTE_H = 20;
const NOTE_STEP = 24;

type State = {
  temp: string;
  speed: string;
  color: string;
  kind: "gaps" | "solid" | "limit";
  verdict: string;
  meaning: string;
};

/**
 * Три состояния одной стенки — ровно по подписи блока 7: 200 °C на 80 мм/с дают
 * щели (расплав не успевает прогреться), 220 °C на 80 мм/с дают плотную стенку,
 * а 220 °C на 140 мм/с упираются в предел потока.
 */
const STATES: State[] = [
  {
    temp: "200 °C",
    speed: "80 мм/с",
    color: "#f87171",
    kind: "gaps",
    verdict: "щели",
    meaning: "недодача",
  },
  {
    temp: "220 °C",
    speed: "80 мм/с",
    color: "#10b981",
    kind: "solid",
    verdict: "плотная",
    meaning: "стенка",
  },
  {
    temp: "220 °C",
    speed: "140 мм/с",
    color: "#f59e0b",
    kind: "limit",
    verdict: "предел",
    meaning: "потока",
  },
];

/** Панели-вывода: щели при 200 °C и предел потока при 140 мм/с. */
const NOTES = [
  "200 °C на 80 мм/с: расплав шёл полутвёрдым — щели",
  "220 °C на 140 мм/с — предел потока, выше только хуже",
];

/** Стенка сверху: линии с просветами, линии встык или волнистые линии. */
function Wall({ kind, center, color }: { kind: State["kind"]; center: number; color: string }) {
  const start = center - 35;

  if (kind === "gaps") {
    return (
      <g>
        {WALL_LINES.map((line) => (
          <rect
            key={line}
            x={start + line * WALL_PITCH}
            y={WALL_TOP}
            width="7"
            height={WALL_H}
            rx="3"
            fill={color}
            fillOpacity="0.85"
          />
        ))}
      </g>
    );
  }

  if (kind === "solid") {
    return (
      <g>
        {WALL_LINES.map((line) => (
          <rect
            key={line}
            x={start + line * WALL_PITCH}
            y={WALL_TOP}
            width={WALL_PITCH}
            height={WALL_H}
            fill={color}
            fillOpacity="0.7"
          />
        ))}
      </g>
    );
  }

  return (
    <g>
      {WALL_LINES.map((line) => (
        <path
          key={line}
          d={`M${start + line * WALL_PITCH + 6} ${WALL_TOP + 2} q3 10.5 0 21 q-3 10.5 0 21`}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeOpacity="0.75"
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

/**
 * Кадр блока 7 урока L6 «Одна и та же стенка: 200 и 220 °C на 80 и 140 мм/с».
 *
 * Компоновка — три панели в ряд: температура и скорость сверху, вид стенки сверху
 * в середине и короткий вердикт под ним. Красная панель показывает щели между
 * линиями, зелёная — линии встык, янтарная — волну на пределе потока.
 *
 * Числа — из подписи блока 7 и блока 6: окно PLA 200–220 °C, шаг 5 °C, обдув
 * рабочий, выше верхней границы окна начинается паутина и оплыв мелочи.
 */
export function Basic6Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Одна и та же стенка при трёх режимах: 200 градусов на 80 мм в секунду дают щели между линиями, это недодача; 220 градусов на 80 мм в секунду дают плотную стенку; 220 градусов на 140 мм в секунду упираются в предел потока, и линии начинают плыть. Выше верхней границы окна начинается паутина и оплыв мелочи, поэтому температуру поднимают шагом 5 градусов и смотрят на стенку и на струны"
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
          Одна стенка: 200 и 220 °C, 80 и 140 мм/с
        </text>

        {/* Три режима: температура, скорость и вид стенки сверху */}
        {STATES.map((state, index) => (
          <g key={`${state.temp}-${state.speed}`}>
            <rect
              x={PANEL_X[index]}
              y={PANEL_TOP}
              width={PANEL_W}
              height={PANEL_H}
              rx="6"
              fill="#0f172a"
              fillOpacity="0.35"
              stroke="#475569"
              strokeOpacity="0.55"
            />
            <text
              x={PANEL_CENTER[index]}
              y="38"
              fontSize="12"
              fontWeight="700"
              fill={state.color}
              textAnchor="middle"
            >
              {state.temp}
            </text>
            <text x={PANEL_CENTER[index]} y="50" fontSize="10" fill="#94a3b8" textAnchor="middle">
              {state.speed}
            </text>
            <Wall kind={state.kind} center={PANEL_CENTER[index]} color={state.color} />
            <text
              x={PANEL_CENTER[index]}
              y="113"
              fontSize="10"
              fontWeight="700"
              fill={state.color}
              textAnchor="middle"
            >
              {state.verdict}
            </text>
            <text x={PANEL_CENTER[index]} y="124" fontSize="10" fill="#94a3b8" textAnchor="middle">
              {state.meaning}
            </text>
          </g>
        ))}

        {/* Панели-вывода */}
        {NOTES.map((note, index) => {
          const top = NOTE_TOP + index * NOTE_STEP;

          return (
            <g key={note}>
              <rect
                x="12"
                y={top}
                width="296"
                height={NOTE_H}
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <text x="22" y={top + 13} fontSize="10" fill="#94a3b8">
                {note}
              </text>
            </g>
          );
        })}
      </svg>
    </VisualWrapper>
  );
}
