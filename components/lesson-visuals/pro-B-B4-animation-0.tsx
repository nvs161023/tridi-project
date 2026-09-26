import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Klipper и скорость — следствие из content урока: Marlin считает на слабом
 * чипе, Klipper — на Raspberry Pi, а Input Shaper гасит вибрации. Обе стенки
 * печатаются одновременно, но по-разному: верхняя растёт рывками и с волной
 * («звоном») на поверхности, нижняя — ровно и с прямой кромкой.
 *
 * От «Теплового барьера» и «PEI при нагреве» отличается предметом: там процессы
 * внутри узлов, здесь результат печати — то, что видно на напечатанной стенке.
 *
 * Анимация 6 с, по кругу: обе стенки набирают ширину заново, разница видна в
 * самом ходе роста. При prefers-reduced-motion обе стенки показаны готовыми —
 * сравнение волны и ровной кромки остаётся.
 *
 * Классы с префиксом v-pb4a: <style> внутри SVG действует на всю страницу.
 */
export function ProB4Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация: стенка, напечатанная на слабом чипе Marlin, растёт рывками и получается с волной, а с Klipper на Raspberry Pi и Input Shaper та же стенка растёт ровно и выходит с прямой кромкой"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-pb4a-slow { animation: v-pb4a-grow 6s steps(6, end) infinite; transform-origin: 104px 64px; }
          .v-pb4a-fast { animation: v-pb4a-grow 6s ease-in-out infinite; transform-origin: 104px 128px; }
          @keyframes v-pb4a-grow {
            from { transform: scaleX(0.04); }
            to { transform: scaleX(1); }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-pb4a-slow, .v-pb4a-fast { animation: none; transform: scaleX(1); }
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

        <text x="14" y="22" fontSize="10" fill="#e2e8f0">
          одинаковая печать — разный расчёт
        </text>

        {/* Стенка от Marlin: растёт рывками, на кромке волна */}
        <g className="v-pb4a-slow">
          <path
            d="M104,40 L296,40 Q302,46 296,52 Q290,58 296,64 Q302,70 296,76 Q290,82 296,88 L104,88 Z"
            fill="#1e3a5f"
            stroke="#38bdf8"
          />
        </g>

        {/* Стенка от Klipper с Input Shaper: ровный рост и прямая кромка */}
        <g className="v-pb4a-fast">
          <rect x="104" y="104" width="196" height="48" fill="#1e3a5f" stroke="#34d399" />
        </g>

        <text x="14" y="46" fontSize="10" fontWeight="bold" fill="#93c5fd">
          Marlin
        </text>
        <text x="14" y="64" fontSize="10" fill="#93c5fd">
          слабый чип
        </text>
        <text x="14" y="82" fontSize="10" fill="#fca5a5">
          звон на стенке
        </text>

        <text x="14" y="110" fontSize="10" fontWeight="bold" fill="#6ee7b7">
          Klipper
        </text>
        <text x="14" y="128" fontSize="10" fill="#6ee7b7">
          Raspberry Pi
        </text>
        <text x="14" y="146" fontSize="10" fill="#6ee7b7">
          ход ровный
        </text>

        <text x="14" y="172" fontSize="10" fill="#94a3b8">
          Input Shaper — компенсация вибраций
        </text>
      </svg>
    </VisualWrapper>
  );
}
