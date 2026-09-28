import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Силуэт детали: пластина с бобышкой. Весь цикл он не меняется — это и есть суть. */
const SILHOUETTE = "112,132 112,72 140,72 140,58 168,58 168,72 208,72 208,132";

/** Густая сетка: вертикали и горизонтали мелкого шага, обрезанные по силуэту. */
const DENSE_X = [118, 124, 130, 136, 142, 148, 154, 160, 166, 172, 178, 184, 190, 196, 202];
const DENSE_Y = [76, 84, 92, 100, 108, 116, 124, 132];

/** Редкая сетка после упрощения: те же детали, но крупными треугольниками. */
const SPARSE_X = [120, 144, 168, 192];
const SPARSE_Y = [84, 108];
const SPARSE_DIAGONALS: [number, number, number, number][] = [
  [120, 84, 144, 108],
  [144, 84, 168, 108],
  [168, 84, 192, 108],
  [144, 108, 168, 84],
  [168, 108, 192, 84],
];

/** Мелкий шум на поверхности: точки-пылинки, которые уходят вместе с мелкой сеткой. */
const NOISE: [number, number][] = [
  [120, 66],
  [132, 62],
  [146, 54],
  [158, 52],
  [172, 56],
  [186, 62],
  [198, 68],
  [150, 78],
  [166, 80],
  [180, 86],
  [136, 88],
  [196, 96],
];

/**
 * Упрощение модели: сетка редеет, а форма остаётся той же. Густая сетка мелких
 * треугольников гаснет, на её месте проявляется редкая из крупных, вместе с сеткой
 * уходит шум-пылинки на поверхности. Контур силуэта всё время на месте — на нём и
 * строится мысль «форма та же». Слева счётчики полигонов, справа вес файла: было
 * «1 000 000» и «120 МБ», стало «100 000» и «12 МБ».
 *
 * Ровно по content урока: «1 млн полигонов → 100 тыс. Модель легче, качество
 * сохраняется».
 *
 * От морфинга L-L3-animation-0 отличается тем, что там форма меняется от стадии к
 * стадии, а здесь форма неподвижна и меняется только плотность сетки. От прогресса
 * «10 действий» и дорожек L-L1 — отсутствием этапов: в кадре одно превращение.
 *
 * Анимация 8 с, цикл: до 3 с густая сетка и шум, после 4,5 с редкая сетка и лёгкий
 * файл. При prefers-reduced-motion показан финал — редкая сетка и «100 000».
 *
 * Классы с префиксом v-nn3a: <style> внутри SVG действует на всю страницу.
 */
