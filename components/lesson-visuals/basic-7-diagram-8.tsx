import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Две панели: провис 12…158, чистый мост 162…308, 20…102. */
const PANEL_TOP = 20;
const PANEL_H = 82;
const PANEL_X = [12, 162];
const PANEL_CENTER = [85, 235];
const WALL_W = 14;
const WALL_TOP = 48;
const WALL_H = 38;
const WALL_A = 30;
const WALL_B = 92;
const SPAN = { from: WALL_A + WALL_W, to: WALL_B };
const SAG_Y = [56, 64, 72];
const SAG_DROP = 12;
const STRAIGHT_Y = [56, 64, 72, 80];

const LEAD = "мост держат обдув, скорость и геометрия";
const LEAD_NOTE = "пролёт больше 30–50 мм и угол круче 60° — поддержки";
const NOTES = [
  "−5 °C на мосту · обдув PLA 100 %, PETG 60–80 %",
  "скорость моста 20–30 мм/с · пролёты 20 / 30 / 40 мм",
];

type State = { title: string; color: string; sag: boolean; note: string };

/** Проблема 9: расплав не успевает застыть, пока линия висит без опоры. */
const STATES: State[] = [
  {
    title: "провисшие мосты",
    color: "#f87171",
    sag: true,
    note: "провис: норма до 0,3 мм",
  },
  {
    title: "чистый мост",
    color: "#10b981",
    sag: false,
    note: "низ моста ровный",
  },
];

/**
 * Кадр блока 21 урока L7 «Мост: провис и чистый мост».
 *
 * Две стенки с пролётом: слева нити моста провисают дугой, справа ложатся ровно.
 * Снизу ручки — обдув мостов, скорость, температура и геометрия пролёта.
 *
 * Числа — из проблемы 9: пролёт больше 30–50 мм и угол круче 60° без поддержек
 * не вытянуть, обдув 100 % для PLA и 60–80 % для PETG, скорость моста
 * 20–30 мм/с, температура минус 5 °C, нормальный провис 0,1–0,3 мм, тест
 * мостов — три пролёта 20, 30 и 40 мм.
 */
export function Basic7Diagram8({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Провисшие мосты: под перемычкой между двумя стенками нити провисают дугой, иногда рвутся. Справа тот же пролёт, но линии ложатся ровно. Мост держат обдув, скорость и геометрия: обдув мостов 100 процентов для PLA и 60–80 для PETG, скорость моста 20–30 миллиметров в секунду, температура минус 5 градусов. Пролёт больше 30–50 мм и угол круче 60 градусов — только поддержки. Проверка — тест мостов с пролётами 20, 30 и 40 мм, нормальный провис 0,1–0,3 мм"
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
          Мост: провис и чистый мост
        </text>

        {/* Пролёт между стенками: дуги против ровных линий */}
        {STATES.map((state, index) => {
          const x0 = PANEL_X[index];
          const center = PANEL_CENTER[index];

          return (
            <g key={state.title}>
              <rect
                x={x0}
                y={PANEL_TOP}
                width="146"
                height={PANEL_H}
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <text
                x={center}
                y="34"
                fontSize="10"
                fontWeight="700"
                fill={state.color}
                textAnchor="middle"
              >
                {state.title}
              </text>
              {[WALL_A, WALL_B].map((offset) => (
                <rect
                  key={offset}
                  x={x0 + offset}
                  y={WALL_TOP}
                  width={WALL_W}
                  height={WALL_H}
                  rx="2"
                  fill="#3b82f6"
                  fillOpacity="0.25"
                  stroke="#3b82f6"
                />
              ))}
              {state.sag
                ? SAG_Y.map((y) => (
                    <path
                      key={y}
                      d={`M${x0 + SPAN.from} ${y} Q${x0 + (SPAN.from + SPAN.to) / 2} ${y + SAG_DROP} ${x0 + SPAN.to} ${y}`}
                      fill="none"
                      stroke={state.color}
                      strokeWidth="1.5"
                    />
                  ))
                : STRAIGHT_Y.map((y) => (
                    <line
                      key={y}
                      x1={x0 + SPAN.from}
                      y1={y}
                      x2={x0 + SPAN.to}
                      y2={y}
                      stroke={state.color}
                      strokeWidth="1.5"
                    />
                  ))}
              {state.sag && (
                <line
                  x1={x0 + SPAN.from}
                  y1={WALL_TOP + WALL_H - 2}
                  x2={x0 + SPAN.to}
                  y2={WALL_TOP + WALL_H - 2}
                  stroke={state.color}
                  strokeOpacity="0.6"
                />
              )}
              <text x={center} y="96" fontSize="10" fill={state.color} textAnchor="middle">
                {state.note}
              </text>
            </g>
          );
        })}

        {/* Ручки: обдув, скорость, температура и геометрия */}
        <rect
          x="12"
          y="106"
          width="296"
          height="24"
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        <text x="22" y="118" fontSize="10" fontWeight="700" fill="#e2e8f0">
          {LEAD}
        </text>
        <text x="22" y="128" fontSize="10" fill="#94a3b8">
          {LEAD_NOTE}
        </text>
        {NOTES.map((note, index) => (
          <g key={note}>
            <rect
              x="12"
              y={134 + index * 24}
              width="296"
              height={index === 1 ? 18 : 20}
              rx="6"
              fill="#0f172a"
              fillOpacity="0.35"
              stroke="#475569"
              strokeOpacity="0.55"
            />
            <text x="22" y={147 + index * 24} fontSize="10" fill="#94a3b8">
              {note}
            </text>
          </g>
        ))}

      </svg>
    </VisualWrapper>
  );
}
