import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Линии слоёв в стенке: шаг 8 px, от 52 до 132. */
const layers = [52, 60, 68, 76, 84, 92, 100, 108, 116, 124, 132];

/** Слои выше трещины — те, что отходят от стенки на высокой скорости. */
const peelLayers = layers.filter((y) => y < 88);

/** Слои, которые держатся. */
const heldLayers = layers.filter((y) => y > 88);

/** Крошки, осыпающиеся с трещины. */
const crumbs = [
  { cx: 250, cy: 98 },
  { cx: 262, cy: 104 },
];

/**
 * Как скорость влияет — две стенки рядом.
 *
 * Ровно по content урока: «Быстрый — расслаивается. Медленный — держит». Слева
 * стенка, напечатанная на 40 мм/с: слои лежат плотно. Справа — на 80 мм/с: верхние
 * слои расходятся, между ними появляется трещина и осыпаются крошки.
 *
 * От картинки про углы (урок 7, вид сверху с путём сопла) отличается объектом: там
 * план угла, здесь стенка в разрезе и её слои.
 */
export function Basic7Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация: стенка на 40 мм/с держит форму, а на 80 мм/с верхние слои расходятся — появляется трещина и осыпаются крошки пластика"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-b7a-peel { animation: v-b7a-split 3.4s ease-in-out infinite; }
          .v-b7a-crack { opacity: 0.6; animation: v-b7a-open 3.4s ease-in-out infinite; }
          .v-b7a-crumb { opacity: 0; animation: v-b7a-fall 3.4s ease-in infinite; }
          @keyframes v-b7a-split {
            0%, 100% { transform: translateX(0); }
            55%, 80% { transform: translateX(5px); }
          }
          @keyframes v-b7a-open {
            0%, 100% { opacity: 0.45; }
            55%, 80% { opacity: 1; }
          }
          @keyframes v-b7a-fall {
            0%, 45% { transform: translateY(0); opacity: 0; }
            60% { transform: translateY(4px); opacity: 0.9; }
            100% { transform: translateY(18px); opacity: 0; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-b7a-peel, .v-b7a-crack, .v-b7a-crumb { animation: none; }
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

        {/* Скорости над стенками */}
        <text x="48" y="34" fontSize="10" fill="#6ee7b7">
          40 мм/с
        </text>
        <text x="216" y="34" fontSize="10" fill="#fca5a5">
          80 мм/с
        </text>

        {/* Стенка, которая держит: слои плотно */}
        <rect x="48" y="44" width="56" height="96" rx="2" fill="#1e3a5f" stroke="#3b82f6" />
        {layers.map((y) => (
          <line key={`hold-${y}`} x1="48" y1={y} x2="104" y2={y} stroke="#475569" strokeWidth="1.5" />
        ))}

        {/* Стенка, которая расслаивается */}
        <rect x="216" y="44" width="56" height="96" rx="2" fill="#1e3a5f" stroke="#fb7185" />
        {heldLayers.map((y) => (
          <line key={`base-${y}`} x1="216" y1={y} x2="272" y2={y} stroke="#475569" strokeWidth="1.5" />
        ))}
        <g className="v-b7a-peel">
          {peelLayers.map((y) => (
            <line key={`peel-${y}`} x1="216" y1={y} x2="272" y2={y} stroke="#64748b" strokeWidth="1.5" />
          ))}
        </g>

        {/* Трещина между слоями */}
        <line
          className="v-b7a-crack"
          x1="216"
          y1="88"
          x2="272"
          y2="88"
          stroke="#fb7185"
          strokeWidth="3"
        />
        <polygon points="276,84 284,88 276,92" fill="#fb7185" />

        {crumbs.map((crumb, index) => (
          <circle
            key={crumb.cx}
            className="v-b7a-crumb"
            cx={crumb.cx}
            cy={crumb.cy}
            r="1.8"
            fill="#fb7185"
            style={{ animationDelay: `${index * 0.6}s` }}
          />
        ))}

        {/* Итог под стенками */}
        <circle cx="41" cy="155" r="3" fill="#34d399" />
        <text x="48" y="158" fontSize="10" fill="#e2e8f0">
          держит форму
        </text>
        <circle cx="209" cy="155" r="3" fill="#fb7185" />
        <text x="216" y="158" fontSize="10" fill="#e2e8f0">
          расслаивается
        </text>
      </svg>
    </VisualWrapper>
  );
}
