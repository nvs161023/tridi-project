import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Четыре параллельных прохода: шаг 32 при ширине полосы 64 — перекрытие 50%. */
const PASSES = [36, 68, 100, 132];

/** Профиль полосы: мягкие края и плотное ядро. */
const PASS_EDGE = 16;
const PASS_CORE = 32;

/**
 * Покраска аэрографом: четыре параллельных прохода ложатся на деталь с
 * перекрытием в половину ширины, мягкие края сливаются без полос, в финале
 * поверх появляется ровный слой.
 *
 * Ровно по content урока: «Равномерный слой без следов. В отличие от кисти — нет
 * полос» и по text: «Аэрограф 0,3 мм + компрессор 1,5–2,5 бар».
 *
 * От K2-image-1 (зоны покрытия на детали) отличается картиной: там статичные зоны
 * «грунт, краска, лак» с подписями, здесь движение — проходы ложатся один за
 * другим и сливаются. От G-G3 (горячее сопло выглаживает верхний слой) — тем, что
 * здесь холодное распыление краски, а не глажка пластика.
 *
 * Анимация 8 с, по кругу: проходы проявляются слева направо, каждый тянется сверху
 * вниз, к концу перекрытия смыкаются в ровный слой. При prefers-reduced-motion
 * показан готовый ровный слой.
 *
 * Классы с префиксом v-mm6a: <style> внутри SVG действует на всю страницу.
 */
export function ProMM6Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация покраски: четыре параллельных прохода аэрографа ложатся на деталь слева направо, каждый тянется сверху вниз, мягкие края перекрываются на половину и смыкаются без стыков, в финале поверх появляется ровный слой; у сопла маркеры 0,3 мм и 1,5–2,5 бар, внизу подпись, что кистью остаются полосы"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-mm6a-pass {
            animation: v-mm6a-pass 8s ease-in-out infinite;
            animation-fill-mode: backwards;
            transform-box: fill-box;
            transform-origin: top;
          }
          .v-mm6a-final { animation: v-mm6a-final 8s ease-in-out infinite; }
          @keyframes v-mm6a-pass {
            0% { opacity: 0; transform: scaleY(0); }
            10% { opacity: 1; transform: scaleY(1); }
            100% { opacity: 1; transform: scaleY(1); }
          }
          @keyframes v-mm6a-final {
            0%, 84% { opacity: 0; }
            94%, 100% { opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-mm6a-pass { animation: none; opacity: 1; transform: none; }
            .v-mm6a-final { animation: none; opacity: 1; }
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
          Покраска: проходы с перекрытием
        </text>

        {/* Деталь, которую красят */}
        <rect x="32" y="64" width="164" height="96" rx="4" fill="#334155" />

        {/* Четыре прохода: края полупрозрачные, ядра плотнее — стыков не видно */}
        {PASSES.map((x, index) => (
          <g
            key={`pass-${x}`}
            className="v-mm6a-pass"
            style={{ animationDelay: `${index * 1.55}s` }}
          >
            <rect x={x} y="68" width={PASS_EDGE} height="88" fill="#38bdf8" fillOpacity="0.12" />
            <rect
              x={x + PASS_EDGE}
              y="68"
              width={PASS_CORE}
              height="88"
              fill="#38bdf8"
              fillOpacity="0.3"
            />
            <rect
              x={x + PASS_EDGE + PASS_CORE}
              y="68"
              width={PASS_EDGE}
              height="88"
              fill="#38bdf8"
              fillOpacity="0.12"
            />
          </g>
        ))}

        {/* Финальный ровный слой поверх перекрытий */}
        <rect
          x="36"
          y="68"
          width="160"
          height="88"
          fill="#38bdf8"
          fillOpacity="0.16"
          className="v-mm6a-final"
        />


        {/* Аэрограф над деталью: бачок, корпус, сопло и факел */}
        <rect x="24" y="28" width="16" height="14" rx="2" fill="#334155" stroke="#475569" />
        <rect x="24" y="42" width="40" height="10" rx="3" fill="#334155" stroke="#475569" />
        <polygon points="64,43 78,45 78,49 64,51" fill="#94a3b8" />
        <polygon points="78,32 104,50 104,62 78,56" fill="#38bdf8" fillOpacity="0.18" />

        <text x="112" y="34" fontSize="7.5" fill="#7dd3fc">
          0,3 мм
        </text>
        <text x="112" y="48" fontSize="7.5" fill="#7dd3fc">
          1,5–2,5 бар
        </text>
        <text x="224" y="100" fontSize="7.5" fill="#e2e8f0">
          перекрытие 50%
        </text>
        <text x="224" y="116" fontSize="7.5" fill="#94a3b8">
          слой без стыков
        </text>
        <text x="12" y="174" fontSize="7.5" fill="#94a3b8">
          кистью остаются полосы
        </text>
      </svg>
    </VisualWrapper>
  );
}
