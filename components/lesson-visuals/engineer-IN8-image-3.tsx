import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Кадр блока 14 урока IN8 «Из скана в CAD: параметрическая деталь».
 *
 * Сшивка двух сканов из описания `IN8_stitch.png`: два прохода с перекрытием и
 * тремя общими точками, справа шаги align и merge. Перекрытие 30–50 % и метки в
 * кадре — блок 12, шов 0,3 мм и «три точки руками» — блок 13.
 */
export function EngineerIN8Image3({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Сшивка двух проходов: два скана с перекрытием тридцать–пятьдесят процентов и тремя общими точками. Сначала align — выровнять по трём точкам, потом merge — склеить. Шов шириной 0,3 мм уже виден на печати, поэтому сшивать нужно до упрощения, а три точки руками надёжнее тысяч автоматических"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          сшивка двух проходов: align и merge
        </text>

        <defs>
          <marker id="in8-3-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0 0 L6 3 L0 6 z" fill="#64748b" />
          </marker>
        </defs>

        {/* Два прохода с перекрытием */}
        <text x="14" y="30" fontSize="10" fill="#38bdf8">
          проход 1
        </text>
        <text x="104" y="30" fontSize="10" fill="#f472b6">
          проход 2
        </text>
        <circle cx="66" cy="64" r="30" fill="#38bdf8" fillOpacity="0.1" stroke="#38bdf8" strokeWidth="1.1" strokeDasharray="4 3" />
        <circle cx="96" cy="76" r="30" fill="#f472b6" fillOpacity="0.1" stroke="#f472b6" strokeWidth="1.1" strokeDasharray="4 3" />

        {/* Три общие точки */}
        {[
          { x: 72, y: 94, n: "1" },
          { x: 90, y: 46, n: "2" },
          { x: 84, y: 70, n: "3" },
        ].map((point) => (
          <g key={point.n}>
            <circle cx={point.x} cy={point.y} r="7" fill="#0f172a" stroke="#f87171" strokeWidth="1.2" />
            <text x={point.x} y={point.y + 3.5} fontSize="10" fontWeight="700" fill="#f87171" textAnchor="middle">
              {point.n}
            </text>
          </g>
        ))}
        <text x="86" y="124" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          3 общие точки
        </text>

        {/* Шаги сшивки */}
        <rect x="168" y="34" width="140" height="24" rx="6" fill="#0f172a" fillOpacity="0.6" stroke="#38bdf8" strokeOpacity="0.5" />
        <text x="178" y="50" fontSize="10" fill="#38bdf8">
          align — выровнять
        </text>
        <path d="M238 58 V70" stroke="#64748b" strokeWidth="1.2" markerEnd="url(#in8-3-arrow)" />
        <rect x="168" y="74" width="140" height="24" rx="6" fill="#0f172a" fillOpacity="0.6" stroke="#34d399" strokeOpacity="0.5" />
        <text x="178" y="90" fontSize="10" fill="#34d399">
          merge — склеить
        </text>
        <text x="168" y="112" fontSize="10" fill="#fbbf24">
          шов 0,3 мм уже видно
        </text>

        <text x="12" y="140" fontSize="10" fill="#cbd5e1">
          перекрытие 30–50 %, метка в каждом кадре
        </text>
        <text x="12" y="156" fontSize="10" fill="#cbd5e1">
          сшивать до упрощения: общие точки теряются
        </text>
        <text x="12" y="172" fontSize="10" fill="#fbbf24">
          три точки руками надёжнее тысяч
        </text>
      </svg>
    </VisualWrapper>
  );
}
