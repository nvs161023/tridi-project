import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Две панели: норма 12…158, перелив 162…308, 22…106. */
const PANEL_TOP = 22;
const PANEL_H = 84;
const PANEL_X = [12, 162];
const PANEL_CENTER = [85, 235];

/** Контур стенки и линии-слои: у перелива они шире контура. */
const CONTOUR_TOP = 44;
const CONTOUR_W = 56;
const CONTOUR_H = 40;
const CONTOUR_OFFSET = 40;
const LAYER_Y = [46, 56, 66, 76];
const LAYER_H = 6;
const OVER_STEP = 70;
const OVER_OFFSET = 33;

const NOTES = [
  "ширина линии 105–115 % сопла: 0,42–0,46 мм",
  "высота слоя 25–75 % сопла · температура −5 °C",
  "Z-offset +0,02–0,04 мм · смятый торец сопла меняют",
];

type State = { title: string; color: string; over: boolean; note: string };

/** Из блока 11: норма 0,45 мм, при потоке 107 % стенка выходит 0,5–0,58 мм. */
const STATES: State[] = [
  { title: "норма · 0,45 мм", color: "#10b981", over: false, note: "размеры в норме" },
  { title: "перелив · 0,5–0,58 мм", color: "#f59e0b", over: true, note: "размеры +0,1–0,3 мм" },
];

/**
 * Кадр блока 12 урока L7 «Перелив: волны и наплывы».
 *
 * Слева стенка в норме: линии легли ровно в контур. Справа перелив: линии шире
 * контура, верх идёт волной, размеры уходят в плюс на 0,1–0,3 мм. Снизу три
 * ручки: ширина линии, высота слоя, температура и Z-offset.
 *
 * Числа — из блока 11: ширина линии 105–115 % сопла (0,42–0,46 мм), высота слоя
 * 25–75 % сопла, температура минус 5 °C от верхней границы, Z-offset плюс
 * 0,02–0,04 мм, стенка 0,5–0,58 мм вместо 0,45 при множителе 107 %.
 */
export function Basic7Diagram3({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Перелив и волнистая поверхность: в норме линии ложатся в контур стенки шириной 0,45 мм, при переливе линии шире контура, верх идёт волнами, размеры уходят в плюс на 0,1–0,3 мм, а стенка выходит 0,5–0,58 мм. Ручки: ширина линии 105–115 процентов сопла, высота слоя 25–75 процентов сопла, температура минус 5 градусов и Z-offset плюс 0,02–0,04 мм"
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
          Перелив: волны и наплывы
        </text>

        {/* Норма и перелив: линии в контуре и линии шире контура */}
        {STATES.map((state, index) => {
          const center = PANEL_CENTER[index];
          const x0 = PANEL_X[index];
          const contourX = x0 + CONTOUR_OFFSET;
          const overX = x0 + OVER_OFFSET;

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
              <text x={center} y="36" fontSize="10" fontWeight="700" fill={state.color} textAnchor="middle">
                {state.title}
              </text>
              <rect
                x={contourX}
                y={CONTOUR_TOP}
                width={CONTOUR_W}
                height={CONTOUR_H}
                fill="none"
                stroke={state.over ? "#64748b" : state.color}
                strokeDasharray={state.over ? "3 3" : undefined}
              />
              {LAYER_Y.map((y) => (
                <rect
                  key={y}
                  x={state.over ? overX : contourX + 2}
                  y={y}
                  width={state.over ? OVER_STEP : CONTOUR_W - 4}
                  height={LAYER_H}
                  rx="3"
                  fill={state.color}
                  fillOpacity="0.55"
                />
              ))}
              {state.over && (
                <path
                  d={`M${overX} 42 q8 -4 16 0 q8 4 16 0 q8 -4 16 0 q8 4 16 0`}
                  fill="none"
                  stroke={state.color}
                  strokeWidth="3"
                />
              )}
              <text x={center} y="98" fontSize="10" fill="#94a3b8" textAnchor="middle">
                {state.note}
              </text>
            </g>
          );
        })}

        {/* Сноски: три ручки из блока 11 */}
        {NOTES.map((note, index) => {
          const top = 110 + index * 24;
          const height = index === NOTES.length - 1 ? 18 : 20;

          return (
            <g key={note}>
              <rect
                x="12"
                y={top}
                width="296"
                height={height}
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
