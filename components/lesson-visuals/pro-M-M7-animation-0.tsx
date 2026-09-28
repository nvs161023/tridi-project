import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Микроцарапины на матовой части поверхности. */
const SCRATCHES = [
  [48, 120, 60, 118],
  [70, 126, 84, 124],
  [52, 132, 66, 130],
  [88, 118, 100, 116],
  [76, 134, 90, 132],
  [104, 128, 118, 126],
];

/** Ворс круга: лучи от центра (160, 78) радиусом 34. */
const FELT_HAIRS = [
  [194, 78],
  [184, 102],
  [160, 112],
  [136, 102],
  [126, 78],
  [136, 54],
  [160, 44],
  [184, 54],
];

/** Звезда блика на отполированной части. */
const GLOSS_STAR = "222,110 224,114 228,116 224,118 222,122 220,118 216,116 220,114";

/**
 * Полировка: вращающийся войлочный круг с пастой идёт по матовой поверхности,
 * микроцарапины под ним пропадают, справа проступает глянец со звездой блика.
 *
 * Ровно по content урока: «Матовая поверхность → глянцевая. Паста ГОИ + войлок» и
 * по warning: «Работай с водой — пыль от шкурки вредна».
 *
 * От G-G3 (горячее сопло выглаживает верхний слой) отличается инструментом: там
 * горячее сопло принтера и оплавленный слой, здесь холодный войлочный круг с
 * пастой и абразивная полировка. Кругов с ворсом в курсе не было.
 *
 * Анимация 7 с, по кругу: войлок вращается и ведёт по поверхности, царапины гаснут
 * одна за другой, в финале проступает глянец и вспыхивает звезда блика.
 * При prefers-reduced-motion показан итог: отполированная поверхность с бликом.
 *
 * Классы с префиксом v-mm7a: <style> внутри SVG действует на всю страницу.
 */
export function ProMM7Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация полировки: вращающийся войлочный круг с пастой ведут по матовой поверхности, микроцарапины пропадают, справа проступает глянец и вспыхивает звезда блика; подписи — войлок с пастой ГОИ, работа с водой, потому что пыль от шкурки вредна"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-mm7a-wheel {
            animation: v-mm7a-wheel 7s ease-in-out infinite;
            transform-box: view-box;
            transform-origin: 160px 78px;
          }
          .v-mm7a-scratch { animation: v-mm7a-scratch 7s ease-in-out infinite; animation-fill-mode: backwards; }
          .v-mm7a-gloss { animation: v-mm7a-gloss 7s ease-in-out infinite; }
          .v-mm7a-star { animation: v-mm7a-star 7s ease-in-out infinite; }
          @keyframes v-mm7a-wheel {
            0% { transform: translateX(-18px) rotate(0deg); }
            50% { transform: translateX(18px) rotate(540deg); }
            100% { transform: translateX(-18px) rotate(1080deg); }
          }
          @keyframes v-mm7a-scratch {
            0%, 26% { opacity: 0.85; }
            46%, 100% { opacity: 0; }
          }
          @keyframes v-mm7a-gloss {
            0%, 45% { opacity: 0; }
            70%, 100% { opacity: 1; }
          }
          @keyframes v-mm7a-star {
            0%, 62% { opacity: 0; }
            78% { opacity: 1; }
            88% { opacity: 0.5; }
            100% { opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-mm7a-wheel { animation: none; transform: rotate(20deg); }
            .v-mm7a-scratch { animation: none; opacity: 0; }
            .v-mm7a-gloss { animation: none; opacity: 1; }
            .v-mm7a-star { animation: none; opacity: 1; }
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
          Полировка: матовое → глянец
        </text>

        {/* Поверхность детали */}
        <rect x="24" y="112" width="232" height="30" rx="4" fill="#475569" />

        {/* Микроцарапины матовой части */}
        {SCRATCHES.map(([x1, y1, x2, y2], index) => (
          <line
            key={`scratch-${x1}-${y1}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#94a3b8"
            strokeWidth="1.2"
            className="v-mm7a-scratch"
            style={{ animationDelay: `${index * 0.35}s` }}
          />
        ))}


        {/* Войлочный круг с пастой: вращается и ведёт по поверхности */}
        <g className="v-mm7a-wheel">
          <circle cx="160" cy="78" r="34" fill="#334155" stroke="#64748b" />
          {FELT_HAIRS.map(([x, y]) => (
            <line key={`hair-${x}-${y}`} x1="160" y1="78" x2={x} y2={y} stroke="#64748b" strokeWidth="1" />
          ))}
        </g>

        {/* Глянец и звезда блика на отполированной части */}
        <rect
          x="196"
          y="116"
          width="56"
          height="6"
          rx="3"
          fill="#7dd3fc"
          fillOpacity="0.3"
          className="v-mm7a-gloss"
        />
        <polygon points={GLOSS_STAR} fill="#e0f2fe" className="v-mm7a-star" />

        <text x="12" y="52" fontSize="7.5" fill="#e2e8f0">
          войлок + паста ГОИ
        </text>
        <text x="12" y="156" fontSize="7.5" fill="#e2e8f0">
          матовая поверхность
        </text>
        <text x="190" y="156" fontSize="7.5" fill="#e2e8f0">
          и после — глянец
        </text>
        <text x="12" y="170" fontSize="7.5" fill="#94a3b8">
          работать с водой — пыль вредна
        </text>
      </svg>
    </VisualWrapper>
  );
}
