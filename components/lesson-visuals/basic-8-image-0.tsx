import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Четыре карточки 2 × 2: 12…158 и 162…308, ряды 20 и 62. */
const CARD_X = [12, 162];
const CARD_Y = [20, 62];
const CARD_W = 146;
const CARD_H = 40;
const LINE_X1 = 10;
const LINE_X2 = 136;

const LEAD = "плохой первый слой — стоп: две минуты против часа";
const LEAD_NOTE = "первые 5–10 минут решают судьбу печати";
const NOTES = [
  "линии плоские и прижатые, углы и кайма на месте",
  "тест № 1 из урока 5 — квадрат 20 на 20 мм, три минуты",
];

type State = {
  name: string;
  color: string;
  kind: "flat" | "gaps" | "wavy" | "round";
};

/** Четыре состояния из блока 18: норма, щели, вдавлено, пустоты. */
const STATES: State[] = [
  { name: "норма 0,45 мм", color: "#10b981", kind: "flat" },
  { name: "щели: недодача", color: "#f59e0b", kind: "gaps" },
  { name: "вдавлено: Z-offset", color: "#f87171", kind: "wavy" },
  { name: "пустоты: круглые", color: "#f87171", kind: "round" },
];

/**
 * Кадр блока 18 урока L8 «Первый слой вживую: четыре состояния».
 *
 * Четыре карточки с рисунком линий первого слоя: норма — плоские прижатые
 * линии, щели — тонкая недодача, вдавлено — волны от низкого сопла, пустоты —
 * круглые отдельные линии. Снизу два правила из блока 19: линии без щелей и
 * «гребёнки», плохой первый слой — стоп, потому что две минуты дешевле часа.
 *
 * Числа — из блоков 17 и 19: первые 5–10 минут решают судьбу печати, тест № 1
 * из урока 5 это квадрат 20 на 20 мм на три минуты, норма стенки 0,45 мм.
 */
export function Basic8Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Первый слой вживую: четыре состояния — норма с прижатыми плоскими линиями 0,45 мм, щели от недодачи, вдавленный слой от слишком низкого сопла и пустоты с круглыми отдельными линиями. Линии должны быть плоскими и прижатыми, без щелей и без гребёнки, углы и кайма на месте. Первые 5–10 минут решают судьбу печати, а плохой первый слой — стоп: две минуты против часа печати. Тест номер один из урока пять — квадрат 20 на 20 мм на три минуты"
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
          Первый слой вживую: четыре состояния
        </text>

        {/* Линии первого слоя в четырёх состояниях */}
        {STATES.map((state, index) => {
          const x0 = CARD_X[index % 2];
          const y0 = CARD_Y[Math.floor(index / 2)];
          const lines = [y0 + 20, y0 + 26, y0 + 32, y0 + 38];
          return (
            <g key={state.name}>
              <rect
                x={x0}
                y={y0}
                width={CARD_W}
                height={CARD_H}
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <text x={x0 + LINE_X1} y={y0 + 13} fontSize="10" fontWeight="700" fill={state.color}>
                {state.name}
              </text>
              {state.kind === "flat" &&
                lines.map((y) => (
                  <line
                    key={y}
                    x1={x0 + LINE_X1}
                    y1={y}
                    x2={x0 + LINE_X2}
                    y2={y}
                    stroke={state.color}
                    strokeWidth="2"
                    strokeOpacity="0.8"
                  />
                ))}
              {state.kind === "gaps" &&
                lines.map((y) => (
                  <g key={y}>
                    <line
                      x1={x0 + LINE_X1}
                      y1={y}
                      x2={x0 + LINE_X2}
                      y2={y}
                      stroke={state.color}
                      strokeOpacity="0.5"
                    />
                    <line
                      x1={x0 + LINE_X1 + 26}
                      y1={y}
                      x2={x0 + LINE_X1 + 34}
                      y2={y}
                      stroke="#0f172a"
                      strokeWidth="2"
                    />
                    <line
                      x1={x0 + LINE_X1 + 86}
                      y1={y}
                      x2={x0 + LINE_X1 + 94}
                      y2={y}
                      stroke="#0f172a"
                      strokeWidth="2"
                    />
                  </g>
                ))}
              {state.kind === "wavy" &&
                [y0 + 22, y0 + 30, y0 + 38].map((y) => (
                  <path
                    key={y}
                    d={`M${x0 + LINE_X1} ${y} q21 -5 42 0 q21 5 42 0 q11 -3 21 -2`}
                    fill="none"
                    stroke={state.color}
                    strokeOpacity="0.8"
                  />
                ))}
              {state.kind === "round" &&
                [y0 + 22, y0 + 30, y0 + 38].map((y) => (
                  <line
                    key={y}
                    x1={x0 + LINE_X1}
                    y1={y}
                    x2={x0 + LINE_X2}
                    y2={y}
                    stroke={state.color}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="30 6"
                    strokeOpacity="0.8"
                  />
                ))}
            </g>
          );
        })}

        {/* Правила первого слоя */}
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
