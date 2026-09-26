import type { CSSProperties } from "react";

import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Пять слоёв, на которые распадается модель. */
const layerTops = [48, 60, 72, 84, 96];

/** Точки траектории сопла: пила из девяти вершин. */
const pathPoints = [
  [196, 168],
  [206, 158],
  [216, 168],
  [226, 158],
  [236, 168],
  [246, 158],
  [256, 168],
  [266, 158],
  [276, 168],
];

/**
 * Как слайсер нарезает модель — анимация слева направо.
 *
 * Сюжет из content: «3D-модель разбивается на слои, как хлеб. Каждый слой —
 * траектория сопла». Поэтому композиция читается как процесс: модель с линиями
 * разреза → стрелка → разъехавшиеся слои → траектория сопла с бегущей точкой.
 *
 * Это обратный процесс к анимации «Как принтер строит модель» (та собирает стенку
 * снизу вверх и смотрит сбоку) — здесь модель распадается сверху вниз.
 *
 * Анимация 3,5 с, по кругу. При prefers-reduced-motion выключается: слои стоят на
 * месте, точка замирает на траектории, путь остаётся целиком.
 */
export function Basic3Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация: 3D-модель распадается на слои, как хлеб, и каждый слой превращается в траекторию движения сопла"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-b3a-layer { animation: v-b3a-split 3.5s ease-in-out infinite; }
          .v-b3a-arrow { animation: v-b3a-flow 1s linear infinite; }
          .v-b3a-dot { animation: v-b3a-run 3.5s linear infinite; }
          @keyframes v-b3a-split {
            0%, 20% { transform: translateY(0); }
            55%, 75% { transform: translateY(var(--v-b3a-shift)); }
            100% { transform: translateY(0); }
          }
          @keyframes v-b3a-flow { to { stroke-dashoffset: -16; } }
          @keyframes v-b3a-run {
            0% { transform: translate(0, 0); }
            25% { transform: translate(20px, -10px); }
            50% { transform: translate(40px, 0); }
            75% { transform: translate(60px, -10px); }
            100% { transform: translate(80px, 0); }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-b3a-layer, .v-b3a-arrow, .v-b3a-dot {
              animation: none;
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

        {/* 3D-модель с линиями разреза */}
        <polygon points="30,44 42,34 102,34 90,44" fill="#1e293b" stroke="#475569" />
        <polygon points="90,44 102,34 102,94 90,104" fill="#1e293b" stroke="#475569" />
        <rect x="30" y="44" width="60" height="60" fill="#334155" stroke="#475569" />
        {[56, 68, 80, 92].map((y) => (
          <line key={y} x1="30" y1={y} x2="90" y2={y} stroke="#94a3b8" strokeWidth="0.8" />
        ))}

        {/* Стрелка: модель отдаётся слайсеру */}
        <line
          x1="140"
          y1="74"
          x2="172"
          y2="74"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeDasharray="6 4"
          className="v-b3a-arrow"
        />
        <polygon points="172,68 184,74 172,80" fill="#3b82f6" />

        {/* Слои: разъезжаются и снова собираются */}
        {layerTops.map((top, index) => (
          <rect
            key={top}
            x="196"
            y={top}
            width="100"
            height="9"
            rx="2"
            fill="#1e3a5f"
            stroke="#3b82f6"
            className="v-b3a-layer"
            style={
              {
                "--v-b3a-shift": `${3 + index * 3}px`,
              } as CSSProperties
            }
          />
        ))}

        {/* Траектория сопла для одного слоя: линия видна всегда, точку ведёт анимация */}
        <polyline
          points={pathPoints.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2"
        />
        <circle cx="196" cy="168" r="3" fill="#f59e0b" className="v-b3a-dot" />

        {/* Подписи */}
        <text x="30" y="120" fontSize="10" fill="#e2e8f0" dominantBaseline="middle">
          3D-модель
        </text>
        <text x="30" y="136" fontSize="10" fill="#94a3b8" dominantBaseline="middle">
          нарезается на слои
        </text>
        <text x="196" y="120" fontSize="10" fill="#e2e8f0" dominantBaseline="middle">
          слои
        </text>
        <text x="196" y="140" fontSize="10" fill="#f59e0b" dominantBaseline="middle">
          траектория сопла
        </text>
      </svg>
    </VisualWrapper>
  );
}
