import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Панель 420 × 180 мм в масштабе 0,4: 168 × 72, углы 16,54 и 184,126. */
const PANEL = { x: 16, y: 54, w: 168, h: 72 };
/** Стол 256 × 256 мм в том же масштабе — 102 мм, то есть 49…151 по обеим осям. */
const BED = { x: 49, y: 36, size: 102 };
/** Две линии реза по нейтральным зонам: трети панели, x = 72 и 128. */
const CUTS = [72, 128];
/** Колонка цифр: подписи 196…308, три строки через 38. */
const STAT_X = 196;
const STAT_TOP = 52;
const STAT_STEP = 38;

type Stat = { value: string; note: string; color: string };

/** Габарит панели, стол и части после реза — блоки 3 и 9. */
const STATS: Stat[] = [
  { value: "420 × 180", note: "панель, мм", color: "#e2e8f0" },
  { value: "256 × 256", note: "стол, мм", color: "#60a5fa" },
  { value: "2 линии", note: "части по 140 мм", color: "#10b981" },
];

const NOTES = [
  "Резать по нейтральной зоне, а не по нагрузке",
  "Каждая часть — в габарит стола с запасом 5 мм",
];

/**
 * Кадр блока 4 урока C7 «Одна деталь, две линии разреза».
 *
 * Панель 420 × 180 мм из описания кадра `C7_split_zones.png` больше стола
 * 256 × 256 мм: в масштабе 0,4 панель выходит за стол на 82 мм с каждой стороны
 * (блок 3). Две линии реза стоят по нейтральным зонам, а не по нагрузке
 * (блок 7), и делят панель на три части примерно по 140 мм — каждая с запасом
 * входит в габарит стола, как требует блок 9.
 */
export function ConfidentC7Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Одна деталь, две линии разреза. Панель 420 на 180 миллиметров больше стола 256 на 256: в масштабе она выходит за стол на 82 миллиметра с каждой стороны. Две линии реза стоят по нейтральным зонам, а не по месту нагрузки, и делят панель на три части примерно по 140 миллиметров. Каждая часть входит в габарит стола с запасом пять миллиметров"
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

        {/* Габарит панели */}
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          панель 420 × 180 мм
        </text>

        {/* Стол: панель шире стола на 82 мм с каждой стороны */}
        <rect
          x={BED.x}
          y={BED.y}
          width={BED.size}
          height={BED.size}
          rx="3"
          fill="#0f172a"
          fillOpacity="0.35"
          stroke="#475569"
          strokeDasharray="4 3"
        />
        <rect
          x={PANEL.x}
          y={PANEL.y}
          width={PANEL.w}
          height={PANEL.h}
          rx="2"
          fill="#334155"
          fillOpacity="0.6"
          stroke="#64748b"
        />

        {/* Нейтральные зоны под линии реза */}
        {CUTS.map((x) => (
          <rect
            key={x}
            x={x - 8}
            y={PANEL.y}
            width="16"
            height={PANEL.h}
            fill="#f59e0b"
            fillOpacity="0.12"
          />
        ))}
        {CUTS.map((x, index) => (
          <g key={x}>
            <line
              x1={x}
              y1="49"
              x2={x}
              y2="124"
              stroke="#f59e0b"
              strokeDasharray="4 3"
              strokeOpacity="0.9"
            />
            <circle cx={x} cy="45" r="5" fill="#f59e0b" fillOpacity="0.2" stroke="#f59e0b" />
            <text x={x} y="48" fontSize="10" fontWeight="700" fill="#fcd34d" textAnchor="middle">
              {index + 1}
            </text>
          </g>
        ))}

        <text x="100" y="149" fontSize="10" fill="#94a3b8" textAnchor="middle">
          стол 256 мм
        </text>

        {/* Что остаётся после реза */}
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

        {/* Правила выбора места */}
        {NOTES.map((note, index) => (
          <text
            key={note}
            x="12"
            y={160 + index * 12}
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
