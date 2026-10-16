import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Бумага — янтарная, щуп — синий: тот же язык, что в кадре про зазор. */
const PAPER = "#f59e0b";
const FEELER = "#3b82f6";

/** Две полосы по 48 px и зазор 3 px: 24…72, 75…123. */
const ROW_TOP = 24;
const ROW_HEIGHT = 48;
const ROW_GAP = 3;

/** Строки полосы: название и значение сверху, пояснение под ними. */
const NAME_Y = 20;
const DETAIL_Y = 36;

/** Рисунок слева, текст с 76, значение в правой колонке. */
const DRAW_X = 22;
const TEXT_X = 76;
const VALUE_X = 252;

/** Две панели-вывода под полосами: 126…147 и 150…171. */
const NOTE_TOP = 126;
const NOTE_H = 21;
const NOTE_STEP = 24;
const NOTE_TEXT_Y = 14;

type Gauge = {
  name: string;
  color: string;
  value: string;
  detail: string;
  kind: "paper" | "feeler";
};

/**
 * Две строки ровно по подписи блока 17: бумага 0,08 мм гуляет по толщине
 * (0,10-0,12 мм от пачки к пачке), щуп 0,10 мм всегда одинаков. Ощупь на шаге 3
 * блока 16: щуп проходит с лёгким сопротивлением, но без зажима.
 */
const GAUGES: Gauge[] = [
  {
    name: "Бумага",
    color: PAPER,
    value: "0,08 мм",
    detail: "толщина гуляет: 0,10–0,12 мм",
    kind: "paper",
  },
  {
    name: "Щуп",
    color: FEELER,
    value: "0,10 мм",
    detail: "одинаков: лёгкое сопротивление без зажима",
    kind: "feeler",
  },
];

/** Панели-вывода: пять точек и шаг правки винтов — оба числа из шагов блока 16. */
const NOTES = [
  "проверка в пяти точках: четыре угла и центр",
  "винт: 1/8 оборота ≈ 0,06–0,12 мм · шаг правки 0,02 мм",
];

/** Рисунок щупа и бумаги: у бумаги толщина плывёт, у щупа одна и та же. */
function Gauge({ kind, top, color }: { kind: Gauge["kind"]; top: number; color: string }) {
  if (kind === "paper") {
    return (
      <g>
        <path
          d={`M${DRAW_X} ${top + 20} q11 -5 22 0 q11 5 22 0 L${DRAW_X + 44} ${top + 28} q-11 5 -22 0 q-11 -5 -22 0 z`}
          fill={color}
          fillOpacity="0.35"
          stroke={color}
        />
        <line x1={DRAW_X + 12} y1={top + 17} x2={DRAW_X + 12} y2={top + 31} stroke="#94a3b8" />
        <line x1={DRAW_X + 34} y1={top + 22} x2={DRAW_X + 34} y2={top + 26} stroke="#94a3b8" />
      </g>
    );
  }

  return (
    <g>
      <rect x={DRAW_X} y={top + 22} width="44" height="4" rx="1" fill="#334155" stroke="#64748b" />
      <line x1={DRAW_X + 10} y1={top + 18} x2={DRAW_X + 10} y2={top + 30} stroke={color} />
      <line x1={DRAW_X + 34} y1={top + 18} x2={DRAW_X + 34} y2={top + 30} stroke={color} />
    </g>
  );
}

/**
 * Кадр блока 17 урока L5 «Бумага или щуп: как поймать момент».
 *
 * Компоновка — две полосы: сверху бумага, снизу щуп. У бумаги толщина нарисована
 * волнистой, а засечки по бокам разной длины — это и есть «гуляет по толщине от
 * пачки к пачке». У щупа полоса ровная и обе засечки одинаковые. Под полосами две
 * панели-вывода из шагов блока 16: проверка щупом 0,10 мм в пяти точках (четыре
 * угла и центр) и шаг правки винтов.
 *
 * Числа — из подписи блока 17: бумага 0,08 мм против 0,10-0,12 мм, щуп 0,10 мм.
 * Восьмая часть оборота винта даёт 0,06-0,12 мм, а Z-offset правят шагами по
 * 0,02 мм — это шаги 4 и 6 блока 16.
 */
export function Basic5Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Бумага или щуп при выставлении зазора: бумага толщиной 0,08 мм гуляет по толщине и даёт 0,10–0,12 мм от пачки к пачке, а щуп 0,10 мм всегда одинаков и проходит с лёгким сопротивлением, но без зажима. Проверка идёт в пяти точках — четыре угла и центр; восьмая часть оборота винта даёт 0,06–0,12 мм, а Z-offset правят шагами по 0,02 мм"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
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
          Бумага или щуп
        </text>

        {/* Две полосы: рисунок, название, значение и пояснение */}
        {GAUGES.map((gauge, index) => {
          const top = ROW_TOP + index * (ROW_HEIGHT + ROW_GAP);

          return (
            <g key={gauge.name}>
              <rect
                x="12"
                y={top}
                width="296"
                height={ROW_HEIGHT}
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <Gauge kind={gauge.kind} top={top} color={gauge.color} />
              <text x={TEXT_X} y={top + NAME_Y} fontSize="12" fontWeight="700" fill={gauge.color}>
                {gauge.name}
              </text>
              <text x={VALUE_X} y={top + NAME_Y} fontSize="12" fontWeight="700" fill="#e2e8f0">
                {gauge.value}
              </text>
              <text x={TEXT_X} y={top + DETAIL_Y} fontSize="10" fill="#94a3b8">
                {gauge.detail}
              </text>
            </g>
          );
        })}

        {/* Панели-вывода из шагов блока 16 */}
        {NOTES.map((note, index) => {
          const top = NOTE_TOP + index * NOTE_STEP;

          return (
            <g key={note}>
              <rect x="12" y={top} width="296" height={NOTE_H} rx="6" fill="#0f172a" fillOpacity="0.35" stroke="#475569" strokeOpacity="0.55" />
              <text x="22" y={top + NOTE_TEXT_Y} fontSize="10" fill="#94a3b8">
                {note}
              </text>
            </g>
          );
        })}
      </svg>
    </VisualWrapper>
  );
}
