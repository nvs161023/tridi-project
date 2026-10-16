import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Три колонки по 96 px и зазор 4 px: 12…108, 112…208, 212…308. */
const PANEL_TOP = 22;
const PANEL_H = 118;
const PANEL_W = 96;
const PANEL_X = [12, 112, 212];
const PANEL_CENTER = [60, 160, 260];

/** Куб одной стенки — квадрат 40 на 40; толщина стенки — толщина обводки. */
const CUBE_TOP = 44;
const CUBE_SIZE = 40;

/** Шкала стенки 0–0,50 мм на 70 px: 0,45 мм — середина цели. */
const BAR_TOP = 96;
const BAR_H = 8;
const BAR_W = 70;
const BAR_MAX = 0.5;
const TARGET_MIN = 0.43;
const TARGET_MAX = 0.47;

/** Панели-вывода под колонками: 142…158 и 160…176. */
const NOTE_TOP = 142;
const NOTE_H = 16;
const NOTE_STEP = 18;

type Cube = {
  state: string;
  color: string;
  wall: number;
  value: string;
  multiplier: string;
  strokeWidth: number;
};

/**
 * Три состояния одностенного куба — по подписи блока 15: стенки 0,42, 0,45 и
 * 0,48 мм при множителях 107, 100 и 94 %. Тонкая стенка значит недодачу и требует
 * поднять множитель, толстая — перелив и лишний пластик.
 */
const CUBES: Cube[] = [
  {
    state: "недодача",
    color: "#f87171",
    wall: 0.42,
    value: "0,42 мм",
    multiplier: "множитель 107 %",
    strokeWidth: 1.5,
  },
  {
    state: "норма",
    color: "#10b981",
    wall: 0.45,
    value: "0,45 мм",
    multiplier: "множитель 100 %",
    strokeWidth: 2,
  },
  {
    state: "перелив",
    color: "#f59e0b",
    wall: 0.48,
    value: "0,48 мм",
    multiplier: "множитель 94 %",
    strokeWidth: 3,
  },
];

/** Панели-вывода: сам замер и формула пересчёта из шага 4 блока 14. */
const NOTES = [
  "16 замеров, разброс 0,02 мм · цель 0,45 ± 0,02",
  "новый множитель = текущий × 0,45 / среднее",
];

/**
 * Кадр блока 15 урока L6 «Куб одной стенки: замер и пересчёт».
 *
 * Компоновка — три колонки: состояние, куб одной стенки (толщина обводки — это
 * толщина стенки), шкала замера 0–0,50 мм с зелёной зоной цели и множитель,
 * который из замера следует. Стенка 0,42 мм значит недодачу и множитель 107 %,
 * 0,45 мм — норму и 100 %, 0,48 мм — перелив и 94 %.
 *
 * Числа — из блоков 13–16: рабочий диапазон множителя 95–105 %, цель 0,45 ±
 * 0,02 мм, 16 замеров по четыре на стенку, пересчёт «текущий × 0,45 / среднее».
 */
export function Basic6Image2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Одностенный куб и замер его стенки: при недодаче стенка 0,42 мм и множитель 107 процентов, в норме 0,45 мм и 100 процентов, при переливе 0,48 мм и 94 процента. Цель — 0,45 плюс-минус 0,02 мм, замеров шестнадцать, по четыре на каждую стенку. Новый множитель равен текущему, умноженному на 0,45 и делённому на измеренное среднее"
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
          Одностенный куб: замер и пересчёт
        </text>

        {/* Три состояния куба: состояние, стенка, шкала и множитель */}
        {CUBES.map((cube, index) => {
          const center = PANEL_CENTER[index];
          const barX = center - BAR_W / 2;
          const markerX = barX + (cube.wall / BAR_MAX) * BAR_W;

          return (
            <g key={cube.state}>
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
                x={center}
                y="36"
                fontSize="11"
                fontWeight="700"
                fill={cube.color}
                textAnchor="middle"
              >
                {cube.state}
              </text>
              <rect
                x={center - CUBE_SIZE / 2}
                y={CUBE_TOP}
                width={CUBE_SIZE}
                height={CUBE_SIZE}
                fill="#0f172a"
                fillOpacity="0.4"
                stroke={cube.color}
                strokeWidth={cube.strokeWidth}
              />
              {/* Шкала стенки 0–0,50 мм с зелёной зоной цели */}
              <rect
                x={barX}
                y={BAR_TOP}
                width={BAR_W}
                height={BAR_H}
                rx="2"
                fill="#0f172a"
                fillOpacity="0.6"
                stroke="#475569"
              />
              <rect
                x={barX + (TARGET_MIN / BAR_MAX) * BAR_W}
                y={BAR_TOP}
                width={((TARGET_MAX - TARGET_MIN) / BAR_MAX) * BAR_W}
                height={BAR_H}
                fill="#10b981"
                fillOpacity="0.3"
              />
              <rect
                x={barX}
                y={BAR_TOP}
                width={(cube.wall / BAR_MAX) * BAR_W}
                height={BAR_H}
                rx="2"
                fill={cube.color}
                fillOpacity="0.55"
              />
              <line
                x1={markerX}
                y1={BAR_TOP - 2}
                x2={markerX}
                y2={BAR_TOP + BAR_H + 2}
                stroke="#e2e8f0"
              />
              <text x={center} y="120" fontSize="12" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
                {cube.value}
              </text>
              <text x={center} y="132" fontSize="10" fill="#94a3b8" textAnchor="middle">
                {cube.multiplier}
              </text>
            </g>
          );
        })}

        {/* Панели-вывода: замер и пересчёт */}
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
              <text x="22" y={top + 11} fontSize="10" fill="#94a3b8">
                {note}
              </text>
            </g>
          );
        })}
      </svg>
    </VisualWrapper>
  );
}
