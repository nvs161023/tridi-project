import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Четыре ступени по 32 px и зазор 2 px: 20, 54, 88, 122. */
const ROW_TOP = 20;
const ROW_H = 32;
const ROW_GAP = 2;

/** Каждая ступень сдвинута вправо на 8 px — видно, что шаг опирается на предыдущий. */
const ROW_INDENT = 8;
const ROW_WIDTH = 296;

/** Значок ступени, название и число; справа — растущая засечка. */
const BADGE_X = 22;
const BADGE_R = 9;
const TEXT_X = 40;
const TITLE_Y = 14;
const DETAIL_Y = 26;
const STAIR_X = 288;
const STAIR_W = 8;
const STAIR_INSET = 5;
const STAIR_BASE = 6;
const STAIR_STEP = 6;

/** Панель-вывод под ступенями: 158…176. */
const NOTE_TOP = 158;
const NOTE_H = 18;

type Step = { title: string; detail: string; color: string };

/**
 * Четыре шага ровно по блоку 30 (и числам блока 34): сначала температурная башня,
 * потом одностенный куб, потом лестница скорости, и только в конце ограничители.
 * Обратный порядок — это поиск причины, когда что-то пошло не так.
 */
const STEPS: Step[] = [
  {
    title: "Температура",
    detail: "башня 200–220 °C, шаг 5 °C",
    color: "#f59e0b",
  },
  {
    title: "Множитель потока",
    detail: "куб, 95–105 %, стенка 0,45 мм",
    color: "#38bdf8",
  },
  {
    title: "Скорость",
    detail: "лестница 60/90/120/150 мм/с",
    color: "#10b981",
  },
  {
    title: "Ограничители",
    detail: "12 мм³/с · 2500 мм/с² · jerk 10",
    color: "#3b82f6",
  },
];

/**
 * Кадр блока 31 урока L6 «Лестница калибровки: три теста и один ограничитель».
 *
 * Компоновка — четыре ступени: каждая сдвинута вправо и выше предыдущей, у
 * каждой номер, название и рабочее число, справа растущая засечка. Сноска
 * объясняет, что лестница работает в обе стороны: вверх — настройка, вниз —
 * поиск причины, когда что-то пошло не так.
 *
 * Числа — из блоков 30, 31 и 34: башня 200–220 °C шагом 5 °C, куб с множителем
 * 95–105 % и стенкой 0,45 мм, лестница 60/90/120/150 мм/с, ограничитель потока
 * 12 мм³/с, ускорение 2500 мм/с² и jerk 10 мм/с для профиля без компенсации.
 */
export function Basic6Diagram4({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Порядок калибровки из четырёх шагов: сначала температура — башня 200–220 градусов шагом 5; потом множитель потока — куб и рабочая стенка 0,45 мм в диапазоне 95–105 процентов; потом скорость — лестница 60, 90, 120 и 150 мм в секунду; и в конце ограничители — 12 кубических миллиметров в секунду, 2500 миллиметров в секунду в квадрате и jerk 10. Вверх по лестнице идёт настройка, вниз — поиск причины"
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
          Порядок калибровки: четыре шага
        </text>

        {/* Четыре ступени: номер, название, число и растущая засечка */}
        {STEPS.map((step, index) => {
          const x = 12 + index * ROW_INDENT;
          const width = ROW_WIDTH - index * ROW_INDENT;
          const top = ROW_TOP + index * (ROW_H + ROW_GAP);
          const stairHeight = STAIR_BASE + index * STAIR_STEP;
          const stairY = top + ROW_H - STAIR_INSET - stairHeight;

          return (
            <g key={step.title}>
              <rect
                x={x}
                y={top}
                width={width}
                height={ROW_H}
                rx="6"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke="#475569"
                strokeOpacity="0.55"
              />
              <circle
                cx={x + BADGE_X}
                cy={top + ROW_H / 2}
                r={BADGE_R}
                fill={step.color}
                fillOpacity="0.25"
                stroke={step.color}
              />
              <text
                x={x + BADGE_X}
                y={top + ROW_H / 2 + 4}
                fontSize="11"
                fontWeight="700"
                fill={step.color}
                textAnchor="middle"
              >
                {index + 1}
              </text>
              <text x={x + TEXT_X} y={top + TITLE_Y} fontSize="11" fontWeight="700" fill={step.color}>
                {step.title}
              </text>
              <text x={x + TEXT_X} y={top + DETAIL_Y} fontSize="10" fill="#94a3b8">
                {step.detail}
              </text>
              <rect
                x={STAIR_X}
                y={stairY}
                width={STAIR_W}
                height={stairHeight}
                rx="2"
                fill={step.color}
                fillOpacity="0.45"
              />
            </g>
          );
        })}

        {/* Панель-вывод: лестница работает в обе стороны */}
        <rect
          x="12"
          y={NOTE_TOP}
          width="296"
          height={NOTE_H}
          rx="6"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeOpacity="0.55"
        />
        <text x="22" y={NOTE_TOP + 12} fontSize="10" fill="#94a3b8">
          вверх — настройка, вниз — поиск причины
        </text>
      </svg>
    </VisualWrapper>
  );
}
