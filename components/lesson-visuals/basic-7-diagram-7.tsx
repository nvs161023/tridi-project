import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Две панели: оплывший верх 12…158, норма 162…308, 20…102. */
const PANEL_TOP = 20;
const PANEL_H = 82;
const PANEL_X = [12, 162];
const PANEL_CENTER = [85, 235];
const PLATE = { offset: 34, y: 46, w: 90, h: 34 };
const TOP_Y = 44;
const GAP = 14;
const INNER_Y = [56, 66, 76];

const LEAD = "верхним слоям нужно, на что лечь, и чем остыть";
const LEAD_NOTE = "верхних слоёв 4–5 · заполнение под верхом 20–25 %";
const NOTES = [
  "обдув PLA 100 %, PETG 40–60 % · температура −5 °C",
  "тест «крыша» 40 × 40 × 3 · ABS и PC — камера",
];

type State = { title: string; color: string; wavy: boolean; note: string };

/** Проблема 8: верх не находит опоры и не успевает остыть. */
const STATES: State[] = [
  {
    title: "оплывший верх",
    color: "#f59e0b",
    wavy: true,
    note: "верх волной, провалы",
  },
  {
    title: "верх затянут",
    color: "#10b981",
    wavy: false,
    note: "линии слиты, просветов нет",
  },
];

/**
 * Кадр блока 19 урока L7 «Оплывший верх и провалы на плоскости».
 *
 * Слева верхняя плоскость идёт волной и с провалами между линиями, справа линии
 * слиты в ровную поверхность. Снизу ручки: верхние слои, заполнение под верхом,
 * обдув и температура, и короткий тест «крыша».
 *
 * Числа — из проблемы 8: верхних слоёв 4–5, это около 0,8–1 мм, заполнение под
 * верхом 20–25 %, обдув для PLA 100 % и для PETG 40–60 %, температура минус
 * 5 °C на верхних слоях, для ABS и PC работает камера, тест «крыша» — плашка
 * 40 × 40 × 3 мм с заполнением 15 % и тремя верхними слоями.
 */
export function Basic7Diagram7({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Оплывший верх и провалы на плоскости: слева верхняя плоскость волнистая и бугристая, местами провалы между линиями, кромки заплывают. Справа верх затянут ровно, линии слиты, просветов на свет нет. Порядок лечения: верхних слоёв 4–5, это около 0,8–1 мм, заполнение под верхом 20–25 %, обдув для PLA 100 процентов и для PETG 40–60 процентов, температура минус 5 градусов и замедление верхних слоёв, для ABS и PC работает камера. Проверка — тест крыши: плашка 40 на 40 на 3 мм"
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
          Оплывший верх и провалы на плоскости
        </text>

        {/* Плоскость сверху: волна с провалами против ровных линий */}
        {STATES.map((state, index) => {
          const x0 = PANEL_X[index];
          const center = PANEL_CENTER[index];
          const left = x0 + PLATE.offset;
          const right = left + PLATE.w;

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
              <rect
                x={left}
                y={PLATE.y}
                width={PLATE.w}
                height={PLATE.h}
                fill={state.color}
                fillOpacity="0.18"
                stroke={state.color}
              />
              {state.wavy ? (
                <path
                  d={`M${left} ${TOP_Y} q11 -5 22 0 q11 5 22 0 q11 -5 22 0 q11 5 22 0`}
                  fill="none"
                  stroke={state.color}
                  strokeWidth="2"
                />
              ) : (
                <line x1={left} y1={TOP_Y} x2={right} y2={TOP_Y} stroke={state.color} strokeWidth="2" />
              )}
              {INNER_Y.map((y) =>
                state.wavy ? (
                  <g key={y}>
                    <line x1={left + 2} y1={y} x2={left + 36} y2={y} stroke={state.color} />
                    <line x1={left + 36 + GAP} y1={y} x2={right - 2} y2={y} stroke={state.color} />
                  </g>
                ) : (
                  <line key={y} x1={left + 2} y1={y} x2={right - 2} y2={y} stroke={state.color} />
                ),
              )}
              <text x={center} y="96" fontSize="10" fill={state.color} textAnchor="middle">
                {state.note}
              </text>
            </g>
          );
        })}

        {/* Ручки: опора под верхом, охлаждение и тест */}
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
