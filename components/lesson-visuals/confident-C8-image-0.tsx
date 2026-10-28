import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Две детали: гладкая 26…92 и текстурированная 100…166, высота 52…126. */
const SMOOTH = { x: 26, w: 66 };
const FUZZY = { x: 100, w: 66 };
const PART_Y = 52;
const PART_H = 74;
/** Шаг точек текстуры: 4 px по высоте, сдвиг ±1,6 px. */
const JAG_STEP = 4;
/** Колонка цены текстуры: подписи 194…308, три строки через 36. */
const STAT_X = 194;
const STAT_TOP = 56;
const STAT_STEP = 36;

type Stat = { value: string; note: string; color: string };

/** Цена и настройки текстуры — блок 29. */
const STATS: Stat[] = [
  { value: "0,2–0,3 мм", note: "толщина текстуры", color: "#f59e0b" },
  { value: "10–30 %", note: "дольше печать", color: "#60a5fa" },
  { value: "почти 0", note: "расход материала", color: "#10b981" },
];

/** Ровные слои гладкой стенки: 58 … 122 через 8. */
const LAYERS = Array.from({ length: 9 }, (_, index) => PART_Y + 6 + index * 8);

/** Зубчатая кромка: сдвиг по синусу, чтобы край читался как шершавый. */
function jagged(x: number, sign: 1 | -1) {
  return Array.from({ length: PART_H / JAG_STEP + 1 }, (_, index) => {
    const y = PART_Y + index * JAG_STEP;
    const dx = Math.sin(index * 1.7) * 1.6 * sign;
    return `${(x + dx).toFixed(1)},${y}`;
  });
}

/** Контур текстурной стенки: левая кромка сверху вниз, правая — снизу вверх. */
const FUZZY_POINTS = [...jagged(FUZZY.x, -1), ...jagged(FUZZY.x + FUZZY.w, 1).reverse()].join(" ");

/** Точки текстуры на стенке: те же сдвиги, что и у кромки. */
const DOTS = Array.from({ length: 12 }, (_, index) => ({
  x: FUZZY.x + 10 + ((index * 37) % 46),
  y: PART_Y + 8 + ((index * 19) % 58),
}));

/**
 * Кадр блока 27 урока C8 «Fuzzy skin: текстура стенки».
 *
 * Одна деталь дважды, как в описании кадра `C8_fuzzy_skin.png`: слева гладкая
 * стенка со слоями, справа та же стенка с fuzzy skin — кромка дрожит, на
 * поверхности зерно. Пиксельные «зубцы» повторяют смысл настройки из блока 26:
 * каждая точка контура сдвигается на доли миллиметра. Справа — цена из блока 29:
 * толщина 0,2–0,3 мм, печать дольше на 10–30 %, расход почти не меняется.
 */
export function ConfidentC8Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Fuzzy skin: текстура стенки. Одна деталь дважды: слева гладкая стенка со слоями, справа та же стенка с текстурой — кромка дрожит, на поверхности мелкое зерно. Толщина текстуры 0,2–0,3 миллиметра, печать дольше на 10–30 процентов, расход материала почти не меняется. Текстура прячет шов и полосы слоёв. Посадки и резьбу текстурировать нельзя"
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
          гладкая и шершавая стенка
        </text>

        {/* Гладкая стенка со слоями */}
        <rect
          x={SMOOTH.x}
          y={PART_Y}
          width={SMOOTH.w}
          height={PART_H}
          fill="#334155"
          fillOpacity="0.7"
          stroke="#64748b"
        />
        {LAYERS.map((y) => (
          <line
            key={y}
            x1={SMOOTH.x}
            y1={y}
            x2={SMOOTH.x + SMOOTH.w}
            y2={y}
            stroke="#94a3b8"
            strokeOpacity="0.16"
          />
        ))}
        <text x={SMOOTH.x + SMOOTH.w / 2} y="140" fontSize="10" fill="#94a3b8" textAnchor="middle">
          гладко
        </text>

        {/* Та же стенка с fuzzy skin: зубчатая кромка и зерно */}
        <polygon
          points={FUZZY_POINTS}
          fill="#334155"
          fillOpacity="0.7"
          stroke="#f59e0b"
          strokeOpacity="0.7"
        />
        {DOTS.map((dot) => (
          <circle key={`${dot.x}-${dot.y}`} cx={dot.x} cy={dot.y} r="0.9" fill="#fcd34d" fillOpacity="0.6" />
        ))}
        <text
          x={FUZZY.x + FUZZY.w / 2}
          y="140"
          fontSize="10"
          fontWeight="700"
          fill="#fcd34d"
          textAnchor="middle"
        >
          fuzzy skin
        </text>

        <line x1="12" y1="128" x2="170" y2="128" stroke="#475569" />

        {/* Цена текстуры */}
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

        <text x="12" y="160" fontSize="10" fontWeight="700" fill="#e2e8f0">
          Текстура прячет шов и полосы слоёв
        </text>
        <text x="12" y="171" fontSize="10" fill="#94a3b8">
          Посадки и резьбу текстурировать нельзя
        </text>
      </svg>
    </VisualWrapper>
  );
}
