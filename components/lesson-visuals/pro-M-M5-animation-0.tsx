import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Пузырьки у поверхности: центр и радиус — рождаются и схлопываются. */
const BUBBLES = [
  { cx: 48, cy: 84, r: 5 },
  { cx: 70, cy: 74, r: 4 },
  { cx: 94, cy: 88, r: 6 },
  { cx: 118, cy: 72, r: 4 },
  { cx: 140, cy: 86, r: 5 },
  { cx: 162, cy: 76, r: 4 },
  { cx: 82, cy: 98, r: 3.5 },
  { cx: 152, cy: 100, r: 3.5 },
];

/** Пятна нагара на поверхности, которые сбивает кавитация. */
const DIRT_SPOTS = [44, 76, 108, 140, 172];

/** Отлетевшие частицы грязи: всплывают вверх от поверхности. */
const DIRT_BITS = [
  [56, 92],
  [88, 78],
  [112, 86],
  [134, 70],
  [158, 90],
  [176, 64],
];

/**
 * Кавитация: крупный план поверхности детали в жидкости. Пузырьки рождаются у
 * поверхности, схлопываются со вспышкой, пятна нагара отрываются и всплывают
 * вверх; справа панель с частотой и таймером.
 *
 * Ровно по content урока: «Пузырьки образуются и схлопываются, очищая
 * поверхность» и по text: «Ультразвук создаёт кавитацию — пузырьки очищают
 * поверхность».
 *
 * От E2-E2-3-animation-0 (пузырь пара в сопле оставляет поры в стенке) отличается
 * и предметом, и результатом: здесь пузырьки — рабочий инструмент очистки, они
 * сбивают грязь с поверхности в мойке, ничего не разрушая.
 *
 * Анимация 6 с, по кругу: пузырьки всплывают от поверхности и лопаются со
 * вспышкой, частицы нагара отрываются и поднимаются, пятна на поверхности
 * светлеют. При prefers-reduced-motion показан момент вспышки и отрыва.
 *
 * Классы с префиксом v-mm5a: <style> внутри SVG действует на всю страницу.
 */
export function ProMM5Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация кавитации: у поверхности детали в жидкости рождаются пузырьки, схлопываются со вспышкой, пятна нагара сбиваются, оторванные частицы грязи всплывают вверх; справа панель с частотой 40 килогерц и таймером 3 минуты"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-mm5a-bubble { animation: v-mm5a-pop 6s ease-in-out infinite; animation-fill-mode: backwards; }
          .v-mm5a-flash { animation: v-mm5a-flash 6s linear infinite; animation-fill-mode: backwards; }
          .v-mm5a-bit { animation: v-mm5a-rise 6s ease-in infinite; animation-fill-mode: backwards; }
          .v-mm5a-dirt { animation: v-mm5a-clean 6s ease-in-out infinite; }
          @keyframes v-mm5a-pop {
            0% { opacity: 0; transform: scale(0.4); }
            22% { opacity: 1; transform: scale(1); }
            44% { opacity: 1; transform: scale(1.05); }
            56% { opacity: 0.15; transform: scale(0.6); }
            100% { opacity: 0; transform: scale(0.4); }
          }
          @keyframes v-mm5a-flash {
            0%, 44% { opacity: 0; }
            52% { opacity: 1; }
            60% { opacity: 0; }
            100% { opacity: 0; }
          }
          @keyframes v-mm5a-rise {
            0% { opacity: 0; transform: translateY(4px); }
            20% { opacity: 1; }
            70% { opacity: 0.6; }
            100% { opacity: 0; transform: translateY(-46px); }
          }
          @keyframes v-mm5a-clean {
            0% { opacity: 0.9; }
            45% { opacity: 0.45; }
            70%, 100% { opacity: 0.95; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-mm5a-bubble { animation: none; opacity: 0.9; }
            .v-mm5a-flash { animation: none; opacity: 1; }
            .v-mm5a-bit { animation: none; opacity: 0.7; }
            .v-mm5a-dirt { animation: none; opacity: 0.5; }
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
          Кавитация: пузырьки снимают грязь
        </text>

        {/* Жидкость в ванне и поверхность детали */}
        <rect x="12" y="28" width="296" height="148" rx="6" fill="#1e3a5f" />
        <rect x="24" y="110" width="164" height="34" rx="4" fill="#475569" />

        {/* Пятна нагара на поверхности */}
        {DIRT_SPOTS.map((cx) => (
          <ellipse
            key={`spot-${cx}`}
            cx={cx}
            cy="110"
            rx="9"
            ry="4"
            fill="#a16207"
            className="v-mm5a-dirt"
          />
        ))}

        {/* Пузырьки и вспышки при схлопывании */}
        {BUBBLES.map(({ cx, cy, r }, index) => (
          <g key={`bubble-${cx}-${cy}`}>
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="#7dd3fc"
              strokeWidth="1.2"
              className="v-mm5a-bubble"
              style={{ animationDelay: `${index * 0.5}s` }}
            />
            <circle
              cx={cx}
              cy={cy}
              r="2.2"
              fill="#e0f2fe"
              className="v-mm5a-flash"
              style={{ animationDelay: `${index * 0.5}s` }}
            />
          </g>
        ))}

        {/* Оторванная грязь всплывает вверх */}
        {DIRT_BITS.map(([cx, cy], index) => (
          <circle
            key={`bit-${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r="1.8"
            fill="#a16207"
            className="v-mm5a-bit"
            style={{ animationDelay: `${index * 0.45}s` }}
          />
        ))}

        {/* Панель: частота и таймер */}
        <rect x="204" y="112" width="100" height="52" rx="4" fill="#0f172a" />
        <text x="212" y="136" fontSize="14" fill="#7dd3fc">
          40 кГц
        </text>
        <text x="212" y="152" fontSize="12" fill="#e2e8f0">
          таймер 3 мин
        </text>

        <text x="12" y="44" fontSize="7.5" fill="#e2e8f0">
          пузырьки схлопываются
        </text>
        <text x="12" y="158" fontSize="7.5" fill="#e2e8f0">
          поверхность детали
        </text>
        <text x="100" y="172" fontSize="7.5" fill="#94a3b8">
          грязь всплывает вверх
        </text>
      </svg>
    </VisualWrapper>
  );
}
