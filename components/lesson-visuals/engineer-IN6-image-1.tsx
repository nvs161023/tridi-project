import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const DIMENSIONS = [
  "габариты",
  "межосевые",
  "Ø отверстий",
  "посадки",
  "толщина",
  "радиусы",
  "углы",
];

/**
 * Кадр блока 11 урока IN6 «Реверс-инжиниринг: измерение и воспроизведение».
 *
 * Макет из описания `IN6_key_dims.png`: кронштейн с базой отсчёта и четыре
 * выноски на чертеже, справа — семь размеров из блока 10 в том порядке, в каком
 * их снимают. Внизу справа — тест важности из блока 9: отличие на 0,5 мм.
 */
export function EngineerIN6Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Кронштейн с базой отсчёта на левой грани. На чертеже отмечены диаметр отверстия, межосевое расстояние, посадка и толщина. Справа список семи размеров: габариты, межосевые, диаметры отверстий, посадки, толщина, радиусы, углы. Тест важности: отличие на 0,5 миллиметра ломает деталь"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <defs>
          <marker
            id="in6-1-tick"
            viewBox="0 0 6 6"
            refX="3"
            refY="3"
            markerWidth="4"
            markerHeight="4"
            orient="auto"
          >
            <path d="M0 0 L6 0 L6 6 z" fill="#64748b" />
          </marker>
        </defs>

        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          ключевые размеры и порядок замера
        </text>

        {/* Чертёж кронштейна */}
        <rect x="12" y="24" width="152" height="142" rx="8" fill="#0f172a" fillOpacity="0.35" stroke="#334155" />
        <polygon points="46,38 60,38 60,124 46,124" fill="#334155" stroke="#64748b" />
        <polygon points="46,110 146,110 146,124 46,124" fill="#334155" stroke="#64748b" />
        <circle cx="53" cy="58" r="4" fill="#0f172a" stroke="#cbd5e1" />
        <circle cx="53" cy="86" r="4" fill="#0f172a" stroke="#cbd5e1" />
        <circle cx="98" cy="117" r="4" fill="#0f172a" stroke="#cbd5e1" />

        {/* База отсчёта */}
        <line x1="45" y1="40" x2="45" y2="122" stroke="#f59e0b" strokeWidth="2" />
        <line x1="38" y1="82" x2="44" y2="82" stroke="#f59e0b" strokeWidth="0.8" />
        <text x="18" y="86" fontSize="10" fill="#fbbf24">
          база
        </text>

        {/* Межосевое расстояние */}
        <line x1="72" y1="58" x2="72" y2="86" stroke="#64748b" strokeWidth="0.8" />
        <line x1="68" y1="58" x2="76" y2="58" stroke="#64748b" strokeWidth="0.8" />
        <line x1="68" y1="86" x2="76" y2="86" stroke="#64748b" strokeWidth="0.8" />
        <text x="78" y="70" fontSize="10" fill="#cbd5e1">
          межосевое
        </text>

        {/* Диаметр отверстия */}
        <line x1="74" y1="47" x2="58" y2="55" stroke="#94a3b8" strokeWidth="0.8" />
        <text x="76" y="50" fontSize="10" fill="#cbd5e1">
          Ø отверстия
        </text>

        {/* Посадка */}
        <line x1="80" y1="104" x2="94" y2="114" stroke="#94a3b8" strokeWidth="0.8" />
        <text x="76" y="102" fontSize="10" fill="#cbd5e1">
          посадка
        </text>

        {/* Толщина */}
        <text x="100" y="142" fontSize="10" fill="#cbd5e1">
          толщина
        </text>

        {/* Семь размеров по порядку */}
        <rect x="170" y="24" width="138" height="142" rx="8" fill="#0f172a" fillOpacity="0.45" stroke="#334155" />
        {DIMENSIONS.map((name, i) => (
          <g key={name}>
            <circle cx="184" cy={31.5 + i * 16} r="7" fill="#1e293b" stroke="#475569" />
            <text x="184" y={38 + i * 16} fontSize="10" fill="#94a3b8" textAnchor="middle">
              {i + 1}
            </text>
            <text x="196" y={38 + i * 16} fontSize="10" fill={i < 2 ? "#fbbf24" : "#e2e8f0"}>
              {name}
            </text>
          </g>
        ))}
        <text x="180" y="150" fontSize="10" fill="#fbbf24">
          тест: ±0,5 мм ломает?
        </text>
      </svg>
    </VisualWrapper>
  );
}
