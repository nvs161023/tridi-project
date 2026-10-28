import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Разрез детали: стенка 24, полки на 58, дно кармана на 84, скос справа. */
const TOP_Y = 58;
const POCKET_Y = 84;
const POCKET_LEFT = 76;
const POCKET_RIGHT = 120;
/** Колонка рабочих значений: подписи 196…308, три строки через 32. */
const STAT_X = 196;
const STAT_TOP = 62;
const STAT_STEP = 32;

type Stat = { value: string; note: string; color: string };

/** Рабочие значения ironing — блок 17. */
const STATS: Stat[] = [
  { value: "10 %", note: "поток", color: "#60a5fa" },
  { value: "20 мм/с", note: "скорость", color: "#10b981" },
  { value: "0,1 мм", note: "шаг линий", color: "#f59e0b" },
];

/**
 * Кадр блока 16 урока C8 «Где работает ironing».
 *
 * Разрез по описанию кадра `C8_ironing_zones.png` и блока 16: ironing идёт
 * только по плоским площадкам — верх, полки и дно кармана отмечены синим.
 * Наклон справа разгладить нельзя: сопло идёт по плоскости, а не по склону
 * (блок 20). Цифры справа — стартовые значения блока 17: поток 10 %, скорость
 * 20 мм/с, шаг линий 0,1 мм.
 */
export function ConfidentC8Diagram1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Где работает ironing. Разрез детали: ironing идёт только по плоским площадкам — по верху, по полкам и по дну кармана, они отмечены синим. Наклон справа разгладить нельзя. Рабочие значения: поток 10 процентов, скорость 20 миллиметров в секунду, шаг линий 0,1 миллиметра"
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
          только плоские площадки
        </text>

        {/* Разрез: верх, полки, карман и скос справа */}
        <polygon
          points={`24,126 24,${TOP_Y} ${POCKET_LEFT},${TOP_Y} ${POCKET_LEFT},${POCKET_Y} ${POCKET_RIGHT},${POCKET_Y} ${POCKET_RIGHT},${TOP_Y} 142,${TOP_Y} 156,72 156,126`}
          fill="#334155"
          fillOpacity="0.65"
          stroke="#64748b"
        />
        <line x1="12" y1="126" x2="168" y2="126" stroke="#475569" />

        {/* Плоские площадки: верх, полка и дно кармана */}
        <line x1="24" y1={TOP_Y} x2={POCKET_LEFT} y2={TOP_Y} stroke="#60a5fa" strokeWidth="3" />
        <line x1={POCKET_RIGHT} y1={TOP_Y} x2="142" y2={TOP_Y} stroke="#60a5fa" strokeWidth="3" />
        <line
          x1={POCKET_LEFT}
          y1={POCKET_Y}
          x2={POCKET_RIGHT}
          y2={POCKET_Y}
          stroke="#60a5fa"
          strokeWidth="3"
        />

        {/* Подписи площадок */}
        <text x="26" y="52" fontSize="10" fontWeight="700" fill="#93c5fd">
          верх
        </text>
        <text x="121" y="52" fontSize="10" fontWeight="700" fill="#93c5fd">
          полка
        </text>
        <line x1="98" y1={POCKET_Y} x2="98" y2="96" stroke="#60a5fa" strokeOpacity="0.6" />
        <text x="98" y="108" fontSize="10" fontWeight="700" fill="#93c5fd" textAnchor="middle">
          дно кармана
        </text>

        {/* Скос: ironing по нему не работает */}
        <line x1="142" y1={TOP_Y} x2="156" y2="72" stroke="#f87171" strokeWidth="2" />
        <line x1="145" y1="62" x2="153" y2="68" stroke="#f87171" strokeWidth="2" />
        <line x1="153" y1="62" x2="145" y2="68" stroke="#f87171" strokeWidth="2" />
        <text x="150" y="92" fontSize="10" fill="#fca5a5" textAnchor="end">
          наклон
        </text>
        <line x1="150" y1="88" x2="148" y2="75" stroke="#f87171" strokeOpacity="0.6" />

        <text x="12" y="140" fontSize="10" fill="#64748b">
          разрез по детали
        </text>

        {/* Рабочие значения ironing */}
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
          Ironing — только плоские площадки
        </text>
        <text x="12" y="171" fontSize="10" fill="#94a3b8">
          Наклон и стенки он не разглаживает
        </text>
      </svg>
    </VisualWrapper>
  );
}
