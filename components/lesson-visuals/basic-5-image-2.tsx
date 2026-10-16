import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Три панели по 96 px с зазором 4: 12…108, 112…208, 212…308. */
const PANEL_X = 12;
const PANEL_W = 96;
const PANEL_STEP = 100;
const PANEL_TOP = 26;
const PANEL_H = 78;

/** Внутри панели: подпись, шаг Z-offset, рисунок. */
const HEAD_Y = 40;
const STEP_Y = 53;

/** Плита и тела расплава: линии лежат на плите. */
const PLATE_Y = 90;
const PLATE_H = 7;
const BEAD_TOP = 83;

/** Сопло стоит слева и смотрит вниз: расстояние до линии и есть Z-offset. */
const NOZZLE_CX = 30;
const NOZZLE_TOP = 58;

/** Центры трёх линий первого слоя в панели. */
const BEAD_CENTERS = [26, 48, 70];

const PLATE_FILL = "#334155";
const PLATE_EDGE = "#64748b";
const NOZZLE_FILL = "#475569";
const NOZZLE_EDGE = "#94a3b8";

type State = {
  name: string;
  step: string;
  color: string;
  /** Куда опущен наконечник сопла: в расплав, на поверхность или висит выше. */
  tip: number;
  lines: string[];
  kind: "near" | "normal" | "far";
};

/**
 * Три состояния из подписи блока 19 и текста блока 18: слишком близко — волны
 * и бугорок у сопла, норма — ровная матовая полоса, слишком далеко — линии
 * круглые и между ними просветы. Шаг правки один и тот же: 0,02 мм.
 */
const STATES: State[] = [
  {
    name: "Слишком близко",
    step: "−0,02 мм",
    color: "#f59e0b",
    tip: 84,
    lines: ["волны, бугорок", "перед соплом"],
    kind: "near",
  },
  {
    name: "Норма",
    step: "0",
    color: "#10b981",
    tip: 79,
    lines: ["ровная", "матовая полоса"],
    kind: "normal",
  },
  {
    name: "Слишком далеко",
    step: "+0,02 мм",
    color: "#f59e0b",
    tip: 72,
    lines: ["круглые линии,", "просветы"],
    kind: "far",
  },
];

/** Панели-вывода: шаг правки и физический предел ходового винта (блок 18). */
/** Панели-вывода: шаг правки и физический предел ходового винта (блок 18). */
const NOTES = [
  "шаг правки 0,02 мм, одна правка за печать",
  "винт 2 мм: 200 шагов на оборот = 0,01 мм на шаг",
];



/** Три линии первого слоя: смятые волной, ровные встык или круглые с просветом. */
function Beads({ kind, x0, color }: { kind: State["kind"]; x0: number; color: string }) {
  if (kind === "near") {
    return (
      <path
        d={`M${x0 + 15} ${PLATE_Y} L${x0 + 15} ${BEAD_TOP} q11 -8 22 0 q11 6 22 1 q11 -8 22 0 L${x0 + 81} ${PLATE_Y} Z`}
        fill={color}
        fillOpacity="0.45"
        stroke="#fbbf24"
      />
    );
  }

  if (kind === "normal") {
    return (
      <g>
        {BEAD_CENTERS.map((center) => (
          <rect
            key={center}
            x={x0 + center - 11}
            y={BEAD_TOP}
            width="22"
            height={PLATE_Y - BEAD_TOP}
            rx="3"
            fill={color}
            fillOpacity="0.45"
            stroke="#34d399"
          />
        ))}
      </g>
    );
  }

  return (
    <g>
      {BEAD_CENTERS.map((center) => (
        <circle
          key={center}
          cx={x0 + center}
          cy={PLATE_Y - 4.5}
          r="4.5"
          fill={color}
          fillOpacity="0.4"
          stroke="#fbbf24"
        />
      ))}
    </g>
  );
}

/**
 * Кадр блока 19 урока L5 «Слишком близко, норма, слишком далеко».
 *
 * Компоновка — триптих: три панели по 96 px. В каждой панели подпись состояния,
 * значение шага Z-offset и разрез первого слоя: сопло слева, три линии расплава
 * на плите. Сверху вниз, как читают тест: близко — расплав смят волной и бугорок
 * перед соплом, норма — линии ровно встык матовой полосой, далеко — линии
 * круглые и между ними просветы до стола. Под панелями две строки-подписи, ниже
 * панель-вывод с шагом правки и пределом ходового винта.
 *
 * Смысловые числа — из блоков 18 и 19: шаг правки 0,02 мм, первый слой 0,2 мм,
 * ходовой винт 2 мм и 200 шагов на оборот = 0,01 мм на шаг. Смещения −0,02 и
 * +0,02 мм — это один шаг практической сетки в каждую сторону.
 */
export function Basic5Image2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Три состояния первого слоя по Z-offset: слишком близко, когда расплав идёт волнами и перед соплом встаёт бугорок; норма с ровной матовой полосой из линий встык; слишком далеко, когда линии ложатся круглыми и между ними видны просветы до стола. Шаг правки 0,02 мм, винт 2 мм: 200 шагов на оборот дают 0,01 мм на шаг"
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
          Z-offset: три состояния
        </text>

        {/* Триптих: подпись, шаг, разрез первого слоя и строки-подписи */}
        {STATES.map((state, index) => {
          const x0 = PANEL_X + index * PANEL_STEP;

          return (
            <g key={state.name}>
              <rect
                x={x0}
                y={PANEL_TOP}
                width={PANEL_W}
                height={PANEL_H}
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <text x={x0 + 6} y={HEAD_Y} fontSize="10" fontWeight="700" fill={state.color}>
                {state.name}
              </text>
              <text x={x0 + 6} y={STEP_Y} fontSize="10" fill="#94a3b8">
                {state.step}
              </text>

              <rect
                x={x0 + 8}
                y={PLATE_Y}
                width="80"
                height={PLATE_H}
                rx="2"
                fill={PLATE_FILL}
                stroke="#475569"
              />
              <line x1={x0 + 8} y1={PLATE_Y} x2={x0 + 88} y2={PLATE_Y} stroke={PLATE_EDGE} />

              <Beads kind={state.kind} x0={x0} color={state.color} />

              <path
                d={`M${x0 + NOZZLE_CX - 9} ${NOZZLE_TOP} L${x0 + NOZZLE_CX + 9} ${NOZZLE_TOP} L${x0 + NOZZLE_CX + 4} ${state.tip} L${x0 + NOZZLE_CX - 4} ${state.tip} Z`}
                fill={NOZZLE_FILL}
                stroke={NOZZLE_EDGE}
              />

              {state.lines.map((line, lineIndex) => (
                <text key={line} x={x0 + 6} y={116 + lineIndex * 12} fontSize="9" fill="#94a3b8">
                  {line}
                </text>
              ))}
            </g>
          );
        })}

        {/* Панель-вывод: шаг правки и предел ходового винта */}
        <rect
          x="12"
          y="138"
          width="296"
          height="32"
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        {NOTES.map((note, index) => (
          <text key={note} x="22" y={150 + index * 12} fontSize="10" fill="#94a3b8">
            {note}
          </text>
        ))}
      </svg>
    </VisualWrapper>
  );
}
