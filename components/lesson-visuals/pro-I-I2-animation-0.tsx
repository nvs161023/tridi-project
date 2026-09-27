import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Стрелки нагрузки сверху — по две над каждым образцом. */
const LOAD_X = [66, 94, 226, 254];

/** Волны gyroid: три строки внутри левого образца. */
const WAVES = [84, 98, 112];

/** Стрелки расхода усилия: диагонали у Gyroid, оси у Grid. */
const GYROID_ARROWS = [
  { x1: 80, y1: 98, x2: 62, y2: 84 },
  { x1: 80, y1: 98, x2: 98, y2: 84 },
  { x1: 80, y1: 98, x2: 62, y2: 112 },
  { x1: 80, y1: 98, x2: 98, y2: 112 },
];

const GRID_ARROWS = [
  { x1: 240, y1: 98, x2: 240, y2: 76 },
  { x1: 240, y1: 98, x2: 240, y2: 120 },
  { x1: 240, y1: 98, x2: 218, y2: 98 },
  { x1: 240, y1: 98, x2: 262, y2: 98 },
];

/**
 * Прочность разных форм из content урока: «15 % Gyroid vs 50 % Grid. Gyroid держит
 * нагрузку во все стороны, Grid — только по осям».
 *
 * Кадр — два ОБРАЗЦА В РАЗРЕЗЕ (видны стенки, а не плитки сверху), груз давит на
 * оба сверху, а внутри показано, куда уходит усилие: у Gyroid четыре диагональные
 * стрелки во все стороны, у Grid только четыре по осям, а диагональ обрывается
 * пунктиром с крестом.
 *
 * От «Как скорость влияет» из базового урока 7 отличается тем, что там две стенки
 * растут и расслаиваются, а здесь ни одна стенка не растёт и ничего не ломается:
 * предмет — направление усилия внутри решётки. От «Как ломается деталь» в F2 —
 * тем, что там поворот детали на 90° и трещина по слоям, здесь заполнение.
 *
 * Анимация 8 с: нагрузка нарастает и спадает, стрелки показывают ход усилия.
 * При prefers-reduced-motion кадр статичен — усилие показано в максимуме.
 */
export function ProII2Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация: под одной нагрузкой образец с 15 процентами Gyroid расходится усилием во все стороны и держится, а 50 процентов Grid держит только по осям — по диагонали усилие обрывается и проваливается"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-ii2a-load { animation: v-ii2a-press 8s ease-in-out infinite; }
          .v-ii2a-spread { animation: v-ii2a-flow 8s ease-in-out infinite; }
          .v-ii2a-diag { animation: v-ii2a-lost 8s ease-in-out infinite; }
          @keyframes v-ii2a-press {
            0%, 12% { opacity: 0.35; transform: translateY(-3px); }
            35%, 70% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0.35; transform: translateY(-3px); }
          }
          @keyframes v-ii2a-flow {
            0%, 20% { opacity: 0.45; }
            45%, 75% { opacity: 1; }
            100% { opacity: 0.45; }
          }
          @keyframes v-ii2a-lost {
            0%, 20% { opacity: 0.4; }
            45%, 75% { opacity: 0.6; }
            100% { opacity: 0.4; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-ii2a-load, .v-ii2a-spread, .v-ii2a-diag {
              animation: none; opacity: 1; transform: none;
            }
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

        <text x="12" y="16" fontSize="10" fill="#94a3b8">
          15 % Gyroid и 50 % Grid под одной нагрузкой
        </text>

        {/* Груз: стрелки давления сверху на оба образца */}
        <g className="v-ii2a-load">
          {LOAD_X.map((x) => (
            <g key={`load-${x}`}>
              <line x1={x} y1="32" x2={x} y2="48" stroke="#e2e8f0" strokeWidth="2" />
              <polygon points={`${x - 3},${46} ${x + 3},${46} ${x},${52}`} fill="#e2e8f0" />
            </g>
          ))}
        </g>

        {/* Левый образец: Gyroid 15 % */}
        <rect x="36" y="62" width="88" height="72" fill="#0f172a" stroke="#34d399" />
        <rect x="36" y="62" width="88" height="6" fill="#64748b" />
        <rect x="36" y="128" width="88" height="6" fill="#64748b" />
        <rect x="36" y="62" width="6" height="72" fill="#64748b" />
        <rect x="118" y="62" width="6" height="72" fill="#64748b" />
        {WAVES.map((y) => (
          <path
            key={`wave-${y}`}
            d={`M46,${y} q9,-7 18,0 q9,7 18,0 q9,-7 18,0 q9,7 18,0`}
            fill="none"
            stroke="#34d399"
            strokeWidth="1.4"
          />
        ))}
        <g className="v-ii2a-spread">
          {GYROID_ARROWS.map((arrow) => (
            <line
              key={`gyroid-${arrow.x2}-${arrow.y2}`}
              x1={arrow.x1}
              y1={arrow.y1}
              x2={arrow.x2}
              y2={arrow.y2}
              stroke="#6ee7b7"
              strokeWidth="1.8"
            />
          ))}
        </g>

        {/* Правый образец: Grid 50 % */}
        <rect x="196" y="62" width="88" height="72" fill="#0f172a" stroke="#38bdf8" />
        <rect x="196" y="62" width="88" height="6" fill="#64748b" />
        <rect x="196" y="128" width="88" height="6" fill="#64748b" />
        <rect x="196" y="62" width="6" height="72" fill="#64748b" />
        <rect x="278" y="62" width="6" height="72" fill="#64748b" />
        {[80, 98, 116].map((y) => (
          <line key={`gh-${y}`} x1="206" y1={y} x2="274" y2={y} stroke="#38bdf8" strokeWidth="1.2" />
        ))}
        {[218, 240, 262].map((x) => (
          <line key={`gv-${x}`} x1={x} y1="72" x2={x} y2="124" stroke="#38bdf8" strokeWidth="1.2" />
        ))}
        <g className="v-ii2a-load">
          {GRID_ARROWS.map((arrow) => (
            <line
              key={`grid-${arrow.x2}-${arrow.y2}`}
              x1={arrow.x1}
              y1={arrow.y1}
              x2={arrow.x2}
              y2={arrow.y2}
              stroke="#7dd3fc"
              strokeWidth="1.8"
            />
          ))}
        </g>
        <g className="v-ii2a-diag">
          <line x1="222" y1="80" x2="258" y2="116" stroke="#f87171" strokeWidth="1.4" strokeDasharray="4 3" />
          <line x1="250" y1="110" x2="258" y2="118" stroke="#f87171" strokeWidth="2" />
          <line x1="258" y1="110" x2="250" y2="118" stroke="#f87171" strokeWidth="2" />
        </g>

        <text x="80" y="150" fontSize="9.5" fontWeight="bold" fill="#6ee7b7" textAnchor="middle">
          Gyroid 15 %
        </text>
        <text x="80" y="168" fontSize="9" fill="#e2e8f0" textAnchor="middle">
          держится во все стороны
        </text>
        <text x="240" y="150" fontSize="9.5" fontWeight="bold" fill="#7dd3fc" textAnchor="middle">
          Grid 50 %
        </text>
        <text x="240" y="168" fontSize="9" fill="#e2e8f0" textAnchor="middle">
          по осям — да, диагональ — нет
        </text>
      </svg>
    </VisualWrapper>
  );
}

