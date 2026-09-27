import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Четыре положения шва: подпись, выбранный режим и уровень в панели. */
const seamOptions = [
  { y: 60, label: "Aligned" },
  { y: 78, label: "Random" },
  { y: 96, label: "Nearest" },
  { y: 114, label: "Sharpest corner" },
];

/**
 * Seam Position — оптика «карта шва»: слева одна деталь, по которой шов
 * переезжает из положения в положение, справа узкая панель со списком четырёх
 * положений (Aligned, Random, Nearest, Sharpest corner) и режимом Spiral Vase,
 * который печатает вазу одной спиралью и шва не оставляет.
 *
 * Ровно по content урока: «Seam Position — Aligned, Random, Nearest, Sharpest
 * corner. Для ваз — Spiral Vase Mode (без шва)» и по совету «для моделей с
 * лицом — Back, для функциональных — Sharpest corner».
 *
 * От схем интерфейсов в других уроках отличается оптикой: у калибровок была
 * карта вкладок, у Cut — плоскость разреза в окне, у Variable Layer Height —
 * разрез по Z; здесь список положений шва рядом с деталью, по которой шов
 * ездит. Полного окна слайсера в кадре нет.
 *
 * Анимация 6 с, по кругу: шов идёт влево, в центр, в угол — и обратно, а
 * выбранная строка Sharpest corner подсвечивается в момент, когда шов в углу.
 * При prefers-reduced-motion шов стоит в углу, строка подсвечена.
 *
 * Классы с префиксом v-gg2s: <style> внутри SVG действует на всю страницу.
 */
export function ProGG2Screenshot0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Seam Position в слайсере: слева деталь, по которой шов переезжает из положения в положение, справа узкая панель со списком Aligned, Random, Nearest и Sharpest corner, выбран Sharpest corner, ниже режим Spiral Vase — печать вазы без шва"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-gg2s-move { animation: v-gg2s-move 6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
          .v-gg2s-pick { animation: v-gg2s-pick 6s ease-in-out infinite; }
          @keyframes v-gg2s-move {
            0%, 12% { transform: translateX(-14px); }
            30%, 44% { transform: translateX(0); }
            62%, 78% { transform: translateX(14px); }
            100% { transform: translateX(-14px); }
          }
          @keyframes v-gg2s-pick {
            0%, 12% { opacity: 0.35; }
            62%, 78% { opacity: 1; }
            100% { opacity: 0.35; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-gg2s-move { animation: none; transform: translateX(14px); }
            .v-gg2s-pick { animation: none; opacity: 1; }
          }
        `}</style>

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
          Seam Position: куда встанет шов
        </text>

        <rect x="62" y="46" width="52" height="76" rx="8" fill="#334155" stroke="#64748b" />
        <ellipse cx="88" cy="46" rx="26" ry="6" fill="#1e293b" stroke="#64748b" />
        <g className="v-gg2s-move">
          <line x1="88" y1="48" x2="88" y2="120" stroke="#f87171" strokeWidth="1.8" />
          <circle cx="88" cy="50" r="3" fill="#fbbf24" />
        </g>

        <text x="88" y="138" fontSize="9" fill="#94a3b8" textAnchor="middle">
          шов ходит по детали
        </text>

        <rect x="176" y="26" width="132" height="124" rx="6" fill="#0f172a" stroke="#475569" />
        <text x="184" y="44" fontSize="10" fontWeight="bold" fill="#93c5fd">
          Seam Position
        </text>
        {seamOptions.map((option, index) => (
          <g key={`seam-${option.label}`}>
            <circle
              className={index === 3 ? "v-gg2s-pick" : undefined}
              cx="186"
              cy={option.y - 3}
              r="3.5"
              fill={index === 3 ? "#38bdf8" : "#334155"}
              stroke={index === 3 ? "#38bdf8" : "#64748b"}
            />
            <text x="194" y={option.y} fontSize="10" fill={index === 3 ? "#e2e8f0" : "#94a3b8"}>
              {option.label}
            </text>
          </g>
        ))}
        <line x1="184" y1="128" x2="300" y2="128" stroke="#334155" />
        <text x="184" y="146" fontSize="9" fill="#6ee7b7">
          Spiral Vase — без шва
        </text>

        <text x="12" y="166" fontSize="9" fill="#94a3b8">
          для лица шов уводим назад
        </text>
      </svg>
    </VisualWrapper>
  );
}
