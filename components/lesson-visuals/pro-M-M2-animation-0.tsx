import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Стопка кадров на входе: рамки со сдвигом, внутри — силуэт объекта. */
const FRAMES = [
  { x: 20, y: 48 },
  { x: 28, y: 58 },
  { x: 36, y: 68 },
  { x: 44, y: 78 },
];

/** Облако точек: разреженное, затем плотное — точки вокруг вазы. */
const CLOUD = [
  [108, 72],
  [116, 64],
  [126, 60],
  [136, 62],
  [144, 70],
  [148, 82],
  [146, 94],
  [140, 104],
  [130, 110],
  [118, 108],
  [110, 100],
  [106, 88],
  [122, 84],
  [132, 78],
  [138, 88],
  [128, 96],
  [118, 92],
  [134, 100],
  [124, 70],
  [142, 76],
];

/** Контур вазы полигонами — mesh-модель после сборки. */
const VASE_OUTLINE =
  "200,124 204,110 198,96 206,80 206,68 230,68 230,80 238,96 232,110 236,124";

/** Диагонали триангуляции внутри вазы. */
const VASE_LINES = [
  [200, 124, 204, 110],
  [204, 110, 206, 80],
  [206, 80, 230, 68],
  [230, 68, 232, 110],
  [232, 110, 236, 124],
  [204, 110, 230, 110],
  [206, 80, 230, 110],
];

/** Пятна текстуры, которые проявляются в финале. */
const TEXTURE_SPOTS = [
  [210, 86],
  [222, 78],
  [228, 96],
  [216, 108],
  [206, 114],
];

/**
 * Сборка модели: слева стопка кадров-фотографий, в центре разреженное облако
 * точек, справа полигональная сетка вазы, которая в финале покрывается цветной
 * текстурой.
 *
 * Ровно по content урока: «Фото → точки → mesh → текстура. 3D-модель готова» и
 * по text урока: «Камера + свет. 20–50 фото вокруг объекта».
 *
 * От «сканирования» в M1-animation отличается входом и финалом: там один лазер
 * и точки на детали, финал — голая сетка без текстуры. Здесь вход — стопка
 * кадров, которые слетаются, а финал — модель с текстурой. От сцены-цикла
 * E2-E2-3 (сушилка и хранение) — предметом: здесь реконструкция модели, не
 * пластик. От D1-animation (строка кода и сопло) — тем, что нет ни кода, ни
 * принтера.
 *
 * Анимация 9 с, по кругу. Классы с префиксом v-mm2a: <style> внутри SVG
 * действует на всю страницу.
 */
export function ProMM2Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация сборки модели: стопка кадров-фотографий слетается к центру, из них собирается облако точек, точки уплотняются в полигональную сетку вазы, и в финале сетка покрывается цветной текстурой — модель готова"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >

        <style>{`
          .v-mm2a-frame { animation: v-mm2a-frame 9s ease-in-out infinite; animation-fill-mode: backwards; }
          .v-mm2a-dot { animation: v-mm2a-dot 9s linear infinite; }
          .v-mm2a-mesh { animation: v-mm2a-mesh 9s ease-in-out infinite; }
          .v-mm2a-tex { animation: v-mm2a-tex 9s ease-in-out infinite; }
          @keyframes v-mm2a-frame {
            0% { opacity: 1; transform: translate(0, 0); }
            34% { opacity: 1; transform: translate(20px, 6px); }
            50% { opacity: 0.25; transform: translate(34px, 10px); }
            100% { opacity: 0.25; transform: translate(34px, 10px); }
          }
          @keyframes v-mm2a-dot {
            0%, 26% { opacity: 0; }
            42% { opacity: 1; }
            92% { opacity: 1; }
            100% { opacity: 0; }
          }
          @keyframes v-mm2a-mesh {
            0%, 46% { opacity: 0; }
            66%, 100% { opacity: 1; }
          }
          @keyframes v-mm2a-tex {
            0%, 66% { opacity: 0; }
            86%, 100% { opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-mm2a-frame { animation: none; opacity: 1; transform: translate(6px, 2px); }
            .v-mm2a-dot { animation: none; opacity: 1; }
            .v-mm2a-mesh { animation: none; opacity: 1; }
            .v-mm2a-tex { animation: none; opacity: 1; }
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
          Сборка модели: фото → точки → mesh → текстура
        </text>

        {/* Вход: стопка кадров-фотографий */}
        {FRAMES.map((frame, index) => (
          <g
            key={`frame-${frame.x}-${frame.y}`}
            className="v-mm2a-frame"
            style={{ animationDelay: `${index * 0.18}s` }}
          >
            <rect
              x={frame.x}
              y={frame.y}
              width="32"
              height="24"
              rx="2"
              fill="#0f172a"
              stroke="#34d399"
              strokeWidth="1.2"
            />
            <rect x={frame.x + 8} y={frame.y + 7} width="16" height="10" fill="#475569" />
          </g>
        ))}

        {/* Стрелка потока: кадры уходят в облако */}
        <line x1="86" y1="90" x2="98" y2="90" stroke="#64748b" strokeWidth="1.4" />
        <polygon points="96,86 104,90 96,94" fill="#64748b" />


        {/* Облако точек: сначала разреженное, затем плотное */}
        {CLOUD.map(([x, y], index) => (
          <circle
            key={`cloud-${x}-${y}`}
            cx={x}
            cy={y}
            r="1.4"
            fill="#fca5a5"
            className="v-mm2a-dot"
            style={{ animationDelay: `${(index % 10) * 0.2}s` }}
          />
        ))}

        {/* Стрелка потока: облако уплотняется в сетку */}
        <line x1="156" y1="90" x2="184" y2="90" stroke="#64748b" strokeWidth="1.4" />
        <polygon points="182,86 190,90 182,94" fill="#64748b" />

        {/* Полигональная сетка вазы */}
        <g className="v-mm2a-mesh" stroke="#93c5fd" fill="none">
          <polygon points={VASE_OUTLINE} strokeWidth="1.3" />
          {VASE_LINES.map(([x1, y1, x2, y2]) => (
            <line
              key={`vase-${x1}-${y1}-${x2}-${y2}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              strokeWidth="0.8"
              strokeOpacity="0.75"
            />
          ))}
        </g>

        {/* Текстура: цвет и пятна поверх сетки — финал сборки */}
        <g className="v-mm2a-tex">
          <polygon points={VASE_OUTLINE} fill="#f59e0b" fillOpacity="0.45" />
          {TEXTURE_SPOTS.map(([x, y]) => (
            <circle key={`spot-${x}-${y}`} cx={x} cy={y} r="4" fill="#fbbf24" fillOpacity="0.6" />
          ))}
        </g>

        <text x="16" y="140" fontSize="7.5" fill="#e2e8f0">
          20–50 фото
        </text>
        <text x="100" y="156" fontSize="7.5" fill="#94a3b8">
          облако точек
        </text>
        <text x="196" y="172" fontSize="7.5" fill="#e2e8f0">
          mesh → текстура
        </text>
      </svg>
    </VisualWrapper>
  );
}
