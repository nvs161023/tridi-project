import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Как принтер строит модель — вид сбоку, крупный план.
 *
 * Ракурс: строго сбоку (в отличие от изометрии в соседнем блоке «Устройство
 * принтера»), масштаб — одна стенка и сопло. Показаны слои, которые появляются
 * снизу вверх, и разрез стены: две стенки, а между ними решётка заполнения,
 * вынесенная в лупу справа (из content: «Внутри — решётка, не сплошной пластик»).
 *
 * Анимация 3 с, по кругу: сопло едет вдоль стола, сверху проявляется новый слой,
 * штриховая линия пластика бежит за соплом. При prefers-reduced-motion анимация
 * выключается, и остаётся статичный кадр с готовой стенкой.
 *
 * Классы анимации с префиксом v-b1a: <style> внутри SVG действует на всю
 * страницу, поэтому имена должны быть уникальными.
 */
export function Basic1Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация: сопло движется вдоль стола и наращивает модель слой за слоем; в разрезе видно, что внутри решётка заполнения, а не сплошной пластик"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-b1a-run { animation: v-b1a-move 3s ease-in-out infinite; }
          .v-b1a-layer { animation: v-b1a-appear 3s ease-in-out infinite; }
          .v-b1a-trail { animation: v-b1a-flow 1.2s linear infinite; }
          @keyframes v-b1a-move {
            0%, 100% { transform: translateX(-38px); }
            50% { transform: translateX(44px); }
          }
          @keyframes v-b1a-appear {
            0%, 55% { opacity: 0.15; }
            70%, 100% { opacity: 1; }
          }
          @keyframes v-b1a-flow { to { stroke-dashoffset: -20; } }
          @media (prefers-reduced-motion: reduce) {
            .v-b1a-run, .v-b1a-layer, .v-b1a-trail {
              animation: none;
              opacity: 1;
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

        {/* Стол принтера */}
        <line x1="18" y1="150" x2="222" y2="150" stroke="#475569" strokeWidth="2" />

        {/* Стенка модели: пять слоёв снизу вверх, каждый — две стенки и решётка */}
        {[140, 130, 120, 110].map((bottom) => (
          <g key={bottom}>
            <rect x="74" y={bottom - 9} width="10" height="9" fill="#3b82f6" />
            <rect x="176" y={bottom - 9} width="10" height="9" fill="#3b82f6" />
            <path
              d={`M84 ${bottom - 1} L92 ${bottom - 8} M104 ${bottom - 1} L112 ${bottom - 8}
                  M124 ${bottom - 1} L132 ${bottom - 8} M144 ${bottom - 1} L152 ${bottom - 8}
                  M164 ${bottom - 1} L172 ${bottom - 8}`}
              stroke="#2563eb"
              strokeWidth="2"
            />
          </g>
        ))}

        {/* Верхний слой появляется по ходу анимации */}
        <g className="v-b1a-layer">
          <rect x="74" y="91" width="10" height="9" fill="#93c5fd" />
          <rect x="176" y="91" width="10" height="9" fill="#93c5fd" />
          <path
            d="M84 99 L92 92 M104 99 L112 92 M124 99 L132 92 M144 99 L152 92 M164 99 L172 92"
            stroke="#3b82f6"
            strokeWidth="2"
          />
        </g>

        {/* Сопло над стенкой */}
        <g className="v-b1a-run">
          <rect x="86" y="66" width="26" height="14" rx="2" fill="#334155" stroke="#475569" />
          <polygon points="94,80 104,80 99,90" fill="#f59e0b" />
          <circle cx="99" cy="88" r="3" fill="#f59e0b" fillOpacity="0.6" />
          <line
            x1="60"
            y1="73"
            x2="86"
            y2="73"
            stroke="#f59e0b"
            strokeWidth="1.4"
            strokeDasharray="5 4"
            className="v-b1a-trail"
          />
        </g>

        {/* Лупа: разрез стены — решётка заполнения */}
        <circle
          cx="266"
          cy="98"
          r="36"
          fill="#0f172a"
          stroke="#475569"
          strokeWidth="1.2"
          strokeDasharray="5 4"
        />
        {[74, 86, 98, 110].map((y) =>
          [246, 258, 270, 282].map((x) => (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="9"
              height="9"
              fill="#1e3a5f"
              stroke="#3b82f6"
              strokeWidth="0.8"
            />
          )),
        )}
        <line x1="228" y1="72" x2="242" y2="86" stroke="#475569" strokeWidth="0.9" />

        {/* Подписи */}
        <text x="18" y="44" fontSize="10" fill="#e2e8f0" dominantBaseline="middle">
          сопло
        </text>
        <polyline
          points="34,52 60,62 90,66"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="0.9"
          strokeDasharray="3 2"
        />
        <text x="18" y="168" fontSize="10" fill="#94a3b8" dominantBaseline="middle">
          слой за слоем — снизу вверх
        </text>
        <text x="232" y="150" fontSize="10" fill="#e2e8f0" dominantBaseline="middle">
          внутри —
        </text>
        <text x="232" y="164" fontSize="10" fill="#e2e8f0" dominantBaseline="middle">
          решётка
        </text>
      </svg>
    </VisualWrapper>
  );
}
