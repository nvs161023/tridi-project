import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Пять точек замера на прутке: X-координаты, с них снимают диаметр. */
const MEASURE_POINTS = [44, 76, 108, 140, 172];

/** Показания штангенциркуля по точкам — из content урока. */
const READINGS = [
  { y: 52, value: "1,74 мм" },
  { y: 70, value: "1,76 мм" },
  { y: 88, value: "1,75 мм" },
  { y: 106, value: "1,73 мм" },
  { y: 124, value: "1,75 мм" },
];

/**
 * Измерение филамента: губки штангенциркуля прикладываются по очереди в пяти
 * точках прутка, каждое показание выезжает строкой в столбик замеров, в финале
 * выделяется среднее 1,75 мм и появляется плашка слайсера с полем Diameter.
 *
 * Ровно по content урока: «Штангенциркуль в 5 местах катушки. Среднее — 1,75 мм.
 * Если 1,72 — внеси в слайсер» (предупреждение стоит строкой внизу).
 *
 * Замеров в курсе до сих пор не было: ни один кадр не показывает снятие размера
 * и столбик показаний. От M4-image-0 отличается тем, что там каталог приборов со
 * шкалами, а здесь один прибор в работе и журнал замеров.
 *
 * Анимация 10 с, по кругу: губки по очереди прикладываются к прутку в пяти
 * точках, показания выезжают одно за другим, к концу появляются среднее и плашка
 * слайсера. При prefers-reduced-motion показано всё сразу — полный протокол.
 *
 * Классы с префиксом v-mm4a: <style> внутри SVG действует на всю страницу.
 */
export function ProMM4Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация измерения филамента: губки штангенциркуля по очереди прикладываются к прутку в пяти точках, показания 1,74 и 1,76 и 1,75 и 1,73 и 1,75 выезжают в столбик, в финале выделяется среднее 1,75 мм и появляется плашка слайсера с полем Diameter, внизу предупреждение — если 1,72, внеси в слайсер"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >

        <style>{`
          .v-mm4a-jaw { animation: v-mm4a-jaw 10s ease-in-out infinite; animation-fill-mode: backwards; }
          .v-mm4a-value { animation: v-mm4a-value 10s linear infinite; animation-fill-mode: backwards; }
          .v-mm4a-total { animation: v-mm4a-total 10s ease-in-out infinite; }
          @keyframes v-mm4a-jaw {
            0% { opacity: 0; transform: translateY(-8px); }
            6% { opacity: 1; transform: translateY(0); }
            16% { opacity: 1; transform: translateY(0); }
            28%, 100% { opacity: 0.55; transform: translateY(0); }
          }
          @keyframes v-mm4a-value {
            0%, 4% { opacity: 0; transform: translateX(-6px); }
            10%, 100% { opacity: 1; transform: translateX(0); }
          }
          @keyframes v-mm4a-total {
            0%, 88% { opacity: 0; }
            94%, 100% { opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-mm4a-jaw { animation: none; opacity: 0.55; }
            .v-mm4a-value { animation: none; opacity: 1; transform: none; }
            .v-mm4a-total { animation: none; opacity: 1; }
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
          Измеряем пруток в пяти точках
        </text>
        <text x="216" y="36" fontSize="7.5" fill="#94a3b8">
          замеры, мм
        </text>

        {/* Пруток филамента */}
        <rect x="24" y="58" width="180" height="10" rx="5" fill="#334155" stroke="#475569" />

        {/* Губки прикладываются в пяти точках по очереди */}
        {MEASURE_POINTS.map((x, index) => (
          <g
            key={`jaw-${x}`}
            className="v-mm4a-jaw"
            style={{ animationDelay: `${index * 2}s` }}
          >
            <rect x={x - 11} y="46" width="4" height="30" fill="#64748b" />
            <rect x={x + 7} y="46" width="4" height="30" fill="#64748b" />
            <line x1={x} y1="54" x2={x} y2="74" stroke="#f59e0b" strokeWidth="1.1" />
          </g>
        ))}


        {/* Столбик показаний: выезжают одно за другим */}
        {READINGS.map((reading, index) => (
          <text
            key={reading.value + reading.y}
            x="216"
            y={reading.y}
            fontSize="9"
            fill="#e2e8f0"
            className="v-mm4a-value"
            style={{ animationDelay: `${index * 2}s` }}
          >
            {reading.value}
          </text>
        ))}

        {/* Среднее и плашка слайсера — финал */}
        <g className="v-mm4a-total">
          <text x="216" y="146" fontSize="9" fill="#34d399">
            среднее 1,75 мм
          </text>
          <rect x="24" y="106" width="168" height="40" rx="4" fill="#0f172a" />
          <text x="32" y="118" fontSize="7.5" fill="#94a3b8">
            Diameter
          </text>
          <text x="120" y="118" fontSize="7.5" fill="#94a3b8">
            слайсер
          </text>
          <rect x="28" y="124" width="80" height="20" rx="3" fill="#1e293b" stroke="#475569" />
          <text x="32" y="138" fontSize="14" fill="#34d399">
            1,75
          </text>
        </g>

        <text x="12" y="162" fontSize="7.5" fill="#fbbf24">
          если 1,72 — внеси в слайсер
        </text>
      </svg>
    </VisualWrapper>
  );
}
