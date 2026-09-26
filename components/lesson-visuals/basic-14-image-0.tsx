import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const ACCENT = "#f59e0b";

/**
 * Шесть точек обслуживания из content урока: ремни, валы, винт Z, сопло,
 * вентиляторы, стол. Координаты — места, где стоит номерная метка на принтере.
 */
const points = [
  { id: 1, name: "ремни", x: 100, y: 42 },
  { id: 2, name: "валы", x: 34, y: 51 },
  { id: 3, name: "винт Z", x: 122, y: 90 },
  { id: 4, name: "сопло", x: 56, y: 72 },
  { id: 5, name: "вентиляторы", x: 112, y: 140 },
  { id: 6, name: "стол", x: 44, y: 105 },
];

/** Строки списка справа: лупа с крупным узлом и подпись. */
const rows = [50, 70, 90, 110, 130, 150];

/**
 * Точки обслуживания — принтер сбоку и шесть мест, которые проверяют раз в месяц.
 *
 * Ровно по content урока: «Схема принтера: ремни, валы, винт Z, сопло,
 * вентиляторы, стол». Список работ — из блока «Обслуживание»: натяжение ремней,
 * смазать валы, прочистить сопло, пыль с вентиляторов.
 *
 * От схемы устройства в уроке 1 отличается ракурсом и приёмом: там изометрия и
 * шесть узлов с прямыми выносками «что это», здесь вид сбоку и шесть меток
 * обслуживания с лупой — рядом показан узел крупно и как он называется.
 */
export function Basic14Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Точки обслуживания: принтер сбоку, номерами отмечены ремни, валы, винт Z, сопло, вентиляторы и стол, рядом лупа с крупным узлом и названием"
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

        {/* Корпус с электроникой */}
        <rect x="24" y="128" width="116" height="24" rx="4" fill="#334155" stroke="#475569" />
        <rect x="34" y="136" width="24" height="10" rx="2" fill="#1e293b" />
        <circle cx="100" cy="140" r="6" fill="#1e293b" stroke="#475569" />
        <circle cx="132" cy="140" r="7" fill="#1e293b" stroke="#475569" />
        <line x1="127" y1="135" x2="137" y2="145" stroke="#475569" />
        <line x1="137" y1="135" x2="127" y2="145" stroke="#475569" />
        <rect x="30" y="152" width="10" height="4" rx="1" fill="#475569" />
        <rect x="130" y="152" width="10" height="4" rx="1" fill="#475569" />

        {/* Верхняя балка, ремень и направляющие валы */}
        <rect x="26" y="34" width="100" height="12" rx="3" fill="#334155" stroke="#475569" />
        <line x1="30" y1="42" x2="122" y2="42" stroke="#94a3b8" />
        <line x1="40" y1="40" x2="40" y2="44" stroke="#94a3b8" />
        <line x1="96" y1="40" x2="96" y2="44" stroke="#94a3b8" />
        <line x1="116" y1="40" x2="116" y2="44" stroke="#94a3b8" />
        <line x1="28" y1="49" x2="124" y2="49" stroke="#64748b" />
        <line x1="28" y1="53" x2="124" y2="53" stroke="#64748b" />

        {/* Стойка с винтом Z */}
        <rect x="114" y="34" width="16" height="94" rx="3" fill="#334155" stroke="#475569" />
        {/* Винт Z разбит на два отрезка: посередине стоит номерная метка */}
        <polyline
          points="122,40 118,47 126,54 118,61 126,68 118,75 126,82"
          fill="none"
          stroke="#64748b"
        />
        <polyline
          points="122,98 118,105 126,112 118,119 122,126"
          fill="none"
          stroke="#64748b"
        />

        {/* Печатающая головка с соплом */}
        <rect x="58" y="46" width="28" height="18" rx="3" fill="#475569" stroke="#64748b" />
        <circle cx="66" cy="55" r="5" fill="#1e293b" />
        <rect x="63" y="62" width="14" height="5" rx="1" fill="#334155" />
        <polygon points="66,67 74,67 70,76" fill="#94a3b8" />

        {/* Стол с напечатанной деталью */}
        <rect x="26" y="108" width="84" height="6" rx="2" fill="#475569" stroke="#64748b" />
        <rect x="30" y="116" width="76" height="4" rx="1" fill="#334155" />
        <path d="M62,108 L66,94 L68,92 L76,92 L78,94 L82,108 Z" fill="#334155" stroke="#64748b" />

        {/* Номерные метки на узлах */}
        {points.map((point) => (
          <g key={point.id}>
            <rect
              x={point.x - 6.5}
              y={point.y - 6.5}
              width="13"
              height="13"
              rx="4"
              fill="#0f172a"
              stroke={ACCENT}
              strokeWidth="1.6"
            />
            <text
              x={point.x}
              y={point.y + 3.6}
              fontSize="10"
              fontWeight="bold"
              fill={ACCENT}
              textAnchor="middle"
            >
              {point.id}
            </text>
          </g>
        ))}

        {/* Список точек с лупой: узел крупно и его название */}
        <rect x="160" y="34" width="152" height="132" rx="8" fill="#0f172a" stroke="#334155" />
        {points.map((point, index) => {
          const cy = rows[index];

          return (
            <g key={`row-${point.id}`}>
              <circle cx="176" cy={cy} r="11" fill="#0f172a" stroke={ACCENT} strokeWidth="1.4" />
              <line
                x1="184"
                y1={cy + 7}
                x2="190"
                y2={cy + 13}
                stroke={ACCENT}
                strokeWidth="2"
                strokeLinecap="round"
              />
              <text x="194" y={cy + 3.5} fontSize="10" fill="#e2e8f0">
                {point.id} {point.name}
              </text>
              {point.id === 1 ? (
                <>
                  <line x1="172" y1={cy - 2} x2="181" y2={cy - 2} stroke={ACCENT} />
                  <line x1="172" y1={cy + 2} x2="181" y2={cy + 2} stroke={ACCENT} />
                </>
              ) : null}
              {point.id === 2 ? (
                <rect x="171" y={cy - 2} width="11" height="4" rx="2" fill="none" stroke={ACCENT} />
              ) : null}
              {point.id === 3 ? (
                <polyline
                  points={`172,${cy + 4} 176,${cy - 4} 181,${cy + 4}`}
                  fill="none"
                  stroke={ACCENT}
                />
              ) : null}
              {point.id === 4 ? (
                <polygon
                  points={`172,${cy - 4} 182,${cy - 4} 177,${cy + 5}`}
                  fill="none"
                  stroke={ACCENT}
                />
              ) : null}
              {point.id === 5 ? (
                <>
                  <circle cx="177" cy={cy} r="4.5" fill="none" stroke={ACCENT} />
                  <line x1="177" y1={cy} x2="181" y2={cy - 3} stroke={ACCENT} />
                  <line x1="177" y1={cy} x2="181" y2={cy + 3} stroke={ACCENT} />
                </>
              ) : null}
              {point.id === 6 ? (
                <>
                  <line x1="171" y1={cy - 3} x2="183" y2={cy - 3} stroke={ACCENT} />
                  <line x1="174" y1={cy - 3} x2="174" y2={cy + 4} stroke={ACCENT} />
                  <line x1="180" y1={cy - 3} x2="180" y2={cy + 4} stroke={ACCENT} />
                </>
              ) : null}
            </g>
          );
        })}
      </svg>
    </VisualWrapper>
  );
}

