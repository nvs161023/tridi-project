import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const STAGES = [
  { title: "Объект", accent: "#94a3b8" },
  { title: "Скан", accent: "#38bdf8" },
  { title: "Облако", accent: "#a78bfa" },
  { title: "Меш", accent: "#34d399" },
  { title: "CAD", accent: "#fbbf24" },
];

/**
 * Кадр блока 4 урока IN7 «Сканирование и фотограмметрия».
 *
 * Макет из описания `IN7_scan_chain.png`: путь от детали к файлу в пять шагов —
 * объект, скан или кадры, облако точек, меш и CAD. Под цепью три пояснения из
 * блоков 3, 12 и 25: миллионы координат, сетка из треугольников и упрощение до
 * 200–300 тысяч полигонов. Внизу — главная мысль урока: форма без чисел.
 */
export function EngineerIN7Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Путь от объекта к файлу: объект, скан или кадры, облако точек, меш, CAD. Облако — миллионы координат, кадров от 20 до 50. Меш — сетка из треугольников, после упрощения остаётся 200–300 тысяч полигонов. Скан даёт форму, но не даёт чисел: отверстия и посадки меряют руками"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          путь от объекта к файлу
        </text>

        {STAGES.map((stage, i) => {
          const x = 12 + i * 61.5;
          return (
            <g key={stage.title}>
              <rect x={x} y="28" width="50" height="56" rx="7" fill="#0f172a" fillOpacity="0.5" stroke="#334155" />
              <rect x={x} y="28" width="50" height="2.5" rx="1.2" fill={stage.accent} fillOpacity="0.85" />

              {/* Иконки шагов */}
              {i === 0 ? (
                <>
                  <path d={`M${x + 17} 47 h16 v12 h-16 z`} fill="none" stroke={stage.accent} strokeWidth="1.2" />
                  <path d={`M${x + 17} 47 l5 -4 h16 v12 l-5 4`} fill="none" stroke={stage.accent} strokeWidth="1.2" />
                </>
              ) : null}
              {i === 1 ? (
                <>
                  <rect x={x + 15} y="46" width="20" height="14" rx="2" fill="none" stroke={stage.accent} strokeWidth="1.2" />
                  <circle cx={x + 25} cy="53" r="3.4" fill="none" stroke={stage.accent} strokeWidth="1.1" />
                </>
              ) : null}
              {i === 2 ? (
                <>
                  {[
                    [17, 49],
                    [25, 46],
                    [33, 50],
                    [21, 56],
                    [30, 57],
                    [24, 62],
                  ].map(([dx, dy]) => (
                    <circle key={`${dx}-${dy}`} cx={x + dx} cy={dy} r="1.5" fill={stage.accent} />
                  ))}
                  <circle cx={x + 25} cy="53" r="16" fill="none" stroke={stage.accent} strokeWidth="0.8" strokeDasharray="3 3" />
                </>
              ) : null}
              {i === 3 ? (
                <>
                  <path d={`M${x + 15} 60 l10 -12 l10 12 z`} fill="none" stroke={stage.accent} strokeWidth="1.2" />
                  <path d={`M${x + 15} 60 l10 4 l10 -4 M${x + 25} 48 v16`} stroke={stage.accent} strokeWidth="0.9" strokeDasharray="2 2" />
                </>
              ) : null}
              {i === 4 ? (
                <>
                  <path d={`M${x + 15} 47 l10 -4 l10 4 v13 l-10 4 l-10 -4 z`} fill="none" stroke={stage.accent} strokeWidth="1.1" />
                  <text x={x + 25} y="56" fontSize="9" fill={stage.accent} textAnchor="middle">
                    3D
                  </text>
                </>
              ) : null}

              <text x={x + 25} y="76" fontSize="10" fontWeight="700" fill={stage.accent} textAnchor="middle">
                {stage.title}
              </text>

              {i < STAGES.length - 1 ? (
                <path
                  d={`M${x + 51} 56 h8`}
                  stroke="#64748b"
                  strokeWidth="1.2"
                  markerEnd="url(#in7-0-arrow)"
                />
              ) : null}
            </g>
          );
        })}

        <defs>
          <marker id="in7-0-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0 0 L6 3 L0 6 z" fill="#64748b" />
          </marker>
        </defs>

        {/* Пояснения под цепью */}
        <text x="12" y="106" fontSize="10" fill="#cbd5e1">
          Облако точек — миллионы координат.
        </text>
        <text x="12" y="122" fontSize="10" fill="#cbd5e1">
          Меш — сетка из треугольников.
        </text>
        <text x="12" y="138" fontSize="10" fill="#cbd5e1">
          Кадров 20–50, после упрощения — 200–300 тыс. полигонов.
        </text>

        <rect x="12" y="150" width="296" height="20" rx="6" fill="#f59e0b" fillOpacity="0.1" stroke="#f59e0b" strokeOpacity="0.4" />
        <text x="22" y="164" fontSize="10" fill="#fbbf24">
          ⚠ скан даёт форму, но не числа: отверстия — руками
        </text>
      </svg>
    </VisualWrapper>
  );
}
