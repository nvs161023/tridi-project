import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Три стенки одной и той же детали: центр детали и вид шва. */
const walls = [64, 160, 256];

/** Разброс точек шва у режима Random — по всей поверхности стенки. */
const randomDots = [
  [138, 58],
  [152, 66],
  [168, 74],
  [182, 62],
  [144, 82],
  [162, 88],
  [178, 96],
  [140, 102],
  [156, 110],
  [184, 108],
];

/**
 * Виды шва (z-seam) — одна и та же стенка со скруглёнными углами в трёх видах:
 * шов сплошной линией по центру, шов разбросан точками и шов, уведённый в угол.
 *
 * Ровно по content урока: «Фото: Aligned (линия), Random (разбросан), Sharpest
 * corner (в углу). Под каждым — когда использовать» и по предупреждению
 * «Random шов может оставить точки на поверхности. Для гладких — Aligned».
 *
 * От «Примеров ориентации» из модуля F отличается предметом: там одна деталь
 * поворачивается в трёх положениях и меняется её силуэт, здесь деталь одна и та
 * же, а меняется только рисунок линии шва на её стенке. От «Типов соединений»
 * из F3 — тем, что там разрезы стыка шип-паз, а здесь место смены слоя.
 */
export function ProGG2Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Виды шва на одной стенке: Aligned — сплошная вертикальная линия по центру, Random — точки разбросаны по всей поверхности, Sharpest corner — шов уведён в угол детали; гладким поверхностям подходит Aligned, случайный может оставить точки"
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

        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          один шов — три положения
        </text>

        {walls.map((center) => (
          <g key={`wall-${center}`}>
            <rect
              x={center - 26}
              y="46"
              width="52"
              height="70"
              rx="8"
              fill="#334155"
              stroke="#64748b"
            />
            <ellipse cx={center} cy="46" rx="26" ry="6" fill="#1e293b" stroke="#64748b" />
          </g>
        ))}

        {/* Aligned: сплошная линия по центру */}
        <line x1="64" y1="48" x2="64" y2="114" stroke="#f87171" strokeWidth="1.8" />

        {/* Random: точки разбросаны */}
        {randomDots.map(([x, y]) => (
          <line
            key={`dot-${x}-${y}`}
            x1={x}
            y1={y}
            x2={x}
            y2={y + 4}
            stroke="#f87171"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        ))}

        {/* Sharpest corner: шов ушёл в угол детали */}
        <line x1="282" y1="48" x2="282" y2="114" stroke="#f87171" strokeWidth="1.8" />
        <circle cx="282" cy="52" r="3" fill="#fbbf24" />

        <text x="64" y="134" fontSize="10" fontWeight="bold" fill="#fca5a5" textAnchor="middle">
          Aligned
        </text>
        <text x="160" y="134" fontSize="10" fontWeight="bold" fill="#fca5a5" textAnchor="middle">
          Random
        </text>
        <text x="256" y="134" fontSize="10" fontWeight="bold" fill="#fca5a5" textAnchor="middle">
          Sharpest corner
        </text>

        <text x="12" y="152" fontSize="10" fill="#e2e8f0">
          гладким — Aligned, моделям с лицом — Back
        </text>
        <text x="12" y="168" fontSize="9" fill="#94a3b8">
          Random оставляет точки на поверхности
        </text>
      </svg>
    </VisualWrapper>
  );
}
