import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Базa столбиков 118, масштаб 1,4 px на час: 50 ч — 70 px, 12 ч — 17 px. */
const BASE_Y = 118;
const SCALE = 1.4;
/** Одна печать: 24…60 по X, 50 часов вверх. */
const ONE = { x: 24, w: 36, h: 50 * SCALE };
/** Четыре части: столбики по 16 через 20, начиная с 92. */
const PARTS = [92, 112, 132, 152];
const PART_W = 16;
const PART_H = 12 * SCALE;
/** Колонка сравнения: подписи 190…308, четыре строки через 36. */
const STAT_X = 190;
const STAT_TOP = 48;
const STAT_STEP = 36;

type Stat = { value: string; note: string; color: string };

/** Время и риск из блока 32: 50 часов одним куском против четырёх по 12. */
const STATS: Stat[] = [
  { value: "50 ч", note: "сбой обнуляет всё", color: "#f87171" },
  { value: "4 × 12 ч", note: "48 ч печати", color: "#60a5fa" },
  { value: "1 час", note: "на сборку", color: "#f59e0b" },
  { value: "материал", note: "экономии нет", color: "#94a3b8" },
];

/**
 * Кадр блока 33 урока C7 «Одна печать 50 часов или четыре по 12».
 *
 * Сравнение из описания кадра `C7_time_compare.png` и блока 32: цельная панель
 * печаталась бы 50 часов, четыре части — примерно по 12, то есть 48 часов
 * печати и ещё час на сборку. Материал разрез не экономит — соединители его
 * только добавляют, зато один сбой на части не отправляет в мусор всю работу.
 */
export function ConfidentC7Diagram3({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Одна печать 50 часов или четыре по 12. Цельная панель печаталась бы 50 часов — один сбой обнуляет всю работу. Четыре части по 12 часов дают 48 часов печати и ещё час на сборку. Материал разрез не экономит: соединители его только добавляют. Части освобождают стол раньше"
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
          время, риск и материал
        </text>

        {/* Одна печать целиком */}
        <rect
          x={ONE.x}
          y={BASE_Y - ONE.h}
          width={ONE.w}
          height={ONE.h}
          rx="2"
          fill="#f87171"
          fillOpacity="0.18"
          stroke="#f87171"
        />
        <text x={ONE.x + ONE.w / 2} y={BASE_Y - ONE.h - 4} fontSize="10" fontWeight="700" fill="#fca5a5" textAnchor="middle">
          50 ч
        </text>
        <text x={ONE.x + ONE.w / 2} y={BASE_Y + 14} fontSize="10" fill="#94a3b8" textAnchor="middle">
          целиком
        </text>

        {/* Четыре части по 12 часов */}
        {PARTS.map((x) => (
          <rect
            key={x}
            x={x}
            y={BASE_Y - PART_H}
            width={PART_W}
            height={PART_H}
            rx="2"
            fill="#60a5fa"
            fillOpacity="0.18"
            stroke="#60a5fa"
          />
        ))}
        {PARTS.map((x) => (
          <text key={x} x={x + PART_W / 2} y={BASE_Y - PART_H - 4} fontSize="10" fill="#93c5fd" textAnchor="middle">
            12
          </text>
        ))}
        <text x="130" y={BASE_Y + 14} fontSize="10" fill="#93c5fd" textAnchor="middle">
          четыре печати
        </text>

        {/* Сумма четырёх частей: 48 ч — почти как цельная панель */}
        <line
          x1="88"
          y1={BASE_Y - 4 * PART_H}
          x2="182"
          y2={BASE_Y - 4 * PART_H}
          stroke="#60a5fa"
          strokeDasharray="4 3"
          strokeOpacity="0.6"
        />
        <text x="182" y={BASE_Y - 4 * PART_H - 4} fontSize="10" fill="#93c5fd" textAnchor="end">
          48 ч всего
        </text>

        {/* База столбиков */}
        <line x1="12" y1={BASE_Y} x2="182" y2={BASE_Y} stroke="#475569" />

        {/* Время, риск и материал */}
        {STATS.map((stat, index) => {
          const y = STAT_TOP + index * STAT_STEP;
          return (
            <g key={stat.value}>
              <text x={STAT_X} y={y} fontSize="10" fontWeight="700" fill={stat.color}>
                {stat.value}
              </text>
              <text x={STAT_X} y={y + 12} fontSize="10" fill="#94a3b8">
                {stat.note}
              </text>
            </g>
          );
        })}

        <text x="12" y="152" fontSize="10" fill="#94a3b8">
          Части освобождают стол раньше
        </text>
      </svg>
    </VisualWrapper>
  );
}
