import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Три дорожки материала: холодная, рабочая и перегретая. */
const columns = [
  { x: 20, temp: "180 °C", tempFill: "#93c5fd", word: "густой", note: "щели" },
  { x: 116, temp: "210 °C", tempFill: "#6ee7b7", word: "ровно", note: "без щелей" },
  { x: 212, temp: "240 °C", tempFill: "#fca5a5", word: "жидкий", note: "нити" },
];

/** Кусок густого пластика: три отрезка с щелями между ними. */
const thickSegments = [20, 45, 70];

/** Капли жидкого пластика, свисающие с линии. */
const drips = [
  { cx: 222, cy: 95 },
  { cx: 240, cy: 97 },
  { cx: 258, cy: 95 },
];

/**
 * Что происходит при разной температуре — три дорожки в одном кадре.
 *
 * Ровно по content урока: «180 °C — густой, щели. 210 °C — ровно. 240 °C — жидкий,
 * нити». Слева холодный пластик ложится отдельными комками (щели пульсируют),
 * в середине линия идёт ровно (по ней бежит светлая волна), справа жидкий пластик
 * тянет нити и капли падают.
 *
 * От анимации первого слоя (урок 5, одна линия крупным планом) отличается тем, что
 * здесь три РАЗНЫЕ дорожки рядом и сравнение идёт по температуре, а не по зазору
 * сопла до стола.
 */
export function Basic4Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация: при 180 °C пластик ложится густыми комками с щелями, при 210 °C линия идёт ровно, при 240 °C пластик жидкий и тянет нити"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-b4a-thick { animation: v-b4a-shift 3s ease-in-out infinite; }
          .v-b4a-wave { animation: v-b4a-run 3s linear infinite; }
          .v-b4a-drip { animation: v-b4a-fall 3s ease-in infinite; }
          @keyframes v-b4a-shift {
            0%, 100% { transform: translateX(0); }
            50% { transform: translateX(2px); }
          }
          @keyframes v-b4a-run {
            0% { transform: translateX(0); opacity: 0.25; }
            50% { opacity: 0.95; }
            100% { transform: translateX(50px); opacity: 0.25; }
          }
          @keyframes v-b4a-fall {
            0% { transform: translateY(0); opacity: 1; }
            70% { transform: translateY(4px); opacity: 0.2; }
            100% { transform: translateY(4px); opacity: 0; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-b4a-thick, .v-b4a-wave, .v-b4a-drip { animation: none; }
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

        {columns.map((column, index) => (
          <g key={column.temp}>
            <text x={column.x} y="26" fontSize="11" fontWeight="bold" fill={column.tempFill}>
              {column.temp}
            </text>

            {/* Сопло */}
            <polygon
              points={`${column.x + 14},40 ${column.x + 26},40 ${column.x + 20},52`}
              fill="#94a3b8"
            />

            {/* Материал: густые комки, ровная линия или жидкая струйка */}
            {index === 0 ? (
              <g className="v-b4a-thick">
                {thickSegments.map((x) => (
                  <rect
                    key={x}
                    x={x}
                    y="86"
                    width="16"
                    height="7"
                    rx="3"
                    fill="#94a3b8"
                  />
                ))}
              </g>
            ) : null}
            {index === 1 ? (
              <>
                <rect x="116" y="86" width="66" height="7" rx="3" fill="#34d399" />
                <rect
                  className="v-b4a-wave"
                  x="116"
                  y="86"
                  width="14"
                  height="7"
                  rx="3"
                  fill="#a7f3d0"
                />
              </>
            ) : null}
            {index === 2 ? (
              <>
                <rect x="212" y="87" width="66" height="5" rx="2" fill="#f59e0b" />
                {drips.map((drop, dropIndex) => (
                  <circle
                    key={drop.cx}
                    className="v-b4a-drip"
                    cx={drop.cx}
                    cy={drop.cy}
                    r="2.5"
                    fill="#fbbf24"
                    style={{ animationDelay: `${dropIndex * 0.4}s` }}
                  />
                ))}
              </>
            ) : null}

            <text x={column.x} y="120" fontSize="10" fill="#e2e8f0">
              {column.word}
            </text>
            <text x={column.x} y="136" fontSize="10" fill="#94a3b8">
              {column.note}
            </text>
          </g>
        ))}

        {/* Шкала температуры под дорожками */}
        <defs>
          <linearGradient id="v-b4a-scale" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="50%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#f87171" />
          </linearGradient>
        </defs>
        <rect x="20" y="148" width="258" height="6" rx="3" fill="url(#v-b4a-scale)" />
        {[53, 149, 245].map((x) => (
          <line key={x} x1={x} y1="146" x2={x} y2="156" stroke="#e2e8f0" strokeWidth="1" />
        ))}
        <text x="160" y="172" fontSize="10" fill="#94a3b8" textAnchor="middle">
          температура выше
        </text>
      </svg>
    </VisualWrapper>
  );
}
