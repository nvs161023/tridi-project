import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Точки облака на детали: остаются за прошедшей лазерной плоскостью. */
const CLOUD_POINTS = [
  [48, 116],
  [52, 108],
  [60, 118],
  [58, 76],
  [58, 96],
  [70, 74],
  [74, 96],
  [74, 116],
  [84, 114],
  [86, 120],
  [94, 116],
  [100, 118],
  [104, 112],
  [104, 120],
  [88, 118],
  [63, 112],
];

/** Точки в полёте: облако перетекает к сетке. */
const FLYING_POINTS = [
  [120, 80],
  [130, 76],
  [140, 74],
  [150, 74],
  [160, 78],
  [170, 84],
];

/** Контур сетки: та же деталь, но полигонами. */
const MESH_OUTLINE = "176,124 176,110 190,110 190,74 206,74 206,110 244,110 244,124";

/** Диагонали триангуляции внутри контура. */
const MESH_LINES = [
  [176, 124, 190, 110],
  [190, 110, 206, 74],
  [206, 74, 244, 124],
  [190, 110, 206, 110],
  [190, 110, 244, 110],
  [206, 110, 244, 124],
];

/**
 * Сканирование: одна деталь и один лазерный сканер. Лазерная плоскость едет по
 * детали слева направо, за ней остаются точки облака, точки перелетают вправо и
 * там собирается голая полигональная сетка — mesh для печати.
 *
 * Ровно по content урока: «Лазер проходит по объекту, облако точек → mesh.
 * 3D-модель готова к печати».
 *
 * От «сборки модели» в M2-animation отличается входом и финалом: здесь один
 * лазер и точки на детали, финал — голая сетка без текстуры. Там вход — стопка
 * кадров, финал — модель с текстурой. От basic-1-animation (сопло наращивает
 * модель слоями) — тем, что ничего не печатается: лазер только снимает копию.
 *
 * Анимация 8 с, по кругу. Классы с префиксом v-mm1a: <style> внутри SVG
 * действует на всю страницу.
 */
export function ProMM1Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация сканирования: лазерная плоскость едет по детали слева направо, за ней остаются точки облака, точки перелетают вправо и собираются в голую полигональную сетку — mesh для печати, без текстуры"
      animated={animated}
    >

      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-mm1a-beam { animation: v-mm1a-beam 8s ease-in-out infinite; }
          .v-mm1a-dot { animation: v-mm1a-dot 8s linear infinite; animation-fill-mode: backwards; }
          .v-mm1a-fly { animation: v-mm1a-fly 8s ease-in-out infinite; animation-fill-mode: backwards; }
          .v-mm1a-mesh { animation: v-mm1a-mesh 8s ease-in-out infinite; }
          @keyframes v-mm1a-beam {
            0% { transform: translateX(0); }
            58% { transform: translateX(64px); }
            72% { transform: translateX(64px); }
            86% { transform: translateX(0); }
            100% { transform: translateX(0); }
          }
          @keyframes v-mm1a-dot {
            0% { opacity: 0; }
            8% { opacity: 1; }
            88% { opacity: 1; }
            96% { opacity: 0; }
            100% { opacity: 0; }
          }
          @keyframes v-mm1a-fly {
            0%, 56% { opacity: 0; transform: translate(0, 0); }
            64% { opacity: 1; }
            84% { opacity: 0; transform: translate(6px, 8px); }
            100% { opacity: 0; }
          }
          @keyframes v-mm1a-mesh {
            0%, 58% { opacity: 0; }
            78%, 100% { opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-mm1a-beam { animation: none; transform: translateX(64px); }
            .v-mm1a-dot { animation: none; opacity: 1; }
            .v-mm1a-fly { animation: none; opacity: 0.7; }
            .v-mm1a-mesh { animation: none; opacity: 1; }
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
          Сканирование: лазер → точки → mesh
        </text>
        <text x="236" y="30" fontSize="7.5" fill="#e2e8f0">
          лазерный сканер
        </text>

        {/* Один прибор: лазерный сканер над деталью */}
        <rect x="36" y="30" width="44" height="12" rx="3" fill="#334155" stroke="#64748b" />
        <circle cx="76" cy="36" r="3.5" fill="#f87171" />


        {/* Деталь-кронштейн */}
        <rect x="44" y="110" width="68" height="14" fill="#475569" stroke="#64748b" />
        <rect x="56" y="70" width="20" height="40" fill="#475569" stroke="#64748b" />
        <circle cx="66" cy="88" r="5" fill="#0f172a" />

        {/* Лазерная плоскость едет по детали */}
        <g className="v-mm1a-beam">
          <rect x="46" y="50" width="11" height="74" fill="#f87171" fillOpacity="0.12" />
          <rect x="50" y="52" width="2.5" height="70" fill="#f87171" />
        </g>

        {/* Облако точек, оставшееся за плоскостью */}
        {CLOUD_POINTS.map(([x, y], index) => (
          <circle
            key={`dot-${x}-${y}`}
            cx={x}
            cy={y}
            r="1.4"
            fill="#fca5a5"
            className="v-mm1a-dot"
            style={{ animationDelay: `${(index % 8) * 0.55}s` }}
          />
        ))}

        {/* Точки перелетают к сетке */}
        {FLYING_POINTS.map(([x, y], index) => (
          <circle
            key={`fly-${x}-${y}`}
            cx={x}
            cy={y}
            r="1.4"
            fill="#fca5a5"
            className="v-mm1a-fly"
            style={{ animationDelay: `${index * 0.12}s` }}
          />
        ))}

        {/* Голая полигональная сетка — mesh для печати */}
        <g className="v-mm1a-mesh" stroke="#93c5fd" fill="none">
          <polygon points={MESH_OUTLINE} strokeWidth="1.3" />
          {MESH_LINES.map(([x1, y1, x2, y2]) => (
            <line
              key={`mesh-${x1}-${y1}-${x2}-${y2}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              strokeWidth="0.8"
              strokeOpacity="0.75"
            />
          ))}
        </g>

        <text x="44" y="144" fontSize="7.5" fill="#e2e8f0">
          сканируем деталь
        </text>
        <text x="120" y="156" fontSize="7.5" fill="#94a3b8">
          облако точек
        </text>
        <text x="176" y="172" fontSize="7.5" fill="#e2e8f0">
          mesh → STL для печати
        </text>
      </svg>
    </VisualWrapper>
  );
}
