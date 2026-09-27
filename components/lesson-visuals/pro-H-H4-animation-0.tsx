import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Как это работает: одно сопло бежит по одной детали — на ровном участке за ним
 * остаётся толстая полоса (0,28 мм), на деталировке тонкая (0,12 мм); под
 * деталью ступенчатый профиль высоты слоя, справа счётчик времени.
 *
 * Ровно по content урока: «Сопло печатает ровный участок толстым слоем, деталь —
 * тонким. Время сокращается, качество сохраняется» и по важному из урока: «Не
 * ставь больше 0,3 мм — расслоение».
 *
 * От «Как создаётся рельеф» в модуле G отличается предметом кадра: там две
 * стенки-колонки растут в разрезе рядом и сравнивается ровная стенка с
 * текстурой; здесь одна деталь, по ней едет сопло, за ним тянутся две полосы
 * разной высоты, а под деталью показан профиль высоты слоя и счётчик времени.
 *
 * Анимация 8 с, по кругу: сопло проходит ровный участок, за ним растёт толстая
 * полоса, затем деталировку — с тонкой полосой, и кадр держится целиком. При
 * prefers-reduced-motion обе полосы показаны сразу, сопло — в конце прохода.
 *
 * Классы с префиксом v-hh4a: <style> внутри SVG действует на всю страницу.
 */
export function ProHH4Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация переменной высоты слоя: сопло бежит по одной детали — на ровном участке за ним остаётся толстая полоса 0,28 мм, на деталировке тонкая 0,12 мм, под деталью ступенчатый профиль высоты слоя, справа счётчик: было 8 часов, стало 5,6 часа, экономия 30 процентов"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-hh4a-strip1 {
            animation: v-hh4a-strip1 8s linear infinite;
            transform-box: fill-box;
            transform-origin: left center;
          }
          @keyframes v-hh4a-strip1 {
            0%, 8% { transform: scaleX(0); }
            42%, 92% { transform: scaleX(1); }
            97%, 100% { transform: scaleX(0); }
          }
          .v-hh4a-strip2 {
            animation: v-hh4a-strip2 8s linear infinite;
            transform-box: fill-box;
            transform-origin: left center;
          }
          @keyframes v-hh4a-strip2 {
            0%, 50% { transform: scaleX(0); }
            84%, 92% { transform: scaleX(1); }
            97%, 100% { transform: scaleX(0); }
          }
          .v-hh4a-nozzle { animation: v-hh4a-nozzle 8s linear infinite; }
          @keyframes v-hh4a-nozzle {
            0%, 8% { transform: translateX(34px); }
            42% { transform: translateX(94px); }
            50% { transform: translateX(94px); }
            84%, 92% { transform: translateX(176px); }
            97%, 100% { transform: translateX(34px); }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-hh4a-strip { animation: none; transform: none; }
            .v-hh4a-nozzle { animation: none; transform: translateX(176px); }
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
          сопло: толсто на ровном, тонко на деталях
        </text>

        {/* Деталь: напечатанная часть */}
        <rect x="30" y="92" width="156" height="34" fill="#334155" stroke="#64748b" />

        {/* Полосы, которые тянет за собой сопло */}
        <rect
          className="v-hh4a-strip v-hh4a-strip1"
          x="34"
          y="84"
          width="60"
          height="8"
          fill="#7dd3fc"
          fillOpacity="0.35"
          stroke="#7dd3fc"
        />
        <rect
          className="v-hh4a-strip v-hh4a-strip2"
          x="94"
          y="88"
          width="92"
          height="4"
          fill="#7dd3fc"
          fillOpacity="0.35"
          stroke="#7dd3fc"
        />

        {/* Сопло, которое едет вдоль детали */}
        <g className="v-hh4a-nozzle">
          <rect x="0" y="64" width="10" height="6" fill="#cbd5e1" />
          <polygon points="0,70 10,70 7,82 3,82" fill="#cbd5e1" />
        </g>

        {/* Профиль высоты слоя под деталью */}
        <rect x="30" y="132" width="64" height="10" fill="#7dd3fc" fillOpacity="0.25" stroke="#7dd3fc" />
        <rect x="94" y="137" width="92" height="5" fill="#7dd3fc" fillOpacity="0.25" stroke="#7dd3fc" />

        <text x="62" y="160" fontSize="9" fill="#7dd3fc" textAnchor="middle">
          0,28 мм
        </text>
        <text x="140" y="160" fontSize="9" fill="#7dd3fc" textAnchor="middle">
          0,12 мм
        </text>
        <text x="12" y="176" fontSize="9" fill="#94a3b8">
          время сокращается, качество сохраняется
        </text>

        {/* Счётчик времени */}
        <rect x="212" y="56" width="84" height="96" rx="6" fill="#0f172a" stroke="#475569" />
        <text x="254" y="74" fontSize="9" fill="#94a3b8" textAnchor="middle">
          Время
        </text>
        <text x="254" y="92" fontSize="9" fill="#94a3b8" textAnchor="middle">
          было 8 ч
        </text>
        <text x="254" y="116" fontSize="12" fontWeight="bold" fill="#6ee7b7" textAnchor="middle">
          5,6 ч
        </text>
        <text x="254" y="138" fontSize="9" fill="#6ee7b7" textAnchor="middle">
          −30%
        </text>
      </svg>
    </VisualWrapper>
  );
}
