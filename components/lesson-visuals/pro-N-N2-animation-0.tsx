import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Четыре генератора полос по позициям обхода: корпус, точка выхода лучей и три
 * полосы структурированного света, которые падают на свой участок детали.
 */
const SCANNERS = [
  {
    cls: "v-nn2a-p1",
    body: [100, 42],
    from: [130, 49],
    targets: [
      [146, 88],
      [147, 92],
      [148, 96],
    ],
  },
  {
    cls: "v-nn2a-p2",
    body: [190, 42],
    from: [190, 49],
    targets: [
      [174, 88],
      [173, 92],
      [172, 96],
    ],
  },
  {
    cls: "v-nn2a-p3",
    body: [190, 118],
    from: [190, 125],
    targets: [
      [174, 102],
      [173, 106],
      [172, 109],
    ],
  },
  {
    cls: "v-nn2a-p4",
    body: [100, 118],
    from: [130, 125],
    targets: [
      [146, 102],
      [147, 106],
      [148, 109],
    ],
  },
] as const;

/** Частичные облака: точки, снятые с каждой из четырёх сторон детали. */
const PARTIAL_CLOUDS = [
  {
    cls: "v-nn2a-c1",
    dots: [
      [144.5, 89],
      [144, 93],
      [144.5, 97],
      [147, 87],
      [151, 87],
      [145, 101],
    ],
  },
  {
    cls: "v-nn2a-c2",
    dots: [
      [175.5, 89],
      [176, 93],
      [175.5, 97],
      [173, 87],
      [169, 87],
      [175, 101],
    ],
  },
  {
    cls: "v-nn2a-c3",
    dots: [
      [175, 103],
      [175.5, 107],
      [173, 109],
      [169, 110],
    ],
  },
  {
    cls: "v-nn2a-c4",
    dots: [
      [145, 103],
      [144.5, 107],
      [147, 109],
      [151, 110],
    ],
  },
] as const;

/**
 * Контур сшитого облака: эллипс вокруг детали, разорванный в двух местах — там,
 * где скан не добрал поверхность. Разрывы обозначены оранжевыми молниями.
 */
const STITCH_ARCS = [
  "199.8,118.1 208.9,107.3 212,95 208.9,82.7 199.8,71.9 186,63.8 169,59.5",
  "151,59.5 134,63.8 120.2,71.9 111.1,82.7 108,95 111.1,107.3",
  "120.2,118.1 134,126.2 151,130.5",
  "169,130.5 186,126.2 199.8,118.1",
];

/** Молнии в разрывах: верхний пропуск и нижний пропуск. */
const GAPS = ["154,57 158,61 162,57 166,61", "154,128 158,132 162,128 166,132"];

/** Счётчик позиций: четыре строки журнала, каждая загорается после своей позиции. */
const COUNTS = [
  { cls: "v-nn2a-n1", text: "позиция 1 снята" },
  { cls: "v-nn2a-n2", text: "позиция 2 снята" },
  { cls: "v-nn2a-n3", text: "позиция 3 снята" },
  { cls: "v-nn2a-n4", text: "позиция 4 снята" },
];

/**
 * Сканирование: деталь стоит неподвижно, а генератор полос обходит её с четырёх
 * сторон — сверху слева, сверху справа, снизу справа и снизу слева. После каждой
 * позиции на детали остаётся своё частичное облако (красные точки по снятой
 * стороне), а в конце четыре частичных облака сшиваются в один контур. В контуре
 * видны два разрыва — пропуски, которые не снялись: они отмечены молниями и уходят
 * в обработку на следующем шаге.
 *
 * Ровно по content урока: «Лазер или структурированный свет проходит по объекту.
 * Облако точек превращается в mesh. Модель готова к обработке», плюс мост к уроку
 * N3 об обработке.
 *
 * От сканирования M-M1-animation-0 отличается прибором и сюжетом: там лазерная
 * линия превращала деталь в точки, здесь деталь неподвижна, полосы падают с четырёх
 * позиций, и главное — сшивка частичных облаков с пропусками.
 *
 * Анимация 12 с, цикл: четыре позиции по 2,4 с и сшивка в конце. При
 * prefers-reduced-motion показан финал — сшитое облако, пропуски и счётчик 4 из 4.
 *
 * Классы с префиксом v-nn2a: <style> внутри SVG действует на всю страницу.
 */
