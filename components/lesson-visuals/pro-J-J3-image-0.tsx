import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Деталь крупным планом: куб, у которого заштрихована плоскость слоёв. */
const FRONT = { x: 52, y: 74, w: 46, h: 50 };

/** Верхняя грань — та самая плоскость слоёв: по ней и идёт штриховка. */
const TOP = "52,74 72,60 118,60 98,74";

/** Боковая грань: дорисовывает объём, чтобы куб читался как деталь, а не как квадрат. */
const SIDE = "98,74 118,60 118,110 98,124";

/** Линии штриховки на плоскости слоёв: наискось, как на разрезе. */
const HATCH: [number, number, number, number][] = [
  [56, 74, 76, 60],
  [68, 74, 88, 60],
  [80, 74, 100, 60],
  [92, 74, 112, 60],
];

/** Три оси: X и Y лежат в плоскости слоёв, Z идёт поперёк них. */
const AXIS_X = { x1: 32, y1: 126, x2: 62, y2: 126, arrow: "62,122 62,130 68,126" };
const AXIS_Y = { x1: 32, y1: 126, x2: 54, y2: 112, arrow: "59.1,108.8 56.2,115.4 51.9,108.6" };
const AXIS_Z = { x1: 32, y1: 126, x2: 32, y2: 100, arrow: "29,98 35,98 32,94" };

/** Строка прочности: ось, её прочность и длина полосы (100 % — 84 px). */
type Row = {
  /** Подпись оси. */
  axis: string;
  /** Прочность в процентах — слово из content блока. */
  value: string;
  /** Длина полосы: 100 % — вся, поперёк слоёв — меньше половины. */
  length: number;
  /** Верх полосы: строки стоят через 40 px. */
  y: number;
  /** В плоскости слоёв — зелёный, поперёк — оранжевый. */
  fill: string;
  accent: string;
};

const ROWS: Row[] = [
  { axis: "X", value: "100 %", length: 84, y: 40, fill: "#34d399", accent: "#6ee7b7" },
  { axis: "Y", value: "100 %", length: 84, y: 80, fill: "#34d399", accent: "#6ee7b7" },
  { axis: "Z", value: "40 %", length: 34, y: 120, fill: "#fb923c", accent: "#fdba74" },
];

const BAR_X = 186;

/**
 * Прочность по осям, по контенту урока: «Схема: деталь вдоль и поперёк. Вдоль —
 * 100 %, поперёк — 30–50 %». В кадре одна деталь, а не две картинки рядом: у куба
 * заштрихована плоскость слоёв, снизу подписаны оси X, Y и Z, справа три полосы
 * прочности — вдоль слоёв 100 %, поперёк 40 %. Внизу правило-вывод словами урока.
 *
 * От pro-F-F2-diagram-0 отличается тем, что там две отдельные панели «вдоль» и
 * «поперёк» с линией разрыва, а здесь одна деталь и её оси: видно, что слабая не
 * «вторая картинка», а направление Z у той же самой детали.
 */
export function ProJJ3Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Прочность по осям: одна деталь, у которой заштрихована плоскость слоёв, а снизу показаны оси X, Y и Z; справа три полосы прочности — по осям X и Y вдоль слоёв 100 процентов, по оси Z поперёк слоёв 40 процентов; внизу вывод: X и Y — вдоль слоёв 100 процентов, Z — поперёк слоёв 30–50 процентов"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="16" fontSize="10" fill="#94a3b8">
          прочность по осям: X, Y и Z
        </text>
        <text x="170" y="16" fontSize="10" fill="#94a3b8">
          % от монолита
        </text>

        {/* Слева — деталь: заштрихована плоскость слоёв и подписаны оси */}
        <rect x="12" y="26" width="152" height="114" rx="8" fill="#0f172a" stroke="#475569" />
        <text x="20" y="42" fontSize="9" fill="#94a3b8">
          слои лежат в плоскости XY
        </text>
        <polygon points={SIDE} fill="#475569" stroke="#64748b" />
        <polygon points={TOP} fill="#334155" stroke="#64748b" />
        <rect x={FRONT.x} y={FRONT.y} width={FRONT.w} height={FRONT.h} fill="#475569" stroke="#64748b" />
        {HATCH.map(([x1, y1, x2, y2]) => (
          <line key={`hatch-${x1}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#38bdf8" strokeOpacity="0.55" />
        ))}

        <line x1={AXIS_Z.x1} y1={AXIS_Z.y1} x2={AXIS_Z.x2} y2={AXIS_Z.y2} stroke="#94a3b8" strokeWidth="1.3" />
        <polygon points={AXIS_Z.arrow} fill="#94a3b8" />
        <line x1={AXIS_Y.x1} y1={AXIS_Y.y1} x2={AXIS_Y.x2} y2={AXIS_Y.y2} stroke="#94a3b8" strokeWidth="1.3" />
        <polygon points={AXIS_Y.arrow} fill="#94a3b8" />
        <line x1={AXIS_X.x1} y1={AXIS_X.y1} x2={AXIS_X.x2} y2={AXIS_X.y2} stroke="#94a3b8" strokeWidth="1.3" />
        <polygon points={AXIS_X.arrow} fill="#94a3b8" />
        <text x="14" y="100" fontSize="10" fontWeight="bold" fill="#cbd5e1">
          Z
        </text>
        <text x="62" y="98" fontSize="10" fontWeight="bold" fill="#cbd5e1">
          Y
        </text>
        <text x="77" y="136" fontSize="10" fontWeight="bold" fill="#cbd5e1">
          X
        </text>

        {/* Справа — прочность по каждой оси */}
        {ROWS.map((row) => (
          <g key={row.axis}>
            <text x="170" y={row.y + 8} fontSize="11" fontWeight="bold" fill="#e2e8f0">
              {row.axis}
            </text>
            <rect
              x={BAR_X}
              y={row.y}
              width={row.length}
              height="14"
              rx="3"
              fill={row.fill}
              fillOpacity="0.75"
            />
            <text x="308" y={row.y + 8} fontSize="10" fontWeight="bold" fill={row.accent} textAnchor="end">
              {row.value}
            </text>
          </g>
        ))}

        <text x="12" y="158" fontSize="10" fill="#e2e8f0">
          X, Y — вдоль слоёв: 100 %; Z — поперёк: 30–50 %
        </text>
      </svg>
    </VisualWrapper>
  );
}
