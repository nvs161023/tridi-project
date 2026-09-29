import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Строка сравнения: одна и та же нагрузка, один и тот же материал. */
type Strip = {
  y: number;
  /** Заголовок строки — слово из content блока. */
  label: string;
  /** Итог строки — тоже слово из content блока. */
  caption: string;
  accent: string;
  /** Без рёбер пластина гнётся, с рёбрами — держит. */
  bent: boolean;
  /** Куда смотрит стрелка нагрузки (смещение от верха строки). */
  arrowTip: number;
};

const STRIPS: Strip[] = [
  { y: 26, label: "без рёбер", caption: "гнётся", accent: "#f87171", bent: true, arrowTip: 38 },
  { y: 90, label: "с рёбрами", caption: "держит", accent: "#34d399", bent: false, arrowTip: 34 },
];

const STRIP_W = 296;
const STRIP_H = 56;

/** Рёбра под пластиной во второй строке: пять штук по всей длине. */
const RIB_POSITIONS = [78, 120, 162, 204, 246];

/** Пластина под нагрузкой: без рёбер прогибается дугой, с рёбрами стоит прямой. */
function Plate({ strip }: { strip: Strip }) {
  const { y, accent, bent, arrowTip } = strip;

  return (
    <g>
      {bent ? (
        <>
          <path
            d={`M62,${y + 34} Q160,${y + 42} 258,${y + 34} L258,${y + 41} Q160,${y + 49} 62,${y + 41} Z`}
            fill="#475569"
            stroke="#64748b"
          />
          <polygon points={`52,${y + 41} 68,${y + 41} 60,${y + 48}`} fill="#64748b" />
          <polygon points={`252,${y + 41} 268,${y + 41} 260,${y + 48}`} fill="#64748b" />
        </>
      ) : (
        <>
          <rect x="62" y={y + 30} width="196" height="8" fill="#475569" stroke="#64748b" />
          {RIB_POSITIONS.map((x) => (
            <rect
              key={`rib-${x}`}
              x={x}
              y={y + 38}
              width="4"
              height="12"
              fill={accent}
              fillOpacity="0.55"
            />
          ))}
        </>
      )}

      {/* Нагрузка та же в обеих строках: та же стрелка, тот же груз. */}
      <line x1="160" y1={y + 22} x2="160" y2={y + arrowTip - 8} stroke="#94a3b8" strokeWidth="1.2" />
      <polygon
        points={`154,${y + arrowTip - 8} 166,${y + arrowTip - 8} 160,${y + arrowTip}`}
        fill="#94a3b8"
      />
    </g>
  );
}

/**
 * Прочность с рёбрами, по контенту урока: «Пластина без рёбер гнётся. С рёбрами —
 * держит. Толщина та же, прочность выше». Две широкие строки вместо двух узких
 * панелей: сверху та же пластина без рёбер прогибается дугой под стрелкой нагрузки,
 * снизу пластина той же толщины с пятью рёбрами стоит прямой. Нагрузка нарисована
 * одинаково, отличается только наличие рёбер — это и есть вывод «толщина та же».
 *
 * Числа из правил блока (0,8–1,2 мм, 2–3 толщины, 5–10 мм) в рамку не дублируются:
 * они идут списком сразу после этого блока.
 *
 * От pro-J-J1-animation-0 отличается тем, что там про ориентацию слоёв и трещину
 * вдоль слоя, а здесь про рёбра и прогиб. От pro-F-F2-animation-0 — тем, что там
 * две ориентации одной детали и расслоение по границе слоёв, а здесь одна
 * ориентация и разница только в рёбрах.
 */
export function ProJJ2Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Две строки сравнения при одной и той же нагрузке и той же толщине: сверху пластина без рёбер прогибается дугой под стрелкой груза — гнётся; снизу пластина той же толщины с пятью рёбрами остаётся прямой — держит; внизу вывод урока: толщина та же, а прочность выше"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="16" fontSize="10" fill="#94a3b8">
          одна толщина, разный результат
        </text>

        {STRIPS.map((strip) => (
          <g key={strip.label}>
            <rect x="12" y={strip.y} width={STRIP_W} height={STRIP_H} rx="8" fill="#0f172a" stroke="#475569" />
            <text x="20" y={strip.y + 13} fontSize="10" fontWeight="bold" fill={strip.accent}>
              {strip.label}
            </text>
            <text
              x="296"
              y={strip.y + 16}
              fontSize="10"
              fontWeight="bold"
              fill={strip.accent}
              textAnchor="end"
            >
              {strip.caption}
            </text>
            <Plate strip={strip} />
          </g>
        ))}

        <text x="12" y="164" fontSize="9" fill="#94a3b8">
          толщина та же, а прочность выше
        </text>
      </svg>
    </VisualWrapper>
  );
}