export function ProNN2Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация сканирования: деталь неподвижно стоит на подиуме, генератор полос обходит её с четырёх сторон и оставляет четыре частичных облака из красных точек, затем частичные облака сшиваются в один контур с двумя пропусками; счётчик показывает, сколько позиций снято"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-nn2a-p1 { animation: v-nn2a-scan 12s linear infinite; }
          .v-nn2a-p2 { animation: v-nn2a-scan 12s linear 2.4s infinite; animation-fill-mode: backwards; }
          .v-nn2a-p3 { animation: v-nn2a-scan 12s linear 4.8s infinite; animation-fill-mode: backwards; }
          .v-nn2a-p4 { animation: v-nn2a-scan 12s linear 7.2s infinite; animation-fill-mode: backwards; }
          @keyframes v-nn2a-scan {
            0% { opacity: 1; }
            16% { opacity: 1; }
            20%, 100% { opacity: 0.22; }
          }
          .v-nn2a-c1 { animation: v-nn2a-cloud1 12s linear infinite; }
          .v-nn2a-c2 { animation: v-nn2a-cloud2 12s linear infinite; }
          .v-nn2a-c3 { animation: v-nn2a-cloud3 12s linear infinite; }
          .v-nn2a-c4 { animation: v-nn2a-cloud4 12s linear infinite; }
          @keyframes v-nn2a-cloud1 {
            0% { opacity: 0; }
            17%, 98% { opacity: 1; }
            100% { opacity: 0; }
          }
          @keyframes v-nn2a-cloud2 {
            0%, 18% { opacity: 0; }
            35%, 98% { opacity: 1; }
            100% { opacity: 0; }
          }
          @keyframes v-nn2a-cloud3 {
            0%, 38% { opacity: 0; }
            55%, 98% { opacity: 1; }
            100% { opacity: 0; }
          }
          @keyframes v-nn2a-cloud4 {
            0%, 58% { opacity: 0; }
            75%, 98% { opacity: 1; }
            100% { opacity: 0; }
          }
          .v-nn2a-stitch { animation: v-nn2a-stitch 12s linear infinite; }
          @keyframes v-nn2a-stitch {
            0%, 78% { opacity: 0; }
            90%, 98% { opacity: 1; }
            100% { opacity: 0; }
          }
          .v-nn2a-gap { animation: v-nn2a-gap 12s linear infinite; }
          @keyframes v-nn2a-gap {
            0%, 82% { opacity: 0; }
            92%, 98% { opacity: 1; }
            100% { opacity: 0; }
          }
          .v-nn2a-n1 { animation: v-nn2a-count1 12s linear infinite; }
          .v-nn2a-n2 { animation: v-nn2a-count2 12s linear infinite; }
          .v-nn2a-n3 { animation: v-nn2a-count3 12s linear infinite; }
          .v-nn2a-n4 { animation: v-nn2a-count4 12s linear infinite; }
          @keyframes v-nn2a-count1 {
            0%, 4% { opacity: 0; }
            12%, 18% { opacity: 1; }
            22%, 100% { opacity: 0; }
          }
          @keyframes v-nn2a-count2 {
            0%, 24% { opacity: 0; }
            32%, 38% { opacity: 1; }
            42%, 100% { opacity: 0; }
          }
          @keyframes v-nn2a-count3 {
            0%, 44% { opacity: 0; }
            52%, 58% { opacity: 1; }
            62%, 100% { opacity: 0; }
          }
          @keyframes v-nn2a-count4 {
            0%, 64% { opacity: 0; }
            72%, 98% { opacity: 1; }
            100% { opacity: 0; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-nn2a-p1, .v-nn2a-p2, .v-nn2a-p3, .v-nn2a-p4 { animation: none; opacity: 0.22; }
            .v-nn2a-c1, .v-nn2a-c2, .v-nn2a-c3, .v-nn2a-c4 { animation: none; opacity: 1; }
            .v-nn2a-stitch, .v-nn2a-gap { animation: none; opacity: 1; }
            .v-nn2a-n1, .v-nn2a-n2, .v-nn2a-n3, .v-nn2a-n4 { animation: none; opacity: 1; }
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
          Сканирование: обход по четырём сторонам
        </text>

        {/* Журнал позиций: строка загорается, когда позиция снята */}
        <rect x="228" y="26" width="80" height="80" rx="4" fill="#0f172a" stroke="#475569" />
        <text x="234" y="37" fontSize="7.5" fill="#94a3b8">
          журнал обхода
        </text>
        {COUNTS.map((count, index) => (
          <g key={count.cls} className={count.cls}>
            <circle cx="236" cy={49.5 + index * 15} r="2.2" fill="#38bdf8" />
            <text x="242" y={52 + index * 15} fontSize="7.5" fill="#e2e8f0">
              {count.text}
            </text>
          </g>
        ))}

        {/* Деталь на подиуме: стоит неподвижно весь цикл */}
        <rect x="138" y="110" width="44" height="8" fill="#334155" stroke="#64748b" />
        <rect x="146" y="88" width="28" height="22" fill="#475569" stroke="#64748b" />
        <circle cx="160" cy="99" r="4" fill="#0f172a" />

        {/* Генераторы полос: по одному на позицию обхода */}
        {SCANNERS.map((scanner) => (
          <g key={scanner.cls} className={scanner.cls}>
            <rect
              x={scanner.body[0]}
              y={scanner.body[1]}
              width="30"
              height="14"
              rx="3"
              fill="#334155"
              stroke="#64748b"
            />
            {scanner.targets.map(([tx, ty]) => (
              <line
                key={`ray-${scanner.cls}-${tx}-${ty}`}
                x1={scanner.from[0]}
                y1={scanner.from[1]}
                x2={tx}
                y2={ty}
                stroke="#38bdf8"
                strokeWidth="0.9"
              />
            ))}
          </g>
        ))}

        {/* Частичные облака: точки остаются после каждой позиции */}
        {PARTIAL_CLOUDS.map((cloud) => (
          <g key={cloud.cls} className={cloud.cls}>
            {cloud.dots.map(([x, y]) => (
              <circle key={`${cloud.cls}-${x}-${y}`} cx={x} cy={y} r="1.4" fill="#fca5a5" />
            ))}
          </g>
        ))}

        {/* Сшивка: единый контур облака с двумя разрывами-пропусками */}
        <g className="v-nn2a-stitch" fill="none" stroke="#fca5a5" strokeWidth="1">
          {STITCH_ARCS.map((points) => (
            <polyline key={points} points={points} />
          ))}
        </g>
        <g className="v-nn2a-gap" fill="none" stroke="#fbbf24" strokeWidth="1.2">
          {GAPS.map((points) => (
            <polyline key={points} points={points} />
          ))}
        </g>

        <text x="12" y="150" fontSize="7.5" fill="#e2e8f0">
          четыре позиции обхода
        </text>
        <text x="12" y="165" fontSize="7.5" fill="#94a3b8">
          частичные облака
        </text>
        <text x="213" y="150" fontSize="7.5" fill="#e2e8f0">
          сшивка в одно облако
        </text>
        <text x="205" y="165" fontSize="7.5" fill="#fbbf24">
          пропуски — в обработку
        </text>
      </svg>
    </VisualWrapper>
  );
}
