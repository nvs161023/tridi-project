import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Кронштейн: полка 26…158 на 40…56, стойка 26…42 на 40…120. */
const BRACKET = "26,40 158,40 158,56 42,56 42,120 26,120";
/** Зона нагрузки вокруг отверстия под болт: центр 134,48. */
const BOSS = { cx: 134, cy: 48, r: 14 };
/** Колонка выигрыша: подписи 176…308, три блока через 34. */
const STAT_X = 176;
const STAT_TOP = 56;
const STAT_STEP = 34;

type Stat = { value: string; note: string; color: string };

/** Что дал модификатор — блок 15 и пример блока 12. */
const STATS: Stat[] = [
  { value: "60 % → 15 %", note: "заполнение детали", color: "#10b981" },
  { value: "−40 %", note: "времени печати", color: "#f59e0b" },
  { value: "прочность", note: "не изменилась", color: "#e2e8f0" },
];

const NOTES = [
  "Начинай с одной зоны и одной задачи",
  "Один модификатор за тест — так видно, что сработало",
];

/**
 * Кадр блока 12 урока C6 «Пример: кронштейн с зоной нагрузки».
 *
 * Кронштейн 80 × 40 × 30 мм из блока 15 и описания кадра `C6_bracket.png`:
 * у отверстия под болт стоит цилиндр-модификатор, вокруг него 60 % заполнения,
 * остальное тело печатается на 15 %. Именно этот пример дал экономию около 40 %
 * времени без потери прочности у отверстия (блок 15). Нижние строки — правила
 * того же блока: начинать с одной зоны и одной задачи, ставить один модификатор
 * за тест, чтобы было видно, что именно сработало.
 */
export function ConfidentC6Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Пример: кронштейн с зоной нагрузки. Кронштейн 80 на 40 на 30 миллиметров, у отверстия под болт стоит цилиндр-модификатор с заполнением 60 процентов и четырьмя стенками, остальное тело печатается на 15 процентов. Заполнение падает с 60 до 15 процентов, времени уходит на 40 процентов меньше, прочность у отверстия не изменилась. Начинай с одной зоны и одной задачи. Один модификатор за тест — так видно, что сработало"
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
          Кронштейн: зона нагрузки у отверстия
        </text>

        {/* Тело кронштейна и стойка */}
        <polygon points={BRACKET} fill="#334155" fillOpacity="0.6" stroke="#64748b" />
        <polygon points={BRACKET} fill="#10b981" fillOpacity="0.1" />

        {/* Зона нагрузки и отверстие под болт */}
        <circle
          cx={BOSS.cx}
          cy={BOSS.cy}
          r={BOSS.r}
          fill="#10b981"
          fillOpacity="0.18"
          stroke="#10b981"
          strokeDasharray="4 3"
        />
        <circle cx={BOSS.cx} cy={BOSS.cy} r="5" fill="#0f172a" stroke="#e2e8f0" />
        <text x={BOSS.cx} y={BOSS.cy - 21} fontSize="10" fontWeight="700" fill="#10b981" textAnchor="middle">
          60 %
        </text>

        {/* Остальное тело */}
        <line x1="42" y1="104" x2="48" y2="104" stroke="#94a3b8" strokeOpacity="0.7" />
        <text x="52" y="108" fontSize="10" fill="#cbd5e1">
          15 %
        </text>

        {/* Габарит примера */}
        <text x="26" y="140" fontSize="10" fill="#64748b">
          Кронштейн 80 × 40 × 30 мм
        </text>

        {/* Что дал модификатор */}
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

        {/* Правила проверки */}
        {NOTES.map((note, index) => (
          <text
            key={note}
            x="12"
            y={156 + index * 12}
            fontSize="10"
            fontWeight={index === 0 ? "700" : "400"}
            fill={index === 0 ? "#e2e8f0" : "#94a3b8"}
          >
            {note}
          </text>
        ))}
      </svg>
    </VisualWrapper>
  );
}