export function ProNN3Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация упрощения: силуэт детали остаётся неизменным, густая сетка мелких треугольников и шум на поверхности сменяются редкой сеткой крупных треугольников; счётчики показывают, что полигонов стало 100 тысяч вместо миллиона, а вес файла упал со 120 до 12 мегабайт"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-nn3a-dense { animation: v-nn3a-thin 8s ease-in-out infinite; }
          .v-nn3a-sparse { animation: v-nn3a-grow 8s ease-in-out infinite; }
          .v-nn3a-noise { animation: v-nn3a-vanish 8s ease-in-out infinite; }
          .v-nn3a-heavy { animation: v-nn3a-dim 8s ease-in-out infinite; }
          .v-nn3a-light { animation: v-nn3a-bright 8s ease-in-out infinite; }
          @keyframes v-nn3a-thin {
            0%, 38% { opacity: 1; }
            56%, 100% { opacity: 0.1; }
          }
          @keyframes v-nn3a-grow {
            0%, 38% { opacity: 0; }
            56%, 100% { opacity: 1; }
          }
          @keyframes v-nn3a-vanish {
            0%, 34% { opacity: 1; }
            50%, 100% { opacity: 0; }
          }
          @keyframes v-nn3a-dim {
            0%, 38% { opacity: 1; }
            56%, 100% { opacity: 0.25; }
          }
          @keyframes v-nn3a-bright {
            0%, 38% { opacity: 0.25; }
            56%, 100% { opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-nn3a-dense { animation: none; opacity: 0.1; }
            .v-nn3a-sparse { animation: none; opacity: 1; }
            .v-nn3a-noise { animation: none; opacity: 0; }
            .v-nn3a-heavy { animation: none; opacity: 0.25; }
            .v-nn3a-light { animation: none; opacity: 1; }
          }
        `}</style>

        <defs>
          <clipPath id="v-nn3a-outline">
            <polygon points={SILHOUETTE} />
          </clipPath>
        </defs>

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
          Упрощение: редеет сетка, форма та же
        </text>

        {/* Объём детали: заливка и неподвижный контур */}
        <polygon points={SILHOUETTE} fill="#334155" />

        {/* Густая сетка: мелкие треугольники, которые уходят */}
        <g className="v-nn3a-dense" clipPath="url(#v-nn3a-outline)" stroke="#93c5fd" strokeWidth="0.5">
          {DENSE_X.map((x) => (
            <line key={`dense-x-${x}`} x1={x} y1="56" x2={x} y2="134" />
          ))}
          {DENSE_Y.map((y) => (
            <line key={`dense-y-${y}`} x1="110" y1={y} x2="210" y2={y} />
          ))}
        </g>

        {/* Редкая сетка: крупные треугольники, которые остаются */}
        <g className="v-nn3a-sparse" clipPath="url(#v-nn3a-outline)" stroke="#93c5fd" strokeWidth="0.9">
          {SPARSE_X.map((x) => (
            <line key={`sparse-x-${x}`} x1={x} y1="56" x2={x} y2="134" />
          ))}
          {SPARSE_Y.map((y) => (
            <line key={`sparse-y-${y}`} x1="110" y1={y} x2="210" y2={y} />
          ))}
          {SPARSE_DIAGONALS.map(([x1, y1, x2, y2]) => (
            <line key={`sparse-d-${x1}-${y1}-${x2}-${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} />
          ))}
        </g>

        {/* Шум-пылинки: уходит вместе с мелкой сеткой */}
        <g className="v-nn3a-noise">
          {NOISE.map(([x, y]) => (
            <circle key={`noise-${x}-${y}`} cx={x} cy={y} r="1.2" fill="#fbbf24" />
          ))}
        </g>

        <polygon
          points={SILHOUETTE}
          fill="none"
          stroke="#93c5fd"
          strokeWidth="1.4"
        />

        {/* Счётчики полигонов: было и стало */}
        <text x="12" y="44" fontSize="7.5" fill="#94a3b8">
          полигонов
        </text>
        <text className="v-nn3a-heavy" x="12" y="62" fontSize="10" fill="#e2e8f0">
          1 000 000
        </text>
        <text x="70" y="62" fontSize="7.5" fill="#94a3b8">
          было
        </text>
        <text className="v-nn3a-light" x="12" y="78" fontSize="10" fill="#7dd3fc">
          100 000
        </text>
        <text x="70" y="78" fontSize="7.5" fill="#94a3b8">
          стало
        </text>

        {/* Вес файла: было и стало */}
        <text x="248" y="44" fontSize="7.5" fill="#94a3b8">
          вес файла
        </text>
        <text className="v-nn3a-heavy" x="248" y="62" fontSize="10" fill="#e2e8f0">
          120 МБ
        </text>
        <text className="v-nn3a-light" x="248" y="78" fontSize="10" fill="#7dd3fc">
          12 МБ
        </text>

        <text x="12" y="152" fontSize="7.5" fill="#e2e8f0">
          форма та же — модель легче
        </text>
        <text x="12" y="167" fontSize="7.5" fill="#94a3b8">
          меньше полигонов — печатать быстрее
        </text>
      </svg>
    </VisualWrapper>
  );
}
